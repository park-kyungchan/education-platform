import {createHash,randomUUID} from 'node:crypto';
import {readFileSync,lstatSync,realpathSync,closeSync,fsyncSync,mkdirSync,openSync,writeSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {z} from 'zod';
import {readPinnedLocalBytes} from './item-label-store.ts';
import {dailyRecordObservationSchema,studentMetadataBatchSchema,type DailyRecordReadBackend,type DailyRecordWriteBackend,type DailyRecordObservation,type StudentMetadataBatch,type StudentMetadataObservation,studentMetadataGetSchema,type StudentMetadataGet,type DailyRecordSaveFieldStatus} from './dailyrecord.ts';
import {createDailyRecordSaveAdmission,liveSaveRequestEvidence,type DailyRecordSaveAdmission,type DailyRecordSaveApproval} from './dailyrecord-save-admission.ts';
import type {DailyRecordField} from './dailyrecord-context.ts';
import type {DailyRecordScope} from './dailyrecord-context.ts';
import {ownerAdmissionSchema,isDateAdmitted,type OwnerAdmission} from './owner-admission.ts';
import {metadataAdmissionSchema,metadataDateAdmitted,type MetadataAdmission} from './metadata-admission.ts';
import {AcademyReadFailure} from './read-failure.ts';
import {StudentNameNotAdmitted} from './student-resolver.ts';
import {itemAnswerLookupSchema} from './item-answer-lookup.ts';
import type {DailyRecordReadAdmission} from './dailyrecord-read.ts';

const home='/opt/data/profiles/dc-gang-a-dev';
const key=z.string().regex(/^[1-9][0-9]{0,15}$/),hash=z.string().regex(/^[a-f0-9]{64}$/);
export const nativeDailyRecordConfigSchema=z.object({schemaVersion:z.literal('academy.native-dailyrecord-read/1'),
  sourceBundlePath:z.string().startsWith('/'),sourceBundleSha256:hash,
  date:z.iso.date(),students:z.array(z.object({studentId:key,displayName:z.string().min(1).max(200)}).strict()).min(1).max(8),
}).strict().superRefine((v,c)=>{
  if(new Set(v.students.map(s=>s.studentId)).size!==v.students.length||new Set(v.students.map(s=>s.displayName)).size!==v.students.length)
    c.addIssue({code:'custom',message:'unique_admitted_students_required'});
});
type Target={studentName:string;date:string;groupId:string;teacherKey:string;studentKey:string;courseKey:string;recordKey:string;membershipKey:string};
type Row=Target&{fields:Record<string,string>};
interface SourcePort {
  authenticate(credential:{username:string;password:string}):Promise<unknown>;
  discoverDayRecordGroups(input:{teacherLabel:string;date:string}):Promise<{groups:{groupId:string}[]}>;
  execute(input:unknown):Promise<{dayRecords:Row[]}>;
  journalState(target:Target):Promise<{target:Target;fields:Record<string,string>;previousRecordKey:string;previousDate:string;wireDigest:string}>;
  /** Owner client write port (Education AcademyHttpClient.applyJournalAction).
   * Optional: read-only bundles omit it and saves stay fail-closed. */
  applyJournalAction?(action:{attemptId:string;target:Target;field:string;effectRecordKey:string;before:string;after:string;wireDigest:string},
    admission:{consumeApproval:(action:Readonly<{attemptId:string;target:Target;field:string;effectRecordKey:string;before:string;after:string;wireDigest:string}>)=>Promise<{status:'verified';actionDigest:string}|{status:'rejected'}>})
    :Promise<{status:DailyRecordSaveFieldStatus;transport:'returned'|'uncertain'|'not_invoked'}>;
  close():void;
  searchStudentPaperMetadata?(input:{teacherLabel:string;studentName:string;studentKey:string;period:{from:string;through:string}}):Promise<unknown>;
  searchDailyTestMetadata?(input:{teacherLabel:string;studentName:string;studentKey:string}):Promise<unknown>;
  inspectDailyTestInventory?(input:{teacherLabel:string;studentName:string;studentKey:string}):Promise<unknown>;
  readDailyTestHistory?(input:{teacherLabel:string;studentName:string;studentKey:string;periods:string[]}):Promise<unknown>;
  lookupPrintedPaperMetadata?(input:{teacherLabel:string;studentName:string;studentKey:string;paperCode:string;period:{from:string;through:string}}):Promise<unknown>;
  /** Name-only student search (REA contract 2026-10-26). The DT result servlet is keyed
   * on the wire by `{sort_date, stu_name}` alone; implementations must neither require nor
   * send a student key. Key/name equality is verified by the projection layer, never as
   * request input. No sequential key probing, before or after. */
  searchStudentsByName?(input:{teacherLabel:string;studentName:string}):Promise<unknown>;
}
type Admission={teacherId:string;teacherLabel:string;date:string;students:{studentId:string;displayName:string}[];sourceBundleSha256:string};
const fields=['progress','homework','lessonMemo','attendance','dailyTestAssessment','previousHomeworkAssessment'] as const;
const targetOf=(row:Target):Target=>Object.fromEntries(['studentName','date','groupId','teacherKey','studentKey','courseKey','recordKey','membershipKey'].map(k=>[k,row[k as keyof Target]])) as Target;
const observationTarget=(t:Target):DailyRecordObservation['target']=>({sourceNamespace:'academy.lms.dayrecord',teacherId:t.teacherKey,studentId:t.studentKey,lessonDate:t.date,courseId:t.courseKey,membershipId:t.membershipKey,recordId:t.recordKey});

const sourceInstant=z.iso.datetime({offset:true}),sourcePeriod=z.object({from:z.iso.date(),to:z.iso.date()});
const sourceTitle=z.string().max(2000).optional();
// These schemas deliberately strip every unlisted key. Page diagnostics, field inventories,
// scripts/handlers, controls, navigation and whole TR cells never cross the MCP boundary.
const metadataRow=z.object({studentKey:key,studentName:z.string().min(1).max(200),paperKey:key,attemptKey:key,
  sourceRowId:z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).nullable(),sourceScore:z.number().finite().nullable(),
  titles:z.object({testpageName:sourceTitle,testPageName:sourceTitle,pName:sourceTitle,examName:sourceTitle,title:sourceTitle,
    testName:sourceTitle,testingName:sourceTitle,printTestingName:sourceTitle,testTypeName:sourceTitle,applyDate:sourceTitle}),
});
const metadataRows=z.array(metadataRow).max(2000);
// Name-search result pairs. The wire (DtResultSearch rows) and the owner admission table
// both project to exactly this shape; every unlisted key is stripped before the
// exact-name rules run. Extra keys, missing keys and non-string pairs are unqualified.
const nameSearchPair=z.object({studentKey:key,studentName:z.string().min(1).max(200)}).strict();
const nameSearchPairs=z.array(nameSearchPair).max(200);
const metadataPage=z.object({rows:metadataRows,operation:z.enum(['UserBySearchTestResult','DtResultSearch']),page:z.literal(1),
  sourcePeriod:sourcePeriod.nullable(),observedAt:sourceInstant,coverage:z.literal('one_observed_student_search_page_not_complete_history'),
  generatedMembership:z.literal('unqualified'),fixedSourceFilter:z.object({sort_date:z.enum(['1','11','12','13','14','15','16'])}).optional(),
  expectedPaperDefinitions:z.literal('not_observed').optional(),
});
function projectStudentMetadata(query:StudentMetadataBatch['queries'][number],value:unknown,student:Admission['students'][number]):unknown{
  const checkRows=(rows:z.infer<typeof metadataRows>)=>{
    if(rows.some(row=>row.studentKey!==student.studentId||row.studentName!==student.displayName)
      ||new Set(rows.map(row=>JSON.stringify([row.paperKey,row.attemptKey]))).size!==rows.length)throw Error('native_metadata_row_identity_conflict');
  };
  const checkPeriod=(period:z.infer<typeof sourcePeriod>|null,requested:{from:string;through:string})=>{
    if(period?.from!==requested.from||period.to!==requested.through)throw Error('native_metadata_period_conflict');
  };
  const checkDaily=(page:z.infer<typeof metadataPage>,selector:string)=>{
    checkRows(page.rows);
    if(page.operation!=='DtResultSearch'||page.sourcePeriod!==null||page.fixedSourceFilter?.sort_date!==selector)throw Error('native_metadata_selector_conflict');
  };
  if(query.kind==='daily_history'){
    const history=z.object({status:z.literal('observed'),studentKey:key,studentName:z.string(),
      currentFilterQualification:z.object({observedAt:sourceInstant,selector:z.literal('1'),rows:metadataRows}),
      observations:z.array(metadataPage.extend({selector:z.enum(['11','12','13','14','15','16']),expectedPaperDefinitions:z.literal('not_observed')})).max(6),
      calendarBounds:z.literal('source_relative_labels_only_not_exact_calendar_bounds'),expectedPaperDefinitions:z.literal('not_observed'),
      coverage:z.literal('all_parsed_embedded_rows_on_each_observed_response_not_complete_history'),
    }).parse(value);
    if(history.studentKey!==student.studentId||history.studentName!==student.displayName||history.observations.length!==query.periods.length)throw Error('native_metadata_history_scope_conflict');
    checkRows(history.currentFilterQualification.rows);
    history.observations.forEach((page,i)=>{if(page.selector!==query.periods[i])throw Error('native_metadata_selector_conflict');checkDaily(page,page.selector);});
    return history;
  }
  if(query.kind==='printed_paper_metadata'){
    const lookup=z.object({paperCode:z.string(),paperKey:key,status:z.enum(['observed','not_found_in_scope']),rows:metadataRows,
      sourcePeriod:sourcePeriod.nullable(),page:z.literal(1),observedAt:sourceInstant,coverage:z.literal('observed_source_pages_not_complete_history'),
      matchedSourceFamily:z.enum(['student_assessment','daily_zero']).nullable(),generatedMembership:z.literal('unqualified'),
      searchedSources:z.array(z.object({family:z.enum(['student_assessment','daily_zero']),operation:z.enum(['UserBySearchTestResult','DtResultSearch']),
        page:z.literal(1),sourcePeriod:sourcePeriod.nullable(),requestedPeriodApplied:z.boolean(),coverage:z.literal('one_observed_student_search_page_not_complete_history'),observedAt:sourceInstant})).min(1).max(2),
    }).parse(value);
    checkRows(lookup.rows);
    if(lookup.paperCode!==query.paperCode||lookup.rows.some(row=>row.paperKey!==lookup.paperKey)
      ||(lookup.status==='observed')!==(lookup.rows.length>0)||(lookup.matchedSourceFamily!==null)!==(lookup.rows.length>0))throw Error('native_metadata_paper_conflict');
    lookup.searchedSources.forEach((source,i)=>{
      if(i===0){if(source.family!=='student_assessment'||source.operation!=='UserBySearchTestResult'||!source.requestedPeriodApplied)throw Error('native_metadata_lookup_scope_conflict');checkPeriod(source.sourcePeriod,query.period);}
      else if(source.family!=='daily_zero'||source.operation!=='DtResultSearch'||source.requestedPeriodApplied||source.sourcePeriod!==null)throw Error('native_metadata_lookup_scope_conflict');
    });
    if(lookup.matchedSourceFamily==='daily_zero'){if(lookup.sourcePeriod!==null||lookup.searchedSources.length!==2)throw Error('native_metadata_lookup_scope_conflict');}
    else checkPeriod(lookup.sourcePeriod,query.period);
    return lookup;
  }
  const page=metadataPage.parse(value);
  if(query.kind==='student_papers'){
    checkRows(page.rows);checkPeriod(page.sourcePeriod,query.period);
    if(page.operation!=='UserBySearchTestResult'||page.fixedSourceFilter!==undefined||page.expectedPaperDefinitions!==undefined)throw Error('native_metadata_operation_conflict');
  }else{
    checkDaily(page,'1');
    if(query.kind==='daily_inventory'&&page.expectedPaperDefinitions!=='not_observed')throw Error('native_metadata_inventory_conflict');
  }
  return page;
}

/** Consumer transport glue. The existing Education client owns authentication, parsing,
 * source/wire qualification and independent occurrence binding. This port never writes. */
export class NativeDailyRecordBackend implements DailyRecordReadBackend,DailyRecordWriteBackend {
  #ready:Promise<unknown>|undefined;
  #sourceResolved=new Map<string,{studentId:string;displayName:string;lessonDate?:string;at:number}>();
  constructor(readonly client:SourcePort,readonly admission:Admission,readonly credential:()=>{username:string;password:string},readonly ownerAdmission:OwnerAdmission|null=null,
    readonly managedNames:ReadonlySet<string>=new Set(admission.students.map(s=>s.displayName)),readonly metadataAdmission:MetadataAdmission|null=null,
    readonly saveApproval:DailyRecordSaveApproval|null=null){
    if(metadataAdmission){this.metadataAdmission=metadataAdmissionSchema.parse(metadataAdmission);if(metadataAdmission.teacherId!==admission.teacherId)throw Error('native_metadata_scope_refused');}
    if(ownerAdmission){
      ownerAdmissionSchema.parse(ownerAdmission);
      if(ownerAdmission.teacherId!==admission.teacherId||!isDateAdmitted(admission.date,ownerAdmission))throw Error('native_dailyrecord_owner_admission_mismatch');
    }
  }
  saveConfigured():boolean{return this.saveApproval!==null&&typeof this.client.applyJournalAction==='function';}
  /** One serialized write batch on the already-authenticated owner client.
   * The client re-reads the exact before-state, consumes the launch-pinned
   * admission once per field, writes once and reads back; the first
   * non-settled field stops the batch with the rest not attempted. */
  async saveDailyRecord(scope:Readonly<DailyRecordScope>,patches:readonly {field:DailyRecordField;value:string;before:string;wireDigest:string}[]){
    if(!this.saveConfigured())throw Error('dailyrecord_save_backend_not_configured');
    const student=this.admission.students.find(s=>s.studentId===scope.studentId);
    if(scope.sourceNamespace!=='academy.lms.dayrecord'||scope.teacherId!==this.admission.teacherId
      ||!(this.ownerAdmission?isDateAdmitted(scope.lessonDate,this.ownerAdmission):scope.lessonDate===this.admission.date)||!student)throw Error('native_dailyrecord_scope_refused');
    await this.#authenticate();
    const selector=await this.client.discoverDayRecordGroups({teacherLabel:this.admission.teacherLabel,date:scope.lessonDate});
    const result=await this.client.execute({family:'day_record',teacherLabel:this.admission.teacherLabel,date:scope.lessonDate,
      groupIds:selector.groups.map(g=>g.groupId),studentNames:[student.displayName]});
    if(result.dayRecords.length!==1)throw Error('native_dailyrecord_occurrence_unverified');
    const row=result.dayRecords[0]!;
    if(row.studentKey!==scope.studentId||row.studentName!==student.displayName||row.teacherKey!==scope.teacherId||row.date!==scope.lessonDate)
      throw Error('native_dailyrecord_identity_conflict');
    const state=await this.client.journalState(targetOf(row));
    if(JSON.stringify(targetOf(state.target))!==JSON.stringify(targetOf(row)))throw Error('native_dailyrecord_state_conflict');
    // Bind dispatch to the reviewed before-state: any drift refuses the
    // whole batch before a single write or admission consumption.
    if(patches.some(p=>p.wireDigest!==state.wireDigest||state.fields[p.field]!==p.before))
      return patches.map(p=>({field:p.field,status:'before_drift' as const,dispatched:false}));
    const fields:{field:DailyRecordField;status:DailyRecordSaveFieldStatus;dispatched:boolean}[]=[];
    for(let i=0;i<patches.length;i++){
      const patch=patches[i]!;
      const action={attemptId:randomUUID(),target:targetOf(row),field:patch.field,
        effectRecordKey:patch.field==='previousHomeworkAssessment'?state.previousRecordKey:row.recordKey,
        before:patch.before,after:patch.value,wireDigest:state.wireDigest};
      let settled:{status:DailyRecordSaveFieldStatus;dispatched:boolean};
      try{
        const result=await this.client.applyJournalAction!(action,this.saveApproval!);
        settled={status:result.status,dispatched:result.transport!=='not_invoked'};
      }catch{
        // The client may have dispatched before throwing; report the field
        // as unresolved instead of denying a possible write upstream.
        settled={status:'unresolved',dispatched:true};
      }
      fields.push({field:patch.field,...settled});
      if(settled.status!=='persisted'&&settled.status!=='noop'){
        for(let j=i+1;j<patches.length;j++)fields.push({field:patches[j]!.field,status:'not_attempted',dispatched:false});
        break;
      }
    }
    return fields;
  }
  readRoutingAdmission():DailyRecordReadAdmission{
    // Discovery reflects only this exact owner launch. It does not widen its date or student scope.
    return {sourceNamespace:'academy.lms.dayrecord' as const,teacherId:this.admission.teacherId,
      allowedFrom:this.ownerAdmission ? this.ownerAdmission.allowedFrom : this.admission.date,
      allowedThrough:this.ownerAdmission ? this.ownerAdmission.allowedThrough : this.admission.date,
      ...(this.ownerAdmission?.schemaVersion==='academy.owner-admission/2'?{studentScope:this.ownerAdmission.studentScope??'configured'}:{})};
  }
  #authenticate(){
    // One retained promise for every read family, including synchronous credential/auth failures.
    return this.#ready??=Promise.resolve().then(()=>this.client.authenticate(this.credential())).catch(()=>{throw new AcademyReadFailure('authentication','source_authentication_failed','src/native-dailyrecord-backend.ts:#authenticate');});
  }
  async readItemAnswers(labels:readonly string[]):Promise<unknown>{
    const input=itemAnswerLookupSchema.parse({labels:[...labels],purpose:'Owner-scoped item answer read',currentRequestRef:'native-item-answer'});
    await this.#authenticate();
    return this.client.execute({family:'item_answer',teacherLabel:this.admission.teacherLabel,teacherKey:this.admission.teacherId,
      lectureKeys:input.labels,answerReadAdmission:true});
  }
  async readStudentMetadata(value:Readonly<StudentMetadataBatch>):Promise<StudentMetadataObservation>{
    const input=studentMetadataBatchSchema.parse(value),scope=input.scope;
    const student=this.admission.students.find(s=>s.studentId===scope.studentId);
    if(scope.teacherId!==this.admission.teacherId||!student)throw Error('native_metadata_scope_refused');
    if(this.metadataAdmission)this.#authorizeMetadata(input);
    else if(scope.lessonDate!==this.admission.date)throw Error('native_metadata_scope_refused');
    return this.#readMetadata(input,student);
  }
  #authorizeMetadata(input:StudentMetadataBatch){
    const policy=this.metadataAdmission;
    // History always qualifies selector 1 before its requested periods; printed
    // lookup may fall back to that same DT selector. Admit every possible read.
    const selectors=(q:StudentMetadataBatch['queries'][number])=>q.kind==='daily_history'?['1',...q.periods]:q.kind==='student_papers'?[]:['1'];
    if(!policy||input.scope.teacherId!==policy.teacherId||!metadataDateAdmitted(input.scope.lessonDate,policy)
      ||input.queries.some(q=>!policy.operations.includes(q.kind)||('period' in q&&(!metadataDateAdmitted(q.period.from,policy)||!metadataDateAdmitted(q.period.through,policy)))
        ||selectors(q).some(selector=>!policy.relativeSelectors.includes(selector as MetadataAdmission['relativeSelectors'][number]))))
      throw Error('metadata_namespace_not_admitted');
  }
  async readStudentMetadataByName(value:Readonly<StudentMetadataGet>):Promise<StudentMetadataObservation>{
    const input=studentMetadataGetSchema.parse(value),policy=this.metadataAdmission;
    // Namespace authorization precedes authentication and the dated identity read.
    const provisional={...input,scope:{sourceNamespace:'academy.lms.metadata' as const,teacherId:this.admission.teacherId,studentId:'1',lessonDate:input.lessonDate}};
    this.#authorizeMetadata(provisional);
    const configured=this.admission.students.find(s=>s.displayName===input.displayName);
    if(!this.managedNames.has(input.displayName)||(!configured&&policy!.studentScope!=='source_verified'))throw Error('metadata_namespace_not_admitted');
    this.#requireMetadataMethods(input.queries);
    await this.#authenticate();
    const selector=await this.client.discoverDayRecordGroups({teacherLabel:this.admission.teacherLabel,date:input.lessonDate});
    const found=await this.client.execute({family:'day_record',teacherLabel:this.admission.teacherLabel,date:input.lessonDate,groupIds:selector.groups.map(g=>g.groupId),studentNames:[input.displayName]});
    if(!Array.isArray(found.dayRecords)||found.dayRecords.some(r=>r.teacherKey!==this.admission.teacherId||r.studentName!==input.displayName||r.date!==input.lessonDate))throw Error('native_dated_name_scope_conflict');
    if(found.dayRecords.length>1)throw Error('native_dated_name_ambiguous');
    if(found.dayRecords.length!==1)throw Error('native_dailyrecord_occurrence_unverified');
    const row=found.dayRecords[0]!,student={studentId:key.parse(row.studentKey),displayName:input.displayName};
    if(configured&&configured.studentId!==student.studentId)throw Error('native_dated_name_scope_conflict');
    // No caller proof or cross-process cache. This student is local to this batch.
    return this.#readMetadata({purpose:input.purpose,currentRequestRef:input.currentRequestRef,scope:{...provisional.scope,studentId:student.studentId},queries:input.queries},student);
  }
  #requireMetadataMethods(queries:StudentMetadataBatch['queries']){
    const methods={student_papers:'searchStudentPaperMetadata',daily_metadata:'searchDailyTestMetadata',daily_inventory:'inspectDailyTestInventory',daily_history:'readDailyTestHistory',printed_paper_metadata:'lookupPrintedPaperMetadata'} as const;
    for(const query of queries)if(typeof this.client[methods[query.kind]]!=='function')throw Error('native_metadata_method_unavailable');
  }
  async #readMetadata(input:StudentMetadataBatch,student:Admission['students'][number]):Promise<StudentMetadataObservation>{
    const scope=input.scope;
    this.#requireMetadataMethods(input.queries);
    await this.#authenticate();
    const target={teacherLabel:this.admission.teacherLabel,studentName:student.displayName,studentKey:student.studentId};
    const results:StudentMetadataObservation['results']=[];
    for(const query of input.queries){
      let observation:unknown;
      switch(query.kind){
        case 'student_papers':observation=await this.client.searchStudentPaperMetadata!({...target,period:query.period});break;
        case 'daily_metadata':observation=await this.client.searchDailyTestMetadata!(target);break;
        case 'daily_inventory':observation=await this.client.inspectDailyTestInventory!(target);break;
        case 'daily_history':observation=await this.client.readDailyTestHistory!({...target,periods:query.periods});break;
        case 'printed_paper_metadata':observation=await this.client.lookupPrintedPaperMetadata!({...target,paperCode:query.paperCode,period:query.period});break;
      }
      results.push({query,observation:projectStudentMetadata(query,observation,student)});
    }
    return {scope,results};
  }
  /** Name-only search feeding the service-layer resolver. Returns projected
   * `{studentKey, studentName}` pairs; exact-name rules (zero/multi/mismatch
   * unavailable, never a guess, no sequential probing) run in the service.
   * Live wire first via the owner bundle port when present (name-only input,
   * no key upfront); otherwise the owner-issued admission table in this
   * process. No network and no secret use on the admission path; the later
   * intake still verifies key+name against the live wire. */
  async searchStudentsByName(exactName: string,requestRef?:string,lessonDate?:string): Promise<unknown>{
    if(requestRef)this.#sourceResolved.delete(requestRef);
    if(this.ownerAdmission?.schemaVersion==='academy.owner-admission/2'&&this.ownerAdmission.studentScope==='source_verified'
      &&!this.managedNames.has(exactName))throw new StudentNameNotAdmitted();
    if(lessonDate && this.ownerAdmission?.schemaVersion==='academy.owner-admission/2'&&this.ownerAdmission.studentScope==='source_verified'){
      if(!isDateAdmitted(lessonDate,this.ownerAdmission))throw Error('native_dailyrecord_scope_refused');
      await this.#authenticate();
      const selector=await this.client.discoverDayRecordGroups({teacherLabel:this.admission.teacherLabel,date:lessonDate});
      const found=await this.client.execute({family:'day_record',teacherLabel:this.admission.teacherLabel,date:lessonDate,
        groupIds:selector.groups.map(g=>g.groupId),studentNames:[exactName]});
      if(Array.isArray(found.dayRecords)&&found.dayRecords.length>1)throw Error('native_dated_name_ambiguous');
      if(!Array.isArray(found.dayRecords)||found.dayRecords.some(row=>row.studentName!==exactName||row.date!==lessonDate||row.teacherKey!==this.admission.teacherId))
        throw Error('native_dated_name_scope_conflict');
      return this.#rememberResolved(found.dayRecords.map(row=>({studentKey:row.studentKey,studentName:row.studentName})),exactName,requestRef,lessonDate);
    }
    if(typeof this.client.searchStudentsByName==='function'){
      // Name lookup uses the same owner session as subsequent source reads.
      // Retain an authentication failure rather than replaying a login.
      await this.#authenticate();
      const raw=await this.client.searchStudentsByName({teacherLabel:this.admission.teacherLabel,studentName:exactName});
      if(!Array.isArray(raw))throw Error('native_name_search_unqualified_no_automatic_retry');
      const pairs=raw.map((row)=>{
        if(typeof row!=='object'||row===null)throw Error('native_name_search_unqualified_no_automatic_retry');
        const pair=row as Record<string,unknown>;
        return {studentKey:pair.studentKey,studentName:pair.studentName};
      });
      return this.#rememberResolved(pairs,exactName,requestRef);
    }
    const admitted = this.admission.students.filter((s)=>s.displayName===exactName)
      .map((s)=>({studentKey:s.studentId,studentName:s.displayName}));
    if(!admitted.length)throw new StudentNameNotAdmitted();
    return admitted;
  }
  #rememberResolved(raw:unknown,exactName:string,requestRef?:string,lessonDate?:string){
    const pairs=nameSearchPairs.parse(raw);
    const unique=new Map(pairs.filter(row=>row.studentName===exactName).map(row=>[row.studentKey,row]));
    if(this.ownerAdmission?.schemaVersion==='academy.owner-admission/2' && this.ownerAdmission.studentScope==='source_verified'
      && requestRef && pairs.every(row=>row.studentName===exactName) && unique.size===1){
      const row=[...unique.values()][0]!;
      this.#sourceResolved.set(requestRef,{studentId:row.studentKey,displayName:row.studentName,lessonDate,at:Date.now()});
      if(this.#sourceResolved.size>32)this.#sourceResolved.delete(this.#sourceResolved.keys().next().value!);
    }
    return pairs;
  }
  async readDailyRecord(scope:Readonly<DailyRecordScope>,requestRef?:string){
    const resolved=requestRef?this.#sourceResolved.get(requestRef):undefined;
    const sourceStudent=this.ownerAdmission?.schemaVersion==='academy.owner-admission/2' && this.ownerAdmission.studentScope==='source_verified'
      && resolved && resolved.studentId===scope.studentId && (!resolved.lessonDate||resolved.lessonDate===scope.lessonDate) && Date.now()-resolved.at>=0 && Date.now()-resolved.at<=300000 ? resolved : undefined;
    const student=this.admission.students.find(s=>s.studentId===scope.studentId)??sourceStudent;
    if(scope.sourceNamespace!=='academy.lms.dayrecord'||scope.teacherId!==this.admission.teacherId
      ||!(this.ownerAdmission?isDateAdmitted(scope.lessonDate,this.ownerAdmission):scope.lessonDate===this.admission.date)||!student)throw Error('native_dailyrecord_scope_refused');
    // Keep a failed authentication promise: subsequent calls must not retry login.
    await this.#authenticate();
    const selector=await this.client.discoverDayRecordGroups({teacherLabel:this.admission.teacherLabel,date:scope.lessonDate});
    const request={family:'day_record',teacherLabel:this.admission.teacherLabel,date:scope.lessonDate,
      groupIds:selector.groups.map(g=>g.groupId),studentNames:[student.displayName]};
    const result=await this.client.execute(request);
    if(result.dayRecords.length!==1)throw Error('native_dailyrecord_occurrence_unverified');
    const row=result.dayRecords[0]!;
    if(row.studentKey!==scope.studentId||row.studentName!==student.displayName||row.teacherKey!==scope.teacherId||row.date!==scope.lessonDate)
      throw Error('native_dailyrecord_identity_conflict');
    const state=await this.client.journalState(targetOf(row));
    if(JSON.stringify(targetOf(state.target))!==JSON.stringify(targetOf(row)))throw Error('native_dailyrecord_state_conflict');
    const previous=await this.client.execute({...request,date:state.previousDate,groupIds:[row.groupId]});
    if(previous.dayRecords.length!==1)throw Error('native_dailyrecord_previous_unverified');
    const prior=previous.dayRecords[0]!;
    if(prior.studentKey!==row.studentKey||prior.teacherKey!==row.teacherKey||prior.courseKey!==row.courseKey
      ||prior.membershipKey!==row.membershipKey||prior.recordKey!==state.previousRecordKey||prior.date!==state.previousDate)
      throw Error('native_dailyrecord_previous_conflict');
    const observedAt=new Date().toISOString(),ref='native-dayrecord-read:'+randomUUID();
    const tone=[prior.fields.progress,prior.fields.homework,prior.fields.lessonMemo].filter(Boolean).join('\n');
    const observation=dailyRecordObservationSchema.parse({scope,target:observationTarget(row),previousTarget:observationTarget(prior),observedAt,
      sourceRevision:createHash('sha256').update(this.admission.sourceBundleSha256+':'+state.wireDigest).digest('hex'),wireDigest:state.wireDigest,
      fields:Object.fromEntries(fields.map(field=>[field,typeof state.fields[field]==='string'
        ?{state:'known',value:state.fields[field],evidenceRefs:[ref+(field==='previousHomeworkAssessment'?':previous':':current')]}
        :{state:'unknown',reasonCode:'native_field_not_observed'}])),
      toneSamples:tone?[{target:observationTarget(prior),observedAt,text:tone,evidenceRefs:[ref+':previous']}]:[],transmissionState:'unknown'});
    return {status:'observed' as const,observation};
  }
}

/** Durable one-time consumption for save admissions: exclusive create + fsync
 * inside an owner-private directory; an existing record means already used. */
export function durableSaveConsumeOnce(storeDir:string){
  return async (key:string,record:Readonly<Record<string,unknown>>):Promise<boolean>=>{
    mkdirSync(storeDir,{recursive:true,mode:0o700});
    let fd:number;
    try{fd=openSync(resolve(storeDir,key+'.json'),'wx',0o600);}catch{return false;}
    try{writeSync(fd,JSON.stringify(record)+'\n');fsyncSync(fd);}finally{closeSync(fd);}
    return true;
  };
}
export async function nativeDailyRecordConfiguration(args:readonly string[],ownerAdmission:OwnerAdmission|null=null,metadataAdmission:MetadataAdmission|null=null,saveAdmission:DailyRecordSaveAdmission|null=null,saveStoreDir:string|null=null,saveRequestPath:string|null=null){
  if(!args.length)return null;
  if(args.length!==3||args[0]!=='--dailyrecord-native')throw Error('dailyrecord_native_arguments_invalid');
  if(process.getuid?.()!==10000||process.env.HERMES_HOME!==home)throw Error('native_dailyrecord_owner_required');
  const configPath=resolve(args[1]!),stat=lstatSync(configPath);
  if(!configPath.startsWith(home+'/artifacts/')||realpathSync(dirname(configPath))!==dirname(configPath)
    ||stat.uid!==10000||(stat.mode&0o077)!==0||!stat.isFile()||stat.isSymbolicLink())throw Error('native_dailyrecord_private_config_required');
  const pinned=await readPinnedLocalBytes(configPath,hash.parse(args[2]));
  const config=nativeDailyRecordConfigSchema.parse(JSON.parse(pinned.bytes.toString('utf8')));
  const owner=JSON.parse(readFileSync(home+'/academy/owner.json','utf8'));
  if(config.students.some(s=>!owner.expectedStudentNames.includes(s.displayName)))throw Error('native_dailyrecord_managed_student_required');
  const bundle=await readPinnedLocalBytes(config.sourceBundlePath,config.sourceBundleSha256);
  const jsdom='/opt/data/workspace/dc-gang-a/node_modules/jsdom/lib/api.js';
  const dependency=JSON.parse(readFileSync(resolve(jsdom,'../../package.json'),'utf8'));
  if(dependency.version!=='30.1.2')throw Error('native_dailyrecord_dependency_drift');
  const source=bundle.bytes.toString('utf8');
  if(source.split('from "jsdom"').length!==2)throw Error('native_dailyrecord_bundle_contract_rejected');
  // Import the exact verified bytes; never reopen a mutable source pathname for execution.
  const module=await import('data:text/javascript;base64,'+Buffer.from(source.replace('from "jsdom"','from '+JSON.stringify(pathToFileURL(jsdom).href))).toString('base64'));
  if(typeof module.AcademyHttpClient!=='function')throw Error('native_dailyrecord_client_required');
  const password=process.env.DC_ACADEMY_HTTP_PASSWORD;delete process.env.DC_ACADEMY_HTTP_PASSWORD;
  if(!password)throw Error('native_http_secret_required');
  const client=new module.AcademyHttpClient({teacherLabel:owner.teacherLabel,teacherKey:owner.teacherSourceKey,collegeKey:owner.collegeSourceKey}) as SourcePort;
  // Save stays fail-closed unless the launch pinned both an exact save
  // admission and its durable consumption store inside the owner home.
  let saveApproval:DailyRecordSaveApproval|null=null;
  if(saveAdmission||saveStoreDir||saveRequestPath){
    if(!saveAdmission||!saveStoreDir||!saveRequestPath||!saveStoreDir.startsWith(home+'/artifacts/')||!saveRequestPath.startsWith(home+'/artifacts/'))throw Error('dailyrecord_save_launch_incomplete');
    saveApproval=createDailyRecordSaveAdmission(saveAdmission,{
      readCurrentRequest:liveSaveRequestEvidence(saveRequestPath),
      consumeOnce:durableSaveConsumeOnce(saveStoreDir),
    });
  }
  const backend=new NativeDailyRecordBackend(client,{teacherId:owner.teacherSourceKey,teacherLabel:owner.teacherLabel,
    date:config.date,students:config.students,sourceBundleSha256:config.sourceBundleSha256},()=>({username:owner.sourceUsername,password}),ownerAdmission,new Set(owner.expectedStudentNames),metadataAdmission,saveApproval);
  return {backend,close:()=>client.close()};
}

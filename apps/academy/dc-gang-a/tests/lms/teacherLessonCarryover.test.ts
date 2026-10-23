import {expect,test} from 'bun:test';
import {validateAcademyRecord,type AcademyRecord,type TeacherLessonCarryover} from '../../src/academy/records';
import {buildTeacherWorkContext} from '../../src/academy/teacherWorkContext';
import {buildStudentPreparation} from '../../src/academy/preparationHistory';
import {parentDraftText,validateTeacherWorkspace} from '../../src/academy/teacherWorkspace';
import {requirementsForSeries} from '../../src/academy/classroomCyclePolicy';
import type {CurrentRecord} from '../../src/academy/contracts/storageRecords';
import {canonicalJson,known,unknown} from '../../src/learning/model';
import type {CatalogNode} from '../../src/academy/domain';
import {journalHttpFields,JOURNAL_HTTP_SOURCE_CONTRACT,journalHttpActionDigest,type JournalHttpState} from '../../src/lms/lessonJournalHttp';
import {NativeDailyRecordBackend} from '../../../../../modules/academy-workbench/tools/academy-mcp/src/native-dailyrecord-backend';
import {DailyRecordService} from '../../../../../modules/academy-workbench/tools/academy-mcp/src/dailyrecord';
import {registerDailyRecordTools} from '../../../../../modules/academy-workbench/tools/academy-mcp/src/dailyrecord-tools';
import {sourceFixture,credential,principal,target} from './followupSyntheticFixtures';

const date='2099-01-05',at=date+'T00:00:00Z';
const student={namespace:'academy_student',literalKey:target.studentKey};
const sentinel='INVENTED_CARRYOVER_SENTINEL';
const carryover=():TeacherLessonCarryover=>({kind:'teacher_lesson_carryover',sourceStudent:student,
  sourceCourse:{namespace:'academy_course',literalKey:'5'},sourceBook:{namespace:'academy_book',literalKey:'94001'},
  sourceMinorUnit:{namespace:'academy_minor_unit',literalKey:'95001'},activity:'wrong_clinic',status:'reminder',
  originDate:null,targetDate:null,occurrence:null,text:sentinel+'; future occurrence has not been identified',
  directiveRef:'invented-teacher-directive',evidenceRefs:['invented-evidence']});
function version(payload:AcademyRecord,id='invented-reminder'):CurrentRecord{
  return {ownerId:'invented-owner',studentId:'invented-student',entityId:id,sequence:1,
    revisionId:id+'-v1',previousRevisionId:null,previousDigest:null,payload,contentDigest:'a'.repeat(64),integrityDigest:'b'.repeat(64),
    sourceObservedAt:at,recordedAt:at,lastVerifiedAt:at,actorId:'invented-teacher',idempotencyKey:id,commandDigest:'c'.repeat(64)};
}
const editions=[{id:'a',book:'94001',course:'5',unit:'95001'},{id:'b',book:'94002',course:'6',unit:'95002'}];
const catalog:CatalogNode[]=editions.flatMap(edition=>[
  {id:'book-'+edition.id,kind:'book_edition' as const,sourceKey:{namespace:'academy_book',literalKey:edition.book},label:'Invented edition '+edition.id,parent:unknown('root')},
  {id:'major-'+edition.id,kind:'major_unit' as const,sourceKey:{namespace:'academy_major_unit',literalKey:'major-'+edition.id},label:'Unit 1',parent:known('book-'+edition.id,['invented-catalog'])},
  {id:'middle-'+edition.id,kind:'middle_unit' as const,sourceKey:{namespace:'academy_middle_unit',literalKey:'middle-'+edition.id},label:'Unit 1',parent:known('major-'+edition.id,['invented-catalog'])},
  {id:'minor-'+edition.id,kind:'minor_unit' as const,sourceKey:{namespace:'academy_minor_unit',literalKey:edition.unit},label:'Unit 1',parent:known('middle-'+edition.id,['invented-catalog'])},
]);
const registrations=()=>editions.map(edition=>version({kind:'source_book_registration',sourceStudent:student,
  sourceCourse:{namespace:'academy_course',literalKey:edition.course},sourceUserCourse:{namespace:'academy_user_course',literalKey:'registration-'+edition.id},
  sourceBook:{namespace:'academy_book',literalKey:edition.book},catalogNodeId:'book-'+edition.id,sourceCourseLabel:'Invented course '+edition.id,
  sourceBookLabel:'Invented edition '+edition.id,sourceStatus:'Invented active',sourceProgressLiteral:'Invented progress',sourceLearningRangeLiteral:'Invented range',
  assignmentValidity:unknown('not_effective_enrollment'),role:unknown('not_declared'),contractRef:'invented-contract',evidenceRefs:['invented-registration']},'registration-'+edition.id));
function teacherContext(records:CurrentRecord[]){
  const history=[...registrations(),...records];
  return buildTeacherWorkContext({studentId:'invented-student',studentKey:student,date,revision:'invented-scene',
    catalog,preparation:buildStudentPreparation(student,history,date),versions:history});
}

test('carryover accepts every canonical activity including app grading, without completion authority',()=>{
  const before=canonicalJson(requirementsForSeries('gauss'));
  for(const {activity} of requirementsForSeries('gauss'))expect(()=>validateAcademyRecord({...carryover(),activity})).not.toThrow();
  expect(canonicalJson(requirementsForSeries('gauss'))).toBe(before);
  const reminder=carryover();
  expect(()=>validateAcademyRecord({...reminder,sourceCourse:null,sourceBook:null,sourceMinorUnit:null})).not.toThrow();
  expect(()=>validateAcademyRecord({...reminder,originDate:'2099-01-02',targetDate:date,
    occurrence:{date,groupId:'3',courseKey:'5',recordKey:'13',membershipKey:'88001'}})).not.toThrow();
});

test('carryover rejects extra/missing keys, namespace/activity/status/date drift and malformed occurrences',()=>{
  const base=carryover();
  for(const extra of ['completed','deadline','paperKey','attemptKey','sourceRowId'])expect(()=>validateAcademyRecord({...base,[extra]:'invented'} as any)).toThrow();
  for(const key of Object.keys(base)){
    const missing={...base} as any;delete missing[key];expect(()=>validateAcademyRecord(missing)).toThrow();
  }
  for(const field of ['sourceStudent','sourceCourse','sourceBook','sourceMinorUnit'] as const){
    expect(()=>validateAcademyRecord({...base,[field]:{namespace:'wrong_namespace',literalKey:'1'}})).toThrow('source_namespace_conflict');
  }
  for(const patch of [{sourceStudent:null},{status:'completed'},{status:'assigned'},{activity:'invented_activity'},
    {originDate:'2099-02-29'},{targetDate:'2099-13-01'},{targetDate:'today'},{text:' '},{text:'x'.repeat(16001)},{directiveRef:''},{evidenceRefs:['']}]){
    expect(()=>validateAcademyRecord({...base,...patch} as any)).toThrow();
  }
  const occurrence={date,groupId:'3',courseKey:'5',recordKey:'13',membershipKey:'88001'};
  for(const patch of [{date:'2099-02-29'},{groupId:'gauss'},{courseKey:'0'},{recordKey:'9007199254740992'},{membershipKey:1},{extra:'unknown'}])
    expect(()=>validateAcademyRecord({...base,occurrence:{...occurrence,...patch}} as any)).toThrow();
  expect(()=>validateAcademyRecord({...base,occurrence:{...occurrence,courseKey:'6'}})).toThrow('carryover_course_occurrence_conflict');
  expect(()=>validateAcademyRecord({...base,targetDate:'2099-01-06',occurrence})).toThrow('carryover_target_occurrence_conflict');
  // Occurrence binds target, so an earlier origin is valid and a null target stays null.
  expect(()=>validateAcademyRecord({...base,originDate:'2099-01-02',targetDate:date,occurrence})).not.toThrow();
  expect(()=>validateAcademyRecord({...base,targetDate:null,occurrence})).not.toThrow();
});

test('known ancestry and occurrence conflicts are refused; partial registration, unmatched and null links stay unqualified',()=>{
  expect(()=>teacherContext([version({...carryover(),sourceMinorUnit:{namespace:'academy_minor_unit',literalKey:'95002'}})])).toThrow('work_context_carryover_book_conflict');
  expect(()=>teacherContext([version({...carryover(),sourceCourse:{namespace:'academy_course',literalKey:'5'},
    occurrence:{date,groupId:'4',courseKey:'6',recordKey:'14',membershipKey:'88002'}})])).toThrow('carryover_course_occurrence_conflict');
  for(const reminder of [
    // Book A has only been observed in course 5; that is no proof it cannot be used in course 6.
    {...carryover(),sourceCourse:{namespace:'academy_course',literalKey:'6'}},
    {...carryover(),sourceBook:null,sourceCourse:{namespace:'academy_course',literalKey:'6'}},
    {...carryover(),sourceCourse:null,occurrence:{date,groupId:'4',courseKey:'6',recordKey:'14',membershipKey:'88002'}},
    {...carryover(),sourceCourse:null,sourceBook:null,sourceMinorUnit:null},
    {...carryover(),sourceCourse:{namespace:'academy_course',literalKey:'99901'},sourceBook:{namespace:'academy_book',literalKey:'99902'},sourceMinorUnit:{namespace:'academy_minor_unit',literalKey:'99903'}},
  ])expect(teacherContext([version(reminder)]).data.lessonCarryovers[0]!.record).toEqual(reminder);
});

const occurrenceA={date,groupId:'3',courseKey:'5',recordKey:'13',membershipKey:'88001'};
const occurrenceB={date,groupId:'4',courseKey:'6',recordKey:'14',membershipKey:'88002'};
const twoReminders=()=>[
  version({...carryover(),targetDate:date,occurrence:occurrenceA},'wrong-clinic-edition-a'),
  version({...carryover(),sourceCourse:{namespace:'academy_course',literalKey:'6'},sourceBook:{namespace:'academy_book',literalKey:'94002'},
    sourceMinorUnit:{namespace:'academy_minor_unit',literalKey:'95002'},activity:'daily_test',targetDate:date,occurrence:occurrenceB},'daily-test-edition-b'),
];
const officialTarget={studentName:target.studentName,...occurrenceB,teacherKey:principal.teacherKey,studentKey:student.literalKey};
const scope={sourceNamespace:'academy.lms.dayrecord',teacherId:principal.teacherKey,studentId:student.literalKey,lessonDate:date};
const officialFields=()=>({progress:'- Invented edition B unit 1 practice',homework:'- Invented edition B unit 1 review',lessonMemo:'- Invented lesson notice',attendance:'Y',dailyTestAssessment:'-1',previousHomeworkAssessment:'-1'});
const explicitAfter=()=>({progress:'- Invented edition B unit 1 inspection',homework:'- Invented edition B unit 1 practice',lessonMemo:'- Invented explicit notice',attendance:'L',dailyTestAssessment:'6',previousHomeworkAssessment:'3'});

/** Same teacher history enters the real teacher projection AND the maintained strict MCP boundary.
 * The latter must reject history/reminder kinds before source reads; accepted official inputs still
 * traverse the real backend/schema/service and HTTP save composer. Parent text only, no send payload. */
async function officialCaller(records:CurrentRecord[],mutateTeacherCopy=false){
  const work=teacherContext(records);
  const state:JournalHttpState={target:structuredClone(officialTarget),fields:officialFields(),previousRecordKey:'12',previousDate:'2099-01-02',wireDigest:JOURNAL_HTTP_SOURCE_CONTRACT.staticWireDigest};
  const payloads:{field:string;method:string;parameters:Record<string,string>}[]=[];
  let sourceReads=0;
  const f=sourceFixture((url,init)=>{
    const parameters=new URLSearchParams(init.method==='POST'?init.body as string:url.search);
    const selected=journalHttpFields.find(field=>JOURNAL_HTTP_SOURCE_CONTRACT.fields[field].selector===parameters.get('reqCmd'));
    if(!selected)throw Error('unexpected_synthetic_transport');
    const contract=JOURNAL_HTTP_SOURCE_CONTRACT.fields[selected];
    const value=parameters.get(contract.valueParameter)!;
    expect(parameters.get('record_seq')).toBe(selected==='previousHomeworkAssessment'?'12':officialTarget.recordKey);
    expect(parameters.get('cm_seq')).toBe(officialTarget.membershipKey);
    expect(parameters.get('stu_pri_no')??officialTarget.studentKey).toBe(officialTarget.studentKey);
    const stable=Object.fromEntries(parameters);delete stable.dummy;
    payloads.push({field:selected,method:init.method!,parameters:stable});state.fields[selected]=value;
    return new Response('invented-ok');
  });
  // Preserve actual auth and save composition while substituting the qualified source-read boundary.
  f.client.journalState=async()=>structuredClone(state);
  const backend=new NativeDailyRecordBackend({authenticate:c=>f.client.authenticate(c),close:()=>f.client.close(),
    discoverDayRecordGroups:async()=>{sourceReads++;return {groups:[{groupId:officialTarget.groupId}]};},
    execute:async(input:unknown)=>{sourceReads++;const request=input as {date:string};return {dayRecords:[{...officialTarget,date:request.date,
      recordKey:request.date===date?officialTarget.recordKey:'12',fields:officialFields()}]};},
    journalState:t=>f.client.journalState(t)},
    {teacherId:principal.teacherKey,teacherLabel:principal.teacherLabel,date,students:[{studentId:student.literalKey,displayName:target.studentName}],sourceBundleSha256:'d'.repeat(64)},()=>credential);
  try{
    const observation=await backend.readDailyRecord(scope);
    expect(observation.status).toBe('observed');
    const service=new DailyRecordService(backend);
    const tools=new Map<string,(input:unknown)=>Promise<any>>();
    registerDailyRecordTools({registerTool:(name:string,_definition:unknown,handler:(input:unknown)=>Promise<any>)=>tools.set(name,handler)} as any,service);
    const context={schemaVersion:'academy.dailyrecord-user-context/1',purpose:'Invented synthetic intake',currentRequestRef:'invented-request',scope,
      selectedFields:[...journalHttpFields],memoAnswer:{kind:'no_addition',requestRef:'invented-request'},facts:[]};
    const intakeTool=tools.get('academy_dailyrecord_intake')!,reviewTool=tools.get('academy_dailyrecord_review')!;
    const baseline=(await intakeTool({context})).structuredContent;
    const readsBefore=sourceReads,callsBefore=f.calls.length,history=[...registrations(),...records];
    // These exact history objects produce the teacher view above. They cannot be official user facts,
    // source observations, field proposals or an added history argument at the maintained MCP boundary.
    await expect(intakeTool({context,teacherHistory:history})).rejects.toThrow();
    await expect(intakeTool({context:{...context,teacherHistory:history}})).rejects.toThrow();
    for(const record of records){
      expect(()=>validateTeacherWorkspace(record.payload as any)).toThrow();
      await expect(intakeTool({context:{...context,facts:[record.payload]}})).rejects.toThrow();
      for(const field of journalHttpFields)await expect(reviewTool({context,proposals:[{field,value:record.payload,factRefs:['invented-evidence'],decision:{kind:'set',requestRef:'invented-request'}}]})).rejects.toThrow();
    }
    expect(sourceReads).toBe(readsBefore);expect(f.calls).toHaveLength(callsBefore);
    const intake=(await intakeTool({context})).structuredContent as Awaited<ReturnType<DailyRecordService['intake']>>;
    // Each independent source read correctly gets a fresh evidence receipt. Compare exact field
    // values, targets and dispositions; receipt IDs are provenance, not official field bytes.
    const stableFields=(fields:typeof intake.fields)=>fields.map(({before,...rest})=>({...rest,before:before.state==='known'?{state:before.state,value:before.value}:before}));
    expect(stableFields(intake.fields)).toEqual(stableFields(baseline.fields));
    expect(intake.sourceAvailability).toBe('observed');expect(intake.status).toBe('interview_required');
    const serialized=JSON.stringify(Object.fromEntries(journalHttpFields.map(field=>{const value=observation.observation.fields[field];expect(value.state).toBe('known');return [field,value.state==='known'?value.value:null];})));
    const projected=JSON.stringify(intake.fields.map(row=>({field:row.field,before:row.before.state==='known'?row.before.value:null,target:row.target})));
    const draft={progress:[{text:state.fields.progress.slice(2),evidenceRevisionIds:['invented-explicit-fact']}],
      homework:[{text:state.fields.homework.slice(2),evidenceRevisionIds:['invented-explicit-fact']}],memo:[{text:state.fields.lessonMemo.slice(2),evidenceRevisionIds:['invented-explicit-fact']}]};
    const parent=canonicalJson(parentDraftText(draft));
    if(mutateTeacherCopy&&records.length){
      const teacherCopy=structuredClone(work);(teacherCopy.data.lessonCarryovers[0]!.record.evidenceRefs as string[]).push('invented-mutation');
      // Original caller input can change after projection; the immutable teacher view owns a copy.
      (records[0]!.payload as any).text='MUTATED_'+sentinel;
      expect(work.data.lessonCarryovers[0]!.record.text).not.toContain('MUTATED_');
      expect(Object.isFrozen(work.data.lessonCarryovers[0]!.record)).toBe(true);
    }
    for(const field of journalHttpFields){
      const action={attemptId:'invented-'+field,target:officialTarget,field,effectRecordKey:field==='previousHomeworkAssessment'?'12':officialTarget.recordKey,
        before:state.fields[field]!,after:explicitAfter()[field],wireDigest:state.wireDigest};
      const result=await f.client.applyJournalAction(action,{consumeApproval:async a=>({status:'verified',actionDigest:journalHttpActionDigest(a)})});
      expect(result.status).toBe('persisted');expect(result.parentSends).toBe(0);
    }
    expect(f.authCounts()).toEqual({documents:1,submissions:1,principalChecks:1});expect(payloads).toHaveLength(6);
    for(const field of journalHttpFields)expect(state.fields[field]).toBe(explicitAfter()[field]);
    const save=canonicalJson(payloads);
    for(const text of [serialized,projected,parent,save]){
      expect(text).not.toContain(sentinel);expect(text).not.toContain('teacher_lesson_carryover');expect(text).not.toContain('invented-teacher-directive');
    }
    return {serialized,projected,parent,save};
  }finally{f.client.close();}
}

test('N1: teacher-only projection retains unknown links and attributable originals; all other context bytes are unchanged',async()=>{
  const note=carryover(),base=teacherContext([]),withNote=teacherContext([version(note)]);
  expect(withNote.data.lessonCarryovers).toHaveLength(1);expect(withNote.data.lessonCarryovers[0]!.record).toEqual(note);
  const {lessonCarryovers:ignored,...teacherData}=withNote.data;
  const {lessonCarryovers:empty,...baseData}=base.data;
  expect(empty).toEqual([]);expect(canonicalJson(teacherData)).toBe(canonicalJson(baseData));
  expect(withNote.data.exactWork.currentObligations).toEqual([]);expect(withNote.data.sectionAssignments.state).toBe('unknown');
  expect(withNote.data.lessonCarryovers[0]!.record.targetDate).toBeNull();expect(withNote.data.lessonCarryovers[0]!.record.occurrence).toBeNull();
  expect(await officialCaller([version(note)])).toEqual(await officialCaller([]));
});

test('N1-N3: two registered editions with identical unit labels and co-scheduled activity occurrences retain distinct reminders',async()=>{
  const records=twoReminders(),context=teacherContext(records);
  expect(context.data.books.map(book=>book.sourceBook.literalKey)).toEqual(['94001','94002']);
  expect(catalog.filter(node=>node.kind==='minor_unit').map(node=>node.label)).toEqual(['Unit 1','Unit 1']);
  expect(context.data.lessonCarryovers.map(row=>row.revisionRef)).toEqual(['wrong-clinic-edition-a-v1','daily-test-edition-b-v1']);
  expect(context.data.lessonCarryovers.map(row=>row.record.sourceMinorUnit!.literalKey)).toEqual(['95001','95002']);
  expect(context.data.lessonCarryovers.map(row=>row.record.occurrence)).toEqual([occurrenceA,occurrenceB]);
  expect(context.data.lessonCarryovers.map(row=>row.record.activity)).toEqual(['wrong_clinic','daily_test']);
  expect(await officialCaller(records,true)).toEqual(await officialCaller([]));
});

for(const [label,patch] of [
  ['same unit in a different edition',{sourceBook:{namespace:'academy_book',literalKey:'94001'}}],
  ['same date wrong-clinic activity',{activity:'wrong_clinic',targetDate:date}],
  ['same date daily-test activity',{activity:'daily_test',targetDate:date}],
  ['unknown future occurrence',{sourceCourse:null,sourceBook:null,sourceMinorUnit:null,targetDate:null,occurrence:null}],
] as const){
  test('N2/N3: '+label+' leaves six-field serialization, parent text and real save payloads byte-identical',async()=>{
    const note={...carryover(),...patch} as TeacherLessonCarryover;validateAcademyRecord(note);
    const expected=await officialCaller([]),actual=await officialCaller([version(note)],true);
    expect(actual.serialized).toBe(expected.serialized);expect(actual.projected).toBe(expected.projected);
    expect(actual.parent).toBe(expected.parent);expect(actual.save).toBe(expected.save);
  });
}

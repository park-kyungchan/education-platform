import {randomUUID,createHash} from 'node:crypto';
import {z} from 'zod';
import {dailyRecordContextSchema,dailyRecordDateSchema,dailyRecordFieldSchema,dailyRecordFields,dailyRecordIdSchema,dailyRecordScopeSchema,dailyRecordWorkflowContext,type DailyRecordContext,type DailyRecordField,type DailyRecordScope} from './dailyrecord-context.ts';
import {freezeLabelData} from './item-label-context.ts';

const hash=z.string().regex(/^[a-f0-9]{64}$/),instant=z.iso.datetime({offset:true});
const knownValueSchema=z.discriminatedUnion('state',[
  z.object({state:z.literal('known'),value:z.string().max(8192),evidenceRefs:z.array(dailyRecordIdSchema).min(1).max(32)}).strict(),
  z.object({state:z.literal('unknown'),reasonCode:dailyRecordIdSchema}).strict(),
]);
const currentTargetSchema=z.object({sourceNamespace:dailyRecordIdSchema,teacherId:dailyRecordIdSchema,studentId:dailyRecordIdSchema,
  lessonDate:dailyRecordDateSchema,courseId:dailyRecordIdSchema,membershipId:dailyRecordIdSchema,recordId:dailyRecordIdSchema}).strict();
export const dailyRecordObservationSchema=z.object({scope:dailyRecordScopeSchema,target:currentTargetSchema,
  previousTarget:currentTargetSchema.nullable(),observedAt:instant,sourceRevision:hash,wireDigest:hash,
  fields:z.object({progress:knownValueSchema,homework:knownValueSchema,lessonMemo:knownValueSchema,attendance:knownValueSchema,dailyTestAssessment:knownValueSchema,previousHomeworkAssessment:knownValueSchema}).strict(),
  toneSamples:z.array(z.object({target:currentTargetSchema,observedAt:instant,text:z.string().max(8192),evidenceRefs:z.array(dailyRecordIdSchema).min(1).max(32)}).strict()).max(3),
  transmissionState:z.enum(['not_sent','already_sent','unknown']),
}).strict();
export type DailyRecordObservation=z.infer<typeof dailyRecordObservationSchema>;
const learningEntrySchema=z.object({bookRef:dailyRecordIdSchema,unitRef:dailyRecordIdSchema,scope:z.enum(['unit','sections']),sectionRefs:z.array(dailyRecordIdSchema).max(64),activity:z.string().min(1).max(400),deadline:dailyRecordDateSchema.nullable()}).strict();
const proposalSchema=z.object({field:dailyRecordFieldSchema,value:z.string().max(8192),factRefs:z.array(dailyRecordIdSchema).min(1).max(32),
  decision:z.object({kind:z.enum(['set','replace','clear']),requestRef:dailyRecordIdSchema}).strict(),learningEntries:z.array(learningEntrySchema).max(64).optional(),
}).strict();
export const dailyRecordIntakeSchema=z.object({context:dailyRecordContextSchema,suppliedValues:z.array(proposalSchema).max(6).default([])}).strict();
export const dailyRecordReviewSchema=z.object({context:dailyRecordContextSchema,observationHandle:dailyRecordIdSchema.optional(),
  cismObservationHandle:dailyRecordIdSchema.optional(),
  proposals:z.array(proposalSchema).min(1).max(6),
}).strict();
const cismSelectionSchema=z.object({reportId:dailyRecordIdSchema,periodStart:dailyRecordDateSchema,periodEnd:dailyRecordDateSchema,section:z.literal('learning_support')}).strict().refine(v=>v.periodStart<=v.periodEnd,'ordered_reporting_period_required');
export const cismSectionSchema=z.object({context:dailyRecordContextSchema,selection:cismSelectionSchema}).strict();
export const cismObservationSchema=z.object({scope:dailyRecordScopeSchema,selection:cismSelectionSchema,observedAt:instant,sourceRevision:hash,
  sourceReferenceDate:dailyRecordDateSchema,sectionLabel:z.literal('학습부진아 지도'),text:z.string().max(20000),evidenceRefs:z.array(dailyRecordIdSchema).min(1).max(32),
}).strict();
export type CismObservation=z.infer<typeof cismObservationSchema>;
type Proposal=z.infer<typeof proposalSchema>;
type ReadResult<T>={status:'observed';observation:T}|{status:'unavailable';reasonCode:string};
/** Implemented by the native/source owner, never by MCP arguments. All methods are read-only. */
export interface DailyRecordReadBackend {
  readDailyRecord(scope:Readonly<DailyRecordScope>):Promise<ReadResult<DailyRecordObservation>>;
  readCismSection?(scope:Readonly<DailyRecordScope>,selection:Readonly<z.infer<typeof cismSelectionSchema>>):Promise<ReadResult<CismObservation>>;
}
/** Inject the canonical Education safeguard, together with its verified policy/source identity. */
export interface DailyRecordParentSafeguard {readonly policySha256:string;readonly safeguardSourceSha256:string;readonly sourceRef:string;check(text:string):boolean;checkLines(text:string):boolean}
/** Trusted owner-side adapter; no catalog/bridge or verification flags come from tool input. */
export interface DailyRecordLearningPolicy {readonly bundleSha256:string;readonly configSha256:string;readonly catalogSha256:string;review(scope:Readonly<DailyRecordScope>,value:string,entries:unknown):string[]}
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fieldValues=(observation:DailyRecordObservation)=>Object.fromEntries(dailyRecordFields.map(field=>{const value=observation.fields[field];return [field,value.state==='known'?{state:value.state,value:value.value}:{state:value.state,reasonCode:value.reasonCode}];}));
const scopeOf=(target:z.infer<typeof currentTargetSchema>):DailyRecordScope=>({sourceNamespace:target.sourceNamespace,teacherId:target.teacherId,studentId:target.studentId,lessonDate:target.lessonDate});
const safeReason=(value:string)=>/^[a-z][a-z0-9_]{0,100}$/.test(value)?value:'source_read_unavailable';
function validValue(field:DailyRecordField,value:string){
  if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))return false;
  if(field==='attendance')return ['Y','N','L',' ',''].includes(value);
  if(field==='dailyTestAssessment')return ['-1','0','1','2','3','4','5','6','7','8','9','10'].includes(value);
  if(field==='previousHomeworkAssessment')return ['-1','0','1','2','3','4','5'].includes(value);
  return value.split('').reduce((n,c)=>n+(c.charCodeAt(0)>127?2:1),0)<=400;
}
function unknownAssessment(field:DailyRecordField,value:string){return (field==='dailyTestAssessment'||field==='previousHomeworkAssessment')&&value==='-1';}
function qualifiedObservation(value:unknown,scope:DailyRecordScope){
  const observation=dailyRecordObservationSchema.parse(value);
  if(!same(observation.scope,scope)||!same(scopeOf(observation.target),scope))throw Error('source_scope_conflict');
  const p=observation.previousTarget,t=observation.target;
  if(p&&(p.sourceNamespace!==t.sourceNamespace||p.teacherId!==t.teacherId||p.studentId!==t.studentId||p.courseId!==t.courseId||p.membershipId!==t.membershipId||p.recordId===t.recordId||p.lessonDate>=t.lessonDate))throw Error('previous_record_scope_conflict');
  if(!p&&observation.fields.previousHomeworkAssessment.state==='known')throw Error('previous_record_required');
  for(const field of dailyRecordFields){const v=observation.fields[field];if(v.state==='known'&&!validValue(field,v.value))throw Error('source_field_value_unqualified');}
  for(const sample of observation.toneSamples){if(sample.target.sourceNamespace!==t.sourceNamespace||sample.target.teacherId!==t.teacherId||sample.target.studentId!==t.studentId||sample.target.lessonDate>=t.lessonDate)throw Error('tone_sample_scope_conflict');}
  return freezeLabelData(observation);
}
function proposalBlockers(p:Proposal,context:DailyRecordContext){
  const blockers:string[]=[];
  if(!context.selectedFields.includes(p.field))blockers.push('field_not_selected');
  if(p.decision.requestRef!==context.currentRequestRef)blockers.push('current_request_ref_required');
  if(!validValue(p.field,p.value))blockers.push('invalid_explicit_field_value');
  if(p.factRefs.some(ref=>!context.facts.some(f=>f.ref===ref&&f.field===p.field)))blockers.push('field_fact_reference_required');
  if(['attendance','dailyTestAssessment','previousHomeworkAssessment'].includes(p.field)){
    const explicit=context.facts.filter(f=>p.factRefs.includes(f.ref)&&f.field===p.field&&f.origin==='user_supplied'&&f.explicitValue!==undefined);
    if(!explicit.some(f=>f.explicitValue===p.value))blockers.push('explicit_user_source_option_fact_required');
    if(new Set(explicit.map(f=>f.explicitValue)).size>1)blockers.push('conflicting_explicit_user_source_options');
  }
  if(new Set(p.factRefs).size!==p.factRefs.length)blockers.push('duplicate_fact_ref');
  if(p.decision.kind==='clear'&&p.value!=='')blockers.push('clear_requires_empty_value');
  if(p.value===''&&p.decision.kind!=='clear'&&['progress','homework','lessonMemo'].includes(p.field))blockers.push('explicit_clear_decision_required');
  if(p.field==='lessonMemo'&&context.memoAnswer.kind==='no_addition')blockers.push('no_addition_preserves_existing_memo');
  if(p.field==='lessonMemo'&&context.memoAnswer.kind==='not_supplied')blockers.push('today_memo_interview_required');
  return blockers;
}

export class DailyRecordService {
  readonly #handles=new Map<string,{observation:DailyRecordObservation;scope:DailyRecordScope;requestRef:string}>();
  readonly #cismHandles=new Map<string,CismObservation>();
  #tail:Promise<unknown>=Promise.resolve();
  #readRefused=false;
  constructor(readonly backend:DailyRecordReadBackend|null=null,readonly parentSafeguard:DailyRecordParentSafeguard|null=null,readonly now:()=>number=Date.now,readonly learningPolicy:DailyRecordLearningPolicy|null=null){
    if(learningPolicy)for(const pin of [learningPolicy.bundleSha256,learningPolicy.configSha256,learningPolicy.catalogSha256])hash.parse(pin);
    if(parentSafeguard){hash.parse(parentSafeguard.policySha256);hash.parse(parentSafeguard.safeguardSourceSha256);dailyRecordIdSchema.parse(parentSafeguard.sourceRef);}
  }
  #base(context:DailyRecordContext){return {workflowContext:dailyRecordWorkflowContext,userContext:context,academyWrites:0,parentSends:0,automaticRetryAllowed:false,sourceContentIsUntrustedData:true};}
  #age(observedAt:string){const age=this.now()-Date.parse(observedAt);return age<0||age>300000;}
  async #serial<T>(run:()=>Promise<T>):Promise<T>{
    const result=this.#tail.then(async()=>{if(this.#readRefused)throw Error('source_read_requires_owner_resolution');try{return await run();}catch{this.#readRefused=true;throw Error('source_read_requires_owner_resolution');}});
    this.#tail=result.catch(()=>{});return result;
  }
  async #read(scope:DailyRecordScope){
    if(!this.backend)return {status:'unavailable' as const,reasonCode:'dailyrecord_read_backend_not_configured'};
    try{const read=await this.#serial(()=>this.backend!.readDailyRecord(freezeLabelData(structuredClone(scope))));
      if(read.status==='unavailable'){this.#readRefused=true;return {status:'unavailable' as const,reasonCode:safeReason(read.reasonCode)};}
      return {status:'observed' as const,observation:qualifiedObservation(read.observation,scope)};
    }catch{this.#readRefused=true;return {status:'unavailable' as const,reasonCode:'dailyrecord_source_unqualified_no_automatic_retry'};}
  }
  async intake(value:unknown){
    const input=dailyRecordIntakeSchema.parse(value),context=input.context;
    if(new Set(input.suppliedValues.map(p=>p.field)).size!==input.suppliedValues.length)throw Error('duplicate_proposal_field');
    const read=await this.#read(context.scope),source=read.status==='observed'?read.observation:null;
    const blockers:string[]=read.status==='unavailable'?[read.reasonCode]:this.#age(source!.observedAt)?['stale_source']:[];
    const interviews:{field:DailyRecordField;reasonCode:string}[]=[];
    const fields=dailyRecordFields.map(field=>{
      const current=source?.fields[field]??{state:'unknown' as const,reasonCode:'source_not_read'},explicit=input.suppliedValues.find(p=>p.field===field);
      const supplied=explicit&&!proposalBlockers(explicit,context).length;
      const existing=current.state==='known'&&!unknownAssessment(field,current.value)
        &&(!['attendance','progress','homework'].includes(field)||current.value.trim().length>0);
      const facts=context.facts.some(f=>f.field===field);
      if(field==='lessonMemo'){if(context.memoAnswer.kind==='not_supplied')interviews.push({field,reasonCode:'today_student_specific_memo_required'});}
      else if(!existing&&!supplied&&(!['progress','homework'].includes(field)||!facts))interviews.push({field,reasonCode:'explicit_value_or_qualified_existing_value_required'});
      return {field,before:current,selected:context.selectedFields.includes(field),disposition:existing?'preserve_existing':supplied?'explicit_user_value':facts&&['progress','homework'].includes(field)?'user_facts_available':'missing',
        target:field==='previousHomeworkAssessment'?source?.previousTarget??null:source?.target??null};
    });
    for(const p of input.suppliedValues)blockers.push(...proposalBlockers(p,context).map(b=>p.field+':'+b));
    let observationHandle:string|null=null;
    if(source&&!blockers.length){if(this.#handles.size>=128)this.#handles.delete(this.#handles.keys().next().value!);observationHandle='dailyrecord-observation:'+randomUUID();this.#handles.set(observationHandle,{observation:source,scope:freezeLabelData(structuredClone(context.scope)),requestRef:context.currentRequestRef});}
    return {...this.#base(context),status:blockers.length?'held':interviews.length?'interview_required':'ready_for_review',observationHandle,fields,interviews,blockers,
      source:source?{observedAt:source.observedAt,sourceRevision:source.sourceRevision,wireDigest:source.wireDigest,transmissionState:source.transmissionState}:null,
      toneSamples:source?.toneSamples.filter(s=>this.parentSafeguard?.checkLines(s.text))??[],toneSelection:'hyphen_lines_only_other_formats_ignored',sourceAvailability:read.status,execution:'not_supported'};
  }
  async review(value:unknown){
    const input=dailyRecordReviewSchema.parse(value),context=input.context,held=input.observationHandle?this.#handles.get(input.observationHandle):undefined;
    if(input.observationHandle&&(!held||!same(held.scope,context.scope)||held.requestRef!==context.currentRequestRef))throw Error('exact_backend_observation_handle_required');
    if(new Set(input.proposals.map(p=>p.field)).size!==input.proposals.length)throw Error('duplicate_proposal_field');
    const global:string[]=held?[]:['qualified_before_source_unavailable'];
    const cism=input.cismObservationHandle?this.#cismHandles.get(input.cismObservationHandle):undefined;
    if(input.cismObservationHandle&&(!cism||!same(cism.scope,context.scope)||this.#age(cism.observedAt)))global.push('exact_fresh_cism_observation_handle_required');
    for(const fact of context.facts.filter(f=>f.origin==='cism_section')){
      if(!cism||!same(cism.scope,context.scope)||this.#age(cism.observedAt)||!cism.evidenceRefs.includes(fact.ref)||fact.text!==cism.text)global.push('cism_fact_not_bound_to_exact_observed_section');
    }
    if(held&&this.#age(held.observation.observedAt))global.push('stale_source');
    // Fresh authoritative before-state; this pure review neither consumes approval nor writes.
    const read=!held||global.length?null:await this.#read(context.scope);
    if(read?.status==='unavailable')global.push(read.reasonCode);
    if(held&&read?.status==='observed'){
      if(this.#age(read.observation.observedAt))global.push('stale_source');
      if(!same(read.observation.target,held.observation.target)||!same(read.observation.previousTarget,held.observation.previousTarget)||!same(fieldValues(read.observation),fieldValues(held.observation))||read.observation.wireDigest!==held.observation.wireDigest||read.observation.sourceRevision!==held.observation.sourceRevision||read.observation.transmissionState!==held.observation.transmissionState)global.push('source_before_or_contract_drift');
    }
    const rows=input.proposals.map(p=>{
      const before=held?.observation.fields[p.field]??{state:'unknown' as const,reasonCode:'qualified_before_source_unavailable'},target=p.field==='previousHomeworkAssessment'?held?.observation.previousTarget??null:held?.observation.target??null;
      const blockers=[...global,...proposalBlockers(p,context)];
      if(before.state!=='known')blockers.push('unknown_before');
      if(!target)blockers.push(p.field==='previousHomeworkAssessment'?'independent_previous_record_required':'qualified_current_record_required');
      const changed=before.state!=='known'||before.value!==p.value;
      if(changed&&before.state==='known'&&before.value!==''&&!unknownAssessment(p.field,before.value)&&p.decision.kind==='set')blockers.push('existing_value_requires_explicit_replace');
      const facts=context.facts.filter(f=>f.field===p.field),constraints=facts.flatMap(f=>[...f.requiredFragments,...f.questionCounts.map(c=>c.rendering),...f.deadlines.map(d=>d.rendering),...f.stageClaims.map(s=>s.rendering)]);
      const missingFragments=constraints.filter(fragment=>!p.value.includes(fragment));
      if(missingFragments.length)blockers.push('supplied_fact_fragment_missing');
      if(['progress','homework','lessonMemo'].includes(p.field)){
        const factText=facts.map(f=>f.text).join('\n');
        const counts=(text:string)=>[...text.matchAll(/(?<!\d)(\d{1,6})\s*문항/g)].map(m=>Number(m[1]));
        const supportedCounts=new Set([...counts(factText),...facts.flatMap(f=>f.questionCounts.map(c=>c.count))]);
        if(counts(p.value).some(count=>!supportedCounts.has(count)))blockers.push('unsupported_question_count');
        const deadlines=(text:string)=>[...text.matchAll(/(?:(\d{4})[-./](\d{1,2})[-./](\d{1,2})|(\d{1,2})\s*월\s*(\d{1,2})\s*일)/g)].map(m=>m[1]?`${m[1]}-${Number(m[2])}-${Number(m[3])}`:`${Number(m[4])}-${Number(m[5])}`);
        const supportedDeadlines=new Set([...deadlines(factText),...facts.flatMap(f=>f.deadlines.flatMap(d=>[`${d.date.slice(0,4)}-${Number(d.date.slice(5,7))}-${Number(d.date.slice(8,10))}`,`${Number(d.date.slice(5,7))}-${Number(d.date.slice(8,10))}`,...deadlines(d.rendering)]))]);
        if(deadlines(p.value).some(date=>!supportedDeadlines.has(date)))blockers.push('unsupported_deadline');
        if(/완료/.test(p.value)&&!facts.some(f=>/완료/.test(f.text)||f.stageClaims.some(s=>s.status==='complete')))blockers.push('unsupported_completion_claim');
        const completionPatterns={solving:/(?:문제\s*)?풀이\s*(?:까지\s*)?완료/,grading:/채점(?:·검사)?\s*(?:까지\s*)?완료/,
          correction:/(?:오답\s*(?:수정|정리|처리)|재풀이)\s*(?:까지\s*)?완료/,
          teacher_review:/(?:교사\s*확인|검토)\s*(?:까지\s*)?완료/};
        for(const [stage,pattern] of Object.entries(completionPatterns))if(pattern.test(p.value)){
          const claims=facts.flatMap(f=>f.stageClaims).filter(s=>s.stage===stage);
          if(claims.some(s=>s.status!=='complete'))blockers.push('stage_completion_mismatch:'+stage);
          if(!claims.some(s=>s.status==='complete')&&!facts.some(f=>pattern.test(f.text)))blockers.push('unsupported_stage_completion_claim:'+stage);
        }
      }
      if(changed&&p.value!==''&&['progress','homework','lessonMemo'].includes(p.field)){
        if(this.parentSafeguard&&!this.parentSafeguard.checkLines(p.value))blockers.push('parent_hyphen_lines_required');
        if(['progress','homework'].includes(p.field)){
          if(!this.learningPolicy)blockers.push('canonical_learning_policy_not_connected');
          else blockers.push(...this.learningPolicy.review(context.scope,p.value,p.learningEntries));
        }
        if(!this.parentSafeguard)blockers.push('canonical_parent_safeguard_not_connected');
        else if(this.parentSafeguard.check(p.value))blockers.push('parent_internal_language_excluded');
      }
      return {field:p.field,target,before,after:p.value,factRefs:p.factRefs,learningEntries:p.learningEntries??null,disposition:blockers.length?'blocked':changed?'proposed':'noop',blockers:[...new Set(blockers)],missingFactFragments:missingFragments,
        semanticFactReview:'teacher_review_required_not_proven_by_fragment_checks'};
    });
    const interviews=context.memoAnswer.kind==='not_supplied'?[{field:'lessonMemo',reasonCode:'today_student_specific_memo_required'}]:[];
    const patch=rows.filter(r=>r.disposition==='proposed').map(r=>({field:r.field,target:r.target,before:r.before.state==='known'?r.before.value:null,after:r.after,factRefs:r.factRefs,learningEntries:r.learningEntries}));
    const parentSafeguard=this.parentSafeguard?{sourceRef:this.parentSafeguard.sourceRef,policySha256:this.parentSafeguard.policySha256,safeguardSourceSha256:this.parentSafeguard.safeguardSourceSha256}:null;
    const cismSource=cism?{observationHandle:input.cismObservationHandle,scope:cism.scope,selection:cism.selection,observedAt:cism.observedAt,sourceRevision:cism.sourceRevision,evidenceRefs:cism.evidenceRefs}:null;
    const body={observationHandle:input.observationHandle??null,scope:context.scope,requestRef:context.currentRequestRef,userContextDigest:digest(context),parentSafeguard,cismSource,learningPolicy:this.learningPolicy?{bundleSha256:this.learningPolicy.bundleSha256,configSha256:this.learningPolicy.configSha256,catalogSha256:this.learningPolicy.catalogSha256}:null,
      sourceRevision:held?.observation.sourceRevision??null,wireDigest:held?.observation.wireDigest??null,transmissionState:read?.status==='observed'?read.observation.transmissionState:held?.observation.transmissionState??'unknown',rows,patch};
    return {...this.#base(context),...body,status:rows.some(r=>r.blockers.length)||interviews.length?'held':'prepared',interviews,reviewDigest:digest(body),
      execution:'not_supported',saveAdmission:'separate_trusted_native_owner_required'};
  }
  async cism(value:unknown){
    const input=cismSectionSchema.parse(value),context=input.context;
    if(!this.backend?.readCismSection)return {...this.#base(context),status:'unavailable',reasonCode:'exact_cism_read_backend_not_configured',observationHandle:null,execution:'not_supported'};
    try{const read=await this.#serial(()=>this.backend!.readCismSection!(freezeLabelData(structuredClone(context.scope)),freezeLabelData(structuredClone(input.selection))));
      if(read.status==='unavailable'){this.#readRefused=true;return {...this.#base(context),status:'unavailable',reasonCode:safeReason(read.reasonCode),observationHandle:null,execution:'not_supported'};}
      const observation=cismObservationSchema.parse(read.observation);
      if(!same(observation.scope,context.scope)||!same(observation.selection,input.selection)||this.#age(observation.observedAt)
        ||observation.sourceReferenceDate<input.selection.periodStart||observation.sourceReferenceDate>input.selection.periodEnd)throw Error('cism_scope_or_freshness_conflict');
      if(this.#cismHandles.size>=128)this.#cismHandles.delete(this.#cismHandles.keys().next().value!);
      const observationHandle='cism-observation:'+randomUUID();this.#cismHandles.set(observationHandle,freezeLabelData(observation));
      return {...this.#base(context),status:'observed',observationHandle,observation:freezeLabelData(observation),parentRewording:'not_performed',execution:'not_supported'};
    }catch{this.#readRefused=true;return {...this.#base(context),status:'unavailable',reasonCode:'exact_cism_source_unqualified_no_automatic_retry',observationHandle:null,execution:'not_supported'};}
  }
}

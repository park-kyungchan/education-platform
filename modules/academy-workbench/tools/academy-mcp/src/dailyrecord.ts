import {randomUUID,createHash} from 'node:crypto';
import {z} from 'zod';
import {dailyRecordContextSchema,dailyRecordDateSchema,dailyRecordFieldSchema,dailyRecordFields,dailyRecordIdSchema,dailyRecordScopeSchema,dailyRecordWorkflowContext,type DailyRecordContext,type DailyRecordField,type DailyRecordScope} from './dailyrecord-context.ts';
import {freezeLabelData} from './item-label-context.ts';
import {itemAnswerLookupSchema,projectItemAnswerRead} from './item-answer-lookup.ts';
import {resolveStudentByName,studentResolveInputSchema} from './student-resolver.ts';
import {readDailyRecordByName,type DailyRecordReadAdmission} from './dailyrecord-read.ts';
import {readFailureResult} from './read-failure.ts';
import {toolResultBytes} from './tool-result.ts';
import {actorProofSchema,consumedWithoutEffect,executionKey,fieldExecutionState,needsReconciliation,requestBoundApproval,settledEffect,signedAuthorizationSchema,textDigest,workflowLockKey,workflowRequestKey,canonicalSame,type DailyRecordActionApproval,type DailyRecordAuthorization,type DailyRecordReviewPolicyPins,type DailyRecordWorkflow,type FieldExecutionState} from './dailyrecord-workflow.ts';

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
export const dailyRecordIntakeSchema=z.object({context:dailyRecordContextSchema,suppliedValues:z.array(proposalSchema).max(6).default([]),actorProof:actorProofSchema.optional()}).strict();
export const dailyRecordReviewSchema=z.object({context:dailyRecordContextSchema,observationHandle:dailyRecordIdSchema.optional(),
  cismObservationHandle:dailyRecordIdSchema.optional(),
  proposals:z.array(proposalSchema).min(1).max(6),actorProof:actorProofSchema.optional(),
}).strict();
const cismSelectionSchema=z.object({reportId:dailyRecordIdSchema,periodStart:dailyRecordDateSchema,periodEnd:dailyRecordDateSchema,section:z.literal('learning_support')}).strict().refine(v=>v.periodStart<=v.periodEnd,'ordered_reporting_period_required');
export const cismSectionSchema=z.object({context:dailyRecordContextSchema,selection:cismSelectionSchema}).strict();
export const cismObservationSchema=z.object({scope:dailyRecordScopeSchema,selection:cismSelectionSchema,observedAt:instant,sourceRevision:hash,
  sourceReferenceDate:dailyRecordDateSchema,sectionLabel:z.literal('학습부진아 지도'),text:z.string().max(20000),evidenceRefs:z.array(dailyRecordIdSchema).min(1).max(32),
}).strict();
export type CismObservation=z.infer<typeof cismObservationSchema>;
type Proposal=z.infer<typeof proposalSchema>;
type ReadResult<T>={status:'observed';observation:T}|{status:'unavailable';reasonCode:string};
const metadataPeriod=z.object({from:dailyRecordDateSchema,through:dailyRecordDateSchema}).strict().refine(v=>v.from<=v.through,'ordered_metadata_period_required');
export const studentMetadataQuerySchema=z.discriminatedUnion('kind',[
  z.object({kind:z.literal('student_papers'),period:metadataPeriod}).strict(),
  z.object({kind:z.literal('daily_metadata')}).strict(),
  z.object({kind:z.literal('daily_inventory')}).strict(),
  z.object({kind:z.literal('daily_history'),periods:z.array(z.enum(['11','12','13','14','15','16'])).min(1).max(6).refine(v=>new Set(v).size===v.length,'unique_metadata_selectors_required')}).strict(),
  z.object({kind:z.literal('printed_paper_metadata'),paperCode:z.string().regex(/^#[3456789ABCDEFGHJKLMNPQRSTUVWXYZ][23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{0,10}$/),period:metadataPeriod}).strict(),
]);
/** Separate read-only query transport: never a DailyRecord field, fact, approval or credential input. */
export const studentMetadataBatchSchema=z.object({purpose:dailyRecordIdSchema,currentRequestRef:dailyRecordIdSchema,
  scope:dailyRecordScopeSchema.extend({sourceNamespace:z.literal('academy.lms.metadata')}).strict(),
  queries:z.array(studentMetadataQuerySchema).min(1).max(8),
}).strict();
export type StudentMetadataBatch=z.infer<typeof studentMetadataBatchSchema>;
export const studentMetadataGetSchema=z.object({displayName:z.string().trim().min(1).max(200),lessonDate:dailyRecordDateSchema,
  purpose:dailyRecordIdSchema,currentRequestRef:dailyRecordIdSchema,queries:z.array(studentMetadataQuerySchema).min(1).max(8)}).strict();
export type StudentMetadataGet=z.infer<typeof studentMetadataGetSchema>;
export type StudentMetadataObservation={scope:StudentMetadataBatch['scope'];results:{query:StudentMetadataBatch['queries'][number];observation:unknown}[]};
const nativeKeySchema=z.string().regex(/^[1-9][0-9]{0,15}$/);
/** Exact textbook section grading read: source titles are the source's own
 * section/test titles for one student/course/book. Scores and per-item O/X
 * outcomes only; no clinic solving, teacher acceptance or print state. */
export const textbookSectionResultsSchema=z.object({displayName:z.string().trim().min(1).max(200),
  purpose:dailyRecordIdSchema,currentRequestRef:dailyRecordIdSchema,
  courseKey:nativeKeySchema,bookNo:nativeKeySchema,
  sourceTitles:z.array(z.string().trim().min(1).max(200)).min(1).max(12).refine(v=>new Set(v).size===v.length,'unique_source_titles_required')}).strict();
export type TextbookSectionResults=z.infer<typeof textbookSectionResultsSchema>;
export type TextbookSectionObservation={student:{studentId:string;displayName:string};courseKey:string;bookNo:string;
  records:{sourceTitle:string;score:number;correctCount:number;itemCount:number;items:{ordinal:string;scoring:'O'|'X'}[];sourceDate:{literal:string|null;precision:string;meaning:string}}[];observedAt:string;coverage:string};
/** Implemented by the native/source owner, never by MCP arguments. All methods are read-only. */
export interface DailyRecordReadBackend {
  readRoutingAdmission?():DailyRecordReadAdmission;
  readDailyRecord(scope:Readonly<DailyRecordScope>,requestRef:string):Promise<ReadResult<DailyRecordObservation>>;
  readStudentMetadataByName?(input:Readonly<StudentMetadataGet>):Promise<StudentMetadataObservation>;
  readStudentMetadata?(input:Readonly<StudentMetadataBatch>):Promise<StudentMetadataObservation>;
  readItemAnswers?(labels:readonly string[]):Promise<unknown>;
  readCismSection?(scope:Readonly<DailyRecordScope>,selection:Readonly<z.infer<typeof cismSelectionSchema>>):Promise<ReadResult<CismObservation>>;
  searchStudentsByName?(exactName:Readonly<string>,requestRef:string,lessonDate?:string):Promise<unknown>;
  readTextbookSections?(input:Readonly<TextbookSectionResults>):Promise<TextbookSectionObservation>;
}
export const dailyRecordSaveSchema=z.object({context:dailyRecordContextSchema,observationHandle:dailyRecordIdSchema,
  cismObservationHandle:dailyRecordIdSchema.optional(),
  reviewDigest:hash,proposals:z.array(proposalSchema).min(1).max(6),
  /** Owner-issued signed per-request authorization; its signature, not the caller, is the authority. */
  authorization:signedAuthorizationSchema.optional(),actorProof:actorProofSchema.optional()}).strict();
const authorizationIdSchema=z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/);
export const dailyRecordReconcileSchema=z.object({context:dailyRecordContextSchema,authorizationId:authorizationIdSchema,actorProof:actorProofSchema.optional()}).strict();
export const dailyRecordExecutionStatusSchema=z.object({authorizationId:authorizationIdSchema,actorProof:actorProofSchema.optional()}).strict();
/** Upstream tool name to input schema for actor-proof payload normalization. */
export const dailyRecordWorkflowToolSchemas={academy_dailyrecord_intake:dailyRecordIntakeSchema,academy_dailyrecord_review:dailyRecordReviewSchema,
  academy_dailyrecord_save:dailyRecordSaveSchema,academy_dailyrecord_reconcile:dailyRecordReconcileSchema,academy_dailyrecord_execution_status:dailyRecordExecutionStatusSchema} as const;
export type DailyRecordWorkflowToolName=keyof typeof dailyRecordWorkflowToolSchemas;
export type DailyRecordSave=z.infer<typeof dailyRecordSaveSchema>;
export type DailyRecordSaveFieldStatus='persisted'|'noop'|'not_persisted'|'conflict'|'unresolved'|'not_attempted'|'before_drift';
/** Implemented by the native/source owner only, never from MCP arguments.
 * Each patch carries the reviewed before-value and wire digest; the backend
 * must refuse the whole batch before any write when its fresh before-state
 * differs. It then runs the launch-pinned save admission's one-time
 * consumption, a single write and an authoritative readback inside the
 * owner client. Uncertain dispatches resolve by later readback, never by
 * retrying inside this call, and are reported, never thrown past the point
 * of possible dispatch. */
export interface DailyRecordWriteBackend {
  /** Legacy launch-pinned admission path. */
  saveConfigured():boolean;
  /** Owner client write port is present; per-request approval is supplied by the owner workflow. */
  requestBoundSaveConfigured?():boolean;
  saveDailyRecord(scope:Readonly<DailyRecordScope>,patches:readonly {field:DailyRecordField;value:string;before:string;wireDigest:string}[],approval?:DailyRecordActionApproval):Promise<{field:DailyRecordField;status:DailyRecordSaveFieldStatus;dispatched:boolean;transport?:'returned'|'uncertain'|'not_invoked'}[]>;
}
/** Inject the canonical Education safeguard, together with its verified policy/source identity. */
export interface DailyRecordParentSafeguard {readonly policySha256:string;readonly safeguardSourceSha256:string;readonly sourceRef:string;check(text:string):boolean;checkLines(text:string):boolean}
/** Trusted owner-side adapter; no catalog/bridge or verification flags come from tool input. */
export interface DailyRecordLearningPolicy {readonly bundleSha256:string;readonly configSha256:string;readonly catalogSha256:string;review(scope:Readonly<DailyRecordScope>,value:string,entries:unknown):string[];suggest?(scope:Readonly<DailyRecordScope>,value:string,entries:unknown):string|null}
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fieldValues=(observation:DailyRecordObservation)=>Object.fromEntries(dailyRecordFields.map(field=>{const value=observation.fields[field];return [field,value.state==='known'?{state:value.state,value:value.value}:{state:value.state,reasonCode:value.reasonCode}];}));
const scopeOf=(target:z.infer<typeof currentTargetSchema>):DailyRecordScope=>({sourceNamespace:target.sourceNamespace,teacherId:target.teacherId,studentId:target.studentId,lessonDate:target.lessonDate});
const safeReason=(value:string)=>readFailureResult(Error(value),'source_read_unavailable').reasonCode;
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

/** Field-local next steps for held rows. Guidance names who can resolve a
 * hold; it never supplies a mapping, option or teacher decision. */
const holdActionTable:[RegExp,string,string][]=[
  [/_ask_teacher$|^interview_required$/,'teacher_interview','Ask the teacher for the exact edition/unit/section binding of this activity and record the answer as a scoped correction for this student, edition and activity only.'],
  [/^learning_entries_required$/,'supply_learning_entries','Supply learningEntries binding book, unit and sections through the owner catalog.'],
  [/^learning_(mapping_unqualified|evidence_required|book_invalid|unit_invalid|section_invalid|edition_invalid|grade_invalid|entry_invalid)$|^duplicate_learning_/,'owner_catalog_binding','The owner catalog has no qualified binding for this entry; record a teacher-confirmed binding in the private owner catalog. Never invent a mapping.'],
  [/^learning_render_mismatch$/,'teacher_review_rendering','Text differs from the canonical grouped rendering; the teacher reviews any format example for meaning before resubmitting.'],
  [/^canonical_(learning_policy|parent_safeguard)_not_connected$|^learning_(catalog|contract)_invalid$/,'owner_configuration','The runtime owner must connect the pinned policy; a caller cannot resolve this.'],
  [/^(supplied_fact_fragment_missing|unsupported_question_count|unsupported_deadline|unsupported_completion_claim|unsupported_stage_completion_claim|stage_completion_mismatch|field_fact_reference_required|explicit_user_source_option_fact_required|conflicting_explicit_user_source_options|duplicate_fact_ref)$/,'supply_or_correct_fact','The text asserts something the supplied teacher facts do not support; obtain that teacher fact or remove the claim.'],
  [/^(source_before_or_contract_drift|stale_source|qualified_before_source_unavailable|unknown_before|qualified_current_record_required|independent_previous_record_required|exact_fresh_cism_observation_handle_required|cism_fact_not_bound_to_exact_observed_section)$/,'fresh_intake','Run a fresh intake and review; the source changed or is not qualified.'],
  [/^(parent_hyphen_lines_required|parent_internal_language_excluded|invalid_explicit_field_value)$/,'rewrite_text','Rewrite the parent-facing field text and review again.'],
  [/^(existing_value_requires_explicit_replace|explicit_clear_decision_required|clear_requires_empty_value|no_addition_preserves_existing_memo|today_memo_interview_required|field_not_selected|current_request_ref_required)$/,'explicit_teacher_decision','Obtain the explicit teacher decision for this exact field and request.'],
];
function holdActions(scope:DailyRecordScope,field:DailyRecordField,blockers:readonly string[],learningEntries:unknown){
  return blockers.map(code=>{
    const match=holdActionTable.find(([pattern])=>pattern.test(code.split(':')[0]!));
    const action=match?.[1]??'resolve_blocker';
    return {field,code,action,guidance:match?.[2]??null,
      correctionScope:action==='teacher_interview'||action==='owner_catalog_binding'?{scope,field,learningEntries:learningEntries??null,appliesTo:'this_student_edition_unit_activity_only' as const}:null};
  });
}
type ReviewedPatch={field:DailyRecordField;target:z.infer<typeof currentTargetSchema>|null;before:string|null;after:string};
type StoredReview={reviewDigest:string;status:string;scope:DailyRecordScope;requestRef:string;observationHandle:string|null;
  patch:{field:DailyRecordField;before:string;after:string;effectRecordKey:string}[];reviewPolicy:DailyRecordReviewPolicyPins;reviewedBy:string|null;reviewedAt:string};

export class DailyRecordService {
  readonly #handles=new Map<string,{observation:DailyRecordObservation;scope:DailyRecordScope;requestRef:string}>();
  readonly #cismHandles=new Map<string,CismObservation>();
  #tail:Promise<unknown>=Promise.resolve();
  constructor(readonly backend:DailyRecordReadBackend|null=null,readonly parentSafeguard:DailyRecordParentSafeguard|null=null,readonly now:()=>number=Date.now,readonly learningPolicy:DailyRecordLearningPolicy|null=null,readonly writeBackend:DailyRecordWriteBackend|null=null,
    /** Owner-durable workflow; when present it replaces process-local handles and the launch-pinned save path. */
    readonly workflow:DailyRecordWorkflow|null=null){
    if(learningPolicy)for(const pin of [learningPolicy.bundleSha256,learningPolicy.configSha256,learningPolicy.catalogSha256])hash.parse(pin);
    if(parentSafeguard){hash.parse(parentSafeguard.policySha256);hash.parse(parentSafeguard.safeguardSourceSha256);dailyRecordIdSchema.parse(parentSafeguard.sourceRef);}
  }
  #base(context:DailyRecordContext){return {workflowContext:dailyRecordWorkflowContext,userContext:context,academyWrites:0,parentSends:0,automaticRetryAllowed:false,sourceContentIsUntrustedData:true};}
  #age(observedAt:string){const age=this.now()-Date.parse(observedAt);return age<0||age>300000;}
  #policyPins():DailyRecordReviewPolicyPins{
    return {learningPolicy:this.learningPolicy?{bundleSha256:this.learningPolicy.bundleSha256,configSha256:this.learningPolicy.configSha256,catalogSha256:this.learningPolicy.catalogSha256}:null,
      parentSafeguard:this.parentSafeguard?{policySha256:this.parentSafeguard.policySha256,safeguardSourceSha256:this.parentSafeguard.safeguardSourceSha256}:null};
  }
  /** Authenticate the caller runtime for this exact normalized payload. */
  #actor(tool:string,input:{actorProof?:unknown}){
    if(!this.workflow)return {status:'rejected' as const,reasonCode:'dailyrecord_workflow_not_configured'};
    const {actorProof,...payload}=input;
    return this.workflow.actors.verify(tool,payload,actorProof);
  }
  #observation(handle:string):{observation:DailyRecordObservation;scope:DailyRecordScope;requestRef:string}|undefined{
    const local=this.#handles.get(handle);if(local||!this.workflow)return local;
    const stored=this.workflow.store.get('observation',handle) as {observation:unknown;scope:unknown;requestRef:unknown}|null;
    if(!stored)return undefined;
    return {observation:freezeLabelData(dailyRecordObservationSchema.parse(stored.observation)),scope:dailyRecordScopeSchema.parse(stored.scope),requestRef:dailyRecordIdSchema.parse(stored.requestRef)};
  }
  // P4: serialization keeps the account-lock order, but failures close per
  // request. No session-wide latch: the next request gets a fresh judgement,
  // still with no automatic retry inside a request. Uncertain source state
  // is resolved only by a later readback, never by replaying the failure.
  async #serial<T>(run:()=>Promise<T>):Promise<T>{
    const result=this.#tail.then(run);
    this.#tail=result.catch(()=>{});return result;
  }
  async #read(scope:DailyRecordScope,requestRef:string){
    if(!this.backend)return {status:'unavailable' as const,reasonCode:'dailyrecord_read_backend_not_configured'};
    try{return await this.#serial(async()=>{
      const read=await this.backend!.readDailyRecord(freezeLabelData(structuredClone(scope)),requestRef);
      if(read.status==='unavailable')return {status:'unavailable' as const,reasonCode:safeReason(read.reasonCode)};
      return {status:'observed' as const,observation:qualifiedObservation(read.observation,scope)};
    });
    }catch(error){return {status:'unavailable' as const,...readFailureResult(error,'dailyrecord_source_unqualified_no_automatic_retry')};}
  }
  async metadata(value:unknown){
    const input=studentMetadataBatchSchema.parse(value);
    const base={scope:input.scope,purpose:input.purpose,currentRequestRef:input.currentRequestRef,
      academyWrites:0,parentSends:0,automaticRetryAllowed:false,sourceContentIsUntrustedData:true,execution:'read_only' as const};
    // Failure responses retain correlation and effects without duplicating the
    // caller's scope/purpose in both MCP representations or returning source rows.
    const failureBase={currentRequestRef:input.currentRequestRef,academyWrites:0,parentSends:0,automaticRetryAllowed:false,execution:'read_only' as const};
    if(!this.backend?.readStudentMetadata)return {...failureBase,status:'unavailable' as const,reasonCode:'student_metadata_backend_not_configured'};
    try{
      // The same queue/latch protects metadata, DailyRecord and CISM reads on this service/client.
      return await this.#serial(async()=>{
        const observation=await this.backend!.readStudentMetadata!(freezeLabelData(structuredClone(input)));
        if(!same(observation.scope,input.scope)||observation.results.length!==input.queries.length
          ||observation.results.some((row,i)=>!same(row.query,input.queries[i])))throw Error('metadata_scope_or_query_conflict');
        const result={...base,status:'observed' as const,results:observation.results};
        // Measure the actual dual MCP representation, not just its structuredContent half.
        if(toolResultBytes(result)>512*1024)throw Error('metadata_result_too_large');
        return freezeLabelData(result);
      });
    }catch(error){return {...failureBase,status:'unavailable' as const,...readFailureResult(error,'student_metadata_unqualified_no_automatic_retry')};}
  }
  async metadataByName(value:unknown){
    const input=studentMetadataGetSchema.parse(value);
    const base={purpose:input.purpose,currentRequestRef:input.currentRequestRef,academyWrites:0,parentSends:0,automaticRetryAllowed:false,execution:'read_only' as const};
    if(!this.backend?.readStudentMetadataByName)return {...base,status:'unavailable' as const,reasonCode:'student_metadata_backend_not_configured'};
    try{return await this.#serial(async()=>{
      const observation=await this.backend!.readStudentMetadataByName!(freezeLabelData(structuredClone(input)));
      const scope=studentMetadataBatchSchema.shape.scope.parse(observation.scope);
      if(scope.lessonDate!==input.lessonDate||observation.results.length!==input.queries.length||observation.results.some((r,i)=>!same(r.query,input.queries[i])))throw Error('native_metadata_row_identity_conflict');
      const result={...base,status:'observed' as const,scope,results:observation.results};
      if(toolResultBytes(result)>512*1024)throw Error('metadata_result_too_large');
      return freezeLabelData(result);
    });}catch(error){return {...base,status:'unavailable' as const,...readFailureResult(error,'student_metadata_unqualified_no_automatic_retry')};}
  }
  async itemAnswers(value:unknown){
    const input=itemAnswerLookupSchema.parse(value);
    const base={purpose:input.purpose,currentRequestRef:input.currentRequestRef,labels:input.labels,
      academyWrites:0,parentSends:0,nativePrintInvoked:false,automaticRetryAllowed:false,sourceContentIsUntrustedData:true,execution:'read_only' as const};
    if(!this.backend?.readItemAnswers)return {...base,status:'unavailable' as const,reasonCode:'item_answer_backend_not_configured'};
    try{
      const result={...base,...projectItemAnswerRead(await this.#serial(()=>this.backend!.readItemAnswers!(input.labels)),input.labels)};
      if(toolResultBytes(result)>512*1024)throw Error('item_answer_result_too_large');
      return freezeLabelData(result);
    }
    catch(error){return {...base,status:'unavailable' as const,...readFailureResult(error,'item_answer_source_unqualified_no_automatic_retry')};}
  }
  async textbookSections(value:unknown){
    const input=textbookSectionResultsSchema.parse(value);
    const base={purpose:input.purpose,currentRequestRef:input.currentRequestRef,displayName:input.displayName,
      academyWrites:0,parentSends:0,automaticRetryAllowed:false,sourceContentIsUntrustedData:true,execution:'read_only' as const};
    if(!this.backend?.readTextbookSections)return {...base,status:'unavailable' as const,reasonCode:'textbook_section_backend_not_configured'};
    try{
      const result=await this.#serial(async()=>{
        const observation=await this.backend!.readTextbookSections!(freezeLabelData(structuredClone(input)));
        if(observation.student.displayName!==input.displayName||observation.courseKey!==input.courseKey||observation.bookNo!==input.bookNo
          ||observation.records.length!==input.sourceTitles.length
          ||new Set(observation.records.map(r=>r.sourceTitle)).size!==input.sourceTitles.length
          ||observation.records.some(r=>!input.sourceTitles.includes(r.sourceTitle)))throw Error('textbook_section_scope_conflict');
        return {...base,status:'observed' as const,...observation};
      });
      if(toolResultBytes(result)>512*1024)throw Error('textbook_section_result_too_large');
      return freezeLabelData(result);
    }catch(error){return {...base,status:'unavailable' as const,...readFailureResult(error,'textbook_section_unqualified_no_automatic_retry')};}
  }
  async get(value:unknown){
    return readDailyRecordByName(value,this,this.backend?.readRoutingAdmission?.()??null,this.now);
  }
  async resolveStudent(value:unknown){
    const input=studentResolveInputSchema.parse(value);
    const base={purpose:input.purpose,currentRequestRef:input.currentRequestRef,displayName:input.displayName,
      academyWrites:0,parentSends:0,automaticRetryAllowed:false,sourceContentIsUntrustedData:true,execution:'read_only' as const};
    if(!this.backend?.searchStudentsByName)return {...base,status:'unavailable' as const,reasonCode:'student_resolve_backend_not_configured'};
    try{
      return await this.#serial(async()=>{
        const result=await resolveStudentByName(input.displayName,{searchByName:name=>this.backend!.searchStudentsByName!(name,input.currentRequestRef,input.lessonDate)});
        if(result.status==='unavailable')return {...base,...result};
        return freezeLabelData({...base,...result});
      });
    }catch(error){return {...base,status:'unavailable' as const,...readFailureResult(error,'student_resolve_unqualified_no_automatic_retry')};}
  }
  async intake(value:unknown){
    const input=dailyRecordIntakeSchema.parse(value),context=input.context;
    if(new Set(input.suppliedValues.map(p=>p.field)).size!==input.suppliedValues.length)throw Error('duplicate_proposal_field');
    const read=await this.#read(context.scope,context.currentRequestRef),source=read.status==='observed'?read.observation:null;
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
    const actor=this.workflow&&input.actorProof!==undefined?this.#actor('academy_dailyrecord_intake',input):null;
    if(source&&!blockers.length){
      if(this.#handles.size>=128)this.#handles.delete(this.#handles.keys().next().value!);observationHandle='dailyrecord-observation:'+randomUUID();
      this.#handles.set(observationHandle,{observation:source,scope:freezeLabelData(structuredClone(context.scope)),requestRef:context.currentRequestRef});
      if(this.workflow){
        const createdBy=actor?.status==='authenticated'?actor.actorId:null;
        this.workflow.store.publishOnce('observation',observationHandle,{observation:source,scope:context.scope,requestRef:context.currentRequestRef,createdBy,createdAt:new Date(this.now()).toISOString()});
        this.workflow.store.appendAudit(workflowRequestKey(context.scope,context.currentRequestRef),{event:'observation_recorded',observationHandle,actorId:createdBy,sourceRevision:source.sourceRevision});
      }
    }
    return {...this.#base(context),status:blockers.length?'held':interviews.length?'interview_required':'ready_for_review',observationHandle,
      observationPersistence:observationHandle&&this.workflow?'owner_durable' as const:'process_local' as const,
      actorAuthentication:actor?(actor.status==='authenticated'?{status:actor.status,actorId:actor.actorId}:actor):null,fields,interviews,blockers,
      source:source?{observedAt:source.observedAt,sourceRevision:source.sourceRevision,wireDigest:source.wireDigest,transmissionState:source.transmissionState}:null,
      toneSamples:source?.toneSamples.filter(s=>this.parentSafeguard?.checkLines(s.text))??[],toneSelection:'hyphen_lines_only_other_formats_ignored',sourceAvailability:read.status,failure:'failure' in read?read.failure:null,execution:'not_supported'};
  }
  async review(value:unknown){return this.#review(value,true);}
  async #review(value:unknown,persist:boolean){
    const input=dailyRecordReviewSchema.parse(value),context=input.context,held=input.observationHandle?this.#observation(input.observationHandle):undefined;
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
    const read=!held||global.length?null:await this.#read(context.scope,context.currentRequestRef);
    if(read?.status==='unavailable')global.push(read.reasonCode);
    if(held&&read?.status==='observed'){
      if(this.#age(read.observation.observedAt))global.push('stale_source');
      if(!same(read.observation.target,held.observation.target)||!same(read.observation.previousTarget,held.observation.previousTarget)||!same(fieldValues(read.observation),fieldValues(held.observation))||read.observation.wireDigest!==held.observation.wireDigest||read.observation.sourceRevision!==held.observation.sourceRevision||read.observation.transmissionState!==held.observation.transmissionState)global.push('source_before_or_contract_drift');
    }
    const rows=input.proposals.map(p=>{
      const before=held?.observation.fields[p.field]??{state:'unknown' as const,reasonCode:'qualified_before_source_unavailable'},target=p.field==='previousHomeworkAssessment'?held?.observation.previousTarget??null:held?.observation.target??null;
      const blockers=[...global,...proposalBlockers(p,context)];
      let learningSuggestedRendering:string|null=null;
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
          else {
            const learningBlockers=this.learningPolicy.review(context.scope,p.value,p.learningEntries);
            blockers.push(...learningBlockers);
            if(held&&!global.length&&learningBlockers.includes('learning_render_mismatch'))
              learningSuggestedRendering=this.learningPolicy.suggest?.(context.scope,p.value,p.learningEntries)??null;
          }
        }
        if(!this.parentSafeguard)blockers.push('canonical_parent_safeguard_not_connected');
        else if(this.parentSafeguard.check(p.value))blockers.push('parent_internal_language_excluded');
      }
      const unique=[...new Set(blockers)];
      return {field:p.field,target,before,after:p.value,factRefs:p.factRefs,learningEntries:p.learningEntries??null,learningSuggestedRendering,
        learningSuggestionMeaning:learningSuggestedRendering===null?null:'format_example_only_teacher_must_review_meaning',disposition:unique.length?'blocked':changed?'proposed':'noop',blockers:unique,missingFactFragments:missingFragments,
        holdActions:holdActions(context.scope,p.field,unique,p.learningEntries),
        semanticFactReview:'teacher_review_required_not_proven_by_fragment_checks'};
    });
    const interviews=context.memoAnswer.kind==='not_supplied'?[{field:'lessonMemo',reasonCode:'today_student_specific_memo_required'}]:[];
    const patch=rows.filter(r=>r.disposition==='proposed').map(r=>({field:r.field,target:r.target,before:r.before.state==='known'?r.before.value:null,after:r.after,factRefs:r.factRefs,learningEntries:r.learningEntries}));
    const parentSafeguard=this.parentSafeguard?{sourceRef:this.parentSafeguard.sourceRef,policySha256:this.parentSafeguard.policySha256,safeguardSourceSha256:this.parentSafeguard.safeguardSourceSha256}:null;
    const cismSource=cism?{observationHandle:input.cismObservationHandle,scope:cism.scope,selection:cism.selection,observedAt:cism.observedAt,sourceRevision:cism.sourceRevision,evidenceRefs:cism.evidenceRefs}:null;
    const body={observationHandle:input.observationHandle??null,scope:context.scope,requestRef:context.currentRequestRef,userContextDigest:digest(context),parentSafeguard,cismSource,learningPolicy:this.learningPolicy?{bundleSha256:this.learningPolicy.bundleSha256,configSha256:this.learningPolicy.configSha256,catalogSha256:this.learningPolicy.catalogSha256}:null,
      sourceRevision:held?.observation.sourceRevision??null,wireDigest:held?.observation.wireDigest??null,transmissionState:read?.status==='observed'?read.observation.transmissionState:held?.observation.transmissionState??'unknown',rows,patch};
    const status=rows.some(r=>r.blockers.length)||interviews.length?'held' as const:'prepared' as const,reviewDigest=digest(body);
    let reviewRecord:{persisted:boolean;reviewedBy:string|null;actorAuthentication:unknown}|null=null;
    if(persist&&this.workflow&&status==='prepared'&&input.observationHandle){
      const actor=this.#actor('academy_dailyrecord_review',input),reviewedBy=actor.status==='authenticated'?actor.actorId:null;
      // Only an authenticated review can later support a save; an
      // unauthenticated one is reported but never recorded as reviewed.
      if(reviewedBy){
        const record:StoredReview={reviewDigest,status,scope:context.scope,requestRef:context.currentRequestRef,observationHandle:input.observationHandle,
          patch:(patch as ReviewedPatch[]).map(p=>({field:p.field,before:p.before??'',after:p.after,effectRecordKey:p.target?.recordId??''})),
          reviewPolicy:this.#policyPins(),reviewedBy,reviewedAt:new Date(this.now()).toISOString()};
        this.workflow.store.publishOnce('review',reviewDigest,record);
        this.workflow.store.appendAudit(workflowRequestKey(context.scope,context.currentRequestRef),{event:'review_recorded',reviewDigest,actorId:reviewedBy,fields:record.patch.map(p=>p.field)});
      }
      reviewRecord={persisted:reviewedBy!==null,reviewedBy,actorAuthentication:actor.status==='authenticated'?{status:actor.status,actorId:actor.actorId}:actor};
    }
    return {...this.#base(context),...body,status,interviews,reviewDigest,reviewRecord,
      execution:'not_supported',saveAdmission:this.workflow?'owner_signed_request_authorization_required':'separate_trusted_native_owner_required'};
  }
  async save(value:unknown){
    const input=dailyRecordSaveSchema.parse(value),context=input.context;
    if(this.workflow)return this.#saveRequestBound(input);
    const base={...this.#base(context),observationHandle:input.observationHandle,reviewDigest:input.reviewDigest};
    if(!this.writeBackend?.saveConfigured())return {...base,status:'unavailable' as const,reasonCode:'dailyrecord_save_backend_not_configured',
      academyWrites:0,execution:'not_supported' as const,saveAdmission:'separate_trusted_native_owner_required' as const,fields:[]};
    // Recompute the exact review against a fresh before-state. The caller's
    // reviewDigest must match it, so unreviewed or drifted text never writes.
    const reviewed=await this.#review({context,observationHandle:input.observationHandle,cismObservationHandle:input.cismObservationHandle,proposals:input.proposals},false);
    if(reviewed.status!=='prepared'||reviewed.reviewDigest!==input.reviewDigest||reviewed.execution!=='not_supported')
      return {...base,status:'held' as const,reasonCode:'reviewed_patch_required',academyWrites:0,execution:'not_supported' as const,
        fields:reviewed.rows.map(r=>({field:r.field,status:'not_attempted' as const,dispatched:false}))};
    const patch=(reviewed.patch as {field:DailyRecordField;before:string|null;after:string}[]).map(p=>({field:p.field,value:p.after,before:p.before??'',wireDigest:reviewed.wireDigest??''}));
    if(!patch.length)return {...base,status:'saved' as const,academyWrites:0,execution:'owner_write_backend' as const,
      fields:input.proposals.map(p=>({field:p.field,status:'noop' as const,dispatched:false}))};
    try{
      const fields=await this.#serial(()=>this.writeBackend!.saveDailyRecord(freezeLabelData(structuredClone(context.scope)),patch));
      const academyWrites=fields.filter(f=>f.dispatched).length;
      const settled=fields.every(f=>f.status==='persisted'||f.status==='noop');
      return {...base,status:settled?'saved' as const:'held' as const,reasonCode:settled?null:'save_reconciliation_required',
        academyWrites,execution:'owner_write_backend' as const,fields};
    }catch(error){return {...base,status:'held' as const,...readFailureResult(error,'dailyrecord_save_unqualified_no_automatic_retry'),reasonCode:'save_reconciliation_required',academyWrites:null,execution:'not_supported' as const,fields:[]};}
    // A backend throw is reconciled by readback, never denied as zero
    // writes: conforming backends report per-field dispatch themselves,
    // so this path only covers pre-dispatch or non-conforming failures.
  }
  /** Owner-workflow save: authenticated actor, owner-signed per-request
   * authorization, a prior authenticated durable review, a shared
   * cross-process writer lock, fresh recomputed review, durable one-time
   * consumption before dispatch and recorded field outcomes. Uncertain
   * dispatches are never retried; they need academy_dailyrecord_reconcile. */
  async #saveRequestBound(input:z.infer<typeof dailyRecordSaveSchema>){
    const workflow=this.workflow!,store=workflow.store,context=input.context,scope=context.scope;
    const requestKey=workflowRequestKey(scope,context.currentRequestRef);
    const base={...this.#base(context),observationHandle:input.observationHandle,reviewDigest:input.reviewDigest,
      parentTransmission:'separate_explicit_instruction_required' as const,workflowStoreScope:store.scope};
    const hold=(reasonCode:string,extra:Record<string,unknown>={})=>{
      store.appendAudit(requestKey,{event:'save_held',reasonCode,reviewDigest:input.reviewDigest});
      return {...base,status:'held' as const,reasonCode,academyWrites:0,execution:'not_supported' as const,fields:[] as unknown[],...extra};
    };
    if(!this.writeBackend?.requestBoundSaveConfigured?.())
      return {...base,status:'unavailable' as const,reasonCode:'dailyrecord_request_bound_save_backend_not_configured',academyWrites:0,execution:'not_supported' as const,fields:[]};
    const actor=this.#actor('academy_dailyrecord_save',input);
    if(actor.status!=='authenticated')return hold(actor.reasonCode);
    const verified=workflow.authorizations.verify(input.authorization);
    if(verified.status!=='verified')return hold(verified.reasonCode);
    const authorization=verified.authorization,authorizationId=authorization.authorizationId;
    if(authorization.requestRef!==context.currentRequestRef)return hold('authorization_request_mismatch');
    if(!authorization.authorizedActors.includes(actor.actorId))return hold('actor_not_authorized_for_request');
    if(!canonicalSame(authorization.reviewPolicy,this.#policyPins()))return hold('authorization_review_policy_mismatch');
    // The issuer must have authorized against at least one authenticated recorded review of this exact request.
    if(!authorization.basedOnReviewDigests.some(d=>{const r=store.get('review',d) as StoredReview|null;return r!==null&&r.reviewedBy!==null&&canonicalSame(r.scope,scope)&&r.requestRef===context.currentRequestRef;}))
      return hold('authorization_review_not_recorded');
    const prior=store.get('review',input.reviewDigest) as StoredReview|null;
    if(!prior)return hold('prior_review_record_required');
    if(prior.status!=='prepared'||prior.reviewedBy===null||!canonicalSame(prior.scope,scope)||prior.requestRef!==context.currentRequestRef
      ||prior.observationHandle!==input.observationHandle||!canonicalSame(prior.reviewPolicy,this.#policyPins()))return hold('prior_review_record_mismatch');
    if(!prior.patch.length)return {...base,status:'saved' as const,reasonCode:'reviewed_patch_empty',academyWrites:0,execution:'owner_request_bound' as const,
      fields:input.proposals.map(p=>({field:p.field,status:'noop' as const,dispatched:false}))};
    for(const p of prior.patch){
      if(!authorization.actions.some(a=>canonicalSame(a.scope,scope)&&a.field===p.field&&a.before===p.before&&a.after===p.after))
        return hold('authorization_action_mismatch',{field:p.field});
    }
    const recorded=store.publishOnce('authorization',authorizationId,{signed:verified.signed,firstVerifiedAt:new Date(this.now()).toISOString()});
    if(!recorded.created&&!canonicalSame((recorded.record as {signed:unknown}).signed,verified.signed))return hold('authorization_id_conflict');
    if(recorded.created)store.appendAudit(requestKey,{event:'authorization_recorded',authorizationId,issuerId:authorization.issuerId,
      userEventRef:authorization.userEvent.eventRef,actorId:actor.actorId,fields:authorization.actions.filter(a=>canonicalSame(a.scope,scope)).map(a=>a.field)});
    const state=(field:DailyRecordField)=>fieldExecutionState(store,executionKey(authorizationId,scope,field));
    const report=(field:DailyRecordField,extra:Record<string,unknown>={})=>({field,executionState:state(field),...extra});
    try{
      return await store.withLock(workflowLockKey(scope),async()=>{
        // Re-read execution state inside the lock: another process may have finished.
        const states=prior.patch.map(p=>({field:p.field,state:state(p.field)}));
        if(states.some(s=>needsReconciliation(s.state)))return hold('uncertain_dispatch_reconcile_required',{fields:states.map(s=>report(s.field))});
        if(states.some(s=>consumedWithoutEffect(s.state)))return hold('authorization_consumed_new_authorization_required',{fields:states.map(s=>report(s.field))});
        if(states.every(s=>settledEffect(s.state)))return {...base,status:'saved' as const,reasonCode:'duplicate_execution_already_settled',academyWrites:0,
          execution:'owner_request_bound' as const,authorizationId,actorId:actor.actorId,fields:states.map(s=>report(s.field,{status:'noop',dispatched:false}))};
        const fresh=await this.#review({context,observationHandle:input.observationHandle,cismObservationHandle:input.cismObservationHandle,proposals:input.proposals},false);
        if(fresh.status!=='prepared'||fresh.reviewDigest!==input.reviewDigest)
          return hold('fresh_review_drift_new_review_required',{fields:fresh.rows.map(r=>({field:r.field,status:'not_attempted',dispatched:false,blockers:r.blockers,holdActions:r.holdActions}))});
        const patches=(fresh.patch as ReviewedPatch[]).map(p=>({field:p.field,value:p.after,before:p.before??'',wireDigest:fresh.wireDigest??''}));
        const approval=requestBoundApproval(store,{authorization,actorId:actor.actorId,reviewDigest:input.reviewDigest,scope,reviewed:prior.patch});
        store.appendAudit(requestKey,{event:'dispatch_started',authorizationId,actorId:actor.actorId,fields:patches.map(p=>p.field)});
        let results:Awaited<ReturnType<DailyRecordWriteBackend['saveDailyRecord']>>;
        try{results=await this.#serial(()=>this.writeBackend!.saveDailyRecord(freezeLabelData(structuredClone(scope)),patches,approval));}
        catch(error){
          // Consumption marks a possible dispatch; it stays unresolved until a readback reconciliation.
          for(const p of patches)if(store.get('consumption',executionKey(authorizationId,scope,p.field)))
            store.publishOnce('outcome',executionKey(authorizationId,scope,p.field),{status:'unresolved',dispatched:null,actorId:actor.actorId,recordedAt:new Date(this.now()).toISOString()});
          store.appendAudit(requestKey,{event:'dispatch_failed',authorizationId,reasonCode:readFailureResult(error,'dailyrecord_save_unqualified_no_automatic_retry').reasonCode});
          return {...base,status:'held' as const,reasonCode:'save_reconciliation_required',academyWrites:null,execution:'owner_request_bound' as const,authorizationId,actorId:actor.actorId,
            fields:patches.map(p=>report(p.field,{status:'unresolved',dispatched:null}))};
        }
        for(const r of results){
          // Fields refused before consumption (drift, not attempted) leave no execution record and stay available.
          if(store.get('consumption',executionKey(authorizationId,scope,r.field)))
            store.publishOnce('outcome',executionKey(authorizationId,scope,r.field),{status:r.status,dispatched:r.dispatched,transport:r.transport??null,actorId:actor.actorId,recordedAt:new Date(this.now()).toISOString()});
        }
        const academyWrites=results.filter(r=>r.dispatched).length;
        const settled=results.every(r=>r.status==='persisted'||r.status==='noop');
        const reasonCode=settled?null:results.some(r=>r.status==='unresolved'||r.status==='conflict')?'save_reconciliation_required'
          :results.some(r=>r.status==='before_drift')?'fresh_before_drift_new_review_required'
          :results.some(r=>r.status==='not_persisted')?'readback_not_persisted_new_authorization_required':'partial_save_review_remaining_fields';
        store.appendAudit(requestKey,{event:'dispatch_completed',authorizationId,actorId:actor.actorId,academyWrites,results:results.map(r=>({field:r.field,status:r.status,dispatched:r.dispatched}))});
        return {...base,status:settled?'saved' as const:'held' as const,reasonCode,academyWrites,execution:'owner_request_bound' as const,authorizationId,actorId:actor.actorId,
          fields:results.map(r=>report(r.field,{status:r.status,dispatched:r.dispatched}))};
      });
    }catch(error){
      if(error instanceof Error&&error.message==='shared_writer_lock_busy')return hold('shared_writer_lock_busy');
      throw error;
    }
  }
  /** Read-only classification of uncertain dispatches by authoritative readback. Never writes to the academy or retries. */
  async reconcile(value:unknown){
    const input=dailyRecordReconcileSchema.parse(value),context=input.context,scope=context.scope;
    const base={...this.#base(context),authorizationId:input.authorizationId,execution:'read_only' as const,parentTransmission:'separate_explicit_instruction_required' as const};
    if(!this.workflow)return {...base,status:'unavailable' as const,reasonCode:'dailyrecord_workflow_not_configured',fields:[]};
    const store=this.workflow.store,actor=this.#actor('academy_dailyrecord_reconcile',input);
    if(actor.status!=='authenticated')return {...base,status:'held' as const,reasonCode:actor.reasonCode,fields:[]};
    const stored=store.get('authorization',input.authorizationId) as {signed:{authorization:DailyRecordAuthorization}}|null;
    if(!stored)return {...base,status:'held' as const,reasonCode:'authorization_not_recorded',fields:[]};
    const authorization=stored.signed.authorization,actions=authorization.actions.filter(a=>canonicalSame(a.scope,scope));
    if(authorization.requestRef!==context.currentRequestRef||!actions.length)return {...base,status:'held' as const,reasonCode:'authorization_scope_mismatch',fields:[]};
    const requestKey=workflowRequestKey(scope,context.currentRequestRef);
    return store.withLock(workflowLockKey(scope),async()=>{
      const key=(field:DailyRecordField)=>executionKey(authorization.authorizationId,scope,field);
      const pending=actions.filter(a=>needsReconciliation(fieldExecutionState(store,key(a.field))));
      const fields=()=>actions.map(a=>({field:a.field,executionState:fieldExecutionState(store,key(a.field))}));
      if(!pending.length)return {...base,status:'settled' as const,reasonCode:null,fields:fields()};
      const read=await this.#read(scope,context.currentRequestRef);
      if(read.status!=='observed'){
        store.appendAudit(requestKey,{event:'reconcile_readback_unavailable',authorizationId:authorization.authorizationId,actorId:actor.actorId,reasonCode:read.reasonCode});
        return {...base,status:'held' as const,reasonCode:'readback_unavailable_reconcile_later',sourceReasonCode:read.reasonCode,fields:fields()};
      }
      for(const action of pending){
        const consumption=store.get('consumption',key(action.field)) as {effectRecordKey:string}|null;
        const record=action.field==='previousHomeworkAssessment'?read.observation.previousTarget?.recordId:read.observation.target.recordId;
        const current=read.observation.fields[action.field];
        const classification=consumption&&consumption.effectRecordKey!==record?'conflict'
          :current.state!=='known'?null:current.value===action.after?'persisted':current.value===action.before?'not_persisted':'conflict';
        if(!classification)continue;
        store.publishOnce('reconciliation',key(action.field),{classification,sourceRevision:read.observation.sourceRevision,observedAt:read.observation.observedAt,actorId:actor.actorId,reconciledAt:new Date(this.now()).toISOString()});
        store.appendAudit(requestKey,{event:'reconciled',authorizationId:authorization.authorizationId,field:action.field,classification,actorId:actor.actorId});
      }
      const after=fields();
      return {...base,status:after.some(f=>needsReconciliation(f.executionState))?'held' as const:'settled' as const,
        reasonCode:after.some(f=>needsReconciliation(f.executionState))?'readback_field_unknown_reconcile_later':null,fields:after};
    });
  }
  /** Metadata-only handoff view of one authorization's execution; no field text. */
  async executionStatus(value:unknown){
    const input=dailyRecordExecutionStatusSchema.parse(value);
    const base={authorizationId:input.authorizationId,academyWrites:0,parentSends:0,automaticRetryAllowed:false,execution:'read_only' as const};
    if(!this.workflow)return {...base,status:'unavailable' as const,reasonCode:'dailyrecord_workflow_not_configured'};
    const store=this.workflow.store,actor=this.#actor('academy_dailyrecord_execution_status',input);
    if(actor.status!=='authenticated')return {...base,status:'held' as const,reasonCode:actor.reasonCode};
    const stored=store.get('authorization',input.authorizationId) as {signed:{authorization:DailyRecordAuthorization};firstVerifiedAt:string}|null;
    if(!stored)return {...base,status:'not_recorded' as const,reasonCode:'authorization_not_recorded'};
    const a=stored.signed.authorization;
    const actions=a.actions.map(action=>({scope:action.scope,field:action.field,beforeSha256:textDigest(action.before),afterSha256:textDigest(action.after),
      executionState:fieldExecutionState(store,executionKey(a.authorizationId,action.scope,action.field)) satisfies FieldExecutionState}));
    const scopes=[...new Map(a.actions.map(x=>[workflowRequestKey(x.scope,a.requestRef),x.scope])).keys()];
    return {...base,status:'recorded' as const,storeScope:store.scope,
      authorization:{requestRef:a.requestRef,issuerId:a.issuerId,issuedAt:a.issuedAt,expiresAt:a.expiresAt,userEventRef:a.userEvent.eventRef,
        authorizedActors:a.authorizedActors,basedOnReviewDigests:a.basedOnReviewDigests,parentTransmission:a.parentTransmission,firstVerifiedAt:stored.firstVerifiedAt},
      actions,audit:scopes.flatMap(k=>store.audit(k))};
  }
  async cism(value:unknown){
    const input=cismSectionSchema.parse(value),context=input.context;
    if(!this.backend?.readCismSection)return {...this.#base(context),status:'unavailable',reasonCode:'exact_cism_read_backend_not_configured',observationHandle:null,execution:'not_supported'};
    try{return await this.#serial(async()=>{
      const read=await this.backend!.readCismSection!(freezeLabelData(structuredClone(context.scope)),freezeLabelData(structuredClone(input.selection)));
      if(read.status==='unavailable')return {...this.#base(context),status:'unavailable',reasonCode:safeReason(read.reasonCode),observationHandle:null,execution:'not_supported'};
      const observation=cismObservationSchema.parse(read.observation);
      if(!same(observation.scope,context.scope)||!same(observation.selection,input.selection)||this.#age(observation.observedAt)
        ||observation.sourceReferenceDate<input.selection.periodStart||observation.sourceReferenceDate>input.selection.periodEnd)throw Error('cism_scope_or_freshness_conflict');
      if(this.#cismHandles.size>=128)this.#cismHandles.delete(this.#cismHandles.keys().next().value!);
      const observationHandle='cism-observation:'+randomUUID();this.#cismHandles.set(observationHandle,freezeLabelData(observation));
      return {...this.#base(context),status:'observed',observationHandle,observation:freezeLabelData(observation),parentRewording:'not_performed',execution:'not_supported'};
    });
    }catch(error){return {...this.#base(context),status:'unavailable',...readFailureResult(error,'exact_cism_source_unqualified_no_automatic_retry'),observationHandle:null,execution:'not_supported'};}
  }
}

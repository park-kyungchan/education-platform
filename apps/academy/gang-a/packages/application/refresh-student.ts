import {hashCanonical} from '../audit/event-log.ts';
import type {TrustedObservationVerifier} from '../ports/observation-verifier.ts';
import {z} from 'zod';
import {StudentId,NativeStudentId,SourceId,Sha256,Instant,EntityId} from '../domain/ids.ts';
import {Evidence} from '../domain/evidence.ts';
import {Decision,validateDecisionReferences} from '../domain/decision.ts';
import {assertEvidenceNamespace} from '../security/student-scope.ts';
const ErrorCode=z.enum(['AUTH_REQUIRED','ACCESS_DENIED','RATE_LIMITED','NETWORK_ERROR','IDENTITY_MISMATCH','UNVERIFIED_ROUTE']);
const Coverage=z.strictObject({state:z.enum(['not_queried','observed','observed_absent_within_scope','partial','stale_retained']),lastSuccessAt:Instant.nullable(),lastAttemptAt:Instant.nullable(),lastErrorCode:ErrorCode.nullable(),completeWithinDeclaredScope:z.boolean()});
export const StudentState=z.strictObject({studentId:StudentId,nativeStudentId:NativeStudentId.nullable(),revision:Sha256,allowedEntityIds:z.array(EntityId),evidence:z.array(Evidence),decisions:z.array(Decision),teacherMemo:z.string().nullable(),coverage:z.record(z.string(),Coverage),completionState:z.enum(['unknown','teacher_confirmed_complete','teacher_confirmed_incomplete'])}).superRefine((state,c)=>{if(new Set(state.allowedEntityIds).size!==state.allowedEntityIds.length||new Set(state.evidence.map(e=>e.evidenceId)).size!==state.evidence.length||new Set(state.decisions.map(d=>d.decisionId)).size!==state.decisions.length)c.addIssue({code:'custom',message:'duplicate_student_state_member'});if(state.evidence.some(e=>e.scope.studentId!==state.studentId)||state.decisions.some(d=>d.studentId!==state.studentId))c.addIssue({code:'custom',message:'student_state_namespace_mismatch'});if(state.evidence.some(e=>!e.scope.entityIds.every(id=>state.allowedEntityIds.includes(id)))||state.decisions.some(d=>!d.targetEntityIds.every(id=>state.allowedEntityIds.includes(id))))c.addIssue({code:'custom',message:'student_state_entity_scope_mismatch'});for(const [index,decision]of state.decisions.entries())try{validateDecisionReferences(decision,state.evidence);}catch(error){c.addIssue({code:'custom',path:['decisions',index],message:'student_state_decision_reference_invalid:'+String(error)});}});
export type StudentState=z.infer<typeof StudentState>;
export const RefreshResult=z.discriminatedUnion('kind',[
 z.strictObject({kind:z.literal('unavailable'),studentId:StudentId,sourceId:SourceId,reason:z.literal('CONNECTOR_UNAVAILABLE'),networkInvoked:z.literal(false)}),
 z.strictObject({kind:z.literal('failure'),studentId:StudentId,sourceId:SourceId,attemptedAt:Instant,code:ErrorCode}),
 z.strictObject({kind:z.literal('direct_observation'),studentId:StudentId,sourceId:SourceId,attemptedAt:Instant,observedAt:Instant,evidence:z.array(Evidence),completeWithinDeclaredScope:z.boolean(),queryReceipt:z.strictObject({runId:z.string().min(1),nativeStudentId:NativeStudentId,sourceRevision:z.string().min(1),observedAt:Instant})})
]);
export type RefreshResult=z.infer<typeof RefreshResult>;
/** Pure partial update: retains other students and all teacher decisions/memos.
 * A failure never replaces observations or becomes evidence of non-completion. */
export async function applySelectedStudentRefresh(states:ReadonlyMap<StudentId,StudentState>,selected:StudentId,expectedRevision:Sha256,resultInput:unknown,verifier?:TrustedObservationVerifier):Promise<Map<StudentId,StudentState>>{
 const result=RefreshResult.parse(resultInput),old=states.get(selected);if(!old||result.studentId!==selected)throw Error('refresh_student_scope_mismatch');const current=StudentState.parse(old);if(current.studentId!==selected)throw Error('store_student_namespace_mismatch');assertEvidenceNamespace(selected,current.allowedEntityIds,current.evidence,current.decisions);if(current.revision!==expectedRevision)throw Error('revision_conflict');
 if(result.kind==='unavailable')return new Map(states);
 const previous=current.coverage[result.sourceId]??{state:'not_queried' as const,lastSuccessAt:null,lastAttemptAt:null,lastErrorCode:null,completeWithinDeclaredScope:false};
 if(previous.lastAttemptAt&&Date.parse(result.attemptedAt)<Date.parse(previous.lastAttemptAt))throw Error('stale_refresh_result');
 let next:StudentState;
 if(result.kind==='failure')next={...current,coverage:{...current.coverage,[result.sourceId]:{...previous,state:previous.lastSuccessAt?'stale_retained':'not_queried',lastAttemptAt:result.attemptedAt,lastErrorCode:result.code}}};
 else{
  if(!verifier||!await verifier.verify(result))throw Error('live_adapter_or_trusted_receipt_unavailable');
  if(current.nativeStudentId===null||current.nativeStudentId!==result.queryReceipt.nativeStudentId||result.queryReceipt.observedAt!==result.observedAt)throw Error('native_identity_or_query_receipt_mismatch');
  if(result.evidence.some(e=>e.source.kind!=='direct_lms_observation'||e.scope.sourceId!==result.sourceId||e.source.observedAt!==result.observedAt||e.source.receipt.runId!==result.queryReceipt.runId||e.source.receipt.nativeStudentId!==result.queryReceipt.nativeStudentId||e.source.receipt.sourceRevision!==result.queryReceipt.sourceRevision))throw Error('direct_refresh_requires_matching_direct_source_evidence');
  assertEvidenceNamespace(selected,current.allowedEntityIds,result.evidence,[]);
  if(new Set(result.evidence.map(e=>e.evidenceId)).size!==result.evidence.length)throw Error('duplicate_refresh_evidence_id');const ids=new Set(current.evidence.map(e=>e.evidenceId));if(result.evidence.some(e=>ids.has(e.evidenceId)))throw Error('evidence_is_append_only');
  next={...current,evidence:[...current.evidence,...result.evidence],coverage:{...current.coverage,[result.sourceId]:{state:result.evidence.length?'observed':result.completeWithinDeclaredScope?'observed_absent_within_scope':'partial',lastSuccessAt:result.attemptedAt,lastAttemptAt:result.attemptedAt,lastErrorCode:null,completeWithinDeclaredScope:result.completeWithinDeclaredScope}}};
 }
 const {revision:_priorRevision,...revisionContent}=next;next={...next,revision:await hashCanonical(revisionContent)};
 const nextStates=new Map(states);nextStates.set(selected,next);return nextStates;
}

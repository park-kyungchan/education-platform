/** Canonical normalized evidence/decision contract. Pure validation only.
 * A parsed record grants neither source access nor runtime authority.
 * Legacy wire fields remain immutable and bind to these IDs via JSON Pointers. */
import {z} from 'zod';
export const EVIDENCE_CONTRACT_VERSION='academy.evidence/1.1.0';
export const TEACHER_OUTCOME_RULE_VERSION='teacher.outcome/1.0.0';
const Id=z.string().min(1).max(512);
const Instant=z.string().datetime({offset:true});
const Hash=z.string().regex(/^[a-f0-9]{64}$/);
export const SourceKind=z.enum(['user_report','lms_direct_observation','imported_snapshot','inference']);
export const ActorKind=z.enum(['user','assistant','native_tool','system']);
export const ActorRole=z.enum(['teacher','source_collector','reviewer','maintainer','unknown']);
export const EvidenceScope=z.strictObject({studentId:Id,entityIds:z.array(Id),fields:z.array(Id),window:z.strictObject({from:Instant.nullable(),to:Instant.nullable(),labelRaw:z.string().nullable()}).nullable()}).superRefine((s,c)=>{
  if(s.window?.from&&s.window.to&&Date.parse(s.window.from)>Date.parse(s.window.to))c.addIssue({code:'custom',message:'invalid_scope_window'});
  if(new Set(s.entityIds).size!==s.entityIds.length||new Set(s.fields).size!==s.fields.length)c.addIssue({code:'custom',message:'duplicate_scope_member'});
});
const SourceRef=z.strictObject({sourceMessageId:Id.nullable(),reference:Id.nullable(),sha256:Hash.nullable(),jsonPointer:z.string().nullable()});
/** Direct-observation classification needs a source receipt. The real server
 * must validate that receipt against its trusted tool run, native identity,
 * source revision and current authorization; syntax validation is not proof. */
const DirectObservationReceipt=z.strictObject({toolName:Id,runId:Id,nativeStudentId:Id,sourceRevision:Id,observedAt:Instant});
export const EvidenceRecord=z.strictObject({
  evidenceId:Id,sourceKind:SourceKind,
  actor:z.strictObject({kind:ActorKind,role:ActorRole,id:Id.nullable()}),sourceRef:SourceRef,
  reportedAt:Instant.nullable(),observedAt:Instant.nullable(),capturedAt:Instant.nullable(),recordedAt:Instant,timeRaw:z.string().nullable(),
  verificationStatus:z.enum(['unverified','corroborated','contradicted']),verificationDetail:z.string().nullable().optional(),
  scope:EvidenceScope,claim:z.strictObject({type:Id,value:z.json()}),revision:z.number().int().positive(),
  supersedesEvidenceIds:z.array(Id),retractsEvidenceIds:z.array(Id),conflictingEvidenceIds:z.array(Id),
  statementProvenance:z.strictObject({confirmed:z.boolean(),sourceMessageId:Id}).optional(),
  coverage:z.strictObject({completeWithinDeclaredScope:z.boolean(),observedSourceRowCount:z.number().int().nonnegative().nullable(),sourceAsOf:Instant.nullable()}).optional(),
  directObservationReceipt:DirectObservationReceipt.optional()
}).superRefine((e,c)=>{
  if(e.sourceKind==='user_report'&&(e.actor.kind!=='user'||e.sourceRef.sourceMessageId===null))c.addIssue({code:'custom',message:'user_report_requires_user_and_source_message'});
  if(e.statementProvenance&&(e.sourceKind!=='user_report'||e.statementProvenance.sourceMessageId!==e.sourceRef.sourceMessageId))c.addIssue({code:'custom',message:'statement_provenance_is_not_independent_verification'});
  if(e.sourceKind==='imported_snapshot'&&(!e.sourceRef.reference||!e.sourceRef.sha256))c.addIssue({code:'custom',message:'imported_snapshot_requires_pinned_source'});
  if(e.sourceKind==='lms_direct_observation'){
    if(e.actor.kind!=='native_tool'||!e.directObservationReceipt||!e.sourceRef.reference||!e.sourceRef.sha256)c.addIssue({code:'custom',message:'direct_source_requires_native_tool_and_trusted_receipt_binding'});
    if(e.directObservationReceipt&&e.observedAt!==e.directObservationReceipt.observedAt)c.addIssue({code:'custom',message:'observation_time_must_match_source_receipt'});
  }else if(e.directObservationReceipt)c.addIssue({code:'custom',message:'non_direct_source_cannot_carry_direct_receipt'});
  if(e.sourceKind==='inference'&&e.actor.kind==='user')c.addIssue({code:'custom',message:'user_statement_must_be_user_report'});
  for(const ids of [e.supersedesEvidenceIds,e.retractsEvidenceIds,e.conflictingEvidenceIds])if(ids.includes(e.evidenceId)||new Set(ids).size!==ids.length)c.addIssue({code:'custom',message:'invalid_evidence_relation'});
});
export const DecisionRecord=z.strictObject({
  decisionId:Id,studentId:Id,targetEntityIds:z.array(Id).min(1),evidenceIds:z.array(Id).min(1),ruleVersion:Id,
  decisionStatus:z.enum(['pending','confirmed','conflicted','superseded','retracted']),
  decisionAuthority:z.strictObject({actorKind:ActorKind,role:ActorRole}),recordedAt:Instant
}).superRefine((d,c)=>{
  if(new Set(d.targetEntityIds).size!==d.targetEntityIds.length||new Set(d.evidenceIds).size!==d.evidenceIds.length)c.addIssue({code:'custom',message:'duplicate_decision_reference'});
  if(d.decisionStatus==='confirmed'&&!((d.decisionAuthority.actorKind==='user'&&['teacher','reviewer'].includes(d.decisionAuthority.role))||(d.decisionAuthority.actorKind==='native_tool'&&d.decisionAuthority.role==='reviewer')))c.addIssue({code:'custom',message:'confirmed_teacher_decision_requires_separate_decision_authority'});
});
export type Evidence=z.infer<typeof EvidenceRecord>;
export type Decision=z.infer<typeof DecisionRecord>;
export function parseEvidenceDecisionBundle(evidenceInputs:unknown[],decisionInputs:unknown[]){
  const evidenceRecords=evidenceInputs.map(x=>EvidenceRecord.parse(x)),decisionRecords=decisionInputs.map(x=>DecisionRecord.parse(x));
  const evidence=new Map(evidenceRecords.map(e=>[e.evidenceId,e]));
  if(evidence.size!==evidenceRecords.length)throw Error('duplicate_evidence_id');
  if(new Set(decisionRecords.map(d=>d.decisionId)).size!==decisionRecords.length)throw Error('duplicate_decision_id');
  for(const d of decisionRecords)for(const id of d.evidenceIds){const e=evidence.get(id);if(!e)throw Error('decision_evidence_missing');if(e.scope.studentId!==d.studentId)throw Error('decision_student_scope_mismatch');if(!d.targetEntityIds.every(target=>e.scope.entityIds.includes(target)))throw Error('decision_entity_scope_mismatch');}
  for(const e of evidenceRecords)for(const id of [...e.supersedesEvidenceIds,...e.retractsEvidenceIds,...e.conflictingEvidenceIds]){const prior=evidence.get(id);if(prior&&prior.scope.studentId!==e.scope.studentId)throw Error('evidence_relation_student_scope_mismatch');}
  return {contractVersion:EVIDENCE_CONTRACT_VERSION,evidenceRecords,decisionRecords,runtimeAuthorityGranted:false as const};
}
/** The caller supplies an explicitly reported event time, never sentAt as a
 * fallback. Unknown relative wording remains raw and has no inferred instant. */
export function normalizeUserReportedTime(input:{reportedAt:string|null;explicitObservedAt:string|null;timeRaw:string|null}){return {reportedAt:input.reportedAt===null?null:Instant.parse(input.reportedAt),observedAt:input.explicitObservedAt===null?null:Instant.parse(input.explicitObservedAt),timeRaw:input.timeRaw};}

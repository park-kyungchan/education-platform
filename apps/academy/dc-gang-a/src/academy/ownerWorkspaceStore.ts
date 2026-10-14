import {validateTeacherExamDraft,type TeacherExamSelectionDraft} from './teacherExamWorkspace';
import type {SQL} from 'bun';
import {assertExactKeys,assertInstant,canonicalJson,digest,requireText,stableId} from '../learning/model';
import {academyOperatingSelection} from './operatingWorkspace';
import {TeacherWorkspaceRefusal,validateTeacherWorkspace,workspaceEntityId,isTeacherWorkspaceRecord,type TeacherOperationalCase,type TeacherWorkspaceRecord} from './teacherWorkspace';
import type {WriteAcknowledgement} from './contracts/storageRecords';
export type OwnerWorkspaceRecord=TeacherWorkspaceRecord|TeacherOperationalCase|TeacherExamSelectionDraft;
export function ownerWorkspaceEntityId(payload:OwnerWorkspaceRecord){return payload.kind==='teacher_exam_selection_draft'?'teacher-exam-selection-'+payload.draftId:workspaceEntityId(payload);}
export function validateOwnerWorkspace(payload:OwnerWorkspaceRecord){if(payload.kind==='teacher_exam_selection_draft')validateTeacherExamDraft(payload);else validateTeacherWorkspace(payload);}
export interface OwnerWorkspaceCommand {ownerId:string;actorId:string;idempotencyKey:string;expectedRevisionId:string|null;payload:OwnerWorkspaceRecord}
export interface OwnerWorkspaceVersion {ownerId:string;entityId:string;sequence:number;revisionId:string;previousRevisionId:string|null;previousDigest:string|null;payload:OwnerWorkspaceRecord;contentDigest:string;integrityDigest:string;recordedAt:string;actorId:string;idempotencyKey:string;commandDigest:string}
export interface OwnerWorkspaceStore {
 appendOwnerWorkspace(command:OwnerWorkspaceCommand):Promise<WriteAcknowledgement>;
 ownerWorkspaces(ownerId:string):Promise<OwnerWorkspaceVersion[]>;
 ownerWorkspaceHistory(ownerId:string,entityId:string,afterSequence?:number):Promise<OwnerWorkspaceVersion[]>;
 ownerWorkspaceResult(ownerId:string,actorId:string,requestId:string):Promise<OwnerWorkspaceVersion|null>;
}
function version(row:any):OwnerWorkspaceVersion {
 const result:OwnerWorkspaceVersion={ownerId:row.owner_id,entityId:row.entity_id,sequence:Number(row.sequence),revisionId:row.revision_id,previousRevisionId:row.previous_revision_id,previousDigest:row.previous_digest,payload:row.payload,contentDigest:row.content_digest,integrityDigest:row.integrity_digest,recordedAt:new Date(row.recorded_at).toISOString(),actorId:row.actor_id,idempotencyKey:row.idempotency_key,commandDigest:row.command_digest};
 validateOwnerWorkspace(result.payload);const {integrityDigest,...body}=result;if(!Number.isSafeInteger(result.sequence)||result.sequence<1||digest(body)!==integrityDigest||digest(result.payload)!==result.contentDigest)throw Error('stored_owner_workspace_integrity');return result;
}
/** Explicit additive schema migration, invoked only by the existing development/migration owner. */
export async function migrateOwnerWorkspaces(db:SQL){
 await db.unsafe(`CREATE TABLE IF NOT EXISTS academy.owner_workspace_versions (
 owner_id text NOT NULL,entity_id text NOT NULL,sequence bigint NOT NULL CHECK(sequence>0),revision_id text NOT NULL,previous_revision_id text,previous_digest text,payload jsonb NOT NULL,content_digest text NOT NULL,integrity_digest text NOT NULL,recorded_at timestamptz NOT NULL,actor_id text NOT NULL,idempotency_key text NOT NULL,command_digest text NOT NULL,
 PRIMARY KEY(owner_id,entity_id,sequence),UNIQUE(owner_id,revision_id));
 CREATE TABLE IF NOT EXISTS academy.owner_workspace_heads(owner_id text NOT NULL,entity_id text NOT NULL,sequence bigint NOT NULL,PRIMARY KEY(owner_id,entity_id),FOREIGN KEY(owner_id,entity_id,sequence) REFERENCES academy.owner_workspace_versions(owner_id,entity_id,sequence));
 CREATE TABLE IF NOT EXISTS academy.owner_workspace_outcomes(owner_id text NOT NULL,actor_id text NOT NULL,idempotency_key text NOT NULL,command_digest text NOT NULL,acknowledgement jsonb NOT NULL,PRIMARY KEY(owner_id,actor_id,idempotency_key));
 DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='immutable_owner_workspace' AND tgrelid='academy.owner_workspace_versions'::regclass) THEN CREATE TRIGGER immutable_owner_workspace BEFORE UPDATE OR DELETE OR TRUNCATE ON academy.owner_workspace_versions FOR EACH STATEMENT EXECUTE FUNCTION academy.prevent_history_mutation(); END IF; END $$;
 REVOKE ALL ON academy.owner_workspace_versions,academy.owner_workspace_heads,academy.owner_workspace_outcomes FROM PUBLIC;`);
}
export async function assertOwnerWorkspacesReady(db:SQL){
 const [row]=await db`SELECT to_regclass('academy.owner_workspace_versions') IS NOT NULL AND to_regclass('academy.owner_workspace_heads') IS NOT NULL AND to_regclass('academy.owner_workspace_outcomes') IS NOT NULL AS ready, (SELECT count(*)::int FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid JOIN pg_catalog.pg_namespace pn ON pn.oid=p.pronamespace WHERE n.nspname='academy' AND c.relname='owner_workspace_versions' AND t.tgname='immutable_owner_workspace' AND t.tgenabled='O' AND t.tgtype=58 AND pn.nspname='academy' AND p.proname='prevent_history_mutation' AND NOT t.tgisinternal) AS triggers`;
 if(row?.ready!==true||row.triggers!==1)throw Error('owner_workspace_storage_unavailable');
}
export async function appendOwnerWorkspace(db:SQL,command:OwnerWorkspaceCommand):Promise<WriteAcknowledgement>{
 command=JSON.parse(canonicalJson(command)) as OwnerWorkspaceCommand;
 assertExactKeys(command,['ownerId','actorId','idempotencyKey','expectedRevisionId','payload']);canonicalJson(command);validateOwnerWorkspace(command.payload);
 for(const id of [command.ownerId,command.actorId,command.idempotencyKey]){requireText(id,'workspace identity');if(id.length>200)throw Error('invalid_workspace_identity');}
 if(command.expectedRevisionId!==null){requireText(command.expectedRevisionId,'workspace predecessor');if(command.expectedRevisionId.length>200)throw Error('invalid_workspace_identity');}
 const recordedAt=new Date().toISOString();assertInstant(command.payload.reportedAt);if(Date.parse(command.payload.reportedAt)>Date.parse(recordedAt))throw Error('future_source_observation');
 const entityId=ownerWorkspaceEntityId(command.payload),contentDigest=digest(command.payload),commandDigest=digest(command);
 let callbackFailed=false;
 try{return await db.begin(async tx=>{try{
  // Owner outcome and optional student evidence share the same existing transaction owner.
  if(command.payload.studentBinding)await tx`SELECT pg_advisory_xact_lock(hashtextextended(${canonicalJson(['student-records',command.ownerId,command.payload.studentBinding.studentId])},0))`;
  await tx`SELECT pg_advisory_xact_lock(hashtextextended(${canonicalJson(['owner-workspaces',command.ownerId])},0))`;
  const [retry]=await tx`SELECT command_digest,acknowledgement FROM academy.owner_workspace_outcomes WHERE owner_id=${command.ownerId} AND actor_id=${command.actorId} AND idempotency_key=${command.idempotencyKey}`;
  if(retry){if(retry.command_digest!==commandDigest)throw Error('idempotency_reuse');return {...retry.acknowledgement,status:'replay'} as WriteAcknowledgement;}
  if(command.payload.kind==='teacher_operational_case'){
  const selected=await academyOperatingSelection(command.payload.policyIds,command.payload.policyRevision),stepIds=new Set(selected.nodes.filter(node=>node.kind==='step').map(node=>node.id));
  if(command.payload.checklist.some(step=>!stepIds.has(step.stepId as never)))throw Error('operational_step_binding_conflict');
  const policies=selected.nodes.filter(node=>node.kind==='policy');
  if(command.payload.checklist.some(step=>step.state==='human_reported_done')||command.payload.state==='locally_closed'){
   if(policies.some(policy=>policy.kind==='policy'&&(policy.lifecycle!=='active'||policy.automation==='deferred'||policy.obligation==='deferred')))throw Error('operational_deferred_boundary');
   if(policies.some(policy=>policy.kind==='policy'&&policy.applicability.requiresActualAssignment)&&!command.payload.actualAssignmentConfirmed)throw Error('operational_assignment_confirmation_required');
  }
  }
  const binding=command.payload.studentBinding;
  if(binding){
   const [student]=await tx`SELECT source_namespace,source_key FROM academy.students WHERE owner_id=${command.ownerId} AND id=${binding.studentId}`;
   if(!student||canonicalJson({namespace:student.source_namespace,literalKey:student.source_key})!==canonicalJson(binding.sourceStudent))throw Error('student_scope_conflict');
   for(const revisionId of command.payload.evidenceRevisionIds){const [basis]=await tx`SELECT v.revision_id FROM academy.record_heads h JOIN academy.record_versions v USING(owner_id,student_id,entity_id,sequence) WHERE h.owner_id=${command.ownerId} AND h.student_id=${binding.studentId} AND v.revision_id=${revisionId}`;if(!basis){const [local]=await tx`SELECT v.revision_id FROM academy.owner_workspace_heads h JOIN academy.owner_workspace_versions v USING(owner_id,entity_id,sequence) WHERE h.owner_id=${command.ownerId} AND v.payload->'studentBinding'->>'studentId'=${binding.studentId} AND v.revision_id=${revisionId}`;if(!local)throw Error('stale_evidence_basis');}}
  }else if(command.payload.evidenceRevisionIds.length)throw Error('operational_evidence_scope_conflict');
  if(command.payload.kind==='teacher_activity_review'){
   const payload=command.payload,binding=payload.studentBinding;
   if(!payload.evidenceRevisionIds.includes(payload.assignmentRevisionId))throw Error('work_assignment_basis_conflict');
   const [row]=await tx`SELECT v.payload FROM academy.record_heads h JOIN academy.record_versions v USING(owner_id,student_id,entity_id,sequence) WHERE h.owner_id=${command.ownerId} AND h.student_id=${binding.studentId} AND v.revision_id=${payload.assignmentRevisionId}`;
   const assignment=row?.payload;
   if(assignment?.kind!=='learning_work_assignment'||assignment.status!=='assigned')throw Error('work_assignment_basis_conflict');
   if(payload.selectedItemIds.some(id=>!assignment.items.some((item:{assignedItemId:string})=>item.assignedItemId===id))||payload.coverage==='whole_assigned_items'&&payload.selectedItemIds.length!==assignment.items.length)throw Error('work_item_binding_conflict');
   if(canonicalJson(payload.paper.issuance)!==canonicalJson(assignment.paper))throw Error('work_paper_binding_conflict');
   if((payload.mindmap.state!=='not_requested'||payload.mindmap.explanation!==null)&&assignment.activity!=='concept_blank_test')throw Error('mindmap_activity_scope_conflict');
  }
  const [row]=await tx`SELECT v.* FROM academy.owner_workspace_heads h JOIN academy.owner_workspace_versions v USING(owner_id,entity_id,sequence) WHERE h.owner_id=${command.ownerId} AND h.entity_id=${entityId}`;
  const prior=row?version(row):null;if((prior?.revisionId??null)!==command.expectedRevisionId)throw Error('stale_base');
  if(prior&&(prior.payload.kind!==command.payload.kind||ownerWorkspaceEntityId(prior.payload)!==entityId||canonicalJson(prior.payload.studentBinding)!==canonicalJson(binding)||prior.payload.kind==='teacher_operational_case'&&command.payload.kind==='teacher_operational_case'&&prior.payload.category!==command.payload.category||Date.parse(prior.payload.reportedAt)>Date.parse(command.payload.reportedAt)))throw Error('owner_workspace_identity_changed');
  if(prior?.payload.kind==='teacher_activity_review'&&command.payload.kind==='teacher_activity_review'&&prior.payload.final.decision==='accepted'&&(command.payload.final.decision==='pending'||command.payload.final.decision!=='reopen'&&canonicalJson(prior.payload.selectedItemIds)!==canonicalJson(command.payload.selectedItemIds)))throw Error('explicit_reopen_required');
  if(prior?.payload.kind==='teacher_operational_case'&&command.payload.kind==='teacher_operational_case'&&prior.payload.state==='locally_closed'&&!['locally_closed','reopened'].includes(command.payload.state))throw Error('explicit_case_reopen_required');
  const body:Omit<OwnerWorkspaceVersion,'integrityDigest'>={ownerId:command.ownerId,entityId,sequence:(prior?.sequence??0)+1,revisionId:stableId('revision','academy-owner-workspace-v1',command.ownerId,command.actorId,command.idempotencyKey),previousRevisionId:prior?.revisionId??null,previousDigest:prior?.integrityDigest??null,payload:command.payload,contentDigest,recordedAt,actorId:command.actorId,idempotencyKey:command.idempotencyKey,commandDigest};
  const integrityDigest=digest(body);
  await tx`INSERT INTO academy.owner_workspace_versions(owner_id,entity_id,sequence,revision_id,previous_revision_id,previous_digest,payload,content_digest,integrity_digest,recorded_at,actor_id,idempotency_key,command_digest) VALUES(${body.ownerId},${entityId},${body.sequence},${body.revisionId},${body.previousRevisionId},${body.previousDigest},${canonicalJson(body.payload)}::text::jsonb,${contentDigest},${integrityDigest},${recordedAt},${body.actorId},${body.idempotencyKey},${commandDigest})`;
  await tx`INSERT INTO academy.owner_workspace_heads(owner_id,entity_id,sequence) VALUES(${body.ownerId},${entityId},${body.sequence}) ON CONFLICT(owner_id,entity_id) DO UPDATE SET sequence=EXCLUDED.sequence`;
  const result:WriteAcknowledgement={status:'saved',revisionId:body.revisionId,sequence:body.sequence,recordedAt,contentDigest,officialSaved:false,parentSent:false};
  await tx`INSERT INTO academy.owner_workspace_outcomes(owner_id,actor_id,idempotency_key,command_digest,acknowledgement) VALUES(${command.ownerId},${command.actorId},${command.idempotencyKey},${commandDigest},${canonicalJson(result)}::text::jsonb)`;return result;
 }catch(error){callbackFailed=true;throw error;}}) as WriteAcknowledgement;}catch(error){if(callbackFailed)throw new TeacherWorkspaceRefusal(error instanceof Error?error.message:'workspace_transaction_refused','transaction');throw error;}
}
export async function ownerWorkspaces(db:SQL,ownerId:string){
 requireText(ownerId,'owner');const rows=await db`SELECT v.* FROM academy.owner_workspace_heads h JOIN academy.owner_workspace_versions v USING(owner_id,entity_id,sequence) WHERE h.owner_id=${ownerId} ORDER BY entity_id LIMIT 1001`;if(rows.length>1000)throw Error('owner_workspace_scope_too_large');return rows.map(version);
}
export async function ownerWorkspaceHistory(db:SQL,ownerId:string,entityId:string,afterSequence=0){
 if(!Number.isSafeInteger(afterSequence)||afterSequence<0)throw Error('invalid_history_range');requireText(ownerId,'owner');requireText(entityId,'entity');const rows=await db`SELECT * FROM academy.owner_workspace_versions WHERE owner_id=${ownerId} AND entity_id=${entityId} AND sequence>${afterSequence} ORDER BY sequence LIMIT 200`;return rows.map(version);
}
export async function ownerWorkspaceResult(db:SQL,ownerId:string,actorId:string,requestId:string){
 const rows=await db`SELECT v.* FROM academy.owner_workspace_outcomes o JOIN academy.owner_workspace_versions v ON v.owner_id=o.owner_id AND v.actor_id=o.actor_id AND v.revision_id=o.acknowledgement->>'revisionId' AND v.idempotency_key=o.idempotency_key AND v.command_digest=o.command_digest WHERE o.owner_id=${ownerId} AND o.actor_id=${actorId} AND o.idempotency_key=${requestId}`;return rows.length===1?version(rows[0]):null;
}

export type StudentWorkspaceVersion=OwnerWorkspaceVersion&{payload:TeacherWorkspaceRecord;studentId:string};
export function asStudentWorkspace(row:OwnerWorkspaceVersion,studentId:string):StudentWorkspaceVersion {
 if(!isTeacherWorkspaceRecord(row.payload)||row.payload.studentBinding.studentId!==studentId)throw Error('workspace_history_scope_conflict');return {...row,payload:row.payload,studentId};
}
export async function studentWorkspaces(db:SQL,ownerId:string,studentId:string):Promise<StudentWorkspaceVersion[]>{
 const [ready]=await db`SELECT to_regclass('academy.owner_workspace_heads') IS NOT NULL AS ready`;if(!ready?.ready)return [];
 const rows=await db`SELECT v.* FROM academy.owner_workspace_heads h JOIN academy.owner_workspace_versions v USING(owner_id,entity_id,sequence) WHERE h.owner_id=${ownerId} AND v.payload->'studentBinding'->>'studentId'=${studentId} AND v.payload->>'kind' IN ('teacher_activity_review','teacher_parent_draft') ORDER BY entity_id LIMIT 1001`;if(rows.length>1000)throw Error('student_workspace_scope_too_large');return rows.map((row:any)=>asStudentWorkspace(version(row),studentId));
}

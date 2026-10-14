import type {SQL} from 'bun';
import {canonicalJson,digest,stableId,requireText} from '../learning/model';
import {validateConcept,validateLink,conceptDefinitionDigest,projectStudentConceptGraph,type ConceptRevision,type ConceptLinkRevision} from './conceptEvidenceGraph';
import {TeacherWorkspaceRefusal} from './teacherWorkspace';
import {adaptConceptEvidence,type ConceptEvidenceRead} from './conceptEvidenceAdapter';
import {conceptDefinitionFromInput,conceptLinkFromInput,conceptSelector,type ConceptCommandContext,type ConceptDefinitionInput,type ConceptLinkInput,type ConceptWorkspaceVersion,type ConceptWorkspaceReceipt} from './conceptWorkspace';

export type ConceptEvidenceReader=(tx:SQL,ownerId:string,studentId:string,additionalRevisionIds?:string[])=>Promise<ConceptEvidenceRead>;
interface PersistedRow {owner_id:string;student_id:string|null;entity_id:string;sequence:number|bigint;revision_id:string;previous_revision_id:string|null;previous_digest:string|null;kind:'definition'|'link';payload:ConceptRevision|ConceptLinkRevision;content_digest:string;integrity_digest:string;recorded_at:Date|string;actor_id:string;idempotency_key:string;command_digest:string;source_qualification:ConceptWorkspaceVersion['sourceQualification']}
function version(row:PersistedRow):ConceptWorkspaceVersion {
 const result:ConceptWorkspaceVersion={ownerId:row.owner_id,studentId:row.student_id,entityId:row.entity_id,sequence:Number(row.sequence),revisionId:row.revision_id,previousRevisionId:row.previous_revision_id,previousDigest:row.previous_digest,kind:row.kind,payload:row.payload,contentDigest:row.content_digest,integrityDigest:row.integrity_digest,recordedAt:new Date(row.recorded_at).toISOString(),actorId:row.actor_id,idempotencyKey:row.idempotency_key,commandDigest:row.command_digest,sourceQualification:row.source_qualification};
 if(result.kind==='definition'){if(result.studentId!==null||result.payload.kind!=='atomic_concept_revision')throw Error('concept_storage_scope_conflict');validateConcept(result.payload);}
 else {if(result.payload.kind!=='student_concept_link_revision'||result.payload.ownerId!==result.ownerId||result.payload.studentId!==result.studentId||result.payload.sequence!==result.sequence)throw Error('concept_storage_scope_conflict');validateLink(result.payload);}
 const {integrityDigest,...body}=result;if(!Number.isSafeInteger(result.sequence)||result.sequence<1||digest(body)!==integrityDigest||digest(result.payload)!==result.contentDigest)throw Error('concept_storage_integrity');return result;
}
export async function migrateConceptWorkspace(db:SQL){
 await db.unsafe(`CREATE TABLE IF NOT EXISTS academy.concept_domain_versions (
 owner_id text NOT NULL,student_id text,entity_id text NOT NULL,sequence bigint NOT NULL CHECK(sequence>0),revision_id text NOT NULL,previous_revision_id text,previous_digest text,kind text NOT NULL CHECK(kind IN ('definition','link')),payload jsonb NOT NULL,content_digest text NOT NULL,integrity_digest text NOT NULL,recorded_at timestamptz NOT NULL,actor_id text NOT NULL,idempotency_key text NOT NULL,command_digest text NOT NULL,source_qualification text NOT NULL,
 PRIMARY KEY(owner_id,entity_id,sequence),UNIQUE(owner_id,revision_id),FOREIGN KEY(owner_id,student_id) REFERENCES academy.students(owner_id,id));
 CREATE TABLE IF NOT EXISTS academy.concept_domain_heads(owner_id text NOT NULL,entity_id text NOT NULL,sequence bigint NOT NULL,PRIMARY KEY(owner_id,entity_id),FOREIGN KEY(owner_id,entity_id,sequence) REFERENCES academy.concept_domain_versions(owner_id,entity_id,sequence));
 CREATE TABLE IF NOT EXISTS academy.concept_domain_outcomes(owner_id text NOT NULL,actor_id text NOT NULL,idempotency_key text NOT NULL,command_digest text NOT NULL,acknowledgement jsonb NOT NULL,PRIMARY KEY(owner_id,actor_id,idempotency_key));
 DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='immutable_concept_domain' AND tgrelid='academy.concept_domain_versions'::regclass) THEN CREATE TRIGGER immutable_concept_domain BEFORE UPDATE OR DELETE OR TRUNCATE ON academy.concept_domain_versions FOR EACH STATEMENT EXECUTE FUNCTION academy.prevent_history_mutation(); END IF; END $$;
 REVOKE ALL ON academy.concept_domain_versions,academy.concept_domain_heads,academy.concept_domain_outcomes FROM PUBLIC;`);
 await assertConceptWorkspaceReady(db);
}
export async function assertConceptWorkspaceReady(db:SQL){
 const [row]=await db`SELECT to_regclass('academy.concept_domain_versions') IS NOT NULL AND to_regclass('academy.concept_domain_heads') IS NOT NULL AND to_regclass('academy.concept_domain_outcomes') IS NOT NULL AS ready,(SELECT count(*)::int FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace pn ON pn.oid=p.pronamespace WHERE n.nspname='academy' AND c.relname='concept_domain_versions' AND t.tgname='immutable_concept_domain' AND t.tgenabled='O' AND t.tgtype=58 AND pn.nspname='academy' AND p.proname='prevent_history_mutation' AND NOT t.tgisinternal) AS triggers`;
 if(row?.ready!==true||row.triggers!==1)throw Error('concept_storage_unavailable');
}
async function persist(tx:SQL,context:ConceptCommandContext,input:{idempotencyKey:string;expectedRevisionId:string|null},kind:'definition'|'link',studentId:string|null,payload:ConceptRevision|ConceptLinkRevision,commandDigest:string):Promise<Omit<ConceptWorkspaceReceipt,'record'>> {
 const [row]=await tx`SELECT v.* FROM academy.concept_domain_heads h JOIN academy.concept_domain_versions v USING(owner_id,entity_id,sequence) WHERE h.owner_id=${context.ownerId} AND h.entity_id=${payload.id}`;
 const prior=row?version(row):null;if((prior?.revisionId??null)!==input.expectedRevisionId)throw Error('stale_base');
 if(prior&&(prior.kind!==kind||prior.studentId!==studentId))throw Error('concept_storage_scope_conflict');
 const body:Omit<ConceptWorkspaceVersion,'integrityDigest'>={ownerId:context.ownerId,studentId,entityId:payload.id,sequence:(prior?.sequence??0)+1,revisionId:stableId('concept_record','academy-concept-domain-v1',context.ownerId,context.actorId,input.idempotencyKey),previousRevisionId:prior?.revisionId??null,previousDigest:prior?.integrityDigest??null,kind,payload,contentDigest:digest(payload),recordedAt:new Date().toISOString(),actorId:context.actorId,idempotencyKey:input.idempotencyKey,commandDigest,sourceQualification:kind==='definition'?'teacher_reported_definition_not_curated_catalog':'explicit_scoped_teacher_relationship_report'};
 const integrityDigest=digest(body);
 await tx`INSERT INTO academy.concept_domain_versions(owner_id,student_id,entity_id,sequence,revision_id,previous_revision_id,previous_digest,kind,payload,content_digest,integrity_digest,recorded_at,actor_id,idempotency_key,command_digest,source_qualification) VALUES(${body.ownerId},${studentId},${body.entityId},${body.sequence},${body.revisionId},${body.previousRevisionId},${body.previousDigest},${kind},${canonicalJson(payload)}::text::jsonb,${body.contentDigest},${integrityDigest},${body.recordedAt},${body.actorId},${body.idempotencyKey},${commandDigest},${body.sourceQualification})`;
 await tx`INSERT INTO academy.concept_domain_heads(owner_id,entity_id,sequence) VALUES(${body.ownerId},${body.entityId},${body.sequence}) ON CONFLICT(owner_id,entity_id) DO UPDATE SET sequence=EXCLUDED.sequence`;
 const acknowledgement={status:'saved' as const,revisionId:body.revisionId,sequence:body.sequence,recordedAt:body.recordedAt,contentDigest:body.contentDigest,officialSaved:false as const,parentSent:false as const};
 await tx`INSERT INTO academy.concept_domain_outcomes(owner_id,actor_id,idempotency_key,command_digest,acknowledgement) VALUES(${body.ownerId},${body.actorId},${body.idempotencyKey},${commandDigest},${canonicalJson(acknowledgement)}::text::jsonb)`;return acknowledgement;
}
async function append(db:SQL,context:ConceptCommandContext,input:ConceptDefinitionInput|ConceptLinkInput,reader:ConceptEvidenceReader|undefined):Promise<ConceptWorkspaceReceipt>{
 input=JSON.parse(canonicalJson(input));const kind='definition'in input?'definition':'link';const commandDigest=digest({context,kind,input});let callbackFailed=false;
 let acknowledgement:Omit<ConceptWorkspaceReceipt,'record'>;
 try{acknowledgement=await db.begin(async tx=>{try{
  await assertConceptWorkspaceReady(tx as unknown as SQL);
  if(kind==='link')await tx`SELECT pg_advisory_xact_lock(hashtextextended(${canonicalJson(['student-records',context.ownerId,(input as ConceptLinkInput).studentId])},0))`;
  await tx`SELECT pg_advisory_xact_lock(hashtextextended(${canonicalJson(['concept-domain',context.ownerId])},0))`;
  const [retry]=await tx`SELECT command_digest,acknowledgement FROM academy.concept_domain_outcomes WHERE owner_id=${context.ownerId} AND actor_id=${context.actorId} AND idempotency_key=${input.idempotencyKey}`;
  if(retry){if(retry.command_digest!==commandDigest)throw Error('idempotency_reuse');return {...retry.acknowledgement,status:'replay' as const};}
  if(kind==='definition'){
   const data=input as ConceptDefinitionInput,payload=conceptDefinitionFromInput(context,data);
   if(data.review.decision==='reviewed_definition'){
    const [priorRow]=await tx`SELECT v.* FROM academy.concept_domain_heads h JOIN academy.concept_domain_versions v USING(owner_id,entity_id,sequence) WHERE h.owner_id=${context.ownerId} AND h.entity_id=${payload.id}`;
    const prior=priorRow?version(priorRow):null;
    if(prior?.kind!=='definition'||prior.payload.kind!=='atomic_concept_revision'||conceptDefinitionDigest(prior.payload)!==data.review.expectedDefinitionDigest)throw Error('definition_review_basis_conflict');
    const {kind:priorKind,id:priorId,revisionId:priorRevision,semanticReview:priorReview,...priorDefinition}=prior.payload;
    if(canonicalJson(priorDefinition)!==canonicalJson(data.definition))throw Error('definition_review_basis_conflict');
   }
   return await persist(tx as unknown as SQL,context,data,kind,null,payload,commandDigest);
  }
  const data=input as ConceptLinkInput,conceptRows=await tx`SELECT v.* FROM academy.concept_domain_heads h JOIN academy.concept_domain_versions v USING(owner_id,entity_id,sequence) WHERE h.owner_id=${context.ownerId} AND v.kind='definition' AND v.payload->>'revisionId'=${data.conceptRevisionId}`;
  if(conceptRows.length!==1)throw Error('stale_concept_revision');
  const definition=version(conceptRows[0]);if(definition.payload.kind!=='atomic_concept_revision')throw Error('concept_storage_scope_conflict');
  const permittedBasis=new Set([data.evidenceRevisionId,data.conceptRevisionId,...definition.payload.sourceRefs]);if(data.basisRefs.some(ref=>!permittedBasis.has(ref)))throw Error('concept_basis_scope_conflict');
  if(!reader)throw Error('concept_evidence_adapter_required');const read=await reader(tx as unknown as SQL,context.ownerId,data.studentId);
  const adapted=adaptConceptEvidence(context.ownerId,data.studentId,read);if(!read.currentRevisionIds.includes(data.evidenceRevisionId)||!adapted.descriptors.some(row=>row.revisionId===data.evidenceRevisionId))throw Error('stale_evidence_basis');
  const provisional=conceptLinkFromInput(context,data,null),[priorRow]=await tx`SELECT v.* FROM academy.concept_domain_heads h JOIN academy.concept_domain_versions v USING(owner_id,entity_id,sequence) WHERE h.owner_id=${context.ownerId} AND h.entity_id=${provisional.id}`;
  const prior=priorRow?version(priorRow):null;if(prior&&prior.payload.kind!=='student_concept_link_revision')throw Error('concept_storage_scope_conflict');
  if(prior?.payload.kind==='student_concept_link_revision'&&prior.payload.status!=='candidate'&&data.status==='candidate')throw Error('concept_review_downgrade_forbidden');
  const payload=conceptLinkFromInput(context,data,(prior?.payload as ConceptLinkRevision|undefined)??null);
  return await persist(tx as unknown as SQL,context,data,kind,data.studentId,payload,commandDigest);
 }catch(error){callbackFailed=true;throw error;}}) as Omit<ConceptWorkspaceReceipt,'record'>;
 }catch(error){if(callbackFailed)throw new TeacherWorkspaceRefusal(error instanceof Error?error.message:'concept_transaction_refused','transaction');throw error;}
 try{const record=await conceptResult(db,context.ownerId,context.actorId,input.idempotencyKey,kind==='link'?(input as ConceptLinkInput).studentId:null);if(!record||record.revisionId!==acknowledgement.revisionId)throw Error('committed_outcome_uncertain');return {...acknowledgement,record};}catch{throw Error('committed_outcome_uncertain');}
}
export const appendConceptDefinition=(db:SQL,context:ConceptCommandContext,input:ConceptDefinitionInput)=>append(db,context,input,undefined);
export const appendStudentConceptLink=(db:SQL,context:ConceptCommandContext,input:ConceptLinkInput,reader:ConceptEvidenceReader)=>append(db,context,input,reader);
export async function conceptResult(db:SQL,ownerId:string,actorId:string,requestId:string,studentId:string|null){
 const rows=await db`SELECT v.* FROM academy.concept_domain_outcomes o JOIN academy.concept_domain_versions v ON v.owner_id=o.owner_id AND v.actor_id=o.actor_id AND v.revision_id=o.acknowledgement->>'revisionId' AND v.idempotency_key=o.idempotency_key AND v.command_digest=o.command_digest WHERE o.owner_id=${ownerId} AND o.actor_id=${actorId} AND o.idempotency_key=${requestId} AND v.student_id IS NOT DISTINCT FROM ${studentId}`;return rows.length===1?version(rows[0]):null;
}
export async function conceptHistory(db:SQL,ownerId:string,studentId:string|null,entityId:string,afterSequence=0){
 if(!Number.isSafeInteger(afterSequence)||afterSequence<0)throw Error('invalid_history_range');conceptSelector(entityId);const rows=await db`SELECT * FROM academy.concept_domain_versions WHERE owner_id=${ownerId} AND student_id IS NOT DISTINCT FROM ${studentId} AND entity_id=${entityId} AND sequence>${afterSequence} ORDER BY sequence LIMIT 200`;return rows.map(version);
}
export interface StudentConceptGraphRead {
 graph:ReturnType<typeof projectStudentConceptGraph>;heads:ConceptWorkspaceVersion[];evidenceMetadata:ReturnType<typeof adaptConceptEvidence>['metadata'];storageReady:boolean;
 catalogQualification:'teacher_entered_candidates_only_no_curated_catalog';definitionDigests:Record<string,string>;sourceGate:string;officialSaved:false;parentSent:false;
}
export async function readStudentConceptGraph(db:SQL,ownerId:string,studentId:string,reader:ConceptEvidenceReader){
 return db.begin(async tx=>{
  await tx`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`;
  const [ready]=await tx`SELECT to_regclass('academy.concept_domain_versions') IS NOT NULL AS ready`;
  if(ready?.ready){const [size]=await tx`SELECT count(*)::int AS rows,coalesce(sum(pg_column_size(payload)),0)::bigint AS bytes FROM academy.concept_domain_versions WHERE owner_id=${ownerId} AND (student_id IS NULL OR student_id=${studentId})`;if(size.rows>2000||Number(size.bytes)>8_388_608)throw Error('concept_graph_cap');}
  const rows:PersistedRow[]=ready?.ready?await tx`SELECT * FROM academy.concept_domain_versions WHERE owner_id=${ownerId} AND (student_id IS NULL OR student_id=${studentId}) ORDER BY entity_id,sequence LIMIT 2001`:[];
  if(rows.length>2000)throw Error('concept_graph_cap');const versions=rows.map(version),definitions=versions.filter(row=>row.kind==='definition'),links=versions.filter(row=>row.kind==='link');
  const read=await reader(tx as unknown as SQL,ownerId,studentId,links.flatMap(row=>row.payload.kind==='student_concept_link_revision'?[row.payload.evidenceRevisionId]:[]));const adapted=adaptConceptEvidence(ownerId,studentId,read);
  const concepts=[...new Map(definitions.map(row=>[row.payload.revisionId,row.payload as ConceptRevision])).values()];
  const graph=projectStudentConceptGraph(ownerId,studentId,adapted.descriptors,concepts,links.map(row=>row.payload as ConceptLinkRevision));
  const latest=new Map<string,ConceptWorkspaceVersion>();
  for(const row of versions){const prior=latest.get(row.entityId);if(row.sequence!==(prior?.sequence??0)+1||row.previousRevisionId!==(prior?.revisionId??null)||row.previousDigest!==(prior?.integrityDigest??null))throw Error('concept_storage_history_gap');latest.set(row.entityId,row);}
  const headRows:PersistedRow[]=ready?.ready?await tx`SELECT v.* FROM academy.concept_domain_heads h JOIN academy.concept_domain_versions v USING(owner_id,entity_id,sequence) WHERE h.owner_id=${ownerId} AND (v.student_id IS NULL OR v.student_id=${studentId}) ORDER BY v.entity_id`:[];
  const heads=headRows.map(version);if(heads.length!==latest.size||heads.some(row=>latest.get(row.entityId)?.revisionId!==row.revisionId))throw Error('concept_storage_head_conflict');
  return {graph,heads,evidenceMetadata:adapted.metadata,storageReady:ready?.ready===true,catalogQualification:'teacher_entered_candidates_only_no_curated_catalog' as const,definitionDigests:Object.fromEntries(concepts.map(concept=>[concept.revisionId,conceptDefinitionDigest(concept)])),sourceGate:'Actual atomic catalog and curriculum source qualification remain separate; research task/capability proposals were not promoted' as const,officialSaved:false as const,parentSent:false as const};
 }) as Promise<StudentConceptGraphRead>;
}

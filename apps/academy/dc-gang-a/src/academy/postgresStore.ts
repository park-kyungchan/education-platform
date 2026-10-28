import {lockApprovalDependencies,lockSharedOutputGate,validateReadAdmission,computeReadHorizon,normalizeReadHorizon,NativePrerequisiteStore,migrateNativePrerequisites,assertNativePrerequisitesReady,guardReservedAppend} from './nativePrerequisiteStore';
import type {TeacherPrerequisiteStore,TeacherPrerequisiteReadStore,CurrentCatalogPin,ReadOutputDecision,ReadOutputRefusalSelector,CommittedReadOutput} from './ports/teacherStore';
import type {ReadAdmission} from './contracts/prerequisiteRecords';
import {migrateConceptWorkspace,assertConceptWorkspaceReady,appendConceptDefinition,appendStudentConceptLink,readStudentConceptGraph,conceptResult,conceptHistory} from './conceptWorkspaceStore';
import type {ConceptCommandContext,ConceptDefinitionInput,ConceptLinkInput} from './conceptWorkspace';
import type {ConceptEvidenceRead} from './conceptEvidenceAdapter';
import {ownerWorkspaceVersionFrom,asStudentWorkspace} from './ownerWorkspaceStore';
import {migrateOwnerWorkspaces,assertOwnerWorkspacesReady,appendOwnerWorkspace,ownerWorkspaces,ownerWorkspaceHistory,ownerWorkspaceResult,studentWorkspaces,type OwnerWorkspaceCommand} from './ownerWorkspaceStore';
import type { SQL } from 'bun';
import type {NativeQualificationHooks} from './nativeTypedRead';
import {immutableCopy, assertExactKeys, assertInstant, assertRefs, canonicalJson, digest, requireText, stableId } from '../learning/model';
import { traceHierarchy, validateHierarchy, validateSourceKey, type CatalogNode, type SourceKey } from './domain';
import { createAcademySourceAudit } from '../lms/academySourceAudit';
import {readInputRecord} from '../contracts/readInputRecord';
import { validateAcademyRecord, type AcademyRecord } from './records';
import {assertPreparationDate} from './preparationHistory';
import {sameClinicTarget} from './learningWork';
import {assertAssignmentNotReplaced,assertReplacementGraph,replacementPredecessor,retainedAssessmentScore,type AssignmentVersion} from './learningWorkBindings';
import {classroomCyclePolicy} from './classroomCyclePolicy';
import type {NormalizedCohort} from './sourceBridge';
import {normalizeSourceArea,validateSourceAreaTask,type SourceAreaTask,type SourceAreaReceipt} from './sourceSynchronization';
import type {StudentRegistration,StoredStudent,AppendCommand,WriteAcknowledgement,RecordVersion} from './contracts/storageRecords';
import type {SourceRequestReceipt} from './contracts/sourceRequests';
import type {TeacherStore,TeacherReadStore} from './ports/teacherStore';
import type {SourceRefreshStore} from './ports/sourceRefreshStore';
export type {StudentRegistration,StoredStudent,AppendCommand,WriteAcknowledgement,RecordVersion} from './contracts/storageRecords';
export type {SourceRequestReceipt} from './contracts/sourceRequests';
const sourceTransaction=Symbol('source_refresh_transaction');


function sourceRequestId(value:string){if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value))throw Error('source_request_id_required');return 'source-request:'+value;}
interface StudentRow { id: string; display_name: string; source_namespace: string; source_key: string; proof_refs: string[]; registered_at: Date | string }

interface VersionRow { owner_id:string;student_id:string;entity_id:string;sequence:bigint|number;revision_id:string;previous_revision_id:string|null;previous_digest:string|null;payload:AcademyRecord;content_digest:string;integrity_digest:string;source_observed_at:Date|string;recorded_at:Date|string;actor_id:string;idempotency_key:string;command_digest:string }
function versionFrom(row: VersionRow): RecordVersion {
  const value: RecordVersion = { ownerId:row.owner_id,studentId:row.student_id,entityId:row.entity_id,sequence:Number(row.sequence),revisionId:row.revision_id,
    previousRevisionId:row.previous_revision_id,previousDigest:row.previous_digest,payload:row.payload,contentDigest:row.content_digest,integrityDigest:row.integrity_digest,
    sourceObservedAt:new Date(row.source_observed_at).toISOString(),recordedAt:new Date(row.recorded_at).toISOString(),actorId:row.actor_id,idempotencyKey:row.idempotency_key,commandDigest:row.command_digest };
  validateAcademyRecord(value.payload);
  const {integrityDigest,...body}=value;
  if (!Number.isSafeInteger(value.sequence)||value.sequence<1||digest(body)!==integrityDigest) throw Error('stored_revision_integrity');
  return value;
}
/** Trusted provider adapter; caller authentication and operation grants belong to application ingress. */
export class PostgresAcademyStore implements TeacherPrerequisiteStore,SourceRefreshStore {
  constructor(readonly db: SQL,private readonly transactionScope?:typeof sourceTransaction,private readonly qualification?:NativeQualificationHooks,private readonly writerHook?:import('./nativePrerequisiteStore').DependencyWriterHook) {}
  /** A whole teacher scene observes one PostgreSQL revision horizon and cannot write. */
  async readSnapshot<T>(read:(store:TeacherPrerequisiteReadStore)=>Promise<T>):Promise<T>{
    if(this.transactionScope)throw Error('nested_teacher_read_snapshot');
    return this.db.begin(async tx=>{
      await tx`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`;
      const scoped=new PostgresAcademyStore(tx as unknown as SQL,sourceTransaction);let active=true;
      const query=<R>(operation:()=>Promise<R>):Promise<R>=>active?operation():Promise.reject(Error('read_snapshot_closed'));
      try{return await read(this.frozenReadView(scoped,query));}finally{active=false;}
    }) as Promise<T>;
  }
  /** Exactly the 31 frozen reads; no writer, driver or output committer. */
  private frozenReadView(scoped:PostgresAcademyStore,query:<R>(operation:()=>Promise<R>)=>Promise<R>):TeacherPrerequisiteReadStore{
    const view:TeacherPrerequisiteReadStore={
        currentCatalogPins:(...args)=>query(()=>scoped.currentCatalogPins(...args)),
        ownerRevision:(...args)=>query(()=>scoped.ownerRevision(...args)),
        ownerHistory:(...args)=>query(()=>scoped.ownerHistory(...args)),
        scoreEvidenceCurrent:(...args)=>query(()=>scoped.scoreEvidenceCurrent(...args)),
        scoreEvidenceForAttempt:(...args)=>query(()=>scoped.scoreEvidenceForAttempt(...args)),
        approvalClosurePreview:(...args)=>query(()=>scoped.approvalClosurePreview(...args)),
        teachers:(...args)=>query(()=>scoped.teachers(...args)),
        teacherCurrent:(...args)=>query(()=>scoped.teacherCurrent(...args)),
        teacherBindingByActor:(...args)=>query(()=>scoped.teacherBindingByActor(...args)),
        classGroups:(...args)=>query(()=>scoped.classGroups(...args)),
        classCurrent:(...args)=>query(()=>scoped.classCurrent(...args)),
        lessons:(...args)=>query(()=>scoped.lessons(...args)),
        lessonCurrent:(...args)=>query(()=>scoped.lessonCurrent(...args)),
        temporalBindings:(...args)=>query(()=>scoped.temporalBindings(...args)),
        activityScopes:(...args)=>query(()=>scoped.activityScopes(...args)),
        studentRevisionCurrent:(...args)=>query(()=>scoped.studentRevisionCurrent(...args)),
        studentRevisionHistory:(...args)=>query(()=>scoped.studentRevisionHistory(...args)),
        approvalCurrent:(...args)=>query(()=>scoped.approvalCurrent(...args)),
        commandOutcomeLookup:(...args)=>query(()=>scoped.commandOutcomeLookup(...args)),
        readOccurrenceLookup:(...args)=>query(()=>scoped.readOccurrenceLookup(...args)),
        studentWorkspaces:(...args)=>query(()=>scoped.studentWorkspaces(...args)),
        students:(...args)=>query(()=>scoped.students(...args)),
        current:(...args)=>query(()=>scoped.current(...args)),
        history:(...args)=>query(()=>scoped.history(...args)),
        preparationRevisions:(...args)=>query(()=>scoped.preparationRevisions(...args)),
        catalog:(...args)=>query(()=>scoped.catalog(...args)),
        pinnedCatalog:(...args)=>query(()=>scoped.pinnedCatalog(...args)),
        observationRequest:(...args)=>query(()=>scoped.observationRequest(...args)),
        observationResult:(...args)=>query(()=>scoped.observationResult(...args)),
        clinicRequest:(...args)=>query(()=>scoped.clinicRequest(...args)),
        clinicResult:(...args)=>query(()=>scoped.clinicResult(...args)),
    };
    return Object.freeze(view);
  }
  private prerequisite(){return new NativePrerequisiteStore(this.db,this.writerHook??this.qualification?.afterDependencyWrite);}
  ownerRevision:TeacherPrerequisiteStore['ownerRevision']=(...args)=>this.prerequisite().ownerRevision(...args);
  ownerHistory:TeacherPrerequisiteStore['ownerHistory']=(...args)=>this.prerequisite().ownerHistory(...args);
  scoreEvidenceCurrent:TeacherPrerequisiteStore['scoreEvidenceCurrent']=(...args)=>this.prerequisite().scoreEvidenceCurrent(...args);
  scoreEvidenceForAttempt:TeacherPrerequisiteStore['scoreEvidenceForAttempt']=(...args)=>this.prerequisite().scoreEvidenceForAttempt(...args);
  approvalClosurePreview:TeacherPrerequisiteStore['approvalClosurePreview']=(...args)=>this.prerequisite().approvalClosurePreview(...args);
  teachers:TeacherPrerequisiteStore['teachers']=(...args)=>this.prerequisite().teachers(...args);
  teacherCurrent:TeacherPrerequisiteStore['teacherCurrent']=(...args)=>this.prerequisite().teacherCurrent(...args);
  teacherBindingByActor:TeacherPrerequisiteStore['teacherBindingByActor']=(...args)=>this.prerequisite().teacherBindingByActor(...args);
  classGroups:TeacherPrerequisiteStore['classGroups']=(...args)=>this.prerequisite().classGroups(...args);
  classCurrent:TeacherPrerequisiteStore['classCurrent']=(...args)=>this.prerequisite().classCurrent(...args);
  lessons:TeacherPrerequisiteStore['lessons']=(...args)=>this.prerequisite().lessons(...args);
  lessonCurrent:TeacherPrerequisiteStore['lessonCurrent']=(...args)=>this.prerequisite().lessonCurrent(...args);
  temporalBindings:TeacherPrerequisiteStore['temporalBindings']=(...args)=>this.prerequisite().temporalBindings(...args);
  activityScopes:TeacherPrerequisiteStore['activityScopes']=(...args)=>this.prerequisite().activityScopes(...args);
  studentRevisionCurrent:TeacherPrerequisiteStore['studentRevisionCurrent']=(...args)=>this.prerequisite().studentRevisionCurrent(...args);
  studentRevisionHistory:TeacherPrerequisiteStore['studentRevisionHistory']=(...args)=>this.prerequisite().studentRevisionHistory(...args);
  approvalCurrent:TeacherPrerequisiteStore['approvalCurrent']=(...args)=>this.prerequisite().approvalCurrent(...args);
  commandOutcomeLookup:TeacherPrerequisiteStore['commandOutcomeLookup']=(...args)=>this.prerequisite().commandOutcomeLookup(...args);
  readOccurrenceLookup:TeacherPrerequisiteStore['readOccurrenceLookup']=(...args)=>this.prerequisite().readOccurrenceLookup(...args);
  appendScoreEvidence:TeacherPrerequisiteStore['appendScoreEvidence']=(...args)=>{if(this.transactionScope)throw Error('write_in_snapshot');return this.prerequisite().appendScoreEvidence(...args);};
  appendTeacher:TeacherPrerequisiteStore['appendTeacher']=(...args)=>{if(this.transactionScope)throw Error('write_in_snapshot');return this.prerequisite().appendTeacher(...args);};
  appendClassGroup:TeacherPrerequisiteStore['appendClassGroup']=(...args)=>{if(this.transactionScope)throw Error('write_in_snapshot');return this.prerequisite().appendClassGroup(...args);};
  appendLesson:TeacherPrerequisiteStore['appendLesson']=(...args)=>{if(this.transactionScope)throw Error('write_in_snapshot');return this.prerequisite().appendLesson(...args);};
  appendTemporalBinding:TeacherPrerequisiteStore['appendTemporalBinding']=(...args)=>{if(this.transactionScope)throw Error('write_in_snapshot');return this.prerequisite().appendTemporalBinding(...args);};
  appendActivityScope:TeacherPrerequisiteStore['appendActivityScope']=(...args)=>{if(this.transactionScope)throw Error('write_in_snapshot');return this.prerequisite().appendActivityScope(...args);};
  appendStudentRevision:TeacherPrerequisiteStore['appendStudentRevision']=(...args)=>{if(this.transactionScope)throw Error('write_in_snapshot');return this.prerequisite().appendStudentRevision(...args);};
  createAssessment:TeacherPrerequisiteStore['createAssessment']=(...args)=>{if(this.transactionScope)throw Error('write_in_snapshot');return this.prerequisite().createAssessment(...args);};
  createDraft:TeacherPrerequisiteStore['createDraft']=(...args)=>{if(this.transactionScope)throw Error('write_in_snapshot');return this.prerequisite().createDraft(...args);};
  createProgress:TeacherPrerequisiteStore['createProgress']=(...args)=>{if(this.transactionScope)throw Error('write_in_snapshot');return this.prerequisite().createProgress(...args);};
  correctPrerequisiteRecord:TeacherPrerequisiteStore['correctPrerequisiteRecord']=(...args)=>{if(this.transactionScope)throw Error('write_in_snapshot');return this.prerequisite().correctPrerequisiteRecord(...args);};
  issueApproval:TeacherPrerequisiteStore['issueApproval']=(...args)=>{if(this.transactionScope)throw Error('write_in_snapshot');return this.prerequisite().issueApproval(...args);};
  consumeApprovalAndApproveDraft:TeacherPrerequisiteStore['consumeApprovalAndApproveDraft']=(...args)=>{if(this.transactionScope)throw Error('write_in_snapshot');return this.prerequisite().consumeApprovalAndApproveDraft(...args);};
  revokeApproval:TeacherPrerequisiteStore['revokeApproval']=(...args)=>{if(this.transactionScope)throw Error('write_in_snapshot');return this.prerequisite().revokeApproval(...args);};
  admitCommand:TeacherPrerequisiteStore['admitCommand']=(...args)=>{if(this.transactionScope)throw Error('write_in_snapshot');return this.prerequisite().admitCommand(...args);};
  fenceCommand:TeacherPrerequisiteStore['fenceCommand']=(...args)=>{if(this.transactionScope)throw Error('write_in_snapshot');return this.prerequisite().fenceCommand(...args);};
  admitReadOccurrence:TeacherPrerequisiteStore['admitReadOccurrence']=(...args)=>{if(this.transactionScope)throw Error('write_in_snapshot');return this.prerequisite().admitReadOccurrence(...args);};
  finalizeReadOccurrence:TeacherPrerequisiteStore['finalizeReadOccurrence']=(...args)=>{if(this.transactionScope)throw Error('write_in_snapshot');return this.prerequisite().finalizeReadOccurrence(...args);};
  private transact<T>(operation:(tx:SQL)=>Promise<T>):Promise<T>{return this.transactionScope===sourceTransaction?operation(this.db):this.db.begin(async tx=>{await tx`SET TRANSACTION ISOLATION LEVEL READ COMMITTED`;return operation(tx as unknown as SQL);}) as Promise<T>;}
  /** Startup qualification only; never repairs or migrates a production store. */
  async assertRuntimeReady():Promise<void> {
    const [row]=await this.db`
      SELECT to_regclass('academy.students') IS NOT NULL
        AND to_regclass('academy.record_versions') IS NOT NULL
        AND to_regclass('academy.record_heads') IS NOT NULL
        AND to_regclass('academy.command_outcomes') IS NOT NULL
        AND to_regclass('academy.catalog_versions') IS NOT NULL
        AND to_regclass('academy.source_catalog_links') IS NOT NULL AS tables_ready,
        (SELECT count(*)::int FROM pg_catalog.pg_trigger t
          JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
          JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
          JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid
          JOIN pg_catalog.pg_namespace pn ON pn.oid=p.pronamespace
          WHERE n.nspname='academy' AND pn.nspname='academy'
            AND p.proname='prevent_history_mutation' AND NOT t.tgisinternal
            AND t.tgenabled='O' AND t.tgtype=27
            AND ((c.relname='record_versions' AND t.tgname='immutable_history')
              OR (c.relname='catalog_versions' AND t.tgname='immutable_catalog'))) AS history_triggers`;
    if(row?.tables_ready!==true||row.history_triggers!==2)throw Error('existing_academy_schema_required');
    await assertNativePrerequisitesReady(this.db);
  }
  async migrate(): Promise<void> {
    if(this.transactionScope)throw Error('migration_in_snapshot');
    await this.db.unsafe(`
      CREATE SCHEMA IF NOT EXISTS academy;
      CREATE TABLE IF NOT EXISTS academy.students (
        owner_id text NOT NULL, id text NOT NULL, display_name text NOT NULL,
        source_namespace text NOT NULL, source_key text NOT NULL, proof_refs jsonb NOT NULL,
        registered_at timestamptz NOT NULL DEFAULT clock_timestamp(),
        PRIMARY KEY(owner_id,id), UNIQUE(owner_id,source_namespace,source_key),
        CHECK(length(display_name)>0), CHECK(jsonb_typeof(proof_refs)='array' AND jsonb_array_length(proof_refs)>0)
      );
      CREATE TABLE IF NOT EXISTS academy.record_versions (
        owner_id text NOT NULL, student_id text NOT NULL, entity_id text NOT NULL,
        sequence bigint NOT NULL CHECK(sequence>0), revision_id text NOT NULL,
        previous_revision_id text, previous_digest text, payload jsonb NOT NULL,
        content_digest text NOT NULL, integrity_digest text NOT NULL,
        source_observed_at timestamptz NOT NULL, recorded_at timestamptz NOT NULL,
        actor_id text NOT NULL, idempotency_key text NOT NULL, command_digest text NOT NULL,
        PRIMARY KEY(owner_id,student_id,entity_id,sequence),
        UNIQUE(owner_id,student_id,revision_id),
        FOREIGN KEY(owner_id,student_id) REFERENCES academy.students(owner_id,id)
      );
      CREATE TABLE IF NOT EXISTS academy.record_heads (
        owner_id text NOT NULL, student_id text NOT NULL, entity_id text NOT NULL,
        revision_id text NOT NULL, sequence bigint NOT NULL, content_digest text NOT NULL,
        last_verified_at timestamptz NOT NULL,
        PRIMARY KEY(owner_id,student_id,entity_id),
        FOREIGN KEY(owner_id,student_id,entity_id,sequence) REFERENCES academy.record_versions(owner_id,student_id,entity_id,sequence)
      );
      CREATE TABLE IF NOT EXISTS academy.command_outcomes (
        owner_id text NOT NULL, actor_id text NOT NULL, idempotency_key text NOT NULL,
        command_digest text NOT NULL, acknowledgement jsonb NOT NULL,
        PRIMARY KEY(owner_id,actor_id,idempotency_key)
      );
      CREATE TABLE IF NOT EXISTS academy.catalog_versions (
        owner_id text NOT NULL, node_id text NOT NULL, sequence bigint NOT NULL,
        revision_id text NOT NULL, payload jsonb NOT NULL, content_digest text NOT NULL,
        recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
        PRIMARY KEY(owner_id,node_id,sequence), UNIQUE(owner_id,revision_id)
      );
      CREATE TABLE IF NOT EXISTS academy.source_catalog_links (
        owner_id text NOT NULL, student_id text NOT NULL, source_revision_id text NOT NULL, catalog_revision_id text NOT NULL,
        relation_type text NOT NULL CHECK(relation_type='source_book_reference'),
        PRIMARY KEY(owner_id,student_id,source_revision_id,catalog_revision_id),
        FOREIGN KEY(owner_id,student_id,source_revision_id) REFERENCES academy.record_versions(owner_id,student_id,revision_id),
        FOREIGN KEY(owner_id,catalog_revision_id) REFERENCES academy.catalog_versions(owner_id,revision_id)
      );
      CREATE INDEX IF NOT EXISTS record_history_clock ON academy.record_versions(owner_id,student_id,recorded_at,entity_id,sequence);
      CREATE OR REPLACE FUNCTION academy.prevent_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'append_only_history'; END; $$;
      DROP TRIGGER IF EXISTS immutable_history ON academy.record_versions;
      CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON academy.record_versions FOR EACH ROW EXECUTE FUNCTION academy.prevent_history_mutation();
      DROP TRIGGER IF EXISTS immutable_catalog ON academy.catalog_versions;
      CREATE TRIGGER immutable_catalog BEFORE UPDATE OR DELETE ON academy.catalog_versions FOR EACH ROW EXECUTE FUNCTION academy.prevent_history_mutation();
      REVOKE ALL ON SCHEMA academy FROM PUBLIC;
      REVOKE ALL ON ALL TABLES IN SCHEMA academy FROM PUBLIC;
    `);
    await migrateNativePrerequisites(this.db);
  }
  async migrateTeacherWorkspaces(){if(this.transactionScope)throw Error('migration_in_snapshot');await migrateOwnerWorkspaces(this.db);await assertOwnerWorkspacesReady(this.db);}
  assertTeacherWorkspacesReady(){return assertOwnerWorkspacesReady(this.db);}
  appendOwnerWorkspace(command:OwnerWorkspaceCommand){if(this.transactionScope)throw Error('write_in_snapshot');return appendOwnerWorkspace(this.db,command);}
  ownerWorkspaces(ownerId:string){return ownerWorkspaces(this.db,ownerId);}
  ownerWorkspaceHistory(ownerId:string,entityId:string,afterSequence=0){return ownerWorkspaceHistory(this.db,ownerId,entityId,afterSequence);}
  ownerWorkspaceResult(ownerId:string,actorId:string,requestId:string){return ownerWorkspaceResult(this.db,ownerId,actorId,requestId);}
  studentWorkspaces(ownerId:string,studentId:string){return studentWorkspaces(this.db,ownerId,studentId);}
  migrateConceptWorkspace(){if(this.transactionScope)throw Error('migration_in_snapshot');return migrateConceptWorkspace(this.db);}
  assertConceptWorkspaceReady(){return assertConceptWorkspaceReady(this.db);}
  appendConceptDefinition(context:ConceptCommandContext,input:ConceptDefinitionInput){if(this.transactionScope)throw Error('write_in_snapshot');return appendConceptDefinition(this.db,context,input);}
  appendStudentConceptLink(context:ConceptCommandContext,input:ConceptLinkInput){if(this.transactionScope)throw Error('write_in_snapshot');return appendStudentConceptLink(this.db,context,input,(tx,ownerId,studentId,refs)=>this.conceptEvidenceRead(tx,ownerId,studentId,refs));}
  readStudentConceptGraph(ownerId:string,studentId:string){return readStudentConceptGraph(this.db,ownerId,studentId,(tx,owner,id,refs)=>this.conceptEvidenceRead(tx,owner,id,refs));}
  conceptResult(ownerId:string,actorId:string,requestId:string,studentId:string|null){return conceptResult(this.db,ownerId,actorId,requestId,studentId);}
  conceptHistory(ownerId:string,studentId:string|null,entityId:string,afterSequence=0){return conceptHistory(this.db,ownerId,studentId,entityId,afterSequence);}
  async conceptEvidenceDetail(ownerId:string,studentId:string,revisionId:string){
    return this.db.begin(async tx=>{await tx`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`;const read=await this.conceptEvidenceRead(tx as unknown as SQL,ownerId,studentId,[revisionId]);const record=[...read.legacy,...read.workspaces].find(row=>row.revisionId===revisionId);if(!record)throw Error('concept_evidence_not_found');return {record,current:read.currentRevisionIds.includes(revisionId),officialSaved:false,parentSent:false};});
  }
  private async conceptEvidenceRead(tx:SQL,ownerId:string,studentId:string,additionalRevisionIds:string[]=[]):Promise<ConceptEvidenceRead>{
    if(additionalRevisionIds.length>2000)throw Error('concept_graph_cap');
    const scoped=new PostgresAcademyStore(tx,sourceTransaction),student=(await scoped.students(ownerId)).find(row=>row.id===studentId);if(!student)throw Error('student_scope_conflict');
    const [legacySize]=await tx`SELECT count(*)::int AS rows,coalesce(sum(pg_column_size(v.payload)),0)::bigint AS bytes FROM academy.record_heads h JOIN academy.record_versions v USING(owner_id,student_id,entity_id,sequence) WHERE h.owner_id=${ownerId} AND h.student_id=${studentId}`;
    if(legacySize.rows>2000||Number(legacySize.bytes)>16_777_216)throw Error('concept_evidence_scope_too_large');
    const [workspaceReady]=await tx`SELECT to_regclass('academy.owner_workspace_versions') IS NOT NULL AS ready`;
    if(workspaceReady?.ready){const [size]=await tx`SELECT count(*)::int AS rows,coalesce(sum(pg_column_size(v.payload)),0)::bigint AS bytes FROM academy.owner_workspace_heads h JOIN academy.owner_workspace_versions v USING(owner_id,entity_id,sequence) WHERE h.owner_id=${ownerId} AND v.payload->'studentBinding'->>'studentId'=${studentId}`;if(size.rows>1000||Number(size.bytes)>16_777_216)throw Error('concept_evidence_scope_too_large');}
    const [current,workspaces]=await Promise.all([scoped.current(ownerId,studentId),scoped.studentWorkspaces(ownerId,studentId)]);
    const legacy=new Map<string,RecordVersion>(current.map(row=>[row.revisionId,row])),local=new Map(workspaces.map(row=>[row.revisionId,row]));
    const load=async(refs:string[])=>{const unique=[...new Set(refs)];if(!unique.length)return;
      const [size]=await tx`SELECT count(*)::int AS rows,coalesce(sum(pg_column_size(payload)),0)::bigint AS bytes FROM academy.record_versions WHERE owner_id=${ownerId} AND student_id=${studentId} AND revision_id IN ${tx(unique)}`;if(size.rows>2000||Number(size.bytes)>16_777_216)throw Error('concept_evidence_scope_too_large');
      const oldRows=await tx`SELECT * FROM academy.record_versions WHERE owner_id=${ownerId} AND student_id=${studentId} AND revision_id IN ${tx(unique)}`;for(const row of oldRows){const record=versionFrom(row);legacy.set(record.revisionId,record);}
      const [ready]=await tx`SELECT to_regclass('academy.owner_workspace_versions') IS NOT NULL AS ready`;
      if(ready?.ready){const [size]=await tx`SELECT count(*)::int AS rows,coalesce(sum(pg_column_size(payload)),0)::bigint AS bytes FROM academy.owner_workspace_versions WHERE owner_id=${ownerId} AND payload->'studentBinding'->>'studentId'=${studentId} AND revision_id IN ${tx(unique)}`;if(size.rows>2000||Number(size.bytes)>16_777_216)throw Error('concept_evidence_scope_too_large');const rows=await tx`SELECT * FROM academy.owner_workspace_versions WHERE owner_id=${ownerId} AND payload->'studentBinding'->>'studentId'=${studentId} AND payload->>'kind' IN ('teacher_activity_review','teacher_parent_draft') AND revision_id IN ${tx(unique)}`;for(const row of rows){const record=asStudentWorkspace(ownerWorkspaceVersionFrom(row),studentId);local.set(record.revisionId,record);}}
    };
    await load(additionalRevisionIds);
    const assignmentRefs=[...legacy.values()].flatMap(row=>row.payload.kind==='learning_work_attempt'?[row.payload.assignmentRevisionId]:[]).concat([...local.values()].flatMap(row=>row.payload.kind==='teacher_activity_review'?[row.payload.assignmentRevisionId]:[]));await load(assignmentRefs);
    return {student,legacy:[...legacy.values()],workspaces:[...local.values()],currentRevisionIds:[...current,...workspaces].map(row=>row.revisionId)};
  }
  async registerStudent(input: StudentRegistration): Promise<void> {input=immutableCopy(input);
    assertExactKeys(input, ['ownerId', 'id', 'displayName', 'sourceKey', 'proofRefs']);
    canonicalJson(input); validateSourceKey(input.sourceKey); assertRefs(input.proofRefs);
    for (const field of [input.ownerId, input.id, input.displayName]) requireText(field, 'student registration');
    if (input.displayName.length > 200 || input.sourceKey.namespace !== 'academy_student') throw Error('student_binding_contract');
    await this.db.begin(async tx => {
      await tx`SET TRANSACTION ISOLATION LEVEL READ COMMITTED`;
      await lockApprovalDependencies(tx,input.ownerId);
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${canonicalJson([input.ownerId,input.id])},0))`;
      await tx`INSERT INTO academy.students(owner_id,id,display_name,source_namespace,source_key,proof_refs)
        VALUES(${input.ownerId},${input.id},${input.displayName},${input.sourceKey.namespace},${input.sourceKey.literalKey},${canonicalJson(input.proofRefs)}::text::jsonb)
        ON CONFLICT(owner_id,id) DO NOTHING`;
      const [row] = await tx`SELECT display_name,source_namespace,source_key FROM academy.students WHERE owner_id=${input.ownerId} AND id=${input.id}`;
      if (!row || row.display_name !== input.displayName || row.source_namespace !== input.sourceKey.namespace || row.source_key !== input.sourceKey.literalKey) throw Error('student_rebinding_requires_revision');
      await (this.writerHook??this.qualification?.afterDependencyWrite)?.('registerStudent',input.ownerId,input.id,tx as unknown as SQL);
    });
  }
  async students(ownerId: string): Promise<StoredStudent[]> {
    requireText(ownerId, 'owner');
    const rows = await this.db`SELECT id,display_name,source_namespace,source_key,proof_refs,registered_at FROM academy.students WHERE owner_id=${ownerId} ORDER BY id`;
    return rows.map((row: StudentRow) => ({ ownerId, id: row.id, displayName: row.display_name,
      sourceKey: { namespace: row.source_namespace, literalKey: row.source_key }, proofRefs: row.proof_refs,
      registeredAt: new Date(row.registered_at).toISOString() }));
  }
  async append(command: AppendCommand, recordedAt = new Date().toISOString()): Promise<WriteAcknowledgement> {command=immutableCopy(command);
    assertExactKeys(command,['ownerId','studentId','entityId','actorId','idempotencyKey','expectedRevisionId','sourceObservedAt','payload']);
    canonicalJson(command); validateAcademyRecord(command.payload);
    if(command.payload.kind==='daily_progress'||command.payload.kind==='daily_record_draft'||command.payload.kind==='previous_homework_assessment')throw Error('native_prerequisite_command_required');
    for(const value of [command.ownerId,command.studentId,command.entityId,command.actorId,command.idempotencyKey])requireText(value,'append identity');
    if(command.expectedRevisionId!==null)requireText(command.expectedRevisionId,'expected revision');
    assertInstant(command.sourceObservedAt);assertInstant(recordedAt);
    if(Date.parse(command.sourceObservedAt)>Date.parse(recordedAt))throw Error('future_source_observation');
    const commandDigest=digest(command);
    const contentDigest=command.payload.kind==='source_audit'?createAcademySourceAudit(command.payload.acquisition).contentDigest:digest(command.payload);
    const acknowledgement=await this.transact(async tx=>{
      await lockApprovalDependencies(tx,command.ownerId);
      // Serialize source replacement and source-bound teacher intake in the same student partition.
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${canonicalJson(['student-records',command.ownerId,command.studentId])},0))`;
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${canonicalJson([command.ownerId,command.actorId,command.idempotencyKey])},0))`;
      await guardReservedAppend(tx,command.ownerId,command.actorId,command.idempotencyKey);
      const [retry]=await tx`SELECT command_digest,acknowledgement FROM academy.command_outcomes WHERE owner_id=${command.ownerId} AND actor_id=${command.actorId} AND idempotency_key=${command.idempotencyKey}`;
      if(retry){if(retry.command_digest!==commandDigest)throw Error('idempotency_reuse');return {...retry.acknowledgement,status:'replay'} as WriteAcknowledgement;}
      const [student]=await tx`SELECT source_key FROM academy.students WHERE owner_id=${command.ownerId} AND id=${command.studentId}`;
      if(!student)throw Error('unknown_student_partition');
      if('sourceStudent' in command.payload&&command.payload.sourceStudent.literalKey!==student.source_key)throw Error('source_student_binding_conflict');
      if(command.payload.kind==='teacher_observation_request'&&command.payload.resolution==='pending'){
        const occurrence=canonicalJson(command.payload.observation.occurrence);
        const pending=await tx`SELECT v.* FROM academy.record_heads h JOIN academy.record_versions v USING(owner_id,student_id,entity_id,sequence)
          WHERE h.owner_id=${command.ownerId} AND h.student_id=${command.studentId} AND v.actor_id=${command.actorId}
            AND v.payload->>'kind'='teacher_observation_request' AND v.payload->>'resolution'='pending'
            AND NOT EXISTS(SELECT 1 FROM academy.command_outcomes o JOIN academy.record_versions committed
              ON committed.owner_id=o.owner_id AND committed.actor_id=o.actor_id AND committed.revision_id=o.acknowledgement->>'revisionId'
              WHERE o.owner_id=v.owner_id AND o.actor_id=v.actor_id AND o.idempotency_key=v.payload->>'requestId' AND committed.payload->>'kind'='teacher_observation')`;
        for(const row of pending){const original=versionFrom(row);if(original.payload.kind==='teacher_observation_request'&&canonicalJson(original.payload.observation.occurrence)===occurrence)throw Error('unresolved_observation_request');}
      }
      if(command.payload.kind==='teacher_clinic_request'&&command.payload.resolution==='pending'){
        const target=command.payload.decision;
        const pending=await tx`SELECT v.* FROM academy.record_heads h JOIN academy.record_versions v USING(owner_id,student_id,entity_id,sequence)
          WHERE h.owner_id=${command.ownerId} AND h.student_id=${command.studentId} AND v.actor_id=${command.actorId}
            AND v.payload->>'kind'='teacher_clinic_request' AND v.payload->>'resolution'='pending'
            AND NOT EXISTS(SELECT 1 FROM academy.command_outcomes o JOIN academy.record_versions committed
              ON committed.owner_id=o.owner_id AND committed.actor_id=o.actor_id AND committed.revision_id=o.acknowledgement->>'revisionId'
              WHERE o.owner_id=v.owner_id AND o.actor_id=v.actor_id AND o.idempotency_key=v.payload->>'requestId' AND committed.payload->>'kind'='teacher_clinic_revision')`;
        for(const row of pending){const original=versionFrom(row);if(original.payload.kind==='teacher_clinic_request'&&sameClinicTarget(original.payload.decision,target))throw Error('unresolved_clinic_request');}
      }
      if(command.payload.kind==='teacher_observation'){
        const payload=command.payload;
        if(payload.reportedAt!==command.sourceObservedAt)throw Error('observation_clock_conflict');
        const [basis]=await tx`SELECT v.* FROM academy.record_heads h JOIN academy.record_versions v USING(owner_id,student_id,entity_id,sequence)
          WHERE h.owner_id=${command.ownerId} AND h.student_id=${command.studentId} AND v.revision_id=${payload.basisRevisionId}`;
        if(!basis)throw Error('stale_evidence_basis');
        const version=versionFrom(basis);
        if(version.payload.kind!=='source_audit')throw Error('observation_basis_conflict');
        const snapshot=readInputRecord(version.payload.acquisition);
        if(snapshot.family!=='day_record'||!Array.isArray(snapshot.dayRecords)||!snapshot.dayRecords.some(raw=>{
          const row=readInputRecord(raw);return row.studentKey===student.source_key&&Object.entries(payload.occurrence).every(([key,value])=>row[key]===value);
        }))throw Error('observation_basis_conflict');
      }
      if(command.payload.kind==='source_course_inventory'||command.payload.kind==='teacher_activity_revision'||command.payload.kind==='teacher_preparation_assignment'||command.payload.kind==='learning_work_assignment'){
        const payload=command.payload;
        const registrations=await tx`SELECT v.payload FROM academy.record_heads h JOIN academy.record_versions v USING(owner_id,student_id,entity_id,sequence)
          WHERE h.owner_id=${command.ownerId} AND h.student_id=${command.studentId} AND v.payload->>'kind'='source_book_registration'`;
        const matches=registrations.filter((r:{payload:AcademyRecord})=>r.payload.kind==='source_book_registration'&&canonicalJson(r.payload.sourceCourse)===canonicalJson(payload.sourceCourse)&&canonicalJson(r.payload.sourceBook)===canonicalJson(payload.sourceBook)&&(!('sourceUserCourse' in payload)||canonicalJson(r.payload.sourceUserCourse)===canonicalJson(payload.sourceUserCourse)));
        if(matches.length!==1)throw Error('preparation_book_binding_conflict');
      }
      if(command.payload.kind==='learning_work_assignment'){
        const payload=command.payload;
        const [registration]=await tx`SELECT v.* FROM academy.record_heads h JOIN academy.record_versions v USING(owner_id,student_id,entity_id,sequence)
          WHERE h.owner_id=${command.ownerId} AND h.student_id=${command.studentId} AND v.revision_id=${payload.registrationRevisionId}`;
        const registered=registration?versionFrom(registration).payload:null;
        if(registered?.kind!=='source_book_registration'||['sourceCourse','sourceUserCourse','sourceBook'].some(field=>canonicalJson(registered[field as 'sourceCourse'])!==canonicalJson(payload[field as 'sourceCourse'])))throw Error('work_registration_binding_conflict');
        const assignments=await tx`SELECT * FROM academy.record_versions WHERE owner_id=${command.ownerId} AND student_id=${command.studentId} AND payload->>'kind'='learning_work_assignment'`;
        if(payload.replaces?.state==='known'){
          const retained:AssignmentVersion[]=assignments.map((row:VersionRow)=>versionFrom(row) as AssignmentVersion);
          const proposed={ownerId:command.ownerId,studentId:command.studentId,entityId:command.entityId,revisionId:'uncommitted-replacement-candidate',payload} as AssignmentVersion;
          const predecessor=replacementPredecessor(proposed,retained)!;
          const [current]=await tx`SELECT revision_id FROM academy.record_heads WHERE owner_id=${command.ownerId} AND student_id=${command.studentId} AND entity_id=${predecessor.entityId}`;
          const carried=retained.some(old=>old.entityId===command.entityId&&old.payload.replaces?.state==='known'&&old.payload.replaces.value.assignmentRevisionId===predecessor.revisionId);
          if(!carried&&current?.revision_id!==predecessor.revisionId)throw Error('work_replacement_basis_not_current');
          assertReplacementGraph([...retained,proposed]);
        }
        for(const row of assignments){
          const old=versionFrom(row);if(old.payload.kind!=='learning_work_assignment')throw Error('work_binding_conflict');
          if(old.entityId!==command.entityId&&canonicalJson(old.payload.assignmentKey)===canonicalJson(payload.assignmentKey))throw Error('duplicate_work_identity');
          if(old.payload.paper.state==='known'&&payload.paper.state==='known'&&canonicalJson(old.payload.paper.value.issuanceKey)===canonicalJson(payload.paper.value.issuanceKey)
            &&canonicalJson({paper:old.payload.paper.value,items:old.payload.items})!==canonicalJson({paper:payload.paper.value,items:payload.items}))throw Error('paper_issuance_rebound');
        }
        if(payload.paper.state==='known'&&payload.paper.value.reissueOf!==null){
          const predecessor=payload.paper.value.reissueOf;
          if(!assignments.some((row:VersionRow)=>row.payload.kind==='learning_work_assignment'&&row.payload.paper.state==='known'
            &&canonicalJson(row.payload.paper.value.issuanceKey)===canonicalJson(predecessor)&&canonicalJson(row.payload.sourceCourse)===canonicalJson(payload.sourceCourse)&&canonicalJson(row.payload.sourceBook)===canonicalJson(payload.sourceBook)))throw Error('paper_reissue_predecessor_missing');
        }
        await tx`SELECT pg_advisory_xact_lock(hashtextextended(${canonicalJson([command.ownerId,'catalog-write'])},0))`;
        const nodes:CatalogNode[]=[];
        for(const ref of payload.catalogRefs){
          const [row]=await tx`SELECT payload,content_digest FROM academy.catalog_versions WHERE owner_id=${command.ownerId} AND node_id=${ref.nodeId} AND revision_id=${ref.revisionId}`;
          if(!row||digest(row.payload)!==row.content_digest)throw Error('work_catalog_binding_conflict');
          nodes.push(row.payload);
        }
        validateHierarchy(nodes);
        const index=new Map(nodes.map(node=>[node.id,node]));
        for(const section of payload.sectionNodeIds){
          const path=traceHierarchy(nodes,section);
          if(index.get(section)?.kind!=='learning_section'||path.state!=='known'||canonicalJson(path.path[0]!.sourceKey)!==canonicalJson(payload.sourceBook))throw Error('work_catalog_binding_conflict');
        }
        for(const item of payload.items){
          const path=traceHierarchy(nodes,item.contentNodeId);
          if(index.get(item.contentNodeId)?.kind!=='problem'||path.state!=='known'||!path.path.some(node=>node.id===item.sectionNodeId))throw Error('work_catalog_binding_conflict');
          if(canonicalJson(index.get(item.contentNodeId)!.sourceKey)!==canonicalJson(item.itemKey))throw Error('work_source_item_binding_conflict');
        }
      }
      if(command.payload.kind==='learning_work_attempt'){
        const payload=command.payload;
        const [row]=await tx`SELECT v.* FROM academy.record_heads h JOIN academy.record_versions v USING(owner_id,student_id,entity_id,sequence)
          WHERE h.owner_id=${command.ownerId} AND h.student_id=${command.studentId} AND v.revision_id=${payload.assignmentRevisionId}`;
        const assignment=row?versionFrom(row).payload:null;
        if(assignment?.kind!=='learning_work_assignment'||assignment.status!=='assigned')throw Error('work_assignment_basis_conflict');
        const successorRows=await tx`SELECT v.* FROM academy.record_versions v WHERE v.owner_id=${command.ownerId} AND v.student_id=${command.studentId} AND v.payload->>'kind'='learning_work_assignment'`;
        assertAssignmentNotReplaced(versionFrom(row) as AssignmentVersion,successorRows.map((v:VersionRow)=>versionFrom(v) as AssignmentVersion),new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(command.sourceObservedAt)));
        if(canonicalJson(payload.paperIssuanceKey)!==canonicalJson(assignment.paper.state==='known'?assignment.paper.value.issuanceKey:null))throw Error('work_paper_binding_conflict');
        if(payload.itemResults.some(item=>!assignment.items.some(assigned=>assigned.assignedItemId===item.assignedItemId)))throw Error('work_item_binding_conflict');
        if(payload.assessmentBasis?.state==='known'){
          const [source]=await tx`SELECT v.* FROM academy.record_heads h JOIN academy.record_versions v USING(owner_id,student_id,entity_id,sequence) WHERE h.owner_id=${command.ownerId} AND h.student_id=${command.studentId} AND v.revision_id=${payload.assessmentBasis.value.sourceAuditRevisionId}`;
          if(!source||retainedAssessmentScore(versionFrom(row) as AssignmentVersion,payload,versionFrom(source)).state!=='known')throw Error('assessment_source_binding_conflict');
        }
        if(payload.occurredAt.state==='known'&&Date.parse(payload.occurredAt.value)>Date.parse(command.sourceObservedAt))throw Error('future_attempt_occurrence');
        const attempts=await tx`SELECT * FROM academy.record_versions WHERE owner_id=${command.ownerId} AND student_id=${command.studentId} AND payload->>'kind'='learning_work_attempt'`;
        for(const row of attempts){const previous=versionFrom(row);if(previous.payload.kind==='learning_work_attempt'&&previous.entityId!==command.entityId&&canonicalJson(previous.payload.attemptKey)===canonicalJson(payload.attemptKey))throw Error('duplicate_work_identity');}
        if(payload.previousAttemptRevisionId!==null){
          const previous=attempts.find((row:VersionRow)=>row.revision_id===payload.previousAttemptRevisionId);
          if(!previous||previous.entity_id===command.entityId||previous.payload.kind!=='learning_work_attempt'||previous.payload.assignmentRevisionId!==payload.assignmentRevisionId)throw Error('work_attempt_predecessor_conflict');
        }
      }
      if(command.payload.kind==='teacher_clinic_revision'){
        const payload=command.payload;
        // Exact committed outcomes replay above. A retained pending original is not decision authority.
        if(payload.policyRevision!==classroomCyclePolicy.operationalContextRevision)throw Error('stale_clinic_policy');
        if(payload.reportedAt!==command.sourceObservedAt)throw Error('clinic_clock_conflict');
        const [assignmentRow]=await tx`SELECT v.* FROM academy.record_heads h JOIN academy.record_versions v USING(owner_id,student_id,entity_id,sequence)
          WHERE h.owner_id=${command.ownerId} AND h.student_id=${command.studentId} AND v.revision_id=${payload.assignmentRevisionId}`;
        const assignment=assignmentRow?versionFrom(assignmentRow).payload:null;
        if(assignment?.kind!=='learning_work_assignment'||assignment.status!=='assigned'||assignment.effectiveDate>payload.effectiveDate)throw Error('work_assignment_basis_conflict');
        const successorRows=await tx`SELECT v.* FROM academy.record_versions v WHERE v.owner_id=${command.ownerId} AND v.student_id=${command.studentId} AND v.payload->>'kind'='learning_work_assignment'`;
        assertAssignmentNotReplaced(versionFrom(assignmentRow) as AssignmentVersion,successorRows.map((v:VersionRow)=>versionFrom(v) as AssignmentVersion),payload.effectiveDate);
        if(!assignment.items.some(item=>item.assignedItemId===payload.assignedItemId))throw Error('work_item_binding_conflict');
        const [attemptRow]=await tx`SELECT v.* FROM academy.record_heads h JOIN academy.record_versions v USING(owner_id,student_id,entity_id,sequence)
          WHERE h.owner_id=${command.ownerId} AND h.student_id=${command.studentId} AND h.entity_id=${payload.attemptEntityId} AND v.revision_id=${payload.attemptRevisionId}`;
        const attempt=attemptRow?versionFrom(attemptRow).payload:null;
        if(attempt?.kind!=='learning_work_attempt'||attempt.assignmentRevisionId!==payload.assignmentRevisionId)throw Error('work_attempt_basis_conflict');
        const entityId='teacher-clinic-'+digest({assignmentRevisionId:payload.assignmentRevisionId,attemptEntityId:payload.attemptEntityId,assignedItemId:payload.assignedItemId});
        if(command.entityId!==entityId)throw Error('clinic_target_identity_conflict');
      }
      let catalogRevisionId:string|null=null;
      if(command.payload.kind==='source_book_registration'){
        await tx`SELECT pg_advisory_xact_lock(hashtextextended(${canonicalJson([command.ownerId,'catalog-write'])},0))`;
        const [catalog]=await tx`SELECT revision_id,payload FROM academy.catalog_versions WHERE owner_id=${command.ownerId} AND node_id=${command.payload.catalogNodeId} ORDER BY sequence DESC LIMIT 1`;
        if(!catalog||catalog.payload.kind!=='book_edition'||canonicalJson(catalog.payload.sourceKey)!==canonicalJson(command.payload.sourceBook))throw Error('catalog_reference_conflict');
        catalogRevisionId=catalog.revision_id;
      }
      if(command.payload.kind==='source_audit'){
        const audit=createAcademySourceAudit(command.payload.acquisition);
        if(Date.parse(audit.observedAt)!==Date.parse(command.sourceObservedAt))throw Error('source_observation_clock_conflict');
        if(audit.entities.some(entity=>'studentKey' in entity.sourceIdentity&&entity.sourceIdentity.studentKey!==student.source_key))throw Error('source_student_binding_conflict');
        const snapshot=readInputRecord(command.payload.acquisition);
        if(snapshot.family==='item_metadata')throw Error('shared_metadata_requires_catalog_partition');
        const targetKeys:string[]=[];
        for(const field of ['records','dailyResults','dayRecords'])if(Array.isArray(snapshot[field]))for(const row of snapshot[field]){const target=readInputRecord(row);if(typeof target.studentKey==='string')targetKeys.push(target.studentKey);}
        if(snapshot.studentCourseScope){const scope=readInputRecord(snapshot.studentCourseScope);if(typeof scope.studentKey==='string')targetKeys.push(scope.studentKey);}
        if(targetKeys.some(key=>key!==student.source_key))throw Error('source_student_binding_conflict');
      }
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${canonicalJson([command.ownerId,command.studentId,command.entityId])},0))`;
      const [head]=await tx`SELECT v.* FROM academy.record_heads h JOIN academy.record_versions v USING(owner_id,student_id,entity_id,sequence)
        WHERE h.owner_id=${command.ownerId} AND h.student_id=${command.studentId} AND h.entity_id=${command.entityId}`;
      const prior=head?versionFrom(head):null;
      if(command.expectedRevisionId!==(prior?.revisionId??null))throw Error('stale_base');
      if(prior&&(prior.payload.kind!==command.payload.kind||Date.parse(prior.sourceObservedAt)>Date.parse(command.sourceObservedAt)||Date.parse(prior.recordedAt)>Date.parse(recordedAt)))throw Error('invalid_revision_transition');
      if(prior?.payload.kind==='teacher_observation'&&command.payload.kind==='teacher_observation'&&canonicalJson(prior.payload.occurrence)!==canonicalJson(command.payload.occurrence))throw Error('observation_identity_changed');
      if(prior?.payload.kind==='teacher_observation_request'&&command.payload.kind==='teacher_observation_request'){
        for(const field of ['sourceStudent','requestId','expectedRevisionId','observation'] as const)if(canonicalJson(prior.payload[field])!==canonicalJson(command.payload[field]))throw Error('observation_original_request_changed');
        if(prior.payload.resolution!=='pending'||command.payload.resolution!=='rejected')throw Error('invalid_observation_request_transition');
      }
      if(prior?.payload.kind==='learning_work_assignment'&&command.payload.kind==='learning_work_assignment'){
        for(const field of ['sourceStudent','sourceCourse','sourceUserCourse','sourceBook','assignmentKey','activity'] as const)
          if(canonicalJson(prior.payload[field])!==canonicalJson(command.payload[field]))throw Error('work_identity_changed');
        if(prior.payload.replaces?.state==='known'&&(command.payload.replaces?.state!=='known'||prior.payload.replaces.value.assignmentRevisionId!==command.payload.replaces.value.assignmentRevisionId))throw Error('work_replacement_identity_changed');
      }
      if(prior?.payload.kind==='learning_work_attempt'&&command.payload.kind==='learning_work_attempt'){
        for(const field of ['sourceStudent','attemptKey','assignmentRevisionId','paperIssuanceKey','previousAttemptRevisionId'] as const)
          if(canonicalJson(prior.payload[field])!==canonicalJson(command.payload[field]))throw Error('work_identity_changed');
      }
      if(prior?.payload.kind==='teacher_clinic_request'&&command.payload.kind==='teacher_clinic_request'){
        for(const field of ['sourceStudent','requestId','expectedRevisionId','decision'] as const)if(canonicalJson(prior.payload[field])!==canonicalJson(command.payload[field]))throw Error('clinic_original_request_changed');
        if(prior.payload.resolution!=='pending'||command.payload.resolution!=='rejected')throw Error('invalid_clinic_request_transition');
      }
      if(prior){
        for(const field of ['sourceStudent','sourceCourse','sourceBook','sourceUserCourse','sourceMinorUnit','activity','scope','teacherKey'] as const){
          const previous=prior.payload as unknown as Record<string,unknown>,next=command.payload as unknown as Record<string,unknown>;
          if(['source_course_inventory','source_prestudy_snapshot','teacher_preparation_assignment','teacher_activity_revision'].includes(command.payload.kind)&&(field in previous||field in next)&&canonicalJson(previous[field])!==canonicalJson(next[field]))throw Error('preparation_identity_changed');
        }
      }
      let result:WriteAcknowledgement;
      // A fresh teacher observation intent needs its own actor/request/predecessor even when text is identical.
      if(command.payload.kind!=='teacher_observation'&&command.payload.kind!=='teacher_clinic_revision'&&prior?.contentDigest===contentDigest){
        await tx`UPDATE academy.record_heads SET last_verified_at=${command.sourceObservedAt} WHERE owner_id=${command.ownerId} AND student_id=${command.studentId} AND entity_id=${command.entityId}`;
        result={status:'unchanged',revisionId:prior.revisionId,sequence:prior.sequence,recordedAt:prior.recordedAt,contentDigest,officialSaved:false,parentSent:false};
      }else{
        const body:Omit<RecordVersion,'integrityDigest'>={ownerId:command.ownerId,studentId:command.studentId,entityId:command.entityId,sequence:(prior?.sequence??0)+1,
          revisionId:stableId('revision','academy-v1',command.ownerId,command.actorId,command.idempotencyKey),previousRevisionId:prior?.revisionId??null,previousDigest:prior?.integrityDigest??null,
          payload:command.payload,contentDigest,sourceObservedAt:new Date(command.sourceObservedAt).toISOString(),recordedAt:new Date(recordedAt).toISOString(),actorId:command.actorId,idempotencyKey:command.idempotencyKey,commandDigest};
        const integrityDigest=digest(body);
        await tx`INSERT INTO academy.record_versions(owner_id,student_id,entity_id,sequence,revision_id,previous_revision_id,previous_digest,payload,content_digest,integrity_digest,source_observed_at,recorded_at,actor_id,idempotency_key,command_digest)
          VALUES(${body.ownerId},${body.studentId},${body.entityId},${body.sequence},${body.revisionId},${body.previousRevisionId},${body.previousDigest},${canonicalJson(body.payload)}::text::jsonb,${body.contentDigest},${integrityDigest},${body.sourceObservedAt},${body.recordedAt},${body.actorId},${body.idempotencyKey},${body.commandDigest})`;
        if(catalogRevisionId)await tx`INSERT INTO academy.source_catalog_links(owner_id,student_id,source_revision_id,catalog_revision_id,relation_type) VALUES(${body.ownerId},${body.studentId},${body.revisionId},${catalogRevisionId},'source_book_reference')`;
        await tx`INSERT INTO academy.record_heads(owner_id,student_id,entity_id,revision_id,sequence,content_digest,last_verified_at)
          VALUES(${body.ownerId},${body.studentId},${body.entityId},${body.revisionId},${body.sequence},${contentDigest},${command.sourceObservedAt})
          ON CONFLICT(owner_id,student_id,entity_id) DO UPDATE SET revision_id=EXCLUDED.revision_id,sequence=EXCLUDED.sequence,content_digest=EXCLUDED.content_digest,last_verified_at=EXCLUDED.last_verified_at`;
        result={status:'saved',revisionId:body.revisionId,sequence:body.sequence,recordedAt:body.recordedAt,contentDigest,officialSaved:false,parentSent:false};
      }
      await tx`INSERT INTO academy.command_outcomes(owner_id,actor_id,idempotency_key,command_digest,acknowledgement) VALUES(${command.ownerId},${command.actorId},${command.idempotencyKey},${commandDigest},${canonicalJson(result)}::text::jsonb)`;
      await (this.writerHook??this.qualification?.afterDependencyWrite)?.('append',command.ownerId,command.idempotencyKey,tx);
      return result;
    });
    const [committed]=await this.db`SELECT * FROM academy.record_versions WHERE owner_id=${command.ownerId} AND student_id=${command.studentId} AND revision_id=${acknowledgement.revisionId}`;
    if(!committed||versionFrom(committed).contentDigest!==acknowledgement.contentDigest)throw Error('committed_outcome_uncertain');
    return acknowledgement;
  }
  async clinicRequest(ownerId:string,studentId:string,actorId:string,requestId:string):Promise<RecordVersion|null>{
    const entityId='clinic-request-'+digest({actorId,idempotencyKey:requestId});
    const rows=await this.db`SELECT v.* FROM academy.record_heads h JOIN academy.record_versions v USING(owner_id,student_id,entity_id,sequence)
      WHERE h.owner_id=${ownerId} AND h.student_id=${studentId} AND h.entity_id=${entityId} AND v.actor_id=${actorId}`;
    if(!rows.length)return null;const record=versionFrom(rows[0]);if(record.payload.kind!=='teacher_clinic_request'||record.payload.requestId!==requestId)throw Error('clinic_request_identity_conflict');return record;
  }
  async clinicResult(ownerId:string,studentId:string,actorId:string,requestId:string):Promise<RecordVersion|null>{
    const rows=await this.db`SELECT v.* FROM academy.command_outcomes o JOIN academy.record_versions v
      ON v.owner_id=o.owner_id AND v.actor_id=o.actor_id AND v.revision_id=o.acknowledgement->>'revisionId'
        AND v.idempotency_key=o.idempotency_key AND v.command_digest=o.command_digest
      WHERE o.owner_id=${ownerId} AND o.actor_id=${actorId} AND o.idempotency_key=${requestId} AND v.student_id=${studentId}`;
    if(rows.length!==1)return null;const record=versionFrom(rows[0]);return record.payload.kind==='teacher_clinic_revision'?record:null;
  }
  async observationResult(ownerId:string,studentId:string,actorId:string,requestId:string):Promise<RecordVersion|null>{
    const rows=await this.db`SELECT v.* FROM academy.command_outcomes o JOIN academy.record_versions v
      ON v.owner_id=o.owner_id AND v.actor_id=o.actor_id AND v.revision_id=o.acknowledgement->>'revisionId'
        AND v.idempotency_key=o.idempotency_key AND v.command_digest=o.command_digest
      WHERE o.owner_id=${ownerId} AND o.actor_id=${actorId} AND o.idempotency_key=${requestId} AND v.student_id=${studentId}`;
    if(rows.length!==1)return null;
    const record=versionFrom(rows[0]);return record.payload.kind==='teacher_observation'?record:null;
  }
  async observationRequest(ownerId:string,studentId:string,actorId:string,requestId:string):Promise<RecordVersion|null>{
    const entityId='observation-request-'+digest({actorId,idempotencyKey:requestId});
    const rows=await this.db`SELECT v.* FROM academy.record_heads h JOIN academy.record_versions v USING(owner_id,student_id,entity_id,sequence)
      WHERE h.owner_id=${ownerId} AND h.student_id=${studentId} AND h.entity_id=${entityId} AND v.actor_id=${actorId}`;
    if(!rows.length)return null;const record=versionFrom(rows[0]);if(record.payload.kind!=='teacher_observation_request'||record.payload.requestId!==requestId)throw Error('observation_request_identity_conflict');return record;
  }
  async history(ownerId:string,studentId:string,entityId:string,afterSequence=0,limit=200):Promise<RecordVersion[]> {
    if(!Number.isSafeInteger(afterSequence)||afterSequence<0||!Number.isSafeInteger(limit)||limit<1||limit>1000)throw Error('invalid_history_range');
    const rows=await this.db`SELECT * FROM academy.record_versions WHERE owner_id=${ownerId} AND student_id=${studentId} AND entity_id=${entityId} AND sequence>${afterSequence} ORDER BY sequence LIMIT ${limit}`;
    return rows.map((row:VersionRow)=>versionFrom(row));
  }
  async current(ownerId:string,studentId:string):Promise<(RecordVersion&{lastVerifiedAt:string})[]> {
    const rows=await this.db`SELECT v.*,h.last_verified_at FROM academy.record_heads h JOIN academy.record_versions v USING(owner_id,student_id,entity_id,sequence) WHERE h.owner_id=${ownerId} AND h.student_id=${studentId} ORDER BY h.entity_id`;
    return rows.map((row:VersionRow&{last_verified_at:Date|string})=>({...versionFrom(row),lastVerifiedAt:new Date(row.last_verified_at).toISOString()}));
  }
  async preparationRevisions(ownerId:string,studentId:string,date:string):Promise<RecordVersion[]> {
    requireText(ownerId,'owner');requireText(studentId,'student');assertPreparationDate(date);
    const rows=await this.db`SELECT * FROM academy.record_versions WHERE owner_id=${ownerId} AND student_id=${studentId}
      AND ((payload->>'kind' IN ('teacher_activity_revision','teacher_preparation_assignment') AND payload->>'effectiveDate'<=${date})
        OR payload->>'kind' IN ('learning_work_assignment','learning_work_attempt','teacher_clinic_revision'))
      ORDER BY entity_id,sequence LIMIT 10001`;
    if(rows.length>10000)throw Error('preparation_history_scope_too_large');
    return rows.map((row:VersionRow)=>versionFrom(row));
  }
  async pinnedCatalog(ownerId:string,refs:readonly {nodeId:string;revisionId:string}[]){
    if(refs.length>10000)throw Error('catalog_scope_too_large');
    const selected=[...new Map(refs.map(ref=>[ref.revisionId,ref])).values()];
    if(!selected.length)return [];
    const rows=await this.db`SELECT node_id,revision_id,payload,content_digest FROM academy.catalog_versions WHERE owner_id=${ownerId} AND revision_id IN ${this.db(selected.map(ref=>ref.revisionId))}`;
    return selected.map(ref=>{const row=rows.find((row:{node_id:string;revision_id:string})=>row.node_id===ref.nodeId&&row.revision_id===ref.revisionId);if(!row||digest(row.payload)!==row.content_digest)throw Error('work_catalog_binding_conflict');return {node:row.payload as CatalogNode,revisionId:row.revision_id as string};});
  }
  /** Commit the exact validated acquisition as one unit; never leave a partially replaced source. */
  async applySourceRefresh(cohort:NormalizedCohort,actorId:string,requestId:string){cohort=immutableCopy(cohort);
    canonicalJson(cohort);requireText(actorId,'source actor');
    const key=sourceRequestId(requestId);let callbackFailed=false;
    try{await this.db.begin(async tx=>{try{
      await tx`SET TRANSACTION ISOLATION LEVEL READ COMMITTED`;
      await lockApprovalDependencies(tx,cohort.ownerId);
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${canonicalJson([cohort.ownerId,actorId,'source-request'])},0))`;
      const [row]=await tx`SELECT acknowledgement FROM academy.command_outcomes WHERE owner_id=${cohort.ownerId} AND actor_id=${actorId} AND idempotency_key=${key}`;
      const intent=row?.acknowledgement as SourceRequestReceipt|undefined;
      if(!intent||intent.kind!=='source_refresh_request'||intent.requestId!==requestId||intent.ownerId!==cohort.ownerId||intent.actorId!==actorId||intent.status!=='pending'||intent.studentId!==null&&(cohort.students.length!==1||cohort.students[0]!.registration.id!==intent.studentId))throw Error('source_request_binding_conflict');
      const scoped=new PostgresAcademyStore(tx as unknown as SQL,sourceTransaction);
      for(const studentId of cohort.students.map(s=>s.registration.id).sort())await tx`SELECT pg_advisory_xact_lock(hashtextextended(${canonicalJson(['student-records',cohort.ownerId,studentId])},0))`;
      for(const student of cohort.students){
        const heads=await scoped.current(cohort.ownerId,student.registration.id);
        if(heads.some(head=>student.books.some(book=>book.entityId===head.entityId)&&Date.parse(head.lastVerifiedAt)>Date.parse(student.observedAt)))throw Error('stale_source_capture');
      }
      // Shared catalog freshness is owner-wide, not the selected student's local clock.
      // Take the same catalog lock as saveCatalog before observing any competing source head.
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${canonicalJson([cohort.ownerId,'catalog-write'])},0))`;
      for(const node of cohort.catalog){
        const clocks=cohort.students.filter(student=>student.books.some(book=>book.payload.catalogNodeId===node.id)).map(student=>Date.parse(student.observedAt));
        if(clocks.length===0)throw Error('source_catalog_binding_conflict');
        const [latest]=await tx`SELECT max(h.last_verified_at) AS observed_at FROM academy.record_heads h JOIN academy.record_versions v USING(owner_id,student_id,entity_id,sequence)
          WHERE h.owner_id=${cohort.ownerId} AND v.payload->>'kind'='source_book_registration' AND v.payload->>'catalogNodeId'=${node.id}`;
        if(latest?.observed_at&&new Date(latest.observed_at).getTime()>Math.min(...clocks))throw Error('stale_shared_catalog_capture');
      }
      for(const node of cohort.catalog)await scoped.saveCatalog(cohort.ownerId,node);
      const commands:NonNullable<SourceRequestReceipt['commands']>=[];
      for(const student of cohort.students){
        const heads=await scoped.current(cohort.ownerId,student.registration.id);
        for(const book of student.books){
          const idempotencyKey=requestId+':'+book.entityId;
          const outcome=await scoped.append({ownerId:cohort.ownerId,studentId:student.registration.id,entityId:book.entityId,actorId,
            idempotencyKey,expectedRevisionId:heads.find(h=>h.entityId===book.entityId)?.revisionId??null,sourceObservedAt:student.observedAt,payload:book.payload});
          commands.push({studentId:student.registration.id,entityId:book.entityId,idempotencyKey,outcome});
        }
      }
      const receipt:SourceRequestReceipt={...intent,status:intent.areas?'pending':'observed',captureDigest:cohort.captureDigest,studentCount:cohort.students.length,bookCount:commands.length,
        changedVersions:commands.filter(c=>c.outcome.status==='saved').length,unchangedVersions:commands.filter(c=>c.outcome.status==='unchanged').length,commands};
      await tx`UPDATE academy.command_outcomes SET acknowledgement=${canonicalJson(receipt)}::text::jsonb WHERE owner_id=${cohort.ownerId} AND actor_id=${actorId} AND idempotency_key=${key}`;
    }catch(error){callbackFailed=true;throw error;}});
    return await this.sourceRequestResult(cohort.ownerId,actorId,requestId);
    }catch(error){if(callbackFailed)throw error;return {status:'pending' as const,ownerId:cohort.ownerId,actorId,requestId,cacheRetained:true,replacementAcquisitionAllowed:false};}
  }
  async admitSourceRequest(ownerId:string,actorId:string,studentId:string|null,requestId:string,sync?:{date:string;tasks:SourceAreaTask[]}){
    if(sync){assertPreparationDate(sync.date);if(!sync.tasks.length||sync.tasks.length>256||new Set(sync.tasks.map(task=>task.id)).size!==sync.tasks.length)throw Error('invalid_source_area_plan');sync.tasks.forEach(validateSourceAreaTask);}
    const key=sourceRequestId(requestId),commandDigest=digest({ownerId,actorId,studentId,requestId,...(sync?{date:sync.date}:{})});
    return this.db.begin(async tx=>{
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${canonicalJson([ownerId,actorId,'source-request'])},0))`;
      const [existing]=await tx`SELECT command_digest,acknowledgement FROM academy.command_outcomes WHERE owner_id=${ownerId} AND actor_id=${actorId} AND idempotency_key=${key}`;
      if(existing){if(existing.command_digest!==commandDigest)throw Error('source_request_reuse');return {created:false,receipt:existing.acknowledgement as SourceRequestReceipt};}
      const [pending]=await tx`SELECT acknowledgement FROM academy.command_outcomes WHERE owner_id=${ownerId} AND actor_id=${actorId} AND acknowledgement->>'kind'='source_refresh_request' AND acknowledgement->>'status'='pending' ORDER BY idempotency_key LIMIT 1`;
      if(pending)return {created:false,receipt:pending.acknowledgement as SourceRequestReceipt};
      const receipt:SourceRequestReceipt={schemaVersion:1,kind:'source_refresh_request',ownerId,actorId,requestId,studentId,status:'pending',...(sync?{date:sync.date,areas:sync.tasks.map(task=>({...task,family:task.request.family,status:'pending' as const}))}:{})};
      await tx`INSERT INTO academy.command_outcomes(owner_id,actor_id,idempotency_key,command_digest,acknowledgement) VALUES(${ownerId},${actorId},${key},${commandDigest},${canonicalJson(receipt)}::text::jsonb)`;
      return {created:true,receipt};
    });
  }
  async finishSourceRequest(ownerId:string,actorId:string,requestId:string,status:'blocked'|'failed',reason:string){
    const key=sourceRequestId(requestId);if(!/^[a-z][a-z0-9_]{1,100}$/.test(reason))throw Error('source_reason_required');
    await this.db.begin(async tx=>{
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${canonicalJson([ownerId,actorId,'source-request'])},0))`;
      const [row]=await tx`SELECT acknowledgement FROM academy.command_outcomes WHERE owner_id=${ownerId} AND actor_id=${actorId} AND idempotency_key=${key}`;
      if(!row||row.acknowledgement.kind!=='source_refresh_request'||row.acknowledgement.status!=='pending')throw Error('source_request_transition_conflict');
      const receipt=row.acknowledgement as SourceRequestReceipt;
      const areas=receipt.areas?.map(area=>area.status==='pending'?{...area,status:'blocked' as const,reason}:area);
      await tx`UPDATE academy.command_outcomes SET acknowledgement=${canonicalJson({...receipt,status,reason,...(areas?{areas}:{})})}::text::jsonb WHERE owner_id=${ownerId} AND actor_id=${actorId} AND idempotency_key=${key}`;
    });
  }
  async pendingSourceRequest(ownerId:string,actorId:string){
    const [row]=await this.db`SELECT acknowledgement FROM academy.command_outcomes WHERE owner_id=${ownerId} AND actor_id=${actorId} AND acknowledgement->>'kind'='source_refresh_request' AND acknowledgement->>'status'='pending' ORDER BY idempotency_key LIMIT 1`;
    return row?this.sourceRequestResult(ownerId,actorId,row.acknowledgement.requestId):null;
  }
  /** Bounded actor-owned discovery, request-key order (never falsely labelled newest-first). */
  async sourceRequestHistory(ownerId:string,actorId:string,cursor:string|null=null){
    requireText(ownerId,'source owner');requireText(actorId,'source actor');
    const after=cursor===null?'':sourceRequestId(cursor);
    const selected=await this.db`SELECT acknowledgement FROM academy.command_outcomes WHERE owner_id=${ownerId} AND actor_id=${actorId}
      AND acknowledgement->>'kind'='source_refresh_request' AND idempotency_key>${after} ORDER BY idempotency_key LIMIT 21`;
    const rows=[];
    for(const row of selected.slice(0,20))rows.push(await this.sourceRequestResult(ownerId,actorId,row.acknowledgement.requestId));
    return {schemaVersion:1 as const,kind:'source_refresh_history' as const,ownerId,actorId,order:'request_id_not_event_time' as const,rows,nextCursor:selected.length>20?rows.at(-1)!.requestId:null};
  }
  async sourceRequestResult(ownerId:string,actorId:string,requestId:string){
    const key=sourceRequestId(requestId);
    const [row]=await this.db`SELECT acknowledgement FROM academy.command_outcomes WHERE owner_id=${ownerId} AND actor_id=${actorId} AND idempotency_key=${key}`;
    if(!row)return {status:'not_found' as const,ownerId,actorId,requestId,cacheRetained:true,replacementAcquisitionAllowed:false};
    const receipt=row.acknowledgement as SourceRequestReceipt;
    if(receipt.kind!=='source_refresh_request'||receipt.ownerId!==ownerId||receipt.actorId!==actorId||receipt.requestId!==requestId)throw Error('source_request_binding_conflict');
    if(receipt.status==='observed'||receipt.status==='partial'||receipt.commands){
      if(!Array.isArray(receipt.commands)||receipt.bookCount!==receipt.commands.length)throw Error('source_batch_readback_uncertain');
      const commands=[...receipt.commands,...(receipt.areas??[]).flatMap(area=>area.commands??[])];
      for(const command of commands){
        const [stored]=await this.db`SELECT v.* FROM academy.command_outcomes o JOIN academy.record_versions v ON v.owner_id=o.owner_id AND v.revision_id=o.acknowledgement->>'revisionId' WHERE o.owner_id=${ownerId} AND o.actor_id=${actorId} AND o.idempotency_key=${command.idempotencyKey} AND v.student_id=${command.studentId} AND v.entity_id=${command.entityId}`;
        if(!stored||versionFrom(stored).revisionId!==command.outcome.revisionId||versionFrom(stored).contentDigest!==command.outcome.contentDigest)throw Error('source_batch_readback_uncertain');
      }
    }
    return {...receipt,cacheRetained:true,academyEffect:'read_only',officialSaved:false,parentSent:false,replacementAcquisitionAllowed:receipt.status!=='pending'};
  }
  /** An area's evidence and acknowledgement commit together; other areas and teacher records are untouched. */
  async applySourceArea(ownerId:string,actorId:string,requestId:string,taskId:string,outcome:{status:'observed';data:unknown}|{status:'blocked'|'failed';reason:string}){outcome=immutableCopy(outcome);
    const key=sourceRequestId(requestId);let callbackFailed=false;
    try{
      await this.db.begin(async tx=>{try{
        await tx`SET TRANSACTION ISOLATION LEVEL READ COMMITTED`;
        await lockApprovalDependencies(tx,ownerId);
        await tx`SELECT pg_advisory_xact_lock(hashtextextended(${canonicalJson([ownerId,actorId,'source-request'])},0))`;
        const [row]=await tx`SELECT acknowledgement FROM academy.command_outcomes WHERE owner_id=${ownerId} AND actor_id=${actorId} AND idempotency_key=${key}`;
        const receipt=row?.acknowledgement as SourceRequestReceipt|undefined,area=receipt?.areas?.find(task=>task.id===taskId);
        if(!receipt||receipt.status!=='pending'||!area||area.status!=='pending'||!receipt.commands)throw Error('source_area_transition_conflict');
        const scoped=new PostgresAcademyStore(tx as unknown as SQL,sourceTransaction);
        let next:SourceAreaReceipt;
        if(outcome.status==='observed'){
          const {id,studentId,teacherKey,collegeKey,request}=area;
          await tx`SELECT pg_advisory_xact_lock(hashtextextended(${canonicalJson(['student-records',ownerId,studentId])},0))`;
          const heads=await scoped.current(ownerId,studentId),commands:NonNullable<SourceAreaReceipt['commands']>=[];
          const normalized=normalizeSourceArea(ownerId,{id,studentId,teacherKey,collegeKey,request},await scoped.students(ownerId),outcome.data,heads);
          // The student lock also serializes scope clocks across actors and changing source row identities.
          const [newer]=await tx`SELECT 1 FROM academy.command_outcomes o
            CROSS JOIN LATERAL jsonb_array_elements(COALESCE(o.acknowledgement->'areas','[]'::jsonb)) a
            WHERE o.owner_id=${ownerId} AND o.acknowledgement->>'kind'='source_refresh_request'
              AND a->>'id'=${id} AND a->>'studentId'=${studentId} AND a->>'status'='observed'
              AND (a->>'observedAt')::timestamptz>${normalized.observedAt}::timestamptz LIMIT 1`;
          if(newer)throw Error('stale_source_capture');
          for(const record of normalized.records){
            if(record.studentId!==studentId)throw Error('source_student_binding_conflict');
            const before=heads.find(head=>head.entityId===record.entityId);
            if(before&&Date.parse(before.lastVerifiedAt)>Date.parse(record.sourceObservedAt))throw Error('stale_source_capture');
            const idempotencyKey=requestId+':'+taskId+':'+record.entityId;
            const saved=await scoped.append({ownerId,actorId,studentId,entityId:record.entityId,idempotencyKey,expectedRevisionId:before?.revisionId??null,sourceObservedAt:record.sourceObservedAt,payload:record.payload});
            commands.push({studentId,entityId:record.entityId,idempotencyKey,outcome:saved});
          }
          next={...area,status:'observed',transport:normalized.transport,observedAt:normalized.observedAt,captureDigest:normalized.captureDigest,commands};
        }else{
          if(!/^[a-z][a-z0-9_]{1,100}$/.test(outcome.reason))throw Error('source_reason_required');
          next={...area,status:outcome.status,reason:outcome.reason};
        }
        const updated={...receipt,areas:receipt.areas!.map(task=>task.id===taskId?next:task)};
        await tx`UPDATE academy.command_outcomes SET acknowledgement=${canonicalJson(updated)}::text::jsonb WHERE owner_id=${ownerId} AND actor_id=${actorId} AND idempotency_key=${key}`;
      }catch(error){callbackFailed=true;throw error;}});
      return {status:'applied' as const,result:await this.sourceRequestResult(ownerId,actorId,requestId)};
    }catch(error){if(callbackFailed)throw error;return {status:'pending' as const};}
  }
  async finishSourceAreas(ownerId:string,actorId:string,requestId:string){
    const key=sourceRequestId(requestId);
    await this.db.begin(async tx=>{
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${canonicalJson([ownerId,actorId,'source-request'])},0))`;
      const [row]=await tx`SELECT acknowledgement FROM academy.command_outcomes WHERE owner_id=${ownerId} AND actor_id=${actorId} AND idempotency_key=${key}`;
      const receipt=row?.acknowledgement as SourceRequestReceipt|undefined;
      if(!receipt||receipt.status!=='pending'||!receipt.areas?.length||receipt.areas.some(area=>area.status==='pending'))throw Error('source_area_transition_conflict');
      const status=receipt.areas.every(area=>area.status==='observed')?'observed':'partial';
      await tx`UPDATE academy.command_outcomes SET acknowledgement=${canonicalJson({...receipt,status})}::text::jsonb WHERE owner_id=${ownerId} AND actor_id=${actorId} AND idempotency_key=${key}`;
    });
    return this.sourceRequestResult(ownerId,actorId,requestId);
  }
  async saveCatalog(ownerId:string,node:CatalogNode):Promise<{revisionId:string;sequence:number;contentDigest:string}> {node=immutableCopy(node);
    requireText(ownerId,'catalog owner');canonicalJson(node);
    return this.transact(async tx=>{
      await lockApprovalDependencies(tx,ownerId);
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${canonicalJson([ownerId,'catalog-write'])},0))`;
      const rows=await tx`SELECT DISTINCT ON(node_id) node_id,payload,sequence,revision_id,content_digest FROM academy.catalog_versions WHERE owner_id=${ownerId} ORDER BY node_id,sequence DESC`;
      const nodes=rows.map((row:{payload:CatalogNode})=>row.payload).filter((existing:CatalogNode)=>existing.id!==node.id);
      validateHierarchy([...nodes,node]);
      if(nodes.some((existing:CatalogNode)=>canonicalJson(existing.sourceKey)===canonicalJson(node.sourceKey)))throw Error('duplicate_catalog_source_identity');
      const prior=rows.find((row:{node_id:string})=>row.node_id===node.id);
      if(prior&&(prior.payload.kind!==node.kind||canonicalJson(prior.payload.sourceKey)!==canonicalJson(node.sourceKey)))throw Error('catalog_identity_changed');
      const contentDigest=digest(node);
      if(prior?.content_digest===contentDigest)return {revisionId:prior.revision_id,sequence:Number(prior.sequence),contentDigest};
      const sequence=Number(prior?.sequence??0)+1;
      const revisionId=stableId('catalog_revision','academy-v1',ownerId,node.id,String(sequence),contentDigest);
      await tx`INSERT INTO academy.catalog_versions(owner_id,node_id,sequence,revision_id,payload,content_digest) VALUES(${ownerId},${node.id},${sequence},${revisionId},${canonicalJson(node)}::text::jsonb,${contentDigest})`;
      await (this.writerHook??this.qualification?.afterDependencyWrite)?.('saveCatalog',ownerId,node.id,tx);
      return {revisionId,sequence,contentDigest};
    });
  }
  async catalog(ownerId:string):Promise<CatalogNode[]> {
    const rows=await this.db`SELECT DISTINCT ON(node_id) payload,content_digest FROM academy.catalog_versions WHERE owner_id=${ownerId} ORDER BY node_id,sequence DESC`;
    const nodes=rows.map((row:{payload:CatalogNode;content_digest:string})=>{if(digest(row.payload)!==row.content_digest)throw Error('catalog_integrity');return row.payload;});
    validateHierarchy(nodes);return nodes;
  }
  /** Current head pin per catalog node, digest verified, node-id order.
   * No partial pins: any integrity failure refuses the whole result. */
  async currentCatalogPins(ownerId:string):Promise<CurrentCatalogPin[]>{
    requireText(ownerId,'owner');
    const rows=await this.db`SELECT DISTINCT ON(node_id) node_id,sequence,revision_id,payload,content_digest FROM academy.catalog_versions WHERE owner_id=${ownerId} ORDER BY node_id,sequence DESC`;
    const latest=new Map<string,{sequence:number;revisionId:string;node:CatalogNode;contentDigest:string}>();
    for(const row of rows as {node_id:string;sequence:number|string;revision_id:string;payload:CatalogNode;content_digest:string}[]){
      const prior=latest.get(row.node_id);
      if(!prior||Number(row.sequence)>prior.sequence)latest.set(row.node_id,{sequence:Number(row.sequence),revisionId:row.revision_id,node:row.payload,contentDigest:row.content_digest});
    }
    return [...latest.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([,pin])=>{if(digest(pin.node)!==pin.contentDigest)throw Error('catalog_integrity');return {node:pin.node,revisionId:pin.revisionId,contentDigest:pin.contentDigest};});
  }
  /** Write-side output gate (never in the frozen read view). The shared
   * owner gate and then the exact read key are held across preparation and
   * the terminal audit write in one READ COMMITTED transaction, so the
   * prepared value is only handed back after a known COMMIT. A duplicate
   * admission refuses lookup-only; an ambiguous COMMIT is never replayed. */
  async commitReadOutput<T>(request:ReadAdmission,prepare:(view:TeacherPrerequisiteReadStore)=>Promise<ReadOutputDecision<T>>,selectRefusal?:ReadOutputRefusalSelector):Promise<CommittedReadOutput<T>>{request=immutableCopy(request);
    if(this.transactionScope)throw Error('write_in_snapshot');
    validateReadAdmission(request);
    if(typeof prepare!=='function')throw Error('output_prepare_required');
    const base={requestId:request.requestId,outputAdmissionId:request.requestId,emissionDisposition:'NOT_ATTEMPTED' as const};
    const finalRefusal=async(view:TeacherPrerequisiteReadStore,code:string)=>{
      const selected=selectRefusal?await selectRefusal(view,code):{kind:'OUTPUT_REFUSED' as const,code};
      if(!selected||selected.kind!=='OUTPUT_REFUSED')throw Error('invalid_output_refusal');
      requireText(selected.code,'read refusal');return selected.code;
    };
    let terminalWritten=false;
    try{
      const result=await this.db.begin(async (tx):Promise<CommittedReadOutput<T>>=>{
        await tx`SET TRANSACTION ISOLATION LEVEL READ COMMITTED`;
        await lockSharedOutputGate(tx as unknown as SQL,request.ownerId);
        const q=this.qualification;
        const backend=q?Number((await tx`SELECT pg_backend_pid() AS pid`)[0]!.pid):0;
        if(q)await q.gate(request.requestId,'SHARED_OWNER',backend);
        await tx`SELECT pg_advisory_xact_lock(hashtextextended(${canonicalJson([request.ownerId,request.actorId,'read:'+request.requestId])},0))`;
        if(q)await q.gate(request.requestId,'READ_KEY',backend);
        const gate=new NativePrerequisiteStore(tx as unknown as SQL);
        if((await gate.readOccurrenceLookup(request)).status!=='PENDING')throw Error('read_already_terminal_or_unadmitted');
        const scoped=new PostgresAcademyStore(tx as unknown as SQL,sourceTransaction);let active=true;
        const query=<R>(operation:()=>Promise<R>):Promise<R>=>active?operation():Promise.reject(Error('read_snapshot_closed'));
        const gateView=this.frozenReadView(scoped,query);
        let decision:ReadOutputDecision<T>;
        try{decision=await prepare(gateView);
        if(q)await q.gate(request.requestId,'PREPARED',backend);
        if(!decision||typeof decision!=='object'||decision.kind!=='OUTPUT_READY'&&decision.kind!=='OUTPUT_REFUSED')throw Error('invalid_output_decision');
        if(decision.kind==='OUTPUT_REFUSED'){
          const refusalCode=await finalRefusal(gateView,decision.code);
          await gate.finalizeOutputInGate({request,status:'REFUSED',snapshotDigest:null,refusalCode});terminalWritten=true;
          return {...base,value:null,terminalStatus:'REFUSED' as const};}
        /* SC4: recompute the complete horizon from current state under the
         * shared gate before any output is authorized. Asserted preparatory
         * pins alone never suffice; missing inputs fail closed. */
        let refusalCode:string|null=null;
        try{
          const supplied=normalizeReadHorizon(decision.horizon);
          const binding=await gateView.teacherBindingByActor(request.ownerId,request.actorId);
          if(!binding||binding.payload.state!=='ACTIVE'||binding.payload.assignmentState.state!=='known'||binding.payload.assignmentState.value!=='ACTIVE'||supplied.businessDate<binding.payload.validFrom||binding.payload.validTo!==null&&supplied.businessDate>=binding.payload.validTo)refusalCode='output_rights_refused';
          else{
            const current=await computeReadHorizon(gateView,request.ownerId,request.actorId,supplied.businessDate,supplied.scoreHeads.map(row=>row.attemptRef),supplied.plan);
            if(canonicalJson(current)!==canonicalJson(supplied))refusalCode='horizon_drift';
          }
        }catch(error){refusalCode=error instanceof Error&&error.message==='horizon_evidence_required'?'horizon_evidence_required':'horizon_drift';}
        if(refusalCode!==null){
          refusalCode=await finalRefusal(gateView,refusalCode);
          await gate.finalizeOutputInGate({request,status:'REFUSED',snapshotDigest:null,refusalCode});terminalWritten=true;
          return {...base,value:null,terminalStatus:'REFUSED' as const};}
        }finally{active=false;}
        const prepared=decision.value as {snapshot?:unknown;sourceSnapshot?:unknown}|null;const sourceSnapshot=prepared&&typeof prepared==='object'?(prepared.snapshot??prepared.sourceSnapshot):undefined;const snapshotDigest=sourceSnapshot!==undefined?digest(sourceSnapshot):digest({outputAdmissionId:request.requestId,value:decision.value??null});
        await gate.finalizeOutputInGate({request,status:'COMPLETED',snapshotDigest,refusalCode:null});terminalWritten=true;
        if(q)await q.gate(request.requestId,'TERMINAL',backend);
        return {...base,value:decision.value,terminalStatus:'COMPLETED' as const};
      });
      // Actual driver COMMIT is known here. Owner-facing acknowledgement
      // suppression is not evidence of driver/kernel COMMIT uncertainty.
      this.qualification?.knownCommit(request.requestId,result.terminalStatus);
      if(this.qualification?.suppressAcknowledgement(request.requestId))return {...base,value:null,terminalStatus:'UNKNOWN' as const};
      return result;
    }catch(error){
      if(error instanceof Error&&error.message==='read_already_terminal_or_unadmitted')throw error;
      if(terminalWritten){
        // A failed COMMIT acknowledgement cannot authorize any prepared
        // response, even if a later lookup observes REFUSED or COMPLETED.
        return {...base,value:null,terminalStatus:'UNKNOWN' as const};
      }
      try{
        return await this.db.begin(async(tx):Promise<CommittedReadOutput<T>>=>{
          await tx`SET TRANSACTION ISOLATION LEVEL READ COMMITTED`;
          await lockSharedOutputGate(tx as unknown as SQL,request.ownerId);
          await tx`SELECT pg_advisory_xact_lock(hashtextextended(${canonicalJson([request.ownerId,request.actorId,'read:'+request.requestId])},0))`;
          const gate=new NativePrerequisiteStore(tx as unknown as SQL);
          if((await gate.readOccurrenceLookup(request)).status!=='PENDING')return {...base,value:null,terminalStatus:'UNKNOWN' as const};
          // The failed gate view is closed. Rights and wire bytes must be
          // selected under this cleanup transaction's newly acquired gate.
          const scoped=new PostgresAcademyStore(tx as unknown as SQL,sourceTransaction);let active=true;
          const query=<R>(operation:()=>Promise<R>):Promise<R>=>active?operation():Promise.reject(Error('read_snapshot_closed'));
          const view=this.frozenReadView(scoped,query);
          try{
            const refusalCode=await finalRefusal(view,'output_prepare_failed');
            await gate.finalizeOutputInGate({request,status:'REFUSED',snapshotDigest:null,refusalCode});
            return {...base,value:null,terminalStatus:'REFUSED' as const};
          }finally{active=false;}
        });
      }catch{return {...base,value:null,terminalStatus:'UNKNOWN' as const};}
    }
  }
}

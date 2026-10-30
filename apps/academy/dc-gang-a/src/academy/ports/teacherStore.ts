import type {StudentWorkspaceVersion} from '../ownerWorkspaceStore';
import type {CatalogNode} from '../domain';
import type {AppendCommand,CurrentRecord,PinnedCatalogNode,RecordVersion,StoredStudent,WriteAcknowledgement} from '../contracts/storageRecords';
/** Scoped reads only; no driver, schema migration or generic connection access. */
export interface TeacherReadStore {
  studentWorkspaces?(ownerId:string,studentId:string):Promise<StudentWorkspaceVersion[]>;
  students(ownerId:string):Promise<StoredStudent[]>;
  current(ownerId:string,studentId:string):Promise<CurrentRecord[]>;
  history(ownerId:string,studentId:string,entityId:string,afterSequence?:number,limit?:number):Promise<RecordVersion[]>;
  preparationRevisions(ownerId:string,studentId:string,date:string):Promise<RecordVersion[]>;
  catalog(ownerId:string):Promise<CatalogNode[]>;
  pinnedCatalog(ownerId:string,refs:readonly {nodeId:string;revisionId:string}[]):Promise<PinnedCatalogNode[]>;
  observationRequest(ownerId:string,studentId:string,actorId:string,requestId:string):Promise<RecordVersion|null>;
  observationResult(ownerId:string,studentId:string,actorId:string,requestId:string):Promise<RecordVersion|null>;
  clinicRequest(ownerId:string,studentId:string,actorId:string,requestId:string):Promise<RecordVersion|null>;
  clinicResult(ownerId:string,studentId:string,actorId:string,requestId:string):Promise<RecordVersion|null>;
}
/** Implementations enforce scope, current basis, CAS, original retention and outcome readback atomically. */
export interface TeacherStore extends TeacherReadStore {
  readSnapshot<T>(read:(store:TeacherReadStore)=>Promise<T>):Promise<T>;
  append(command:AppendCommand,recordedAt?:string):Promise<WriteAcknowledgement>;
}


import type {OwnerFamily,NativeScoreEvidence,ScoreEvidenceCommand,OwnerVersion,TeacherBinding,ClassGroupRecord,LessonSessionRecord,TemporalBinding,ActivityScopeLink,StudentRecordPayload,ApprovalVersionPayload,OwnerAppendCommand,StudentRevisionCommand,CreateAssessmentCommand,CreateDraftCommand,CreateProgressCommand,CorrectStudentCommand,IssueApprovalCommand,ApproveWithApprovalCommand,RevokeApprovalCommand,NativeWriteResult,ApprovalIssuance,AdmissionCommand,RequestBinding,FenceCommand,OutcomeLookupResult,ReadAdmission,ReadFinalization,ReadOccurrenceLookup,CommandContext,ObjectRef,ApprovalClosure} from '../contracts/prerequisiteRecords';
export interface TeacherPrerequisiteReadStore extends TeacherReadStore {
 ownerRevision(ownerId:string,family:OwnerFamily,entityKey:string,revisionId:string):Promise<OwnerVersion|null>;
 ownerHistory(ownerId:string,family:OwnerFamily,entityKey:string,afterSequence?:number,limit?:number):Promise<OwnerVersion[]>;
 scoreEvidenceCurrent(ownerId:string,entityKey:string):Promise<OwnerVersion<NativeScoreEvidence>|null>;
 scoreEvidenceForAttempt(ownerId:string,attemptRef:ObjectRef<'DailyTestAttempt'>):Promise<OwnerVersion<NativeScoreEvidence>[]>;
 approvalClosurePreview(context:CommandContext,draftRef:ObjectRef<'DailyRecordDraft'>):Promise<ApprovalClosure>;
 teachers(ownerId:string):Promise<OwnerVersion<TeacherBinding>[]>;
 teacherCurrent(ownerId:string,teacherKey:string):Promise<OwnerVersion<TeacherBinding>|null>;
 teacherBindingByActor(ownerId:string,actorId:string):Promise<OwnerVersion<TeacherBinding>|null>;
 classGroups(ownerId:string):Promise<OwnerVersion<ClassGroupRecord>[]>;
 classCurrent(ownerId:string,classKey:string):Promise<OwnerVersion<ClassGroupRecord>|null>;
 lessons(ownerId:string):Promise<OwnerVersion<LessonSessionRecord>[]>;
 lessonCurrent(ownerId:string,lessonKey:string):Promise<OwnerVersion<LessonSessionRecord>|null>;
 temporalBindings(ownerId:string):Promise<OwnerVersion<TemporalBinding>[]>;
 activityScopes(ownerId:string,filter:{activityKind?:ActivityScopeLink['activityKind'];activityEntityId?:string;lessonKey?:string}):Promise<OwnerVersion<ActivityScopeLink>[]>;
 studentRevisionCurrent(ownerId:string,studentId:string):Promise<OwnerVersion<StudentRecordPayload>|null>;
 studentRevisionHistory(ownerId:string,studentId:string,afterSequence?:number,limit?:number):Promise<OwnerVersion<StudentRecordPayload>[]>;
 approvalCurrent(ownerId:string,approvalId:string):Promise<OwnerVersion<ApprovalVersionPayload>|null>;
 commandOutcomeLookup(request:RequestBinding):Promise<OutcomeLookupResult>;
 readOccurrenceLookup(request:ReadAdmission):Promise<ReadOccurrenceLookup>;
 currentCatalogPins(ownerId:string):Promise<CurrentCatalogPin[]>;
}
export interface TeacherPrerequisiteStore extends TeacherStore,TeacherPrerequisiteReadStore {
 readSnapshot<T>(read:(store:TeacherPrerequisiteReadStore)=>Promise<T>):Promise<T>;
 appendScoreEvidence(command:ScoreEvidenceCommand):Promise<NativeWriteResult>;
 appendTeacher(command:OwnerAppendCommand<TeacherBinding>):Promise<NativeWriteResult>;
 appendClassGroup(command:OwnerAppendCommand<ClassGroupRecord>):Promise<NativeWriteResult>;
 appendLesson(command:OwnerAppendCommand<LessonSessionRecord>):Promise<NativeWriteResult>;
 appendTemporalBinding(command:OwnerAppendCommand<TemporalBinding>):Promise<NativeWriteResult>;
 appendActivityScope(command:OwnerAppendCommand<ActivityScopeLink>):Promise<NativeWriteResult>;
 appendStudentRevision(command:StudentRevisionCommand):Promise<NativeWriteResult>;
 createAssessment(command:CreateAssessmentCommand):Promise<NativeWriteResult>;
 createDraft(command:CreateDraftCommand):Promise<NativeWriteResult>;
 createProgress(command:CreateProgressCommand):Promise<NativeWriteResult>;
 correctPrerequisiteRecord(command:CorrectStudentCommand):Promise<NativeWriteResult>;
 issueApproval(command:IssueApprovalCommand):Promise<ApprovalIssuance>;
 consumeApprovalAndApproveDraft(command:ApproveWithApprovalCommand):Promise<NativeWriteResult>;
 revokeApproval(command:RevokeApprovalCommand):Promise<NativeWriteResult>;
 admitCommand(command:AdmissionCommand):Promise<RequestBinding>;
 fenceCommand(command:FenceCommand):Promise<OutcomeLookupResult>;
 admitReadOccurrence(request:ReadAdmission):Promise<ReadOccurrenceLookup>;
 finalizeReadOccurrence(command:ReadFinalization):Promise<ReadOccurrenceLookup>;
 commitReadOutput<T>(request:ReadAdmission, prepare:(view:TeacherPrerequisiteReadStore)=>Promise<ReadOutputDecision<T>>,selectRefusal?:ReadOutputRefusalSelector):Promise<CommittedReadOutput<T>>;
}

export interface CurrentCatalogPin { node:CatalogNode; revisionId:string; contentDigest:string }
/** Registered Function inputs, retained in the internal horizon so the
 * output owner can independently recompute the same finite dependency set. */
export interface ReadHorizonPlan {
 /** Trusted compiled plan fields, never caller request overrides. */
 consumerProfile?:import('../contracts/prerequisiteRecords').ConsumerProfileId;
 sourceClosure?:true;
 classGroupRef:ObjectRef<'ClassGroup'>;
 studentRef:ObjectRef<'Student'>|null;
 occurrence:{mode:'EXACT';lessonRef:ObjectRef<'LessonSession'>}|{mode:'ENUMERATE_SEPARATELY'};
 draftRef:ObjectRef<'DailyRecordDraft'>|null;
 expectedRevisions:ObjectRef[];
}
/** Complete final-gate horizon expectation (SC4). The service captures it
 * in the preparatory snapshot and returns it through the existing committer
 * callback; the store recomputes the identical horizon from current state
 * inside the gate transaction and refuses any drift. Asserted pins alone
 * never authorize output. */
export interface ReadHorizonExpectation {
 plan?:ReadHorizonPlan;
 businessDate:string;
 bindingRevision:string|null;
 ownerHeads:{family:'teacher'|'class'|'lesson'|'student';entityKey:string;revisionId:string}[];
 temporalEdges:{entityKey:string;bindingKind:string;subject:string;target:string;validFrom:string;validTo:string|null;revisionId:string}[];
 activityScopes:{entityKey:string;activityKey:string;lessonKey:string;revisionId:string}[];
 students:string[];
 recordHeads:{studentId:string;entityId:string;revisionId:string}[];
 catalogPins:{nodeId:string;revisionId:string;contentDigest:string}[];
 catalogEdges:{nodeId:string;parentNodeId:string|null}[];
 scoreHeads:{attemptRef:ObjectRef<'DailyTestAttempt'>;revisionIds:string[]}[];
}
/* horizon is runtime-required for OUTPUT_READY: the store refuses
 * horizon_evidence_required when it is absent, even though the field is
 * optional at the type level for in-flight service migrations. */
export type ReadOutputRefusal={kind:'OUTPUT_REFUSED';code:string};
/** Trusted source-only final-error capability. The owner supplies its current
 * fenced view, including a new view after a known prepare rollback. It cannot
 * authorize COMPLETED and is never supplied by a caller's wire request. */
export type ReadOutputRefusalSelector=(view:TeacherPrerequisiteReadStore,code:string)=>Promise<ReadOutputRefusal>;
export type ReadOutputDecision<T>={kind:'OUTPUT_READY';value:T;horizon?:ReadHorizonExpectation}|ReadOutputRefusal;
export interface CommittedReadOutput<T> { value:T|null; requestId:string; outputAdmissionId:string; terminalStatus:'COMPLETED'|'REFUSED'|'UNKNOWN'; emissionDisposition:'NOT_ATTEMPTED'|'ATTEMPTED'|'UNKNOWN' }
// TeacherPrerequisiteStore write-side output committer (outside frozen read view):
// TeacherPrerequisiteStore.commitReadOutput<T>(request:ReadAdmission, prepare:(view:TeacherPrerequisiteReadStore)=>Promise<ReadOutputDecision<T>>,selectRefusal?:ReadOutputRefusalSelector):Promise<CommittedReadOutput<T>>;
// TeacherAuthStore same-file output lease (src/academy/teacherAuthStore.ts; existing file+.lock, no schema/secret change):
// TeacherAuthStore.withOutputLease<T>(use:(state:Readonly<ProductAuthState>)=>Promise<T>):Promise<T>;

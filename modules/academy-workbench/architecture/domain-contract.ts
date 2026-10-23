/** Design types only. No network provider, authentication material, or mutation executor. */
export type EvidenceLevel = 'source' | 'observed_structure' | 'observed_bounded_value'
  | 'verified_join' | 'verified_effect' | 'accepted_workflow' | 'design_hypothesis';
export type EvidenceRef = {
  evidenceId: string; sourceKind: 'academy_web' | 'mobile_app' | 'official_launcher' | 'teacher' | 'staff' | 'user_artifact';
  level: EvidenceLevel; observedAt: string; occurredAt: string | null;
  contractVersion: string | null; sourceDigest: string | null;
  // Resolved by trusted storage. Never an authentication-bearing URL or session token.
  safePointer: string;
};
export type Scope = {
  ownerId: string; academyId: string; actorId: string;
  role: 'pilot_instructor' | 'instructor' | 'operations_staff' | 'administrator';
  studentIds: string[]; lessonIds: string[];
  // Selection is not proof of source-enforced authority.
  authorizationProof: string;
};
export type SourceIdentity = { namespace: string; opaqueId: string };
export type IdentityBinding = {
  localId: string; source: SourceIdentity; validFrom: string; validThrough: string | null;
  proof: EvidenceRef[]; state: 'verified' | 'candidate' | 'conflict';
};
export type Fact<T> =
  | { state:'known'; value:T; evidence:EvidenceRef[]; freshness:'fresh'|'stale'; observedAt:string }
  | { state:'unknown'; reason:string; evidence:EvidenceRef[] }
  | { state:'conflicting'; candidates:Array<{value:T;evidence:EvidenceRef[]}> };
export type Coverage = {
  state:'complete'|'partial'|'unknown'; expectedCount:number|null; observedCount:number;
  exhausted:boolean; duplicateCount:number; evidence:EvidenceRef[];
};
export type LessonOccurrence = {
  lessonId:string; studentId:string; teacherId:string; enrollmentId:string;
  date:string; timeZone:string; kind:'regular'|'makeup'|'moved'|'unknown';
  originalLessonId:string|null; sourceBindings:IdentityBinding[];
};
export type ContentRange = {
  courseId:string; bookEditionId:string; unitIds:string[];
  segments:Array<{pageFrom:number|null;pageThrough:number|null;orderedItemRefs:string[];label:string}>;
};
export type Assignment = {
  assignmentId:string; studentId:string; assignedFromLessonId:string;
  dueLessonId:Fact<string>; content:ContentRange; activities:string[];
  revision:string; supersedesRevision:string|null; evidence:EvidenceRef[];
};
export type AssessmentIdentity = {
  studentId:string; category:'FA'|'NA'|'DA'|'DT'|'ZT'|'other';
  originalPaper:SourceIdentity; testingOccurrence:SourceIdentity;
};
export type MembershipSnapshot = {
  identity:AssessmentIdentity; revision:string;
  orderedMembers:Array<{ordinal:number;item:SourceIdentity|null;label:string}>;
  coverage:Coverage; evidence:EvidenceRef[];
};
export type JudgmentSnapshot = {
  identity:AssessmentIdentity; revision:string;
  items:Array<{ordinal:number;item:SourceIdentity|null;judgment:'correct'|'incorrect'|'ungraded'|'unknown';rawEnum:string|null}>;
  score:Fact<{value:number;maximum:number;scaleId:string}>;
  coverage:Coverage; evidence:EvidenceRef[];
};
export type WrongSubset = {
  identity:AssessmentIdentity; membershipRevision:string; judgmentRevision:string;
  joinBasis:'verified_item_keys'|'verified_shared_assessment_ordinals';
  incorrectOrdinals:number[]; unknownOrdinals:number[]; evidence:EvidenceRef[];
};
export type ClinicPlan = {
  planId:string; studentId:string; sourceAssessment:AssessmentIdentity;
  kind:'original_wrong_items'|'similar_items';
  requirement:'required'|'not_required'|'unknown';
  reason:string; ruleVersion:string; teacherOverride:Fact<{teacherId:string;reason:string}>;
  sourceMembershipRevision:string; sourceJudgmentRevision:string;
};
export type PrintSnapshot = {
  snapshotId:string; artifactDigest:string; generatedPaperVersion:string;
  sourceAssessment:AssessmentIdentity|null; clinicPlanId:string|null;
  capturedAt:string; header:string; orderedItemRefs:string[];
  artifactOrigin:'existing_verified_artifact'|'user_supplied_artifact';
  printing:Fact<{confirmedBy:string;confirmedAt:string;copies:number}>;
  // An available PDF, render completion, or print-dialog opening cannot establish this fact.
  evidence:EvidenceRef[];
};
export type DistributionEvent = {
  distributionId:string; snapshotId:string; studentId:string; lessonId:string;
  distributedBy:string; observedAt:string; evidence:EvidenceRef[];
};
export type WorkEvidence = {
  workId:string; studentId:string; assignmentId:string|null; lessonId:string;
  printSnapshotId:string|null;
  work:Fact<'not_started'|'in_progress'|'submitted'>;
  grading:Fact<'ungraded'|'partial'|'graded'>;
  correction:Fact<'not_required'|'required'|'in_progress'|'student_reported_done'|'teacher_verified'>;
  teacherReview:Fact<'pending'|'confirmed'|'needs_retry'>;
};
export type ParentProgressProjection = {
  // Deliberately excludes completion, correction, print/distribution, and teacher-review flags.
  lessonId:string; studentId:string;
  entries:Array<{range:ContentRange;activity:string;itemCount:Fact<number>;evidence:EvidenceRef[]}>;
  sourceRevisionIds:string[];
};
export type FeatureRelation = {
  nodeId:string; domainId:string; sourceOperationIds:string[];
  activation:'mapped_only'|'hidden_dependency'|'pilot_visible'|'enabled_after_acceptance';
  dependencies:Array<{nodeId:string;relationship:'reads'|'produces'|'requires'|'follows'|'side_effect_candidate';evidence:EvidenceRef[]}>;
  hiddenFromUi:boolean; retainInGraph:true;
};
export type ReadResult<T> =
  | {ok:true;value:T;coverage:Coverage;evidence:EvidenceRef[];scope:Scope}
  | {ok:false;code:'AUTH_REQUIRED'|'ACCESS_DENIED'|'BINDING_UNVERIFIED'|'PARTIAL'|'SOURCE_CHANGED'|'UPSTREAM_UNAVAILABLE'|'PRINT_INSTANCE_NOT_RESOLVED';lastEvidence:EvidenceRef[]};
export type MutationProposal = {
  proposalId:string; scope:Scope; operationId:string; exactTargetDigest:string;
  beforeRevision:string; afterDigest:string; sideEffects:string[];
  reviewState:'draft'|'review_ready'|'blocked';
  execution:'not_implemented';
};

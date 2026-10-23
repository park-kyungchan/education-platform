/**
 * ACX-T04: module-local workflow DESIGN, not an executor or activated integration.
 * Imports no runtime, reads no source, and invokes no native/domain action.
 * Existing canonical Work/Memory/context/verification contracts remain agent-platform-owned.
 */
export const CONTRACT_ID = 'ACX-EXECUTION/r1' as const;
export const CONTRACT_STATUS = 'design_not_activated' as const;
export type WorkflowKey =
  | 'class-preparation' | 'lesson-delivery' | 'progress-audit' | 'homework-followup'
  | 'assessment-preparation' | 'wrong-answer-clinic' | 'attendance-internal-journal';
export type TopicId = `academy.${WorkflowKey}`;
export type OwnerId =
  | 'academy-workbench' | 'education-platform/academy-dc' | 'education-platform/academy-gang'
  | 'education-platform/month-end-workbench' | 'education-platform/month-end-web'
  | 'education-platform/curriculum' | 'education-platform/mathematics-core'
  | 'math-research-module' | 'agent-platform' | 'existing-native-source-owner' | 'teacher';
export interface SourceLocator {
  owner: OwnerId;
  repository: string;
  path: string;
  line: number;
  revision: string | null;
  /** A locator is discovery metadata; actual consumption requires a selected immutable revision. */
  consumption: 'locator_only_requalify_before_use';
}
export interface ObjectRef {
  owner: OwnerId;
  namespace: string;
  id: string;
  revision: string | null;
  evidenceRefs: readonly string[];
}
export type Qualified<T> =
  | { state: 'known'; value: T; evidenceRefs: readonly string[] }
  | { state: 'unknown' | 'conflicting' | 'stale' | 'not_applicable'; reason: string; evidenceRefs: readonly string[] };
/** All instants remain independently nullable; never fill a missing clock from another clock. */
export interface EvidenceClocks {
  requestedAt: string | null;
  attemptedAt: string | null;
  queriedAt: string | null;
  observedAt: string | null;
  capturedAt: string | null;
  reportedAt: string | null;
  occurredAt: string | null;
  recordedAt: string | null;
  lastSuccessfulAt: string | null;
}
export interface EvidenceRef {
  ref: ObjectRef;
  basis: 'source_observation' | 'teacher_original' | 'user_report' | 'imported_snapshot' | 'inference';
  clocks: EvidenceClocks;
  scopeRef: ObjectRef;
  sourceByteHash: string | null;
  coverage: 'complete_within_declared_scope' | 'partial' | 'unknown';
  limitations: readonly string[];
}
export type TeacherOriginalRef = EvidenceRef & {
  basis: 'teacher_original';
  ref: ObjectRef & { owner: 'teacher' };
};
export interface IdentityJoin {
  localRef: ObjectRef;
  nativeRef: Qualified<ObjectRef>;
  state: 'verified' | 'candidate' | 'unknown' | 'conflicting';
  joinEvidenceRefs: readonly string[];
  /** Equal names, path strings, codes or numeric literals never establish identity. */
  method: 'explicit_scoped_evidence_only';
}
export interface BookScope {
  edition: Qualified<ObjectRef>;
  sectionRefs: readonly ObjectRef[];
  sourceLabels: readonly string[];
  parentage: Qualified<readonly { child: ObjectRef; parent: ObjectRef }[]>;
  assignedPagesOrItems: Qualified<readonly string[]>;
}
export interface TaskScope {
  businessDate: Qualified<string>;
  timeZone: Qualified<string>;
  classOrCohort: Qualified<ObjectRef>;
  students: Qualified<readonly IdentityJoin[]>;
  lesson: Qualified<ObjectRef>;
  /** Resolve 'today' per the selected operational timezone, never the host date alone. */
  navigation: 'business-date_then_class-or-cohort_then_student-preparation-and-pending';
}
export interface CommonInputs {
  scope: TaskScope;
  currentDecisionRefs: readonly ObjectRef[];
  selectedPolicyRefs: readonly ObjectRef[];
  priorCompletedEffectRefs: readonly ObjectRef[];
  uncertainEffectRefs: readonly ObjectRef[];
  sourceObservationRefs: readonly EvidenceRef[];
  teacherOriginalRefs: readonly TeacherOriginalRef[];
}
export interface WorkflowInputs {
  'class-preparation': CommonInputs & {
    books: readonly BookScope[]; previousLessonRef: Qualified<ObjectRef>;
    homeworkAssignmentRefs: readonly ObjectRef[]; pendingReviewRefs: readonly ObjectRef[];
  };
  'lesson-delivery': CommonInputs & {
    preparedPlanRef: Qualified<ObjectRef>; selectedActivityRefs: readonly ObjectRef[];
    attendanceEvidenceRefs: readonly EvidenceRef[]; actualWorkEvidenceRefs: readonly EvidenceRef[];
  };
  'progress-audit': CommonInputs & {
    books: readonly BookScope[]; assignmentRefs: readonly ObjectRef[];
    requestedCoverage: readonly ObjectRef[]; priorProgressRevision: Qualified<ObjectRef>;
  };
  'homework-followup': CommonInputs & {
    assignmentRef: Qualified<ObjectRef>; books: readonly BookScope[];
    dueAt: Qualified<string>; performanceEvidenceRefs: readonly EvidenceRef[];
    correctionEvidenceRefs: readonly EvidenceRef[];
  };
  'assessment-preparation': CommonInputs & {
    assessmentCycle: Qualified<ObjectRef>; researchRevision: Qualified<ObjectRef>;
    books: readonly BookScope[]; constraintDecisionRefs: readonly ObjectRef[];
    researchTypeRefs: readonly ObjectRef[]; nativeCandidateRefs: readonly IdentityJoin[];
    finalTeacherSelectionRef: Qualified<ObjectRef>;
  };
  'wrong-answer-clinic': CommonInputs & {
    originalAssessment: Qualified<ObjectRef>; studentAttempt: Qualified<ObjectRef>;
    gradingRevision: Qualified<ObjectRef>; wrongItemSubset: Qualified<ObjectRef>;
    generatedSimilarPaper: Qualified<ObjectRef>; printedSnapshot: Qualified<ObjectRef>;
    distributionEvidenceRefs: readonly EvidenceRef[]; teacherExceptionRefs: readonly EvidenceRef[];
  };
  'attendance-internal-journal': CommonInputs & {
    exactDailyRecord: Qualified<IdentityJoin>; previousLessonRecord: Qualified<ObjectRef>;
    attendance: Qualified<EvidenceRef>; progress: Qualified<EvidenceRef>;
    homework: Qualified<EvidenceRef>; previousHomeworkAssessment: Qualified<EvidenceRef>;
    todayDailyTest: Qualified<EvidenceRef>; todayMemo: Qualified<EvidenceRef>;
    fieldsToPreserve: readonly string[];
  };
}
export type Stage = 'preparation' | 'selection_qualification' | 'native_domain_execution'
  | 'readback' | 'verification' | 'teacher_review' | 'scoped_acceptance';
export type Effect = 'read_selected_source' | 'record_internal_lesson_fields'
  | 'generate_selected_paper' | 'print_selected_snapshot' | 'record_physical_distribution';
export interface ExactAuthorizationRef {
  sourceDecisionRef: ObjectRef;
  workflow: WorkflowKey;
  targetScopeRef: ObjectRef;
  permittedEffects: readonly Effect[];
  exactTargetRefs: readonly ObjectRef[];
  selectedNativeOwner: OwnerId;
  currentValidityEvidenceRefs: readonly string[];
  /** This design only references an authorization; it cannot issue or authenticate one. */
  authorizationOwner: 'current_user_and_existing_native_boundary';
}
/** Independent axes: a native receipt, teacher original and approval remain different evidence. */
export interface WorkflowRecord<K extends WorkflowKey> {
  workflow: K;
  inputs: WorkflowInputs[K];
  work: {
    projectId: 'academy-workbench'; workId: string;
    /** Existing common source Task; never substituted for a native Task or Run. */
    logicalTaskRef: ObjectRef;
    /** Absent observations remain unknown. Source-only preparation needs no native Run. */
    nativeExecution: Qualified<{
      runtimeId: string; sessionId: string | null; taskId: string | null; runId: string | null;
      observationEvidenceRefs: readonly string[];
    }>;
  };
  preparation: { state: 'pending' | 'prepared' | 'held'; draftRef: Qualified<ObjectRef> };
  selectionQualification: { state: 'pending' | 'qualified' | 'held'; checks: readonly string[]; unknowns: readonly string[] };
  nativeDomainExecution:
    | { state: 'not_started' | 'held'; reason: string }
    | { state: 'succeeded' | 'failed' | 'uncertain'; authorizationRef: ExactAuthorizationRef; nativeReceiptRefs: readonly ObjectRef[] };
  readback: { state: 'not_requested' | 'observed' | 'partial' | 'failed' | 'uncertain'; sourceEvidenceRefs: readonly EvidenceRef[] };
  verification: { state: 'not_run' | 'pass' | 'fail' | 'unverified'; canonicalVerificationRefs: readonly ObjectRef[]; limitations: readonly string[] };
  teacherReview: { state: 'pending' | 'reviewed' | 'correction_requested' | 'not_applicable'; teacherOriginalEvidenceRefs: readonly TeacherOriginalRef[] };
  acceptance: { state: 'not_requested' | 'pending' | 'accepted_scoped' | 'rejected'; decisionRef: Qualified<ObjectRef>; includedScopeRefs: readonly ObjectRef[]; excludedScopes: readonly string[] };
}
export interface StageRequirement {
  stage: Stage;
  requiredEvidenceOrDecision: string;
  heldWhen: string;
}
export const STAGE_REQUIREMENTS: readonly StageRequirement[] = [
  { stage: 'preparation', requiredEvidenceOrDecision: 'Resolve dated class/cohort and exact student/lesson scope; load relevant owner context and original teacher evidence.', heldWhen: 'Required scope, source currentness or a prior uncertain effect remains unresolved.' },
  { stage: 'selection_qualification', requiredEvidenceOrDecision: 'Select exact sources, identities, editions, assignment/item membership and current scoped decisions; preserve partial/unknown states.', heldWhen: 'A proposed mapping, missing field or source hash is being used as identity, currentness or authority.' },
  { stage: 'native_domain_execution', requiredEvidenceOrDecision: 'Existing domain/native owner executes only effects covered by current exact scoped authorization and its supported operation.', heldWhen: 'This design is not activated; no authorized owner handoff is selected, or current execution holds remain.' },
  { stage: 'readback', requiredEvidenceOrDecision: 'Read authoritative exact target state and receipts; compare with intended fields/membership and fresh before-state.', heldWhen: 'Timeout, ambiguous receipt or partial observation requires reconciliation; do not retry the effect.' },
  { stage: 'verification', requiredEvidenceOrDecision: 'Reference canonical Verification records for exact target, criterion and observation; distinguish not-run/unverified from pass.', heldWhen: 'Only schema/build/fixture success exists for a claim about live, physical or pedagogical completion.' },
  { stage: 'teacher_review', requiredEvidenceOrDecision: 'Retain original teacher evidence and explicit review of actual learner work independently from server fields and execution approval.', heldWhen: 'A score, completed server field, source receipt or prior approval is being substituted for teacher review.' },
  { stage: 'scoped_acceptance', requiredEvidenceOrDecision: 'Record explicit acceptance target, scope, revision and exclusions; retain rejected or superseded proposals.', heldWhen: 'No actual scoped acceptance exists; test success or a selected UI item cannot supply it.' },
];
export interface WorkflowDesign<K extends WorkflowKey> {
  id: `ACX-WF-${string}`;
  topicId: `academy.${K}`;
  workflow: K;
  status: 'design_not_activated';
  semanticAndInputSources: readonly SourceLocator[];
  requiredInputFields: readonly (keyof WorkflowInputs[K])[];
  preparedOutput: string;
  qualificationRules: readonly string[];
  domainExecutionOwner: readonly OwnerId[];
  futureEffectsRequiringExactAuthorization: readonly Effect[];
  readbackAndVerification: readonly string[];
  teacherAcceptance: string;
  operationalCompletionClaimed: false;
}
const workbenchDecisions = { owner: 'academy-workbench', repository: 'academy-workbench', path: 'context/business-decisions.json', line: 1, revision: null, consumption: 'locator_only_requalify_before_use' } as const;
const gangSemantics = { owner: 'education-platform/academy-gang', repository: 'education-platform', path: 'apps/academy/gang-a/docs/ACADEMY_OPERATING_CONTEXT.md', line: 5, revision: null, consumption: 'locator_only_requalify_before_use' } as const;
const dailyRecordPolicy = { owner: 'education-platform/academy-dc', repository: 'education-platform', path: 'apps/academy/dc-gang-a/docs/daily-record-authoring-policy.md', line: 5, revision: null, consumption: 'locator_only_requalify_before_use' } as const;
const assessmentContext = { owner: 'education-platform/month-end-workbench', repository: 'education-platform', path: 'apps/academy/month-end-workbench/docs/source-context.md', line: 1, revision: null, consumption: 'locator_only_requalify_before_use' } as const;
const researchContext = { owner: 'math-research-module', repository: 'math-research-module', path: 'context/monthly-assessment-20261016/README.md', line: 1, revision: null, consumption: 'locator_only_requalify_before_use' } as const;

/** Complete seven-workflow catalog. Field names are checked against each workflow's input type. */
export const WORKFLOW_DESIGNS = {
  'class-preparation': {
    id: 'ACX-WF-CLASS-PREPARATION', topicId: 'academy.class-preparation', workflow: 'class-preparation', status: CONTRACT_STATUS,
    semanticAndInputSources: [workbenchDecisions, gangSemantics, dailyRecordPolicy],
    requiredInputFields: ['scope', 'currentDecisionRefs', 'selectedPolicyRefs', 'books', 'previousLessonRef', 'homeworkAssignmentRefs', 'pendingReviewRefs', 'sourceObservationRefs', 'teacherOriginalRefs', 'priorCompletedEffectRefs', 'uncertainEffectRefs'],
    preparedOutput: 'Dated class/cohort preparation packet with per-student assigned scope, previous evidence, next materials and pending teacher checks.',
    qualificationRules: ['Resolve class membership for this lesson, not a global roster.', 'Bind prior homework and current assignments separately; missing evidence remains unknown.'],
    domainExecutionOwner: ['existing-native-source-owner', 'teacher'], futureEffectsRequiringExactAuthorization: ['read_selected_source'],
    readbackAndVerification: ['Check freshness and coverage per source domain; expose partial failures without replacing prior successful observations.', 'Verify prepared packet against exact assignments and edition-local sections.'],
    teacherAcceptance: 'Teacher accepts the exact preparation packet; this does not establish lesson delivery or learner completion.', operationalCompletionClaimed: false,
  },
  'lesson-delivery': {
    id: 'ACX-WF-LESSON-DELIVERY', topicId: 'academy.lesson-delivery', workflow: 'lesson-delivery', status: CONTRACT_STATUS,
    semanticAndInputSources: [gangSemantics, workbenchDecisions],
    requiredInputFields: ['scope', 'currentDecisionRefs', 'selectedPolicyRefs', 'preparedPlanRef', 'selectedActivityRefs', 'attendanceEvidenceRefs', 'actualWorkEvidenceRefs', 'teacherOriginalRefs', 'priorCompletedEffectRefs', 'uncertainEffectRefs'],
    preparedOutput: 'Selected activity plan and separate pending observations for actual classroom work.',
    qualificationRules: ['Planned activities are definitions; each actual performance is a separate scoped event.', 'Separate preparation, learner solving, grading, correction and teacher review.'],
    domainExecutionOwner: ['teacher', 'existing-native-source-owner'], futureEffectsRequiringExactAuthorization: ['read_selected_source', 'record_internal_lesson_fields'],
    readbackAndVerification: ['Source entry readback verifies recorded fields only.', 'Actual attendance, durations and learner performance need matching original evidence; scheduled time is not actual time.'],
    teacherAcceptance: 'Teacher reviews actual work and any deviations; acceptance of a plan cannot complete its events.', operationalCompletionClaimed: false,
  },
  'progress-audit': {
    id: 'ACX-WF-PROGRESS-AUDIT', topicId: 'academy.progress-audit', workflow: 'progress-audit', status: CONTRACT_STATUS,
    semanticAndInputSources: [workbenchDecisions, gangSemantics],
    requiredInputFields: ['scope', 'currentDecisionRefs', 'selectedPolicyRefs', 'books', 'assignmentRefs', 'requestedCoverage', 'priorProgressRevision', 'sourceObservationRefs', 'teacherOriginalRefs', 'priorCompletedEffectRefs', 'uncertainEffectRefs'],
    preparedOutput: 'Edition-local scope audit separating observed, not observed within queried scope, not tracked, unknown mapping and unverified section existence.',
    qualificationRules: ['Use explicit book-edition and local/native student/entity joins; no label-only or global row-position join.', 'Validate pagination/filter completeness and denominators within the requested scope; embedded written response is not another grading unit.'],
    domainExecutionOwner: ['existing-native-source-owner', 'teacher'], futureEffectsRequiringExactAuthorization: ['read_selected_source'],
    readbackAndVerification: ['Preserve per-domain clocks and prior evidence when a refresh fails.', 'A server completion field or score cannot establish correction, print, distribution or teacher completion.'],
    teacherAcceptance: 'Teacher accepts or corrects the bounded progress interpretation; corrections retain original evidence and revision lineage.', operationalCompletionClaimed: false,
  },
  'homework-followup': {
    id: 'ACX-WF-HOMEWORK-FOLLOWUP', topicId: 'academy.homework-followup', workflow: 'homework-followup', status: CONTRACT_STATUS,
    semanticAndInputSources: [workbenchDecisions, gangSemantics, dailyRecordPolicy],
    requiredInputFields: ['scope', 'currentDecisionRefs', 'selectedPolicyRefs', 'assignmentRef', 'books', 'dueAt', 'performanceEvidenceRefs', 'correctionEvidenceRefs', 'teacherOriginalRefs', 'priorCompletedEffectRefs', 'uncertainEffectRefs'],
    preparedOutput: 'Internal assignment-followup view with exact scope and independent solving, grading, correction and teacher-review needs.',
    qualificationRules: ['Earlier work outside a current assignment cannot complete it.', 'Do not invent a deadline, performance code or parent follow-up action from routine, scores or empty fields.'],
    domainExecutionOwner: ['teacher', 'existing-native-source-owner'], futureEffectsRequiringExactAuthorization: ['read_selected_source', 'record_internal_lesson_fields'],
    readbackAndVerification: ['Bind any internal update to exact assignment/student/lesson/field and preserve unrelated values.', 'Keep previous-homework assessment separate from today\'s assigned homework.'],
    teacherAcceptance: 'Teacher reviews actual assigned work; internal pending status never implies a communication has occurred.', operationalCompletionClaimed: false,
  },
  'assessment-preparation': {
    id: 'ACX-WF-ASSESSMENT-PREPARATION', topicId: 'academy.assessment-preparation', workflow: 'assessment-preparation', status: CONTRACT_STATUS,
    semanticAndInputSources: [assessmentContext, researchContext, workbenchDecisions],
    requiredInputFields: ['scope', 'currentDecisionRefs', 'assessmentCycle', 'researchRevision', 'books', 'constraintDecisionRefs', 'researchTypeRefs', 'nativeCandidateRefs', 'finalTeacherSelectionRef', 'sourceObservationRefs', 'teacherOriginalRefs', 'priorCompletedEffectRefs', 'uncertainEffectRefs'],
    preparedOutput: 'Research-backed candidate packet with original item identities, constraints, alternative judgments and unresolved mathematical/source gaps.',
    qualificationRules: ['Resolve dated decisions per assessment scope; preserve historical 9/9/6 proposal, later 8/8/8 preparation and later explicit selection as distinct claims.', 'Research IDs, pat_no, lecture_key, paper keys and q_code are separate namespaces; points are not difficulty evidence.', 'Specific 80-minute examination and general 100-minute policy have different scope; preparation deadline is not examination date.', 'Current native-launch hold remains in force; this design does not clear it.'],
    domainExecutionOwner: ['education-platform/month-end-workbench', 'existing-native-source-owner', 'teacher'], futureEffectsRequiringExactAuthorization: ['read_selected_source', 'generate_selected_paper', 'print_selected_snapshot'],
    readbackAndVerification: ['Compare native producer receipts and exact selected membership separately from portable research projections.', 'Preserve partial-match analysis, source revision, edition uncertainty and unapplied correction proposals.'],
    teacherAcceptance: 'Explicit final teacher selection and scoped mathematical review are separate from assistant ranking, source verification and paper production.', operationalCompletionClaimed: false,
  },
  'wrong-answer-clinic': {
    id: 'ACX-WF-WRONG-ANSWER-CLINIC', topicId: 'academy.wrong-answer-clinic', workflow: 'wrong-answer-clinic', status: CONTRACT_STATUS,
    semanticAndInputSources: [workbenchDecisions, gangSemantics],
    requiredInputFields: ['scope', 'currentDecisionRefs', 'selectedPolicyRefs', 'originalAssessment', 'studentAttempt', 'gradingRevision', 'wrongItemSubset', 'generatedSimilarPaper', 'printedSnapshot', 'distributionEvidenceRefs', 'teacherExceptionRefs', 'teacherOriginalRefs', 'priorCompletedEffectRefs', 'uncertainEffectRefs'],
    preparedOutput: 'Scope-bound clinic plan preserving original assessment, attempt, wrong-item subset, generated paper, printed snapshot and actual distribution as separate identities.',
    qualificationRules: ['Require verified exact-assessment evidence for 100-point exemption; keep explicit teacher exceptions.', 'Zero wrong items closes the relevant re-solve task only with teacher confirmation.', 'Re-generation creates a new event; never replace historical printed membership with a later array.'],
    domainExecutionOwner: ['teacher', 'existing-native-source-owner'], futureEffectsRequiringExactAuthorization: ['read_selected_source', 'generate_selected_paper', 'print_selected_snapshot', 'record_physical_distribution'],
    readbackAndVerification: ['Read back original item membership and generated artifact identity; a PDF or print dialog does not prove physical printing.', 'Retain solving, grading, correction, distribution and teacher review evidence independently.'],
    teacherAcceptance: 'Teacher reviews the actual learner work and remaining supplementation for the exact clinic scope.', operationalCompletionClaimed: false,
  },
  'attendance-internal-journal': {
    id: 'ACX-WF-ATTENDANCE-INTERNAL-JOURNAL', topicId: 'academy.attendance-internal-journal', workflow: 'attendance-internal-journal', status: CONTRACT_STATUS,
    semanticAndInputSources: [dailyRecordPolicy, workbenchDecisions],
    requiredInputFields: ['scope', 'currentDecisionRefs', 'exactDailyRecord', 'previousLessonRecord', 'attendance', 'progress', 'homework', 'previousHomeworkAssessment', 'todayDailyTest', 'todayMemo', 'fieldsToPreserve', 'teacherOriginalRefs', 'priorCompletedEffectRefs', 'uncertainEffectRefs'],
    preparedOutput: 'Internal DailyRecord intake/draft for exact lesson attendance, progress, homework, assessments and student-specific journal; parent-facing projection is excluded.',
    qualificationRules: ['Interview only for genuinely missing exact student/date/record fields; do not reask already supplied answers.', 'Lesson narrative or a test does not establish attendance; a score/rate/count does not establish source assessment codes.', 'Today\'s no-additional-memo answer is dated, does not erase existing text and never becomes a permanent preference.', 'Keep parent-facing draft and parent transmission outside this workflow.'],
    domainExecutionOwner: ['education-platform/academy-dc', 'existing-native-source-owner', 'teacher'], futureEffectsRequiringExactAuthorization: ['read_selected_source', 'record_internal_lesson_fields'],
    readbackAndVerification: ['Any save requires current exact student/date/record/field authorization, fresh before-state and existing admission/readback checks.', 'Preserve user-entered values and original teacher text independently from normalized codes and receipts; ambiguous effects require reconciliation.'],
    teacherAcceptance: 'Teacher confirms exact internal content and preservation of prior values; source save and review do not imply parent delivery.', operationalCompletionClaimed: false,
  },
} as const satisfies { [K in WorkflowKey]: WorkflowDesign<K> };

export const DESIGN_BOUNDARY = {
  projectId: 'academy-workbench', workId: 'academy-context-consolidation-20261021',
  specification: 'ACX-SPEC/r1', plan: 'ACX-PLAN/r1', issue: 'ACX-ISSUE-20261021',
  registration: 'local_design_record_not_native_or_global_registration',
  runtimeActivation: false, genericExecutorImplemented: false, sourceCopyingPerformed: false,
  executionAuthorityGranted: false, teacherEvidenceCopied: false, operationalCompletionClaimed: false,
  stageOrder: ['preparation', 'selection_qualification', 'native_domain_execution', 'readback', 'verification', 'teacher_review', 'scoped_acceptance'],
  excludedTopics: ['academy.counseling', 'academy.parent-communication'],
  commonHarness: {
    owner: 'agent-platform', consumption: 'existing_pinned_canonical_contracts',
    responsibilities: ['Work/Memory/context identity references', 'source/currentness references', 'Verification references', 'preserved completed and uncertain effects'],
    executorOwnership: 'existing_domain_and_native_owners', secondExecutor: false,
    newCanonicalArtifactKind: false, newCanonicalMemoryImplementation: false,
  },
} as const;

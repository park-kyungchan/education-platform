/** CON-01 selection design only. No reader, reducer, renderer, source acquisition or effect. */
export type Knowledge<T> =
  | { state: 'known'; value: T; evidenceRefs: readonly string[] }
  | { state: 'unknown' | 'partial' | 'conflicting' | 'stale'; reason: string; evidenceRefs: readonly string[] };

export interface ReportClocks {
  businessDate: string;
  timeZone: string;
  occurredAt: string | null;
  sourceObservedAt: string | null;
  teacherReportedAt: string | null;
  recordedAt: string | null;
  lastVerifiedAt: string | null;
  retrievedAt: string | null;
  sourceRevision: string | null;
}
export interface ActivityScope {
  studentRef: string;
  editionRef: Knowledge<string>;
  volume: Knowledge<string>;
  sectionRef: Knowledge<string>;
  exactSectionLabels: readonly string[];
  activityKind: string;
  occurrenceRef: Knowledge<string>;
  attemptRef: Knowledge<string>;
  materialRef: Knowledge<string>;
}
/** These are projections of qualified canonical results, never rules for computing learning state. */
export interface ActivityReport {
  scope: ActivityScope;
  sourceScore: Knowledge<{ earned: number; possible: number; sourceRef: string }>;
  canonicalJudgment: Knowledge<{ status: string; scopeRefs: readonly string[]; teacherRef: string }>;
  assignment: Knowledge<{ assignmentRef: string; state: 'active' | 'cancelled' | 'replaced'; replacementRef: string | null; deadline: string | null }>;
  defaultEligibility: Knowledge<{ policyRef: string; eligible: boolean }>;
  stages: readonly {
    stage: 'assigned' | 'printed' | 'distributed' | 'solved' | 'graded' | 'corrected' | 'teacher_reviewed' | 'app_entered';
    status: Knowledge<string>;
  }[];
  printedMembershipRef: Knowledge<string>;
  clocks: ReportClocks;
}
export interface StudentReport {
  studentRef: string;
  dayFlow: readonly string[];
  books: readonly { editionRef: Knowledge<string>; exactTitle: string; activities: readonly ActivityReport[] }[];
  activeAssignedWork: readonly string[];
  proposedTeachingActions: readonly string[];
  questions: readonly string[];
}
export const selectedReportContract = {
  status: 'selection-design-only',
  navigation: ['businessDate', 'classOrCohort', 'studentPreparationAndPending'],
  formatOwner: 'installed academy-student-context skill; no global modification',
  title: '[YYYY-MM-DD academy lesson context / requested class and students]; Korean outward rendering',
  hierarchy: ['numbered student', 'numbered day flow', 'numbered book/edition/volume', 'exact unit then activity/occurrence', 'new homework/teaching direction or actions/questions'],
  rules: [
    'Unknown catalog activities are not confirmed pending assignments.',
    'Use canonical teacher judgments; no score-based second reducer.',
    'Keep scoped teacher-final completion closed against older scores/checklists; a later distinct assignment stays distinct.',
    'Apply current corrections only to matching student/edition/activity/occurrence and preserve dated provenance.',
    'Explicit assignments and default 100-point eligibility are separate; eligibility alone does not assign work.',
    'Remove cancelled/replaced work from current pending counts while retaining its history.',
    'Keep original assessment, attempt, wrong subset, generated paper, printed membership and distribution distinct.',
    'Keep internal lesson plans, parent projection, draft, review, server save and actual send distinct.',
    'Exhaust required saved facets, separate dated lesson observations, canonical fragments and metadata catalog pages.',
    'Unavailable current evidence produces a bounded partial report, never a refreshed/all-history claim.',
  ],
  currentTeacherContextDate: '2026-10-19',
  teacherContextBasis: 'current delegation metadata only; facts remain with private owner/conversation',
  originalDailyReport: 'outstanding; older report is historical and must not be presented as current',
  effects: { sourceAcquisition: false, save: false, send: false, print: false, nativeActivation: false },
} as const;

/** Academy-specific context overlay; shared Artifact/Work contracts remain upstream. */
export type Layer = 'DATA' | 'LOGIC' | 'ACTION' | 'GOVERNANCE';
export type Stage = 'paper-solving' | 'app-entry' | 'app-grading' | 'wrong-answer-correction' | 'teacher-review' | 'video-inspection' | 'attendance';
export interface Times {
  sourceTimestamp: string | null;
  snapshotCapturedAt: string | null;
  captureWindow: { from: string; to: string; timeZone: 'Asia/Seoul' } | null;
  userReportTime: string | null;
  ingestedAt: string;
}
interface SourceBase { key: string; summary: string; times: Times; rawPrivateDataIncluded: false }
export type Source = SourceBase & (
  | { kind: 'trusted-user-history'; messageId: string; originalText: string }
  | { kind: 'delegated-observation-report'; originalObserver: 'parent-agent'; reobservedByThisWorker: false; rawArtifactAvailableHere: false }
  | { kind: 'delegated-history-report'; originalAuthor: 'user' | 'parent' | 'historical-analysis'; originalText: null }
  | { kind: 'repository-file'; path: string; commit: string }
  | { kind: 'github-observation'; url: string; headSha: string }
);
export type Observation =
  | { facet: 'authentication'; status: 'login-and-learning-menu-observed'; unattendedReuse: 'unverified'; liveMcp: 'unverified'; vpsOperation: 'unverified'; timeoutMs: number; unlimitedTimeout: 'unverified' }
  | { facet: 'source-read'; endpoint: string; query: string; outcome: 'read'; completeness: 'bounded'; diagnosticMethod: 'ui' }
  | { facet: 'source-read'; endpoint: string; query: string; outcome: 'blocked-extension-install'; completeness: 'not-read'; diagnosticMethod: 'screenshot'; axDomBarrierClarity: 'insufficient'; installed: false; bypassed: false; overlayText: string }
  | { facet: 'app-grading-coverage'; assignedUnits: number; scoreVisibleUnits: number; resultUnconfirmedUnits: number; unit: 'app-grading-unit'; paperCompletion: 'unknown'; questionCount: null; studyMinutes: null; completionRatio: null }
  | { facet: 'daily-record'; date: string; rawStatus: 'absent' | 'blank'; attendanceInterpretation: 'absence-record' | 'unresolved'; learningInterpretation: 'unknown' }
  | { facet: 'video-status'; rawStatus: 'OK'; meaning: 'upload-or-video-status'; teacherInspection: 'unknown' }
  | { facet: 'clinic-server-status'; rawStatus: '미학습'; paperCompletion: 'unknown'; teacherJudgment: 'separate' }
  | { facet: 'historical-re'; analyzedScreens: number; menuCount: number; status: 'reported-static-analysis'; singleRequestSlotOverwrite: 'possible'; historicalFailureCause: 'unproven' }
  | { facet: 'operational-limit'; targets: string[]; status: 'unverified' }
  | { facet: 'pr-status'; prNumber: number; headSha: string; syntheticChecks: 'pass'; canonicalCheckout: 'fail'; independentReview: 'fail'; aggregate: 'fail'; merge: 'open' };
export type Report =
  | { facet: 'parent-observation'; signals: Array<'delayed-start' | 'attention-drift' | 'volume-burden' | 'planning-difficulty'>; causeDiagnosis: false }
  | { facet: 'paper-delivery'; auditOrdinals: number[]; status: 'printed-and-enclosed-reported'; receipt: 'unknown'; studentSolving: 'unknown'; teacherJudgment: 'unknown' }
  | { facet: 'prior-scope'; first: number; last: number; status: 'superseded'; label: 'TEST' };
export type Decision =
  | { facet: 'closure-correction'; date: string; value: 'academy-closed'; reason: 'Hangul-Day'; appliesTo: 'this-academy-this-date-only'; allPublicHolidaysClosed: false }
  | { facet: 'latest-delivery-scope'; first: number; last: number; label: 'TEST'; scopeAuthority: 'latest-conveyed-range'; globalRewrite: false }
  | { facet: 'teacher-completion'; auditCohortSize: number; completedOrdinals: number[]; paths: Array<'original-wrong' | 'similar-clinic'>; judgmentCount: number; status: 'teacher-completed'; overridesServerLearningLabel: false; serverCanRevokeTeacherJudgment: false }
  | { facet: 'perfect-score-exclusion'; excludedCount: number; appliesTo: 'historical-comparison-list-only'; teacherReviewInferred: false }
  | { facet: 'repository-delivery'; actions: Array<'commit' | 'push' | 'open-pr' | 'verify' | 'merge'>; externalMessageSendingIncluded: false };
interface RecordBase {
  key: string; node: string; summary: string; sourceKeys: string[];
  scope: string; limitations: string[];
  links: Array<{ relation: 'corrects' | 'supersedes' | 'qualifies' | 'supports'; target: string }>;
}
export type ContextRecord = RecordBase & (
  | { kind: 'observation'; layer: 'DATA'; observation: Observation }
  | { kind: 'report'; layer: 'DATA'; report: Report }
  | { kind: 'interpretation'; layer: 'LOGIC'; status: 'superseded'; value: 'unresolved'; notHistoricalAbsenceClaim: true }
  | { kind: 'rule'; layer: 'LOGIC'; rule: { stages: Stage[]; forbiddenInferences: string[]; reusedContracts: string[] } }
  | { kind: 'decision'; layer: 'GOVERNANCE'; decision: Decision }
  | { kind: 'action-boundary'; layer: 'ACTION'; effects: { academyMutation: false; send: false; print: false; installExtension: false; bypass: false; credentialSetup: false; deployment: false; contextLoadAuthority: 'none' } }
);
export interface InquiryContext {
  schemaVersion: 'academy.inquiry-context/1'; preparedAt: string;
  basisCommit: string; authority: 'none'; nativePermissionGranted: false;
  coverage: { status: 'partial'; completeConversation: false; completeProgressTable: false; originalPrivateArtifactsIncluded: false; contextScope: string; excluded: string[] };
  hierarchy: Array<{ key: string; parent: string | null; layer: Layer; label: string }>;
  sources: Source[]; records: ContextRecord[];
}
/** Exact attempt identity, never a display title, score or audit ordinal alone. */
export interface AssessmentIdentity { originalTestId: string; unitId: string; attemptedAt: string }
export interface TeacherClinicJudgment { identity: AssessmentIdentity; path: 'original-wrong' | 'similar-clinic'; outcome: 'complete'; evidenceRef: string }
export interface ServerClinicObservation { identity: AssessmentIdentity; path: TeacherClinicJudgment['path']; rawStatus: '미학습' | '학습'; capturedAt: string }

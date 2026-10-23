/** Portable draft; contains no student data. Runtime validation: validate.py. */
export type Status = 'planned' | 'in_progress' | 'teacher_confirmed' | 'unknown' | 'cancelled' | 'superseded';
export type EvidenceKind = 'user_report' | 'server_observed';
export type ActivityKind = 'activity' | 'assignment' | 'assessment' | 'teacher_decision';
export type HierarchyLevel = 'major' | 'middle' | 'subunit' | 'section';
export type AssessmentKind = 'daily_test' | 'printed_major_unit_assessment' | 'textbook_major_unit_section';
export interface Evidence {
  kind: EvidenceKind;
  messageId: string | null;
  /** A bounded excerpt, not necessarily the full message. null means no direct quote. */
  quote: string | null;
  observedAt: string | null;
  localArtifact: string | null;
  summary?: string;
  scope?: string;
  observationEndedAt?: string;
}
export interface State {
  status: Status;
  evidenceIds: string[];
  detail: string | null;
}
export interface Activity extends State {
  id: string;
  kind: ActivityKind;
  label?: string;
  teacherFinal?: State;
  grading?: State;
  submission?: State;
  assessmentKind?: AssessmentKind;
  /** True reports participation only; does not imply grading or completion. */
  performedUserReported?: boolean;
  questionCount?: number;
  uniqueQuestionCount?: number;
  questionLabels?: string[] | null;
  score?: number | null;
  scope?: string;
  excludedScopes?: string[];
  bookId?: string | null;
  pagesInclusive?: [number, number];
  revision?: number;
  supersededBy?: string;
  dueDate?: string | null;
  dueTime?: string | null;
  sectionLabels?: string[];
  /** Additional explicitly sourced properties; never interpreted as completion. */
  [extension: string]: unknown;
}
export interface CurriculumNode {
  level: HierarchyLevel;
  label: string;
  children: CurriculumNode[];
  activities?: Activity[];
  mappingStatus?: string;
  sectionInventoryComplete?: boolean;
}
export interface Book {
  id: string;
  label: string;
  hierarchy: CurriculumNode[];
  hierarchyEvidenceIds?: string[];
  wholeBookDecision?: Activity;
  history?: Activity[];
  sectionActivities?: Activity[];
  clinicDecisions?: {wrongClinic: State; similarClinic: State};
  grade?: number;
  semester?: number;
  volume?: number;
  volume2Exists?: boolean;
}
export interface Attendance {
  actualArrival: string | null;
  plannedArrival?: string | null;
  plannedDeparture: string | null;
  actualDeparture: string | null;
  evidenceIds: string[];
  reason?: string;
  priorContext?: string;
}
export interface Student {
  id: string;
  name: string;
  attendance: Attendance;
  books: Book[];
  activities?: Activity[];
  assignments: Activity[];
  history?: Activity[];
  historicalAssessmentDistinction?: {
    evidenceIds: string[];
    occurrences: {date: string; kind: AssessmentKind; score: number | null}[];
    notTodayActivity: boolean;
    doNotMergeByTitle: boolean;
  };
}
export interface ClassContext {
  schemaVersion: 'academy.class-context/1.0-draft';
  date: string;
  timezone: 'Asia/Seoul';
  snapshotAsOf: string;
  snapshotType: 'partial_day';
  privacy: Record<string, string | boolean>;
  semantics: Record<string, string>;
  sessions: {id: string; label: string; students: Student[]}[];
  crossSession: Activity[];
  dailyRecordDrafts: {studentId: string; status: 'draft'; progress: string[]; homework: string[]; memo: string[]; evidenceIds: string[]; interviewRequired: string[]; savedToServer: false}[];
  relatedNotTodayAttendance: Record<string, string>[];
  evidence: Record<string, Evidence>;
  limitations: string[];
  historicalArtifactIndex: {path: string; scope: string}[];
}

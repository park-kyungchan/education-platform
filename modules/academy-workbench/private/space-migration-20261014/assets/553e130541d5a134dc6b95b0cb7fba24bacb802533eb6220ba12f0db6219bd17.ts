/** Structural contract only. This file contains no student records or source identifiers. */
export type CoverageStatus = 'observed_bounded' | 'not_checked' | 'ambiguous' | 'observed_absent' | 'complete_in_scope';
export type EvidenceLevel = 'observed' | 'observed_summary' | 'inferred_join' | 'not_checked';
export interface SourceRef { fileSha256: string; fileName: string; jsonPointer: string; evidenceLevel: EvidenceLevel }
export interface SourceTime {
  raw: string;
  precision: 'day' | 'minute' | 'second' | 'millisecond' | 'unknown';
  rawYear: string | null;
  yearStatus: 'observed_four_digit' | 'observed_two_digit_century_unknown' | 'unknown';
  inferredYear: number | null;
  inferenceBasis: string | null;
  timezone: string | null;
  timezoneStatus: 'observed' | 'unknown' | 'not_applicable';
}
export interface BaseRecord { id: string; source: SourceRef }
export interface Student extends BaseRecord { label: string; nativeStudentId: string | null }
export interface Enrollment extends BaseRecord {
  studentId: string; nativeEnrollmentId: string | null; kind: 'current_snapshot' | 'history_event';
  course: string; group: string; start: SourceTime; end: SourceTime; weekdays: string[];
  historyComplete: boolean;
}
export interface EnrollmentEvent extends BaseRecord {
  studentId: string; enrollmentId: string | null; nativeEventId: string | null;
  eventKind: 'admitted' | 'enrolled' | 'paused' | 'resumed' | 'withdrawn' | 'graduated' | 'course_changed' | 'group_changed' | 'other';
  effectiveAt: SourceTime; observedAt: SourceTime | null; value: Record<string, unknown>;
  supersedesEventId: string | null;
}
export interface BookEdition extends BaseRecord { bookCode: string; edition: number; title: string }
export interface OutlineSection extends BaseRecord {
  bookEditionId: string; unitLabel: string; unitTitle: string; sectionKey: string;
  sectionLabel: string; lessonIndex: number | null; catalogCode: string;
}
export interface RegisteredBook extends BaseRecord {
  studentId: string; bookEditionId: string | null; sourceBookCode: string; sourceEdition: number;
  sourceDateFields: SourceTime[]; dateFieldSemantics: 'unverified';
}
export type MappingReason = 'catalog_code_exact_in_normalized_source' | 'workbook_catalog_and_edition_not_observed' | 'section_alias_equivalence_unconfirmed' | 'unclassified_unresolved';
export interface Attempt extends BaseRecord {
  studentId: string; nativeAttemptId: string | null; outlineSectionId: string | null;
  normalizedSourceKey: string; mappingState: 'inferred_join' | 'unresolved'; mappingReason: MappingReason;
  unresolvedUnitLabel: string | null; displayedAt: SourceTime; score: number; clinicText: string;
  questionAnswersCoverage: 'not_checked'; paperCompletion: 'not_checked';
}
export interface DiarySummary extends BaseRecord { studentId: string; date: SourceTime; progressSummary: string; homeworkSummary: string }
export interface Attendance extends BaseRecord { studentId: string; date: SourceTime; sourceStatus: string; meaning: 'source_label_only' }
export interface VideoObservation extends BaseRecord {
  studentId: string; state: 'reviewed' | 'waiting'; unitText: string | null; displayedAt: SourceTime | null;
  stars: number | null; sourceFields: unknown[]; bookEditionLink: null;
}
export interface Assignment extends BaseRecord {
  studentId: string; nativeAssignmentId: string | null; assignmentDate: SourceTime; due: SourceTime;
  assignmentText: string; sourceBookText: string | null; sourceState: string;
  sourceBookTextState: 'observed' | 'source_null' | 'not_supplied';
  completion: 'not_checked'; teacherVerdict: 'not_checked';
}
export interface HomeworkSnapshot extends BaseRecord { studentId: string; due: SourceTime; observedFields: Record<string, unknown> }
export interface AssignmentCheck extends BaseRecord {
  studentId: string; assignmentId: string; scopeText: string; sourceState: string;
  observedFields: Record<string, unknown>; provesCompletion: false;
}
export interface PaperEvidence extends BaseRecord {
  studentId: string; assignmentId: string | null; attemptId: string | null;
  artifactSha256: string; pageRange: string | null; observation: string;
  completionClaim: 'not_checked' | 'observed_work_present';
}
export interface TeacherVerdict extends BaseRecord {
  studentId: string; assignmentId: string | null; attemptId: string | null;
  nativeTeacherId: string | null; observedAt: SourceTime; verdict: 'accepted' | 'revision_required' | 'incomplete' | 'other';
  teacherText: string; supersedesVerdictId: string | null;
}
export interface QuestionAnswer extends BaseRecord {
  studentId: string; attemptId: string; nativeQuestionId: string | null; questionNumber: string;
  questionVersion: string | null; studentAnswer: unknown; correctAnswer: unknown | null;
  responseStatus: 'answered' | 'blank' | 'skipped' | 'unavailable'; rubricVersion: string | null;
  result: 'correct' | 'incorrect' | 'ungraded' | 'unknown'; pointsEarned: number | null; pointsPossible: number | null;
  submittedAt: SourceTime | null; nativeAnswerId: string | null;
}
export interface AnswerEvent extends BaseRecord {
  studentId: string; attemptId: string; questionAnswerId: string | null; nativeEventId: string | null;
  eventKind: 'started' | 'answered' | 'changed' | 'submitted' | 'graded' | 'regraded' | 'other';
  effectiveAt: SourceTime; observedAt: SourceTime | null; payload: Record<string, unknown>;
  sequence: number | null; actorId: string | null;
  orderingBasis: 'native_sequence' | 'authoritative_time' | 'source_order_only' | 'unknown';
  supersedesEventId: string | null;
}
export interface Coverage {
  scope: string; status: CoverageStatus; completeness: 'bounded_only' | 'unknown' | 'complete_in_scope';
  availability: 'supplied' | 'not_supplied'; presence: 'observed_present' | 'observed_absent' | 'unknown';
  verification: 'independently_reconciled' | 'source_reported' | 'not_checked';
  count: number | null; reason: string; missingInputs: string[];
  proof: CoverageProof | null;
}
export interface CoverageProof {
  populationNativeIds: string[]; start: SourceTime; cutoff: SourceTime;
  expectedRecords: number; observedRecords: number; reconciledRecords: number;
  authoritativeReconciliation: SourceRef;
}
export interface IdentityBinding {
  snapshotEntityId: string; canonicalEntityId: string | null; entityKind: 'student' | 'book_edition';
  status: 'not_checked' | 'verified' | 'rejected'; evidence: SourceRef[];
  verificationMethod: 'authoritative_id_crosswalk' | 'explicit_user_verified' | null;
}
export interface ObservationEvent extends BaseRecord { studentId: string | null; observedAt: SourceTime | null; kind: 'execution' | 'recovery'; sourceFields: Record<string, unknown> }
export interface SourceManifest { fileName: string; fileSha256: string; bytes: number }
export interface HistoryDataset {
  schemaVersion: '1.0.0'; sourceArchiveSha256: string; sourceFiles: SourceManifest[];
  identityPolicy: 'source_snapshot_scoped_ids_no_longitudinal_identity_claim';
  students: Student[]; enrollments: Enrollment[]; enrollmentEvents: EnrollmentEvent[];
  bookEditions: BookEdition[]; outlineSections: OutlineSection[]; registeredBooks: RegisteredBook[];
  attempts: Attempt[]; diarySummaries: DiarySummary[]; attendance: Attendance[]; videos: VideoObservation[];
  assignments: Assignment[]; homeworkSnapshots: HomeworkSnapshot[]; assignmentChecks: AssignmentCheck[];
  paperEvidence: PaperEvidence[]; teacherVerdicts: TeacherVerdict[];
  questionAnswers: QuestionAnswer[]; answerEvents: AnswerEvent[]; observationEvents: ObservationEvent[];
  coverage: Coverage[];
}

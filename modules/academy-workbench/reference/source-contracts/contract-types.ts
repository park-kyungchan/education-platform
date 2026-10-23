/** Design-only source contract. No fetch, browser action, native call, or adapter registration. */
export type EvidenceGrade = 'current-source' | 'current-ui-read' | 'dated-source' | 'unmeasured';
export type Effect = 'read-view' | 'unknown' | 'reset-result' | 'session-change' | 'generate-paper' | 'native-report';
export type SourceId<K extends string> = string & { readonly sourceKind: K };
export type StudentKey = SourceId<'LMS.pri_no'>;
export type PaperKey = SourceId<'LMS.p_no'>;
export type TestingKey = SourceId<'LMS.testing_no'>;
export type CourseKey = SourceId<'LMS.course_key'>;
export type BookKey = SourceId<'LMS.book_no'>;
export type PrestudyKey = SourceId<'LMS.prestudy_key'>;
export type DayRecordKey = SourceId<'LMS.record_seq'>;
export type MobileUserKey = SourceId<'Mobile.unknown_user_key'>;

export interface EvidenceRef {
  file: string;
  pointer?: string;
  lines?: readonly [number, number];
  grade: EvidenceGrade;
  observedAt?: string;
}
export interface OccurrenceKey {
  student: StudentKey;
  paper: PaperKey;
  testing: TestingKey;
  assessment: 'DA' | 'FA' | 'NA';
}
export interface ReadSnapshot<T> {
  data: T;
  observedAt: string;
  source: EvidenceRef;
  completeness: 'bounded' | 'complete-for-request' | 'unknown';
  sourceRevision: string | null;
  atomicAcrossPages: false | 'separately-verified';
}
export interface SourceDeclaredOperation {
  id: string;
  path: string | null;
  selector: { key: string; literal: string } | null;
  sourceMethod: 'GET' | 'POST' | 'form-method-unavailable' | 'native-bridge';
  effect: Effect;
  effectBasis: 'current-ui-observation' | 'source-body' | 'historical-review' | 'unknown';
  fields: readonly string[];
  provenance: readonly EvidenceRef[];
  directApiAdapterActivated: false;
  mobileParityMeasured: false;
}
/** Similar names never authorize equality. A join must carry its measured source-key proof. */
export interface VerifiedJoin<A, B> {
  left: A;
  right: B;
  evidence: EvidenceRef;
  cardinality: 'one-to-one' | 'one-to-many' | 'many-to-many';
  taskScope: string;
}
export type RequiredState = 'assignment' | 'videoUploaded' | 'videoAnalyzed' | 'workSubmitted' | 'autoGraded' | 'teacherReviewed' | 'printed';
export type StateObservation = { state: 'unknown'; reason: string } | { state: 'observed'; value: unknown; evidence: EvidenceRef };
export type PreparationStates = Record<RequiredState, StateObservation>;

/** DOM-01 design contracts only. No runtime reducer, storage, or transport is introduced. */
import type {StudentLearningScene,DateClassPreparation,TeacherCohort,TrustedTeacherContext} from '../../apps/academy/dc-gang-a/src/academy/contracts/teacherOperations';
import type {TeacherActivityReview} from '../../apps/academy/dc-gang-a/src/academy/teacherWorkspace';
import type {Application as AssessmentApplication,SourcePort} from '../../apps/academy/month-end-workbench/src/contracts';

export type WorkflowId = 'class-preparation'|'lesson-delivery'|'progress-audit'|'homework-followup'|'assessment-preparation'|'wrong-answer-clinic'|'attendance-internal-journal';
export interface WorkflowSelection {
  id:WorkflowId;
  producers:readonly string[];
  contracts:readonly string[];
  currentConsumers:readonly string[];
  intendedConsumers:readonly string[];
  evidencePaths:readonly string[];
  demonstratedGaps:readonly string[];
  prohibitedInferences:readonly string[];
}

/** Proposed QRY-BOUNDARY facade subset: retain authenticated ingress and original return shapes. */
export interface RetainedTeacherQueryPort {
  student(context:TrustedTeacherContext,studentId:string,date?:string):Promise<StudentLearningScene>;
  cohort(context:TrustedTeacherContext):Promise<TeacherCohort>;
  classPreparation(context:TrustedTeacherContext,date:string):Promise<DateClassPreparation>;
}
export type RetainedTeacherResult = StudentLearningScene|DateClassPreparation|TeacherCohort;
export interface QualifiedQueryEnvelope<T extends RetainedTeacherResult> {
  schema:'academy.retained-query.proposal.v1';
  producer:{repositoryId:'park-kyungchan/education-platform';commit:string;contractPath:string};
  result:T;
  currentness:{state:'observed'|'unknown';sourceRevisionRefs:readonly string[];sourceObservedAt:string|null;lastVerifiedAt:string|null;retrievedAt:string;coverage:string};
  effects:{sourceWrites:false;parentSends:false;nativeActivation:false};
}
/** Aliases preserve maintained month-end ownership; assessment research is not a teacher-state reducer. */
export type AssessmentResearchPort=Pick<AssessmentApplication,'context'|'research'|'navigate'|'setScope'|'study'|'intent'|'sourceScope'|'find'|'review'|'alignmentProposal'|'snapshot'>;
export type AssessmentSourcePort=SourcePort;
export type ScopedTeacherFinal=Pick<TeacherActivityReview,'assignmentRevisionId'|'selectedItemIds'|'coverage'|'final'>;

/** Eligibility is a proposed query refinement, never a cancellation or completion event. */
interface AssessmentEligibilityIdentity {
  studentSourceKey:{namespace:string;literalKey:string};
  bookRegistrationRevisionId:string;
  assessmentAttemptRevisionId:string;
  explicitAssignmentRevisionIds:readonly string[];
  teacherReview:'not_inferred';
  finalCompletion:'not_inferred';
}
export type AssessmentEligibilityBasis=AssessmentEligibilityIdentity & (
  {score:{state:'verified_exact';value:100;sourceRevisionId:string};defaultWrongTarget:'excluded';defaultSimilarTarget:'excluded'} |
  {score:{state:'other_or_unknown';sourceRevisionId:string|null};defaultWrongTarget:'requires_exact_evidence';defaultSimilarTarget:'requires_exact_evidence'}
);

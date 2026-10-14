import type {StudentWorkspaceVersion} from '../ownerWorkspaceStore';
import type {CatalogNode,SourceKey,catalogLevels} from '../domain';
import type {AcademyRecord,TeacherObservation,TeacherObservationRequest} from '../records';
import type {TeacherClinicRevision,TeacherClinicRequest} from '../learningWork';
import type {RecordVersion,WriteAcknowledgement} from './storageRecords';
import type {StudentPreparationHistory} from '../preparationHistory';
import type {TeacherWorkContext} from '../teacherWorkContext';
import type {AcademySourceConnection} from '../nativeConnector';
import type {operationalContractShape} from '../operationalContract';
import type {DayRecordSourceRow} from '../../lms/dayRecordReadProtocol';
/** Shared human/agent contracts; authentication is issued by ingress, never by this type. */
export interface TrustedTeacherContext {readonly ownerId:string;readonly actorId:string;readonly role:'teacher'}
export interface ObservationInput {studentId:string;occurrence:TeacherObservation['occurrence'];basisRevisionId:string;expectedRevisionId:string|null;idempotencyKey:string;reportedAt:string;text:string}
export interface ClinicDecisionInput {studentId:string;assignmentRevisionId:string;attemptEntityId:string;attemptRevisionId:string;assignedItemId:string;effectiveDate:string;expectedRevisionId:string|null;expectedPolicyRevision:string;idempotencyKey:string;reportedAt:string;decision:TeacherClinicRevision['decision'];inspection:TeacherClinicRevision['inspection'];note:string}
type Scope={ownerId:string;actorId:string};
type TeacherObservationPolicy=typeof operationalContractShape.meaning.teacherAcceptance;
export type ObservationReceipt=WriteAcknowledgement&{record:RecordVersion;teacherObservationPolicy:TeacherObservationPolicy};
export type ClinicReceipt=WriteAcknowledgement&{record:RecordVersion};
export interface TeacherCohort {schemaVersion:1;kind:'teacher_cohort';scope:'registered_teacher_owned_students_not_scheduled_date_completeness';rowCount:number;teacherScope:Scope;availableLessonDates:string[];students:{id:string;displayName:string;registeredAt:string}[];connection:AcademySourceConnection;academyEffect:'read_only';officialSaved:false;parentSent:false}
export interface StudentLearningScene {
 teacherWorkspaces?:StudentWorkspaceVersion[];
 schemaVersion:1;kind:'student_learning_scene';student:{id:string;displayName:string;sourceKey:SourceKey;proofRefs:readonly string[]};sceneRevision:string;teacherScope:Scope;
 observationRecovery:{input:ObservationInput;actorId:string;ownerId:string;resolution:TeacherObservationRequest['resolution'];refusal:string|null}[];
 clinicRecovery:{input:ClinicDecisionInput;actorId:string;ownerId:string;resolution:TeacherClinicRequest['resolution'];refusal:string|null}[];
 books:{entityId:string;revisionId:string;displayName:string;sourceObservedAt:string;lastVerifiedAt:string;recordedAt:string;source:AcademyRecord}[];
 evidence:(RecordVersion&{lastVerifiedAt:string})[];catalog:CatalogNode[];preparation:StudentPreparationHistory;workContext:TeacherWorkContext;
 hierarchy:{levels:typeof catalogLevels;unknownLevels:(typeof catalogLevels)[number][]};
 knowledge:{mastery:'not_established';teacherInspection:'unknown';effectiveEnrollment:'unknown';scheduledLessonCompleteness:'unknown';sourceFreshness:'last_successful_acquisition_not_view_time'};
 connection:AcademySourceConnection;allowedOperations:string[];teacherObservationPolicy:TeacherObservationPolicy;limits:string[];officialSaved:false;parentSent:false;
}
export interface DateClassRow {studentId:string;studentName:string;occurrence:TeacherObservation['occurrence'];fields:DayRecordSourceRow['fields'];revisionId:string;sourceObservedAt:string;lastVerifiedAt:string;preparation:StudentPreparationHistory;knowledge:{prestudyHomeworkJoin:'unknown';homeworkAttemptJoin:'unknown';correctionInspection:'unknown';teacherReview:'unknown'}}
export interface DateClassPreparation {schemaVersion:1;kind:'date_class_preparation';date:string;rows:DateClassRow[];rowCount:number;scope:'verified_occurrences_in_observed_calendar_window_not_all_history';connection:AcademySourceConnection;knowledge:{missingRows:'not_evidence_of_absence_or_nonperformance';completeCurrentRoster:'not_established'};officialSaved:false;parentSent:false}

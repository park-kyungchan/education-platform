import { assertDate, assertExactKeys, assertInstant, assertKnowledge, assertRefs, canonicalJson, requireText, type Knowledge } from '../learning/model';
import { createAcademySourceAudit } from '../lms/academySourceAudit';
import { validateSourceKey, type SourceKey } from './domain';
import {validateCourseInventory,validatePrestudySnapshot,validatePreparationScope,type SourceCourseInventory,type SourcePrestudySnapshot,type TeacherBookPreparationScope} from './bookPreparation';
import {requirementsForSeries,type CycleActivity} from './classroomCyclePolicy';
import {validateLearningAssignment,validateLearningAttempt,validateTeacherClinic,validateClinicRequest,type LearningWorkAssignment,type LearningWorkAttempt,type TeacherClinicRevision,type TeacherClinicRequest} from './learningWork';

/** A current source registration, deliberately not inferred effective enrollment or teacher book-slot assignment. */
export interface SourceBookRegistration {
  readonly kind: 'source_book_registration'; readonly sourceStudent: SourceKey;
  readonly sourceCourse: SourceKey; readonly sourceUserCourse: SourceKey; readonly sourceBook: SourceKey;
  readonly catalogNodeId: string; readonly sourceCourseLabel: string; readonly sourceBookLabel: string;
  readonly sourceStatus: string; readonly sourceProgressLiteral: string; readonly sourceLearningRangeLiteral: string;
  readonly assignmentValidity: Knowledge<string>; readonly role: Knowledge<string>;
  readonly contractRef: string; readonly evidenceRefs: readonly string[];
}
export interface SourceAuditRecord { readonly kind: 'source_audit'; readonly acquisition: Parameters<typeof createAcademySourceAudit>[0]; readonly contractRef: string }
export interface TeacherReportedNote { readonly kind: 'teacher_reported_note'; readonly text: string; readonly directiveRef: string }
/** Teacher planning only; occurrence binds the target lesson, never the origin lesson.
 * Unknown identity/date links remain explicit nulls, even when another link is known. */
export interface TeacherLessonCarryover {
  readonly kind:'teacher_lesson_carryover'; readonly sourceStudent:SourceKey;
  readonly sourceCourse:SourceKey|null; readonly sourceBook:SourceKey|null; readonly sourceMinorUnit:SourceKey|null;
  readonly activity:CycleActivity; readonly status:'reminder';
  readonly originDate:string|null; readonly targetDate:string|null; readonly occurrence:ObservationOccurrence|null;
  readonly text:string; readonly directiveRef:string; readonly evidenceRefs:readonly string[];
}
export interface ObservationOccurrence { date:string; groupId:string; courseKey:string; recordKey:string; membershipKey:string }
/** An attributable original/correction, never an inspection approval, official save or delivery receipt. */
export interface TeacherObservation {
  kind:'teacher_observation';sourceStudent:SourceKey;occurrence:ObservationOccurrence;
  basisRevisionId:string;reportedAt:string;text:string;
}
/** A protected submitted original is not an accepted observation or teacher approval. */
export interface TeacherObservationRequest {
  kind:'teacher_observation_request';sourceStudent:SourceKey;requestId:string;
  expectedRevisionId:string|null;observation:TeacherObservation;resolution:'pending'|'rejected';refusal:string|null;
}
export const observationTerminalRefusals:readonly string[]=['stale_base','stale_evidence_basis','observation_basis_conflict','observation_identity_changed','invalid_revision_transition','unresolved_observation_request','idempotency_reuse'];
export class ObservationCommandRefusal extends Error {constructor(code:string,readonly originalRetained:boolean){super(code);}}
/** Trusted intake attributes the report; this label is not authentication or an actual performance timestamp. */
export interface TeacherActivityRevision {
  kind:'teacher_activity_revision';sourceStudent:SourceKey;sourceCourse:SourceKey;sourceBook:SourceKey;sourceMinorUnit:SourceKey;
  activity:CycleActivity;scope:'minor_unit';decision:'accepted'|'reopen';effectiveDate:string;
  authority:'explicit_teacher_report';directiveRef:string;evidenceRefs:readonly string[];
}
export interface TeacherPreparationAssignment extends Omit<TeacherBookPreparationScope,'kind'> {
  kind:'teacher_preparation_assignment';sourceStudent:SourceKey;effectiveDate:string;
}
export type AcademyRecord = SourceBookRegistration | SourceAuditRecord | TeacherReportedNote | TeacherLessonCarryover | TeacherObservation | TeacherObservationRequest | SourceCourseInventory | SourcePrestudySnapshot | TeacherActivityRevision | TeacherPreparationAssignment | LearningWorkAssignment | LearningWorkAttempt | TeacherClinicRevision | TeacherClinicRequest;
export function validateAcademyRecord(payload: AcademyRecord): void {
  canonicalJson(payload);
  if(payload.kind==='teacher_lesson_carryover'){
    assertExactKeys(payload,['kind','sourceStudent','sourceCourse','sourceBook','sourceMinorUnit','activity','status','originDate','targetDate','occurrence','text','directiveRef','evidenceRefs']);
    validateSourceKey(payload.sourceStudent);
    if(payload.sourceStudent.namespace!=='academy_student')throw Error('source_namespace_conflict');
    for(const [key,namespace] of [[payload.sourceCourse,'academy_course'],[payload.sourceBook,'academy_book'],[payload.sourceMinorUnit,'academy_minor_unit']] as const){
      if(key!==null){validateSourceKey(key);if(key.namespace!==namespace)throw Error('source_namespace_conflict');}
    }
    if(payload.status!=='reminder'||!requirementsForSeries('gauss').some(row=>row.activity===payload.activity))throw Error('invalid_lesson_carryover');
    for(const date of [payload.originDate,payload.targetDate])if(date!==null)assertDate(date);
    if(payload.occurrence!==null){
      assertExactKeys(payload.occurrence,['date','groupId','courseKey','recordKey','membershipKey']);assertDate(payload.occurrence.date);
      if(payload.targetDate!==null&&payload.targetDate!==payload.occurrence.date)throw Error('carryover_target_occurrence_conflict');
      if(payload.sourceCourse!==null&&payload.sourceCourse.literalKey!==payload.occurrence.courseKey)throw Error('carryover_course_occurrence_conflict');
      for(const field of ['groupId','courseKey','recordKey','membershipKey'] as const){
        const key=payload.occurrence[field];if(typeof key!=='string'||!/^[1-9][0-9]*$/.test(key)||!Number.isSafeInteger(Number(key)))throw Error('invalid_observation_occurrence');
      }
    }
    requireText(payload.text,'teacher carryover');requireText(payload.directiveRef,'teacher directive');assertRefs(payload.evidenceRefs);
    if(payload.text.length>16000)throw Error('teacher_note_too_large');return;
  }
  if(payload.kind==='learning_work_assignment'){validateLearningAssignment(payload);return;}
  if(payload.kind==='learning_work_attempt'){validateLearningAttempt(payload);return;}
  if(payload.kind==='teacher_clinic_revision'){validateTeacherClinic(payload);return;}
  if(payload.kind==='teacher_clinic_request'){validateClinicRequest(payload);return;}
  if(payload.kind==='teacher_observation_request'){
    assertExactKeys(payload,['kind','sourceStudent','requestId','expectedRevisionId','observation','resolution','refusal']);
    validateSourceKey(payload.sourceStudent);requireText(payload.requestId,'observation request');
    if(payload.requestId.length>200||payload.sourceStudent.namespace!=='academy_student'||payload.observation.kind!=='teacher_observation')throw Error('invalid_observation_request');
    if(payload.expectedRevisionId!==null){requireText(payload.expectedRevisionId,'observation predecessor');if(payload.expectedRevisionId.length>200)throw Error('invalid_observation_request');}
    validateAcademyRecord(payload.observation);
    if(canonicalJson(payload.sourceStudent)!==canonicalJson(payload.observation.sourceStudent)||!['pending','rejected'].includes(payload.resolution)
      ||(payload.resolution==='pending'?payload.refusal!==null:typeof payload.refusal!=='string'||!observationTerminalRefusals.includes(payload.refusal)))throw Error('invalid_observation_request');
    return;
  }
  if(payload.kind==='teacher_observation'){
    assertExactKeys(payload,['kind','sourceStudent','occurrence','basisRevisionId','reportedAt','text']);
    validateSourceKey(payload.sourceStudent);if(payload.sourceStudent.namespace!=='academy_student')throw Error('source_namespace_conflict');
    assertExactKeys(payload.occurrence,['date','groupId','courseKey','recordKey','membershipKey']);
    const date=payload.occurrence.date;
    if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw Error('invalid_observation_date');
    for(const field of ['groupId','courseKey','recordKey','membershipKey'] as const){const key=payload.occurrence[field];if(typeof key!=='string'||!/^[1-9][0-9]*$/.test(key)||!Number.isSafeInteger(Number(key)))throw Error('invalid_observation_occurrence');}
    requireText(payload.basisRevisionId,'evidence basis');requireText(payload.text,'teacher observation');assertInstant(payload.reportedAt);
    if(payload.basisRevisionId.length>200||payload.text.length>16000)throw Error('observation_too_large');return;
  }
  if(payload.kind==='source_course_inventory'){validateCourseInventory(payload);return;}
  if(payload.kind==='source_prestudy_snapshot'){validatePrestudySnapshot(payload);return;}
  if(payload.kind==='teacher_preparation_assignment'){
    validateSourceKey(payload.sourceStudent);if(payload.sourceStudent.namespace!=='academy_student')throw Error('source_namespace_conflict');
    const {kind,sourceStudent,effectiveDate,...scope}=payload;
    validatePreparationScope({kind:'teacher_book_preparation_scope',...scope});
    if(!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)||!Number.isFinite(Date.parse(effectiveDate+'T00:00:00Z'))||new Date(effectiveDate+'T00:00:00Z').toISOString().slice(0,10)!==effectiveDate)throw Error('invalid_preparation_date');return;
  }
  if(payload.kind==='teacher_activity_revision'){
    assertExactKeys(payload,['kind','sourceStudent','sourceCourse','sourceBook','sourceMinorUnit','activity','scope','decision','effectiveDate','authority','directiveRef','evidenceRefs']);
    for(const [key,namespace] of [[payload.sourceStudent,'academy_student'],[payload.sourceCourse,'academy_course'],[payload.sourceBook,'academy_book'],[payload.sourceMinorUnit,'academy_minor_unit']] as const){validateSourceKey(key);if(key.namespace!==namespace)throw Error('source_namespace_conflict');}
    if(payload.scope!=='minor_unit'||payload.authority!=='explicit_teacher_report'||!['accepted','reopen'].includes(payload.decision)||!requirementsForSeries('gauss').some(r=>r.activity===payload.activity&&r.completionAuthority==='explicit_teacher_judgment'))throw Error('teacher_activity_authority');
    const date=payload.effectiveDate;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw Error('invalid_preparation_date');
    requireText(payload.directiveRef,'teacher directive');assertRefs(payload.evidenceRefs);return;
  }
  if (payload.kind === 'source_book_registration') {
    assertExactKeys(payload, ['kind','sourceStudent','sourceCourse','sourceUserCourse','sourceBook','catalogNodeId','sourceCourseLabel','sourceBookLabel','sourceStatus','sourceProgressLiteral','sourceLearningRangeLiteral','assignmentValidity','role','contractRef','evidenceRefs']);
    for (const [key, namespace] of [[payload.sourceStudent,'academy_student'],[payload.sourceCourse,'academy_course'],[payload.sourceUserCourse,'academy_user_course'],[payload.sourceBook,'academy_book']] as const) {
      validateSourceKey(key); if (key.namespace !== namespace) throw Error('source_namespace_conflict');
    }
    for (const text of [payload.catalogNodeId,payload.sourceCourseLabel,payload.sourceBookLabel,payload.sourceStatus,payload.sourceProgressLiteral,payload.sourceLearningRangeLiteral,payload.contractRef]) { requireText(text,'source book field'); if (text.length>16000) throw Error('source_field_too_large'); }
    assertKnowledge<string>(payload.assignmentValidity, value => requireText(value,'assignment validity'));
    assertKnowledge<string>(payload.role, value => requireText(value,'book role'));
    assertRefs(payload.evidenceRefs);
    return;
  }
  if (payload.kind === 'source_audit') {
    assertExactKeys(payload,['kind','acquisition','contractRef']); requireText(payload.contractRef,'source contract');
    createAcademySourceAudit(payload.acquisition); return;
  }
  if (payload.kind === 'teacher_reported_note') {
    assertExactKeys(payload,['kind','text','directiveRef']); requireText(payload.text,'teacher note'); requireText(payload.directiveRef,'attributable directive');
    if (payload.text.length>16000) throw Error('teacher_note_too_large'); return;
  }
  throw Error('unsupported_academy_record');
}

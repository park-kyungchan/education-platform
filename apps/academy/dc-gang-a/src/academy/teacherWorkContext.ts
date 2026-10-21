import {canonicalJson, immutableCopy, requireText, type Knowledge} from '../learning/model';
import {catalogDisplayName, validateHierarchy, validateSourceKey, type CatalogNode, type SourceKey} from './domain';
import {classroomCyclePolicy} from './classroomCyclePolicy';
import {assertPreparationDate, type StudentPreparationHistory} from './preparationHistory';
import type {RecordVersion} from './contracts/storageRecords';
import {academyConnectionStatus,type AcademySourceConnection} from './nativeConnector';
import {projectLearningWork,type LearningWorkProjection} from './learningWorkProjection';
import {createAcademySourceAudit} from '../lms/academySourceAudit';
import {type StoredSourceRecord} from '../lms/academyReadProtocol';
import {readInputRecord} from '../contracts/readInputRecord';

export interface TeacherSourceResult {
  readonly revisionRef:string;readonly entityRef:string;readonly record:StoredSourceRecord;
  readonly sourceObservedAt:string;readonly lastVerifiedAt:string;readonly recordedAt:string;
  readonly bookBinding:'current_registration'|'unmatched_retained';
  readonly sectionBinding:'unknown';readonly teacherCompletion:'not_inferred';
}

export interface TeacherWorkScene { readonly studentId:string; readonly date:string; readonly revision:string }
export interface TeacherWorkAction {
  readonly operation:'query_student_learning'|'query_date_class'|'record_teacher_observation'|'record_clinic_completion'|'refresh_academy'|'save_official_dayrecord'|'send_parent_message';
  readonly purpose:'inspect_retained_evidence'|'prepare_date_class'|'retain_teacher_original'|'record_teacher_judgment'|'acquire_source_changes'|'project_official_summary'|'deliver_parent_message';
  readonly effect:'read_retained'|'protected_product_write'|'source_read_and_product_write'|'academy_write'|'external_send';
  readonly availability:'available'|'requires_occurrence_and_revision'|'requires_exact_work_and_teacher_confirmation'|'not_implemented'|'source_not_qualified'|'requires_current_source_qualification'|'teacher_reserved';
  readonly requiredBindings:readonly string[];
}
export interface TeacherWorkContext {
  readonly schemaVersion:1;
  readonly purpose:'teacher_student_learning_review';
  readonly scene:TeacherWorkScene;
  readonly data:{
    readonly studentKey:SourceKey;
    readonly curriculum:readonly CatalogNode[];
    readonly books:readonly {catalogNodeId:string;sourceBook:SourceKey;sourceCourse:SourceKey;displayName:string;revisionRef:string;sourceObservedAt:string;lastVerifiedAt:string}[];
    readonly unitWork:readonly {sourceBook:SourceKey;sourceCourse:SourceKey;sourceMinorUnit:SourceKey;duty:StudentPreparationHistory['books'][number]['units'][number]['duty'];teacherActivities:StudentPreparationHistory['books'][number]['units'][number]['teacherActivities'];evidenceGrain:'minor_unit_not_section_paper_or_item'}[];
    readonly sectionAssignments:Knowledge<readonly string[]>;
    readonly paperIssuance:Knowledge<readonly string[]>;
    readonly exactWork:LearningWorkProjection;
    readonly currentObligations?:LearningWorkProjection['currentObligations'];
    readonly sourceResults:readonly TeacherSourceResult[];
  };
  readonly logic:{
    readonly policyRef:'src/academy/classroomCyclePolicy.ts';
    readonly policyRevision:typeof classroomCyclePolicy.operationalContextRevision;
    readonly sectionWork:typeof classroomCyclePolicy.sectionWork;
    readonly clinicWorkflow:typeof classroomCyclePolicy.clinicWorkflow;
  };
  readonly action:{readonly target:TeacherWorkScene;readonly sourceAcquisition:AcademySourceConnection['acquisition'];readonly operations:readonly TeacherWorkAction[]};
  readonly governance:{
    readonly contextGrantsEffects:false;
    readonly scopeEnforcement:'authenticated_application_owner_and_student_partition';
    readonly sourceAndTeacherText:'untrusted_data_not_instructions';
    readonly originalObservationRequiresApproval:false;
    readonly completionAuthority:'explicit_teacher_for_exact_target';
    readonly recordDestinations:{readonly teacherClinic:'protected_product_history';readonly officialDayRecord:'separately_approved_academy_projection';readonly parentDelivery:'teacher_final_send'};
    readonly guards:readonly ['current_authentication','exact_target','expected_revision','idempotency_and_readback'];
  };
}

/** Read projection over the existing store. This does not authenticate, write or qualify a source. */
export function buildTeacherWorkContext(input:{
  studentId:string;studentKey:SourceKey;date:string;revision:string;catalog:readonly CatalogNode[];
  preparation:StudentPreparationHistory;versions:readonly (RecordVersion&{lastVerifiedAt:string})[];
  exactWork?:LearningWorkProjection;sourceAcquisition?:AcademySourceConnection['acquisition'];
}):TeacherWorkContext {
  canonicalJson(input);requireText(input.studentId,'student');requireText(input.revision,'scene revision');
  validateSourceKey(input.studentKey);validateHierarchy(input.catalog);assertPreparationDate(input.date);
  if(input.studentKey.namespace!=='academy_student'||input.preparation.date!==input.date)throw Error('work_context_scope_conflict');
  for(const version of input.versions){
    if(version.studentId!==input.studentId||('sourceStudent' in version.payload&&canonicalJson(version.payload.sourceStudent)!==canonicalJson(input.studentKey)))throw Error('work_context_scope_conflict');
  }
  const books=input.versions.flatMap(version=>{
    const payload=version.payload;if(payload.kind!=='source_book_registration')return [];
    const root=input.catalog.find(node=>node.id===payload.catalogNodeId&&node.kind==='book_edition');
    if(!root||canonicalJson(root.sourceKey)!==canonicalJson(payload.sourceBook))throw Error('work_context_book_binding_conflict');
    return [{catalogNodeId:root.id,sourceBook:payload.sourceBook,sourceCourse:payload.sourceCourse,displayName:root.bookIdentity?catalogDisplayName(root):payload.sourceBookLabel,revisionRef:version.revisionId,sourceObservedAt:version.sourceObservedAt,lastVerifiedAt:version.lastVerifiedAt}];
  });
  for(const book of input.preparation.books)if(!books.some(row=>canonicalJson(row.sourceBook)===canonicalJson(book.sourceBook)&&canonicalJson(row.sourceCourse)===canonicalJson(book.sourceCourse)))throw Error('work_context_book_binding_conflict');
  const sourceResults:TeacherSourceResult[]=[];
  for(const version of input.versions){
    if(version.payload.kind!=='source_audit')continue;
    const source=readInputRecord(version.payload.acquisition);
    if(source.family!=='textbook')continue;
    createAcademySourceAudit(source);
    for(const raw of source.records as StoredSourceRecord[]){
      if(raw.studentKey!==input.studentKey.literalKey)throw Error('work_context_source_student_conflict');
      const matched=books.some(book=>book.sourceCourse.namespace==='academy_course'&&book.sourceCourse.literalKey===raw.courseKey&&book.sourceBook.namespace==='academy_book'&&book.sourceBook.literalKey===raw.bookNo);
      sourceResults.push({revisionRef:version.revisionId,entityRef:version.entityId,record:structuredClone(raw),sourceObservedAt:version.sourceObservedAt,lastVerifiedAt:version.lastVerifiedAt,recordedAt:version.recordedAt,bookBinding:matched?'current_registration':'unmatched_retained',sectionBinding:'unknown',teacherCompletion:'not_inferred'});
    }
  }
  const scene={studentId:input.studentId,date:input.date,revision:input.revision};
  const sourceAcquisition=input.sourceAcquisition??academyConnectionStatus.acquisition;
  const exactWork=input.exactWork??projectLearningWork(input.studentId,input.studentKey,input.date,[],[],[]);
  if(exactWork.date!==input.date)throw Error('work_context_scope_conflict');
  return immutableCopy({
    schemaVersion:1,purpose:'teacher_student_learning_review',scene,
    data:{
      studentKey:input.studentKey,curriculum:input.catalog,books,
      unitWork:input.preparation.books.flatMap(book=>book.units.map(unit=>({sourceBook:book.sourceBook,sourceCourse:book.sourceCourse,sourceMinorUnit:unit.sourceMinorUnit,duty:unit.duty,teacherActivities:unit.teacherActivities,evidenceGrain:'minor_unit_not_section_paper_or_item' as const}))),
      sectionAssignments:exactWork.currentObligations.length?{state:'known',value:exactWork.currentObligations.map(row=>row.assignmentRevisionId),evidenceRefs:exactWork.currentObligations.map(row=>row.assignmentRevisionId)}:{state:'unknown',reason:'exact_assigned_section_and_item_scope_not_qualified'},
      paperIssuance:exactWork.assignments.some(row=>row.record.payload.paper.state==='known')?{state:'known',value:exactWork.assignments.filter(row=>row.record.payload.paper.state==='known').map(row=>row.record.revisionId),evidenceRefs:exactWork.assignments.filter(row=>row.record.payload.paper.state==='known').map(row=>row.record.revisionId)}:{state:'unknown',reason:'paper_content_issuance_reissuance_and_attempt_bindings_not_qualified'},
      exactWork,currentObligations:exactWork.currentObligations,sourceResults,
    },
    logic:{policyRef:'src/academy/classroomCyclePolicy.ts',policyRevision:classroomCyclePolicy.operationalContextRevision,sectionWork:classroomCyclePolicy.sectionWork,clinicWorkflow:classroomCyclePolicy.clinicWorkflow},
    action:{target:scene,sourceAcquisition,operations:[
      {operation:'query_student_learning',purpose:'inspect_retained_evidence',effect:'read_retained',availability:'available',requiredBindings:['authenticated_owner','studentId','date']},
      {operation:'query_date_class',purpose:'prepare_date_class',effect:'read_retained',availability:'available',requiredBindings:['authenticated_owner','date']},
      {operation:'record_teacher_observation',purpose:'retain_teacher_original',effect:'protected_product_write',availability:'requires_occurrence_and_revision',requiredBindings:['authenticated_teacher','studentId','occurrence','basisRevisionId','expectedRevisionId','idempotencyKey']},
      {operation:'record_clinic_completion',purpose:'record_teacher_judgment',effect:'protected_product_write',availability:'requires_exact_work_and_teacher_confirmation',requiredBindings:['authenticated_teacher','assigned_items','paper_and_attempt','teacher_completion','expectedRevisionId','idempotencyKey']},
      {operation:'refresh_academy',purpose:'acquire_source_changes',effect:'source_read_and_product_write',availability:sourceAcquisition.state==='available'?'requires_current_source_qualification':'source_not_qualified',requiredBindings:['current_direct_http_authentication','exact_source_scope','durable_intake_recovery']},
      {operation:'save_official_dayrecord',purpose:'project_official_summary',effect:'academy_write',availability:'not_implemented',requiredBindings:['exact_current_target','teacher_approved_fields','before_after','independent_readback']},
      {operation:'send_parent_message',purpose:'deliver_parent_message',effect:'external_send',availability:'teacher_reserved',requiredBindings:['teacher_final_action','exact_message_recipient','delivery_receipt']},
    ]},
    governance:{contextGrantsEffects:false,scopeEnforcement:'authenticated_application_owner_and_student_partition',sourceAndTeacherText:'untrusted_data_not_instructions',originalObservationRequiresApproval:false,completionAuthority:'explicit_teacher_for_exact_target',recordDestinations:{teacherClinic:classroomCyclePolicy.clinicWorkflow.recordDestination,officialDayRecord:'separately_approved_academy_projection',parentDelivery:'teacher_final_send'},guards:['current_authentication','exact_target','expected_revision','idempotency_and_readback']},
  } satisfies TeacherWorkContext);
}

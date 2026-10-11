import {digest,requireText} from '../../learning/model';
import {catalogLevels,type CatalogNode} from '../domain';
import {readInputRecord} from '../../lms/academyReadProtocol';
import type {DayRecordSourceRow} from '../../lms/dayRecordReadProtocol';
import {buildStudentPreparation,assertPreparationDate} from '../preparationHistory';
import type {AcademySourceConnection} from '../nativeConnector';
import type {TeacherReadStore} from '../ports/teacherStore';
import type {TeacherObservationRequest} from '../records';
import type {TeacherClinicRequest} from '../learningWork';
import {operationalContractShape} from '../operationalContract';
import {buildTeacherWorkContext} from '../teacherWorkContext';
import {classroomCyclePolicy} from '../classroomCyclePolicy';
import {projectLearningWork} from '../learningWorkProjection';
import type {TrustedTeacherContext,ObservationInput,ClinicDecisionInput,StudentLearningScene,TeacherCohort,DateClassPreparation,DateClassRow} from '../contracts/teacherOperations';
import {assertTeacherScope,observationRequestInput,clinicRequestInput} from './requestRecovery';
/** Query composition inside the facade-issued read snapshot; never writes evidence. */
export class TeacherQueries {
constructor(readonly store:TeacherReadStore,readonly ownerId:string,readonly connection:()=>AcademySourceConnection){}
async cohort(context:TrustedTeacherContext):Promise<TeacherCohort> {
    assertTeacherScope(this.ownerId,context);
    const students=await this.store.students(this.ownerId);
    const dates=new Set<string>();
    for(const student of students)for(const row of await this.store.current(this.ownerId,student.id)){
      if(row.payload.kind!=='source_audit')continue;
      const snapshot=readInputRecord(row.payload.acquisition);
      if(snapshot.family==='day_record'&&Array.isArray(snapshot.dayRecords))for(const lesson of snapshot.dayRecords as DayRecordSourceRow[])dates.add(lesson.date);
    }
    return {schemaVersion:1,kind:'teacher_cohort',scope:'registered_teacher_owned_students_not_scheduled_date_completeness',rowCount:students.length,
      teacherScope:{ownerId:this.ownerId,actorId:context.actorId},availableLessonDates:[...dates].sort(),
      students:students.map(student=>({id:student.id,displayName:student.displayName,registeredAt:student.registeredAt})),connection:this.connection(),academyEffect:'read_only',officialSaved:false,parentSent:false};
  }
async student(context:TrustedTeacherContext,studentId:string,date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())):Promise<StudentLearningScene> {
    assertTeacherScope(this.ownerId,context);requireText(studentId,'student id');if(studentId.length>200)throw Error('invalid_student_selector');
    assertPreparationDate(date);
    const student=(await this.store.students(this.ownerId)).find(row=>row.id===studentId);
    if(!student)throw Error('student_scope_conflict');
    const [storedCurrent,catalog,revisions]=await Promise.all([this.store.current(this.ownerId,studentId),this.store.catalog(this.ownerId),this.store.preparationRevisions(this.ownerId,studentId,date)]);
    const current=storedCurrent.filter(v=>v.payload.kind!=='teacher_clinic_request'&&v.payload.kind!=='teacher_observation_request');
    const observationRecovery:{input:ObservationInput;actorId:string;ownerId:string;resolution:TeacherObservationRequest['resolution'];refusal:string|null}[]=[];
    for(const row of storedCurrent){
      const request=row.payload;if(request.kind!=='teacher_observation_request'||row.actorId!==context.actorId)continue;
      if(await this.store.observationResult(this.ownerId,studentId,context.actorId,request.requestId))continue;
      observationRecovery.push({input:observationRequestInput(studentId,request),actorId:row.actorId,ownerId:this.ownerId,resolution:request.resolution,refusal:request.refusal});
    }
    const clinicRecovery:{input:ClinicDecisionInput;actorId:string;ownerId:string;resolution:TeacherClinicRequest['resolution'];refusal:string|null}[]=[];
    for(const row of storedCurrent){
      const request=row.payload;if(request.kind!=='teacher_clinic_request'||row.actorId!==context.actorId)continue;
      if(await this.store.clinicResult(this.ownerId,studentId,context.actorId,request.requestId))continue;
      clinicRecovery.push({input:clinicRequestInput(studentId,request),actorId:row.actorId,ownerId:this.ownerId,resolution:request.resolution,refusal:request.refusal});
    }
    const preparationVersions=[...new Map([...current,...revisions].map(v=>[v.revisionId,v])).values()];
    const catalogRefs=preparationVersions.flatMap(v=>v.payload.kind==='learning_work_assignment'?v.payload.catalogRefs:[]);
    const pinned=catalogRefs.length?await this.store.pinnedCatalog(this.ownerId,catalogRefs):[];
    const exactWork=projectLearningWork(studentId,student.sourceKey,date,preparationVersions,current,pinned);
    const bookSources=current.filter(row=>row.payload.kind==='source_book_registration');
    const rootIds=new Set(bookSources.map(row=>row.payload.kind==='source_book_registration'?row.payload.catalogNodeId:''));
    const nodes=new Map(catalog.map(node=>[node.id,node]));
    const belongs=(node:CatalogNode):boolean=>{
      let currentNode:CatalogNode|undefined=node;
      while(currentNode){if(rootIds.has(currentNode.id))return true;if(currentNode.parent.state==='unknown')return false;currentNode=nodes.get(currentNode.parent.value);}
      return false;
    };
    const selectedCatalog=catalog.filter(belongs);
    const sceneRevision=digest({studentId,date,heads:current.map(row=>({revisionId:row.revisionId,lastVerifiedAt:row.lastVerifiedAt})),teacherRevisions:revisions.map(v=>v.revisionId),catalog:selectedCatalog,workContextSchema:'1-source-results-r1',policyRevision:classroomCyclePolicy.operationalContextRevision});
    const preparation=buildStudentPreparation(student.sourceKey,preparationVersions,date);
    const connection=this.connection();
    const workContext=buildTeacherWorkContext({studentId,studentKey:student.sourceKey,date,revision:sceneRevision,catalog:selectedCatalog,preparation,versions:current,exactWork,sourceAcquisition:connection.acquisition});
    return {schemaVersion:1,kind:'student_learning_scene',student:{id:student.id,displayName:student.displayName,sourceKey:student.sourceKey,proofRefs:student.proofRefs},
      sceneRevision,
      teacherScope:{ownerId:this.ownerId,actorId:context.actorId},
      observationRecovery,
      clinicRecovery,
      books:bookSources.map(row=>({entityId:row.entityId,revisionId:row.revisionId,displayName:workContext.data.books.find(book=>book.revisionRef===row.revisionId)!.displayName,sourceObservedAt:row.sourceObservedAt,lastVerifiedAt:row.lastVerifiedAt,recordedAt:row.recordedAt,source:row.payload})),
      evidence:current.filter(row=>row.payload.kind!=='source_book_registration'),catalog:selectedCatalog,
      preparation,
      workContext,
      hierarchy:{levels:catalogLevels,unknownLevels:catalogLevels.filter(kind=>!selectedCatalog.some(node=>node.kind===kind))},
      knowledge:{mastery:'not_established',teacherInspection:'unknown',effectiveEnrollment:'unknown',scheduledLessonCompleteness:'unknown',sourceFreshness:'last_successful_acquisition_not_view_time'},
      connection,allowedOperations:['query_student_learning','query_date_class','record_teacher_observation'],
      teacherObservationPolicy:operationalContractShape.meaning.teacherAcceptance,
      limits:['Source registration/learning range is not effective enrollment or book-slot judgment','No missing evidence becomes nonperformance','Printed paper, board and video labels remain separate source namespaces','Current sources do not prove full historical/native-app coverage'],
      officialSaved:false,parentSent:false};
  }
async classPreparation(context:TrustedTeacherContext,date:string):Promise<DateClassPreparation>{
    assertTeacherScope(this.ownerId,context);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw Error('invalid_lesson_date');
    const students=await this.store.students(this.ownerId);
    const rows:DateClassRow[]=[];
    for(const student of students){
      const [current,revisions]=await Promise.all([this.store.current(this.ownerId,student.id),this.store.preparationRevisions(this.ownerId,student.id,date)]);
      const preparation=buildStudentPreparation(student.sourceKey,[...new Map([...current,...revisions].map(v=>[v.revisionId,v])).values()],date);
      for(const version of current){
        if(version.payload.kind!=='source_audit')continue;
        const snapshot=readInputRecord(version.payload.acquisition);
        if(snapshot.family!=='day_record'||!Array.isArray(snapshot.dayRecords))continue;
        for(const source of snapshot.dayRecords as DayRecordSourceRow[]){
          if(source.date!==date)continue;
          if(source.studentKey!==student.sourceKey.literalKey||source.studentName!==student.displayName)throw Error('stored_source_subject_conflict');
          rows.push({studentId:student.id,studentName:student.displayName,occurrence:{date:source.date,groupId:source.groupId,courseKey:source.courseKey,recordKey:source.recordKey,membershipKey:source.membershipKey},fields:source.fields,
            revisionId:version.revisionId,sourceObservedAt:version.sourceObservedAt,lastVerifiedAt:version.lastVerifiedAt,
            preparation,knowledge:{prestudyHomeworkJoin:'unknown',homeworkAttemptJoin:'unknown',correctionInspection:'unknown',teacherReview:'unknown'}});
        }
      }
    }
    rows.sort((a,b)=>a.studentName.localeCompare(b.studentName,'ko')||a.occurrence.recordKey.localeCompare(b.occurrence.recordKey));
    return {schemaVersion:1,kind:'date_class_preparation',date,rows,rowCount:rows.length,scope:'verified_occurrences_in_observed_calendar_window_not_all_history',connection:this.connection(),knowledge:{missingRows:'not_evidence_of_absence_or_nonperformance',completeCurrentRoster:'not_established'},officialSaved:false,parentSent:false};
  }
}

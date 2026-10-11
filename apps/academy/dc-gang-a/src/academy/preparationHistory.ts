import {assertInstant,canonicalJson,requireText} from '../learning/model';
import {validateSourceKey,type SourceKey} from './domain';
import {validateAcademyRecord,type AcademyRecord,type SourceBookRegistration,type TeacherActivityRevision,type TeacherPreparationAssignment} from './records';
import type {SourcePrestudyVideo,SourceCourseInventory} from './bookPreparation';
import {requirementsForSeries,type CycleActivity} from './classroomCyclePolicy';

export interface PreparationVersion {
  payload:AcademyRecord;revisionId:string;recordedAt:string;sourceObservedAt:string;
}
interface RetainedUnit {courseKey:string;unitKey:string;label:string;revisionRef:string;effectiveDate:string;accepted:boolean;directiveRef:string;videoRefs:string[];recordedAt:string}
export function assertPreparationDate(date:string):void {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw Error('invalid_preparation_date');
}
const literal=(value:unknown):string=>{if(typeof value!=='string'||!/^\d+$/.test(value))throw Error('invalid_preparation_literal');return value;};
const text=(value:unknown):string=>{if(typeof value!=='string')throw Error('invalid_preparation_text');requireText(value,'preparation text');return value;};
const sourceDate=(instant:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(instant));
function legacyEvidence(record:PreparationVersion,student:SourceKey){
  if(record.payload.kind!=='teacher_reported_note')return null;
  let body;try{body=JSON.parse(record.payload.text);}catch{return null;}
  if(!body||body.kind!=='teacher_confirmed_video_history_with_source_attachments')return null;
  if(body.schemaVersion!==1||body.sourceStudentKey!==student.literalKey||body.directiveRef!==record.payload.directiveRef)throw Error('legacy_preparation_subject_or_directive_conflict');
  assertPreparationDate(body.date);
  if(!Array.isArray(body.completedUnits)||!Array.isArray(body.sourceBookInventoryRefs)||body.completedUnits.length>1000||body.sourceBookInventoryRefs.length>100)throw Error('legacy_preparation_shape');
  const definitions:RetainedUnit[]=[];
  for(const book of body.sourceBookInventoryRefs){
    literal(book.courseSourceKey);text(book.labelLiteral);
    if(!Array.isArray(book.units)||book.units.length>1000)throw Error('legacy_unit_inventory_shape');
    const seen=new Set<string>();
    for(const unit of book.units){literal(unit.unitSourceKey);text(unit.labelLiteral);if(seen.has(unit.unitSourceKey))throw Error('legacy_duplicate_unit');seen.add(unit.unitSourceKey);
      definitions.push({courseKey:book.courseSourceKey,unitKey:unit.unitSourceKey,label:unit.labelLiteral,revisionRef:record.revisionId,effectiveDate:body.date,accepted:false,directiveRef:record.payload.directiveRef,videoRefs:[],recordedAt:record.recordedAt});}
  }
  const accepted:RetainedUnit[]=body.completedUnits.map((unit:any)=>{
    literal(unit.courseSourceKey);literal(unit.unitSourceKey);text(unit.labelLiteral);
    if(unit.videoState!=='teacher_confirmed_resolved'||unit.originalUploadIdentityInvented!==false||unit.problemSolvingEstablished!==false||!['exact_source_video_and_explicit_teacher_confirmation','explicit_teacher_historical_confirmation_list_retention_exception'].includes(unit.basis)||!Array.isArray(unit.videoSourceKeys)||unit.videoSourceKeys.length>1000)throw Error('legacy_completion_authority');
    unit.videoSourceKeys.forEach(literal);
    const matches=definitions.filter(d=>d.courseKey===unit.courseSourceKey&&d.unitKey===unit.unitSourceKey&&d.label===unit.labelLiteral);
    if(matches.length!==1)throw Error('legacy_completion_unit_conflict');
    return {...matches[0]!,accepted:true,videoRefs:unit.videoSourceKeys};
  });
  return {definitions,accepted,effectiveDate:body.date};
}
/** Pure compatibility read. No note rewriting, academy calls, implicit assignments or source-grade acceptance. */
export function buildStudentPreparation(student:SourceKey,versions:readonly PreparationVersion[],date:string){
  validateSourceKey(student);if(student.namespace!=='academy_student')throw Error('preparation_student_namespace');assertPreparationDate(date);
  const books:SourceBookRegistration[]=[];const retained:RetainedUnit[]=[];const accepted:RetainedUnit[]=[];const videos:SourcePrestudyVideo[]=[];
  const instructions:{payload:TeacherActivityRevision;revisionId:string;recordedAt:string}[]=[];
  const inventories:{payload:SourceCourseInventory;version:PreparationVersion}[]=[];
  const assignments:{payload:TeacherPreparationAssignment;version:PreparationVersion}[]=[];
  for(const version of versions){
    requireText(version.revisionId,'preparation revision');assertInstant(version.recordedAt);assertInstant(version.sourceObservedAt);validateAcademyRecord(version.payload);
    if(version.payload.kind==='source_book_registration'){
      if(canonicalJson(version.payload.sourceStudent)!==canonicalJson(student))throw Error('preparation_student_binding_conflict');
      books.push(version.payload);
    }
    if('sourceStudent' in version.payload&&canonicalJson(version.payload.sourceStudent)!==canonicalJson(student))throw Error('preparation_student_binding_conflict');
    if(version.payload.kind==='source_prestudy_snapshot'&&sourceDate(version.sourceObservedAt)<=date)videos.push(...version.payload.videos);
    if(version.payload.kind==='teacher_activity_revision'&&version.payload.effectiveDate<=date)instructions.push({payload:version.payload,revisionId:version.revisionId,recordedAt:version.recordedAt});
    if(version.payload.kind==='source_course_inventory'&&sourceDate(version.sourceObservedAt)<=date)inventories.push({payload:version.payload,version});
    if(version.payload.kind==='teacher_preparation_assignment'&&version.payload.effectiveDate<=date)assignments.push({payload:version.payload,version});
    const legacy=legacyEvidence(version,student);
    if(legacy&&legacy.effectiveDate<=date){retained.push(...legacy.definitions);accepted.push(...legacy.accepted);}
  }
  for(const unit of retained)if(books.filter(b=>b.sourceCourse.literalKey===unit.courseKey).length!==1)throw Error('legacy_book_binding_unqualified');
  for(const instruction of instructions)if(books.filter(b=>canonicalJson(b.sourceCourse)===canonicalJson(instruction.payload.sourceCourse)&&canonicalJson(b.sourceBook)===canonicalJson(instruction.payload.sourceBook)).length!==1)throw Error('preparation_book_binding_conflict');
  for(const row of [...inventories,...assignments])if(books.filter(b=>canonicalJson(b.sourceCourse)===canonicalJson(row.payload.sourceCourse)&&canonicalJson(b.sourceBook)===canonicalJson(row.payload.sourceBook)&&(!('sourceUserCourse' in row.payload)||canonicalJson(b.sourceUserCourse)===canonicalJson(row.payload.sourceUserCourse))).length!==1)throw Error('preparation_book_binding_conflict');
  return {schemaVersion:1,kind:'student_preparation_history' as const,date,
    books:books.map(book=>{
      const definitions=retained.filter(u=>u.courseKey===book.sourceCourse.literalKey);
      const units=new Map<string,RetainedUnit>();for(const unit of definitions){const old=units.get(unit.unitKey);if(old&&old.label!==unit.label)throw Error('legacy_unit_label_conflict');units.set(unit.unitKey,unit);}
      const inventory=inventories.filter(i=>canonicalJson(i.payload.sourceCourse)===canonicalJson(book.sourceCourse)&&canonicalJson(i.payload.sourceBook)===canonicalJson(book.sourceBook)).sort((a,b)=>a.version.sourceObservedAt.localeCompare(b.version.sourceObservedAt)||a.version.recordedAt.localeCompare(b.version.recordedAt)).at(-1);
      if(inventory){units.clear();for(const unit of inventory.payload.units)units.set(unit.sunitKey,{courseKey:book.sourceCourse.literalKey,unitKey:unit.sunitKey,label:unit.labelLiteral,revisionRef:inventory.version.revisionId,effectiveDate:sourceDate(inventory.version.sourceObservedAt),accepted:false,directiveRef:'source_inventory_not_teacher_directive',videoRefs:[],recordedAt:inventory.version.recordedAt});}
      if(instructions.some(i=>canonicalJson(i.payload.sourceCourse)===canonicalJson(book.sourceCourse)&&canonicalJson(i.payload.sourceBook)===canonicalJson(book.sourceBook)&&!units.has(i.payload.sourceMinorUnit.literalKey)))throw Error('teacher_unit_binding_unqualified');
      const assignment=assignments.filter(a=>canonicalJson(a.payload.sourceCourse)===canonicalJson(book.sourceCourse)&&canonicalJson(a.payload.sourceBook)===canonicalJson(book.sourceBook)).sort((a,b)=>a.payload.effectiveDate.localeCompare(b.payload.effectiveDate)||a.version.recordedAt.localeCompare(b.version.recordedAt)).at(-1)?.payload;
      const upper=assignment?.upperBound;
      const end=upper?.state==='known'?[...units.values()].findIndex(u=>u.unitKey===upper.value):-1;
      if(upper?.state==='known'&&end<0)throw Error('upper_bound_not_in_inventory');
      return {sourceCourse:book.sourceCourse,sourceBook:book.sourceBook,labelLiteral:book.sourceBookLabel,
        unitInventoryCoverage:inventory?'all_returned_course_units':units.size?'retained_unit_references_not_full_source_inventory':'source_not_loaded',
        units:[...units.values()].map((unit,index)=>{
          const completions=accepted.filter(u=>u.courseKey===unit.courseKey&&u.unitKey===unit.unitKey);
          const sourceVideos=videos.filter(v=>v.courseKey===unit.courseKey&&v.sunitKey===unit.unitKey);
          const resolve=(activity:CycleActivity)=>{
            const directives=[...(activity==='prestudy_review'?completions.map(c=>({decision:'accepted',effectiveDate:c.effectiveDate,recordedAt:c.recordedAt,revisionId:c.revisionRef})):[]),...instructions.filter(i=>i.payload.activity===activity&&i.payload.sourceCourse.literalKey===unit.courseKey&&i.payload.sourceBook.literalKey===book.sourceBook.literalKey&&i.payload.sourceMinorUnit.literalKey===unit.unitKey).map(i=>({decision:i.payload.decision,effectiveDate:i.payload.effectiveDate,recordedAt:i.recordedAt,revisionId:i.revisionId}))].sort((a,b)=>a.effectiveDate.localeCompare(b.effectiveDate)||a.recordedAt.localeCompare(b.recordedAt));
            const latest=directives.at(-1),same=latest?directives.filter(d=>d.effectiveDate===latest.effectiveDate&&d.recordedAt===latest.recordedAt):[];
            if(latest&&same.some(d=>d.decision!==latest.decision))throw Error('ambiguous_teacher_revision_order');
            return {activity,state:latest?.decision==='accepted'?'teacher_confirmed_resolved':latest?.decision==='reopen'?'teacher_reinspection_required':'teacher_evidence_not_reported',currentRevisionRefs:same.map(d=>d.revisionId).sort(),priorAcceptanceRevisionRefs:[...new Set(directives.filter(d=>d.decision==='accepted').map(d=>d.revisionId))]};
          };
          const labels=book.sourceCourseLabel+' '+book.sourceBookLabel;
          const series=assignment?.series??(labels.includes('다빈치')&&!labels.includes('가우스')?'davinci':labels.includes('가우스')&&!labels.includes('다빈치')?'gauss':null);
          const review=resolve('prestudy_review'),resolved=review.state==='teacher_confirmed_resolved';
          return {sourceMinorUnit:{namespace:'academy_minor_unit',literalKey:unit.unitKey},labelLiteral:unit.label,
            duty:!assignment||end<0?'teacher_scope_not_recorded':index<=end?'current_duty':'outside_current_audit_scope',
            video:{state:series==='davinci'?'not_required':resolved?'teacher_confirmed_resolved':review.state==='teacher_reinspection_required'?'teacher_reinspection_required':sourceVideos.some(v=>v.lane==='teacher_unconfirmed')?'awaiting_teacher_review':sourceVideos.length?'source_reviewed_teacher_acceptance_unqualified':'source_not_loaded',teacherRevisionRefs:review.currentRevisionRefs,priorAcceptanceRevisionRefs:review.priorAcceptanceRevisionRefs,sourceVideoRefs:[...new Set([...completions.flatMap(c=>c.videoRefs),...sourceVideos.map(v=>v.prestudyKey)])],referenceVideoRefs:resolved?sourceVideos.map(v=>v.prestudyKey).filter(key=>!completions.some(c=>c.videoRefs.includes(key))):[]},
            teacherActivities:series?requirementsForSeries(series).filter(r=>r.completionAuthority==='explicit_teacher_judgment').map(r=>resolve(r.activity)):[],
            appGradingEstablished:false,wholeCycleTeacherCompletionEstablished:false};
        })};
    }),scope:'student_book_standing_evidence_not_automatic_lesson_homework_join',historicalFinalRecordEstablished:false,storedCommentHistory:'not_qualified',wholeHomeworkCoverageEstablished:false,officialSaved:false,parentSent:false};
}
export type StudentPreparationHistory=ReturnType<typeof buildStudentPreparation>;

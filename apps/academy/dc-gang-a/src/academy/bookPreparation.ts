import {assertExactKeys,assertKnowledge,assertRefs,canonicalJson,requireText,type Knowledge} from '../learning/model';
import {validateSourceKey,type SourceKey} from './domain';
import {requirementsForSeries,type ClassroomSeries} from './classroomCyclePolicy';

export interface SourceCourseUnit {
  sunitKey:string; bunitKey:string; sourceOrder:number; labelLiteral:string;
  progressCells:readonly {fieldId:string;literal:string}[];
}
/** The current source course's full returned table, not all editions, history or app attempts. */
export interface SourceCourseInventory {
  kind:'source_course_inventory'; sourceStudent:SourceKey; sourceCourse:SourceKey;
  sourceUserCourse:SourceKey; sourceBook:SourceKey; bookLabelLiteral:string; courseVersionLiteral:string;
  coverage:'all_returned_course_units'; evidenceRefs:readonly string[]; units:readonly SourceCourseUnit[];
}
export interface TeacherBookPreparationScope {
  kind:'teacher_book_preparation_scope'; sourceCourse:SourceKey;sourceBook:SourceKey;
  start:'book_beginning'; upperBound:Knowledge<string>; series:ClassroomSeries;
  teacherBookAliasLiteral:string; directiveRef:string;
}
export interface SourcePrestudyVideo {
  prestudyKey:string;studentKey:string;teacherKey:string;courseKey:string;sunitKey:string;
  unitLabelLiteral:string;versionLiteral:string;lane:'teacher_unconfirmed'|'teacher_confirmed';
  statusLiteral:string;scoreLiteral:string;createdLiteral:string;commentLiteral:string;
}
export interface SourcePrestudySnapshot {
  kind:'source_prestudy_snapshot';sourceStudent:SourceKey;teacherKey:string;
  coverage:'all_returned_requested_rows_not_all_time_history';evidenceRefs:readonly string[];
  videos:readonly SourcePrestudyVideo[];
}
const literal=(value:unknown)=>{if(typeof value!=='string'||!/^\d+$/.test(value)||value.length>100)throw Error('invalid_literal_source_key');};
const text=(value:unknown)=>{requireText(value as string,'preparation field');if((value as string).length>16000)throw Error('preparation_field_too_large');};
const source=(value:SourceKey,namespace:string)=>{validateSourceKey(value);if(value.namespace!==namespace)throw Error('preparation_source_namespace');literal(value.literalKey);};
export function validateCourseInventory(value:SourceCourseInventory):void {
  canonicalJson(value);
  assertExactKeys(value,['kind','sourceStudent','sourceCourse','sourceUserCourse','sourceBook','bookLabelLiteral','courseVersionLiteral','coverage','evidenceRefs','units']);
  if(value.kind!=='source_course_inventory'||value.coverage!=='all_returned_course_units'||!Array.isArray(value.units)||!value.units.length||value.units.length>1000)throw Error('invalid_course_inventory');
  source(value.sourceStudent,'academy_student');source(value.sourceCourse,'academy_course');source(value.sourceUserCourse,'academy_user_course');source(value.sourceBook,'academy_book');
  text(value.bookLabelLiteral);text(value.courseVersionLiteral);assertRefs(value.evidenceRefs);
  const keys=new Set<string>();
  for(const [index,unit] of value.units.entries()){
    assertExactKeys(unit,['sunitKey','bunitKey','sourceOrder','labelLiteral','progressCells']);literal(unit.sunitKey);literal(unit.bunitKey);text(unit.labelLiteral);
    if(unit.sourceOrder!==index||keys.has(unit.sunitKey)||!Array.isArray(unit.progressCells)||unit.progressCells.length>32)throw Error('unit_inventory_order_or_identity');keys.add(unit.sunitKey);
    for(const cell of unit.progressCells){assertExactKeys(cell,['fieldId','literal']);text(cell.fieldId);if(typeof cell.literal!=='string'||cell.literal.length>16000)throw Error('invalid_progress_literal');}
  }
}
export function validatePreparationScope(value:TeacherBookPreparationScope):void {
  canonicalJson(value);assertExactKeys(value,['kind','sourceCourse','sourceBook','start','upperBound','series','teacherBookAliasLiteral','directiveRef']);
  if(value.kind!=='teacher_book_preparation_scope'||value.start!=='book_beginning')throw Error('invalid_preparation_scope');
  source(value.sourceCourse,'academy_course');source(value.sourceBook,'academy_book');requirementsForSeries(value.series);
  assertKnowledge<string>(value.upperBound,literal);text(value.teacherBookAliasLiteral);text(value.directiveRef);
}
export function validatePrestudySnapshot(value:SourcePrestudySnapshot):void {
  canonicalJson(value);assertExactKeys(value,['kind','sourceStudent','teacherKey','coverage','evidenceRefs','videos']);
  if(value.kind!=='source_prestudy_snapshot'||value.coverage!=='all_returned_requested_rows_not_all_time_history'||!Array.isArray(value.videos)||value.videos.length>1000)throw Error('invalid_prestudy_snapshot');
  source(value.sourceStudent,'academy_student');literal(value.teacherKey);assertRefs(value.evidenceRefs);const keys=new Set<string>();
  for(const video of value.videos){
    assertExactKeys(video,['prestudyKey','studentKey','teacherKey','courseKey','sunitKey','unitLabelLiteral','versionLiteral','lane','statusLiteral','scoreLiteral','createdLiteral','commentLiteral']);
    for(const key of [video.prestudyKey,video.studentKey,video.teacherKey,video.courseKey,video.sunitKey])literal(key);
    if(video.studentKey!==value.sourceStudent.literalKey||video.teacherKey!==value.teacherKey||keys.has(video.prestudyKey)||!['teacher_unconfirmed','teacher_confirmed'].includes(video.lane))throw Error('prestudy_subject_or_identity_conflict');keys.add(video.prestudyKey);
    text(video.unitLabelLiteral);text(video.versionLiteral);
    for(const v of [video.statusLiteral,video.scoreLiteral,video.createdLiteral,video.commentLiteral])if(typeof v!=='string'||v.length>16000)throw Error('invalid_prestudy_literal');
  }
}
export function buildBookPreparation(inventory:SourceCourseInventory,scope:TeacherBookPreparationScope|null,snapshots:readonly SourcePrestudySnapshot[]){
  validateCourseInventory(inventory);if(scope){validatePreparationScope(scope);if(canonicalJson(scope.sourceCourse)!==canonicalJson(inventory.sourceCourse)||canonicalJson(scope.sourceBook)!==canonicalJson(inventory.sourceBook))throw Error('preparation_book_scope_conflict');}
  for(const snapshot of snapshots){validatePrestudySnapshot(snapshot);if(canonicalJson(snapshot.sourceStudent)!==canonicalJson(inventory.sourceStudent))throw Error('preparation_student_scope_conflict');}
  const upperBound=scope?.upperBound;
  const end=upperBound?.state==='known'?inventory.units.findIndex(u=>u.sunitKey===upperBound.value):-1;
  if(scope?.upperBound.state==='known'&&end<0)throw Error('upper_bound_not_in_inventory');
  const units=inventory.units.map(unit=>{
    const videos=snapshots.flatMap(v=>v.videos).filter(v=>v.studentKey===inventory.sourceStudent.literalKey&&v.courseKey===inventory.sourceCourse.literalKey&&v.sunitKey===unit.sunitKey);
    const duty=scope?(end<0?'awaiting_teacher_scope':unit.sourceOrder<=end?'current_duty':'not_yet_assigned'):'awaiting_teacher_scope';
    const videoState=scope?.series==='davinci'?'not_required':videos.some(v=>v.lane==='teacher_unconfirmed')?'awaiting_teacher_review':videos.length?'source_reviewed_teacher_acceptance_unqualified':snapshots.length?'not_observed_in_returned_lists':'source_not_loaded';
    return {sunitKey:unit.sunitKey,labelLiteral:unit.labelLiteral,sourceOrder:unit.sourceOrder,duty,videoState,exactVideoRefs:videos.map(v=>v.prestudyKey),videoJoinGrain:'student_course_minor_unit_not_assignment_or_occurrence',sourceProgressCells:unit.progressCells,
      appGradingEstablished:false,teacherCompletionEstablished:false,cycleActivities:scope?requirementsForSeries(scope.series):[],
      latestResubmissionResolution:'not_qualified',pendingTeacherReview:videoState==='awaiting_teacher_review'};
  });
  return {bookLabelLiteral:inventory.bookLabelLiteral,courseVersionLiteral:inventory.courseVersionLiteral,teacherBookAliasLiteral:scope?.teacherBookAliasLiteral??null,
    inventoryCoverage:inventory.coverage,unitCount:units.length,responsibilityScope:scope?.upperBound??{state:'unknown',reason:'teacher_scope_not_recorded'},
    units,readyEstablished:false,limits:['Returned course units do not prove all printed editions or history','Editable progress scalars are not exact app attempt/item grading','Source video version and source course version are distinct namespaces','Video-to-lesson/homework/range and latest request resolution remain separate','No source label is an automatic classroom judgment'],officialSaved:false,parentSent:false};
}
export type BookPreparationView=ReturnType<typeof buildBookPreparation>;

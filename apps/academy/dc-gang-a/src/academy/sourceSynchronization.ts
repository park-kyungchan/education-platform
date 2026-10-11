import {assertExactKeys,assertInstant,canonicalJson,digest,requireText,stableId} from '../learning/model';
import {createAcademyReadPlan,readInputRecord,readLiteralKey,readLiteralName,type ScopedAcademyReadPlan} from '../lms/academyReadProtocol';
import {createAcademySourceAudit} from '../lms/academySourceAudit';
import {assertPreparationDate} from './preparationHistory';
import {planDayRecordEvidence,planTextbookEvidence,type PlannedSourceEvidence} from './sourceEvidence';
import type {RecordVersion,StoredStudent} from './contracts/storageRecords';
import type {SourceAreaTask,SourceAreaReceipt} from './contracts/sourceRequests';
export type {SourceAreaTask,SourceAreaReceipt} from './contracts/sourceRequests';


export function validateSourceAreaTask(task:SourceAreaTask){
 canonicalJson(task);assertExactKeys(task,['id','studentId','teacherKey','collegeKey','request']);requireText(task.studentId,'source student');readLiteralKey(task.teacherKey);readLiteralKey(task.collegeKey);
 const plan=createAcademyReadPlan(task.request);
 if(task.id!==stableId('source-area',task.studentId,digest(plan.request)))throw Error('source_area_identity_conflict');
 return plan;
}
/** Only exact source scopes already bound to protected students. No date/group/attempt inference. */
export function planSourceAreas(config:{ownerId:string;teacherLabel:string;teacherKey:string;collegeKey:string},students:readonly StoredStudent[],heads:readonly RecordVersion[],date:string):SourceAreaTask[]{
 assertPreparationDate(date);const tasks=new Map<string,SourceAreaTask>();
 const add=(studentId:string,request:SourceAreaTask['request'])=>{const task={id:stableId('source-area',studentId,digest(request)),studentId,teacherKey:config.teacherKey,collegeKey:config.collegeKey,request};validateSourceAreaTask(task);tasks.set(task.id,task);};
 for(const student of students){
  if(student.ownerId!==config.ownerId||student.sourceKey.namespace!=='academy_student')throw Error('source_student_binding_conflict');
  add(student.id,{family:'student_course',teacherLabel:config.teacherLabel,studentKey:student.sourceKey.literalKey,studentName:student.displayName});
  for(const head of heads.filter(row=>row.studentId===student.id&&row.ownerId===config.ownerId)){
   if(head.payload.kind!=='source_audit')continue;const source=readInputRecord(head.payload.acquisition);createAcademySourceAudit(source);
   if(source.family==='day_record')for(const raw of source.dayRecords as unknown[]){
    const row=readInputRecord(raw);if(row.studentKey!==student.sourceKey.literalKey||row.studentName!==student.displayName||row.teacherKey!==config.teacherKey)throw Error('source_student_binding_conflict');
    if(row.date===date)add(student.id,{family:'day_record',teacherLabel:config.teacherLabel,date,groupIds:[readLiteralKey(row.groupId)],studentNames:[student.displayName]});
   }
   if(source.family==='textbook')for(const raw of source.records as unknown[]){
    const row=readInputRecord(raw);if(row.studentKey!==student.sourceKey.literalKey||row.studentName!==student.displayName)throw Error('source_student_binding_conflict');
    const courseKey=readLiteralKey(row.courseKey),bookNo=readLiteralKey(row.bookNo);
    if(!heads.some(head=>head.ownerId===config.ownerId&&head.studentId===student.id&&head.payload.kind==='source_book_registration'&&head.payload.sourceCourse.literalKey===courseKey&&head.payload.sourceBook.literalKey===bookNo))continue;
    add(student.id,{family:'textbook',teacherLabel:config.teacherLabel,studentKey:student.sourceKey.literalKey,studentName:student.displayName,courseKey,bookNo,sourceTitles:[readLiteralName(row.sourceTitle)],gradeViewAdmission:true});
   }
   if(source.family==='daily_zero')for(const raw of source.dailyResults as unknown[]){
    const row=readInputRecord(raw);if(row.studentKey!==student.sourceKey.literalKey||row.studentName!==student.displayName)throw Error('source_student_binding_conflict');
    if(row.status==='observed')add(student.id,{family:'daily_zero',teacherLabel:config.teacherLabel,targets:[{studentKey:student.sourceKey.literalKey,studentName:student.displayName,attemptKey:readLiteralKey(row.attemptKey)}],gradeViewAdmission:true});
   }
  }
 }
 if(tasks.size>256)throw Error('source_area_plan_too_large');
 return [...tasks.values()];
}
/** Validate the actual direct receiver witness before planning append-only source records. */
export function normalizeSourceArea(ownerId:string,task:SourceAreaTask,students:readonly StoredStudent[],input:unknown,heads:readonly RecordVersion[]=[]){
 const plan=validateSourceAreaTask(task),result=readInputRecord(input);canonicalJson(result);
 assertExactKeys(result,['schemaVersion','observedAt','authentication','source','academyWrites','parentSends']);
 const auth=readInputRecord(result.authentication);assertExactKeys(auth,['state','transport','principalKey','collegeKey']);
 if(result.schemaVersion!==1||result.academyWrites!==0||result.parentSends!==0||auth.state!=='authenticated'||auth.transport!=='direct_http_api'||auth.principalKey!==task.teacherKey||auth.collegeKey!==task.collegeKey||ownerId!==stableId('owner','academy_instructor',task.collegeKey,task.teacherKey))throw Error('source_area_principal_conflict');
 const student=students.find(row=>row.ownerId===ownerId&&row.id===task.studentId);if(!student)throw Error('unknown_student_partition');
 const snapshot=readInputRecord(result.source);createAcademySourceAudit(snapshot);
 if(snapshot.family!==plan.family||snapshot.status!=='observed')throw Error('source_area_not_observed');
 if(typeof snapshot.observedAt!=='string'||typeof result.observedAt!=='string')throw Error('source_clock_required');assertInstant(snapshot.observedAt);assertInstant(result.observedAt);
 const records:PlannedSourceEvidence[]=[];
 if(plan.family==='student_course'){
  const {family,...scope}=plan.request;
  if(scope.studentKey!==student.sourceKey.literalKey||scope.studentName!==student.displayName||canonicalJson(scope)!==canonicalJson(snapshot.studentCourseScope))throw Error('source_area_scope_conflict');
  for(const raw of snapshot.studentCourses as unknown[]){const row=readInputRecord(raw),identity=readInputRecord(row.identity),cells=row.sourceCells as string[];if(identity.collegeKey!==task.collegeKey||cells[1]!==scope.teacherLabel||cells[2]!==student.displayName)throw Error('source_area_scope_conflict');}
  records.push({studentId:student.id,entityId:stableId('entity','academy_student_course_scope',student.id),sourceObservedAt:snapshot.observedAt,payload:{kind:'source_audit',acquisition:snapshot,contractRef:'docs/academy-deterministic-read-contract.ts#sourceContracts/student_course'}});
 }else if(plan.family==='day_record'){
  if(canonicalJson(snapshot.requestedScope)!==canonicalJson(plan.request)||plan.request.studentNames.length!==1||plan.request.studentNames[0]!==student.displayName)throw Error('source_area_scope_conflict');
  records.push(...planDayRecordEvidence(ownerId,task.teacherKey,[student],[snapshot]));
 }else if(plan.family==='textbook'){
  const request=plan.request;
  if(request.studentKey!==student.sourceKey.literalKey||request.studentName!==student.displayName)throw Error('source_area_scope_conflict');
  const rows=(snapshot.records as unknown[]).map(readInputRecord);
  if(rows.length!==request.sourceTitles.length||rows.some(row=>row.courseKey!==request.courseKey||row.bookNo!==request.bookNo||!request.sourceTitles.includes(row.sourceTitle as string)))throw Error('source_area_scope_conflict');
  const books=heads.filter(head=>head.ownerId===ownerId&&head.studentId===student.id).flatMap(head=>head.payload.kind==='source_book_registration'?[head.payload]:[]);
  records.push(...planTextbookEvidence(ownerId,[student],books,[snapshot]));
 }else if(plan.family==='daily_zero'){
  const rows=(snapshot.dailyResults as unknown[]).map(readInputRecord);
  if(rows.length!==plan.request.targets.length||rows.some(row=>row.status!=='observed'||row.studentKey!==student.sourceKey.literalKey||row.studentName!==student.displayName||!plan.request.targets.some(target=>target.studentKey===row.studentKey&&target.studentName===row.studentName&&target.attemptKey===row.attemptKey)))throw Error('source_area_scope_conflict');
  for(const row of rows){const acquisition={...snapshot,dailyResults:[row]};records.push({studentId:student.id,entityId:stableId('entity','academy_daily_zero',student.id,readLiteralKey(row.attemptKey)),sourceObservedAt:snapshot.observedAt,payload:{kind:'source_audit',acquisition,contractRef:'docs/academy-deterministic-read-contract.ts#sourceContracts/daily_zero'}});}
 }else throw Error('source_area_not_connected');
 return {records,transport:'direct_http_api' as const,observedAt:snapshot.observedAt,captureDigest:digest(result)};
}

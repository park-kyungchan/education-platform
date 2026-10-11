/** Scoped read preparation, not an authentication provider or generic HTTP dispatcher. */
import {parseScoreView,readAssessmentBatch,type AssessmentReadTarget,type AssessmentReadResult} from './assessmentReadProtocol';
import {readDayRecordSource,type DayRecordColumnContract,type DayRecordSourceRow} from './dayRecordReadProtocol';
import {readItemMetadata,type ItemMetadataObservation} from './itemMetadataRead';
import {readItemAnswerBatch} from './itemAnswerBatch';
import type {ItemAnswerObservation} from './itemAnswerRead';
export const scopedReadFamilies=['daily_zero','day_record','item_answer','item_metadata','student_course','textbook'] as const;
import {createStudentCourseRequest,readStudentCourses,type StudentCourseObservation,type StudentCourseRequest} from './studentCourseRead';
export interface TextbookReadRequest {
  family: 'textbook'; teacherLabel: string; studentKey: string; studentName: string;
  courseKey: string; bookNo: string; sourceTitles: string[]; gradeViewAdmission: true;
}
export interface AcademyReadOperation {
  path: string; method: 'GET' | 'POST'; selectorKey: 'reqCmd' | 'p_process';
  selector: string; selectorPlacement: 'query' | 'body';
}
export interface AcademyReadPlan {
  schemaVersion: 1; kind: 'prepared_scoped_native_browser_read'; family: 'textbook';
  effect: 'read_only'; credentialChannel: 'native_browser_vault'; origin: 'https://dc.gang-a.kr';
  request: TextbookReadRequest; operations: AcademyReadOperation[];
  unknownStates: string[]; automaticRetryAllowed: false;
}
export interface DailyReadRequest {
  family:'daily_zero';teacherLabel:string;targets:AssessmentReadTarget[];gradeViewAdmission:true;
}
export interface DailyReadPlan extends Omit<AcademyReadPlan,'family'|'request'> {
  family:'daily_zero';request:DailyReadRequest;
}
export interface DayRecordReadRequest {family:'day_record';teacherLabel:string;date:string;groupIds:string[];studentNames:string[]}
export interface DayRecordReadPlan extends Omit<AcademyReadPlan,'family'|'request'> {family:'day_record';request:DayRecordReadRequest}
export interface ItemMetadataReadRequest {family:'item_metadata';teacherLabel:string;lectureKey:string}
export interface ItemMetadataReadPlan extends Omit<AcademyReadPlan,'family'|'request'> {family:'item_metadata';request:ItemMetadataReadRequest}
export interface ItemAnswerReadRequest {family:'item_answer';teacherLabel:string;teacherKey:string;lectureKeys:string[];answerReadAdmission:true}
export interface ItemAnswerReadPlan extends Omit<AcademyReadPlan,'family'|'request'> {family:'item_answer';request:ItemAnswerReadRequest}
export interface StudentCourseReadRequest extends StudentCourseRequest {family:'student_course'}
export interface StudentCourseReadPlan extends Omit<AcademyReadPlan,'family'|'request'> {family:'student_course';request:StudentCourseReadRequest}
export type ScopedAcademyReadPlan=AcademyReadPlan|DailyReadPlan|DayRecordReadPlan|ItemMetadataReadPlan|ItemAnswerReadPlan|StudentCourseReadPlan;
export function readInputRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('invalid_read_request');
  const descriptors = Object.getOwnPropertyDescriptors(input);
  if (Object.values(descriptors).some(value => !Object.hasOwn(value, 'value'))) throw new Error('accessor_read_request');
  return Object.fromEntries(Object.entries(descriptors).map(([name,value])=>[name,value.value]));
}
export function readLiteralName(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 200) throw new Error('invalid_read_name');
  return value;
}
export function readLiteralKey(value: unknown): string {
  if (typeof value !== 'string' || !/^[1-9][0-9]{0,15}$/.test(value) || BigInt(value) > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('invalid_read_key');
  return value;
}
export function createAcademyReadPlan(input: unknown): ScopedAcademyReadPlan {
  const data = readInputRecord(input);
  if(data.family==='item_answer') {
    const required=['family','teacherLabel','teacherKey','lectureKeys','answerReadAdmission'];
    if(Object.keys(data).length!==required.length||Object.keys(data).some(key=>!required.includes(key)))throw Error('unexpected_read_request_field');
    if(data.answerReadAdmission!==true||!Array.isArray(data.lectureKeys)||data.lectureKeys.length<1||data.lectureKeys.length>32||new Set(data.lectureKeys).size!==data.lectureKeys.length)throw Error('invalid_answer_batch_scope');
    return {schemaVersion:1,kind:'prepared_scoped_native_browser_read',family:'item_answer',effect:'read_only',credentialChannel:'native_browser_vault',origin:'https://dc.gang-a.kr',
      request:{family:'item_answer',teacherLabel:readLiteralName(data.teacherLabel),teacherKey:readLiteralKey(data.teacherKey),lectureKeys:data.lectureKeys.map(readLiteralKey),answerReadAdmission:true},
      operations:[{path:'/servlet/controller.common.TestPageShowExServlet',method:'GET',selectorKey:'p_process',selector:'GetLectureList',selectorPlacement:'query'}],
      unknownStates:['answer_renderer','generated_paper_membership','printed_answer_version','student_response','teacher_inspection'],automaticRetryAllowed:false};
  }
  if(data.family==='student_course') {
    const {family,...fields}=data;
    const request=createStudentCourseRequest(fields);
    return {schemaVersion:1,kind:'prepared_scoped_native_browser_read',family:'student_course',effect:'read_only',credentialChannel:'native_browser_vault',origin:'https://dc.gang-a.kr',
      request:{family:'student_course',...request},operations:[
        {path:'/servlet/controller.coursemanage.CourseManageServlet',method:'GET',selectorKey:'reqCmd',selector:'StudyCourse',selectorPlacement:'query'},
        {path:'/servlet/controller.coursemanage.CourseManageServlet',method:'POST',selectorKey:'reqCmd',selector:'StudyCourse',selectorPlacement:'query'},
      ],unknownStates:['complete_enrollment_pagination','effective_course_dates','course_book_lesson_mapping'],automaticRetryAllowed:false};
  }
  if(data.family==='item_metadata') {
    const required=['family','teacherLabel','lectureKey'];
    if(Object.keys(data).length!==required.length||Object.keys(data).some(key=>!required.includes(key)))throw new Error('unexpected_read_request_field');
    return {schemaVersion:1,kind:'prepared_scoped_native_browser_read',family:'item_metadata',effect:'read_only',credentialChannel:'native_browser_vault',origin:'https://dc.gang-a.kr',
      request:{family:'item_metadata',teacherLabel:readLiteralName(data.teacherLabel),lectureKey:readLiteralKey(data.lectureKey)},
      operations:[{path:'/servlet/controller.common.TestPageShowExServlet',method:'GET',selectorKey:'p_process',selector:'GetLectureList',selectorPlacement:'query'}],
      unknownStates:['concept_mapping','student_mastery','video_watch_history','complete_content_inventory'],automaticRetryAllowed:false};
  }
  if(data.family==='day_record') {
    const required=['family','teacherLabel','date','groupIds','studentNames'];
    if(Object.keys(data).length!==required.length||Object.keys(data).some(key=>!required.includes(key)))throw new Error('unexpected_read_request_field');
    if(typeof data.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(data.date)||!Number.isFinite(Date.parse(data.date+'T00:00:00Z'))
      ||new Date(data.date+'T00:00:00Z').toISOString().slice(0,10)!==data.date)throw new Error('invalid_read_date');
    if(!Array.isArray(data.groupIds)||data.groupIds.length<1||data.groupIds.length>12||new Set(data.groupIds).size!==data.groupIds.length
      ||!Array.isArray(data.studentNames)||data.studentNames.length<1||data.studentNames.length>64||new Set(data.studentNames).size!==data.studentNames.length)throw new Error('invalid_day_record_scope');
    return {schemaVersion:1,kind:'prepared_scoped_native_browser_read',family:'day_record',effect:'read_only',credentialChannel:'native_browser_vault',origin:'https://dc.gang-a.kr',
      request:{family:'day_record',teacherLabel:readLiteralName(data.teacherLabel),date:data.date,groupIds:data.groupIds.map(readLiteralKey),studentNames:data.studentNames.map(readLiteralName)},
      operations:[{path:'/servlet/controller.cct.tutor.DayRecordServlet',method:'POST',selectorKey:'p_process',selector:'Main',selectorPlacement:'body'},
        {path:'/servlet/controller.cct.tutor.CourseScheduleServlet',method:'GET',selectorKey:'reqCmd',selector:'SelSglRecord',selectorPlacement:'query'}],
      unknownStates:['whole_cohort_completeness','immutable_parent_sent_text','teacher_finalization'],automaticRetryAllowed:false};
  }
  if(data.family==='daily_zero') {
    const required=['family','teacherLabel','targets','gradeViewAdmission'];
    if(Object.keys(data).length!==required.length||Object.keys(data).some(key=>!required.includes(key)))throw new Error('unexpected_read_request_field');
    if(data.gradeViewAdmission!==true||!Array.isArray(data.targets)||data.targets.length<1||data.targets.length>2)throw new Error('invalid_daily_read_scope');
    const targets=data.targets.map(readInputRecord).map(target=>{
      if(Object.keys(target).length!==3||Object.keys(target).some(key=>!['studentKey','studentName','attemptKey'].includes(key)))throw new Error('unexpected_read_target_field');
      return {studentKey:readLiteralKey(target.studentKey),studentName:readLiteralName(target.studentName),attemptKey:readLiteralKey(target.attemptKey)};
    });
    if(new Set(targets.map(x=>JSON.stringify([x.studentKey,x.attemptKey]))).size!==targets.length)throw new Error('duplicate_read_target');
    return {schemaVersion:1,kind:'prepared_scoped_native_browser_read',family:'daily_zero',effect:'read_only',credentialChannel:'native_browser_vault',
      origin:'https://dc.gang-a.kr',request:{family:'daily_zero',teacherLabel:readLiteralName(data.teacherLabel),targets,gradeViewAdmission:true},operations:[
        {path:'/servlet/controller.dailyzerotest.DailyZeroTestServlet',method:'POST',selectorKey:'reqCmd',selector:'DtResultSearch',selectorPlacement:'query'},
        {path:'/servlet/controller.common.TestpageSelectExServlet',method:'POST',selectorKey:'p_process',selector:'getStudyResultSingleTestingSingleUser',selectorPlacement:'body'},
      ],unknownStates:['lesson_occurrence','source_grade_timestamp','clinic_solving','teacher_acceptance','durable_print_receipt'],automaticRetryAllowed:false};
  }
  const keys = ['family','teacherLabel','studentKey','studentName','courseKey','bookNo','sourceTitles','gradeViewAdmission'];
  if (Object.keys(data).length !== keys.length || Object.keys(data).some(key=>!keys.includes(key))) throw new Error('unexpected_read_request_field');
  if (data.family !== 'textbook') throw new Error('unsupported_read_family');
  if (data.gradeViewAdmission !== true) throw new Error('existing_grade_view_admission_required');
  if (!Array.isArray(data.sourceTitles) || data.sourceTitles.length < 1 || data.sourceTitles.length > 12
    || new Set(data.sourceTitles).size !== data.sourceTitles.length) throw new Error('invalid_source_selection');
  const request: TextbookReadRequest = {family:'textbook',teacherLabel:readLiteralName(data.teacherLabel),
    studentKey:readLiteralKey(data.studentKey),studentName:readLiteralName(data.studentName),courseKey:readLiteralKey(data.courseKey),
    bookNo:readLiteralKey(data.bookNo),sourceTitles:data.sourceTitles.map(readLiteralName),gradeViewAdmission:true};
  return {schemaVersion:1,kind:'prepared_scoped_native_browser_read',family:'textbook',effect:'read_only',credentialChannel:'native_browser_vault',
    origin:'https://dc.gang-a.kr',request,operations:[
      {path:'/servlet/controller.coursemanage.TextBookManageServlet',method:'POST',selectorKey:'reqCmd',selector:'getTextBookProgress',selectorPlacement:'query'},
      {path:'/servlet/controller.common.TestpageSelectExServlet',method:'POST',selectorKey:'p_process',selector:'getWrongAnswerNoteResult',selectorPlacement:'body'},
      {path:'/servlet/controller.common.TestpageSelectExServlet',method:'POST',selectorKey:'p_process',selector:'getStudyResultSingleTestingSingleUser',selectorPlacement:'body'},
    ],unknownStates:['clinic_solving','clinic_app_reentry','teacher_acceptance','durable_print_receipt','unstarted_or_ungraded_stage_inventory'],automaticRetryAllowed:false};
}

export interface AcademyReadEnvironment {
  origin: string; authenticatedTeacherVisible: boolean;
  authenticationMode?:'browser_managed_manual'|'direct_http_api';
  principalKey?:string;
  domParser?:Pick<DOMParser,'parseFromString'>;
  onItemAnswerObservation?:(answer:ItemAnswerObservation)=>void|Promise<void>;
  dayRecordColumnContract?:DayRecordColumnContract;
  fetcher: (url:string, init:RequestInit)=>Promise<Response>;
}
export interface StoredSourceItem {
  originalOrdinal: string; lectureKey: string | null; outerLectureKey: string | null; scoring: 'O' | 'X';
}
export interface StoredSourceRecord {
  sourceTitle: string; studentKey: string; studentName: string; courseKey: string; bookNo: string;
  paperKey: string; attemptKey: string; score: number; items: StoredSourceItem[];
  sourceDate: {literal:string|null;precision:'month_day'|'unknown';meaning:'source_apply_date_not_exact_grade_time'};
}
export interface AcademyReadResult {
  schemaVersion:1; family:'textbook'|'daily_zero'|'day_record'|'item_metadata'|'item_answer'|'student_course'; status:'observed'|'partial'|'blocked'; records:StoredSourceRecord[];
  dailyResults:AssessmentReadResult[];
  dayRecords:DayRecordSourceRow[];
  itemMetadata?:ItemMetadataObservation[];
  itemAnswers?:ItemAnswerObservation[];
  requestedAnswerLabels?:string[];
  pendingAnswerLabels?:string[];
  answerBlockedReason?:string|null;
  studentCourses?:StudentCourseObservation[];
  studentCourseScope?:StudentCourseRequest;
  requestedScope?:DayRecordReadRequest;
  observedAt:string; coverage:'exact_selected_existing_records_not_whole_book'|'requested_daily_targets'|'requested_date_groups_students_not_cohort_completeness'|'one_exact_verified_item_not_all_content_or_batch_encoding'|'exact_requested_shared_answers_not_printed_versions'|'observed_rows_not_all_assignments_or_pagination'; unknownStates:string[];
  nativePrintInvoked:false; automaticRetryAllowed:false;
}
export function sourceResponseKey(value:unknown):string {
  if(typeof value==='number'&&Number.isSafeInteger(value)&&value>0)return String(value);
  return readLiteralKey(value);
}
export function parseTextbookScopeBinding(html:string,request:TextbookReadRequest):void {
  const bindings=new Set<string>();
  for(const attribute of html.matchAll(/\bonclick\s*=\s*(["'])([\s\S]*?)\1/gi)) {
    const source=attribute[2]!.replace(/&#39;|&apos;/g,"'").replace(/&quot;/g,'"');
    const call=/createBookIncorrectPapers\(\s*['"]?([0-9]+)['"]?\s*,\s*['"]?([0-9]+)['"]?\s*,\s*['"]?([0-9]+)['"]?\s*\)/.exec(source);
    if(call&&call[1]===request.courseKey&&call[2]===request.bookNo&&call[3]===request.studentKey)bindings.add(JSON.stringify(call.slice(1)));
  }
  if(bindings.size!==1)throw new Error('exact_textbook_scope_not_observed');
}
export async function executeAcademyRead(plan:ScopedAcademyReadPlan,environment:AcademyReadEnvironment):Promise<AcademyReadResult> {
  const trusted=createAcademyReadPlan(plan.request);
  if(environment.origin!==trusted.origin||environment.authenticatedTeacherVisible!==true)throw new Error('authentication_required');
  if(JSON.stringify(plan)!==JSON.stringify(trusted))throw new Error('read_plan_drift');
  if(trusted.family==='item_answer') {
    if(environment.principalKey!==trusted.request.teacherKey)throw Error('exact_teacher_principal_required');
    const result=await readItemAnswerBatch(trusted.request.lectureKeys,environment,environment.onItemAnswerObservation??(()=>{}));
    return {schemaVersion:1,family:'item_answer',status:result.status,records:[],dailyResults:[],dayRecords:[],itemAnswers:result.observations,
      requestedAnswerLabels:result.requestedLabels,pendingAnswerLabels:result.pendingLabels,answerBlockedReason:result.blockedReason,
      observedAt:new Date().toISOString(),coverage:'exact_requested_shared_answers_not_printed_versions',unknownStates:[...trusted.unknownStates],nativePrintInvoked:false,automaticRetryAllowed:false};
  }
  if(trusted.family==='student_course') {
    const {family,...request}=trusted.request;
    const rows=await readStudentCourses(request,environment);
    return {schemaVersion:1,family:'student_course',status:'observed',records:[],dailyResults:[],dayRecords:[],studentCourses:rows,studentCourseScope:request,
      observedAt:new Date().toISOString(),coverage:'observed_rows_not_all_assignments_or_pagination',unknownStates:[...trusted.unknownStates],nativePrintInvoked:false,automaticRetryAllowed:false};
  }
  if(trusted.family==='item_metadata') {
    const item=await readItemMetadata(trusted.request.lectureKey,environment);
    return {schemaVersion:1,family:'item_metadata',status:'observed',records:[],dailyResults:[],dayRecords:[],itemMetadata:[item],
      observedAt:new Date().toISOString(),coverage:'one_exact_verified_item_not_all_content_or_batch_encoding',unknownStates:[...trusted.unknownStates],nativePrintInvoked:false,automaticRetryAllowed:false};
  }
  if(trusted.family==='day_record') {
    const dayRecords=await readDayRecordSource(trusted.request,environment);
    return {schemaVersion:1,family:'day_record',status:dayRecords.length===trusted.request.studentNames.length?'observed':dayRecords.length?'partial':'blocked',
      records:[],dailyResults:[],dayRecords,requestedScope:trusted.request,observedAt:new Date().toISOString(),coverage:'requested_date_groups_students_not_cohort_completeness',
      unknownStates:[...trusted.unknownStates],nativePrintInvoked:false,automaticRetryAllowed:false};
  }
  if(trusted.family==='daily_zero') {
    const dailyResults=await readAssessmentBatch(trusted.request.targets,{...environment,scoreViewAdmission:true});
    const observed=dailyResults.filter(x=>x.status==='observed').length;
    return {schemaVersion:1,family:'daily_zero',status:observed===dailyResults.length?'observed':observed?'partial':'blocked',records:[],dailyResults,dayRecords:[],
      observedAt:new Date().toISOString(),coverage:'requested_daily_targets',unknownStates:[...trusted.unknownStates],nativePrintInvoked:false,automaticRetryAllowed:false};
  }
  const request=trusted.request;
  const post=async(path:string,fields:Record<string,string>)=>{
    const response=await environment.fetcher(path,{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',
      headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-Requested-With':'XMLHttpRequest'},
      body:new URLSearchParams(fields).toString(),signal:AbortSignal.timeout(20000)});
    if(!response.ok||response.redirected)throw new Error('source_transport_failed');
    const text=await response.text();
    if(text.length>2000000)throw new Error('source_response_too_large');
    if(/webUserPass|세션이 만료/.test(text))throw new Error('authentication_required');
    return text;
  };
  const progress=await post('/servlet/controller.coursemanage.TextBookManageServlet?reqCmd=getTextBookProgress',{student_name:request.studentName});
  parseTextbookScopeBinding(progress,request);
  const raw=readInputRecord(JSON.parse(await post('/servlet/controller.common.TestpageSelectExServlet',{
    p_process:'getWrongAnswerNoteResult',answerNoteResult:JSON.stringify({courseKeyList:[request.courseKey],bookNoList:[request.bookNo],userKeyList:[request.studentKey]}),
  })));
  if(raw.result!=='ok'||!Array.isArray(raw.noteResultList))throw new Error('wrong_note_contract_rejected');
  const notes=raw.noteResultList.map(readInputRecord);
  for(const row of notes)if(sourceResponseKey(row.pri_no)!==request.studentKey||row.name!==request.studentName)throw new Error('source_subject_conflict');
  const records:StoredSourceRecord[]=[];
  for(const title of request.sourceTitles) {
    const matches=notes.filter(row=>row.testing_name===title);
    if(matches.length!==1)throw new Error('source_selection_missing_or_ambiguous');
    const row=matches[0]!;
    const paperKey=sourceResponseKey(row.p_no),attemptKey=sourceResponseKey(row.testing_no);
    const data=readInputRecord(JSON.parse(await post('/servlet/controller.common.TestpageSelectExServlet',{
      p_process:'getStudyResultSingleTestingSingleUser',condition:JSON.stringify({testing_no:Number(readLiteralKey(attemptKey)),pri_no:Number(request.studentKey),
        student_name:request.studentName,score:{create:1},incorrect:{create:0},similar:{create:0},advance:{create:0},report:{create:0}}),
    })));
    const detail=parseScoreView(data,{studentKey:request.studentKey,studentName:request.studentName,attemptKey});
    const paper=readInputRecord((data.print_list as unknown[])[0]);
    if(paper.sub_title!==title)throw new Error('source_title_conflict');
    const items=(paper.exam_list as unknown[]).map(readInputRecord).map(item=>({originalOrdinal:sourceResponseKey(item.exam_no),
      lectureKey:item.lecture_key==null?null:sourceResponseKey(item.lecture_key),outerLectureKey:item.outer_lecture_key==null?null:sourceResponseKey(item.outer_lecture_key),
      scoring:item.scoring_result as 'O'|'X'})).sort((a,b)=>Number(a.originalOrdinal)-Number(b.originalOrdinal));
    const literal=typeof row.apply_date==='string'?row.apply_date:null;
    records.push({sourceTitle:title,studentKey:request.studentKey,studentName:request.studentName,courseKey:request.courseKey,bookNo:request.bookNo,paperKey,attemptKey,
      score:detail.score,items,sourceDate:{literal,precision:literal&&/^\d{2}-\d{2}$/.test(literal)?'month_day':'unknown',meaning:'source_apply_date_not_exact_grade_time'}});
  }
  records.sort((a,b)=>a.sourceTitle<b.sourceTitle?-1:a.sourceTitle>b.sourceTitle?1:0);
  return {schemaVersion:1,family:'textbook',status:'observed',records,dailyResults:[],dayRecords:[],observedAt:new Date().toISOString(),coverage:'exact_selected_existing_records_not_whole_book',
    unknownStates:[...trusted.unknownStates],nativePrintInvoked:false,automaticRetryAllowed:false};
}

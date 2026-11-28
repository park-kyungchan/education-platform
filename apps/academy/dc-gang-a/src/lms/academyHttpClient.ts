import {CISM_PATH,parseCismReport,cismWriteParameters,cismWeek,type CismReport} from './cismWeeklyProtocol';
import {JSDOM} from 'jsdom';
import {TEXTBOOK_CATALOG_PATH,MAX_TEXTBOOK_CATALOG_BYTES,MAX_TEXTBOOK_SAMPLE_BYTES,MAX_TEXTBOOK_REFERENCE_BYTES,parseTextbookCatalog,boundedTextbookBody,qualifiedTextbookPdfUrl,textbookPdfDigest,type TextbookCatalogObservation,type TextbookPdfObservation,type TextbookSchoolLevel} from './textbookCatalogRead';
import {PRESTUDY_PATH,PRESTUDY_SUMMARY_PATH,PRESTUDY_REPORT_PATH,TEXTBOOK_PROGRESS_PATH,PRESTUDY_VIEWS,PrestudyFormDrift,type PrestudyView,parsePrestudySearchForm,parsePrestudyList,parsePrestudySummary,prestudyRowsForStudent,parseTextbookBindings,parsePrestudyDetail,parsePrestudyReport,type PrestudyListRow,type PrestudySummaryRow,type TextbookBinding,type PrestudyReport} from './prestudyRead';
import {LmsReadRefusal,readBoundedLmsPage,qualifyLmsScheduleInput,lmsScheduleRequestPath,parseLmsSchedule,type LmsScheduleInput,type LmsScheduleRead} from './lmsScheduleRead';
import {randomInt,createHash} from 'node:crypto';
import {examRouteClass,examRouteOf} from './lmsRouteRegistry';
import {createAcademyReadPlan,executeAcademyRead,readLiteralKey,readLiteralName,sourceResponseKey,parseTextbookScopeBinding,type AcademyReadResult,type ScopedAcademyReadPlan} from './academyReadProtocol';
import {readInputRecord} from '../contracts/readInputRecord';
import {currentDayRecordColumns} from './dayRecordColumnContract';
import {inspectDayRecordGroupMetadata} from './dayRecordGroupMetadata';
import type {SourceDiscoveryRequest} from '../contracts/sourceDiscovery';
import {canonicalJson,digest,assertExactKeys,assertDate} from '../learning/model';
import {applyJournalHttpAction,validateJournalHttpAction,assertJournalWireQualified,assertJournalAssessmentOptions,journalWireDigest,JOURNAL_HTTP_SOURCE_CONTRACT,type JournalHttpTarget,type JournalHttpState,type JournalHttpAction,type JournalHttpAdmission} from './lessonJournalHttp';
import {parseItemMetadata} from './itemMetadataRead';
import {selectSourceFunction} from './sourceFunctionText';
import {inspectAssessmentSearchMetadata,inspectStudentNameSearch,parseScoreView} from './assessmentReadProtocol';
import {PAPER_EXAM_LIST_PATH,paperExamListForm,parsePaperExamList,printArchiveUrl,boundedPrintArchiveBody,type PaperExamRow,type PrintArchiveKind} from './paperPrintRead';
import {COURSE_BOOK_REPORT_PATH,isLoginOrSessionPage,readCourseBookReportEnvelope,projectCourseBookReport,type CourseBookReport} from './courseBookReport';
import {REPORT_VIEW_PATH,readReportViewEnvelope,reportViewForm} from './reportViewClient';
import {validateReportViewName} from './reportViewRead';
import {qualifyStudentPaperSearchPeriod,type StudentPaperSearchPeriod} from './studentPaperSearchPeriod';
import {deriveTextbookSectionTitlePattern,mergeTextbookSectionRows,TEXTBOOK_PAPER_SEARCH_COVERAGE,type TextbookPaperSearchRow} from './textbookSectionIndex';
import {decodePaperCode} from './printedPaperCode';
import {inspectTestPoolDocument,readTestPoolDocument,testPoolSelectorDefaults} from './testPoolInspection';
import {testPoolQuestionPreviewReferences,testPoolPreviewSourcePins} from './testPoolQuestionPreview';
import {inspectTestPoolPresentationProtocol as inspectPoolPresentationProtocol} from './testPoolPresentationProtocol';
import {qualifyNativePaperInputReference,qualifyNativePaperOptionsTemplate,inspectNativePaperOptionsResponse,readNativePaperLectureKeys,qualifyNativePaperSelectedQuestionsTemplate,nativePaperSelectedQuestionQuery,inspectNativePaperSelectedQuestionsResponse} from './nativePaperReadProtocol';
import {reusablePoolExpectation,reusableTestPoolRequest,qualifyReusablePoolTab,qualifyReusablePoolMain,readReusablePoolText,reusablePoolCreatedKey,reusablePoolReadbackKey,verifyReusablePoolMembership,inspectReusablePoolMainTarget,ReusableTestPoolCreateFailure,REUSABLE_POOL_INDEX_PATH,
 lectureUsageExpectation,lectureUsageRequest,qualifyLectureUsageTab,inspectLectureUsageHistory,verifyLectureUsageDelta,lectureUsageDateAt,LectureUsageWriteFailure,LECTURE_USAGE_HISTORY_PATH,
 type ReusableTestPoolInput,type ReusablePoolExpectation,type ReusablePoolDispatch,type LectureUsageInput,type LectureUsageExpectation,type LectureUsageSnapshot,type LectureUsageDispatch} from './reusableTestPoolProtocol';
import {emptyTestPoolScope,testPoolScope,testPoolReadRequest,parseTestPoolCategories,qualifyTestPoolTypeTemplate,parseTestPoolTypeLabels,extractTestPoolLabelPayload,qualifyTestPoolQuestionTemplate,parseTestPoolQuestions,type TestPoolScope} from './testPoolReadProtocol';

export const ACADEMY_ORIGIN='https://dc.gang-a.kr' as const;
export interface AcademyPrincipal {teacherLabel:string;teacherKey:string;collegeKey:string}
export interface AcademyCredential {username:string;password:string}
export type SourceTransport=(url:string,init:RequestInit)=>Promise<Response>;
/** The DT/ZT result search's month selectors after the default `sort_date` '1', in their listed order. */
export const DAILY_TEST_HISTORY_SELECTORS=['11','12','13','14','15','16'] as const;
export type DailyTestHistorySelector=typeof DAILY_TEST_HISTORY_SELECTORS[number];
/** Failure metadata deliberately excludes URL parameters, bodies, headers and session values. */
export class AcademyHttpFailure extends Error {
  constructor(readonly httpStatus:number,readonly sourceOperation:string){super('source_http_failed');this.name='AcademyHttpFailure';}
}
/** Inert standards DOM: no resources, scripts or event handlers execute. */
export const sourceDomParser={
  parseFromString:(text:string,mime:DOMParserSupportedType):Document=>new JSDOM(text,{contentType:mime}).window.document as unknown as Document,
  parseWithSourceLocations:(text:string)=>{
    const dom=new JSDOM(text,{contentType:'text/html',includeNodeLocations:true});
    return {document:dom.window.document as unknown as Document,sourceRange:(node:Node)=>{
      const location=dom.nodeLocation(node);
      return location?{start:location.startOffset,end:location.endOffset}:null;
    }};
  },
};
/** Fresh client-issued session only. No vault/cookie export, persistent jar or automatic login retry. */
export class AcademyHttpClient {
  #cookies=new Map<string,{value:string;path:string}>();
  #authenticated=false;
  #loginAttempted=false;
  #principal:AcademyPrincipal;
  #transport:SourceTransport;
  #testPoolProtocol:{defaults:Record<string,string>;selectorSha256:string;html:string}|null=null;
  #reusablePoolCreateAttempted=false;
  #lectureUsageWriteAttempted=false;
  /** Wrong-note attempts verified by readHistoricalTextbookIndex, per exact scope: the only attempts a historical section read may follow. */
  #historicalAttempts=new Map<string,Map<string,{sourceTitle:string;paperKey:string;attemptKey:string}>>();
  constructor(principal:AcademyPrincipal,transport:SourceTransport=fetch){
    this.#principal={teacherLabel:readLiteralName(principal.teacherLabel),teacherKey:readLiteralKey(principal.teacherKey),collegeKey:readLiteralKey(principal.collegeKey)};
    this.#transport=transport;
  }
  get authenticated(){return this.#authenticated;}
  async readCismReport(input:{teacherLabel:string;date:string}):Promise<CismReport>{
    if(Object.keys(input).sort().join(',')!=='date,teacherLabel'||input.teacherLabel!==this.#principal.teacherLabel)throw Error('cism_scope_conflict');
    cismWeek(input.date);if(!this.#authenticated)throw Error('authentication_required');
    const path=CISM_PATH+'?'+new URLSearchParams({reqCmd:'CismChartMain',tutor_pri_no:this.#principal.teacherKey,the_date:input.date});
    const response=await this.#request(path,{method:'GET'},false,'cism_weekly_read');
    const bytes=await boundedTextbookBody(response,2000000,'catalog');
    return parseCismReport(new TextDecoder().decode(bytes),sourceDomParser.parseFromString,input.date,this.#principal);
  }
  async applyCismField(input:{teacherLabel:string;date:string;fieldRef:string;before:string;after:string;wireSha256:string;completeExistingNarrative?:boolean},authorize:()=>Promise<boolean>,recordAcknowledgement?:(value:{contentType:string;raw:Uint8Array;sha256:string})=>Promise<void>){
    const current=await this.readCismReport({teacherLabel:input.teacherLabel,date:input.date}),field=current.fields.find(f=>f.fieldRef===input.fieldRef);
    if(!field||current.wireSha256!==input.wireSha256||field.value!==input.before)throw Error('cism_stale_before');
    if(field.value.trim()&&(field.kind!=='class_mode'||field.value!=='0')&&!(field.kind==='narrative'&&input.completeExistingNarrative===true))throw Error('cism_existing_value_preserved');
    const params=cismWriteParameters(current,field,input.after);if(!await authorize())throw Error('cism_review_required');
    const response=await this.#request(CISM_PATH,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'},body:params.toString()},false,'cism_field_save');
    const mime=response.headers.get('content-type')??'';
    const raw=await boundedTextbookBody(new Response(response.body,{status:response.status,headers:{'Content-Type':'text/html'}}),65536,'catalog'),sha256=createHash('sha256').update(raw).digest('hex');
    await recordAcknowledgement?.({contentType:mime,raw,sha256});
    let ack:unknown;try{ack=JSON.parse(new TextDecoder().decode(raw));}catch{}
    const result=ack&&typeof ack==='object'?(ack as {result?:unknown}).result:undefined;
    // The native narrative handler only rejects FAIL; it does not require OK.
    // Never infer persistence from an acknowledgement. Verify the exact source field.
    const readback=await this.readCismReport({teacherLabel:input.teacherLabel,date:input.date});
    if(result==='FAIL')throw Error('cism_ack_rejected');
    if(readback.fields.find(f=>f.fieldRef===input.fieldRef)?.value!==input.after)throw Error('cism_readback_mismatch');
    return {status:'persisted' as const,fieldRef:input.fieldRef,report:readback,acknowledgement:{sha256,byteLength:raw.length,jsonResult:result==='OK'?'OK':result==='FAIL'?'FAIL':ack===undefined?'not_json':'other',persistenceBasis:'exact_native_readback'}};
  }
  async readTextbookCatalog(input:{teacherLabel:string;schoolLevel?:TextbookSchoolLevel}):Promise<TextbookCatalogObservation>{
    if(!input||Object.keys(input).some(k=>!['teacherLabel','schoolLevel'].includes(k))||input.teacherLabel!==this.#principal.teacherLabel)throw Error('textbook_catalog_principal_rejected');
    if(!this.#authenticated)throw Error('authentication_required');
    const schoolLevel=input.schoolLevel??'middle';if(!['elementary','middle','high'].includes(schoolLevel))throw Error('textbook_catalog_school_level_rejected');
    const path=TEXTBOOK_CATALOG_PATH+(schoolLevel==='middle'?'':'&grade='+schoolLevel);
    const response=await this.#request(path,{method:'GET'},false,'textbook_answer_catalog');
    const bytes=await boundedTextbookBody(response,MAX_TEXTBOOK_CATALOG_BYTES,'catalog');
    return parseTextbookCatalog(new TextDecoder().decode(bytes),sourceDomParser.parseFromString,schoolLevel);
  }
  async readTextbookPdf(input:{teacherLabel:string;documentRef:string;schoolLevel:TextbookSchoolLevel}):Promise<TextbookPdfObservation>{
    if(!input||Object.keys(input).sort().join(',')!=='documentRef,schoolLevel,teacherLabel'||!/^[a-f0-9]{64}$/.test(input.documentRef))throw Error('textbook_pdf_input_rejected');
    const catalog=await this.readTextbookCatalog({teacherLabel:input.teacherLabel,schoolLevel:input.schoolLevel});
    const entry=catalog.entries.find(e=>e.documentRef===input.documentRef);if(!entry)throw Error('textbook_pdf_not_in_current_catalog');
    const url=qualifiedTextbookPdfUrl(entry.url);let response:Response;
    try{response=await this.#transport(url.href,{method:'GET',headers:{Accept:'application/pdf'},credentials:'omit',redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(20000)});}
    catch{throw Error('textbook_pdf_transport_failed');}
    if(response.url&&response.url!==url.href)throw Error('textbook_pdf_response_url_rejected');
    const bytes=await boundedTextbookBody(response,entry.kind==='sample'?MAX_TEXTBOOK_SAMPLE_BYTES:MAX_TEXTBOOK_REFERENCE_BYTES,'pdf');
    return {schoolLevel:input.schoolLevel,kind:entry.kind,documentRef:entry.documentRef,filename:entry.filename,sourceUrl:entry.url,sourceLabels:entry.sourceLabels,catalogSha256:catalog.catalogSha256,
      observedAt:new Date().toISOString(),sha256:textbookPdfDigest(bytes),byteLength:bytes.byteLength,bytes,sourceRequests:2};
  }
  /** Prestudy video lists for one exact student. The waiting list proves an
   * upload awaiting teacher review; the completed list and the summary page
   * are separate source surfaces. AI score/star literals are reported as
   * literals only; teacher review remains a separate, unobserved state. */
  async readPrestudy(input:{teacherLabel:string;studentName:string;view?:PrestudyView}):Promise<{view:PrestudyView;waiting?:PrestudyListRow[];completed?:PrestudyListRow[];summary?:PrestudySummaryRow[];observedAt:string;coverage:string}>{
    if(!input||Object.keys(input).some(k=>!['studentName','teacherLabel','view'].includes(k))||!('studentName' in input)||!('teacherLabel' in input)||input.teacherLabel!==this.#principal.teacherLabel)throw Error('prestudy_principal_rejected');
    const view=input.view??'videos';
    if(!PRESTUDY_VIEWS.includes(view))throw Error('prestudy_principal_rejected');
    readLiteralName(input.studentName);
    if(!this.#authenticated)throw Error('authentication_required');
    const pageText=async(path:string,init:RequestInit,operation:string)=>readBoundedLmsPage(await this.#request(path,init,false,operation));
    const search=async(cmd:'WebUnPreStudy'|'WebCtPreStudy')=>{
      const shell=await pageText(PRESTUDY_PATH+'?reqCmd='+cmd,{method:'GET'},cmd);
      const form=parsePrestudySearchForm(shell,sourceDomParser.parseFromString,cmd,this.#principal.teacherKey);
      const body=new URLSearchParams({reqCmd:form.reqCmd,g_clg_no:form.collegeKey,g_mem_type:form.memberType,g_pri_no:form.teacherKey,student_name:input.studentName});
      const result=await pageText(PRESTUDY_PATH,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'},body:body.toString()},cmd);
      return prestudyRowsForStudent(parsePrestudyList(result,sourceDomParser.parseFromString,cmd,this.#principal.teacherKey),input.studentName);
    };
    try{
      // lms-reads.md R1: each view sends only the requests of its own rows, in the old tool's order.
      const waiting=view==='teacher_summary'?undefined:await search('WebUnPreStudy');
      const completed=view==='videos'?await search('WebCtPreStudy'):undefined;
      const summary=view==='incomplete'?undefined:prestudyRowsForStudent(parsePrestudySummary(await pageText(PRESTUDY_SUMMARY_PATH,{method:'GET'},'TeacherPrestudySummary'),sourceDomParser.parseFromString),input.studentName);
      return {view,...(waiting?{waiting}:{}),...(completed?{completed}:{}),...(summary?{summary}:{}),observedAt:new Date().toISOString(),
        coverage:view==='videos'?'exact_student_rows_on_waiting_completed_and_one_observed_summary_page_not_all_history'
          :view==='incomplete'?'exact_student_rows_on_the_waiting_list_only_not_all_history':'exact_student_rows_on_one_observed_summary_page_only'};
    }catch(error){throw this.#lmsReadFailure(error);}
  }
  /** One LMS schedule page of the teacher: attendance, the study schedule or the course study manager
   * (specs/academy-mcp/lms-reads.md). One GET; the page is read bounded and parsed fail closed. */
  async readLmsSchedule(input:{teacherLabel:string}&LmsScheduleInput):Promise<LmsScheduleRead&{observedAt:string;coverage:string}>{
    if(!input||input.teacherLabel!==this.#principal.teacherLabel)throw Error('lms_schedule_principal_rejected');
    const {teacherLabel:_label,...rest}=input;
    const qualified=qualifyLmsScheduleInput(rest);
    if(!this.#authenticated)throw Error('authentication_required');
    try{
      const html=await readBoundedLmsPage(await this.#request(lmsScheduleRequestPath(qualified),{method:'GET'},false,'lms_schedule_read'));
      const page=parseLmsSchedule(qualified,html,sourceDomParser.parseFromString,this.#principal.teacherKey);
      return {...page,observedAt:new Date().toISOString(),coverage:'one_observed_page_of_the_view_not_all_history'};
    }catch(error){throw this.#lmsReadFailure(error);}
  }
  /** The public refusal of a failed LMS read (lms-reads.md R4, R5, R8): a redirect, an HTTP 401 or 403, a login or
   * session page closes the session and is `authentication_required` (no login is retried: `authenticate` runs once);
   * the prestudy parsers' own codes become `source_rejected`, `source_drift` and `scope_conflict`. Never carries page text. */
  #lmsReadFailure(error:unknown):Error{
    const message=error instanceof Error?error.message:'';
    if(error instanceof AcademyHttpFailure&&[401,403].includes(error.httpStatus)||['source_redirect_rejected','source_redirect_contract_rejected','foreign_source_redirect_rejected','prestudy_authentication_required','authentication_required'].includes(message)||error instanceof LmsReadRefusal&&error.code==='authentication_required'){
      this.close();return Error('authentication_required');
    }
    if(error instanceof PrestudyFormDrift)return Error(error.scopeConflict?'scope_conflict':'source_drift');
    if(message==='prestudy_source_rejected')return Error('source_rejected');
    if(['prestudy_search_form_missing','prestudy_summary_table_missing','prestudy_row_unqualified','prestudy_summary_row_unqualified'].includes(message))return Error('source_drift');
    return error instanceof Error?error:Error('source_cause_unclassified');
  }
  /** AI prestudy report for one exact uploaded-video record. The detail
   * record must belong to the exact student; its rendered analysis key is
   * followed to the server-rendered report page. Report text is student
   * content for the teacher only; no transcript field exists on either
   * page and none is derived. */
  async readPrestudyReport(input:{teacherLabel:string;studentName:string;studentKey:string;prestudyKey:string}):Promise<PrestudyReport&{prestudyKey:string;sourceRecord:{prestudyKey:string;unitLabel:string|null;dateLiteral:string|null};encodingResult:string|null;observedAt:string;coverage:string}>{
    if(!input||Object.keys(input).sort().join(',')!=='prestudyKey,studentKey,studentName,teacherLabel'||input.teacherLabel!==this.#principal.teacherLabel)throw Error('prestudy_report_principal_rejected');
    readLiteralName(input.studentName);readLiteralKey(input.studentKey);readLiteralKey(input.prestudyKey);
    if(!this.#authenticated)throw Error('authentication_required');
    const pageText=async(path:string,operation:string)=>readBoundedLmsPage(await this.#request(path,{method:'GET'},false,operation));
    let detail:ReturnType<typeof parsePrestudyDetail>,report:PrestudyReport;
    try{
      const detailHtml=await pageText(PRESTUDY_PATH+'?reqCmd=WebPreStudy&prestudy_key='+encodeURIComponent(input.prestudyKey),'WebPreStudy');
      detail=parsePrestudyDetail(detailHtml,sourceDomParser.parseFromString,input.studentKey,input.prestudyKey);
      if(!detail.analysisKey)throw Error('prestudy_report_not_ready');
      const reportHtml=await pageText(PRESTUDY_REPORT_PATH+'?analysis_key='+encodeURIComponent(detail.analysisKey),'prestudy_ai_report');
      report=parsePrestudyReport(reportHtml,sourceDomParser.parseFromString);
    }catch(error){throw this.#lmsReadFailure(error);}
    return {...report,prestudyKey:detail.prestudyKey,sourceRecord:{prestudyKey:detail.prestudyKey,unitLabel:detail.unitLabel,dateLiteral:detail.dateLiteral},encodingResult:detail.encodingResult,observedAt:new Date().toISOString(),
      coverage:'exact_prestudy_detail_and_server_rendered_ai_report_sections_not_transcript'};
  }
  /** Registered textbook bindings for one exact student, from the live
   * getTextBookProgress rows. Caller IDs are never accepted here. */
  async readTextbookBindings(input:{teacherLabel:string;studentName:string;studentKey:string}):Promise<TextbookBinding[]>{
    if(!input||Object.keys(input).sort().join(',')!=='studentKey,studentName,teacherLabel'||input.teacherLabel!==this.#principal.teacherLabel)throw Error('textbook_binding_principal_rejected');
    readLiteralName(input.studentName);readLiteralKey(input.studentKey);
    if(!this.#authenticated)throw Error('authentication_required');
    const response=await this.#request(TEXTBOOK_PROGRESS_PATH,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-Requested-With':'XMLHttpRequest'},body:new URLSearchParams({student_name:input.studentName}).toString()},false,'getTextBookProgress');
    const text=await response.text();if(text.length>2000000)throw Error('textbook_binding_source_rejected');
    return parseTextbookBindings(text,sourceDomParser.parseFromString,input.studentKey);
  }
  close(){this.#cookies.clear();this.#authenticated=false;this.#testPoolProtocol=null;}
  /** Fixed original DayRecord Main document; selector/date metadata only, never roster rows or handlers. */
  async inspectDayRecordGroupSelector(input:{teacherLabel:string;date:string}){
    if(!input||typeof input!=='object'||Object.keys(input).sort().join(',')!=='date,teacherLabel'||input.teacherLabel!==this.#principal.teacherLabel||
      typeof input.date!=='string'||!/^20[0-9]{2}-[0-9]{2}-[0-9]{2}$/.test(input.date))throw Error('day_record_group_input_invalid');
    const calendar=new Date(input.date+'T00:00:00.000Z');if(!Number.isFinite(calendar.valueOf())||calendar.toISOString().slice(0,10)!==input.date)throw Error('day_record_group_input_invalid');
    if(!this.#authenticated)throw Error('authentication_required');
    try{
      const path='/servlet/controller.cct.tutor.DayRecordServlet?'+new URLSearchParams({p_process:'Main',std_ymd:input.date.replaceAll('-','')});
      const raw=await readReusablePoolText(await this.#request(path,{method:'GET'},false,'day_record_group_selector'));
      if(/normal_session_error\.jsp|popup_session_error\.jsp|세션이 만료|<input\b[^>]*\btype\s*=\s*["']?password/i.test(raw))throw Error('test_pool_authentication_required');
      return {...inspectDayRecordGroupMetadata(raw,sourceDomParser.parseFromString,input.date),sourceOperation:'day_record_group_selector' as const,
        authenticatedPrincipalQualified:true as const,requestedTeacherMatchesClientPrincipal:true as const,responsePrincipalRechecked:false as const,
        academyWrites:0 as const,sourceHandlersExecuted:false as const,rosterRowsExported:false as const,serverSideEffects:'not_independently_observed' as const};
    }catch(error){
      if(error instanceof AcademyHttpFailure&&[401,403].includes(error.httpStatus)||error instanceof Error&&['source_redirect_rejected','foreign_source_redirect_rejected','test_pool_authentication_required','day_record_group_authentication_required'].includes(error.message))this.close();throw error;
    }
  }
  async #request(path:string,init:RequestInit={},followLoginRedirect=false,sourceOperation?:string):Promise<Response>{
    const url=new URL(path,ACADEMY_ORIGIN);
    if(url.origin!==ACADEMY_ORIGIN||url.username||url.password||url.hash)throw Error('fixed_academy_origin_required');
    const headers=new Headers(init.headers);
    if(headers.has('cookie')||headers.has('authorization'))throw Error('caller_credentials_rejected');
    const cookie=[...this.#cookies].filter(([,v])=>url.pathname.startsWith(v.path)).map(([k,v])=>k+'='+v.value).join('; ');
    if(cookie)headers.set('Cookie',cookie);
    headers.set('Origin',ACADEMY_ORIGIN);headers.set('Referer',ACADEMY_ORIGIN+'/c_login.jsp');
    let response:Response;
    try{response=await this.#transport(url.href,{...init,headers,redirect:'manual',cache:'no-store',signal:init.signal??AbortSignal.timeout(20000)});}catch{throw Error('academy_transport_failed');}
    for(const raw of response.headers.getSetCookie()){
      const [pair,...attributes]=raw.split(';');const equal=pair!.indexOf('=');const name=pair!.slice(0,equal).trim(),value=pair!.slice(equal+1);
      if(equal<1||name!=='JSESSIONID')continue;
      const domain=attributes.find(x=>/^\s*domain=/i.test(x))?.split('=')[1]?.trim().replace(/^\./,'');
      if(domain&&domain!=='dc.gang-a.kr')throw Error('foreign_session_cookie_rejected');
      const pathValue=attributes.find(x=>/^\s*path=/i.test(x))?.slice(attributes.find(x=>/^\s*path=/i.test(x))!.indexOf('=')+1).trim()??'/';
      if(!pathValue.startsWith('/')||/[\r\n;]/.test(value))throw Error('session_cookie_contract_rejected');
      if(!value||attributes.some(x=>/^\s*max-age=0\s*$/i.test(x)))this.#cookies.delete(name);else this.#cookies.set(name,{value,path:pathValue});
    }
    if(response.status>=300&&response.status<400){
      const location=response.headers.get('location');if(!location)throw Error('source_redirect_contract_rejected');
      const next=new URL(location,url);
      if(next.origin!==ACADEMY_ORIGIN||next.username||next.password||next.hash)throw Error('foreign_source_redirect_rejected');
      if(!followLoginRedirect)throw Error('source_redirect_rejected');
      return this.#request(next.href,{method:'GET'},false);
    }
    if(!response.ok)throw new AcademyHttpFailure(response.status,sourceOperation??(url.pathname==='/c_login.jsp'?'login_document':url.pathname==='/servlet/controller.login.LoginServlet'?'login_submission':'owned_source_request'));
    return response;
  }
  async authenticate(credential:AcademyCredential){
    if(this.#loginAttempted)throw Error('fresh_authentication_attempt_required');this.#loginAttempted=true;
    if(typeof credential.username!=='string'||!credential.username||typeof credential.password!=='string'||!credential.password)throw Error('native_http_credentials_required');
    try{
      const html=await (await this.#request('/c_login.jsp')).text();
      const doc=sourceDomParser.parseFromString(html,'text/html'),form=doc.querySelector('form#loginForm');
      const names=['p_process','p_prino','p_groupno','userpwd','userid','cf_pc','cf_user','autoLoginCheck','autoLoginKey'];
      if(!form||form.getAttribute('method')?.toLowerCase()!=='post'
        ||names.some(name=>!form.querySelector('[name='+name+']'))
        ||!html.includes('document.loginForm.action = "/servlet/controller.login.LoginServlet"')
        ||!html.includes('document.loginForm.p_process.value = "c_login"'))throw Error('login_wire_contract_drift');
      const alphabet='abcdefghijklmnopqrstuvwxyz0123456789';
      const encode=(literal:string)=>Buffer.from(literal+'  '+Array.from({length:30},()=>alphabet[randomInt(alphabet.length)]).join(''),'utf8').toString('base64');
      const body=new URLSearchParams({p_process:'c_login',p_prino:'',p_groupno:'',cf_pc:'',cf_user:'',autoLoginCheck:'',autoLoginKey:'',userid:encode(credential.username),userpwd:encode(credential.password)});
      await this.#request('/servlet/controller.login.LoginServlet',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'},body:body.toString()},true);
      const current=sourceDomParser.parseFromString(await (await this.#request('/servlet/controller.coursemanage.CourseManageServlet?reqCmd=StudyCourse')).text(),'text/html');
      const value=(selector:string)=>current.querySelector<HTMLInputElement>(selector)?.value;
      if(current.querySelector('input[type=password]'))throw Error('source_login_challenge');
      if(value('form[name=userForm] [name=pri_no]')!==this.#principal.teacherKey)throw Error('teacher_user_principal_conflict');
      if(value('form[name=form1] [name=g_pri_no]')!==this.#principal.teacherKey)throw Error('teacher_course_principal_conflict');
      if(value('form[name=form1] [name=g_clg_no]')!==this.#principal.collegeKey)throw Error('teacher_college_conflict');
      if(!value('form[name=form1] [name=g_mem_type]'))throw Error('teacher_member_type_missing');
      // StudyCourse's current account menu says "내정보", not the teacher's name.
      // The two independent opaque principal fields above establish identity.
      if(![...current.querySelectorAll('a,span')].some(node=>/로그아웃/.test(node.textContent??'')))throw Error('teacher_logout_marker_drift');
      this.#authenticated=true;
      return {state:'authenticated' as const,principalKey:this.#principal.teacherKey,collegeKey:this.#principal.collegeKey,transport:'direct_http_api' as const};
    }catch(error){this.close();throw error;}
  }
  async discoverBooks(input:SourceDiscoveryRequest){
    if(input.teacherLabel!==this.#principal.teacherLabel||input.teacherKey!==this.#principal.teacherKey||input.collegeKey!==this.#principal.collegeKey)throw Error('source_principal_drift');
    if(!Array.isArray(input.studentNames)||!input.studentNames.length||input.studentNames.length>64||new Set(input.studentNames).size!==input.studentNames.length)throw Error('invalid_source_scope');
    input.studentNames.forEach(readLiteralName);if(!this.#authenticated)throw Error('authentication_required');
    const fetchDocument=async(path:string,init:RequestInit={})=>{
      const response=await this.#request(path,init),html=await response.text();
      if(html.length>2000000||/webUserPass|세션이 만료/.test(html))throw Error('source_contract_refused');
      return sourceDomParser.parseFromString(html,'text/html');
    };
    const endpoint='/servlet/controller.coursemanage.CourseManageServlet';
    const initial=await fetchDocument(endpoint+'?reqCmd=StudyCourse');
    const value=(name:string)=>initial.querySelector<HTMLInputElement>('form[name=form1] [name='+name+']')?.value;
    const principal=value('g_pri_no'),college=value('g_clg_no'),memberType=value('g_mem_type');
    if(principal!==input.teacherKey||college!==input.collegeKey||!memberType)throw Error('source_principal_drift');
    const students=[];
    for(const name of input.studentNames){
      const query=new URLSearchParams({reqCmd:'StudyCourse',clg_no:college,cls_no:'0',grade_no:'0',student_name:name});
      const current=await fetchDocument(endpoint+'?'+query,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'},body:new URLSearchParams({reqCmd:'StudyCourse',g_clg_no:college,g_pri_no:principal,g_mem_type:memberType,cls_no:'0',grade_no:'0',student_name:name}).toString()});
      if(current.querySelector<HTMLInputElement>('form[name=form1] [name=g_pri_no]')?.value!==principal||current.querySelector<HTMLInputElement>('form[name=form1] [name=g_clg_no]')?.value!==college)throw Error('source_principal_drift');
      const courseRows=[...current.querySelectorAll('tr')].filter(row=>[...row.querySelectorAll('[onclick]')].some(element=>/^\s*onChangeStatus\(/.test(element.getAttribute('onclick')??''))).map(row=>({cells:[...row.querySelectorAll(':scope > td')].map(cell=>cell.textContent?.trim()??''),handlers:[...row.querySelectorAll('[onclick]')].map(element=>element.getAttribute('onclick')!).filter(v=>/^\s*(onChangeStatus|onResetCourse|onDeleteCourse)\(/.test(v))}));
      const books=await fetchDocument('/servlet/controller.coursemanage.TextBookManageServlet?reqCmd=getTextBookProgress',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'},body:new URLSearchParams({student_name:name}).toString()});
      const bookRows=[...books.querySelectorAll('tr')].filter(row=>[...row.querySelectorAll('[onclick]')].some(element=>(element.getAttribute('onclick')??'').includes('createBookIncorrectPapers('))).map(row=>({cells:[...row.querySelectorAll(':scope > td')].map(cell=>cell.textContent?.trim()??''),bindings:[...row.querySelectorAll('[onclick]')].map(element=>element.getAttribute('onclick')!).filter(v=>v.includes('createBookIncorrectPapers('))}));
      students.push({name,courseRows,bookRows,observedAt:new Date().toISOString()});
    }
    return {schemaVersion:1,teacherLabel:input.teacherLabel,principalKey:principal,collegeKey:college,source:'direct_http_api',observedAt:new Date().toISOString(),academyMutations:0,students};
  }
  /** Explicit read of the user's TestPool index; no tab/form/creation handler is invoked. */
  async inspectTestPoolIndex(){
    if(!this.#authenticated)throw Error('authentication_required');
    const path='/servlet/controller.tutor.etest.TestPoolServlet?reqCmd=Main';
    const response=await this.#request(path,{method:'GET'},false,'test_pool_index');
    try{return {...inspectTestPoolDocument(await response.text(),sourceDomParser.parseFromString),
      sourceOperation:'test_pool_index' as const,observedAt:new Date().toISOString()};}
    catch(error){if(error instanceof Error&&error.message==='test_pool_authentication_required')this.close();throw error;}
  }
  /** Inspect the user-designated tab as inert text. Never invoke create, save, delete or print handlers. */
  async inspectTestPoolTab(){
    if(!this.#authenticated)throw Error('authentication_required');
    const response=await this.#request('/common/etest_pool.jsp',{method:'GET'},false,'test_pool_tab_document');
    try{return {...inspectTestPoolDocument(await response.text(),sourceDomParser.parseFromString),
      sourceOperation:'test_pool_tab_document' as const,observedAt:new Date().toISOString()};}
    catch(error){if(error instanceof Error&&error.message==='test_pool_authentication_required')this.close();throw error;}
  }
  async #reusablePoolReadback(poolNo:string,expected:ReusablePoolExpectation,tabSourceSha256:string,onMembershipVerified?:()=>void){
    const raw=await readReusablePoolText(await this.#request(REUSABLE_POOL_INDEX_PATH+'?'+new URLSearchParams({reqCmd:'getPool',pool_no:poolNo}),{method:'GET'},false,'reusable_pool_membership_readback'));
    const membership=verifyReusablePoolMembership(raw,expected);
    onMembershipVerified?.();
    const main=await readReusablePoolText(await this.#request(REUSABLE_POOL_INDEX_PATH+'?reqCmd=Main',{method:'GET'},false,'reusable_pool_index_readback'));
    const metadata=inspectReusablePoolMainTarget(main,poolNo,expected,this.#principal.teacherLabel,sourceDomParser.parseFromString);
    return {status:metadata.metadataVerified?'readback_verified' as const:'readback_partial' as const,poolNo,tabSourceSha256,membership,metadata,
      metadataReadbackScope:'ordered_membership_outer_keys_variants_titles_search_words_creator_question_count' as const,
      keywordTitleReadback:'not_projected_by_qualified_readback' as const,
      sourceHandlersExecuted:false as const,nativeProgramInvoked:false as const,serverSideEffects:'not_independently_observed' as const,automaticRetryAllowed:false as const,acceptance:'not_inferred' as const};
  }
  /** Read-only recovery for a known poolNo. Never constructs or submits a create request. */
  async readReusableTestPoolReadback(poolNo:string,input:ReusableTestPoolInput){
    const key=reusablePoolReadbackKey(poolNo),expected=reusablePoolExpectation(input);if(!this.#authenticated)throw Error('authentication_required');
    try{
      const tab=await readReusablePoolText(await this.#request('/common/etest_pool.jsp',{method:'GET'},false,'reusable_pool_readback_source'));
      const qualified=qualifyReusablePoolTab(tab,sourceDomParser.parseFromString);
      return {...await this.#reusablePoolReadback(key,expected,qualified.sourceSha256),academyWrites:0 as const};
    }catch(error){
      if(error instanceof AcademyHttpFailure&&[401,403].includes(error.httpStatus)||error instanceof Error&&['source_redirect_rejected','foreign_source_redirect_rejected','test_pool_authentication_required'].includes(error.message))this.close();throw error;
    }
  }
  /** Explicit single-attempt reusable save only. A durable external journal callback must finish before dispatch. */
  async createReusableTestPool(input:ReusableTestPoolInput,beforeDispatch:(admission:ReusablePoolDispatch)=>Promise<void>){
    if(!this.#authenticated)throw Error('authentication_required');
    if(this.#reusablePoolCreateAttempted)throw Error('reusable_pool_create_attempt_already_consumed');
    if(typeof beforeDispatch!=='function')throw Error('reusable_pool_dispatch_journal_required');
    const request=reusableTestPoolRequest(input);this.#reusablePoolCreateAttempted=true;
    let phase='source_preflight',dispatchAttempted=false,poolNo:string|null=null,metadataReadback:ReturnType<typeof inspectReusablePoolMainTarget>|undefined,membershipVerified=false,saveResponseSha256:string|null=null;
    try{
      const tab=await readReusablePoolText(await this.#request('/common/etest_pool.jsp',{method:'GET'},false,'reusable_pool_create_source'));
      const qualified=qualifyReusablePoolTab(tab,sourceDomParser.parseFromString);
      const main=await readReusablePoolText(await this.#request(REUSABLE_POOL_INDEX_PATH+'?reqCmd=Main',{method:'GET'},false,'reusable_pool_create_index'));
      const index=qualifyReusablePoolMain(main,sourceDomParser.parseFromString);
      phase='dispatch_journal';await beforeDispatch(Object.freeze({schemaVersion:'academy.reusable-test-pool-dispatch/1',method:'POST',path:request.path,
        bodySha256:request.bodySha256,selectionSha256:request.selectionSha256,tabSourceSha256:qualified.sourceSha256,mainSourceSha256:index.sourceSha256,automaticRetryAllowed:false}));
      if(!this.#authenticated)throw Error('authentication_required');
      phase='save_response';dispatchAttempted=true;
      const xml=await readReusablePoolText(await this.#request(request.path,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Accept':'application/xml'},body:request.body},false,'reusable_pool_create'));
      saveResponseSha256=createHash('sha256').update(xml,'utf8').digest('hex');poolNo=reusablePoolCreatedKey(xml,sourceDomParser.parseFromString);phase='readback';
      const readback=await this.#reusablePoolReadback(poolNo,request,qualified.sourceSha256,()=>{membershipVerified=true;});metadataReadback=readback.metadata;
      if(!metadataReadback.metadataVerified)throw Error('reusable_pool_metadata_unqualified');
      return {...readback,status:'created_readback_verified' as const,requestBodySha256:request.bodySha256,saveResponseSha256,dispatchAttempted:true as const,
        reusableSaveRequested:true as const,saveRequestsSubmitted:1 as const,noUseLogOrOptionUpdateSubmitted:true as const};
    }catch(error){
      if(error instanceof AcademyHttpFailure&&[401,403].includes(error.httpStatus)||error instanceof Error&&['source_redirect_rejected','foreign_source_redirect_rejected','test_pool_authentication_required'].includes(error.message))this.close();
      const code=error instanceof Error&&/^[a-z_]{1,100}$/.test(error.message)?error.message:'reusable_pool_create_unknown_failure';
      throw new ReusableTestPoolCreateFailure(code,phase,dispatchAttempted,poolNo,metadataReadback,membershipVerified,error instanceof AcademyHttpFailure?error.httpStatus:null,saveResponseSha256);
    }
  }
  async #lectureUsageHistory(expected:LectureUsageExpectation):Promise<LectureUsageSnapshot>{
    const histories=[];
    for(const lectureKey of expected.lectureKeys){
      const raw=await readReusablePoolText(await this.#request(LECTURE_USAGE_HISTORY_PATH+'?'+new URLSearchParams({p_process:'GetLectureListLog',lecture_key:lectureKey}),{method:'GET'},false,'lecture_usage_history'));
      histories.push(inspectLectureUsageHistory(raw,lectureKey,expected,sourceDomParser.parseFromString));
    }
    return {scopeSha256:expected.scopeSha256,date:expected.date,histories};
  }
  /** Exact selected IDs and matching memo/date only; no raw or unrelated history is returned. */
  async readLectureUsageHistory(input:LectureUsageInput){
    const expected=lectureUsageExpectation(input);if(!this.#authenticated)throw Error('authentication_required');
    try{
      const tab=await readReusablePoolText(await this.#request('/common/etest_pool.jsp',{method:'GET'},false,'lecture_usage_source'));
      const qualification=qualifyLectureUsageTab(tab,sourceDomParser.parseFromString);
      return {status:'history_observed' as const,...await this.#lectureUsageHistory(expected),tabSourceSha256:qualification.sourceSha256,
        academyWrites:0 as const,teacherAttribution:'not_returned_by_qualified_history' as const,sourceHandlersExecuted:false as const,automaticRetryAllowed:false as const,
        serverSideEffects:'not_independently_observed' as const,acceptance:'not_inferred' as const};
    }catch(error){
      if(error instanceof AcademyHttpFailure&&[401,403].includes(error.httpStatus)||error instanceof Error&&['source_redirect_rejected','foreign_source_redirect_rejected','test_pool_authentication_required'].includes(error.message))this.close();throw error;
    }
  }
  /** One original SaveLectureUseLog POST, fenced before dispatch and compared with both scoped snapshots. */
  async saveLectureUsageLog(input:LectureUsageInput,beforeDispatch:(admission:LectureUsageDispatch)=>Promise<void>){
    if(!this.#authenticated)throw Error('authentication_required');
    if(this.#lectureUsageWriteAttempted)throw Error('lecture_usage_write_attempt_already_consumed');
    if(typeof beforeDispatch!=='function')throw Error('lecture_usage_dispatch_journal_required');
    const request=lectureUsageRequest(input);if(request.date!==lectureUsageDateAt())throw Error('lecture_usage_current_date_required');this.#lectureUsageWriteAttempted=true;
    let phase='source_preflight',dispatchAttempted=false,baseline:LectureUsageSnapshot|null=null,readback:LectureUsageSnapshot|null=null,saveResponseSha256:string|null=null;
    try{
      const tab=await readReusablePoolText(await this.#request('/common/etest_pool.jsp',{method:'GET'},false,'lecture_usage_write_source'));
      const qualification=qualifyLectureUsageTab(tab,sourceDomParser.parseFromString);
      phase='baseline';baseline=await this.#lectureUsageHistory(request);
      if(baseline.histories.some(history=>history.unknownTargetDateCount))throw Error('lecture_usage_target_date_unqualified');
      if(baseline.histories.some(history=>history.matched.length>=500||history.recordCount>=5000))throw Error('lecture_usage_readback_capacity_exceeded');
      phase='dispatch_journal';await beforeDispatch(Object.freeze({schemaVersion:'academy.lecture-use-log-dispatch/1',method:'POST',path:request.path,
        bodySha256:request.bodySha256,scopeSha256:request.scopeSha256,tabSourceSha256:qualification.sourceSha256,
        baselineSha256:createHash('sha256').update(JSON.stringify(baseline)).digest('hex'),automaticRetryAllowed:false}));
      if(!this.#authenticated)throw Error('authentication_required');if(request.date!==lectureUsageDateAt())throw Error('lecture_usage_current_date_required');
      phase='save_response';dispatchAttempted=true;
      const raw=await readReusablePoolText(await this.#request(request.path,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','Accept':'application/xml'},body:request.body},false,'lecture_usage_write'));
      saveResponseSha256=createHash('sha256').update(raw).digest('hex');
      if(/normal_session_error\.jsp|popup_session_error\.jsp|세션이 만료|<input\b[^>]*\btype\s*=\s*["']?password/i.test(raw))throw Error('test_pool_authentication_required');
      phase='readback';readback=await this.#lectureUsageHistory(request);
      const comparison=verifyLectureUsageDelta(baseline,readback);if(!comparison.verified)throw Error('lecture_usage_increment_unqualified');
      return {status:'usage_saved_readback_matched' as const,scopeSha256:request.scopeSha256,requestBodySha256:request.bodySha256,tabSourceSha256:qualification.sourceSha256,
        saveResponseSha256,baseline,readback,comparison,saveRequestsSubmitted:1 as const,dispatchAttempted:true as const,automaticRetryAllowed:false as const,
        saveResponseValueUsedAsSuccessPredicate:false as const,sourceHandlersExecuted:false as const,nativeProgramInvoked:false as const,acceptance:'not_inferred' as const};
    }catch(error){
      if(error instanceof AcademyHttpFailure&&[401,403].includes(error.httpStatus)||error instanceof Error&&['source_redirect_rejected','foreign_source_redirect_rejected','test_pool_authentication_required'].includes(error.message))this.close();
      const code=error instanceof Error&&/^[a-z_]{1,100}$/.test(error.message)?error.message:'lecture_usage_write_unknown_failure';
      throw new LectureUsageWriteFailure(code,phase,dispatchAttempted,baseline,readback,saveResponseSha256);
    }
  }
  /** Source-referenced input document only; no question-row, save, print or generation request. */
  async inspectNativePaperInputDocument(){
    if(!this.#authenticated)throw Error('authentication_required');
    const reference=qualifyNativePaperInputReference(await this.inspectTestPoolTab());
    const response=await this.#request(reference.path,{method:'GET'},false,'native_paper_input_document');
    try{return {...inspectTestPoolDocument(await response.text(),sourceDomParser.parseFromString),sourceOperation:'native_paper_input_document' as const,
      tabSourceSha256:reference.tabSourceSha256,path:reference.path,selectedQuestionReadContract:'not_qualified' as const,observedAt:new Date().toISOString()};}
    catch(error){if(error instanceof Error&&error.message==='test_pool_authentication_required')this.close();throw error;}
  }
  /** Observe current native paper-option metadata through the exact original fixed GET template. */
  async readNativePaperOptions(){
    if(!this.#authenticated)throw Error('authentication_required');
    try{
      const html=await (await this.#request('/common/etest_pool.jsp',{method:'GET'},false,'native_paper_options_source')).text();
      const template=qualifyNativePaperOptionsTemplate(html,sourceDomParser.parseFromString);
      const query=new URLSearchParams(template.query);
      const text=await (await this.#request(template.path+'?'+query,{method:'GET'},false,'native_paper_options')).text();
      return {...inspectNativePaperOptionsResponse(text),sourceOperation:'native_paper_options' as const,
        sourceTemplate:template,observedAt:new Date().toISOString()};
    }catch(error){if(error instanceof Error&&error.message==='test_pool_authentication_required')this.close();throw error;}
  }
  /** Source-qualified exact selected-row GET. No UI grid mutation, defaults, save or native handoff. */
  async readNativePaperSelectedQuestions(lectureKeys:readonly string[]){
    if(!this.#authenticated)throw Error('authentication_required');
    const requested=readNativePaperLectureKeys(lectureKeys);
    try{
      const reference=qualifyNativePaperInputReference(await this.inspectTestPoolTab());
      const html=await (await this.#request(reference.path,{method:'GET'},false,'native_paper_selected_input_source')).text();
      const template=qualifyNativePaperSelectedQuestionsTemplate(html,sourceDomParser.parseFromString);
      const request=nativePaperSelectedQuestionQuery(requested,Date.now());
      const text=await (await this.#request(request.path+'?'+request.query,{method:'GET'},false,'native_paper_selected_questions')).text();
      return {...inspectNativePaperSelectedQuestionsResponse(text,requested,sourceDomParser.parseFromString),sourceOperation:'native_paper_selected_questions' as const,
        sourceTemplate:{...template,tabSourceSha256:reference.tabSourceSha256,tabSourceDigestMeaning:'canonical_json_string_sha256' as const},
        requestBinding:{method:request.method,path:request.path,p_process:'GetLectureList' as const,lectureKeys:requested,uniq:request.uniq,querySha256:request.querySha256,queryDigestMeaning:'raw_utf8_sha256' as const},
        observedAt:new Date().toISOString()};
    }catch(error){
      if(error instanceof AcademyHttpFailure&&[401,403].includes(error.httpStatus)
        ||error instanceof Error&&['source_redirect_rejected','foreign_source_redirect_rejected'].includes(error.message)){
        this.close();throw Error('test_pool_authentication_refused');
      }
      if(error instanceof Error&&error.message==='test_pool_authentication_required')this.close();throw error;
    }
  }
  /** Read the source-referenced type-selection document; no selection/generation request is sent. */
  async inspectTestPoolSelector(){
    if(!this.#authenticated)throw Error('authentication_required');
    const response=await this.#request('/common/testpage/testpage_select_hwp.jsp',{method:'GET'},false,'test_pool_type_selector_document');
    try{return {...inspectTestPoolDocument(await response.text(),sourceDomParser.parseFromString),
      sourceOperation:'test_pool_type_selector_document' as const,observedAt:new Date().toISOString()};}
    catch(error){if(error instanceof Error&&error.message==='test_pool_authentication_required')this.close();throw error;}
  }
  /** Only the fixed scripts referenced by the original question preview; inspect without executing. */
  async inspectTestPoolQuestionProtocol(){
    const selector=await this.inspectTestPoolSelector();
    const scripts=[];
    for(const path of ['/js/common.js','/js/common_function.js']){
      if(!selector.externalScripts.some(script=>script.sameOrigin&&script.path===path))throw Error('test_pool_preview_script_unqualified');
      const text=await (await this.#request(path,{method:'GET'},false,'test_pool_preview_script')).text();
      const inspection=inspectTestPoolDocument('',sourceDomParser.parseFromString,[text]);
      scripts.push({path,sourceSha256:digest(text),functions:inspection.readFunctionSources.filter(row=>['getExamPath','getExamCardImageFileName'].includes(row.name))});
    }
    return {selector,scripts,sourceHandlersExecuted:false,academyWrites:0};
  }
  /** Inert presentation controls and formatter evidence; revisions never authorize automatic re-pinning. */
  async inspectTestPoolPresentationProtocol(expectedSelectorSha256?:string){
    const protocol=await this.#poolProtocol();
    if(expectedSelectorSha256!==undefined&&expectedSelectorSha256!==protocol.selectorSha256)throw Error('test_pool_selector_source_changed');
    const selector=inspectTestPoolDocument(protocol.html,sourceDomParser.parseFromString);
    if(!selector.externalScripts.some(script=>script.sameOrigin&&script.path==='/js/common_function.js'))throw Error('test_pool_preview_script_unqualified');
    const helpers=await (await this.#request('/js/common_function.js',{method:'GET'},false,'test_pool_presentation_helpers')).text();
    return {...inspectPoolPresentationProtocol(protocol.html,helpers,sourceDomParser.parseWithSourceLocations),observedAt:new Date().toISOString()};
  }
  /** Exact CategoryList read discovered in the current type-selector source; never creates a paper. */
  async #poolProtocol(){
    if(!this.#authenticated)throw Error('authentication_required');
    if(this.#testPoolProtocol)return this.#testPoolProtocol;
    const selectorText=await (await this.#request('/common/testpage/testpage_select_hwp.jsp',{method:'GET'},false,'test_pool_type_selector_document')).text();
    try{readTestPoolDocument(selectorText,sourceDomParser.parseFromString);}
    catch(error){if(error instanceof Error&&error.message==='test_pool_authentication_required')this.close();throw error;}
    const defaults=testPoolSelectorDefaults(selectorText);
    return this.#testPoolProtocol=Object.freeze({defaults:Object.freeze(defaults),selectorSha256:digest(selectorText),html:selectorText});
  }
  async inspectTestPoolCategoryTree(requestedScope:TestPoolScope=emptyTestPoolScope,expectedSelectorSha256?:string){
    const scope=testPoolScope(requestedScope),protocol=await this.#poolProtocol(),defaults=protocol.defaults;
    if(expectedSelectorSha256!==undefined&&expectedSelectorSha256!==protocol.selectorSha256)throw Error('test_pool_selector_source_changed');
    const params=new URLSearchParams({p_process:'CategoryList',...defaults,...Object.fromEntries(Object.entries(scope).map(([key,value])=>[key,String(value)]))});
    const response=await this.#request('/servlet/controller.common.TestPageShowServlet?'+params,{method:'GET'},false,'test_pool_category_list');
    const text=await response.text();if(Buffer.byteLength(text)>2_000_000)throw Error('test_pool_response_too_large');
    if(/normal_session_error\.jsp|세션이 만료/.test(text)){this.close();throw Error('test_pool_authentication_required');}
    const value=JSON.parse(text);
    const nodes=parseTestPoolCategories(value,scope);
    return {sourceOperation:'test_pool_category_list' as const,sourceSha256:digest(text),observedAt:new Date().toISOString(),
      selectorDefaults:defaults,selectorSha256:protocol.selectorSha256,scope,nodes,
      sourceHandlersExecuted:false,academyWrites:0};
  }
  async readTestPoolTypeLabels(requestedScope:TestPoolScope,expectedSelectorSha256?:string){
    const scope=testPoolScope(requestedScope);if(!scope.cl3)throw Error('test_pool_type_scope_requires_source_level3');
    const protocol=await this.#poolProtocol(),template=qualifyTestPoolTypeTemplate(protocol.html);
    if(expectedSelectorSha256!==undefined&&expectedSelectorSha256!==protocol.selectorSha256)throw Error('test_pool_selector_source_changed');
    const params=new URLSearchParams({p_process:'GetTypeTotal',category_iden:protocol.defaults.category_iden!,make_school_key:protocol.defaults.make_school_key!,...Object.fromEntries(Object.entries(scope).map(([key,value])=>[key,String(value)]))});
    const response=await this.#request('/servlet/controller.common.TestPageShowExServlet?'+params,{method:'GET'},false,'test_pool_type_labels');
    const text=await response.text();if(Buffer.byteLength(text)>2_000_000)throw Error('test_pool_response_too_large');
    if(/normal_session_error\.jsp|세션이 만료/.test(text)){this.close();throw Error('test_pool_authentication_required');}
    // The original iframe consumer reads document.body.innerHTML before parsing its value.
    const htmlEnvelope=/text\/html/i.test(response.headers.get('content-type')??'')||/^\s*</.test(text);
    const payload=htmlEnvelope?sourceDomParser.parseFromString(text,'text/html').body.innerHTML:text;
    let labels:ReturnType<typeof parseTestPoolTypeLabels>,payloadSha256:string;
    try{const framed=extractTestPoolLabelPayload(payload);payloadSha256=framed.payloadSha256;labels=parseTestPoolTypeLabels(framed.value);}
    catch(error){const kind=(value:string)=>!value.trim()?'empty':value.trim().startsWith('<')?'markup':value.trim().startsWith('{')?'object':value.trim().startsWith('[')?'array':'other';
      const code=error instanceof Error&&/^[a-z_]+$/.test(error.message)?error.message:'test_pool_label_parse_failed';
      throw Object.assign(Error(code),{safeResponseMetadata:{contentType:(response.headers.get('content-type')??'unknown').split(';')[0],wireKind:kind(text),payloadKind:kind(payload),
        wireBytes:Buffer.byteLength(text),payloadBytes:Buffer.byteLength(payload),bodyElementTags:htmlEnvelope?[...sourceDomParser.parseFromString(text,'text/html').body.children].slice(0,8).map(node=>node.tagName):[]}});}
    return {sourceOperation:'test_pool_type_labels' as const,sourceSha256:digest(text),observedAt:new Date().toISOString(),
      selectorSha256:protocol.selectorSha256,template,categoryIden:protocol.defaults.category_iden,scope,labels,
      wireFormat:htmlEnvelope?'sentinel_framed_html_body':'sentinel_framed_body',payloadSha256,
      coverage:'returned_scoped_response_only',wholePoolCompleteness:'unknown',sourceHandlersExecuted:false,academyWrites:0,finalItemMembershipCreated:false};
  }
  /** Unranked existing questions under one exact source-returned type; never final exam membership. */
  async readTestPoolQuestions(requestedScope:TestPoolScope,patNo:string,page:number,limit:number,expectedSelectorSha256?:string,offset=0){
    const request=testPoolReadRequest({operation:'questions',scope:requestedScope,patNo,page,limit,expectedSelectorSha256,offset});
    const labels=await this.readTestPoolTypeLabels(request.scope,request.expectedSelectorSha256);
    const label=labels.labels.find(row=>String(row.nativeId)===patNo);if(!label)throw Error('test_pool_question_type_not_in_scope');
    const protocol=await this.#poolProtocol(),template=qualifyTestPoolQuestionTemplate(protocol.html);
    const params=new URLSearchParams({p_process:'GetExamList',category_iden:protocol.defaults.category_iden!,make_school_key:protocol.defaults.make_school_key!,
      ...Object.fromEntries(Object.entries(request.scope).map(([key,value])=>[key,String(value)])),
      exam_type:template.defaults.g_examtype_filter!,difficulty:template.defaults.searchConditionDifficulty!,beh_no:template.defaults.searchConditionBehAreaNo!,pat_no:patNo,
      rows:'50',page:String(page),sidx:'',sord:'asc',_search:'false'});
    const response=await this.#request('/servlet/controller.common.TestPageShowExServlet?'+params,{method:'GET'},false,'test_pool_type_questions');
    const text=await response.text();if(Buffer.byteLength(text)>2_000_000)throw Error('test_pool_response_too_large');
    if(/normal_session_error\.jsp|세션이 만료/.test(text)){this.close();throw Error('test_pool_authentication_required');}
    const value=JSON.parse(text);let parsed:ReturnType<typeof parseTestPoolQuestions>;
    try{parsed=parseTestPoolQuestions(value,patNo,page,50);}catch(error){
      throw Object.assign(error instanceof Error?error:Error('test_pool_question_parse_failed'),{safeResponseMetadata:{
        responseKeys:value&&typeof value==='object'?Object.keys(value).slice(0,40):[],rowsIsArray:Array.isArray(value?.rows),rowCount:Array.isArray(value?.rows)?value.rows.length:null,
        firstRowFieldNames:value?.rows?.[0]&&typeof value.rows[0]==='object'?Object.keys(value.rows[0]).slice(0,50):[],
        paginationFields:Object.fromEntries(['page','total','records'].map(key=>[key,typeof value?.[key]==='number'||typeof value?.[key]==='string'&&/^[0-9]{1,16}$/.test(value[key])?value[key]:null]))}});
    }
    if(offset>parsed.questions.length)throw Error('test_pool_question_offset_out_of_range');
    const end=Math.min(offset+limit,parsed.questions.length),sourceRowCount=parsed.questions.length;
    let previewReferencesState:'qualified_original_source'|'source_changed_unqualified'='source_changed_unqualified';
    const previews=new Map<string,ReturnType<typeof testPoolQuestionPreviewReferences>>();
    if(protocol.selectorSha256===testPoolPreviewSourcePins.selector){
      const helpers=await (await this.#request('/js/common_function.js',{method:'GET'},false,'test_pool_preview_helpers')).text();
      if(Buffer.byteLength(helpers)>2_000_000)throw Error('test_pool_response_too_large');
      const helpersSha256=digest(helpers);
      if(helpersSha256===testPoolPreviewSourcePins.helpers){
        previewReferencesState='qualified_original_source';
        for(const question of parsed.questions)previews.set(question.lectureKey,testPoolQuestionPreviewReferences(question.lectureKey,question.sourceFields,protocol.selectorSha256,helpersSha256));
      }
    }
    return {sourceOperation:'test_pool_type_questions' as const,selectorSha256:protocol.selectorSha256,sourceSha256:digest(text),observedAt:new Date().toISOString(),
      scope:request.scope,patNo,labelExact:label.labelExact,templateSha256:template.sourceSha256,...parsed,questions:parsed.questions.slice(offset,end).map(question=>({...question,previewReferences:previews.get(question.lectureKey)??[]})),previewReferencesState,
      sourcePageSize:50,sourceRowCount,offset,nextOffset:end<sourceRowCount?end:null,
      coverage:'returned_type_page_only',questionContent:'source_metadata_and_answer_only',sourceOrderPreserved:true,
      sourceHandlersExecuted:false,academyWrites:0,finalItemMembershipCreated:false};
  }
  /** Read the current teacher/date selector before a missing local group mapping is used. */
  async discoverDayRecordGroups(input:{teacherLabel:string;date:string}){
    assertExactKeys(input,['teacherLabel','date']);assertDate(input.date);
    if(input.teacherLabel!==this.#principal.teacherLabel)throw Error('day_record_group_principal_conflict');
    if(!this.#authenticated)throw Error('authentication_required');
    const response=await this.#request('/servlet/controller.cct.tutor.DayRecordServlet',{
      method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'},
      body:new URLSearchParams({p_process:'Main',std_ymd:input.date.replaceAll('-','')}).toString(),
    });
    const html=await response.text();if(html.length>2000000)throw Error('source_response_too_large');
    const doc=sourceDomParser.parseFromString(html,'text/html');
    if(doc.querySelector('input[type=password]')||/webUserPass|세션이 만료/.test(html)){
      this.close();throw Error('authentication_required');
    }
    const dates=doc.querySelectorAll<HTMLInputElement>('input[name=std_date]');
    const teachers=doc.querySelectorAll<HTMLInputElement>('input[name=teacher_pri_no]');
    const selectors=doc.querySelectorAll<HTMLSelectElement>('select[name=grp_seq]');
    if(dates.length!==1||dates[0]!.value!==input.date||teachers.length!==1
      ||teachers[0]!.value!==this.#principal.teacherKey||selectors.length!==1)throw Error('day_record_group_scope_conflict');
    const select=selectors[0]!,groups:{groupId:string;label:string}[]=[],seen=new Set<string>();
    if(select.disabled||select.options.length>64)throw Error('day_record_group_options_rejected');
    for(const option of select.options){
      if(option.disabled||option.parentElement?.tagName==='OPTGROUP'&&(option.parentElement as HTMLOptGroupElement).disabled)continue;
      if(option.value===''||option.value==='0')continue;
      const groupId=readLiteralKey(option.value),label=option.textContent?.trim()??'';
      if(!label||seen.has(groupId))throw Error('day_record_group_options_rejected');
      seen.add(groupId);groups.push({groupId,label});
    }
    if(!groups.length||groups.length>12)throw Error('day_record_group_options_rejected');
    const selectedGroupId=select.value===''||select.value==='0'?null:readLiteralKey(select.value);
    if(selectedGroupId!==null&&!seen.has(selectedGroupId))throw Error('day_record_group_options_rejected');
    return {teacherKey:this.#principal.teacherKey,date:input.date,groups,selectedGroupId,
      observedAt:new Date().toISOString(),sourceOperation:'POST DayRecordServlet p_process=Main',
      coverage:'current_date_selector_only_not_student_membership',academyWrites:0 as const,parentSends:0 as const};
  }
  async inspectDayRecordWire(input:unknown){
    const plan=createAcademyReadPlan(input);
    if(plan.family!=='day_record'||plan.request.teacherLabel!==this.#principal.teacherLabel)throw Error('day_record_wire_scope_required');
    const output=[];
    for(const groupId of plan.request.groupIds){
      const response=await this.#readRequest(plan,'/servlet/controller.cct.tutor.DayRecordServlet',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'},body:new URLSearchParams({p_process:'Main',std_ymd:plan.request.date.replaceAll('-',''),grp_seq:groupId}).toString()});
      const html=await response.text();if(html.length>2000000)throw Error('source_response_too_large');
      const doc=sourceDomParser.parseFromString(html,'text/html');
      const functions:Record<string,string>={};
      for(const script of doc.querySelectorAll('script')){
        const source=script.textContent??'';
        for(const name of ['onAttn','onFoPrg','onFoHw','onFoMm','setDailyTest','openHomeWorkRate','reallength']){
          const match=new RegExp('function\\s+'+name+'\\s*\\(').exec(source);if(!match)continue;
          const next=/\n\s*function\s+/.exec(source.slice(match.index+match[0].length));
          const end=next?match.index+match[0].length+next.index:source.length;
          const definition=source.slice(match.index,end).trim();if(definition.length>20000)throw Error('source_handler_selection_too_large');functions[name]=definition;
        }
      }
      const popupEvents:string[]=[];
      for(const script of doc.querySelectorAll('script')){
        const lines=(script.textContent??'').split('\n');const selected=new Set<number>();
        for(let i=0;i<lines.length;i++)if(/SetDailyTest|SetHomeWorkRate|daily_test_radio|homework_radio|CourseCommonServlet|daily_test_confirm|homework_confirm/.test(lines[i]!))
          for(let n=Math.max(0,i-12);n<=Math.min(lines.length-1,i+14);n++)selected.add(n);
        if(selected.size)popupEvents.push([...selected].sort((a,b)=>a-b).map(i=>lines[i]).join('\n'));
      }
      const rows=[...doc.querySelectorAll('[onclick]')].filter(node=>plan.request.studentNames.includes(node.textContent?.trim()??'')&&(node.getAttribute('onclick')??'').includes('onOpenDaysMain')).map(node=>{
        let row=node.closest('tr');while(row&&![...row.querySelectorAll('[onfocusout]')].some(e=>(e.getAttribute('onfocusout')??'').includes('onFoPrg(')))row=row.parentElement?.closest('tr')??null;
        return {studentName:node.textContent?.trim(),controls:row?[...row.querySelectorAll('input,select,textarea,[onclick]')].map(e=>({id:e.id,name:e.getAttribute('name'),type:e.getAttribute('type'),value:['INPUT','SELECT','TEXTAREA'].includes(e.tagName)?(e as HTMLInputElement).value:null,handler:e.getAttribute('onclick')??e.getAttribute('onfocusout')??e.getAttribute('onchange')})):[]};
      });
      const assessmentOptions=[...doc.querySelectorAll<HTMLInputElement>('input[name=homework_radio],input[name=daily_test_radio]')].map(node=>({field:node.name,value:node.value,label:(node.closest('td')?.textContent??node.parentElement?.textContent??'').replace(/\s+/g,' ').trim()}));
      output.push({groupId,date:plan.request.date,sourceHandlersInvoked:false as const,functions,popupEvents,rows,assessmentOptions});
    }
    return output;
  }
  async inspectStudentPaperForm(input:{teacherLabel:string;studentName:string;studentKey:string}){
    assertExactKeys(input,['teacherLabel','studentName','studentKey']);readLiteralName(input.studentName);readLiteralKey(input.studentKey);
    if(input.teacherLabel!==this.#principal.teacherLabel)throw Error('student_paper_principal_conflict');
    if(!this.#authenticated)throw Error('authentication_required');
    // Canonical UserByMain read shell only: no guessed student-filter request or branch row retention.
    const response=await this.#request('/servlet/controller.tutor.base.TestPageListServlet?p_process=UserByMain&ass_no=1001',{method:'GET'});
    const text=await response.text();if(text.length>2000000||/webUserPass|세션이 만료/.test(text))throw Error('student_paper_source_rejected');
    const doc=sourceDomParser.parseFromString(text,'text/html');if(doc.querySelector('input[type=password]'))throw Error('source_login_challenge');
    const forms=[...doc.querySelectorAll('form')].map(form=>({name:form.getAttribute('name'),action:form.getAttribute('action'),method:form.getAttribute('method'),fields:[...new Set([...form.querySelectorAll('[name]')].map(e=>e.getAttribute('name')!))]}));
    const functions:string[]=[],fieldAssignments:string[]=[],searchFunctions:Record<string,string>={};
    for(const script of doc.querySelectorAll('script')){
      const code=script.textContent??'';for(const match of code.matchAll(/function\s+(\w+)\s*\(/g))functions.push(match[1]!);
      for(const line of code.split('\n'))if(line.length<512&&/^\s*document\.\w+\.\w+\.(value|action|method)\s*=/.test(line)&&!/pwd|pass|cookie|JSON\.parse/i.test(line))fieldAssignments.push(line.trim());
      for(const name of ['goPage','onSearchPage','onClsChange','onStudentNameKeyDown']){const selected=selectSourceFunction(code,name);if(selected)searchFunctions[name]=selected;}
    }
    return {sourceOperation:'UserByMain' as const,requestedStudent:input,forms,functions:[...new Set(functions)],fieldAssignments,searchFunctions,studentRowsRetained:0 as const,filteredStudentReadQualified:false as const,handlersInvoked:false as const};
  }
  /** One explicit student/period/page; exact code match is not complete-history coverage. */
  async lookupPrintedPaperMetadata(input:{teacherLabel:string;studentName:string;studentKey:string;paperCode:string;period:StudentPaperSearchPeriod}){
    assertExactKeys(input,['teacherLabel','studentName','studentKey','paperCode','period']);
    const paperKey=decodePaperCode(input.paperCode);
    const {paperCode,...searchInput}=input;
    const result=await this.searchStudentPaperMetadata(searchInput);
    let matches=result.rows.filter(row=>row.paperKey===paperKey);
    const searchedSources:{family:string;operation:string;page:number;sourcePeriod:unknown;requestedPeriodApplied:boolean;coverage:string;observedAt:string}[]=[{
      family:'student_assessment',operation:result.operation,page:result.page,sourcePeriod:result.sourcePeriod,requestedPeriodApplied:true,coverage:result.coverage,observedAt:result.observedAt,
    }];
    let matchedSourceFamily=matches.length?'student_assessment':null;
    // An explicit miss in one read family is not proof that the paper is absent.
    // This is a separate qualified read, never a retry of a failed occurrence.
    if(!matches.length){
      const daily=await this.searchDailyTestMetadata({teacherLabel:input.teacherLabel,studentName:input.studentName,studentKey:input.studentKey});
      searchedSources.push({family:'daily_zero',operation:daily.operation,page:daily.page,sourcePeriod:null,requestedPeriodApplied:false,coverage:daily.coverage,observedAt:daily.observedAt});
      matches=daily.rows.filter(row=>row.paperKey===paperKey);if(matches.length)matchedSourceFamily='daily_zero';
    }
    return {paperCode,paperKey,status:matches.length?'observed' as const:'not_found_in_scope' as const,
      rows:matches,sourcePeriod:matchedSourceFamily==='daily_zero'?null:result.sourcePeriod,page:result.page,observedAt:searchedSources.at(-1)!.observedAt,
      coverage:'observed_source_pages_not_complete_history' as const,searchedSources,matchedSourceFamily,generatedMembership:'unqualified' as const,
      academyWrites:0 as const,parentSends:0 as const};
  }
  /** Project only exact-name identities from the read-qualified DT/ZT pages.
   * The `sort_date` '1' page first, unchanged; on a miss, each history
   * selector that page offers, in listed order, one request each, stopping at
   * the first page that holds the exact name. A pair found after '1' names its
   * page in `fixedSourceFilter`. An empty result covers only the pages read. */
  async searchStudentsByName(input:{teacherLabel:string;studentName:string}){
    assertExactKeys(input,['teacherLabel','studentName']);readLiteralName(input.studentName);
    if(input.teacherLabel!==this.#principal.teacherLabel)throw Error('daily_search_principal_conflict');
    if(!this.#authenticated)throw Error('authentication_required');
    const first=await this.#studentNameSearchPage(input.studentName,'1');
    const found=inspectStudentNameSearch(first,input.studentName);
    if(found.length)return found;
    const offered=sourceDomParser.parseFromString(first,'text/html').querySelectorAll<HTMLSelectElement>('select[name=sort_date]');
    if(offered.length!==1||DAILY_TEST_HISTORY_SELECTORS.some(selector=>![...offered[0]!.options].some(option=>option.value===selector)))throw Error('daily_history_selector_drift');
    for(const selector of DAILY_TEST_HISTORY_SELECTORS){
      const pairs=inspectStudentNameSearch(await this.#studentNameSearchPage(input.studentName,selector),input.studentName);
      if(pairs.length)return pairs.map(pair=>({...pair,fixedSourceFilter:{sort_date:selector}}));
    }
    return [];
  }
  async #studentNameSearchPage(studentName:string,sortDate:'1'|DailyTestHistorySelector){
    const response=await this.#request('/servlet/controller.dailyzerotest.DailyZeroTestServlet?reqCmd=DtResultSearch',{
      method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-Requested-With':'XMLHttpRequest'},
      body:new URLSearchParams({sort_date:sortDate,stu_name:studentName}).toString(),
    });
    const html=await response.text();if(html.length>2000000)throw Error('daily_search_response_rejected');
    if(/webUserPass|세션이 만료/.test(html)||/<input\b[^>]*\btype\s*=\s*["']password["']/i.test(html)){this.close();throw Error('authentication_required');}
    return html;
  }
  /** Reuse the same fixed, read-qualified DT/ZT search used by exact score reads. */
  async searchDailyTestMetadata(input:{teacherLabel:string;studentName:string;studentKey:string}){
    assertExactKeys(input,['teacherLabel','studentName','studentKey']);readLiteralName(input.studentName);readLiteralKey(input.studentKey);
    if(input.teacherLabel!==this.#principal.teacherLabel)throw Error('daily_search_principal_conflict');
    if(!this.#authenticated)throw Error('authentication_required');
    const response=await this.#request('/servlet/controller.dailyzerotest.DailyZeroTestServlet?reqCmd=DtResultSearch',{
      method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-Requested-With':'XMLHttpRequest'},
      body:new URLSearchParams({sort_date:'1',stu_name:input.studentName}).toString(),
    });
    const html=await response.text();if(html.length>2000000)throw Error('daily_search_response_rejected');
    if(/webUserPass|세션이 만료/.test(html)||/<input\b[^>]*\btype\s*=\s*["']password["']/i.test(html)){this.close();throw Error('authentication_required');}
    return {...inspectAssessmentSearchMetadata(html,input),operation:'DtResultSearch' as const,page:1,
      sourcePeriod:null,fixedSourceFilter:{sort_date:'1'},observedAt:new Date().toISOString()};
  }
  /** Discover exact-student rows and inert filter/page contracts in the same qualified read. */
  async inspectDailyTestInventory(input:{teacherLabel:string;studentName:string;studentKey:string}){
    return this.#dailyTestInventory(input,'1');
  }
  /** Explicit observed month selectors, not guessed calendar arithmetic or an automatic retry. */
  async readDailyTestHistory(input:{teacherLabel:string;studentName:string;studentKey:string;periods:string[]}){
    assertExactKeys(input,['teacherLabel','studentName','studentKey','periods']);
    if(!Array.isArray(input.periods)||input.periods.length<1||input.periods.length>6||new Set(input.periods).size!==input.periods.length||input.periods.some(p=>!(DAILY_TEST_HISTORY_SELECTORS as readonly string[]).includes(p)))throw Error('daily_history_period_rejected');
    const {periods,...target}=input;
    const current=await this.inspectDailyTestInventory(target);
    const selectors=current.filterContracts.controls.filter(c=>c.name==='sort_date');
    if(selectors.length!==1||periods.some(p=>!selectors[0]!.options?.some(o=>o.value===p)))throw Error('daily_history_selector_drift');
    const observations=[];
    for(const selector of periods){
      const observation=await this.#dailyTestInventory(target,selector);
      observations.push({selector,label:selectors[0]!.options!.find(o=>o.value===selector)!.label,...observation});
    }
    return {status:'observed' as const,studentKey:target.studentKey,studentName:target.studentName,currentFilterQualification:{observedAt:current.observedAt,selector:'1',rows:current.rows},observations,
      calendarBounds:'source_relative_labels_only_not_exact_calendar_bounds' as const,
      expectedPaperDefinitions:'not_observed' as const,coverage:'all_parsed_embedded_rows_on_each_observed_response_not_complete_history' as const,academyWrites:0 as const,parentSends:0 as const};
  }
  async #dailyTestInventory(input:{teacherLabel:string;studentName:string;studentKey:string},sortDate:string){
    assertExactKeys(input,['teacherLabel','studentName','studentKey']);readLiteralName(input.studentName);readLiteralKey(input.studentKey);
    if(input.teacherLabel!==this.#principal.teacherLabel)throw Error('daily_search_principal_conflict');
    if(!this.#authenticated)throw Error('authentication_required');
    const response=await this.#request('/servlet/controller.dailyzerotest.DailyZeroTestServlet?reqCmd=DtResultSearch',{
      method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-Requested-With':'XMLHttpRequest'},
      body:new URLSearchParams({sort_date:sortDate,stu_name:input.studentName}).toString(),
    });
    const html=await response.text();if(html.length>2000000)throw Error('daily_search_response_rejected');
    if(/webUserPass|세션이 만료/.test(html)||/<input\b[^>]*\btype\s*=\s*["']password["']/i.test(html)){this.close();throw Error('authentication_required');}
    const metadata=inspectAssessmentSearchMetadata(html,input),doc=sourceDomParser.parseFromString(html,'text/html');
    const functions:Record<string,string>={};
    for(const script of doc.querySelectorAll('script:not([src])')){
      const code=script.textContent??'';
      for(const match of code.matchAll(/function\s+((?:onSearch|goPage|onPage|onDate|setDate|onResult|search|selectDate)\w*)\s*\(/g)){
        if(Object.keys(functions).length>=64)throw Error('daily_inventory_contract_limit');
        const selected=selectSourceFunction(code,match[1]!);if(selected){if(functions[match[1]!])throw Error('daily_inventory_contract_ambiguous');functions[match[1]!]=selected;}
      }
    }
    const controls=[...doc.querySelectorAll<HTMLInputElement|HTMLSelectElement>('input[name],select[name]')]
      .filter(node=>/sort_date|date|page/i.test(node.name))
      .map(node=>({name:node.name,type:node.getAttribute('type'),value:node.value,options:node.tagName==='SELECT'?[...(node as HTMLSelectElement).options].map(o=>({value:o.value,label:o.text})):undefined}));
    const scriptSources=[...doc.querySelectorAll<HTMLScriptElement>('script[src]')].map(node=>node.getAttribute('src'));
    const forms=[...doc.querySelectorAll('form')].map(form=>({name:form.getAttribute('name'),action:form.getAttribute('action'),method:form.getAttribute('method'),fieldNames:[...new Set([...form.querySelectorAll('[name]')].map(n=>n.getAttribute('name')))]}));
    const displayRows=metadata.rows.flatMap(row=>{
      const node=row.sourceRowId?doc.getElementById(row.sourceRowId):null;
      if(node?.tagName!=='TR')return [];
      return [{paperKey:row.paperKey,attemptKey:row.attemptKey,sourceRowId:row.sourceRowId,cells:[...node.querySelectorAll(':scope > td')].map(n=>(n.textContent??'').replace(/\s+/g,' ').trim())}];
    });
    const navigation=[...doc.querySelectorAll('a[href],a[onclick]')].filter(n=>/DailyZeroTestServlet|ass_no=1180|DailyTest|데일리테스트|DT\/ZT/.test((n.getAttribute('href')??'')+' '+(n.getAttribute('onclick')??'')+' '+(n.textContent??''))).map(n=>({label:(n.textContent??'').trim().slice(0,200),href:n.getAttribute('href'),handler:n.getAttribute('onclick')}));
    return {...metadata,operation:'DtResultSearch' as const,page:1,sourcePeriod:null,fixedSourceFilter:{sort_date:sortDate},observedAt:new Date().toISOString(),
      filterContracts:{functions,controls,scriptSources,forms,navigation},displayRows,gradingPresence:'source_score_alone_not_teacher_review' as const,
      expectedPaperDefinitions:'not_observed' as const,handlersInvoked:false as const,academyWrites:0 as const,parentSends:0 as const};
  }
  async searchStudentPaperMetadata(input:{teacherLabel:string;studentName:string;studentKey:string;period?:StudentPaperSearchPeriod;includeAllPaperTypes?:boolean}){
    const hasPeriod=Object.hasOwn(input,'period'),hasAllTypes=Object.hasOwn(input,'includeAllPaperTypes');
    assertExactKeys(input,['teacherLabel','studentName','studentKey',...(hasPeriod?['period']:[]),...(hasAllTypes?['includeAllPaperTypes']:[])]);readLiteralName(input.studentName);readLiteralKey(input.studentKey);
    if(hasAllTypes&&input.includeAllPaperTypes!==true)throw Error('student_paper_type_scope_rejected');
    const period=hasPeriod?qualifyStudentPaperSearchPeriod(input.period):undefined;
    if(input.teacherLabel!==this.#principal.teacherLabel)throw Error('student_paper_principal_conflict');if(!this.#authenticated)throw Error('authentication_required');
    const path='/servlet/controller.tutor.base.TestPageListServlet';
    const initial=await (await this.#request(path+'?p_process=UserByMain&ass_no=1001',{method:'GET'})).text();
    if(initial.length>2000000)throw Error('student_paper_source_rejected');const doc=sourceDomParser.parseFromString(initial,'text/html');
    if(doc.querySelector('form[name=userForm] [name=pri_no]')?.getAttribute('value')!==this.#principal.teacherKey)throw Error('student_paper_owner_drift');
    const form=doc.querySelector<HTMLFormElement>('form[name=search]');if(!form||form.getAttribute('method')?.toLowerCase()!=='post')throw Error('student_paper_search_method_drift');
    const definitions=[...doc.querySelectorAll('script')].map(s=>selectSourceFunction(s.textContent??'','onSearchPage')).filter(Boolean);
    if(definitions.length!==1||digest(definitions[0])!=='e1973c2ee678d321fd81c351e75f9af7e254aef077befe59ad1e649bb2cb6f09')throw Error('student_paper_search_wire_drift');
    const body=new URLSearchParams();
    for(const name of ['clg_no','cls_no','p_pageno','check_da_test','check_fa_test','check_na_test','stu_name','chioce_cls','sort_date1','sort_date2']){
      const nodes=form.querySelectorAll<HTMLInputElement|HTMLSelectElement>('[name='+name+']');if(nodes.length!==1)throw Error('student_paper_filter_drift');const node=nodes[0]!;
      if(node.getAttribute('type')==='checkbox'&&!(node as HTMLInputElement).checked){
        // The search form checks only one paper type by default, which
        // silently drops textbook section attempts of the other types.
        // Callers that need every recorded attempt (textbook section
        // index) opt in to all three source type values explicitly.
        if(!hasAllTypes)continue;
      }
      body.set(name,node.value);
    }
    if(body.get('clg_no')!==this.#principal.collegeKey||input.studentName.length<2)throw Error('student_paper_college_scope_conflict');
    body.set('stu_name',input.studentName);body.set('p_pageno','1');body.set('cls_no',body.get('chioce_cls')!);
    if(period){body.set('sort_date1',period.from);body.set('sort_date2',period.through);}
    const response=await this.#request(path+'?p_process=UserBySearchTestResult&ass_no=1001',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'},body:body.toString()});
    const html=await response.text();if(html.length>2000000)throw Error('student_paper_response_too_large');const selected=sourceDomParser.parseFromString(html,'text/html');
    if(selected.querySelector('form[name=userForm] [name=pri_no]')?.getAttribute('value')!==this.#principal.teacherKey)throw Error('student_paper_owner_drift');
    return {...inspectAssessmentSearchMetadata(html,input),operation:'UserBySearchTestResult',page:1,sourcePeriod:{from:body.get('sort_date1'),to:body.get('sort_date2')},observedAt:new Date().toISOString(),browserRequests:0,academyWrites:0};
  }
  async inspectTextbookIndex(input:unknown){
    const plan=createAcademyReadPlan(input);
    if(plan.family!=='textbook'||plan.request.teacherLabel!==this.#principal.teacherLabel)throw Error('textbook_index_scope_required');
    const post=async(path:string,fields:Record<string,string>)=>{
      const response=await this.#readRequest(plan,path,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-Requested-With':'XMLHttpRequest'},body:new URLSearchParams(fields).toString()});
      const text=await response.text();if(text.length>2000000||/webUserPass|세션이 만료/.test(text))throw Error('textbook_index_source_rejected');return text;
    };
    const request=plan.request;
    const progress=await post('/servlet/controller.coursemanage.TextBookManageServlet?reqCmd=getTextBookProgress',{student_name:request.studentName});
    parseTextbookScopeBinding(progress,request);
    const data=readInputRecord(JSON.parse(await post('/servlet/controller.common.TestpageSelectExServlet',{
      p_process:'getWrongAnswerNoteResult',answerNoteResult:JSON.stringify({courseKeyList:[request.courseKey],bookNoList:[request.bookNo],userKeyList:[request.studentKey]}),
    })));
    if(data.result!=='ok'||!Array.isArray(data.noteResultList)||data.noteResultList.length>1000)throw Error('wrong_note_contract_rejected');
    const identities=new Set<string>();
    const wrongRows=data.noteResultList.map(readInputRecord).map(row=>{
      if(sourceResponseKey(row.pri_no)!==request.studentKey||row.name!==request.studentName)throw Error('source_subject_conflict');
      const paperKey=sourceResponseKey(row.p_no),attemptKey=sourceResponseKey(row.testing_no),identity=JSON.stringify([paperKey,attemptKey]);
      if(identities.has(identity))throw Error('ambiguous_textbook_index');identities.add(identity);
      return {sourceTitle:readLiteralName(row.testing_name),paperKey,attemptKey,fieldNames:Object.keys(row).sort(),sourceDate:{literal:typeof row.apply_date==='string'?row.apply_date:null,meaning:'source_apply_date_not_exact_grade_time' as const}};
    });
    // The wrong-note index omits all-correct sections. Merge the exact
    // student's paper-search attempts matching this book's title template;
    // a failed paper search degrades the basis honestly instead of turning
    // wrong-note absence into a no-record claim.
    const pattern=deriveTextbookSectionTitlePattern(wrongRows.map(r=>r.sourceTitle),request.studentName);
    let paperSearch:{status:'observed';coverage:typeof TEXTBOOK_PAPER_SEARCH_COVERAGE;page:1;sourcePeriod:{from:string|null;to:string|null}|null;matchedRowCount:number}
      |{status:'unavailable'|'no_derivable_section_title_pattern';coverage:typeof TEXTBOOK_PAPER_SEARCH_COVERAGE;matchedRowCount:0};
    let rows:({sourceTitle:string;paperKey:string;attemptKey:string;fieldNames?:string[];sourceDate:{literal:string|null;meaning:string};sources:readonly string[]})[]=wrongRows.map(r=>({...r,sources:['wrong_answer_note'] as const}));
    if(!pattern){
      paperSearch={status:'no_derivable_section_title_pattern',coverage:TEXTBOOK_PAPER_SEARCH_COVERAGE,matchedRowCount:0};
    }else{
      try{
        const paper=await this.searchStudentPaperMetadata({teacherLabel:request.teacherLabel,studentName:request.studentName,studentKey:request.studentKey,includeAllPaperTypes:true});
        const paperRows:TextbookPaperSearchRow[]=paper.rows.flatMap(r=>typeof r.titles.testingName==='string'
          ?[{testingName:r.titles.testingName,paperKey:r.paperKey,attemptKey:r.attemptKey,applyDateLiteral:typeof r.titles.applyDate==='string'?r.titles.applyDate:null}]:[]);
        const merged=mergeTextbookSectionRows(wrongRows.map(r=>({sourceTitle:r.sourceTitle,paperKey:r.paperKey,attemptKey:r.attemptKey,sourceDateLiteral:r.sourceDate.literal})),paperRows,pattern);
        const fieldNamesByAttempt=new Map(wrongRows.map(r=>[r.attemptKey,r.fieldNames] as const));
        rows=merged.map(r=>({sourceTitle:r.sourceTitle,paperKey:r.paperKey,attemptKey:r.attemptKey,
          ...(fieldNamesByAttempt.has(r.attemptKey)?{fieldNames:fieldNamesByAttempt.get(r.attemptKey)!}:{}),
          sourceDate:{literal:r.sourceDateLiteral,meaning:'source_apply_date_not_exact_grade_time' as const},sources:r.sources}));
        paperSearch={status:'observed',coverage:TEXTBOOK_PAPER_SEARCH_COVERAGE,page:1,sourcePeriod:paper.sourcePeriod,matchedRowCount:merged.filter(r=>r.sources.includes('student_paper_search')).length};
      }catch(error){
        if(error instanceof Error&&error.message==='textbook_section_title_conflict_for_attempt')throw error;
        paperSearch={status:'unavailable',coverage:TEXTBOOK_PAPER_SEARCH_COVERAGE,matchedRowCount:0};
      }
    }
    const indexBasis=paperSearch.status==='observed'?'wrong_answer_note_plus_student_paper_search':'wrong_answer_note_only' as const;
    return {schemaVersion:1,sourceOperation:'getWrongAnswerNoteResult' as const,scope:{teacherLabel:request.teacherLabel,studentKey:request.studentKey,studentName:request.studentName,courseKey:request.courseKey,bookNo:request.bookNo},rows,rowCount:rows.length,
      indexBasis,paperSearch,coverage:paperSearch.status==='observed'
        ?'wrong_answer_note_index_plus_one_observed_student_paper_search_page_not_complete_history'
        :'wrong_answer_note_index_only_paper_search_not_observed_not_complete_history',
      sourceHandlersInvoked:false as const,generatedPaperMembership:'unqualified' as const,observedAt:new Date().toISOString()};
  }
  /** The exact scope of a historical read: the client's own teacher and three verified keys. */
  #historicalScope(input:unknown,extra:readonly string[]=[]){
    const data=readInputRecord(input),keys=['bookNo','courseKey','studentKey','studentName','teacherLabel',...extra].sort();
    if(Object.keys(data).sort().join(',')!==keys.join(',')||data.teacherLabel!==this.#principal.teacherLabel)throw Error('historical_read_scope_rejected');
    return {data,scope:{teacherLabel:this.#principal.teacherLabel,studentName:readLiteralName(data.studentName),studentKey:readLiteralKey(data.studentKey),
      courseKey:readLiteralKey(data.courseKey),bookNo:readLiteralKey(data.bookNo)}};
  }
  /** One read request of the historical fallback. A login page, a session-error page or a
   * redirect fails closed with authentication_required (R11); no error holds a request value. */
  async #historicalPost(path:string,fields:Record<string,string>,operation:string):Promise<string>{
    if(!this.#authenticated)throw Error('authentication_required');
    let response:Response;
    try{response=await this.#request(path,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-Requested-With':'XMLHttpRequest'},body:new URLSearchParams(fields).toString()},false,operation);}
    catch(error){
      if(error instanceof AcademyHttpFailure&&[401,403].includes(error.httpStatus)
        ||error instanceof Error&&['source_redirect_rejected','foreign_source_redirect_rejected','source_redirect_contract_rejected'].includes(error.message)){this.close();throw Error('authentication_required');}
      throw error;
    }
    const text=await response.text();
    if(text.length>2000000)throw Error('source_response_too_large');
    if(isLoginOrSessionPage(text)){this.close();throw Error('authentication_required');}
    return text;
  }
  /** One GET of a page whose inline handler the gated clinic write pins (specs/academy-mcp/gated-writes.md "Wire hash"): the
   * page text, under the 2 MiB bound; a login, session-error or redirect answer closes the session (`authentication_required`). */
  async readClinicWirePage(path:'/servlet/controller.coursemanage.TextBookManageServlet?reqCmd=getTextBookMain'|'/servlet/controller.tutor.fa.TestPageListGrpServlet?p_process=Main'):Promise<string>{
    if(!this.#authenticated)throw Error('authentication_required');
    let html:string;
    try{html=await readBoundedLmsPage(await this.#request(path,{method:'GET'},false,'clinic_wire_page'));}
    catch(error){
      if(error instanceof AcademyHttpFailure&&[401,403].includes(error.httpStatus)||error instanceof Error&&['source_redirect_rejected','foreign_source_redirect_rejected','source_redirect_contract_rejected'].includes(error.message)){this.close();throw Error('authentication_required');}
      throw error instanceof LmsReadRefusal?Error(error.code):error;
    }
    // Only a login form closes the session here: the page's own scripts may name a session-error page.
    if(/<input\b[^>]*\btype\s*=\s*["']?password\b|<form\b[^>]*\bname\s*=\s*["']?loginForm\b/i.test(html)){this.close();throw Error('authentication_required');}
    return html;
  }
  /** One POST form of `TestpageSelectExServlet` (the wrong-note read, a score view, or the paper creation of a reviewed clinic
   * change): the raw answer text. Whether it is a read or a write is the class of its `p_process` and `condition`
   * (lmsRouteRegistry.ts testpageSelectExRequestEffect); the caller owns that decision and its ledger. */
  async postTestpageSelectEx(fields:{p_process:string}&Record<string,string>):Promise<string>{
    return this.#historicalPost('/servlet/controller.common.TestpageSelectExServlet',fields,fields.p_process);
  }
  /**
   * One request of the gated FA and unit-exam pair (specs/academy-mcp/gated-writes.md R8, item 7 of the unit): the answer text under the 2 MiB bound.
   * `expected` is the class the route must have in the exam route lists of lmsRouteRegistry.ts; a route that list does not class so is refused
   * (`exam_route_class_mismatch`) before any request leaves. A login form, a redirect or a 401/403 closes the session (`authentication_required`).
   */
  async #examRequest(expected:'read'|'write',method:'GET'|'POST',path:string,operation:string,init:RequestInit):Promise<string>{
    const {path:servlet}=examRouteOf(path);
    if(examRouteClass(method,servlet,operation)!==expected)throw Error('exam_route_class_mismatch');
    if(!this.#authenticated)throw Error('authentication_required');
    let html:string;
    try{html=await readBoundedLmsPage(await this.#request(path,{method,...init},false,'exam_'+operation));}
    catch(error){
      if(error instanceof AcademyHttpFailure&&[401,403].includes(error.httpStatus)||error instanceof Error&&['source_redirect_rejected','foreign_source_redirect_rejected','source_redirect_contract_rejected'].includes(error.message)){this.close();throw Error('authentication_required');}
      throw error instanceof LmsReadRefusal?Error(error.code):error;
    }
    if(/<input\b[^>]*\btype\s*=\s*["']?password\b|<form\b[^>]*\bname\s*=\s*["']?loginForm\b/i.test(html)){this.close();throw Error('authentication_required');}
    return html;
  }
  /** One GET of a route the exam lists class read: the AutoModify, CheckMunhang, TestHangServlet Main and Validate requests. */
  async readExamRoute(path:string):Promise<string>{
    return this.#examRequest('read','GET',path,examRouteOf(path).operation,{});
  }
  /** One POST form of a route the exam lists class read: `getStudentList` of ObjectSelectServlet and `GetPaperNo` of DiagnostManageServlet. */
  async postExamRead(path:string,fields:Record<string,string>):Promise<string>{
    return this.#examRequest('read','POST',path,fields.reqCmd??fields.p_process??'',{headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-Requested-With':'XMLHttpRequest'},body:new URLSearchParams(fields).toString()});
  }
  /** One mutating GET of a route the exam lists class write (the allocating Auto page, SaveMunhang, the assignment Save), called under the ledger lock only. */
  async writeExamGet(path:string):Promise<string>{
    return this.#examRequest('write','GET',path,examRouteOf(path).operation,{});
  }
  /** The multipart/form-data POST of the exam paper `Save` (a route the exam lists class write), called under the ledger lock only. The boundary is the transport's. */
  async writeExamMultipart(path:string,members:readonly (readonly [string,string])[]):Promise<string>{
    const body=new FormData();
    for(const [name,value] of members)body.append(name,value);
    return this.#examRequest('write','POST',path,examRouteOf(path).operation,{body});
  }
  /** Direct-key historical index (specs/academy-mcp/direct-key-lookup.md R2-R4): the wrong-answer
   * note of one exact course, book and student, for a book that the live getTextBookProgress
   * list no longer holds. Every row must carry the student key as `pri_no` and a `cls_no` of 0 (what the
   * live LMS sends on every row) or the course key; the course itself is verified by the request scope
   * (one course, one book, one student) and by getCourseBookReport. Anything else refuses with historical_key_unverified. No paper search and no
   * live-list request: the caller has already read the live list. */
  async readHistoricalTextbookIndex(input:{teacherLabel:string;studentKey:string;studentName:string;courseKey:string;bookNo:string}){
    const {scope}=this.#historicalScope(input);
    const text=await this.#historicalPost('/servlet/controller.common.TestpageSelectExServlet',{p_process:'getWrongAnswerNoteResult',
      answerNoteResult:JSON.stringify({courseKeyList:[scope.courseKey],bookNoList:[scope.bookNo],userKeyList:[scope.studentKey]})},'getWrongAnswerNoteResult');
    let data:Record<string,unknown>;
    try{data=readInputRecord(JSON.parse(text));}catch{throw Error('historical_key_unverified');}
    if(data.result!=='ok'||!Array.isArray(data.noteResultList)||data.noteResultList.length>1000)throw Error('historical_key_unverified');
    const verified=new Map<string,{sourceTitle:string;paperKey:string;attemptKey:string}>();
    const rows=data.noteResultList.map(raw=>{
      let row:Record<string,unknown>;
      try{row=readInputRecord(raw);}catch{throw Error('historical_key_unverified');}
      if(String(row.pri_no)!==scope.studentKey||!(row.cls_no===0||row.cls_no==='0'||String(row.cls_no)===scope.courseKey))throw Error('historical_key_unverified');
      let sourceTitle:string,paperKey:string,attemptKey:string;
      try{sourceTitle=readLiteralName(row.testing_name);paperKey=sourceResponseKey(row.p_no);attemptKey=sourceResponseKey(row.testing_no);}
      catch{throw Error('historical_key_unverified');}
      const identity=JSON.stringify([paperKey,attemptKey]);
      if(verified.has(identity))throw Error('ambiguous_textbook_index');
      verified.set(identity,{sourceTitle,paperKey,attemptKey});
      return {sourceTitle,paperKey,attemptKey,sourceDate:{literal:typeof row.apply_date==='string'?row.apply_date:null,meaning:'source_apply_date_not_exact_grade_time' as const}};
    });
    this.#historicalAttempts.set(JSON.stringify(scope),verified);
    return {sourceOperation:'getWrongAnswerNoteResult' as const,rows,indexBasis:'wrong_answer_note_only' as const,observedAt:new Date().toISOString()};
  }
  /** `getCourseBookReport` of one exact course, book and student: SERVER_RET = OK, a book
   * title, the student's name and every echoed key must hold (R4); the answer is the pinned
   * projection of courseBookReport.ts. */
  async readCourseBookReport(input:{teacherLabel:string;studentKey:string;studentName:string;courseKey:string;bookNo:string}):Promise<CourseBookReport>{
    const {scope}=this.#historicalScope(input);
    const text=await this.#historicalPost(COURSE_BOOK_REPORT_PATH,{reqCmd:'getCourseBookReport',course_key:scope.courseKey,book_no:scope.bookNo,student_pri_no:scope.studentKey},'getCourseBookReport');
    return projectCourseBookReport(readCourseBookReportEnvelope(text),scope);
  }
  /** One read-only report view of `ReportViewServlet` (specs/academy-mcp/direct-key-lookup.md R8): the view
   * name is validated before anything else, then the exact POST form of reportViewClient.ts is sent and the
   * JSON of its `SERVER_RET = OK` answer returned. A login page, a session page or a redirect refuses with
   * authentication_required (fail closed); another page with report_view_unqualified.
   * `NewStudentReportView` takes the owner's college key when the caller gives none. */
  async readReportView(view:unknown,params:Record<string,unknown>):Promise<Record<string,unknown>>{
    const name=validateReportViewName(view);
    const form=reportViewForm(name,name==='NewStudentReportView'&&params?.collegeKey===undefined?{...params,collegeKey:this.#principal.collegeKey}:params);
    return readReportViewEnvelope(await this.#historicalPost(REPORT_VIEW_PATH,Object.fromEntries(form),name));
  }
  /** `getTestExamList` of one paper (specs/studyq-linux/core.md R20; a read, lmsRouteRegistry.ts): the rows
   * of its exam list. A login page refuses with authentication_required; a row whose `sel_type` is not
   * obj, sbj or des refuses the whole list with paper_exam_sel_type_unqualified, before any download. */
  async readPaperExamList(paperNo:string):Promise<PaperExamRow[]>{
    const form=paperExamListForm(paperNo);
    return parsePaperExamList(await this.#historicalPost(PAPER_EXAM_LIST_PATH,form,'getTestExamList'));
  }
  /** One `print.zip` of the static storage: a read-only GET of the pinned URL made from the integer key,
   * with no Academy cookie or credential (`credentials: 'omit'`, no redirect), HTTP 200 only and at most
   * 16 MiB. The bytes are only data for modules/studyq-linux; nothing here opens an archive. */
  async downloadPrintArchive(kind:PrintArchiveKind,key:number):Promise<Uint8Array>{
    const url=printArchiveUrl(kind,key);let response:Response;
    try{response=await this.#transport(url.href,{method:'GET',headers:{Accept:'application/zip, application/octet-stream'},credentials:'omit',redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(30000)});}
    catch{throw Error('paper_print_transport_failed');}
    if(response.url&&response.url!==url.href)throw Error('paper_print_archive_rejected');
    return boundedPrintArchiveBody(response);
  }
  /** Section detail of the historical fallback: the single-user result of each attempt that
   * readHistoricalTextbookIndex verified for this exact scope, never another attempt. */
  async readHistoricalTextbookSections(input:{teacherLabel:string;studentKey:string;studentName:string;courseKey:string;bookNo:string;
    attempts:{sourceTitle:string;paperKey:string;attemptKey:string;sourceDateLiteral:string|null}[]}){
    const {data,scope}=this.#historicalScope(input,['attempts']);
    const verified=this.#historicalAttempts.get(JSON.stringify(scope));
    if(!verified||!Array.isArray(data.attempts)||data.attempts.length<1||data.attempts.length>12)throw Error('historical_key_unverified');
    const records=[];
    for(const raw of data.attempts){
      const attempt=readInputRecord(raw),known=verified.get(JSON.stringify([attempt.paperKey,attempt.attemptKey]));
      if(!known||known.sourceTitle!==attempt.sourceTitle)throw Error('historical_key_unverified');
      const text=await this.#historicalPost('/servlet/controller.common.TestpageSelectExServlet',{p_process:'getStudyResultSingleTestingSingleUser',
        condition:JSON.stringify({testing_no:Number(known.attemptKey),pri_no:Number(scope.studentKey),student_name:scope.studentName,
          score:{create:1},incorrect:{create:0},similar:{create:0},advance:{create:0},report:{create:0}})},'getStudyResultSingleTestingSingleUser');
      const result=readInputRecord(JSON.parse(text));
      const detail=parseScoreView(result,{studentKey:scope.studentKey,studentName:scope.studentName,attemptKey:known.attemptKey});
      const paper=readInputRecord((result.print_list as unknown[])[0]);
      if(paper.sub_title!==known.sourceTitle)throw Error('source_title_conflict');
      const items=(paper.exam_list as unknown[]).map(readInputRecord).map(item=>({originalOrdinal:sourceResponseKey(item.exam_no),
        lectureKey:item.lecture_key==null?null:sourceResponseKey(item.lecture_key),outerLectureKey:item.outer_lecture_key==null?null:sourceResponseKey(item.outer_lecture_key),
        scoring:item.scoring_result as 'O'|'X'})).sort((a,b)=>Number(a.originalOrdinal)-Number(b.originalOrdinal));
      const literal=typeof attempt.sourceDateLiteral==='string'?attempt.sourceDateLiteral:null;
      records.push({sourceTitle:known.sourceTitle,studentKey:scope.studentKey,studentName:scope.studentName,courseKey:scope.courseKey,bookNo:scope.bookNo,
        paperKey:known.paperKey,attemptKey:known.attemptKey,score:detail.score,items,
        sourceDate:{literal,precision:literal&&/^\d{2}-\d{2}$/.test(literal)?'month_day' as const:'unknown' as const,meaning:'source_apply_date_not_exact_grade_time' as const}});
    }
    return {family:'textbook' as const,status:'observed' as const,records,observedAt:new Date().toISOString(),coverage:'exact_selected_existing_records_not_whole_book' as const};
  }
  async inspectItemHeader(input:unknown){
    const plan=createAcademyReadPlan(input);
    if(plan.family!=='item_metadata'||plan.request.teacherLabel!==this.#principal.teacherLabel)throw Error('item_header_scope_required');
    const query=new URLSearchParams({p_process:'GetLectureList',lecture_list:plan.request.lectureKey});
    const response=await this.#readRequest(plan,'/servlet/controller.common.TestPageShowExServlet?'+query,{method:'GET'});
    const text=await response.text();if(text.length>2000000)throw Error('item_header_response_rejected');
    const raw=JSON.parse(text),metadata=parseItemMetadata(raw,plan.request.lectureKey),row=raw.rows[0] as Record<string,unknown>;
    const fieldNames=Object.keys(row).sort(),candidateFields:Record<string,string|number>={};
    for(const key of ['pat_no','pat_seq','pat_order','type_no','type_num','type_seq','type_order','book_no','unit_no','unit_seq']){
      const value=row[key];if(typeof value==='number'&&Number.isFinite(value)||typeof value==='string'&&value.length<200)candidateFields[key]=value as string|number;
    }
    return {metadata,fieldNames,candidateFields,printedTypeOrdinal:'not_qualified' as const,generatedPaperMembership:'unqualified' as const,answersRetained:false as const};
  }
  async journalState(target:JournalHttpTarget):Promise<JournalHttpState>{
    if(target.teacherKey!==this.#principal.teacherKey)throw Error('journal_principal_conflict');
    if(!this.#authenticated)throw Error('authentication_required');
    const request={family:'day_record',teacherLabel:this.#principal.teacherLabel,date:target.date,groupIds:[target.groupId],studentNames:[target.studentName]};
    const result=await this.execute(request);const row=result.dayRecords.find(r=>r.studentName===target.studentName);
    if(!row)throw Error('journal_target_not_observed');
    const {fields,...identity}=row;if(canonicalJson(identity)!==canonicalJson(target))throw Error('journal_target_conflict');
    const wire=(await this.inspectDayRecordWire(request))[0];const controls=wire?.rows.find(r=>r.studentName===target.studentName)?.controls;
    if(!wire||!controls)throw Error('journal_wire_not_observed');
    const wireDigest=journalWireDigest(wire);assertJournalWireQualified(wireDigest);
    assertJournalAssessmentOptions(wire.assessmentOptions);
    for(const [handler,selector] of [['onAttn','udtAttn'],['onFoPrg','udtPrg'],['onFoHw','udtHw'],['onFoMm','udtMemo'],['setDailyTest','SetDailyTest'],['openHomeWorkRate','SetHomeWorkRate']])
      if(!wire.functions[handler!] || !wire.functions[handler!].includes('reqCmd='+selector))throw Error('journal_wire_drift');
    const assessment=(field:string)=>{const matches=controls.filter(c=>c.name===field);if(matches.length!==1||typeof matches[0]!.value!=='string')throw Error('journal_assessment_not_observed');return matches[0]!.value;};
    const dailyHandlers=controls.map(c=>c.handler??'').filter(h=>/^setDailyTest\(/.test(h));
    const dailyTuple=dailyHandlers.length===1?/^setDailyTest\(([1-9][0-9]*),([1-9][0-9]*),[0-9]+\)$/.exec(dailyHandlers[0]!):null;
    if(!dailyTuple||dailyTuple[1]!==target.recordKey||dailyTuple[2]!==target.membershipKey)throw Error('journal_daily_tuple_conflict');
    const previousHandlers=controls.map(c=>c.handler??'').filter(h=>/^openHomeWorkRate\(/.test(h));
    // A first lesson: the row has neither the previous lesson's homework-rate handler nor its control.
    // There is no previous record to read; one of the two without the other stays refused.
    // "No handler" uses the row reader's unanchored test, so any row that mentions the handler is not a first lesson.
    if(!controls.some(c=>/openHomeWorkRate\s*\(/.test(c.handler??''))&&!controls.some(c=>c.name==='h_homework_rate'))
      return {target:{...target},fields:{...fields,dailyTestAssessment:assessment('h_daily_test')},previousRecordKey:null,previousDate:null,wireDigest};
    if(previousHandlers.length!==1)throw Error('journal_previous_tuple_ambiguous');
    const match=/^openHomeWorkRate\(([1-9][0-9]*),([1-9][0-9]*),[0-9]+\)$/.exec(previousHandlers[0]!);
    if(!match||match[2]!==target.membershipKey||match[1]===target.recordKey)throw Error('journal_previous_tuple_conflict');
    const previousRecordKey=readLiteralKey(match[1]);
    const plan=createAcademyReadPlan(request);
    const query=new URLSearchParams({reqCmd:'SelSglRecord',course_seq:target.courseKey,stu_pri_no:target.studentKey,record_seq:previousRecordKey,sel_grp_seq:target.groupId,tut_pri_no:target.teacherKey,cm_seq:target.membershipKey});
    const response=await this.#readRequest(plan,'/servlet/controller.cct.tutor.CourseScheduleServlet?'+query,{method:'GET'});
    const text=await response.text();if(text.length>2000000||/webUserPass|세션이 만료/.test(text))throw Error('journal_previous_source_rejected');
    const xml=sourceDomParser.parseFromString(text,'text/xml'),records=xml.querySelectorAll('record'),values=records[0]?.textContent?.split('!');
    if(xml.querySelector('parsererror')||records.length!==1||!values||values[2]!==target.courseKey||values[4]!==target.studentName||values[10]!==previousRecordKey||values[11]!==target.studentKey||values[12]!==target.membershipKey||!values[1]||values[1]>=target.date)throw Error('journal_previous_occurrence_conflict');
    return {target:{...target},fields:{...fields,dailyTestAssessment:assessment('h_daily_test'),previousHomeworkAssessment:assessment('h_homework_rate')},previousRecordKey,previousDate:values[1],wireDigest};
  }
  async applyJournalAction(action:JournalHttpAction,admission:JournalHttpAdmission){
    validateJournalHttpAction(action);
    if(action.target.teacherKey!==this.#principal.teacherKey)throw Error('journal_principal_conflict');
    if(!this.#authenticated)throw Error('authentication_required');
    return applyJournalHttpAction(action,{...admission,read:target=>this.journalState(target),write:async selected=>{
      const contract=JOURNAL_HTTP_SOURCE_CONTRACT.fields[selected.field];
      if(contract.method==='GET'){
        const t=selected.target,query=new URLSearchParams({reqCmd:contract.selector,[contract.valueParameter]:selected.after,course_seq:t.courseKey,stu_pri_no:t.studentKey,record_seq:selected.effectRecordKey,cm_seq:t.membershipKey,dummy:new Date().toISOString()});
        await this.#request(contract.path+'?'+query,{method:contract.method});
      }else{
        const body=new URLSearchParams({reqCmd:contract.selector,cm_seq:selected.target.membershipKey,record_seq:selected.effectRecordKey,tutor_pri_no:selected.target.teacherKey,[contract.valueParameter]:selected.after});
        await this.#request(contract.path,{method:contract.method,headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'},body:body.toString()});
      }
    }});
  }
  async execute(input:unknown):Promise<AcademyReadResult>{
    const plan=createAcademyReadPlan(input);
    if(plan.request.teacherLabel!==this.#principal.teacherLabel)throw Error('teacher_scope_conflict');
    if(!this.#authenticated)throw Error('authentication_required');
    const result=await executeAcademyRead(plan,{origin:ACADEMY_ORIGIN,authenticatedTeacherVisible:true,authenticationMode:'direct_http_api',principalKey:this.#principal.teacherKey,
      domParser:sourceDomParser,dayRecordColumnContract:currentDayRecordColumns,fetcher:(url,init)=>this.#readRequest(plan,url,init),
      textbookPaperSearch:async()=>{
        if(plan.family!=='textbook')return {status:'unavailable',rows:[]};
        try{
          const paper=await this.searchStudentPaperMetadata({teacherLabel:plan.request.teacherLabel,studentName:plan.request.studentName,studentKey:plan.request.studentKey,includeAllPaperTypes:true});
          return {status:'observed' as const,rows:paper.rows.flatMap(r=>typeof r.titles.testingName==='string'
            ?[{testingName:r.titles.testingName,paperKey:r.paperKey,attemptKey:r.attemptKey,applyDateLiteral:typeof r.titles.applyDate==='string'?r.titles.applyDate:null}]:[])};
        }catch{return {status:'unavailable' as const,rows:[] as never[]};}
      }});
    if(!this.#authenticated)throw Error('authentication_required');return result;
  }
  async #readRequest(plan:ScopedAcademyReadPlan,path:string,init:RequestInit):Promise<Response>{
    if(!this.#authenticated)throw Error('authentication_required');
    const url=new URL(path,ACADEMY_ORIGIN),query=url.searchParams,body=new URLSearchParams(typeof init.body==='string'?init.body:'');
    const method=init.method??'GET';
    const operation=plan.operations.find(op=>op.path===url.pathname&&op.method===method
      &&(op.selectorPlacement==='query'?query:body).getAll(op.selectorKey).length===1
      &&(op.selectorPlacement==='query'?query:body).get(op.selectorKey)===op.selector);
    if(url.origin!==ACADEMY_ORIGIN||!operation||query.getAll(operation.selectorKey).length+body.getAll(operation.selectorKey).length>2)throw Error('reviewed_read_operation_required');
    let response:Response;
    try{response=await this.#request(path,init,false,operation.selector);}catch(error){
      if(error instanceof AcademyHttpFailure&&[401,403].includes(error.httpStatus)||error instanceof Error&&error.message==='source_redirect_rejected'){this.close();throw Error('authentication_required');}
      throw error;
    }
    // Bound the actual body, then let every family parser consume the same unchanged text.
    const reader=response.body?.getReader(),chunks:Uint8Array[]=[];let length=0;
    if(reader)try{for(;;){const part=await reader.read();if(part.done)break;length+=part.value.length;if(length>2000000){await reader.cancel();throw Error('source_response_too_large');}chunks.push(part.value);}}finally{reader.releaseLock();}
    const text=Buffer.concat(chunks).toString('utf8');
    if(/webUserPass|세션이 만료|<input\b[^>]*\btype\s*=\s*["']?password\b|<form\b[^>]*\bname\s*=\s*["']?loginForm\b/i.test(text)){this.close();throw Error('authentication_required');}
    return new Response(text,{status:response.status,headers:response.headers});
  }
}

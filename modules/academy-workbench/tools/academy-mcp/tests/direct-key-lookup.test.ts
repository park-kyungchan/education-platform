import {describe,expect,test} from 'bun:test';
import {chmod,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {lmsRequestRole,writeForbiddenTransport} from './network-deny.ts';
import {REPORT_VIEW_PATH,readReportViewEnvelope,reportViewForm} from '../../../../../apps/academy/dc-gang-a/src/lms/reportViewClient.ts';
import {reportViewRequestEffect,reportViewRoutes} from '../../../../../apps/academy/dc-gang-a/src/lms/lmsRouteRegistry.ts';
import {AcademyHttpClient} from '../../../../../apps/academy/dc-gang-a/src/lms/academyHttpClient.ts';
import {projectCourseBookReport,readCourseBookReportEnvelope} from '../../../../../apps/academy/dc-gang-a/src/lms/courseBookReport.ts';
import {REPORT_VIEW_NAMES,validateReportViewName} from '../../../../../apps/academy/dc-gang-a/src/lms/reportViewRead.ts';
import {DailyRecordService,textbookSectionResultsGetSchema,clinicPaperStatusGetSchema} from '../src/dailyrecord.ts';
import {NativeDailyRecordBackend,bookTitleAgrees} from '../src/native-dailyrecord-backend.ts';
import {EduAcademyMemoryBindingReader,memoryProcess,memoryReadSubcommands,type HistoricalBinding,type HistoricalBindingReader} from '../src/historical-binding-reader.ts';
import {accountLockPrefix} from '../src/runtime-identity.ts';
import {accountBusy} from '../src/upstream-process.ts';

// specs/academy-mcp/direct-key-lookup.md R1-R12: the direct-key historical fallback of
// academy_textbook_section_results_get. Invented keys, names and synthetic pages only; the
// LMS is a recorded fixture transport that answers write_forbidden to every write route.
const STUDENT='Invented Student',KEY='770011',COURSE='560013',BOOK='430019',LIVE_COURSE='570017',LIVE_BOOK='110023';
const TITLE='[필수예제] [가우스] 1-1 Invented section - '+STUDENT,OTHER_TITLE='[유형다지기] [가우스] 1-2 Invented drill - '+STUDENT;
const MEMORY_LABEL='가우스 1-1 Invented',REPORT_TITLE='가우스 초등 1-1 Invented';
const admission={teacherId:'99001',teacherLabel:'Invented Teacher',students:[{studentId:KEY,displayName:STUDENT}],sourceBundleSha256:'b'.repeat(64)};
const credential=()=>({username:'fictional',password:'fictional'});
const request={displayName:STUDENT,purpose:'Read an invented archived book',currentRequestRef:'direct-key-request'};

const loginPage='<form id="loginForm" name="loginForm" method="post"><input name="p_process"><input name="p_prino"><input name="p_groupno"><input name="userpwd" type="password"><input name="userid"><input name="cf_pc"><input name="cf_user"><input name="autoLoginCheck"><input name="autoLoginKey"></form><script>document.loginForm.action = "/servlet/controller.login.LoginServlet"; document.loginForm.p_process.value = "c_login";</script>';
const principal='<a href="/logout">Invented Teacher- [로그아웃]</a><form name="userForm"><input name="pri_no" value="99001"></form><form name="form1"><input name="g_pri_no" value="99001"><input name="g_clg_no" value="88001"><input name="g_mem_type" value="teacher"></form>';
/** getTextBookProgress rows: one row per live book, its wrong-note button binding the keys. */
const progress=(books:{courseKey:string;bookNo:string;label:string}[])=>'<table>'+books.map(b=>
  `<tr><td>${STUDENT}</td><td>${b.label}</td><td>10 %</td><td><button onclick="createBookIncorrectPapers('${b.courseKey}','${b.bookNo}','${KEY}')">생성</button></td></tr>`).join('')+'</table>';
const liveBook={courseKey:LIVE_COURSE,bookNo:LIVE_BOOK,label:'다빈치 3-2 Invented'};
const noteRow=(over:Record<string,unknown>={})=>({pri_no:Number(KEY),cls_no:Number(COURSE),name:STUDENT,testing_name:TITLE,p_no:5001,testing_no:6001,apply_date:'03-14',...over});
const note=(rows:unknown[])=>JSON.stringify({result:'ok',noteResultList:rows});
const reportRaw=(over:Record<string,unknown>={})=>({
  block1:[{'1':REPORT_TITLE,'2':'2040-01-01','3':'2040-03-01','4':STUDENT}],block2:[{'1':5,'3':82.5,'4':75,'5':'Invented comment'}],
  block5:[{'1':1,'2':'Invented test','3':10,'4':70,'5':80,'6':'03-01'}],
  bunit_list:[{'1':'Invented chapter','3':80,'4':70,exam_result:[{'1':1,'2':'Invented type','3':2,'4':1,'5':66,'6':'O'},{'1':2,'2':' Other type ','3':4,'4':3,'5':40,'6':'X'}]}],
  block9:[{'2':1,'3':2,'4':3,'5':4}],block10:[{'1':90},{'1':80},{'1':70},{'1':60}],block11:[{'2':71}],block12:[{'2':'Invented unit','3':3,'4':4,'5':70}],...over});
const envelope=(raw:unknown)=>`<html><body>SERVER_RET = OK<BR>${JSON.stringify(raw)}<END_DATA></body></html>`;
const single=(title:string)=>JSON.stringify({result:'OK',print_list:[{pri_no:Number(KEY),student_name:STUDENT,score:50,sub_title:title,
  exam_list:[{exam_no:2,scoring_result:'X',lecture_key:9102},{exam_no:1,scoring_result:'O',lecture_key:9101}]}]});

type Answer=string|Response|((body:URLSearchParams)=>string|Response);
type WireAnswers={getTextBookProgress?:Answer;getWrongAnswerNoteResult?:Answer;getCourseBookReport?:Answer;getStudyResultSingleTestingSingleUser?:Answer};
const memoryOf=(bindings:HistoricalBinding[]):HistoricalBindingReader&{calls:number}=>{
  const reader={calls:0,async activeBindings(name:string,id:string){reader.calls++;expect([name,id]).toEqual([STUDENT,KEY]);return bindings;}};
  return reader;
};
/** The real LMS client over a recorded synthetic LMS: login, then the answers given by operation. */
function wire(answers:WireAnswers,reader:HistoricalBindingReader|null=null){
  const bodies:Record<string,URLSearchParams[]>={};
  const guard=writeForbiddenTransport((url,init)=>{
    const u=new URL(url),body=new URLSearchParams(typeof init?.body==='string'?init.body:'');
    if(u.pathname==='/c_login.jsp')return new Response(loginPage);
    if(u.pathname==='/servlet/controller.login.LoginServlet'||u.searchParams.get('reqCmd')==='StudyCourse')return new Response(principal);
    const op=u.searchParams.get('p_process')??u.searchParams.get('reqCmd')??body.get('p_process')??body.get('reqCmd')??'';
    (bodies[op]??=[]).push(body);
    const answer=answers[op as keyof WireAnswers];
    if(answer===undefined)throw Error('unexpected_fixture_request');
    const out=typeof answer==='function'?answer(body):answer;
    return typeof out==='string'?new Response(out):out.clone();
  });
  const client=new AcademyHttpClient({teacherLabel:'Invented Teacher',teacherKey:'99001',collegeKey:'88001'},guard.transport as never);
  const backend=new NativeDailyRecordBackend(client as never,admission,credential,null,null,null,null,reader);
  /** The operations after the login exchange, in order. */
  const ops=()=>guard.requests.filter(r=>r.role!=='login'&&!r.route.endsWith(' StudyCourse')).map(r=>r.route.split(' ')[1]);
  return {guard,backend,service:new DailyRecordService(backend),ops,bodies};
}
const historicalAnswers=(over:WireAnswers={}):WireAnswers=>({getTextBookProgress:progress([liveBook]),getWrongAnswerNoteResult:note([noteRow()]),
  getCourseBookReport:envelope(reportRaw()),getStudyResultSingleTestingSingleUser:body=>single(JSON.parse(body.get('condition')!).testing_no===6002?OTHER_TITLE:TITLE),...over});
const explicitKeys={courseKey:COURSE,bookNo:BOOK,studentKey:KEY};

/** A fake source port for the live path: it records every call. */
function livePort(bindings:{courseKey:string;bookNo:string;studentKey:string;bookLabel:string}[]){
  const calls:string[]=[];
  const port={authenticate:async()=>{},discoverDayRecordGroups:async()=>({groups:[]}),close:()=>{},journalState:async()=>{throw Error('not_called');},
    readTextbookBindings:async()=>{calls.push('bindings');return bindings;},
    inspectTextbookIndex:async(input:any)=>{calls.push('index:'+input.bookNo);return {rows:[{sourceTitle:'Live section of '+input.bookNo,sourceDate:{literal:'10-23',meaning:'source_apply_date_not_exact_grade_time'}}]};},
    execute:async(input:any)=>{calls.push('execute:'+input.bookNo);return {family:'textbook',status:'observed',observedAt:'2040-01-16T09:00:00.000Z',coverage:'x',
      records:input.sourceTitles.map((sourceTitle:string)=>({sourceTitle,studentKey:KEY,studentName:STUDENT,courseKey:input.courseKey,bookNo:input.bookNo,score:90,
        items:[{originalOrdinal:'1',lectureKey:'8101',outerLectureKey:null,scoring:'O'}],sourceDate:{literal:null,precision:'unknown',meaning:'source_apply_date_not_exact_grade_time'}}))};},
    readHistoricalTextbookIndex:async()=>{calls.push('historical');throw Error('not_called');},
    readCourseBookReport:async()=>{calls.push('report');throw Error('not_called');},
  };
  return {calls,port};
}
const liveBinding={courseKey:LIVE_COURSE,bookNo:LIVE_BOOK,studentKey:KEY,bookLabel:'다빈치 3-2 Invented'};

describe('direct-key historical lookup (specs/academy-mcp/direct-key-lookup.md)',()=>{
 test('direct_key_r1_live_list_answers_as_before',async()=>{
  // Explicit keys of a live book, a label of a live book, and no label at all: the live path, no bindingSource.
  for(const args of [{...request,courseKey:LIVE_COURSE,bookNo:LIVE_BOOK,studentKey:KEY},{...request,bookLabel:'다빈치 3-2'},request]){
   const {calls,port}=livePort([liveBinding]);
   const reader=memoryOf([{bookNo:BOOK,courseKey:COURSE,bookLabel:MEMORY_LABEL}]);
   const answer=await new DailyRecordService(new NativeDailyRecordBackend(port as never,admission,credential,null,null,null,null,reader)).textbookSectionsByName(args) as any;
   expect(answer).toMatchObject({status:'observed',courseKey:LIVE_COURSE,bookNo:LIVE_BOOK,index:[{sourceTitle:'Live section of '+LIVE_BOOK}]});
   expect(answer.bindingSource).toBeUndefined();
   expect(calls).toEqual(['bindings','index:'+LIVE_BOOK]);expect(reader.calls).toBe(0);
  }
  // Section grading of a live book stays the live read.
  const {calls,port}=livePort([liveBinding]);
  const graded=await new DailyRecordService(new NativeDailyRecordBackend(port as never,admission,credential)).textbookSectionsByName({...request,courseKey:LIVE_COURSE,bookNo:LIVE_BOOK,studentKey:KEY,sourceTitles:['Live section']}) as any;
  expect(graded).toMatchObject({status:'observed',records:[{sourceTitle:'Live section',score:90}]});expect(graded.bindingSource).toBeUndefined();
  expect(calls).toEqual(['bindings','execute:'+LIVE_BOOK]);
  // With no label and no keys an empty live list keeps its refusal, memory or not.
  const empty=livePort([]);
  const refused=await new DailyRecordService(new NativeDailyRecordBackend(empty.port as never,admission,credential,null,null,null,null,memoryOf([]))).textbookSectionsByName(request);
  expect(refused).toMatchObject({status:'unavailable',reasonCode:'textbook_binding_source_unqualified'});
 });

 test('direct_key_r2_explicit_and_memory_keys',async()=>{
  // Explicit keys of a book the live list does not hold.
  const explicit=wire(historicalAnswers());
  const byKeys=await explicit.service.textbookSectionsByName({...request,...explicitKeys}) as any;
  expect(byKeys).toMatchObject({status:'observed',bindingSource:'historical_key_registry',courseKey:COURSE,bookNo:BOOK,student:{studentId:KEY,displayName:STUDENT},
   index:[{sourceTitle:TITLE,sourceDate:{literal:'03-14'}}],indexBasis:'wrong_answer_note_only',
   coverage:'historical_wrong_answer_note_and_course_book_report_only_all_correct_sections_omitted_from_wrong_note_index',
   reportSummary:{bookTitle:REPORT_TITLE,period:'2040-01-01 ~ 2040-03-01',myAverage:82.5,allAverage:75,chapterCount:1},academyWrites:0});
  // The active memory binding that the label selects, after a live list that holds another book.
  const reader=memoryOf([{bookNo:BOOK,courseKey:COURSE,bookLabel:MEMORY_LABEL},{bookNo:'430027',courseKey:'560013',bookLabel:'개념원리 2-1 Invented'}]);
  const memory=wire(historicalAnswers(),reader);
  const byLabel=await memory.service.textbookSectionsByName({...request,bookLabel:'가우스 1-1'}) as any;
  expect(byLabel).toMatchObject({status:'observed',bindingSource:'historical_key_registry',courseKey:COURSE,bookNo:BOOK,bookLabel:MEMORY_LABEL,
   bookSelection:{requested:'가우스 1-1',boundLabel:MEMORY_LABEL,match:'loose'}});
  expect(reader.calls).toBe(1);
  // The empty live page, which the client cannot qualify, is a live list without the book.
  const empty=wire(historicalAnswers({getTextBookProgress:'<table></table>'}),memoryOf([{bookNo:BOOK,courseKey:COURSE,bookLabel:MEMORY_LABEL}]));
  expect(await empty.service.textbookSectionsByName({...request,bookLabel:MEMORY_LABEL})).toMatchObject({status:'observed',bindingSource:'historical_key_registry',bookSelection:{match:'exact'}});
  // An all-correct archived book: a verified report and an empty wrong-note list answer index [].
  const allCorrect=wire(historicalAnswers({getWrongAnswerNoteResult:note([])}));
  expect(await allCorrect.service.textbookSectionsByName({...request,...explicitKeys})).toMatchObject({status:'observed',index:[],bindingSource:'historical_key_registry'});
 });

 test('direct_key_r3_only_the_read_list',async()=>{
  const index=wire(historicalAnswers());
  await index.service.textbookSectionsByName({...request,...explicitKeys});
  expect(index.ops()).toEqual(['getTextBookProgress','getWrongAnswerNoteResult','getCourseBookReport']);
  expect(index.guard.requests.filter(r=>r.role!=='login').map(r=>r.route.split(' ')[0])).toEqual(['/servlet/controller.coursemanage.CourseManageServlet',
   '/servlet/controller.coursemanage.TextBookManageServlet','/servlet/controller.common.TestpageSelectExServlet','/servlet/controller.coursemanage.TextBookManageServlet']);
  expect(JSON.parse(index.bodies.getWrongAnswerNoteResult![0]!.get('answerNoteResult')!)).toEqual({courseKeyList:[COURSE],bookNoList:[BOOK],userKeyList:[KEY]});
  expect(index.bodies.getCourseBookReport![0]!.toString()).toBe(`reqCmd=getCourseBookReport&course_key=${COURSE}&book_no=${BOOK}&student_pri_no=${KEY}`);
  // With sourceTitles: the single-user result of each verified wrong-note attempt, nothing else.
  const sections=wire(historicalAnswers({getWrongAnswerNoteResult:note([noteRow(),noteRow({testing_name:OTHER_TITLE,p_no:5002,testing_no:6002})])}));
  const graded=await sections.service.textbookSectionsByName({...request,...explicitKeys,sourceTitles:[TITLE,OTHER_TITLE]}) as any;
  expect(graded).toMatchObject({status:'observed',bindingSource:'historical_key_registry',courseKey:COURSE,bookNo:BOOK});
  expect(graded.records.map((r:any)=>[r.sourceTitle,r.score,r.correctCount,r.itemCount,r.items.map((i:any)=>i.ordinal+i.scoring).join()]).sort())
   .toEqual([[TITLE,50,1,2,'1O,2X'],[OTHER_TITLE,50,1,2,'1O,2X']].sort());
  expect(sections.ops()).toEqual(['getTextBookProgress','getWrongAnswerNoteResult','getCourseBookReport','getStudyResultSingleTestingSingleUser','getStudyResultSingleTestingSingleUser']);
  expect(sections.bodies.getStudyResultSingleTestingSingleUser!.map(b=>JSON.parse(b.get('condition')!).testing_no)).toEqual([6001,6002]);
  for(const w of [index,sections])expect(w.ops().filter(op=>op==='UserBySearchTestResult'||op==='UserByMain')).toEqual([]);
  // A title absent from the wrong-note index is not observed; no score is invented and no detail is read.
  const absent=wire(historicalAnswers());
  expect(await absent.service.textbookSectionsByName({...request,...explicitKeys,sourceTitles:['[필수예제] [가우스] 9-9 Missing']}))
   .toMatchObject({status:'not_observed_in_either_source',reasonCode:'textbook_section_not_in_either_observed_source'});
  expect(absent.ops()).toEqual(['getTextBookProgress','getWrongAnswerNoteResult','getCourseBookReport']);
 });

 test('direct_key_r4_keys_verified_never_guessed',async()=>{
  const refusals:[string,WireAnswers,Record<string,unknown>][]=[
   ['a wrong-note row of another student',{getWrongAnswerNoteResult:note([noteRow({pri_no:770012})])},{}],
   ['a wrong-note row without cls_no',{getWrongAnswerNoteResult:note([noteRow({cls_no:undefined})])},{}],
   ['a report without SERVER_RET = OK',{getCourseBookReport:'<html><body>SERVER_RET = FAIL<BR>{}<END_DATA></body></html>'},{}],
   ['a report that is no envelope',{getCourseBookReport:'<html><body>Invented error page</body></html>'},{}],
   ['a report of another student',{getCourseBookReport:envelope(reportRaw({block1:[{'1':REPORT_TITLE,'2':'a','3':'b','4':'Other Invented'}]}))},{}],
   ['a report without a book title',{getCourseBookReport:envelope(reportRaw({block1:[{'1':' ','2':'a','3':'b','4':STUDENT}]}))},{}],
   ['a report echoing another course key',{getCourseBookReport:envelope(reportRaw({course_key:'560099'}))},{}],
   ['a report echoing another book in block1',{getCourseBookReport:envelope(reportRaw({block1:[{'1':REPORT_TITLE,'2':'a','3':'b','4':STUDENT,book_no:'430099'}]}))},{}],
   ['a report of a failed request',{getCourseBookReport:new Response('Invented failure',{status:500})},{}],
   ['a report whose title disagrees with the given label',{},{bookLabel:'개념원리 3-1'}],
  ];
  for(const [name,answers,extra] of refusals){
   const w=wire(historicalAnswers(answers));
   const answer=await w.service.textbookSectionsByName({...request,...explicitKeys,...extra}) as any;
   expect({name,status:answer.status,reasonCode:answer.reasonCode,index:answer.index,records:answer.records}).toEqual({name,status:'unavailable',reasonCode:'historical_key_unverified',index:undefined,records:undefined});
  }
  // An explicit student key that is not the named student's refuses before any fallback request.
  const other=wire(historicalAnswers());
  expect(await other.service.textbookSectionsByName({...request,...explicitKeys,studentKey:'770012'})).toMatchObject({status:'unavailable',reasonCode:'historical_key_unverified'});
  expect(other.ops()).toEqual([]);
  // A memory binding whose label the report's title does not agree with.
  const mislabeled=wire(historicalAnswers(),memoryOf([{bookNo:BOOK,courseKey:COURSE,bookLabel:'개념원리 2-1 Invented'}]));
  expect(await mislabeled.service.textbookSectionsByName({...request,bookLabel:'개념원리 2-1'})).toMatchObject({status:'unavailable',reasonCode:'historical_key_unverified'});
  expect(bookTitleAgrees(REPORT_TITLE,MEMORY_LABEL)).toBe(true);expect(bookTitleAgrees(REPORT_TITLE,'다빈치 1-1')).toBe(false);
 });

 test('direct_key_cls_no_zero_rows_are_in_scope',async()=>{
  // The live shape (finding ama-live-directkey-clsno-zero): cls_no is the number 0 on every row.
  const zero=(over:Record<string,unknown>={})=>noteRow({cls_no:0,...over});
  const w=wire(historicalAnswers({getWrongAnswerNoteResult:note([zero(),zero({testing_name:OTHER_TITLE,p_no:5002,testing_no:6002})])}));
  const answer=await w.service.textbookSectionsByName({...request,...explicitKeys}) as any;
  expect(answer).toMatchObject({status:'observed',bindingSource:'historical_key_registry',courseKey:COURSE,bookNo:BOOK});
  expect(answer.index.map((r:any)=>r.sourceTitle)).toEqual([TITLE,OTHER_TITLE]);
  expect(JSON.parse(w.bodies.getWrongAnswerNoteResult![0]!.get('answerNoteResult')!)).toEqual({courseKeyList:[COURSE],bookNoList:[BOOK],userKeyList:[KEY]});
  // Zero and the course key may be mixed; a row of another student is never in scope.
  const mixed=wire(historicalAnswers({getWrongAnswerNoteResult:note([zero(),noteRow({testing_name:OTHER_TITLE,p_no:5002,testing_no:6002})])}));
  expect(await mixed.service.textbookSectionsByName({...request,...explicitKeys})).toMatchObject({status:'observed'});
  const foreign=wire(historicalAnswers({getWrongAnswerNoteResult:note([zero({pri_no:770012})])}));
  expect(await foreign.service.textbookSectionsByName({...request,...explicitKeys})).toMatchObject({status:'unavailable',reasonCode:'historical_key_unverified'});
 });

 test('direct_key_cls_no_other_course_refuses_historical_key_unverified',async()=>{
  for(const cls of [560099,-1,'abc',null])
   for(const rows of [[noteRow({cls_no:0}),noteRow({cls_no:cls,testing_no:6009})],[noteRow({cls_no:cls})]]){
    const w=wire(historicalAnswers({getWrongAnswerNoteResult:note(rows)}));
    const answer=await w.service.textbookSectionsByName({...request,...explicitKeys}) as any;
    expect({cls,status:answer.status,reasonCode:answer.reasonCode,index:answer.index}).toEqual({cls,status:'unavailable',reasonCode:'historical_key_unverified',index:undefined});
   }
 });

 test('direct_key_r5_missing_and_ambiguous_bindings',async()=>{
  // Two active bindings of one book_no with different course keys.
  const ambiguous=wire(historicalAnswers(),memoryOf([{bookNo:BOOK,courseKey:COURSE,bookLabel:MEMORY_LABEL},{bookNo:BOOK,courseKey:'560099',bookLabel:MEMORY_LABEL+' B'}]));
  expect(await ambiguous.service.textbookSectionsByName({...request,bookLabel:'가우스 1-1'})).toMatchObject({status:'unavailable',reasonCode:'historical_binding_ambiguous'});
  expect(ambiguous.ops()).toEqual(['getTextBookProgress']);
  // Neither the live list nor a binding: an empty live list and no memory match.
  for(const reader of [null,memoryOf([{bookNo:BOOK,courseKey:'CK-12',bookLabel:MEMORY_LABEL}]),memoryOf([])]){
   const missing=wire(historicalAnswers({getTextBookProgress:'<table></table>'}),reader);
   expect(await missing.service.textbookSectionsByName({...request,bookLabel:'가우스 1-1'})).toMatchObject({status:'unavailable',reasonCode:'historical_binding_missing'});
   expect(missing.ops()).toEqual(['getTextBookProgress']);
  }
  // A live list with books and no memory match keeps the live interview (TASK-FLEX-2).
  const {calls,port}=livePort([liveBinding,{...liveBinding,courseKey:'570019',bookNo:'110029',bookLabel:'개념원리 3-1 Invented'}]);
  const flex=await new DailyRecordService(new NativeDailyRecordBackend(port as never,admission,credential,null,null,null,null,memoryOf([]))).textbookSectionsByName({...request,bookLabel:'No Such Book'});
  expect(flex).toMatchObject({status:'interview_required',bindings:[{bookLabel:'다빈치 3-2 Invented'},{bookLabel:'개념원리 3-1 Invented'}],bookSelection:{requested:'No Such Book',match:'none'}});
  expect(calls.filter(c=>c==='historical'||c==='report')).toEqual([]);
  // Two matching memory bindings of different books ask with those candidates.
  const two=wire(historicalAnswers(),memoryOf([{bookNo:BOOK,courseKey:COURSE,bookLabel:MEMORY_LABEL},{bookNo:'430027',courseKey:COURSE,bookLabel:'가우스 1-1 Invented 2'}]));
  expect(await two.service.textbookSectionsByName({...request,bookLabel:'가우스'})).toMatchObject({status:'interview_required',
   bindings:[{bookLabel:MEMORY_LABEL,bookNo:BOOK},{bookLabel:'가우스 1-1 Invented 2',bookNo:'430027'}],bookSelection:{requested:'가우스',match:'several'}});
  expect(two.ops()).toEqual(['getTextBookProgress']);
 });

 test('direct_key_r6_key_rule_before_any_request',async()=>{
  const invalid:Record<string,string>[]=[{courseKey:COURSE},{courseKey:COURSE,bookNo:BOOK},{bookNo:BOOK,studentKey:KEY},
   {...explicitKeys,courseKey:'0560013'},{...explicitKeys,bookNo:'12345678901234567'},{...explicitKeys,studentKey:'9007199254740993'},
   {...explicitKeys,bookNo:'43a019'},{...explicitKeys,courseKey:''},{...explicitKeys,studentKey:'-1'}];
  for(const keys of invalid){
   const w=wire(historicalAnswers());
   expect(textbookSectionResultsGetSchema.safeParse({...request,...keys}).success).toBe(false);
   await expect(w.service.textbookSectionsByName({...request,...keys})).rejects.toThrow();
   expect(w.guard.requests).toEqual([]);
  }
  expect(textbookSectionResultsGetSchema.safeParse({...request,...explicitKeys,studentKey:'9007199254740991'}).success).toBe(true);
  // The clinic read takes no key at all.
  expect(clinicPaperStatusGetSchema.safeParse({...request,...explicitKeys}).success).toBe(false);
 });

 test('direct_key_r7_memory_read_only',async()=>{
  // The production reader runs roster, show and due only, --store before the subcommand, a fixed environment.
  const directory=await mkdtemp(resolve(tmpdir(),'direct-key-memory-'));
  try{
   const bin=resolve(directory,'edu-academy-memory'),store=resolve(directory,'store.json');
   await writeFile(bin,['#!/bin/sh','d=$(dirname "$0")','printf \'%s\\n\' "$*" >> "$d/calls.log"','printf \'HOME=%s EDU_ONT_BIN=%s\\n\' "${HOME-unset}" "$EDU_ONT_BIN" >> "$d/env.log"',
    'case "$3" in',
    ` roster) printf 'stu-a\\tclass_slot=none\\tmemory_as_of=-\\nstu-b\\tclass_slot=none\\tmemory_as_of=-\\n';;`,
    ` show) if [ "$5" = stu-a ]; then printf 'student stu-a\\nhead: 3\\nname: ${STUDENT}\\nstudent_id: ${KEY}\\n'; else printf 'student stu-b\\nhead: 1\\nname: Other Invented\\n'; fi;;`,
    ` due) printf '{"student":"stu-a","lesson_date":"%s","memory_as_of":"-","have":[],"due":[],"bindings":[{"book_no":"${BOOK}","course_key":"${COURSE}","book_label":"${MEMORY_LABEL}"}]}\\n' "$5";;`,
    ' *) exit 9;;','esac',''].join('\n'));
   await chmod(bin,0o755);
   const reader=new EduAcademyMemoryBindingReader(memoryProcess(bin,store),()=>'2040-01-16');
   expect(await reader.activeBindings(STUDENT,KEY)).toEqual([{bookNo:BOOK,courseKey:COURSE,bookLabel:MEMORY_LABEL}]);
   const calls=(await readFile(resolve(directory,'calls.log'),'utf8')).trim().split('\n');
   expect(calls).toEqual([`--store ${store} roster`,`--store ${store} show student stu-a`,`--store ${store} show student stu-b`,`--store ${store} due stu-a 2040-01-16`]);
   expect(new Set((await readFile(resolve(directory,'env.log'),'utf8')).trim().split('\n'))).toEqual(new Set(['HOME=unset EDU_ONT_BIN=/usr/local/bin/ont']));
   // A stored student_id of another key is not this student.
   expect(await reader.activeBindings(STUDENT,'770012')).toEqual([]);
   // Every write subcommand is refused before a process starts.
   const before=(await readFile(resolve(directory,'calls.log'),'utf8')).length;
   for(const write of ['bind','unbind','observed','note','remind','student','day-close','import'])
    await expect(memoryProcess(bin,store)([write,'stu-a'])).rejects.toThrow('historical_binding_reader_refused');
   expect((await readFile(resolve(directory,'calls.log'),'utf8')).length).toBe(before);
   expect([...memoryReadSubcommands].sort()).toEqual(['due','roster','show']);
   expect(()=>memoryProcess('relative/bin',store)).toThrow('memory_bindings_arguments_invalid');
  }finally{await rm(directory,{recursive:true,force:true});}
  // The reader asks one student's slug by name; two store students of the name are ambiguous.
  const runs:string[][]=[];
  const twice=new EduAcademyMemoryBindingReader(async args=>{runs.push([...args]);
   return args[0]==='roster'?'stu-a\tclass_slot=none\tmemory_as_of=-\nstu-b\tclass_slot=none\tmemory_as_of=-\n':`student ${args[2]}\nname: ${STUDENT}\n`;},()=>'2040-01-16');
  await expect(twice.activeBindings(STUDENT,KEY)).rejects.toThrow('historical_binding_ambiguous');
  expect(runs.every(r=>memoryReadSubcommands.has(r[0]!))).toBe(true);
 });

 test('direct_key_r8_report_view_names',()=>{
  expect([...REPORT_VIEW_NAMES]).toEqual(['SmartBookReportView','DiagReportView','NewStudentReportView','FaView','GaReportView','NaScoreResultView']);
  for(const view of REPORT_VIEW_NAMES)expect(validateReportViewName(view)).toBe(view);
  for(const view of ['StudentInfoView','faview','FaView ','',null,1,'../FaView'])expect(()=>validateReportViewName(view)).toThrow('report_view_name_invalid');
 });

 test('direct_key_r8_report_views_are_read_by_post_only',()=>{
  const url='https://dc.gang-a.kr'+REPORT_VIEW_PATH;
  for(const view of REPORT_VIEW_NAMES){
   expect(lmsRequestRole(url,'p_process='+view+'&p_testing_no=1','POST')).toBe('read');
   expect(reportViewRequestEffect('POST',view)).toBe('read');
   // The same view by GET, or with its name in the query, is not a read.
   expect(lmsRequestRole(url+'?p_process='+view,undefined,'GET')).toBe('write');
   expect(lmsRequestRole(url+'?p_process='+view,'p_process='+view,'POST')).toBe('write');
   expect(lmsRequestRole(url,'p_process='+view,'GET')).toBe('write');
   expect(reportViewRequestEffect('GET',view)).toBe('write');
  }
  for(const view of ['StudentInfoView','faview','SaveReportView','']){
   expect(lmsRequestRole(url,'p_process='+view,'POST')).toBe('write');
   expect(reportViewRequestEffect('POST',view)).toBe('write');
  }
  const routes=reportViewRoutes();
  expect(routes.map(r=>r.operation)).toEqual([...REPORT_VIEW_NAMES]);
  for(const r of routes)expect({path:r.servletPath,method:r.httpMethod,effect:r.semanticEffect,safe:r.safeToProbe})
   .toEqual({path:REPORT_VIEW_PATH,method:'POST',effect:'read',safe:true});
 });

 test('direct_key_r8_report_views_post_their_exact_forms',async()=>{
  expect(reportViewForm('DiagReportView',{testingNo:'901',studentKey:KEY,classNo:COURSE,limitDate:'2040-01-31'}).toString())
   .toBe('p_process=DiagReportView&p_testing_no=901&p_pri_no=770011&p_cls_no=560013&p_limit_date=2040-01-31');
  expect(reportViewForm('FaView',{testingNo:'902',studentKey:KEY,classNo:COURSE}).toString())
   .toBe('p_process=FaView&p_testing_no=902&p_pri_no=770011&p_cls_no=560013&p_limit_date=');
  expect(reportViewForm('NewStudentReportView',{paperNo:'4401',applyCode:'APP-7',collegeKey:'88001'}).toString())
   .toBe('p_process=NewStudentReportView&p_p_no=4401&p_apply_code=APP-7&clg_no=88001');
  for(const [view,params,code] of [['StudentInfoView',{},'report_view_name_invalid'],['GaReportView',{},'report_view_params_invalid'],
   ['DiagReportView',{testingNo:'0',studentKey:KEY,classNo:COURSE},'report_view_params_invalid'],['FaView',{testingNo:'1',studentKey:KEY},'report_view_params_invalid'],
   ['FaView',{testingNo:'1',studentKey:KEY,classNo:COURSE,limitDate:'31/01/2040'},'report_view_params_invalid'],
   ['FaView',{testingNo:'1',studentKey:KEY,classNo:COURSE,extra:'x'},'report_view_params_invalid'],
   ['NewStudentReportView',{paperNo:'1',applyCode:'',collegeKey:'2'},'report_view_params_invalid'],['NewStudentReportView',null,'report_view_params_invalid']] as const)
   expect(()=>reportViewForm(view,params)).toThrow(code);
  // The envelope: JSON after SERVER_RET = OK, with or without <BR> and <END_DATA>; a login page fails closed.
  expect(readReportViewEnvelope('<body>SERVER_RET = OK<BR>{"block1":[{"1":"t"}]}<END_DATA></body>')).toEqual({block1:[{'1':'t'}]});
  expect(readReportViewEnvelope('SERVER_RET = OK {"title":"t"}')).toEqual({title:'t'});
  expect(()=>readReportViewEnvelope(loginPage)).toThrow('authentication_required');
  for(const page of ['<body>SERVER_RET = FAIL<BR>{}<END_DATA></body>','<body>SERVER_RET = OK<BR>not json<END_DATA></body>','<body>SERVER_RET = OK<BR>[1]<END_DATA></body>','<html></html>'])
   expect(()=>readReportViewEnvelope(page)).toThrow('report_view_unqualified');
  // Through the client: the view name first, then one POST of the exact form, classed read.
  let calls=0;const bodies:string[]=[];let answer='<body>SERVER_RET = OK<BR>{"block1":[{"1":"t"}]}<END_DATA></body>';
  const guard=writeForbiddenTransport((_url,init)=>{calls++;
   if(calls===1)return new Response(loginPage);if(calls<=3)return new Response(principal);
   bodies.push(String(init?.body));return new Response(answer);});
  const client=new AcademyHttpClient({teacherLabel:'Invented Teacher',teacherKey:'99001',collegeKey:'88001'},guard.transport as never);
  await expect(client.readReportView('StudentInfoView',{})).rejects.toThrow('report_view_name_invalid');
  await expect(client.readReportView('FaView',{testingNo:'1',studentKey:KEY,classNo:COURSE})).rejects.toThrow('authentication_required');
  expect(calls).toBe(0);
  await client.authenticate(credential());
  expect(await client.readReportView('DiagReportView',{testingNo:'901',studentKey:KEY,classNo:COURSE})).toEqual({block1:[{'1':'t'}]});
  await client.readReportView('NewStudentReportView',{paperNo:'4401',applyCode:'APP-7'});
  await expect(client.readReportView('SmartBookReportView',{})).rejects.toThrow('report_view_params_invalid');
  expect(bodies).toEqual(['p_process=DiagReportView&p_testing_no=901&p_pri_no=770011&p_cls_no=560013&p_limit_date=',
   'p_process=NewStudentReportView&p_p_no=4401&p_apply_code=APP-7&clg_no=88001']);
  expect(guard.forbidden()).toEqual([]);
  expect(guard.requests.slice(-2)).toEqual([{route:REPORT_VIEW_PATH+' DiagReportView',role:'read'},{route:REPORT_VIEW_PATH+' NewStudentReportView',role:'read'}]);
  // A login page in place of the view fails closed and ends the session.
  answer=loginPage;
  await expect(client.readReportView('FaView',{testingNo:'1',studentKey:KEY,classNo:COURSE})).rejects.toThrow('authentication_required');
  expect(client.authenticated).toBe(false);
 });

 test('direct_key_r8_batch2_report_views_post_their_exact_forms',async()=>{
  // GaReportView and NaScoreResultView take the form of DiagReportView; SmartBookReportView the book code and the student key.
  for(const view of ['GaReportView','NaScoreResultView'] as const){
   expect(reportViewForm(view,{testingNo:'903',studentKey:KEY,classNo:COURSE,limitDate:'2040-02-29'}).toString())
    .toBe('p_process='+view+'&p_testing_no=903&p_pri_no=770011&p_cls_no=560013&p_limit_date=2040-02-29');
   expect(reportViewForm(view,{testingNo:'903',studentKey:KEY,classNo:COURSE}).toString())
    .toBe('p_process='+view+'&p_testing_no=903&p_pri_no=770011&p_cls_no=560013&p_limit_date=');
   for(const bad of [{testingNo:'903',studentKey:KEY},{testingNo:'0903',studentKey:KEY,classNo:COURSE},{testingNo:'903',studentKey:KEY,classNo:COURSE,bookCode:'SB-1'}])
    expect(()=>reportViewForm(view,bad)).toThrow('report_view_params_invalid');
  }
  expect(reportViewForm('SmartBookReportView',{bookCode:'SB-2040.inv_01',studentKey:KEY}).toString())
   .toBe('p_process=SmartBookReportView&book_code=SB-2040.inv_01&pri_no=770011');
  for(const bad of [{bookCode:'',studentKey:KEY},{bookCode:'a'.repeat(65),studentKey:KEY},{bookCode:'SB 1',studentKey:KEY},{bookCode:'SB&p_process=x',studentKey:KEY},
   {bookCode:'책',studentKey:KEY},{bookCode:7,studentKey:KEY},{bookCode:'SB-1'},{bookCode:'SB-1',studentKey:'0'},{bookCode:'SB-1',studentKey:KEY,testingNo:'1'}])
   expect(()=>reportViewForm('SmartBookReportView',bad)).toThrow('report_view_params_invalid');
  // Through the client: a bad book code refuses before any request; each view is one POST classed read.
  let calls=0;const bodies:string[]=[];
  const guard=writeForbiddenTransport((_url,init)=>{calls++;
   if(calls===1)return new Response(loginPage);if(calls<=3)return new Response(principal);
   bodies.push(String(init?.body));return new Response('<body>SERVER_RET = OK<BR>{"block1":[{"1":"t"}]}<END_DATA></body>');});
  const client=new AcademyHttpClient({teacherLabel:'Invented Teacher',teacherKey:'99001',collegeKey:'88001'},guard.transport as never);
  await client.authenticate(credential());
  const before=calls;
  await expect(client.readReportView('SmartBookReportView',{bookCode:'../x',studentKey:KEY})).rejects.toThrow('report_view_params_invalid');
  expect(calls).toBe(before);
  await client.readReportView('GaReportView',{testingNo:'903',studentKey:KEY,classNo:COURSE});
  await client.readReportView('NaScoreResultView',{testingNo:'904',studentKey:KEY,classNo:COURSE,limitDate:'2040-01-31'});
  await client.readReportView('SmartBookReportView',{bookCode:'SB-1',studentKey:KEY});
  expect(bodies).toEqual(['p_process=GaReportView&p_testing_no=903&p_pri_no=770011&p_cls_no=560013&p_limit_date=',
   'p_process=NaScoreResultView&p_testing_no=904&p_pri_no=770011&p_cls_no=560013&p_limit_date=2040-01-31',
   'p_process=SmartBookReportView&book_code=SB-1&pri_no=770011']);
  expect(guard.forbidden()).toEqual([]);
  expect(guard.requests.slice(-3)).toEqual(['GaReportView','NaScoreResultView','SmartBookReportView'].map(v=>({route:REPORT_VIEW_PATH+' '+v,role:'read'})));
 });

 test('direct_key_r9_write_forbidden',async()=>{
  const reader=memoryOf([{bookNo:BOOK,courseKey:COURSE,bookLabel:MEMORY_LABEL}]);
  const w=wire(historicalAnswers({getWrongAnswerNoteResult:note([noteRow(),noteRow({testing_name:OTHER_TITLE,p_no:5002,testing_no:6002})])}),reader);
  expect(await w.service.textbookSectionsByName({...request,...explicitKeys})).toMatchObject({status:'observed'});
  expect(await w.service.textbookSectionsByName({...request,bookLabel:'가우스 1-1',sourceTitles:[OTHER_TITLE]})).toMatchObject({status:'observed',records:[{sourceTitle:OTHER_TITLE}]});
  expect(await w.backend.readCourseBookReportByName({displayName:STUDENT,...explicitKeys})).toMatchObject({kind:'report',bindingSource:'historical_key_registry',courseKey:COURSE});
  expect(await w.service.textbookSectionsByName({...request,...explicitKeys,studentKey:'770012'})).toMatchObject({reasonCode:'historical_key_unverified'});
  expect(w.guard.forbidden()).toEqual([]);
  expect(new Set(w.guard.requests.map(r=>r.role))).toEqual(new Set(['login','read']));
 });

 test('direct_key_r10_account_busy',async()=>{
  // The launch prefix the endpoint identity accepts, and only flock's conflict exit means busy.
  expect(accountLockPrefix(['--nonblock','/invented/lock'],'/invented/lock')).toBe(true);
  expect(accountLockPrefix(['--wait','45','--conflict-exit-code','75','/invented/lock'],'/invented/lock')).toBe(true);
  expect(accountLockPrefix(['--conflict-exit-code','75','--wait','45','/invented/lock'],'/invented/lock')).toBe(true);
  for(const prefix of [['--wait','45','/invented/lock'],['--wait','45','--conflict-exit-code','1','/invented/lock'],['--wait','45','--conflict-exit-code','75','/other/lock']])
   expect(accountLockPrefix(prefix,'/invented/lock')).toBe(false);
  expect([accountBusy(75),accountBusy(1),accountBusy(0),accountBusy(null)]).toEqual([true,false,false,false]);
  // Through the bridge: an endpoint launched as `flock --wait 0 --conflict-exit-code 75 <lock> …` while the lock is held.
  const base=await mkdtemp(resolve(tmpdir(),'direct-key-busy-'));
  const deny=resolve(import.meta.dir,'network-deny.ts'),fixture=resolve(import.meta.dir,'tool-surface-fixture.ts'),entry=resolve(import.meta.dir,'../src/neutral-server.ts');
  const lock=resolve(base,'account.lock'),events=resolve(base,'events.txt');
  let holder:ReturnType<typeof Bun.spawn>|undefined,client:Client|undefined,transport:StdioClientTransport|undefined;
  try{
   await writeFile(events,'');await writeFile(lock,'');
   await writeFile(resolve(base,'endpoints.json'),JSON.stringify({dailyrecord:{command:'/usr/bin/flock',
    args:['--wait','0','--conflict-exit-code','75',lock,process.execPath,'--preload',deny,fixture,'dailyrecord',events]}}),{mode:0o600});
   await writeFile(resolve(base,'routing.json'),'{}',{mode:0o600});
   const env={PATH:process.env.PATH??'/usr/bin:/bin',ACADEMY_MCP_INSTALL_DIR:base};
   const discovery=Bun.spawn([process.execPath,'--preload',deny,entry,'--discover'],{env,stdout:'pipe',stderr:'pipe'});
   expect(await discovery.exited).toBe(0);
   // The holder keeps the lock until its standard input closes.
   holder=Bun.spawn(['/usr/bin/flock',lock,'/bin/sh','-c','read held'],{stdin:'pipe',stdout:'ignore',stderr:'ignore'});
   for(let i=0;i<200&&Bun.spawnSync(['/usr/bin/flock','--nonblock',lock,'true']).exitCode===0;i++)await Bun.sleep(10);
   expect(Bun.spawnSync(['/usr/bin/flock','--nonblock',lock,'true']).exitCode).toBe(1);
   client=new Client({name:'fictional-busy-client',version:'1.0.0'});
   transport=new StdioClientTransport({command:process.execPath,args:['--preload',deny,entry],env,stderr:'pipe'});
   await client.connect(transport);
   const result:any=await client.callTool({name:'academy_textbook_section_results_get',arguments:{displayName:STUDENT,...explicitKeys}});
   expect(result.isError).toBe(true);
   expect(result.structuredContent).toMatchObject({status:'blocked',code:'owner_account_busy',academyWrites:0});
   expect(await readFile(events,'utf8')).toBe('');
  }finally{
   await client?.close();await transport?.close();
   if(holder){(holder.stdin as {end():void}).end();await Promise.race([holder.exited,Bun.sleep(2000)]);holder.kill('SIGKILL');}
   await rm(base,{recursive:true,force:true});
  }
 },30000);

 test('direct_key_r11_login_page_fails_closed',async()=>{
  const pages:[string,WireAnswers][]=[
   ['a login page for the wrong-answer note',{getWrongAnswerNoteResult:loginPage}],
   ['a session-error page for the wrong-answer note',{getWrongAnswerNoteResult:'<script>location.href="/common/normal_session_error.jsp"</script>'}],
   ['a redirect to the login page for the report',{getCourseBookReport:new Response('',{status:302,headers:{location:'/c_login.jsp'}})}],
   ['a login page for the report',{getCourseBookReport:loginPage}],
   ['a session page for a section detail',{getStudyResultSingleTestingSingleUser:'<html>세션이 만료되었습니다</html>'}],
  ];
  for(const [name,answers] of pages){
   const w=wire(historicalAnswers(answers));
   const answer=await w.service.textbookSectionsByName({...request,...explicitKeys,...(answers.getStudyResultSingleTestingSingleUser?{sourceTitles:[TITLE]}:{})}) as any;
   expect({name,status:answer.status,reasonCode:answer.reasonCode,index:answer.index,records:answer.records})
    .toEqual({name,status:'unavailable',reasonCode:'authentication_required',index:undefined,records:undefined});
  }
 });

 test('direct_key_r12_no_value_in_errors',async()=>{
  const printed:string[]=[];
  const original={log:console.log,error:console.error,warn:console.warn,info:console.info,write:process.stderr.write.bind(process.stderr)};
  console.log=console.error=console.warn=console.info=(...args:unknown[])=>{printed.push(args.map(String).join(' '));};
  (process.stderr as any).write=(chunk:unknown,...rest:unknown[])=>{printed.push(String(chunk));return original.write(chunk as never,...rest as never[]);};
  const failures:unknown[]=[];
  try{
   for(const answers of [{getWrongAnswerNoteResult:note([noteRow({pri_no:770012})])},{getCourseBookReport:envelope(reportRaw({course_key:'560099'}))},
    {getWrongAnswerNoteResult:loginPage},{getCourseBookReport:'SERVER_RET = FAIL'}] as WireAnswers[]){
    const answer=await wire(historicalAnswers(answers)).service.textbookSectionsByName({...request,...explicitKeys}) as any;
    failures.push({reasonCode:answer.reasonCode,failure:answer.failure});
   }
   for(const reader of [memoryOf([{bookNo:BOOK,courseKey:COURSE,bookLabel:MEMORY_LABEL},{bookNo:BOOK,courseKey:'560099',bookLabel:MEMORY_LABEL}]),memoryOf([])]){
    const answer=await wire(historicalAnswers({getTextBookProgress:'<table></table>'}),reader).service.textbookSectionsByName({...request,bookLabel:MEMORY_LABEL}) as any;
    failures.push({reasonCode:answer.reasonCode,failure:answer.failure});
   }
  }finally{Object.assign(console,{log:original.log,error:original.error,warn:original.warn,info:original.info});(process.stderr as any).write=original.write;}
  const text=JSON.stringify(failures)+printed.join('\n');
  expect(failures.map((f:any)=>f.reasonCode)).toEqual(['historical_key_unverified','historical_key_unverified','authentication_required','historical_key_unverified','historical_binding_ambiguous','historical_binding_missing']);
  for(const value of [STUDENT,KEY,COURSE,BOOK,'770012','560099',MEMORY_LABEL,REPORT_TITLE,'Invented section'])expect({value,found:text.includes(value)}).toEqual({value,found:false});
 });

 test('direct_key_clinic_isolated',async()=>{
  // academy_clinic_paper_status_get never takes the fallback: an empty live list keeps its refusal, memory is not read.
  const reader=memoryOf([{bookNo:BOOK,courseKey:COURSE,bookLabel:MEMORY_LABEL}]);
  const empty=livePort([]);
  const service=new DailyRecordService(new NativeDailyRecordBackend(empty.port as never,admission,credential,null,null,null,null,reader));
  expect(await service.clinicPaperStatus({...request,bookLabel:MEMORY_LABEL})).toMatchObject({status:'unavailable',reasonCode:'textbook_binding_source_unqualified'});
  expect(await service.clinicPaperStatus(request)).toMatchObject({status:'unavailable',reasonCode:'textbook_binding_source_unqualified'});
  const live=livePort([liveBinding]);
  const clinic=await new DailyRecordService(new NativeDailyRecordBackend(live.port as never,admission,credential,null,null,null,null,reader)).clinicPaperStatus({...request,bookLabel:MEMORY_LABEL}) as any;
  expect(clinic).toMatchObject({status:'interview_required',bindings:[{bookLabel:'다빈치 3-2 Invented'}]});
  expect(clinic.bindingSource).toBeUndefined();
  expect(reader.calls).toBe(0);expect(empty.calls.concat(live.calls).filter(c=>c==='historical'||c==='report')).toEqual([]);
 });

 test('direct_key_course_book_projection',()=>{
  const raw=reportRaw({block5:Array.from({length:10},(_,i)=>({'1':i+1,'2':'Invented test '+i,'3':10,'4':70,'5':80,'6':'03-01'})),
   block12:Array.from({length:12},(_,i)=>({'2':'Invented unit '+i,'3':3,'4':i?4:0,'5':70})),block11:[{'2':71}]});
  const report=projectCourseBookReport(readCourseBookReportEnvelope(envelope(raw)),{studentName:STUDENT,studentKey:KEY,courseKey:COURSE,bookNo:BOOK});
  expect(Object.keys(report.studyqInput).sort()).toEqual(['all_average','bunit_list','comment','difficulty','grade','munit_list','my_average','period','score_range','student','test_list']);
  expect(report.metadata).toEqual({bookTitle:REPORT_TITLE});
  expect(JSON.stringify(report.studyqInput)).not.toContain(REPORT_TITLE);
  expect(report.studyqInput).toMatchObject({period:'2040-01-01 ~ 2040-03-01',student:STUDENT,grade:5,my_average:82.5,all_average:75,comment:'Invented comment',
   score_range:{my:82.5,average:75},difficulty:{top:{questions:1,score:90},high:{questions:2,score:80},mid:{questions:3,score:70},low:{questions:4,score:60}}});
  expect(report.studyqInput.test_list).toHaveLength(8);
  expect(report.studyqInput.bunit_list[0]).toEqual({name:'Invented chapter',my_score:80,average:70,questions:[
   {no:1,type:'Invented type',question_type:'객관식',difficulty:'중',correct_rate:66,correct:true},
   {no:2,type:'Other type',question_type:'서술형',difficulty:'최상',correct_rate:40,correct:false}]});
  expect(report.studyqInput.munit_list).toHaveLength(11);
  expect(report.studyqInput.munit_list[0]).toEqual({name:'Invented unit 0',correct:3,total:1,average:71});
  expect(report.studyqInput.munit_list[1]).toEqual({name:'Invented unit 1',correct:3,total:4,average:70});
  expect(report.truncation).toEqual({testsDropped:2,chaptersDropped:0,questionsDropped:0,munitsDropped:1});
  // An empty type is kept empty: the renderer refuses it, no label is invented.
  const blank=projectCourseBookReport(reportRaw({bunit_list:[{'1':'c','3':1,'4':1,exam_result:[{'1':1,'3':1,'4':9,'5':1,'6':'X'}]}]}),{studentName:STUDENT,studentKey:KEY,courseKey:COURSE,bookNo:BOOK});
  expect(blank.studyqInput.bunit_list[0]!.questions[0]).toMatchObject({type:'',question_type:'9'});
  expect(()=>readCourseBookReportEnvelope(loginPage)).toThrow('authentication_required');
  expect(()=>readCourseBookReportEnvelope('SERVER_RET = OK<BR>not json<END_DATA>')).toThrow('historical_key_unverified');
 });
});

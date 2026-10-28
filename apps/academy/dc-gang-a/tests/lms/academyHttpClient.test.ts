import {expect,test} from 'bun:test';

const principal='<a href="/logout">Invented Teacher- [로그아웃]</a><form name="userForm"><input name="pri_no" value="99001"></form><form name="form1"><input name="g_pri_no" value="99001"><input name="g_clg_no" value="88001"><input name="g_mem_type" value="teacher"></form>';
const login='<form id="loginForm" name="loginForm" method="post"><input name="p_process"><input name="p_prino"><input name="p_groupno"><input name="userpwd"><input name="userid"><input name="cf_pc"><input name="cf_user"><input name="autoLoginCheck"><input name="autoLoginKey"></form><script>document.loginForm.action = "/servlet/controller.login.LoginServlet"; document.loginForm.p_process.value = "c_login";</script>';
// Construct explicitly invented cookie pairs at runtime; no captured session literal is stored.
const anonymousCookie=['JSESSIONID','synthetic-anonymous'].join('=');
const authenticatedCookie=['JSESSIONID','synthetic-authenticated'].join('=');
test('name-only source search authenticates and returns distinct exact identities without neighboring records',async()=>{
 const {AcademyHttpClient}=await import('../../src/lms/academyHttpClient');let calls=0;
 const rows=[{priNo:9101,userName:'Invented Student',title:'private title'},
  {priNo:9101,userName:'Invented Student'}, {priNo:9102,userName:'Invented Student'},
  {priNo:9103,userName:'Other Student',title:'withheld'}];
 const html="<script>const x={testResultList:JSON.parse('"+JSON.stringify(rows)+"')};</script>";
 const client=new AcademyHttpClient({teacherLabel:'Invented Teacher',teacherKey:'99001',collegeKey:'88001'},async(url,init)=>{
  calls++;if(calls<=3)return new Response(calls===1?login:principal);
  expect(url).toContain('DailyZeroTestServlet?reqCmd=DtResultSearch');
  expect(Object.fromEntries(new URLSearchParams(init.body as string))).toEqual({sort_date:'1',stu_name:'Invented Student'});
  return new Response(html);
 });
 const input={teacherLabel:'Invented Teacher',studentName:'Invented Student'};
 await expect(client.searchStudentsByName(input)).rejects.toThrow('authentication_required');expect(calls).toBe(0);
 await client.authenticate({username:'inventedUser',password:'inventedPassword'});
 const result=await client.searchStudentsByName(input);
 expect(result).toEqual([{studentKey:'9101',studentName:'Invented Student'},{studentKey:'9102',studentName:'Invented Student'}]);
 expect(JSON.stringify(result)).not.toContain('private title');expect(JSON.stringify(result)).not.toContain('Other Student');
 await expect(client.searchStudentsByName({...input,teacherLabel:'Other Teacher'})).rejects.toThrow('daily_search_principal_conflict');
 expect(calls).toBe(4);client.close();
});
test('name-only source projection holds malformed and ambiguous pages without inferring absence',async()=>{
 const {inspectStudentNameSearch}=await import('../../src/lms/assessmentReadProtocol');
 expect(inspectStudentNameSearch("<script>x={testResultList:JSON.parse('[]')}</script>",'Invented Student')).toEqual([]);
 expect(()=>inspectStudentNameSearch('<input type="password">','Invented Student')).toThrow('student_search_source_rejected');
 expect(()=>inspectStudentNameSearch('<script>x={}</script>','Invented Student')).toThrow('result_list_missing_or_ambiguous');
 const bad="<script>x={testResultList:JSON.parse('[{\"priNo\":\"bad\",\"userName\":\"Invented Student\"}]')}</script>";
 expect(()=>inspectStudentNameSearch(bad,'Invented Student')).toThrow();
});
test('source item-answer read requests only the exact selected label and preserves the official literal',async()=>{
 const {AcademyHttpClient}=await import('../../src/lms/academyHttpClient');let calls=0;
 const client=new AcademyHttpClient({teacherLabel:'Invented Teacher',teacherKey:'99001',collegeKey:'88001'},async(url,init)=>{
  calls++;if(calls<=3)return new Response(calls===1?login:principal);
  const parsed=new URL(url);expect(parsed.pathname).toBe('/servlet/controller.common.TestPageShowExServlet');
  expect(parsed.searchParams.get('p_process')).toBe('GetLectureList');expect(parsed.searchParams.get('lecture_list')).toBe('12345');
  expect(init.method).toBe('GET');
  return new Response(JSON.stringify({result:'OK',rows:[{id:12345,lecture_key:12345,outer_lecture_key:200,
    unit_name:'Invented unit',pat_name:'Invented pattern',play_seconds:90,difficulty:2,answer:'1|_|invented answer'}]}));
 });
 await client.authenticate({username:'inventedUser',password:'inventedPassword'});
 const result=await client.execute({family:'item_answer',teacherLabel:'Invented Teacher',teacherKey:'99001',lectureKeys:['12345'],answerReadAdmission:true});
 expect(result).toMatchObject({status:'observed',itemAnswers:[{identity:{lectureKey:'12345'},answerLiteral:'1|_|invented answer',rendering:'not_qualified'}],nativePrintInvoked:false});
 expect(calls).toBe(4);client.close();
});
test('inventory discovers exact-student attempts and period contracts without assigning completion or expected missing papers',async()=>{
 const {AcademyHttpClient}=await import('../../src/lms/academyHttpClient');let calls=0;
 const rows=[{pNo:7101,score:0,testingNo:8101,priNo:9101,userName:'Invented Student',testName:'Invented basic test',applyDate:'2099-01-01'},{pNo:7102,score:100,testingNo:8102,priNo:9102,userName:'Other Student',testName:'Excluded neighboring test'}];
 const html='<input name="sort_date" value="1"><input name="unrelated_secret" value="omitted"><script>const EXTERN_DIALOG={testResultList:JSON.parse('+JSON.stringify(JSON.stringify(rows)).replace(/^"|"$/g,"'")+')};function onSearchResult(){return "inert";}</script>';
 const client=new AcademyHttpClient({teacherLabel:'Invented Teacher',teacherKey:'99001',collegeKey:'88001'},async()=>new Response(++calls===1?login:calls<=3?principal:html));
 try{
  await client.authenticate({username:'inventedUser',password:'inventedPassword'});
  const result=await client.inspectDailyTestInventory({teacherLabel:'Invented Teacher',studentName:'Invented Student',studentKey:'9101'});
  expect(result.rows).toHaveLength(1);expect(result.rows[0]!.sourceScore).toBe(0);
  expect(result.expectedPaperDefinitions).toBe('not_observed');expect(result.sourcePeriod).toBeNull();
  expect(result.filterContracts.functions.onSearchResult).toContain('inert');
  expect(JSON.stringify(result)).not.toContain('Other Student');expect(JSON.stringify(result)).not.toContain('unrelated_secret');
  expect(calls).toBe(4);
 }finally{client.close();}
});
test('history accepts only current UI month selectors and stops before an unqualified selector request',async()=>{
 const {AcademyHttpClient}=await import('../../src/lms/academyHttpClient');let calls=0;
 const html='<select name="sort_date"><option value="1">Recent week</option><option value="11">Recent month</option><option value="12">Previous month</option></select><script>const EXTERN_DIALOG={testResultList:JSON.parse(\'[]\')};</script>';
 const seen:string[]=[];
 const client=new AcademyHttpClient({teacherLabel:'Invented Teacher',teacherKey:'99001',collegeKey:'88001'},async(_url,init)=>{calls++;if(calls>3)seen.push(new URLSearchParams(init.body as string).get('sort_date')!);return new Response(calls===1?login:calls<=3?principal:html);});
 const target={teacherLabel:'Invented Teacher',studentName:'Invented Student',studentKey:'9101'};
 await expect(client.readDailyTestHistory({...target,periods:['99']})).rejects.toThrow('daily_history_period_rejected');expect(calls).toBe(0);
 try{
  await client.authenticate({username:'inventedUser',password:'inventedPassword'});
  const result=await client.readDailyTestHistory({...target,periods:['11','12']});expect(seen).toEqual(['1','11','12']);
  expect(result.observations.map(o=>o.label)).toEqual(['Recent month','Previous month']);
  expect(result.expectedPaperDefinitions).toBe('not_observed');
  await expect(client.readDailyTestHistory({...target,periods:['13']})).rejects.toThrow('daily_history_selector_drift');expect(seen.at(-1)).toBe('1');
 }finally{client.close();}
});
test('a source login challenge closes the ephemeral client instead of becoming an ordinary area miss',async()=>{
 const {AcademyHttpClient}=await import('../../src/lms/academyHttpClient');let calls=0;
 const client=new AcademyHttpClient({teacherLabel:'Invented Teacher',teacherKey:'99001',collegeKey:'88001'},async()=>new Response(++calls===1?login:calls<=3?principal:'<form name="loginForm"><input type="password"></form>'));
 const request={family:'daily_zero',teacherLabel:'Invented Teacher',targets:[{studentKey:'9101',studentName:'Invented Student',attemptKey:'8101'}],gradeViewAdmission:true};
 await client.authenticate({username:'inventedUser',password:'inventedPassword'});
 await expect(client.execute(request)).rejects.toThrow('authentication_required');expect(client.authenticated).toBe(false);
 const stopped=calls;await expect(client.execute(request)).rejects.toThrow('authentication_required');expect(calls).toBe(stopped);
});
test('direct DT/ZT results retain direct transport rather than fabricating historical browser provenance',async()=>{
 const {AcademyHttpClient}=await import('../../src/lms/academyHttpClient');let calls=0;
 const search=`<script>EXTERN_DIALOG={testResultList:JSON.parse('[{"pNo":7101,"score":50,"testingNo":8101,"priNo":9101,"userName":"Invented Student"}]')}</script>`;
 const detail={result:'OK',print_list:[{pri_no:9101,student_name:'Invented Student',score:50,exam_list:[{exam_no:1,scoring_result:'O'},{exam_no:2,scoring_result:'X'}]}]};
 const client=new AcademyHttpClient({teacherLabel:'Invented Teacher',teacherKey:'99001',collegeKey:'88001'},async()=>new Response(++calls===1?login:calls<=3?principal:calls===4?search:JSON.stringify(detail)));
 try{
  await client.authenticate({username:'inventedUser',password:'inventedPassword'});
  const result=await client.execute({family:'daily_zero',teacherLabel:'Invented Teacher',targets:[{studentKey:'9101',studentName:'Invented Student',attemptKey:'8101'}],gradeViewAdmission:true});
  expect(result.dailyResults[0]).toMatchObject({status:'observed',authenticationMode:'direct_http_api'});
 }finally{client.close();}
});
test('fixed-origin fresh HTTP login independently qualifies principal and keeps secrets in request memory',async()=>{
  const module=await import('../../src/lms/academyHttpClient').catch(()=>({AcademyHttpClient:undefined}));
  expect(typeof module.AcademyHttpClient).toBe('function');
  const calls:{url:string;init:RequestInit}[]=[];
  const transport=async(url:string,init:RequestInit)=>{
    calls.push({url,init});
    expect(init.redirect).toBe('manual');
    if(calls.length===1)return new Response(login,{headers:{'Set-Cookie':anonymousCookie+'; Path=/; Secure; HttpOnly'}});
    if(calls.length===2){
      const body=new URLSearchParams(init.body as string);
      expect(body.get('p_process')).toBe('c_login');expect(body.get('autoLoginCheck')).toBe('');expect(body.get('autoLoginKey')).toBe('');
      expect(Buffer.from(body.get('userid')!,'base64').toString('utf8').slice(0,-32)).toBe('inventedUser');
      expect(Buffer.from(body.get('userpwd')!,'base64').toString('utf8').slice(0,-32)).toBe('inventedPassword');
      expect(new Headers(init.headers).get('cookie')).toBe(anonymousCookie);
      return new Response('',{status:302,headers:{Location:'/teacher','Set-Cookie':authenticatedCookie+'; Path=/; Secure; HttpOnly'}});
    }
    if(calls.length===3)return new Response('<a href="/logout">Invented Teacher- [로그아웃]</a>');
    expect(new Headers(init.headers).get('cookie')).toBe(authenticatedCookie);return new Response(principal);
  };
  const client=new module.AcademyHttpClient!({teacherLabel:'Invented Teacher',teacherKey:'99001',collegeKey:'88001'},transport);
  const result=await client.authenticate({username:'inventedUser',password:'inventedPassword'});
  expect(result).toEqual({state:'authenticated',principalKey:'99001',collegeKey:'88001',transport:'direct_http_api'});
  expect(JSON.stringify(client)).not.toContain('synthetic-authenticated');expect(JSON.stringify(client)).not.toContain('inventedPassword');
  client.close();expect(client.authenticated).toBe(false);
});
test('inert HTTP DOM reader works without a global browser DOM',async()=>{
  const {AcademyHttpClient}=await import('../../src/lms/academyHttpClient');
  let count=0;
  const client=new AcademyHttpClient({teacherLabel:'Invented Teacher',teacherKey:'99001',collegeKey:'88001'},async()=>new Response(++count===1?login:principal));
  await client.authenticate({username:'inventedUser',password:'inventedPassword'});
  const result=await client.execute({family:'student_course',teacherLabel:'Invented Teacher',studentKey:'77001',studentName:'Invented Learner'});
  expect(result.status).toBe('observed');expect(result.studentCourses).toEqual([]);expect(typeof DOMParser).toBe('undefined');client.close();
});
test('failure metadata distinguishes password challenge from principal drift without disclosing source or secrets',async()=>{
  const {AcademyHttpClient}=await import('../../src/lms/academyHttpClient');
  let count=0;
  const client=new AcademyHttpClient({teacherLabel:'Invented Teacher',teacherKey:'99001',collegeKey:'88001'},async()=>new Response(++count===1?login:'<input type="password"><form name="loginForm"></form>'));
  await expect(client.authenticate({username:'inventedUser',password:'inventedPassword'})).rejects.toThrow('source_login_challenge');
  expect(client.authenticated).toBe(false);
});
test('logout display whitespace does not alter independently matched opaque principal keys',async()=>{
  const {AcademyHttpClient}=await import('../../src/lms/academyHttpClient');let count=0;
  const client=new AcademyHttpClient({teacherLabel:'Invented Teacher',teacherKey:'99001',collegeKey:'88001'},async()=>new Response(++count===1?login:principal.replace('Teacher- [로그아웃]','Teacher \n - [로그아웃]')));
  expect((await client.authenticate({username:'inventedUser',password:'inventedPassword'})).state).toBe('authenticated');client.close();
});
test('StudyCourse account-menu logout and two exact principal forms qualify without a name dropdown',async()=>{
  const {AcademyHttpClient}=await import('../../src/lms/academyHttpClient');let count=0;
  const client=new AcademyHttpClient({teacherLabel:'Invented Teacher',teacherKey:'99001',collegeKey:'88001'},async()=>new Response(++count===1?login:principal.replace('Invented Teacher- [로그아웃]','내정보- [로그아웃]')));
  expect((await client.authenticate({username:'inventedUser',password:'inventedPassword'})).state).toBe('authenticated');client.close();
});
test('current span logout control qualifies only alongside both exact principal forms',async()=>{
  const {AcademyHttpClient}=await import('../../src/lms/academyHttpClient');let count=0;
  const span=principal.replace('<a href="/logout">Invented Teacher- [로그아웃]</a>','<span>내정보- [로그아웃]</span>');
  const client=new AcademyHttpClient({teacherLabel:'Invented Teacher',teacherKey:'99001',collegeKey:'88001'},async()=>new Response(++count===1?login:span));
  expect((await client.authenticate({username:'inventedUser',password:'inventedPassword'})).state).toBe('authenticated');client.close();
});
test('field-wire inspection fetches only validated DayRecord Main and never invokes handlers',async()=>{
  const {AcademyHttpClient}=await import('../../src/lms/academyHttpClient');let count=0;
  const client=new AcademyHttpClient({teacherLabel:'Invented Teacher',teacherKey:'99001',collegeKey:'88001'},async()=>new Response(++count===1?login:principal));
  await client.authenticate({username:'inventedUser',password:'inventedPassword'});
  const inspection=await client.inspectDayRecordWire({family:'day_record',teacherLabel:'Invented Teacher',date:'2099-01-01',groupIds:['3'],studentNames:['Invented Learner']});
  expect(inspection.length).toBe(1);expect(inspection[0]!.sourceHandlersInvoked).toBe(false);client.close();
});
test('direct book discovery refuses foreign teacher scope without a source request',async()=>{
  const {AcademyHttpClient}=await import('../../src/lms/academyHttpClient');let calls=0;
  const client=new AcademyHttpClient({teacherLabel:'Invented Teacher',teacherKey:'99001',collegeKey:'88001'},async()=>{calls++;return new Response(login);});
  await expect(client.discoverBooks({teacherLabel:'Other Teacher',teacherKey:'99001',collegeKey:'88001',studentNames:['Invented Learner']})).rejects.toThrow('source_principal_drift');
  expect(calls).toBe(0);
});
test('journal admission does not authorize unauthenticated HTTP or foreign teacher targets',async()=>{
  const {AcademyHttpClient}=await import('../../src/lms/academyHttpClient');let calls=0;
  const client=new AcademyHttpClient({teacherLabel:'Invented Teacher',teacherKey:'99001',collegeKey:'88001'},async()=>{calls++;return new Response(login);});
  expect(typeof client.journalState).toBe('function');
  const target={studentName:'Invented Learner',date:'2099-01-05',groupId:'3',teacherKey:'99001',studentKey:'77001',courseKey:'5',recordKey:'13',membershipKey:'88001'};
  await expect(client.journalState(target)).rejects.toThrow('authentication_required');
  await expect(client.journalState({...target,teacherKey:'99002'})).rejects.toThrow('journal_principal_conflict');expect(calls).toBe(0);
});
test('item-header qualification exposes field names, not answers or generated paper membership',async()=>{
  const {AcademyHttpClient}=await import('../../src/lms/academyHttpClient');let count=0;
  const item={result:'OK',rows:[{lecture_key:77001,id:77001,outer_lecture_key:87001,unit_name:'Invented unit',pat_name:'Invented pattern',play_seconds:10,difficulty:1,answer:'withheld invented answer',pat_no:23001}]};
  const client=new AcademyHttpClient({teacherLabel:'Invented Teacher',teacherKey:'99001',collegeKey:'88001'},async()=>new Response(++count===1?login:count<=3?principal:JSON.stringify(item)));
  expect(typeof client.inspectItemHeader).toBe('function');await client.authenticate({username:'inventedUser',password:'inventedPassword'});
  const result=await client.inspectItemHeader({family:'item_metadata',teacherLabel:'Invented Teacher',lectureKey:'77001'});
  expect(result.fieldNames).toContain('pat_no');expect(JSON.stringify(result)).not.toContain('withheld invented answer');expect(result.generatedPaperMembership).toBe('unqualified');client.close();
});
test('student-paper source qualification inspects only canonical read form metadata, never retains branch rows',async()=>{
  const {AcademyHttpClient}=await import('../../src/lms/academyHttpClient');let count=0;
  const html='<form name="form1" action="/servlet/controller.tutor.base.TestPageListServlet"><input name="p_process" value="UserByMain"><input name="p_user_name"><input name="p_pri_no"></form><script>function onSearchUser(){document.form1.p_process.value="UserByMain";document.form1.submit();}</script><table><tr><td>Unrequested invented learner</td></tr></table>';
  const client=new AcademyHttpClient({teacherLabel:'Invented Teacher',teacherKey:'99001',collegeKey:'88001'},async(url)=>{count++;if(count===4)expect(url).toBe('https://dc.gang-a.kr/servlet/controller.tutor.base.TestPageListServlet?p_process=UserByMain&ass_no=1001');return new Response(count===1?login:count<=3?principal:html);});
  expect(typeof client.inspectStudentPaperForm).toBe('function');await client.authenticate({username:'inventedUser',password:'inventedPassword'});
  const result=await client.inspectStudentPaperForm({teacherLabel:'Invented Teacher',studentName:'Invented Learner',studentKey:'77001'});
  expect(result.forms[0]!.fields).toContain('p_pri_no');expect(JSON.stringify(result)).not.toContain('Unrequested invented learner');expect(result.studentRowsRetained).toBe(0);expect(result.filteredStudentReadQualified).toBe(false);client.close();
});
test('student result metadata matches exact subject namespace and preserves titles without another student',async()=>{
  const module=await import('../../src/lms/assessmentReadProtocol');expect(typeof module.inspectAssessmentSearchMetadata).toBe('function');
  const rows=[{priNo:77001,testingNo:81001,pNo:82001,userName:'Invented Learner',score:80,testpageName:'Invented Gauss Plus original'},{priNo:77002,testingNo:81002,pNo:82002,userName:'Foreign Learner',score:90,testpageName:'Withheld foreign paper'}];
  const html="<script>const x={testResultList:JSON.parse('"+JSON.stringify(rows)+"')};</script>";
  const result=module.inspectAssessmentSearchMetadata(html,{studentKey:'77001',studentName:'Invented Learner'});
  expect(result.rows.length).toBe(1);expect(JSON.stringify(result)).toContain('Invented Gauss Plus original');expect(JSON.stringify(result)).not.toContain('Withheld foreign paper');expect(result.generatedMembership).toBe('unqualified');
});
test('one-page student paper search requires authentication before any request',async()=>{
 const {AcademyHttpClient}=await import('../../src/lms/academyHttpClient');let calls=0;
 const client=new AcademyHttpClient({teacherLabel:'Invented Teacher',teacherKey:'99001',collegeKey:'88001'},async()=>{calls++;return new Response('');});
 expect(typeof client.searchStudentPaperMetadata).toBe('function');await expect(client.searchStudentPaperMetadata({teacherLabel:'Invented Teacher',studentName:'Invented Learner',studentKey:'77001'})).rejects.toThrow('authentication_required');expect(calls).toBe(0);
});
test('an explicit older paper-search period is qualified without replacing its literal dates',async()=>{
 const {qualifyStudentPaperSearchPeriod}=await import('../../src/lms/studentPaperSearchPeriod');
 expect(qualifyStudentPaperSearchPeriod({from:'2098-09-01',through:'2099-01-05'})).toEqual({from:'2098-09-01',through:'2099-01-05'});
 expect(()=>qualifyStudentPaperSearchPeriod({from:'2099-02-29',through:'2099-03-01'})).toThrow();
 expect(()=>qualifyStudentPaperSearchPeriod({from:'2099-01-06',through:'2099-01-05'})).toThrow('student_paper_period_reversed');
 expect(()=>qualifyStudentPaperSearchPeriod({from:'2099-01-01',through:'2099-01-05',studentKey:'77002'})).toThrow();
});
test('invalid explicit paper periods and foreign teacher scope never issue a source request',async()=>{
 const {AcademyHttpClient}=await import('../../src/lms/academyHttpClient');let calls=0;
 const client=new AcademyHttpClient({teacherLabel:'Invented Teacher',teacherKey:'99001',collegeKey:'88001'},async()=>{calls++;return new Response('');});
 const target={teacherLabel:'Invented Teacher',studentName:'Invented Learner',studentKey:'77001'};
 await expect(client.searchStudentPaperMetadata({...target,period:{from:'2099-01-06',through:'2099-01-05'}})).rejects.toThrow('student_paper_period_reversed');
 await expect(client.searchStudentPaperMetadata({...target,teacherLabel:'Foreign Teacher',period:{from:'2099-01-01',through:'2099-01-05'}})).rejects.toThrow('student_paper_principal_conflict');
 await expect(client.searchStudentPaperMetadata({...target,period:{from:'2098-09-01',through:'2099-01-05'}})).rejects.toThrow('authentication_required');
 expect(calls).toBe(0);
});
test('stubbed student-search lookup plumbing joins the exact paper and retains one-page coverage',async()=>{
 const {AcademyHttpClient}=await import('../../src/lms/academyHttpClient');
 const {encodePaperCode}=await import('../../src/lms/printedPaperCode');let searches=0;
 const client=new AcademyHttpClient({teacherLabel:'Invented Teacher',teacherKey:'99001',collegeKey:'88001'});
 client.searchStudentPaperMetadata=async input=>{
  searches++;expect(input.period).toEqual({from:'2098-09-01',through:'2099-01-05'});
  return {rows:[{paperKey:'82001',attemptKey:'81001'},{paperKey:'82002',attemptKey:'81002'}],sourcePeriod:{from:input.period!.from,to:input.period!.through},page:1,observedAt:'2099-01-05T00:00:00.000Z',coverage:'one_observed_student_search_page_not_complete_history'} as any;
 };
 const input={teacherLabel:'Invented Teacher',studentName:'Invented Learner',studentKey:'77001',paperCode:encodePaperCode('82001'),period:{from:'2098-09-01',through:'2099-01-05'}};
 let dailySearches=0;client.searchDailyTestMetadata=async()=>{dailySearches++;return {rows:[],operation:'DtResultSearch',page:1,observedAt:'2099-01-05T00:00:00.000Z',coverage:'one_observed_student_search_page_not_complete_history',sourcePeriod:null,fixedSourceFilter:{sort_date:'1'}} as any;};
 const result=await client.lookupPrintedPaperMetadata(input);
 expect(result.rows.map(row=>row.paperKey)).toEqual(['82001']);expect(result.coverage).toBe('observed_source_pages_not_complete_history');expect(result.generatedMembership).toBe('unqualified');expect(dailySearches).toBe(0);
 await expect(client.lookupPrintedPaperMetadata({...input,paperCode:'#INVALID'})).rejects.toThrow('invalid_printed_paper_code');expect(searches).toBe(1);
 const missing=await client.lookupPrintedPaperMetadata({...input,paperCode:encodePaperCode('82003')});expect(missing.status).toBe('not_found_in_scope');expect(missing.rows).toEqual([]);expect(dailySearches).toBe(1);expect(missing.searchedSources[1]?.requestedPeriodApplied).toBe(false);
});
test('DT metadata fallback with stubbed student search identifies a paper without claiming its semantic kind',async()=>{
 const {AcademyHttpClient}=await import('../../src/lms/academyHttpClient');const {encodePaperCode}=await import('../../src/lms/printedPaperCode');let calls=0;
 const rows=[{priNo:77001,userName:'Invented Learner',pNo:82003,testingNo:81003,score:75,testpageName:'Invented chapter comprehensive assessment'},{priNo:77002,userName:'Foreign Learner',pNo:82003,testingNo:81004,score:100,testpageName:'Withheld foreign title'}];
 const html="<script>const results={testResultList:JSON.parse('"+JSON.stringify(rows)+"')};</script>";
 const client=new AcademyHttpClient({teacherLabel:'Invented Teacher',teacherKey:'99001',collegeKey:'88001'},async(url,init)=>{
  calls++;if(calls===1)return new Response(login);if(calls<=3)return new Response(principal);
  expect(url).toContain('DailyZeroTestServlet?reqCmd=DtResultSearch');expect(Object.fromEntries(new URLSearchParams(init.body as string))).toEqual({sort_date:'1',stu_name:'Invented Learner'});return new Response(html);
 });
 await client.authenticate({username:'inventedUser',password:'inventedPassword'});
 client.searchStudentPaperMetadata=async()=>({rows:[],operation:'UserBySearchTestResult',page:1,sourcePeriod:{from:'2098-09-01',to:'2099-01-05'},observedAt:'2099-01-05T00:00:00.000Z',coverage:'one_observed_student_search_page_not_complete_history'} as any);
 const result=await client.lookupPrintedPaperMetadata({teacherLabel:'Invented Teacher',studentName:'Invented Learner',studentKey:'77001',paperCode:encodePaperCode('82003'),period:{from:'2098-09-01',through:'2099-01-05'}});
 expect(result.status).toBe('observed');expect(result.matchedSourceFamily).toBe('daily_zero');expect(result.rows.length).toBe(1);expect(result.rows[0]!.titles.testpageName).toBe('Invented chapter comprehensive assessment');expect(JSON.stringify(result)).not.toContain('Withheld foreign title');expect(result).not.toHaveProperty('assessmentKind');client.close();
});

test('textbook index exposes existing subject-bound headers without generation or answer content',async()=>{
 const {AcademyHttpClient}=await import('../../src/lms/academyHttpClient');let count=0;
 const progress='<button onclick="createBookIncorrectPapers(5,6,77001)">Existing book</button>';
 const notes={result:'ok',noteResultList:[{pri_no:77001,name:'Invented Learner',p_no:81001,testing_no:82001,testing_name:'Invented existing section',apply_date:'10-01',answer:'withheld answer'}]};
 const client=new AcademyHttpClient({teacherLabel:'Invented Teacher',teacherKey:'99001',collegeKey:'88001'},async(url,init)=>{
  count++;if(count<=3)return new Response(count===1?login:principal);
  const body=new URLSearchParams(init.body as string);
  if(count===4){expect(url).toContain('reqCmd=getTextBookProgress');expect(body.get('student_name')).toBe('Invented Learner');return new Response(progress);}
  expect(count).toBe(5);expect(body.get('p_process')).toBe('getWrongAnswerNoteResult');
  expect(JSON.parse(body.get('answerNoteResult')!)).toEqual({courseKeyList:['5'],bookNoList:['6'],userKeyList:['77001']});return new Response(JSON.stringify(notes));
 });
 const method=(client as unknown as {inspectTextbookIndex?: (input:unknown)=>Promise<unknown>}).inspectTextbookIndex;
 expect(typeof method).toBe('function');await client.authenticate({username:'inventedUser',password:'inventedPassword'});
 const result=await method!.call(client,{family:'textbook',teacherLabel:'Invented Teacher',studentKey:'77001',studentName:'Invented Learner',courseKey:'5',bookNo:'6',sourceTitles:['Invented existing section'],gradeViewAdmission:true});
 expect(result).toMatchObject({rows:[{sourceTitle:'Invented existing section',paperKey:'81001',attemptKey:'82001'}],sourceHandlersInvoked:false,generatedPaperMembership:'unqualified'});
 expect(JSON.stringify(result)).not.toContain('withheld answer');expect(count).toBe(5);client.close();
});
test('HTTP failure exposes only safe status and operation metadata, not source content or credentials',async()=>{
 const {AcademyHttpClient}=await import('../../src/lms/academyHttpClient');
 const client=new AcademyHttpClient({teacherLabel:'Invented Teacher',teacherKey:'99001',collegeKey:'88001'},async()=>new Response('withheld source body',{status:503}));
 let failure:unknown;try{await client.authenticate({username:'inventedUser',password:'inventedPassword'});}catch(error){failure=error;}
 expect(failure).toBeInstanceOf(Error);expect((failure as Error).message).toBe('source_http_failed');
 expect((failure as {httpStatus:number}).httpStatus).toBe(503);expect((failure as {sourceOperation:string}).sourceOperation).toBe('login_document');
 expect(JSON.stringify(failure)).not.toContain('withheld source body');expect(JSON.stringify(failure)).not.toContain('inventedPassword');
});
test('textbook index refuses foreign teacher and unauthenticated access before source requests',async()=>{
 const {AcademyHttpClient}=await import('../../src/lms/academyHttpClient');let calls=0;
 const client=new AcademyHttpClient({teacherLabel:'Invented Teacher',teacherKey:'99001',collegeKey:'88001'},async()=>{calls++;return new Response('');});
 const request={family:'textbook',teacherLabel:'Invented Teacher',studentKey:'77001',studentName:'Invented Learner',courseKey:'5',bookNo:'6',sourceTitles:['Invented existing section'],gradeViewAdmission:true};
 await expect(client.inspectTextbookIndex({...request,teacherLabel:'Other Teacher'})).rejects.toThrow('textbook_index_scope_required');
 await expect(client.inspectTextbookIndex(request)).rejects.toThrow('authentication_required');expect(calls).toBe(0);
});
test('textbook index refuses a foreign subject returned by the scoped wrong-note query',async()=>{
 const {AcademyHttpClient}=await import('../../src/lms/academyHttpClient');let count=0;
 const progress='<button onclick="createBookIncorrectPapers(5,6,77001)">Existing book</button>';
 const notes={result:'ok',noteResultList:[{pri_no:77002,name:'Foreign Learner',p_no:81001,testing_no:82001,testing_name:'Foreign section'}]};
 const client=new AcademyHttpClient({teacherLabel:'Invented Teacher',teacherKey:'99001',collegeKey:'88001'},async()=>new Response(++count===1?login:count<=3?principal:count===4?progress:JSON.stringify(notes)));
 await client.authenticate({username:'inventedUser',password:'inventedPassword'});
 await expect(client.inspectTextbookIndex({family:'textbook',teacherLabel:'Invented Teacher',studentKey:'77001',studentName:'Invented Learner',courseKey:'5',bookNo:'6',sourceTitles:['Invented existing section'],gradeViewAdmission:true})).rejects.toThrow('source_subject_conflict');client.close();
});

import {expect,test} from 'bun:test';
import {AcademyHttpClient,AcademyHttpFailure,sourceDomParser,type SourceTransport} from '../../src/lms/academyHttpClient';
import {qualifyNativePaperInputReference,qualifyNativePaperOptionsTemplate,inspectNativePaperOptionsResponse,NATIVE_PAPER_INPUT_PATH,NATIVE_PAPER_OPTIONS_PATH,qualifyNativePaperSelectedQuestionsTemplate,inspectNativePaperSelectedQuestionsResponse,nativePaperSelectedQuestionQuery,NATIVE_PAPER_SELECTED_FIELDS,NATIVE_PAPER_SELECTED_PATH} from '../../src/lms/nativePaperReadProtocol';
import {digest} from '../../src/learning/model';
import {createHash} from 'node:crypto';
const rawSha=(text:string)=>createHash('sha256').update(text,'utf8').digest('hex');

// Fictional principal, documents and options only. No native account or official source is contacted.
const principal={teacherLabel:'Fictional Teacher',teacherKey:'99001',collegeKey:'88001'};
const login='<form id="loginForm" name="loginForm" method="post">'+['p_process','p_prino','p_groupno','userpwd','userid','cf_pc','cf_user','autoLoginCheck','autoLoginKey'].map(name=>'<input name="'+name+'">').join('')+'</form><script>document.loginForm.action = "/servlet/controller.login.LoginServlet"; document.loginForm.p_process.value = "c_login";</script>';
const identity='<span>로그아웃</span><form name="userForm"><input name="pri_no" value="99001"></form><form name="form1"><input name="g_pri_no" value="99001"><input name="g_clg_no" value="88001"><input name="g_mem_type" value="teacher"></form>';
const loader=`var loadPaperOptions = function() {
 var param={p_process:"getTestOption",stage_id:"",ass_type:""};
 $.ajax({type:"GET",url:"/servlet/controller.common.TestpageSelectExServlet",data:param,
 success:function(data){if(data.result=="ok"){paperOptions=data;}else{alert(data.message);}},
 error:function(xhr,status,error){alert(error);}});
};`;
const tab='<script>var inputPath="'+NATIVE_PAPER_INPUT_PATH+'";'+loader+'globalThis.nativePaperScriptExecuted=true;fetch("https://fictional.invalid/never");</script>';
const options={result:'ok',message:'fictional-private-message',elem:{ET:[{option_type:1,exam_spacer:'fictional-private-setting',p_key:'fictional-private-key',password:'fictional-private-password'}]},teacher_id:'fictional-private-account'};
const qualify=(html=tab)=>qualifyNativePaperOptionsTemplate(html,sourceDomParser.parseFromString);
type Call={path:string;method:string;query:[string,string][]};
function fakeTransport(afterLogin:(url:URL,call:number)=>Response|Promise<Response>,principalHtml=identity){
 const calls:Call[]=[];
 const transport:SourceTransport=async(url,init)=>{
  const target=new URL(url);calls.push({path:target.pathname,method:init.method??'GET',query:[...target.searchParams]});
  if(target.pathname==='/c_login.jsp')return new Response(login);
  if(target.pathname==='/servlet/controller.login.LoginServlet')return new Response('');
  if(target.pathname==='/servlet/controller.coursemanage.CourseManageServlet')return new Response(principalHtml);
  return afterLogin(target,calls.length);
 };
 return {calls,client:new AcademyHttpClient(principal,transport)};
}
const authenticate=(client:AcademyHttpClient)=>client.authenticate({username:'fictional-user',password:'fictional-password'});

test('native option source qualification observes only the fixed original request and never executes handlers',()=>{
 const result=qualify();
 expect(result.path).toBe(NATIVE_PAPER_OPTIONS_PATH);expect(result.method).toBe('GET');
 expect(result.query).toEqual({p_process:'getTestOption',stage_id:'',ass_type:''});
 expect(result.tabSourceSha256).toBe(digest(tab));expect(result.functionSourceSha256).toBe(digest(loader.slice(loader.indexOf('function'),loader.lastIndexOf('}')+1)));
 expect(result.sourceHandlersExecuted).toBe(false);expect((globalThis as Record<string,unknown>).nativePaperScriptExecuted).toBeUndefined();
 expect(JSON.stringify(result)).not.toContain('fictional.invalid');
});

test('changed, dynamic, reassigned and ambiguous option functions cannot authorize a request',()=>{
 for(const changed of [tab.replace('getTestOption','SaveTestPool'),tab.replace('type:"GET"','type:"POST"'),tab.replace('stage_id:""','stage_id:currentStage'),
  tab.replace('ass_type:""','ass_type:"ET"'),tab.replace('data:param','data:otherParams'),tab.replace(NATIVE_PAPER_OPTIONS_PATH,'https://foreign.invalid/endpoint'),
  tab.replace('var param={','var param={extra:"not-admitted",'),tab.replace('$.ajax({','fetch("/save");$.ajax({'),tab.replace('var param={','var param={p_process:"getTestOption",')])expect(()=>qualify(changed)).toThrow();
 expect(()=>qualify('<script>'+loader+loader+'</script>')).toThrow('native_paper_options_function_unqualified');
 expect(()=>qualify('<script>'+loader+'loadPaperOptions=other;</script>')).toThrow('native_paper_options_function_unqualified');
 expect(()=>qualify('<script>var loadPaperOptions=;</script>')).toThrow('native_paper_options_function_unqualified');
 expect(()=>qualify('<script>var unrelated=true;</script>')).toThrow('native_paper_options_function_unqualified');
});

test('input document reference qualification rejects missing and foreign paths without copying source parameters',()=>{
 const valid={sourceSha256:'a'.repeat(64),sourcePathCandidates:[{path:NATIVE_PAPER_INPUT_PATH,sameOrigin:true}]};
 expect(qualifyNativePaperInputReference(valid)).toEqual({path:NATIVE_PAPER_INPUT_PATH,method:'GET',tabSourceSha256:'a'.repeat(64),queryValuesCopied:false});
 expect(()=>qualifyNativePaperInputReference({...valid,sourcePathCandidates:[]})).toThrow('native_paper_input_reference_unqualified');
 expect(()=>qualifyNativePaperInputReference({...valid,sourcePathCandidates:[{path:NATIVE_PAPER_INPUT_PATH,sameOrigin:false}]})).toThrow('native_paper_input_reference_unqualified');
});

test('current option metadata preserves opaque IDs, field kinds and hashes while omitting setting/account/credential values',()=>{
 const raw=JSON.stringify(options),result=inspectNativePaperOptionsResponse(raw),encoded=JSON.stringify(result);
 expect(result.sourceSha256).toBe(digest(raw));expect(result.groups).toHaveLength(1);expect(result.optionCount).toBe(1);
 expect(result.groups[0]!.stageId).toBe('elem');expect(result.groups[0]!.assessmentType).toBe('ET');expect(result.groups[0]!.options[0]!.optionType).toBe(1);
 expect(result.groups[0]!.options[0]!.fields).toContainEqual({name:'exam_spacer',valueKind:'string'});
 expect(result.groups[0]!.options[0]!.omittedFieldCount).toBe(1);expect(result.optionSettingValuesExported).toBe(false);expect(result.accountValuesExported).toBe(false);
 for(const forbidden of ['fictional-private-setting','fictional-private-key','fictional-private-password','fictional-private-account','fictional-private-message'])expect(encoded).not.toContain(forbidden);
 expect(result.unknowns).toContain('selected_question_row_query_contract_not_qualified');expect(result.academyWrites).toBe(0);
});

test('malformed, unauthenticated and oversized responses fail closed without guessing a current option schema',()=>{
 expect(()=>inspectNativePaperOptionsResponse('x'.repeat(2_000_001))).toThrow('native_paper_options_response_limit');
 expect(()=>inspectNativePaperOptionsResponse('{broken')).toThrow('native_paper_options_response_invalid');
 expect(()=>inspectNativePaperOptionsResponse('{"result":"error","message":"private"}')).toThrow('native_paper_options_result_unqualified');
 expect(()=>inspectNativePaperOptionsResponse('<input type="password">')).toThrow('test_pool_authentication_required');
 expect(()=>inspectNativePaperOptionsResponse(JSON.stringify({result:'ok',elem:{ET:Array.from({length:501},()=>({option_type:1}))}}))).toThrow('native_paper_options_collection_limit');
 const unknown=inspectNativePaperOptionsResponse('{"result":"ok"}');expect(unknown.groups).toEqual([]);expect(unknown.unknowns).toContain('no_stage_assessment_option_arrays_observed');
});

test('authenticated reader methods send only fixed tab/input/options GETs with no setters or source handlers',async()=>{
 const {client,calls}=fakeTransport(url=>{
  if(url.pathname==='/common/etest_pool.jsp')return new Response(tab);
  if(url.pathname===NATIVE_PAPER_INPUT_PATH)return new Response('<form action="/future/unqualified"><input name="native_key" value="fictional-private-input"><button onclick="SaveUseLog()">Print</button></form><script>globalThis.nativePaperInputExecuted=true;</script>');
  if(url.pathname===NATIVE_PAPER_OPTIONS_PATH)return new Response(JSON.stringify(options));
  throw Error('unexpected_route');
 });
 try{
  await expect(client.inspectNativePaperInputDocument()).rejects.toThrow('authentication_required');await expect(client.readNativePaperOptions()).rejects.toThrow('authentication_required');expect(calls).toHaveLength(0);
  await authenticate(client);
  const input=await client.inspectNativePaperInputDocument(),current=await client.readNativePaperOptions();
  expect(input.sourceOperation).toBe('native_paper_input_document');expect(input.selectedQuestionReadContract).toBe('not_qualified');expect(input.controlValuesExported).toBe(false);
  expect(JSON.stringify(input)).not.toContain('fictional-private-input');expect((globalThis as Record<string,unknown>).nativePaperInputExecuted).toBeUndefined();
  expect(current.sourceOperation).toBe('native_paper_options');expect(current.academyWrites).toBe(0);
  expect(calls.slice(3)).toEqual([{path:'/common/etest_pool.jsp',method:'GET',query:[]},{path:NATIVE_PAPER_INPUT_PATH,method:'GET',query:[]},
   {path:'/common/etest_pool.jsp',method:'GET',query:[]},{path:NATIVE_PAPER_OPTIONS_PATH,method:'GET',query:[['p_process','getTestOption'],['stage_id',''],['ass_type','']]}]);
  expect(calls.filter(row=>row.method==='POST')).toHaveLength(1); // Only the existing fresh login submission.
 }finally{client.close();}
});

test('source qualification failures occur before a native input/options request',async()=>{
 for(const source of ['<script>var unrelated=true;</script>',tab.replace('getTestOption','SaveUseLog')]){
  const {client,calls}=fakeTransport(()=>new Response(source));
  try{await authenticate(client);await expect(client.readNativePaperOptions()).rejects.toThrow();expect(calls).toHaveLength(4);}finally{client.close();}
 }
 const {client,calls}=fakeTransport(()=>new Response('<script>'+loader+'</script>'));
 try{await authenticate(client);await expect(client.inspectNativePaperInputDocument()).rejects.toThrow('native_paper_input_reference_unqualified');expect(calls).toHaveLength(4);}finally{client.close();}
});

test('principal mismatch, auth expiry and HTTP failure never trigger implicit login retry or source generation',async()=>{
 const wrong=fakeTransport(()=>{throw Error('must_not_read');},identity.replace('value="88001"','value="88002"'));
 try{await expect(authenticate(wrong.client)).rejects.toThrow('teacher_college_conflict');await expect(wrong.client.readNativePaperOptions()).rejects.toThrow('authentication_required');expect(wrong.calls).toHaveLength(3);}finally{wrong.client.close();}
 const expired=fakeTransport(url=>new Response(url.pathname==='/common/etest_pool.jsp'?tab:'<script>location="/error/normal_session_error.jsp";</script>'));
 try{await authenticate(expired.client);await expect(expired.client.readNativePaperOptions()).rejects.toThrow('test_pool_authentication_required');expect(expired.client.authenticated).toBe(false);await expect(expired.client.inspectNativePaperInputDocument()).rejects.toThrow('authentication_required');expect(expired.calls).toHaveLength(5);await expect(authenticate(expired.client)).rejects.toThrow('fresh_authentication_attempt_required');}finally{expired.client.close();}
 const failed=fakeTransport(url=>new Response(url.pathname==='/common/etest_pool.jsp'?tab:'private error',{status:url.pathname==='/common/etest_pool.jsp'?200:503}));
 try{await authenticate(failed.client);let failure:unknown;try{await failed.client.readNativePaperOptions();}catch(error){failure=error;}expect(failure).toBeInstanceOf(AcademyHttpFailure);expect((failure as AcademyHttpFailure).sourceOperation).toBe('native_paper_options');expect((failure as AcademyHttpFailure).httpStatus).toBe(503);expect(failed.calls).toHaveLength(5);expect(JSON.stringify(failure)).not.toContain('private error');}finally{failed.client.close();}
});

// Literal protocol-specification fixture only: no real principal, selected questions or source response.
// Same observed request/guard/callback AST, with formatting independent of a private source artifact.
const selectedInput='<script>'+String.raw`
function checkValidate(item) {
 if (item == null || item == undefined || item == "") { return "EMPTY"; }
 if (item.match(/^[0-9]+$/) == null) { return "ONLY_DIGITS"; }
 if (item.length > 9) { return "OVER_LENGTH"; }
 return "OK";
}
function lecture_info() {
 var lecture_list = document.form1.lecture_list.value;
 if (lecture_list == "") { alert("강의번호를 입력해야 합니다."); return; }
 lecture_list = replaceAll(lecture_list, ".", ",");
 lecture_list = replaceAll(lecture_list, "\r\n", ",");
 lecture_list = replaceAll(lecture_list, "\n", ",");
 lecture_list = replaceAll(lecture_list, "\t", ",");
 lecture_list = replaceAll(lecture_list, " ", ",");
`+Array.from({length:10},()=>`lecture_list = replaceAll(lecture_list, ",,", ",");`).join('\n')+String.raw`
 var firstChar = lecture_list.charAt(0);
 if (firstChar == ",") { lecture_list = lecture_list.substring(1); }
 var lastChar = lecture_list.charAt(lecture_list.length - 1);
 if (lastChar == ",") { lecture_list = lecture_list.slice(0, -1); }
 var itemArray = lecture_list.split(",");
 for (var i=0; i<itemArray.length; i++) {
  var item = itemArray[i];
  var checkResult = checkValidate(item);
  if (checkResult == "EMPTY") { alert("공백없이 강의번호를 입력해야 합니다."); return; }
  else if (checkResult == "ONLY_DIGITS") { alert("강의번호는 숫자로만 입력해야 합니다."); return; }
  else if (checkResult == "OVER_LENGTH") { alert("강의번호는 10자리 이상일 수 없습니다."); return; }
  if (checkResult != "OK") { alert("알수없는 에러."); return; }
 }
 var str_lecture_list = itemArray.join(",");
 var uniq = new Date();
 uniq = uniq.getTime();
 var url = "/servlet/controller.common.TestPageShowExServlet?p_process=GetLectureList&lecture_list="+str_lecture_list+"&uniq="+uniq;
 IFRAME__GET_EXAM_LIST.document.location.href = url;
}
function onResultGetExamList() {
 var jsonStr = IFRAME__GET_EXAM_LIST.document.body.innerHTML;
 IFRAME__GET_EXAM_LIST.document.body.innerHTML = "";
 if (jsonStr != "") {
  var format = detectFormat(jsonStr);
  if (format != "json") { alert("문항 목록 구하기 실패. parse."); return; }
  var result = MODULE.Util.JsonStrToObject(jsonStr);
  if (result == undefined) { alert("문항 목록 구하기 실패. 1"); return; }
  if (result.result == "OK") {
   var rows = result.rows;
   $(top.window).scrollTop(0);
   parent.resultFrame(rows);
  } else { alert("문항 목록 구하기 실패. 2"); }
 } else { }
}
globalThis.nativeSelectedInputExecuted=true;
`+'</script>';
const selectedKeys=['9900001','9900002'];
const selectedRows=[
 {lecture_key:9900002,outer_lecture_key:'59900002',answer:'raw-obj-answer',sel_type:'obj',obj_option:'D',sbj_option:'Y',des_option:'N',stage_id:'elem',difficulty:2,examtext_key:0,text_height:0,exam_size_list:[{exam_type:'sbj',exam_height:123}],private_token:'fictional-omitted'},
 {lecture_key:'9900001',id:null,use_log:'',answer:'written-source-answer',sel_type:'sbj',exam_size_list:'[{"exam_type":"sbj","exam_height":77}]'},
];
const inspectSelected=(text:string)=>inspectNativePaperSelectedQuestionsResponse(text,selectedKeys,sourceDomParser.parseFromString);

test('selected-row source pins bind fixed original GET, ID guard and OK/rows callback without executing source',()=>{
 const template=qualifyNativePaperSelectedQuestionsTemplate(selectedInput,sourceDomParser.parseFromString);
 expect(template.path).toBe(NATIVE_PAPER_SELECTED_PATH);expect(template.method).toBe('GET');expect(template.p_process).toBe('GetLectureList');
 expect(template.functions.map(fn=>fn.name)).toEqual(['checkValidate','lecture_info','onResultGetExamList']);expect(template.inputSourceSha256).toBe(rawSha(selectedInput));expect(template.inputCanonicalJsonStringSha256).toBe(digest(selectedInput));
 expect((globalThis as Record<string,unknown>).nativeSelectedInputExecuted).toBeUndefined();
 expect(nativePaperSelectedQuestionQuery(selectedKeys,123).query).toBe('p_process=GetLectureList&lecture_list=9900001,9900002&uniq=123');
});

test('changed request, validation, callback, rebinding or duplicate functions refuse qualification',()=>{
 for(const source of [selectedInput.replace('GetLectureList','SaveTestPool'),selectedInput.replace('getTime()','toString()'),selectedInput.replace('> 9','> 99'),
  selectedInput.replace('result.result == "OK"','result.result == "ok"'),selectedInput.replace('parent.resultFrame(rows);','fetch("/write");'),
  selectedInput.replace('IFRAME__GET_EXAM_LIST.document.location.href = url;','fetch(url);'),selectedInput.replace('</script>','lecture_info=other;</script>'),
  selectedInput.replace('</script>','window.lecture_info=other;</script>'),selectedInput+selectedInput]){
  expect(()=>qualifyNativePaperSelectedQuestionsTemplate(source,sourceDomParser.parseFromString)).toThrow('native_paper_selected_template_unqualified');
 }
});

test('selected rows retain source order and raw18 values, including arrays/strings/null, with all missing fields reported',()=>{
 const raw=JSON.stringify({result:'OK',rows:selectedRows,account:'fictional-account'}),value=inspectSelected(raw);
 expect(value.sourceSha256).toBe(rawSha(raw));expect(value.sourceCanonicalJsonStringSha256).toBe(digest(raw));expect(value.sourceRowOrder).toEqual(['9900002','9900001']);expect(value.sourceOrderMatchesRequested).toBe(false);
 expect(value.rows[0]!.exam_size_list).toEqual(selectedRows[0]!.exam_size_list);expect(value.rows[1]!.exam_size_list).toBe(selectedRows[1]!.exam_size_list);
 expect(value.rows[0]!.answer).toBe('raw-obj-answer');expect(value.rows[0]!.sel_type).toBe('obj');expect(Object.hasOwn(value.rows[0]!,'id')).toBe(false);
 expect(value.rowEvidence[0]!.missingFields).toContain('id');expect(value.rowEvidence[1]!.nullFields).toContain('id');expect(value.rows[1]!.use_log).toBe('');
 expect(value.missingFieldCounts.id).toBe(1);expect(value.rowEvidence[0]!.sourcePointer).toBe('/rows/0');expect(value.nativeGridSerializationApplied).toBe(false);expect(value.variantOverrideApplied).toBe(false);
 for(const row of value.rows)expect(Object.keys(row).every(key=>NATIVE_PAPER_SELECTED_FIELDS.includes(key as typeof NATIVE_PAPER_SELECTED_FIELDS[number]))).toBe(true);
 expect(JSON.stringify(value)).not.toContain('fictional-omitted');expect(JSON.stringify(value)).not.toContain('fictional-account');
});

test('only raw JSON or inert exact iframe body JSON is accepted; no PRE/script extraction or source handlers',()=>{
 const value=inspectSelected('<html><body>'+JSON.stringify({result:'OK',rows:selectedRows})+'</body></html>');expect(value.responseEnvelope).toBe('html_body_inner_html');
 for(const invalid of ['<pre>'+JSON.stringify({result:'OK',rows:selectedRows})+'</pre>','<script>globalThis.nativeRowExecuted=true</script>',JSON.stringify({result:'ok',rows:selectedRows}),'broken'])expect(()=>inspectSelected(invalid)).toThrow();
 expect((globalThis as Record<string,unknown>).nativeRowExecuted).toBeUndefined();
});

test('invalid caller scope, extra/missing/duplicate/aliased row IDs and excessive values never become a selected row set',()=>{
 for(const keys of [[],['9900001','9900001'],['1,2'],['012'],['1234567890'],Array.from({length:25},(_,i)=>String(i+1))])expect(()=>nativePaperSelectedQuestionQuery(keys,1)).toThrow('native_paper_selected_scope_invalid');
 for(const rows of [selectedRows.slice(0,1),[selectedRows[0],selectedRows[0]],[{id:'9900001'},{lecture_key:'9900002'}],[{lecture_key:'9900001'},{lecture_key:'123'}]])expect(()=>inspectSelected(JSON.stringify({result:'OK',rows}))).toThrow();
 expect(()=>inspectSelected('x'.repeat(2_000_001))).toThrow('native_paper_selected_response_limit');
 expect(()=>inspectSelected('{"result":"OK","rows":[{"lecture_key":"9900001","answer":1e999},{"lecture_key":"9900002"}]}')).toThrow('native_paper_selected_value_unqualified');
});

test('authenticated selected read freezes caller scope and sends fresh tab/input then exactly one fixed GET',async()=>{
 const ids=[...selectedKeys],{client,calls}=fakeTransport(url=>{
  if(url.pathname==='/common/etest_pool.jsp'){ids.reverse();return new Response(tab);}
  if(url.pathname===NATIVE_PAPER_INPUT_PATH)return new Response(selectedInput);
  if(url.pathname===NATIVE_PAPER_SELECTED_PATH)return new Response(JSON.stringify({result:'OK',rows:selectedRows}));
  throw Error('unexpected_route');
 });
 try{
  await expect(client.readNativePaperSelectedQuestions(ids)).rejects.toThrow('authentication_required');expect(calls).toHaveLength(0);await authenticate(client);
  const value=await client.readNativePaperSelectedQuestions(ids);expect(value.requestBinding.lectureKeys).toEqual(selectedKeys);expect(value.requestBinding.method).toBe('GET');expect(value.academyWrites).toBe(0);expect(value.sourceTemplate.tabSourceDigestMeaning).toBe('canonical_json_string_sha256');
  expect(calls.slice(3).map(c=>[c.path,c.method])).toEqual([['/common/etest_pool.jsp','GET'],[NATIVE_PAPER_INPUT_PATH,'GET'],[NATIVE_PAPER_SELECTED_PATH,'GET']]);
  expect(calls[5]!.query.map(([key])=>key)).toEqual(['p_process','lecture_list','uniq']);expect(calls[5]!.query[1]).toEqual(['lecture_list',selectedKeys.join(',')]);
  expect(calls[5]!.query[2]![1]).toMatch(/^[0-9]{13}$/);expect(calls.filter(c=>c.method==='POST')).toHaveLength(1);
 }finally{client.close();}
});

test('source drift prevents row request; authentication expiry latches without retry and HTTP errors retain only bounded metadata',async()=>{
 const drift=fakeTransport(url=>new Response(url.pathname==='/common/etest_pool.jsp'?tab:selectedInput.replace('GetLectureList','SaveUseLog')));
 try{await authenticate(drift.client);await expect(drift.client.readNativePaperSelectedQuestions(selectedKeys)).rejects.toThrow('native_paper_selected_template_unqualified');expect(drift.calls).toHaveLength(5);}finally{drift.client.close();}
 const expired=fakeTransport(url=>new Response(url.pathname==='/common/etest_pool.jsp'?tab:url.pathname===NATIVE_PAPER_INPUT_PATH?selectedInput:'<input type="password">'));
 try{await authenticate(expired.client);await expect(expired.client.readNativePaperSelectedQuestions(selectedKeys)).rejects.toThrow('test_pool_authentication_required');expect(expired.client.authenticated).toBe(false);await expect(expired.client.readNativePaperSelectedQuestions(selectedKeys)).rejects.toThrow('authentication_required');expect(expired.calls).toHaveLength(6);}finally{expired.client.close();}
 const failed=fakeTransport(url=>url.pathname===NATIVE_PAPER_SELECTED_PATH?new Response('private-failure',{status:503}):new Response(url.pathname==='/common/etest_pool.jsp'?tab:selectedInput));
 try{await authenticate(failed.client);let error:unknown;try{await failed.client.readNativePaperSelectedQuestions(selectedKeys);}catch(e){error=e;}expect(error).toBeInstanceOf(AcademyHttpFailure);expect((error as AcademyHttpFailure).sourceOperation).toBe('native_paper_selected_questions');expect(JSON.stringify(error)).not.toContain('private-failure');expect(failed.calls).toHaveLength(6);}finally{failed.client.close();}
});

test('selected read401/403 and source redirects close authentication with a safe refusal and no further request',async()=>{
 for(const response of [new Response('private401',{status:401}),new Response('private403',{status:403}),new Response('',{status:302,headers:{location:'/error/normal_session_error.jsp'}})]){
  const {client,calls}=fakeTransport(url=>url.pathname===NATIVE_PAPER_SELECTED_PATH?response:new Response(url.pathname==='/common/etest_pool.jsp'?tab:selectedInput));
  try{
   await authenticate(client);await expect(client.readNativePaperSelectedQuestions(selectedKeys)).rejects.toThrow('test_pool_authentication_refused');
   expect(client.authenticated).toBe(false);expect(calls).toHaveLength(6);
   await expect(client.readNativePaperSelectedQuestions(selectedKeys)).rejects.toThrow('authentication_required');
   await expect(authenticate(client)).rejects.toThrow('fresh_authentication_attempt_required');expect(calls).toHaveLength(6);
  }finally{client.close();}
 }
});

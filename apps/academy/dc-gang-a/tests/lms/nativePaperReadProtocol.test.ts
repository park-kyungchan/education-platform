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


// Reusable save protocol specification only; all account/paper/row responses below are fictional.
import {reusablePoolExpectation,reusableTestPoolRequest,qualifyReusablePoolTab,qualifyReusablePoolMain,reusablePoolCreatedKey,verifyReusablePoolMembership,inspectReusablePoolMainTarget,ReusableTestPoolCreateFailure} from "../../src/lms/reusableTestPoolProtocol";
const reusableTabFunctions=String.raw`function onSaveETestPoolButtonClick() {
	var ids = jQuery('#gridList').getDataIDs();
	var examCount = ids.length;

	if (examCount == 0) {
		alert("문제를 먼저 선택해주세요");
		return;
	} else if(examCount > 250) {
		alert("최대 문항수는 250 문항 입니다..");
		return;
	} else {
		if ((ids.length > 30) && (isTestUser == 1)) {
			alert("최대 30문항까지 제작해보실수 있습니다.");
			return;
		}
	}

	var title1 = document.regist_form.title1.value;
	var title2 = MODULE.Util.replaceTestName(document.regist_form.title2.value) || "";
	title2 = title2.trim();

	if (title1 == "" || title2 == "") {
		alert("문제지 [큰 제목]과 [작은 제목]은 필수 항목입니다.");
		return;
	}

	// 문제지 제작로그는 문항사용이력과 다름.
	// isNeedSaveETestPool = true; ETestPool DB에 저장 O, 문제지 제작로그 O
	// isNeedSaveETestPool = false; ETestPool DB에 저장 X, 문제지 제작로그 O
	var isNeedSaveETestPool = true;

	START({}).then(function(data) {
		return saveTestPool(isNeedSaveETestPool);
	}).then(function(data) {
		// success
		alert("문제지가 저장 되었습니다.");
	}).fail(function(message) {
		alert(message);
	});
}

function saveTestPool(isNeedSaveETestPool) {
	var def = jQuery.Deferred();

	var title1 = document.regist_form.title1.value;
	var title2 = MODULE.Util.replaceTestName(document.regist_form.title2.value);
	var searchWord1 = document.regist_form.search_word1.value;
	var searchWord2 = document.regist_form.search_word2.value;
	var keywordTitle = document.regist_form.keyword_title.value;

	var poolValue = title1+"|,|"+title2+"|,|"+searchWord1+"|,|"+searchWord2 +"|,|"+ keywordTitle;

	var rows = jQuery('#gridList').getRowData();
	var lectureList = MODULE.Util.getGridAllItemValueList(rows, "lecture_key", ",");
	var outerLectureList = MODULE.Util.getGridAllItemValueList(rows, "outer_lecture_key", ",");
	var examTypeList = MODULE.Util.getGridAllItemValueList(rows, "sel_type", ",");

	var is = String(isNeedSaveETestPool);

	var param = {
		reqCmd: "SaveTestPool",
		pool_value: poolValue,
		lecture_list: lectureList,
		outer_lecture_list: outerLectureList,
		exam_type_list: examTypeList,
		pool_no: g_pool_no,
		is: is
	}

	MODULE.XmlRequest.request({
		type: "POST",
		contentType: "application/x-www-form-urlencoded",
		url: "/servlet/controller.common.TestpageSelectServlet",
		// url: "/servlet/controller.common.TestpageSelectServlet?reqCmd=SaveTestPool&pool_value=111%7C%2C%7C222%7C%2C%7C333%7C%2C%7C444%7C%2C%7C555&lecture_list=1254955,1254961,1423813&outer_lecture_list=501254955,501254961,501423813&pool_no=0&is=false",
		data: param
	}).then(function (xmlObject) {

		var poolNo = xmlObject.find("poolno").first().text();
		g_pool_no = poolNo;

		def.resolve();

	}).fail(function (fail_message) {
		return def.reject(fail_message).promise();
		//MODULE.DialogBox.message("알림", fail_message);
	});

	return def.promise();
}

function getPoolExamList(poolNo) {
	if (poolNo == undefined || poolNo == null || poolNo == "" || poolNo == 0) {
		return;
	}

	var url = "/servlet/controller.tutor.etest.TestPoolServlet?reqCmd=getPool&pool_no=" + poolNo;

	jsRequest1.open("GET", url, true);
	jsRequest1.onreadystatechange = onGetPoolExamList;
	jsRequest1.send(null);
}

function onGetPoolExamList() {

	if (jsRequest1.readyState == 4) {
		if (jsRequest1.status == 200) {

			var resultStr = jsRequest1.responseText;
			var json = MODULE.Util.JsonStrToObject(resultStr);
			if (json == undefined) {
				alert("문항정보 요청 실패 1.");
				return;
			}

			if (json.result == "OK") {
				var rows = json.rows;

				$("#typeListGrid").clearGridData(false);

				var __MAX_COUNT = rows.length;
				jQuery('#gridList').setGridParam({
					userData: { __MAX_COUNT: __MAX_COUNT }
				});

				for (var i=0; i<rows.length; i++) {
					var row = rows[i];

					row.id = (i + 1);

					$("#gridList").addRowData(row.id, row);
				}

				displayStatics();
			} else {
				alert("문항정보 요청 실패 2.");
			}
		}
	}
}`;

const reusableMainFunctions=String.raw`function popup_etest_pool()
{
	//var WIN;
	var url = '/common/etest_pool.jsp';

	var dummy = new Date();
	var value = "//dc.gang-a.kr"
				+ url
				+ "?dummy="+dummy;

	//WIN = window.open(url,"etest_pool","width=1024px, height=768px,scrollbars=yes,resizable=yes,toolbar=no,location=no,directories=no,status=yes,menubar=no");
	//WIN.focus();

	MODULE.Commons.showPopUp(url);

	//iframe_html_inputbox("대상자목록", value, 1024, 768);
	//return_result = showModalDialog(url, "", "titlebar:no; dialogWidth:1024px; dialogHeight:768px; status:no; scroll:yes;");
	//alert("return_result => " + return_result);
}

function popup_etest_pool(pool_no, title1, title2, search_word1, search_word2)
{
	//var WIN;
	var url = '/common/etest_pool.jsp?pool_no='+pool_no+"&title1="+encodeURIComponent(title1)+"&title2="+encodeURIComponent(title2)+"&search_word1="+encodeURIComponent(search_word1)+"&search_word2="+encodeURIComponent(search_word2);
	//WIN = window.open(url,"etest_pool","width=1024px, height=768px,scrollbars=yes,resizable=yes,toolbar=no,location=no,directories=no,status=yes,menubar=no");
	//WIN.focus();
	MODULE.Commons.showPopUp(url);

	var dummy = new Date();
	var value = "//dc.gang-a.kr"
				+ url
				+ "?dummy="+dummy;
	//iframe_html_inputbox("대상자목록", value, 1024, 768);
	//return_result = showModalDialog(url, "", "titlebar:no; dialogWidth:1024px; dialogHeight:768px; status:no; scroll:yes;");
	//alert("return_result => " + return_result);
}

function popup_etest_pool_new(pool_no, title1, title2, search_word1, search_word2)
{
	//var WIN;
	var url = '/common/etest_pool.jsp?pool_no='+pool_no+"&title1="+encodeURIComponent(title1)+"&title2="+encodeURIComponent(title2)+"&search_word1="+encodeURIComponent(search_word1)+"&search_word2="+encodeURIComponent(search_word2);
	//WIN = window.open(url,"","width=1024px, height=768px,scrollbars=yes,resizable=yes,toolbar=no,location=no,directories=no,status=yes,menubar=no");
	//	WIN.focus();
	MODULE.Commons.showPopUp(url);

	var dummy = new Date();
	var value = "//dc.gang-a.kr"
				+ url
				+ "?dummy="+dummy;
	//iframe_html_inputbox("대상자목록", value, 1024, 768);
	//return_result = showModalDialog(url, "", "titlebar:no; dialogWidth:1024px; dialogHeight:768px; status:no; scroll:yes;");
	//alert("return_result => " + return_result);
}`;

function reusableInput(){return {schemaVersion:'academy.reusable-test-pool-create/1' as const,title1:'Fictional October',title2:'Grade3 Final',keywordTitle:'Fictional October usage memo',rows:Array.from({length:24},(_,i)=>({lectureKey:String(9900001+i),outerLectureKey:String(59900001+i),variant:i%3===0?'des' as const:'sbj' as const}))};}
function reusableTab(){return '<form name="regist_form">'+['title1','title2','search_word1','search_word2','keyword_title'].map(name=>'<input name="'+name+'">').join('')+'</form><button onclick="javascript:onSaveETestPoolButtonClick();">재사용을 위해 입력된 정보 저장</button><script>'+reusableTabFunctions+'globalThis.reusableSaveHandlerExecuted=true;</script>';}
function reusableMain(includeTarget=true,creator='Fictional Teacher',ambiguous=false){
 const input=reusableInput(),head=ambiguous?'<tr><th>문항수</th><th>제작자</th><th>작성자</th></tr>':'<tr><th>문제지</th><th>문항수</th><th>제작자</th></tr>';
 return '<script>'+reusableMainFunctions+'</script><table>'+head+'<tr><td>OTHER_PRIVATE_PAPER</td><td>24</td><td>OTHER_PRIVATE_TEACHER</td></tr>'+(includeTarget?'<tr><td><a onclick="popup_etest_pool(\'7001\',\''+input.title1+'\',\''+input.title2+'\',\'\',\'\')">Fictional paper</a></td><td>24</td><td>'+creator+'</td></tr>':'')+'</table>';
}
function reusableRows(){return reusableInput().rows.map(row=>({lecture_key:row.lectureKey,outer_lecture_key:row.outerLectureKey,sel_type:row.variant,answer:'PRIVATE_RAW_ANSWER',private_owner:'PRIVATE_OWNER_FIELD'}));}
type ReusableCall={path:string;method:string;body:string};
function reusableFake(overrides?:{save?:(calls:ReusableCall[])=>Response|Promise<Response>;rows?:()=>unknown[];main?:()=>string;tab?:()=>string}){
 const calls:ReusableCall[]=[];let created=false;
 const transport:SourceTransport=async(url,init)=>{const target=new URL(url),call={path:target.pathname+target.search,method:init.method??'GET',body:typeof init.body==='string'?init.body:''};calls.push(call);
  if(target.pathname==='/c_login.jsp')return new Response(login);
  if(target.pathname==='/servlet/controller.login.LoginServlet')return new Response('');
  if(target.pathname==='/servlet/controller.coursemanage.CourseManageServlet')return new Response(identity);
  if(target.pathname==='/common/etest_pool.jsp')return new Response(overrides?.tab?.()??reusableTab());
  if(target.pathname==='/servlet/controller.common.TestpageSelectServlet'){created=true;return overrides?.save?.(calls)??new Response('<response><poolno>7001</poolno></response>',{headers:{'Content-Type':'application/xml'}});}
  if(target.searchParams.get('reqCmd')==='getPool')return new Response(JSON.stringify({result:'OK',rows:overrides?.rows?.()??reusableRows()}));
  if(target.searchParams.get('reqCmd')==='Main')return new Response(overrides?.main?.()??reusableMain(created));
  throw Error('unexpected_reusable_route');
 };
 return {client:new AcademyHttpClient(principal,transport),calls};
}
const saveCalls=(calls:ReusableCall[])=>calls.filter(call=>call.path==='/servlet/controller.common.TestpageSelectServlet');

test('reusable save request keeps24ordered identities/outerkeys/variants and the exact original seven fields',()=>{
 const input=reusableInput(),before=JSON.stringify(input),request=reusableTestPoolRequest(input),body=new URLSearchParams(request.body);
 expect([...body.keys()]).toEqual(['reqCmd','pool_value','lecture_list','outer_lecture_list','exam_type_list','pool_no','is']);
 expect(body.get('pool_value')).toBe([input.title1,input.title2,'','',input.keywordTitle].join('|,|'));expect(body.get('pool_no')).toBe('0');expect(body.get('is')).toBe('true');
 expect(body.get('lecture_list')).toBe(input.rows.map(row=>row.lectureKey).join(','));expect(body.get('outer_lecture_list')).toBe(input.rows.map(row=>row.outerLectureKey).join(','));expect(body.get('exam_type_list')).toBe(input.rows.map(row=>row.variant).join(','));
 expect(JSON.stringify(input)).toBe(before);expect(Object.isFrozen(request.rows[0])).toBe(true);
 for(const change of [(v:any)=>{v.creator='Spoofed';},(v:any)=>{v.rows.pop();},(v:any)=>{v.rows[1].lectureKey=v.rows[0].lectureKey;},(v:any)=>{v.rows[0].variant='obj';},(v:any)=>{v.rows[0].variant=['sbj'];},(v:any)=>{v.rows[0].outerLectureKey='0';},(v:any)=>{v.title2='';},(v:any)=>{v.title1='bad|,|title';}]){const bad=structuredClone(input);change(bad);expect(()=>reusableTestPoolRequest(bad)).toThrow();}
 for(const value of [undefined,['memo'],123,'bad|,|memo',' memo','memo\ncontinued','x'.repeat(129)]){const bad={...input,keywordTitle:value};expect(()=>reusableTestPoolRequest(bad)).toThrow();}
 expect(new URLSearchParams(reusableTestPoolRequest({...input,keywordTitle:''}).body).get('pool_value')).toBe([input.title1,input.title2,'','',''].join('|,|'));
 expect(reusableTestPoolRequest({...input,keywordTitle:'다른 메모'}).bodySha256).not.toBe(request.bodySha256);
});
test('reusable source qualification binds exact save button/functions and effective Main duplicate popup without executing them',()=>{
 expect(qualifyReusablePoolTab(reusableTab(),sourceDomParser.parseFromString).functions).toHaveLength(4);
 expect(qualifyReusablePoolMain(reusableMain(),sourceDomParser.parseFromString).functions).toHaveLength(2);
 expect((globalThis as Record<string,unknown>).reusableSaveHandlerExecuted).toBeUndefined();
 for(const bad of [reusableTab().replace('SaveTestPool','DeleteTestPool'),reusableTab().replace('var isNeedSaveETestPool = true','var isNeedSaveETestPool = false'),reusableTab().replace('"POST"','"GET"'),reusableTab().replace('재사용을 위해 입력된 정보 저장','다른 버튼'),reusableTab().replace('</script>','saveTestPool=other;</script>'),reusableTab()+reusableTab()])expect(()=>qualifyReusablePoolTab(bad,sourceDomParser.parseFromString)).toThrow();
 expect(()=>qualifyReusablePoolMain(reusableMain().replace('encodeURIComponent(title1)','title1'),sourceDomParser.parseFromString)).toThrow();
 expect(()=>qualifyReusablePoolMain(reusableMain().replace('</script>','function popup_etest_pool(){};</script>'),sourceDomParser.parseFromString)).toThrow();
});
test('reusable save XML requires a single canonical positive pool key; membership binds order,variant and outer identity',()=>{
 expect(reusablePoolCreatedKey('<r><poolno>7001</poolno></r>',sourceDomParser.parseFromString)).toBe('7001');
 for(const bad of ['<r/>','<r><poolno>0</poolno></r>','<r><poolno>07001</poolno></r>','<r><poolno>7001</poolno><poolno>7002</poolno></r>','<!DOCTYPE r><r><poolno>7001</poolno></r>','<input type="password">'])expect(()=>reusablePoolCreatedKey(bad,sourceDomParser.parseFromString)).toThrow();
 const expected=reusablePoolExpectation(reusableInput()),valid=verifyReusablePoolMembership(JSON.stringify({result:'OK',rows:reusableRows()}),expected);
 expect(valid.identityOrderOuterKeysAndVariantsVerified).toBe(true);expect(JSON.stringify(valid)).not.toContain('PRIVATE');
 for(const change of [(rows:any[])=>rows.reverse(),(rows:any[])=>{rows[0].sel_type='sbj';},(rows:any[])=>{rows[0].outer_lecture_key='59999999';},(rows:any[])=>{rows[0].lecture_key=rows[1].lecture_key;},(rows:any[])=>{rows.pop();}]){const rows=reusableRows();change(rows);expect(()=>verifyReusablePoolMembership(JSON.stringify({result:'OK',rows}),expected)).toThrow();}
});
test('Main readback projects only exact returned pool row and refuses ambiguous creator headers or wrong creator',()=>{
 const expected=reusablePoolExpectation(reusableInput()),inspect=(html:string)=>inspectReusablePoolMainTarget(html,'7001',expected,principal.teacherLabel,sourceDomParser.parseFromString);
 const good=inspect(reusableMain());expect(good.metadataVerified).toBe(true);expect(JSON.stringify(good)).not.toContain('OTHER_PRIVATE');
 const ambiguous=inspect(reusableMain(true,'Fictional Teacher',true));expect(ambiguous.metadataVerified).toBe(false);expect(ambiguous.targetPresent).toBe(true);expect(JSON.stringify(ambiguous)).not.toContain('OTHER_PRIVATE');
 expect(inspect(reusableMain(true,'Different Teacher')).metadataVerified).toBe(false);expect(inspect(reusableMain(false)).targetPresent).toBe(false);
 expect(inspect(reusableMain().replace('Fictional October','Changed title')).metadataVerified).toBe(false);
});
test('observed six-column Main structure binds 제작선생님 and outer target row despite nested search-detail table',()=>{
 const expected=reusablePoolExpectation(reusableInput()),title=expected.title1,subtitle=expected.title2;
 const main=(duplicate=false)=>'<script>'+reusableMainFunctions+'</script><table><tr><th>문제지</th><th>문항수</th><th>제작선생님</th><th>제작일</th><th>삭제</th><th>검색어</th></tr>'+
  (duplicate?'<tr><th>문제지</th><th>문항수</th><th>제작선생님</th><th>제작일</th><th>삭제</th><th>검색어</th></tr>':'')+
  '<tr><td><p><a onclick="popup_etest_pool(\'7001\',\''+title+'\',\''+subtitle+'\',\'\',\'\')">Fictional paper</a></p></td><td>24</td><td>Fictional Teacher</td><td>2026-10-19</td><td>삭제</td>'+
  '<td><div><table><tr><td>NESTED_PRIVATE_DETAIL</td><td>UNRELATED_PRIVATE_RECORD</td></tr></table></div></td></tr></table>';
 const inspect=(html:string)=>inspectReusablePoolMainTarget(html,'7001',expected,principal.teacherLabel,sourceDomParser.parseFromString);
 expect(qualifyReusablePoolMain(main(),sourceDomParser.parseFromString).creatorHeaderCandidates).toMatchObject([{tableIndex:0,cellCount:6,creatorIndex:2,label:'제작선생님'}]);
 const good=inspect(main());expect(good.metadataVerified).toBe(true);expect(good.creator).toBe('Fictional Teacher');expect(JSON.stringify(good)).not.toContain('PRIVATE');
 expect(good).toMatchObject({questionCount:24,questionCountText:'24',questionCountHeaderQualified:true,questionCountMatchesExpected:true});
 for(const changed of [main().replace('<td>24</td>','<td>2</td>'),main().replace('<th>문항수</th>','<th>미확인</th>'),main().replace('<th>제작일</th>','<th>문항수</th>')])expect(inspect(changed).metadataVerified).toBe(false);
 const ambiguous=inspect(main(true));expect(ambiguous.metadataVerified).toBe(false);expect(JSON.stringify(ambiguous)).not.toContain('PRIVATE');
 const inner=main().replace('NESTED_PRIVATE_DETAIL','<a onclick="popup_etest_pool(\'7001\',\''+title+'\',\''+subtitle+'\',\'\',\'\')">inner</a>');
 expect(()=>inspect(inner)).not.toThrow();expect(inspect(inner).metadataVerified).toBe(false);
});
test('single reusable creation awaits journal before onePOST and verifies membership plus actual creator without other writes',async()=>{
 const {client,calls}=reusableFake();let journalCalls=0;
 try{await authenticate(client);const output=await client.createReusableTestPool(reusableInput(),async admission=>{journalCalls++;expect(saveCalls(calls)).toHaveLength(0);expect(admission.bodySha256).toBe(reusableTestPoolRequest(reusableInput()).bodySha256);expect(admission.automaticRetryAllowed).toBe(false);});
  expect(output.status).toBe('created_readback_verified');expect(output.metadata.metadataVerified).toBe(true);expect(output.poolNo).toBe('7001');expect(output.saveRequestsSubmitted).toBe(1);expect(journalCalls).toBe(1);expect(saveCalls(calls)).toHaveLength(1);
  expect(output.keywordTitleReadback).toBe('not_projected_by_qualified_readback');
  expect(output.metadataReadbackScope).toBe('ordered_membership_outer_keys_variants_titles_search_words_creator_question_count');
  expect(calls.slice(3).map(call=>call.path)).toEqual(['/common/etest_pool.jsp','/servlet/controller.tutor.etest.TestPoolServlet?reqCmd=Main','/servlet/controller.common.TestpageSelectServlet','/servlet/controller.tutor.etest.TestPoolServlet?reqCmd=getPool&pool_no=7001','/servlet/controller.tutor.etest.TestPoolServlet?reqCmd=Main']);
  expect(JSON.stringify(output)).not.toContain('PRIVATE');await expect(client.createReusableTestPool(reusableInput(),async()=>{})).rejects.toThrow('reusable_pool_create_attempt_already_consumed');expect(saveCalls(calls)).toHaveLength(1);
 }finally{client.close();}
});
test('journal failure, source drift and concurrent duplicate attempts cannot submit another save',async()=>{
 const failed=reusableFake();try{await authenticate(failed.client);let failure:unknown;try{await failed.client.createReusableTestPool(reusableInput(),async()=>{throw Error('fictional_journal_failed');});}catch(error){failure=error;}
  expect(failure).toBeInstanceOf(ReusableTestPoolCreateFailure);expect(failure).toMatchObject({phase:'dispatch_journal',dispatchAttempted:false,poolNo:null,automaticRetryAllowed:false});expect(saveCalls(failed.calls)).toHaveLength(0);await expect(failed.client.createReusableTestPool(reusableInput(),async()=>{})).rejects.toThrow('already_consumed');
 }finally{failed.client.close();}
 const drift=reusableFake({tab:()=>reusableTab().replace('SaveTestPool','DeleteTestPool')});try{await authenticate(drift.client);await expect(drift.client.createReusableTestPool(reusableInput(),async()=>{})).rejects.toThrow();expect(saveCalls(drift.calls)).toHaveLength(0);}finally{drift.client.close();}
 const concurrent=reusableFake();try{await authenticate(concurrent.client);const results=await Promise.allSettled([concurrent.client.createReusableTestPool(reusableInput(),async()=>{}),concurrent.client.createReusableTestPool(reusableInput(),async()=>{})]);expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);expect(saveCalls(concurrent.calls)).toHaveLength(1);}finally{concurrent.client.close();}
});
test('postdispatch failures preserve unknown state and knownpoolNo; readonly recovery never resubmits creation',async()=>{
 for(const save of [()=>new Response('<response/>'),()=>new Response('failure',{status:503})]){
  const {client,calls}=reusableFake({save});try{await authenticate(client);let failure:unknown;try{await client.createReusableTestPool(reusableInput(),async()=>{});}catch(error){failure=error;}
   expect(failure).toMatchObject({dispatchAttempted:true,poolNo:null,automaticRetryAllowed:false,unknownOutcome:true,remoteOutcome:'unknown_after_dispatch'});expect(saveCalls(calls)).toHaveLength(1);await expect(client.createReusableTestPool(reusableInput(),async()=>{})).rejects.toThrow('already_consumed');expect(saveCalls(calls)).toHaveLength(1);
  }finally{client.close();}
 }
 let ambiguous=true;const recovery=reusableFake({main:()=>reusableMain(true,'Fictional Teacher',ambiguous)});
 try{await authenticate(recovery.client);let failure:unknown;try{await recovery.client.createReusableTestPool(reusableInput(),async()=>{});}catch(error){failure=error;}
  expect(failure).toMatchObject({dispatchAttempted:true,poolNo:'7001',membershipVerified:true,metadataReadback:{metadataVerified:false}});ambiguous=false;
  const readback=await recovery.client.readReusableTestPoolReadback('7001',reusableInput());expect(readback.status).toBe('readback_verified');expect(readback.academyWrites).toBe(0);expect(saveCalls(recovery.calls)).toHaveLength(1);
 }finally{recovery.client.close();}
});
test('wrong saved membership and authentication refusal stay oneattempt; readonly recovery validates scope before requests',async()=>{
 const wrong=reusableFake({rows:()=>reusableRows().reverse()});try{await authenticate(wrong.client);let failure:unknown;try{await wrong.client.createReusableTestPool(reusableInput(),async()=>{});}catch(error){failure=error;}expect(failure).toMatchObject({dispatchAttempted:true,poolNo:'7001',automaticRetryAllowed:false});expect(saveCalls(wrong.calls)).toHaveLength(1);}finally{wrong.client.close();}
 const wrongCount=reusableFake({main:()=>reusableMain(true).replace('<td>24</td><td>Fictional Teacher','<td>2</td><td>Fictional Teacher')});
 try{await authenticate(wrongCount.client);let failure:unknown;try{await wrongCount.client.createReusableTestPool(reusableInput(),async()=>{});}catch(error){failure=error;}
  expect(failure).toMatchObject({dispatchAttempted:true,membershipVerified:true,unknownOutcome:true,metadataReadback:{questionCount:2,questionCountMatchesExpected:false,metadataVerified:false}});expect(saveCalls(wrongCount.calls)).toHaveLength(1);
 }finally{wrongCount.client.close();}
 for(const status of [401,403,302]){const refused=reusableFake({save:()=>new Response('',{status,headers:status===302?{Location:'/c_login.jsp'}:{}})});try{await authenticate(refused.client);await expect(refused.client.createReusableTestPool(reusableInput(),async()=>{})).rejects.toThrow('reusable_test_pool_create_failed');expect(refused.client.authenticated).toBe(false);expect(saveCalls(refused.calls)).toHaveLength(1);await expect(refused.client.readReusableTestPoolReadback('7001',reusableInput())).rejects.toThrow('authentication_required');}finally{refused.client.close();}}
 const fresh=reusableFake();try{await expect(fresh.client.readReusableTestPoolReadback('7001',reusableInput())).rejects.toThrow('authentication_required');expect(fresh.calls).toHaveLength(0);await authenticate(fresh.client);const count=fresh.calls.length;await expect(fresh.client.readReusableTestPoolReadback('07001',reusableInput())).rejects.toThrow();expect(fresh.calls).toHaveLength(count);}finally{fresh.client.close();}
});


import {lectureUsageExpectation,lectureUsageRequest,lectureUsageDateAt,qualifyLectureUsageTab,inspectLectureUsageHistory,verifyLectureUsageDelta,LectureUsageWriteFailure} from "../../src/lms/reusableTestPoolProtocol";
const usageTabFunctions=String.raw`function getTextExamList() {
	var examList = "";

	var ids = jQuery('#gridList').getDataIDs();

	for (var i=0; i<ids.length; i++) {
		var rowId = ids[i];
		var currRow = jQuery('#gridList').getRowData(rowId);

		if (examList != "") {
			examList = examList + "<BR>";
		}

		examList = examList +"1|,|"+currRow.lecture_key;
	}

	return examList;
}

function saveUseLog() {
	var def = jQuery.Deferred();

	var keyworkTitle = document.regist_form.keyword_title.value;
	var examList = getTextExamList();

	var param = {
		reqCmd: "SaveLectureUseLog",
		keyword_title: keyworkTitle,
		exam_list: examList
	}

	MODULE.XmlRequest.request({
		type: "POST",
		url: "/servlet/controller.common.TestpageSelectServlet",
		data: param,
		contentType: "application/x-www-form-urlencoded; charset=UTF-8"
	}).then(function (xmlObject) {

		var result = xmlObject.find("result").first().text();
		def.resolve();

	}).fail(function (fail_message) {
		return def.reject(fail_message).promise();
		//MODULE.DialogBox.message("알림", fail_message);
	});

	return def.promise();
}

function showUseLog(element, lectureKey) {
	g_ap = getAbsolutePosition(element);

	var url = "/servlet/controller.common.TestPageShowExServlet?p_process=GetLectureListLog&lecture_key="+lectureKey;

	jsRequest5.open("GET", url, true);
	jsRequest5.onreadystatechange = onGetUseLogResult;
	jsRequest5.send(null);
}

function onGetUseLogResult() {

	if (jsRequest5.readyState == 4) {
		if (jsRequest5.status == 200) {

			try {
				var html = "";

				var w_resultXML = jsRequest5.responseXML;
				if (w_resultXML == null) {
					return 0;
				}

				var w_result = w_resultXML.getElementsByTagName("result");
				var w_result_data = w_result[0].childNodes[0].data;

				if (w_result_data == "result_ok") {

					var w_result = w_resultXML.getElementsByTagName("lectureList");
					var w_result_data = w_result[0].childNodes[0].data;

					var ass_type = "";

					var return_result= " {mans : ["+ w_result_data +"]}" ;

					eval("resultJson="+return_result)

					html += ("<table width='270' border='0' cellpadding='0' cellspacing='0'>");

					html += ("<tr>");
					html += ("<td width='260' height='22' align='center' valign='middle' background='/image/testpage/fimg_01.png'>&nbsp;</td>");
					html += ("</tr>");

					html += ("<tr>");
					html += ("<td height='22' align='center' valign='middle' background='/image/testpage/fimg_02.png'>");

					html += ("<table width='260' height='40' border='0' cellpadding='0' cellspacing='0'>");

					for (var i=0; i<resultJson.mans.length; i++) {
						if (resultJson.mans[i].ass_no == "1000") {
							ass_type = "진단";
						} else if (resultJson.mans[i].ass_no == "1001") {
							ass_type = "형성";
						} else if (resultJson.mans[i].ass_no == "1002") {
							ass_type = "수시";
						} else {
							ass_type = "문제지";
						}

						html += ("<tr>");
						html += ("<td width='43' height='26' align='center'><span class='style2'>"+ass_type+"</span></td>");
						html += ("<td align='center'><span class='style2'>"+resultJson.mans[i].title+"</span></td>");
						html += ("<td width='80' align='center'><span class='style2'>"+resultJson.mans[i].use_date+"</span></td>");
						html += ("</tr>");

						if (i < (resultJson.mans.length-1)) {
							html += ("<tr>");
							html += ("<td height='1' colspan='3' align='center' background='/image/testpage/fimg_04.png'></td>");
							html += ("</tr>");
						}
					}

					html += ("</table>");

					html += ("</td>");
					html += ("</tr>");

					html += ("<tr>");
					html += ("<td height='15' align='center' valign='middle' background='/image/testpage/fimg_03.png'></td>");
					html += ("</tr>");

					html += ("</table>");


					var useLogLayer  = document.getElementById( "use_log_layer" );
					var scrollPosition = jQuery("#gridList").closest(".ui-jqgrid-bdiv").scrollTop();

					useLogLayer.innerHTML = html;

					useLogLayer.style.left = (g_ap.x + 30) + 'px';
					useLogLayer.style.top = (g_ap.y + 10 - scrollPosition ) + 'px';
					useLogLayer.style.display = "block";
				} else {
					alert("로그가 없습니다.");
				}
			} catch (e) {
				alert("실패했습니다.#2");
			}
		}
	}
}`;
function usageInput(count=3){return {schemaVersion:'academy.lecture-use-log/1' as const,lectureKeys:Array.from({length:count},(_,i)=>String(9900001+i)),keywordTitle:'Fictional exact usage memo',date:lectureUsageDateAt()};}
function usageTab(){return '<form name="regist_form"><input name="keyword_title"></form><script>'+usageTabFunctions+'globalThis.usageScriptExecuted=true;</script>';}
function usageXml(records:unknown[],result='result_ok'){
 const escaped=records.map(record=>JSON.stringify(record)).join(',').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
 return '<response><result>'+result+'</result><lectureList>'+escaped+'</lectureList></response>';
}
function usageRecords(after=false){const input=usageInput();return [{ass_no:'1003',title:input.keywordTitle,use_date:input.date},
 {ass_no:'1003',title:'UNRELATED_PRIVATE_HISTORY',use_date:input.date},
 {ass_no:'1000',title:input.keywordTitle,use_date:'2025-10-19'},
 ...after?[{ass_no:'1003',title:input.keywordTitle,use_date:input.date}]:[]];}
function usageFake(options?:{tab?:()=>string;history?:(key:string,after:boolean)=>Response;save?:()=>Response}){
 const calls:ReusableCall[]=[];let submitted=false;
 const transport:SourceTransport=async(url,init)=>{const target=new URL(url);calls.push({path:target.pathname+target.search,method:init.method??'GET',body:typeof init.body==='string'?init.body:''});
  if(target.pathname==='/c_login.jsp')return new Response(login);
  if(target.pathname==='/servlet/controller.login.LoginServlet')return new Response('');
  if(target.pathname==='/servlet/controller.coursemanage.CourseManageServlet')return new Response(identity);
  if(target.pathname==='/common/etest_pool.jsp')return new Response(options?.tab?.()??usageTab());
  if(target.pathname==='/servlet/controller.common.TestPageShowExServlet')return options?.history?.(target.searchParams.get('lecture_key')!,submitted)??new Response(usageXml(usageRecords(submitted)));
  if(target.pathname==='/servlet/controller.common.TestpageSelectServlet'){
   if(new URLSearchParams(String(init.body)).get('reqCmd')!=='SaveLectureUseLog')throw Error('fictional_wrong_usage_command');
   submitted=true;return options?.save?.()??new Response('<response><result>UNQUALIFIED_LITERAL</result></response>');
  }
  throw Error('fictional_unexpected_usage_route');
 };
 return {client:new AcademyHttpClient(principal,transport),calls};
}

test('usage contract binds exact unique selected IDs, memo/date and original three-field ordered serialization',()=>{
 const input=usageInput(24),request=lectureUsageRequest(input),params=new URLSearchParams(request.body);
 expect([...params.keys()]).toEqual(['reqCmd','keyword_title','exam_list']);expect(params.get('reqCmd')).toBe('SaveLectureUseLog');
 expect(params.get('keyword_title')).toBe(input.keywordTitle);expect(params.get('exam_list')).toBe(input.lectureKeys.map(key=>'1|,|'+key).join('<BR>'));
 expect(params.has('date')).toBe(false);expect(Object.isFrozen(request.lectureKeys)).toBe(true);
 for(const mutate of [(v:any)=>{v.lectureKeys=[];},(v:any)=>{v.lectureKeys.push(...v.lectureKeys);},(v:any)=>{v.lectureKeys[1]=v.lectureKeys[0];},
  (v:any)=>{v.lectureKeys[0]='09900001';},(v:any)=>{v.lectureKeys[0]=['9900001'];},(v:any)=>{v.keywordTitle='';},(v:any)=>{v.keywordTitle=' memo';},
  (v:any)=>{v.keywordTitle='x'.repeat(129);},(v:any)=>{v.date='2026-02-30';},(v:any)=>{v.creator='Spoofed';}]){
  const bad=structuredClone(input);mutate(bad);expect(()=>lectureUsageRequest(bad)).toThrow();
 }
 expect(lectureUsageDateAt(new Date('2026-10-19T16:00:00Z'))).toBe('2026-10-20');
});

test('usage source guard pins read/write functions and callback without running original eval or handlers',()=>{
 expect(qualifyLectureUsageTab(usageTab(),sourceDomParser.parseFromString).functions).toHaveLength(4);
 expect((globalThis as any).usageScriptExecuted).toBeUndefined();
 for(const bad of [usageTab().replace('GetLectureListLog','DeleteLectureListLog'),usageTab().replace('jsRequest5.open("GET"','jsRequest5.open("POST"'),
  usageTab().replace('SaveLectureUseLog','SaveOtherLog'),usageTab().replace('"result_ok"','"ok"'),usageTab().replace('"<BR>"','"\\n"'),
  usageTab().replace('</script>','showUseLog=other;</script>'),usageTab().replace('name="keyword_title"','name="other"')])expect(()=>qualifyLectureUsageTab(bad,sourceDomParser.parseFromString)).toThrow();
});

test('XML usage payload is decoded as literals, filtered to exact memo/date and keeps duplicate assessment numbers',()=>{
 const expected=lectureUsageExpectation(usageInput()),result=inspectLectureUsageHistory(usageXml(usageRecords(true)),expected.lectureKeys[0]!,expected,sourceDomParser.parseFromString);
 expect(result.recordCount).toBe(4);expect(result.matched).toHaveLength(2);expect(result.matched.map(row=>row.assNo)).toEqual(['1003','1003']);
 expect(JSON.stringify(result)).not.toContain('UNRELATED_PRIVATE');expect(result.unknownTargetDateCount).toBe(0);
 const unknown=inspectLectureUsageHistory(usageXml([{ass_no:1003,title:expected.keywordTitle,use_date:'19/10/2026'}]),expected.lectureKeys[0]!,expected,sourceDomParser.parseFromString);
 expect(unknown.matched).toEqual([]);expect(unknown.unknownTargetDateCount).toBe(1);expect(unknown.dateFormatCounts.unqualified).toBe(1);
 for(const payload of ["{ass_no:'1',title:(globalThis.usageEvaluated=true),use_date:'2026-10-19'}", "{ass_no:'1',title:'x',use_date:'2026-10-19',get extra(){return 1}}", "...other", "{ass_no:'1',title:'x',use_date:'2026-10-19',nested:{id:1}}", "{ass_no:'1',ass_no:'2',title:'x',use_date:'2026-10-19'}"]){
  expect(()=>inspectLectureUsageHistory('<r><result>result_ok</result><lectureList><![CDATA['+payload+']]></lectureList></r>',expected.lectureKeys[0]!,expected,sourceDomParser.parseFromString)).toThrow();
 }
 expect((globalThis as any).usageEvaluated).toBeUndefined();
 for(const xml of ['<!DOCTYPE r>'+usageXml([]),usageXml([],'no_logs'),'<r><result>result_ok</result></r>','<input type="password">',usageXml([]).replace('</response>','<result>result_ok</result></response>')])expect(()=>inspectLectureUsageHistory(xml,expected.lectureKeys[0]!,expected,sourceDomParser.parseFromString)).toThrow();
 expect(()=>inspectLectureUsageHistory(usageXml([]),'9999999',expected,sourceDomParser.parseFromString)).toThrow('question_out_of_scope');
 expect(()=>inspectLectureUsageHistory('x'.repeat(2_000_001),expected.lectureKeys[0]!,expected,sourceDomParser.parseFromString)).toThrow('response_invalid');
});

test('observed dotted history calendar dates match exact memo and day without accepting other date grammars',()=>{
 const input={...usageInput(),date:'2026-10-19'},expected=lectureUsageExpectation(input),key=expected.lectureKeys[0]!;
 const inspect=(date:string)=>inspectLectureUsageHistory(usageXml([{ass_no:0,title:input.keywordTitle,use_date:date}]),key,expected,sourceDomParser.parseFromString);
 expect(inspect('2026.10.19')).toMatchObject({matched:[{assNo:0,title:input.keywordTitle,useDate:'2026.10.19'}],unknownTargetDateCount:0,dateFormatCounts:{accepted:1,unqualified:0}});
 expect(inspect('2026.10.18').matched).toHaveLength(0);
 for(const date of ['2026.02.30','2026.13.19','2026.10.19.','2026.10.19 10:00:00','2026/10/19',' 2026.10.19'])expect(inspect(date)).toMatchObject({matched:[],unknownTargetDateCount:1,dateFormatCounts:{accepted:0,unqualified:1}});
});

test('only observed result_fail with one exactly empty list means no history; other failure shapes stay refused',()=>{
 const expected=lectureUsageExpectation(usageInput()),key=expected.lectureKeys[0]!;
 const xml='<root><result>result_fail</result><lectureList></lectureList></root>';
 expect(inspectLectureUsageHistory(xml,key,expected,sourceDomParser.parseFromString)).toMatchObject({lectureKey:key,recordCount:0,matched:[],unknownTargetDateCount:0,sourceResult:'result_fail',historyState:'no_history_reported_by_source'});
 for(const raw of [xml.replace('</lectureList>',"{ass_no:1003,title:'memo',use_date:'2026-10-19'}</lectureList>"),xml.replace('</lectureList>',' </lectureList>'),xml.replace('</lectureList>','<record/></lectureList>'),xml.replace('<lectureList></lectureList>',''),xml.replace('result_fail','result_error')])expect(()=>inspectLectureUsageHistory(raw,key,expected,sourceDomParser.parseFromString)).toThrow('response_unqualified');
 expect(inspectLectureUsageHistory(usageXml([]),key,expected,sourceDomParser.parseFromString)).not.toHaveProperty('historyState');
});

test('history multiset requires exactly one addition per selected lecture with no removal or substitution',()=>{
 const expected=lectureUsageExpectation(usageInput()),snapshot=(after:boolean)=>({scopeSha256:expected.scopeSha256,date:expected.date,
  histories:expected.lectureKeys.map(key=>inspectLectureUsageHistory(usageXml(usageRecords(after)),key,expected,sourceDomParser.parseFromString))});
 const before=snapshot(false),after=snapshot(true),good=verifyLectureUsageDelta(before,after);
 expect(good.verified).toBe(true);expect(good.perLecture.every(row=>row.addedCount===1&&row.removedCount===0)).toBe(true);
 expect(good.teacherAttribution).toBe('not_returned_by_qualified_history');expect(good.causalAttribution).toBe('not_independently_proven');
 for(const mutate of [(v:any)=>{v.histories[1].matched=[];},(v:any)=>{v.histories[0].matched.push(v.histories[0].matched[0]);},
  (v:any)=>{for(const record of v.histories[0].matched)record.assNo='changed';},(v:any)=>{v.histories[0].unknownTargetDateCount=1;},
  (v:any)=>{v.histories.reverse();},(v:any)=>{v.scopeSha256='a'.repeat(64);},(v:any)=>{v.histories[1].lectureKey=v.histories[0].lectureKey;}]){
  const changed=structuredClone(after);mutate(changed);expect(verifyLectureUsageDelta(before,changed).verified).toBe(false);
 }
 expect(verifyLectureUsageDelta({...before,histories:[]},{...after,histories:[]}).verified).toBe(false);
});

test('public usage reader uses fresh qualified Tab and exact selected GETs without exports of other histories',async()=>{
 const {client,calls}=usageFake();try{
  await authenticate(client);const result=await client.readLectureUsageHistory(usageInput());expect(result.academyWrites).toBe(0);expect(result.histories).toHaveLength(3);
  expect(result.histories.every(row=>row.matched.length===1)).toBe(true);expect(JSON.stringify(result)).not.toContain('UNRELATED_PRIVATE');expect(saveCalls(calls)).toHaveLength(0);
  expect(calls.slice(3).map(call=>call.path)).toEqual(['/common/etest_pool.jsp',...usageInput().lectureKeys.map(key=>'/servlet/controller.common.TestPageShowExServlet?p_process=GetLectureListLog&lecture_key='+key)]);
 }finally{client.close();}
});

test('single usage write waits for journal and proves plus1 for every lecture without interpreting save result value',async()=>{
 const {client,calls}=usageFake();let journals=0;try{
  await authenticate(client);const result=await client.saveLectureUsageLog(usageInput(),async admission=>{
   journals++;expect(saveCalls(calls)).toHaveLength(0);expect(admission.bodySha256).toBe(lectureUsageRequest(usageInput()).bodySha256);
   expect(admission.baselineSha256).toMatch(/^[a-f0-9]{64}$/);expect(admission.automaticRetryAllowed).toBe(false);
  });
  expect(result.status).toBe('usage_saved_readback_matched');expect(result.comparison.verified).toBe(true);expect(result.saveResponseValueUsedAsSuccessPredicate).toBe(false);
  expect(result.saveRequestsSubmitted).toBe(1);expect(result.acceptance).toBe('not_inferred');expect(journals).toBe(1);expect(saveCalls(calls)).toHaveLength(1);
  expect(calls.filter(call=>call.path.startsWith('/servlet/controller.common.TestPageShowExServlet'))).toHaveLength(6);expect(JSON.stringify(result)).not.toContain('UNRELATED_PRIVATE');
  await expect(client.saveLectureUsageLog(usageInput(),async()=>{})).rejects.toThrow('already_consumed');expect(saveCalls(calls)).toHaveLength(1);
 }finally{client.close();}
});

test('missing journal, source drift, unsupported baseline date or wrong current date cannot submit usage POST',async()=>{
 const f=usageFake();try{await authenticate(f.client);let failure:unknown;try{await f.client.saveLectureUsageLog(usageInput(),async()=>{throw Error('fictional_journal_failed');});}catch(error){failure=error;}
  expect(failure).toBeInstanceOf(LectureUsageWriteFailure);expect(failure).toMatchObject({phase:'dispatch_journal',dispatchAttempted:false,unknownOutcome:false});expect(saveCalls(f.calls)).toHaveLength(0);
 }finally{f.client.close();}
 for(const options of [{tab:()=>usageTab().replace('GetLectureListLog','DeleteLog')},{history:()=>new Response(usageXml([{ass_no:'1',title:usageInput().keywordTitle,use_date:'unqualified'}]))},
  {history:()=>new Response(usageXml(Array.from({length:500},()=>({ass_no:'1003',title:usageInput().keywordTitle,use_date:usageInput().date}))))}]){
  const current=usageFake(options);try{await authenticate(current.client);await expect(current.client.saveLectureUsageLog(usageInput(),async()=>{})).rejects.toThrow('lecture_usage_write_failed');expect(saveCalls(current.calls)).toHaveLength(0);}finally{current.client.close();}
 }
 const stale=usageFake();try{await authenticate(stale.client);const count=stale.calls.length;await expect(stale.client.saveLectureUsageLog({...usageInput(),date:'2025-10-19'},async()=>{})).rejects.toThrow('current_date_required');expect(stale.calls).toHaveLength(count);}finally{stale.client.close();}
 const concurrent=usageFake();try{await authenticate(concurrent.client);const results=await Promise.allSettled([concurrent.client.saveLectureUsageLog(usageInput(),async()=>{}),concurrent.client.saveLectureUsageLog(usageInput(),async()=>{})]);expect(results.filter(row=>row.status==='fulfilled')).toHaveLength(1);expect(saveCalls(concurrent.calls)).toHaveLength(1);}finally{concurrent.client.close();}
});

test('HTTP200 without each plus1 remains unknown; recovery reads current history without another write',async()=>{
 const noChange=usageFake({history:()=>new Response(usageXml(usageRecords(false)))});try{await authenticate(noChange.client);let failure:unknown;try{await noChange.client.saveLectureUsageLog(usageInput(),async()=>{});}catch(error){failure=error;}
  expect(failure).toBeInstanceOf(LectureUsageWriteFailure);expect(failure).toMatchObject({phase:'readback',dispatchAttempted:true,unknownOutcome:true,remoteOutcome:'unknown_after_dispatch'});
  expect((failure as LectureUsageWriteFailure).readback?.histories).toHaveLength(3);expect(saveCalls(noChange.calls)).toHaveLength(1);
  await expect(noChange.client.saveLectureUsageLog(usageInput(),async()=>{})).rejects.toThrow('already_consumed');expect(saveCalls(noChange.calls)).toHaveLength(1);
 }finally{noChange.client.close();}
 const transportFailed=usageFake({save:()=>new Response('unavailable',{status:503})});try{await authenticate(transportFailed.client);let failure:LectureUsageWriteFailure|undefined;
  try{await transportFailed.client.saveLectureUsageLog(usageInput(),async()=>{});}catch(error){failure=error as LectureUsageWriteFailure;}
  expect(failure?.unknownOutcome).toBe(true);expect(failure?.baseline?.histories).toHaveLength(3);
  const readback=await transportFailed.client.readLectureUsageHistory(usageInput());expect(verifyLectureUsageDelta(failure!.baseline!,readback).verified).toBe(true);expect(saveCalls(transportFailed.calls)).toHaveLength(1);
 }finally{transportFailed.client.close();}
});

test('usage authentication refusals latch closed before or after dispatch without retry',async()=>{
 for(const after of [false,true])for(const status of [401,403,302]){
  const failureResponse=()=>new Response('',{status,headers:status===302?{Location:'/c_login.jsp'}:{}});
  const f=usageFake(after?{save:failureResponse}:{history:failureResponse});try{await authenticate(f.client);let failure:unknown;try{await f.client.saveLectureUsageLog(usageInput(),async()=>{});}catch(error){failure=error;}
   expect(failure).toMatchObject({dispatchAttempted:after,unknownOutcome:after});expect(f.client.authenticated).toBe(false);expect(saveCalls(f.calls)).toHaveLength(after?1:0);
   const count=f.calls.length;await expect(f.client.readLectureUsageHistory(usageInput())).rejects.toThrow('authentication_required');expect(f.calls).toHaveLength(count);
  }finally{f.client.close();}
 }
});

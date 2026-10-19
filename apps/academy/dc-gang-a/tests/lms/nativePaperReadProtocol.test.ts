import {expect,test} from 'bun:test';
import {AcademyHttpClient,AcademyHttpFailure,sourceDomParser,type SourceTransport} from '../../src/lms/academyHttpClient';
import {qualifyNativePaperInputReference,qualifyNativePaperOptionsTemplate,inspectNativePaperOptionsResponse,NATIVE_PAPER_INPUT_PATH,NATIVE_PAPER_OPTIONS_PATH} from '../../src/lms/nativePaperReadProtocol';
import {digest} from '../../src/learning/model';

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

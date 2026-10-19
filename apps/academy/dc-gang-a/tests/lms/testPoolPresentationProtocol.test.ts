import {expect,test} from 'bun:test';
import {AcademyHttpClient,sourceDomParser} from '../../src/lms/academyHttpClient';
import {inspectTestPoolPresentationProtocol} from '../../src/lms/testPoolPresentationProtocol';
import {testPoolPreviewSourcePins} from '../../src/lms/testPoolQuestionPreview';
import {testPoolReadRequest} from '../../src/lms/testPoolReadProtocol';
import {digest} from '../../src/learning/model';

const selector=`<!doctype html><script src="/js/common_function.js"></script>
<input type="hidden" name="teacher_key" value="unrequested-private-control">
<label for="difficulty">난이도 원문</label><select id="difficulty" name="searchConditionDifficulty" onchange="onDifficulty(this.value)">
<option value="M">중</option><option value="H" selected>상 </option><option value="T">최상</option></select>
<label for="response">응답 형식</label><input id="response" name="exam_type" type="radio" value="native-response" onclick="onExamType(this.value)">
<button id="desOption" onclick="previewDBExam(123)">서술형 원문</button>
<script>
var make_school_key=0;var category_iden="SYNTHETIC";var categ_type="0";
var g_examtype_filter="all";var searchConditionDifficulty=0;var searchConditionBehAreaNo=0;
$("#dbExamListGrid").jqGrid({colNames:["난이도 원문","형식 원문","정답"],colModel:[
{name:"difficulty",index:"difficulty",formatter:dbFormatterDifficultyCell},
{name:"sel_type",formatter:dbFormatterTypesCell},{name:"answer"}]});
function dbFormatterDifficultyCell(value){switch(value){case "H":return "상";default:return "기타 원문";}}
function dbFormatterTypesCell(value){return "형식 원문";}
function previewDBExam(key){throw new Error("must remain inert");}
globalThis.testPoolPresentationExecuted=true;fetch("https://unrequested.invalid/never");
</script>`;
const helpers=`function getExamPath(key){return "/data/contents/exam/";}
function getExamCardImageFileName(key,type){return key+"-examcard-"+type+".png";}
globalThis.testPoolHelperExecuted=true;fetch("https://unrequested.invalid/helper");`;
const inspect=(html=selector,text=helpers)=>inspectTestPoolPresentationProtocol(html,text,sourceDomParser.parseWithSourceLocations);

test('presentation observations preserve literal choices, exact labels and source ranges without executing scripts',()=>{
  const result=inspect();
  const difficulty=result.controls.find(control=>control.id==='difficulty')!;
  expect(difficulty.labelExact).toBe('난이도 원문');
  expect(difficulty.handlerReferences).toEqual(['onDifficulty']);
  expect(difficulty.options.map(option=>[option.valueRaw,option.labelExact,option.selected])).toEqual([['M','중',false],['H','상 ',true],['T','최상',false]]);
  expect(selector.slice(difficulty.sourceRange.start,difficulty.sourceRange.end)).toStartWith('<select');
  for(const option of difficulty.options)expect(selector.slice(option.sourceRange.start,option.sourceRange.end)).toContain('value="'+option.valueRaw+'"');
  expect(result.controls.find(control=>control.id==='response')!.valueRaw).toBe('native-response');
  expect(result.gridColumns.map(column=>[column.name,column.labelExact,column.formatterReference,column.formatterKind])).toEqual([
    ['difficulty','난이도 원문','dbFormatterDifficultyCell','reference'],['sel_type','형식 원문','dbFormatterTypesCell','reference'],['answer','정답',null,'absent']]);
  const formatter=result.functionEvidence.find(row=>row.name==='dbFormatterDifficultyCell')!;
  expect(formatter.literals.map(row=>row.valueRaw)).toEqual(['H','상','기타 원문']);
  expect(formatter.sourceSha256).toBe(digest(selector.slice(formatter.sourceRange.start,formatter.sourceRange.end)));
  const helper=result.functionEvidence.find(row=>row.name==='getExamCardImageFileName')!;
  expect(helper.source).toBe('helpers');expect(helper.sourceSha256).toBe(digest(helpers.slice(helper.sourceRange.start,helper.sourceRange.end)));
  expect(result.filterDeclarations.find(row=>row.name==='searchConditionDifficulty')!.valueRaw).toBe(0);
  expect(result.rangeUnit).toBe('utf16_code_units');expect(result.sourceHandlersExecuted).toBe(false);expect(result.academyWrites).toBe(0);
  expect((globalThis as Record<string,unknown>).testPoolPresentationExecuted).toBeUndefined();
  expect((globalThis as Record<string,unknown>).testPoolHelperExecuted).toBeUndefined();
  expect(JSON.stringify(result)).not.toContain('unrequested-private-control');expect(JSON.stringify(result)).not.toContain('unrequested.invalid');
});

test('changed source hashes retain original pins and unknown meanings instead of auto-qualifying mappings',()=>{
  const result=inspect();
  expect(result.selectorSha256).toBe(digest(selector));expect(result.helpersSha256).toBe(digest(helpers));
  expect(result.sourcePins).toEqual({expectedSelectorSha256:testPoolPreviewSourcePins.selector,expectedHelpersSha256:testPoolPreviewSourcePins.helpers,
    selectorMatches:false,helpersMatch:false,qualification:'source_changed_unqualified'});
  expect(result.difficultyMapping).toBe('not_normalized');expect(result.responseFormatMapping).toBe('not_normalized');
  expect(result.unknowns).toContain('source_revisions_differ_from_preview_qualification_pins');
  expect(result.unknowns).toContain('literal_values_and_labels_do_not_establish_code_semantics');
  expect(result.unknowns).toContain('question_and_solution_content_roles_not_normalized');
});

test('dynamic or malformed source remains unqualified and never becomes inferred control or formatter meaning',()=>{
  const dynamic=selector.replace('formatter:dbFormatterDifficultyCell','formatter:chooseFormatter()');
  const result=inspect(dynamic);
  expect(result.gridColumns[0]!.formatterKind).toBe('dynamic');expect(result.gridColumns[0]!.formatterReference).toBeNull();
  expect(result.unknowns).toContain('question_grid_formatter_dynamic');
  const broken=inspect(selector.replace('var make_school_key=0;','var make_school_key=;'));
  expect(broken.unknowns).toContain('selector_script_parse_unqualified');
  expect(broken.unknowns).toContain('preview_function_not_observed:previewDBExam');
  expect(()=>inspect(selector.replace('name:"difficulty",index:', 'name:"difficulty",name:"other",index:'))).toThrow('test_pool_presentation_property_ambiguous');
  expect(()=>inspect('<form><input type="password"></form>')).toThrow('test_pool_authentication_required');
});

test('presentation parsing rejects oversized sources, documents, option sets and function evidence',()=>{
  expect(()=>inspect('x'.repeat(2_000_001))).toThrow('test_pool_presentation_source_limit');
  expect(()=>inspect(selector,'x'.repeat(2_000_001))).toThrow('test_pool_presentation_source_limit');
  expect(()=>inspect('<select name="difficulty">'+Array.from({length:101},(_,i)=>'<option value="'+i+'">choice</option>').join('')+'</select>')).toThrow('test_pool_presentation_option_limit');
  expect(()=>inspect('<i></i>'.repeat(20_001))).toThrow('test_pool_presentation_document_limit');
  expect(()=>inspect(selector,helpers+'function dbFormatterDifficultyCell(){/*'+'x'.repeat(32_001)+'*/return "unknown";}')).toThrow('test_pool_presentation_function_size_limit');
});

test('presentation native requests accept only root-scoped protocol reads and reject arbitrary fields',()=>{
  const request={operation:'protocol',scope:{cl1:0,cl2:0,cl3:0,cl4:0}};
  expect(testPoolReadRequest(request).operation).toBe('protocol');
  for(const invalid of [{...request,scope:{cl1:3,cl2:0,cl3:0,cl4:0}},{...request,url:'https://unrequested.invalid'},
    {...request,password:'not-admitted'},{...request,page:1},{...request,expectedSelectorSha256:'changed'}])expect(()=>testPoolReadRequest(invalid)).toThrow();
});

const principal='<span>로그아웃</span><form name="userForm"><input name="pri_no" value="99001"></form><form name="form1"><input name="g_pri_no" value="99001"><input name="g_clg_no" value="88001"><input name="g_mem_type" value="teacher"></form>';
const login='<form id="loginForm" name="loginForm" method="post">'+['p_process','p_prino','p_groupno','userpwd','userid','cf_pc','cf_user','autoLoginCheck','autoLoginKey'].map(name=>'<input name="'+name+'">').join('')+'</form><script>document.loginForm.action = "/servlet/controller.login.LoginServlet"; document.loginForm.p_process.value = "c_login";</script>';

test('authenticated protocol inspection fetches only fixed selector/helper reads and never exports credential or private control values',async()=>{
  const calls:{path:string;method:string}[]=[];
  const client=new AcademyHttpClient({teacherLabel:'Invented Teacher',teacherKey:'99001',collegeKey:'88001'},async(url,init)=>{
    const target=new URL(url);calls.push({path:target.pathname,method:init.method??'GET'});
    if(target.pathname==='/c_login.jsp')return new Response(login);
    if(target.pathname==='/servlet/controller.login.LoginServlet')return new Response('');
    if(target.pathname==='/servlet/controller.coursemanage.CourseManageServlet')return new Response(principal);
    if(target.pathname==='/common/testpage/testpage_select_hwp.jsp')return new Response(selector);
    if(target.pathname==='/js/common_function.js')return new Response(helpers);
    throw Error('unexpected_source_route');
  });
  try{
    await expect(client.inspectTestPoolPresentationProtocol()).rejects.toThrow('authentication_required');expect(calls).toHaveLength(0);
    await client.authenticate({username:'invented-user',password:'invented-password'});
    const result=await client.inspectTestPoolPresentationProtocol(digest(selector));
    expect(result.sourceOperation).toBe('test_pool_presentation_protocol');expect(result.sourcePins.qualification).toBe('source_changed_unqualified');
    expect(calls).toEqual([{path:'/c_login.jsp',method:'GET'},{path:'/servlet/controller.login.LoginServlet',method:'POST'},
      {path:'/servlet/controller.coursemanage.CourseManageServlet',method:'GET'},{path:'/common/testpage/testpage_select_hwp.jsp',method:'GET'},{path:'/js/common_function.js',method:'GET'}]);
    expect(JSON.stringify(result)).not.toContain('invented-password');expect(JSON.stringify(result)).not.toContain('unrequested-private-control');
    await expect(client.inspectTestPoolPresentationProtocol('0'.repeat(64))).rejects.toThrow('test_pool_selector_source_changed');
    expect(calls).toHaveLength(5);
  }finally{client.close();}
});

test('unqualified or foreign helper references are refused before fetching a script',async()=>{
  let requests=0;
  const client=new AcademyHttpClient({teacherLabel:'Invented Teacher',teacherKey:'99001',collegeKey:'88001'},async()=>new Response(++requests===1?login:requests<=3?principal:selector.replace('src="/js/common_function.js"','src="https://foreign.invalid/js/common_function.js"')));
  try{
    await client.authenticate({username:'invented-user',password:'invented-password'});
    await expect(client.inspectTestPoolPresentationProtocol()).rejects.toThrow('test_pool_preview_script_unqualified');
    expect(requests).toBe(4);
  }finally{client.close();}
});

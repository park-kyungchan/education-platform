import {testPoolQuestionPreviewReferences,testPoolPreviewSourcePins} from '../../src/lms/testPoolQuestionPreview';
import {expect,test} from 'bun:test';
import {testPoolScope,testPoolReadRequest,parseTestPoolCategories,parseTestPoolTypeLabels,qualifyTestPoolTypeTemplate,extractTestPoolLabelPayload,parseTestPoolQuestions,qualifyTestPoolQuestionTemplate} from '../../src/lms/testPoolReadProtocol';
const scope={cl1:3,cl2:5,cl3:7,cl4:0};
test('exact source category tuples and numeric keys survive without a guessed hierarchy',()=>{
  const rows=parseTestPoolCategories([{key:17,title:'원문 라벨',...scope,isFolder:true,isLazy:true}],{cl1:3,cl2:0,cl3:0,cl4:0});
  expect(rows[0]).toEqual({nativeKey:17,title:'원문 라벨',scope,isFolder:true,isLazy:true});
  expect(()=>parseTestPoolCategories([{key:17,title:'외부 범위',...scope,cl1:4,isFolder:true,isLazy:true}],{cl1:3,cl2:0,cl3:0,cl4:0})).toThrow('test_pool_category_scope_conflict');
  expect(()=>testPoolScope({...scope,reqCmd:'SaveTestPool'})).toThrow();
  expect(()=>testPoolScope({cl1:3,cl2:0,cl3:1,cl4:0})).toThrow('test_pool_scope_hierarchy_gap');
});
test('question pages require an exact type, bounded request, matching pagination and unique item identity',()=>{
  const request={operation:'questions',scope,patNo:'23',page:1,limit:2};expect(testPoolReadRequest(request).patNo).toBe('23');
  for(const bad of [{...request,limit:100},{...request,patNo:'23&Save=1'},{...request,page:0}])expect(()=>testPoolReadRequest(bad)).toThrow();
  const row={lecture_key:1001,pat_no:23,pat_name:'원문 유형',unit_name:'원문 단원',answer:'<script>untrusted()</script>',use_log:'private usage not exported'};
  const page={page:1,total:1,records:1,rows:[row]};
  const parsed=parseTestPoolQuestions(page,'23',1,2);expect(parsed.questions[0]!.lectureKey).toBe('1001');
  expect(parsed.questions[0]!.sourceFields.answer).toBe(row.answer);expect(parsed.questions[0]!.sourceFields.use_log).toBeUndefined();
  expect(()=>parseTestPoolQuestions(page,'24',1,2)).toThrow('test_pool_question_type_conflict');
  expect(()=>parseTestPoolQuestions({...page,rows:[row,row],records:2},'23',1,2)).toThrow('test_pool_question_identity_invalid');
  expect(()=>parseTestPoolQuestions({...page,page:2},'23',1,2)).toThrow('test_pool_question_pagination_conflict');
});
test('question filters must come from exact current source declarations',()=>{
  const html='$("#dbExamListGrid").jqGrid({rowNum:50,jsonReader:{root:"rows"}});var g_examtype_filter="all";var searchConditionDifficulty=0;var searchConditionBehAreaNo=0;url="/servlet/controller.common.TestPageShowExServlet?p_process=GetExamList&category_iden="+c+"&make_school_key="+s+"&cl1="+a+"&cl2="+b+"&cl3="+c+"&cl4="+d+"&exam_type="+e+"&difficulty="+f+"&pat_no="+p+"&beh_no="+h;';
  expect(qualifyTestPoolQuestionTemplate(html).defaults.g_examtype_filter).toBe('all');
  expect(()=>qualifyTestPoolQuestionTemplate(html.replace('var g_examtype_filter="all";',''))).toThrow('test_pool_question_default_unqualified');
  expect(()=>qualifyTestPoolQuestionTemplate(html.replace('&beh_no=','&save='))).toThrow('test_pool_question_template_fields_changed');
});
test('native requests admit only explicit label/category reads and qualified scope before authentication',()=>{
  expect(testPoolReadRequest({operation:'labels',scope}).operation).toBe('labels');
  for(const request of [{operation:'SaveTestPool',scope},{operation:'labels',scope:{cl1:3,cl2:0,cl3:0,cl4:0}},
    {operation:'categories',scope,username:'foreign'},{operation:'categories',scope,expectedSelectorSha256:'invented'}])expect(()=>testPoolReadRequest(request)).toThrow();
});
test('source sentinel frames preserve JSON and reject ambiguous, reversed and executable payloads',()=>{
  expect(extractTestPoolLabelPayload('##START_DATA##{"result":"OK","pat_list":[]}##END_DATA##').value).toEqual({result:'OK',pat_list:[]});
  for(const body of ['{}','##END_DATA####START_DATA##{}','##START_DATA##{}##START_DATA####END_DATA##','##START_DATA##process.exit()##END_DATA##'])expect(()=>extractTestPoolLabelPayload(body)).toThrow();
});
test('labels preserve IDs, exact text and counts without inferring difficulty or membership',()=>{
  const rows=parseTestPoolTypeLabels({result:'OK',pat_list:[{pat_no:23,pat_name:'원문 <라벨>',cnt:'007'}]});
  expect(rows).toEqual([{nativeId:23,labelExact:'원문 <라벨>',sourceQuestionCountRaw:'007'}]);
  expect(()=>parseTestPoolTypeLabels({result:'OK',pat_list:[{pat_no:23,pat_name:'가',cnt:1},{pat_no:23,pat_name:'나',cnt:1}]})).toThrow('duplicate_test_pool_label');
  expect(()=>parseTestPoolTypeLabels({result:'FAILED',pat_list:[]})).toThrow('test_pool_label_response_invalid');
});
test('type request source must declare the qualified exact query field set',()=>{
  const source='url="/servlet/controller.common.TestPageShowExServlet?p_process=GetTypeTotal&category_iden="+c+"&cl1="+a+"&cl2="+b+"&cl3="+c+"&cl4="+d+"&make_school_key="+s;';
  expect(qualifyTestPoolTypeTemplate(source).queryFields).toHaveLength(7);
  expect(()=>qualifyTestPoolTypeTemplate(source.replace('&cl4=','&create='))).toThrow('test_pool_type_template_fields_changed');
  expect(()=>qualifyTestPoolTypeTemplate('')).toThrow('test_pool_type_template_unqualified');
});
test('original preview references require exact source revisions and source-declared formats',()=>{
  const refs=testPoolQuestionPreviewReferences('12345678',{obj_option:'Y',sbj_option:'N',des_option:'D'},testPoolPreviewSourcePins.selector,testPoolPreviewSourcePins.helpers);
  expect(refs.map(ref=>ref.type)).toEqual(['obj','des']);
  expect(refs[1]!.url).toBe('https://storage.studyq.net/data/contents/exam/d6-012/d4-34/d2-56/ek-12345678/12345678-examcard-des.png');
  expect(()=>testPoolQuestionPreviewReferences('12345678',{},'changed',testPoolPreviewSourcePins.helpers)).toThrow('test_pool_preview_source_unqualified');
  expect(()=>testPoolQuestionPreviewReferences('../other',{},testPoolPreviewSourcePins.selector,testPoolPreviewSourcePins.helpers)).toThrow('test_pool_preview_key_unqualified');
});

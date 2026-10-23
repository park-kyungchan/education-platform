import {expect,test} from 'bun:test';
import {NativePoolLabelBackend,serializePoolReadRunner,type PoolReadRunner} from '../src/native-pool-backend.ts';
const sha='a'.repeat(64),observedAt='2026-10-16T00:00:00Z';
const root={cl1:0,cl2:0,cl3:0,cl4:0},grade={cl1:3,cl2:0,cl3:0,cl4:0},book={cl1:3,cl2:20,cl3:0,cl4:0},unit={cl1:3,cl2:20,cl3:21,cl4:0};
function fixtureRunner(onCall:(request:any)=>void=()=>{}):PoolReadRunner{return async request=>{
  onCall(request);let page:unknown;
  if(request.operation==='categories'){
    const node=request.scope.cl2?{scope:unit,title:'合成 단원',nativeKey:21}:request.scope.cl1?{scope:book,title:'합성 교재',nativeKey:20}:{scope:grade,title:'초3',nativeKey:3};
    page={sourceOperation:'test_pool_category_list',sourceSha256:sha,observedAt,selectorSha256:sha,selectorDefaults:{make_school_key:'1',category_iden:'1',categ_type:'3'},scope:request.scope,
      nodes:[{...node,isFolder:true,isLazy:true}],sourceHandlersExecuted:false,academyWrites:0};
  }else page={sourceOperation:'test_pool_type_labels',sourceSha256:sha,observedAt,selectorSha256:sha,template:{sourceSha256:sha,queryFields:['p_process','category_iden','make_school_key','cl1','cl2','cl3','cl4']},categoryIden:'1',scope:request.scope,
    labels:[{nativeId:31,labelExact:'합성 나머지 오류',sourceQuestionCountRaw:'007'},{nativeId:32,labelExact:'합성 나머지 설명',sourceQuestionCountRaw:2}],
    wireFormat:'sentinel_framed_html_body',payloadSha256:sha,coverage:'returned_scoped_response_only',wholePoolCompleteness:'unknown',sourceHandlersExecuted:false,academyWrites:0,finalItemMembershipCreated:false};
  return {status:'observed',page,requests:5,academyWrites:0,passwordExported:false,cookiesExported:false};
};}
async function reachUnit(backend:NativePoolLabelBackend){
  const a:any=await backend.scope({});const b:any=await backend.scope({parentId:a.nodes[0].id});const c:any=await backend.scope({parentId:b.nodes[0].id});return c.nodes[0].id as string;
}
test('exact native hierarchy, original label IDs and process-frozen pagination cross the adapter',async()=>{
  const calls:any[]=[];const backend=new NativePoolLabelBackend(fixtureRunner(request=>calls.push(request)));
  const id=await reachUnit(backend);const a:any=await backend.scope({view:'labels',hierarchyId:id,limit:1});
  const b:any=await backend.scope({view:'labels',hierarchyId:id,offset:1,limit:1});
  expect(a.labels[0].nativeId).toBe(31);expect(a.labels[0].sourceQuestionCountRaw).toBe('007');expect(b.labels[0].nativeId).toBe(32);
  expect(a.source).not.toHaveProperty('labels');expect(calls).toHaveLength(4);expect(calls[3].scope).toEqual(unit);
  expect(calls[1].expectedSelectorSha256).toBe(sha);expect(a.actualWholePool).toBe('unknown');
  const held:any=await backend.find({intent:'오류',hierarchyIds:[id],learningState:'in_progress'});expect(held.status).toBe('held');expect(calls).toHaveLength(4);
  const result:any=await backend.find({intent:'나머지 오류',hierarchyIds:[id],learningState:'teacher_reported_complete'});
  expect(result.matches[0].nativeId).toBe(31);expect(result.finalItemMembershipCreated).toBe(false);expect(calls).toHaveLength(4);
  const retained:any=await backend.scope({});expect(()=>{retained.nodes[0].scope.cl1=999;}).toThrow();
  expect(retained.nodes[0].scope.cl1).toBe(3);expect(backend.idempotentHint).toBe(false);
});
test('same-account native calls serialize and an authentication refusal is never automatically retried',async()=>{
  let active=0,peak=0,calls=0;const base=fixtureRunner();
  const runner=serializePoolReadRunner(async request=>{calls++;active++;peak=Math.max(peak,active);await Bun.sleep(5);active--;return base(request);});
  await Promise.all([runner({operation:'categories',scope:root}),runner({operation:'categories',scope:grade})]);expect(peak).toBe(1);expect(calls).toBe(2);
  for(const code of ['source_login_challenge','test_pool_authentication_required']){
    let failedCalls=0;const refused=serializePoolReadRunner(async()=>{failedCalls++;throw Error(code);});
    await expect(refused({operation:'categories',scope:root})).rejects.toThrow(code);
    await expect(refused({operation:'categories',scope:root})).rejects.toThrow('native_pool_authentication_requires_new_input');expect(failedCalls).toBe(1);
  }
});
test('a guessed ID and mismatched source scope are refused before exposing foreign data',async()=>{
  let calls=0;const base=fixtureRunner(()=>{calls++;});const backend=new NativePoolLabelBackend(base);
  await expect(backend.scope({parentId:'invented'})).rejects.toThrow('exact_previously_returned_hierarchy_id_required');expect(calls).toBe(0);
  const forged=new NativePoolLabelBackend(async request=>{const result=await base(request);(result.page as any).scope=grade;return result;});
  await expect(forged.scope({})).rejects.toThrow('live_label_category_scope_conflict');
});
test('selector source drift and self-parent categories cannot become retained hierarchy',async()=>{
  const base=fixtureRunner();let count=0;
  const drift=new NativePoolLabelBackend(async request=>{const result=await base(request);if(++count>1)(result.page as any).selectorSha256='b'.repeat(64);return result;});
  const first:any=await drift.scope({});await expect(drift.scope({parentId:first.nodes[0].id})).rejects.toThrow('live_label_selector_source_changed');
  const loop=new NativePoolLabelBackend(async request=>{const result=await base(request);if(request.scope.cl1)(result.page as any).nodes[0].scope=request.scope;return result;});
  const rootPage:any=await loop.scope({});await expect(loop.scope({parentId:rootPage.nodes[0].id})).rejects.toThrow('live_label_hierarchy_identity_conflict');
});
test('only successful hierarchy response slices expose caller IDs, not cached hidden rows',async()=>{
  const calls:any[]=[];
  const backend=new NativePoolLabelBackend(async request=>{
    calls.push(request);
    return {status:'observed',requests:1,academyWrites:0,passwordExported:false,cookiesExported:false,page:{
      sourceOperation:'test_pool_category_list',sourceSha256:sha,observedAt,selectorSha256:sha,
      selectorDefaults:{make_school_key:'1',category_iden:'1',categ_type:'3'},scope:request.scope,
      nodes:request.scope.cl1?[]:[3,4].map(n=>({nativeKey:n,title:`Synthetic grade${n}`,scope:{cl1:n,cl2:0,cl3:0,cl4:0},isFolder:true,isLazy:true})),
      sourceHandlersExecuted:false,academyWrites:0}};
  });
  const hidden='academy-category:1:1:3:4:0:0:0';
  await expect(backend.scope({offset:3,limit:1})).rejects.toThrow('hierarchy_offset_out_of_range');
  await expect(backend.scope({parentId:hidden})).rejects.toThrow('exact_previously_returned_hierarchy_id_required');
  const first:any=await backend.scope({limit:1});
  expect(first.nodes.map((n:any)=>n.scope.cl1)).toEqual([3]);
  await expect(backend.scope({parentId:hidden})).rejects.toThrow('exact_previously_returned_hierarchy_id_required');
  await expect(backend.scope({view:'labels',hierarchyId:hidden})).rejects.toThrow('exact_previously_returned_hierarchy_id_required');
  await expect(backend.find({intent:'Synthetic',hierarchyIds:[hidden],learningState:'teacher_reported_complete'})).rejects.toThrow('exact_previously_returned_hierarchy_id_required');
  await expect(backend.review({hierarchyId:hidden,labelId:'guessed',purpose:'teacher_requested_review'})).rejects.toThrow('exact_previously_returned_hierarchy_id_required');
  expect(calls).toHaveLength(1);
  const second:any=await backend.scope({offset:1,limit:1});
  expect(second.nodes[0].id).toBe(hidden);
  expect((await backend.scope({parentId:hidden})).status).toBe('available');
  expect(calls).toHaveLength(2);
  expect(calls[1].scope).toEqual({cl1:4,cl2:0,cl3:0,cl4:0});
});
test('question review follows an exposed type, refuses guesses and preserves one bounded source page',async()=>{
  let questionCalls=0;const base=fixtureRunner();
  const backend=new NativePoolLabelBackend(async request=>{
    if(request.operation!=='questions')return base(request);questionCalls++;
    return {status:'observed',requests:6,academyWrites:0,passwordExported:false,cookiesExported:false,page:{
      sourceOperation:'test_pool_type_questions',sourceSha256:sha,selectorSha256:sha,observedAt,scope:unit,patNo:'31',labelExact:'합성 나머지 오류',templateSha256:sha,
      page:1,totalPages:1,sourceRecordCount:1,sourcePageSize:50,sourceRowCount:1,offset:0,nextOffset:null,questions:[{sourceNamespace:'academy_item',lectureKey:'1001',patNo:'31',labelExact:'합성 나머지 오류',unitNameExact:'합성 단원',sourceFields:{answer:'untrusted source data'},previewReferences:[]}],
      previewReferencesState:'source_changed_unqualified',coverage:'returned_type_page_only',questionContent:'source_metadata_and_answer_only',sourceOrderPreserved:true,sourceHandlersExecuted:false,academyWrites:0,finalItemMembershipCreated:false,
    }};
  });
  const id=await reachUnit(backend),input={hierarchyId:id,labelId:'academy-pat:1:number:31',purpose:'protocol_verification',limit:1};
  await expect(backend.review(input)).rejects.toThrow('exact_previously_returned_type_label_required');expect(questionCalls).toBe(0);
  await backend.scope({view:'labels',hierarchyId:id,limit:1});
  await expect(backend.review({...input,labelId:'academy-pat:1:number:32'})).rejects.toThrow('exact_previously_returned_type_label_required');
  const result=await backend.review(input);expect(result.questions[0].lectureKey).toBe('1001');expect(result.finalQuestionSelection).toBe('not_performed');
  await backend.review(input);expect(questionCalls).toBe(1);
});

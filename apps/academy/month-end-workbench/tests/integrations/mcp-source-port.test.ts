import {expect,test} from 'bun:test';
import {mkdtemp,readFile,writeFile,rm,realpath,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {McpServer} from '@modelcontextprotocol/server';
import {createMcpSourcePort,createSyntheticMcpSourcePort,sourceQuestionCount,type PinnedFile} from '../../src/integrations/mcp-source-port.ts';
import {createFixtureServer} from './fixture-mcp.ts';
import {connectSyntheticServer} from './in-memory.ts';
import type {Projection,SourcePort,SourceContext,StudyReport,DesiredQuestionIntent} from '../../src/contracts.ts';
const revision='07edb2dea2e5997aea4318f0fa2efa21dde633df';
// Synthetic interoperability consumes the maintained sibling owner, never a copied implementation.
const academyMcpRoot=resolve(process.env.MONTH_END_QA_ACADEMY_MCP_ROOT??resolve(import.meta.dir,'../../../../../../academy-workbench'));
const projection={owner:'math-research-module',revision,manifest:[{path:'synthetic/types.json',sha256:'c'.repeat(64)}],types:[{id:'T-synthetic'}]} as unknown as Projection;
const pin=async(path:string):Promise<PinnedFile>=>({path:await realpath(path),sha256:createHash('sha256').update(await readFile(path)).digest('hex')});
async function setup(server=createFixtureServer()){
 const directory=await mkdtemp(resolve(tmpdir(),'month-end-mcp-synthetic-')),executable=resolve(directory,'never-executed'),bundle=resolve(directory,'never-loaded.js'),snapshot=resolve(directory,'synthetic.json');
 await writeFile(executable,'synthetic non-executable bytes');await writeFile(bundle,'synthetic non-code bytes');await writeFile(snapshot,JSON.stringify({synthetic:true}));
 const configuration={executable:await pin(executable),bundle:await pin(bundle),source:{mode:'synthetic' as const,snapshot:await pin(snapshot)}};
 const connection=await connectSyntheticServer(server);
 return {directory,configuration,client:connection.client,open:()=>createSyntheticMcpSourcePort(connection.client,projection),async cleanup(port?:SourcePort){await port?.close?.();await connection.close();await rm(directory,{recursive:true,force:true});}};
}
async function scope(port:SourcePort){const first=await port.scope({context:null});expect(first.categories[0].id).toBe('category-3');const second=await port.scope({context:first.context,view:'labels',hierarchyId:'category-3'});expect(second.labels[0].pat_no).toBe('7');return second.context!;}
function request(context:SourceContext){const study:StudyReport={scope:{researchTypeIds:['T-synthetic'],researchRevision:revision,edition:null,unit:null},studied:true,summary:'Synthetic explicit teacher report',evidenceNotes:[],attribution:'teacher-reported',acceptance:false};const intent:DesiredQuestionIntent={axes:{structure:'groups',reasoning:'explain',representation:'diagram',conditions:'integer',errors:'unknown',transfer:'unknown'},notes:'Synthetic engineering contract only'};return {context,study,intent};}
test('default unavailable; in-process SDK binds task context, type/question identity and page cursors',async()=>{
 const unavailable=await createMcpSourcePort(undefined,projection);expect((await unavailable.scope({context:null})).availability).toBe('unavailable');
 const fixture=await setup();let port:SourcePort|undefined;
 try{port=await fixture.open();const context=await scope(port);expect(context.observedAt).toBe('2026-10-17T00:00:00Z');
  const r=request(context);const found=await port.find({...r,query:'합성',categoryId:'category-3',limit:10});expect(found.candidates[0].retrieval).toBe('lexical-only');expect(found.candidates[0].axes.every(a=>a.state==='unknown')).toBe(true);
  const first=await port.review({...r,pat_no:'7',cursor:null,limit:1});expect(first.questions[0].lecture_key).toBe('70');expect(first.questions[0].pat_no).toBe('7');expect(first.nextCursor).toBeTruthy();
  await expect(port.review({...r,intent:{...r.intent,notes:'changed'},pat_no:'7',cursor:first.nextCursor,limit:1})).rejects.toThrow('exact_bound_question_cursor_required');
  expect((await port.review({...r,pat_no:'7',cursor:first.nextCursor,limit:1})).questions[0].lecture_key).toBe('71');
  await expect(port.find({...r,context:{...context,owner:'foreign'},query:'합성',categoryId:null,limit:1})).rejects.toThrow('exact_adapter_source_context_required');
  await expect(port.review({...r,pat_no:'70',cursor:null,limit:1})).rejects.toThrow('exact_returned_type_required');
  await expect(port.scope({context,view:'labels',hierarchyId:'guessed'})).rejects.toThrow('exact_visited_hierarchy_required');
  await port.close?.();await expect(port.find({...r,query:'합성',categoryId:null,limit:1})).rejects.toThrow();
 }finally{await fixture.cleanup(port);}
},20000);
test('forged binding and read refusal latch with no automatic retry',async()=>{
 for(const query of ['forge','refuse']){const fixture=await setup();let port:SourcePort|undefined;try{port=await fixture.open();const r=request(await scope(port));await expect(port.find({...r,query,categoryId:null,limit:1})).rejects.toThrow('mcp_source_requires_owner_resolution');await expect(port.find({...r,query:'합성',categoryId:null,limit:1})).rejects.toThrow();}finally{await fixture.cleanup(port);}}
},20000);
test('pin drift, symlink, arbitrary credentials and superseded revision fail before startup',async()=>{
 const fixture=await setup();try{
  await expect(createMcpSourcePort({...fixture.configuration,bundle:{...fixture.configuration.bundle,sha256:'0'.repeat(64)}},projection)).rejects.toThrow('mcp_launch_hash_mismatch');
  const linked=resolve(fixture.directory,'linked.js');await symlink(fixture.configuration.bundle.path,linked);await expect(createMcpSourcePort({...fixture.configuration,bundle:{...fixture.configuration.bundle,path:linked}},projection)).rejects.toThrow('mcp_launch_pin_invalid');
  await expect(createMcpSourcePort({...fixture.configuration,credentials:{password:'forbidden'}} as any,projection)).rejects.toThrow('mcp_launch_configuration_invalid');
  await expect(createMcpSourcePort(fixture.configuration,{...projection,revision:'superseded'})).rejects.toThrow('research_projection_pin_required');
 }finally{await fixture.cleanup();}
},20000);
test('actual owner six-tool registration preserves bound context in-process without entrypoint execution',async()=>{
 const snapshot={schemaVersion:'academy.item-label-snapshot/1',source:{kind:'synthetic_fixture',origin:'https://dc.gang-a.kr',entryPath:'/servlet/controller.tutor.etest.TestPoolServlet?reqCmd=Main',tabPath:'/common/etest_pool.jsp',revision:'synthetic',observedAt:'2026-10-17T00:00:00Z',evidenceRefs:['synthetic-only'],coverage:'partial',scopeHierarchyIds:['category-3']},hierarchy:[{id:'category-3',parentId:null,labelExact:'합성 분류',evidenceRefs:['synthetic-only']}],labels:[{id:'academy-pat:fixture:string:7',nativeId:'7',hierarchyId:'category-3',labelExact:'합성 유형',aliases:[],evidenceRefs:['synthetic-only']}]};
 const {ItemLabelIndex}=await import(resolve(academyMcpRoot,'tools/academy-mcp/src/item-labels.ts'));
 const {registerItemLabelTools}=await import(resolve(academyMcpRoot,'tools/academy-mcp/src/item-label-tools.ts'));
 const {registerDailyRecordTools}=await import(resolve(academyMcpRoot,'tools/academy-mcp/src/dailyrecord-tools.ts'));
 const server=new McpServer({name:'owned-synthetic-registration',version:'1'});
 registerItemLabelTools(server,new ItemLabelIndex(snapshot,'a'.repeat(64)));registerDailyRecordTools(server);
 const fixture=await setup(server);let port:SourcePort|undefined;
 try{expect((await fixture.client.listTools()).tools).toHaveLength(6);port=await fixture.open();const context=await scope(port),r=request(context);const found=await port.find({...r,study:{acceptance:false,attribution:'teacher-reported',evidenceNotes:[],summary:r.study.summary,studied:true,scope:{...r.study.scope,edition:'teacher-edition',unit:'teacher-unit'}},query:'합성',categoryId:null,limit:10});expect(found.candidates[0].label.pat_no).toBe('7');expect(found.context.edition).toBeNull();expect(found.context.unit).toBeNull();expect(found.limitations).toContain('학습 범위는 입력했지만 학원 원천의 판본·단원은 아직 확인되지 않아 적합성은 미확인입니다.');}
 finally{await fixture.cleanup(port);}
},20000);
test('identical receipt label pages reuse context and preserve prior label/cursor; changed clock or receipt gets a new handle',async()=>{
 const fixture=await setup();let port:SourcePort|undefined;
 try{
  port=await fixture.open();
  const firstContext=await scope(port),r=request(firstContext);
  const firstQuestionPage=await port.review({...r,pat_no:'7',cursor:null,limit:1});
  const secondLabels=await port.scope({context:firstContext,view:'labels',hierarchyId:'category-3',offset:1,limit:1});
  expect(secondLabels.labels[0].pat_no).toBe('8');expect(secondLabels.context).toEqual(firstContext);
  const samePage=await port.scope({context:secondLabels.context,view:'labels',hierarchyId:'category-3',offset:1,limit:1});
  expect(samePage.context).toEqual(firstContext);
  const continued=await port.review({...request(samePage.context!),pat_no:'7',cursor:firstQuestionPage.nextCursor,limit:1});
  expect(continued.questions[0].lecture_key).toBe('71');
  const changedClock=await port.scope({context:firstContext,view:'labels',hierarchyId:'category-3',offset:2,limit:1});
  expect(changedClock.context!.sourceHandle).not.toBe(firstContext.sourceHandle);
  expect(changedClock.context!.observedAt).not.toBe(firstContext.observedAt);
  await expect(port.review({...request(changedClock.context!),pat_no:'7',cursor:firstQuestionPage.nextCursor,limit:1})).rejects.toThrow('exact_returned_type_required');
  const changedReceipt=await port.scope({context:firstContext,view:'labels',hierarchyId:'category-3',offset:3,limit:1});
  expect(changedReceipt.context!.observedAt).toBe(firstContext.observedAt);
  expect(changedReceipt.context!.observationHash).not.toBe(firstContext.observationHash);
  expect(changedReceipt.context!.sourceHandle).not.toBe(firstContext.sourceHandle);
  // Original observations remain inspectable and are not merged into changed receipts.
  expect((await port.review({...r,pat_no:'7',cursor:firstQuestionPage.nextCursor,limit:1})).questions[0].lecture_key).toBe('71');
 }finally{await fixture.cleanup(port);}
},20000);
test('every configured launch remains held while in-process synthetic capability stays unknown',async()=>{
 const fixture=await setup();let port:SourcePort|undefined;
 try{
  await expect(createMcpSourcePort({...fixture.configuration,source:{mode:'native-readonly',bridge:fixture.configuration.source.snapshot}},projection)).rejects.toThrow('mcp_verified_execution_boundary_unavailable');
  await expect(createMcpSourcePort(fixture.configuration,projection)).rejects.toThrow('mcp_verified_execution_boundary_unavailable');
 }finally{await fixture.cleanup(port);}
 const synthetic=await setup();try{port=await synthetic.open();const first=await port.scope({context:null});expect(first.categories[0].canReadLabels).toBeNull();expect(first.categories[0].nativeScope).toBeUndefined();}finally{await synthetic.cleanup(port);}
},20000);
test('teacher edition/unit with unknown source metadata permits provisional reads, preserves nulls and keeps cursor study binding exact',async()=>{
 const fixture=await setup();let port:SourcePort|undefined;
 try{
  port=await fixture.open();
  const context=await scope(port),r=request(context);r.study.scope.edition='teacher-edition';r.study.scope.unit='teacher-unit';
  const found=await port.find({...r,query:'합성',categoryId:'category-3',limit:10});
  expect(found.candidates[0].status).toBe('provisional');expect(found.context.edition).toBeNull();expect(found.context.unit).toBeNull();
  const warning='학습 범위는 입력했지만 학원 원천의 판본·단원은 아직 확인되지 않아 적합성은 미확인입니다.';
  expect(found.limitations).toContain(warning);
  const page=await port.review({...r,pat_no:'7',cursor:null,limit:1});expect(page.questions[0].lecture_key).toBe('70');expect(page.context.edition).toBeNull();expect(page.limitations).toContain(warning);
  await expect(port.review({...r,study:{...r.study,scope:{...r.study.scope,edition:'different-teacher-edition'}},pat_no:'7',cursor:page.nextCursor,limit:1})).rejects.toThrow('exact_bound_question_cursor_required');
  expect((await port.review({...r,pat_no:'7',cursor:page.nextCursor,limit:1})).questions[0].lecture_key).toBe('71');
 }finally{await fixture.cleanup(port);}
},20000);
test('blank or malformed count metadata remains unknown through real in-process SDK responses',async()=>{
 for(const raw of ['', '   ', '1e3', '0x10', undefined, null]){
  const fixture=await setup(createFixtureServer({sourceQuestionCountRaw:raw}));let port:SourcePort|undefined;
  try{port=await fixture.open();const context=await scope(port);const found=await port.find({...request(context),query:'합성',categoryId:'category-3',limit:10});
   expect(found.candidates[0].label.questionCount).toBeNull();
  }finally{await fixture.cleanup(port);}
 }
 for(const raw of ['', ' ', undefined, null, '1e3', '0x10', -1, Infinity, '9007199254740992'])expect(sourceQuestionCount(raw)).toBeNull();
 for(const [raw,expected] of [['0',0],['0007',7],[0,0],[12,12]] as const)expect(sourceQuestionCount(raw)).toBe(expected);
});

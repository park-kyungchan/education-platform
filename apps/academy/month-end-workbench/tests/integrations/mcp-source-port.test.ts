import {expect,test} from 'bun:test';
import {mkdtemp,readFile,writeFile,rm,realpath,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createMcpSourcePort,type PinnedFile} from '../../src/integrations/mcp-source-port.ts';
import type {Projection,SourcePort,SourceContext,StudyReport,DesiredQuestionIntent} from '../../src/contracts.ts';
const revision='07edb2dea2e5997aea4318f0fa2efa21dde633df';
const projection={owner:'math-research-module',revision,manifest:[{path:'synthetic/types.json',sha256:'c'.repeat(64)}],types:[{id:'T-synthetic'}]} as unknown as Projection;
const pin=async(path:string):Promise<PinnedFile>=>({path:await realpath(path),sha256:createHash('sha256').update(await readFile(path)).digest('hex')});
async function setup(entrypoint=resolve(import.meta.dir,'fixture-mcp.ts'),snapshotData:unknown={synthetic:true}){
 const directory=await mkdtemp(resolve(tmpdir(),'month-end-mcp-synthetic-'));const bundle=resolve(directory,'mcp.bundle.js'),snapshot=resolve(directory,'synthetic.json');
 let selectedEntry=entrypoint;if(!entrypoint.endsWith('fixture-mcp.ts')){selectedEntry=resolve(directory,'network-denied-entry.ts');await writeFile(selectedEntry,`import ${JSON.stringify(resolve(import.meta.dir,'../../../../../.private/source-refs/academy-workbench/tools/academy-mcp/tests/network-deny.ts'))};\nimport ${JSON.stringify(entrypoint)};\n`);}
 const build=await Bun.build({entrypoints:[selectedEntry],target:'bun',outdir:directory,naming:'mcp.bundle.js'});if(!build.success)throw Error(build.logs.join('\n'));
 await writeFile(snapshot,JSON.stringify(snapshotData));const configuration={executable:await pin(process.execPath),bundle:await pin(bundle),source:{mode:'synthetic' as const,snapshot:await pin(snapshot)}};
 return {directory,configuration,async cleanup(port?:SourcePort){await port?.close?.();await rm(directory,{recursive:true,force:true});}};
}
async function scope(port:SourcePort){const first=await port.scope({context:null});expect(first.categories[0].id).toBe('category-3');const second=await port.scope({context:first.context,view:'labels',hierarchyId:'category-3'});expect(second.labels[0].pat_no).toBe('7');return second.context!;}
function request(context:SourceContext){const study:StudyReport={scope:{researchTypeIds:['T-synthetic'],researchRevision:revision,edition:null,unit:null},studied:true,summary:'Synthetic explicit teacher report',evidenceNotes:[],attribution:'teacher-reported',acceptance:false};const intent:DesiredQuestionIntent={axes:{structure:'groups',reasoning:'explain',representation:'diagram',conditions:'integer',errors:'unknown',transfer:'unknown'},notes:'Synthetic engineering contract only'};return {context,study,intent};}
test('default unavailable; SDK pins task context, type/question identity and immutable page cursors',async()=>{
 const unavailable=await createMcpSourcePort(undefined,projection);expect((await unavailable.scope({context:null})).availability).toBe('unavailable');
 const fixture=await setup();let port:SourcePort|undefined;
 try{port=await createMcpSourcePort(fixture.configuration,projection);const context=await scope(port);expect(context.observedAt).toBe('2026-10-17T00:00:00Z');
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
 for(const query of ['forge','refuse']){const fixture=await setup();let port:SourcePort|undefined;try{port=await createMcpSourcePort(fixture.configuration,projection);const r=request(await scope(port));await expect(port.find({...r,query,categoryId:null,limit:1})).rejects.toThrow('mcp_source_requires_owner_resolution');await expect(port.find({...r,query:'합성',categoryId:null,limit:1})).rejects.toThrow();}finally{await fixture.cleanup(port);}}
},20000);
test('pin drift, symlink, arbitrary credentials and superseded revision fail before startup',async()=>{
 const fixture=await setup();try{
  await expect(createMcpSourcePort({...fixture.configuration,bundle:{...fixture.configuration.bundle,sha256:'0'.repeat(64)}},projection)).rejects.toThrow('mcp_launch_hash_mismatch');
  const linked=resolve(fixture.directory,'linked.js');await symlink(fixture.configuration.bundle.path,linked);await expect(createMcpSourcePort({...fixture.configuration,bundle:{...fixture.configuration.bundle,path:linked}},projection)).rejects.toThrow('mcp_launch_pin_invalid');
  await expect(createMcpSourcePort({...fixture.configuration,credentials:{password:'forbidden'}} as any,projection)).rejects.toThrow('mcp_launch_configuration_invalid');
  await expect(createMcpSourcePort(fixture.configuration,{...projection,revision:'superseded'})).rejects.toThrow('research_projection_pin_required');
 }finally{await fixture.cleanup();}
},20000);
test('actual bundled six-tool label entrypoint preserves bound context and existing DailyRecord registration',async()=>{
 const snapshot={schemaVersion:'academy.item-label-snapshot/1',source:{kind:'synthetic_fixture',origin:'https://dc.gang-a.kr',entryPath:'/servlet/controller.tutor.etest.TestPoolServlet?reqCmd=Main',tabPath:'/common/etest_pool.jsp',revision:'synthetic',observedAt:'2026-10-17T00:00:00Z',evidenceRefs:['synthetic-only'],coverage:'partial',scopeHierarchyIds:['category-3']},hierarchy:[{id:'category-3',parentId:null,labelExact:'합성 분류',evidenceRefs:['synthetic-only']}],labels:[{id:'academy-pat:fixture:string:7',nativeId:'7',hierarchyId:'category-3',labelExact:'합성 유형',aliases:[],evidenceRefs:['synthetic-only']}]};
 const entry=resolve(import.meta.dir,'../../../../../.private/source-refs/academy-workbench/tools/academy-mcp/src/label-server.ts');
 const fixture=await setup(entry,snapshot);let port:SourcePort|undefined;
 try{port=await createMcpSourcePort(fixture.configuration,projection);const context=await scope(port),r=request(context);const found=await port.find({...r,study:{acceptance:false,attribution:'teacher-reported',evidenceNotes:[],summary:r.study.summary,studied:true,scope:{...r.study.scope,edition:'teacher-edition',unit:'teacher-unit'}},query:'합성',categoryId:null,limit:10});expect(found.candidates[0].label.pat_no).toBe('7');expect(found.context.edition).toBeNull();expect(found.context.unit).toBeNull();expect(found.limitations).toContain('학습 범위는 입력했지만 학원 원천의 판본·단원은 아직 확인되지 않아 적합성은 미확인입니다.');}
 finally{await fixture.cleanup(port);}
},20000);
test('identical receipt label pages reuse context and preserve prior label/cursor; changed clock or receipt gets a new handle',async()=>{
 const fixture=await setup();let port:SourcePort|undefined;
 try{
  port=await createMcpSourcePort(fixture.configuration,projection);
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
test('native-shaped source capabilities retain exact tuple and reject wrong level locally without latching transport',async()=>{
 const fixture=await setup();let port:SourcePort|undefined;
 try{
  // The compiled fictional SDK server ignores launch args and denies all network: no native bridge is executed.
  port=await createMcpSourcePort({...fixture.configuration,source:{mode:'native-readonly',bridge:fixture.configuration.source.snapshot}},projection);
  const first=await port.scope({context:null});
  expect(first.categories[0].nativeScope).toEqual({cl1:1,cl2:2,cl3:3,cl4:0});
  expect(first.categories[0].depth).toBe(3);expect(first.categories[0].canReadLabels).toBe(true);expect(first.categories[0].isLazy).toBe(true);
  expect(first.categories[1].canReadLabels).toBe(false);expect(first.categories[1].depth).toBe(1);
  await expect(port.scope({context:first.context,view:'labels',hierarchyId:'category-1'})).rejects.toThrow('exact_label_read_capable_scope_required');
  await expect(port.find({...request(first.context!),categoryId:null,query:'synthetic',limit:1})).rejects.toThrow('exact_label_read_capable_scope_required');
  const valid=await port.scope({context:first.context,view:'labels',hierarchyId:'category-3'});
  expect(valid.labels[0].pat_no).toBe('7');
 }finally{await fixture.cleanup(port);}
 const synthetic=await setup();try{port=await createMcpSourcePort(synthetic.configuration,projection);const first=await port.scope({context:null});expect(first.categories[0].canReadLabels).toBeNull();expect(first.categories[0].nativeScope).toBeUndefined();}finally{await synthetic.cleanup(port);}
},20000);
test('teacher edition/unit with unknown source metadata permits provisional reads, preserves nulls and keeps cursor study binding exact',async()=>{
 const fixture=await setup();let port:SourcePort|undefined;
 try{
  port=await createMcpSourcePort(fixture.configuration,projection);
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

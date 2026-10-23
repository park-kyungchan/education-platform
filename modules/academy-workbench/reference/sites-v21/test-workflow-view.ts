import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {mountWorkflowView} from './src/workflow-view.ts';
import {WORK_CONTEXT_TOOL} from './src/workflow-operation.ts';
import {workflowResponse,workflowRevisions} from './tests/fixtures/workflow-view.ts';
const originalFetch=globalThis.fetch;
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
let checks=0;
async function test(name:string,fn:()=>Promise<void>){await fn();checks++;console.log('PASS '+name);}
type Responder=(input:any,options:any)=>Promise<Response>|Response;
function mount(respond:Responder=(input)=>Response.json({status:'success',result:workflowResponse(input)})){
 const w=new Window({url:'https://synthetic.example.invalid'}),target=w.document.createElement('div');w.document.body.append(target);
 const tools=new Map<string,any>(),signals:AbortSignal[]=[],calls:any[]=[],selected:string[]=[];let unauthorized=0;
 Object.defineProperty(w.document,'modelContext',{value:{registerTool(tool:any,options:any){assert(!tools.has(tool.name),'no duplicate tools');tools.set(tool.name,tool);signals.push(options.signal);}}});
 globalThis.fetch=(async(path:any,options:any)=>{assert.equal(path,'/api/academy/work-context');assert.equal(options.credentials,'same-origin');assert.equal(options.redirect,'manual');assert.equal(options.method,'POST');const input=JSON.parse(options.body);calls.push(input);return respond(input,options);}) as typeof fetch;
 let handle:ReturnType<typeof mountWorkflowView>;
 handle=mountWorkflowView(target as any,{now:()=>new Date('2026-10-11T16:00:00Z'),onUnauthorized(){unauthorized++;handle.dispose();target.innerHTML='';},canSelectStudent:id=>id==='a',async selectStudent(id){selected.push(id);return {studentId:id};}});
 return {w,target,tools,signals,calls,selected,handle,get unauthorized(){return unauthorized;},async close(){handle.dispose();await w.happyDOM.close();}};
}
const prep=(more:any={})=>({view:'preparation',date:'2026-10-12',session:'all',policyIds:[],expectedCatalogRevision:workflowRevisions.catalogRevision,expectedMembershipRevision:workflowRevisions.membershipRevision,expectedRosterRevision:workflowRevisions.rosterRevision,...more});
try{
 await test('bounded automatic cohort load uses Seoul date, no selected policy, exact private read',async()=>{
  const app=mount();try{assert.equal(app.target.querySelector('input')!.value,'2026-10-12');await app.handle.ready;assert.equal(app.calls.length,2);assert.deepEqual(app.calls[0],{view:'policy-index',limit:8,offset:0});assert.deepEqual(app.calls[1].policyIds,[]);assert(app.target.textContent.includes('Synthetic Student A'));assert(!app.target.textContent.includes('0개'));assert(app.target.textContent.includes('실제 출석·과제·완료는 미확인'));assert.equal(app.target.querySelector('.workflow-details')!.hasAttribute('open'),false);}finally{await app.close();}
 });
 await test('browser tool updates the real UI and returns exact HTTP result, selection remains explicit',async()=>{
  const app=mount();try{await app.handle.ready;const args=prep({policyIds:['P-one']});const result=await app.tools.get('academy_work_context').execute(args);assert.deepEqual(result,workflowResponse(args));assert(app.target.querySelector('.workflow-details')!.hasAttribute('open'));assert(app.target.textContent.includes('Read selected source → Teacher decision'));assert(app.target.textContent.includes('실행 시도·재시도·재개 기록은 불러오지'));assert(app.target.textContent.includes('수정한 이전 근거'));assert(app.target.textContent.includes('<script>unsafe</script>'));assert.equal(app.target.querySelector('script'),null);assert.equal(app.selected.length,0);(app.target.querySelector('[data-workflow-student]') as unknown as HTMLButtonElement).click();await tick();assert.deepEqual(app.selected,['a']);}finally{await app.close();}
 });
 await test('browser mutation hints differ from read-only server without schema drift',async()=>{
  const app=mount();try{await app.handle.ready;const browser=app.tools.get('academy_work_context');assert.equal(browser.annotations.readOnlyHint,false);assert.equal(browser.annotations.consequentialHint,false);assert.equal(browser.annotations.untrustedContentHint,true);assert.equal(WORK_CONTEXT_TOOL.annotations.readOnlyHint,true);assert.equal(browser.name,WORK_CONTEXT_TOOL.name);assert.deepEqual(browser.inputSchema,WORK_CONTEXT_TOOL.inputSchema);assert(browser.description.includes('Changes displayed')||browser.description.includes('changes browser navigation'));}finally{await app.close();}
 });
 await test('historical unknown does not list student in a past cohort',async()=>{
  const app=mount();try{await app.handle.ready;await app.handle.execute(prep({date:'2026-10-05'}));assert.equal(app.target.querySelectorAll('[data-workflow-student]').length,0);assert(app.target.textContent.includes('등록 시작일 미확인'));assert(!app.target.textContent.includes('수업 없음'));}finally{await app.close();}
 });
 await test('invalid tool input is rejected without changing UI or issuing a request',async()=>{
  const app=mount();try{await app.handle.ready;const before=app.target.innerHTML,calls=app.calls.length;for(const args of [prep({date:'2026-02-30'}),prep({session:0}),prep({policyIds:['P-one','P-one']}),{view:'policy-index',all:true}])await assert.rejects(app.handle.execute(args));assert.equal(app.calls.length,calls);assert.equal(app.target.innerHTML,before);}finally{await app.close();}
 });
 await test('omitted session matches the shared API default',async()=>{
  const app=mount();try{await app.handle.ready;const args=prep();delete args.session;await app.tools.get('academy_work_context').execute(args);assert.equal(app.calls.at(-1).session,'all');assert.equal(app.target.querySelector('select')!.value,'all');}finally{await app.close();}
 });
 await test('mismatched nested source revision does not enter visible cohort scope',async()=>{
  const app=mount(input=>{const result=workflowResponse(input);if(input.view==='preparation')result.preparation.dateCohorts.source.sha256='0'.repeat(64);return Response.json({status:'success',result});});try{await app.handle.ready;assert.equal(app.target.querySelectorAll('[data-workflow-student]').length,0);assert(app.target.textContent.includes('확인하지 못했습니다'));}finally{await app.close();}
 });
 await test('reattaching after student selection preserves context and does not register duplicate tools',async()=>{
  const app=mount();try{await app.handle.ready;const next=app.w.document.createElement('div');app.w.document.body.append(next);app.handle.attach(next as any);assert.equal(app.target.children.length,0);assert(next.textContent.includes('Synthetic Student A'));assert.equal(app.signals.length,1);app.handle.dispose();assert(app.signals[0].aborted);await assert.rejects(app.tools.get('academy_work_context').execute({view:'policy-index'}),/disposed/);}finally{await app.close();}
 });
 for(const status of [401,403])await test('current '+status+' destroys protected view and aborts tools',async()=>{
  const app=mount(input=>input.view==='policy-index'?Response.json({status:'success',result:workflowResponse(input)}):Response.json({status:'denied'},{status}));try{await app.handle.ready;assert.equal(app.unauthorized,1);assert.equal(app.target.textContent,'');assert(app.signals[0].aborted);}finally{await app.close();}
 });
 await test('late old success cannot replace a newer selected date',async()=>{
  const pending=new Map<string,(r:Response)=>void>();const app=mount(input=>input.view==='policy-index'||input.date==='2026-10-12'?Response.json({status:'success',result:workflowResponse(input)}):new Promise(resolve=>pending.set(input.date,resolve)));
  try{await app.handle.ready;const old=app.handle.execute(prep({date:'2026-10-19'}));const oldRejected=assert.rejects(old,/superseded/);await tick();const newest=app.handle.execute(prep({date:'2026-10-26'}));await tick();pending.get('2026-10-26')!(Response.json({status:'success',result:workflowResponse(prep({date:'2026-10-26'}))}));await newest;pending.get('2026-10-19')!(Response.json({status:'success',result:workflowResponse(prep({date:'2026-10-19'}))}));await oldRejected;assert.equal(app.target.querySelector('input')!.value,'2026-10-26');}finally{await app.close();}
 });
 await test('unverified server result shows actual error state',async()=>{
  const app=mount(input=>{const result=workflowResponse(input);result.verification.contextGatePassed=false;return Response.json({status:'success',result});});try{await app.handle.ready;assert(app.target.textContent.includes('확인하지 못했습니다'));assert.equal(app.target.querySelectorAll('[data-workflow-student]').length,0);assert.equal(app.unauthorized,0);}finally{await app.close();}
 });
 console.log(JSON.stringify({passed:true,checks,execution:'synthetic_dom_mock_webmcp',nativeWebMcpVerified:false,networkRequests:0,lmsWrites:0}));
}finally{globalThis.fetch=originalFetch;}

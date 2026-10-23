import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {Window} from 'happy-dom';
import {workflowResponse} from './tests/fixtures/workflow-view.ts';

// Client-only regressions. No generated Worker configuration, student fixtures,
// Site calls or network requests are used. Only the synthetic test receipt is saved.
const built=await Bun.build({entrypoints:[import.meta.dir+'/src/app.ts'],target:'browser',format:'iife',minify:false});
assert.equal(built.success,true,'client compilation must succeed');
const script=await built.outputs[0].text();
assert(!script.includes('ACADEMY_QA'),'production bundle must not expose QA state');
const origin='https://synthetic-client.example.invalid';
const hash='a'.repeat(64),navigationHash='b'.repeat(64);
const students=['a','b','c'].map(id=>({id,displayName:'Synthetic Student '+id.toUpperCase(),managementState:'active'}));
function success(id:string){return {
 status:'success',studentId:id,
 refreshReadiness:{studentId:id,state:'unavailable',reason:'LIVE_ADAPTER_NOT_CONNECTED',areas:[],backendAttemptStarted:false,lastBackendAttemptAt:null,lastSuccessfulRefreshedAt:null,externalRequests:0},assessmentProjection:{studentId:id,sourceSnapshotSha256:hash,sourceEvidenceProjectionSha256:hash,namespaceBindingSha256:hash,coverage:{state:'not_collected',actualAttemptCount:0,queriedAt:null,lastSuccessfulRefreshedAt:null},assessmentAttempts:[],diaryEvidence:[],diaryCoverage:{state:'not_collected',projectedDiaryCount:0,dtMentionCount:0}},assessmentReceipt:{studentId:id,runtimeSchemaValidated:true,fullContractByteHashVerified:true,assessmentProjectionSha256:hash,contractSha256:hash,contextScopeFingerprint:hash},evidenceProjection:{version:'1.0.0',studentId:id,sourceSnapshotSha256:hash,namespaceBinding:{studentId:id,spaceStudentId:id,studentPageId:'synthetic-'+id},evidenceRecords:[],decisionRecords:[],assignments:[],recordEvidenceIds:{},recordDecisionIds:{},sourcePlan:null,externalSourceQueried:false,liveRefreshConnected:false,queriedAt:null,lastSuccessfulRefreshedAt:null},domainReceipt:{studentId:id,runtimeSchemaValidated:true,fullContractByteHashVerified:true,namespaceBindingValidated:true,evidenceProjectionSha256:hash,contractSha256:hash,namespaceBindingSha256:hash,contextScopeFingerprint:hash},teacherOverlay:null,gradingProjection:{studentId:id,sourceSnapshotSha256:hash,view:{studentLabel:'Synthetic Student '+id.toUpperCase(),books:[],records:{},unmappedRecordIds:[],sourceContractVersion:'synthetic',sourceAsOf:{},unmappedAssertions:[],raw:{},inputSha256:hash,notebookEvidence:[]},includedContents:[]},scope:{teacherOverlayProjectionSha256:null,gradingProjectionSha256:hash,evidenceProjectionSha256:hash,assessmentProjectionSha256:hash,sourceRevisions:{assessmentProjection:hash,assessmentContract:hash,gradingProjection:hash,evidenceProjection:hash,domainContract:hash,namespaceBinding:hash}},
 selectedStudent:{id,pageId:'synthetic-'+id,enrollments:[{courseTitle:'Synthetic enrollment '+id,status:'active',validFrom:null,validTo:null}]},
 snapshot:{sourceHash:hash,sourceCoverage:[],unresolvedAttempts:[],view:{studentLabel:'Synthetic Student '+id.toUpperCase(),books:[],records:{},unmappedRecordIds:[],sourceContractVersion:'synthetic',sourceAsOf:{},unmappedAssertions:[],raw:{},inputSha256:hash,notebookEvidence:[]}},
 receipt:{loadStatus:'verified',runtimeReceipt:true,scopeFingerprint:hash,fixtureScope:'selected-'+id},
 navigationReceipt:{loadStatus:'verified',runtimeReceipt:true,scopeFingerprint:navigationHash,fixtureScope:'navigation'},
 meta:{students,rosterRevision:'synthetic-roster-1',registrySha256:hash,snapshotProjectionSha256:{a:hash,b:hash,c:hash},teacherOverlayProjectionSha256:{a:null,b:null,c:null},gradingProjectionSha256:{a:hash,b:hash,c:hash},evidenceProjectionSha256:{a:hash,b:hash,c:hash},domainContractSha256:hash,assessmentProjectionSha256:{a:hash,b:hash,c:hash},assessmentContractSha256:hash,bundleBuiltAt:'synthetic'},
 verification:{contextGatePassed:true,navigationGatePassed:true}
};}
type Next=(id:string,options:any)=>Promise<any>|any;
async function boot(next:Next,initial=success('a')){
 const w:any=new Window({url:origin,settings:{enableJavaScriptEvaluation:false,disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
 w.document.write('<header id="app-shell"></header><main id="c2-root"></main><section id="unresolved"></section>');
 const tools=new Map<string,any>(),calls:any[]=[];
 Object.defineProperty(w.document,'modelContext',{value:{registerTool(tool:any){tools.set(tool.name,tool);}}});
 const fetcher=async(path:string,options:any)=>{
  assert.equal(options.redirect,'manual');assert.equal(options.credentials,'same-origin');
  const body=JSON.parse(options.body);calls.push({path,body,signal:options.signal});
  return path==='/api/init'?Response.json(initial):path==='/api/academy/work-context'?Response.json({status:'success',result:workflowResponse(body)}):next(body.studentId,options);
 };
 new Function('window','document','fetch',script)(w,w.document,fetcher);
 const ready=await w.ACADEMY_READY;
 return {w,tools,calls,ready,select:(id:string)=>tools.get('select_student').execute({studentId:id}),close:()=>w.happyDOM.close()};
}
const title=(app:any)=>app.w.document.querySelector('#c2-root h1')?.textContent??'';
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
let checks=0;const passed:string[]=[];
async function test(name:string,fn:()=>Promise<void>){await fn();checks++;passed.push(name);}
async function withApp(next:Next,fn:(app:Awaited<ReturnType<typeof boot>>)=>Promise<void>,initial=success('a')){const app=await boot(next,initial);try{await fn(app);}finally{await app.close();}}
async function assertCleared(app:any){
 assert.equal(title(app),'');
 assert(!app.w.document.body.textContent.includes('Synthetic Student'));
 assert(!app.w.document.body.textContent.includes('Synthetic enrollment'));
 assert.equal(app.w.document.querySelectorAll('[data-student-id]').length,0);
 assert(app.w.document.querySelector('a[href="/signin-with-chatgpt?return_to=/"]'));
 assert(!Object.hasOwn(app.w,'ACADEMY_QA'));
 await assert.rejects(app.tools.get('list_managed_students').execute({}),/context_not_loaded/);
 await assert.rejects(app.tools.get('read_selected_book_evidence').execute({}),/context_not_loaded/);
}

await test('mobile rail metadata keeps its bounded column and wraps unbroken text',async()=>{
 // Source-CSS regression only. Native 390px layout verification is separate.
 const css=readFileSync(import.meta.dir+'/src/rails.css','utf8'),mediaStart=css.indexOf('@media(max-width:720px){');assert(mediaStart>=0,'existing 720px media rule');
 const mobile=css.slice(mediaStart).split('@media').slice(1,2).join('@media');
 const metadata=/\.c2 \.node-meta\{([^}]+)\}/.exec(mobile)?.[1];assert(metadata,'bounded metadata selector');assert(/(?:^|;)max-width:64px(?:;|$)/.test(metadata));assert(/(?:^|;)overflow-wrap:anywhere(?:;|$)/.test(metadata));
});

await test('initial completion exposes no protected data or QA global',()=>withApp(id=>Response.json(success(id)),async app=>{
 assert.equal(app.ready,true);assert.equal(await app.w.ACADEMY_READY,true);
 assert(!Object.hasOwn(app.w,'ACADEMY_QA'));assert(title(app).includes('Synthetic Student A'));
}));

await test('browser tools that reload or select visible state do not claim read-only',()=>withApp(id=>Response.json(success(id)),async app=>{
 for(const name of ['list_managed_students','select_student','read_selected_book_evidence']){const tool=app.tools.get(name);assert.equal(tool.annotations.readOnlyHint,false);assert.equal(tool.annotations.consequentialHint,false);assert.equal(tool.annotations.untrustedContentHint,true);assert(tool.description.includes('displayed browser state'));}
}));

for(const name of ['list_managed_students','select_student','read_selected_book_evidence'])await test(name+' rejects invalid callback input before any UI or request side effect',()=>withApp(id=>Response.json(success(id)),async app=>{
 await tick();
 const before=app.w.document.body.innerHTML,heading=app.w.document.querySelector('#c2-root h1'),count=app.calls.length,signals=app.calls.map((call:any)=>call.signal.aborted);
 const forbidden=name==='select_student'?{studentId:'b',forbidden:true}:{forbidden:true};
 const invalid:any[]=[forbidden,null,undefined,[],[{}],'',0,new Date(),Object.create({studentId:'b'})];
 if(name==='select_student')invalid.push({}, {studentId:null},{studentId:1},{studentId:''},{studentId:'x'.repeat(513)},{studentId:'b',sourcePath:'/private/other'});
 else invalid.push({studentId:'b'}, {date:'2026-10-12'});
 const accessor=Object.create(null);Object.defineProperty(accessor,name==='select_student'?'studentId':'forbidden',{enumerable:true,get(){throw Error('callback must not evaluate getters');}});invalid.push(accessor);
 for(const input of invalid){await assert.rejects(app.tools.get(name).execute(input),/invalid_browser_tool_arguments/);assert.equal(app.calls.length,count);assert.equal(app.w.document.body.innerHTML,before);assert.equal(app.w.document.querySelector('#c2-root h1'),heading);assert.deepEqual(app.calls.map((call:any)=>call.signal.aborted),signals);}
 if(name==='select_student'){await assert.rejects(app.tools.get(name).execute({studentId:'outside-roster'}),/student_outside_loaded_roster/);assert.equal(app.calls.length,count);assert.equal(app.w.document.body.innerHTML,before);}
}));

for(const status of [401,403])await test('JSON '+status+' clears protected data before parsing',async()=>{
 let parsed=false;const response=Response.json({status:'identity_required'},{status});response.json=async()=>{parsed=true;throw Error('must not parse denial');};
 await withApp(()=>response,async app=>{await assert.rejects(app.select('b'),/protected_identity_response_required/);await assertCleared(app);});
 assert.equal(parsed,false);
});

await test('HTML 403 clears protected data before parsing',async()=>{
 let parsed=false;const response=new Response('<html>Sign in</html>',{status:403,headers:{'Content-Type':'text/html'}});response.json=async()=>{parsed=true;throw Error('must not parse HTML');};
 await withApp(()=>response,async app=>{await assert.rejects(app.select('b'),/protected_identity_response_required/);await assertCleared(app);});assert.equal(parsed,false);
});

await test('HTTP redirect clears protected data without following sign-in',()=>withApp(()=>new Response(null,{status:302,headers:{Location:'/signin-with-chatgpt'}}),async app=>{
 await assert.rejects(app.select('b'),/protected_identity_response_required/);await assertCleared(app);assert.equal(app.calls.filter((c:any)=>c.path!=='/api/academy/work-context').length,2);
}));

await test('opaque manual redirect clears protected data before parsing',async()=>{
 let parsed=false;const response={status:0,ok:false,type:'opaqueredirect',redirected:false,headers:new Headers(),json:async()=>{parsed=true;throw Error('must not parse redirect');}};
 await withApp(()=>response,async app=>{await assert.rejects(app.select('b'),/protected_identity_response_required/);await assertCleared(app);});assert.equal(parsed,false);
});

await test('HTML 200 sign-in response fails closed',()=>withApp(()=>new Response('<html>Sign in</html>',{status:200,headers:{'Content-Type':'text/html'}}),async app=>{
 await assert.rejects(app.select('b'),/protected_identity_response_required/);await assertCleared(app);
}));

await test('already-followed redirect fails closed',()=>withApp(()=>({status:200,ok:true,type:'basic',redirected:true,headers:new Headers({'Content-Type':'application/json'}),json:async()=>success('b')}),async app=>{
 await assert.rejects(app.select('b'),/protected_identity_response_required/);await assertCleared(app);
}));

await test('selection waits for the protected handler response',async()=>{
 let resolve:any;
 await withApp(()=>new Promise(r=>resolve=r),async app=>{
  const selection=app.select('b');await tick();assert(title(app).includes('Synthetic Student A'));
  const request=app.calls.findLast((c:any)=>c.path==='/api/student-snapshot').body;assert.equal(request.studentId,'b');
  for(const field of ['expectedRosterRevision','expectedRegistrySha256','expectedSnapshotSha256'])assert.equal(typeof request[field],'string');
  resolve(Response.json(success('b')));await selection;assert(title(app).includes('Synthetic Student B'));
  assert(!app.w.document.body.textContent.includes('Synthetic enrollment a'));assert(app.w.document.body.textContent.includes('Synthetic enrollment b'));
 });
});

await test('stale auth denial cannot clear a newer successful selection',async()=>{
 const pending=new Map<string,(response:any)=>void>();
 await withApp(id=>new Promise(r=>pending.set(id,r)),async app=>{
  const older=app.select('b').then(()=>'',(e:any)=>e.message);await tick();
  const newer=app.select('c');await tick();pending.get('c')!(Response.json(success('c')));await newer;
  pending.get('b')!(new Response('<html>Sign in</html>',{status:403,headers:{'Content-Type':'text/html'}}));
  assert.equal(await older,'superseded_selection');assert(title(app).includes('Synthetic Student C'));
  assert.equal(app.w.document.querySelector('a[href="/signin-with-chatgpt?return_to=/"]'),null);
 });
});

await test('stale success cannot overwrite a newer successful selection',async()=>{
 const pending=new Map<string,(response:any)=>void>();
 await withApp(id=>new Promise(r=>pending.set(id,r)),async app=>{
  const older=app.select('b').then(()=>'',(e:any)=>e.message);await tick();
  const newer=app.select('c');await tick();pending.get('c')!(Response.json(success('c')));await newer;
  pending.get('b')!(Response.json(success('b')));assert.equal(await older,'superseded_selection');assert(title(app).includes('Synthetic Student C'));
 });
});

for(const missing of ['navigationReceipt','navigationGatePassed'])await test('missing '+missing+' cannot replace the selected snapshot',()=>withApp(id=>{
 const result:any=success(id);if(missing==='navigationReceipt')delete result.navigationReceipt;else result.verification.navigationGatePassed=false;return Response.json(result);
},async app=>{await assert.rejects(app.select('b'),/navigation_receipt_required/);assert(title(app).includes('Synthetic Student A'));}));

await test('wrong selected metadata cannot replace the selected snapshot',()=>withApp(id=>{const result=success(id);result.selectedStudent.id='c';return Response.json(result);},async app=>{
 await assert.rejects(app.select('b'),/returned_student_scope_mismatch/);assert(title(app).includes('Synthetic Student A'));
}));
await test('missing teacher overlay pin cannot replace selected data',()=>withApp(id=>{const result:any=success(id);delete result.meta.teacherOverlayProjectionSha256;return Response.json(result);},async app=>{
 await assert.rejects(app.select('b'),/teacher_overlay_pin_required/);assert(title(app).includes('Synthetic Student A'));
}));
await test('other student teacher overlay cannot enter selected scope',()=>withApp(id=>{const result:any=success(id);result.teacherOverlay={studentId:'c',sourceSnapshotSha256:hash};return Response.json(result);},async app=>{
 await assert.rejects(app.select('b'),/teacher_overlay_scope_mismatch/);assert(title(app).includes('Synthetic Student A'));
}));

await test('navigation and selected WebMCP tools report their distinct receipts',()=>withApp(id=>Response.json(success(id)),async app=>{
 const navigation=await app.tools.get('list_managed_students').execute({});
 assert.equal(navigation.navigationReceipt.fixtureScope,'navigation');assert(!('contextReceipt' in navigation));
 await app.select('b');const evidence=await app.tools.get('read_selected_book_evidence').execute({});
 assert.equal(evidence.studentId,'b');assert.equal(evidence.contextReceipt.fixtureScope,'selected-b');assert(!('navigationReceipt' in evidence));
}));

for(const mutation of ['missing_domain_receipt','wrong_namespace_page','wrong_evidence_pin','forged_lms_success','wrong_domain_hash'])await test('evidence client blocks '+mutation+' before replacing visible data',()=>withApp(id=>{
 const result:any=success(id);if(mutation==='missing_domain_receipt')delete result.domainReceipt;else if(mutation==='wrong_namespace_page')result.evidenceProjection.namespaceBinding.studentPageId='other-page';else if(mutation==='wrong_evidence_pin')result.scope.evidenceProjectionSha256='0'.repeat(64);else if(mutation==='forged_lms_success')result.evidenceProjection.lastSuccessfulRefreshedAt='2026-10-07T07:00:00Z';else result.domainReceipt.contractSha256='0'.repeat(64);return Response.json(result);
},async app=>{await assert.rejects(app.select('b'),/evidence_schema_namespace_receipt_required/);assert(title(app).includes('Synthetic Student A'));}));

for(const status of [401,403])await test('parallel Today '+status+' invalidates a pending selection and rejects its late success',async()=>{
 let todayResolve:any,selectionResolve:any;
 await withApp(id=>new Promise(resolve=>{if(id===undefined)todayResolve=resolve;else selectionResolve=resolve;}),async app=>{
  app.w.document.querySelector('[data-today-summary]').click();
  const selected=app.select('b');const rejected=assert.rejects(selected,/superseded_selection|AbortError/);await tick();
  todayResolve(Response.json({status:'identity_required'},{status}));await tick();await assertCleared(app);
  assert.equal(app.calls.find((c:any)=>c.path==='/api/student-snapshot').signal.aborted,true);
  selectionResolve(Response.json(success('b')));await rejected;await tick();await assertCleared(app);
 });
});

const receipt={passed:true,checks,tests:passed,execution:'synthetic_dom_actual_client_bundle',privateFixturesRead:false,networkEndpointInvoked:false,productionEndpointVerified:false};
writeFileSync(import.meta.dir+'/artifacts/client-handler-validation.json',JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt));

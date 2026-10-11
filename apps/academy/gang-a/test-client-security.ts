import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {Window} from 'happy-dom';

// Client-only regressions. No generated Worker configuration, student fixtures,
// Site calls or network requests are used. Only the synthetic test receipt is saved.
const built=await Bun.build({entrypoints:[import.meta.dir+'/src/app.ts'],target:'browser',format:'iife',minify:false});
assert.equal(built.success,true,'client compilation must succeed');
const script=await built.outputs[0].text();
assert(!script.includes('ACADEMY_QA'),'production bundle must not expose QA state');
const origin='https://synthetic-client.example.invalid';
const hash='a'.repeat(64),navigationHash='b'.repeat(64);
const students=['a','b','c'].map(id=>({id,displayName:'Synthetic Student '+id.toUpperCase(),managementState:'active'}));
function fixtureReceipt(id:string,fingerprint=hash){return {kind:'context_load_receipt',schemaVersion:'1.0.0',runId:'synthetic-run',taskId:'synthetic-task',role:'executor',event:'start',routeId:'academy.progress_report',sourceMode:'saved_snapshot',registryVersion:'synthetic',registrySha256:hash,scopeFingerprint:fingerprint,sourcePolicy:'minimal_scoped_data',observations:[],loadStatus:'verified',compliance:[],permissionStatus:'evaluate_with_current_user_and_tool_authority',runtimeReceipt:true};}
function success(id:string){const view={studentLabel:'Synthetic Student '+id.toUpperCase(),books:[],records:{},unmappedRecordIds:[],sourceContractVersion:'synthetic',sourceAsOf:{},unmappedAssertions:[],raw:{},inputSha256:hash,notebookEvidence:[],questionCoverage:{state:'not_captured',observedItemCount:0,totalItems:null}};return {
 status:'success',studentId:id,
 evidenceProjection:{version:'1.0.0',studentId:id,sourceSnapshotSha256:hash,sourceProjectionSha256:hash,namespaceBinding:{bindingId:'synthetic-binding-'+id,studentId:id,spaceStudentId:id,studentPageId:'synthetic-'+id,rosterRevision:'synthetic-roster-1',sourceSnapshotSha256:hash,canonicalSnapshotStudentId:null,canonicalSnapshotSha256:null,nativeStudentId:null,nativeIdentityVerified:false,basis:'approved_source_hash_and_exact_source_key_binding'},evidenceRecords:[],decisionRecords:[],assignments:[],recordEvidenceIds:{},recordDecisionIds:{},unboundEvidenceIds:[],unboundDecisionIds:[],sourcePlan:null,externalSourceQueried:false,liveRefreshConnected:false,queriedAt:null,lastSuccessfulRefreshedAt:null},
 domainReceipt:{contractVersion:'academy.evidence/1.1.0',studentId:id,runtimeSchemaValidated:true,fullContractByteHashVerified:true,namespaceBindingValidated:true,evidenceProjectionSha256:hash,contractSha256:hash,namespaceBindingSha256:hash,contextScopeFingerprint:hash,parsedEvidenceCount:0,parsedDecisionCount:0,externalSourceQueried:false},
 teacherOverlay:null,gradingProjection:{version:'1.0.0',policyId:'synthetic-policy',studentId:id,sourceSnapshotSha256:hash,view,includedContents:[],excludedStandaloneRecordIds:[],completionDenominator:null},
 scope:{studentId:id,projectionSha256:hash,teacherOverlayProjectionSha256:null,gradingProjectionSha256:hash,evidenceProjectionSha256:hash,sourceRevisions:{gradingProjection:hash,evidenceProjection:hash,domainContract:hash,namespaceBinding:hash}},
 selectedStudent:{id,pageId:'synthetic-'+id,enrollments:[{id:'synthetic-enrollment-'+id,courseTitle:'Synthetic enrollment '+id,status:'active',validFrom:null,validTo:null}]},
 snapshot:{sourceHash:hash,sourceCoverage:[],unresolvedAttempts:[],unresolvedResources:[],sourceSnapshot:{pageId:'synthetic-'+id,sha256:hash},loadedAt:null,lastSuccessfulRefreshedAt:null,queriedAt:null,sourceEventAt:null,status:'saved_snapshot',view},
 receipt:fixtureReceipt(id),navigationReceipt:fixtureReceipt(id,navigationHash),bootstrapReceipt:fixtureReceipt(id),
 meta:{students,rosterRevision:'synthetic-roster-1',registrySha256:hash,snapshotProjectionSha256:{a:hash,b:hash,c:hash},teacherOverlayProjectionSha256:{a:null,b:null,c:null},gradingProjectionSha256:{a:hash,b:hash,c:hash},evidenceProjectionSha256:{a:hash,b:hash,c:hash},domainContractSha256:hash,bundleBuiltAt:'synthetic',sourceMode:'saved_snapshot',liveRefreshConnected:false},
 verification:{contextGatePassed:true,navigationGatePassed:true,authenticatedOwnerPrivateDispatch:true,fullContractByteHashVerified:true,contractCount:0,platformPromptHook:false,externalSourceQueried:false}
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
  return path==='/api/init'?Response.json(initial):next(body.studentId,options);
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

await test('initial completion exposes no protected data or QA global',()=>withApp(id=>Response.json(success(id)),async app=>{
 assert.equal(app.ready,true);assert.equal(await app.w.ACADEMY_READY,true);
 assert(!Object.hasOwn(app.w,'ACADEMY_QA'));assert(title(app).includes('Synthetic Student A'));
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
 await assert.rejects(app.select('b'),/protected_identity_response_required/);await assertCleared(app);assert.equal(app.calls.length,2);
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
  const request=app.calls.at(-1).body;assert.equal(request.studentId,'b');
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
 assert.equal(navigation.navigationReceipt.scopeFingerprint,navigationHash);assert(!('contextReceipt' in navigation));
 await app.select('b');const evidence=await app.tools.get('read_selected_book_evidence').execute({});
 assert.equal(evidence.studentId,'b');assert.equal(evidence.contextReceipt.scopeFingerprint,hash);assert(!('navigationReceipt' in evidence));
}));

for(const mutation of ['missing_domain_receipt','wrong_namespace_page','wrong_evidence_pin','forged_lms_success','wrong_domain_hash'])await test('evidence client blocks '+mutation+' before replacing visible data',()=>withApp(id=>{
 const result:any=success(id);if(mutation==='missing_domain_receipt')delete result.domainReceipt;else if(mutation==='wrong_namespace_page')result.evidenceProjection.namespaceBinding.studentPageId='other-page';else if(mutation==='wrong_evidence_pin')result.scope.evidenceProjectionSha256='0'.repeat(64);else if(mutation==='forged_lms_success')result.evidenceProjection.lastSuccessfulRefreshedAt='2026-10-07T07:00:00Z';else result.domainReceipt.contractSha256='0'.repeat(64);return Response.json(result);
},async app=>{await assert.rejects(app.select('b'),/evidence_schema_namespace_receipt_required/);assert(title(app).includes('Synthetic Student A'));}));

const receipt={passed:true,checks,tests:passed,execution:'synthetic_dom_actual_client_bundle',privateFixturesRead:false,networkEndpointInvoked:false,productionEndpointVerified:false};
writeFileSync(import.meta.dir+'/test-results/client-validation.json',JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt));

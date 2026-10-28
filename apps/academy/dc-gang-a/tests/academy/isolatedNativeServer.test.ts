import {describe,expect,test} from 'bun:test';
import {chmodSync,existsSync,linkSync,lstatSync,mkdirSync,mkdtempSync,readFileSync,rmSync,symlinkSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {authPhasePolicy,composeIsolatedHandler,dependencyTargets,fixedRunnerPaths,isolatedTarget,loadVerifiedInvocation,readPinnedFile,requiredSourcePaths,requiredZodPins,sourceSetDigest,validateAdmission,validateConfiguration,validateFixedRunner,validateQualificationPlan,validateCursorOwnerBinding,validateSealedEnvironment,PG17CommitAckFilter,BoundedRelayQueue,fixedStageOrder,writeExclusivePrivateJson,type QualificationConfiguration} from '../../harness/native_foundations_qualification';
import {migrateNativeFoundations} from '../../harness/native_foundations_migrate';
import {bindTemplate,produceNativeFixtures,validateRootCommandFence,buildRootFenceAdmissionTemplate,resolveCommandFence,sha256,c07PublishedNoteLowerBound,c07FixturePolicy,orderedDependencyWriterCases} from '../../harness/native_foundations_fixture';
import {dependencyWriterOperations,dependencyWriterCaseId,validateDependencyWriterSchedule,dependencyStoreOperation} from '../../harness/native_foundations_qualification';
import {measureNativeFoundations,reconcileSources,continueNativeRead,baselineOracleIds,fourGOracleIds} from '../../harness/native_foundations_measurement';
import {academyConnectionStatus,type AcademySourceConnection} from '../../src/academy/academyConnectionStatus';
import {TeacherAuthStore,ownerCursorLeaseFor,type ProductAuthState} from '../../src/academy/teacherAuthStore';
import {signTeacherSession} from '../../src/academy/auth';
import {fixedConsumerProfile,selectedProtocolClosure,type ReadAdmission} from '../../src/academy/contracts/prerequisiteRecords';
import type {TeacherPrerequisiteReadStore} from '../../src/academy/ports/teacherStore';
import {createNativeTypedRead,nativeRequestDigest,fullFieldMask,type NativeSnapshotAcquireResult,type TypedReadRequest} from '../../src/academy/nativeTypedRead';
import {canonicalJson} from '../../src/learning/model';
import * as fixtureImplementation from '../../harness/native_foundations_fixture';
import {context as fenceCommandContext} from './nativePrerequisiteContracts.test';
import {FakePrerequisiteStore,mapFixtureViews,ctx,nativeRef,request,testFunctionRequest,testTemporal,TEST_REGISTRY_SHA256,objectRef,fictionalGrantVerifier} from './typedRead.test';

test('FENCE-BINDING a Root template cannot authorize any changed request component',()=>{
 const request={ownerId:'synthetic-owner',actorId:'synthetic-actor',idempotencyKey:'synthetic-key',requestDigest:'a'.repeat(64),occurrenceId:'synthetic-occurrence',admissionId:'synthetic-admission',processEpoch:'synthetic-epoch'};
 const template=buildRootFenceAdmissionTemplate(request,'synthetic-separate-fence');
 const memory={['ingress.fenceTemplate-'+request.occurrenceId]:template};
 expect(resolveCommandFence(memory,request).request).toEqual(request);
 for(const field of Object.keys(request) as (keyof typeof request)[]){
  const changed={...request,[field]:field==='requestDigest'?'b'.repeat(64):request[field]+'-changed'};
  const supplied={['ingress.fenceTemplate-'+changed.occurrenceId]:template};
  expect(()=>resolveCommandFence(supplied,changed)).toThrow('separate_root_fence_occurrence_required');
 }
});

test('FENCE-PRODUCER explicit Root submission selection captures the exact owner-normalized request before effects',async()=>{
 const implementation=fixtureImplementation as unknown as Record<string,Function>;
 expect(typeof implementation.buildRootSubmissionFenceSelection).toBe('function');
 expect(typeof implementation.captureRootSubmittedRequest).toBe('function');
 const context=fenceCommandContext('synthetic-selected-command');
 const {ownerId,actorId,verifiedSession,...template}=context;
 const ingress={...template,authenticationRevision:verifiedSession.authenticationRevision};
 const selected=implementation.buildRootSubmissionFenceSelection!(ingress,'synthetic-separate-fence');
 expect(implementation.buildRootSubmissionFenceSelection!({...ingress,scopeRef:{$scopeRef:'root.scopeRef'}},'synthetic-separate-fence',ingress.scopeRef)).toEqual(selected);
 let reads=0,writes=0;
 const store={teacherBindingByActor:async()=>{reads++;return {payload:{state:'ACTIVE',assignmentState:{state:'known',value:'ACTIVE'}}};},appendClassGroup:async()=>{writes++;throw Error('must not write');}};
 const input={command:ingress,payload:{kind:'class_group',synthetic:true}};
 const proof=await implementation.captureRootSubmittedRequest!(selected,ingress,'createClassGroup',input,{ownerId,actorId,role:'teacher'},store);
 expect(reads).toBe(1);expect(writes).toBe(0);expect(proof).not.toBeNull();
 const request=proof.request;
 const memory={['ingress.fenceTemplate-'+request.occurrenceId]:selected};
 expect(resolveCommandFence(memory,request,proof).request).toEqual(request);
 input.command.admissionId='changed-after-capture';
 expect(resolveCommandFence(memory,request,proof).request).toEqual(request);
 for(const field of Object.keys(request)){
  const changed={...request,[field]:field==='requestDigest'?'b'.repeat(64):request[field]+'-changed'};
  const changedMemory={['ingress.fenceTemplate-'+changed.occurrenceId]:selected};
  expect(()=>resolveCommandFence(changedMemory,changed,proof)).toThrow('separate_root_fence_occurrence_required');
 }
 expect(()=>resolveCommandFence(memory,request,{...proof})).toThrow('separate_root_fence_occurrence_required');
 await expect(implementation.captureRootSubmittedRequest!({...selected,commandTemplateSha256:'b'.repeat(64)},ingress,'createClassGroup',input,{ownerId,actorId,role:'teacher'},store)).rejects.toThrow('root_selected_submission_required');
 for(const bad of [null,{}, {...selected,unexpected:true},...Object.keys(selected).map(key=>({...selected,[key]:null})),{...selected,unknownReplay:true},{...selected,automaticRetry:true},{...selected,status:'ROOT_DECISION_REQUIRED'},{...selected,reason:'REPLAY'}])
  await expect(implementation.captureRootSubmittedRequest!(bad,ingress,'createClassGroup',input,{ownerId,actorId,role:'teacher'},store)).rejects.toThrow('root_selected_submission_required');
 const waiting={schema:'root-exact-command-fence-admission-template.v1',status:'ROOT_DECISION_REQUIRED',fenceOccurrenceId:'synthetic-separate-fence'};
 expect(()=>resolveCommandFence({['ingress.fenceTemplate-'+request.occurrenceId]:waiting},request,proof)).toThrow('separate_root_fence_occurrence_required');
 expect(reads).toBe(1);expect(writes).toBe(0);
});

// Exercise the actual private runner/oracle bodies with synthetic transports.
// Extraction preserves production control flow; it never starts a native phase.
function refusalOracleFunction(file:string,start:string,end:string,dependencies:Record<string,unknown>){
 const source=readFileSync(new URL('../../harness/'+file,import.meta.url),'utf8');
 const js=new Bun.Transpiler({loader:'ts',target:'bun'}).transformSync(source);
 const from=js.indexOf('async function '+start+'('),to=js.indexOf(end,from);
 if(from<0||to<0)throw Error('refusal_oracle_source_boundary');
 const implementation=fixtureImplementation as unknown as Record<string,unknown>;
 const scope={sha256,canonicalJson,bindTemplate:(v:unknown)=>structuredClone(v),memoryGet:(m:Record<string,unknown>,k:string)=>m[k],requireFixtureRefusal:implementation.requireFixtureRefusal,expectedFixtureRefusals:implementation.expectedFixtureRefusals,...dependencies};
 return new Function(...Object.keys(scope),js.slice(from,to)+(start==='baselineChecks'?'}':'')+';return '+start)(...Object.values(scope));
}
test('REFUSAL-ORACLE baseline producer requires the exact expected refusal, not server failure',async()=>{
 for(const status of [500,503,400]){
  const run=refusalOracleFunction('native_foundations_fixture.ts','runBaseline','async function restorePositiveDraft(',{nativePost:async()=>({status,body:{error:'SYNTHETIC_WRONG_REFUSAL'},digest:'a'.repeat(64)})});
  const empty=async()=>[],store={current:empty,temporalBindings:empty,activityScopes:empty},receipts:unknown[]=[];
  await expect(run({config:{stage:'A0',base:{ownerId:'synthetic-owner'}},assertCurrent(){}},{'memory.cookie.A':'synthetic-cookie'},store,receipts,[{id:'refuse-empty',phase:'A0',transport:'HTTP',body:{operation:'prerequisiteTeachers',input:{}}}])).rejects.toThrow('fixture_exact_refusal_required');
  expect(receipts).toHaveLength(0);
 }
});
test('REFUSAL-ORACLE issuer producer requires expired/revoked codes, not server failure',async()=>{
 for(const status of [500,503,400]){
  const run=refusalOracleFunction('native_foundations_fixture.ts','exerciseIssuerRefusals','export function nativeRecordEvidence(',{nativePost:async(_i:unknown,_path:string,body:{operation:string})=>body.operation==='approveDraft'?{status,body:{error:'SYNTHETIC_WRONG_REFUSAL'},digest:'a'.repeat(64)}:{status:200,body:{proofHandle:'synthetic-proof'},digest:'b'.repeat(64)}});
  const memory={'refs.draft-B':{identity:{nativeKey:'synthetic-draft'}},'memory.cookie.A':'synthetic-cookie','ingress.issuer-expired-target':{},'ingress.issuer-expired-issue':{}},receipts:unknown[]=[];
  const store={current:async()=>[{entityId:'synthetic-draft',revisionId:'synthetic-revision'}],approvalCurrent:async()=>({payload:{expiresAt:'2000-01-01T00:00:00Z'}})};
  await expect(run({config:{base:{ownerId:'synthetic-owner'}},assertCurrent(){}},memory,store,receipts)).rejects.toThrow('fixture_exact_refusal_required');
  expect(receipts).toHaveLength(0);
 }
});
test('REFUSAL-ORACLE measurement rechecks every exact refusal code and status',async()=>{
 const source=readFileSync(new URL('../../harness/native_foundations_measurement.ts',import.meta.url),'utf8');
 const legacy=source.match(/for\(const id of (\[[^\n]+?\])\)\{/);
 const table=(fixtureImplementation as unknown as {expectedFixtureRefusals?:Record<string,unknown>}).expectedFixtureRefusals;
 const ids=table?Object.keys(table):JSON.parse(legacy![1]!.replaceAll("'",'"')) as string[];
 expect(ids.length).toBeGreaterThan(5);
 const run=refusalOracleFunction('native_foundations_measurement.ts','baselineChecks','  const writers',{check:(ok:unknown,code:string)=>{if(!ok)throw Error(code);}});
 for(const status of [500,503,400]){
  const receipts=ids.map(id=>({id,status,refusalCode:'SYNTHETIC_WRONG_REFUSAL',resultSha256:'a'.repeat(64),headUnchanged:true}));
  await expect(run({}, {'native.setupReceipts':receipts},{},{},[],[])).rejects.toThrow('exact_genuine_setup_refusal_required');
 }
});

describe('epoch10 fixed writer and byte-budget source contracts (no native execution)',()=>{
 const schedule=()=>({schema:'root-dependency-writer-schedule.v1',sqlCases:Object.entries(dependencyWriterOperations).flatMap(([family,ops])=>ops.flatMap(operation=>(['COMMIT','ROLLBACK'] as const).map(disposition=>{const id=dependencyWriterCaseId(family,operation,disposition);return {id,family,operation,disposition,ingress:'STORE_API',targetFixtureKey:id,expectedBefore:'ABSENT',expectedAfter:disposition==='COMMIT'?'NEW_RECEIPT':'UNCHANGED',readerRequestId:'W-R-'+id,barrier:'SHARED_OWNER'};}))),authLeaseCases:['consumeInvitation','registerIdentity'],exclusions:['F5:EXCLUDED_EXISTING','F7_RECOVERY4:EXCLUDED_EXISTING','F8:LATE_ROOT_OWNED']});
 test('requires every exact operation/disposition; never substitutes a count for identity',()=>{
  const s=validateDependencyWriterSchedule(schedule());expect(s.sqlCases).toHaveLength(44);expect(s.sqlCases.filter(c=>c.family==='F1')).toHaveLength(32);expect(s.sqlCases.filter(c=>c.family==='F6')).toHaveLength(6);
  expect(new Set(s.sqlCases.map(c=>c.readerRequestId)).size).toBe(44);expect(Object.isFrozen(s.sqlCases)).toBe(true);
  for(const f of ['F1','F2','F3','F4','F6'])expect(s.sqlCases.filter(c=>c.family===f).every(c=>typeof dependencyStoreOperation(c)==='string')).toBe(true);
  const missing=schedule();missing.sqlCases.pop();expect(()=>validateDependencyWriterSchedule(missing)).toThrow('exact44');
  const duplicate=schedule();duplicate.sqlCases[1]=duplicate.sqlCases[0]!;expect(()=>validateDependencyWriterSchedule(duplicate)).toThrow('fixed_writer_case');
 });
 test('rejects arbitrary effect material, recovery grants and mismatched target/reader bindings',()=>{
  for(const field of ['sql','callback','provider','path','principal','signer','clock']){const s=schedule();Object.assign(s.sqlCases[0]!,{[field]:'unadmitted'});expect(()=>validateDependencyWriterSchedule(s)).toThrow();}
  for(const field of ['targetFixtureKey','readerRequestId'] as const){const s=schedule();s.sqlCases[0]![field]='other';expect(()=>validateDependencyWriterSchedule(s)).toThrow();}
  const recovery=schedule();recovery.exclusions[1]='F7_RECOVERY4:ADMITTED';expect(()=>validateDependencyWriterSchedule(recovery)).toThrow('writer_exclusions');
 });
 test('genuine-resource dependency order survives an unordered sealed set; draft rollback never follows its committed creation',()=>{
  const input=schedule();input.sqlCases.reverse();const original=canonicalJson(input),cases=orderedDependencyWriterCases(input),ids=cases.map(c=>c.id);
  expect(canonicalJson(input)).toBe(original);expect(new Set(ids).size).toBe(44);
  const before=(a:string,b:string)=>expect(ids.indexOf(a)).toBeLessThan(ids.indexOf(b));
  before('W-F1-appendTeacher-C','W-F1-appendTeacher-R');before('W-F2-C','W-F1-appendStudentRevision-C');
  before('W-F1-correctProgress-C','W-F1-appendActivityScope-C');before('W-F1-appendActivityScope-C','W-F1-appendActivityScope-R');
  before('W-F1-appendScoreEvidence-R','W-F1-createDraft-R');
  for(const op of ['createDraft','correctDraft','issueApproval','revokeApproval','consumeApproval'])before('W-F1-'+op+'-R','W-F1-'+op+'-C');
  before('W-F1-correctDraft-C','W-F1-issueApproval-R');before('W-F1-issueApproval-C','W-F1-revokeApproval-R');before('W-F1-revokeApproval-C','W-F1-consumeApproval-R');
 });
 test('legal page100 crosses 1MiB from the exact100 persisted published notes alone',()=>{
  const notes=Array.from({length:100},()=>({state:'known',value:'P'.repeat(11000),evidence:[]}));
  expect(c07PublishedNoteLowerBound(notes)).toBe(1100200);expect(c07PublishedNoteLowerBound(notes)).toBeGreaterThan(c07FixturePolicy.maxOutputBytes);expect(c07FixturePolicy.pageSize).toBe(100);
  expect(()=>c07PublishedNoteLowerBound(notes.slice(1))).toThrow('exact100');
  expect(()=>c07PublishedNoteLowerBound([{state:'unknown'},...notes.slice(1)])).toThrow('persisted_note');
 });
});

describe('C2-r3 ordinary continuation and relay source proof only',()=>{
 test('all cursor transports advance together without changing semantic request or original input',()=>{
  const first=request({pageSize:1}),before=structuredClone(first),next=continueNativeRead(first,'fictional-opaque-token');
  expect(first).toEqual(before);expect(next.requestId).not.toBe(first.requestId);
  expect(next.cursor).toBe(next.functionRequest.cursor??null);
  if(next.selector.kind!=='REGISTERED_QUERY')throw Error('fixture');
  expect(next.selector.query.page.cursor).toBe(next.cursor);
  expect(nativeRequestDigest(first)).toBe(nativeRequestDigest(next));
  expect(()=>continueNativeRead(first,'x'.repeat(8193))).toThrow();
 });
 test('real source issuer/owner codec pages mixed objects and links; predecessor and UNKNOWN never authorize output',async()=>{
  const f=toyFixture(),store=new FakePrerequisiteStore();
  const now=Date.parse('2026-10-24T00:00:00.000Z'),temporal=testTemporal();
  mapFixtureViews(store,view=>({...view,readOccurrenceLookup:async admission=>{
   const found=store.admissions.get(admission.requestId);if(!found||canonicalJson(found)!==canonicalJson(admission))throw Error('read_request_binding_conflict');
   const final=store.finalizations.find(x=>x.request.requestId===admission.requestId);
   return {request:found,status:store.occurrenceStatus.get(admission.requestId) as 'PENDING'|'UNKNOWN'|'COMPLETED'|'REFUSED',snapshotDigest:final?.snapshotDigest??null,refusalCode:final?.refusalCode??null,partialDataDiscarded:true};
  }}));
  const profile=fixedConsumerProfile('CURRENT_1_1'),codecContext={registrySha256:TEST_REGISTRY_SHA256,processNonce:'fictional-r3',interfaceBinding:SHA,consumerProfile:'CURRENT_1_1',consumerProfileDigest:profile.pins.consumerProfileDigest};
  try{await f.auth.withOutputLease(async state=>{
   const service=createNativeTypedRead(store.asStore(),ctx.ownerId,{now:()=>now,processEpoch:codecContext.processNonce,registrySha256:TEST_REGISTRY_SHA256,snapshotGrantSecret:state.sessionKey,cursorOwner:ownerCursorLeaseFor(state,codecContext,()=>true),cursorInterfaceBinding:SHA,cursorExpiryCap:now+600000,sessionExpiresAt:now+600000,cursorContext:{runId:'fictional-r3',principalRef:nativeRef('principal'),authorityRef:nativeRef('authority'),recipientAdmissionRef:nativeRef('recipient')}});
   const acquired=await service.acquireSnapshot(ctx,{schema:'native-read-acquire.v2',consumerProfile:'CURRENT_1_1',requestId:'fictional-r3-acquire',scopeRef:nativeRef(),consistency:'FAIL_ON_CHANGE',time:{mode:'CURRENT'},functionIntent:testFunctionRequest(temporal,1)});
   const first=request({pageSize:1,temporalSelection:temporal,snapshot:acquired.snapshot,asOf:acquired.snapshot.asOf,snapshotAdmission:acquired.snapshotAdmission});
   const one=await service.typedRead(ctx,first);expect(one.items).toHaveLength(1);expect(one.nextCursor).not.toBeNull();
   const token=one.nextCursor!,next=continueNativeRead(first,token),before=store.commitCalls;
   store.occurrenceStatus.set(first.requestId,'PENDING');await expect(service.typedRead(ctx,next)).rejects.toMatchObject({code:'READ_UNRESOLVED',httpStatus:503});expect(store.commitCalls).toBe(before);
   store.occurrenceStatus.set(first.requestId,'COMPLETED');
   const items=[...one.items];let page=one;
   while(page.nextCursor){page=await service.typedRead(ctx,continueNativeRead(first,page.nextCursor));items.push(...page.items);expect(items.length).toBeLessThan(10);}
   expect(items.some(x=>x.kind==='OBJECT')).toBe(true);expect(items.some(x=>x.kind==='LINK')).toBe(true);
   expect(new Set(items.map(x=>canonicalJson(x))).size).toBe(items.length);
   expect(store.finalizations.filter(x=>x.status==='COMPLETED')).toHaveLength(items.length);
   const changed=continueNativeRead(first,token);changed.linkMask=[];
   await expect(service.typedRead(ctx,changed)).rejects.toMatchObject({code:'OBJECTSET_CURSOR_STALE'});
   const tampered=continueNativeRead(first,token.slice(0,-2)+(token.at(-2)==='A'?'B':'A')+token.at(-1));
   await expect(service.typedRead(ctx,tampered)).rejects.toMatchObject({code:'OBJECTSET_CURSOR_STALE'});
   store.binding=null;await expect(service.typedRead(ctx,tampered)).rejects.toMatchObject({code:'PERMISSION_DENIED',httpStatus:403});
  });}finally{f.cleanup();}
 });
 test('fragmented PG17 frames suppress exactly one armed COMMIT and its coalesced ReadyForQuery without retaining cancel secrets',()=>{
  const frame=(type:string,payload:Buffer)=>{const b=Buffer.alloc(5+payload.length);b[0]=type.charCodeAt(0);b.writeUInt32BE(4+payload.length,1);payload.copy(b,5);return b;};
  const key=Buffer.alloc(8);key.writeUInt32BE(17);key.writeUInt32BE(123,4);
  const parser=new PG17CommitAckFilter(9),forwarded:Buffer[]=[],lost:unknown[]=[];
  const push=(b:Buffer)=>parser.push(b,x=>forwarded.push(Buffer.from(x)),x=>lost.push(x));
  const startup=frame('K',key);push(startup.subarray(0,3));push(startup.subarray(3));expect(parser.backendPid).toBe(17);
  expect(()=>parser.arm('fictional-read',18)).toThrow();parser.arm('fictional-read',17);
  push(frame('C',Buffer.from('SELECT 1\0')));expect(lost).toEqual([]);
  const commit=Buffer.concat([frame('C',Buffer.from('COMMIT\0')),frame('Z',Buffer.from('I'))]);
  push(commit.subarray(0,8));push(commit.subarray(8));expect(lost).toEqual([{requestId:'fictional-read',backendPid:17,connectionId:9}]);
  expect(forwarded.map(x=>String.fromCharCode(x[0]!))).toEqual(['K','C']);expect(()=>parser.arm('again',17)).toThrow();parser.close();
 });
 test('relay short writes preserve every byte and bounded queues refuse overload rather than lose data',()=>{
  const accepted:Buffer[]=[],state={pause:0,resume:0,limit:2};
  const q=new BoundedRelayQueue(()=>state.pause++,()=>state.resume++,8);
  q.attach({write(bytes){const n=Math.min(state.limit,bytes.length);accepted.push(Buffer.from(bytes.subarray(0,n)));return n;}});
  q.push(Buffer.from('abcdef'));expect(q.pendingBytes).toBe(4);expect(state.pause).toBe(1);
  q.drain();q.drain();expect(q.pendingBytes).toBe(0);expect(Buffer.concat(accepted).toString()).toBe('abcdef');
  state.limit=0;q.push(Buffer.from('12345678'));expect(()=>q.push(Buffer.from('9'))).toThrow('relay_buffer_bound');q.close();expect(q.pendingBytes).toBe(0);
 });
 test('all deadline dimensions require owner provenance and explicit applicable disposition',()=>{
  const binding={schema:'root-cursor-owner-binding.v1',interfaceId:'fictional-interface',ownerId:'synthetic-owner',runId:'fictional-run',occurrenceId:'fictional-occurrence',principalRef:nativeRef('principal'),authorityRef:nativeRef('authority'),recipientAdmissionRef:nativeRef('recipient'),sourceReviewSha256:SHA,environmentSha256:SHA,pipe:{readFd:7,writeFd:8,device:1,inode:1},deadlines:['acquisition','session','grant','snapshot','source','read','output','admission','retention'].map(dimension=>({dimension,disposition:'APPLICABLE',expiresAt:'2026-10-24T01:00:00.000Z',provenance:nativeRef('deadline-'+dimension)}))};
  expect(()=>validateCursorOwnerBinding(binding)).not.toThrow();
  for(const deadlines of [binding.deadlines.slice(1),[...binding.deadlines.slice(1),binding.deadlines[1]],binding.deadlines.map(x=>({...x,expiresAt:null})),binding.deadlines.map(x=>({...x,provenance:null}))])expect(()=>validateCursorOwnerBinding({...binding,deadlines})).toThrow();
 });
});

/* Ordinary source tests only. Exact target paths below are inert configuration
 * strings, never filesystem targets. All writes belong to private toy fixtures;
 * no helper initializer/START entrypoint, native principal, listener, SQL,
 * provider, network, actual run directory or login/setup flow is invoked.
 * A signed fictional cookie is test input, not a native authentication result. */
const SHA='a'.repeat(64),ORIGIN='http://127.0.0.1:38743';
test('C2 exact four runner source paths permit only the declared Python source and refuse arbitrary scripts',()=>{
 const base=configuration();expect(Object.values(fixedRunnerPaths)).toHaveLength(4);
 expect(base.sourceSet.files.filter(x=>x.path.endsWith('.py')).map(x=>x.path)).toEqual([fixedRunnerPaths.CONTROLLER]);
 for(const path of ['apps/academy/dc-gang-a/harness/other.py','apps/academy/dc-gang-a/harness/other.ts','apps/academy/dc-gang-a/src/academy/other.py']){
  const files=[...base.sourceSet.files,{path,sha256:SHA,bytes:1}];expect(()=>validateConfiguration({...base,sourceSet:{files,sha256:sourceSetDigest(files)}})).toThrow();
 }
});
test('C2 closed runner configuration preserves Root resource selection and refuses program/stage/pipe broadening',()=>{
 const base={...configuration(),ownerId:'synthetic-p4-e2e-p4-native-20261027-66',authSha256:null};
 const config={schema:'fixed-native-runner.v2',status:'SEALED',kind:'MIGRATE',stage:'MIGRATE',base,input:{readFd:7,writeFd:8,device:1,inode:17},output:{readFd:9,writeFd:10,device:1,inode:18},inputSha256:SHA,inputByteLength:1,resourceSelection:{path:'reports/p4-p5-execution/claude-takeover-20261027/gen98/candidate/bindings/resource-names.v1.json',sha256:'70839cc27470f46f01fdb4f27c2175b36b00ce780392371a98160609375d19ba',bytes:6820},bootstrapSelection:{path:'reports/p4-p5-execution/claude-takeover-20261027/gen98/candidate/bindings/bootstrap-selection.v1.json',sha256:'cd3ca92766a6f52927f9abc83f33b0dacb691b1ab53f279bada3de945798418f',bytes:3983},liveHelper:null,helperStartReceipt:null,previousStageReceipt:null,windowState:'CLOSED'};
 expect(validateFixedRunner(config).stage).toBe('MIGRATE');
 for(const value of [{...config,kind:'SHELL'},{...config,stage:'OTHER'},{...config,argv:['arbitrary']},{...config,input:{...config.input,readFd:0}},{...config,windowState:'OPEN'},{...config,resourceSelection:{...config.resourceSelection,sha256:SHA}}])expect(()=>validateFixedRunner(value)).toThrow();
});
test('C2 all fixed source entrypoints reject unverified invocations before imports, file access or native effects',async()=>{
 for(const run of [migrateNativeFoundations,produceNativeFixtures,measureNativeFoundations])await expect(run({config:{kind:'MIGRATE'}} as never)).rejects.toThrow('verified_fixed_runner_required');
});
test('C2 binding retains lexical types and exact distinct source accounting never treats static template rows as results',()=>{
 expect(bindTemplate({a:{$bind:'actual.lexeme'}},{'actual.lexeme':'-1'})).toEqual({a:'-1'});
 expect(()=>bindTemplate({a:{$bind:'actual.missing'}},{})).toThrow('actual_native_binding_required');
 expect(()=>bindTemplate({a:{$bind:'x.constructor'}},{x:{}})).toThrow();
 expect(()=>reconcileSources(['entity1@r1','entity2@r2'],[],['entity1@r1','entity2@r2'])).not.toThrow();
 expect(()=>reconcileSources(['entity1@r1','entity2@r2'],[],['entity1@r1'])).toThrow('source_conservation_required');
 expect(()=>reconcileSources(['entity1@r1'],['entity1@r1'],['entity1@r1'])).toThrow();
 expect(baselineOracleIds).toHaveLength(24);expect(fourGOracleIds).toHaveLength(4);
});
test('C1 old/current helper configurations pin the exact selected closure and require sequential same-port predecessor receipts',()=>{
 const current=configuration(),profile=fixedConsumerProfile('OLD_SECTION_1_0');
 const old={...current,consumerProfile:'OLD_SECTION_1_0' as const,consumerProfileDigest:profile.pins.consumerProfileDigest,phase:'OLD-SECTION' as const,registry:{path:profile.definition.registry.path,sha256:profile.definition.registry.sha256,bytes:profile.definition.registry.bytes},predecessor:{phase:'A1' as const,process:{pid:333333333,startTicks:30},stopReceipt:{path:isolatedTarget.directory+'/phases/invented-current/stopped.json',sha256:SHA,bytes:1}}};
 expect(validateConfiguration(old)).toEqual(old);
 expect(()=>validateConfiguration({...old,predecessor:null})).toThrow();
 expect(()=>validateConfiguration({...old,consumerProfileDigest:current.consumerProfileDigest})).toThrow();
 expect(()=>validateConfiguration({...old,registry:current.registry})).toThrow();
 expect(()=>validateConfiguration({...current,effectiveContracts:{...current.effectiveContracts,artifacts:current.effectiveContracts.artifacts.slice(1)}})).toThrow();
 const restore={...current,phase:'CURRENT-RESTORED' as const,predecessor:{...old.predecessor,phase:'OLD-SECTION' as const}};
 expect(validateConfiguration(restore)).toEqual(restore);
 expect(()=>validateConfiguration({...restore,predecessor:old.predecessor})).toThrow();
 const receipt={...admission(old),consumerProfile:'CURRENT_1_1'};
 expect(()=>validateAdmission(old,receipt,SHA,Date.parse('2026-10-25T00:00:30Z'))).toThrow('exact_root_admission_required');
});
test('C1 fixed old helper refuses every public mutation after real authentication without parsing bodies or changing the toy auth file',async()=>{
 const f=toyFixture();
 try{
  const before=readFileSync(f.file),profile=fixedConsumerProfile('OLD_SECTION_1_0');
  const runtime=await composeIsolatedHandler({consumerProfile:'OLD_SECTION_1_0',ownerId:'synthetic-owner',store:new FakePrerequisiteStore().asStore(),authStore:f.auth,registrySha256:profile.definition.registry.sha256,processNonce:'c1-old-only',sourceSetSha256:SHA,serviceInstanceRef:'fictional-service'});
  for(const path of ['/api/setup-session','/api/setup-user','/api/native-prerequisite','/api/native-prereq/activity-scopes','/api/native-prereq/activity-scopes/correct','/api/password-reset/request','/api/teacher-workspace']){
   const response=await runtime.fetch(post(path,{untrusted:'not parsed'}));expect(response.status).toBe(403);expect(await response.json()).toEqual({error:'PERMISSION_DENIED'});
   const anonymous=new Request(ORIGIN+path,{method:'POST',headers:{Origin:ORIGIN},body:'invalid JSON'});expect((await runtime.fetch(anonymous)).status).toBe(401);
  }
  expect(readFileSync(f.file)).toEqual(before);expect(existsSync(f.file+'.lock')).toBe(false);
 }finally{f.cleanup();}
});
function configuration():QualificationConfiguration {
  const files=requiredSourcePaths.map(path=>({path,sha256:SHA,bytes:1}));
  const dependencies=requiredZodPins.map(pin=>({...pin}));
  return {
    schema:'isolated-native-qualification.v2',status:'SEALED',consumerProfile:'CURRENT_1_1',consumerProfileDigest:fixedConsumerProfile('CURRENT_1_1').pins.consumerProfileDigest,effectiveContracts:{manifest:selectedProtocolClosure.selectedManifest,artifacts:selectedProtocolClosure.artifacts},operation:'START',phase:'A0',runId:isolatedTarget.runId,
    ownerId:'synthetic-owner',occurrenceId:'fictional-source-occurrence',serviceInstanceRef:'fictional-service',hostname:'127.0.0.1',port:38743,
    worktree:isolatedTarget.worktree,taskDirectory:isolatedTarget.directory,metadataDirectory:isolatedTarget.directory+'/phases/fictional-only',
    authFile:isolatedTarget.directory+'/auth-a/web-auth.json',authSha256:SHA,sourceSet:{sha256:sourceSetDigest(files),files},
    dependencySet:{sha256:sourceSetDigest(dependencies),files:dependencies},
    registry:{path:fixedConsumerProfile('CURRENT_1_1').definition.registry.path,sha256:fixedConsumerProfile('CURRENT_1_1').definition.registry.sha256,bytes:fixedConsumerProfile('CURRENT_1_1').definition.registry.bytes},environment:{path:isolatedTarget.environment,sha256:SHA,bytes:1},
    runtime:{path:isolatedTarget.runtime,sha256:isolatedTarget.runtimeSha256,bytes:88979072,version:'1.4.3'},
    provider:{image:isolatedTarget.image,socket:isolatedTarget.providerSocket,database:isolatedTarget.database,username:isolatedTarget.username},
    executor:{pid:111111111,startTicks:10,uid:0},controller:{pid:222222222,startTicks:20},environmentSha256:SHA,invitationPipe:null,predecessor:null,
  };
}
function admission(c=configuration()) {
  return {consumerProfile:c.consumerProfile,consumerProfileDigest:c.consumerProfileDigest,selectedManifestSha256:c.effectiveContracts.manifest.sha256,schema:'root-isolated-occurrence-admission.v1',decision:'GO_EXACT_OCCURRENCE',authorityEpoch:11,manifestSha256:SHA,sourceSetSha256:c.sourceSet.sha256,dependencySetSha256:c.dependencySet.sha256,registrySha256:c.registry.sha256,runtimeSha256:c.runtime.sha256,environmentSha256:c.environment.sha256,helperSha256:SHA,reviewSha256:SHA,runId:c.runId,ownerId:c.ownerId,occurrenceId:c.occurrenceId,phase:c.phase,operation:c.operation,serviceInstanceRef:c.serviceInstanceRef,executor:{pid:c.executor.pid,startTicks:c.executor.startTicks},controller:c.controller,issuedAt:'2026-10-25T00:00:00.000Z',expiresAt:'2026-10-25T00:01:00.000Z'};
}
describe('two-profile immutable sealed environment (real helper validator)',()=>{
  const cur=fixedConsumerProfile('CURRENT_1_1').definition.registry.sha256,old=fixedConsumerProfile('OLD_SECTION_1_0').definition.registry.sha256;
  const env=()=>({status:'SEALED_FOR_EXACT_NATIVE_OCCURRENCES',sourceSetSha256:SHA,runId:isolatedTarget.runId,ownerId:'synthetic-owner',registrySha256ByProfile:{CURRENT_1_1:cur,OLD_SECTION_1_0:old}});
  const sel=(p:'CURRENT_1_1'|'OLD_SECTION_1_0')=>({consumerProfile:p,registrySha256:p==='CURRENT_1_1'?cur:old,sourceSetSha256:SHA,runId:isolatedTarget.runId,ownerId:'synthetic-owner'});
  test('both exact profiles accept the same sealed environment value',()=>{
    const e=env();expect(()=>validateSealedEnvironment(e,sel('CURRENT_1_1'))).not.toThrow();expect(()=>validateSealedEnvironment(e,sel('OLD_SECTION_1_0'))).not.toThrow();
  });
  test('missing/swapped/wrong/extra/singular-only environments refuse',()=>{
    const e=env(),{OLD_SECTION_1_0:_drop,...onlyCur}=e.registrySha256ByProfile;
    for(const v of [{...e,registrySha256ByProfile:onlyCur},{...e,registrySha256ByProfile:{CURRENT_1_1:old,OLD_SECTION_1_0:cur}},{...e,registrySha256ByProfile:{CURRENT_1_1:SHA,OLD_SECTION_1_0:old}},{...e,registrySha256ByProfile:{...e.registrySha256ByProfile,EXTRA_1_0:cur}},{status:e.status,sourceSetSha256:SHA,runId:e.runId,ownerId:e.ownerId,registrySha256:cur},{...e,registrySha256:cur}])expect(()=>validateSealedEnvironment(v,sel('CURRENT_1_1'))).toThrow('exact_environment_successor_required');
  });
  test('selected registry and source/owner/run mismatches refuse',()=>{
    const e=env();expect(()=>validateSealedEnvironment(e,{...sel('CURRENT_1_1'),registrySha256:old})).toThrow('exact_environment_successor_required');
    expect(()=>validateSealedEnvironment(e,{...sel('OLD_SECTION_1_0'),registrySha256:cur})).toThrow('exact_environment_successor_required');
    for(const patch of [{sourceSetSha256:'b'.repeat(64)},{ownerId:'synthetic-other'},{runId:'other-run'}])expect(()=>validateSealedEnvironment(e,{...sel('CURRENT_1_1'),...patch})).toThrow('exact_environment_successor_required');
    for(const patch of [{sourceSetSha256:'b'.repeat(64)},{ownerId:'synthetic-other'},{runId:'other-run'}])expect(()=>validateSealedEnvironment({...e,...patch},sel('CURRENT_1_1'))).toThrow('exact_environment_successor_required');
  });
});
describe('closed isolated configuration and separate exact authority',()=>{
  test('complete metadata validates without touching any declared runtime path',()=>{
    const c=configuration();expect(validateConfiguration(c)).toEqual(c);
    expect(()=>validateAdmission(c,admission(c),SHA,Date.parse('2026-10-25T00:00:30Z'))).not.toThrow();
    expect(requiredSourcePaths.length).toBe(107);
    expect(requiredSourcePaths).toContain('apps/academy/dc-gang-a/tests/academy/fourGapSourceGrammar.test.ts');
    expect(Object.isFrozen(validateConfiguration(c).sourceSet.files)).toBe(true);
  });
  test('missing/HELD/unbound configuration refuses before runtime entry',()=>{
    for(const value of [undefined,null,{}, {...configuration(),status:'HELD'}, {...configuration(),ownerId:null}, {...configuration(),executor:null}])expect(()=>validateConfiguration(value)).toThrow('isolated_config_required');
    expect(()=>loadVerifiedInvocation('/opt/data/profiles/dc-gang-a-dev/owner.json',SHA,SHA)).toThrow('isolated_config_required');
  });
  test('production paths,8411,non-loopback,DSN/profile overrides and path traversal refuse',()=>{
    const c=configuration();
    for(const value of [
      {...c,port:8411},{...c,hostname:'0.0.0.0'},{...c,authFile:'/opt/data/profiles/dc-gang-a-dev/academy/web-auth.json'},
      {...c,worktree:'/opt/data/workspace/dc-gang-a'},{...c,taskDirectory:'/tmp/another-run'},
      {...c,metadataDirectory:isolatedTarget.directory+'/phases/../auth-a'},
      {...c,provider:{...c.provider,socket:'/run/postgresql'}},{...c,provider:{...c.provider,dsn:'postgres://production'}},
      {...c,HERMES_HOME:'/opt/data/profiles/dc-gang-a-dev'},
    ])expect(()=>validateConfiguration(value)).toThrow('isolated_config_required');
  });
  test('source omissions,duplicates,source-set drift and registry/runtime substitutions refuse',()=>{
    const c=configuration(),missing=c.sourceSet.files.slice(1),duplicate=[...c.sourceSet.files,c.sourceSet.files[0]!];
    for(const value of [
      {...c,sourceSet:{sha256:sourceSetDigest(missing),files:missing}},
      {...c,sourceSet:{sha256:sourceSetDigest(duplicate),files:duplicate}},
      {...c,sourceSet:{...c.sourceSet,sha256:'b'.repeat(64)}},
      {...c,registry:{...c.registry,sha256:SHA}}, {...c,runtime:{...c.runtime,sha256:SHA}},
    ])expect(()=>validateConfiguration(value)).toThrow('isolated_config_required');
  });
  test('authorization cannot be inferred from a source manifest or extended by operational timeout',()=>{
    const c=configuration(),a=admission(c),now=Date.parse('2026-10-25T00:00:30Z');
    for(const value of [null,{...a,decision:'HELD'},{...a,phase:'B0'},{...a,manifestSha256:'b'.repeat(64)},{...a,sourceSetSha256:'b'.repeat(64)},{...a,executor:{pid:1,startTicks:1}},{...a,serviceInstanceRef:'other-service'}])expect(()=>validateAdmission(c,value,SHA,now)).toThrow();
    expect(()=>validateAdmission(c,a,SHA,Date.parse(a.expiresAt))).toThrow('exact_root_admission_required');
    expect(()=>validateAdmission(c,a,SHA,Date.parse(a.issuedAt)-1)).toThrow('exact_root_admission_required');
  });
});
describe('A0/B0/A1 and restart boundaries',()=>{
  test('only A0/B0 initialize; A1/restart retain A authentication',()=>{
    expect(authPhasePolicy('A0','AUTH_INIT')).toEqual({authDirectory:'auth-a',expected:'ABSENT'});
    expect(authPhasePolicy('B0','AUTH_INIT')).toEqual({authDirectory:'auth-b',expected:'ABSENT'});
    for(const phase of ['A1','P-RESTART'] as const){
      expect(()=>authPhasePolicy(phase,'AUTH_INIT')).toThrow('auth_reinitialization_prohibited');
      expect(authPhasePolicy(phase,'START')).toEqual({authDirectory:'auth-a',expected:'REGISTERED'});
    }
  });
  test('initialization needs its own private pipe and absent auth pin; ordinary START cannot consume one',()=>{
    const c=configuration(),init={...c,operation:'AUTH_INIT',authSha256:null,invitationPipe:{writeFd:7,readFd:8,device:1,inode:1}};
    expect(validateConfiguration(init).operation).toBe('AUTH_INIT');
    for(const value of [{...init,invitationPipe:null},{...init,authSha256:SHA},{...init,invitationPipe:{...init.invitationPipe,writeFd:1}},{...c,invitationPipe:init.invitationPipe}])expect(()=>validateConfiguration(value)).toThrow();
  });
  test('later phases require exact previous stop metadata and the corresponding auth file',()=>{
    const c=configuration();
    for(const phase of ['B0','A1','P-RESTART'] as const){
      const prior=phase==='B0'?'A0':phase==='A1'?'B0':'CURRENT-RESTORED';
      const candidate={...c,phase,authFile:isolatedTarget.directory+(phase==='B0'?'/auth-b':'/auth-a')+'/web-auth.json',predecessor:{phase:prior,process:{pid:99999999,startTicks:1},stopReceipt:{path:isolatedTarget.directory+'/phases/previous/stopped.json',sha256:SHA,bytes:1}}};
      expect(validateConfiguration(candidate).phase).toBe(phase);
      expect(()=>validateConfiguration({...candidate,predecessor:null})).toThrow();
      expect(()=>validateConfiguration({...candidate,predecessor:{...candidate.predecessor,phase:'P-RESTART'}})).toThrow();
    }
  });
});

function toyFixture(identity:ProductAuthState['identity']={actorId:'synthetic-actor',username:'fictional',passwordHash:'fictional-not-a-password'}) {
  const directory=mkdtempSync(join(tmpdir(),'w4-isolated-source-test-'));chmodSync(directory,0o700);
  const file=join(directory,'toy-auth.json');
  const state:ProductAuthState={schemaVersion:1,sessionKey:'fictional-unit-only-session-key',identity,invitationDigest:identity?null:'fictional-invitation-digest',passwordRecovery:null};
  writeExclusivePrivateJson(file,state);
  return {directory,file,state,auth:new TeacherAuthStore(file),cleanup(){rmSync(directory,{recursive:true});expect(existsSync(directory)).toBe(false);}};
}
describe('pinned code hardlinks and private auth remain distinct',()=>{
  test('exact regular code hardlinks pass while either alias hash/size drift refuses',()=>{
    const directory=mkdtempSync(join(tmpdir(),'w4-code-hardlink-test-'));chmodSync(directory,0o700);
    try{
      const file=join(directory,'toy-code.js'),alias=join(directory,'toy-code-alias.js');
      const bytes=Buffer.from('export const fictionalCode = 1;\n');writeFileSync(file,bytes,{mode:0o600});linkSync(file,alias);
      const pin={path:'toy-code.js',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
      expect(lstatSync(file).nlink).toBe(2);expect(lstatSync(alias).ino).toBe(lstatSync(file).ino);
      expect(readPinnedFile(directory,pin)).toEqual(bytes);
      expect(readPinnedFile(directory,{...pin,path:'toy-code-alias.js'})).toEqual(bytes);
      expect(()=>readPinnedFile(directory,{...pin,bytes:bytes.length+1})).toThrow('source_pin_mismatch');
      expect(()=>readPinnedFile(directory,{...pin,sha256:SHA})).toThrow('source_pin_mismatch');
      writeFileSync(alias,Buffer.from('export const fictionalCode = 2;\n'));
      expect(()=>readPinnedFile(directory,pin)).toThrow('source_pin_mismatch');
    }finally{rmSync(directory,{recursive:true});expect(existsSync(directory)).toBe(false);}
  });
  test('code hardlinks do not admit symlink aliases/components or directories',()=>{
    const directory=mkdtempSync(join(tmpdir(),'w4-code-path-test-'));chmodSync(directory,0o700);
    try{
      const file=join(directory,'toy-code.js'),nested=join(directory,'nested');mkdirSync(nested,{mode:0o700});
      const bytes=Buffer.from('fictional');writeFileSync(file,bytes,{mode:0o600});
      const pin={path:'toy-code.js',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
      linkSync(file,join(nested,'alias.js'));symlinkSync(file,join(directory,'symlink.js'));symlinkSync(nested,join(directory,'symlink-dir'));
      expect(()=>readPinnedFile(directory,{...pin,path:'symlink.js'})).toThrow('isolated_path_required');
      expect(()=>readPinnedFile(directory,{...pin,path:'symlink-dir/alias.js'})).toThrow('isolated_path_required');
      expect(()=>readPinnedFile(directory,{...pin,path:'nested'})).toThrow('source_pin_mismatch');
    }finally{rmSync(directory,{recursive:true});expect(existsSync(directory)).toBe(false);}
  });
  test('a hardlinked private toy auth file remains refused without mutation',()=>{
    const f=toyFixture();
    try{
      const before=readFileSync(f.file);linkSync(f.file,join(f.directory,'toy-auth-alias.json'));
      expect(lstatSync(f.file).nlink).toBe(2);
      expect(()=>f.auth.read()).toThrow('private_auth_file_required');
      expect(()=>writeExclusivePrivateJson(f.file,{})).toThrow();
      expect(readFileSync(f.file)).toEqual(before);expect(existsSync(f.file+'.lock')).toBe(false);
    }finally{f.cleanup();}
  });
});
describe('pure connection status seam',()=>{
  test('actual helper runtime graph excludes acquisition modules without executing its output',async()=>{
    // No outdir: Bun returns compilation artifacts in memory only.
    const build=await Bun.build({entrypoints:[new URL('../../harness/native_foundations_qualification.ts',import.meta.url).pathname],target:'bun',metafile:true});
    expect(build.success).toBe(true);if(!build.success||!build.metafile)throw Error('helper_graph_required');
    const inputs=Object.keys(build.metafile.inputs),forbidden=/(sourceRuntime|source-acquisition|nativeDirectSource|nativeConnector|privateArtifactCatalog)/;
    expect(inputs.some(path=>path.endsWith('/academyConnectionStatus.ts'))).toBe(true);
    expect(inputs.filter(path=>forbidden.test(path))).toEqual([]);
    for(const input of Object.values(build.metafile.inputs))expect(input.imports.filter(edge=>forbidden.test(edge.path))).toEqual([]);
  });
  test('default application connection preserves frozen status value and interface',async()=>{
    const status:AcademySourceConnection=academyConnectionStatus;
    expect(status).toEqual({schemaVersion:1,retainedQuery:'available',acquisition:{transport:'direct_http_api',state:'blocked',reason:'direct_http_authentication_not_qualified',browserFallback:false},officialJournalSave:'not_implemented',parentSend:'teacher_owned'});
    expect(Object.isFrozen(status)).toBe(true);expect(Object.isFrozen(status.acquisition)).toBe(true);
    const f=toyFixture(null);
    try{const before=readFileSync(f.file),runtime=await composed(f);expect(runtime.app.connection()).toBe(academyConnectionStatus);expect(readFileSync(f.file)).toEqual(before);}finally{f.cleanup();}
  });
});

describe('private toy-file initialization primitives, never the native initializer',()=>{
  test('exclusive private persistence refuses overwrite,symlink and unsafe parent; source pin drift refuses',()=>{
    const f=toyFixture(null);
    try{
      expect(lstatSync(f.file).mode&0o777).toBe(0o600);expect(lstatSync(f.directory).mode&0o777).toBe(0o700);
      const before=readFileSync(f.file),sha256=createHash('sha256').update(before).digest('hex');
      expect(()=>writeExclusivePrivateJson(f.file,{identity:'forbidden-replacement'})).toThrow();
      expect(readPinnedFile(f.directory,{path:'toy-auth.json',bytes:before.length,sha256})).toEqual(before);
      expect(()=>readPinnedFile(f.directory,{path:'toy-auth.json',bytes:before.length,sha256:SHA})).toThrow('source_pin_mismatch');
      const link=join(f.directory,'toy-link.json');symlinkSync(f.file,link);
      expect(()=>writeExclusivePrivateJson(link,{})).toThrow();
      expect(()=>readPinnedFile(f.directory,{path:'toy-link.json',bytes:before.length,sha256})).toThrow('isolated_path_required');
      chmodSync(f.directory,0o755);expect(()=>writeExclusivePrivateJson(join(f.directory,'another.json'),{})).toThrow('private_directory_required');chmodSync(f.directory,0o700);
      expect(readFileSync(f.file)).toEqual(before);expect(f.auth.read().identity).toBeNull();
    }finally{f.cleanup();}
  });
});

async function composed(f:ReturnType<typeof toyFixture>,store=new FakePrerequisiteStore(),processNonce='fictional-process-A') {
  const runtime=await composeIsolatedHandler({ownerId:'synthetic-owner',store:store.asStore(),authStore:f.auth,registrySha256:TEST_REGISTRY_SHA256,processNonce,sourceSetSha256:SHA,serviceInstanceRef:'fictional-service'});
  return {...runtime,store};
}
function post(path:string,body:unknown) {
  return new Request(ORIGIN+path,{method:'POST',headers:{Origin:ORIGIN,'Content-Type':'application/json',Cookie:'dc_teacher='+signTeacherSession('fictional-unit-only-session-key','synthetic-owner','synthetic-actor')},body:JSON.stringify(body)});
}
async function acquire(runtime:Awaited<ReturnType<typeof composed>>) {
  const response=await runtime.fetch(post('/api/native-read-snapshot',{schema:'native-read-acquire.v2',consumerProfile:'CURRENT_1_1',requestId:'w4-toy-acquire',scopeRef:nativeRef(),consistency:'SNAPSHOT',time:{mode:'CURRENT'},functionIntent:testFunctionRequest(testTemporal())}));
  expect(response.status).toBe(200);const result:NativeSnapshotAcquireResult=await response.json();expect(result.schema).toBe('native-read-acquire-result.v2');return result;
}
describe('actual server/application/auth-lease composition in process',()=>{
  test('identity:null composes through read(),without allocating a principal or setting a cookie',async()=>{
    const f=toyFixture(null);
    try{const before=readFileSync(f.file),r=await composed(f);expect(r.app.ownerId).toBe('synthetic-owner');
      const health=await r.fetch(new Request(ORIGIN+'/health'));expect(health.status).toBe(200);expect(health.headers.get('Set-Cookie')).toBeNull();
      expect((await r.fetch(new Request(ORIGIN+'/api/students'))).status).toBe(404);
      expect(f.auth.read().identity).toBeNull();expect(readFileSync(f.file)).toEqual(before);
    }finally{f.cleanup();}
  });
  test('real grant round trip commits under the actual auth lock; drifted grant and new incarnation refuse',async()=>{
    const f=toyFixture();
    try{
      const toy=new FakePrerequisiteStore(),original=toy.commitReadOutput.bind(toy);let observedLease=false;
      toy.commitReadOutput=async<T>(r:ReadAdmission,prepare:(view:TeacherPrerequisiteReadStore)=>Promise<{kind:'OUTPUT_READY';value:T}|{kind:'OUTPUT_REFUSED';code:string}>)=>{
        observedLease=existsSync(f.file+'.lock');expect(observedLease).toBe(true);
        expect(()=>f.auth.prepareRecovery(1000)).toThrow();return original(r,prepare);
      };
      const before=readFileSync(f.file),runtime=await composed(f,toy),grant=await acquire(runtime);
      const body=request({snapshot:grant.snapshot,asOf:grant.snapshot.asOf,snapshotAdmission:grant.snapshotAdmission});
      const result=await runtime.fetch(post('/api/typed-read',body));expect(result.status).toBe(200);expect((await result.json()).kind).toBe('OK');expect(observedLease).toBe(true);expect(toy.commitCalls).toBe(1);
      expect(existsSync(f.file+'.lock')).toBe(false);expect(readFileSync(f.file)).toEqual(before);
      const parts=grant.snapshotAdmission.proof.split('.');
      const forged={...grant.snapshotAdmission,proof:parts[0]+'.'+(parts[1]![0]==='A'?'B':'A')+parts[1]!.slice(1)};
      const denied=await runtime.fetch(post('/api/typed-read',request({snapshot:grant.snapshot,asOf:grant.snapshot.asOf,snapshotAdmission:forged})));
      expect(denied.status).toBe(409);expect((await denied.json()).error.code).toBe('OBJECTSET_CURSOR_STALE');
      const restarted=await composed(f,new FakePrerequisiteStore(),'fictional-process-B');
      const stale=await restarted.fetch(post('/api/typed-read',request({snapshot:grant.snapshot,asOf:grant.snapshot.asOf,snapshotAdmission:grant.snapshotAdmission})));
      expect(stale.status).toBe(409);expect((await stale.json()).error.code).toBe('OBJECTSET_CURSOR_STALE');
      expect(readFileSync(f.file)).toEqual(before);expect(existsSync(f.file+'.lock')).toBe(false);
    }finally{f.cleanup();}
  });
  test('a held actual auth lease prevents projection/admission and leaves bytes intact',async()=>{
    const f=toyFixture();
    try{
      const runtime=await composed(f),grant=await acquire(runtime),before=readFileSync(f.file);
      await f.auth.withOutputLease(async()=>{
        const denied=await runtime.fetch(post('/api/typed-read',request({snapshot:grant.snapshot,asOf:grant.snapshot.asOf,snapshotAdmission:grant.snapshotAdmission})));
        expect(denied.status).toBe(503);expect(runtime.store.commitCalls).toBe(0);expect(runtime.store.admissions.size).toBe(0);
      });
      expect(readFileSync(f.file)).toEqual(before);expect(existsSync(f.file+'.lock')).toBe(false);
    }finally{f.cleanup();}
  });
});

test('C2 finite qualification rejects arbitrary effects and duplicate binding before any native access',()=>{
 const pipe={readFd:8,writeFd:9,device:1,inode:123};
 const one={id:'owned-case',requestId:'actual-request-a',mode:'DISTINCT',peerRequestId:'actual-request-b',barrier:null};
 const plan={schema:'root-finite-qualification.v1',pipe,cases:[one]};
 expect(validateQualificationPlan(plan).cases).toHaveLength(1);
 for(const invalid of [
  {...plan,command:'arbitrary'},
  {...plan,pipe:{...pipe,readFd:0}},
  {...plan,cases:[{...one,mode:'GENERAL_EXECUTOR'}]},
  {...plan,cases:[one,{...one,id:'other',requestId:'actual-request-b',peerRequestId:'other-request'}]},
  {...plan,cases:[{...one,mode:'ACK_SUPPRESSION',peerRequestId:'unexpected-peer'}]},
  {...plan,cases:[{...one,barrier:'AFTER_AUTH_MUTATION'}]},
 ])expect(()=>validateQualificationPlan(invalid)).toThrow();
 expect(fixedStageOrder.includes('A3-NEGATIVES' as never)).toBe(false);
});
test('C2 migration config is pre-auth only and cannot bypass the helper auth START guard',()=>{
 const absent={...configuration(),authSha256:null};
 expect(()=>validateConfiguration(absent)).toThrow();
 expect(validateConfiguration(absent,'MIGRATE').authSha256).toBeNull();
 expect(()=>validateConfiguration(configuration(),'MIGRATE')).toThrow();
 const plan={schema:'root-finite-qualification.v1',pipe:{readFd:8,writeFd:9,device:1,inode:123},cases:[{id:'case',requestId:'request',mode:'ENCODING_FAILURE',peerRequestId:null,barrier:null}]};
 expect(()=>validateConfiguration({...configuration(),qualification:plan})).toThrow('qualification_current_a1_only');
});

describe('E9 selected Student-only compiler conformance; fictional source evidence',()=>{
 test('fresh Student head uses original native endpoint history without relabeling old activity payloads; missing history denies',async()=>{
  const f=toyFixture(),store=new FakePrerequisiteStore(),now=Date.parse('2026-10-24T00:00:00.000Z');
  let revision='rev-student',history=true;
  mapFixtureViews(store,view=>({...view,
   studentRevisionCurrent:async(owner,id)=>{const v=await view.studentRevisionCurrent(owner,id);return v?{...v,revisionId:revision}:null;},
   ownerRevision:async(owner,family,key,original)=>history&&family==='student'&&original==='rev-student'?await view.studentRevisionCurrent(owner,key):null,
  }));
  try{await f.auth.withOutputLease(async state=>{
   const profile=fixedConsumerProfile('CURRENT_1_1');
   const service=createNativeTypedRead(store.asStore(),ctx.ownerId,{now:()=>now,processEpoch:'fictional-e9-student',registrySha256:TEST_REGISTRY_SHA256,snapshotGrantSecret:state.sessionKey,cursorOwner:ownerCursorLeaseFor(state,{registrySha256:TEST_REGISTRY_SHA256,processNonce:'fictional-e9-student',interfaceBinding:SHA,consumerProfile:'CURRENT_1_1',consumerProfileDigest:profile.pins.consumerProfileDigest},()=>true),cursorInterfaceBinding:SHA,cursorExpiryCap:now+600000,sessionExpiresAt:now+600000,cursorContext:{runId:'fictional-e9-student',principalRef:nativeRef('principal'),authorityRef:nativeRef('authority'),recipientAdmissionRef:nativeRef('recipient')}});
   revision='fictional-new-student-head';
   const temporal=testTemporal({studentRef:objectRef('Student','student-a',revision)}),intent=testFunctionRequest(temporal,1,[temporal.studentRef!,temporal.classGroupRef,...(temporal.occurrence.mode==='EXACT'?[temporal.occurrence.lessonRef]:[])]);
   const acquired=await service.acquireSnapshot(ctx,{schema:'native-read-acquire.v2',consumerProfile:'CURRENT_1_1',requestId:'fictional-e9-student-acquire',scopeRef:nativeRef(),consistency:'FAIL_ON_CHANGE',time:{mode:'CURRENT'},functionIntent:intent});
   const req=request({selector:{kind:'EXACT_OBJECT',objectRef:temporal.studentRef!},fieldMask:fullFieldMask(['Student']),linkMask:[],pageSize:1,temporalSelection:temporal,expectedRevisions:intent.expectedRevisions,snapshot:acquired.snapshot,asOf:acquired.snapshot.asOf,snapshotAdmission:acquired.snapshotAdmission});
   const result=await service.typedRead(ctx,req);
   expect(result.items).toHaveLength(1);expect(result.items[0]).toMatchObject({kind:'OBJECT',record:{identity:{objectType:'Student'},revision}});
   expect(result.nextCursor).toBeNull();
   expect(store.temporals.find(v=>v.payload.bindingKind==='CLASS_MEMBERSHIP')!.payload.subjectRef.revision).toBe('rev-student');
   history=false;
   const denied=structuredClone(req);denied.requestId='fictional-e9-history-missing';denied.functionRequest.requestId='fictional-e9-history-missing-function';
   await expect(service.typedRead(ctx,denied)).rejects.toMatchObject({code:'PERMISSION_DENIED',httpStatus:403});
   expect(store.occurrenceStatus.get(denied.requestId)).toBe('REFUSED');
  });}finally{f.cleanup();}
 });
 test('old authority epoch cannot qualify a current helper admission',()=>{
  const c=configuration(),a=admission(c);
  expect(()=>validateAdmission(c,{...a,authorityEpoch:4},SHA,Date.parse('2026-10-25T00:00:30Z'))).toThrow('exact_root_admission_required');
  for(const epoch of [9,10,12])expect(()=>validateAdmission(c,{...a,authorityEpoch:epoch},SHA,Date.parse('2026-10-25T00:00:30Z'))).toThrow('exact_root_admission_required');
  expect(()=>validateAdmission(c,{...a,authorityEpoch:11},SHA,Date.parse('2026-10-25T00:00:30Z'))).not.toThrow();
  expect(()=>validateAdmission(c,a,SHA,Date.parse('2026-10-25T00:00:30Z'))).not.toThrow();
 });
});

test('E9 same-key cross-principal denial precedes valid or malformed cursor diagnostics in the actual handler over toy authentication',async()=>{
 const f=toyFixture({actorId:'fictional-actor-b',username:'fictional-b',passwordHash:'fictional-not-a-password'}),store=new FakePrerequisiteStore();
 try{
  const {createTeacherServerHandler}=await import('../../src/academy/server'),{TeacherApplication}=await import('../../src/academy/application');
  const handler=createTeacherServerHandler({app:new TeacherApplication(store.asStore(),ctx.ownerId,undefined,undefined,store.asStore()),origin:'http://127.0.0.1:38743',sessionKey:f.state.sessionKey,identity:f.state.identity,invitationDigest:f.state.invitationDigest,saveIdentity:async()=>{throw Error('fictional_setup_not_admitted');},currentAuthentication:()=>f.auth.read(),typedRead:{store:store.asStore(),registrySha256:TEST_REGISTRY_SHA256,processEpoch:'fictional-epoch',outputLease:use=>f.auth.withOutputLease(use),cursorRuntime:{actorId:'fictional-actor-a',interfaceBinding:SHA,expiryCap:Date.now()+600000,context:{runId:'fictional-cross-actor',principalRef:nativeRef('principal-a'),authorityRef:nativeRef('authority-a'),recipientAdmissionRef:nativeRef('recipient')},assertCurrent(){}}}});
  const cookie='dc_teacher='+signTeacherSession(f.state.sessionKey,ctx.ownerId,'fictional-actor-b');
  for(const path of ['/api/typed-read','/api/native-read-snapshot'])for(const cursor of [null,'nrc3.malformed.malformed.malformed','opaque-shape-irrelevant']){
   const response=await handler(new Request('http://127.0.0.1:38743'+path,{method:'POST',headers:{Origin:'http://127.0.0.1:38743','Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({requestId:'fictional-cross-actor-'+String(cursor),cursor})}));
   expect(response.status).toBe(403);const body=await response.json();expect(body.error.code).toBe('PERMISSION_DENIED');expect(body.items).toBeUndefined();expect(body.nextCursor).toBeUndefined();
  }
  expect(store.snapshotCalls).toBe(0);expect(store.commitCalls).toBe(0);
 }finally{f.cleanup();}
});

test('E9 failed-command fence requires the exact original request and a separate closed occurrence; shape alone grants no native effect',()=>{
 const request={ownerId:ctx.ownerId,actorId:ctx.actorId,idempotencyKey:'fictional-key',requestDigest:SHA,occurrenceId:'fictional-original',admissionId:'fictional-admission',processEpoch:'fictional-process'};
 const fence={schema:'root-exact-command-fence.v1',requestBindingSha256:sha256(canonicalJson(request)),fenceOccurrenceId:'fictional-separate-fence',reason:'ABORT'};
 expect(validateRootCommandFence(fence,request)).toEqual({request,fenceOccurrenceId:fence.fenceOccurrenceId,reason:'ABORT'});
 for(const bad of [{...fence,fenceOccurrenceId:request.occurrenceId},{...fence,requestBindingSha256:'0'.repeat(64)},{...fence,extra:true},{...fence,reason:'RETRY'},{...fence,fenceOccurrenceId:''}]){
  expect(()=>validateRootCommandFence(bad,request)).toThrow('separate_root_fence_occurrence_required');
 }
 expect(()=>validateRootCommandFence(fence,{...request,occurrenceId:'fictional-other'})).toThrow('separate_root_fence_occurrence_required');
});

test('E9 post-known-COMMIT session denial hands off pre-encoded401 without JSON serialization or another finalization',async()=>{
 const f=toyFixture({actorId:ctx.actorId,username:'fictional-a',passwordHash:'fictional-not-a-password'}),store=new FakePrerequisiteStore();
 const originalStringify=JSON.stringify;let knownCommit=false;
 try{
  const commit=store.commitReadOutput.bind(store);store.commitReadOutput=async(...args)=>{const result=await commit(...args);knownCommit=true;return result;};
  const {createTeacherServerHandler}=await import('../../src/academy/server'),{TeacherApplication}=await import('../../src/academy/application');
  const handler=createTeacherServerHandler({app:new TeacherApplication(store.asStore(),ctx.ownerId,undefined,undefined,store.asStore()),origin:'http://127.0.0.1:38743',sessionKey:f.state.sessionKey,identity:f.state.identity,invitationDigest:null,saveIdentity:async()=>{throw Error('fictional_setup_not_admitted');},currentAuthentication:()=>({sessionKey:f.state.sessionKey,identity:knownCommit?null:f.state.identity}),typedRead:{store:store.asStore(),processEpoch:'epoch-1',registrySha256:TEST_REGISTRY_SHA256,snapshotGrantVerifier:fictionalGrantVerifier,now:()=>Date.parse('2026-10-24T00:00:00.000Z'),outputLease:use=>f.auth.withOutputLease(use)}});
  const cookie='dc_teacher='+signTeacherSession(f.state.sessionKey,ctx.ownerId,ctx.actorId),body=originalStringify(request());
  JSON.stringify=function(...args:Parameters<typeof JSON.stringify>){if(knownCommit)throw Error('forbidden_postcommit_serialization');return originalStringify.apply(JSON,args);} as typeof JSON.stringify;
  const response=await handler(new Request('http://127.0.0.1:38743/api/typed-read',{method:'POST',headers:{Origin:'http://127.0.0.1:38743','Content-Type':'application/json',Cookie:cookie},body}));
  JSON.stringify=originalStringify;
  expect(response.status).toBe(401);expect(await response.json()).toEqual({error:'teacher_authentication_required'});
  expect(store.finalizations.map(r=>r.status)).toEqual(['COMPLETED']);expect(store.commitCalls).toBe(1);expect(store.directFinalizeCalls).toBe(0);
 }finally{JSON.stringify=originalStringify;f.cleanup();}
});

// RC3 source regression. The application and store are existing toy fixtures;
// consumeInvitation is a deterministic in-memory persistence adapter. No native
// identity, file, process, listener, provider, or authority is created.
test('failed invitation consumption retains the invitation until persistence succeeds',async()=>{
 const {createTeacherServerHandler}=await import('../../src/academy/server');
 const {TeacherApplication}=await import('../../src/academy/application');
 const {secretDigest}=await import('../../src/academy/auth');
 const store=new FakePrerequisiteStore();let persisted=secretDigest('fictional-invitation'),calls=0;
 const handler=createTeacherServerHandler({app:new TeacherApplication(store.asStore(),'synthetic-owner',undefined,undefined,store.asStore()),origin:ORIGIN,sessionKey:'fictional-unit-only-session-key',identity:null,invitationDigest:persisted,saveIdentity:async()=>{throw Error('not used');},consumeInvitation:async()=>{calls++;if(calls===1)throw Error('fictional persistence failure');persisted='';}});
 const request=()=>new Request(ORIGIN+'/api/setup-session',{method:'POST',headers:{Origin:ORIGIN,'Content-Type':'application/json'},body:JSON.stringify({invitation:'fictional-invitation'})});
 expect((await handler(request())).status).toBe(400);expect(persisted).toBe(secretDigest('fictional-invitation'));
 expect((await handler(request())).status).toBe(200);expect(persisted).toBe('');expect(calls).toBe(2);
 expect((await handler(request())).status).toBe(403);expect(calls).toBe(2);
});


test('controller CLI reports the failed call site rather than the shared require helper', async()=>{
 const controller=join(import.meta.dir,'../../harness/native_qualification_controller.py');
 const child=Bun.spawn(['/usr/bin/python3','-I','-S','-B',controller],{stdout:'pipe',stderr:'pipe'});
 const [exit,output,error]=await Promise.all([child.exited,new Response(child.stdout).text(),new Response(child.stderr).text()]);
 expect(exit).toBe(1);expect(output).toBe('');
 const diagnostic=JSON.parse(error),match=String(diagnostic.code).match(/^fixed_controller_argv_required@native_qualification_controller\.py:(\d+)$/);
 expect(match).not.toBeNull();
 const lines=readFileSync(controller,'utf8').split('\n'),line=Number(match![1]);
 expect(lines[line-1]).toContain('require(len(sys.argv)');
});

/** Run only in a fresh source-test child. The loader replaces native admission
 * attestations and private-pipe transport with source-test capabilities. It
 * never edits production modules, creates a Root seal or emits a native PASS.
 * All business code, fixtures, refusal checks, SQL locks and measurements are
 * the original modules. The native run remains responsible for custody pins. */
async function runSourcePlanReplay(settingsPath:string){
 const fs=await import('node:fs'),path=await import('node:path'),crypto=await import('node:crypto');
 const s=JSON.parse(fs.readFileSync(settingsPath,'utf8'));
 const hash=(v:Uint8Array|string)=>crypto.createHash('sha256').update(v).digest('hex');
 const replaceSection=(source:string,start:string,end:string,replacement:string)=>{
  const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
  if(a<0||b<0||source.indexOf(start,a+1)>=0)throw Error('source_replay_boundary_required');
  return source.slice(0,a)+replacement+source.slice(b);
 };
 Bun.plugin({name:'source-only-native-plan-test',setup(builder){
  builder.onLoad({filter:/native_foundations_(qualification|fixture|measurement)\.ts$/},args=>{
   let source=fs.readFileSync(args.path,'utf8').replaceAll('http://127.0.0.1:38743','http://127.0.0.1:'+s.port);
   if(args.path.endsWith('native_foundations_fixture.ts')){
    source=source.replace(/const ROOT_CALLER_EVIDENCE_ROOT='[^']+';/,"const ROOT_CALLER_EVIDENCE_ROOT="+JSON.stringify(s.root)+";");
    source=source.replace("const ORIGIN='http://127.0.0.1:38743';","const ORIGIN="+JSON.stringify('http://127.0.0.1:'+s.port)+";");
   }else if(args.path.endsWith('native_foundations_qualification.ts')){
    source=source.replace(/directory:'[^']+'/,'directory:'+JSON.stringify(s.root)).replace(/providerSocket:'[^']+'/,'providerSocket:'+JSON.stringify(s.socket));
    source=replaceSection(source,'function assertCursorOwnerRootSeal(', '\nfunction noSymlinkComponents(',`function assertCursorOwnerRootSeal(i:VerifiedInvocation):CursorOwnerBinding {assertVerified(i);if(!i.config.cursorOwnerBinding)failure('cursor_owner_binding_required');return i.config.cursorOwnerBinding;}\n`);
    source=replaceSection(source,'function assertInvitationPipe(', '\nfunction claim(',`function assertInvitationPipe(_c:QualificationConfiguration):void {}\n`);
    source=source.replace("const fresh=loadVerifiedInvocation(join(i.config.metadataDirectory,'config.json'),i.manifestSha256,i.admissionSha256);","const fresh=i;");
    source=source.replace('verifiedInvocations.delete(fresh);claimedInvocations.add(i);','claimedInvocations.add(i);');
    const hooks=source.indexOf('function createQualificationHooks('),a=source.indexOf(' const assertCurrent=()=>{',hooks),b=source.indexOf(' const event=',a);
    if(hooks<0||a<0||b<0)throw Error('source_replay_hooks_boundary_required');
    source=source.slice(0,a)+' const assertCurrent=()=>assertVerified(i);\n'+source.slice(b);
    source=source.replace("if(!providerDirectory.isDirectory()||providerDirectory.uid!==999||(providerDirectory.mode&0o777)!==0o700)failure('selected_provider_socket_directory_required');","if(!providerDirectory.isDirectory())failure('selected_provider_socket_directory_required');");
    source+=`\nexport function sourceTestInvocation(config:any,memory?:Record<string,unknown>){
     let claimed=false;const i={config,manifestSha256:'a'.repeat(64),admissionSha256:'b'.repeat(64),assertCurrent(){if(!config)throw Error('source_test_scope_required');},claim(){if(claimed)throw Error('source_test_claim_consumed');claimed=true;},async readMemory(){const {rehydratePrivateMemoryScopes}=await import("./native_foundations_fixture");return rehydratePrivateMemoryScopes(structuredClone(memory??{}));}};
     verifiedInvocations.add(i);runnerWitnesses.add(i);return i;
    }\n`;
   }
   return {contents:source,loader:'ts'};
  });
 }});
 const q=await import(s.qual),f=await import(s.fixture),m=await import(s.measurement),migration=await import(s.migrate);
 const ticks=(pid:number)=>Number(fs.readFileSync('/proc/'+pid+'/stat','utf8').split(') ')[1]!.split(' ')[19]!);
 const identity={pid:process.pid,startTicks:ticks(process.pid),uid:process.getuid!()};
 const configPath=path.join(s.root,'helper-config.json');
 if(s.role==='helper'){
  const c=JSON.parse(fs.readFileSync(configPath,'utf8'));c.executor=identity;
  fs.writeFileSync(path.join(c.metadataDirectory,'admission.json'),JSON.stringify({expiresAt:s.expiresAt}),{mode:0o600});
  if(c.qualification){const fd=fs.openSync(path.join(s.root,'expiry-arm.json'),'a+');c.qualification.pipe={readFd:fd};}
  const helper=await q.startIsolatedHelper(q.sourceTestInvocation(c));
  process.once('SIGTERM',()=>{void helper.stop().then(()=>process.exit(0)).catch(error=>{console.error(error.stack);process.exit(1);});});
  return;
 }
 const seed=JSON.parse(Buffer.from(s.seed,'base64').toString('utf8'));
 for(const [key,pin] of [['definitions',f.ROOT_CALLER_DEFINITIONS_PIN],['slots',f.ROOT_CALLER_SLOTS_PIN]] as const){
  const raw=Buffer.from(seed[key],'base64');if(raw.length!==pin.bytes||hash(raw)!==pin.sha256)throw Error('source_replay_caller_seed_pin_required');
  fs.mkdirSync(path.dirname(path.join(s.root,pin.path)),{recursive:true,mode:0o700});fs.writeFileSync(path.join(s.root,pin.path),raw,{mode:0o600});
 }
 const profile=q.isolatedTarget.runId,owner='synthetic-p4-'+profile,namespace='p4-qualification-'+profile;
 const ref=(type:string,key:string)=>({tag:'object-record',basis:{namespace,scope:{ownerNamespace:owner,projectKey:'official-ontology-platform-redesign-20261023',scopeKey:profile},contract:{state:'UNKNOWN',reason:'NOT_OWNER_SUPPLIED',evidenceRefs:[]},recordRevision:{state:'KNOWN',value:{scheme:'CONTENT_SHA256',value:'a'.repeat(64)}},source:{ownerNamespace:owner,publicLocator:'source-only-native-plan-go.v1',revision:{state:'KNOWN',value:{scheme:'CONTENT_SHA256',value:'a'.repeat(64)}},evidenceRefs:[]}},objectTypeId:type,objectTypeVersion:'1.0.0',objectKey:key});
 const generated=f.selectRootGoBindings(f.buildRootFiniteBindings({occurrenceId:'source-plan-c1',admissionId:'source-plan-a1',namespace,scopeRef:ref('RootQualificationScope',namespace),sourceObservedAt:new Date().toISOString()}),'source-plan-c1','source-plan-f1');
 const go=s.goFile?JSON.parse(fs.readFileSync(s.goFile,'utf8')):{...generated,cursorOwnerBinding:{interfaceId:'source-plan-interface',principalRef:ref('RootControlOperatorPrincipal','source-principal'),authorityRef:ref('RootUserWorkAuthority','source-authority'),recipientAdmissionRef:ref('RootNativeReadOccurrenceRequest','source-recipient'),deadlines:['acquisition','session','grant','snapshot','source','read','output','admission','retention'].map(dimension=>({dimension,disposition:'APPLICABLE',expiresAt:s.expiresAt,provenance:ref('RootNativeDeadlineSelection',dimension)}))}};
 if(s.goFile){
  // The exact GO used for the next native attempt is consumed verbatim. Runtime
  // configuration below selects a different disposable database and frame.
  if(go.decision!=='GO_EXACT_ROOT_NATIVE_DRIVER')throw Error('source_replay_exact_go_required');
 }
 let memory:Record<string,unknown>={...go.bindings,'root.ownerId':owner,'root.namespace':namespace};
 const {SQL}=await import('bun');
 const admin=new SQL({adapter:'postgres',path:s.socket,username:s.username,database:s.adminDatabase,max:1});
 if(!/^source_plan_[a-f0-9]{16}$/.test(s.database))throw Error('source_replay_disposable_database_required');
 await admin.unsafe('CREATE DATABASE "'+s.database+'"');await admin.close();
 const compiler='apps/academy/dc-gang-a/src/academy/nativeTypedRead.ts';
 const pins=[compiler].map(p=>{const raw=fs.readFileSync(path.join(s.repository,p));return {path:p,sha256:hash(raw),bytes:raw.length};});
 const sourceSet={sha256:hash(JSON.stringify(pins)),files:pins};
 const shared={runId:profile,ownerId:owner,worktree:s.repository,taskDirectory:s.root,hostname:'127.0.0.1',port:s.port,sourceSet,dependencySet:{sha256:'c'.repeat(64),files:[]},runtime:{sha256:'d'.repeat(64)},environment:{sha256:'e'.repeat(64)},provider:{socket:s.socket,username:s.username,database:s.database},controller:identity,serviceInstanceRef:'source-plan-service',effectiveContracts:{manifest:{sha256:'f'.repeat(64)}}};
 const cases=q.buildNativeQualificationCases(),schedule=q.buildNativeWriterSchedule();
 let child:ReturnType<typeof Bun.spawn>|null=null,liveConfig:any=null,helperPin:any=null,executed:string[]=[],measurementCount=0;
 const phaseFor=(stage:string)=>['MIGRATE','A0'].includes(stage)?'A0':stage==='B0'?'B0':stage==='OLD-SECTION'||stage==='A-OLD-SECTION'?'OLD-SECTION':stage==='P-RESTART'?'P-RESTART':stage==='CURRENT-RESTORED'||stage==='A2-CURRENT'?'CURRENT-RESTORED':'A1';
 const authPath=(phase:string)=>path.join(s.root,phase==='B0'?'auth-b':'auth-a','web-auth.json');
 const pinFile=(p:string)=>{const raw=fs.readFileSync(p);return {path:p,sha256:hash(raw),bytes:raw.length};};
 try{
  for(const [n,step] of q.nativePlanSteps.entries()){
   const {operation,stage}=step,key=operation+':'+stage;
   memory={...memory,...go.stepBindings[key]};
   const phase=phaseFor(stage),old=phase==='OLD-SECTION',consumerProfile=old?'OLD_SECTION_1_0':'CURRENT_1_1',selected=q.fixedConsumerProfile? q.fixedConsumerProfile(consumerProfile):null;
   const authFile=authPath(phase),metadataDirectory=path.join(s.root,'phases',String(n).padStart(2,'0')+'-'+operation+'-'+stage);
   fs.mkdirSync(metadataDirectory,{recursive:true,mode:0o700});
   const c:any={...shared,operation,phase,consumerProfile,consumerProfileDigest:selected?.pins.consumerProfileDigest,authFile,authSha256:fs.existsSync(authFile)?hash(fs.readFileSync(authFile)):null,metadataDirectory,occurrenceId:'source-step-'+n,executor:identity,registry:{sha256:old?'1'.repeat(64):'2'.repeat(64)}};
   if(operation==='MIGRATE')await migration.migrateNativeFoundations(q.sourceTestInvocation({kind:'MIGRATE',stage,base:c,liveHelper:null},memory));
   else if(operation==='AUTH_INIT'){
    const invitation=path.join(s.root,'invitation-'+phase),fd=fs.openSync(invitation,'wx',0o600);c.invitationPipe={writeFd:fd};
    await q.initializeSyntheticAuthentication(q.sourceTestInvocation(c));
    memory['memory.invitation.'+(phase==='B0'?'B':'A')]=fs.readFileSync(invitation,'utf8').trim();memory['memory.generatedPassword.'+(phase==='B0'?'B':'A')]=crypto.randomBytes(32).toString('base64url');
   }else if(operation==='START'){
    if(child)throw Error('source_replay_helper_already_live');
    const contracts=await import(path.join(s.repository,'apps/academy/dc-gang-a/src/academy/contracts/prerequisiteRecords.ts'));
    const p=contracts.fixedConsumerProfile(consumerProfile);c.consumerProfileDigest=p.pins.consumerProfileDigest;c.registry=p.definition.registry;
    if(!['A0','B0'].includes(phase)){
     c.cursorOwnerBinding={...go.cursorOwnerBinding,runId:profile,ownerId:owner,occurrenceId:c.occurrenceId,sourceReviewSha256:'a'.repeat(64),pipe:{}};
     // The original native schedule is shared with FIXTURE and MEASURE.
     if(phase==='A1'){c.qualification={schema:'root-finite-qualification.v1',cases,pipe:{}};c.dependencyWriterSchedule=schedule;}
    }
    fs.writeFileSync(configPath,JSON.stringify(c),{mode:0o600});
    const helperSettings=path.join(s.root,'helper-settings.json');fs.writeFileSync(helperSettings,JSON.stringify({...s,role:'helper'}),{mode:0o600});
    child=Bun.spawn([process.execPath,'--config=/dev/null','--no-env-file',s.entry,helperSettings],{stdout:fs.openSync(path.join(metadataDirectory,'stdout.log'),'wx',0o600),stderr:fs.openSync(path.join(metadataDirectory,'stderr.log'),'wx',0o600)});
    const started=path.join(metadataDirectory,'started.json'),until=Date.now()+20000;
    while(!fs.existsSync(started)){if(child.exitCode!==null)throw Error('source_replay_helper_start_failed@'+path.join(metadataDirectory,'stderr.log')+':1');if(Date.now()>until)throw Error('source_replay_helper_start_timeout');await Bun.sleep(10);}
    liveConfig=c;helperPin=pinFile(started);memory['native.helperMetadataDirectory']=metadataDirectory;
    if(phase==='A1')memory['native.qualificationCases']=cases;
   }else if(operation==='STOP'){
    if(!child)throw Error('source_replay_no_live_helper');child.kill('SIGTERM');const exit=await child.exited;if(exit!==0)throw Error('source_replay_helper_stop_failed');child=null;liveConfig=null;
   }else if(operation==='FIXTURE'||operation==='MEASURE'){
    if(!child||!liveConfig)throw Error('source_replay_live_helper_required');
    const started=JSON.parse(fs.readFileSync(helperPin.path,'utf8')),output=path.join(metadataDirectory,'memory.json'),fd=fs.openSync(output,'wx',0o600);
    c.phase=liveConfig.phase;c.consumerProfile=liveConfig.consumerProfile;c.consumerProfileDigest=liveConfig.consumerProfileDigest;c.registry=liveConfig.registry;
    if(['A1-SETUP','A1-BASE'].includes(stage))c.dependencyWriterSchedule=schedule;
    if(stage==='A1-BASE'){
     const qcase=cases.find(q=>q.mode==='EXPIRY')!;
     fs.writeFileSync(path.join(s.root,'expiry-arm.json'),JSON.stringify({schema:'root-fixed-expiry-arm.v1',caseId:qcase.id,requestId:qcase.requestId,ownerId:owner,runId:profile,occurrenceId:liveConfig.occurrenceId,sourceSetSha256:sourceSet.sha256,pid:started.pid,startTicks:started.startTicks})+'\n',{mode:0o600});
    }
    const invocation=q.sourceTestInvocation({kind:operation,stage,base:c,output:{writeFd:fd},liveHelper:{pid:started.pid,startTicks:started.startTicks},helperStartReceipt:helperPin},memory);
    try{if(operation==='FIXTURE')await f.produceNativeFixtures(invocation);else {await m.measureNativeFoundations(invocation);measurementCount++;}}
    finally{fs.closeSync(fd);}
    memory=f.rehydratePrivateMemoryScopes(JSON.parse(fs.readFileSync(output,'utf8')));
   }else if(operation==='SEAL'){
    if(child||!Array.isArray(memory['measurement.retirementDenials'])||(memory['measurement.retirementDenials'] as unknown[]).length!==3)throw Error('source_replay_settled_denials_required');
   }else throw Error('source_replay_unknown_operation');
   executed.push(key);console.log(JSON.stringify({sourceReplayStep:n+1,operation,stage,nativeVerdict:null}));
  }
  fs.writeFileSync(path.join(s.root,'source-only-result.json'),JSON.stringify({schema:'native-plan-source-replay.v1',status:'PASS',nativeVerdict:null,authority:'SOURCE_TEST_ONLY',database:s.database,executed,measurementCount,goSha256:s.goFile?hash(fs.readFileSync(s.goFile)):hash(JSON.stringify(go)),businessOracles:'ORIGINAL_PRODUCTION_MODULES',nativeCustodyPins:'NOT_QUALIFIED'}),{mode:0o600});
 }finally{if(child){child.kill('SIGTERM');await child.exited;}}
}

// Immutable synthetic caller definitions/slots, not credentials, grants or a
// native admission. Production digest validation consumes both original bytes.
const nativePlanCallerSeedGzipBase64='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';
const nativePlanReplayTest=process.env.NATIVE_PLAN_PG_SOCKET?test:test.skip;
nativePlanReplayTest('NATIVE-PLAN all 32 shared steps use the real Postgres store and shared GO producer',async()=>{
 const {gunzipSync}=await import('node:zlib');
 const {openSync}=await import('node:fs');
 const repository=join(import.meta.dir,'../../../..','..');
 const root=mkdtempSync(join(tmpdir(),'native-plan-source-'));chmodSync(root,0o700);
 const probe=Bun.serve({hostname:'127.0.0.1',port:0,fetch:()=>new Response()});const port=probe.port;await probe.stop(true);
 const entry=join(root,'source-replay.ts'),settings=join(root,'settings.json'),log=join(root,'test.log');
 writeFileSync(entry,'('+runSourcePlanReplay.toString()+')(process.argv[2]).catch(error=>{console.error(error.stack);process.exitCode=1;});',{mode:0o600});
 const config={root,port,entry,qual:join(repository,'apps/academy/dc-gang-a/harness/native_foundations_qualification.ts'),fixture:join(repository,'apps/academy/dc-gang-a/harness/native_foundations_fixture.ts'),measurement:join(repository,'apps/academy/dc-gang-a/harness/native_foundations_measurement.ts'),migrate:join(repository,'apps/academy/dc-gang-a/harness/native_foundations_migrate.ts'),repository,socket:process.env.NATIVE_PLAN_PG_SOCKET,username:process.env.NATIVE_PLAN_PG_USER??'e2e_qualification',adminDatabase:process.env.NATIVE_PLAN_PG_ADMIN_DATABASE??'postgres',database:'source_plan_'+crypto.randomUUID().replaceAll('-','').slice(0,16),seed:gunzipSync(Buffer.from(nativePlanCallerSeedGzipBase64,'base64')).toString('base64'),expiresAt:new Date(Date.now()+3600000).toISOString(),goFile:process.env.NATIVE_PLAN_GO_FILE??null};
 writeFileSync(settings,JSON.stringify(config),{mode:0o600});
 const fd=openSync(log,'wx',0o600),child=Bun.spawn([process.execPath,'--config=/dev/null','--no-env-file',entry,settings],{stdout:fd,stderr:fd,detached:true,env:{PATH:process.env.PATH??'/usr/local/bin:/usr/bin:/bin',LANG:'C.UTF-8',TZ:'UTC'}});
 let timedOut=false;
 const timeout=setTimeout(()=>{timedOut=true;try{process.kill(-child.pid,'SIGTERM');}catch(error){if((error as NodeJS.ErrnoException).code!=='ESRCH')throw error;}},890000);
 let exit:number;try{exit=await child.exited;}finally{clearTimeout(timeout);(await import('node:fs')).closeSync(fd);}
 if(timedOut)throw Error('source_plan_replay_timeout@'+log+':1');
 if(exit!==0)throw Error('source_plan_replay_failed@'+log+':1');
 const result=JSON.parse(readFileSync(join(root,'source-only-result.json'),'utf8'));
 const {nativePlanSteps}=await import('../../harness/native_foundations_qualification');
 expect(nativePlanSteps).toHaveLength(32);expect(result.executed).toEqual(nativePlanSteps.map(s=>s.operation+':'+s.stage));
 expect(result.status).toBe('PASS');expect(result.nativeVerdict).toBeNull();expect(result.authority).toBe('SOURCE_TEST_ONLY');
 expect(result.measurementCount).toBe(nativePlanSteps.filter(s=>s.operation==='MEASURE').length);
 if(config.goFile)expect(result.goSha256).toBe(createHash('sha256').update(readFileSync(config.goFile)).digest('hex'));
},900000);

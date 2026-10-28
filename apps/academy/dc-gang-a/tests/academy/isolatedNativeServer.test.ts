import {describe,expect,test} from 'bun:test';
import {chmodSync,existsSync,linkSync,lstatSync,mkdirSync,mkdtempSync,readFileSync,rmSync,symlinkSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {authPhasePolicy,composeIsolatedHandler,dependencyTargets,fixedRunnerPaths,isolatedTarget,loadVerifiedInvocation,readPinnedFile,requiredSourcePaths,requiredZodPins,sourceSetDigest,validateAdmission,validateConfiguration,validateFixedRunner,validateQualificationPlan,validateCursorOwnerBinding,validateSealedEnvironment,PG17CommitAckFilter,BoundedRelayQueue,fixedStageOrder,writeExclusivePrivateJson,type QualificationConfiguration} from '../../harness/native_foundations_qualification';
import {migrateNativeFoundations} from '../../harness/native_foundations_migrate';
import {bindTemplate,produceNativeFixtures,validateRootCommandFence,sha256,c07PublishedNoteLowerBound,c07FixturePolicy,orderedDependencyWriterCases} from '../../harness/native_foundations_fixture';
import {dependencyWriterOperations,dependencyWriterCaseId,validateDependencyWriterSchedule,dependencyStoreOperation} from '../../harness/native_foundations_qualification';
import {measureNativeFoundations,reconcileSources,continueNativeRead,baselineOracleIds,fourGOracleIds} from '../../harness/native_foundations_measurement';
import {academyConnectionStatus,type AcademySourceConnection} from '../../src/academy/academyConnectionStatus';
import {TeacherAuthStore,ownerCursorLeaseFor,type ProductAuthState} from '../../src/academy/teacherAuthStore';
import {signTeacherSession} from '../../src/academy/auth';
import {fixedConsumerProfile,selectedProtocolClosure,type ReadAdmission} from '../../src/academy/contracts/prerequisiteRecords';
import type {TeacherPrerequisiteReadStore} from '../../src/academy/ports/teacherStore';
import {createNativeTypedRead,nativeRequestDigest,fullFieldMask,type NativeSnapshotAcquireResult,type TypedReadRequest} from '../../src/academy/nativeTypedRead';
import {canonicalJson} from '../../src/learning/model';
import {FakePrerequisiteStore,mapFixtureViews,ctx,nativeRef,request,testFunctionRequest,testTemporal,TEST_REGISTRY_SHA256,objectRef,fictionalGrantVerifier} from './typedRead.test';

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
 const base={...configuration(),ownerId:'synthetic-p4-e2e-p4-native-20261027-50',authSha256:null};
 const config={schema:'fixed-native-runner.v2',status:'SEALED',kind:'MIGRATE',stage:'MIGRATE',base,input:{readFd:7,writeFd:8,device:1,inode:17},output:{readFd:9,writeFd:10,device:1,inode:18},inputSha256:SHA,inputByteLength:1,resourceSelection:{path:'reports/p4-p5-execution/claude-takeover-20261027/gen82/candidate/bindings/resource-names.v1.json',sha256:'6e9e8143a44f9692dac281de073c966607492a7dac756565cba898f5e1870c0e',bytes:6820},bootstrapSelection:{path:'reports/p4-p5-execution/claude-takeover-20261027/gen82/candidate/bindings/bootstrap-selection.v1.json',sha256:'44f1b71bd2ee0889ea1762d8937a8e43f5694b5314cc0c5ce665ad8fc67e5f12',bytes:3983},liveHelper:null,helperStartReceipt:null,previousStageReceipt:null,windowState:'CLOSED'};
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
  const handler=createTeacherServerHandler({app:new TeacherApplication(store.asStore(),ctx.ownerId,undefined,undefined,store.asStore()),origin:'http://127.0.0.1:38743',sessionKey:f.state.sessionKey,identity:f.state.identity,invitationDigest:null,saveIdentity:async()=>{throw Error('fictional_setup_not_admitted');},currentAuthentication:()=>({sessionKey:f.state.sessionKey,identity:knownCommit?null:f.state.identity}),typedRead:{store:store.asStore(),processEpoch:'epoch-1',registrySha256:TEST_REGISTRY_SHA256,snapshotGrantVerifier:fictionalGrantVerifier,outputLease:use=>f.auth.withOutputLease(use)}});
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

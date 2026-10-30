import {expect,test} from 'bun:test';
import {mkdtempSync,mkdirSync,readFileSync,readdirSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {DailyRecordService} from '../src/dailyrecord.ts';
import {DailyRecordWorkflowStore,dailyRecordWorkflowConfiguration} from '../src/dailyrecord-workflow.ts';
import {NativeDailyRecordBackend} from '../src/native-dailyrecord-backend.ts';
import {ownerAdmissionSchema} from '../src/owner-admission.ts';
import type {DailyRecordField} from '../src/dailyrecord-context.ts';
import {backend,clock,context,proposal,safeguard} from './dailyrecord-fixture.ts';
import {nativeScope,proposals,userRequest,workflowContext,workflowService} from './dailyrecord-workflow-fixture.ts';

function fixture(){
  const base=mkdtempSync(resolve(tmpdir(),'dailyrecord-workflow-'));
  const config={storeDir:resolve(base,'owner-store')};
  // A fresh service models a new process: no in-memory handle survives.
  const process=(now:()=>number=Date.now)=>workflowService(base,config,now);
  const writes=()=>existsSync(resolve(base,'events.txt'))?readFileSync(resolve(base,'events.txt'),'utf8').split('\n').filter(l=>l.startsWith('write:')).length:0;
  return {base,process,writes,cleanup:()=>rmSync(base,{recursive:true,force:true})};
}
const actor=(runtime:string)=>({runtime,sessionRef:runtime+'-session',paneRef:'w0:synthetic'});
async function reviewed(service:DailyRecordService,runtime:string,fields:Partial<Record<DailyRecordField,string>>,requestRef='synthetic-request-1'){
  const c=workflowContext(fields,requestRef);
  const intake:any=await service.intake({context:c,actor:actor(runtime)});
  expect(intake.observationPersistence).toBe('owner_durable');
  const review:any=await service.review({context:c,observationHandle:intake.observationHandle,proposals:proposals(fields,requestRef),actor:actor(runtime)});
  expect(review.status).toBe('prepared');expect(review.reviewRecord).toMatchObject({persisted:true,reviewedBy:{declaredRuntime:runtime,observedBy:'upstream'}});
  return {c,intake,review,save:(by:string,request:unknown=userRequest(requestRef))=>({context:c,observationHandle:intake.observationHandle,reviewDigest:review.reviewDigest,
    proposals:proposals(fields,requestRef),request,actor:actor(by)})};
}

test('restart and handoff: one session reviews, another saves in a fresh process with the user instruction; status shows who did what',async()=>{
  const f=fixture();
  try{
    const r=await reviewed(f.process().service,'codex',{progress:'- 지정 문제 풀이 진행.'});
    const second=f.process();
    const saved:any=await second.service.save(r.save('claude'));
    expect(saved).toMatchObject({status:'saved',academyWrites:1,parentSends:0,parentTransmission:'separate_explicit_instruction_required',execution:'owner_request_bound',
      attribution:{declaredRuntime:'claude',declaredSession:'claude-session'},fields:[{field:'progress',status:'persisted',dispatched:true,executionState:'settled_persisted'}]});
    expect(second.source.read().progress).toBe('- 지정 문제 풀이 진행.');
    const status:any=await f.process().service.executionStatus({scope:nativeScope,requestRef:'synthetic-request-1'});
    expect(status).toMatchObject({status:'recorded',storeScope:'single_host_owner_filesystem',request:{sessionRef:'synthetic-session-1',recordedBy:{declaredRuntime:'claude'}},
      fields:[{field:'progress',executions:[{requestRef:'synthetic-request-1',executionState:'settled_persisted',by:{declaredRuntime:'claude'}}]}]});
    expect(status.audit.map((e:any)=>e.event)).toEqual(['observation_recorded','review_recorded','request_recorded','dispatch_started','dispatch_completed']);
    expect(status.audit.find((e:any)=>e.event==='review_recorded').by.declaredRuntime).toBe('codex');
    // Status and audit carry digests and attribution, never field or instruction text.
    expect(JSON.stringify(status)).not.toContain('지정 문제');expect(JSON.stringify(status)).not.toContain('Save the reviewed');
  }finally{f.cleanup();}
},20000);

test('duplicate saves report the recorded outcome and never dispatch twice',async()=>{
  const f=fixture();
  try{
    const r=await reviewed(f.process().service,'codex',{progress:'- 지정 문제 풀이 진행.'});
    expect(await f.process().service.save(r.save('codex'))).toMatchObject({status:'saved',academyWrites:1});
    expect(await f.process().service.save(r.save('claude'))).toMatchObject({status:'saved',reasonCode:'duplicate_execution_already_settled',academyWrites:0});
    // A resubmission with edited proposals is not the reviewed save and never reports success.
    const edited={...r.save('claude'),proposals:proposals({progress:'- 바뀐 문안.'})};
    expect(await f.process().service.save(edited)).toMatchObject({status:'held',reasonCode:'prior_review_record_mismatch',academyWrites:0});
    expect(f.writes()).toBe(1);
  }finally{f.cleanup();}
},20000);

test('missing provenance, conflicting instructions and unreviewed patches fail closed with zero writes',async()=>{
  const f=fixture();
  try{
    const p=f.process(),r=await reviewed(p.service,'codex',{progress:'- 지정 문제 풀이 진행.'});
    const cases:[string,unknown][]=[
      ['user_instruction_provenance_required',{...r.save('codex'),request:undefined}],
      ['user_request_ref_mismatch',r.save('codex',userRequest('another-request'))],
      ['prior_review_record_required',{...r.save('codex'),reviewDigest:'9'.repeat(64)}],
      ['prior_review_record_mismatch',{...r.save('codex'),observationHandle:'dailyrecord-observation:another-observation'}],
    ];
    for(const [code,input] of cases)expect({code,result:await p.service.save(input)}).toMatchObject({code,result:{status:'held',reasonCode:code,academyWrites:0}});
    expect(await p.service.save(r.save('codex'))).toMatchObject({status:'saved',academyWrites:1});
    // A request reference is bound to its first recorded instruction.
    expect(await p.service.save(r.save('claude',userRequest('synthetic-request-1','A different instruction.')))).toMatchObject({status:'held',reasonCode:'request_instruction_conflict'});
    expect(f.writes()).toBe(1);
  }finally{f.cleanup();}
},20000);

test('foreign student scope is refused before any write',async()=>{
  const f=fixture();
  try{
    const p=f.process(),r=await reviewed(p.service,'codex',{progress:'- 지정 문제 풀이 진행.'});
    const foreign=workflowContext({progress:'- 지정 문제 풀이 진행.'});foreign.scope={...foreign.scope,studentId:'77002'};
    expect(await p.service.save({...r.save('codex'),context:foreign})).toMatchObject({status:'held',reasonCode:'prior_review_record_mismatch',academyWrites:0});
    expect(f.writes()).toBe(0);
  }finally{f.cleanup();}
},20000);

test('a concurrent external write after review is detected by the fresh compare before dispatch',async()=>{
  const f=fixture();
  try{
    const p=f.process(),r=await reviewed(p.service,'codex',{progress:'- 지정 문제 풀이 진행.'});
    p.source.write({...p.source.read(),progress:'- 다른 교사가 먼저 저장한 문안'});
    expect(await p.service.save(r.save('codex'))).toMatchObject({status:'held',reasonCode:'fresh_review_drift_new_review_required',academyWrites:0,
      fields:[{field:'progress',status:'not_attempted',blockers:expect.arrayContaining(['source_before_or_contract_drift']),holdActions:expect.arrayContaining([expect.objectContaining({action:'fresh_intake'})])}]});
    expect(f.writes()).toBe(0);expect(p.source.read().progress).toBe('- 다른 교사가 먼저 저장한 문안');
  }finally{f.cleanup();}
},20000);

test('partial save keeps field outcomes; a failed transition is never replayed and needs a new request',async()=>{
  const f=fixture();
  try{
    const p=f.process(),fields={progress:'- 지정 문제 풀이 진행.',homework:'- 다음 시간까지 지정 문제 풀이.'};
    const r=await reviewed(p.service,'codex',fields);
    writeFileSync(resolve(f.base,'inject-ignored-write-homework'),'');
    expect(await p.service.save(r.save('codex'))).toMatchObject({status:'held',reasonCode:'readback_not_persisted_new_request_required',academyWrites:2,
      fields:[{field:'progress',status:'persisted',executionState:'settled_persisted'},{field:'homework',status:'not_persisted',executionState:'settled_not_persisted'}]});
    expect(await p.service.save(r.save('codex'))).toMatchObject({status:'held',reasonCode:'transition_already_attempted_new_request_required',academyWrites:0});
    rmSync(resolve(f.base,'inject-ignored-write-homework'));
    // A new user request reviews again: the persisted field is now a noop and only the remaining one dispatches.
    const again=await reviewed(p.service,'claude',fields,'synthetic-request-2');
    expect(again.review.patch.map((x:any)=>x.field)).toEqual(['homework']);
    expect(await p.service.save(again.save('claude'))).toMatchObject({status:'saved',academyWrites:1,fields:[{field:'homework',status:'persisted'}]});
    expect(p.source.read()).toMatchObject(fields);
  }finally{f.cleanup();}
},30000);

test('a failed first field leaves the next field not attempted and still available',async()=>{
  const f=fixture();
  try{
    const p=f.process(),r=await reviewed(p.service,'codex',{progress:'- 지정 문제 풀이 진행.',homework:'- 다음 시간까지 지정 문제 풀이.'});
    writeFileSync(resolve(f.base,'inject-ignored-write-progress'),'');
    expect(await p.service.save(r.save('codex'))).toMatchObject({status:'held',
      fields:[{field:'progress',status:'not_persisted',executionState:'settled_not_persisted'},{field:'homework',status:'not_attempted',dispatched:false,executionState:'available'}]});
    expect(f.writes()).toBe(1);
  }finally{f.cleanup();}
},20000);

test('an unresolved dispatch blocks other sessions until an authoritative readback reconciles it',async()=>{
  const f=fixture();
  try{
    const p=f.process(),r=await reviewed(p.service,'codex',{progress:'- 지정 문제 풀이 진행.'});
    writeFileSync(resolve(f.base,'inject-readback-failure'),'');
    expect(await p.service.save(r.save('codex'))).toMatchObject({status:'held',reasonCode:'save_reconciliation_required',
      fields:[{field:'progress',status:'unresolved',dispatched:true,executionState:'reconciliation_required'}]});
    rmSync(resolve(f.base,'inject-readback-failure'));
    writeFileSync(resolve(f.base,'inject-source-read-failure'),'');
    const other=f.process();
    expect(await other.service.save(r.save('claude'))).toMatchObject({status:'held',reasonCode:'uncertain_dispatch_reconcile_required',academyWrites:0});
    expect(await other.service.reconcile({context:r.c,actor:actor('claude')})).toMatchObject({status:'held',reasonCode:'readback_unavailable_reconcile_later',execution:'read_only',
      fields:[{field:'progress',executionState:'reconciliation_required'}]});
    rmSync(resolve(f.base,'inject-source-read-failure'));
    expect(await f.process().service.reconcile({context:r.c,actor:actor('claude')})).toMatchObject({status:'settled',by:{declaredRuntime:'claude'},
      fields:[{field:'progress',requestRef:'synthetic-request-1',executionState:'reconciled_persisted'}]});
    expect(await f.process().service.save(r.save('codex'))).toMatchObject({status:'saved',reasonCode:'duplicate_execution_already_settled',academyWrites:0});
    expect(f.writes()).toBe(1);
  }finally{f.cleanup();}
},30000);

test('a new request on the same field waits for reconciliation of an earlier request',async()=>{
  const f=fixture();
  try{
    const p=f.process(),r=await reviewed(p.service,'codex',{progress:'- 지정 문제 풀이 진행.'});
    writeFileSync(resolve(f.base,'inject-readback-failure'),'');
    await p.service.save(r.save('codex'));
    rmSync(resolve(f.base,'inject-readback-failure'));
    // The first write landed; a new request reviewed from the new before-state must still wait for reconcile.
    const second=await reviewed(f.process().service,'claude',{progress:'- 다음 시간 진도 문안.'},'synthetic-request-2');
    expect(await f.process().service.save(second.save('claude'))).toMatchObject({status:'held',reasonCode:'uncertain_dispatch_reconcile_required',academyWrites:0});
    await f.process().service.reconcile({context:r.c});
    expect(await f.process().service.save(second.save('claude'))).toMatchObject({status:'saved',academyWrites:1});
    expect(f.writes()).toBe(2);
  }finally{f.cleanup();}
},30000);

test('transport uncertainty is resolved by the owner readback, never by a retry',async()=>{
  const f=fixture();
  try{
    const p=f.process(),r=await reviewed(p.service,'codex',{progress:'- 지정 문제 풀이 진행.'});
    writeFileSync(resolve(f.base,'inject-transport-error-after-write'),'');
    expect(await p.service.save(r.save('codex'))).toMatchObject({status:'saved',fields:[{field:'progress',status:'persisted',executionState:'settled_persisted'}]});
    expect(f.writes()).toBe(1);
  }finally{f.cleanup();}
},20000);

test('a source-verified student outside the launch list saves by the intake-recorded name, and only with a matching row',async()=>{
  const scope={sourceNamespace:'academy.lms.dayrecord',teacherId:'99001',studentId:'77002',lessonDate:'2040-01-04'};
  const admission={teacherId:'99001',teacherLabel:'Invented Teacher',date:'2040-01-04',students:[{studentId:'77001',displayName:'Invented Student'}],sourceBundleSha256:'b'.repeat(64)};
  const owner=ownerAdmissionSchema.parse({schemaVersion:'academy.owner-admission/2' as const,decider:'user' as const,decidedAt:'2040-01-04',sourceNamespace:'academy.lms.dayrecord',teacherId:'99001',allowedFrom:null,allowedThrough:null,failClosedDefault:'2026-10-23',studentScope:'source_verified' as const});
  const target={studentName:'Second Student',date:'2040-01-04',groupId:'3',teacherKey:'99001',studentKey:'77002',courseKey:'5',recordKey:'23',membershipKey:'9'};
  let writes=0;
  const port={authenticate:async()=>{},discoverDayRecordGroups:async()=>({groups:[{groupId:'3'}]}),
    execute:async(input:any)=>({dayRecords:input.studentNames[0]==='Second Student'?[{...target,fields:{progress:'Current'}}]:[]}),
    journalState:async()=>({target,fields:{progress:'Current',homework:'',lessonMemo:'',attendance:'Y',dailyTestAssessment:'0',previousHomeworkAssessment:'3'},previousRecordKey:'22',previousDate:'2040-01-02',wireDigest:'a'.repeat(64)}),
    applyJournalAction:async()=>{writes++;return {status:'persisted' as const,transport:'returned' as const};},close:()=>{}};
  const approval={consumeApproval:async()=>({status:'verified' as const,actionDigest:'c'.repeat(64)})};
  const patch=[{field:'progress' as const,value:'- 새 문안',before:'Current',wireDigest:'a'.repeat(64)}];
  const managed=new Set(['Invented Student','Second Student','Third Student']);
  const verified=new NativeDailyRecordBackend(port as never,admission,()=>({username:'fictional',password:'fictional'}),owner,managed);
  const unmanaged=new NativeDailyRecordBackend(port as never,admission,()=>({username:'fictional',password:'fictional'}),owner);
  await expect(unmanaged.saveDailyRecord(scope,patch,approval,{displayName:'Second Student'})).rejects.toThrow('native_dailyrecord_scope_refused');
  await expect(verified.saveDailyRecord(scope,patch,approval)).rejects.toThrow('native_dailyrecord_scope_refused');
  expect(await verified.saveDailyRecord(scope,patch,approval,{displayName:'Second Student'})).toEqual([{field:'progress',status:'persisted',dispatched:true,transport:'returned'}]);
  // An unmanaged name is refused; a managed name without the exact source row is unverified.
  await expect(verified.saveDailyRecord(scope,patch,approval,{displayName:'Another Name'})).rejects.toThrow('native_dailyrecord_scope_refused');
  await expect(verified.saveDailyRecord(scope,patch,approval,{displayName:'Third Student'})).rejects.toThrow('native_dailyrecord_occurrence_unverified');
  const configuredOnly=new NativeDailyRecordBackend(port as never,admission,()=>({username:'fictional',password:'fictional'}),ownerAdmissionSchema.parse({...owner,studentScope:'configured'}),managed);
  await expect(configuredOnly.saveDailyRecord(scope,patch,approval,{displayName:'Second Student'})).rejects.toThrow('native_dailyrecord_scope_refused');
  expect(writes).toBe(1);
});

test('held mapping rows carry field-local actions and a scoped correction target without inventing a mapping',async()=>{
  const policy={bundleSha256:'5'.repeat(64),configSha256:'6'.repeat(64),catalogSha256:'7'.repeat(64),review:()=>['student_book_binding_unverified_ask_teacher','learning_mapping_unqualified']};
  const service=new DailyRecordService(backend(),safeguard,()=>clock,policy);
  const c=context(),intake=await service.intake({context:c});
  const entries=[{bookRef:'fictional-book',unitRef:'fictional-unit',scope:'unit' as const,sectionRefs:[],activity:'fictional activity',deadline:null}];
  const review:any=await service.review({context:c,observationHandle:intake.observationHandle!,proposals:[{...proposal('progress','지정 문제 12문항 풀이 진행.'),learningEntries:entries}]});
  expect(review.status).toBe('held');
  expect(review.rows[0].holdActions).toEqual([
    {field:'progress',code:'student_book_binding_unverified_ask_teacher',action:'teacher_interview',guidance:expect.stringContaining('scoped correction'),
      correctionScope:{scope:c.scope,field:'progress',learningEntries:entries,appliesTo:'this_student_edition_unit_activity_only'}},
    {field:'progress',code:'learning_mapping_unqualified',action:'owner_catalog_binding',guidance:expect.stringContaining('Never invent'),
      correctionScope:expect.objectContaining({appliesTo:'this_student_edition_unit_activity_only'})}]);
  expect(review.patch).toEqual([]);expect(review.rows[0].learningSuggestedRendering).toBeNull();
});

test('the kernel lock serializes holders, times out while held and is released when a holder process dies',async()=>{
  const base=mkdtempSync(resolve(tmpdir(),'dailyrecord-lock-'));
  try{
    const store=new DailyRecordWorkflowStore(resolve(base,'store')),order:string[]=[];
    let release!:()=>void;const held=new Promise<void>(r=>{release=r;});
    const first=store.withLock('k',async()=>{order.push('first-in');await held;order.push('first-out');});
    await new Promise(r=>setTimeout(r,30));
    await expect(store.withLock('k',async()=>{},{waitMs:100})).rejects.toThrow('shared_writer_lock_busy');
    const second=store.withLock('k',async()=>{order.push('second');});
    await new Promise(r=>setTimeout(r,60));release();await Promise.all([first,second]);
    expect(order).toEqual(['first-in','first-out','second']);
    // A holder process that dies without releasing: the kernel drops its lock.
    const script=resolve(base,'crash.ts');
    writeFileSync(script,`import {DailyRecordWorkflowStore} from ${JSON.stringify(resolve(import.meta.dir,'../src/dailyrecord-workflow.ts'))};
await new DailyRecordWorkflowStore(process.argv[2]).withLock('crash',async()=>{console.log('held');process.exit(9);});`);
    const child=Bun.spawn([process.execPath,script,resolve(base,'store')],{stdout:'pipe',stderr:'inherit'});
    expect(await child.exited).toBe(9);expect(await new Response(child.stdout).text()).toBe('held\n');
    expect(await store.withLock('crash',async()=>'acquired',{waitMs:2000})).toBe('acquired');
    expect(store.publishOnce('request','n1',{v:1}).created).toBe(true);
    expect(store.publishOnce('request','n1',{v:2})).toEqual({created:false,record:{v:1}});
  }finally{rmSync(base,{recursive:true,force:true});}
},20000);

test('native launches keep the workflow store under the real owner root with no symlink, and create nothing early',async()=>{
  const {createDailyRecordWorkflow}=await import('../src/dailyrecord-workflow.ts');
  const root='/opt/data/profiles/dc-gang-a-dev/artifacts/';
  const native={requiredRoot:root,nativeDefaultStore:root+'dailyrecord-workflow'};
  expect(()=>dailyRecordWorkflowConfiguration(['--dailyrecord-workflow-store','/tmp/outside-owner','--dailyrecord-native','c','s'],native)).toThrow('dailyrecord_workflow_store_owner_root_required');
  expect(()=>dailyRecordWorkflowConfiguration(['--dailyrecord-native','c','s','--dailyrecord-workflow-store',root+'../escape'],native)).toThrow('dailyrecord_workflow_store_owner_root_required');
  expect(dailyRecordWorkflowConfiguration(['--dailyrecord-native','c','s'],native)).toEqual({remainingArgs:['--dailyrecord-native','c','s'],storeDir:root+'dailyrecord-workflow'});
  expect(existsSync('/tmp/outside-owner')).toBe(false);
  const base=mkdtempSync(resolve(tmpdir(),'dailyrecord-workflow-flags-'));
  try{
    const {symlinkSync,realpathSync}=await import('node:fs');
    const owner=realpathSync(base)+'/owner/',outside=resolve(base,'outside');mkdirSync(owner);mkdirSync(outside);
    symlinkSync(outside,owner+'archive');
    expect(()=>createDailyRecordWorkflow({storeDir:owner+'archive/workflow',requiredRoot:owner})).toThrow('dailyrecord_workflow_store_symlink_refused');
    expect(readdirSync(outside)).toEqual([]);
    expect(()=>createDailyRecordWorkflow({storeDir:owner+'workflow',requiredRoot:resolve(base,'link-root')+'/'})).toThrow();
    expect(createDailyRecordWorkflow({storeDir:owner+'workflow',requiredRoot:owner}).store.root).toBe(owner+'workflow');
    expect(dailyRecordWorkflowConfiguration(['--other']).storeDir).toBeNull();
  }finally{rmSync(base,{recursive:true,force:true});}
});

test('without the workflow the legacy launch-pinned route is unchanged',async()=>{
  const service=new DailyRecordService(backend(),safeguard,()=>clock,{bundleSha256:'5'.repeat(64),configSha256:'6'.repeat(64),catalogSha256:'7'.repeat(64),review:()=>[]});
  const c=context(),intake=await service.intake({context:c});
  expect(intake.observationPersistence).toBe('process_local');
  const review:any=await service.review({context:c,observationHandle:intake.observationHandle!,proposals:[proposal('progress','지정 문제 12문항 풀이 진행.')]});
  expect(review).toMatchObject({status:'prepared',reviewRecord:null,saveAdmission:'separate_trusted_native_owner_required'});
});

test('the field ledger follows the physical record, so another lesson date cannot bypass an unresolved previous-record write',async()=>{
  const {requestBoundApproval,unresolvedOnField,studentExecutions}=await import('../src/dailyrecord-workflow.ts');
  const base=mkdtempSync(resolve(tmpdir(),'dailyrecord-ledger-'));
  try{
    const store=new DailyRecordWorkflowStore(resolve(base,'store'));
    const first={...nativeScope,lessonDate:'2040-01-04'},second={...nativeScope,lessonDate:'2040-01-05'};
    const attribution={schemaVersion:'academy.dailyrecord-attribution/1' as const,observedBy:'upstream' as const,observedAt:new Date().toISOString(),client:null,
      process:{pid:1,ppid:0,uid:0,parentCommand:null,bridgeSha256:null},herdrPaneId:null,declared:null};
    const approval=requestBoundApproval(store,{requestRef:'r1',attribution,reviewDigest:'d'.repeat(64),scope:first,
      reviewed:[{field:'previousHomeworkAssessment',before:'3',after:'4',effectRecordKey:'12'}]});
    const target={studentName:'Invented Student',date:first.lessonDate,groupId:'3',teacherKey:'99001',studentKey:'77001',courseKey:'5',recordKey:'13',membershipKey:'8'};
    expect((await approval.consumeApproval({attemptId:'a1',target,field:'previousHomeworkAssessment',effectRecordKey:'12',before:'3',after:'4',wireDigest:'a'.repeat(64)})).status).toBe('verified');
    // Seen through a later lesson whose previous record is the same physical record.
    expect(unresolvedOnField(store,second,'previousHomeworkAssessment','12')).toHaveLength(1);
    expect(unresolvedOnField(store,second,'previousHomeworkAssessment','99')).toHaveLength(0);
    // A ledger entry whose execution record was never published is skipped, not a crash.
    store.addToLedger(JSON.stringify(['ignored']),'never-published');
    const {workflowLockKey}=await import('../src/dailyrecord-workflow.ts');
    store.addToLedger(workflowLockKey(first),'never-published');
    expect(studentExecutions(store,first)).toHaveLength(1);
  }finally{rmSync(base,{recursive:true,force:true});}
});

test('status survives a ledger entry without an execution record',async()=>{
  const f=fixture();
  try{
    const p=f.process(),r=await reviewed(p.service,'codex',{progress:'- 지정 문제 풀이 진행.'});
    const {workflowLockKey}=await import('../src/dailyrecord-workflow.ts');
    p.workflow!.store.addToLedger(workflowLockKey(nativeScope),'crashed-before-execution-record');
    expect(await p.service.save(r.save('codex'))).toMatchObject({status:'saved',academyWrites:1});
    expect(await p.service.executionStatus({scope:nativeScope})).toMatchObject({status:'recorded',fields:[{field:'progress',executions:[{executionState:'settled_persisted'}]}]});
  }finally{f.cleanup();}
},20000);

test('an empty reviewed patch still fails closed when the source drifted before save',async()=>{
  const f=fixture();
  try{
    const p=f.process();
    // The proposal equals the current source, so the prepared review has an empty patch.
    const r=await reviewed(p.service,'codex',{progress:'- 기존 진도 문안'});
    expect(r.review.patch).toEqual([]);
    p.source.write({...p.source.read(),progress:'- 다른 교사가 바꾼 문안'});
    expect(await p.service.save(r.save('codex'))).toMatchObject({status:'held',reasonCode:'fresh_review_drift_new_review_required',academyWrites:0});
    const again=await reviewed(p.service,'codex',{progress:'- 다른 교사가 바꾼 문안'},'synthetic-request-2');
    expect(await p.service.save(again.save('codex'))).toMatchObject({status:'saved',reasonCode:'reviewed_patch_empty',academyWrites:0});
    expect(f.writes()).toBe(0);
  }finally{f.cleanup();}
},20000);

test('a managed source-verified student outside the launch list is resolved, reviewed and then saved by a fresh process',async()=>{
  const {createDailyRecordWorkflow}=await import('../src/dailyrecord-workflow.ts');
  const {learningPolicy}=await import('./dailyrecord-fixture.ts');
  const base=mkdtempSync(resolve(tmpdir(),'dailyrecord-outside-list-'));
  try{
    const scope={sourceNamespace:'academy.lms.dayrecord',teacherId:'99001',studentId:'77002',lessonDate:'2040-01-04'};
    const admission={teacherId:'99001',teacherLabel:'Invented Teacher',date:'2040-01-04',students:[{studentId:'77001',displayName:'Invented Student'}],sourceBundleSha256:'b'.repeat(64)};
    const owner=ownerAdmissionSchema.parse({schemaVersion:'academy.owner-admission/2',decider:'user',decidedAt:'2040-01-04',sourceNamespace:'academy.lms.dayrecord',teacherId:'99001',
      allowedFrom:null,allowedThrough:null,failClosedDefault:'2026-10-23',studentScope:'source_verified'});
    const target={studentName:'Second Student',date:'2040-01-04',groupId:'3',teacherKey:'99001',studentKey:'77002',courseKey:'5',recordKey:'23',membershipKey:'9'};
    const prior={...target,date:'2040-01-02',recordKey:'22'};
    const state={progress:'- 기존 진도 문안',homework:'',lessonMemo:'',attendance:'Y',dailyTestAssessment:'0',previousHomeworkAssessment:'3'};
    const port=()=>({authenticate:async()=>{},discoverDayRecordGroups:async()=>({groups:[{groupId:'3'}]}),
      execute:async(input:any)=>({dayRecords:input.studentNames[0]==='Second Student'?[{...(input.date===target.date?target:prior),fields:{progress:state.progress,homework:state.homework,lessonMemo:state.lessonMemo,attendance:state.attendance}}]:[]}),
      journalState:async()=>({target,fields:{...state},previousRecordKey:'22',previousDate:'2040-01-02',wireDigest:'a'.repeat(64)}),
      applyJournalAction:async(action:any,approval:any)=>{
        if((await approval.consumeApproval(action)).status!=='verified')throw Error('journal_http_approval_rejected');
        (state as Record<string,string>)[action.field]=action.after;return {status:'persisted' as const,transport:'returned' as const};},close:()=>{}});
    const managed=new Set(['Invented Student','Second Student']),store=resolve(base,'store');
    const service=()=>{const backend=new NativeDailyRecordBackend(port() as never,admission,()=>({username:'fictional',password:'fictional'}),owner,managed);
      return new DailyRecordService(backend,safeguard,Date.now,learningPolicy,backend,createDailyRecordWorkflow({storeDir:store}));};
    const c={...workflowContext({progress:'- 지정 문제 풀이 진행.'}),scope};
    // The composed name route returns an owner-durable authoring handle that a fresh process can review and save.
    const got:any=await service().get({displayName:'Second Student',lessonDate:'2040-01-04',purpose:'Synthetic save',currentRequestRef:c.currentRequestRef});
    expect(got).toMatchObject({status:'observed',authoringHandle:{persistence:'owner_durable',boundTo:{scope,currentRequestRef:c.currentRequestRef}}});
    const viaGet:any=await service().review({context:c,observationHandle:got.authoringHandle.observationHandle,proposals:proposals({progress:'- 지정 문제 풀이 진행.'})});
    expect(viaGet.status).toBe('prepared');
    const first=service();
    expect(await first.resolveStudent({purpose:'Synthetic save',currentRequestRef:c.currentRequestRef,displayName:'Second Student',lessonDate:'2040-01-04'})).toMatchObject({status:'resolved'});
    const intake:any=await first.intake({context:c});
    expect(intake).toMatchObject({sourceAvailability:'observed',observationPersistence:'owner_durable'});expect(intake.observationHandle).toBeTruthy();
    const review:any=await first.review({context:c,observationHandle:intake.observationHandle,proposals:proposals({progress:'- 지정 문제 풀이 진행.'})});
    expect(review.status).toBe('prepared');
    const saved=await service().save({context:c,observationHandle:intake.observationHandle,reviewDigest:review.reviewDigest,proposals:proposals({progress:'- 지정 문제 풀이 진행.'}),request:userRequest()});
    expect(saved).toMatchObject({status:'saved',academyWrites:1,fields:[{field:'progress',status:'persisted'}]});
    expect(state.progress).toBe('- 지정 문제 풀이 진행.');
  }finally{rmSync(base,{recursive:true,force:true});}
},20000);

test('in-process and multi-process contenders never hold the kernel lock together',async()=>{
  const base=mkdtempSync(resolve(tmpdir(),'dailyrecord-lock-gen-'));
  try{
    const store=new DailyRecordWorkflowStore(resolve(base,'store'));
    let active=0,maxActive=0;
    const body=async()=>{active++;maxActive=Math.max(maxActive,active);await new Promise(r=>setTimeout(r,15));active--;};
    await Promise.all(Array.from({length:12},()=>store.withLock('contended',body,{waitMs:5000,pollMs:2})));
    expect(maxActive).toBe(1);
    // Multi-process contention through the same store.
    const script=resolve(base,'contend.ts');
    writeFileSync(script,`import {DailyRecordWorkflowStore} from ${JSON.stringify(resolve(import.meta.dir,'../src/dailyrecord-workflow.ts'))};
const store=new DailyRecordWorkflowStore(process.argv[2]);const {appendFileSync}=await import('node:fs');
for(let i=0;i<5;i++)await store.withLock('cross',async()=>{appendFileSync(process.argv[3],'in\\n');await new Promise(r=>setTimeout(r,10));appendFileSync(process.argv[3],'out\\n');},{waitMs:20000,pollMs:3});`);
    const trace=resolve(base,'trace.txt');
    const children=Array.from({length:4},()=>Bun.spawn([process.execPath,script,resolve(base,'store'),trace],{stdout:'ignore',stderr:'inherit'}));
    expect(await Promise.all(children.map(c=>c.exited))).toEqual([0,0,0,0]);
    const lines=readFileSync(trace,'utf8').trim().split('\n');
    expect(lines).toHaveLength(40);
    for(let i=0;i<lines.length;i+=2)expect([lines[i],lines[i+1]]).toEqual(['in','out']);
  }finally{rmSync(base,{recursive:true,force:true});}
},30000);

test('execution keys distinguish physical records, and a changed previous-record binding stays unresolved',async()=>{
  const {executionKey,requestBoundApproval,createDailyRecordWorkflow,fieldExecutionState}=await import('../src/dailyrecord-workflow.ts');
  expect(executionKey('r',nativeScope,'previousHomeworkAssessment','R1','3','4')).not.toBe(executionKey('r',nativeScope,'previousHomeworkAssessment','R2','3','4'));
  const {scope,learningPolicy}=await import('./dailyrecord-fixture.ts');
  const base=mkdtempSync(resolve(tmpdir(),'dailyrecord-binding-'));
  try{
    const workflow=createDailyRecordWorkflow({storeDir:resolve(base,'store')});
    const attribution={schemaVersion:'academy.dailyrecord-attribution/1' as const,observedBy:'upstream' as const,observedAt:new Date().toISOString(),client:null,
      process:{pid:1,ppid:0,uid:0,parentCommand:null,bridgeSha256:null},herdrPaneId:null,declared:null};
    // An uncertain previous-record dispatch to a record the lesson no longer binds.
    const approval=requestBoundApproval(workflow.store,{requestRef:'synthetic-current-user-request',attribution,reviewDigest:'d'.repeat(64),scope,
      reviewed:[{field:'previousHomeworkAssessment',before:'4',after:'5',effectRecordKey:'old-previous-record'}]});
    const target={studentName:'Synthetic Student',date:scope.lessonDate,groupId:'3',teacherKey:scope.teacherId,studentKey:scope.studentId,courseKey:'5',recordKey:'current-record-synthetic',membershipKey:'8'};
    expect((await approval.consumeApproval({attemptId:'a1',target,field:'previousHomeworkAssessment',effectRecordKey:'old-previous-record',before:'4',after:'5',wireDigest:'2'.repeat(64)})).status).toBe('verified');
    const service=new DailyRecordService(backend(),safeguard,Date.now,learningPolicy,null,workflow);
    const result:any=await service.reconcile({context:context()});
    expect(result).toMatchObject({status:'held',reasonCode:'affected_record_not_observed_manual_reconcile_required',
      fields:[{field:'previousHomeworkAssessment',executionState:'dispatch_outcome_unknown'}]});
    const key=executionKey('synthetic-current-user-request',scope,'previousHomeworkAssessment','old-previous-record','4','5');
    expect(fieldExecutionState(workflow.store,key)).toBe('dispatch_outcome_unknown');
  }finally{rmSync(base,{recursive:true,force:true});}
});

test('the same physical transition reached through another lesson date is not a fresh execution',async()=>{
  const {executionKey}=await import('../src/dailyrecord-workflow.ts');
  expect(executionKey('r1',{...nativeScope,lessonDate:'2040-01-04'},'previousHomeworkAssessment','12','3','4'))
    .toBe(executionKey('r1',{...nativeScope,lessonDate:'2040-01-05'},'previousHomeworkAssessment','12','3','4'));
  expect(executionKey('r1',nativeScope,'previousHomeworkAssessment','12','3','4')).not.toBe(executionKey('r2',nativeScope,'previousHomeworkAssessment','12','3','4'));
});

test('an old value after an uncertain transport stays unresolved until the settle window passes',async()=>{
  const {reconcileSettleMs}=await import('../src/dailyrecord.ts');
  const f=fixture();
  try{
    const p=f.process(),r=await reviewed(p.service,'codex',{progress:'- 지정 문제 풀이 진행.'});
    writeFileSync(resolve(f.base,'inject-lost-write-progress'),'');
    expect(await p.service.save(r.save('codex'))).toMatchObject({status:'held',reasonCode:'save_reconciliation_required',
      fields:[{field:'progress',status:'unresolved',transport:'uncertain',executionState:'reconciliation_required'}]});
    rmSync(resolve(f.base,'inject-lost-write-progress'));
    // The request may still be pending remotely: an unchanged readback inside the window proves nothing.
    expect(await f.process().service.reconcile({context:r.c})).toMatchObject({status:'held',reasonCode:'readback_unchanged_within_settle_window_reconcile_later',
      fields:[{field:'progress',executionState:'reconciliation_required'}]});
    const later=f.process(()=>Date.now()+reconcileSettleMs+1000);
    expect(await later.service.reconcile({context:r.c})).toMatchObject({status:'settled',fields:[{field:'progress',executionState:'reconciled_not_persisted'}]});
    expect(await later.service.save(r.save('codex'))).toMatchObject({status:'held',reasonCode:'transition_already_attempted_new_request_required'});
  }finally{f.cleanup();}
},20000);

test('attribution records the parent executable only, never its arguments',async()=>{
  const {observeAttribution}=await import('../src/dailyrecord-workflow.ts');
  const a=observeAttribution({observedBy:'upstream',client:null,bridgeSha256:null,declared:null});
  expect(a.process.parentCommand===null||!a.process.parentCommand.includes(' ')).toBe(true);
});

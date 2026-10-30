import {expect,test} from 'bun:test';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {DailyRecordService,dailyRecordWorkflowToolSchemas,type DailyRecordWorkflowToolName} from '../src/dailyrecord.ts';
import {DailyRecordWorkflowStore,createDailyRecordWorkflow,signActorProof,signAuthorization} from '../src/dailyrecord-workflow.ts';
import type {DailyRecordField} from '../src/dailyrecord-context.ts';
import {backend,clock,context,proposal,safeguard} from './dailyrecord-fixture.ts';
import {authorizationFor,keypair,nativeScope,proposals,registry,workflowContext,workflowService} from './dailyrecord-workflow-fixture.ts';

type Actor={id:string;privatePem:string;publicPem:string};
function fixture(options:{actors?:boolean;issuers?:boolean}={}){
  const base=mkdtempSync(resolve(tmpdir(),'dailyrecord-workflow-'));
  const a={id:'runtime-a',...keypair()},b={id:'runtime-b',...keypair()},issuer=keypair();
  const config={storeDir:resolve(base,'owner-store'),
    actorRegistry:options.actors===false?null:registry('actor',[{id:a.id,publicPem:a.publicPem},{id:b.id,publicPem:b.publicPem}]),
    issuerRegistry:options.issuers===false?null:registry('issuer',[{id:'owner-issuer',publicPem:issuer.publicPem}])};
  // A fresh service models a new process: no in-memory handle or ticket survives.
  const process=()=>workflowService(base,config);
  const writes=()=>existsSync(resolve(base,'events.txt'))?readFileSync(resolve(base,'events.txt'),'utf8').split('\n').filter(l=>l.startsWith('write:')).length:0;
  return {base,a,b,issuer,config,process,writes,cleanup:()=>rmSync(base,{recursive:true,force:true})};
}
const methods={academy_dailyrecord_intake:'intake',academy_dailyrecord_review:'review',academy_dailyrecord_save:'save',academy_dailyrecord_reconcile:'reconcile',academy_dailyrecord_execution_status:'executionStatus'} as const;
async function as(actor:Actor|null,service:DailyRecordService,tool:DailyRecordWorkflowToolName,args:Record<string,unknown>):Promise<any>{
  const payload=dailyRecordWorkflowToolSchemas[tool].parse(args) as Record<string,unknown>;
  return (service as any)[methods[tool]](actor?{...payload,actorProof:signActorProof(actor.privatePem,actor.id,tool,payload)}:payload);
}
async function reviewed(f:ReturnType<typeof fixture>,service:DailyRecordService,actor:Actor,fields:Partial<Record<DailyRecordField,string>>){
  const c=workflowContext(fields);
  const intake=await as(actor,service,'academy_dailyrecord_intake',{context:c});
  expect(intake.observationPersistence).toBe('owner_durable');
  const review=await as(actor,service,'academy_dailyrecord_review',{context:c,observationHandle:intake.observationHandle,proposals:proposals(fields)});
  expect(review.status).toBe('prepared');expect(review.reviewRecord).toMatchObject({persisted:true,reviewedBy:actor.id});
  return {c,intake,review,save:(authorization:unknown)=>({context:c,observationHandle:intake.observationHandle,reviewDigest:review.reviewDigest,proposals:proposals(fields),authorization})};
}
const authorize=(f:ReturnType<typeof fixture>,review:any,actors:string[],extra:Partial<Parameters<typeof authorizationFor>[1]>={})=>
  authorizationFor(f.issuer.privatePem,{actors,reviewDigests:[review.reviewDigest],actions:review.patch.map((p:any)=>({field:p.field,before:p.before??'',after:p.after})),...extra});

test('restart and actor handoff: one runtime reviews, another saves in a fresh process with an owner authorization',async()=>{
  const f=fixture();
  try{
    const first=f.process();
    const r=await reviewed(f,first.service,f.a,{progress:'- 지정 문제 풀이 진행.'});
    const signed=authorize(f,r.review,[f.b.id]);
    // New process: the review handle, review record and source are reached only through the owner store.
    const second=f.process();
    const saved=await as(f.b,second.service,'academy_dailyrecord_save',r.save(signed));
    expect(saved).toMatchObject({status:'saved',academyWrites:1,parentSends:0,parentTransmission:'separate_explicit_instruction_required',
      execution:'owner_request_bound',actorId:f.b.id,fields:[{field:'progress',status:'persisted',dispatched:true,executionState:'settled_persisted'}]});
    expect(second.source.read().progress).toBe('- 지정 문제 풀이 진행.');
    const status=await as(f.a,f.process().service,'academy_dailyrecord_execution_status',{authorizationId:signed.authorization.authorizationId});
    expect(status).toMatchObject({status:'recorded',storeScope:'single_host_owner_filesystem',authorization:{issuerId:'owner-issuer',userEventRef:'synthetic-user-event-1',authorizedActors:[f.b.id],parentTransmission:'not_authorized'},
      actions:[{field:'progress',executionState:'settled_persisted'}]});
    expect(status.audit.map((e:any)=>e.event)).toEqual(['observation_recorded','review_recorded','authorization_recorded','dispatch_started','dispatch_completed']);
    // Audit and status carry digests and codes, never the field text.
    expect(JSON.stringify(status)).not.toContain('지정 문제');
  }finally{f.cleanup();}
},20000);

test('duplicate saves report the recorded outcome and never dispatch twice',async()=>{
  const f=fixture();
  try{
    const p=f.process(),r=await reviewed(f,p.service,f.a,{progress:'- 지정 문제 풀이 진행.'}),signed=authorize(f,r.review,[f.a.id,f.b.id]);
    expect(await as(f.a,p.service,'academy_dailyrecord_save',r.save(signed))).toMatchObject({status:'saved',academyWrites:1});
    expect(await as(f.b,f.process().service,'academy_dailyrecord_save',r.save(signed))).toMatchObject({status:'saved',reasonCode:'duplicate_execution_already_settled',academyWrites:0});
    expect(f.writes()).toBe(1);
  }finally{f.cleanup();}
},20000);

test('missing trust interfaces and invalid authority fail closed with precise codes and zero writes',async()=>{
  const noActors=fixture({actors:false});
  try{
    const p=noActors.process(),c=workflowContext({progress:'- 지정 문제 풀이 진행.'});
    const intake=await p.service.intake({context:c});
    const review:any=await p.service.review({context:c,observationHandle:intake.observationHandle!,proposals:proposals({progress:'- 지정 문제 풀이 진행.'})});
    expect(review.reviewRecord).toMatchObject({persisted:false,reviewedBy:null,actorAuthentication:{reasonCode:'actor_authentication_unavailable'}});
    expect(await p.service.save({context:c,observationHandle:intake.observationHandle!,reviewDigest:review.reviewDigest,proposals:proposals({progress:'- 지정 문제 풀이 진행.'})}))
      .toMatchObject({status:'held',reasonCode:'actor_authentication_unavailable',academyWrites:0});
    expect(noActors.writes()).toBe(0);
  }finally{noActors.cleanup();}
  const noIssuer=fixture({issuers:false});
  try{
    const p=noIssuer.process(),r=await reviewed(noIssuer,p.service,noIssuer.a,{progress:'- 지정 문제 풀이 진행.'});
    expect(await as(noIssuer.a,p.service,'academy_dailyrecord_save',r.save(undefined))).toMatchObject({status:'held',reasonCode:'dailyrecord_authorization_issuer_not_configured',academyWrites:0});
  }finally{noIssuer.cleanup();}
  const f=fixture();
  try{
    const p=f.process(),r=await reviewed(f,p.service,f.a,{progress:'- 지정 문제 풀이 진행.'}),good=authorize(f,r.review,[f.a.id]);
    const intruder={id:'runtime-a',...keypair()};
    const tampered={...good,authorization:{...good.authorization,actions:[{...good.authorization.actions[0]!,after:'- 다른 문안'}]}};
    const cases:[string,Promise<any>][]=[
      ['request_authorization_required',as(f.a,p.service,'academy_dailyrecord_save',r.save(undefined))],
      ['actor_proof_required',as(null,p.service,'academy_dailyrecord_save',r.save(good))],
      ['actor_signature_invalid',as(intruder,p.service,'academy_dailyrecord_save',r.save(good))],
      ['actor_not_registered',as({id:'runtime-z',...keypair()},p.service,'academy_dailyrecord_save',r.save(good))],
      ['actor_not_authorized_for_request',as(f.b,p.service,'academy_dailyrecord_save',r.save(good))],
      ['authorization_signature_invalid',as(f.a,p.service,'academy_dailyrecord_save',r.save(tampered))],
      ['authorization_signature_invalid',as(f.a,p.service,'academy_dailyrecord_save',r.save(authorizationFor(keypair().privatePem,{actors:[f.a.id],reviewDigests:[r.review.reviewDigest],actions:[{field:'progress',before:'- 기존 진도 문안',after:'- 지정 문제 풀이 진행.'}]})))],
      ['authorization_expired',as(f.a,p.service,'academy_dailyrecord_save',r.save(authorize(f,r.review,[f.a.id],{now:Date.now()-7200000})))],
      ['authorization_request_mismatch',as(f.a,p.service,'academy_dailyrecord_save',r.save(authorize(f,r.review,[f.a.id],{requestRef:'another-request'})))],
      ['authorization_review_policy_mismatch',as(f.a,p.service,'academy_dailyrecord_save',r.save(authorize(f,r.review,[f.a.id],{policy:{learningPolicy:null,parentSafeguard:null}})))],
      ['authorization_action_mismatch',as(f.a,p.service,'academy_dailyrecord_save',r.save(authorizationFor(f.issuer.privatePem,{actors:[f.a.id],reviewDigests:[r.review.reviewDigest],actions:[{field:'progress',before:'- 기존 진도 문안',after:'- 승인되지 않은 문안'}]})))],
      ['prior_review_record_required',as(f.a,p.service,'academy_dailyrecord_save',{...r.save(good),reviewDigest:'9'.repeat(64)})],
      ['prior_review_record_mismatch',as(f.a,p.service,'academy_dailyrecord_save',{...r.save(good),observationHandle:'dailyrecord-observation:another-observation'})],
      ['authorization_review_not_recorded',as(f.a,p.service,'academy_dailyrecord_save',r.save(authorize(f,r.review,[f.a.id],{reviewDigests:['7'.repeat(64)]})))],
    ];
    for(const [code,pending] of cases)expect({code,result:await pending}).toMatchObject({code,result:{status:'held',reasonCode:code,academyWrites:0}});
    // Parent transmission can never be authorized by a save authorization.
    expect(()=>signAuthorization(f.issuer.privatePem,{...good.authorization,parentTransmission:'authorized' as never})).toThrow();
    // An actor proof is bound to its exact payload and is single-use.
    const payload=dailyRecordWorkflowToolSchemas.academy_dailyrecord_save.parse(r.save(good)) as Record<string,unknown>;
    const proof=signActorProof(f.a.privatePem,f.a.id,'academy_dailyrecord_save',payload);
    expect(await p.service.save({...payload,reviewDigest:'8'.repeat(64),actorProof:proof})).toMatchObject({reasonCode:'actor_proof_payload_mismatch'});
    expect(await p.service.save({...payload,actorProof:proof})).toMatchObject({status:'saved',academyWrites:1});
    expect(await p.service.save({...payload,actorProof:proof})).toMatchObject({status:'held',reasonCode:'actor_proof_replayed',academyWrites:0});
    expect(f.writes()).toBe(1);
  }finally{f.cleanup();}
},30000);

test('foreign student scope is refused before any write',async()=>{
  const f=fixture();
  try{
    const p=f.process(),r=await reviewed(f,p.service,f.a,{progress:'- 지정 문제 풀이 진행.'}),signed=authorize(f,r.review,[f.a.id]);
    const foreign=workflowContext({progress:'- 지정 문제 풀이 진행.'});foreign.scope={...foreign.scope,studentId:'77002'};
    expect(await as(f.a,p.service,'academy_dailyrecord_save',{...r.save(signed),context:foreign})).toMatchObject({status:'held',reasonCode:'authorization_review_not_recorded',academyWrites:0});
    expect(await as(f.a,p.service,'academy_dailyrecord_reconcile',{context:foreign,authorizationId:signed.authorization.authorizationId})).toMatchObject({status:'held',reasonCode:'authorization_not_recorded'});
    expect(f.writes()).toBe(0);
  }finally{f.cleanup();}
},20000);

test('a concurrent external write after review is detected by the fresh compare before dispatch',async()=>{
  const f=fixture();
  try{
    const p=f.process(),r=await reviewed(f,p.service,f.a,{progress:'- 지정 문제 풀이 진행.'}),signed=authorize(f,r.review,[f.a.id]);
    p.source.write({...p.source.read(),progress:'- 다른 교사가 먼저 저장한 문안'});
    const held=await as(f.a,p.service,'academy_dailyrecord_save',r.save(signed));
    expect(held).toMatchObject({status:'held',reasonCode:'fresh_review_drift_new_review_required',academyWrites:0,
      fields:[{field:'progress',status:'not_attempted',blockers:expect.arrayContaining(['source_before_or_contract_drift']),holdActions:expect.arrayContaining([expect.objectContaining({action:'fresh_intake'})])}]});
    expect(f.writes()).toBe(0);expect(p.source.read().progress).toBe('- 다른 교사가 먼저 저장한 문안');
  }finally{f.cleanup();}
},20000);

test('partial save keeps field outcomes; a consumed failed field needs a new authorization and the rest stays reviewable',async()=>{
  const f=fixture();
  try{
    const p=f.process(),fields={progress:'- 지정 문제 풀이 진행.',homework:'- 다음 시간까지 지정 문제 풀이.'};
    const r=await reviewed(f,p.service,f.a,fields),signed=authorize(f,r.review,[f.a.id]);
    writeFileSync(resolve(f.base,'inject-lost-write-homework'),'');
    const partial=await as(f.a,p.service,'academy_dailyrecord_save',r.save(signed));
    expect(partial).toMatchObject({status:'held',reasonCode:'readback_not_persisted_new_authorization_required',academyWrites:2,
      fields:[{field:'progress',status:'persisted',executionState:'settled_persisted'},{field:'homework',status:'not_persisted',executionState:'settled_not_persisted'}]});
    expect(await as(f.a,p.service,'academy_dailyrecord_save',r.save(signed))).toMatchObject({status:'held',reasonCode:'authorization_consumed_new_authorization_required',academyWrites:0});
    rmSync(resolve(f.base,'inject-lost-write-homework'));
    // The persisted field is now a noop; only the remaining field is reviewed and newly authorized.
    const again=await reviewed(f,p.service,f.a,fields);
    expect(again.review.patch.map((x:any)=>x.field)).toEqual(['homework']);
    expect(await as(f.a,p.service,'academy_dailyrecord_save',again.save(authorize(f,again.review,[f.a.id])))).toMatchObject({status:'saved',academyWrites:1,fields:[{field:'homework',status:'persisted'}]});
    expect(p.source.read()).toMatchObject(fields);
  }finally{f.cleanup();}
},30000);

test('a failed first field leaves the next field not attempted and still available',async()=>{
  const f=fixture();
  try{
    const p=f.process(),fields={progress:'- 지정 문제 풀이 진행.',homework:'- 다음 시간까지 지정 문제 풀이.'};
    const r=await reviewed(f,p.service,f.a,fields),signed=authorize(f,r.review,[f.a.id]);
    writeFileSync(resolve(f.base,'inject-lost-write-progress'),'');
    expect(await as(f.a,p.service,'academy_dailyrecord_save',r.save(signed))).toMatchObject({status:'held',
      fields:[{field:'progress',status:'not_persisted',executionState:'settled_not_persisted'},{field:'homework',status:'not_attempted',dispatched:false,executionState:'available'}]});
    expect(f.writes()).toBe(1);
  }finally{f.cleanup();}
},20000);

test('readback failure is never retried: save holds, reconcile classifies by authoritative readback only',async()=>{
  const f=fixture();
  try{
    const p=f.process(),r=await reviewed(f,p.service,f.a,{progress:'- 지정 문제 풀이 진행.'}),signed=authorize(f,r.review,[f.a.id,f.b.id]);
    writeFileSync(resolve(f.base,'inject-readback-failure'),'');
    expect(await as(f.a,p.service,'academy_dailyrecord_save',r.save(signed))).toMatchObject({status:'held',reasonCode:'save_reconciliation_required',
      fields:[{field:'progress',status:'unresolved',dispatched:true,executionState:'reconciliation_required'}]});
    writeFileSync(resolve(f.base,'inject-source-read-failure'),'');
    expect(await as(f.b,f.process().service,'academy_dailyrecord_save',r.save(signed))).toMatchObject({status:'held',reasonCode:'uncertain_dispatch_reconcile_required',academyWrites:0});
    expect(await as(f.b,f.process().service,'academy_dailyrecord_reconcile',{context:r.c,authorizationId:signed.authorization.authorizationId}))
      .toMatchObject({status:'held',reasonCode:'readback_unavailable_reconcile_later',execution:'read_only',fields:[{field:'progress',executionState:'reconciliation_required'}]});
    rmSync(resolve(f.base,'inject-readback-failure'));rmSync(resolve(f.base,'inject-source-read-failure'));
    expect(await as(f.b,f.process().service,'academy_dailyrecord_reconcile',{context:r.c,authorizationId:signed.authorization.authorizationId}))
      .toMatchObject({status:'settled',fields:[{field:'progress',executionState:'reconciled_persisted'}]});
    expect(await as(f.a,f.process().service,'academy_dailyrecord_save',r.save(signed))).toMatchObject({status:'saved',reasonCode:'duplicate_execution_already_settled',academyWrites:0});
    expect(f.writes()).toBe(1);
  }finally{f.cleanup();}
},30000);

test('transport uncertainty is resolved by the owner readback, never by a retry',async()=>{
  const f=fixture();
  try{
    const p=f.process(),r=await reviewed(f,p.service,f.a,{progress:'- 지정 문제 풀이 진행.'});
    writeFileSync(resolve(f.base,'inject-transport-error-after-write'),'');
    expect(await as(f.a,p.service,'academy_dailyrecord_save',r.save(authorize(f,r.review,[f.a.id])))).toMatchObject({status:'saved',
      fields:[{field:'progress',status:'persisted',executionState:'settled_persisted'}]});
    expect(f.writes()).toBe(1);
  }finally{f.cleanup();}
},20000);

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

test('the shared lock serializes holders, waits for a live holder and breaks only an abandoned one',async()=>{
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
    // A holder whose process is gone is broken exactly once; the next writer proceeds.
    const {readdirSync}=await import('node:fs'),{createHash}=await import('node:crypto');
    const dir=resolve(base,'store','locks',createHash('sha256').update('dead','utf8').digest('hex'));
    const dead=Bun.spawnSync([process.execPath,'-e','console.log(process.pid)']);const pid=Number(dead.stdout.toString().trim());
    mkdirSync(dir);writeFileSync(resolve(dir,'holder.json'),JSON.stringify({pid,token:'abandoned',acquiredAt:new Date().toISOString()}));
    expect(await store.withLock('dead',async()=>'acquired',{waitMs:2000})).toBe('acquired');
    expect(readdirSync(resolve(base,'store','locks'))).toEqual([]);
    // Exclusive publish keeps the first record.
    expect(store.publishOnce('nonce','n1',{v:1}).created).toBe(true);
    expect(store.publishOnce('nonce','n1',{v:2})).toEqual({created:false,record:{v:1}});
  }finally{rmSync(base,{recursive:true,force:true});}
},20000);

test('workflow launch flags pin registries, keep stores inside the owner root and refuse orphan registries',async()=>{
  const {dailyRecordWorkflowConfiguration}=await import('../src/dailyrecord-workflow.ts');
  const {createHash}=await import('node:crypto');
  const base=mkdtempSync(resolve(tmpdir(),'dailyrecord-workflow-flags-'));
  try{
    const bytes=JSON.stringify(registry('actor',[{id:'runtime-a',publicPem:keypair().publicPem}])),path=resolve(base,'actors.json');writeFileSync(path,bytes);
    const sha=createHash('sha256').update(bytes).digest('hex');
    const configured=await dailyRecordWorkflowConfiguration(['--dailyrecord-workflow-store',resolve(base,'store'),'--dailyrecord-actor-registry',path,sha,'--other']);
    expect(configured.remainingArgs).toEqual(['--other']);expect(configured.workflow?.actors.configured).toBe(true);expect(configured.workflow?.authorizations.configured).toBe(false);
    await expect(dailyRecordWorkflowConfiguration(['--dailyrecord-actor-registry',path,sha])).rejects.toThrow('dailyrecord_workflow_store_required');
    await expect(dailyRecordWorkflowConfiguration(['--dailyrecord-workflow-store',resolve(base,'store'),'--dailyrecord-actor-registry',path,'0'.repeat(64)])).rejects.toThrow();
    await expect(dailyRecordWorkflowConfiguration(['--dailyrecord-workflow-store','/tmp/outside-owner'],{requiredRoot:'/opt/data/profiles/dc-gang-a-dev/artifacts/'})).rejects.toThrow('dailyrecord_workflow_store_owner_root_required');
    expect(existsSync('/tmp/outside-owner')).toBe(false);
  }finally{rmSync(base,{recursive:true,force:true});}
});

test('without the workflow the legacy launch-pinned route is unchanged and needs no actor',async()=>{
  const service=new DailyRecordService(backend(),safeguard,()=>clock,{bundleSha256:'5'.repeat(64),configSha256:'6'.repeat(64),catalogSha256:'7'.repeat(64),review:()=>[]});
  const c=context(),intake=await service.intake({context:c});
  expect(intake.observationPersistence).toBe('process_local');
  const review:any=await service.review({context:c,observationHandle:intake.observationHandle!,proposals:[proposal('progress','지정 문제 12문항 풀이 진행.')]});
  expect(review).toMatchObject({status:'prepared',reviewRecord:null,saveAdmission:'separate_trusted_native_owner_required'});
  expect(createDailyRecordWorkflow).toBeDefined();expect(nativeScope.sourceNamespace).toBe('academy.lms.dayrecord');
});

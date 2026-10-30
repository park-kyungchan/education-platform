import {expect,test} from 'bun:test';
import {mkdtemp,readFile,readdir,rm,rmdir,unlink,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {authorizationFor,keypair,proposals,registry,workflowContext} from './dailyrecord-workflow-fixture.ts';

/**
 * Multi-process synthetic E2E: each runtime is a separate neutral bridge
 * process with its own owner-registered actor key; every bridge call starts
 * a fresh upstream owner process launched with the real workflow flags. Only
 * the academy HTTP source is a fictional file; network access is denied.
 */
const entry=resolve(import.meta.dir,'../src/neutral-server.ts'),deny=resolve(import.meta.dir,'network-deny.ts');
const fields={progress:'- 지정 문제 풀이 진행.'};
async function withRuntimes(run:(f:{base:string;issuerPem:string;connect:(actor:'runtime-a'|'runtime-b'|null)=>Promise<Client>;
  events:()=>Promise<string[]>;source:()=>Promise<Record<string,string>>;receipts:(suffix:string)=>Promise<any[]>})=>Promise<void>){
  const base=await mkdtemp(resolve(tmpdir(),'dailyrecord-workflow-e2e-'));
  const keys={'runtime-a':keypair(),'runtime-b':keypair()},issuer=keypair();
  const clients:{client:Client;transport:StdioClientTransport}[]=[];
  try{
    const pin=async(name:string,value:unknown)=>{const bytes=JSON.stringify(value),path=resolve(base,name);await writeFile(path,bytes);return [path,createHash('sha256').update(bytes).digest('hex')];};
    const actors=await pin('actors.json',registry('actor',Object.entries(keys).map(([id,k])=>({id,publicPem:k.publicPem}))));
    const issuers=await pin('issuers.json',registry('issuer',[{id:'owner-issuer',publicPem:issuer.publicPem}]));
    const admission={schemaVersion:'academy.owner-admission/1',decider:'user',decidedAt:'2040-01-04',sourceNamespace:'academy.lms.dayrecord',teacherId:'99001',
      allowedFrom:'2040-01-03',allowedThrough:'2040-01-05',failClosedDefault:'2026-10-23'};
    const [admissionPath,admissionSha256]=await pin('admission.json',admission);
    await writeFile(resolve(base,'routing.json'),JSON.stringify({admissionPath,admissionSha256}));
    await writeFile(resolve(base,'endpoints.json'),JSON.stringify({dailyrecord:{command:process.execPath,args:['--preload',deny,resolve(import.meta.dir,'neutral-workflow-upstream-fixture.ts'),base,
      '--dailyrecord-workflow-store',resolve(base,'owner-store'),'--dailyrecord-actor-registry',...actors,'--dailyrecord-authorization-issuers',...issuers]}}));
    for(const [id,k] of Object.entries(keys))await writeFile(resolve(base,id+'.pem'),k.privatePem,{mode:0o600});
    const env={PATH:process.env.PATH??'/usr/bin:/bin',ACADEMY_MCP_INSTALL_DIR:base};
    const discovery=Bun.spawn([process.execPath,'--preload',deny,entry,'--discover'],{env,stdout:'pipe',stderr:'pipe'});
    expect(await discovery.exited).toBe(0);
    const connect=async(actor:'runtime-a'|'runtime-b'|null)=>{
      const client=new Client({name:'fictional-runtime-'+(actor??'anonymous'),version:'1.0.0'});
      const transport=new StdioClientTransport({command:process.execPath,args:['--preload',deny,entry],stderr:'pipe',
        env:actor?{...env,ACADEMY_MCP_ACTOR_ID:actor,ACADEMY_MCP_ACTOR_KEY_FILE:resolve(base,actor+'.pem')}:env});
      await client.connect(transport);clients.push({client,transport});return client;
    };
    await run({base,issuerPem:issuer.privatePem,connect,
      events:async()=>(await readFile(resolve(base,'events.txt'),'utf8')).trim().split('\n'),
      source:async()=>JSON.parse(await readFile(resolve(base,'source.json'),'utf8')),
      receipts:async suffix=>Promise.all((await readdir(resolve(base,'receipts'))).filter(n=>n.endsWith(suffix)).map(async n=>JSON.parse(await readFile(resolve(base,'receipts',n),'utf8'))))});
  }finally{
    for(const {client,transport} of clients){await client.close();await transport.close();}
    await rm(base,{recursive:true,force:true});
  }
}
async function review(client:Client){
  const c=workflowContext(fields);
  const intake:any=(await client.callTool({name:'academy_dailyrecord_intake',arguments:{context:c}})).structuredContent;
  // Owner-durable handles cross processes unchanged; no bridge ticket is minted.
  expect(intake).toMatchObject({status:'ready_for_review',observationPersistence:'owner_durable'});
  expect(intake.observationHandle).toStartWith('dailyrecord-observation:');
  const reviewed:any=(await client.callTool({name:'academy_dailyrecord_review',arguments:{context:c,observationHandle:intake.observationHandle,proposals:proposals(fields)}})).structuredContent;
  return {c,intake,reviewed,save:(authorization:unknown)=>({context:c,observationHandle:intake.observationHandle,reviewDigest:reviewed.reviewDigest,proposals:proposals(fields),authorization})};
}
const authorize=(issuerPem:string,reviewed:any,actors:string[])=>authorizationFor(issuerPem,{actors,reviewDigests:[reviewed.reviewDigest],
  actions:reviewed.patch.map((p:any)=>({field:p.field,before:p.before??'',after:p.after}))});

test('two runtime processes hand off through the owner store: A reviews, B saves, A audits',async()=>{
  await withRuntimes(async({issuerPem,connect,events,source,receipts})=>{
    const a=await connect('runtime-a'),b=await connect('runtime-b');
    const tools=(await a.listTools()).tools.map(t=>t.name);
    expect(tools).toEqual(expect.arrayContaining(['academy_dailyrecord_reconcile','academy_dailyrecord_execution_status','academy_dailyrecord_save']));
    const r=await review(a);
    expect(r.reviewed).toMatchObject({status:'prepared',reviewRecord:{persisted:true,reviewedBy:'runtime-a'},saveAdmission:'owner_signed_request_authorization_required'});
    const signed=authorize(issuerPem,r.reviewed,['runtime-b']);
    // A caller-typed proof is discarded; the bridge signs with its own configured key.
    const forged={schemaVersion:'academy.dailyrecord-actor-proof/1',actorId:'runtime-a',issuedAt:new Date().toISOString(),nonce:'f'.repeat(32),tool:'academy_dailyrecord_save',payloadSha256:'0'.repeat(64),signature:'A'.repeat(88)};
    const saved:any=(await b.callTool({name:'academy_dailyrecord_save',arguments:{...r.save(signed),actorProof:forged}})).structuredContent;
    expect(saved).toMatchObject({status:'saved',academyWrites:1,actorId:'runtime-b',parentSends:0,fields:[{field:'progress',status:'persisted',executionState:'settled_persisted'}]});
    expect((await source()).progress).toBe(fields.progress);
    expect((await events()).filter(e=>e.startsWith('write:'))).toEqual(['write:progress']);
    expect((await receipts('-result.json')).find(x=>x.tool==='academy_dailyrecord_save')).toMatchObject({academyWrites:1,parentSends:0});
    // A is authenticated but not authorized for this request; status is a metadata-only handoff view.
    expect((await a.callTool({name:'academy_dailyrecord_save',arguments:r.save(signed)})).structuredContent).toMatchObject({status:'held',reasonCode:'actor_not_authorized_for_request',academyWrites:0});
    const status:any=(await a.callTool({name:'academy_dailyrecord_execution_status',arguments:{authorizationId:signed.authorization.authorizationId}})).structuredContent;
    expect(status).toMatchObject({status:'recorded',actions:[{field:'progress',executionState:'settled_persisted'}]});
    expect(status.audit.filter((e:any)=>e.event==='review_recorded'||e.event==='dispatch_completed').map((e:any)=>e.actorId)).toEqual(['runtime-a','runtime-b']);
  });
},60000);

test('concurrent runtime processes with one authorization dispatch exactly once',async()=>{
  await withRuntimes(async({base,issuerPem,connect,events})=>{
    const a=await connect('runtime-a'),b=await connect('runtime-b');
    const r=await review(a),signed=authorize(issuerPem,r.reviewed,['runtime-a','runtime-b']);
    await writeFile(resolve(base,'inject-slow-write'),'');
    const results=(await Promise.all([a,b].map(c=>c.callTool({name:'academy_dailyrecord_save',arguments:r.save(signed)})))).map((x:any)=>x.structuredContent);
    expect(results.map(x=>x.academyWrites).sort()).toEqual([0,1]);
    expect(results.find(x=>x.academyWrites===0)).toMatchObject({status:'saved',reasonCode:'duplicate_execution_already_settled'});
    expect((await events()).filter(e=>e.startsWith('write:'))).toEqual(['write:progress']);
  });
},60000);

test('an owner process crash mid-dispatch stays uncertain until a readback reconciliation; it is never replayed',async()=>{
  await withRuntimes(async({base,issuerPem,connect,events,receipts})=>{
    const a=await connect('runtime-a'),b=await connect('runtime-b');
    const r=await review(a),signed=authorize(issuerPem,r.reviewed,['runtime-a','runtime-b']);
    await writeFile(resolve(base,'inject-crash-after-write'),'');
    const crashed:any=await a.callTool({name:'academy_dailyrecord_save',arguments:r.save(signed)});
    expect(crashed.isError).toBe(true);
    expect(crashed.structuredContent).toMatchObject({status:'blocked',academyWrites:null,effectStatus:'unknown',automaticRetryAllowed:false});
    expect((await receipts('-failure.json')).find(x=>x.tool==='academy_dailyrecord_save')).toMatchObject({academyWrites:null,effectStatus:'unknown'});
    await unlink(resolve(base,'inject-crash-after-write'));
    // Another runtime, another process: the consumed action blocks any second dispatch.
    expect((await b.callTool({name:'academy_dailyrecord_save',arguments:r.save(signed)})).structuredContent)
      .toMatchObject({status:'held',reasonCode:'uncertain_dispatch_reconcile_required',academyWrites:0,fields:[{field:'progress',executionState:'dispatch_outcome_unknown'}]});
    expect((await b.callTool({name:'academy_dailyrecord_reconcile',arguments:{context:r.c,authorizationId:signed.authorization.authorizationId}})).structuredContent)
      .toMatchObject({status:'settled',academyWrites:0,fields:[{field:'progress',executionState:'reconciled_persisted'}]});
    expect((await events()).filter(e=>e.startsWith('write:'))).toEqual(['write:progress']);
  });
},60000);

test('a post-dispatch bridge receipt failure keeps the save effect unknown',async()=>{
  await withRuntimes(async({base,issuerPem,connect,receipts})=>{
    const a=await connect('runtime-a');
    const r=await review(a),signed=authorize(issuerPem,r.reviewed,['runtime-a']);
    await writeFile(resolve(base,'inject-save-receipt-failure'),'');
    const saved:any=await a.callTool({name:'academy_dailyrecord_save',arguments:r.save(signed)});
    expect(saved.isError).toBe(true);
    expect(saved.structuredContent).toMatchObject({academyWrites:null,effectStatus:'unknown',automaticRetryAllowed:false});
    expect((await receipts('-failure.json')).find(x=>x.tool==='academy_dailyrecord_save')).toMatchObject({academyWrites:null,effectStatus:'unknown'});
    for(const name of (await readdir(resolve(base,'receipts'))).filter(n=>n.endsWith('-result.json')))await rmdir(resolve(base,'receipts',name)).catch(()=>{});
    await unlink(resolve(base,'inject-save-receipt-failure'));
    // The owner store already holds the true outcome; a repeated save reports it without dispatch.
    expect((await a.callTool({name:'academy_dailyrecord_save',arguments:r.save(signed)})).structuredContent).toMatchObject({status:'saved',reasonCode:'duplicate_execution_already_settled',academyWrites:0});
  });
},60000);

test('a runtime without an owner-registered key cannot record a review or save',async()=>{
  await withRuntimes(async({issuerPem,connect,events})=>{
    const anonymous=await connect(null);
    const r=await review(anonymous);
    expect(r.reviewed).toMatchObject({status:'prepared',reviewRecord:{persisted:false,reviewedBy:null,actorAuthentication:{reasonCode:'actor_proof_required'}}});
    const saved:any=(await anonymous.callTool({name:'academy_dailyrecord_save',arguments:r.save(authorize(issuerPem,r.reviewed,['runtime-a']))})).structuredContent;
    expect(saved).toMatchObject({status:'held',reasonCode:'actor_proof_required',academyWrites:0});
    expect((await events()).some(e=>e.startsWith('write:'))).toBe(false);
  });
},60000);

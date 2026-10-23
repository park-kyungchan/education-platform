/** Bounded source citations and two isolated consumer probes; not a canonical auditor replacement. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {sourceBase,dom,mcp,sources,ports,workflows,gaps} from './inventory.ts';
import type {Projection,SourcePort} from '../../apps/academy/month-end-workbench/src/contracts.ts';
import {assertRecord,taskVerificationTarget} from '/home/palantirkc/projects/agent-platform/packages/work-continuity/src/git-work/index.ts';
import type {TaskRecord} from '/home/palantirkc/projects/agent-platform/packages/work-continuity/src/git-work/types.ts';

const root=resolve(import.meta.dir,'../..');
const owned='architecture/academy-query-integration/';
const work='work/education-platform/academy-query-integration-20261021/';
const sha=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
const git=(cwd:string,args:string[])=>{
  const result=Bun.spawnSync(['git',...args],{cwd});
  assert.equal(result.exitCode,0,'read-only Git lookup failed: '+args.join(' '));
  return result.stdout;
};
const bytesAt=(cwd:string,commit:string,path:string)=>git(cwd,['show',commit+':'+path]);
const json=(path:string)=>JSON.parse(readFileSync(resolve(root,path),'utf8'));
const writeNew=async(path:string,value:unknown)=>{
  assert(path.startsWith(owned)&&path.endsWith('.json')&&!path.includes('..'));
  assert.equal(await Bun.file(resolve(root,path)).exists(),false,'immutable output exists: '+path);
  await Bun.write(resolve(root,path),JSON.stringify(value,null,2)+'\n');
};
const mode=process.argv[2]??'inspect';
assert(['inspect','source-check','records-check'].includes(mode));
const auditor='/home/palantirkc/projects/agent-platform';
const auditorPin='712f90deac0676e662dc5d75d88d89f7b6773bfe';
assert.equal(git(auditor,['rev-parse','HEAD']).toString().trim(),auditorPin);
assert.equal(Bun.spawnSync(['git','diff','--quiet','HEAD','--','packages/work-continuity/src'],{cwd:auditor}).exitCode,0);
assert.equal(git(root,['rev-parse','HEAD']).toString().trim(),sourceBase,'source base changed; require a new inventory revision');
const frozen=JSON.parse(bytesAt(dom.repositoryRoot,dom.commit,dom.inventory).toString());
assert.equal(git(dom.repositoryRoot,['rev-parse',dom.commit+'^{tree}']).toString().trim(),dom.tree);
const receipts=Object.entries(sources).map(([id,ref])=>{
  const cwd=ref.repository==='education'?root:mcp.repositoryRoot;
  const commit=ref.repository==='education'?sourceBase:mcp.commit;
  const data=bytesAt(cwd,commit,ref.path),local=readFileSync(resolve(cwd,ref.path));
  assert.equal(sha(data),sha(local),'selected source drift: '+ref.path);
  const prior=frozen.sources.find((row:{path:string})=>row.path===ref.path);
  if(ref.repository==='education'&&prior)assert.equal(sha(data),prior.sha256,'selected DOM source mismatch: '+ref.path);
  const lines=data.toString().split('\n');
  const anchors=ref.anchors.map(anchor=>{
    const line=lines.findIndex(value=>value.includes(anchor))+1;
    assert(line>0,'missing source anchor '+id+': '+anchor);
    return {anchor,line};
  });
  return {id,repositoryId:ref.repository==='education'?'park-kyungchan/education-platform':mcp.repositoryId,commit,path:ref.path,
    blobOid:git(cwd,['rev-parse',commit+':'+ref.path]).toString().trim(),sha256:sha(data),bytes:data.length,anchors,
    frozenDomHashReused:ref.repository==='education'&&!!prior};
});
const domRefs=[dom.inventory,dom.selection,dom.boundary].map(path=>{
  const bytes=bytesAt(dom.repositoryRoot,dom.commit,path);
  return {repositoryId:'park-kyungchan/education-platform',commit:dom.commit,path,sha256:sha(bytes),bytes:bytes.length};
});
const manifest={schema:'academy.qry01-source-evidence.v1',sourceBase,dom:{...dom,refs:domRefs,wholeInventoryRerun:false},mcp,
  files:receipts,limits:{boundedSelection:true,exhaustiveGraph:false,sourceBodiesRetained:false,privateOriginalsRead:false,nativeBindingQualified:false}};
const manifestPath=owned+'source-evidence.json';
if(mode==='inspect'){
  await writeNew(manifestPath,manifest);
  console.log(JSON.stringify({status:'pass',selectedFiles:receipts.length,domSelectedHashesReused:receipts.filter(r=>r.frozenDomHashReused).length,domWholeGraphRerun:false}));
  process.exit(0);
}
assert.deepEqual(json(manifestPath),manifest,'manifest drift');
for(const port of ports)for(const id of port.evidence)assert(id in sources,'unresolved port citation');
for(const gap of gaps)for(const id of gap.basis)assert(id in sources,'unresolved gap citation');
assert.equal(new Set(ports.map(p=>p.id)).size,ports.length);
assert.equal(new Set(workflows.map(w=>w.id)).size,7);
for(const workflow of workflows)for(const port of workflow.ports)assert(ports.some(p=>p.id===port));

if(mode==='source-check'){
  // Bun erases the provider's external SDK type import. This runtime probe uses
  // the real module, while the owned tsc check does not re-certify its unavailable
  // SDK declaration closure. The first broader attempt is retained in R1.
  const modulePath=resolve(root,'apps/academy/month-end-workbench/src/integrations/mcp-source-port.ts');
  const provider=await import(modulePath) as {
    createSyntheticMcpSourcePort(client:unknown,projection:Projection):Promise<SourcePort>;
    createMcpSourcePort(configuration:undefined,projection:Projection):Promise<SourcePort>;
  };
  // Minimal synthetic projection is used solely to reach the adapter's input bound.
  // No research originals, MCP process, socket, credential or private source file is opened.
  const projection={owner:'math-research-module',revision:'07edb2dea2e5997aea4318f0fa2efa21dde633df',manifest:[{path:'synthetic/probe.json',sha256:'0'.repeat(64)}]} as unknown as Projection;
  let toolCalls=0,closed=0;
  const client={listTools:async()=>({tools:['academy_item_label_scope','academy_find_item_labels','academy_review_type_questions'].map(name=>({name,inputSchema:{type:'object'},annotations:{readOnlyHint:true,destructiveHint:false}}))}),
    callTool:async()=>{toolCalls++;throw Error('unexpected_synthetic_tool_call');},close:async()=>{closed++;}};
  const adapter=await provider.createSyntheticMcpSourcePort(client,projection);
  await assert.rejects(adapter.scope({context:null,view:'hierarchy',offset:0,limit:100}),/mcp_integer_invalid/);
  assert.equal(toolCalls,0);await adapter.close?.();assert.equal(closed,1);
  const unavailable=await provider.createMcpSourcePort(undefined,projection);
  assert.equal(unavailable.mode,'unavailable');assert.equal((await unavailable.scope({context:null})).availability,'unavailable');
  await assert.rejects(unavailable.find({} as never),/academy_unavailable/);
  const commands=[];
  for(const [id,args] of [
    ['status',['bun','run','status']],
    ['actual-typescript-version',['bun','node_modules/typescript/bin/tsc','--version']],
    ['owned-typecheck',['bun','node_modules/typescript/bin/tsc','--noEmit','-p',owned+'tsconfig.json']],
  ] as const){
    const startedAt=new Date().toISOString(),p=Bun.spawn([...args],{cwd:root,stdout:'pipe',stderr:'pipe'});
    const [stdout,stderr,exitCode]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);
    commands.push({id,args,startedAt,exitCode,stdoutSha256:sha(stdout),stderrSha256:sha(stderr),stdoutBytes:Buffer.byteLength(stdout),stderrBytes:Buffer.byteLength(stderr),summary:id==='status'?'Source status metadata; no production/runtime proof.':stdout.trim()||stderr.slice(-4000)});
  }
  const receipt={schema:'academy.qry01-source-checks.v1',createdAt:new Date().toISOString(),sourceBase,
    nativeThreadId:process.env.CODEX_THREAD_ID??null,nativeIdentityMeaning:'Observed environment CODEX_THREAD_ID; not derived from logical IDs.',
    manifestSha256:sha(readFileSync(resolve(root,manifestPath))),selectedFiles:receipts.length,domSelectedHashesReused:receipts.filter(r=>r.frozenDomHashReused).length,
    inventory:{ports:ports.length,workflows:workflows.length,gaps:gaps.length,resolvedSourceCitations:true},
    probes:[{id:'frontend100-adapter50',status:'pass',expected:'mcp_integer_invalid',toolCalls,closed,meaning:'Demonstrates an actual consumer/provider limit mismatch using only an isolated synthetic client.'},
      {id:'unconfigured-source-unavailable',status:'pass',meaning:'Undefined configuration creates no process; scope unavailable and find refuses.'}],commands,
    reused:['Qualified DOM-01 exact frozen source inventory and snapshot/transition qualification in receiving Work','Root-qualified df8b9f7 Unicode/cursor/no-loss/whole-tool512KiB behavior and bounded metadata refusal'],
    notRun:['Unchanged DOM whole241-source graph and suites','Unchanged full Workbench MCP suites','bun run check aggregate: would rerun every unchanged module; direct task instruction requires proportional inventory checks','Native startup, PostgreSQL sockets, live Academy reads, MCP subprocesses, browser/server startup'],
    priorFailuresRetained:['QRY-01-SOURCE-CHECKS-R1.json: broader static provider import failed on missing @modelcontextprotocol/client declarations and dependent implicit-any; own readonly spawn argument corrected. R2 owns only inventory/checkpoint source and browser-safe SourcePort contracts; actual provider still exercised by Bun dynamic import, no stub/installation/pin change. Full provider typecheck remains unqualified in this environment.', 'DOM-01 query-boundary documents missing research/backend-map/route-registry.json blocking endpointCatalog tests; not repaired or promoted by this inventory','df8b9f7 object not present in root architecture/project mirror; exact root-qualified saved-MCP repository locator resolved successfully; no fetch or retry of native effects'],
    effects:{privateOriginalReads:0,businessWrites:0,nativeActivation:0,gitMutation:0,publication:0},
    passed:commands.every(r=>r.exitCode===0)};
  await writeNew(owned+'observations/QRY-01-SOURCE-CHECKS-R2.json',receipt);
  console.log(JSON.stringify({status:receipt.passed?'pass':'fail',selectedFiles:receipts.length,ports:ports.length,gaps:gaps.length,commands:commands.map(({id,exitCode})=>({id,exitCode})),syntheticToolCalls:toolCalls}));
  if(!receipt.passed)process.exitCode=1;
}else{
  const task=json(work+'tasks/'+encodeURIComponent('education-platform:task:academy-query-integration-20261021-qry-01')+'.json') as TaskRecord;
  const result=json(work+'inputs/QRY-01-RESULT-R1.json');
  const vi=json(work+'inputs/QRY-01-VERIFICATION-R1.json');
  const evidence=json(work+'evidence/'+encodeURIComponent('education-platform:evidence:qry-01-result-observation-r1')+'.json');
  const ve=json(work+'evidence/'+encodeURIComponent('education-platform:evidence:qry-01-verification-r1')+'.json');
  for(const record of [task,result,vi,evidence,ve])assertRecord(record);
  const verification=vi.content.verification;
  assert.deepEqual(verification.payload.targetRefs,[taskVerificationTarget(task)]);
  assert(verification.payload.criteria.every((r:{status:string;evidenceRefs:string[]})=>r.status==='pass'&&r.evidenceRefs.includes(evidence.id)));
  const resultPath=work+'inputs/QRY-01-RESULT-R1.json';
  const resultSha=sha(readFileSync(resolve(root,resultPath)));
  assert(verification.payload.inputHashes.some((r:{path:string;sha256:string})=>r.path===resultPath&&r.sha256===resultSha));
  assert.equal(evidence.source.sha256,resultSha);
  assert.equal(ve.source.sha256,sha(readFileSync(resolve(root,work+'inputs/QRY-01-VERIFICATION-R1.json'))));
  for(const artifact of result.content.artifacts)assert.equal(sha(readFileSync(resolve(root,artifact.path))),artifact.sha256);
  assert.equal(task.state.execution,'complete');assert.equal(task.state.verification,'passed');assert.equal(task.state.sharedAudit,'unsynchronized');assert.equal(task.state.formalCompletion,'pending');
  const receipt={schema:'academy.qry01-local-record-check.v1',createdAt:new Date().toISOString(),canonicalApiPin:auditorPin,
    api:'assertRecord/taskVerificationTarget',target:taskVerificationTarget(task),resultInputSha256:resultSha,
    resultObservationCited:true,exactResultInputHashBound:true,evidenceSourceHashesMatch:true,artifactHashesMatch:true,
    sourceAndSelectedPortChecks:'pass',canonicalCommittedSnapshot:'pending root commit/checkpoint',canonicalCommittedTransition:'pending root commit/checkpoint',
    dirtyWorktreeIsNotCommittedSource:true,sharedDelivery:false,nativeAdoption:false,formalAcceptance:false};
  await writeNew(owned+'observations/QRY-01-LOCAL-RECORD-CHECK-R1.json',receipt);
  console.log(JSON.stringify(receipt));
}

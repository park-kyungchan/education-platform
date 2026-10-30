import {expect,test} from 'bun:test';
import {readFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createPackagedFixture} from './release-graph-fixture.ts';
const hash=(x:string|Buffer)=>createHash('sha256').update(x).digest('hex');
test('V2 composite routes after student resolution to either pinned paper admission and preserves denial',async()=>{
 const f=await createPackagedFixture();
 try{
  const built=await Bun.build({entrypoints:[resolve(import.meta.dir,'dailytest-v2-paper-fixture.ts')],target:'node',outdir:f.base,naming:'paper.mjs'});expect(built.success).toBe(true);
  const path=resolve(f.base,'paper.mjs'),artifact={path,sha256:hash(await readFile(path))},paperEvents=resolve(f.base,'paper-events');
  const manifests:any={},endpoints:any=JSON.parse(await readFile(f.release.endpoints.path,'utf8'));
  for(const endpoint of ['paper1','paper2']){
   const args=[endpoint,paperEvents,'ok'];
   manifests[endpoint]=await f.pin(`manifest-${endpoint}.json`,{schemaVersion:'academy.endpoint-identity/1',endpoint,semanticContractVersion:'fictional-paper/1',launchArgumentsSha256:hash(JSON.stringify(args)),artifacts:[{...artifact,role:'entry'}]});
   endpoints[endpoint]={command:process.execPath,args:['--no-env-file',path,'--runtime-identity',manifests[endpoint].path,manifests[endpoint].sha256,...args]};
  }
  let endpointPin=await f.pin('endpoints-two-papers.json',endpoints);
  const registry=JSON.parse(await readFile(f.release.registry.path,'utf8'));
  registry.push(...['paper1','paper2'].map((endpoint,i)=>({endpoint,upstreamName:'academy_paper_headers',tool:{name:i?'class2_academy_paper_headers':'academy_paper_headers',inputSchema:{type:'object'}}})));
  registry.push({endpoint:'dailyrecord',upstreamName:'academy_dailytest_history_with_headers',tool:{name:'academy_dailytest_history_with_headers',inputSchema:{type:'object'}}});
  const registryPin=await f.pin('registry-two-papers.json',registry),originalRouting=JSON.parse(await readFile(f.release.routing.path,'utf8'));
  let n=0;const publish=async(scopes:any)=>{const routing=await f.pin(`scoped-routing-${++n}.json`,{...originalRouting,paperScopes:scopes});const pointer=await f.pin(`scoped-release-${n}.json`,{...f.release,generation:`scope-${n}`,routing,endpoints:endpointPin,registry:registryPin,endpointIdentities:{dailyrecord:f.manifest,...manifests}});await rename(pointer.path,resolve(f.base,'release.json'));};
  const call=()=>f.client.callTool({name:'academy_dailytest_history_with_headers',arguments:{displayName:'Fictional Two',lessonDate:'2026-10-21',purpose:'Fictional request',currentRequestRef:'fictional-ref',periods:['11']}});
  await publish([{endpoint:'paper1',studentIds:['77002']},{endpoint:'paper2',studentIds:['77001']}]);
  const observed=await call();expect(observed.structuredContent).toMatchObject({status:'observed',headersRead:1});
  const outside=await f.client.callTool({name:'academy_dailytest_history_with_headers',arguments:{displayName:'Fictional Two',lessonDate:'2026-10-21',purpose:'Fictional request',currentRequestRef:'fictional-ref',periods:['11'],headerOffset:2,expectedSelectionSha256:(observed.structuredContent as any).selectionSha256}});
  expect(outside.structuredContent).toMatchObject({code:'dailytest_header_offset_out_of_range',failure:{category:'policy_denial'}});
  const invalidPin=await f.client.callTool({name:'academy_dailytest_history_with_headers',arguments:{displayName:'Fictional Two',lessonDate:'2026-10-21',purpose:'Fictional request',currentRequestRef:'fictional-ref',periods:['11'],expectedSelectionSha256:'0'.repeat(64)}});
  expect(invalidPin.structuredContent).toMatchObject({code:'dailytest_header_selection_changed',failure:{category:'contract_drift'}});
  await publish([{endpoint:'paper1',studentIds:['77001']},{endpoint:'paper2',studentIds:['77002']}]);
  expect((await call()).structuredContent).toMatchObject({status:'observed',headersRead:1});
  const denyArgs=['paper2',paperEvents,'deny'];
  manifests.paper2=await f.pin('manifest-paper2-denied.json',{schemaVersion:'academy.endpoint-identity/1',endpoint:'paper2',semanticContractVersion:'fictional-paper/1',launchArgumentsSha256:hash(JSON.stringify(denyArgs)),artifacts:[{...artifact,role:'entry'}]});
  endpoints.paper2={command:process.execPath,args:['--no-env-file',path,'--runtime-identity',manifests.paper2.path,manifests.paper2.sha256,...denyArgs]};
  endpointPin=await f.pin('endpoints-denied.json',endpoints);
  await publish([{endpoint:'paper1',studentIds:['77001']},{endpoint:'paper2',studentIds:['77002']}]);
  const blocked=await call();expect(blocked.isError).toBe(true);expect(blocked.structuredContent).toMatchObject({status:'blocked',code:'read_scope_not_admitted',failedSource:'paper',sourceRequests:0});expect(JSON.stringify(blocked)).not.toContain('PRIVATE_CANARY');
  for(const [mode,code,sourceRequests] of [['latched','source_failure_latched_no_retry',null],['private','source_headers_read_failed',2]] as const){
   const args=['paper2',paperEvents,mode];manifests.paper2=await f.pin(`manifest-paper2-${mode}.json`,{schemaVersion:'academy.endpoint-identity/1',endpoint:'paper2',semanticContractVersion:'fictional-paper/1',launchArgumentsSha256:hash(JSON.stringify(args)),artifacts:[{...artifact,role:'entry'}]});
   endpoints.paper2={command:process.execPath,args:['--no-env-file',path,'--runtime-identity',manifests.paper2.path,manifests.paper2.sha256,...args]};endpointPin=await f.pin(`endpoints-${mode}.json`,endpoints);
   await publish([{endpoint:'paper1',studentIds:['77001']},{endpoint:'paper2',studentIds:['77002']}]);const failure=await call();expect(failure.isError).toBe(true);expect(failure.structuredContent).toMatchObject({code,failedSource:'paper',sourceRequests});expect(JSON.stringify(failure)).not.toContain('private_canary');
  }
  const identityArgs=['paper2',paperEvents,'identity'];
  manifests.paper2=await f.pin('manifest-paper2-identity.json',{schemaVersion:'academy.endpoint-identity/1',endpoint:'paper2',semanticContractVersion:'fictional-paper/1',launchArgumentsSha256:hash(JSON.stringify(identityArgs)),artifacts:[{...artifact,role:'entry'}]});
  endpoints.paper2={command:process.execPath,args:['--no-env-file',path,'--runtime-identity',manifests.paper2.path,manifests.paper2.sha256,...identityArgs]};
  endpointPin=await f.pin('endpoints-identity.json',endpoints);
  await publish([{endpoint:'paper1',studentIds:['77001']},{endpoint:'paper2',studentIds:['77002']}]);
  expect((await call()).structuredContent).toMatchObject({code:'dailytest_header_identity_conflict',failure:{category:'contract_drift'}});
  await publish([{endpoint:'paper1',studentIds:['77002']},{endpoint:'paper2',studentIds:['77002']}]);
  expect((await call()).isError).toBe(true);
  expect((await readFile(paperEvents,'utf8')).trim().split('\n')).toEqual(['paper1','paper2','paper2','paper2','paper2','paper2']);
  // Exercise the actual DailyRecordService response, not a hand-written stub.
  const metadataPolicy=JSON.parse(await readFile(f.ownerArgs[4]!,'utf8'));metadataPolicy.operations=['daily_inventory'];
  const deniedMetadata=await f.pin('metadata-denied.json',metadataPolicy),ownerArgs=[...f.ownerArgs];ownerArgs[4]=deniedMetadata.path;ownerArgs[5]=deniedMetadata.sha256;
  const ownerManifest=JSON.parse(await readFile(f.manifest.path,'utf8'));ownerManifest.launchArgumentsSha256=hash(JSON.stringify(ownerArgs));
  ownerManifest.artifacts=ownerManifest.artifacts.map((a:any)=>a.path===f.ownerArgs[4]?{...deniedMetadata,role:'admission'}:a);
  const deniedOwner=await f.pin('metadata-denied-owner.json',ownerManifest);
  endpoints.dailyrecord={command:process.execPath,args:['--no-env-file',f.owner.path,'--runtime-identity',deniedOwner.path,deniedOwner.sha256,...ownerArgs]};
  endpointPin=await f.pin('endpoints-metadata-denied.json',endpoints);
  const metadataRouting=await f.pin('metadata-denied-routing.json',{...originalRouting,paperScopes:[{endpoint:'paper1',studentIds:['77002']},{endpoint:'paper2',studentIds:['77001']}]});
  const metadataRelease=await f.pin('metadata-denied-release.json',{...f.release,generation:'metadata-denied',routing:metadataRouting,endpoints:endpointPin,registry:registryPin,endpointIdentities:{dailyrecord:deniedOwner,...manifests}});await rename(metadataRelease.path,resolve(f.base,'release.json'));
  const before=await readFile(f.events,'utf8');const metadataDenied=await call();
  expect(metadataDenied.isError).toBe(true);expect(metadataDenied.structuredContent).toMatchObject({status:'blocked',code:'metadata_namespace_not_admitted',reasonCode:'metadata_namespace_not_admitted',failedSource:'metadata',sourceRequests:null,failure:{category:'policy_denial'}});
  const after=await readFile(f.events,'utf8');expect(after.slice(before.length)).not.toContain('"op":"auth"');
  expect((await readFile(paperEvents,'utf8')).trim().split('\n')).toEqual(['paper1','paper2','paper2','paper2','paper2','paper2']);

 }finally{await f.client.close();await f.transport.close();}
},60000);

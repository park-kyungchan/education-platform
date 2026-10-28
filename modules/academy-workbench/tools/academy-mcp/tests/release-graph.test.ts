import {expect,test} from 'bun:test';
import {writeFile,readFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createPackagedFixture as fixture} from './release-graph-fixture.ts';
import {prepareRuntimeRelease} from '../src/prepare-runtime-release.ts';
const hash=(b:string|Buffer)=>createHash('sha256').update(b).digest('hex');
const request={displayName:'Fictional Two',lessonDate:'2026-10-21',purpose:'Fictional metadata',currentRequestRef:'release-graph-request',queries:[{kind:'daily_inventory'}]};
test('exact packaged owner/bridge graph identifies itself, revalidates per call, keeps typed faults and detects drift before reads',async()=>{
 const f=await fixture();
 try{
  const identity=await f.client.callTool({name:'academy_runtime_identity',arguments:{}});expect(identity.structuredContent).toMatchObject({schemaVersion:'academy.mcp-release/2',bridgeSha256:f.bridge.sha256,loadedBridgeSha256:f.bridge.sha256,graphQualification:'artifact_pinned',endpointIdentities:[{manifestSha256:f.manifest.sha256}]});
  for(let i=0;i<2;i++)expect((await f.client.callTool({name:'academy_student_metadata_get',arguments:request})).structuredContent).toMatchObject({status:'observed',scope:{studentId:'77002',lessonDate:request.lessonDate}});
  let events=(await readFile(f.events,'utf8')).trim().split('\n').map(l=>JSON.parse(l));expect(events.filter(e=>e.op==='metadata')).toHaveLength(2);expect(new Set(events.filter(e=>e.op==='identity').map(e=>e.pid)).size).toBe(2);
  const unknown=await f.client.callTool({name:'unknown_tool',arguments:{}});expect(unknown.structuredContent).toMatchObject({code:'unknown_tool',failure:{category:'endpoint_absence'}});
  for(const [variant,category] of [['expired','authentication'],['drift','contract_drift'],['truncated','malformed_response']]){
   const original=JSON.parse(await readFile(f.release.endpoints.path,'utf8'));original.dailyrecord.args.push(variant);
   const rawManifest=JSON.parse(await readFile(f.manifest.path,'utf8'));rawManifest.launchArgumentsSha256=hash(JSON.stringify([...f.ownerArgs,variant]));
   const variantManifest=await f.pin('manifest-'+variant+'.json',rawManifest);original.dailyrecord.args[3]=variantManifest.path;original.dailyrecord.args[4]=variantManifest.sha256;
   const endpoints=await f.pin('endpoints-'+variant+'.json',original),next=await f.pin('pointer-'+variant+'.json',{...f.release,generation:variant,endpoints,endpointIdentities:{dailyrecord:variantManifest}});await rename(next.path,resolve(f.base,'release.json'));
   const result=await f.client.callTool({name:'academy_student_metadata_get',arguments:request});expect(result.structuredContent).toMatchObject({status:'unavailable',failure:{category}});expect(JSON.stringify(result)).not.toContain('CANARY');
  }
  const original=JSON.parse(await readFile(f.release.endpoints.path,'utf8'));original.dailyrecord.args=original.dailyrecord.args.filter((_:string,i:number)=>![2,3,4].includes(i));
  const wrong=await f.pin('endpoints-no-identity.json',original),pointer=await f.pin('pointer-no-identity.json',{...f.release,endpoints:wrong});await rename(pointer.path,resolve(f.base,'release.json'));
  expect((await f.client.callTool({name:'academy_student_metadata_get',arguments:request})).structuredContent).toMatchObject({code:'release_endpoint_identity_mismatch'});
  const before=await readFile(f.events,'utf8');
  const broken=await f.pin('manifest-mismatch.json',{schemaVersion:'academy.endpoint-identity/1',endpoint:'dailyrecord',semanticContractVersion:'academy-read/metadata-v1',launchArgumentsSha256:hash(JSON.stringify(f.ownerArgs)),artifacts:[{...f.owner,sha256:'0'.repeat(64),role:'entry'}]});
  const badPointer=await f.pin('pointer-artifact-mismatch.json',{...f.release,endpointIdentities:{dailyrecord:broken}});await rename(badPointer.path,resolve(f.base,'release.json'));
  expect((await f.client.callTool({name:'academy_student_metadata_get',arguments:request})).structuredContent).toMatchObject({code:'release_artifact_mismatch'});expect(await readFile(f.events,'utf8')).toBe(before);
 }finally{await f.client.close();await f.transport.close();}
},60000);
test('actual stdio malformed frame emits safe diagnostics and subsequent valid requests recover',async()=>{
 const f=await fixture();await f.client.close();await f.transport.close();
 const proc=Bun.spawn([process.execPath,'--no-env-file',f.bridge.path],{env:f.env,stdin:'pipe',stdout:'pipe',stderr:'pipe'});
 proc.stdin.write('PRIVATE_MALFORMED_CANARY\n');
 proc.stdin.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'fictional-raw',version:'1'}}})+'\n');
 const reader=proc.stdout.getReader(),decoder=new TextDecoder();let output='';
 while(!output.includes('"id":1')){const v=await reader.read();if(v.done)throw Error('raw_init_missing');output+=decoder.decode(v.value);}
 proc.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
 proc.stdin.write(JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'academy_runtime_identity',arguments:{}}})+'\n');
 while(!output.includes('"id":2')){const v=await reader.read();if(v.done)throw Error('raw_response_missing');output+=decoder.decode(v.value);}
 proc.stdin.end();await proc.exited;const errors=await new Response(proc.stderr).text();
 expect(errors).toContain('mcp_stdio_input_or_transport_invalid');expect(errors+output).not.toContain('PRIVATE_MALFORMED_CANARY');expect(output).toContain('artifact_pinned');
 await writeFile(resolve(f.base,'raw-protocol-result.json'),JSON.stringify({diagnosticObserved:true,validRecoveryObserved:true,inputEchoed:false})+'\n',{mode:0o600});
},60000);

test('release preparation writes only a fresh local draft with exact pins and held migration',async()=>{
 const f=await fixture();try{
  const plan={generation:'review-draft',bridge:f.bridge,admission:{path:resolve(f.base,'dailyrecord-admission.json'),sha256:hash(await readFile(resolve(f.base,'dailyrecord-admission.json')))},registry:f.release.registry,
   endpoints:{dailyrecord:{command:process.execPath,prefixArgs:['--no-env-file'],identity:f.manifest,args:f.ownerArgs}}};
  const before=await readFile(resolve(f.base,'release.json'),'utf8'),draft=await prepareRuntimeRelease(plan);
  expect(draft.base).not.toBe(f.base);expect(JSON.parse(await readFile(resolve(draft.base,'migration-review.json'),'utf8'))).toMatchObject({status:'local_draft_not_installed',registrationPerformed:false,nativeEndpointsLaunched:false});
  expect(await readFile(resolve(f.base,'release.json'),'utf8')).toBe(before);
 }finally{await f.client.close();await f.transport.close();}
},60000);

test.skipIf(!Bun.which('node'))('Node bridge reads through the exact packaged Bun owner with the same release graph',async()=>{
 const f=await fixture(Bun.which('node')!);try{
  expect((await f.client.callTool({name:'academy_runtime_identity',arguments:{}})).structuredContent).toMatchObject({graphQualification:'artifact_pinned',loadedBridgeSha256:f.bridge.sha256});
  expect((await f.client.callTool({name:'academy_student_metadata_get',arguments:request})).structuredContent).toMatchObject({status:'observed',scope:{studentId:'77002'}});
 }finally{await f.client.close();await f.transport.close();}
},60000);

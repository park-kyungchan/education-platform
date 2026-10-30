import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
const hash=(b:string|Buffer)=>createHash('sha256').update(b).digest('hex');
const policy={schemaVersion:'academy.metadata-admission/1',sourceNamespace:'academy.lms.metadata',teacherId:'99001',allowedFrom:null,allowedThrough:null,studentScope:'source_verified',operations:['daily_metadata','daily_inventory','daily_history'],relativeSelectors:['1','11','12','13','14','15','16']};
// Retain each disposable target as evidence, including failures. No installed path is written.
export async function createPackagedFixture(bridgeCommand=process.execPath,variant?:string){
 const base=await mkdtemp(resolve(tmpdir(),'academy-release-graph-'));
 const pin=async(name:string,value:unknown)=>{const path=resolve(base,name),bytes=typeof value==='string'?value:JSON.stringify(value);await writeFile(path,bytes,{mode:0o600,flag:'wx'});return {path,sha256:hash(bytes)};};
 const build=async(entry:string,name:string)=>{const result=await Bun.build({entrypoints:[resolve(import.meta.dir,entry)],target:'node',outdir:base,naming:name});if(!result.success)throw Error('fixture_build_failed');const path=resolve(base,name);return {path,sha256:hash(await readFile(path))};};
 const bridge=await build('../src/neutral-server.ts','bridge.mjs'),owner=await build('metadata-owner-fixture.ts','owner.mjs');
 const admission=await pin('dailyrecord-admission.json',{schemaVersion:'academy.owner-admission/2',decider:'user',decidedAt:'2026-10-28',sourceNamespace:'academy.lms.dayrecord',teacherId:'99001',allowedFrom:null,allowedThrough:null,studentScope:'source_verified',failClosedDefault:'2026-10-23'});
 const metadata=await pin('metadata-admission.json',policy),routing=await pin('routing.json',{admissionPath:admission.path,admissionSha256:admission.sha256});
 const events=resolve(base,'events.jsonl');
 const ownerArgs=['--dailyrecord-admission',admission.path,admission.sha256,'--metadata-admission',metadata.path,metadata.sha256,events,...(variant?[variant]:[])];
 const manifest=await pin('endpoint-manifest.json',{schemaVersion:'academy.endpoint-identity/1',endpoint:'dailyrecord',semanticContractVersion:'academy-read/metadata-v1',launchArgumentsSha256:hash(JSON.stringify(ownerArgs)),artifacts:[{...owner,role:'entry'},{...admission,role:'admission'},{...metadata,role:'admission'}]});
 const endpoints=await pin('endpoints.json',{dailyrecord:{command:process.execPath,args:['--no-env-file',owner.path,'--runtime-identity',manifest.path,manifest.sha256,...ownerArgs]}});
 const env={PATH:process.env.PATH??'/usr/bin:/bin',ACADEMY_MCP_INSTALL_DIR:base};
 const discover=Bun.spawn([process.execPath,'--no-env-file',bridge.path,'--discover'],{env,stdout:'pipe',stderr:'pipe'});if(await discover.exited!==0)throw Error('packaged_fixture_discovery_failed');
 const registry={path:resolve(base,'registry.json'),sha256:hash(await readFile(resolve(base,'registry.json')))};
 const release={schemaVersion:'academy.mcp-release/2',generation:'fictional-v1',bridge,routing,endpoints,registry,endpointIdentities:{dailyrecord:manifest}};
 await pin('release.json',release);
 const client=new Client({name:'fictional-release-client',version:'1.0.0'}),transport=new StdioClientTransport({command:bridgeCommand,args:bridgeCommand===process.execPath?['--no-env-file',bridge.path]:[bridge.path],env,stderr:'pipe'});await client.connect(transport);
 return {base,pin,bridge,owner,ownerArgs,manifest,release,env,events,client,transport};
}

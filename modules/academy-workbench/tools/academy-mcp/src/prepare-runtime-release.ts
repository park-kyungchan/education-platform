import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {artifactPinSchema,verifyEndpointManifest} from './runtime-identity.ts';
import {readPinnedLocalBytes} from './item-label-store.ts';
import {ownerAdmissionSchema} from './owner-admission.ts';

const planSchema=z.object({generation:z.string().regex(/^[A-Za-z0-9._-]{1,64}$/),bridge:artifactPinSchema,
  admission:artifactPinSchema,registry:artifactPinSchema,
  endpoints:z.record(z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),z.object({command:z.string().startsWith('/'),
    prefixArgs:z.array(z.string().max(4096)).max(16).default([]),identity:artifactPinSchema,args:z.array(z.string().max(4096)).max(128)}).strict()),
}).strict();
/** Prepare only. Fresh /tmp output, no registration, upstream launch, discovery,
 * install-pointer switch, authentication, source read or effectful endpoint. */
export async function prepareRuntimeRelease(value:unknown){
  const plan=planSchema.parse(value),hash=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
  for(const ref of [plan.bridge,plan.admission,plan.registry])await readPinnedLocalBytes(ref.path,ref.sha256);
  ownerAdmissionSchema.parse(JSON.parse((await readPinnedLocalBytes(plan.admission.path,plan.admission.sha256)).bytes.toString('utf8')));
  const registry=z.array(z.object({endpoint:z.string(),upstreamName:z.string(),tool:z.object({name:z.string()}).passthrough()}).strict()).max(256).parse(JSON.parse((await readPinnedLocalBytes(plan.registry.path,plan.registry.sha256)).bytes.toString('utf8')));
  if(new Set(registry.map(r=>r.tool.name)).size!==registry.length||registry.some(r=>!Object.hasOwn(plan.endpoints,r.endpoint)))throw Error('release_payload_unqualified');
  const endpoints:Record<string,unknown>={},endpointIdentities:Record<string,z.infer<typeof artifactPinSchema>>={};
  for(const [endpoint,config] of Object.entries(plan.endpoints)){
    const {manifest}=await verifyEndpointManifest(config.identity);
    if(manifest.endpoint!==endpoint||manifest.launchArgumentsSha256!==hash(JSON.stringify(config.args)))throw Error('release_endpoint_identity_mismatch');
    endpoints[endpoint]={command:config.command,args:[...config.prefixArgs,manifest.artifacts.find(a=>a.role==='entry')!.path,'--runtime-identity',config.identity.path,config.identity.sha256,...config.args]};
    endpointIdentities[endpoint]=config.identity;
  }
  const base=await mkdtemp(join(tmpdir(),'academy-release-draft-'));
  const save=async(name:string,value:unknown)=>{const path=join(base,name),bytes=JSON.stringify(value,null,2)+'\n';await writeFile(path,bytes,{mode:0o600,flag:'wx'});return {path,sha256:hash(bytes)};};
  const routing=await save('routing.json',{admissionPath:plan.admission.path,admissionSha256:plan.admission.sha256}),endpointPin=await save('endpoints.json',endpoints);
  const release=await save('release.json',{schemaVersion:'academy.mcp-release/2',generation:plan.generation,bridge:plan.bridge,routing,endpoints:endpointPin,registry:plan.registry,endpointIdentities});
  await save('migration-review.json',{status:'local_draft_not_installed',release,registrationPerformed:false,nativeEndpointsLaunched:false,
    holds:['exact-head independent review','source-owner namespace admission','native installation and client registration authority','fresh client qualification','Muse authentication hold'],
    proposedClients:['Codex','Muse'],proposedCommonBridgeSha256:plan.bridge.sha256,existingSessions:'not_reloaded'});
  return {base,release,status:'local_draft_not_installed'};
}
if(import.meta.main){
  if(process.argv.length!==3)throw Error('release_plan_path_required');
  console.log(JSON.stringify(await prepareRuntimeRelease(JSON.parse(await readFile(resolve(process.argv[2]),'utf8')))));
}

import {createHash} from 'node:crypto';
import {realpath} from 'node:fs/promises';
import {isAbsolute} from 'node:path';
import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/server';
import {readPinnedLocalBytes} from './item-label-store.ts';
import {readOnlyAnnotations} from './contracts.ts';

export const artifactPinSchema=z.object({path:z.string().refine(isAbsolute),sha256:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
export const endpointIdentitySchema=z.object({schemaVersion:z.literal('academy.endpoint-identity/1'),
  endpoint:z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),semanticContractVersion:z.string().regex(/^[A-Za-z0-9._/-]{1,100}$/),
  launchArgumentsSha256:z.string().regex(/^[a-f0-9]{64}$/),
  artifacts:z.array(artifactPinSchema.extend({role:z.enum(['entry','source','policy','admission','config','dependency'])})).min(1).max(128),
}).strict().refine(v=>v.artifacts.filter(a=>a.role==='entry').length===1,'one_endpoint_entry_required');
export async function verifyEndpointManifest(ref:z.infer<typeof artifactPinSchema>){
  const bytes=await readPinnedLocalBytes(ref.path,ref.sha256),manifest=endpointIdentitySchema.parse(JSON.parse(bytes.bytes.toString('utf8')));
  for(const artifact of manifest.artifacts){
    try{await readPinnedLocalBytes(artifact.path,artifact.sha256);}catch{throw Error('release_artifact_mismatch');}
  }
  return {manifest,summary:{status:'qualified' as const,endpoint:manifest.endpoint,semanticContractVersion:manifest.semanticContractVersion,
    manifestSha256:ref.sha256,launchArgumentsSha256:manifest.launchArgumentsSha256,artifacts:manifest.artifacts.map(({role,sha256})=>({role,sha256}))}};
}
export async function runtimeIdentityConfiguration(args:readonly string[]){
  const remainingArgs:string[]=[];let identity:Awaited<ReturnType<typeof verifyEndpointManifest>>|null=null;
  for(let i=0;i<args.length;i++){
    if(args[i]!=='--runtime-identity'){remainingArgs.push(args[i]);continue;}
    if(identity||i+2>=args.length)throw Error('release_endpoint_identity_mismatch');
    identity=await verifyEndpointManifest(artifactPinSchema.parse({path:args[i+1],sha256:args[i+2]}));i+=2;
    const entry=identity.manifest.artifacts.find(a=>a.role==='entry')!;
    if(entry.path!==await realpath(process.argv[1]!))throw Error('release_endpoint_identity_mismatch');
  }
  if(identity){
    if(createHash('sha256').update(JSON.stringify(remainingArgs)).digest('hex')!==identity.manifest.launchArgumentsSha256)throw Error('release_endpoint_identity_mismatch');
    const requirePin=(path:string,digest:string)=>{
      if(!identity!.manifest.artifacts.some(a=>a.path===path&&a.sha256===digest))throw Error('release_endpoint_identity_mismatch');
    };
    const onePair=new Set(['--metadata-admission','--dailyrecord-admission','--dailyrecord-native']);
    const twoPairs=new Set(['--dailyrecord-policy','--dailyrecord-learning']);
    for(let i=0;i<remainingArgs.length;i++){
      if(onePair.has(remainingArgs[i])||twoPairs.has(remainingArgs[i]))requirePin(remainingArgs[i+1],remainingArgs[i+2]);
      if(twoPairs.has(remainingArgs[i]))requirePin(remainingArgs[i+3],remainingArgs[i+4]);
    }
  }
  return {remainingArgs,identity};
}
export function registerRuntimeIdentity(server:McpServer,identity:Awaited<ReturnType<typeof runtimeIdentityConfiguration>>['identity']){
  server.registerTool('academy_endpoint_identity',{title:'Inspect exact owner endpoint build and contract identity',
    description:'Launch-verified artifact digests only. This is release evidence, never namespace authorization or proof of live source freshness.',
    inputSchema:z.object({}).strict(),annotations:readOnlyAnnotations},()=>{
    const structuredContent=identity?.summary??{status:'unqualified',reasonCode:'endpoint_identity_not_configured'};
    return {content:[{type:'text' as const,text:JSON.stringify(structuredContent)}],structuredContent};
  });
}

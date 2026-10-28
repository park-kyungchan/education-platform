import {installStdioDiagnostics,createAcademyStdioTransport} from './stdio-diagnostics.ts';
import {publicReadFailure} from './read-failure.ts';
// Source-owned version of the installed neutral bridge. Failures close per
// request; pinned launch admission supplies DailyRecord routing scope.
import {Server} from '@modelcontextprotocol/server';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {z} from 'zod';
import {dailyRecordGetSchema,dailyRecordGetDescription,readDailyRecordByName} from './dailyrecord-read.ts';
import {ownerAdmissionSchema} from './owner-admission.ts';
import {readPinnedLocalBytes} from './item-label-store.ts';
import {readOnlyAnnotations} from './contracts.ts';
import {dailyRecordScopeSchema,type DailyRecordScope} from './dailyrecord-context.ts';
import {loadRuntimeRelease} from './runtime-release.ts';
const processStartedAt=new Date().toISOString();
const loadedBridgeSha256=createHash('sha256').update(readFileSync(process.argv[1]!)).digest('hex');
const base=process.env.ACADEMY_MCP_INSTALL_DIR??'/root/.local/share/academy-mcp';
// Launch-owned pinned scope only; no caller may provide or widen admission.
const initialRelease=await loadRuntimeRelease(base);
const routing=initialRelease?null:JSON.parse(readFileSync(base+'/routing.json','utf8'));
const admissionBytes=routing?await readPinnedLocalBytes(routing.admissionPath,routing.admissionSha256):null;
const ownerAdmission=initialRelease?.admission??ownerAdmissionSchema.parse(JSON.parse(admissionBytes!.bytes.toString('utf8')));
const readAdmission={sourceNamespace:ownerAdmission.sourceNamespace,teacherId:ownerAdmission.teacherId,
 allowedFrom:ownerAdmission.allowedFrom,allowedThrough:ownerAdmission.allowedThrough,
 ...(ownerAdmission.schemaVersion==='academy.owner-admission/2'?{studentScope:ownerAdmission.studentScope??'configured'}:{})};
const endpoints=initialRelease?.endpoints??JSON.parse(readFileSync(base+'/endpoints.json','utf8'));
const log=base+'/receipts';mkdirSync(log,{recursive:true,mode:0o700});
let tail:Promise<any>=Promise.resolve();
const sha=(x:any)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
async function upstream<T>(endpoint:string,fn:(client:Client)=>Promise<T>,endpointConfig:any=endpoints):Promise<T>{

 const transport=new StdioClientTransport({...endpointConfig[endpoint],stderr:'pipe'});
 const client=new Client({name:'muse-academy-bounded-adapter',version:'1.0.0'});
 try{await client.connect(transport);return await fn(client);}finally{await client.close();await transport.close();}
}
if(process.argv.includes('--discover')){
 const registry:any[]=[];
 for(const endpoint of Object.keys(endpoints)){
  const listed=await upstream(endpoint,c=>c.listTools());
  for(const tool of listed.tools){
   // The neutral route composes both reads in one upstream lifetime/account lock.
   if(tool.name==='academy_dailyrecord_get'||tool.name==='academy_endpoint_identity'||tool.name==='academy_runtime_identity')continue;
   if(endpoint==='saved'&&/^academy_(dailyrecord_|cism_|item_answer_lookup|runtime_read_admission|student_metadata|student_resolve|endpoint_identity|runtime_identity)/.test(tool.name))continue;
   const scopeHint=endpoint==='dailyrecord'?` DailyRecord owner-admitted dates: ${readAdmission.allowedFrom??'unbounded'} through ${readAdmission.allowedThrough??'unbounded'}.`:'';
   registry.push({endpoint,upstreamName:tool.name,tool:{...tool,name:endpoint==='paper2'?'class2_'+tool.name:tool.name,description:tool.description+' '+(endpoint==='saved'?'Preserved evidence only; coverage/freshness is explicit.':'One serialized native read batch; releases the account lock after completion. No saving, printing, sending, automatic retry or credentials in arguments.'+scopeHint)}});
  }
 }
 registry.push({endpoint:'dailyrecord',upstreamName:'academy_dailyrecord_get',tool:{name:'academy_dailyrecord_get',
  title:'Read live DailyRecord by student name (today by default)',description:dailyRecordGetDescription,
  inputSchema:z.toJSONSchema(dailyRecordGetSchema,{io:'input'}),annotations:{...readOnlyAnnotations,openWorldHint:true,idempotentHint:false}}});
 writeFileSync(base+'/registry.json',JSON.stringify(registry,null,2)+'\n',{mode:0o600,flag:'wx'});
 console.log(JSON.stringify({endpoints:Object.keys(endpoints),tools:registry.map(r=>r.tool.name)}));
 process.exit(0);
}
const registry=initialRelease?.registry??JSON.parse(readFileSync(base+'/registry.json','utf8'));
let sawRelease=initialRelease!==null;
async function activeRelease(){
 const release=await loadRuntimeRelease(base);
 if(!release){if(sawRelease)throw Error('release_pointer_missing');return {registry,endpoints,readAdmission,generation:null,identity:{graphQualification:'legacy_graph_incomplete'},endpointIdentities:{} as Record<string,unknown>};}
 sawRelease=true;
 if(release.identity.bridgeSha256!==null&&release.identity.bridgeSha256!==loadedBridgeSha256)throw Error('release_bridge_identity_mismatch');
 return {registry:release.registry,endpoints:release.endpoints,readAdmission:{sourceNamespace:release.admission.sourceNamespace,
  teacherId:release.admission.teacherId,allowedFrom:release.admission.allowedFrom,allowedThrough:release.admission.allowedThrough,
  ...(release.admission.schemaVersion==='academy.owner-admission/2'?{studentScope:release.admission.studentScope??'configured'}:{})},generation:release.generation,identity:release.identity,endpointIdentities:release.endpointIdentities};
}
const handles=new Map<string,{original:string;intake:any;scope:DailyRecordScope;request:string;at:number;releaseIdentity:string}>();
const signature=(x:any)=>JSON.stringify({fields:x.fields?.map((f:any)=>({field:f.field,before:f.before?.state==='known'?{state:'known',value:f.before.value}:{state:'unknown',reasonCode:f.before?.reasonCode},target:f.target})),revision:x.source?.sourceRevision,wire:x.source?.wireDigest});
async function call(req:any){
 const args=structuredClone(req.arguments??{});
 const occurrence=randomUUID();
 let receiptTool=req.name==='academy_runtime_identity'?req.name:'unrecognized_tool';
 let dispatchIssued=false;
 const steps:{tool:string;status:unknown;sourceAvailability:unknown}[]=[];
 const dispatch=()=>{if(dispatchIssued)return;dispatchIssued=true;writeFileSync(log+'/'+occurrence+'-dispatch.json',JSON.stringify({issuedAt:new Date().toISOString(),tool:receiptTool,argumentsSha256:sha(args),automaticRetryAllowed:false,academyWrites:0,parentSends:0})+'\n',{mode:0o600,flag:'wx'});};
 try{
  const active=await activeRelease();
  if(active.registry.some((entry:any)=>entry.tool.name===req.name))receiptTool=req.name;
  dispatch();
  if(req.name==='academy_runtime_identity'){
   z.object({}).strict().parse(args);
   const data={...active.identity,processStartedAt,loadedBridgeSha256,qualification:'release_artifacts_only_live_source_and_existing_clients_unverified'};
   writeFileSync(log+'/'+occurrence+'-result.json',JSON.stringify({completedAt:new Date().toISOString(),tool:receiptTool,status:'identity_observed',resultSha256:sha(data),automaticRetryAllowed:false})+'\n',{mode:0o600,flag:'wx'});
   return {content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data};
  }
  const entry=active.registry.find((r:any)=>r.tool.name===req.name);if(!entry)throw Error('unknown_tool');
  const result:any=await upstream(entry.endpoint,async client=>{
   const expectedIdentity=active.endpointIdentities[entry.endpoint];
   if(expectedIdentity){
    const handshake=await client.callTool({name:'academy_endpoint_identity',arguments:{}});
    if(handshake.isError||JSON.stringify(handshake.structuredContent)!==JSON.stringify(expectedIdentity))throw Error('release_endpoint_identity_mismatch');
   }
   if(active.generation!==null && entry.endpoint==='dailyrecord'){
    const handshake=await client.callTool({name:'academy_runtime_read_admission',arguments:{}});
    const summary=handshake.structuredContent as Record<string,unknown>|undefined;
    if(handshake.isError||summary?.status!=='configured'||summary.admissionSha256!==sha(active.readAdmission))
     throw Error('release_upstream_admission_mismatch');
   }
   if(entry.upstreamName==='academy_dailyrecord_get'){
    const invoke=async(name:string,input:unknown)=>{
     const response=await client.callTool({name,arguments:input as Record<string,unknown>});
     if(response.isError||!response.structuredContent)throw Error('dailyrecord_route_upstream_failed_no_retry');
     const data=response.structuredContent as Record<string,unknown>;
     steps.push({tool:name,status:data.status??null,sourceAvailability:data.sourceAvailability??null});
     return data;
    };
    const data=await readDailyRecordByName(args,{resolveStudent:input=>invoke('academy_student_resolve',input),intake:input=>invoke('academy_dailyrecord_intake',input)},active.readAdmission);
    return {content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data};
   }
   if(entry.upstreamName==='academy_dailyrecord_review'&&args.observationHandle){
    const ticket=handles.get(args.observationHandle);
    const scope=dailyRecordScopeSchema.parse(args.context.scope);
    if(!ticket||ticket.releaseIdentity!==sha(active.identity)||Date.now()-ticket.at<0||Date.now()-ticket.at>300000||JSON.stringify(ticket.scope)!==JSON.stringify(scope)||ticket.request!==args.context.currentRequestRef)throw Error('observation_ticket_expired_or_foreign');
    const fresh:any=await client.callTool({name:'academy_dailyrecord_intake',arguments:{context:args.context}});
    if(fresh.isError||!fresh.structuredContent||signature(fresh.structuredContent)!==signature(ticket.intake))throw Error('fresh_before_state_changed_reconcile');
    args.observationHandle=fresh.structuredContent.observationHandle;
    return client.callTool({name:entry.upstreamName,arguments:args});
   }
   return client.callTool({name:entry.upstreamName,arguments:args});
  },active.endpoints);
  if(result.isError)throw Error('dailyrecord_route_upstream_failed_no_retry');
  const after=await activeRelease();
  if(sha(after.identity)!==sha(active.identity))throw Error('release_pointer_changed');
  if(entry.upstreamName==='academy_dailyrecord_intake'&&result.structuredContent?.observationHandle){
   const data=result.structuredContent,original=data.observationHandle,ticket='muse-academy-observation:'+randomUUID();
   handles.set(ticket,{original,intake:structuredClone(data),scope:dailyRecordScopeSchema.parse(args.context.scope),request:args.context.currentRequestRef,at:Date.now(),releaseIdentity:sha(active.identity)});
   if(handles.size>64)handles.delete(handles.keys().next().value!);
   data.observationHandle=ticket;result.content=[{type:'text',text:JSON.stringify(data)}];
  }
  writeFileSync(log+'/'+occurrence+'-result.json',JSON.stringify({completedAt:new Date().toISOString(),tool:receiptTool,isError:!!result.isError,status:result.structuredContent?.status??null,sourceAvailability:result.structuredContent?.sourceAvailability??null,steps,resultSha256:sha(result),academyWrites:0,parentSends:0,automaticRetryAllowed:false})+'\n',{mode:0o600,flag:'wx'});
  return result;
 }catch(error){
  dispatch();
  const failure=publicReadFailure(error,'upstream_failure_reconcile_dispatch'),code=failure.code;
  writeFileSync(log+'/'+occurrence+'-failure.json',JSON.stringify({code,failure,observedAt:new Date().toISOString(),tool:receiptTool,automaticRetryAllowed:false,academyWrites:0,parentSends:0})+'\n',{mode:0o600,flag:'wx'});
  const data={status:'blocked',code,failure,occurrence,automaticRetryAllowed:false,academyWrites:0,parentSends:0};
  return {isError:true,content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data};
 }
}
const server=new Server({name:'muse-academy-runtime',version:'1.0.0'},{capabilities:{tools:{}}});
server.setRequestHandler('tools/list',async()=>{
 try{
 const active=await activeRelease();
 const hint=`DailyRecord owner-admitted dates: ${active.readAdmission.allowedFrom??'unbounded'} through ${active.readAdmission.allowedThrough??'unbounded'}.`;
 const identityTool={name:'academy_runtime_identity',description:'Inspect the active release graph and loaded bridge digest. Legacy graphs are explicitly incomplete. No source reads or namespace authorization.',inputSchema:z.toJSONSchema(z.object({}).strict()),annotations:readOnlyAnnotations};
 return {tools:[identityTool,...active.registry.map((r:any)=>r.endpoint==='dailyrecord'?{...r.tool,description:r.tool.description?.replace(/DailyRecord owner-admitted dates: [^.]+\./,hint)}:r.tool)]};
 }catch(error){throw Error(publicReadFailure(error,'release_discovery_unavailable').code);}
});
server.setRequestHandler('tools/call',async req=>{const pending=tail.then(()=>call(req.params));tail=pending.catch(()=>{});return pending;});
installStdioDiagnostics(server);
await server.connect(createAcademyStdioTransport());

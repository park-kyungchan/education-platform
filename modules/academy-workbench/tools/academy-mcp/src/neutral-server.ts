// Source-owned version of the installed neutral bridge. Failures close per
// request; pinned launch admission supplies DailyRecord routing scope.
import {Server} from '@modelcontextprotocol/server';
import {StdioServerTransport} from '@modelcontextprotocol/server/stdio';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {ListToolsRequestSchema,CallToolRequestSchema} from '@modelcontextprotocol/core';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {z} from 'zod';
import {dailyRecordGetSchema,dailyRecordGetDescription,readDailyRecordByName} from './dailyrecord-read.ts';
import {ownerAdmissionSchema} from './owner-admission.ts';
import {readPinnedLocalBytes} from './item-label-store.ts';
import {readOnlyAnnotations} from './contracts.ts';
const base=process.env.ACADEMY_MCP_INSTALL_DIR??'/root/.local/share/academy-mcp';
// Launch-owned pinned scope only; no caller may provide or widen admission.
const routing=JSON.parse(readFileSync(base+'/routing.json','utf8'));
const admissionBytes=await readPinnedLocalBytes(routing.admissionPath,routing.admissionSha256);
const ownerAdmission=ownerAdmissionSchema.parse(JSON.parse(admissionBytes.bytes.toString('utf8')));
const readAdmission={sourceNamespace:ownerAdmission.sourceNamespace,teacherId:ownerAdmission.teacherId,
 allowedFrom:ownerAdmission.allowedFrom,allowedThrough:ownerAdmission.allowedThrough};
const endpoints=JSON.parse(readFileSync(base+'/endpoints.json','utf8'));
const log=base+'/receipts';mkdirSync(log,{recursive:true,mode:0o700});
let tail:Promise<any>=Promise.resolve();
const sha=(x:any)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
async function upstream<T>(endpoint:string,fn:(client:Client)=>Promise<T>):Promise<T>{

 const transport=new StdioClientTransport({...endpoints[endpoint],stderr:'pipe'});
 const client=new Client({name:'muse-academy-bounded-adapter',version:'1.0.0'});
 try{await client.connect(transport);return await fn(client);}finally{await client.close();await transport.close();}
}
if(process.argv.includes('--discover')){
 const registry:any[]=[];
 for(const endpoint of Object.keys(endpoints)){
  const listed=await upstream(endpoint,c=>c.listTools());
  for(const tool of listed.tools){
   // The neutral route composes both reads in one upstream lifetime/account lock.
   if(tool.name==='academy_dailyrecord_get')continue;
   if(endpoint==='saved'&&/^academy_(dailyrecord_|cism_|item_label_scope|find_item_labels|review_type_questions|student_metadata|student_resolve)/.test(tool.name))continue;
   if(endpoint==='dailyrecord'&&tool.name==='academy_cism_section')continue;
   const scopeHint=endpoint==='dailyrecord'?` DailyRecord owner-admitted dates: ${readAdmission.allowedFrom} through ${readAdmission.allowedThrough}.`:'';
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
const registry=JSON.parse(readFileSync(base+'/registry.json','utf8'));
const handles=new Map<string,{original:string;intake:any;scope:any;request:string;at:number}>();
const signature=(x:any)=>JSON.stringify({fields:x.fields?.map((f:any)=>({field:f.field,before:f.before?.state==='known'?{state:'known',value:f.before.value}:{state:'unknown',reasonCode:f.before?.reasonCode},target:f.target})),revision:x.source?.sourceRevision,wire:x.source?.wireDigest});
async function call(req:any){
 const entry=registry.find((r:any)=>r.tool.name===req.name);if(!entry)throw Error('unknown_tool');
 const occurrence=randomUUID();
 const steps:{tool:string;status:unknown;sourceAvailability:unknown}[]=[];
 writeFileSync(log+'/'+occurrence+'-dispatch.json',JSON.stringify({issuedAt:new Date().toISOString(),tool:req.name,argumentsSha256:sha(req.arguments),automaticRetryAllowed:false,academyWrites:0,parentSends:0})+'\n',{mode:0o600,flag:'wx'});
 try{
  const result:any=await upstream(entry.endpoint,async client=>{
   const args=structuredClone(req.arguments??{});
   if(entry.upstreamName==='academy_dailyrecord_get'){
    const invoke=async(name:string,input:unknown)=>{
     const response=await client.callTool({name,arguments:input as Record<string,unknown>});
     if(response.isError||!response.structuredContent)throw Error('dailyrecord_route_upstream_failed_no_retry');
     const data=response.structuredContent as Record<string,unknown>;
     steps.push({tool:name,status:data.status??null,sourceAvailability:data.sourceAvailability??null});
     return data;
    };
    const data=await readDailyRecordByName(args,{resolveStudent:input=>invoke('academy_student_resolve',input),intake:input=>invoke('academy_dailyrecord_intake',input)},readAdmission);
    return {content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data};
   }
   if(entry.upstreamName==='academy_dailyrecord_review'&&args.observationHandle){
    const ticket=handles.get(args.observationHandle);
    if(!ticket||Date.now()-ticket.at>300000||JSON.stringify(ticket.scope)!==JSON.stringify(args.context.scope)||ticket.request!==args.context.currentRequestRef)throw Error('observation_ticket_expired_or_foreign');
    const fresh:any=await client.callTool({name:'academy_dailyrecord_intake',arguments:{context:args.context}});
    if(fresh.isError||!fresh.structuredContent||signature(fresh.structuredContent)!==signature(ticket.intake))throw Error('fresh_before_state_changed_reconcile');
    args.observationHandle=fresh.structuredContent.observationHandle;
    return client.callTool({name:entry.upstreamName,arguments:args});
   }
   return client.callTool({name:entry.upstreamName,arguments:args});
  });
  if(entry.upstreamName==='academy_dailyrecord_intake'&&result.structuredContent?.observationHandle){
   const data=result.structuredContent,original=data.observationHandle,ticket='muse-academy-observation:'+randomUUID();
   handles.set(ticket,{original,intake:structuredClone(data),scope:req.arguments.context.scope,request:req.arguments.context.currentRequestRef,at:Date.now()});
   if(handles.size>64)handles.delete(handles.keys().next().value!);
   data.observationHandle=ticket;result.content=[{type:'text',text:JSON.stringify(data)}];
  }
  writeFileSync(log+'/'+occurrence+'-result.json',JSON.stringify({completedAt:new Date().toISOString(),tool:req.name,isError:!!result.isError,status:result.structuredContent?.status??null,sourceAvailability:result.structuredContent?.sourceAvailability??null,steps,resultSha256:sha(result),academyWrites:0,parentSends:0,automaticRetryAllowed:false})+'\n',{mode:0o600,flag:'wx'});
  return result;
 }catch(error){
  const code=error instanceof Error&&/^[a-z0-9_]+$/.test(error.message)?error.message:'upstream_failure_reconcile_dispatch';
  writeFileSync(log+'/'+occurrence+'-failure.json',JSON.stringify({code,observedAt:new Date().toISOString(),tool:req.name,automaticRetryAllowed:false,academyWrites:0,parentSends:0})+'\n',{mode:0o600,flag:'wx'});
  return {isError:true,content:[{type:'text',text:JSON.stringify({status:'blocked',code,occurrence,automaticRetryAllowed:false,academyWrites:0,parentSends:0})}]};
 }
}
const server=new Server({name:'muse-academy-runtime',version:'1.0.0'},{capabilities:{tools:{}}});
server.setRequestHandler('tools/list',async()=>({tools:registry.map((r:any)=>r.tool)}));
server.setRequestHandler('tools/call',async req=>{const pending=tail.then(()=>call(req.params));tail=pending.catch(()=>{});return pending;});
await server.connect(new StdioServerTransport());

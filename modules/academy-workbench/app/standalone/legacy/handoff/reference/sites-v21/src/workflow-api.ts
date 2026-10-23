/** The single typed operation registry serves same-origin HTTP and Site MCP.
 * No app/LMS/network adapter, user action authority, or browser shim lives here. */
import {z} from 'zod';
import {loadWorkflowCatalog,listWorkflowPolicies,WORKFLOW_CATALOG_PIN,type VerifiedWorkflowCatalog} from './workflow-graph/catalog.ts';
import {loadConfirmedMemberships,MEMBERSHIP_SOURCE_PIN,type VerifiedMemberships} from './workflow-graph/membership.ts';
import {buildWorkflowPreparation,WorkflowPreparationRequest} from './workflow-graph/read-model.ts';
import {WORKFLOW_APPROVED_STUDENT_IDS,WORKFLOW_CONTRACT_REFERENCE,WORKFLOW_CONTRACT_SHA256,WORKFLOW_REGISTRY_SHA256,WORKFLOW_ROSTER_BINDING_SHA256,WORKFLOW_SCOPE_MANIFEST_SHA256} from './workflow-pins.ts';
import {hashBytes,type ContextScope} from './gate/runtime-context-gate.ts';
import {WORKFLOW_SCOPE_FIELDS,type WorkflowScope} from './gate/workflow-scope.ts';
import type {ReceiptType} from './gate/governance-model.ts';

const Hash=z.string().regex(/^[a-f0-9]{64}$/);
const Domain=z.enum(['administration','middle_school','elementary_school','teaching_coaching']);
const PolicyIndexArguments=z.strictObject({view:z.literal('policy-index'),domain:Domain.optional(),offset:z.number().int().min(0).max(10000).default(0),limit:z.number().int().min(1).max(20).default(12)});
const PreparationArguments=WorkflowPreparationRequest.extend({view:z.literal('preparation'),expectedMembershipRevision:Hash,expectedRosterRevision:z.string().min(1).max(512)});
export const WorkContextArgumentsSchema=z.discriminatedUnion('view',[PolicyIndexArguments,PreparationArguments]);
export type WorkContextArguments=z.infer<typeof WorkContextArgumentsSchema>;
export type WorkflowPreparation=ReturnType<typeof buildWorkflowPreparation>;
export type WorkflowPolicySummary=ReturnType<typeof listWorkflowPolicies>[number];
export interface WorkContextRevisions {catalogRevision:string;membershipRevision:string;rosterRevision:string;registrySha256:string;}
export interface WorkContextVerification {contextGatePassed:true;fullContractByteHashVerified:true;registryVersion:'1.2.0';contextScopeFingerprint:string;contractCount:number;authenticatedOwnerPrivateDispatch:true;externalSourceQueried:false;liveAdapterConnected:false;studentRecordsChanged:false;nativeWebMcpVerified:false;}
type WorkContextBase={schemaVersion:'academy.work-context/1.0.0';revisions:WorkContextRevisions;verification:WorkContextVerification;};
export type WorkContextPolicyIndexResult=WorkContextBase&{view:'policy-index';policies:WorkflowPolicySummary[];domains:{domain:z.infer<typeof Domain>;label:string;total:number}[];pagination:{offset:number;limit:number;total:number;hasMore:boolean};};
export type WorkContextPreparationResult=WorkContextBase&{view:'preparation';preparation:WorkflowPreparation;unconfirmedRosterStudentCount:number;};
export type WorkContextResult=WorkContextPolicyIndexResult|WorkContextPreparationResult;
export {WORK_CONTEXT_TOOL} from './workflow-operation.ts';
import {WORK_CONTEXT_TOOL} from './workflow-operation.ts';
export const WORK_CONTEXT_OPERATION={name:WORK_CONTEXT_TOOL.name,path:'/api/academy/work-context',tool:WORK_CONTEXT_TOOL,parse:(input:unknown):WorkContextArguments=>WorkContextArgumentsSchema.parse(input)} as const;
type Packed={gzipBase64:string;sha256:string;};
export interface WorkflowWorkerConfig {
 registryText:string;registrySha256:string;contractTexts:Record<string,string>;contractLocators:Record<string,{version:string;pageId:string|null;reference:string}>;
 catalog:Packed;manifest:Packed;membership:Packed;rosterBinding:Packed;rosterRevision:string;rosterSourceSha256:string;policyIds:string[];catalogEntityIds:string[];
}
type Worker={fetch(request:Request):Promise<Response>};
export interface WorkflowHandlerOptions {
 origin:string;fallback:Worker;config:WorkflowWorkerConfig|undefined;authorize:(request:Request)=>Promise<{identitySha256:string}>;
 gate:(scope:ContextScope,stage:string)=>Promise<ReceiptType>;observe?:(stage:string)=>void;
}
export class WorkflowReadError extends Error {constructor(public status:number,public code:string){super(code);}}
const enc=new TextEncoder(),isObject=(v:unknown):v is Record<string,any>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const sameIds=(a:readonly string[],b:readonly string[])=>JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Vary':'Cookie, Authorization, OAI-Sites-Authorization'}});
const rpcError=(id:unknown,code:number,message:string,status=200)=>json({jsonrpc:'2.0',id:id??null,error:{code,message}},status);
function safeError(error:unknown){if(error instanceof WorkflowReadError)return error;if(isObject(error)&&[401,403].includes(error.status))return {status:error.status,code:typeof error.code==='string'?error.code:'authenticated_owner_required'};return {status:503,code:'protected_workflow_read_unavailable'};}

export function createWorkflowReadHandler(options:WorkflowHandlerOptions):Worker {
 let verifiedCatalog:VerifiedWorkflowCatalog|undefined,verifiedMemberships:VerifiedMemberships|undefined,rosterBinding:any;
 async function decode(packed:Packed,pin:string,stage:string){
  if(packed.sha256!==pin)throw new Error('workflow_source_pin_mismatch');
  options.observe?.(stage);
  const compressed=Uint8Array.from(atob(packed.gzipBase64),c=>c.charCodeAt(0));
  const bytes=new Uint8Array(await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  if(await hashBytes(bytes)!==pin)throw new Error('workflow_source_hash_mismatch');
  return bytes;
 }
 async function assertConfig(c:WorkflowWorkerConfig){
  if(await hashBytes(enc.encode(JSON.stringify({policyIds:c.policyIds,catalogEntityIds:c.catalogEntityIds,rosterRevision:c.rosterRevision,rosterSourceSha256:c.rosterSourceSha256})))!==WORKFLOW_SCOPE_MANIFEST_SHA256)throw Error('workflow_scope_manifest_pin_mismatch');
  if(c.registrySha256!==WORKFLOW_REGISTRY_SHA256||c.catalog.sha256!==WORKFLOW_CATALOG_PIN.catalogSha256||c.manifest.sha256!==WORKFLOW_CATALOG_PIN.manifestSha256||c.membership.sha256!==MEMBERSHIP_SOURCE_PIN.sha256||c.rosterBinding.sha256!==WORKFLOW_ROSTER_BINDING_SHA256)throw Error('workflow_compile_time_pin_mismatch');
  const locator=c.contractLocators['academy.workflow-preparation'];
  if(!locator||locator.pageId!==null||locator.reference!==WORKFLOW_CONTRACT_REFERENCE||locator.version!=='1.0.0'||!c.contractTexts['academy.workflow-preparation'])throw Error('workflow_contract_locator_mismatch');
  if(c.policyIds.length!==71||new Set(c.policyIds).size!==71||c.policyIds.some(id=>!id||id.includes('*'))||new Set(c.catalogEntityIds).size!==c.catalogEntityIds.length||c.catalogEntityIds.some(id=>!id||id.includes('*')))throw Error('workflow_catalog_scope_invalid');
 }
 async function scopedGate(c:WorkflowWorkerConfig,identity:string,s:WorkflowScope,stage:string){
  if(s.policyIds.some(id=>!c.policyIds.includes(id))||s.nodeIds.some(id=>!c.catalogEntityIds.includes(id))||s.studentIds.some(id=>!(WORKFLOW_APPROVED_STUDENT_IDS as readonly string[]).includes(id)))throw new WorkflowReadError(403,'entity_outside_workflow_scope');
  const scope:ContextScope={selectedStudentId:null,allowedEntityIds:[...new Set([...s.studentIds,...s.policyIds,...s.nodeIds])],fields:[...WORKFLOW_SCOPE_FIELDS[s.phase]],sourceIds:[c.catalog.sha256,c.manifest.sha256,...(s.phase==='policy-index'?[]:[c.membership.sha256,c.rosterBinding.sha256])],sourceRevisions:{registry:c.registrySha256,catalog:c.catalog.sha256,manifest:c.manifest.sha256,membership:c.membership.sha256,rosterBinding:c.rosterBinding.sha256,roster:c.rosterSourceSha256,workflowContract:WORKFLOW_CONTRACT_SHA256,authenticatedVisitor:identity},window:JSON.stringify(s),rosterRevision:c.rosterRevision,purpose:'teacher_private_workflow_preparation_reference',cohortPreparation:s};
  return options.gate(scope,stage);
 }
 async function catalog(c:WorkflowWorkerConfig){
  if(!verifiedCatalog){const candidate=await loadWorkflowCatalog(await decode(c.catalog,WORKFLOW_CATALOG_PIN.catalogSha256,'workflow_catalog_decode'),await decode(c.manifest,WORKFLOW_CATALOG_PIN.manifestSha256,'workflow_manifest_decode'));const ids=listWorkflowPolicies(candidate).map(p=>p.policyId);if(!sameIds(ids,c.policyIds))throw Error('workflow_policy_scope_mismatch');verifiedCatalog=candidate;}
  return verifiedCatalog;
 }
 async function members(c:WorkflowWorkerConfig){
  if(!verifiedMemberships){
   const raw=await decode(c.rosterBinding,WORKFLOW_ROSTER_BINDING_SHA256,'workflow_roster_binding_decode');rosterBinding=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));
   if(!sameIds(rosterBinding.students.map((s:any)=>s.id),WORKFLOW_APPROVED_STUDENT_IDS)||rosterBinding.rosterRevision!==c.rosterRevision||rosterBinding.rosterSourceSha256!==c.rosterSourceSha256||!Number.isSafeInteger(rosterBinding.unconfirmedRosterStudentCount)||rosterBinding.unconfirmedRosterStudentCount<0)throw Error('workflow_membership_roster_scope_mismatch');
   verifiedMemberships=await loadConfirmedMemberships(await decode(c.membership,MEMBERSHIP_SOURCE_PIN.sha256,'workflow_membership_decode'),rosterBinding.students,{rosterRevision:c.rosterRevision,rosterSourceSha256:c.rosterSourceSha256});
  }return verifiedMemberships;
 }
 const revisions=(c:WorkflowWorkerConfig):WorkContextRevisions=>({catalogRevision:c.catalog.sha256,membershipRevision:c.membership.sha256,rosterRevision:c.rosterRevision,registrySha256:c.registrySha256});
 const verification=(receipt:ReceiptType):WorkContextVerification=>({contextGatePassed:true,fullContractByteHashVerified:true,registryVersion:'1.2.0',contextScopeFingerprint:receipt.scopeFingerprint,contractCount:receipt.observations.length,authenticatedOwnerPrivateDispatch:true,externalSourceQueried:false,liveAdapterConnected:false,studentRecordsChanged:false,nativeWebMcpVerified:false});
 async function read(request:Request,args:WorkContextArguments):Promise<WorkContextResult>{
  const visitor=await options.authorize(request),c=options.config;if(!c)throw new WorkflowReadError(503,'workflow_read_not_configured');await assertConfig(c);
  if(args.view==='policy-index'){
   const scope:WorkflowScope={phase:'policy-index',date:null,session:null,policyIds:[],studentIds:[],nodeIds:c.policyIds,domain:args.domain??null,offset:args.offset,limit:args.limit};
   const receipt=await scopedGate(c,visitor.identitySha256,scope,'workflow_contracts_and_index_scope_verified');
   const policies=listWorkflowPolicies(await catalog(c)),labels={administration:'학원 운영',middle_school:'중등부',elementary_school:'초등부',teaching_coaching:'수업·코칭'};
   const selected=policies.filter(p=>!args.domain||p.domain===args.domain);
   return {schemaVersion:'academy.work-context/1.0.0',view:'policy-index',revisions:revisions(c),policies:selected.slice(args.offset,args.offset+args.limit),domains:Domain.options.map(domain=>({domain,label:labels[domain],total:policies.filter(p=>p.domain===domain).length})),pagination:{offset:args.offset,limit:args.limit,total:selected.length,hasMore:args.offset+args.limit<selected.length},verification:verification(receipt)};
  }
  if(args.expectedCatalogRevision!==c.catalog.sha256||args.expectedMembershipRevision!==c.membership.sha256||args.expectedRosterRevision!==c.rosterRevision)throw new WorkflowReadError(409,'workflow_revision_changed_reload_required');
  if(new Set(args.policyIds).size!==args.policyIds.length||args.policyIds.some(id=>id.includes('*')||!c.policyIds.includes(id)))throw new WorkflowReadError(403,'policy_outside_workflow_scope');
  const sourceScope:WorkflowScope={phase:'source-binding',date:args.date,session:args.session,policyIds:args.policyIds,studentIds:[...WORKFLOW_APPROVED_STUDENT_IDS],nodeIds:[],domain:null,offset:null,limit:null};
  await scopedGate(c,visitor.identitySha256,sourceScope,'workflow_contracts_and_source_scope_verified');
  const preparation=buildWorkflowPreparation(await catalog(c),await members(c),{date:args.date,session:args.session,policyIds:args.policyIds,expectedCatalogRevision:args.expectedCatalogRevision});
  const finalScope:WorkflowScope={...sourceScope,phase:'preparation',studentIds:[...new Set([...preparation.dateCohorts.cohorts.flatMap(cohort=>cohort.members.map(member=>member.studentId)),...preparation.dateCohorts.unverified.map(member=>member.studentId)])],nodeIds:[...new Set([...preparation.workflowTemplate.nodes,...preparation.workflowTemplate.relations,...preparation.workflowTemplate.sources,...preparation.workflowTemplate.investigations].map(entity=>entity.id))]};
  const receipt=await scopedGate(c,visitor.identitySha256,finalScope,'workflow_selected_scope_gate_passed');
  const result:WorkContextPreparationResult={schemaVersion:'academy.work-context/1.0.0',view:'preparation',revisions:revisions(c),preparation,unconfirmedRosterStudentCount:rosterBinding.unconfirmedRosterStudentCount,verification:verification(receipt)};
  if(enc.encode(JSON.stringify(result)).byteLength>524288)throw new WorkflowReadError(413,'workflow_selection_too_large_select_fewer_policies');
  return result;
 }
 return {async fetch(request){
  const url=new URL(request.url),isHttp=url.pathname===WORK_CONTEXT_OPERATION.path,isMcp=url.pathname==='/mcp';
  if(!isHttp&&!isMcp)return options.fallback.fetch(request);
  if(url.origin!==options.origin)return json({status:'untrusted_host'},403);
  if(request.method!=='POST')return json({status:'method_not_allowed'},405);
  const origin=request.headers.get('origin');if((!isMcp&&origin!==options.origin)||(isMcp&&origin!==null&&origin!==options.origin)||request.headers.get('sec-fetch-site')==='cross-site')return json({status:'same_origin_required'},403);
  if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')return json({status:'application_json_required'},415);
  if(Number(request.headers.get('content-length'))>8192)return json({status:'request_too_large'},413);
  let raw:string;try{raw=await request.clone().text();}catch{return json({status:'invalid_request'},400);}if(raw.length>8192)return json({status:'request_too_large'},413);
  let input:any;try{input=JSON.parse(raw);}catch{return isMcp?rpcError(null,-32700,'Parse error',400):json({status:'invalid_request'},400);}
  if(isHttp){let args:WorkContextArguments;try{args=WORK_CONTEXT_OPERATION.parse(input);}catch{return json({status:'invalid_workflow_arguments'},400);}try{return json({status:'success',result:await read(request,args)});}catch(error){const e=safeError(error);return json({status:e.code},e.status);}}
  // Existing three MCP operations and all their envelope semantics are delegated
  // unchanged. Discovery appends one public, data-free descriptor only.
  if(input?.method==='tools/list'){
   const response=await options.fallback.fetch(request);if(!response.ok)return response;let payload:any;try{payload=await response.json();}catch{return response;}if(!payload?.result?.tools)return json(payload,response.status);payload.result.tools.push(WORK_CONTEXT_OPERATION.tool);return json(payload,response.status);
  }
  if(input?.method!=='tools/call'||input?.params?.name!==WORK_CONTEXT_OPERATION.name)return options.fallback.fetch(request);
  if(!isObject(input)||input.jsonrpc!=='2.0'||!Object.hasOwn(input,'id')||Object.keys(input).some(k=>!['jsonrpc','id','method','params'].includes(k))||!(typeof input.id==='string'||typeof input.id==='number'&&Number.isSafeInteger(input.id))||!isObject(input.params))return rpcError(null,-32600,'Invalid Request',400);
  if(Object.keys(input.params).some(k=>!['name','arguments','_meta'].includes(k)))return rpcError(input.id,-32602,'Invalid tool parameters');
  let args:WorkContextArguments;try{args=WORK_CONTEXT_OPERATION.parse(input.params.arguments??{});}catch{return rpcError(input.id,-32602,'Invalid tool arguments');}
  try{const result=await read(request,args);return json({jsonrpc:'2.0',id:input.id,result:{content:[{type:'text',text:JSON.stringify(result)}],structuredContent:result,isError:false}});}catch(error){const e=safeError(error);if([401,403].includes(e.status))return rpcError(input.id,-32001,e.code,e.status);return json({jsonrpc:'2.0',id:input.id,result:{content:[{type:'text',text:e.code}],isError:true}});}
 }};
}

/** Fixed fictional native fixture producer. Templates describe requests, never
 * expected rows or proof. All bindings are actual API results held in RAM. */
import {createHash} from 'node:crypto';
import type {SQL} from 'bun';
import {canonicalJson} from '../src/learning/model';
import {readFileSync,writeFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {assertFixedRunner,loadFixedRunnerInvocation,writeExclusivePrivateJson,validateDependencyWriterSchedule,dependencyStoreOperation,type DependencyWriterCase,type FixedRunnerInvocation} from './native_foundations_qualification';
import {TeacherAuthStore,type CoordinatedIdentityCustody} from '../src/academy/teacherAuthStore';
import type {PostgresAcademyStore} from '../src/academy/postgresStore';
import type {LoginIdentity} from '../src/academy/server';
import {readCookie,verifyTeacherSession} from '../src/academy/auth';
import {PrerequisiteApplication} from '../src/academy/prerequisiteApplication';
import type {TrustedTeacherContext} from '../src/academy/application';
import type {TeacherPrerequisiteStore} from '../src/academy/ports/teacherStore';
import {approvalRefusalPrecedence,commandBinding,validateEvidence,validateRequest,type AdmissionCommand,type EvidenceRef,type ObjectRef,type RequestBinding} from '../src/academy/contracts/prerequisiteRecords';
import {nativeProposalTexts,type ProposalSources} from '../src/academy/nativeCompleteness';

export type NativeMemory=Record<string,unknown>;
interface OperationTemplate {id:string;phase:string;transport:string;body?:unknown;api?:string;arguments?:unknown[];expectedOutcome?:string;capture?:string}
const ORIGIN='http://127.0.0.1:38743';
export const sha256=(v:Uint8Array|string)=>createHash('sha256').update(v).digest('hex');
export function memoryGet(memory:NativeMemory,path:string):unknown {
 const prefix=Object.keys(memory).filter(k=>path===k||path.startsWith(k+'.')).sort((a,b)=>b.length-a.length)[0];
 if(!prefix)throw Error('actual_native_binding_required');
 let value:unknown=memory[prefix];
 for(const key of path.slice(prefix.length).split('.').filter(Boolean)){
  if(['__proto__','prototype','constructor'].includes(key)||!value||typeof value!=='object'||!Object.hasOwn(value,key))throw Error('actual_native_binding_required');
  value=(value as Record<string,unknown>)[key];
 }
 if(value===undefined)throw Error('actual_native_binding_required');return value;
}
export function bindTemplate(value:unknown,memory:NativeMemory):unknown {
 if(Array.isArray(value))return value.map(v=>bindTemplate(v,memory));
 if(value&&typeof value==='object'){
  const object=value as Record<string,unknown>;
  if(Object.keys(object).length===1&&typeof object.$bind==='string')return structuredClone(memoryGet(memory,object.$bind));
  if(Object.keys(object).some(k=>['__proto__','prototype','constructor'].includes(k)))throw Error('invalid_template');
  return Object.fromEntries(Object.entries(object).map(([k,v])=>[k,bindTemplate(v,memory)]));
 }return value;
}
/* B1 accumulated-memory factoring: only values exactly equal to the
 * root.scopeRef anchor are interned to the same closed marker on the
 * private wire; everything else is serialized verbatim. Rehydration
 * restores deep clones of the anchor before any DTO/API/digest use, so
 * the transform is lossless. Caps stay encoded-byte caps: read/write
 * raw length <=16777216 (16 MiB), controller lines <=262144 (driver-checked). */
function scopeAnchor(memory:NativeMemory):Record<string,unknown>|null {
 const anchor=memory['root.scopeRef'];
 if(anchor===undefined)return null;
 if(!anchor||typeof anchor!=='object'||Array.isArray(anchor)||Object.hasOwn(anchor,'$scopeRef'))throw Error('private_scope_anchor_required');
 return anchor as Record<string,unknown>;
}
function checkScopeMarker(value:Record<string,unknown>):boolean {
 if(!Object.hasOwn(value,'$scopeRef'))return false;
 if(Object.keys(value).length!==1||value.$scopeRef!=='root.scopeRef')throw Error('private_scope_marker_required');
 return true;
}
export function factorPrivateMemoryScopes(memory:NativeMemory):NativeMemory {
 const anchor=scopeAnchor(memory);if(!anchor)return {...memory};
 const anchorJson=canonicalJson(anchor);
 const factor=(value:unknown):unknown=>{
  if(Array.isArray(value))return value.map(factor);
  if(value&&typeof value==='object'){
   const record=value as Record<string,unknown>;
   if(checkScopeMarker(record))return record;
   let recordJson:string|null=null;try{recordJson=canonicalJson(record);}catch{recordJson=null;}
   if(recordJson!==null&&recordJson===anchorJson)return {$scopeRef:'root.scopeRef'};
   return Object.fromEntries(Object.entries(record).map(([k,v])=>[k,factor(v)]));
  }return value;
 };
 return Object.fromEntries(Object.entries(memory).map(([k,v])=>[k,k==='root.scopeRef'?v:factor(v)])) as NativeMemory;
}
export function rehydratePrivateMemoryScopes(memory:NativeMemory):NativeMemory {
 const anchor=scopeAnchor(memory);
 const restore=(value:unknown):unknown=>{
  if(Array.isArray(value))return value.map(restore);
  if(value&&typeof value==='object'){
   const record=value as Record<string,unknown>;
   if(checkScopeMarker(record)){if(!anchor)throw Error('private_scope_anchor_required');return structuredClone(anchor);}
   return Object.fromEntries(Object.entries(record).map(([k,v])=>[k,restore(v)]));
  }return value;
 };
 return Object.fromEntries(Object.entries(memory).map(([k,v])=>[k,k==='root.scopeRef'?v:restore(v)])) as NativeMemory;
}
export async function readNativeMemory(i:FixedRunnerInvocation):Promise<NativeMemory> {
 return await i.readMemory();
}
// Families written and read only inside A1-SETUP (writer schedule, approval rounds) or never read;
// later stages and measurement read none of them, so they do not cross the private pipe.
const SETUP_ONLY_MEMORY=['results.','writerResults.','writerClosure.','writerIssuance.','memory.approvalClosure.','native.issuance.','native.rowHistory.','native.refHistory.'];
export function pruneSetupOnlyMemory(memory:NativeMemory):void {for(const k of Object.keys(memory))if(SETUP_ONLY_MEMORY.some(p=>k.startsWith(p)))delete memory[k];}
export function writeNativeMemory(fd:number,memory:NativeMemory):void {const factored=factorPrivateMemoryScopes(memory),raw=Buffer.from(JSON.stringify(factored));
 if(raw.length>16777216){const sizes=new Map<string,number>();for(const [k,v] of Object.entries(factored)){const f=k.split('.').slice(0,2).join('.');sizes.set(f,(sizes.get(f)??0)+Buffer.byteLength(JSON.stringify(v)??''));}
  console.error(JSON.stringify({status:'PRIVATE_PIPE_OVER_CAP',bytes:raw.length,topFamilies:[...sizes].sort((a,b)=>b[1]-a[1]).slice(0,8)}));throw Error('private_pipe_bound');}
 writeFileSync(fd,raw);}
interface NativeHttpOccurrence {readonly id:string;readonly path:string;readonly command:{idempotencyKey:string;occurrenceId:string;processEpoch:string}|null;readonly submittedRequest?:RootSubmittedRequest|null;settled:boolean}
const nativeHttpOccurrences=new WeakMap<FixedRunnerInvocation,NativeHttpOccurrence[]>();
const rootSubmissionSelections=new WeakMap<FixedRunnerInvocation,ReadonlyMap<string,{template:unknown;selection:RootSubmissionFenceSelection}>>();
const rootSubmissionReaders=new WeakMap<FixedRunnerInvocation,Pick<TeacherPrerequisiteStore,'teacherBindingByActor'>>();
export async function nativePost(i:FixedRunnerInvocation,path:string,body:unknown,cookie:string|null):Promise<{status:number;body:Record<string,unknown>;cookie:string|null;digest:string}> {
 if(i.config.kind!=='FIXTURE'&&i.config.kind!=='MEASURE')throw Error('verified_fixed_runner_required');assertFixedRunner(i,i.config.kind);
 if(!['/api/setup-session','/api/setup-user','/api/login','/api/native-prerequisite','/api/native-read-snapshot','/api/typed-read','/api/native-prereq/teachers/update'].includes(path))throw Error('fixed_native_http_path_required');
 const wire=compileWireCommand(i,body);
 const c=i.config.base,value=wire&&typeof wire==='object'?wire as Record<string,unknown>:{},input=value.input&&typeof value.input==='object'?value.input as Record<string,unknown>:value;
 const command=input.command&&typeof input.command==='object'?input.command as Record<string,unknown>:null;
 const binding=value.operation!=='previewApprovalClosure'&&command&&['idempotencyKey','occurrenceId','processEpoch'].every(k=>typeof command[k]==='string')?{idempotencyKey:String(command.idempotencyKey),occurrenceId:String(command.occurrenceId),processEpoch:String(command.processEpoch)}:null;
 let submittedRequest:RootSubmittedRequest|null=null;
 const selected=command&&rootSubmissionSelections.get(i)?.get(String(command.idempotencyKey));
 if(binding&&selected){
  const live=liveCommandFacts(i,currentAuthenticationRevision(i));
  const expected=compileIngressCommand(selected.template,binding.idempotencyKey,live,rootScopeByInvocation.get(i));
  if(canonicalJson(expected)!==canonicalJson(command))throw Error('root_selected_submission_required');
  const auth=new TeacherAuthStore(c.authFile).readExistingIdentity();
  const raw=cookie?readCookie(cookie,'dc_teacher'):null,session=raw?verifyTeacherSession(auth.sessionKey,raw):null;
  const reader=rootSubmissionReaders.get(i);
  if(session&&auth.identity&&session.ownerId===c.ownerId&&session.actorId===auth.identity.actorId&&reader){
   const operation=path==='/api/native-prereq/teachers/update'?((input.payload as {state?:unknown})?.state==='RETIRED'?'retireTeacher':'updateTeacher'):String(value.operation);
   submittedRequest=await captureRootSubmittedRequest(selected.selection,selected.template,operation,input,{ownerId:session.ownerId,actorId:session.actorId,role:'teacher'},reader);
  }
 }
 const occurrence:NativeHttpOccurrence={id:crypto.randomUUID(),path,command:binding,submittedRequest,settled:false};
 const ledger=nativeHttpOccurrences.get(i)??[];if(ledger.length>=10000)throw Error('native_http_occurrence_budget');ledger.push(occurrence);nativeHttpOccurrences.set(i,ledger);
 const metadata={schema:'fixed-native-http-occurrence.v1',id:occurrence.id,path,requestId:typeof value.requestId==='string'?value.requestId:null,command:binding,stage:i.config.stage,runId:c.runId,ownerId:c.ownerId,occurrenceId:c.occurrenceId,pid:process.pid,startTicks:c.executor.startTicks,sourceSetSha256:c.sourceSet.sha256,automaticRetry:false};
 i.assertCurrent();writeExclusivePrivateJson(join(c.metadataDirectory,'http-'+occurrence.id+'-started.json'),{...metadata,status:'DISPATCH_NEXT_NOT_OUTCOME_PROOF'});
 try{
  const response=await fetch(ORIGIN+path,{method:'POST',redirect:'error',headers:{Origin:ORIGIN,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(wire),signal:AbortSignal.timeout(300000)});
  const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>1048576)throw Error('root_output_bound');
  const result:unknown=bytes.length===0&&response.status===503?{}:JSON.parse(bytes.toString('utf8'));if(!result||typeof result!=='object'||Array.isArray(result))throw Error('native_object_response_required');
  const digest=sha256(bytes);i.assertCurrent();
  writeExclusivePrivateJson(join(c.metadataDirectory,'http-'+occurrence.id+'-finished.json'),{...metadata,status:'RESPONSE_OBSERVED',httpStatus:response.status,responseBytes:bytes.length,responseSha256:digest,delivery:'RESPONSE_RECEIVED_NOT_BUSINESS_ACK'});
  occurrence.settled=true;
  return {status:response.status,body:result as Record<string,unknown>,cookie:response.headers.get('set-cookie')?.split(';')[0]??null,digest};
 }catch{
  // Abort/timeout/lost or malformed reply cannot establish the target's effect.
  // Retain exact start/unknown receipts; never resubmit, finalize or infer zero.
  writeExclusivePrivateJson(join(c.metadataDirectory,'http-'+occurrence.id+'-unknown.json'),{...metadata,status:'OUTCOME_UNKNOWN_RECONCILE_EXACT_OCCURRENCE',replay:false});
  throw Error('native_http_outcome_unknown_reconcile_no_replay');
 }
}

/** Shape/binding check only: this never supplies a native Root permission. */
export function validateRootCommandFence(value:unknown,request:RequestBinding):{request:RequestBinding;fenceOccurrenceId:string;reason:'ABORT'} {
 validateRequest(request);
 const fence=value as {schema:string;requestBindingSha256:string;fenceOccurrenceId:string;reason:'ABORT'};
 if(!fence||typeof fence!=='object'||Array.isArray(fence)||Object.keys(fence).sort().join(',')!=='fenceOccurrenceId,reason,requestBindingSha256,schema'||fence.schema!=='root-exact-command-fence.v1'||fence.requestBindingSha256!==sha256(canonicalJson(request))||typeof fence.fenceOccurrenceId!=='string'||!fence.fenceOccurrenceId||fence.fenceOccurrenceId===request.occurrenceId||fence.reason!=='ABORT')throw Error('separate_root_fence_occurrence_required');
 return {request,fenceOccurrenceId:fence.fenceOccurrenceId,reason:fence.reason};
}

/* Private Root caller binding compiler. Root supplies closed templates in
 * ingress.* / root.storeKeys.* memory slots. Fields that only exist live
 * (current auth hash, live helper incarnation, owner/interface digests of
 * verified runner facts) are bound mechanically at consumption, on a wire
 * clone. Memory templates are never mutated, so a preview target and its
 * future consume target stay the exact shared object. Anything unresolved,
 * malformed, stale or outside the finite catalogue fails before HTTP. */
export const LATE_BIND_FIELDS=Object.freeze(['authenticationRevision','processEpoch','nativeOwnerBinding','nativeInterfaceBinding'] as const);
export interface LiveCommandFacts {readonly authenticationRevision:string;readonly processEpoch:string;readonly nativeOwnerBinding:string;readonly nativeInterfaceBinding:string}
const SHA256_TEXT=/^[a-f0-9]{64}$/;
export function currentAuthenticationRevision(i:FixedRunnerInvocation):string {
 /* Hash only; credential bytes are never logged or returned. */
 return sha256(readFileSync(i.config.base.authFile));
}
export function liveCommandFacts(i:FixedRunnerInvocation,authenticationRevision:string):LiveCommandFacts {
 const helper=i.config.liveHelper;if(!helper)throw Error('live_helper_binding_required');
 const base=i.config.base;
 return {authenticationRevision,processEpoch:`helper:${helper.pid}:${helper.startTicks}`,
  nativeOwnerBinding:sha256(canonicalJson({ownerId:base.ownerId,runId:base.runId,occurrenceId:base.occurrenceId,authSha256:base.authSha256})),
  nativeInterfaceBinding:sha256(canonicalJson({serviceInstanceRef:base.serviceInstanceRef,consumerProfile:base.consumerProfile,sourceSetSha256:base.sourceSet.sha256,liveHelper:helper}))};
}
/* Finite catalogue: explicit slots/lists only (44 writers, C07 P01..P100); no patterns. Scope digests are adopted prerequisiteRecords values. */
export interface CatalogueEntry {readonly slot:string;readonly kind:string;readonly operation:string;readonly action:{name:string;version:string;definitionSha256:string};readonly intent:string}
/* B3: pinned Root definitions/slots; digests recomputed, no fallback. */
const ROOT_CALLER_EVIDENCE_ROOT='/home/palantirkc/operations/platform-redesign-20261023T1807Z';
export const ROOT_CALLER_DEFINITIONS_PIN=Object.freeze({path:'reports/p4-p5-execution/lead-workflow-improvement-20261025/e10-root-private-caller-definitions.v2.json',sha256:'a19e7892b1bfd5c98db35d0d438e58321077487f5e95e8c488eb293a9eb1ad71',bytes:26942});
export const ROOT_CALLER_SLOTS_PIN=Object.freeze({path:'reports/p4-p5-execution/claude-takeover-20261027/gen98/candidate/bindings/root-private-caller-slots.v2.json',sha256:'4a8a317f54cd32ccdef67614db05c3dd7b6ebec9464f1bd58ba35d9274f0aa52',bytes:34142});
export interface RootCallerActionDefinition {readonly name:string;readonly version:string;readonly definitionSha256:string}
export interface RootCallerRegistry {readonly actionsByOperation:ReadonlyMap<string,RootCallerActionDefinition>;readonly planDefinitionSha256:string;readonly intentDomain:string;readonly slots:readonly (readonly [string,string,string])[]}
let rootCallerRegistryCache:RootCallerRegistry|null=null;
function readPinnedJson(pin:{path:string;sha256:string;bytes:number}):Record<string,unknown> {const raw=readFileSync(join(ROOT_CALLER_EVIDENCE_ROOT,pin.path));if(raw.length!==pin.bytes||sha256(raw)!==pin.sha256)throw Error('root_private_caller_pin_required');const value:unknown=JSON.parse(raw.toString('utf8'));if(!value||typeof value!=='object'||Array.isArray(value))throw Error('root_private_caller_pin_required');return value as Record<string,unknown>;}
export function rootPrivateCallerRegistry():RootCallerRegistry {
 if(rootCallerRegistryCache)return rootCallerRegistryCache;
 const defs=readPinnedJson(ROOT_CALLER_DEFINITIONS_PIN),slotsDoc=readPinnedJson(ROOT_CALLER_SLOTS_PIN);
 const byName=new Map<string,RootCallerActionDefinition>(),byOperation=new Map<string,RootCallerActionDefinition>();
 for(const entry of defs.actionDefinitions as {name:string;version:string;definition:Record<string,unknown>;sha256:string}[]){const definitionSha256=sha256(canonicalJson(entry.definition));if(definitionSha256!==entry.sha256||entry.definition.name!==entry.name||entry.definition.version!==entry.version)throw Error('root_private_caller_definition_digest_required');byName.set(entry.name,{name:entry.name,version:entry.version,definitionSha256});}
 for(const [operation,actionName] of Object.entries(defs.operationToAction as Record<string,string>)){const found=byName.get(actionName);if(!found||byOperation.has(operation))throw Error('root_private_caller_definition_required');byOperation.set(operation,found);}
 const planDefinitionSha256=sha256(canonicalJson(defs.planDefinition));if(planDefinitionSha256!==defs.planDefinitionSha256)throw Error('root_private_caller_definition_digest_required');
 const slots=(slotsDoc.slots as unknown[]).map(row=>{if(!Array.isArray(row)||row.length!==3||row.some(v=>typeof v!=='string'))throw Error('root_private_caller_slot_catalogue_required');return row as unknown as readonly [string,string,string];});
 rootCallerRegistryCache={actionsByOperation:byOperation,planDefinitionSha256,intentDomain:(defs.intentModel as {domain:string}).domain,slots};return rootCallerRegistryCache;
}
/** Wrapper plus defining-object digest. */
export function registryAction(operation:string):{name:string;version:string;definitionSha256:string} {const found=rootPrivateCallerRegistry().actionsByOperation.get(operation);if(!found)throw Error('root_private_caller_definition_required');return {name:found.name,version:found.version,definitionSha256:found.definitionSha256};}
function templateAction(operation:string):{name:string;version:string;definitionSha256:string} {return registryAction(operation);}
function templateIntent(slot:string,operation:string,actionDefinitionSha256:string|null=null):string {const registry=rootPrivateCallerRegistry();return sha256(canonicalJson({domain:registry.intentDomain,slot,operation,actionDefinitionSha256,planDefinitionSha256:registry.planDefinitionSha256}));}
/* B1: scope travels once as root.scopeRef; marker resolved at wire. */
export function isRootScopeRefMarker(value:unknown):boolean {return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===1&&(value as Record<string,unknown>).$scopeRef==='root.scopeRef';}
const rootScopeByInvocation=new WeakMap<FixedRunnerInvocation,unknown>();
export function bindRootScopeRef(i:FixedRunnerInvocation,memory:NativeMemory):unknown {const scope=memory['root.scopeRef'];if(!scope||typeof scope!=='object'||Array.isArray(scope)||isRootScopeRefMarker(scope))throw Error('actual_native_binding_required');rootScopeByInvocation.set(i,structuredClone(scope));return scope;}
// Encoded-byte cap: measure the factored private-wire form that writeNativeMemory sends, not the rehydrated copy.
export function privateMemoryBytes(memory:NativeMemory):number {return Buffer.byteLength(JSON.stringify(factorPrivateMemoryScopes(memory)),'utf8');}
function baselinePairs():readonly (readonly [string,string])[] {const seen=new Map<string,string>();for(const op of baselineOperations){const operation=(op.body as {operation?:string}|undefined)?.operation??op.api??'AUTH_FLOW';const slot=op.id==='approval-preview-B'||op.id==='approval-consume-B'?'futureApproveTarget':op.id==='negative-approval-preview'||op.id==='negative-approval-consume'?'changedDependencyTarget':op.id;if(!seen.has(slot))seen.set(slot,operation);}return [...seen.entries()];}
const F1_FACADE:Record<string,string>={appendTeacher:'updateTeacher',appendClassGroup:'createClassGroup',appendLesson:'createLessonSession',appendTemporalBinding:'upsertTemporalBinding',appendActivityScope:'attachActivityScope',appendStudentRevision:'attachStudentRevision',createProgress:'createProgress',correctProgress:'correctProgress',createAssessment:'createAssessment',correctAssessment:'correctAssessment',createDraft:'createDraft',correctDraft:'updateDraft',appendScoreEvidence:'recordScoreEvidence',issueApproval:'issueApproval',consumeApproval:'approveDraft',revokeApproval:'revokeApproval'};
function buildCatalogue():ReadonlyMap<string,CatalogueEntry> {
 const map=new Map<string,CatalogueEntry>();
 const add=(slot:string,kind:string,operation:string)=>{if(map.has(slot))return;const http=kind==='HTTP';const action=http?templateAction(operation):null;const intent=templateIntent(slot,operation,action?action.definitionSha256:null);map.set(slot,{slot,kind,operation,action:action??{name:operation,version:'1.0.0',definitionSha256:intent},intent});};
 for(const [slot,operation] of baselinePairs())add(slot,operation==='AUTH_FLOW'?'AUTH_FLOW':operation.startsWith('PostgresAcademyStore')?'DIRECT':'HTTP',operation);
 for(const s of ['rating-minus1','rating-ten']){add(s,'DIRECT','PostgresAcademyStore.append');add('scope-'+s,'HTTP','attachActivityScope');}
 for(const lv of ['major','middle','minor']){add('g3-'+lv,'HTTP','createProgress');add('scope-g3-'+lv,'HTTP','attachActivityScope');}
 for(const s of ['carryover-one','carryover-two'])add(s,'DIRECT','PostgresAcademyStore.append');
 add('W-C07-STUDENT','HTTP','attachStudentRevision');add('W-C07-CLASS','HTTP','createClassGroup');add('W-C07-LESSON','HTTP','createLessonSession');
 for(const s of ['W-C07-ENROLL','W-C07-MEMBER','W-C07-TEACH','W-C07-PARTICIPATE'])add(s,'HTTP','upsertTemporalBinding');
 for(let n=1;n<=100;n++){const s='W-C07-P'+String(n).padStart(2,'0');add(s,'HTTP','createProgress');add(s+'-SCOPE','HTTP','attachActivityScope');}
 const writers:string[]=[];
 for(const op of Object.keys(F1_FACADE))for(const d of ['C','R'])writers.push('W-F1-'+op+'-'+d);
 writers.push('W-F2-C','W-F2-R','W-F3-append-C','W-F3-append-R','W-F4-saveCatalog-C','W-F4-saveCatalog-R');
 for(const op of ['ADMIT','FINALIZE','GENERIC-CLEANUP'])for(const d of ['C','R'])writers.push('W-F6-'+op+'-'+d);
 for(const wid of writers){
  if(wid.startsWith('W-F2-'))add(wid,'DIRECT','PostgresAcademyStore.registerStudent');
  else if(wid.startsWith('W-F3-'))add(wid,'DIRECT','PostgresAcademyStore.append');
  else if(wid.startsWith('W-F4-'))add(wid,'DIRECT','PostgresAcademyStore.saveCatalog');
  else if(wid.startsWith('W-F6-'))add(wid,'HTTP',wid.includes('ADMIT')?'admitReadOccurrence':'finalizeReadOccurrence');
  else add(wid,'HTTP',wid==='W-F1-appendActivityScope-R'?'correctActivityScope':F1_FACADE[wid.slice(5,-2)]!);
  add('W-R-'+wid,'READER','typedRead');
 }
 for(const [s,op] of [['restore-progress-scope','correctActivityScope'],['restore-positive-draft','updateDraft'],['restore-preview','previewApprovalClosure'],['restore-issue','issueApproval'],['restore-approve','approveDraft'],['issuer-expired-target','previewApprovalClosure'],['issuer-expired-issue','issueApproval'],['issuer-revoked-target','previewApprovalClosure'],['issuer-revoked-issue','issueApproval'],['issuer-revoke','revokeApproval'],['P-SNAPSHOT','updateStudentRevision'],['P-RETIRE-A','updateTeacher'],['G4-detach','correctActivityScope']] as const)add(s,'HTTP',op);
 for(const s of ['consumeInvitation','registerIdentity'])add(s,'AUTH_LEASE',s);
 add('W-F1-attachAssessmentScope-C','HTTP','attachActivityScope');
 add('participate-lesson-scheduled','HTTP','upsertTemporalBinding');
 for(const d of ['R','C'])add('W-F1-consumeApproval-'+d+'-ISSUE-PRE','HTTP','issueApproval');
 for(const [slot,operation] of baselinePairs())if(operation!=='AUTH_FLOW'&&!operation.startsWith('PostgresAcademyStore'))add('W-TEACHER-REFRESH-'+slot,'HTTP',operation==='attachActivityScope'?'correctActivityScope':operation);
 /* Ground in the exact pinned Root slots file. */
 const pinned=rootPrivateCallerRegistry().slots;
 if(map.size!==pinned.length)throw Error('root_private_caller_slot_catalogue_required');
 for(const [slot,kind,operation] of pinned){const entry=map.get(slot);if(!entry||entry.kind!==kind||entry.operation!==operation)throw Error('root_private_caller_slot_catalogue_required');}
 return map;
}
let catalogueCache:ReadonlyMap<string,CatalogueEntry>|null=null;
export function commandCatalogue():ReadonlyMap<string,CatalogueEntry> {if(!catalogueCache)catalogueCache=buildCatalogue();return catalogueCache;}
export interface RootFiniteBindingFacts {readonly occurrenceId:string;readonly admissionId:string;readonly namespace:string;readonly scopeRef:unknown;readonly sourceObservedAt:string}
/** Shared GO producer. Neither source replay nor the external native assembler
 * keeps a second copy of command bindings, fence selections or partitions. */
export function buildRootFiniteBindings(facts:RootFiniteBindingFacts):NativeMemory {
 const ref=facts.scopeRef as {basis?:{recordRevision?:{value?:{value?:unknown}};source?:{publicLocator?:unknown}}};
 const sourceRevision=ref?.basis?.recordRevision?.value?.value,locator=ref?.basis?.source?.publicLocator;
 if(typeof sourceRevision!=='string'||typeof locator!=='string')throw Error('root_scope_evidence_required');
 const out:NativeMemory={'root.scopeRef':facts.scopeRef,'root.externalScopedRef':structuredClone(facts.scopeRef),'evidence.fixture':{sourceRef:structuredClone(facts.scopeRef),sourceRevision,locator,observedAt:facts.sourceObservedAt},'clock.observedSourceAt':facts.sourceObservedAt};
 for(const entry of commandCatalogue().values()){
  if(entry.kind==='HTTP')out['ingress.'+entry.slot]={idempotencyKey:entry.slot,occurrenceId:facts.occurrenceId,admissionId:facts.admissionId,processEpoch:{$lateBind:'processEpoch'},sourceObservedAt:facts.sourceObservedAt,authenticationRevision:{$lateBind:'authenticationRevision'},namespace:facts.namespace,scopeRef:{$scopeRef:'root.scopeRef'},nativeOwnerBinding:{$lateBind:'nativeOwnerBinding'},nativeInterfaceBinding:{$lateBind:'nativeInterfaceBinding'},action:entry.action,requestIntentDigest:entry.intent};
  else if(entry.kind==='DIRECT')out['root.storeKeys.'+entry.slot]=entry.slot;
 }
 return out;
}
export const rootBindingPartitionSteps=Object.freeze(['AUTH_INIT:A0','START:A0','FIXTURE:A0']);
export function selectRootGoBindings(all:NativeMemory,occurrencePrefix:string,fencePrefix:string):{bindings:NativeMemory;stepBindings:Record<string,NativeMemory>} {
 const selected:NativeMemory={};
 for(const [key,value] of Object.entries(all)){
  if(key.startsWith('ingress.')){const slot=key.slice(8),occurrenceId=occurrencePrefix+'-'+slot;selected[key]={...(value as Record<string,unknown>),occurrenceId};selected['ingress.fenceTemplate-'+occurrenceId]=buildRootSubmissionFenceSelection(selected[key],fencePrefix+'-'+slot,all['root.scopeRef']);}
  else selected[key]=value;
 }
 const partitions:NativeMemory[]=[{}];let used=0;
 for(const [key,value] of Object.entries(selected)){const bytes=Buffer.byteLength(JSON.stringify({[key]:value}));if(used&&used+bytes>120000){partitions.push({});used=0;}partitions.at(-1)![key]=value;used+=bytes;}
 if(partitions.length>4)throw Error('partition_limit');
 return {bindings:partitions[0]!,stepBindings:Object.fromEntries(partitions.slice(1).map((v,n)=>[rootBindingPartitionSteps[n]!,v]))};
}
export function catalogueEntry(id:string):CatalogueEntry {const found=commandCatalogue().get(id);if(!found)throw Error('unselected_command_input');return found;}
export function isFiniteSelectedCommandId(id:string):boolean {return commandCatalogue().has(id);}
export function compileIngressCommand(template:unknown,id:string,live:LiveCommandFacts,rootScopeRef?:unknown):Record<string,unknown> {
 if(!isFiniteSelectedCommandId(id))throw Error('unselected_command_input');
 if(!template||typeof template!=='object'||Array.isArray(template))throw Error('unresolved_command_input');
 const value=template as Record<string,unknown>;
 const keys=['idempotencyKey','occurrenceId','admissionId','processEpoch','sourceObservedAt','authenticationRevision','namespace','scopeRef','nativeOwnerBinding','nativeInterfaceBinding','action','requestIntentDigest'];
 if(Object.keys(value).sort().join(',')!==[...keys].sort().join(','))throw Error('unresolved_command_input');
 if(value.idempotencyKey!==id)throw Error('unresolved_command_input');
 for(const k of ['occurrenceId','admissionId','namespace'])if(typeof value[k]!=='string'||!value[k])throw Error('unresolved_command_input');
 if(typeof value.sourceObservedAt!=='string'||!Number.isFinite(Date.parse(value.sourceObservedAt)))throw Error('unresolved_command_input');
 if(!value.scopeRef||typeof value.scopeRef!=='object'||Array.isArray(value.scopeRef))throw Error('unresolved_command_input');
 let scopeRef:unknown=value.scopeRef;
 if(isRootScopeRefMarker(scopeRef)){
  if(!rootScopeRef||typeof rootScopeRef!=='object'||Array.isArray(rootScopeRef)||isRootScopeRefMarker(rootScopeRef))throw Error('unresolved_command_input');
  scopeRef=structuredClone(rootScopeRef);
 }else if(rootScopeRef!==undefined&&canonicalJson(scopeRef)!==canonicalJson(rootScopeRef))throw Error('unresolved_command_input');
 if(typeof value.requestIntentDigest!=='string'||!SHA256_TEXT.test(value.requestIntentDigest))throw Error('unresolved_command_input');
 const action=value.action as Record<string,unknown>|null;
 if(!action||typeof action!=='object'||Array.isArray(action)||Object.keys(action).sort().join(',')!=='definitionSha256,name,version'||typeof action.name!=='string'||!action.name||typeof action.version!=='string'||!/^\d+\.\d+\.\d+$/.test(action.version)||typeof action.definitionSha256!=='string'||!SHA256_TEXT.test(action.definitionSha256))throw Error('unresolved_command_input');
 const entry=catalogueEntry(id);const act=value.action as Record<string,unknown>;if(act.name!==entry.action.name||act.version!==entry.action.version||act.definitionSha256!==entry.action.definitionSha256||value.requestIntentDigest!==entry.intent)throw Error('wrong_action_binding');
 const out:Record<string,unknown>={...value,scopeRef};
 for(const field of LATE_BIND_FIELDS){
  const slot=value[field] as Record<string,unknown>|string|null;
  const expected=live[field];
  if(typeof slot==='string'){if(slot!==expected)throw Error('stale_command_binding');}
  else if(slot&&typeof slot==='object'&&!Array.isArray(slot)&&Object.keys(slot).length===1&&slot.$lateBind===field)out[field]=expected;
  else throw Error('unresolved_command_input');
 }
 return Object.freeze(out);
}
export function compileWireCommand(i:FixedRunnerInvocation,body:unknown):unknown {
 if(!body||typeof body!=='object'||Array.isArray(body))return body;
 const value=body as Record<string,unknown>;
 const input=value.input;
 if(input&&typeof input==='object'&&!Array.isArray(input)){
  const command=(input as Record<string,unknown>).command;
  if(command&&typeof command==='object'&&!Array.isArray(command)&&typeof (command as Record<string,unknown>).idempotencyKey==='string'){
   const live=liveCommandFacts(i,currentAuthenticationRevision(i));
   return {...value,input:{...(input as Record<string,unknown>),command:compileIngressCommand(command,String((command as Record<string,unknown>).idempotencyKey),live,rootScopeByInvocation.get(i))}};
  }
  return body;
 }
 const top=value.command;
 if(top&&typeof top==='object'&&!Array.isArray(top)&&typeof (top as Record<string,unknown>).idempotencyKey==='string'){
  const live=liveCommandFacts(i,currentAuthenticationRevision(i));
  return {...value,command:compileIngressCommand(top,String((top as Record<string,unknown>).idempotencyKey),live,rootScopeByInvocation.get(i))};
 }
 return body;
}
/* B2: closed fence descriptors; UNKNOWN stops, never replays. */
export function validateFenceBindingValue(key:string,value:unknown):void {
 const suffix=key.startsWith('ingress.fenceTemplate-')?key.slice('ingress.fenceTemplate-'.length):key.slice('ingress.fence-'.length);
 if(!suffix||!value||typeof value!=='object'||Array.isArray(value))throw Error('unresolved_command_input');
 const v=value as Record<string,unknown>;
 if(key.startsWith('ingress.fenceTemplate-')){
  if(v.schema==='root-exact-submission-fence.v1'){validateRootSubmissionFenceSelection(value);return;}
  if(v.schema!=='root-exact-command-fence-admission-template.v1'||v.status!=='ROOT_DECISION_REQUIRED'||typeof v.fenceOccurrenceId!=='string'||!v.fenceOccurrenceId)throw Error('unresolved_command_input');
  const keys=Object.keys(v).sort().join(',');
  if(keys==='fenceOccurrenceId,schema,status')return;
  if(keys!=='automaticRetry,fenceOccurrenceId,reason,requestBindingSha256,schema,status,unknownReplay'||v.reason!=='ABORT'||v.unknownReplay!==false||v.automaticRetry!==false||typeof v.requestBindingSha256!=='string'||!SHA256_TEXT.test(v.requestBindingSha256))throw Error('unresolved_command_input');
  return;
 }
 if(Object.keys(v).sort().join(',')!=='fenceOccurrenceId,reason,requestBindingSha256,schema'||v.schema!=='root-exact-command-fence.v1'||v.reason!=='ABORT'||typeof v.fenceOccurrenceId!=='string'||!v.fenceOccurrenceId||typeof v.requestBindingSha256!=='string'||!SHA256_TEXT.test(v.requestBindingSha256))throw Error('unresolved_command_input');
}
export function validateRootBindingMemory(i:FixedRunnerInvocation,memory:NativeMemory):void {
 const live=liveCommandFacts(i,currentAuthenticationRevision(i));
 const rootScope=Object.hasOwn(memory,'root.scopeRef')?bindRootScopeRef(i,memory):undefined;
 for(const [key,value] of Object.entries(memory)){
  if(key.startsWith('ingress.fence-')||key.startsWith('ingress.fenceTemplate-')){validateFenceBindingValue(key,value);continue;}
  if(key.startsWith('ingress.'))compileIngressCommand(value,key.slice('ingress.'.length),live,rootScope);
  else if(key.startsWith('root.storeKeys.')){
   const id=key.slice('root.storeKeys.'.length);
   if(!isFiniteSelectedCommandId(id)||typeof value!=='string'||value!==id)throw Error('unresolved_command_input');
  }
 }
 const selections=new Map<string,{template:unknown;selection:RootSubmissionFenceSelection}>();
 for(const [key,value] of Object.entries(memory))if(key.startsWith('ingress.')&&!key.startsWith('ingress.fence')){
  const template=value as Record<string,unknown>,selected=memory['ingress.fenceTemplate-'+template.occurrenceId];
  if(selected&&typeof selected==='object'&&(selected as {schema?:unknown}).schema==='root-exact-submission-fence.v1'){
   const selection=validateRootSubmissionFenceSelection(selected);
   if(selection.commandTemplateSha256!==sha256(canonicalJson(template))||selection.fenceOccurrenceId===template.occurrenceId)throw Error('root_selected_submission_required');
   selections.set(key.slice('ingress.'.length),{template:structuredClone(template),selection:Object.freeze({...selection})});
  }
 }
 rootSubmissionSelections.set(i,selections);
 if(privateMemoryBytes(memory)>16777216)throw Error('private_pipe_bound');
}

export interface RootSubmissionFenceSelection {
 readonly schema:'root-exact-submission-fence.v1';readonly status:'ROOT_SELECTED_ABORT_ON_KNOWN_PENDING';
 readonly commandTemplateSha256:string;readonly fenceOccurrenceId:string;readonly reason:'ABORT';
 readonly unknownReplay:false;readonly automaticRetry:false;
}
function validateRootSubmissionFenceSelection(value:unknown):RootSubmissionFenceSelection {
 const v=value as RootSubmissionFenceSelection;
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join(',')!=='automaticRetry,commandTemplateSha256,fenceOccurrenceId,reason,schema,status,unknownReplay'||v.schema!=='root-exact-submission-fence.v1'||v.status!=='ROOT_SELECTED_ABORT_ON_KNOWN_PENDING'||!SHA256_TEXT.test(v.commandTemplateSha256)||typeof v.fenceOccurrenceId!=='string'||!v.fenceOccurrenceId||v.reason!=='ABORT'||v.unknownReplay!==false||v.automaticRetry!==false)throw Error('root_selected_submission_required');
 return v;
}
/** Root GO selects a conditional disposition before any original submission.
 * This differs from ROOT_DECISION_REQUIRED, which remains data without authority. */
export function buildRootSubmissionFenceSelection(template:unknown,fenceOccurrenceId:string,rootScopeRef?:unknown):RootSubmissionFenceSelection {
 const command=template as {occurrenceId?:unknown;scopeRef?:unknown};
 if(!command||typeof command!=='object'||Array.isArray(command)||typeof command.occurrenceId!=='string'||!command.occurrenceId||!fenceOccurrenceId||fenceOccurrenceId===command.occurrenceId)throw Error('root_selected_submission_required');
 if(isRootScopeRefMarker(command.scopeRef)){
  if(!rootScopeRef||typeof rootScopeRef!=='object'||isRootScopeRefMarker(rootScopeRef))throw Error('root_selected_submission_required');
  template={...command,scopeRef:rootScopeRef};
 }
 return Object.freeze({schema:'root-exact-submission-fence.v1',status:'ROOT_SELECTED_ABORT_ON_KNOWN_PENDING',commandTemplateSha256:sha256(canonicalJson(template)),fenceOccurrenceId,reason:'ABORT',unknownReplay:false,automaticRetry:false});
}
export interface RootSubmittedRequest {readonly request:Readonly<RequestBinding>;readonly commandTemplateSha256:string}
const capturedRootSubmissions=new WeakSet<object>();
/** Reuse the owner facade's normalization, intercepting admission before every
 * effect. Only its teacher-binding read is available; every writer is denied. */
export async function captureRootSubmittedRequest(selection:RootSubmissionFenceSelection,template:unknown,operation:string,input:unknown,context:TrustedTeacherContext,reader:Pick<TeacherPrerequisiteStore,'teacherBindingByActor'>):Promise<RootSubmittedRequest|null> {
 validateRootSubmissionFenceSelection(selection);
 if(selection.commandTemplateSha256!==sha256(canonicalJson(template)))throw Error('root_selected_submission_required');
 const captured=Symbol('captured-root-submission');let request:RequestBinding|null=null;
 const guarded=new Proxy({}, {get:(_target,name)=>{
  if(name==='teacherBindingByActor')return reader.teacherBindingByActor.bind(reader);
  if(name==='admitCommand')return async(admission:AdmissionCommand)=>{request=structuredClone(commandBinding(admission.context,admission.requestDigest));throw captured;};
  return ()=>{throw Error('root_submission_capture_write_forbidden');};
 }}) as TeacherPrerequisiteStore;
 const facade=new PrerequisiteApplication(guarded,context.ownerId);
 const method=Object.getOwnPropertyDescriptor(PrerequisiteApplication.prototype,operation)?.value;
 if(operation==='constructor'||typeof method!=='function')throw Error('root_selected_submission_required');
 try{await method.call(facade,structuredClone(context),structuredClone(input));}
 catch(error){if(error!==captured){if(error instanceof Error&&error.message==='root_submission_capture_write_forbidden')throw error;return null;}}
 if(!request)return null;
 const proof=Object.freeze({request:Object.freeze(request),commandTemplateSha256:selection.commandTemplateSha256});
 capturedRootSubmissions.add(proof);return proof;
}
/** Data only for a later Root decision; binds the actual looked-up request
 * hash and never fabricates the original request, actor or digest. */
export function buildRootFenceAdmissionTemplate(request:RequestBinding,fenceOccurrenceId:string):Record<string,unknown> {
 validateRequest(request);
 if(!fenceOccurrenceId||fenceOccurrenceId===request.occurrenceId)throw Error('separate_root_fence_occurrence_required');
 return {schema:'root-exact-command-fence-admission-template.v1',status:'ROOT_DECISION_REQUIRED',requestBindingSha256:sha256(canonicalJson(request)),fenceOccurrenceId,reason:'ABORT',unknownReplay:false,automaticRetry:false};
}

export function resolveCommandFence(memory:NativeMemory,request:RequestBinding,submitted?:RootSubmittedRequest|null):{request:RequestBinding;fenceOccurrenceId:string;reason:'ABORT'} {
 const exactKey='ingress.fence-'+request.occurrenceId,templateKey='ingress.fenceTemplate-'+request.occurrenceId;
 if(Object.hasOwn(memory,exactKey))return validateRootCommandFence(memory[exactKey],request);
 if(Object.hasOwn(memory,templateKey)){
  const template=memory[templateKey] as Record<string,unknown>;
  if(template?.schema==='root-exact-submission-fence.v1'){
   const selection=validateRootSubmissionFenceSelection(template);
   if(!submitted||!capturedRootSubmissions.has(submitted)||selection.commandTemplateSha256!==submitted.commandTemplateSha256)throw Error('separate_root_fence_occurrence_required');
   return validateRootCommandFence({schema:'root-exact-command-fence.v1',requestBindingSha256:sha256(canonicalJson(submitted.request)),fenceOccurrenceId:selection.fenceOccurrenceId,reason:selection.reason},request);
  }
  if(!template||typeof template!=='object'||template.schema!=='root-exact-command-fence-admission-template.v1'||template.status!=='ROOT_DECISION_REQUIRED'||typeof template.fenceOccurrenceId!=='string')throw Error('separate_root_fence_occurrence_required');
  // A lookup descriptor is not an authorization. Preserve the Root-recorded
  // request hash and reason; the common exact-fence reader rejects absent or mismatched bindings.
  return validateRootCommandFence({schema:'root-exact-command-fence.v1',requestBindingSha256:template.requestBindingSha256,fenceOccurrenceId:template.fenceOccurrenceId,reason:template.reason},request);
 }
 throw Error('actual_native_binding_required');
}

async function settleNativeCommands(i:FixedRunnerInvocation,memory:NativeMemory,db:SQL,store:PostgresAcademyStore):Promise<Record<string,unknown>[]> {
 const ledger=nativeHttpOccurrences.get(i)??[];
 if(ledger.some(o=>!o.settled))throw Error('native_http_pending_reconcile_no_replay');
 const commands=new Map(ledger.filter(o=>o.command).map(o=>[canonicalJson(o.command),o]));
 const receipts:Record<string,unknown>[]=[];
 for(const occurrence of commands.values()){
  const command=occurrence.command!;
  i.assertCurrent();
  const rows=await db`SELECT request FROM academy.effect_fences WHERE owner_id=${i.config.base.ownerId} AND idempotency_key=${command.idempotencyKey} AND request->>'occurrenceId'=${command.occurrenceId} AND request->>'processEpoch'=${command.processEpoch}`;
  if(rows.length===0)throw Error('original_command_absence_unqualified_reconcile_no_replay');
  if(rows.length!==1)throw Error('exact_command_binding_required');
  const request=rows[0]!.request as import('../src/academy/contracts/prerequisiteRecords').RequestBinding;
  if(request.ownerId!==i.config.base.ownerId||request.occurrenceId!==command.occurrenceId||request.idempotencyKey!==command.idempotencyKey||request.processEpoch!==command.processEpoch)throw Error('exact_command_binding_required');
  if(occurrence.submittedRequest&&canonicalJson(request)!==canonicalJson(occurrence.submittedRequest.request))throw Error('exact_command_binding_required');
  let outcome=await store.commandOutcomeLookup(request);const before=outcome.status;
  if(outcome.status==='UNKNOWN')throw Error('original_command_unknown_reconcile_no_replay');
  if(outcome.status==='PENDING'){
   const fence=resolveCommandFence(memory,request,occurrence.submittedRequest);
   const who=request.actorId===memory['native.actorA']?'A':request.actorId===memory['native.actorB']?'B':null;
   if(!who)throw Error('actual_original_actor_required');
   const cookie=String(memoryGet(memory,who==='B'&&memory['memory.cookie.BOnA']?'memory.cookie.BOnA':'memory.cookie.'+who));
   const reply=await nativePost(i,'/api/native-prerequisite',{operation:'fenceCommand',input:{request,fenceOccurrenceId:fence.fenceOccurrenceId,reason:fence.reason}},cookie);
   if(reply.status!==200||reply.body.status!=='NOT_COMMITTED_FENCED')throw Error('exact_command_fence_reconcile_no_replay');
   outcome=await store.commandOutcomeLookup(request);
  }
  if(outcome.status!=='COMMITTED'&&outcome.status!=='NOT_COMMITTED_FENCED')throw Error('original_command_pending_reconcile_no_replay');
  receipts.push({requestBindingSha256:sha256(canonicalJson(request)),before,status:outcome.status,next:outcome.next,originalReplayed:false});
 }
 return receipts;
}
function nativeResultRef(result:Record<string,unknown>):ObjectRef {
 if(result.status!=='saved'||!result.identity||typeof result.revisionId!=='string'||!result.receipt)throw Error('known_native_commit_required');
 return {identity:result.identity,revision:result.revisionId} as ObjectRef;
}
async function captureNative(id:string,result:Record<string,unknown>,memory:NativeMemory,store:PostgresAcademyStore,owner:string):Promise<void> {
 memory['results.'+id]=structuredClone(result); // Genuine result custody for subsequent revision/ack bindings.
 const name=id==='bind-A'?'teacher-A':id==='bind-B'?'teacher-B':id==='student-s1-v1'||id==='student-s1-v2'?'s1':id==='student-s2-v1'?'s2':id;
 if(result.identity&&result.receipt){
  const ref=nativeResultRef(result);memory['refs.'+name]=ref;
  if(id==='student-s1-v1')memory['refs.s1-initial']=ref;
  if(id==='approval-consume-B'){memory['refs.draft-B-approved']=ref;memory['refs.draft-B']=ref;}
  if(id.startsWith('scope-'))memory['scopeRefs.'+id.slice(6)]=ref;
  if(id.startsWith('score-'))memory['scoreRefs.'+id.slice(6)]=result;
  if(id==='bind-A'||id==='bind-B')memory['native.actor'+id.slice(-1)]=(await store.teacherCurrent(owner,ref.identity.nativeKey))?.payload.actorId;
  const scope=memoryGet(memory,'root.externalScopedRef') as {basis:unknown};
  memory['scopedRefs.'+name]={basis:scope.basis,objectTypeId:ref.identity.objectType,objectKey:ref.identity.nativeKey};
  const families:Record<string,'teacher'|'class'|'lesson'|'binding'|'scope'|'evidence'>={Teacher:'teacher',ClassGroup:'class',LessonSession:'lesson',TemporalBinding:'binding',ActivityScopeLink:'scope',NativeScoreEvidence:'evidence'};
  const family=families[ref.identity.objectType];
  if(family)memory['native.rows.'+id]=await store.ownerRevision(owner,family,ref.identity.nativeKey,ref.revision);
  else if(['DailyProgress','PreviousHomeworkAssessment','DailyRecordDraft'].includes(ref.identity.objectType))memory['native.rows.'+id]=(await store.current(owner,'p4-fictional-student-1')).find(row=>row.entityId===ref.identity.nativeKey&&row.revisionId===ref.revision);
 }
 if(id==='approval-preview-B'||id==='negative-approval-preview')memory[id==='approval-preview-B'?'memory.approvalClosure.B':'memory.approvalClosure.negative']=result;
 if(id==='approval-issue-B'||id==='negative-approval-issue'){
  if(typeof result.proofHandle!=='string'||!result.result)throw Error('genuine_approval_issuance_required');memory[id==='approval-issue-B'?'memory.approvalProof.B':'memory.approvalProof.negative']=result.proofHandle;
  memory[id==='approval-issue-B'?'native.issuance.B':'native.issuance.negative']=result;
 }
}
async function directOperation(i:FixedRunnerInvocation,op:OperationTemplate,memory:NativeMemory,store:PostgresAcademyStore):Promise<Record<string,unknown>> {
 const args=bindTemplate(op.arguments,memory) as unknown[];i.assertCurrent();const owner=i.config.base.ownerId;
 switch(op.api){
  case 'PostgresAcademyStore.registerStudent':{
   const input=args[0] as Parameters<PostgresAcademyStore['registerStudent']>[0];
   if(input.ownerId!==owner||!input.id.startsWith('p4-fictional-')||input.sourceKey.namespace!=='academy_student')throw Error('fixed_fictional_student_required');
   await store.registerStudent(input);if(!(await store.students(owner)).some(s=>s.id===input.id))throw Error('native_registration_readback_required');return {registered:true};
  }
  case 'PostgresAcademyStore.saveCatalog':{
   if(args[0]!==owner)throw Error('fixed_owner_required');const node=args[1] as Parameters<PostgresAcademyStore['saveCatalog']>[1];if(!node.id.startsWith('p4-fictional-'))throw Error('fixed_catalog_required');
   const result=await store.saveCatalog(owner,node),head=(await store.currentCatalogPins(owner)).find(p=>p.node.id===node.id);
   if(!head||head.revisionId!==result.revisionId)throw Error('catalog_readback_required');
   memory['catalogPins.'+op.id.slice(8)]={...result,nodeId:node.id};
   memory['refs.catalog.'+op.id.slice(8)]={identity:{scopeRef:memoryGet(memory,'root.scopeRef'),namespace:memoryGet(memory,'root.namespace'),objectType:node.kind==='book_edition'?'TextbookEdition':node.kind==='learning_section'?'Section':'Unit',nativeKey:node.id},revision:result.revisionId};
   memory['scopedRefs.catalog.'+op.id.slice(8)]={basis:(memoryGet(memory,'root.externalScopedRef') as {basis:unknown}).basis,objectTypeId:node.kind==='book_edition'?'TextbookEdition':node.kind==='learning_section'?'Section':'Unit',objectKey:node.id};
   return result;
  }
  case 'PostgresAcademyStore.append':{
   const command=args[0] as Parameters<PostgresAcademyStore['append']>[0];
   if(command.ownerId!==owner||command.actorId!==memoryGet(memory,'native.actorA')||!command.studentId.startsWith('p4-fictional-')||!command.entityId.startsWith('p4-fictional-'))throw Error('fixed_native_append_required');
   const ack=await store.append(command);if(ack.status!=='saved')throw Error('fresh_native_append_required');
   const current=(await store.current(owner,command.studentId)).find(x=>x.entityId===command.entityId&&x.revisionId===ack.revisionId);
   if(!current)throw Error('native_append_readback_required');memory['records.'+op.id]=current;
   const type=command.payload.kind==='learning_work_assignment'?'HomeworkAssignment':command.payload.kind==='learning_work_attempt'?'DailyTestAttempt':null;
   if(type)memory['refs.'+op.id]={identity:{scopeRef:memoryGet(memory,'root.scopeRef'),namespace:memoryGet(memory,'root.namespace'),objectType:type,nativeKey:command.entityId},revision:ack.revisionId};
   if(type)memory['scopedRefs.'+op.id]={basis:(memoryGet(memory,'root.externalScopedRef') as {basis:unknown}).basis,objectTypeId:type,objectKey:command.entityId};
   return {...ack};
  }
  default:throw Error('fixed_native_store_api_required');
 }
}
/** Closed negative-fixture contract, shared by production and measurement.
 * A dependency/server failure is never evidence of the intended refusal. */
export const expectedFixtureRefusals=Object.freeze({
 'B-never-bound':{status:403,code:'teacher_binding_required'},
 'refuse-overlap':{status:409,code:'temporal_overlap'},
 'refuse-empty':{status:400,code:'invalid_interval'},
 'refuse-inverted':{status:400,code:'invalid_interval'},
 'refuse-cross-family':{status:409,code:'work_attempt_predecessor_conflict'},
 'refuse-duplicate-draft':{status:409,code:'duplicate_current_draft'},
 'negative-approval-consume':approvalRefusalPrecedence.SOURCE_REVISION,
 'issuer-expired':{status:409,code:'approval_expired'},
 'issuer-revoked':{status:409,code:'approval_revoked'},
} as const);
export function requireFixtureRefusal(id:string,status:unknown,code:unknown):void {
 const expected=(expectedFixtureRefusals as Readonly<Record<string,{status:number;code:string}>>)[id];
 if(!Object.hasOwn(expectedFixtureRefusals,id)||!expected||status!==expected.status||code!==expected.code)throw Error('fixture_exact_refusal_required');
}
async function runBaseline(i:FixedRunnerInvocation,memory:NativeMemory,store:PostgresAcademyStore,receipts:Record<string,unknown>[],selected?:readonly OperationTemplate[]):Promise<void> {
 const stage=i.config.stage,phase=stage==='A1-SETUP'?'A1':stage;
 const negativeIds=['draft-B-negative-successor','negative-approval-preview','negative-approval-issue','negative-progress-correct','negative-approval-consume','assessment-unknown-postapproval','scope-assessment-unknown-postapproval'];
 const operations=selected??baselineOperations.filter(o=>o.phase===phase&&!negativeIds.includes(o.id));
 for(const op of operations){
  i.assertCurrent();let result:Record<string,unknown>,status=200,digest:string;
  const refusal=op.id.startsWith('refuse-')||op.id==='B-never-bound'||op.id==='negative-approval-consume';
  const heads=async()=>sha256(canonicalJson(await Promise.all([store.current(i.config.base.ownerId,'p4-fictional-student-1'),store.current(i.config.base.ownerId,'p4-fictional-student-2'),store.temporalBindings(i.config.base.ownerId),store.activityScopes(i.config.base.ownerId,{})])));
  const beforeRefusal=refusal?await heads():null;
  if(op.transport==='HTTP'){
   const who=op.id.startsWith('B-')||op.id==='bind-B'?'B':'A';
   if(['draft-A','draft-B','draft-B-negative-successor'].includes(op.id)){
    if(op.id!=='draft-A')await prepareNativeProposal(memory,store,i.config.base.ownerId);
    await acquireFixtureSnapshot(i,memory,op.id==='draft-A'?'A':'B');
    if(op.id==='draft-B-negative-successor')memory['native.negativeAcquire']=memoryGet(memory,'native.acquisitionBeforeDraft');
   }
   if(op.id==='negative-progress-correct'){const row=memoryGet(memory,'native.rows.progress-B') as {payload:Record<string,unknown>};memory['native.originalProgressBPayloadWithOnlyKnownNoteCorrection']={...row.payload,note:{state:'known',value:'Fictional dependency correction',evidence:[memoryGet(memory,'evidence.fixture')]}};}
   let body=bindTemplate(op.body,memory) as Record<string,unknown>;
   if(body.operation==='classGroups')body={...body,operation:'prerequisiteClassGroups'};
   const operation=body.operation;
   const input=body.input as Record<string,unknown>|undefined;
   if((op.id==='draft-B'||op.id==='draft-B-negative-successor')&&input?.payload){const payload=input.payload as Record<string,unknown>;payload.progressRefs={state:'known',value:memoryGet(memory,'proposal.B.progressRefs'),evidence:memoryGet(memory,'proposal.B.progressEvidence')};if(op.id==='draft-B')payload.supersedesDraftRef=memoryGet(memory,'writerRefs.W-F1-consumeApproval-C');for(const field of ['homework','attempt','previousAssessment'])payload[field+'Refs']={state:'known',value:memoryGet(memory,'proposal.B.'+field+'Refs'),evidence:memoryGet(memory,'proposal.B.'+field+'Evidence')};}
   if(operation==='attachActivityScope'&&input?.payload){input.payload={...(input.payload as object),schemaVersion:'2.0.0',state:'ACTIVE'};}
   if(op.id==='assessment-unknown-postapproval'&&input?.payload){input.studentId='p4-fictional-student-2';const p=input.payload as Record<string,unknown>;p.sourceStudent={namespace:'academy_student',literalKey:'p4-fictional-student-2'};p.homeworkRef=memoryGet(memory,'refs.work-negative');p.assessmentScope={studentRef:memoryGet(memory,'refs.s2'),classGroupRef:memoryGet(memory,'refs.class-main'),businessDate:'2026-10-24',lessonRef:memoryGet(memory,'refs.lesson-scheduled')};p.assessedAt={state:'known',value:'2026-10-24T09:00:00Z',evidence:[memoryGet(memory,'evidence.fixture')]};p.evidenceRefs=[memoryGet(memory,'records.work-negative.revisionId')];}
   if(op.id==='scope-assessment-unknown-postapproval'&&input?.payload){const p=input.payload as Record<string,unknown>;p.recordScope={studentRef:memoryGet(memory,'refs.s2'),classGroupRef:memoryGet(memory,'refs.class-main'),businessDate:'2026-10-24',lessonRef:memoryGet(memory,'refs.lesson-scheduled')};}
   if(op.id==='student-s1-v2')body={...body,operation:'updateStudentRevision'};
   let path='/api/native-prerequisite',cookie:string|null=String(memory['memory.cookie.'+who]??'')||null;
   if(op.id.endsWith('-invite')){path='/api/setup-session';cookie=null;}
   else if(op.id.endsWith('-setup')){path='/api/setup-user';cookie=String(memoryGet(memory,'memory.setupCookie.'+who));}
   else if(op.id.endsWith('-login')){path='/api/login';cookie=null;}
   // Previous homework must come from an earlier lesson: assess s2's lesson-negative work in its later
   // scheduled lesson, whose participantRefs already list s2; only the participation link was missing.
   if(op.id==='assessment-unknown-postapproval'&&!memory['refs.participate-lesson-scheduled']){
    const link=await nativePost(i,'/api/native-prerequisite',{operation:'upsertTemporalBinding',input:{command:memoryGet(memory,'ingress.participate-lesson-scheduled'),bindingKey:null,expectedRevisionId:null,payload:{kind:'temporal_binding',bindingKind:'LESSON_PARTICIPATION',subjectRef:memoryGet(memory,'refs.lesson-scheduled'),targetRef:memoryGet(memory,'refs.s2'),validFrom:'2026-10-24',validTo:'2026-10-25',sourceLiteral:'Fictional explicit interval participate-lesson-scheduled',synthetic:true}}},String(memoryGet(memory,'memory.cookie.A')));
    if(link.status!==200)throw Error('scheduled_lesson_participation_required');memory['refs.participate-lesson-scheduled']=nativeResultRef(link.body);
   }
   if(op.id==='approval-consume-B'&&!memory['issuer.exercised']){await exerciseIssuerRefusals(i,memory,store,receipts);memory['issuer.exercised']=true;}
   const response=await nativePost(i,path,body,cookie);status=response.status;result=response.body;digest=response.digest;
   if(op.id.endsWith('-invite')||op.id.endsWith('-login')){if(status!==200||!response.cookie)throw Error('genuine_authentication_required');memory['memory.'+(op.id.endsWith('-invite')?'setupCookie.':'cookie.')+who]=response.cookie;}
   if(op.id.endsWith('-setup')){if(status!==200)throw Error('genuine_setup_required');delete memory['memory.setupCookie.'+who];const identity=new TeacherAuthStore(i.config.base.authFile).readExistingIdentity().identity!;memory['native.identity'+who]=identity;memory['native.actor'+who]=identity.actorId;memory['native.authHash'+who]=sha256(readFileSync(i.config.base.authFile));}
  }else{
   try{result=await directOperation(i,op,memory,store);}
   catch(error){if(op.id!=='refuse-cross-family'||!(error instanceof Error)||error.message!=='work_attempt_predecessor_conflict')throw error;result={error:error.message};status=409;}
   digest=sha256(JSON.stringify(result));
  }
  if(refusal)requireFixtureRefusal(op.id,status,result.error);else if(status!==200)throw Error('fixture_outcome_requires_reconciliation');
  if(refusal&&await heads()!==beforeRefusal)throw Error('fixture_refusal_changed_business_heads');
  receipts.push({id:op.id,status,resultSha256:digest,automaticRetry:false,...(refusal?{refusalCode:result.error,headUnchanged:true,beforeHeads:beforeRefusal,afterHeads:beforeRefusal}:{})});
  if(!refusal){await captureNative(op.id,result,memory,store,i.config.base.ownerId);if(op.id==='assessment-unknown-postapproval')memory['refs.assessment-unknown']=nativeResultRef(result);}
 }
 if(stage==='A1-SETUP'&&!selected){
  // All destructive negative dependencies are prepared before the final
  // setup freeze. A fresh real successor restores the positive B lane;
  // nothing reseeds/reverts history or adds an unadopted runtime phase.
  await runBaseline(i,memory,store,receipts,negativeIds.map(id=>baselineOperations.find(o=>o.id===id)!));
  await restorePositiveDraft(i,memory,store,receipts);
 }
}
async function restorePositiveDraft(i:FixedRunnerInvocation,memory:NativeMemory,store:PostgresAcademyStore,receipts:Record<string,unknown>[]):Promise<void> {
 const corrected=memoryGet(memory,'refs.negative-progress-correct') as ObjectRef,scope=memoryGet(memory,'scopeRefs.progress-B') as ObjectRef;
 const original=await store.ownerRevision(i.config.base.ownerId,'scope',scope.identity.nativeKey,scope.revision);
 if(!original||original.payload.kind!=='activity_scope')throw Error('genuine_scope_restore_head_required');
 const update=await nativePost(i,'/api/native-prerequisite',{operation:'correctActivityScope',input:{command:memoryGet(memory,'ingress.restore-progress-scope'),scopeKey:scope.identity.nativeKey,expectedRevisionId:scope.revision,payload:{...original.payload,activityRef:corrected}}},String(memoryGet(memory,'memory.cookie.A')));
 if(update.status!==200)throw Error('positive_scope_successor_required');memory['scopeRefs.progress-B']=nativeResultRef(update.body);memory['refs.progress-B']=corrected;
 // Reuse closed native templates with new Root-admitted command bindings.
 const successor=structuredClone(baselineOperations.find(o=>o.id==='draft-B-negative-successor')!);
 const body=successor.body as {input:{command:unknown;payload:Record<string,unknown>}};
 // The negative successor is the current, never-approved DRAFT head of lane B's scope; the store
 // lets a new draft supersede only an APPROVED head, so the positive lane is restored by correcting
 // that head (keeping its supersession of the approved draft) with the corrected collection.
 (successor.body as {operation:string}).operation='updateDraft';
 body.input={command:{$bind:'ingress.restore-positive-draft'},studentId:'p4-fictional-student-1',entityId:{$bind:'refs.draft-B-negative-successor.identity.nativeKey'},expectedRevisionId:{$bind:'refs.draft-B-negative-successor.revision'},payload:body.input.payload} as never;
 await runBaseline(i,memory,store,receipts,[successor]);memory['refs.draft-B']=memoryGet(memory,'refs.draft-B-negative-successor');
 const selected=['approval-preview-B','approval-issue-B','approval-consume-B'].map((id,index)=>{
  const op=structuredClone(baselineOperations.find(o=>o.id===id)!);(op.body as {input:{command:unknown}}).input.command={$bind:['ingress.restore-approve','ingress.restore-issue','ingress.restore-approve'][index]};return op; // preview binds the consume target's context, as approval-preview-B/consume-B share futureApproveTarget
 });
 await runBaseline(i,memory,store,receipts,selected);
}

async function exerciseIssuerRefusals(i:FixedRunnerInvocation,memory:NativeMemory,store:PostgresAcademyStore,receipts:Record<string,unknown>[]):Promise<void> {
 const owner=i.config.base.ownerId,draft=memoryGet(memory,'refs.draft-B') as ObjectRef,cookie=String(memoryGet(memory,'memory.cookie.A'));
 const head=()=>store.current(owner,'p4-fictional-student-1').then(rows=>rows.find(r=>r.entityId===draft.identity.nativeKey)?.revisionId);
 const before=await head();
 for(const kind of ['expired','revoked'] as const){
  i.assertCurrent();const target=memoryGet(memory,'ingress.issuer-'+kind+'-target');
  const preview=await nativePost(i,'/api/native-prerequisite',{operation:'previewApprovalClosure',input:{command:target,draftRef:draft}},cookie);
  if(preview.status!==200)throw Error('genuine_issuer_preview_required');
  const issue=await nativePost(i,'/api/native-prerequisite',{operation:'issueApproval',input:{command:memoryGet(memory,'ingress.issuer-'+kind+'-issue'),draftRef:draft,closure:preview.body,validForSeconds:kind==='expired'?1:120}},cookie);
  if(issue.status!==200||typeof issue.body.proofHandle!=='string')throw Error('genuine_issuer_proof_required');
  if(kind==='expired'){
   const native=await store.approvalCurrent(owner,issue.body.proofHandle);if(!native)throw Error('native_issued_proof_head_required');
   const deadline=Date.parse(native.payload.expiresAt);if(deadline-Date.now()>1500)throw Error('exact_one_second_proof_required');
   if(deadline>=Date.now())await new Promise<void>(resolve=>setTimeout(resolve,deadline-Date.now()+5));
  }else{
   const native=await store.approvalCurrent(owner,issue.body.proofHandle);if(!native)throw Error('native_issued_proof_head_required');
   const revoke=await nativePost(i,'/api/native-prerequisite',{operation:'revokeApproval',input:{command:memoryGet(memory,'ingress.issuer-revoke'),approvalId:native.entityKey,expectedRevisionId:native.revisionId}},cookie);
   if(revoke.status!==200)throw Error('native_revocation_required');
  }
  const refused=await nativePost(i,'/api/native-prerequisite',{operation:'approveDraft',input:{command:target,draftRef:draft,approvalProofHandle:issue.body.proofHandle}},cookie);
  requireFixtureRefusal('issuer-'+kind,refused.status,refused.body.error);
  if(await head()!==before)throw Error('issuer_refusal_must_preserve_draft_head');
  receipts.push({id:'issuer-'+kind,status:refused.status,refusalCode:refused.body.error,resultSha256:refused.digest,headUnchanged:true,proofSource:'GENUINE_NATIVE_ISSUANCE',automaticRetry:false});
 }
}
/* Full EvidenceRef from the actual captured native ObjectRef only: tag and
 * basis come from that ref, type version follows the native store rule,
 * revision/locator/observedAt are the actual owner-row values. A projected
 * scoped ref without the full native shape fails validateEvidence. */
export function nativeRecordEvidence(ref:ObjectRef,row:{entityId:string;sourceObservedAt:string}):EvidenceRef {
 const evidence:EvidenceRef={sourceRef:{...ref.identity.scopeRef,objectTypeId:ref.identity.objectType,objectTypeVersion:ref.identity.objectType==='Section'?'1.1.0':'1.0.0',objectKey:ref.identity.nativeKey},sourceRevision:ref.revision,locator:'native-record:'+row.entityId,observedAt:row.sourceObservedAt};
 validateEvidence(evidence);return evidence;
}
async function prepareNativeProposal(memory:NativeMemory,store:PostgresAcademyStore,owner:string):Promise<void> {
 const rows=await store.current(owner,'p4-fictional-student-1'),lesson=memoryGet(memory,'refs.lesson-B') as ObjectRef;
 const scopes=await store.activityScopes(owner,{lessonKey:lesson.identity.nativeKey}),sources:ProposalSources={progress:[],homework:[],attempts:[],previousAssessments:[]};
 const evidence=new Map<string,unknown>();
 for(const scope of scopes){
  if(scope.payload.state==='DETACHED')continue;
  const ref=scope.payload.activityRef,row=rows.find(row=>row.entityId===ref.identity.nativeKey&&row.revisionId===ref.revision);if(!row)throw Error('genuine_proposal_source_head_required');
  const source={ref,payload:row.payload};
  if(row.payload.kind==='daily_progress')sources.progress.push(source);
  else if(row.payload.kind==='learning_work_assignment')sources.homework.push(source);
  else if(row.payload.kind==='previous_homework_assessment')sources.previousAssessments.push(source);
  else if(row.payload.kind==='learning_work_attempt'){
   const scores=await store.scoreEvidenceForAttempt(owner,ref as ObjectRef<'DailyTestAttempt'>);if(scores.length!==1)throw Error('native_proposal_numeric_score_evidence_required');const score=scores[0]!;
   sources.attempts.push({ref,payload:{attempt:row.payload,scoreEvidence:{revision:score.revisionId,payload:score.payload}}});
  }
  evidence.set(canonicalRef(ref),nativeRecordEvidence(ref,row));
 }
 const texts=nativeProposalTexts(sources);
 for(const [field,selected] of [['progressText',sources.progress],['homeworkText',[...sources.homework,...sources.previousAssessments]],['noteText',sources.attempts]] as const)memory['proposal.B.'+field+'Knowledge']={state:'known',value:texts[field],evidence:selected.map(row=>evidence.get(canonicalRef(row.ref)))};
 memory['proposal.B.progressRefs']=sources.progress.map(row=>row.ref);memory['proposal.B.progressEvidence']=sources.progress.map(row=>evidence.get(canonicalRef(row.ref)));
 // Drafts declare exactly the current native collection in every category (approval
 // completeness compares them), not the template's fixed baseline refs.
 for(const [field,rows] of [['homework',sources.homework],['attempt',sources.attempts],['previousAssessment',sources.previousAssessments]] as const){memory['proposal.B.'+field+'Refs']=rows.map(row=>row.ref);memory['proposal.B.'+field+'Evidence']=rows.map(row=>evidence.get(canonicalRef(row.ref)));}
}
function canonicalRef(ref:ObjectRef):string{return JSON.stringify(ref);}
async function acquireFixtureSnapshot(i:FixedRunnerInvocation,memory:NativeMemory,lesson:'A'|'B'):Promise<void> {
 // Caller CAS pins are scoped to this genuine Function plan. The owner still
 // captures its whole native horizon; unrelated auxiliary fixture refs must
 // never be injected into another student's plan or overflow its100 pin cap.
 const expected=['s1','class-main','lesson-'+lesson].map(name=>memoryGet(memory,'refs.'+name));
 const functionIntent={contractVersion:'2.0.0',functionVersion:'2.0.0',scopeRef:memoryGet(memory,'root.externalScopedRef'),classGroupRef:memoryGet(memory,'refs.class-main'),businessDate:'2026-10-23',expectedRevisions:expected,pageSize:1,functionName:'GetStudentDailyContext',selector:'STUDENT_OCCURRENCE_CONTEXT_V1',studentRef:memoryGet(memory,'refs.s1'),occurrence:{mode:'EXACT',lessonRef:memoryGet(memory,'refs.lesson-'+lesson)}};
 const result=await nativePost(i,'/api/native-read-snapshot',{schema:'native-read-acquire.v2',consumerProfile:i.config.base.consumerProfile,requestId:crypto.randomUUID(),scopeRef:memoryGet(memory,'root.externalScopedRef'),consistency:'FAIL_ON_CHANGE',time:{mode:'CURRENT'},functionIntent},String(memoryGet(memory,'memory.cookie.A')));
 if(result.status!==200||result.body.schema!=='native-read-acquire-result.v2'||!result.body.snapshotAdmission)throw Error('genuine_fixture_snapshot_required');
 memory['native.acquisitionBeforeDraft']=result.body;
 const {completeSnapshotRead}=await import('./native_foundations_measurement');
 await completeSnapshotRead(i,memory,result.body as never,lesson);
}
async function setupFourG(i:FixedRunnerInvocation,memory:NativeMemory,store:PostgresAcademyStore):Promise<void> {
 // Use the existing S2/negative occurrence lane. Unknown rating scores must
 // not contaminate the separately complete positive B draft's collection.
 const attempt=baselineOperations.find(x=>x.id==='attempt-negative')!;
 for(const [suffix,lexeme] of [['minus1','-1'],['ten','10']] as const){
  const args=structuredClone(attempt.arguments!) as Record<string,unknown>[];
  const command=args[0]!,id='rating-'+suffix;command.entityId='p4-fictional-'+id;command.idempotencyKey=memoryGet(memory,'root.storeKeys.'+id);
  const payload=command.payload as Record<string,unknown>;payload.attemptKey={namespace:'synthetic_attempt',literalKey:'p4-fictional-'+id};payload.rawDailyRating={schemaVersion:'1.0.0',family:'daily_rating_code',lexeme};
  await directOperation(i,{...attempt,id,arguments:args},memory,store);
  const scope={...(bindTemplate(baselineOperations.find(x=>x.id==='scope-attempt-negative')!.body,memory) as {input:Record<string,unknown>}).input};
  scope.command=memoryGet(memory,'ingress.scope-'+id);scope.payload={...(scope.payload as object),activityRef:memoryGet(memory,'refs.'+id),schemaVersion:'2.0.0',state:'ACTIVE'};
  const result=await nativePost(i,'/api/native-prerequisite',{operation:'attachActivityScope',input:scope},String(memoryGet(memory,'memory.cookie.A')));if(result.status!==200)throw Error('g1_native_scope_required');memory['scopeRefs.'+id]=nativeResultRef(result.body);
 }
 const equalPayload={kind:'teacher_lesson_carryover',sourceStudent:{namespace:'academy_student',literalKey:'p4-fictional-student-1'},sourceCourse:null,sourceBook:null,sourceMinorUnit:null,activity:'daily_test',status:'reminder',originDate:'2026-10-22',targetDate:'2026-10-23',occurrence:{date:'2026-10-23',groupId:'1',courseKey:'2',recordKey:'3',membershipKey:'4'},text:'Fictional facet-only reminder',directiveRef:'p4-fictional-fixture-v1',evidenceRefs:['p4-fictional-fixture-v1']};
 for(const id of ['carryover-one','carryover-two'])await directOperation(i,{id,phase:'A1',transport:'DIRECT',api:'PostgresAcademyStore.append',arguments:[{ownerId:i.config.base.ownerId,studentId:'p4-fictional-student-1',entityId:'p4-fictional-'+id,actorId:memoryGet(memory,'native.actorA'),idempotencyKey:memoryGet(memory,'root.storeKeys.'+id),expectedRevisionId:null,sourceObservedAt:memoryGet(memory,'clock.observedSourceAt'),payload:equalPayload}]},memory,store);
 // G3: actual Progress scopes cite each immediate ancestry, on the same
 // student/date/lesson; all three are projected with independent current pins.
 for(const level of ['major','middle','minor']){
  const body=bindTemplate(baselineOperations.find(x=>x.id==='progress-B')!.body,memory) as {operation:string;input:Record<string,unknown>};
  body.input.command=memoryGet(memory,'ingress.g3-'+level);const payload=body.input.payload as Record<string,unknown>,content=payload.contentScope as Record<string,unknown>;
  content.unitRef=memoryGet(memory,'refs.catalog.'+level);content.sectionRefs={state:'known',value:[memoryGet(memory,'refs.catalog.section-'+level)],evidence:[memoryGet(memory,'evidence.fixture')]};
  const progress=await nativePost(i,'/api/native-prerequisite',body,String(memoryGet(memory,'memory.cookie.A')));if(progress.status!==200)throw Error('g3_real_progress_required');memory['refs.g3-'+level]=nativeResultRef(progress.body);
  const scope=(bindTemplate(baselineOperations.find(x=>x.id==='scope-progress-B')!.body,memory) as {operation:string;input:Record<string,unknown>});scope.input.command=memoryGet(memory,'ingress.scope-g3-'+level);scope.input.payload={...(scope.input.payload as object),activityRef:memoryGet(memory,'refs.g3-'+level),schemaVersion:'2.0.0',state:'ACTIVE'};
  if((await nativePost(i,'/api/native-prerequisite',scope,String(memoryGet(memory,'memory.cookie.A')))).status!==200)throw Error('g3_real_scope_required');
 }
}
export const c07FixturePolicy=Object.freeze({studentId:'W-F2-C',classKey:'W-C07-CLASS',lessonKey:'W-C07-LESSON',businessDate:'2026-10-23',count:100,noteBytes:11000,maxOutputBytes:1048576,pageSize:100});
/** Fixed schedule coordination; arguments are source-selected keys, never SQL
 * or programs from the sealed input. A timeout is reconcile-only. */
async function holdWriterKey(db:SQL,owner:string,id:string,kind:'p4-writer-release'|'p4-writer-reader-ready'){
 let release!:()=>void,ready!:(pid:number)=>void,reject!:(reason:unknown)=>void;
 const released=new Promise<void>(r=>{release=r;}),locked=new Promise<number>((r,j)=>{ready=r;reject=j;});
 const settled=db.begin(async tx=>{const pid=Number((await tx`SELECT pg_backend_pid() AS pid`)[0]!.pid);await tx`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify([kind,owner,id])},0))`;ready(pid);await released;}).catch(error=>{reject(error);throw error;});
 const pid=await locked;return {pid,release,settled};
}
async function waitWriterBlock(db:SQL,blocker:number,signal:AbortSignal):Promise<number[]>{
 const until=Date.now()+300000;
 while(Date.now()<until){if(signal.aborted)throw Error('writer_observer_closed');const rows=await db`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND ${blocker}=ANY(pg_blocking_pids(pid))`;if(rows.length)return rows.map((r:{pid:number})=>Number(r.pid));await Bun.sleep(1);}
 throw Error('writer_wait_expired_reconcile_same_occurrence');
}
async function writerCensus(db:SQL,owner:string,entry:DependencyWriterCase):Promise<string>{
 const rows=await db`SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='academy' ORDER BY tablename`,inventory:unknown[]=[];
 for(const row of rows){const name=String(row.tablename);if(!/^[a-z][a-z0-9_]*$/.test(name))throw Error('catalog_identifier_required');if(name==='read_occurrences')continue;
  const actual=await db.unsafe('SELECT row_to_json(t) AS value FROM academy."'+name+'" t');inventory.push({table:name,rows:actual.map((r:{value:unknown})=>sha256(canonicalJson(r.value))).sort()});
 }
 // F6 changes only its own selected audit row. Preserve that actual delta;
 // exclude the independent paired reader's legal terminal metadata.
 if(entry.family==='F6'){const target=await db`SELECT row_to_json(t) AS value FROM academy.read_occurrences t WHERE owner_id=${owner} AND request_id=${entry.id}`;inventory.push({table:'read_occurrences:exact-writer-target',rows:target.map((r:{value:unknown})=>sha256(canonicalJson(r.value))).sort()});}
 return sha256(canonicalJson(inventory));
}
/** Root's exact Teacher join uses real CAS successors, including every affected
 * setup reference. Historical payloads remain untouched; current bindings are
 * replaced only with returned native receipts and actual store readback. */
async function repairTeacherSetupClosure(i:FixedRunnerInvocation,memory:NativeMemory,store:PostgresAcademyStore,receipts:Record<string,unknown>[]):Promise<void>{
 const before=memoryGet(memory,'native.teacherWriter.before') as Awaited<ReturnType<PostgresAcademyStore['teacherCurrent']>>;
 const after=memoryGet(memory,'native.teacherWriter.after') as Awaited<ReturnType<PostgresAcademyStore['teacherCurrent']>>;
 if(!before||!after||before.entityKey!==after.entityKey||before.revisionId===after.revisionId||i.config.stage!=='A1-SETUP')throw Error('exact_teacher_join_successor_required');
 const ref=(v:{scopeRef:unknown;namespace:string;entityKey:string;revisionId:string},objectType:string)=>({identity:{scopeRef:v.scopeRef,namespace:v.namespace,objectType,nativeKey:v.entityKey},revision:v.revisionId}) as ObjectRef;
 const replacements=new Map<string,ObjectRef>([[canonicalJson(ref(before,'Teacher')),ref(after,'Teacher')]]);
 const rebase=(value:unknown):unknown=>{
  if(Array.isArray(value))return value.map(rebase);
  if(value&&typeof value==='object'){
   const exact=replacements.get(canonicalJson(value));if(exact)return structuredClone(exact);
   return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,rebase(v)]));
  }return value;
 };
 const remember=(logical:string,old:ObjectRef,next:ObjectRef,row:unknown)=>{
  replacements.set(canonicalJson(old),next);
  memory['native.refHistory.'+logical+'.'+old.revision]=structuredClone(old);
  for(const [key,value] of Object.entries(memory))if((key.startsWith('refs.')||key.startsWith('scopeRefs.'))&&canonicalJson(value)===canonicalJson(old))memory[key]=structuredClone(next);
  if(memory['native.rows.'+logical])memory['native.rowHistory.'+logical+'.'+old.revision]=memory['native.rows.'+logical];
  memory['native.rows.'+logical]=row;
 };
 const call=async(logical:string,operation:string,input:Record<string,unknown>)=>{
  const id='W-TEACHER-REFRESH-'+logical,response=await nativePost(i,'/api/native-prerequisite',{operation,input:{...input,command:memoryGet(memory,'ingress.'+id)}},String(memoryGet(memory,'memory.cookie.A')));
  if(response.status!==200)throw Error('ROOT_JOIN_HOLD:TEACHER_REFERENCE_SUCCESSOR:'+logical);
  const next=nativeResultRef(response.body);receipts.push({id,status:200,resultSha256:response.digest,referenceSuccessorOnly:true,originalHistoryPreserved:true});return next;
 };
 remember('bind-A',ref(before,'Teacher'),ref(after,'Teacher'),after);
 for(const logical of ['lesson-A','lesson-B','lesson-negative','lesson-scheduled','lesson-cancelled','lesson-participants-unknown']){
  const old=memoryGet(memory,'refs.'+logical) as ObjectRef,current=await store.lessonCurrent(i.config.base.ownerId,old.identity.nativeKey);if(!current||current.revisionId!==old.revision)throw Error('teacher_join_lesson_current_cas');
  const {ownerId:_ownerId,lessonKey:_lessonKey,...payload}=current.payload,nextPayload=rebase(payload);
  if(canonicalJson(nextPayload)===canonicalJson(payload))continue;
  const next=await call(logical,'updateLessonSession',{lessonKey:current.entityKey,expectedRevisionId:current.revisionId,payload:nextPayload});
  const actual=await store.lessonCurrent(i.config.base.ownerId,current.entityKey);if(!actual||actual.revisionId!==next.revision)throw Error('teacher_join_lesson_readback');remember(logical,old,next,actual);
 }
 for(const op of baselineOperations.filter(o=>o.body&&typeof o.body==='object'&&(o.body as {operation?:unknown}).operation==='upsertTemporalBinding'&&!o.id.startsWith('refuse-'))){
  const old=memoryGet(memory,'refs.'+op.id) as ObjectRef,current=(await store.temporalBindings(i.config.base.ownerId)).find(r=>r.entityKey===old.identity.nativeKey);if(!current||current.revisionId!==old.revision)throw Error('teacher_join_binding_current_cas');
  const {ownerId:_ownerId,bindingKey:_bindingKey,...payload}=current.payload,nextPayload=rebase(payload);if(canonicalJson(nextPayload)===canonicalJson(payload))continue;
  const next=await call(op.id,'upsertTemporalBinding',{bindingKey:current.entityKey,expectedRevisionId:current.revisionId,payload:nextPayload});
  const actual=(await store.temporalBindings(i.config.base.ownerId)).find(r=>r.entityKey===current.entityKey);if(!actual||actual.revisionId!==next.revision)throw Error('teacher_join_binding_readback');remember(op.id,old,next,actual);
 }
 for(const studentId of ['p4-fictional-student-1','p4-fictional-student-2'])for(const current of await store.current(i.config.base.ownerId,studentId)){
  if(!['daily_progress','previous_homework_assessment'].includes(current.payload.kind))continue;
  const nextPayload=rebase(current.payload);if(canonicalJson(nextPayload)===canonicalJson(current.payload))continue;
  const logical=Object.keys(memory).find(k=>k.startsWith('refs.')&&(memory[k] as ObjectRef)?.identity?.nativeKey===current.entityId)?.slice(5);if(!logical)throw Error('teacher_join_fixed_record_slot_required');
  const old=memoryGet(memory,'refs.'+logical) as ObjectRef,next=await call(logical,current.payload.kind==='daily_progress'?'correctProgress':'correctAssessment',{studentId,entityId:current.entityId,expectedRevisionId:current.revisionId,payload:nextPayload});
  const actual=(await store.current(i.config.base.ownerId,studentId)).find(r=>r.entityId===current.entityId);if(!actual||actual.revisionId!==next.revision)throw Error('teacher_join_record_readback');remember(logical,old,next,actual);
 }
 for(const current of await store.activityScopes(i.config.base.ownerId,{})){
  const payload=rebase(current.payload);if(canonicalJson(payload)===canonicalJson(current.payload))continue;
  const slot=Object.keys(memory).find(k=>k.startsWith('scopeRefs.')&&(memory[k] as ObjectRef)?.identity?.nativeKey===current.entityKey);if(!slot)throw Error('teacher_join_fixed_scope_slot_required');
  const logical='scope-'+slot.slice(10),old=memoryGet(memory,slot) as ObjectRef,next=await call(logical,'correctActivityScope',{scopeKey:current.entityKey,expectedRevisionId:current.revisionId,payload});
  const actual=(await store.activityScopes(i.config.base.ownerId,{})).find(r=>r.entityKey===current.entityKey);if(!actual||actual.revisionId!==next.revision)throw Error('teacher_join_scope_readback');remember(logical,old,next,actual);
 }
 for(const logical of ['attempt-B1','attempt-B2'])for(const current of await store.scoreEvidenceForAttempt(i.config.base.ownerId,memoryGet(memory,'refs.'+logical) as ObjectRef<'DailyTestAttempt'>)){
  const payload=rebase(current.payload);if(canonicalJson(payload)===canonicalJson(current.payload))continue;
  const next=await call('score-'+logical,'recordScoreEvidence',{entityKey:current.entityKey,expectedRevisionId:current.revisionId,payload});
  const actual=await store.scoreEvidenceCurrent(i.config.base.ownerId,current.entityKey);if(!actual||actual.revisionId!==next.revision)throw Error('teacher_join_score_readback');memory['scoreRefs.'+logical]={identity:next.identity,revisionId:next.revision};
 }
 // Prove fresh rights/closure through genuine acquisition and a new native
 // positive. No old grant or old payload is relabelled as current.
 const {prepareDependencyReader}=await import('./native_foundations_measurement');
 const positive=await prepareDependencyReader(i,memory,'W-R-W-F1-TEACHER-CURRENT-POSITIVE');
 const result=await nativePost(i,'/api/typed-read',positive,String(memoryGet(memory,'memory.cookie.A')));
 if(result.status!==200)throw Error('ROOT_JOIN_HOLD:TEACHER_LATER_POSITIVE_REF_CLOSURE');
 receipts.push({id:'TEACHER-REF-CLOSURE-POSITIVE',status:200,resultSha256:result.digest,originalHistoryPreserved:true});
}
export function orderedDependencyWriterCases(value:unknown):readonly DependencyWriterCase[]{
 const schedule=validateDependencyWriterSchedule(value);
 const order=['W-F1-appendTeacher-C','W-F1-appendTeacher-R','W-F2-C','W-F2-R',...['appendClassGroup','appendStudentRevision','appendLesson','appendTemporalBinding','createProgress','correctProgress','createAssessment','correctAssessment','appendActivityScope','appendScoreEvidence'].flatMap(op=>['C','R'].map(d=>'W-F1-'+op+'-'+d)),...['F3-append','F4-saveCatalog','F6-ADMIT','F6-FINALIZE','F6-GENERIC-CLEANUP'].flatMap(op=>['C','R'].map(d=>'W-'+op+'-'+d)),...['createDraft','correctDraft','issueApproval','revokeApproval','consumeApproval'].flatMap(op=>['R','C'].map(d=>'W-F1-'+op+'-'+d))];
 if(order.length!==44||new Set(order).size!==44||schedule.sqlCases.some(e=>!order.includes(e.id)))throw Error('exact44_selected_cases_required');
 return order.map(id=>schedule.sqlCases.find(e=>e.id===id)!);
}
async function runDependencyWriterSchedule(i:FixedRunnerInvocation,memory:NativeMemory,db:SQL,store:PostgresAcademyStore,receipts:Record<string,unknown>[]):Promise<void>{
 assertFixedRunner(i,'FIXTURE');if(i.config.stage!=='A1-SETUP')throw Error('writer_schedule_prefreeze_only');
 const schedule=validateDependencyWriterSchedule(i.config.base.dependencyWriterSchedule);
 if(canonicalJson(schedule)!==canonicalJson(i.config.base.dependencyWriterSchedule))throw Error('helper_and_runner_exact_schedule_required');
 const {prepareDependencyReader}=await import('./native_foundations_measurement');
 for(const entry of orderedDependencyWriterCases(schedule)){
  if(entry.id==='W-F1-createDraft-R'){await setupFourG(i,memory,store);await setupC07(i,memory,store,receipts);}
  await prepareWriterPrecondition(i,memory,store,entry);
  i.assertCurrent();const reader=await prepareDependencyReader(i,memory,entry.readerRequestId),ready=await holdWriterKey(db,i.config.base.ownerId,entry.id,'p4-writer-reader-ready'),writerRelease=await holdWriterKey(db,i.config.base.ownerId,entry.id,'p4-writer-release');
  const read=nativePost(i,'/api/typed-read',reader,String(memoryGet(memory,'memory.cookie.A')));
  let writer:Promise<unknown>|undefined;const observer=new AbortController(),waits:Promise<unknown>[]=[];
  const wait=(pid:number)=>{const p=waitWriterBlock(db,pid,observer.signal);waits.push(p);return p;};
  try{
   const prepared=await Promise.race([wait(ready.pid),read.then(()=>{throw Error('reader_finished_before_real_prepared_barrier');})]);if(prepared.length!==1)throw Error('one_genuine_prepared_reader_required');
   // Every entry is dispatched by the fixed source recipe below, once.
   writer=dispatchDependencyWriter(i,memory,store,entry);
   const writers=await Promise.race([wait(writerRelease.pid),writer.then(()=>{throw Error('writer_finished_before_actual_work_barrier');})]);if(writers.length!==1)throw Error('one_actual_writer_backend_required');
   const before=await writerCensus(db,i.config.base.ownerId,entry);ready.release();await ready.settled;
   const readers=await wait(writers[0]!);if(!readers.length||readers.includes(writers[0]!))throw Error('distinct_output_reader_wait_required');
   const locks=await db`SELECT pid,mode,granted FROM pg_locks WHERE locktype='advisory' AND pid IN (${writers[0]!},${readers[0]!})`;
   if(!locks.some((l:{pid:number;mode:string;granted:boolean})=>Number(l.pid)===writers[0]&&l.mode==='ExclusiveLock'&&l.granted)||!locks.some((l:{pid:number;mode:string;granted:boolean})=>Number(l.pid)===readers[0]&&l.mode==='ShareLock'&&!l.granted))throw Error('actual_exclusive_before_shared_wait_required');
   writerRelease.release();await writerRelease.settled;const result=await writer,response=await read,after=await writerCensus(db,i.config.base.ownerId,entry);
   if(entry.disposition==='ROLLBACK'&&before!==after)throw Error('writer_rollback_census_changed');
   if(entry.disposition==='COMMIT'&&before===after)throw Error('writer_noop_not_commit_proof');
   if(![200,403,409].includes(response.status))throw Error('writer_reader_terminal_reconcile');
   const audit=await db`SELECT status FROM academy.read_occurrences WHERE owner_id=${i.config.base.ownerId} AND request_id=${entry.readerRequestId}`;
   if(audit.length!==1||!['COMPLETED','REFUSED'].includes(String(audit[0]!.status)))throw Error('writer_reader_terminal_required');
   if(!i.config.helperStartReceipt||!i.config.liveHelper)throw Error('exact_live_helper_binding_required');
   const stageReceipts=['SHARED_OWNER','READ_KEY','PREPARED'].map(stage=>{
    const raw=readFileSync(join(dirname(i.config.helperStartReceipt!.path),'writer-reader-'+entry.id+'-'+stage+'.json')),value=JSON.parse(raw.toString('utf8'));
    if(value.schema!=='actual-writer-reader-stage.v1'||value.stage!==stage||value.caseId!==entry.id||value.requestId!==entry.readerRequestId||value.ownerId!==i.config.base.ownerId||value.runId!==i.config.base.runId||value.sourceSetSha256!==i.config.base.sourceSet.sha256||value.pid!==i.config.liveHelper!.pid||value.startTicks!==i.config.liveHelper!.startTicks||!readers.includes(Number(value.backendPid)))throw Error('actual_ordered_reader_stage_required');
    return {stage,sha256:sha256(raw),backendPid:value.backendPid};
   });
   receipts.push({id:entry.id,family:entry.family,operation:entry.operation,disposition:entry.disposition,before,after,writerBackend:writers[0],readerBackends:readers,stageReceipts,ownerWaitObserved:true,readerStatus:response.status,terminal:audit[0]!.status,resultSha256:sha256(canonicalJson(result)),nativeVerdict:null});
   if(entry.operation==='appendTeacher'&&entry.disposition==='COMMIT')await repairTeacherSetupClosure(i,memory,store,receipts);
  }finally{
   observer.abort();ready.release();writerRelease.release();await Promise.allSettled([ready.settled,writerRelease.settled,...(writer?[writer]:[]),read,...waits]);
  }
 }
 // Exactly the 44 scheduled writer cases; W-TEACHER-REFRESH-* and W-C07-* receipts share the prefix but are not writer cases.
 const writerIds=new Set(orderedDependencyWriterCases(schedule).map(e=>e.id));
 memory['native.dependencyWriterReceipts']=receipts.filter(r=>typeof r.id==='string'&&writerIds.has(r.id));
}
async function dispatchDependencyWriter(i:FixedRunnerInvocation,memory:NativeMemory,store:PostgresAcademyStore,entry:DependencyWriterCase):Promise<unknown>{
 const owner=i.config.base.ownerId,{PostgresAcademyStore}=await import('../src/academy/postgresStore');
 let claimed=false;
 const hook:import('../src/academy/nativePrerequisiteStore').DependencyWriterHook=async(operation,ownerId,_key,tx)=>{
  i.assertCurrent();if(claimed||ownerId!==owner||operation!==dependencyStoreOperation(entry))throw Error('fixed_writer_dispatch_mismatch');claimed=true;
  await tx`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['p4-writer-release',owner,entry.id])},0))`;
  if(entry.disposition==='ROLLBACK')throw Error('QUALIFICATION_WRITER_ROLLBACK');
 };
 const local=new PostgresAcademyStore(store.db,undefined,undefined,hook);
 try{
  switch(entry.family){
   case 'F2':{
    const id=entry.disposition==='COMMIT'?'W-F2-C':'W-F2-R';
    await local.registerStudent({ownerId:owner,id,displayName:'Fictional '+id,sourceKey:{namespace:'academy_student',literalKey:id},proofRefs:['root-fixed-writer-schedule']});
    if(!(await local.students(owner)).some(s=>s.id===id))throw Error('actual_f2_registration_missing');return {registered:true,id};
   }
   case 'F3':{
    const base=bindTemplate(baselineOperations.find(o=>o.id==='registration-s1')!.arguments,memory) as [Parameters<PostgresAcademyStore['append']>[0]];
    const command={...base[0],studentId:'W-F2-C',entityId:entry.id,idempotencyKey:entry.id,payload:{...base[0].payload,sourceStudent:{namespace:'academy_student',literalKey:'W-F2-C'},sourceUserCourse:{namespace:'academy_user_course',literalKey:entry.id}}} as Parameters<PostgresAcademyStore['append']>[0];
    const ack=await local.append(command);if(ack.status!=='saved')throw Error('writer_f3_noop_or_replay');return ack;
   }
   case 'F4':{
    const base=bindTemplate(baselineOperations.find(o=>o.id==='catalog-edition-a')!.arguments,memory) as [string,Parameters<PostgresAcademyStore['saveCatalog']>[1]];
    return await local.saveCatalog(owner,{...base[1],id:'W-F4-ED',sourceKey:{namespace:'academy_book',literalKey:'W-F4-ED'},label:entry.id});
   }
   case 'F6':{
    const rows=await store.db`SELECT request FROM academy.read_occurrences WHERE owner_id=${owner} AND request_id=${entry.readerRequestId}`;
    if(rows.length!==1)throw Error('genuine_service_prepared_read_binding_required');
    const request={...rows[0]!.request,requestId:entry.id} as import('../src/academy/contracts/prerequisiteRecords').ReadAdmission;
    if(entry.operation==='ADMIT')return await local.admitReadOccurrence(request);
    const pending=await store.admitReadOccurrence(request);if(pending.status!=='PENDING')throw Error('fresh_pending_metadata_occurrence_required');
    if(entry.operation==='GENERIC-CLEANUP'){
     const response=await nativePost(i,'/api/native-prerequisite',{operation:'finalizeReadOccurrence',input:{request,status:'REFUSED',snapshotDigest:null,refusalCode:'fixed-qualification-cleanup'}},String(memoryGet(memory,'memory.cookie.A')));
     if(entry.disposition==='ROLLBACK'){const original=await store.readOccurrenceLookup(request);if(original.status!=='PENDING')throw Error('cleanup_rollback_not_pending');return {status:'ROLLED_BACK',responseStatus:response.status,original};}
     if(response.status!==200||response.body.status!=='REFUSED')throw Error('genuine_generic_cleanup_required');return response.body;
    }
    return await local.finalizeReadOccurrence({request,status:'REFUSED',snapshotDigest:null,refusalCode:'fixed-qualification-finalize'});
   }
   case 'F1':{
    if(entry.operation!=='appendTeacher')return await dispatchF1Fixture(i,memory,store,entry);
    const current=await store.teacherBindingByActor(owner,String(memoryGet(memory,'native.actorA')));if(!current||current.payload.state!=='ACTIVE')throw Error('actual_current_a_teacher_required');
    for(const studentId of ['p4-fictional-student-1','p4-fictional-student-2'])if((await store.current(owner,studentId)).some(r=>r.payload.kind==='daily_record_draft'))throw Error('ROOT_JOIN_HOLD:TEACHER_MUST_PRECEDE_DRAFT_SETUP');
    const {teacherKey:_teacherKey,ownerId:_ownerId,...payload}=current.payload;
    if(payload.displayName.state!=='known')throw Error('teacher_known_display_name_required');
    const command=memoryGet(memory,'ingress.'+entry.id) as {idempotencyKey:string};if(command.idempotencyKey!==entry.id)throw Error('exact_writer_ingress_key_required');
    memory['native.teacherWriter.before']=current;
    const response=await nativePost(i,'/api/native-prerequisite',{operation:'updateTeacher',input:{command,teacherKey:current.entityKey,expectedRevisionId:current.revisionId,payload:{...payload,displayName:{...payload.displayName,value:entry.id}}}},String(memoryGet(memory,'memory.cookie.A')));
    const after=await store.teacherBindingByActor(owner,String(memoryGet(memory,'native.actorA')));
    if(entry.disposition==='ROLLBACK'){
     if(!after||canonicalJson(after)!==canonicalJson(current)||response.status<400)throw Error('teacher_rollback_head_or_horizon_changed');
     return {status:'ROLLED_BACK',beforeRevision:current.revisionId,afterRevision:after.revisionId,actualNativeWork:true};
    }
    if(response.status!==200||!after||after.revisionId===current.revisionId||after.payload.displayName.state!=='known'||after.payload.displayName.value!==entry.id)throw Error('teacher_genuine_cas_commit_required');
    // Deliberately discard the owner-consumer write acknowledgement. Recover
    // only the exact original durable proof through independent lookup; never
    // submit the write a second time or claim transport/kernel uncertainty.
    const rows=await store.db`SELECT request FROM academy.effect_fences WHERE owner_id=${owner} AND actor_id=${String(memoryGet(memory,'native.actorA'))} AND idempotency_key=${command.idempotencyKey}`;
    if(rows.length!==1)throw Error('exact_original_writer_request_required');const original=rows[0]!.request as RequestBinding;validateRequest(original);
    const recovered=await store.commandOutcomeLookup(original);
    const lookup=await nativePost(i,'/api/native-prerequisite',{operation:'commandOutcome',input:{request:original}},String(memoryGet(memory,'memory.cookie.A')));
    if(recovered.status!=='COMMITTED'||lookup.status!==200||lookup.body.status!=='COMMITTED'||canonicalJson(lookup.body.result)!==canonicalJson(recovered.result))throw Error('actual_original_writer_proof_recovery_required');
    const result=recovered.result as unknown as Record<string,unknown>,ref=nativeResultRef(result);if(ref.revision!==after.revisionId)throw Error('teacher_commit_receipt_head_mismatch');
    memory['native.commandAckRecovery']={oracle:'V-LOOKUP',caseId:entry.id,requestBindingSha256:sha256(canonicalJson(original)),proofSha256:sha256(canonicalJson(recovered.result)),writeSubmissions:1,ackDisposition:'OWNER_CONSUMER_RESULT_DISCARDED',networkDelivery:'UNKNOWN',lookupOnly:true,originalReplayed:false};
    memory['native.teacherWriter.after']=after;memory['refs.teacher-A']=ref;
    return result;
   }
  }
 }catch(error){
  if(entry.disposition==='ROLLBACK'&&claimed&&error instanceof Error&&error.message==='QUALIFICATION_WRITER_ROLLBACK')return {status:'ROLLED_BACK',operation:entry.operation,actualWorkBeforeRollback:true};
  throw error;
 }
}
/** Fixed genuine preparations happen before the paired reader is captured.
 * Preview derives the closure; the runner never assembles an approval proof. */
async function prepareWriterPrecondition(i:FixedRunnerInvocation,memory:NativeMemory,store:PostgresAcademyStore,entry:DependencyWriterCase):Promise<void>{
 if(entry.family!=='F1')return;
 if(entry.operation==='createDraft'){
  // The writer-created assessment sits in lane B's lesson scope; approval completeness
  // requires every scoped source to be attached, as appendActivityScope does for progress.
  if(!memory['writerRefs.W-F1-attachAssessmentScope-C']){
   const assessment=memoryGet(memory,'writerRefs.W-F1-correctAssessment-C') as ObjectRef;
   const row=(await store.current(i.config.base.ownerId,'p4-fictional-student-1')).find(r=>r.entityId===assessment.identity.nativeKey&&r.revisionId===assessment.revision);
   if(!row||row.payload.kind!=='previous_homework_assessment')throw Error('current_writer_assessment_required');
   const attached=await nativePost(i,'/api/native-prerequisite',{operation:'attachActivityScope',input:{command:memoryGet(memory,'ingress.W-F1-attachAssessmentScope-C'),payload:{kind:'activity_scope',schemaVersion:'2.0.0',state:'ACTIVE',activityKind:'PREVIOUS_HOMEWORK_ASSESSMENT',activityRef:assessment,recordScope:row.payload.assessmentScope,sourceLiteral:'W-F1-attachAssessmentScope-C',synthetic:true}}},String(memoryGet(memory,'memory.cookie.A')));
   if(attached.status!==200)throw Error('writer_assessment_scope_attach_required');
   memory['writerRefs.W-F1-attachAssessmentScope-C']=nativeResultRef(attached.body);
  }
  await prepareNativeProposal(memory,store,i.config.base.ownerId);await acquireFixtureSnapshot(i,memory,'B');
 }
 if(entry.operation!=='issueApproval'&&entry.operation!=='consumeApproval')return;
 const draftRef=memoryGet(memory,'writerRefs.'+(memory['writerRefs.W-F1-correctDraft-C']?'W-F1-correctDraft-C':'W-F1-createDraft-C'));
 const target=entry.operation==='consumeApproval'?entry.id:'W-F1-consumeApproval-C';
 const preview=await nativePost(i,'/api/native-prerequisite',{operation:'previewApprovalClosure',input:{command:memoryGet(memory,'ingress.'+target),draftRef}},String(memoryGet(memory,'memory.cookie.A')));
 if(preview.status!==200)throw Error('genuine_writer_approval_closure_required');
 memory['writerClosure.'+entry.id]=preview.body;
 if(entry.operation==='consumeApproval'){
  const issueId=entry.id+'-ISSUE-PRE';
  const issued=await nativePost(i,'/api/native-prerequisite',{operation:'issueApproval',input:{command:memoryGet(memory,'ingress.'+issueId),draftRef,closure:preview.body,validForSeconds:120}},String(memoryGet(memory,'memory.cookie.A')));
  if(issued.status!==200||typeof issued.body.proofHandle!=='string'||!issued.body.result)throw Error('fresh_separate_writer_issuance_required');
  const other=memory['writerIssuance.W-F1-consumeApproval-R'] as Record<string,unknown>|undefined;
  if(entry.disposition==='COMMIT'&&other?.proofHandle===issued.body.proofHandle)throw Error('writer_consume_proof_reuse_forbidden');
  memory['writerIssuance.'+entry.id]=issued.body;
 }
}
async function dispatchF1Fixture(i:FixedRunnerInvocation,memory:NativeMemory,store:PostgresAcademyStore,entry:DependencyWriterCase):Promise<unknown>{
 const command=memoryGet(memory,'ingress.'+entry.id) as {idempotencyKey:string};if(command.idempotencyKey!==entry.id)throw Error('exact_writer_ingress_key_required');
 const template=(id:string)=>(bindTemplate(baselineOperations.find(o=>o.id===id)!.body,memory) as {operation:string;input:Record<string,unknown>});
 let body:{operation:string;input:Record<string,unknown>};
 switch(entry.operation){
  case 'appendClassGroup':{
   body=template('class-main');body.input.payload={...(body.input.payload as object),displayName:{state:'known',value:entry.id,evidence:[memoryGet(memory,'evidence.fixture')]}};break;
  }
  case 'appendStudentRevision':{
   const id='W-F2-C';
   if(!(await store.students(i.config.base.ownerId)).some(s=>s.id===id))throw Error('fixed_writer_registration_precondition_required');
   body=template('student-s1-v1');body.input.studentId=id;body.input.payload={...(body.input.payload as object),displayName:{state:'known',value:entry.id,evidence:[memoryGet(memory,'evidence.fixture')]}};
   if(entry.disposition==='ROLLBACK'){const ref=memoryGet(memory,'writerRefs.W-F1-appendStudentRevision-C') as ObjectRef;body.operation='updateStudentRevision';body.input.expectedRevisionId=ref.revision;}break;
  }
  case 'appendLesson':{
   body=template('lesson-B');body.input.payload={...(body.input.payload as object),classGroupRef:memoryGet(memory,'writerRefs.W-F1-appendClassGroup-C'),occurrenceOrdinal:{state:'known',value:entry.disposition==='COMMIT'?1:2,evidence:[memoryGet(memory,'evidence.fixture')]}};break;
  }
  case 'appendTemporalBinding':{
   body=template('member-s1');body.input.payload={...(body.input.payload as object),bindingKind:entry.disposition==='COMMIT'?'CLASS_MEMBERSHIP':'ENROLLMENT',subjectRef:memoryGet(memory,'writerRefs.W-F1-appendStudentRevision-C'),targetRef:memoryGet(memory,'writerRefs.W-F1-appendClassGroup-C'),sourceLiteral:entry.id};break;
  }
  case 'createProgress':body=template('progress-B');body.input.payload={...(body.input.payload as object),note:{state:'known',value:entry.id,evidence:[memoryGet(memory,'evidence.fixture')]}};break;
  case 'createAssessment':body=template('assessment-B1');break;
  case 'correctProgress':
  case 'correctAssessment':{
   const original=entry.operation==='correctProgress'?'createProgress':'createAssessment',result=memoryGet(memory,'writerResults.W-F1-'+original+'-C') as Record<string,unknown>,ref=nativeResultRef(result);
   const row=(await store.current(i.config.base.ownerId,'p4-fictional-student-1')).find(r=>r.entityId===ref.identity.nativeKey);if(!row)throw Error('genuine_writer_correctable_head_required');
   body={operation:entry.operation,input:{studentId:row.studentId,entityId:row.entityId,expectedRevisionId:row.revisionId,payload:{...row.payload,note:{state:'known',value:entry.id,evidence:[memoryGet(memory,'evidence.fixture')]}}}};break;
  }
  case 'appendActivityScope':{
   const progress=memoryGet(memory,'writerRefs.W-F1-correctProgress-C') as ObjectRef;
   const row=(await store.current(i.config.base.ownerId,'p4-fictional-student-1')).find(r=>r.entityId===progress.identity.nativeKey&&r.revisionId===progress.revision);
   if(!row||row.payload.kind!=='daily_progress')throw Error('current_writer_progress_required');
   if(entry.disposition==='COMMIT')body={operation:'attachActivityScope',input:{payload:{kind:'activity_scope',schemaVersion:'2.0.0',state:'ACTIVE',activityKind:'DAILY_PROGRESS',activityRef:progress,recordScope:row.payload.recordScope,sourceLiteral:entry.id,synthetic:true}}};
   else{const ref=memoryGet(memory,'writerRefs.W-F1-appendActivityScope-C') as ObjectRef,current=await store.ownerRevision(i.config.base.ownerId,'scope',ref.identity.nativeKey,ref.revision);if(!current||current.payload.kind!=='activity_scope'||current.payload.state!=='ACTIVE')throw Error('dedicated_current_active_scope_required');body={operation:'correctActivityScope',input:{scopeKey:current.entityKey,expectedRevisionId:current.revisionId,payload:current.payload}};}break;
  }
  case 'appendScoreEvidence':{
   const rows=await store.scoreEvidenceForAttempt(i.config.base.ownerId,memoryGet(memory,'refs.attempt-B1') as ObjectRef<'DailyTestAttempt'>);
   if(rows.length!==1)throw Error('existing_unique_b1_score_required');const current=rows[0]!;
   body={operation:'recordScoreEvidence',input:{entityKey:current.entityKey,expectedRevisionId:current.revisionId,payload:current.payload}};break;
  }
  case 'createDraft':{
   body=template('draft-B');const p=body.input.payload as Record<string,unknown>;
   p.progressRefs={state:'known',value:memoryGet(memory,'proposal.B.progressRefs'),evidence:memoryGet(memory,'proposal.B.progressEvidence')};
   for(const field of ['homework','attempt','previousAssessment'])p[field+'Refs']={state:'known',value:memoryGet(memory,'proposal.B.'+field+'Refs'),evidence:memoryGet(memory,'proposal.B.'+field+'Evidence')};
   // At this fixed pre-baseline point B has no draft. If an existing head is
   // observed it must be an actual approved predecessor, never a DRAFT.
   const scope=p.recordScope,existing=(await store.current(i.config.base.ownerId,'p4-fictional-student-1')).filter(r=>r.payload.kind==='daily_record_draft'&&canonicalJson(r.payload.recordScope)===canonicalJson(scope));
   if(existing.length){const approved=existing.at(-1)!;if(approved.payload.kind!=='daily_record_draft'||approved.payload.draftState.state!=='known'||approved.payload.draftState.value!=='APPROVED')throw Error('writer_draft_predecessor_must_be_approved');p.supersedesDraftRef={identity:{...(memoryGet(memory,'refs.s1') as ObjectRef).identity,objectType:'DailyRecordDraft',nativeKey:approved.entityId},revision:approved.revisionId};}break;
  }
  case 'correctDraft':{
   const ref=memoryGet(memory,'writerRefs.W-F1-createDraft-C') as ObjectRef,row=(await store.current(i.config.base.ownerId,'p4-fictional-student-1')).find(r=>r.entityId===ref.identity.nativeKey);
   if(!row||row.payload.kind!=='daily_record_draft'||row.payload.draftState.state!=='known'||row.payload.draftState.value!=='DRAFT')throw Error('writer_current_draft_required');
   body={operation:'updateDraft',input:{studentId:row.studentId,entityId:row.entityId,expectedRevisionId:row.revisionId,payload:row.payload}};break;
  }
  case 'issueApproval':body={operation:'issueApproval',input:{draftRef:memoryGet(memory,'writerRefs.W-F1-correctDraft-C'),closure:memoryGet(memory,'writerClosure.'+entry.id),validForSeconds:120}};break;
  case 'revokeApproval':{
   const issued=memoryGet(memory,'writerResults.W-F1-issueApproval-C') as {approvalId:string;result:Record<string,unknown>};
   const ref=nativeResultRef(issued.result);body={operation:'revokeApproval',input:{approvalId:issued.approvalId,expectedRevisionId:ref.revision}};break;
  }
  case 'consumeApproval':{
   const issued=memoryGet(memory,'writerIssuance.'+entry.id) as {proofHandle:string};
   body={operation:'approveDraft',input:{draftRef:memoryGet(memory,'writerRefs.W-F1-correctDraft-C'),approvalProofHandle:issued.proofHandle}};break;
  }
  default:throw Error('fixed_f1_operation_required');
 }
 body.input.command=command;
 const response=await nativePost(i,'/api/native-prerequisite',body,String(memoryGet(memory,'memory.cookie.A')));
 if(entry.disposition==='ROLLBACK'){
  if(response.status<400)throw Error('writer_rollback_expected');
  return {status:'ROLLED_BACK',operation:entry.operation,responseStatus:response.status};
 }
 if(response.status!==200)throw Error('genuine_f1_writer_commit_required:'+entry.operation);
 const ref=nativeResultRef(entry.operation==='issueApproval'?response.body.result as Record<string,unknown>:response.body);memory['writerRefs.'+entry.id]=ref;memory['writerResults.'+entry.id]=response.body;return response.body;
}
/** Lower bound uses the genuine, schema-validated persisted note values that
 * the CURRENT profile publishes. Wrapper, evidence and cursor only add bytes. */
export function c07PublishedNoteLowerBound(notes:readonly unknown[]):number {
 if(notes.length!==c07FixturePolicy.count)throw Error('c07_exact100_native_notes_required');
 let bytes=0;for(const note of notes){
  if(!note||typeof note!=='object'||(note as {state?:unknown}).state!=='known'||(note as {value?:unknown}).value!=='P'.repeat(c07FixturePolicy.noteBytes))throw Error('c07_exact_persisted_note_required');
  bytes+=Buffer.byteLength(JSON.stringify((note as {value:string}).value),'utf8');
 }
 if(bytes<=c07FixturePolicy.maxOutputBytes)throw Error('c07_genuine_projection_bound_not_crossed');return bytes;
}
async function setupC07(i:FixedRunnerInvocation,memory:NativeMemory,store:PostgresAcademyStore,receipts:Record<string,unknown>[]):Promise<void>{
 if(i.config.stage!=='A1-SETUP'||i.config.base.consumerProfile!=='CURRENT_1_1')throw Error('c07_prefreeze_setup_only');
 const cookie=String(memoryGet(memory,'memory.cookie.A')),owner=i.config.base.ownerId,evidence=memoryGet(memory,'evidence.fixture');
 const call=async(id:string,operation:string,input:Record<string,unknown>)=>{
  const response=await nativePost(i,'/api/native-prerequisite',{operation,input:{...input,command:memoryGet(memory,'ingress.'+id)}},cookie);
  if(response.status!==200)throw Error('c07_setup_refusal_reconcile:'+id);
  const ref=nativeResultRef(response.body);memory['refs.'+id]=ref;receipts.push({id,status:response.status,resultSha256:response.digest,automaticRetry:false});return ref;
 };
 const students=await store.students(owner);if(!students.some(s=>s.id===c07FixturePolicy.studentId))throw Error('c07_genuine_f2_registration_required');
 const actualStudent=await store.studentRevisionCurrent(owner,c07FixturePolicy.studentId);
 const student=actualStudent?{identity:{scopeRef:actualStudent.scopeRef,namespace:actualStudent.namespace,objectType:'Student' as const,nativeKey:actualStudent.entityKey},revision:actualStudent.revisionId}:await call('W-C07-STUDENT','attachStudentRevision',{studentId:c07FixturePolicy.studentId,expectedRevisionId:null,payload:{kind:'student_record',displayName:{state:'known',value:'Fictional W-F2-C',evidence:[evidence]},enrollmentState:{state:'known',value:'ACTIVE',evidence:[evidence]}}});
 const classTemplate=baselineOperations.find(o=>o.id==='class-main')!,classInput=(bindTemplate(classTemplate.body,memory) as {input:Record<string,unknown>}).input;
 const cls=await call(c07FixturePolicy.classKey,'createClassGroup',{...classInput,payload:{...(classInput.payload as object),displayName:{state:'known',value:c07FixturePolicy.classKey,evidence:[evidence]}}});
 const lessonInput=(bindTemplate(baselineOperations.find(o=>o.id==='lesson-B')!.body,memory) as {input:Record<string,unknown>}).input;
 const lesson=await call(c07FixturePolicy.lessonKey,'createLessonSession',{...lessonInput,payload:{...(lessonInput.payload as object),classGroupRef:cls,participantRefs:{state:'known',value:[student],evidence:[evidence]}}});
 for(const [id,template,subject,target] of [
  ['W-C07-ENROLL','enroll-s1',student,cls],['W-C07-MEMBER','member-s1',student,cls],
  ['W-C07-TEACH','teach-A',cls,memoryGet(memory,'refs.teacher-A')],['W-C07-PARTICIPATE','participate-lesson-B',lesson,student],
 ] as const){
  const input=(bindTemplate(baselineOperations.find(o=>o.id===template)!.body,memory) as {input:Record<string,unknown>}).input;
  await call(id,'upsertTemporalBinding',{...input,payload:{...(input.payload as object),subjectRef:subject,targetRef:target}});
 }
 const notes:unknown[]=[];
 for(let n=1;n<=c07FixturePolicy.count;n++){
  const id='W-C07-P'+String(n).padStart(2,'0');
  const template=(bindTemplate(baselineOperations.find(o=>o.id==='progress-B')!.body,memory) as {input:Record<string,unknown>}).input;
  const recordScope={studentRef:student,classGroupRef:cls,businessDate:c07FixturePolicy.businessDate,lessonRef:lesson};
  const progress=await call(id,'createProgress',{...template,studentId:c07FixturePolicy.studentId,payload:{...(template.payload as object),sourceStudent:{namespace:'academy_student',literalKey:c07FixturePolicy.studentId},recordScope,note:{state:'known',value:'P'.repeat(c07FixturePolicy.noteBytes),evidence:[evidence]}}});
  const row=(await store.current(owner,c07FixturePolicy.studentId)).find(r=>r.entityId===progress.identity.nativeKey&&r.revisionId===progress.revision);
  if(!row||row.payload.kind!=='daily_progress')throw Error('c07_actual_progress_receipt_required');notes.push(row.payload.note);
  await call(id+'-SCOPE','attachActivityScope',{payload:{kind:'activity_scope',schemaVersion:'2.0.0',state:'ACTIVE',activityKind:'DAILY_PROGRESS',activityRef:progress,recordScope,sourceLiteral:'Fictional C07 explicit progress attachment',synthetic:true}});
 }
 const publishedNoteBytes=c07PublishedNoteLowerBound(notes);
 memory['native.c07']={student,classGroup:cls,lesson,publishedNoteBytes,notes:100,projectionField:'DailyProgress.note',maxOutputBytes:1048576};
 receipts.push({id:'C07-ARM',count:100,publishedNoteBytes,wrapperAndCursor:'ADDITIONAL_BYTES',actualRefsFromReceipts:true});
}
async function runProbe(i:FixedRunnerInvocation,memory:NativeMemory,store:PostgresAcademyStore):Promise<void> {
 const stage=i.config.stage,auth=new TeacherAuthStore(i.config.base.authFile),occurrence={expectedAuthSha256:i.config.base.authSha256!,assertOccurrence:i.assertCurrent};
 if(stage==='P-ACTOR'){
  const bFile=join(i.config.base.taskDirectory,'auth-b','web-auth.json');
  const genuineB=new TeacherAuthStore(bFile).readExistingIdentity().identity!;
  if(sha256(readFileSync(bFile))!==memoryGet(memory,'native.authHashB')||JSON.stringify(genuineB)!==JSON.stringify(memoryGet(memory,'native.identityB'))||!(await store.teacherBindingByActor(i.config.base.ownerId,genuineB.actorId)))throw Error('genuine_b0_custody_required');
  const custody=auth.substituteCoordinatedIdentityOnly(occurrence,genuineB);
  memory['private.originalA']={...custody,originalRaw:custody.originalRaw.toString('base64')};
  const login=await nativePost(i,'/api/login',{username:genuineB.username,password:memoryGet(memory,'memory.generatedPassword.B')},null);
  if(login.status!==200||!login.cookie)throw Error('genuine_b_login_on_live_a_required');memory['memory.cookie.BOnA']=login.cookie;return;
 }
 if(stage==='RESTORE-A'){
  const privateCustody=memoryGet(memory,'private.originalA') as Omit<CoordinatedIdentityCustody,'originalRaw'>&{originalRaw:string};
  auth.restoreCoordinatedIdentityOnly(occurrence,{...privateCustody,originalRaw:Buffer.from(privateCustody.originalRaw,'base64')});delete memory['private.originalA'];
  const identity=auth.readExistingIdentity().identity!,login=await nativePost(i,'/api/login',{username:identity.username,password:memoryGet(memory,'memory.generatedPassword.A')},null);
  if(login.status!==200||!login.cookie)throw Error('genuine_a_login_after_restore_required');memory['memory.cookie.A']=login.cookie;delete memory['memory.cookie.BOnA'];return;
 }
 if(stage==='A1-DETACH'){
  const ref=memoryGet(memory,'scopeRefs.work-A') as ObjectRef;
  const before=await store.ownerRevision(i.config.base.ownerId,'scope',ref.identity.nativeKey,ref.revision);
  if(!before||before.payload.kind!=='activity_scope')throw Error('native_scope_head_required');
  const response=await nativePost(i,'/api/native-prerequisite',{operation:'correctActivityScope',input:{command:memoryGet(memory,'ingress.G4-detach'),scopeKey:ref.identity.nativeKey,expectedRevisionId:ref.revision,payload:{...before.payload,schemaVersion:'2.0.0',state:'DETACHED'}}},String(memoryGet(memory,'memory.cookie.A')));
  if(response.status!==200)throw Error('detach_reconcile_no_replay');
  const result=response.body;if(!Array.isArray((result.receipt as Record<string,unknown>)?.changedLinks)||!(result.receipt as {changedLinks:{after:string}[]}).changedLinks.some(x=>x.after==='ABSENT'))throw Error('native_detach_absence_receipt_required');
  memory['scopeRefs.work-A']=nativeResultRef(result);return;
 }
 if(stage==='P-SNAPSHOT'){
  memory['measurement.snapshotBeforeStudent']=structuredClone(memoryGet(memory,'measurement.validAContinuation'));
  const current=await store.studentRevisionCurrent(i.config.base.ownerId,'p4-fictional-student-1');if(!current)throw Error('native_student_head_required');
  const response=await nativePost(i,'/api/native-prerequisite',{operation:'updateStudentRevision',input:{command:memoryGet(memory,'ingress.P-SNAPSHOT'),studentId:'p4-fictional-student-1',expectedRevisionId:current.revisionId,payload:{...current.payload,displayName:{state:'known',value:'Fictional Student 1 snapshot successor',evidence:[memoryGet(memory,'evidence.fixture')]}}}},String(memoryGet(memory,'memory.cookie.A')));
  if(response.status!==200)throw Error('snapshot_probe_reconcile_no_replay');memory['refs.s1']=nativeResultRef(response.body);return;
 }
 if(stage==='P-RETIRE-A'){
  // Update input omits the store-assigned identity fields (teacherKey/ownerId); sending them is identity minting.
  const bound=await store.teacherBindingByActor(i.config.base.ownerId,String(memoryGet(memory,'native.actorA')));if(!bound)throw Error('native_teacher_required');
  const response=await nativePost(i,'/api/native-prereq/teachers/update',{command:memoryGet(memory,'ingress.P-RETIRE-A'),teacherKey:bound.entityKey,expectedRevisionId:bound.revisionId,payload:(({teacherKey:_k,ownerId:_o,...rest})=>({...rest,state:'RETIRED'}))(bound.payload as unknown as Record<string,unknown>)},String(memoryGet(memory,'memory.cookie.A')));
  if(response.status!==200)throw Error('retirement_reconcile_no_replay');
  const controls=memoryGet(memory,'measurement.actorControls') as import('../src/academy/nativeTypedRead').TypedReadRequest[];
  if(controls.length!==3)throw Error('independent_retirement_controls_required');
  const denied=[];
  for(const control of controls){
   const request=structuredClone(control);request.requestId=crypto.randomUUID();request.functionRequest.requestId=crypto.randomUUID();
   const reply=await nativePost(i,'/api/typed-read',request,String(memoryGet(memory,'memory.cookie.A')));
   if(reply.status!==403||Object.hasOwn(reply.body,'items')||Object.hasOwn(reply.body,'nextCursor')||Object.hasOwn(reply.body,'gaps'))throw Error('retirement_current_denial_required');
   denied.push({status:reply.status,requestId:request.requestId,sha256:reply.digest});
  }
  memory['measurement.retirementDenials']=denied;return;
 }
 throw Error('fixed_probe_stage_required');
}
export async function produceNativeFixtures(i:FixedRunnerInvocation):Promise<void> {
 assertFixedRunner(i,'FIXTURE');const memory=await readNativeMemory(i),c=i.config.base;
 if(memoryGet(memory,'root.ownerId')!==c.ownerId||memoryGet(memory,'root.namespace')!=='p4-qualification-e2e-p4-native-20261027-66')throw Error('root_selected_fixture_scope_required');
 validateRootBindingMemory(i,memory);
 const [{SQL},{PostgresAcademyStore}]=await Promise.all([import('bun'),import('../src/academy/postgresStore')]);i.claim();
 const db=new SQL({adapter:'postgres',path:c.provider.socket,username:c.provider.username,database:c.provider.database,max:5});
 try{
  const store=new PostgresAcademyStore(db);await store.assertRuntimeReady();rootSubmissionReaders.set(i,store);const receipts:Record<string,unknown>[]=[];
  if(i.config.stage==='A1-DETACH'){const identity=new TeacherAuthStore(c.authFile).readExistingIdentity().identity!;const login=await nativePost(i,'/api/login',{username:identity.username,password:memoryGet(memory,'memory.generatedPassword.A')},null);if(login.status!==200||!login.cookie)throw Error('genuine_a_login_outside_read_windows_required');memory['memory.cookie.A']=login.cookie;}

  if(i.config.stage==='A1-SETUP')await runDependencyWriterSchedule(i,memory,db,store,receipts);
  if(['A0','B0','A1-SETUP'].includes(i.config.stage))await runBaseline(i,memory,store,receipts);else await runProbe(i,memory,store);
  const commands=await settleNativeCommands(i,memory,db,store);
  if(['A0','B0','A1-SETUP'].includes(i.config.stage))memory['native.setupReceipts']=[...(memory['native.setupReceipts'] as unknown[]??[]),...receipts];
  if(i.config.stage==='A0'){
   if(!i.config.helperStartReceipt||!i.config.liveHelper)throw Error('actual_a0_helper_required');
   memory['native.authLeaseReceipts']=['consumeInvitation','registerIdentity'].map(operation=>{
    const raw=readFileSync(join(dirname(i.config.helperStartReceipt!.path),'auth-lease-'+operation+'.json')),value=JSON.parse(raw.toString('utf8'));
    if(value.schema!=='auth-lease-no-write-probe.v1'||value.operation!==operation||value.runId!==c.runId||value.sourceSetSha256!==c.sourceSet.sha256||value.pid!==i.config.liveHelper!.pid||value.startTicks!==i.config.liveHelper!.startTicks||value.beforeSha256!==value.afterSha256||value.businessWrites!==0||value.refusal!=='private_auth_lock_required')throw Error('actual_no_write_auth_lease_receipt_required');
    return {operation,sha256:sha256(raw),beforeSha256:value.beforeSha256,afterSha256:value.afterSha256,pid:value.pid,startTicks:value.startTicks,businessWrites:0};
   });
  }
  if(i.config.stage==='A1-SETUP'){
   const scope=memoryGet(memory,'scopeRefs.work-A') as ObjectRef,history=await store.ownerHistory(c.ownerId,'scope',scope.identity.nativeKey);
   const last=history.at(-1);if(!last||last.revisionId!==scope.revision||last.payload.kind!=='activity_scope'||last.payload.state!=='ACTIVE')throw Error('g4_actual_frozen_active_history_required');
   memory['native.g4FrozenHistory']=history.map(v=>({revisionId:v.revisionId,sha256:sha256(canonicalJson(v))}));
  }
  if(i.config.stage==='A1-SETUP')pruneSetupOnlyMemory(memory);
  writeNativeMemory(i.config.output.writeFd,memory);
  writeExclusivePrivateJson(join(c.metadataDirectory,'fixture-finished.json'),{schema:'fixed-native-fixture-finished.v1',stage:i.config.stage,runId:c.runId,ownerId:c.ownerId,occurrenceId:c.occurrenceId,pid:process.pid,startTicks:c.executor.startTicks,sourceSetSha256:c.sourceSet.sha256,commands,pendingHttp:0,receipts,retirementDenials:memory['measurement.retirementDenials']??null,secretCustody:'RAM_ANONYMOUS_PIPE_ONLY',automaticRetry:false});
 }finally{await db.close();}
}
// Immutable source templates below; no operation or API is accepted from input.
const baselineOperations:readonly OperationTemplate[]=[{"id":"A-invite","phase":"A0","transport":"HTTP","body":{"invitation":{"$bind":"memory.invitation.A"}},"capture":"memory.setupCookie.A"},{"id":"A-setup","phase":"A0","transport":"HTTP","body":{"username":"p4-fictional-teacher-a","password":{"$bind":"memory.generatedPassword.A"}},"capture":"native allocated actorA; capture only through genuine native response/owner minimized metadata"},{"id":"A-login","phase":"A0","transport":"HTTP","body":{"username":"p4-fictional-teacher-a","password":{"$bind":"memory.generatedPassword.A"}},"capture":"memory.cookie.A"},{"id":"bind-A","phase":"A0","transport":"HTTP","body":{"operation":"bindTeacher","input":{"command":{"$bind":"ingress.bind-A"},"payload":{"kind":"teacher_binding","actorId":{"$bind":"native.actorA"},"teacherSourceKey":{"namespace":"synthetic_teacher","literalKey":"p4-fictional-teacher-a"},"displayName":{"state":"known","value":"Fictional Teacher A","evidence":[{"$bind":"evidence.fixture"}]},"assignmentState":{"state":"known","value":"ACTIVE","evidence":[{"$bind":"evidence.fixture"}]},"validFrom":"2024-01-01","validTo":null,"state":"ACTIVE","synthetic":true}}},"expectedOutcome":"saved","capture":"refs.teacher-A from NativeWriteResult.identity + revisionId"},{"id":"B-invite","phase":"B0","transport":"HTTP","body":{"invitation":{"$bind":"memory.invitation.B"}},"capture":"memory.setupCookie.B"},{"id":"B-setup","phase":"B0","transport":"HTTP","body":{"username":"p4-fictional-teacher-b","password":{"$bind":"memory.generatedPassword.B"}},"capture":"native allocated actorB; capture only through genuine native response/owner minimized metadata"},{"id":"B-login","phase":"B0","transport":"HTTP","body":{"username":"p4-fictional-teacher-b","password":{"$bind":"memory.generatedPassword.B"}},"capture":"memory.cookie.B"},{"id":"B-never-bound","phase":"B0","transport":"HTTP","body":{"operation":"classGroups","input":{}},"expectedOutcome":"teacher_binding_required"},{"id":"bind-B","phase":"B0","transport":"HTTP","body":{"operation":"bindTeacher","input":{"command":{"$bind":"ingress.bind-B"},"payload":{"kind":"teacher_binding","actorId":{"$bind":"native.actorB"},"teacherSourceKey":{"namespace":"synthetic_teacher","literalKey":"p4-fictional-teacher-b"},"displayName":{"state":"known","value":"Fictional Teacher B","evidence":[{"$bind":"evidence.fixture"}]},"assignmentState":{"state":"known","value":"ACTIVE","evidence":[{"$bind":"evidence.fixture"}]},"validFrom":"2024-01-01","validTo":null,"state":"ACTIVE","synthetic":true}}},"expectedOutcome":"saved","capture":"refs.teacher-B from NativeWriteResult.identity + revisionId"},{"id":"register-s1","phase":"A0","transport":"DIRECT_REAL_NATIVE_STORE_UNDER_G_SETUP_STORE","api":"PostgresAcademyStore.registerStudent","arguments":[{"ownerId":{"$bind":"root.ownerId"},"id":"p4-fictional-student-1","displayName":"Fictional Student 1","sourceKey":{"namespace":"academy_student","literalKey":"p4-fictional-student-1"},"proofRefs":["p4-fictional-fixture-v1"]}],"expectedOutcome":"one fictional write or exact native refusal only"},{"id":"student-s1-v1","phase":"A0","transport":"HTTP","body":{"operation":"attachStudentRevision","input":{"command":{"$bind":"ingress.student-s1-v1"},"studentId":"p4-fictional-student-1","expectedRevisionId":null,"payload":{"kind":"student_record","displayName":{"state":"known","value":"Fictional Student 1","evidence":[{"$bind":"evidence.fixture"}]},"enrollmentState":{"state":"known","value":"ACTIVE","evidence":[{"$bind":"evidence.fixture"}]}}}},"expectedOutcome":"saved","capture":"refs.s1 from native result; revision must be student_record head"},{"id":"student-s1-v2","phase":"A0","transport":"HTTP","body":{"operation":"updateStudentRevision","input":{"command":{"$bind":"ingress.student-s1-v2"},"studentId":"p4-fictional-student-1","expectedRevisionId":{"$bind":"results.student-s1-v1.revisionId"},"payload":{"kind":"student_record","displayName":{"state":"known","value":"Fictional Student 1 corrected","evidence":[{"$bind":"evidence.fixture"}]},"enrollmentState":{"state":"known","value":"ACTIVE","evidence":[{"$bind":"evidence.fixture"}]}}}},"expectedOutcome":"saved","capture":"refs.s1 replaces old v1 before any lesson/temporal/activity refs are allocated"},{"id":"register-s2","phase":"A0","transport":"DIRECT_REAL_NATIVE_STORE_UNDER_G_SETUP_STORE","api":"PostgresAcademyStore.registerStudent","arguments":[{"ownerId":{"$bind":"root.ownerId"},"id":"p4-fictional-student-2","displayName":"Fictional Student 2","sourceKey":{"namespace":"academy_student","literalKey":"p4-fictional-student-2"},"proofRefs":["p4-fictional-fixture-v1"]}],"expectedOutcome":"one fictional write or exact native refusal only"},{"id":"student-s2-v1","phase":"A0","transport":"HTTP","body":{"operation":"attachStudentRevision","input":{"command":{"$bind":"ingress.student-s2-v1"},"studentId":"p4-fictional-student-2","expectedRevisionId":null,"payload":{"kind":"student_record","displayName":{"state":"known","value":"Fictional Student 2","evidence":[{"$bind":"evidence.fixture"}]},"enrollmentState":{"state":"known","value":"ACTIVE","evidence":[{"$bind":"evidence.fixture"}]}}}},"expectedOutcome":"saved","capture":"refs.s2 from native result; revision must be student_record head"},{"id":"class-main","phase":"A0","transport":"HTTP","body":{"operation":"createClassGroup","input":{"command":{"$bind":"ingress.class-main"},"payload":{"kind":"class_group","displayName":{"state":"known","value":"Fictional class-main","evidence":[{"$bind":"evidence.fixture"}]},"businessTimezone":{"state":"known","value":"Asia/Seoul","evidence":[{"$bind":"evidence.fixture"}]},"classState":{"state":"known","value":"ACTIVE","evidence":[{"$bind":"evidence.fixture"}]},"synthetic":true}}},"expectedOutcome":"saved","capture":"refs.class-main"},{"id":"class-unknown","phase":"A0","transport":"HTTP","body":{"operation":"createClassGroup","input":{"command":{"$bind":"ingress.class-unknown"},"payload":{"kind":"class_group","displayName":{"state":"known","value":"Fictional class-unknown","evidence":[{"$bind":"evidence.fixture"}]},"businessTimezone":{"state":"unknown","reason":"UNVERIFIED","evidence":[],"requiredEvidence":["BUSINESS_CALENDAR"]},"classState":{"state":"known","value":"ACTIVE","evidence":[{"$bind":"evidence.fixture"}]},"synthetic":true}}},"expectedOutcome":"saved","capture":"refs.class-unknown"},{"id":"catalog-edition-a","phase":"A0","transport":"DIRECT_REAL_NATIVE_STORE_UNDER_G_SETUP_STORE","api":"PostgresAcademyStore.saveCatalog","arguments":[{"$bind":"root.ownerId"},{"id":"p4-fictional-edition-a","kind":"book_edition","sourceKey":{"namespace":"academy_book","literalKey":"p4-fictional-edition-a"},"label":"Identical Fictional Edition","parent":{"state":"unknown","reason":"root has no parent"},"bookIdentity":{"series":"gauss","schoolStage":"elementary","grade":3,"term":1,"volume":1,"evidenceRefs":["p4-fictional-fixture-v1"]}}],"expectedOutcome":"one fictional write or exact native refusal only","capture":"catalogPins.edition-a={nodeId,returned revisionId,sequence,contentDigest}; construct refs only from successful readback plus root scope"},{"id":"catalog-edition-b","phase":"A0","transport":"DIRECT_REAL_NATIVE_STORE_UNDER_G_SETUP_STORE","api":"PostgresAcademyStore.saveCatalog","arguments":[{"$bind":"root.ownerId"},{"id":"p4-fictional-edition-b","kind":"book_edition","sourceKey":{"namespace":"academy_book","literalKey":"p4-fictional-edition-b"},"label":"Identical Fictional Edition","parent":{"state":"unknown","reason":"root has no parent"},"bookIdentity":{"series":"gauss","schoolStage":"elementary","grade":3,"term":1,"volume":1,"evidenceRefs":["p4-fictional-fixture-v1"]}}],"expectedOutcome":"one fictional write or exact native refusal only","capture":"catalogPins.edition-b={nodeId,returned revisionId,sequence,contentDigest}; construct refs only from successful readback plus root scope"},{"id":"catalog-major","phase":"A0","transport":"DIRECT_REAL_NATIVE_STORE_UNDER_G_SETUP_STORE","api":"PostgresAcademyStore.saveCatalog","arguments":[{"$bind":"root.ownerId"},{"id":"p4-fictional-major","kind":"major_unit","sourceKey":{"namespace":"academy_catalog","literalKey":"p4-fictional-major"},"label":"Fictional major","parent":{"state":"known","value":"p4-fictional-edition-a","evidenceRefs":["p4-fictional-fixture-v1"]}}],"expectedOutcome":"one fictional write or exact native refusal only","capture":"catalogPins.major={nodeId,returned revisionId,sequence,contentDigest}; construct refs only from successful readback plus root scope"},{"id":"catalog-middle","phase":"A0","transport":"DIRECT_REAL_NATIVE_STORE_UNDER_G_SETUP_STORE","api":"PostgresAcademyStore.saveCatalog","arguments":[{"$bind":"root.ownerId"},{"id":"p4-fictional-middle","kind":"middle_unit","sourceKey":{"namespace":"academy_catalog","literalKey":"p4-fictional-middle"},"label":"Fictional middle","parent":{"state":"known","value":"p4-fictional-major","evidenceRefs":["p4-fictional-fixture-v1"]}}],"expectedOutcome":"one fictional write or exact native refusal only","capture":"catalogPins.middle={nodeId,returned revisionId,sequence,contentDigest}; construct refs only from successful readback plus root scope"},{"id":"catalog-minor","phase":"A0","transport":"DIRECT_REAL_NATIVE_STORE_UNDER_G_SETUP_STORE","api":"PostgresAcademyStore.saveCatalog","arguments":[{"$bind":"root.ownerId"},{"id":"p4-fictional-minor","kind":"minor_unit","sourceKey":{"namespace":"academy_catalog","literalKey":"p4-fictional-minor"},"label":"Fictional minor","parent":{"state":"known","value":"p4-fictional-middle","evidenceRefs":["p4-fictional-fixture-v1"]}}],"expectedOutcome":"one fictional write or exact native refusal only","capture":"catalogPins.minor={nodeId,returned revisionId,sequence,contentDigest}; construct refs only from successful readback plus root scope"},{"id":"catalog-section-major","phase":"A0","transport":"DIRECT_REAL_NATIVE_STORE_UNDER_G_SETUP_STORE","api":"PostgresAcademyStore.saveCatalog","arguments":[{"$bind":"root.ownerId"},{"id":"p4-fictional-section-major","kind":"learning_section","sourceKey":{"namespace":"academy_catalog","literalKey":"p4-fictional-section-major"},"label":"Fictional section-major","parent":{"state":"known","value":"p4-fictional-major","evidenceRefs":["p4-fictional-fixture-v1"]}}],"expectedOutcome":"one fictional write or exact native refusal only","capture":"catalogPins.section-major={nodeId,returned revisionId,sequence,contentDigest}; construct refs only from successful readback plus root scope"},{"id":"catalog-section-middle","phase":"A0","transport":"DIRECT_REAL_NATIVE_STORE_UNDER_G_SETUP_STORE","api":"PostgresAcademyStore.saveCatalog","arguments":[{"$bind":"root.ownerId"},{"id":"p4-fictional-section-middle","kind":"learning_section","sourceKey":{"namespace":"academy_catalog","literalKey":"p4-fictional-section-middle"},"label":"Fictional section-middle","parent":{"state":"known","value":"p4-fictional-middle","evidenceRefs":["p4-fictional-fixture-v1"]}}],"expectedOutcome":"one fictional write or exact native refusal only","capture":"catalogPins.section-middle={nodeId,returned revisionId,sequence,contentDigest}; construct refs only from successful readback plus root scope"},{"id":"catalog-section-minor","phase":"A0","transport":"DIRECT_REAL_NATIVE_STORE_UNDER_G_SETUP_STORE","api":"PostgresAcademyStore.saveCatalog","arguments":[{"$bind":"root.ownerId"},{"id":"p4-fictional-section-minor","kind":"learning_section","sourceKey":{"namespace":"academy_catalog","literalKey":"p4-fictional-section-minor"},"label":"Fictional section-minor","parent":{"state":"known","value":"p4-fictional-minor","evidenceRefs":["p4-fictional-fixture-v1"]}}],"expectedOutcome":"one fictional write or exact native refusal only","capture":"catalogPins.section-minor={nodeId,returned revisionId,sequence,contentDigest}; construct refs only from successful readback plus root scope"},{"id":"catalog-page","phase":"A0","transport":"DIRECT_REAL_NATIVE_STORE_UNDER_G_SETUP_STORE","api":"PostgresAcademyStore.saveCatalog","arguments":[{"$bind":"root.ownerId"},{"id":"p4-fictional-page","kind":"printed_page","sourceKey":{"namespace":"academy_catalog","literalKey":"p4-fictional-page"},"label":"Fictional page","parent":{"state":"known","value":"p4-fictional-section-minor","evidenceRefs":["p4-fictional-fixture-v1"]}}],"expectedOutcome":"one fictional write or exact native refusal only","capture":"catalogPins.page={nodeId,returned revisionId,sequence,contentDigest}; construct refs only from successful readback plus root scope"},{"id":"catalog-problem","phase":"A0","transport":"DIRECT_REAL_NATIVE_STORE_UNDER_G_SETUP_STORE","api":"PostgresAcademyStore.saveCatalog","arguments":[{"$bind":"root.ownerId"},{"id":"p4-fictional-problem","kind":"problem","sourceKey":{"namespace":"academy_catalog","literalKey":"p4-fictional-problem"},"label":"Fictional problem","parent":{"state":"known","value":"p4-fictional-page","evidenceRefs":["p4-fictional-fixture-v1"]}}],"expectedOutcome":"one fictional write or exact native refusal only","capture":"catalogPins.problem={nodeId,returned revisionId,sequence,contentDigest}; construct refs only from successful readback plus root scope"},{"id":"lesson-A","phase":"A0","transport":"HTTP","body":{"operation":"createLessonSession","input":{"command":{"$bind":"ingress.lesson-A"},"payload":{"kind":"lesson_session","classGroupRef":{"$bind":"refs.class-main"},"businessDate":"2026-10-23","occurrenceOrdinal":{"state":"known","value":1,"evidence":[{"$bind":"evidence.fixture"}]},"startsAt":{"state":"known","value":"2026-10-23T00:00:00Z","evidence":[{"$bind":"evidence.fixture"}]},"endsAt":{"state":"known","value":"2026-10-23T01:00:00Z","evidence":[{"$bind":"evidence.fixture"}]},"teacherRefs":{"state":"known","value":[{"$bind":"refs.teacher-A"}],"evidence":[{"$bind":"evidence.fixture"}]},"participantRefs":{"state":"known","value":[{"$bind":"refs.s1"}],"evidence":[{"$bind":"evidence.fixture"}]},"lessonState":{"state":"known","value":"HELD","evidence":[{"$bind":"evidence.fixture"}]},"synthetic":true}}},"expectedOutcome":"saved","capture":"refs.lesson-A"},{"id":"lesson-B","phase":"A0","transport":"HTTP","body":{"operation":"createLessonSession","input":{"command":{"$bind":"ingress.lesson-B"},"payload":{"kind":"lesson_session","classGroupRef":{"$bind":"refs.class-main"},"businessDate":"2026-10-23","occurrenceOrdinal":{"state":"known","value":2,"evidence":[{"$bind":"evidence.fixture"}]},"startsAt":{"state":"known","value":"2026-10-23T02:00:00Z","evidence":[{"$bind":"evidence.fixture"}]},"endsAt":{"state":"known","value":"2026-10-23T03:00:00Z","evidence":[{"$bind":"evidence.fixture"}]},"teacherRefs":{"state":"known","value":[{"$bind":"refs.teacher-A"}],"evidence":[{"$bind":"evidence.fixture"}]},"participantRefs":{"state":"known","value":[{"$bind":"refs.s1"}],"evidence":[{"$bind":"evidence.fixture"}]},"lessonState":{"state":"known","value":"HELD","evidence":[{"$bind":"evidence.fixture"}]},"synthetic":true}}},"expectedOutcome":"saved","capture":"refs.lesson-B"},{"id":"lesson-negative","phase":"A0","transport":"HTTP","body":{"operation":"createLessonSession","input":{"command":{"$bind":"ingress.lesson-negative"},"payload":{"kind":"lesson_session","classGroupRef":{"$bind":"refs.class-main"},"businessDate":"2026-10-23","occurrenceOrdinal":{"state":"known","value":3,"evidence":[{"$bind":"evidence.fixture"}]},"startsAt":{"state":"known","value":"2026-10-23T04:00:00Z","evidence":[{"$bind":"evidence.fixture"}]},"endsAt":{"state":"known","value":"2026-10-23T05:00:00Z","evidence":[{"$bind":"evidence.fixture"}]},"teacherRefs":{"state":"known","value":[{"$bind":"refs.teacher-A"}],"evidence":[{"$bind":"evidence.fixture"}]},"participantRefs":{"state":"known","value":[{"$bind":"refs.s2"}],"evidence":[{"$bind":"evidence.fixture"}]},"lessonState":{"state":"known","value":"HELD","evidence":[{"$bind":"evidence.fixture"}]},"synthetic":true}}},"expectedOutcome":"saved","capture":"refs.lesson-negative"},{"id":"lesson-scheduled","phase":"A0","transport":"HTTP","body":{"operation":"createLessonSession","input":{"command":{"$bind":"ingress.lesson-scheduled"},"payload":{"kind":"lesson_session","classGroupRef":{"$bind":"refs.class-main"},"businessDate":"2026-10-24","occurrenceOrdinal":{"state":"known","value":1,"evidence":[{"$bind":"evidence.fixture"}]},"startsAt":{"state":"unknown","reason":"UNVERIFIED","evidence":[],"requiredEvidence":["SOURCE_FIELD"]},"endsAt":{"state":"unknown","reason":"UNVERIFIED","evidence":[],"requiredEvidence":["SOURCE_FIELD"]},"teacherRefs":{"state":"known","value":[{"$bind":"refs.teacher-A"}],"evidence":[{"$bind":"evidence.fixture"}]},"participantRefs":{"state":"known","value":[{"$bind":"refs.s2"}],"evidence":[{"$bind":"evidence.fixture"}]},"lessonState":{"state":"known","value":"SCHEDULED","evidence":[{"$bind":"evidence.fixture"}]},"synthetic":true}}},"expectedOutcome":"saved","capture":"refs.lesson-scheduled"},{"id":"lesson-cancelled","phase":"A0","transport":"HTTP","body":{"operation":"createLessonSession","input":{"command":{"$bind":"ingress.lesson-cancelled"},"payload":{"kind":"lesson_session","classGroupRef":{"$bind":"refs.class-main"},"businessDate":"2026-10-25","occurrenceOrdinal":{"state":"known","value":1,"evidence":[{"$bind":"evidence.fixture"}]},"startsAt":{"state":"unknown","reason":"UNVERIFIED","evidence":[],"requiredEvidence":["SOURCE_FIELD"]},"endsAt":{"state":"unknown","reason":"UNVERIFIED","evidence":[],"requiredEvidence":["SOURCE_FIELD"]},"teacherRefs":{"state":"known","value":[{"$bind":"refs.teacher-A"}],"evidence":[{"$bind":"evidence.fixture"}]},"participantRefs":{"state":"known","value":[{"$bind":"refs.s2"}],"evidence":[{"$bind":"evidence.fixture"}]},"lessonState":{"state":"known","value":"CANCELLED","evidence":[{"$bind":"evidence.fixture"}]},"synthetic":true}}},"expectedOutcome":"saved","capture":"refs.lesson-cancelled"},{"id":"lesson-participants-unknown","phase":"A0","transport":"HTTP","body":{"operation":"createLessonSession","input":{"command":{"$bind":"ingress.lesson-participants-unknown"},"payload":{"kind":"lesson_session","classGroupRef":{"$bind":"refs.class-main"},"businessDate":"2026-10-26","occurrenceOrdinal":{"state":"known","value":1,"evidence":[{"$bind":"evidence.fixture"}]},"startsAt":{"state":"unknown","reason":"UNVERIFIED","evidence":[],"requiredEvidence":["SOURCE_FIELD"]},"endsAt":{"state":"unknown","reason":"UNVERIFIED","evidence":[],"requiredEvidence":["SOURCE_FIELD"]},"teacherRefs":{"state":"known","value":[{"$bind":"refs.teacher-A"}],"evidence":[{"$bind":"evidence.fixture"}]},"participantRefs":{"state":"unknown","reason":"UNVERIFIED","evidence":[],"requiredEvidence":["COMPLETE_COLLECTION"]},"lessonState":{"state":"known","value":"SCHEDULED","evidence":[{"$bind":"evidence.fixture"}]},"synthetic":true}}},"expectedOutcome":"saved","capture":"refs.lesson-participants-unknown"},{"id":"enroll-s1","phase":"A0","transport":"HTTP","body":{"operation":"upsertTemporalBinding","input":{"command":{"$bind":"ingress.enroll-s1"},"bindingKey":null,"expectedRevisionId":null,"payload":{"kind":"temporal_binding","bindingKind":"ENROLLMENT","subjectRef":{"$bind":"refs.s1"},"targetRef":{"$bind":"refs.class-main"},"validFrom":"2026-10-01","validTo":"2026-10-24","sourceLiteral":"Fictional explicit interval enroll-s1","synthetic":true}}},"expectedOutcome":"saved","capture":"refs.enroll-s1"},{"id":"member-s1","phase":"A0","transport":"HTTP","body":{"operation":"upsertTemporalBinding","input":{"command":{"$bind":"ingress.member-s1"},"bindingKey":null,"expectedRevisionId":null,"payload":{"kind":"temporal_binding","bindingKind":"CLASS_MEMBERSHIP","subjectRef":{"$bind":"refs.s1"},"targetRef":{"$bind":"refs.class-main"},"validFrom":"2026-10-01","validTo":"2026-10-24","sourceLiteral":"Fictional explicit interval member-s1","synthetic":true}}},"expectedOutcome":"saved","capture":"refs.member-s1"},{"id":"member-s1-adjacent","phase":"A0","transport":"HTTP","body":{"operation":"upsertTemporalBinding","input":{"command":{"$bind":"ingress.member-s1-adjacent"},"bindingKey":null,"expectedRevisionId":null,"payload":{"kind":"temporal_binding","bindingKind":"CLASS_MEMBERSHIP","subjectRef":{"$bind":"refs.s1"},"targetRef":{"$bind":"refs.class-main"},"validFrom":"2026-10-24","validTo":null,"sourceLiteral":"Fictional explicit interval member-s1-adjacent","synthetic":true}}},"expectedOutcome":"saved","capture":"refs.member-s1-adjacent"},{"id":"teach-A","phase":"A0","transport":"HTTP","body":{"operation":"upsertTemporalBinding","input":{"command":{"$bind":"ingress.teach-A"},"bindingKey":null,"expectedRevisionId":null,"payload":{"kind":"temporal_binding","bindingKind":"TEACHING_ASSIGNMENT","subjectRef":{"$bind":"refs.class-main"},"targetRef":{"$bind":"refs.teacher-A"},"validFrom":"2024-01-01","validTo":null,"sourceLiteral":"Fictional explicit interval teach-A","synthetic":true}}},"expectedOutcome":"saved","capture":"refs.teach-A"},{"id":"enroll-s2","phase":"A0","transport":"HTTP","body":{"operation":"upsertTemporalBinding","input":{"command":{"$bind":"ingress.enroll-s2"},"bindingKey":null,"expectedRevisionId":null,"payload":{"kind":"temporal_binding","bindingKind":"ENROLLMENT","subjectRef":{"$bind":"refs.s2"},"targetRef":{"$bind":"refs.class-main"},"validFrom":"2026-10-01","validTo":null,"sourceLiteral":"Fictional explicit interval enroll-s2","synthetic":true}}},"expectedOutcome":"saved","capture":"refs.enroll-s2"},{"id":"member-s2","phase":"A0","transport":"HTTP","body":{"operation":"upsertTemporalBinding","input":{"command":{"$bind":"ingress.member-s2"},"bindingKey":null,"expectedRevisionId":null,"payload":{"kind":"temporal_binding","bindingKind":"CLASS_MEMBERSHIP","subjectRef":{"$bind":"refs.s2"},"targetRef":{"$bind":"refs.class-main"},"validFrom":"2026-10-01","validTo":null,"sourceLiteral":"Fictional explicit interval member-s2","synthetic":true}}},"expectedOutcome":"saved","capture":"refs.member-s2"},{"id":"leap-enroll","phase":"A0","transport":"HTTP","body":{"operation":"upsertTemporalBinding","input":{"command":{"$bind":"ingress.leap-enroll"},"bindingKey":null,"expectedRevisionId":null,"payload":{"kind":"temporal_binding","bindingKind":"ENROLLMENT","subjectRef":{"$bind":"refs.s2"},"targetRef":{"$bind":"refs.class-unknown"},"validFrom":"2024-02-28","validTo":"2024-03-01","sourceLiteral":"Fictional explicit interval leap-enroll","synthetic":true}}},"expectedOutcome":"saved","capture":"refs.leap-enroll"},{"id":"participate-lesson-A","phase":"A0","transport":"HTTP","body":{"operation":"upsertTemporalBinding","input":{"command":{"$bind":"ingress.participate-lesson-A"},"bindingKey":null,"expectedRevisionId":null,"payload":{"kind":"temporal_binding","bindingKind":"LESSON_PARTICIPATION","subjectRef":{"$bind":"refs.lesson-A"},"targetRef":{"$bind":"refs.s1"},"validFrom":"2026-10-23","validTo":"2026-10-24","sourceLiteral":"Fictional explicit interval participate-lesson-A","synthetic":true}}},"expectedOutcome":"saved","capture":"refs.participate-lesson-A"},{"id":"participate-lesson-B","phase":"A0","transport":"HTTP","body":{"operation":"upsertTemporalBinding","input":{"command":{"$bind":"ingress.participate-lesson-B"},"bindingKey":null,"expectedRevisionId":null,"payload":{"kind":"temporal_binding","bindingKind":"LESSON_PARTICIPATION","subjectRef":{"$bind":"refs.lesson-B"},"targetRef":{"$bind":"refs.s1"},"validFrom":"2026-10-23","validTo":"2026-10-24","sourceLiteral":"Fictional explicit interval participate-lesson-B","synthetic":true}}},"expectedOutcome":"saved","capture":"refs.participate-lesson-B"},{"id":"participate-lesson-negative","phase":"A0","transport":"HTTP","body":{"operation":"upsertTemporalBinding","input":{"command":{"$bind":"ingress.participate-lesson-negative"},"bindingKey":null,"expectedRevisionId":null,"payload":{"kind":"temporal_binding","bindingKind":"LESSON_PARTICIPATION","subjectRef":{"$bind":"refs.lesson-negative"},"targetRef":{"$bind":"refs.s2"},"validFrom":"2026-10-23","validTo":"2026-10-24","sourceLiteral":"Fictional explicit interval participate-lesson-negative","synthetic":true}}},"expectedOutcome":"saved","capture":"refs.participate-lesson-negative"},{"id":"refuse-overlap","phase":"A0","transport":"HTTP","body":{"operation":"upsertTemporalBinding","input":{"command":{"$bind":"ingress.refuse-overlap"},"bindingKey":null,"expectedRevisionId":null,"payload":{"kind":"temporal_binding","bindingKind":"CLASS_MEMBERSHIP","subjectRef":{"$bind":"refs.s1"},"targetRef":{"$bind":"refs.class-main"},"validFrom":"2026-10-10","validTo":"2026-10-20","sourceLiteral":"Fictional refusal refuse-overlap","synthetic":true}}},"expectedOutcome":"overlap refusal"},{"id":"refuse-empty","phase":"A0","transport":"HTTP","body":{"operation":"upsertTemporalBinding","input":{"command":{"$bind":"ingress.refuse-empty"},"bindingKey":null,"expectedRevisionId":null,"payload":{"kind":"temporal_binding","bindingKind":"CLASS_MEMBERSHIP","subjectRef":{"$bind":"refs.s1"},"targetRef":{"$bind":"refs.class-main"},"validFrom":"2026-10-23","validTo":"2026-10-23","sourceLiteral":"Fictional refusal refuse-empty","synthetic":true}}},"expectedOutcome":"invalid_interval"},{"id":"refuse-inverted","phase":"A0","transport":"HTTP","body":{"operation":"upsertTemporalBinding","input":{"command":{"$bind":"ingress.refuse-inverted"},"bindingKey":null,"expectedRevisionId":null,"payload":{"kind":"temporal_binding","bindingKind":"CLASS_MEMBERSHIP","subjectRef":{"$bind":"refs.s1"},"targetRef":{"$bind":"refs.class-main"},"validFrom":"2026-10-24","validTo":"2026-10-23","sourceLiteral":"Fictional refusal refuse-inverted","synthetic":true}}},"expectedOutcome":"invalid_interval"},{"id":"registration-s1","phase":"A0","transport":"DIRECT_REAL_NATIVE_STORE_UNDER_G_SETUP_STORE","api":"PostgresAcademyStore.append","arguments":[{"ownerId":{"$bind":"root.ownerId"},"studentId":"p4-fictional-student-1","entityId":"p4-fictional-registration-s1","actorId":{"$bind":"native.actorA"},"idempotencyKey":{"$bind":"root.storeKeys.registration-s1"},"expectedRevisionId":null,"sourceObservedAt":{"$bind":"clock.observedSourceAt"},"payload":{"kind":"source_book_registration","sourceStudent":{"namespace":"academy_student","literalKey":"p4-fictional-student-1"},"sourceCourse":{"namespace":"academy_course","literalKey":"p4-fictional-course-1"},"sourceUserCourse":{"namespace":"academy_user_course","literalKey":"p4-fictional-registration-1"},"sourceBook":{"namespace":"academy_book","literalKey":"p4-fictional-edition-a"},"catalogNodeId":"p4-fictional-edition-a","sourceCourseLabel":"Fictional course","sourceBookLabel":"Identical Fictional Edition","sourceStatus":"Fictional active","sourceProgressLiteral":"Fictional observed","sourceLearningRangeLiteral":"Fictional section minor","assignmentValidity":{"state":"known","value":"Fictional teacher-defined assignment","evidenceRefs":["p4-fictional-fixture-v1"]},"role":{"state":"known","value":"Fictional qualification","evidenceRefs":["p4-fictional-fixture-v1"]},"contractRef":"p4-fictional-fixture-v1","evidenceRefs":["p4-fictional-fixture-v1"]}}],"expectedOutcome":"one fictional write or exact native refusal only","capture":"records.registration-s1"},{"id":"registration-s2","phase":"A0","transport":"DIRECT_REAL_NATIVE_STORE_UNDER_G_SETUP_STORE","api":"PostgresAcademyStore.append","arguments":[{"ownerId":{"$bind":"root.ownerId"},"studentId":"p4-fictional-student-2","entityId":"p4-fictional-registration-s2","actorId":{"$bind":"native.actorA"},"idempotencyKey":{"$bind":"root.storeKeys.registration-s2"},"expectedRevisionId":null,"sourceObservedAt":{"$bind":"clock.observedSourceAt"},"payload":{"kind":"source_book_registration","sourceStudent":{"namespace":"academy_student","literalKey":"p4-fictional-student-2"},"sourceCourse":{"namespace":"academy_course","literalKey":"p4-fictional-course-1"},"sourceUserCourse":{"namespace":"academy_user_course","literalKey":"p4-fictional-registration-2"},"sourceBook":{"namespace":"academy_book","literalKey":"p4-fictional-edition-a"},"catalogNodeId":"p4-fictional-edition-a","sourceCourseLabel":"Fictional course","sourceBookLabel":"Identical Fictional Edition","sourceStatus":"Fictional active","sourceProgressLiteral":"Fictional observed","sourceLearningRangeLiteral":"Fictional section minor","assignmentValidity":{"state":"known","value":"Fictional teacher-defined assignment","evidenceRefs":["p4-fictional-fixture-v1"]},"role":{"state":"known","value":"Fictional qualification","evidenceRefs":["p4-fictional-fixture-v1"]},"contractRef":"p4-fictional-fixture-v1","evidenceRefs":["p4-fictional-fixture-v1"]}}],"expectedOutcome":"one fictional write or exact native refusal only","capture":"records.registration-s2"},{"id":"work-A","phase":"A0","transport":"DIRECT_REAL_NATIVE_STORE_UNDER_G_SETUP_STORE","api":"PostgresAcademyStore.append","arguments":[{"ownerId":{"$bind":"root.ownerId"},"studentId":"p4-fictional-student-1","entityId":"p4-fictional-work-A","actorId":{"$bind":"native.actorA"},"idempotencyKey":{"$bind":"root.storeKeys.work-A"},"expectedRevisionId":null,"sourceObservedAt":{"$bind":"clock.observedSourceAt"},"payload":{"kind":"learning_work_assignment","sourceStudent":{"namespace":"academy_student","literalKey":"p4-fictional-student-1"},"sourceCourse":{"namespace":"academy_course","literalKey":"p4-fictional-course-1"},"sourceUserCourse":{"namespace":"academy_user_course","literalKey":"p4-fictional-registration-1"},"sourceBook":{"namespace":"academy_book","literalKey":"p4-fictional-edition-a"},"assignmentKey":{"namespace":"synthetic_assignment","literalKey":"p4-fictional-work-A"},"registrationRevisionId":{"$bind":"records.registration-s1.revisionId"},"activity":"prestudy_review","origin":"teacher_report","effectiveDate":"2026-10-23","dueDate":{"state":"known","value":"2026-10-24","evidenceRefs":["p4-fictional-fixture-v1"]},"status":"assigned","catalogRefs":[{"nodeId":"p4-fictional-edition-a","revisionId":{"$bind":"catalogPins.edition-a.revisionId"}},{"nodeId":"p4-fictional-major","revisionId":{"$bind":"catalogPins.major.revisionId"}},{"nodeId":"p4-fictional-middle","revisionId":{"$bind":"catalogPins.middle.revisionId"}},{"nodeId":"p4-fictional-minor","revisionId":{"$bind":"catalogPins.minor.revisionId"}},{"nodeId":"p4-fictional-section-minor","revisionId":{"$bind":"catalogPins.section-minor.revisionId"}},{"nodeId":"p4-fictional-page","revisionId":{"$bind":"catalogPins.page.revisionId"}},{"nodeId":"p4-fictional-problem","revisionId":{"$bind":"catalogPins.problem.revisionId"}}],"sectionNodeIds":["p4-fictional-section-minor"],"items":[{"assignedItemId":"p4-fictional-item-work-A","itemKey":{"namespace":"academy_catalog","literalKey":"p4-fictional-problem"},"contentNodeId":"p4-fictional-problem","sectionNodeId":"p4-fictional-section-minor","labelLiteral":"1"}],"paper":{"state":"known","value":{"paperKey":{"namespace":"synthetic_paper","literalKey":"p4-fictional-paper-work-A"},"versionLiteral":"1","issuanceKey":{"namespace":"synthetic_issuance","literalKey":"p4-fictional-issuance-work-A"},"reissueOf":null,"orderedItems":[{"assignedItemId":"p4-fictional-item-work-A","printedOrdinal":"1"}]},"evidenceRefs":["p4-fictional-fixture-v1"]},"evidenceRefs":["p4-fictional-fixture-v1",{"$bind":"records.registration-s1.revisionId"}]}}],"expectedOutcome":"one fictional write or exact native refusal only","capture":"records.work-A + exact ObjectRef in refs.work-A"},{"id":"scope-work-A","phase":"A0","transport":"HTTP","body":{"operation":"attachActivityScope","input":{"command":{"$bind":"ingress.scope-work-A"},"payload":{"kind":"activity_scope","activityKind":"HOMEWORK_ASSIGNMENT","activityRef":{"$bind":"refs.work-A"},"recordScope":{"studentRef":{"$bind":"refs.s1"},"classGroupRef":{"$bind":"refs.class-main"},"businessDate":"2026-10-23","lessonRef":{"$bind":"refs.lesson-A"}},"sourceLiteral":"Fictional explicit work-A -> lesson-A","synthetic":true}}},"expectedOutcome":"saved","capture":"scopeRefs.work-A"},{"id":"work-B","phase":"A0","transport":"DIRECT_REAL_NATIVE_STORE_UNDER_G_SETUP_STORE","api":"PostgresAcademyStore.append","arguments":[{"ownerId":{"$bind":"root.ownerId"},"studentId":"p4-fictional-student-1","entityId":"p4-fictional-work-B","actorId":{"$bind":"native.actorA"},"idempotencyKey":{"$bind":"root.storeKeys.work-B"},"expectedRevisionId":null,"sourceObservedAt":{"$bind":"clock.observedSourceAt"},"payload":{"kind":"learning_work_assignment","sourceStudent":{"namespace":"academy_student","literalKey":"p4-fictional-student-1"},"sourceCourse":{"namespace":"academy_course","literalKey":"p4-fictional-course-1"},"sourceUserCourse":{"namespace":"academy_user_course","literalKey":"p4-fictional-registration-1"},"sourceBook":{"namespace":"academy_book","literalKey":"p4-fictional-edition-a"},"assignmentKey":{"namespace":"synthetic_assignment","literalKey":"p4-fictional-work-B"},"registrationRevisionId":{"$bind":"records.registration-s1.revisionId"},"activity":"daily_test","origin":"teacher_report","effectiveDate":"2026-10-23","dueDate":{"state":"known","value":"2026-10-24","evidenceRefs":["p4-fictional-fixture-v1"]},"status":"assigned","catalogRefs":[{"nodeId":"p4-fictional-edition-a","revisionId":{"$bind":"catalogPins.edition-a.revisionId"}},{"nodeId":"p4-fictional-major","revisionId":{"$bind":"catalogPins.major.revisionId"}},{"nodeId":"p4-fictional-middle","revisionId":{"$bind":"catalogPins.middle.revisionId"}},{"nodeId":"p4-fictional-minor","revisionId":{"$bind":"catalogPins.minor.revisionId"}},{"nodeId":"p4-fictional-section-minor","revisionId":{"$bind":"catalogPins.section-minor.revisionId"}},{"nodeId":"p4-fictional-page","revisionId":{"$bind":"catalogPins.page.revisionId"}},{"nodeId":"p4-fictional-problem","revisionId":{"$bind":"catalogPins.problem.revisionId"}}],"sectionNodeIds":["p4-fictional-section-minor"],"items":[{"assignedItemId":"p4-fictional-item-work-B","itemKey":{"namespace":"academy_catalog","literalKey":"p4-fictional-problem"},"contentNodeId":"p4-fictional-problem","sectionNodeId":"p4-fictional-section-minor","labelLiteral":"1"}],"paper":{"state":"known","value":{"paperKey":{"namespace":"synthetic_paper","literalKey":"p4-fictional-paper-work-B"},"versionLiteral":"1","issuanceKey":{"namespace":"synthetic_issuance","literalKey":"p4-fictional-issuance-work-B"},"reissueOf":null,"orderedItems":[{"assignedItemId":"p4-fictional-item-work-B","printedOrdinal":"1"}]},"evidenceRefs":["p4-fictional-fixture-v1"]},"evidenceRefs":["p4-fictional-fixture-v1",{"$bind":"records.registration-s1.revisionId"}]}}],"expectedOutcome":"one fictional write or exact native refusal only","capture":"records.work-B + exact ObjectRef in refs.work-B"},{"id":"scope-work-B","phase":"A0","transport":"HTTP","body":{"operation":"attachActivityScope","input":{"command":{"$bind":"ingress.scope-work-B"},"payload":{"kind":"activity_scope","activityKind":"HOMEWORK_ASSIGNMENT","activityRef":{"$bind":"refs.work-B"},"recordScope":{"studentRef":{"$bind":"refs.s1"},"classGroupRef":{"$bind":"refs.class-main"},"businessDate":"2026-10-23","lessonRef":{"$bind":"refs.lesson-B"}},"sourceLiteral":"Fictional explicit work-B -> lesson-B","synthetic":true}}},"expectedOutcome":"saved","capture":"scopeRefs.work-B"},{"id":"work-negative","phase":"A0","transport":"DIRECT_REAL_NATIVE_STORE_UNDER_G_SETUP_STORE","api":"PostgresAcademyStore.append","arguments":[{"ownerId":{"$bind":"root.ownerId"},"studentId":"p4-fictional-student-2","entityId":"p4-fictional-work-negative","actorId":{"$bind":"native.actorA"},"idempotencyKey":{"$bind":"root.storeKeys.work-negative"},"expectedRevisionId":null,"sourceObservedAt":{"$bind":"clock.observedSourceAt"},"payload":{"kind":"learning_work_assignment","sourceStudent":{"namespace":"academy_student","literalKey":"p4-fictional-student-2"},"sourceCourse":{"namespace":"academy_course","literalKey":"p4-fictional-course-1"},"sourceUserCourse":{"namespace":"academy_user_course","literalKey":"p4-fictional-registration-2"},"sourceBook":{"namespace":"academy_book","literalKey":"p4-fictional-edition-a"},"assignmentKey":{"namespace":"synthetic_assignment","literalKey":"p4-fictional-work-negative"},"registrationRevisionId":{"$bind":"records.registration-s2.revisionId"},"activity":"daily_test","origin":"teacher_report","effectiveDate":"2026-10-23","dueDate":{"state":"known","value":"2026-10-24","evidenceRefs":["p4-fictional-fixture-v1"]},"status":"assigned","catalogRefs":[{"nodeId":"p4-fictional-edition-a","revisionId":{"$bind":"catalogPins.edition-a.revisionId"}},{"nodeId":"p4-fictional-major","revisionId":{"$bind":"catalogPins.major.revisionId"}},{"nodeId":"p4-fictional-middle","revisionId":{"$bind":"catalogPins.middle.revisionId"}},{"nodeId":"p4-fictional-minor","revisionId":{"$bind":"catalogPins.minor.revisionId"}},{"nodeId":"p4-fictional-section-minor","revisionId":{"$bind":"catalogPins.section-minor.revisionId"}},{"nodeId":"p4-fictional-page","revisionId":{"$bind":"catalogPins.page.revisionId"}},{"nodeId":"p4-fictional-problem","revisionId":{"$bind":"catalogPins.problem.revisionId"}}],"sectionNodeIds":["p4-fictional-section-minor"],"items":[{"assignedItemId":"p4-fictional-item-work-negative","itemKey":{"namespace":"academy_catalog","literalKey":"p4-fictional-problem"},"contentNodeId":"p4-fictional-problem","sectionNodeId":"p4-fictional-section-minor","labelLiteral":"1"}],"paper":{"state":"known","value":{"paperKey":{"namespace":"synthetic_paper","literalKey":"p4-fictional-paper-work-negative"},"versionLiteral":"1","issuanceKey":{"namespace":"synthetic_issuance","literalKey":"p4-fictional-issuance-work-negative"},"reissueOf":null,"orderedItems":[{"assignedItemId":"p4-fictional-item-work-negative","printedOrdinal":"1"}]},"evidenceRefs":["p4-fictional-fixture-v1"]},"evidenceRefs":["p4-fictional-fixture-v1",{"$bind":"records.registration-s2.revisionId"}]}}],"expectedOutcome":"one fictional write or exact native refusal only","capture":"records.work-negative + exact ObjectRef in refs.work-negative"},{"id":"scope-work-negative","phase":"A0","transport":"HTTP","body":{"operation":"attachActivityScope","input":{"command":{"$bind":"ingress.scope-work-negative"},"payload":{"kind":"activity_scope","activityKind":"HOMEWORK_ASSIGNMENT","activityRef":{"$bind":"refs.work-negative"},"recordScope":{"studentRef":{"$bind":"refs.s2"},"classGroupRef":{"$bind":"refs.class-main"},"businessDate":"2026-10-23","lessonRef":{"$bind":"refs.lesson-negative"}},"sourceLiteral":"Fictional explicit work-negative -> lesson-negative","synthetic":true}}},"expectedOutcome":"saved","capture":"scopeRefs.work-negative"},{"id":"attempt-B1","phase":"A0","transport":"DIRECT_REAL_NATIVE_STORE_UNDER_G_SETUP_STORE","api":"PostgresAcademyStore.append","arguments":[{"ownerId":{"$bind":"root.ownerId"},"studentId":"p4-fictional-student-1","entityId":"p4-fictional-attempt-B1","actorId":{"$bind":"native.actorA"},"idempotencyKey":{"$bind":"root.storeKeys.attempt-B1"},"expectedRevisionId":null,"sourceObservedAt":{"$bind":"clock.observedSourceAt"},"payload":{"kind":"learning_work_attempt","sourceStudent":{"namespace":"academy_student","literalKey":"p4-fictional-student-1"},"attemptKey":{"namespace":"synthetic_attempt","literalKey":"p4-fictional-attempt-B1"},"assignmentRevisionId":{"$bind":"records.work-B.revisionId"},"paperIssuanceKey":{"namespace":"synthetic_issuance","literalKey":"p4-fictional-issuance-work-B"},"previousAttemptRevisionId":null,"occurredAt":{"state":"known","value":"2026-10-23T02:30:00Z","evidenceRefs":["p4-fictional-fixture-v1"]},"state":"graded","itemResults":[{"assignedItemId":"p4-fictional-item-work-B","grade":{"state":"known","value":"correct","evidenceRefs":["p4-fictional-fixture-v1"]}}],"evidenceRefs":["p4-fictional-fixture-v1",{"$bind":"records.work-B.revisionId"}]}}],"expectedOutcome":"one fictional write or exact native refusal only","capture":"records.attempt-B1 + exact ObjectRef in refs.attempt-B1"},{"id":"scope-attempt-B1","phase":"A0","transport":"HTTP","body":{"operation":"attachActivityScope","input":{"command":{"$bind":"ingress.scope-attempt-B1"},"payload":{"kind":"activity_scope","activityKind":"DAILY_TEST_ATTEMPT","activityRef":{"$bind":"refs.attempt-B1"},"recordScope":{"studentRef":{"$bind":"refs.s1"},"classGroupRef":{"$bind":"refs.class-main"},"businessDate":"2026-10-23","lessonRef":{"$bind":"refs.lesson-B"}},"sourceLiteral":"Fictional explicit attempt-B1 -> lesson-B","synthetic":true}}},"expectedOutcome":"saved","capture":"scopeRefs.attempt-B1"},{"id":"score-attempt-B1","phase":"A0","transport":"HTTP","body":{"operation":"recordScoreEvidence","input":{"command":{"$bind":"ingress.score-attempt-B1"},"entityKey":null,"expectedRevisionId":null,"payload":{"kind":"native_score_evidence","attemptRef":{"$bind":"refs.attempt-B1"},"assignmentRef":{"$bind":"refs.work-B"},"recordScope":{"studentRef":{"$bind":"refs.s1"},"classGroupRef":{"$bind":"refs.class-main"},"businessDate":"2026-10-23","lessonRef":{"$bind":"refs.lesson-B"}},"scale":{"family":"daily_test_attempt","version":"1.0.0","kind":"OWNER_RECORDED_NUMERIC_SCORE"},"score":{"earned":1,"maximum":1},"recordedBy":{"$bind":"refs.teacher-A"},"measurementLiteral":"Fictional owner-recorded 1 of 1; separate from item grade/rating","synthetic":true}}},"expectedOutcome":"saved","capture":"scoreRefs.attempt-B1"},{"id":"attempt-B2","phase":"A0","transport":"DIRECT_REAL_NATIVE_STORE_UNDER_G_SETUP_STORE","api":"PostgresAcademyStore.append","arguments":[{"ownerId":{"$bind":"root.ownerId"},"studentId":"p4-fictional-student-1","entityId":"p4-fictional-attempt-B2","actorId":{"$bind":"native.actorA"},"idempotencyKey":{"$bind":"root.storeKeys.attempt-B2"},"expectedRevisionId":null,"sourceObservedAt":{"$bind":"clock.observedSourceAt"},"payload":{"kind":"learning_work_attempt","sourceStudent":{"namespace":"academy_student","literalKey":"p4-fictional-student-1"},"attemptKey":{"namespace":"synthetic_attempt","literalKey":"p4-fictional-attempt-B2"},"assignmentRevisionId":{"$bind":"records.work-B.revisionId"},"paperIssuanceKey":{"namespace":"synthetic_issuance","literalKey":"p4-fictional-issuance-work-B"},"previousAttemptRevisionId":{"$bind":"records.attempt-B1.revisionId"},"occurredAt":{"state":"known","value":"2026-10-23T02:30:00Z","evidenceRefs":["p4-fictional-fixture-v1"]},"state":"graded","itemResults":[{"assignedItemId":"p4-fictional-item-work-B","grade":{"state":"known","value":"correct","evidenceRefs":["p4-fictional-fixture-v1"]}}],"evidenceRefs":["p4-fictional-fixture-v1",{"$bind":"records.work-B.revisionId"}]}}],"expectedOutcome":"one fictional write or exact native refusal only","capture":"records.attempt-B2 + exact ObjectRef in refs.attempt-B2"},{"id":"scope-attempt-B2","phase":"A0","transport":"HTTP","body":{"operation":"attachActivityScope","input":{"command":{"$bind":"ingress.scope-attempt-B2"},"payload":{"kind":"activity_scope","activityKind":"DAILY_TEST_ATTEMPT","activityRef":{"$bind":"refs.attempt-B2"},"recordScope":{"studentRef":{"$bind":"refs.s1"},"classGroupRef":{"$bind":"refs.class-main"},"businessDate":"2026-10-23","lessonRef":{"$bind":"refs.lesson-B"}},"sourceLiteral":"Fictional explicit attempt-B2 -> lesson-B","synthetic":true}}},"expectedOutcome":"saved","capture":"scopeRefs.attempt-B2"},{"id":"score-attempt-B2","phase":"A0","transport":"HTTP","body":{"operation":"recordScoreEvidence","input":{"command":{"$bind":"ingress.score-attempt-B2"},"entityKey":null,"expectedRevisionId":null,"payload":{"kind":"native_score_evidence","attemptRef":{"$bind":"refs.attempt-B2"},"assignmentRef":{"$bind":"refs.work-B"},"recordScope":{"studentRef":{"$bind":"refs.s1"},"classGroupRef":{"$bind":"refs.class-main"},"businessDate":"2026-10-23","lessonRef":{"$bind":"refs.lesson-B"}},"scale":{"family":"daily_test_attempt","version":"1.0.0","kind":"OWNER_RECORDED_NUMERIC_SCORE"},"score":{"earned":1,"maximum":1},"recordedBy":{"$bind":"refs.teacher-A"},"measurementLiteral":"Fictional owner-recorded 1 of 1; separate from item grade/rating","synthetic":true}}},"expectedOutcome":"saved","capture":"scoreRefs.attempt-B2"},{"id":"attempt-negative","phase":"A0","transport":"DIRECT_REAL_NATIVE_STORE_UNDER_G_SETUP_STORE","api":"PostgresAcademyStore.append","arguments":[{"ownerId":{"$bind":"root.ownerId"},"studentId":"p4-fictional-student-2","entityId":"p4-fictional-attempt-negative","actorId":{"$bind":"native.actorA"},"idempotencyKey":{"$bind":"root.storeKeys.attempt-negative"},"expectedRevisionId":null,"sourceObservedAt":{"$bind":"clock.observedSourceAt"},"payload":{"kind":"learning_work_attempt","sourceStudent":{"namespace":"academy_student","literalKey":"p4-fictional-student-2"},"attemptKey":{"namespace":"synthetic_attempt","literalKey":"p4-fictional-attempt-negative"},"assignmentRevisionId":{"$bind":"records.work-negative.revisionId"},"paperIssuanceKey":{"namespace":"synthetic_issuance","literalKey":"p4-fictional-issuance-work-negative"},"previousAttemptRevisionId":null,"occurredAt":{"state":"known","value":"2026-10-23T04:30:00Z","evidenceRefs":["p4-fictional-fixture-v1"]},"state":"graded","itemResults":[{"assignedItemId":"p4-fictional-item-work-negative","grade":{"state":"known","value":"correct","evidenceRefs":["p4-fictional-fixture-v1"]}}],"evidenceRefs":["p4-fictional-fixture-v1",{"$bind":"records.work-negative.revisionId"}]}}],"expectedOutcome":"one fictional write or exact native refusal only","capture":"records.attempt-negative + exact ObjectRef in refs.attempt-negative"},{"id":"scope-attempt-negative","phase":"A0","transport":"HTTP","body":{"operation":"attachActivityScope","input":{"command":{"$bind":"ingress.scope-attempt-negative"},"payload":{"kind":"activity_scope","activityKind":"DAILY_TEST_ATTEMPT","activityRef":{"$bind":"refs.attempt-negative"},"recordScope":{"studentRef":{"$bind":"refs.s2"},"classGroupRef":{"$bind":"refs.class-main"},"businessDate":"2026-10-23","lessonRef":{"$bind":"refs.lesson-negative"}},"sourceLiteral":"Fictional explicit attempt-negative -> lesson-negative","synthetic":true}}},"expectedOutcome":"saved","capture":"scopeRefs.attempt-negative"},{"id":"refuse-cross-family","phase":"A0","transport":"DIRECT_REAL_NATIVE_STORE_UNDER_G_SETUP_STORE","api":"PostgresAcademyStore.append","arguments":[{"ownerId":{"$bind":"root.ownerId"},"studentId":"p4-fictional-student-2","entityId":"p4-fictional-refuse-cross-family","actorId":{"$bind":"native.actorA"},"idempotencyKey":{"$bind":"root.storeKeys.refuse-cross-family"},"expectedRevisionId":null,"sourceObservedAt":{"$bind":"clock.observedSourceAt"},"payload":{"kind":"learning_work_attempt","sourceStudent":{"namespace":"academy_student","literalKey":"p4-fictional-student-2"},"attemptKey":{"namespace":"synthetic_attempt","literalKey":"p4-fictional-cross-family"},"assignmentRevisionId":{"$bind":"records.work-negative.revisionId"},"paperIssuanceKey":{"namespace":"synthetic_issuance","literalKey":"p4-fictional-issuance-work-negative"},"previousAttemptRevisionId":{"$bind":"records.work-negative.revisionId"},"occurredAt":{"state":"unknown","reason":"not recorded in fictional fixture"},"state":"unknown","itemResults":[],"evidenceRefs":["p4-fictional-fixture-v1"]}}],"expectedOutcome":"native cross-family previousAttempt refusal; no head created","capture":"records.refuse-cross-family + exact ObjectRef in refs.refuse-cross-family"},{"id":"progress-B","phase":"A0","transport":"HTTP","body":{"operation":"createProgress","input":{"command":{"$bind":"ingress.progress-B"},"studentId":"p4-fictional-student-1","payload":{"kind":"daily_progress","sourceStudent":{"namespace":"academy_student","literalKey":"p4-fictional-student-1"},"recordScope":{"studentRef":{"$bind":"refs.s1"},"classGroupRef":{"$bind":"refs.class-main"},"businessDate":"2026-10-23","lessonRef":{"$bind":"refs.lesson-B"}},"contentScope":{"editionRef":{"$bind":"refs.catalog.edition-a"},"unitRef":{"$bind":"refs.catalog.minor"},"sectionRefs":{"state":"known","value":[{"$bind":"refs.catalog.section-minor"}],"evidence":[{"$bind":"evidence.fixture"}]},"printedPages":{"state":"known","value":{"first":1,"last":1},"evidence":[{"$bind":"evidence.fixture"}]},"problemLabels":{"state":"known","value":["1"],"evidence":[{"$bind":"evidence.fixture"}]}},"progressState":{"state":"known","value":"COMPLETED","evidence":[{"$bind":"evidence.fixture"}]},"note":{"state":"known","value":"Fictional progress","evidence":[{"$bind":"evidence.fixture"}]}}}},"expectedOutcome":"saved","capture":"refs.progress-B"},{"id":"scope-progress-B","phase":"A0","transport":"HTTP","body":{"operation":"attachActivityScope","input":{"command":{"$bind":"ingress.scope-progress-B"},"payload":{"kind":"activity_scope","activityKind":"DAILY_PROGRESS","activityRef":{"$bind":"refs.progress-B"},"recordScope":{"studentRef":{"$bind":"refs.s1"},"classGroupRef":{"$bind":"refs.class-main"},"businessDate":"2026-10-23","lessonRef":{"$bind":"refs.lesson-B"}},"sourceLiteral":"Fictional explicit progress attachment","synthetic":true}}},"expectedOutcome":"saved","capture":"scopeRefs.progress-B"},{"id":"progress-negative","phase":"A0","transport":"HTTP","body":{"operation":"createProgress","input":{"command":{"$bind":"ingress.progress-negative"},"studentId":"p4-fictional-student-2","payload":{"kind":"daily_progress","sourceStudent":{"namespace":"academy_student","literalKey":"p4-fictional-student-2"},"recordScope":{"studentRef":{"$bind":"refs.s2"},"classGroupRef":{"$bind":"refs.class-main"},"businessDate":"2026-10-23","lessonRef":{"$bind":"refs.lesson-negative"}},"contentScope":{"editionRef":{"$bind":"refs.catalog.edition-a"},"unitRef":{"$bind":"refs.catalog.minor"},"sectionRefs":{"state":"known","value":[{"$bind":"refs.catalog.section-minor"}],"evidence":[{"$bind":"evidence.fixture"}]},"printedPages":{"state":"known","value":{"first":1,"last":1},"evidence":[{"$bind":"evidence.fixture"}]},"problemLabels":{"state":"known","value":["1"],"evidence":[{"$bind":"evidence.fixture"}]}},"progressState":{"state":"known","value":"COMPLETED","evidence":[{"$bind":"evidence.fixture"}]},"note":{"state":"known","value":"Fictional progress","evidence":[{"$bind":"evidence.fixture"}]}}}},"expectedOutcome":"saved","capture":"refs.progress-negative"},{"id":"scope-progress-negative","phase":"A0","transport":"HTTP","body":{"operation":"attachActivityScope","input":{"command":{"$bind":"ingress.scope-progress-negative"},"payload":{"kind":"activity_scope","activityKind":"DAILY_PROGRESS","activityRef":{"$bind":"refs.progress-negative"},"recordScope":{"studentRef":{"$bind":"refs.s2"},"classGroupRef":{"$bind":"refs.class-main"},"businessDate":"2026-10-23","lessonRef":{"$bind":"refs.lesson-negative"}},"sourceLiteral":"Fictional explicit progress attachment","synthetic":true}}},"expectedOutcome":"saved","capture":"scopeRefs.progress-negative"},{"id":"assessment-B1","phase":"A0","transport":"HTTP","body":{"operation":"createAssessment","input":{"command":{"$bind":"ingress.assessment-B1"},"studentId":"p4-fictional-student-1","payload":{"kind":"previous_homework_assessment","sourceStudent":{"namespace":"academy_student","literalKey":"p4-fictional-student-1"},"homeworkRef":{"$bind":"refs.work-A"},"assessmentScope":{"studentRef":{"$bind":"refs.s1"},"classGroupRef":{"$bind":"refs.class-main"},"businessDate":"2026-10-23","lessonRef":{"$bind":"refs.lesson-B"}},"outcome":{"state":"known","value":"COMPLETE","evidence":[{"$bind":"evidence.fixture"}]},"note":{"state":"known","value":"Fictional previous homework inspection","evidence":[{"$bind":"evidence.fixture"}]},"assessedBy":{"state":"known","value":{"$bind":"refs.teacher-A"},"evidence":[{"$bind":"evidence.fixture"}]},"assessedAt":{"state":"known","value":"2026-10-23T02:40:00Z","evidence":[{"$bind":"evidence.fixture"}]},"evidenceRefs":[{"$bind":"records.work-A.revisionId"}]}}},"expectedOutcome":"saved","capture":"refs.assessment-B1"},{"id":"scope-assessment-B1","phase":"A0","transport":"HTTP","body":{"operation":"attachActivityScope","input":{"command":{"$bind":"ingress.scope-assessment-B1"},"payload":{"kind":"activity_scope","activityKind":"PREVIOUS_HOMEWORK_ASSESSMENT","activityRef":{"$bind":"refs.assessment-B1"},"recordScope":{"studentRef":{"$bind":"refs.s1"},"classGroupRef":{"$bind":"refs.class-main"},"businessDate":"2026-10-23","lessonRef":{"$bind":"refs.lesson-B"}},"sourceLiteral":"Fictional assessment attachment","synthetic":true}}},"expectedOutcome":"saved","capture":"scopeRefs.assessment-B1"},{"id":"assessment-B2","phase":"A0","transport":"HTTP","body":{"operation":"createAssessment","input":{"command":{"$bind":"ingress.assessment-B2"},"studentId":"p4-fictional-student-1","payload":{"kind":"previous_homework_assessment","sourceStudent":{"namespace":"academy_student","literalKey":"p4-fictional-student-1"},"homeworkRef":{"$bind":"refs.work-A"},"assessmentScope":{"studentRef":{"$bind":"refs.s1"},"classGroupRef":{"$bind":"refs.class-main"},"businessDate":"2026-10-23","lessonRef":{"$bind":"refs.lesson-B"}},"outcome":{"state":"known","value":"COMPLETE","evidence":[{"$bind":"evidence.fixture"}]},"note":{"state":"known","value":"Fictional previous homework inspection","evidence":[{"$bind":"evidence.fixture"}]},"assessedBy":{"state":"known","value":{"$bind":"refs.teacher-A"},"evidence":[{"$bind":"evidence.fixture"}]},"assessedAt":{"state":"known","value":"2026-10-23T02:40:00Z","evidence":[{"$bind":"evidence.fixture"}]},"evidenceRefs":[{"$bind":"records.work-A.revisionId"}]}}},"expectedOutcome":"saved","capture":"refs.assessment-B2"},{"id":"scope-assessment-B2","phase":"A0","transport":"HTTP","body":{"operation":"attachActivityScope","input":{"command":{"$bind":"ingress.scope-assessment-B2"},"payload":{"kind":"activity_scope","activityKind":"PREVIOUS_HOMEWORK_ASSESSMENT","activityRef":{"$bind":"refs.assessment-B2"},"recordScope":{"studentRef":{"$bind":"refs.s1"},"classGroupRef":{"$bind":"refs.class-main"},"businessDate":"2026-10-23","lessonRef":{"$bind":"refs.lesson-B"}},"sourceLiteral":"Fictional assessment attachment","synthetic":true}}},"expectedOutcome":"saved","capture":"scopeRefs.assessment-B2"},{"id":"assessment-unknown-postapproval","phase":"A1","transport":"HTTP","body":{"operation":"createAssessment","input":{"command":{"$bind":"ingress.assessment-unknown-postapproval"},"studentId":"p4-fictional-student-1","payload":{"kind":"previous_homework_assessment","sourceStudent":{"namespace":"academy_student","literalKey":"p4-fictional-student-1"},"homeworkRef":{"$bind":"refs.work-A"},"assessmentScope":{"studentRef":{"$bind":"refs.s1"},"classGroupRef":{"$bind":"refs.class-main"},"businessDate":"2026-10-23","lessonRef":{"$bind":"refs.lesson-B"}},"outcome":{"state":"unknown","reason":"UNVERIFIED","evidence":[],"requiredEvidence":["SCOPED_TEACHER_DECISION"]},"note":{"state":"known","value":"Fictional previous homework inspection","evidence":[{"$bind":"evidence.fixture"}]},"assessedBy":{"state":"known","value":{"$bind":"refs.teacher-A"},"evidence":[{"$bind":"evidence.fixture"}]},"assessedAt":{"state":"known","value":"2026-10-23T02:40:00Z","evidence":[{"$bind":"evidence.fixture"}]},"evidenceRefs":[{"$bind":"records.work-A.revisionId"}]}}},"expectedOutcome":"saved","capture":"refs.assessment-unknown"},{"id":"draft-A","phase":"A1","transport":"HTTP","body":{"operation":"createDraft","input":{"command":{"$bind":"ingress.draft-A"},"studentId":"p4-fictional-student-1","payload":{"kind":"daily_record_draft","sourceStudent":{"namespace":"academy_student","literalKey":"p4-fictional-student-1"},"recordScope":{"studentRef":{"$bind":"refs.s1"},"classGroupRef":{"$bind":"refs.class-main"},"businessDate":"2026-10-23","lessonRef":{"$bind":"refs.lesson-A"}},"progressRefs":{"state":"unknown","reason":"UNVERIFIED","evidence":[],"requiredEvidence":["COMPLETE_COLLECTION"]},"homeworkRefs":{"state":"known","value":[{"$bind":"refs.work-A"}],"evidence":[{"$bind":"evidence.fixture"}]},"attemptRefs":{"state":"unknown","reason":"UNVERIFIED","evidence":[],"requiredEvidence":["COMPLETE_COLLECTION"]},"previousAssessmentRefs":{"state":"unknown","reason":"UNVERIFIED","evidence":[],"requiredEvidence":["COMPLETE_COLLECTION"]},"progressText":{"state":"unknown","reason":"UNVERIFIED","evidence":[],"requiredEvidence":["SOURCE_FIELD"]},"homeworkText":{"state":"unknown","reason":"UNVERIFIED","evidence":[],"requiredEvidence":["SOURCE_FIELD"]},"noteText":{"state":"unknown","reason":"UNVERIFIED","evidence":[],"requiredEvidence":["SOURCE_FIELD"]},"responsibleTeacherRef":{"state":"known","value":{"$bind":"refs.teacher-A"},"evidence":[{"$bind":"evidence.fixture"}]},"draftState":{"state":"known","value":"DRAFT","evidence":[{"$bind":"evidence.fixture"}]},"sourceSnapshot":{"$bind":"native.acquisitionBeforeDraft.snapshot"},"supersedesDraftRef":null}}},"expectedOutcome":"saved","capture":"refs.draft-A"},{"id":"draft-B","phase":"A1","transport":"HTTP","body":{"operation":"createDraft","input":{"command":{"$bind":"ingress.draft-B"},"studentId":"p4-fictional-student-1","payload":{"kind":"daily_record_draft","sourceStudent":{"namespace":"academy_student","literalKey":"p4-fictional-student-1"},"recordScope":{"studentRef":{"$bind":"refs.s1"},"classGroupRef":{"$bind":"refs.class-main"},"businessDate":"2026-10-23","lessonRef":{"$bind":"refs.lesson-B"}},"progressRefs":{"state":"known","value":[{"$bind":"refs.progress-B"}],"evidence":[{"$bind":"evidence.fixture"}]},"homeworkRefs":{"state":"known","value":[{"$bind":"refs.work-B"}],"evidence":[{"$bind":"evidence.fixture"}]},"attemptRefs":{"state":"known","value":[{"$bind":"refs.attempt-B1"},{"$bind":"refs.attempt-B2"}],"evidence":[{"$bind":"evidence.fixture"}]},"previousAssessmentRefs":{"state":"known","value":[{"$bind":"refs.assessment-B1"},{"$bind":"refs.assessment-B2"}],"evidence":[{"$bind":"evidence.fixture"}]},"progressText":{"$bind":"proposal.B.progressTextKnowledge"},"homeworkText":{"$bind":"proposal.B.homeworkTextKnowledge"},"noteText":{"$bind":"proposal.B.noteTextKnowledge"},"responsibleTeacherRef":{"state":"known","value":{"$bind":"refs.teacher-A"},"evidence":[{"$bind":"evidence.fixture"}]},"draftState":{"state":"known","value":"DRAFT","evidence":[{"$bind":"evidence.fixture"}]},"sourceSnapshot":{"$bind":"native.acquisitionBeforeDraft.snapshot"},"supersedesDraftRef":null}}},"expectedOutcome":"saved","capture":"refs.draft-B"},{"id":"refuse-duplicate-draft","phase":"A1","transport":"HTTP","body":{"operation":"createDraft","input":{"command":{"$bind":"ingress.refuse-duplicate-draft"},"studentId":"p4-fictional-student-1","payload":{"kind":"daily_record_draft","sourceStudent":{"namespace":"academy_student","literalKey":"p4-fictional-student-1"},"recordScope":{"studentRef":{"$bind":"refs.s1"},"classGroupRef":{"$bind":"refs.class-main"},"businessDate":"2026-10-23","lessonRef":{"$bind":"refs.lesson-B"}},"progressRefs":{"state":"known","value":[{"$bind":"refs.progress-B"}],"evidence":[{"$bind":"evidence.fixture"}]},"homeworkRefs":{"state":"known","value":[{"$bind":"refs.work-B"}],"evidence":[{"$bind":"evidence.fixture"}]},"attemptRefs":{"state":"known","value":[{"$bind":"refs.attempt-B1"},{"$bind":"refs.attempt-B2"}],"evidence":[{"$bind":"evidence.fixture"}]},"previousAssessmentRefs":{"state":"known","value":[{"$bind":"refs.assessment-B1"},{"$bind":"refs.assessment-B2"}],"evidence":[{"$bind":"evidence.fixture"}]},"progressText":{"$bind":"proposal.B.progressTextKnowledge"},"homeworkText":{"$bind":"proposal.B.homeworkTextKnowledge"},"noteText":{"$bind":"proposal.B.noteTextKnowledge"},"responsibleTeacherRef":{"state":"known","value":{"$bind":"refs.teacher-A"},"evidence":[{"$bind":"evidence.fixture"}]},"draftState":{"state":"known","value":"DRAFT","evidence":[{"$bind":"evidence.fixture"}]},"sourceSnapshot":{"$bind":"native.acquisitionBeforeDraft.snapshot"},"supersedesDraftRef":null}}},"expectedOutcome":"duplicate_current_draft"},{"id":"approval-preview-B","phase":"A1","transport":"HTTP","body":{"operation":"previewApprovalClosure","input":{"command":{"$bind":"ingress.futureApproveTarget"},"draftRef":{"$bind":"refs.draft-B"}}},"expectedOutcome":"saved","capture":"memory.approvalClosure.B verbatim; target action ApproveDailyRecord, future approve occurrence/admission/intent bindings"},{"id":"approval-issue-B","phase":"A1","transport":"HTTP","body":{"operation":"issueApproval","input":{"command":{"$bind":"ingress.approval-issue-B"},"draftRef":{"$bind":"refs.draft-B"},"closure":{"$bind":"memory.approvalClosure.B"},"validForSeconds":120}},"expectedOutcome":"saved","capture":"memory.approvalProof.B from genuine issuance; metadata approvalId/revision digests only"},{"id":"approval-consume-B","phase":"A1","transport":"HTTP","body":{"operation":"approveDraft","input":{"command":{"$bind":"ingress.futureApproveTarget"},"draftRef":{"$bind":"refs.draft-B"},"approvalProofHandle":{"$bind":"memory.approvalProof.B"}}},"expectedOutcome":"saved","capture":"refs.draft-B-approved; same atomic receipt includes draft revision + consumed approval revision"},{"id":"catalog-major-b","phase":"A0","transport":"DIRECT_REAL_NATIVE_STORE_UNDER_G_SETUP_STORE","api":"PostgresAcademyStore.saveCatalog","arguments":[{"$bind":"root.ownerId"},{"id":"p4-fictional-major-b","kind":"major_unit","sourceKey":{"namespace":"academy_catalog","literalKey":"p4-fictional-major-b"},"label":"Fictional major-b","parent":{"state":"known","value":"p4-fictional-edition-b","evidenceRefs":["p4-fictional-fixture-v1"]}}],"expectedOutcome":"one fictional write or exact native refusal only","capture":"catalogPins.major-b and refs.catalog.major-b"},{"id":"catalog-section-b","phase":"A0","transport":"DIRECT_REAL_NATIVE_STORE_UNDER_G_SETUP_STORE","api":"PostgresAcademyStore.saveCatalog","arguments":[{"$bind":"root.ownerId"},{"id":"p4-fictional-section-b","kind":"learning_section","sourceKey":{"namespace":"academy_catalog","literalKey":"p4-fictional-section-b"},"label":"Fictional section-b","parent":{"state":"known","value":"p4-fictional-major-b","evidenceRefs":["p4-fictional-fixture-v1"]}}],"expectedOutcome":"one fictional write or exact native refusal only","capture":"catalogPins.section-b and refs.catalog.section-b"},{"id":"progress-s2-major","phase":"A0","transport":"HTTP","body":{"operation":"createProgress","input":{"command":{"$bind":"ingress.progress-s2-major"},"studentId":"p4-fictional-student-2","payload":{"kind":"daily_progress","sourceStudent":{"namespace":"academy_student","literalKey":"p4-fictional-student-2"},"recordScope":{"studentRef":{"$bind":"refs.s2"},"classGroupRef":{"$bind":"refs.class-main"},"businessDate":"2026-10-23","lessonRef":{"$bind":"refs.lesson-negative"}},"contentScope":{"editionRef":{"$bind":"refs.catalog.edition-a"},"unitRef":{"$bind":"refs.catalog.major"},"sectionRefs":{"state":"known","value":[{"$bind":"refs.catalog.section-major"}],"evidence":[{"$bind":"evidence.fixture"}]},"printedPages":{"state":"known","value":{"first":1,"last":1},"evidence":[{"$bind":"evidence.fixture"}]},"problemLabels":{"state":"known","value":["1"],"evidence":[{"$bind":"evidence.fixture"}]}},"progressState":{"state":"known","value":"IN_PROGRESS","evidence":[{"$bind":"evidence.fixture"}]},"note":{"state":"known","value":"Fictional section/edition positive coverage","evidence":[{"$bind":"evidence.fixture"}]}}}},"expectedOutcome":"saved","capture":"refs.progress-s2-major"},{"id":"scope-progress-s2-major","phase":"A0","transport":"HTTP","body":{"operation":"attachActivityScope","input":{"command":{"$bind":"ingress.scope-progress-s2-major"},"payload":{"kind":"activity_scope","activityKind":"DAILY_PROGRESS","activityRef":{"$bind":"refs.progress-s2-major"},"recordScope":{"studentRef":{"$bind":"refs.s2"},"classGroupRef":{"$bind":"refs.class-main"},"businessDate":"2026-10-23","lessonRef":{"$bind":"refs.lesson-negative"}},"sourceLiteral":"Fictional explicit progress-s2-major","synthetic":true}}},"expectedOutcome":"saved","capture":"scopeRefs.progress-s2-major"},{"id":"progress-s2-middle","phase":"A0","transport":"HTTP","body":{"operation":"createProgress","input":{"command":{"$bind":"ingress.progress-s2-middle"},"studentId":"p4-fictional-student-2","payload":{"kind":"daily_progress","sourceStudent":{"namespace":"academy_student","literalKey":"p4-fictional-student-2"},"recordScope":{"studentRef":{"$bind":"refs.s2"},"classGroupRef":{"$bind":"refs.class-main"},"businessDate":"2026-10-23","lessonRef":{"$bind":"refs.lesson-negative"}},"contentScope":{"editionRef":{"$bind":"refs.catalog.edition-a"},"unitRef":{"$bind":"refs.catalog.middle"},"sectionRefs":{"state":"known","value":[{"$bind":"refs.catalog.section-middle"}],"evidence":[{"$bind":"evidence.fixture"}]},"printedPages":{"state":"known","value":{"first":1,"last":1},"evidence":[{"$bind":"evidence.fixture"}]},"problemLabels":{"state":"known","value":["1"],"evidence":[{"$bind":"evidence.fixture"}]}},"progressState":{"state":"known","value":"IN_PROGRESS","evidence":[{"$bind":"evidence.fixture"}]},"note":{"state":"known","value":"Fictional section/edition positive coverage","evidence":[{"$bind":"evidence.fixture"}]}}}},"expectedOutcome":"saved","capture":"refs.progress-s2-middle"},{"id":"scope-progress-s2-middle","phase":"A0","transport":"HTTP","body":{"operation":"attachActivityScope","input":{"command":{"$bind":"ingress.scope-progress-s2-middle"},"payload":{"kind":"activity_scope","activityKind":"DAILY_PROGRESS","activityRef":{"$bind":"refs.progress-s2-middle"},"recordScope":{"studentRef":{"$bind":"refs.s2"},"classGroupRef":{"$bind":"refs.class-main"},"businessDate":"2026-10-23","lessonRef":{"$bind":"refs.lesson-negative"}},"sourceLiteral":"Fictional explicit progress-s2-middle","synthetic":true}}},"expectedOutcome":"saved","capture":"scopeRefs.progress-s2-middle"},{"id":"progress-s2-edition-b","phase":"A0","transport":"HTTP","body":{"operation":"createProgress","input":{"command":{"$bind":"ingress.progress-s2-edition-b"},"studentId":"p4-fictional-student-2","payload":{"kind":"daily_progress","sourceStudent":{"namespace":"academy_student","literalKey":"p4-fictional-student-2"},"recordScope":{"studentRef":{"$bind":"refs.s2"},"classGroupRef":{"$bind":"refs.class-main"},"businessDate":"2026-10-23","lessonRef":{"$bind":"refs.lesson-negative"}},"contentScope":{"editionRef":{"$bind":"refs.catalog.edition-b"},"unitRef":{"$bind":"refs.catalog.major-b"},"sectionRefs":{"state":"known","value":[{"$bind":"refs.catalog.section-b"}],"evidence":[{"$bind":"evidence.fixture"}]},"printedPages":{"state":"known","value":{"first":1,"last":1},"evidence":[{"$bind":"evidence.fixture"}]},"problemLabels":{"state":"known","value":["1"],"evidence":[{"$bind":"evidence.fixture"}]}},"progressState":{"state":"known","value":"IN_PROGRESS","evidence":[{"$bind":"evidence.fixture"}]},"note":{"state":"known","value":"Fictional section/edition positive coverage","evidence":[{"$bind":"evidence.fixture"}]}}}},"expectedOutcome":"saved","capture":"refs.progress-s2-edition-b"},{"id":"scope-progress-s2-edition-b","phase":"A0","transport":"HTTP","body":{"operation":"attachActivityScope","input":{"command":{"$bind":"ingress.scope-progress-s2-edition-b"},"payload":{"kind":"activity_scope","activityKind":"DAILY_PROGRESS","activityRef":{"$bind":"refs.progress-s2-edition-b"},"recordScope":{"studentRef":{"$bind":"refs.s2"},"classGroupRef":{"$bind":"refs.class-main"},"businessDate":"2026-10-23","lessonRef":{"$bind":"refs.lesson-negative"}},"sourceLiteral":"Fictional explicit progress-s2-edition-b","synthetic":true}}},"expectedOutcome":"saved","capture":"scopeRefs.progress-s2-edition-b"},{"id":"scope-assessment-unknown-postapproval","phase":"A1","transport":"HTTP","body":{"operation":"attachActivityScope","input":{"command":{"$bind":"ingress.scope-assessment-unknown-postapproval"},"payload":{"kind":"activity_scope","activityKind":"PREVIOUS_HOMEWORK_ASSESSMENT","activityRef":{"$bind":"refs.assessment-unknown"},"recordScope":{"studentRef":{"$bind":"refs.s1"},"classGroupRef":{"$bind":"refs.class-main"},"businessDate":"2026-10-23","lessonRef":{"$bind":"refs.lesson-B"}},"sourceLiteral":"Fictional unknown-assessment attachment after positive freeze","synthetic":true}}},"expectedOutcome":"saved","capture":"scopeRefs.assessment-unknown-postapproval"},{"id":"draft-B-negative-successor","phase":"A1","transport":"HTTP","body":{"operation":"createDraft","input":{"command":{"$bind":"ingress.draft-B-negative-successor"},"studentId":"p4-fictional-student-1","payload":{"kind":"daily_record_draft","sourceStudent":{"namespace":"academy_student","literalKey":"p4-fictional-student-1"},"recordScope":{"studentRef":{"$bind":"refs.s1"},"classGroupRef":{"$bind":"refs.class-main"},"businessDate":"2026-10-23","lessonRef":{"$bind":"refs.lesson-B"}},"progressRefs":{"state":"known","value":[{"$bind":"refs.progress-B"}],"evidence":[{"$bind":"evidence.fixture"}]},"homeworkRefs":{"state":"known","value":[{"$bind":"refs.work-B"}],"evidence":[{"$bind":"evidence.fixture"}]},"attemptRefs":{"state":"known","value":[{"$bind":"refs.attempt-B1"},{"$bind":"refs.attempt-B2"}],"evidence":[{"$bind":"evidence.fixture"}]},"previousAssessmentRefs":{"state":"known","value":[{"$bind":"refs.assessment-B1"},{"$bind":"refs.assessment-B2"}],"evidence":[{"$bind":"evidence.fixture"}]},"progressText":{"$bind":"proposal.B.progressTextKnowledge"},"homeworkText":{"$bind":"proposal.B.homeworkTextKnowledge"},"noteText":{"$bind":"proposal.B.noteTextKnowledge"},"responsibleTeacherRef":{"state":"known","value":{"$bind":"refs.teacher-A"},"evidence":[{"$bind":"evidence.fixture"}]},"draftState":{"state":"known","value":"DRAFT","evidence":[{"$bind":"evidence.fixture"}]},"sourceSnapshot":{"$bind":"native.negativeAcquire.snapshot"},"supersedesDraftRef":{"$bind":"refs.draft-B-approved"}}}},"expectedOutcome":"saved","capture":"refs.draft-B-negative-successor"},{"id":"negative-approval-preview","phase":"A1","transport":"HTTP","body":{"operation":"previewApprovalClosure","input":{"command":{"$bind":"ingress.changedDependencyTarget"},"draftRef":{"$bind":"refs.draft-B-negative-successor"}}},"expectedOutcome":"real native result","capture":"memory.approvalClosure.negative"},{"id":"negative-approval-issue","phase":"A1","transport":"HTTP","body":{"operation":"issueApproval","input":{"command":{"$bind":"ingress.negative-approval-issue"},"draftRef":{"$bind":"refs.draft-B-negative-successor"},"closure":{"$bind":"memory.approvalClosure.negative"},"validForSeconds":120}},"expectedOutcome":"real native result","capture":"memory.approvalProof.negative"},{"id":"negative-progress-correct","phase":"A1","transport":"HTTP","body":{"operation":"correctProgress","input":{"command":{"$bind":"ingress.negative-progress-correct"},"studentId":"p4-fictional-student-1","entityId":{"$bind":"refs.progress-B.identity.nativeKey"},"expectedRevisionId":{"$bind":"refs.progress-B.revision"},"payload":{"$bind":"native.originalProgressBPayloadWithOnlyKnownNoteCorrection"}}},"expectedOutcome":"real native result","capture":"refs.progress-B-corrected"},{"id":"negative-approval-consume","phase":"A1","transport":"HTTP","body":{"operation":"approveDraft","input":{"command":{"$bind":"ingress.changedDependencyTarget"},"draftRef":{"$bind":"refs.draft-B-negative-successor"},"approvalProofHandle":{"$bind":"memory.approvalProof.negative"}}},"expectedOutcome":"refusal with no draft head change","capture":"No new head; actual native stale_source_revision/closure failure precedence preserved"}];
if(import.meta.main)void (async()=>produceNativeFixtures(loadFixedRunnerInvocation(process.argv.slice(2),'FIXTURE')))().catch((error)=>{console.error(JSON.stringify({status:'RECONCILE',code:((e:unknown)=>{const m=e instanceof Error?e.message:'';const k=/^[A-Za-z0-9_]{1,100}$/.test(m)?m:(e instanceof Error?e.constructor.name:'UNKNOWN')+(typeof (e as {code?:unknown})?.code==='string'?':'+String((e as {code:string}).code).slice(0,40):'');const at=e instanceof Error?[...(e.stack??'').matchAll(/\/([A-Za-z_]+\.ts):(\d+):\d+/g)].slice(0,3).map(x=>x[1]+':'+x[2]).join('<'):'';return at?k+'@'+at:k;})(error),automaticRetry:false}));process.exitCode=1;});

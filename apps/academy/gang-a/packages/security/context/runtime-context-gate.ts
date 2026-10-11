// Cloudflare Workers adapter: Web Crypto digest, preserving shared gate semantics.
import{checkManifest,resolveRequirements,checkReceipt}from'./governance-validation.ts';
import type{ManifestType,ReceiptType,RoleType,LifecycleType,SourceMode,RouteType}from'./governance-model.ts';
import type{z}from'zod';
export type Mode=z.infer<typeof SourceMode>;
export interface ContextScope{selectedStudentId:string|null;allowedEntityIds:string[];fields:string[];sourceIds:string[];sourceRevisions:Record<string,string>;window:string|null;rosterRevision:string;purpose:string;}
export interface LoadInput{runId:string;routeId:string;role:RoleType;event:LifecycleType;sourceMode:Mode;scope:ContextScope;registryBytes:Uint8Array;expectedRegistrySha256:string;}
export interface LoadPlan{runId:string;routeId:string;role:RoleType;event:LifecycleType;sourceMode:Mode;scope:ContextScope;scopeFingerprint:string;registrySha256:string;manifest:ManifestType;required:ManifestType['contracts'];}
export interface FullRead{contractId:string;version:string;pageId:string;reference:string;bytes:Uint8Array;readAt:string;evidenceRef:string;readKind:'tool_full_read'|'verified_cache_read';}
export interface CurrentAuthority{evaluatedBy:'trusted_runtime';status:'allowed'|'denied'|'unknown';scopeFingerprint:string;routeId:string;actionClass:RouteType['requestedActionClasses'][number];evidenceRef:string|null;evaluatedAt:string;expiresAt:string;}
export interface CurrentCapability{status:'available'|'unavailable'|'unknown';sourceMode:Mode;actionClass:RouteType['requestedActionClasses'][number];verifiedAt:string|null;evidenceRef:string|null;}
export const hashBytes=async(x:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',Uint8Array.from(x).buffer))).map(v=>v.toString(16).padStart(2,'0')).join('');
export async function scopeFingerprint(s:ContextScope){return hashBytes(new TextEncoder().encode(JSON.stringify({...s,allowedEntityIds:[...s.allowedEntityIds].sort(),fields:[...s.fields].sort(),sourceIds:[...s.sourceIds].sort(),sourceRevisions:Object.fromEntries(Object.entries(s.sourceRevisions).sort(([a],[b])=>a.localeCompare(b)))})));}
export async function planContextLoad(i:LoadInput):Promise<LoadPlan>{
 if(await hashBytes(i.registryBytes)!==i.expectedRegistrySha256)throw Error('registry_hash_mismatch');
 const m=checkManifest(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(i.registryBytes))),route=m.routes.find(r=>r.id===i.routeId);if(!route)throw Error('unknown_route');
 if(route.dataBoundary==='selected_private_student_scope'&&!i.scope.selectedStudentId)throw Error('selected_student_required');
 if(route.dataBoundary==='abstract_math_only'&&i.scope.selectedStudentId)throw Error('student_scope_forbidden_in_math');
 if(i.scope.selectedStudentId&&!i.scope.allowedEntityIds.includes(i.scope.selectedStudentId))throw Error('student_outside_entity_scope');
 const required=resolveRequirements(m,i.routeId,i.role,i.sourceMode);return{runId:i.runId,routeId:i.routeId,role:i.role,event:i.event,sourceMode:i.sourceMode,scope:structuredClone(i.scope),scopeFingerprint:await scopeFingerprint(i.scope),registrySha256:i.expectedRegistrySha256,manifest:m,required};
}
export async function verifyLoadedContext(plan:LoadPlan,reads:FullRead[],runtimeReceipt=false):Promise<ReceiptType>{
 const ids=new Set(reads.map(r=>r.contractId));if(ids.size!==reads.length)throw Error('duplicate_read');
 const observations=await Promise.all(plan.required.map(async c=>{const r=reads.find(x=>x.contractId===c.id);if(!r)throw Error('required_contract_not_read:'+c.id);if(r.version!==c.version||r.pageId!==c.locator.pageId||r.reference!==c.locator.reference)throw Error('source_pin_mismatch:'+c.id);const digest=await hashBytes(r.bytes);if(digest!==c.locator.sha256)throw Error('content_hash_mismatch:'+c.id);if(!r.readAt||!r.evidenceRef||!['tool_full_read','verified_cache_read'].includes(r.readKind))throw Error('complete_read_evidence_required');return{contractId:c.id,version:c.version,expectedSha256:c.locator.sha256,observedSha256:digest,locator:c.locator,readAt:r.readAt,readKind:r.readKind,contentComplete:true,evidenceReference:r.evidenceRef,outcome:'verified' as const};}));
 return checkReceipt(plan.manifest,{kind:'context_load_receipt',schemaVersion:'1.0.0',runId:plan.runId,taskId:plan.runId,role:plan.role,event:plan.event,routeId:plan.routeId,sourceMode:plan.sourceMode,registryVersion:plan.manifest.version,registrySha256:plan.registrySha256,scopeFingerprint:plan.scopeFingerprint,sourcePolicy:'minimal_scoped_data',observations,loadStatus:'verified',compliance:[],permissionStatus:'evaluate_with_current_user_and_tool_authority',runtimeReceipt},plan.registrySha256,plan.scopeFingerprint);
}
export async function evaluateActionGate(plan:LoadPlan,receipt:ReceiptType,currentScope:ContextScope,authority:CurrentAuthority,capability:CurrentCapability,nowIso:string,currentRegistrySha256:string):Promise<{allowed:boolean;reason:string}>{
 if(currentRegistrySha256!==plan.registrySha256)return{allowed:false,reason:'registry_changed_reload_required'};
 const fingerprint=await scopeFingerprint(currentScope);if(fingerprint!==plan.scopeFingerprint)return{allowed:false,reason:'scope_changed_reload_required'};
 try{checkReceipt(plan.manifest,receipt,plan.registrySha256,fingerprint);}catch{return{allowed:false,reason:'context_receipt_invalid'};}
 if(receipt.loadStatus!=='verified')return{allowed:false,reason:'context_not_loaded'};
 if(!receipt.runtimeReceipt)return{allowed:false,reason:'runtime_read_receipt_required'};
 const route=plan.manifest.routes.find(r=>r.id===plan.routeId)!;if(!route.requestedActionClasses.includes(authority.actionClass))return{allowed:false,reason:'action_outside_route'};
 const now=Date.parse(nowIso),start=Date.parse(authority.evaluatedAt),end=Date.parse(authority.expiresAt);if(!Number.isFinite(now)||!Number.isFinite(start)||!Number.isFinite(end)||now<start||now>=end)return{allowed:false,reason:'authority_stale_or_invalid'};
 if(authority.evaluatedBy!=='trusted_runtime'||authority.status!=='allowed'||!authority.evidenceRef||authority.scopeFingerprint!==fingerprint||authority.routeId!==plan.routeId)return{allowed:false,reason:'current_authority_required'};
 if(capability.status!=='available'||!capability.verifiedAt||!capability.evidenceRef||capability.sourceMode!==plan.sourceMode||capability.actionClass!==authority.actionClass)return{allowed:false,reason:'current_capability_required'};
 return{allowed:true,reason:'context_and_current_runtime_gates_passed'};
}
// This module is a callable application guard. Its caller must obtain authority/capability
// from trusted server/tool state, never from source documents or model-generated fields.
// It installs no platform prompt hook, source adapter, credentials or access policy.

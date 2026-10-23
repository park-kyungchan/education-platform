import { Manifest,Receipt, type ManifestType,type ReceiptType,type RoleType } from './governance-model.ts';
export function checkManifest(input:unknown):ManifestType{
 const m=Manifest.parse(input),byId=new Map(m.contracts.map(c=>[c.id,c]));
 if(byId.size!==m.contracts.length)throw Error('Duplicate contract IDs');
 if(new Set(m.routes.map(r=>r.id)).size!==m.routes.length)throw Error('Duplicate routes');
 const pin=(p:{contractId:string;version:string})=>{const c=byId.get(p.contractId);if(!c||c.version!==p.version)throw Error('Missing or conflicting version pin');if(c.lifecycle!=='active')throw Error('Inactive contract dependency');};
 for(const c of m.contracts)for(const p of c.dependencies)pin(p);
 const seen=new Set<string>(),active=new Set<string>();function visit(id:string){if(active.has(id))throw Error('Dependency cycle');if(seen.has(id))return;active.add(id);for(const dep of byId.get(id)!.dependencies)visit(dep.contractId);active.delete(id);seen.add(id);}for(const c of m.contracts)visit(c.id);
 for(const r of m.routes){for(const p of [...r.required,...r.optional,...r.conditional.flatMap(c=>c.required)])pin(p);if(r.domain==='math'&&r.dataBoundary!=='abstract_math_only')throw Error('Math route cannot import student data');}
 for(const rule of m.roleRules)for(const p of rule.required)pin(p);
 if(new Set(m.roleRules.map(r=>r.role)).size!==6||new Set(m.lifecycleRules.map(r=>r.event)).size!==6)throw Error('Incomplete role or lifecycle coverage');
 return m;
}
export function resolveRequirements(m:ManifestType,routeId:string,role:RoleType,mode:ReceiptType['sourceMode']){
 const route=m.routes.find(r=>r.id===routeId);if(!route||!route.roles.includes(role))throw Error('Unknown route or role');
 const rule=m.roleRules.find(r=>r.role===role);if(!rule)throw Error('Role rule missing');
 const byId=new Map(m.contracts.map(c=>[c.id,c])),out=new Map<string,typeof m.contracts[number]>();
 const add=(id:string)=>{const c=byId.get(id);if(!c)throw Error('Dependency missing');for(const d of c.dependencies)add(d.contractId);out.set(id,c);};
 for(const p of [...rule.required,...route.required,...route.conditional.filter(c=>c.sourceMode===mode).flatMap(c=>c.required)])add(p.contractId);
 return [...out.values()];
}
export function checkReceipt(m:ManifestType,input:unknown,expectedRegistrySha256:string,currentScopeFingerprint:string):ReceiptType{
 const r=Receipt.parse(input);if(r.registryVersion!==m.version||r.registrySha256!==expectedRegistrySha256)throw Error('Registry version or digest mismatch');
 if(r.scopeFingerprint!==currentScopeFingerprint)throw Error('Task scope changed');
 const required=resolveRequirements(m,r.routeId,r.role,r.sourceMode),obs=new Map(r.observations.map(o=>[o.contractId,o]));
 if(obs.size!==r.observations.length)throw Error('Duplicate read observations');
 if(r.loadStatus==='verified')for(const c of required){const o=obs.get(c.id);if(!o||o.version!==c.version||o.expectedSha256!==c.locator.sha256||o.observedSha256!==c.locator.sha256||o.locator.sha256!==c.locator.sha256||o.locator.reference!==c.locator.reference||o.locator.pageId!==c.locator.pageId||!o.contentComplete||!['tool_full_read','verified_cache_read'].includes(o.readKind)||o.outcome!=='verified'||!o.readAt||!o.evidenceReference)throw Error('Verified receipt lacks an actual complete pinned read');}
 for(const c of r.compliance)if(c.outcome==='pass'&&!c.evidenceReference)throw Error('Unsupported compliance pass');
 return r;
}
export function mayReuseCache(cache:{bookCode:string;edition:string;sourceHash:string|null;sourceRevision:string|null;parserVersion:string;analysisRevision:string;scopeVerified:boolean},request:typeof cache){return cache.sourceHash!==null&&request.sourceHash!==null&&cache.bookCode===request.bookCode&&cache.edition===request.edition&&cache.sourceHash===request.sourceHash&&cache.sourceRevision===request.sourceRevision&&cache.parserVersion===request.parserVersion&&cache.analysisRevision===request.analysisRevision&&cache.scopeVerified&&request.scopeVerified;}

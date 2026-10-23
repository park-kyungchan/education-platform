import {OperationalRevision} from './operational-context.ts';
import type {OperatingContext} from './catalog-schema.ts';
import {validateOperationalContext} from './validate-catalog.ts';
import {selectOperationalContext} from './select-template.ts';
import {deepFreeze,sha256} from './primitives.ts';

// Trusted code pins, not locators or hashes accepted from an API request.
export const WORKFLOW_CATALOG_PIN=deepFreeze({
 repository:'export-source/operating-contract',
 commit:'7b5cf56dd6f19ffe56d180b61c03d8366f5f98b1',
 schemaVersion:'academy.operations/1.1.0',
 catalogPath:'context/academy/checkpoint.json',
 catalogSha256:'14e0cc1b95b4247766b4f513d05b8ab032a9b99de333a0212a06d8793d21db0a',
 catalogBytes:1290110,
 manifestPath:'context/academy/manifest.json',
 manifestSha256:'31a58a185db613e1b46f97d5480fd057d4a825a23ec9171a43d36788e6a3b426',
 manifestBytes:6910
} as const);
const contexts=new WeakMap<object,OperatingContext>();
const verifiedCatalog:unique symbol=Symbol('verified_workflow_catalog');
export type VerifiedWorkflowCatalog=Readonly<{
 readonly [verifiedCatalog]:true;
 checkpointId:string;
 revision:string;
 schemaVersion:typeof WORKFLOW_CATALOG_PIN.schemaVersion;
 sourceCommit:typeof WORKFLOW_CATALOG_PIN.commit;
}>;

/** Pure, Worker-safe source loader. No network, filesystem or action authority.
 * The caller must load these bytes through its separately admitted scope gate. */
export async function loadWorkflowCatalog(catalogBytes:Uint8Array,manifestBytes:Uint8Array):Promise<VerifiedWorkflowCatalog>{
 const catalogSnapshot=Uint8Array.from(catalogBytes),manifestSnapshot=Uint8Array.from(manifestBytes);
 if(catalogSnapshot.byteLength!==WORKFLOW_CATALOG_PIN.catalogBytes||await sha256(catalogSnapshot)!==WORKFLOW_CATALOG_PIN.catalogSha256)throw Error('workflow_catalog_bytes_mismatch');
 if(manifestSnapshot.byteLength!==WORKFLOW_CATALOG_PIN.manifestBytes||await sha256(manifestSnapshot)!==WORKFLOW_CATALOG_PIN.manifestSha256)throw Error('workflow_manifest_bytes_mismatch');
 const decode=(bytes:Uint8Array)=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 const context=await validateOperationalContext(decode(catalogSnapshot),decode(manifestSnapshot));
 const catalog=Object.freeze({[verifiedCatalog]:true as const,checkpointId:context.checkpointId,revision:WORKFLOW_CATALOG_PIN.catalogSha256,schemaVersion:WORKFLOW_CATALOG_PIN.schemaVersion,sourceCommit:WORKFLOW_CATALOG_PIN.commit}) as VerifiedWorkflowCatalog;
 contexts.set(catalog,context);
 return catalog;
}
function requireCatalog(catalog:VerifiedWorkflowCatalog){const context=contexts.get(catalog);if(!context)throw Error('verified_workflow_catalog_required');return context;}

/** Explicit policy IDs, plus required dependencies/ancestors/source history.
 * A selected template is never a student assignment or execution attempt. */
export function selectWorkflowTemplate(catalog:VerifiedWorkflowCatalog,selection:unknown){
 const context=requireCatalog(catalog);
 return selectOperationalContext(context,OperationalRevision.parse(catalog.revision),selection);
}
export function listWorkflowPolicies(catalog:VerifiedWorkflowCatalog){
 return deepFreeze(requireCatalog(catalog).nodes.filter(node=>node.kind==='policy').map(policy=>({policyId:policy.id,labelRaw:policy.labelRaw,domain:policy.domain,knowledge:policy.knowledge,lifecycle:policy.lifecycle,obligation:policy.obligation,requiresActualAssignment:policy.applicability.requiresActualAssignment,executionAuthority:policy.executionAuthority})));
}

/** Cohort-only reads opt in to an explicitly empty template. Empty never means
 * select every policy; a verified source and exact revision remain required. */
export function emptyWorkflowTemplate(catalog:VerifiedWorkflowCatalog,expectedRevision:unknown){
 requireCatalog(catalog);
 if(OperationalRevision.parse(expectedRevision)!==catalog.revision)throw Error('operational_revision_conflict');
 return deepFreeze({checkpointId:catalog.checkpointId,revision:catalog.revision,nodes:[],relations:[],references:[],confirmedPractice:{},investigations:[],sources:[],executionAuthority:'not_granted_by_context' as const});
}

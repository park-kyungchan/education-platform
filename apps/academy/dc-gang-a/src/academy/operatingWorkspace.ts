import {loadRepositoryOperatingContext} from '../../../gang-a/packages/adapters/repository-operating-context';
import {selectOperationalContext} from '../../../gang-a/packages/application/select-operational-context';
import type {OperationalId} from '../../../gang-a/packages/domain/operational-context';
/** Byte-pinned existing 71-policy source; original supersession, human roles and deferrals are retained. */
export const operatingManifestSha256='31a58a185db613e1b46f97d5480fd057d4a825a23ec9171a43d36788e6a3b426';
let source:ReturnType<typeof loadRepositoryOperatingContext>|undefined;
export async function academyOperatingCatalog(){
 const loaded=await (source??=loadRepositoryOperatingContext(operatingManifestSha256));
 return {revision:loaded.revision,policies:loaded.context.nodes.filter(node=>node.kind==='policy'),coverage:loaded.context.coverage,executionAuthority:'not_granted_by_context' as const};
}
export async function academyOperatingSelection(policyIds:string[],expectedRevision:string){
 const loaded=await (source??=loadRepositoryOperatingContext(operatingManifestSha256));
 return selectOperationalContext(loaded.context,loaded.revision,{policyIds:policyIds as OperationalId[],expectedRevision});
}

import type {SourceContext,SourceScopeRequest} from '../../month-end-workbench/src/contracts';
/** The maintained MCP transport accepts at most50; continuation stays source-owned. */
export const sourceScopePageLimit=50;
export const hierarchySourcePage=(context:SourceContext|null,parentId:string|null,offset=0):SourceScopeRequest=>({context,view:'hierarchy',parentId,offset,limit:sourceScopePageLimit});
export const labelSourcePage=(context:SourceContext|null,hierarchyId:string,offset=0):SourceScopeRequest=>({context,view:'labels',hierarchyId,offset,limit:sourceScopePageLimit});

import type {OperationRelation,OperationalId} from './operational-context.ts';

/** Definition-only ordering. Do not pass evidence, assignment, execution,
 * retry/reopen or security relationships to a global DAG sorter.
 * A policy's numeric step order is display order; only explicit precedes
 * relations declare prerequisite order. Conceptual relatedness may cycle. */
export function topologicalDefinitionOrder(nodeIds:readonly OperationalId[],relations:readonly OperationRelation[],kind:'contains'|'precedes'|'depends_on'){
 if(!['contains','precedes','depends_on'].includes(kind))throw Error('unsupported_topological_relation_kind');
 const ids=new Set(nodeIds);if(ids.size!==nodeIds.length)throw Error('duplicate_topological_node');
 const degrees=new Map(nodeIds.map(id=>[id,0])),next=new Map<OperationalId,OperationalId[]>();
 for(const edge of relations.filter(edge=>edge.kind===kind)){
  // depends_on points from dependent to prerequisite. Emit prerequisites first.
  const from=kind==='depends_on'?edge.to:edge.from,to=kind==='depends_on'?edge.from:edge.to;
  if(!ids.has(from)||!ids.has(to))throw Error('topological_scope_missing_endpoint');
  degrees.set(to,degrees.get(to)!+1);next.set(from,[...(next.get(from)??[]),to]);
 }
 const ready=nodeIds.filter(id=>degrees.get(id)===0),result:OperationalId[]=[];
 while(ready.length){const id=ready.shift()!;result.push(id);for(const child of next.get(id)??[]){degrees.set(child,degrees.get(child)!-1);if(degrees.get(child)===0)ready.push(child);}}
 if(result.length!==ids.size)throw Error(kind+'_cycle');
 return Object.freeze(result);
}

import {z} from 'zod';
import {OperationalId,OperationalRevision} from './operational-context.ts';
import type {OperatingContext} from './catalog-schema.ts';
import {deepFreeze} from './primitives.ts';

export const ContextSelection=z.strictObject({policyIds:z.array(OperationalId).min(1),expectedRevision:OperationalRevision});
/** Only accepts an already validated catalog and independently byte-pinned revision. */
export function selectOperationalContext(context:OperatingContext,currentRevision:OperationalRevision,input:unknown){
 const selection=ContextSelection.parse(input);if(selection.expectedRevision!==currentRevision)throw Error('operational_revision_conflict');
 if(new Set(selection.policyIds).size!==selection.policyIds.length)throw Error('duplicate_selected_policy');
 const selected=new Set(selection.policyIds),policies=new Map(context.nodes.filter(n=>n.kind==='policy').map(n=>[n.id,n]));
 for(const id of selected)if(!policies.has(id))throw Error('selected_operational_policy_missing');
 let changed=true;while(changed){changed=false;for(const e of context.relations)if(e.kind==='depends_on'&&selected.has(e.from)&&!selected.has(e.to)){selected.add(e.to);changed=true;}}
 const nodeIds=new Set<OperationalId>(selected);
 for(const p of policies.values())if(selected.has(p.id))for(const id of p.stepIds)nodeIds.add(id);
 for(const e of context.relations)if(nodeIds.has(e.from)&&['performed_by_role','reported_to_role','produces_artifact','uses_reference','uses_concept'].includes(e.kind))nodeIds.add(e.to);
 let ancestors=true;while(ancestors){ancestors=false;for(const e of context.relations)if(e.kind==='contains'&&nodeIds.has(e.to)&&!nodeIds.has(e.from)){nodeIds.add(e.from);ancestors=true;}}
 const nodes=context.nodes.filter(n=>nodeIds.has(n.id)),investigations=context.investigations.filter(q=>q.policyIds.some(id=>selected.has(id))),relations=context.relations.filter(e=>nodeIds.has(e.from)&&nodeIds.has(e.to));
 const sourceIds=new Set([...nodes,...investigations,...relations].flatMap(n=>n.sourceAnchorIds));
 const references=Object.values(context.references).filter(r=>nodeIds.has(r.referenceId));
 const confirmedPractice=Object.fromEntries(Object.entries(context.confirmedPractice).filter(([_key,p])=>('policyId'in p?[p.policyId]:p.policyIds).some(id=>selected.has(id))));
 for(const practice of Object.values(confirmedPractice)){for(const id of practice.sourceAnchorIds)sourceIds.add(id);if('sheetStructure'in practice)for(const id of practice.sheetStructure.sourceAnchorIds)sourceIds.add(id);}
 for(const ref of references){for(const id of ref.sourceAnchorIds)sourceIds.add(id);if('rules'in ref)for(const rule of ref.rules)for(const id of rule.sourceAnchorIds)sourceIds.add(id);if('publisherClaims'in ref)for(const claim of ref.publisherClaims)for(const id of claim.sourceAnchorIds)sourceIds.add(id);if('cycle'in ref)for(const step of ref.cycle)for(const id of step.sourceAnchorIds)sourceIds.add(id);}
 let lineage=true;while(lineage){lineage=false;for(const s of context.sources)if(sourceIds.has(s.id))for(const id of s.supersedesAnchorIds)if(!sourceIds.has(id)){sourceIds.add(id);lineage=true;}}
 return deepFreeze(structuredClone({checkpointId:context.checkpointId,revision:currentRevision,nodes,relations,references,confirmedPractice,investigations,sources:context.sources.filter(s=>sourceIds.has(s.id)),executionAuthority:'not_granted_by_context' as const}));
}

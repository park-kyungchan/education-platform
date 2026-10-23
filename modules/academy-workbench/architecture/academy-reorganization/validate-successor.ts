import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const load = (p: string) => JSON.parse(readFileSync(join(import.meta.dir,p),'utf8'));
const entry=load('entrypoint.json');
const a=load(entry.currentArchitecture),e=load(entry.currentExecution),v=load(entry.currentVerification),w=load(entry.currentWorkflowInventory),x=load(entry.crossWorkProtocol);
let count=0;
const check=(value:unknown,message:string)=>{assert(value,message);count++;};
function graph(ids:string[],edges:{from:string;to:string}[]) {
  const set=new Set(ids),seen=new Set<string>(),visiting=new Set<string>();
  check(set.size===ids.length,'duplicate graph node');
  edges.forEach(e=>check(set.has(e.from)&&set.has(e.to),'missing graph endpoint'));
  function visit(id:string){check(!visiting.has(id),'dependency cycle');if(seen.has(id))return;visiting.add(id);edges.filter(e=>e.from===id).forEach(e=>visit(e.to));visiting.delete(id);seen.add(id);}
  ids.forEach(visit);
}
graph(a.modules.map((m:any)=>m.id),a.moduleGraphs.targetRuntimeImports.edges);
graph(e.nodes.map((n:any)=>n.id),e.nodes.flatMap((n:any)=>n.dependsOn.map((to:string)=>({from:n.id,to}))));
check(a.modules.some((m:any)=>m.id==='academy-application'&&m.path.includes('studentScene.ts')),'maintained teacher application omitted');
check(a.modules.some((m:any)=>m.id==='assessment-web'),'month-end web omitted');
check(a.modules.some((m:any)=>m.id==='assessment-application'),'month-end application omitted');
check(a.moduleGraphs.typeReferences.assertAcyclic===false,'type-cycle falsely asserted acyclic');
check(a.moduleGraphs.observedRuntimeImports.assertAcyclic===false,'current coarse source coupling falsely asserted acyclic');
check(a.moduleGraphs.observedRuntimeImports.edges.some((r:any)=>r.from==='academy-source-adapters'&&r.to==='academy-application'),'actual adapter import omitted');
check(a.moduleGraphs.observedRuntimeImports.edges.some((r:any)=>r.from==='academy-application'&&r.to==='academy-source-adapters'),'actual teacher application/lms import omitted');
check(a.moduleGraphs.targetRuntimeImports.implemented===false&&a.moduleGraphs.targetRuntimeImports.requiredMigrationTask==='QRY-BOUNDARY','unimplemented target graph promoted to current source');
const nodes=new Map<string,any>(e.nodes.map((n:any)=>[n.id,n]));
const ancestor=(node:string,required:string,seen=new Set<string>()):boolean=>{if(node===required)return true;if(seen.has(node))return false;seen.add(node);return nodes.get(node).dependsOn.some((p:string)=>ancestor(p,required,seen));};
check(ancestor('VER-03','CON-03'),'final verification precedes final consumers');
check(ancestor('INT-VERIFY','INT-01')&&ancestor('INT-VERIFY','VER-03'),'integrated-tree verification missing');
check(ancestor('INT-02','INT-VERIFY'),'delivery can bypass integrated verification');
check(!ancestor('VER-02','CON-03'),'early parity gate became cyclic with final consumer gate');
check(ancestor('DOM-02','QRY-BOUNDARY')&&ancestor('QRY-02','QRY-BOUNDARY'),'target boundary migration can be bypassed');
for(const n of e.nodes)for(const id of n.dependsOn){
  const p=nodes.get(id);
  if(n.id==='AAR-03'||p.id==='AAR-03'||n.workId===p.workId)continue;
  const bindings=x.edges.filter((q:any)=>q.producer.alias===p.id&&q.consumer.alias===n.id);
  check(bindings.length===1,'foreign edge lacks exactly one receiving qualification');
  check(bindings[0].qualificationTaskId.startsWith(bindings[0].consumer.projectId+':task:'+n.workId+'-'),'qualification Task is not receiver-owned');
  check(bindings[0].producer.commit===null&&bindings[0].status.startsWith('held-'),'uncreated producer pin fabricated');
}
check(w.rows.length===7&&new Set(w.rows.map((r:any)=>r.workflowId)).size===7,'seven-workflow coverage incomplete');
for(const row of w.rows){check(row.checks.length>0,'workflow lacks checks');check(row.completionConsequence.includes('No whole-workflow'),'deferred surface falsely complete');}
check(w.excluded.includes('parent-facing drafting and transmission')&&w.excluded.includes('counseling'),'excluded scope expanded');
const assessment=w.rows.find((r:any)=>r.workflowId==='assessment-preparation');
check(assessment.checks.includes('month-end-workbench package check')&&assessment.checks.includes('month-end-web package check'),'assessment check coverage incomplete');
check(v.gates.some((g:any)=>g.id==='VER-03'&&g.after.includes('CON-03')),'final source gate missing');
check(v.futureBehaviorChecks.some((c:any)=>c.case==='Verified exact assessment score100 with unknown teacher review'&&c.expected.includes('Exclude that assessment')),'verified perfect score eligibility confused with teacher completion');
console.log(JSON.stringify({valid:true,assertions:count,modules:a.modules.length,outcomeNodes:e.nodes.length,crossWorkQualifications:x.edges.length,workflowCoverage:w.rows.length,scope:'repair-successor design only; no native dispatch or operational acceptance inferred'}));

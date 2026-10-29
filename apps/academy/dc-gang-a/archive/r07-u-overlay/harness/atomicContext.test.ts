import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { selectAtomicContext, validateContextAtoms, validateCurrentWorkSelection, dependencyOrder } from '../../harness/atomic_context';
import { entryReadPlan } from '../../harness/context_routing';
import { validateWorkflowCheckpoint } from '../../harness/workflow_checkpoint';
import { loadAcademyOperationalContract } from '../../src/academy/operationalContract';
import { hermesBackendProfile } from '../../docs/hermes-backend-profile';
import { teacherOntologyDeliveryPlan } from '../../docs/teacher-ontology-delivery-plan';
const root=resolve(import.meta.dir,'../..');
const cli=(...args:string[])=>Bun.spawnSync([process.execPath,'--no-env-file',resolve(root,'harness/workflow_checkpoint.ts'),'context',...args],{cwd:root});

test('default continuation selects four-dimensional current context rather than the full historical briefing',()=>{
  const r=cli('continuation');
  expect(r.exitCode).toBe(0);
  const value=JSON.parse(r.stdout.toString());
  expect(value.kind).toBe('selected_atomic_workflow_context');
  expect([...new Set(value.atoms.map((a:{dimension:string})=>a.dimension))].sort()).toEqual(['ACTION','DATA','GOVERNANCE','LOGIC']);
  expect(value.engineeringContext).toBeUndefined();
  expect(value.executesNextStep).toBe(false);
  expect(value.authorizesProductionEffects).toBe(false);
  expect(value.entryReadPlan.requiredReads.map((r:{path:string})=>r.path)).not.toContain('docs/CODEX_CONTEXT.md');
  expect(value.provenance.originalsRetained).toContain('docs/CODEX_CONTEXT.md');
  expect(readFileSync(resolve(root,'docs/CODEX_CONTEXT.md'),'utf8')).toContain('## Decisions and source quality');
});

function fixture(){
  const checkpoint=validateWorkflowCheckpoint(JSON.parse(readFileSync(resolve(root,'handoffs/workflow-current-state.json'),'utf8')));
  const routing=JSON.parse(readFileSync(resolve(root,'docs/workflow-routing.json'),'utf8')).contextReadRouting;
  const plan=entryReadPlan(root,routing,'continuation',[],'current');
  const contract=loadAcademyOperationalContract(root);
  return {checkpoint,plan,contract};
}

test('product Work selects its actual existing goal and bounded unit rather than the stopped profile programme',()=>{
  const {checkpoint,plan,contract}=fixture();
  checkpoint.engineeringContext!.currentWork=validateCurrentWorkSelection({...checkpoint.engineeringContext!.currentWork,programme:'teacher_product_delivery',unit:'S0_teacher_safety',acceptedUnits:[]});
  const selected=selectAtomicContext(checkpoint,contract,plan);
  const work=selected.atoms.find(a=>a.kind==='work_intent')!;
  expect(work.value).toMatchObject({programme:'teacher_product_delivery',unit:'S0_teacher_safety',goal:teacherOntologyDeliveryPlan.systemRefactor.goal});
  expect(selected.dependencyOrder).toEqual(['action.S0_teacher_safety']);
  expect(selected.provenance.programmeGoal.path).toBe('docs/teacher-ontology-delivery-plan.ts');
  expect(selected.authorizesProductionEffects).toBe(false);expect(selected.executesNextStep).toBe(false);
  expect(selected.atoms.some(a=>a.kind==='work_step'&&a.value.unit==='L2_reusable_source_dialogue_contract')).toBe(false);
});

test('design evaluation is selectable without resuming source acquisition or claiming S1 acceptance',()=>{
  const {checkpoint,plan,contract}=fixture();
  checkpoint.engineeringContext!.currentWork=validateCurrentWorkSelection({...checkpoint.engineeringContext!.currentWork,programme:'teacher_product_delivery',unit:'S4_design_evaluation',acceptedUnits:['S0_teacher_safety']});
  const selected=selectAtomicContext(checkpoint,contract,plan);
  expect(selected.dependencyOrder).toEqual(['action.S0_teacher_safety','action.S4_design_evaluation']);
  expect(selected.executesNextStep).toBe(false);
  expect(selected.authorizesProductionEffects).toBe(false);
});

test('approved architecture adoption is a fresh unit, not source queue or effect admission',()=>{
  const {checkpoint,plan,contract}=fixture();
  checkpoint.engineeringContext!.currentWork=validateCurrentWorkSelection({...checkpoint.engineeringContext!.currentWork,programme:'teacher_product_delivery',unit:'S5_gang_a_architecture_adoption',acceptedUnits:['S0_teacher_safety','S4_design_evaluation']});
  const selected=selectAtomicContext(checkpoint,contract,plan);
  expect(selected.dependencyOrder).toEqual(['action.S0_teacher_safety','action.S4_design_evaluation','action.S5_gang_a_architecture_adoption']);
  expect(selected.prerequisiteStatus).toBe('recorded_prerequisites_satisfied_not_admission');
  expect(selected.authorizesProductionEffects).toBe(false);expect(selected.executesNextStep).toBe(false);
});

test('fresh production source preparation is selectable without granting live effects or renewing old budgets',()=>{
  const {checkpoint,plan,contract}=fixture();
  checkpoint.engineeringContext!.currentWork=validateCurrentWorkSelection({...checkpoint.engineeringContext!.currentWork,programme:'teacher_product_delivery',unit:'S6_mathcrew_production_assurance',state:'in_progress',acceptedUnits:[],resumePriorAssignments:false});
  const selected=selectAtomicContext(checkpoint,contract,plan);
  expect(selected.dependencyOrder).toEqual(['action.S6_mathcrew_production_assurance']);
  expect(selected.authorizesProductionEffects).toBe(false);
  expect(selected.executesNextStep).toBe(false);
  const step=selected.atoms.find(a=>a.kind==='work_step')!;
  expect(step.value).toMatchObject({unit:'S6_mathcrew_production_assurance',needsFreshNativeAdmission:true,effectCeiling:['repo_read','repo_edit','synthetic_test']});
  expect(()=>validateCurrentWorkSelection({...checkpoint.engineeringContext!.currentWork,scope:'live_effects_granted'})).toThrow('invalid_current_work_selection');
  expect(()=>validateCurrentWorkSelection({...checkpoint.engineeringContext!.currentWork,resumePriorAssignments:true})).toThrow('invalid_current_work_selection');
});

test('product Work retains unaccepted prerequisites and refuses cross-programme acceptance or source substitution',()=>{
  const {checkpoint,plan,contract}=fixture();
  const work={...checkpoint.engineeringContext!.currentWork,programme:'teacher_product_delivery',unit:'S1_student_domain_sync',acceptedUnits:[]};
  checkpoint.engineeringContext!.currentWork=validateCurrentWorkSelection(work);
  const selected=selectAtomicContext(checkpoint,contract,plan);
  expect(selected.prerequisiteStatus).toBe('unverified_prerequisites');expect(selected.dependencyOrder).toEqual(['action.S0_teacher_safety','action.S1_student_domain_sync']);
  expect(()=>validateCurrentWorkSelection({...work,acceptedUnits:['P1_atomic_context_contracts']})).toThrow();
  expect(()=>validateCurrentWorkSelection({...work,programme:'profile_ontology_refactor'})).toThrow();
  expect(()=>validateCurrentWorkSelection({...work,scope:'live_effects_granted'})).toThrow();
  plan.requiredReads.find(r=>r.id==='teacher_delivery_plan')!.sha256='0'.repeat(64);
  expect(()=>selectAtomicContext(checkpoint,contract,plan)).toThrow('context_contract_source_mismatch');
});

test('egress rejects mistyped payload bags, forged sources and effect-bearing claims',()=>{
  const {checkpoint,plan,contract}=fixture();
  const result=selectAtomicContext(checkpoint,contract,plan);
  for(const mutate of [
    (atoms:any[])=>{atoms.find(a=>a.kind==='decision_evidence').value.decisionId=['not_a_scalar'];},
    (atoms:any[])=>{atoms.find(a=>a.kind==='teacher_purpose').value.teacherReserved='not_an_array';},
    (atoms:any[])=>{atoms[0].source.path='data/not_an_allowed_source.json';},
    (atoms:any[])=>{atoms.find(a=>a.kind==='effect_boundary').value.nativeAuthorityVerified=true;},
    (atoms:any[])=>{atoms.find(a=>a.kind==='effect_boundary').value.sourceTransport='browser_fallback';},
    (atoms:any[])=>{atoms.find(a=>a.kind==='teacher_purpose').value.primarySurface='historical_main';},
    (atoms:any[])=>{atoms.splice(atoms.findIndex(a=>a.kind==='effect_boundary'),1);},
    (atoms:any[])=>{atoms.find(a=>a.kind==='work_step').value.targetRefs=['/unowned/effect'];},
    (atoms:any[])=>{atoms[0].dimension='ACTION';},
    (atoms:any[])=>{atoms[0].value.unreviewedExtra=true;},
  ]){const atoms=structuredClone(result.atoms);mutate(atoms);expect(()=>{validateContextAtoms(atoms);}).toThrow();}
});

test('foreign, unknown, future and stale Work metadata refuses without renewing a budget',()=>{
  const {checkpoint,plan,contract}=fixture();
  for(const change of [{ownerProfile:'default'},{unit:'not_a_unit'},{unit:['P1_atomic_context_contracts']},{state:['in_progress']},{resumePriorAssignments:true},{unknownKey:'not_admitted'}]){
    expect(()=>validateCurrentWorkSelection({...checkpoint.engineeringContext!.currentWork,...change})).toThrow();
  }
  const stale=structuredClone(checkpoint);stale.engineeringContext!.currentWork!.operationalRevision='2026-10-06-r1';
  expect(()=>selectAtomicContext(stale,contract,plan)).toThrow('stale_context_basis');
  expect(()=>selectAtomicContext(checkpoint,contract,plan,new Date('2020-01-01T00:00:00Z'))).toThrow('future_context_basis');
  expect(()=>selectAtomicContext(checkpoint,contract,plan,new Date(),'wrong_revision')).toThrow('stale_selected_context');
  const selected=selectAtomicContext(checkpoint,contract,plan);
  expect(selectAtomicContext(checkpoint,contract,plan,new Date(),selected.revision).revision).toBe(selected.revision);
  expect(selectAtomicContext(checkpoint,contract,plan,new Date('2099-01-01T00:00:00Z')).contextState).toBe('historical_checkpoint_revalidate_before_effect');
});

test('current projection exposes stage, current objective and historical conflict disposition',()=>{
  const {checkpoint,plan,contract}=fixture();
  const result=selectAtomicContext(checkpoint,contract,plan);
  const work=result.atoms.find(a=>a.kind==='work_intent')!;
  expect(work.value).toMatchObject({stage:checkpoint.engineeringContext!.currentWork!.state,checkpointObjective:checkpoint.engineeringContext!.objective});
  expect(result.provenance.workState.selector).toBe('/engineeringContext/currentWork');
  expect(work.assertionClass).toBe('derived');
  expect(result.entryReadPlan.historicalScopeConflicts.length).toBeGreaterThan(0);
  expect(result.provenance.unselectedDecisions.find(d=>d.id==='requested_context_configuration')?.state).toBe('historical');
});

test('missing accepted predecessor stays unknown and does not disappear from selection',()=>{
  const {checkpoint,plan,contract}=fixture();
  checkpoint.engineeringContext!.currentWork=validateCurrentWorkSelection({...checkpoint.engineeringContext!.currentWork,programme:'teacher_product_delivery',unit:'S1_student_domain_sync',acceptedUnits:[]});
  const result=selectAtomicContext(checkpoint,contract,plan);
  expect(result.prerequisiteStatus).toBe('unverified_prerequisites');
  expect(result.atoms.some(a=>a.kind==='work_step'&&a.value.status==='prerequisite_unverified'&&a.state==='unknown')).toBe(true);
  expect(result.executesNextStep).toBe(false);
});

test('only depends_on determines execution order; feedback cycles are retained but dependency cycles refuse',()=>{
  const nodes=[{id:'a',dimension:'ACTION'},{id:'b',dimension:'ACTION'},{id:'goal',dimension:'DATA'}];
  expect(dependencyOrder(nodes,[{from:'b',to:'a',kind:'depends_on'},{from:'a',to:'b',kind:'feedback'},{from:'b',to:'a',kind:'feedback'},{from:'a',to:'goal',kind:'part_of'}])).toEqual(['a','b']);
  expect(()=>dependencyOrder(nodes,[{from:'a',to:'b',kind:'depends_on'},{from:'b',to:'a',kind:'depends_on'}])).toThrow('cyclic_context_dependencies');
  expect(()=>dependencyOrder(nodes,[{from:'a',to:'missing',kind:'supported_by'}])).toThrow('invalid_context_relation');
  expect(()=>dependencyOrder(nodes,[{from:'a',to:'goal',kind:'depends_on'}])).toThrow('dependency_requires_actions');
  expect(()=>dependencyOrder(nodes,[{from:'a',to:'b',kind:['depends_on']}])).toThrow('invalid_context_relation');
});

test('source hashes must bind the actual imported contract, not an unrelated checkout claim',()=>{
  const {checkpoint,plan,contract}=fixture();
  plan.requiredReads.find(r=>r.id==='backend_profile')!.sha256='0'.repeat(64);
  expect(()=>{selectAtomicContext(checkpoint,contract,plan);}).toThrow('context_contract_source_mismatch');
});

test('historical and superseded evidence cannot be promoted by selecting it as a current decision',()=>{
  const {checkpoint,plan,contract}=fixture();
  const ids=hermesBackendProfile.contextSelection.commonDecisionIds as unknown as string[];
  ids.push('requested_context_configuration');
  try{expect(()=>{selectAtomicContext(checkpoint,contract,plan);}).toThrow('conflicting_decision_selection');}finally{ids.pop();}
  const superseded=hermesBackendProfile.contextSelection.supersededDecisionIds as unknown as string[];
  superseded.push('artifact_format');
  try{expect(()=>{selectAtomicContext(checkpoint,contract,plan);}).toThrow('conflicting_decision_selection');}finally{superseded.pop();}
});

test('every declared purpose has a current consumer and explicit legacy semantic parity',()=>{
  for(const purpose of Object.keys(hermesBackendProfile.contextSelection.purposeSources)){
    const current=cli(purpose),legacy=cli(purpose,'--legacy');
    expect(current.exitCode,purpose).toBe(0);expect(legacy.exitCode,purpose).toBe(0);
    const c=JSON.parse(current.stdout.toString()),l=JSON.parse(legacy.stdout.toString());
    const effects=c.atoms.find((a:any)=>a.kind==='effect_boundary').value;
    expect(effects.profile).toBe(l.operationalContract.roles.academyOwner);
    expect(effects.sourceTransport).toBe(l.operationalContract.sourceAccess.requiredTransport);
    for(const atom of c.atoms.filter((a:any)=>a.kind==='decision_evidence')){
      const original=l.engineeringContext.confirmedDecisions.find((d:any)=>d.id===atom.value.decisionId);
      expect(atom.value.statement).toBe(original.statement);expect(atom.value.origin).toBe(original.source);
    }
    expect(c.executesNextStep).toBe(l.executesNextStep);
    expect(c.authorizesProductionEffects).toBe(l.authorizesProductionEffects);
  }
});

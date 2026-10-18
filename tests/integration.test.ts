import {test,expect} from 'bun:test';
import {assertArtifact} from '@palantirkc/ontology';
import {readSourceMap,validateModuleGraph,resolveModuleRoot,runModuleCheck,validateAcademyGangSourceMaintenance} from '../src/modules';
import type {EducationModule} from '../src/contracts';
import {inspectCurriculumSources} from '../packages/curriculum/integration';
test('source graph preserves pending domain acceptance and native ownership',async()=>{const map=await readSourceMap();expect(map.modules).toHaveLength(5);expect(map.semanticState.mathematicsHumanDecision).toBe('PENDING');expect(map.semanticState.mathematicsCanonicalApplication).toBe('NOT_PERFORMED');expect(map.modules.find(m=>m.id==='academy')?.native.ownerProfile).toBe('dc-gang-a-dev');for(const module of map.modules)expect(module.native.authority).toBe('none');});
test('source reader consumes canonical Gang ownership without native or retirement authority',async()=>{
 const map=await readSourceMap(),owner=validateAcademyGangSourceMaintenance(map);
 expect(owner).toBe(map.academyGangSourceMaintenance);
 expect(map.academySources.find(source=>source.id===owner.importSourceRef)?.root).toBe(owner.maintainedCodeRoot);
 expect(map.academySources.find(source=>source.id===owner.importSourceRef)?.commit).toBe(owner.retainedBaseline.commit);
 expect(owner.runtimeAuthority).toBe('none');expect(owner.nativeOrDataCutoverPerformed).toBe(false);expect(owner.retirementAuthorized).toBe(false);
});
test('ownership reader rejects mismatched maintained roots, source references and retained commits',async()=>{
 const map=await readSourceMap();
 const mutations:((input:any)=>void)[]=[
  input=>{delete input.academyGangSourceMaintenance;},
  input=>{input.academyGangSourceMaintenance.maintainedCodeRoot='/opt/data/workspace/gang-a';},
  input=>{input.academyGangSourceMaintenance.importSourceRef='native-dc';},
  input=>{input.academySources.find((source:any)=>source.id==='gang-a-upstream').root='apps/academy/dc-gang-a';},
  input=>{input.academySources.find((source:any)=>source.id==='gang-a-upstream').commit='f'.repeat(40);},
  input=>{input.academySources.push({...input.academySources.find((source:any)=>source.id==='gang-a-upstream')});},
 ];
 for(const mutate of mutations){const input=structuredClone(map);mutate(input);expect(()=>validateAcademyGangSourceMaintenance(input)).toThrow();}
});
test('ownership reader refuses freeze drift, native parity claims and authority escalation',async()=>{
 const map=await readSourceMap();
 const mutations:((input:any)=>void)[]=[
  input=>{input.academyGangSourceMaintenance.retainedBaseline.tree='f'.repeat(40);},
  input=>{input.academyGangSourceMaintenance.retainedBaseline.trackedPaths=130;},
  input=>{input.academyGangSourceMaintenance.retainedBaseline.frozenImplementationAndSourcePaths=126;},
  input=>{input.academyGangSourceMaintenance.retainedBaseline.allowedGovernanceChanges.push('package.json');},
  input=>{input.academyGangSourceMaintenance.inspectedNativeReferenceRef='gang-a-upstream';},
  input=>{input.academySources.find((source:any)=>source.id==='gang-a-inspected-reference').root='apps/academy/gang-a';},
  input=>{input.academyGangSourceMaintenance.nativeSourceParity='verified';},
  input=>{input.academyGangSourceMaintenance.runtimeAuthority='native';},
  input=>{input.academyGangSourceMaintenance.nativeOrDataCutoverPerformed=true;},
  input=>{input.academyGangSourceMaintenance.retirementAuthorized=true;},
 ];
 for(const mutate of mutations){const input=structuredClone(map);mutate(input);expect(()=>validateAcademyGangSourceMaintenance(input)).toThrow();}
});
test('dependency validator rejects missing, duplicate and cyclic module dependencies',async()=>{const map=await readSourceMap(),one=map.modules[0]!;expect(()=>validateModuleGraph([one,one])).toThrow('duplicate_module');expect(()=>validateModuleGraph([{...one,dependsOn:['academy']}])).toThrow('unknown_dependency');expect(()=>validateModuleGraph([{...one,dependsOn:[one.id]}])).toThrow('dependency_cycle');});
test('module routing rejects traversal and arbitrary commands',async()=>{const one=(await readSourceMap()).modules[0]!;for(const root of ['../','/opt/data','apps/../','apps\\academy'])expect(()=>resolveModuleRoot({...one,root})).toThrow();await expect(runModuleCheck(one,'academy:serve')).rejects.toThrow('unadmitted_script');});
test('curriculum exposes missing canonical inputs as a gap rather than accepted mathematics',async()=>{const inventory=await inspectCurriculumSources();expect(inventory.status).toBe('not_available_in_this_ui_export');expect(inventory.required.length).toBeGreaterThan(0);expect(inventory.canonicalReady).toBe(false);expect(inventory.authority).toBe('none');});
test('project consumes pinned shared artifact validator',async()=>{const project=await Bun.file(new URL('../project.json',import.meta.url)).json();expect(()=>assertArtifact(project)).not.toThrow();expect(()=>assertArtifact({...project,kind:'fake'})).toThrow();});

test('academy integration exposes preserved domain facades without opening native stores',async()=>{const facade=await import(new URL('../apps/academy/integration.ts',import.meta.url).href);for(const name of ['TeacherApplication','ClinicWorkbench','SyntheticClinicStore','selectOperationalContext'])expect(typeof facade[name]).toBe('function');});

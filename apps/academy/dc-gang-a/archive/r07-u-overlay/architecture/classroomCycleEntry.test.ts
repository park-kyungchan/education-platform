import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {entryReadPlan,validateContextReadRouting} from '../../harness/context_routing';

test('academy continuation, interview and reads expose the canonical classroom policy without private values or new injection',()=>{
  const root=new URL('../..',import.meta.url).pathname;
  const routing=JSON.parse(readFileSync(root+'/docs/workflow-routing.json','utf8'));
  const architecture=JSON.parse(readFileSync(root+'/docs/academy-whole-lens-target-architecture.json','utf8'));
  expect(architecture.detailedContracts.classroomCyclePolicy).toBe('src/academy/classroomCyclePolicy.ts');
  expect(()=>validateContextReadRouting(routing.contextReadRouting)).not.toThrow();
  for(const purpose of ['continuation','interview','academy_local'] as const){
    const plan=entryReadPlan(root,routing.contextReadRouting,purpose);
    expect(plan.ok).toBe(true);
    expect(plan.requiredReads.some(x=>x.path==='src/academy/classroomCyclePolicy.ts')).toBe(true);
    expect(plan.automaticPerTurnInjectionInstalled).toBe(false);
  }
  expect(readFileSync(root+'/AGENTS.md','utf8')).toContain('src/academy/classroomCyclePolicy.ts');
});

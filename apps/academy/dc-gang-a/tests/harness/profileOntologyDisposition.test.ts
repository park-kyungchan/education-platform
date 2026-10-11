import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { profileOntologyRefactorPlan } from '../../docs/profile-ontology-refactor-plan';
import { p0Sources, profileOntologyP0 } from '../../docs/profile-ontology-p0';

const root = resolve(import.meta.dir, '../..');

test('the maintained workflow gate includes the P0 disposition checks', () => {
  const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  expect(manifest.scripts['test:workflow'].split(' ')).toContain('tests/harness/profileOntologyDisposition.test.ts');
});

test('P0 disposition is discoverable from the existing refactor plan, not a parallel checkpoint', () => {
  const plan = profileOntologyRefactorPlan as { p0?: { artifact: string } };
  expect(plan.p0?.artifact).toBe('docs/profile-ontology-p0.ts');
  expect(existsSync(resolve(root, plan.p0!.artifact))).toBe(true);
});

test('every planned workflow has one accountable owner, actual consumers, disposition and recovery', () => {
  const expected = [...profileOntologyRefactorPlan.scope.workflowFamilies].sort();
  const rows = profileOntologyP0.coverage;
  expect(rows.map(row => row.id).sort()).toEqual(expected);
  expect(new Set(rows.map(row => row.id)).size).toBe(rows.length);
  const nextUnits = new Set(profileOntologyRefactorPlan.deliveryUnits.map(unit => unit.id));
  const conflicts = new Set<string>(profileOntologyP0.conflicts.map(conflict => conflict.id));
  for (const row of rows) {
    expect(row.accountableOwner).toBe('academy_lead');
    expect(row.enforcementOwner.length > 0).toBe(true);
    expect(row.meaningRefs.length > 0).toBe(true);
    expect(row.consumers.length > 0).toBe(true);
    expect(row.gap.length > 0).toBe(true);
    expect(nextUnits.has(row.nextUnit)).toBe(true);
    expect(row.conflictIds.every(id => conflicts.has(id))).toBe(true);
    for (const ref of [...row.meaningRefs, ...row.consumers.map(consumer => consumer.ref), row.recoveryRef]) {
      expect(Object.hasOwn(p0Sources, ref)).toBe(true);
    }
  }
});

test('source-traced repository references resolve to real anchors without emitting source bodies', () => {
  for (const [id, source] of Object.entries(p0Sources)) {
    if (source.scope !== 'repository') continue;
    expect(source.path.startsWith('/'), id).toBe(false);
    expect(source.path.split('/').includes('..'), id).toBe(false);
    const full = resolve(root, source.path);
    expect(existsSync(full), id).toBe(true);
    expect(readFileSync(full, 'utf8').includes(source.anchor), `${id}: anchor missing`).toBe(true);
  }
});

test('classification retains native formats, originals and candidates separately from current rules', () => {
  expect(profileOntologyP0.artifactClasses.map(row => row.id).sort()).toEqual([
    'current_normative_selection', 'historical_view', 'local_procedure', 'native_required_format',
    'original_evidence', 'shared_knowledge', 'unmerged_candidate',
  ]);
  for (const row of profileOntologyP0.artifactClasses) {
    expect(row.retirement).toBe('none_in_P0');
    expect(row.refs.every(ref => Object.hasOwn(p0Sources, ref))).toBe(true);
  }
  expect(profileOntologyP0.artifactClasses.find(row => row.id === 'shared_knowledge')?.owner).toBe('common_platform');
});

test('every conflict is covered and has a current authority and an explicit unperformed successor', () => {
  const used = new Set<string>(profileOntologyP0.coverage.flatMap(row => row.conflictIds));
  const conflicts = profileOntologyP0.conflicts;
  expect(new Set(conflicts.map(row => row.id)).size).toBe(conflicts.length);
  for (const row of conflicts) {
    expect(used.has(row.id), row.id).toBe(true);
    expect(Object.hasOwn(p0Sources, row.currentAuthorityRef), row.id).toBe(true);
    expect(row.refs.every(ref => Object.hasOwn(p0Sources, ref)), row.id).toBe(true);
    expect(row.state).toBe('disposition_recorded_not_migrated');
  }
});

test('retirement dependencies remain real and no original is made eligible for deletion', () => {
  for (const edge of profileOntologyP0.retirementDependencies) {
    expect(edge.retirementAllowed).toBe(false);
    expect(edge.sourceRefs.length > 0).toBe(true);
    for (const path of edge.consumingPaths) {
      if (path.startsWith('/opt/hermes/')) continue; // installed native discovery, not portable repo ownership
      expect(existsSync(resolve(root, path)), path).toBe(true);
      const source = readFileSync(resolve(root, path), 'utf8');
      expect(edge.sourceRefs.some(ref => source.includes(p0Sources[ref].path.split('/').at(-1)!)), path).toBe(true);
    }
  }
});

test('programme dependency ordering does not resume old product or native budgets', () => {
  const ordered = profileOntologyRefactorPlan.deliveryUnits.map(unit => unit.id);
  for (const [index, unit] of profileOntologyRefactorPlan.deliveryUnits.entries()) {
    for (const predecessor of unit.dependsOn) {
      const precedingIndex = ordered.indexOf(predecessor);
      expect(precedingIndex).toBeGreaterThanOrEqual(0);
      expect(precedingIndex).toBeLessThan(index);
    }
  }
  expect(profileOntologyRefactorPlan.p0.migrationPerformed).toBe(false);
  expect(profileOntologyRefactorPlan.preservedState.remainingFindings).toEqual(['R10', 'R12', 'R13']);
  expect(profileOntologyRefactorPlan.preservedState.d4).toBe('USER_STOPPED');
  expect(profileOntologyP0.effects).toEqual({ retiredPaths: [], productRepairs: false, sourceAcquisition: false,
    agentsDispatched: false, budgetsRenewed: false, nativeConfigurationChanged: false, sharedOwnerChanged: false,
    publication: false, grantsEffects: false });
  expect(profileOntologyP0.acceptanceBoundary.wholeProfileComplete).toBe(false);
  expect(profileOntologyP0.sharedOwnerRequests.every(request => request.state === 'identified_not_sent' && !request.blocksP0)).toBe(true);
});

test('explicit legacy continuation preserves the P0 handoff and original historical reads', () => {
  const child = Bun.spawnSync([process.execPath, '--no-env-file', 'run', 'workflow:context', 'continuation', '--legacy'], { cwd: root });
  expect(child.exitCode).toBe(0);
  const context = JSON.parse(child.stdout.toString());
  const retained = context.nextEngineeringSteps.find((step:{id:string})=>step.id==='profile_ontology_refactor');
  expect(retained.referencePaths).toContain('docs/profile-ontology-p0.ts');
  expect(retained.referencePaths).toContain('docs/profile-ontology-refactor-plan.ts');
  // Retain prior programme evidence without forcing its prose into a later selected product Work.
  const checkpoint=JSON.parse(readFileSync(resolve(root,'handoffs/workflow-current-state.json'),'utf8'));
  expect(context.engineeringContext.currentWork).toEqual(checkpoint.engineeringContext.currentWork);
  expect(context.engineeringContext.dispatch).toEqual([]);
  expect(context.executesNextStep).toBe(false);
  expect(context.authorizesProductionEffects).toBe(false);
  expect(context.entryReadPlan.requiredReads.map((row: { path: string }) => row.path)).toContain('docs/CODEX_CONTEXT.md');
  expect(context.operationalContract.authorizesEffects).toBe(false);
});

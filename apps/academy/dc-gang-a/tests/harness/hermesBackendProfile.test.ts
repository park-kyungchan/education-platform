import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateWorkflowCheckpoint, workflowSummary } from '../../harness/workflow_checkpoint';
import { hermesBackendProfile } from '../../docs/hermes-backend-profile';

const root = resolve(import.meta.dir, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const checkpoint = () => validateWorkflowCheckpoint(JSON.parse(read('handoffs/workflow-current-state.json')));

describe('Hermes Backend profile continuation contract', () => {
  test('typed profile plan keeps native and product authority separate', () => {
    expect(hermesBackendProfile.profile).toBe('dc-gang-a-dev');
    expect(hermesBackendProfile.continuation).toBe('handoffs/workflow-current-state.json');
    expect(hermesBackendProfile.ontologyOwnership.automaticCrossProfileSync).toBe(false);
    expect(hermesBackendProfile.runtime.effectiveContextCapacity).toBeNull();
    expect(hermesBackendProfile.runtime.selectionScope).toBe('declared_defaults_not_assignment_controls');
    expect(hermesBackendProfile.recurringOperations.activeEnvelopes).toEqual([]);
    expect(hermesBackendProfile.recurringOperations.teacherReserved).toContain('official_record_finalization');
    expect(hermesBackendProfile.activation.gatewayStart).toBe(false);
    expect(hermesBackendProfile.activation.jobsInstalled).toBe(false);
    expect(hermesBackendProfile.skillSelection.autoLoad).toEqual([]);
    expect(hermesBackendProfile.autonomousGit).toContain('exact_head_ci');
  });
  test('current native consumer receives the new Lead authority instead of the old session pause', () => {
    const current = checkpoint().engineeringContext!;
    expect(hermesBackendProfile.execution).toBe('connected_linux_backend');
    expect(current.currentWork?.ownerProfile).toBe(hermesBackendProfile.profile);
    const decisions = new Map(current.confirmedDecisions.map(item => [item.id, item.statement]));
    expect(decisions.has('phase_two_checkpoint_pause')).toBe(false);
    expect(decisions.get('backend_lead_authority')).toContain('commit');
    expect(decisions.get('backend_lead_authority')).toContain('merge');
    expect(decisions.get('backend_lead_authority')).toContain('cleanup');
    expect(decisions.get('backend_execution_scope')).toContain('Windows Desktop');
    expect(current.confirmedDecisions.find(item=>item.id==='backend_repeat_operations')?.source).toBe('user_interview');
    expect(decisions.get('backend_repeat_operations')).toContain('product requirement');
    expect(decisions.get('backend_repeat_operations')).toContain('direct HTTP/API');
    expect(decisions.get('backend_repeat_operations')).toContain('refuses browser');
  });
  test('prior product questions remain unanswered and the dated checkpoint remains preserved', () => {
    const current = checkpoint().engineeringContext!;
    expect(current.pendingInterview.map(item => item.id)).toContain('ontology_acceptance_queries');
    expect(current.pendingInterview.map(item => item.id)).toContain('ontology_provider_selection');
    const prior = JSON.parse(read('handoffs/harness-phase-two-checkpoint-2026-10-01.json'));
    expect(prior.status).toBe('checkpoint_requested_pause_new_implementation');
    expect(current.historicalDecisionReferences).toContain('handoffs/harness-phase-two-checkpoint-2026-10-01.json');
  });
  test('checkpoint changes do not manufacture live access or installed automation', () => {
    const summary = workflowSummary(checkpoint());
    expect(summary.establishesCurrentResourceAccess).toBe(false);
    expect(summary.authorizesProductionEffects).toBe(false);
    expect(summary.executesNextStep).toBe(false);
    expect(checkpoint().engineeringContext!.dispatch).toEqual([]);
  });
  test('P2 consumes current product intent without reopening completed setup', () => {
    const state = checkpoint();
    const decisions = new Map(state.engineeringContext!.confirmedDecisions.map(item => [item.id, item.statement]));
    expect(state.activeStep.action).toBe('verify_current_academy_scope');
    expect(state.engineeringContext!.nextSteps.map(item => item.id)).not.toContain('qualify_backend_profile');
    // Fresh assignment can change the proving priority without reviving a predecessor's capture queue.
    // Keep the settled whole-class intent, direct transport and peer/original-preservation boundaries.
    expect(decisions.get('priority_order')).toContain('Whole-class experience is already selected');
    expect(decisions.get('priority_order')).toContain('direct HTTP');
    expect(decisions.get('lead_structure')).toContain('Reuse earlier analysis');
    expect(decisions.get('lead_structure')).toContain('do not edit peer tasks, duplicate capture');
    const sourceStep=state.engineeringContext!.nextSteps.find(item=>item.id==='real_dayrecord_source_qualification')!;
    expect(sourceStep.dependsOnQuestionIds).toContain('backend_repeat_operations');
    expect(sourceStep.dependsOnQuestionIds).toContain('backend_autonomous_goals');
    expect(decisions.get('preclass_source_coverage')).toContain('DayRecord');
    expect(decisions.get('historical_approved_revision_views')).toContain('unknown');
    expect(decisions.get('backend_harness_scope')).toContain('native vault');
  });
  test('all five observed tabs retain unknown ownership and non-executable migration', () => {
    const disposition = JSON.parse(read('docs/main-sheet-trailing-five-disposition-2026-10-01.json'));
    expect(disposition.selection.expectedCount).toBe(5);
    expect(disposition.selection.verifiedSelectedCount).toBe(5);
    expect(disposition.tabs).toHaveLength(5);
    expect(new Set(disposition.tabs.map((tab: { sheetId: number }) => tab.sheetId)).size).toBe(5);
    expect(disposition.target.mainSheetId).toBe(1754681846);
    expect(disposition.readBoundary.rangePerTab).toBe('A1:P6');
    expect(disposition.readBoundary.exclusiveParkOwnershipVerified).toBe(false);
    expect(disposition.readBoundary.formulasAndDependenciesVerified).toBe(false);
    expect(disposition.readBoundary.rawStudentValuesPersisted).toBe(false);
    expect(disposition.readBoundary.rawStudentValuesEmitted).toBe(false);
    expect(disposition.tabs.every((tab: { ownership: string }) => tab.ownership.startsWith('unknown;'))).toBe(true);
    expect(Object.values(disposition.effects).every(value => value === 0)).toBe(true);
    expect(disposition.grantsProductionWrites).toBe(false);
    expect(disposition.establishesP2Acceptance).toBe(false);
  });
  test('portable native entry retains AGENTS and distinguishes academy resume from engineering', () => {
    const agents = read('AGENTS.md');
    expect(agents).toContain('Hermes Linux Backend');
    expect(agents).toContain('docs/hermes-backend-profile.ts');
    expect(agents).toContain('approved recurring envelope');
    expect(agents).toContain('Final Kakao');
    expect(agents).not.toContain('Latest checkpoint instruction: pause new implementation');
    expect(agents).toContain('bun run workflow:context bot_development');
    expect(agents).not.toContain('Eligible workers use `gpt-6.1-sol/xhigh`');
  });
});

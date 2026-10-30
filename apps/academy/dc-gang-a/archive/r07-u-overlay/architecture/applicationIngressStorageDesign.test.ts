import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { academyApplicationDesign as design } from '../../docs/academy-application-ingress-storage-design';
import { backendAutonomyOperatingContract as autonomy, nativeSmartApprovalPolicy } from '../../docs/backend-autonomy-operating-contract';
const root = resolve(import.meta.dir, '../..');
const student = JSON.parse(readFileSync(resolve(root, 'docs/academy-student-evidence-contract.json'), 'utf8'));
const workspace = JSON.parse(readFileSync(resolve(root, 'docs/academy-teacher-workspace-tool-contract.json'), 'utf8'));

test('design references existing source owners without claiming runtime admission', () => {
  expect(design.status).toBe('design_only_runtime_not_implemented');
  expect(design.persistence.selectedResource).toBeNull();
  expect(design.recovery.confirmedDestinations).toHaveLength(0);
  for (const bridge of design.bridges) {
    expect(existsSync(resolve(root, bridge.existingSource))).toBe(true);
    for (const name of bridge.domainDefinitions) expect(student.definitions[name]).toBeDefined();
    expect(bridge.runtimeGates.length).toBeGreaterThan(0);
    expect(bridge.prohibitedPromotions.length).toBeGreaterThan(0);
  }
});

test('teacher scenes and WebMCP share operation/result definitions with narrower authority', () => {
  const published = design.ingress.operations.filter(row => row.name !== 'human_review_operation');
  expect(published.map(row => row.name)).toEqual(workspace.tools.map((row: {name: string}) => row.name));
  for (const row of published) expect(workspace.definitions[row.resultDefinition]).toBeDefined();
  expect(design.ingress.operations.find(row => row.name === 'human_review_operation')?.permission).toContain('no public WebMCP');
  expect(design.ingress.browserBoundary.join(' ')).toContain('cannot distinguish an agent invocation');
  expect(design.ingress.sourceIntake.join(' ')).toContain('autonomous ingestion is blocked');
});

test('source namespaces, precision and independent evidence are preserved in bridge mappings', () => {
  const textbook = design.bridges.find(row => row.id === 'textbook')!;
  expect(textbook.fieldMappings.some(row => row.condition.includes('Month-day stays month-day'))).toBe(true);
  const daily = design.bridges.find(row => row.id === 'daily_zero')!;
  expect(daily.domainDefinitions).not.toContain('AssessmentAttempt');
  expect(daily.fieldMappings[0].condition).toContain('cannot satisfy AssessmentAttempt.items');
  const item = design.bridges.find(row => row.id === 'item_metadata')!;
  expect(item.prohibitedPromotions).toContain('play_seconds -> watched time');
  expect(design.bridges.find(row => row.id === 'legacy_projection')?.disposition).toBe('reject_legacy_projection');
});

test('minimal store separates shared catalogs, student history, command outcomes and expendable cache', () => {
  expect(design.persistence.tables.map(row => row.name)).toEqual(['shared_catalog_versions', 'identity_binding_versions', 'record_versions', 'entity_heads', 'command_outcomes', 'evidence_relations', 'query_cache']);
  expect(design.persistence.tables.find(row => row.name === 'record_versions')?.keys).toContain('studentId or explicit owner-level lane');
  expect(design.persistence.transaction.join(' ')).toContain('Server-generated recordedAt is assigned once');
  expect(design.persistence.transaction.join(' ')).toContain('Commit before claiming history_saved_read_back');
  expect(design.persistence.retention.join(' ')).toContain('Do not delete predecessor evidence');
});

test('recovery is exact-manifest and independently placed, not a lossless-storage assertion', () => {
  expect(design.recovery.independentPlacement).toContain('outside the primary provider and Backend lifecycle');
  expect(design.recovery.restoreProcedure.join(' ')).toContain('empty target');
  expect(design.recovery.bundleContents).toContain('original command outcomes/retry identity');
  expect(design.recovery.outageRules.join(' ')).toContain('RPO/RTO are unmeasured');
  expect(design.recovery.failureCases.map(row => row.id)).toEqual(['foreign_scope', 'source_drift', 'partial_roster', 'retry_conflict', 'lost_ack', 'primary_loss', 'history_tamper']);
});

test('user direction, Lead recommendations and excluded effects remain distinguishable', () => {
  expect(design.decisions.find(row => row.id === 'external_protected_candidate')?.provenance).toBe('user_answer');
  expect(design.decisions.find(row => row.id === 'minimal_retention')?.provenance).toBe('lead_recommendation');
  expect(design.authority.excluded).toContain('Production DB creation or student migration before exact protected target/cost/access/restore qualification');
  expect(design.delivery[0].state).toBe('current_user_admitted_code_and_git_only');
  for (const row of design.delivery) for (const path of row.paths) expect(existsSync(resolve(root, path))).toBe(true);
  expect(design.references).toContain('/opt/data/shared-llm-wiki/concepts/ontology-aip-evals-sdlc-agent-start.md');
});

test('native autonomous optimization retains safeguards and does not install a substitute scheduler', () => {
  expect(autonomy.selectedNativeOptimization.mechanism).toBe('approvals.smart_policy through hermes config set');
  expect(autonomy.selectedNativeOptimization.retain.mode).toBe('smart');
  expect(autonomy.selectedNativeOptimization.retain.redaction).toBe(true);
  expect(autonomy.selectedNativeOptimization.retain.commandAllowlist).toHaveLength(0);
  expect(autonomy.selectedNativeOptimization.retain.unattendedMode).toBe('deny');
  expect(nativeSmartApprovalPolicy).toContain('Do not blanket-approve interpreters');
  expect(autonomy.unattendedFrontier.installation).toContain('No new job');
  expect(autonomy.selectedNativeOptimization.observedInitialBlocker.currentQualification).toContain('not claimed repaired');
});

test('interview admission reduces repeated routine prompts without promoting unknown effects to approval', () => {
  expect(nativeSmartApprovalPolicy).toContain('Do not escalate solely because a routine step was not individually re-approved');
  expect(nativeSmartApprovalPolicy).toContain('read-only native Session/Project/Task identity metadata');
  expect(nativeSmartApprovalPolicy).toContain('A guardian error, empty verdict or approval timeout is not consent');
  expect(nativeSmartApprovalPolicy).toContain('Do not blanket-approve interpreters');
  expect(nativeSmartApprovalPolicy).toContain('Worker execution requires fresh supported native controls');
});

import { describe, expect, test } from 'bun:test';
import { teacherOntologyDeliveryPlan } from '../../docs/teacher-ontology-delivery-plan';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateWorkflowCheckpoint, workflowSummary } from '../../harness/workflow_checkpoint';
import { teacherWorkContextSourceReview } from '../../review/teacher-work-context-source-2026-10-07';

const root = resolve(import.meta.dir, '../..');
const direction = teacherOntologyDeliveryPlan.currentDirection;

describe('teacher work direction interview', () => {
  test('keeps full functional acceptance above the historical desired deadline and gates admitted live effects', () => {
    expect(direction.executionWindow?.desiredTeacherUseAt).toBe('2026-10-07T14:00:00+09:00');
    expect(direction.executionWindow?.tradeoff).toBe('full_scope_over_deadline');
    expect(direction.executionWindow?.admitted).toBe('staged_product_delivery_with_qualified_live_effects');
    expect(direction.executionWindow?.liveDataAndRuntime).toBe('admitted_after_source_identity_and_recovery_qualification');
    expect(direction.executionWindow?.scopeReductionForDeadline).toBe(false);
  });
  test('the existing plan owns the new direction without renewing the dated journal unit', () => {
    expect(Object.hasOwn(teacherOntologyDeliveryPlan, 'currentDirection')).toBe(true);
    expect(Object.hasOwn(teacherOntologyDeliveryPlan, 'currentUnit')).toBe(false);
    expect(Object.hasOwn(teacherOntologyDeliveryPlan, 'historicalUnit')).toBe(true);
    expect(teacherOntologyDeliveryPlan.historicalUnit.id).toBe('academy_direct_http_journal_webmcp');
  });

  test('retains literal teacher section names separately from source qualification', () => {
    expect(direction.teacherInput.sectionLabels.elementaryGauss).toEqual(['개념 이해하기', '개념정복', '필수예제', '유형다지기', '실력쌓기', '개념복습', '4M 듣기와 쓰기', '4M 읽기와 쓰기', '대단원 총괄평가']);
    expect(direction.teacherInput.sectionLabels.middleGauss).toEqual(['개념 백지 테스트', '개념 예제', '개념 쏙 생각 쑥', '기본 문제', '필수 예제', '유형 다지기', 'Daily Restudy', '대단원 총괄평가']);
    expect(direction.teacherInput.disposition).toBe('confirmed_input_partly_consumed_by_domain_policy');
    expect(direction.teacherInput.dutyOwner).toBe('src/academy/classroomCyclePolicy.ts');
    expect(direction.teacherInput.expectedWork).toBe('assigned_section_and_item_range_not_every_catalog_entry');
    expect(direction.teacherInput.comprehensiveAssessment).toBe('eligible_after_designated_minor_unit_boundary_not_every_minor_unit');
  });

  test('keeps student solving and explicit teacher completion in the protected product lane', () => {
    expect(direction.teacherInput.clinic).toEqual({ solving: 'student', grading: 'teacher', review: 'teacher', completion: 'explicit_teacher_input_after_repeated_correction_and_explanation' });
    const destinations = new Map(direction.recordDestinations.map(row => [row.kind, row]));
    expect(destinations.get('teacher_clinic_history')?.owner).toBe('private_product_postgresql');
    expect(destinations.get('official_dayrecord')?.owner).toBe('academy_official_record');
    expect(destinations.get('parent_delivery')?.owner).toBe('teacher_final_sender');
    expect(direction.recordDestinations.every(row => row.automaticProjection === false)).toBe(true);
    expect(direction.ui.states).toContain('teacher_grading_pending');
    expect(direction.ui.states).toContain('assigned_nonperformance_confirmed');
    expect(direction.ui.states).toContain('source_unknown');
  });

  test('maps each ontology unit to concrete fields and existing runtime consumers', () => {
    expect(direction.contextFieldPlan.map(row => row.unit)).toEqual(['DATA', 'LOGIC', 'ACTION', 'GOVERNANCE']);
    for (const binding of direction.contextFieldPlan) {
      expect(binding.typedFields.length).toBeGreaterThan(0);
      expect(new Set(binding.typedFields).size).toBe(binding.typedFields.length);
      expect(binding.acceptance.length).toBeGreaterThan(0);
      for (const path of binding.consumers) expect(existsSync(resolve(root, path))).toBe(true);
    }
  });

  test('delivery units have available predecessors and explicit acceptance without claiming execution', () => {
    const seen = new Set<string>();
    for (const unit of direction.deliveryUnits) {
      expect(seen.has(unit.id)).toBe(false);
      for (const predecessor of unit.prerequisites) expect(seen.has(predecessor)).toBe(true);
      for (const path of unit.targets) expect(existsSync(resolve(root, path))).toBe(true);
      expect(unit.acceptance.length).toBeGreaterThan(0);
      seen.add(unit.id);
    }
    expect(direction.phase).toBe('source_context_slice_verified_product_pending');
    expect(direction.evidence.wholeDirectionImplemented).toBe(false);
    expect(direction.evidence.studentReadContextImplemented).toBe(true);
    expect(direction.sourceProgress.fullDeliveryUnitComplete).toBe(false);
    expect(existsSync(resolve(root,direction.sourceProgress.reviewRef))).toBe(true);
    expect(teacherWorkContextSourceReview.wholeGoalComplete).toBe(false);
    expect(teacherWorkContextSourceReview.platformReference.newAuthority).toBe(false);
    expect(direction.evidence.liveReadsPerformed).toBe(false);
    expect(direction.evidence.nativeWebMcpAccepted).toBe(false);
    expect(direction.evidence.teacherAccepted).toBe(false);
    expect(direction.deferredEffects).toContain('Historical worker/reviewer/Cron budgets');
  });

  test('canonical continuation retains product references without stealing the concurrent active Work', () => {
    const checkpoint = validateWorkflowCheckpoint(JSON.parse(readFileSync(resolve(root, 'handoffs/workflow-current-state.json'), 'utf8')));
    const context = checkpoint.engineeringContext!;
    expect(context.currentWork?.ownerProfile).toBe('dc-gang-a-dev');
    expect(context.nextSteps.some(step=>step.referencePaths.includes('docs/teacher-ontology-delivery-plan.ts'))).toBe(true);
    const programme=teacherOntologyDeliveryPlan.systemRefactor;
    expect(programme.source.session).toBe('20261007_182212_d36637');
    expect(existsSync(resolve(root,programme.baseline))).toBe(true);
    expect(programme.priorities.map(unit=>unit.id)).toEqual(['S0_teacher_safety','S1_student_domain_sync','S2_teacher_workflow_coverage','S3_live_human_agent_acceptance','S4_design_evaluation','S5_gang_a_architecture_adoption']);
    const seen=new Set<string>();for(const unit of programme.priorities){for(const dependency of unit.dependsOn)expect(seen.has(dependency)).toBe(true);seen.add(unit.id);expect(unit.verification.length).toBeGreaterThan(0);expect(unit.recovery.length).toBeGreaterThan(0);}
    expect(programme.excluded).toContain('Official academy mutation');
    expect(programme.excluded).toContain('Automatic replay of stopped D4/P2 worker assignments');
    expect(context.confirmedDecisions.find(row => row.id === 'student_knowledge_graph_ontology')!.statement).toContain('consumed at runtime');
    expect(context.dispatch).toEqual([]);
    const summary = workflowSummary(checkpoint);
    expect(summary.authorizesProductionEffects).toBe(false);
    expect(summary.establishesCurrentResourceAccess).toBe(false);
    expect(summary.executesNextStep).toBe(false);
  });
});

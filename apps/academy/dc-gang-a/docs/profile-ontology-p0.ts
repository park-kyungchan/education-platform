import type { profileOntologyRefactorPlan } from './profile-ontology-refactor-plan';

type WorkflowFamily = (typeof profileOntologyRefactorPlan)['scope']['workflowFamilies'][number];
type Owner = 'academy_lead' | 'hermes_native' | 'common_platform' | 'teacher_or_source';
type NextUnit = 'P1_atomic_context_contracts' | 'P2_native_work_and_evaluation_binding' | 'P3_authentication_and_original_recovery_proving_case' | 'P4_whole_profile_consumer_migration';
type Disposition = 'retain_owner_and_qualify' | 'migrate_selected_current_rules' | 'preserve_compatibility' | 'defer_effects';
type EvidenceClass = 'current_normative_selection' | 'native_required_format' | 'original_evidence' | 'historical_view' | 'unmerged_candidate' | 'local_procedure' | 'shared_knowledge';
interface SourceRef {
  scope: 'repository' | 'profile' | 'installed_native' | 'shared_owner' | 'native_tool';
  path: string;
  anchor: string;
  role: 'contract' | 'consumer' | 'procedure' | 'evidence';
}

/** P0 source/consumer disposition. No dispatch, native state ownership or P1 contract implementation.
 * Effects below describe P0 only. The later, separately user-admitted smart_policy change is recorded
 * in docs/backend-autonomy-operating-contract.ts, not granted or executed by this coverage map.
 */
export const p0Sources = {
  plan: { scope: 'repository', path: 'docs/profile-ontology-refactor-plan.ts', anchor: 'deliveryUnits', role: 'contract' },
  checkpoint: { scope: 'repository', path: 'handoffs/workflow-current-state.json', anchor: 'engineeringContext', role: 'contract' },
  routing: { scope: 'repository', path: 'docs/workflow-routing.json', anchor: 'contextReadRouting', role: 'contract' },
  selector: { scope: 'repository', path: 'harness/context_routing.ts', anchor: 'export function entryReadPlan', role: 'consumer' },
  checkpointReader: { scope: 'repository', path: 'harness/workflow_checkpoint.ts', anchor: 'export function workflowContext', role: 'consumer' },
  operational: { scope: 'repository', path: 'docs/academy-operational-contract.json', anchor: 'temporaryAuthorityOrigin', role: 'contract' },
  operationalReader: { scope: 'repository', path: 'src/academy/operationalContract.ts', anchor: 'selectOperationalTopic', role: 'consumer' },
  endpoints: { scope: 'repository', path: 'harness/endpoints.ts', anchor: '--contract-topic', role: 'consumer' },
  profile: { scope: 'repository', path: 'docs/hermes-backend-profile.ts', anchor: 'selectionScope', role: 'contract' },
  agents: { scope: 'repository', path: 'AGENTS.md', anchor: 'Current Lead and native entry', role: 'procedure' },
  soul: { scope: 'profile', path: 'SOUL.md', anchor: 'do not assume `--contract-topic` is implemented', role: 'procedure' },
  memory: { scope: 'native_tool', path: 'memory', anchor: 'target=user|memory; active profile; native writer', role: 'consumer' },
  todo: { scope: 'native_tool', path: 'todo_list', anchor: 'session-owned task list; only one in_progress', role: 'consumer' },
  projects: { scope: 'native_tool', path: 'desktop_project', anchor: 'list; active_id and primary_path', role: 'consumer' },
  kanban: { scope: 'native_tool', path: 'kanban_list', anchor: 'board-scoped list; native Task lifecycle remains Hermes-owned', role: 'consumer' },
  promptBuilder: { scope: 'installed_native', path: '/opt/hermes/agent/prompt_builder.py', anchor: 'build_context_files_prompt', role: 'consumer' },
  skillReader: { scope: 'installed_native', path: '/opt/hermes/tools/skills_tool.py', anchor: 'def _skill_search_dirs', role: 'consumer' },
  activeSessions: { scope: 'installed_native', path: '/opt/hermes/hermes_cli/active_sessions.py', anchor: 'currently open chat surfaces', role: 'consumer' },
  botContract: { scope: 'repository', path: 'docs/bot-development-contract.ts', anchor: 'export const botDevelopmentContract', role: 'contract' },
  botRunbook: { scope: 'repository', path: 'docs/bot-development-runbook.ts', anchor: 'export const botDevelopmentRunbook', role: 'procedure' },
  botDecision: { scope: 'repository', path: 'harness/bot_governance.ts', anchor: 'export function decideBotDevelopment', role: 'consumer' },
  autonomy: { scope: 'repository', path: 'docs/backend-autonomy-operating-contract.ts', anchor: 'export const backendAutonomyOperatingContract', role: 'contract' },
  academySkill: { scope: 'profile', path: 'skills/academy-bot-development/SKILL.md', anchor: 'Canonical policy stays', role: 'procedure' },
  hermesSkill: { scope: 'profile', path: 'skills/autonomous-ai-agents/hermes-agent/SKILL.md', anchor: 'Prefer `delegate_task`', role: 'procedure' },
  reviewSkill: { scope: 'profile', path: 'skills/software-development/requesting-code-review/SKILL.md', anchor: 'Maximum 2 fix-and-reverify cycles', role: 'procedure' },
  debugSkill: { scope: 'profile', path: 'skills/software-development/systematic-debugging/SKILL.md', anchor: 'The Rule of Three', role: 'procedure' },
  tddSkill: { scope: 'profile', path: 'skills/software-development/test-driven-development/SKILL.md', anchor: 'With governed native workers', role: 'procedure' },
  planSkill: { scope: 'profile', path: 'skills/software-development/plan/SKILL.md', anchor: 'canonical plan', role: 'procedure' },
  handoffSkill: { scope: 'profile', path: 'skills/software-development/cross-session-change-handoff/SKILL.md', anchor: 'current ownership', role: 'procedure' },
  ontologySkill: { scope: 'profile', path: 'skills/software-development/ontology-harness-engineering/SKILL.md', anchor: 'When auditing runtime prose', role: 'procedure' },
  gitSkill: { scope: 'profile', path: 'skills/github/github-pr-workflow/SKILL.md', anchor: '# Repo Git and PR Lifecycle', role: 'procedure' },
  oldIntent: { scope: 'repository', path: 'docs/CODEX_CONTEXT.md', anchor: '## Decisions and source quality', role: 'evidence' },
  oldDirection: { scope: 'repository', path: 'docs/WHOLE_LENS_DECISION.md', anchor: '## 6. Execution DAG v1', role: 'evidence' },
  portable: { scope: 'repository', path: 'docs/PORTABLE_WORKSPACE.md', anchor: '## Fresh Windows checkout', role: 'evidence' },
  oldContextMap: { scope: 'repository', path: 'harness/context-map.md', anchor: '# Desktop Context and Authority Map', role: 'evidence' },
  oldDatabase: { scope: 'repository', path: 'docs/LMS_DETERMINISTIC_READ_ARCHITECTURE.md', anchor: 'DB_{studentName}', role: 'evidence' },
  oldBlueprint: { scope: 'repository', path: 'docs/MAIN_SHEET_NATIVE_UX_BLUEPRINT.md', anchor: 'MAIN_SHEET_ONE_TAB_CUTOVER.md', role: 'evidence' },
  oldCutover: { scope: 'repository', path: 'docs/MAIN_SHEET_ONE_TAB_CUTOVER.md', anchor: 'MAIN_SHEET_NATIVE_UX_BLUEPRINT.md', role: 'evidence' },
  oldArchitecture: { scope: 'repository', path: 'docs/system_architecture.md', anchor: 'logged-in Codex in-app Browser', role: 'evidence' },
  compatibilityLead: { scope: 'repository', path: 'harness/lead.ts', anchor: 'teacher_web_Chrome_DevTools', role: 'consumer' },
  workspaceBridge: { scope: 'repository', path: 'harness/workspace_entry.ts', anchor: 'outside_fixed_managed_checkout', role: 'consumer' },
  sourceImports: { scope: 'repository', path: 'docs/source-import-manifest.json', anchor: 'snapshot_date', role: 'evidence' },
  cloud: { scope: 'repository', path: 'harness/cloud.ts', anchor: 'cloud_command_failed:', role: 'consumer' },
  package: { scope: 'repository', path: 'package.json', anchor: 'test:workflow', role: 'consumer' },
  publicationAudit: { scope: 'repository', path: 'harness/tools/prepush_audit.ts', anchor: 'export function auditPublication', role: 'consumer' },
  duty: { scope: 'repository', path: 'src/academy/classroomCyclePolicy.ts', anchor: 'export const classroomCyclePolicy', role: 'contract' },
  application: { scope: 'repository', path: 'src/academy/application.ts', anchor: 'export class TeacherApplication', role: 'consumer' },
  server: { scope: 'repository', path: 'src/academy/server.ts', anchor: 'TeacherApplication', role: 'consumer' },
  sourceClient: { scope: 'repository', path: 'src/lms/academyHttpClient.ts', anchor: 'export class AcademyHttpClient', role: 'consumer' },
  readContract: { scope: 'repository', path: 'docs/academy-deterministic-read-contract.ts', anchor: 'export', role: 'contract' },
  recovery: { scope: 'repository', path: 'src/academy/recovery.ts', anchor: 'export function decryptRecovery', role: 'consumer' },
  teacherPlan: { scope: 'repository', path: 'docs/teacher-ontology-delivery-plan.ts', anchor: 'export const teacherOntologyDeliveryPlan', role: 'contract' },
  productReview: { scope: 'repository', path: 'review/exact-learning-work-2026-10-07.ts', anchor: 'R13', role: 'evidence' },
  blockers: { scope: 'repository', path: 'tests/academy/teacherClinicReviewBlockers.test.ts', anchor: 'test', role: 'consumer' },
  d4: { scope: 'repository', path: 'review/d4-direct-source-consumer-2026-10-06.json', anchor: 'USER_STOPPED', role: 'evidence' },
  sharedManifest: { scope: 'shared_owner', path: '/opt/data/shared-llm-wiki/typed/operational-ontology/v1/manifest.json', anchor: 'knowledge-not-permission', role: 'contract' },
  sharedQuery: { scope: 'shared_owner', path: '/opt/data/shared-llm-wiki/typed/operational-ontology/v1/query.ts', anchor: 'selectContext(loadKnowledge()', role: 'consumer' },
} as const satisfies Record<string, SourceRef>;

type Ref = keyof typeof p0Sources;
interface WorkflowDisposition {
  id: WorkflowFamily;
  accountableOwner: Owner;
  enforcementOwner: Owner;
  meaningRefs: readonly Ref[];
  consumers: readonly { ref: Ref; kind: 'executed_read_only' | 'source_traced' | 'human_procedure' | 'advisory_only' }[];
  disposition: Disposition;
  nextUnit: NextUnit;
  gap: string;
  conflictIds: readonly string[];
  recoveryRef: Ref;
}
interface ConflictDisposition {
  id: string;
  refs: readonly Ref[];
  owner: Owner;
  classification: 'superseded_scope' | 'policy_overlap' | 'missing_consumption' | 'evidence_limit';
  currentAuthorityRef: Ref;
  observed: string;
  resolution: string;
  nextUnit: NextUnit;
  state: 'disposition_recorded_not_migrated';
}
interface P0Disposition {
  schemaVersion: 1;
  kind: 'profile_ontology_p0_disposition';
  revision: string;
  scope: 'dc-gang-a-dev_whole_profile_workflow_families_not_all_Hermes_profiles';
  owner: 'dc-gang-a-dev';
  observedAtUtc: string;
  sourceHead: string;
  programmeRef: Ref;
  coverage: readonly WorkflowDisposition[];
  artifactClasses: readonly { id: EvidenceClass; refs: readonly Ref[]; owner: Owner; handling: 'retain' | 'select_then_migrate' | 'retain_separate_owner'; retirement: 'none_in_P0'; reason: string }[];
  conflicts: readonly ConflictDisposition[];
  retirementDependencies: readonly { sourceRefs: readonly Ref[]; consumingPaths: readonly string[]; relation: 'runtime_or_test' | 'document_reference' | 'compatibility'; nextUnit: NextUnit; retirementAllowed: false }[];
  sharedOwnerRequests: readonly { id: string; owner: 'ontology-platform'; consumerRefs: readonly Ref[]; gap: string; requestedEvidence: string; state: 'identified_not_sent'; blocksP0: false }[];
  inventory: { originalInventory: string; refreshedInventory: string; localSkillBodies: number; trackedMarkdown: number; semanticCoverage: string; modifiedBundledSkills: readonly string[] };
  observation: { projectId: string; sessionId: string; nativeOwnership: string; model: string; modelObservationGrantsWorkerQualification: false; localRecovery: string; baselineDirtyPaths: number };
  effects: { retiredPaths: readonly never[]; productRepairs: false; sourceAcquisition: false; agentsDispatched: false; budgetsRenewed: false; nativeConfigurationChanged: false; sharedOwnerChanged: false; publication: false; grantsEffects: false };
  acceptanceBoundary: { p0: 'coverage_and_disposition_only'; consumerMigration: 'not_performed'; independentAgentReview: 'not_performed'; wholeProfileComplete: false; productComplete: false };
}

export const profileOntologyP0 = {
  schemaVersion: 1,
  kind: 'profile_ontology_p0_disposition',
  revision: '2026-10-07-p0-r1',
  scope: 'dc-gang-a-dev_whole_profile_workflow_families_not_all_Hermes_profiles',
  owner: 'dc-gang-a-dev',
  observedAtUtc: '2026-10-07T02:43:18.244Z',
  sourceHead: '5074aeb5649c1a97ad06d33b9f895296fb4c3ad6',
  programmeRef: 'plan',
  coverage: [
    { id: 'context_and_intent_intake', accountableOwner: 'academy_lead', enforcementOwner: 'hermes_native', meaningRefs: ['checkpoint', 'operational', 'oldIntent', 'oldDirection'], consumers: [{ ref: 'checkpointReader', kind: 'executed_read_only' }, { ref: 'selector', kind: 'executed_read_only' }, { ref: 'promptBuilder', kind: 'source_traced' }], disposition: 'migrate_selected_current_rules', nextUnit: 'P1_atomic_context_contracts', gap: 'Closed routing hashes entire selected files; it does not select attributed current atoms or establish comprehension. Native prompt discovery remains separate.', conflictIds: ['hot_context', 'stale_native_entry', 'cloud_scope'], recoveryRef: 'checkpoint' },
    { id: 'planning_and_priority', accountableOwner: 'academy_lead', enforcementOwner: 'hermes_native', meaningRefs: ['plan', 'checkpoint'], consumers: [{ ref: 'checkpointReader', kind: 'executed_read_only' }, { ref: 'todo', kind: 'executed_read_only' }, { ref: 'planSkill', kind: 'human_procedure' }], disposition: 'migrate_selected_current_rules', nextUnit: 'P1_atomic_context_contracts', gap: 'Programme containment and execution dependencies are described, not yet validated atomic relations. Existing native Todo owns this current leaf.', conflictIds: ['hot_context', 'product_queue'], recoveryRef: 'checkpoint' },
    { id: 'identity_ownership_and_effect_admission', accountableOwner: 'academy_lead', enforcementOwner: 'hermes_native', meaningRefs: ['operational', 'profile', 'autonomy'], consumers: [{ ref: 'projects', kind: 'executed_read_only' }, { ref: 'activeSessions', kind: 'source_traced' }, { ref: 'operationalReader', kind: 'executed_read_only' }, { ref: 'botDecision', kind: 'advisory_only' }], disposition: 'retain_owner_and_qualify', nextUnit: 'P2_native_work_and_evaluation_binding', gap: 'Declared ownership and advisory metadata do not enforce actual target effects. Read-only turn/registry observations are time-bounded, not repo locks.', conflictIds: ['stale_native_entry', 'advisory_vs_enforcement', 'configured_vs_observed'], recoveryRef: 'handoffSkill' },
    { id: 'agent_assignment_and_handoff', accountableOwner: 'academy_lead', enforcementOwner: 'hermes_native', meaningRefs: ['plan', 'botContract', 'botRunbook'], consumers: [{ ref: 'botDecision', kind: 'advisory_only' }, { ref: 'kanban', kind: 'executed_read_only' }, { ref: 'academySkill', kind: 'human_procedure' }], disposition: 'retain_owner_and_qualify', nextUnit: 'P2_native_work_and_evaluation_binding', gap: 'No fresh implementation/reviewer assignment admitted or exercised in P0. Precise controls and full tool-using lifecycle still require actual qualification.', conflictIds: ['skill_retry_policy', 'skill_delegate_examples', 'advisory_vs_enforcement', 'configured_vs_observed'], recoveryRef: 'handoffSkill' },
    { id: 'deterministic_tool_execution', accountableOwner: 'academy_lead', enforcementOwner: 'hermes_native', meaningRefs: ['operational', 'readContract'], consumers: [{ ref: 'endpoints', kind: 'executed_read_only' }, { ref: 'sourceClient', kind: 'source_traced' }, { ref: 'botDecision', kind: 'advisory_only' }], disposition: 'retain_owner_and_qualify', nextUnit: 'P1_atomic_context_contracts', gap: 'Catalog selection works offline. Source client presence does not qualify authentication or exact read operations; HTTP client also exposes separately gated write methods.', conflictIds: ['browser_fallback', 'advisory_vs_enforcement'], recoveryRef: 'readContract' },
    { id: 'implementation_and_integration', accountableOwner: 'academy_lead', enforcementOwner: 'hermes_native', meaningRefs: ['plan', 'profile', 'duty'], consumers: [{ ref: 'package', kind: 'source_traced' }, { ref: 'application', kind: 'source_traced' }, { ref: 'tddSkill', kind: 'human_procedure' }], disposition: 'retain_owner_and_qualify', nextUnit: 'P2_native_work_and_evaluation_binding', gap: 'Preserve the dirty implementation and source-only checks. Future implementation Agents must produce attributable file/test effects, not only suggestions applied by the Lead.', conflictIds: ['product_queue', 'advisory_vs_enforcement'], recoveryRef: 'handoffSkill' },
    { id: 'evaluation_review_and_completion', accountableOwner: 'academy_lead', enforcementOwner: 'hermes_native', meaningRefs: ['plan', 'botContract', 'productReview'], consumers: [{ ref: 'cloud', kind: 'source_traced' }, { ref: 'blockers', kind: 'source_traced' }, { ref: 'reviewSkill', kind: 'human_procedure' }], disposition: 'migrate_selected_current_rules', nextUnit: 'P2_native_work_and_evaluation_binding', gap: 'Keep source checks, independently executed review, native GUI/WebMCP, recovery and teacher acceptance separate. Historical RED remains RED; P0 checks do not retest or accept the product.', conflictIds: ['skill_retry_policy', 'product_queue', 'advisory_vs_enforcement'], recoveryRef: 'productReview' },
    { id: 'failure_recovery_and_interruption', accountableOwner: 'academy_lead', enforcementOwner: 'hermes_native', meaningRefs: ['checkpoint', 'botRunbook', 'productReview'], consumers: [{ ref: 'handoffSkill', kind: 'human_procedure' }, { ref: 'debugSkill', kind: 'human_procedure' }, { ref: 'recovery', kind: 'source_traced' }, { ref: 'server', kind: 'source_traced' }], disposition: 'retain_owner_and_qualify', nextUnit: 'P3_authentication_and_original_recovery_proving_case', gap: 'Native handle cancellation, uncertain external effects, reload recovery and independent durable restore are different boundaries. R10/R12/R13 are retained prerequisites, not P0 repairs.', conflictIds: ['skill_retry_policy', 'product_queue'], recoveryRef: 'productReview' },
    { id: 'git_release_and_owned_cleanup', accountableOwner: 'academy_lead', enforcementOwner: 'hermes_native', meaningRefs: ['agents', 'profile'], consumers: [{ ref: 'publicationAudit', kind: 'source_traced' }, { ref: 'gitSkill', kind: 'human_procedure' }], disposition: 'retain_owner_and_qualify', nextUnit: 'P4_whole_profile_consumer_migration', gap: 'Staged exact-path/diff review and exact-head remote acceptance remain required at publication. P0 does not adopt, stage or publish the pre-existing dirty candidate.', conflictIds: ['cloud_scope', 'product_queue'], recoveryRef: 'profile' },
    { id: 'knowledge_and_native_learning', accountableOwner: 'academy_lead', enforcementOwner: 'hermes_native', meaningRefs: ['sharedManifest', 'profile', 'ontologySkill'], consumers: [{ ref: 'sharedQuery', kind: 'executed_read_only' }, { ref: 'skillReader', kind: 'source_traced' }, { ref: 'memory', kind: 'source_traced' }], disposition: 'retain_owner_and_qualify', nextUnit: 'P4_whole_profile_consumer_migration', gap: 'Common definitions stay with ontology-platform; local bindings belong here. Native learning stays enabled; bundled user modifications need explicit provenance and no reset or same-name shadow.', conflictIds: ['shared_coverage', 'native_vs_authored', 'skill_retry_policy', 'skill_delegate_examples'], recoveryRef: 'ontologySkill' },
    { id: 'academy_source_to_teacher_experience', accountableOwner: 'academy_lead', enforcementOwner: 'teacher_or_source', meaningRefs: ['operational', 'duty', 'teacherPlan', 'readContract'], consumers: [{ ref: 'sourceClient', kind: 'source_traced' }, { ref: 'application', kind: 'source_traced' }, { ref: 'server', kind: 'source_traced' }], disposition: 'defer_effects', nextUnit: 'P3_authentication_and_original_recovery_proving_case', gap: 'Authentication/original recovery is the later proving case after P1/P2. No acquisition, storage migration, deployment, official finalization or parent send follows from P0.', conflictIds: ['browser_fallback', 'teacher_surface_and_storage', 'product_queue'], recoveryRef: 'teacherPlan' },
  ],
  artifactClasses: [
    { id: 'current_normative_selection', refs: ['operational', 'duty', 'profile', 'checkpoint', 'botContract', 'plan'], owner: 'academy_lead', handling: 'select_then_migrate', retirement: 'none_in_P0', reason: 'Select exact current fields and their user provenance at existing owners; old confirmed decisions in the checkpoint still need scope/supersession, not timestamp precedence.' },
    { id: 'native_required_format', refs: ['agents', 'soul', 'memory', 'skillReader'], owner: 'hermes_native', handling: 'retain', retirement: 'none_in_P0', reason: 'Hermes owns discovery and writers. Local AGENTS/SOUL/Skills content is authored policy/procedure, not automatically native-generated truth; preserve Markdown and native learning.' },
    { id: 'original_evidence', refs: ['oldIntent', 'sourceImports', 'productReview', 'd4'], owner: 'teacher_or_source', handling: 'retain', retirement: 'none_in_P0', reason: 'Retain source/user provenance and every failed or stopped generation. Historical documents can contain student material: reference exact paths, do not copy their bodies into the P0 map.' },
    { id: 'historical_view', refs: ['oldDirection', 'portable', 'oldContextMap', 'oldDatabase', 'oldBlueprint', 'oldCutover', 'oldArchitecture'], owner: 'academy_lead', handling: 'select_then_migrate', retirement: 'none_in_P0', reason: 'Keep original bytes. Migrate only selected current rules after runtime/test/reference parity; Windows/Main/browser/physical student DB guidance is not current effect authority.' },
    { id: 'unmerged_candidate', refs: ['teacherPlan', 'productReview', 'd4'], owner: 'academy_lead', handling: 'retain', retirement: 'none_in_P0', reason: 'Preserve all 48 pre-existing dirty paths and the separate contract-audit, answer-reads and D4 worktrees. Their paths/HEADs do not assign their work to P0.' },
    { id: 'local_procedure', refs: ['academySkill', 'hermesSkill', 'reviewSkill', 'debugSkill', 'tddSkill', 'handoffSkill', 'planSkill', 'ontologySkill'], owner: 'academy_lead', handling: 'select_then_migrate', retirement: 'none_in_P0', reason: '73 non-hidden Skill bodies are structurally inventoried, not fully semantically audited. Qualify load-bearing procedures first, preserve bundled/local provenance through native skill_manage.' },
    { id: 'shared_knowledge', refs: ['sharedManifest', 'sharedQuery'], owner: 'common_platform', handling: 'retain_separate_owner', retirement: 'none_in_P0', reason: 'Reuse the observed bounded u01-candidate-r2 selection; no shared Wiki fork, owner edit or claim of all-profile adoption.' },
  ],
  conflicts: [
    { id: 'hot_context', refs: ['oldIntent', 'oldDirection', 'routing', 'selector', 'checkpoint'], owner: 'academy_lead', classification: 'superseded_scope', currentAuthorityRef: 'operational', observed: 'Both historical intent files remain mandatory for every closed purpose; dated Main ownership/readiness and old Desktop checkpoints coexist with durable teacher intent.', resolution: 'P1 selects attributed current decisions and explicit historical provenance. Preserve original files and update all current consumers/tests together before retiring hot-path instructions.', nextUnit: 'P1_atomic_context_contracts', state: 'disposition_recorded_not_migrated' },
    { id: 'stale_native_entry', refs: ['soul', 'agents', 'endpoints'], owner: 'academy_lead', classification: 'superseded_scope', currentAuthorityRef: 'operational', observed: 'SOUL still warns not to assume --contract-topic exists; the actual endpoint:query roles/help consumers executed successfully in main. The separate audit checkout still exists.', resolution: 'Reconcile the active profile entry with the actual merged consumer without adopting the separate audit candidate. Preserve runtime format; remove stale entry duplication only in the admitted native-entry migration.', nextUnit: 'P1_atomic_context_contracts', state: 'disposition_recorded_not_migrated' },
    { id: 'cloud_scope', refs: ['routing', 'portable', 'oldContextMap', 'workspaceBridge', 'agents'], owner: 'academy_lead', classification: 'superseded_scope', currentAuthorityRef: 'profile', observed: 'Continuation still says source-only Cloud and routes historical Cloud/Main scopes. The compatibility bridge is exact /workspace-only; desktop_gate/context-map and portable guidance target old Windows evidence.', resolution: 'Use connected Backend and selected purpose now. P1 separates scope labels; P4 retains required compatibility callers. Do not run private resume, install legacy tooling or overwrite a parent AGENTS merely to satisfy source-only work.', nextUnit: 'P1_atomic_context_contracts', state: 'disposition_recorded_not_migrated' },
    { id: 'browser_fallback', refs: ['routing', 'oldArchitecture', 'compatibilityLead', 'endpoints', 'sourceClient'], owner: 'academy_lead', classification: 'superseded_scope', currentAuthorityRef: 'operational', observed: 'workflow-routing routes[0] still advertises an authorized UI fallback; system_architecture and legacy lead.ts retain browser-oriented guidance. Current endpoint help refuses automatic browser fallback.', resolution: 'P1 binds source access to the current sourceAccess owner. P4 reviews legacy caller scope before changing compatibility output; do not activate the source client or export browser authentication.', nextUnit: 'P1_atomic_context_contracts', state: 'disposition_recorded_not_migrated' },
    { id: 'teacher_surface_and_storage', refs: ['oldIntent', 'oldDirection', 'oldDatabase', 'oldBlueprint', 'oldCutover'], owner: 'academy_lead', classification: 'superseded_scope', currentAuthorityRef: 'operational', observed: 'Historical Main/individual student-tab architecture differs from the selected teacher web app and shared private PostgreSQL logical partitions.', resolution: 'Select current product fields and checkpoint decisions single_main_visibility/student_database_direction. Preserve existing Main/SPT and other instructors until reviewed transition acceptance; no Sheet deletion or database migration.', nextUnit: 'P1_atomic_context_contracts', state: 'disposition_recorded_not_migrated' },
    { id: 'skill_retry_policy', refs: ['reviewSkill', 'debugSkill', 'plan', 'botContract'], owner: 'academy_lead', classification: 'policy_overlap', currentAuthorityRef: 'plan', observed: 'Review Skill says maximum two cycles; debugging Skill requires discussion after three failures. The user selected mission-specific finite budgets and progress-based escalation.', resolution: 'P2 binds the mission policy once with provenance and native limits, then reconciles maintained Skill guidance through native writers. Preserve useful nonprogress diagnostics, actual hard limits and exhausted assignments.', nextUnit: 'P2_native_work_and_evaluation_binding', state: 'disposition_recorded_not_migrated' },
    { id: 'skill_delegate_examples', refs: ['hermesSkill', 'reviewSkill', 'debugSkill', 'tddSkill', 'academySkill'], owner: 'academy_lead', classification: 'policy_overlap', currentAuthorityRef: 'botContract', observed: 'Hermes hub still prefers illustrative delegate_task for quick work. Review has native exclusion near the example, but later illustrative dispatcher/fix examples remain; TDD/debug already include governed-native sections.', resolution: 'P2 selects the existing academy native procedure; preserve useful upstream instruction and modify only the applicable local binding. No delegate_task, broad shell substitute or extra agent is used in P0.', nextUnit: 'P2_native_work_and_evaluation_binding', state: 'disposition_recorded_not_migrated' },
    { id: 'advisory_vs_enforcement', refs: ['profile', 'botContract', 'botDecision', 'autonomy'], owner: 'academy_lead', classification: 'missing_consumption', currentAuthorityRef: 'botContract', observed: 'Bot CLI explicitly reports permissionGranted=false and nativeEvidenceVerified=false. Declared restrictions and the exposed precise-task schema do not themselves establish an enforcing implementation-worker lifecycle.', resolution: 'P2 binds current Work to actual native controls and separately proves attributable file/test/review effects. Keep unsupported lanes closed without blocking independent source-only P0.', nextUnit: 'P2_native_work_and_evaluation_binding', state: 'disposition_recorded_not_migrated' },
    { id: 'configured_vs_observed', refs: ['profile', 'botContract', 'activeSessions'], owner: 'academy_lead', classification: 'evidence_limit', currentAuthorityRef: 'botContract', observed: 'Repo profile declares Sol/xhigh defaults; current native Session metadata reports gpt-6-astra-900k. Defaults are explicitly not assignment controls and capacity is null.', resolution: 'Record the actual Lead identity literally; do not normalize it into Sol, claim effective effort/capacity or use it to qualify a new Agent. Future assignment selection needs supported current controls.', nextUnit: 'P2_native_work_and_evaluation_binding', state: 'disposition_recorded_not_migrated' },
    { id: 'native_vs_authored', refs: ['soul', 'agents', 'skillReader', 'promptBuilder', 'memory'], owner: 'academy_lead', classification: 'policy_overlap', currentAuthorityRef: 'profile', observed: 'Native discovery requires prose formats, while domain policy and current work overlap across authored SOUL/AGENTS/Skills and typed owners.', resolution: 'Retain native formats/writers and learning; progressively reduce duplicated local policy after consumer checks. No engine, prompt/cache/compaction or other-profile change.', nextUnit: 'P4_whole_profile_consumer_migration', state: 'disposition_recorded_not_migrated' },
    { id: 'shared_coverage', refs: ['sharedManifest', 'sharedQuery', 'plan'], owner: 'common_platform', classification: 'evidence_limit', currentAuthorityRef: 'sharedManifest', observed: 'The exact shared query succeeded with selectionComplete=true only for declared subject closure. Query coverage still contains pending-review wording while the manifest describes bounded review/fresh-use evidence.', resolution: 'Do not equate literal selection completeness with all doctrine or local permission. Request owner-scoped coverage/provenance reconciliation if broader adoption needs it; do not repair shared files here.', nextUnit: 'P4_whole_profile_consumer_migration', state: 'disposition_recorded_not_migrated' },
    { id: 'product_queue', refs: ['teacherPlan', 'productReview', 'blockers', 'd4', 'checkpoint'], owner: 'academy_lead', classification: 'evidence_limit', currentAuthorityRef: 'plan', observed: 'R10/R12/R13 and failed clinic/cloud generations are preserved; D4 is USER_STOPPED. Older checkpoint nextSteps still describe product lanes alongside the current programme.', resolution: 'The current first step is governance-first P0 then P1/P2. P3 is conditional, not a resumed patch queue. Preserve originals, exact old runs, RED tests and spent budgets; no automatic product/worker continuation.', nextUnit: 'P3_authentication_and_original_recovery_proving_case', state: 'disposition_recorded_not_migrated' },
  ],
  retirementDependencies: [
    { sourceRefs: ['oldIntent', 'oldDirection'], consumingPaths: ['AGENTS.md', 'harness/context_routing.ts', 'harness/workspace_entry.ts', 'tests/harness/contextRouting.test.ts', 'tests/harness/workspaceEntry.test.ts', 'tests/harness/workflowCheckpoint.test.ts', 'harness/preclass_preview.ts'], relation: 'runtime_or_test', nextUnit: 'P1_atomic_context_contracts', retirementAllowed: false },
    { sourceRefs: ['oldIntent', 'oldDirection'], consumingPaths: ['docs/academy-whole-lens-target-architecture.json', 'docs/student-database-architecture-2026-10-01.json', 'docs/preclass-main-sheet-ux-2026-10-01.json', 'docs/google-api-enablement-proposal-2026-10-01.json', 'docs/main-sheet-live-refresh-wiring.json', 'docs/PORTABLE_WORKSPACE.md'], relation: 'document_reference', nextUnit: 'P4_whole_profile_consumer_migration', retirementAllowed: false },
    { sourceRefs: ['oldContextMap', 'portable'], consumingPaths: ['docs/CODEX_CONTEXT.md', 'harness/README.md', 'harness/desktop_gate.py', 'harness/context-map.md'], relation: 'compatibility', nextUnit: 'P4_whole_profile_consumer_migration', retirementAllowed: false },
    { sourceRefs: ['oldDatabase'], consumingPaths: ['docs/public-student-data-boundary.json'], relation: 'document_reference', nextUnit: 'P4_whole_profile_consumer_migration', retirementAllowed: false },
    { sourceRefs: ['oldBlueprint', 'oldCutover'], consumingPaths: ['docs/MAIN_SHEET_NATIVE_UX_BLUEPRINT.md', 'docs/MAIN_SHEET_ONE_TAB_CUTOVER.md'], relation: 'document_reference', nextUnit: 'P4_whole_profile_consumer_migration', retirementAllowed: false },
    { sourceRefs: ['hermesSkill', 'reviewSkill', 'debugSkill', 'tddSkill'], consumingPaths: ['/opt/hermes/tools/skills_tool.py'], relation: 'runtime_or_test', nextUnit: 'P2_native_work_and_evaluation_binding', retirementAllowed: false },
  ],
  sharedOwnerRequests: [
    { id: 'shared_coverage_provenance', owner: 'ontology-platform', consumerRefs: ['sharedQuery', 'sharedManifest'], gap: 'Query coverage pending wording and manifest review scope need an owner-authored distinction before stronger adoption claims.', requestedEvidence: 'Exact versioned coverage/acceptance semantics and supported portable query boundary; retain old source snapshots and the knowledge-not-permission contract.', state: 'identified_not_sent', blocksP0: false },
    { id: 'portable_work_binding', owner: 'ontology-platform', consumerRefs: ['botDecision', 'sharedQuery'], gap: 'No common runtime-enforced all-profile DATA/LOGIC/ACTION/GOVERNANCE Work contract was qualified by this P0.', requestedEvidence: 'If an existing common contract serves P1/P2, identify its owner, exact portable fields, enforcement consumer and failure tests. Do not impersonate default/Backend-bound CTX02 or build another platform here.', state: 'identified_not_sent', blocksP0: false },
  ],
  inventory: {
    originalInventory: '/opt/data/profiles/dc-gang-a-dev/artifacts/profile-governance-interview-20261007-b8e88b/structural-inventory.json',
    refreshedInventory: '/opt/data/profiles/dc-gang-a-dev/artifacts/profile-ontology-p0-690386/inventory.json',
    localSkillBodies: 73,
    trackedMarkdown: 68,
    semanticCoverage: 'All eleven planned workflow families; load-bearing current/legacy contracts and selected Skill bodies. File inventory is structural, not a claim that every Skill, imported document or past session was semantically audited.',
    modifiedBundledSkills: ['hermes-agent', 'requesting-code-review', 'systematic-debugging', 'test-driven-development'],
  },
  observation: {
    projectId: 'p_a5676068', sessionId: '20261007_114028_690386',
    nativeOwnership: 'desktop_project/list and hermes project show agree on the main checkout. Read-only native metadata observed only this profile turn/registry entry; predecessor b8e88b and 0a13a2 have tui_close. Known relevant boards have no running/ready rows. No machine-wide ownership or termination claim follows.',
    model: 'gpt-6-astra-900k', modelObservationGrantsWorkerQualification: false,
    localRecovery: '/opt/data/profiles/dc-gang-a-dev/artifacts/profile-ontology-p0-690386/prestate.json', baselineDirtyPaths: 48,
  },
  effects: { retiredPaths: [], productRepairs: false, sourceAcquisition: false, agentsDispatched: false, budgetsRenewed: false, nativeConfigurationChanged: false, sharedOwnerChanged: false, publication: false, grantsEffects: false },
  acceptanceBoundary: { p0: 'coverage_and_disposition_only', consumerMigration: 'not_performed', independentAgentReview: 'not_performed', wholeProfileComplete: false, productComplete: false },
} as const satisfies P0Disposition;

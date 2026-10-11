import type { ContextPurpose, ContextSourceId } from '../harness/context_routing';

export interface HermesBackendProfileContract {
  schemaVersion: 1;
  kind: 'repo_profile_contract';
  profile: string;
  repository: string;
  repositoryBindings: 'docs/repository-bindings.json';
  reviewLanes: {sourceReading:{profile:'dc-review';toolset:'source_review_readonly';requiresActualWireQualification:true;noWriteShellNetwork:true};suppliedOnly:readonly string[];grantsNativeAuthority:false};
  role: 'development_and_operations_lead';
  execution: 'connected_linux_backend';
  client: 'windows_desktop_remote_only';
  continuation: string;
  ontologyOwnership: { common: string; product: 'repository'; automaticCrossProfileSync: false };
  runtime: { bun: string; typescript: string; hermesModelDefault: string; provider: string; reasoning: 'xhigh'; selectionScope: 'declared_defaults_not_assignment_controls'; effectiveContextCapacity: null };
  autonomousGit: readonly string[];
  recurringOperations: { mode: 'initial_approved_envelope'; requiredBounds: readonly string[]; activeEnvelopes: readonly never[]; teacherReserved: readonly string[] };
  nativeProse: readonly string[];
  skillSelection: { enabled: readonly string[]; autoLoad: readonly never[]; importPolicy: string };
  pluginSelection: { required: readonly never[]; optional: readonly string[]; excluded: readonly string[] };
  priorities: readonly string[];
  activation: { gatewayStart: false; jobsInstalled: false; workersDispatched: false; accountChanges: false };
  recovery: readonly string[];
  contextSelection: { revision: string; currentCommonSources: readonly ContextSourceId[]; purposeSources: Readonly<Record<ContextPurpose, readonly ContextSourceId[]>>; commonDecisionIds: readonly string[]; purposeDecisionIds: Readonly<Record<ContextPurpose, readonly string[]>>; purposeQuestionWork: Readonly<Record<ContextPurpose, readonly string[]>>; historicalDecisionIds: readonly string[]; supersededDecisionIds: readonly string[]; originals: readonly string[] };
}

/** User-approved responsibility and proposed selection; not a native state mirror or permission engine. */
export const hermesBackendProfile = {
  schemaVersion: 1,
  kind: 'repo_profile_contract',
  profile: 'dc-gang-a-dev',
  repository: 'park-kyungchan/dc-gang-a',
  repositoryBindings: 'docs/repository-bindings.json',
  reviewLanes:{sourceReading:{profile:'dc-review',toolset:'source_review_readonly',requiresActualWireQualification:true,noWriteShellNetwork:true},suppliedOnly:['dc-context','dc-contract-audit'],grantsNativeAuthority:false},
  role: 'development_and_operations_lead',
  execution: 'connected_linux_backend',
  client: 'windows_desktop_remote_only',
  continuation: 'handoffs/workflow-current-state.json',
  contextSelection: {
    revision: '2026-10-08-dual-repository-native-r1',
    currentCommonSources: ['agent_instructions', 'engineering_checkpoint', 'routing_contract', 'operational_contract', 'backend_profile', 'profile_ontology_plan', 'teacher_delivery_plan', 'repository_bindings', 'repository_observation'],
    purposeSources: {
      continuation: [],
      interview: ['classroom_cycle_policy'],
      dependencies: ['cloud_environment', 'runtime_capabilities', 'backend_tooling', 'package_scripts'],
      main_sheet: ['classroom_cycle_policy', 'main_sheet_live_wiring', 'main_sheet_live_input', 'native_preservation'],
      google_integration: ['google_api_proposal', 'integration_registry', 'backend_tooling'],
      academy_local: ['classroom_cycle_policy', 'academy_checkpoint', 'academy_read_contracts', 'backend_map', 'academy_routes'],
      spt_mobile: ['spt_instructions', 'source_imports'],
      bot_development: ['backend_autonomy', 'bot_development_contract', 'bot_development_runbook', 'package_scripts'],
    },
    commonDecisionIds: ['artifact_format', 'ambiguity_handling', 'validation_selection', 'student_knowledge_graph_ontology', 'backend_execution_scope'],
    purposeDecisionIds: {
      continuation: ['backend_ontology_reuse', 'dual_repository_native_integration'],
      interview: ['priority_order', 'preclass_source_coverage', 'single_main_visibility', 'student_database_direction', 'preclass_cohort_presentation'],
      dependencies: ['model_family', 'google_cost_scope'],
      main_sheet: ['single_main_visibility', 'preparation_refresh_schedule', 'historical_approved_revision_views'],
      google_integration: ['q8_google_api_scope', 'google_cost_scope'],
      academy_local: ['preclass_source_coverage', 'backend_repeat_operations', 'backend_autonomous_goals'],
      spt_mobile: ['preclass_cohort_presentation'],
      bot_development: ['model_family', 'dual_repository_native_integration', 'backend_ontology_reuse'],
    },
    // Historical decisions remain at their original checkpoint owner, never deleted by selection.
    purposeQuestionWork: { continuation: [], interview: ['student_ontology_architecture', 'production_history_storage'], dependencies: [], main_sheet: [], google_integration: ['google_project_architecture'], academy_local: ['production_history_storage'], spt_mobile: [], bot_development: [] },
    historicalDecisionIds: ['lead_structure', 'requested_context_configuration', 'backend_harness_scope'],
    supersededDecisionIds: [],
    originals: ['docs/CODEX_CONTEXT.md', 'docs/WHOLE_LENS_DECISION.md'],
  },
  ontologyOwnership: {
    common: '/opt/data/shared-llm-wiki/concepts/ontology-aip-evals-sdlc-agent-start.md',
    product: 'repository',
    automaticCrossProfileSync: false,
  },
  runtime: { bun: '1.4.2', typescript: '7.0.2', hermesModelDefault: 'gpt-6.1-sol', provider: 'openai-codex', reasoning: 'xhigh', selectionScope: 'declared_defaults_not_assignment_controls', effectiveContextCapacity: null },
  autonomousGit: ['branch', 'worktree', 'commit', 'push', 'pull_request', 'review', 'exact_head_ci', 'merge', 'merge_readback', 'owned_merged_branch_worktree_cleanup'],
  recurringOperations: {
    mode: 'initial_approved_envelope',
    requiredBounds: ['target', 'fields', 'change_rules', 'recovery', 'same_target_readback'],
    activeEnvelopes: [],
    teacherReserved: ['teacher_judgment', 'official_record_finalization', 'final_parent_send'],
  },
  nativeProse: ['SOUL.md', 'memories/USER.md', 'memories/MEMORY.md', 'repo/AGENTS.md', 'selected SKILL.md and references'],
  skillSelection: {
    enabled: ['hermes-agent', 'ontology-start', 'ontology-harness-engineering', 'plan', 'test-driven-development', 'systematic-debugging', 'requesting-code-review', 'github', 'github-auth', 'github-pr-workflow', 'github-code-review', 'github-repo-management', 'cross-session-change-handoff', 'hermes-agent-skill-authoring', 'google-workspace', 'grounded-citations', 'llm-wiki', 'artifact-preview-delivery', 'docx', 'pdf', 'xlsx', 'document-to-action-items', 'dogfood', 'inspecting-hermes-desktop-dom', 'node-inspect-debugger', 'simplify-code', 'spike', 'blocked-page-recovery'],
    autoLoad: [],
    importPolicy: 'Native writers for absent user Skills; retain upstream bundled Skills. Independent copies with source identities, no mutable cross-profile symlinks. Common Wiki has one owner.',
  },
  pluginSelection: {
    required: [],
    optional: ['security-guidance'],
    excluded: ['automatic_context_injection', 'disk-cleanup', 'external_memory_service', 'google_meet', 'unrestricted_worker_launcher', 'SPT-fixed-origin browser-workbench'],
  },
  priorities: ['qualified_profile_runtime_and_reused_continuity', 'verified_git_lifecycle', 'date_first_all_student_preclass_review', 'student_kg_ontology_acceptance_queries_then_provider_comparison'],
  activation: { gatewayStart: false, jobsInstalled: false, workersDispatched: false, accountChanges: false },
  recovery: ['Preserve original Git/history and dated source evidence.', 'Native profile delete is a separately admitted teardown, not an automatic rollback.', 'No force push, main reset, foreign branch deletion or unsafe credential fallback.', 'Read back uncertain external writes before retry; retain their original identities.'],
} as const satisfies HermesBackendProfileContract;

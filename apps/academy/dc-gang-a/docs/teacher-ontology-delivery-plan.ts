interface TeacherWorkDirection {
  schemaVersion: 1;
  phase: 'source_context_slice_verified_product_pending';
  source: { sessionId: string; kind: 'current_teacher_interview'; lessonDate: string };
  goal: string;
  executionWindow: {
    desiredTeacherUseAt: '2026-10-07T14:00:00+09:00'; tradeoff: 'full_scope_over_deadline';
    admitted: 'staged_product_delivery_with_qualified_live_effects'; liveDataAndRuntime: 'admitted_after_source_identity_and_recovery_qualification';
    scopeReductionForDeadline: false; focusNow: string; nextSourceUnit: string; parallelPreparation: string;
  };
  programmeScope: readonly string[];
  teacherInput: {
    disposition: 'confirmed_input_partly_consumed_by_domain_policy';
    dutyOwner: 'src/academy/classroomCyclePolicy.ts';
    displayBookExample: string;
    sectionLabels: { elementaryGauss: readonly string[]; middleGauss: readonly string[] };
    expectedWork: 'assigned_section_and_item_range_not_every_catalog_entry';
    comprehensiveAssessment: 'eligible_after_designated_minor_unit_boundary_not_every_minor_unit';
    clinic: { solving: 'student'; grading: 'teacher'; review: 'teacher'; completion: 'explicit_teacher_input_after_repeated_correction_and_explanation' };
  };
  recordDestinations: readonly {
    kind: 'source_evidence' | 'teacher_clinic_history' | 'official_dayrecord' | 'parent_delivery';
    owner: 'source_and_private_versioned_copy' | 'private_product_postgresql' | 'academy_official_record' | 'teacher_final_sender';
    automaticProjection: false;
    qualification: string;
  }[];
  contextFieldPlan: readonly {
    unit: 'DATA' | 'LOGIC' | 'ACTION' | 'GOVERNANCE';
    typedFields: readonly string[];
    consumers: readonly string[];
    acceptance: string;
  }[];
  contentModel: { naming: string; hierarchy: readonly string[]; sectionPlacement: string; paperRelations: string; compatibility: string };
  ui: { layout: string; states: readonly string[]; completionAction: string; palette: Readonly<Record<string, string>>; typography: string; accessibility: string; skills: readonly string[] };
  deliveryUnits: readonly { id: string; prerequisites: readonly string[]; targets: readonly string[]; acceptance: readonly string[] }[];
  deferredEffects: readonly string[];
  interviewVerification: {
    scope: 'interview_continuation_and_source_only_not_product_acceptance';
    focusedTestsPassed: number;
    architectureTestsPassed: number;
    typecheck: 'passed';
    cloudCheck: 'passed_with_environment_dependent_skips';
    contextReadback: 'validated_non_executing';
    preservedHistoricalUnit: true;
    publication: 'not_performed';
  };
  sourceProgress: { scope: 'section_catalog_and_student_context_read_projection'; reviewRef: string; status: 'verified_synthetic_consumers_only'; fullDeliveryUnitComplete: false };
  evidence: { d3: string; d4: string; currentRuntimeQualified: false; liveReadsPerformed: false; wholeDirectionImplemented: false; studentReadContextImplemented: true; teacherAccepted: false; nativeWebMcpAccepted: false };
}

/** Current direction is selected below; historical plans never renew effect authority. */
export const teacherOntologyDeliveryPlan = {
  schemaVersion: 1,
  kind: 'teacher_ontology_product_delivery_plan',
  goal: 'Operate a private teacher website backed by the real five-student Backend database, with extensible student partitions, changing book assignments, grounded hierarchy and classroom queries/refresh.',
  systemRefactor: {
    revision:'2026-10-10-s6-r1',
    intentEvidence:'review/teacher-intent-reconciliation-2026-10-07.ts',
    source: {session:'20261007_182212_d36637',kind:'current_user_request_and_native_clarification'},
    baseline:'review/academy-system-audit-2026-10-07.ts',
    goal:'Complete the teacher-useful Ontology-driven application and its agent working context, not WebMCP registration or a passing source-only slice. Cover every requested business area with explicit disposition and actual consumer evidence.',
    architecture:'Current deployed baseline is one TypeScript/Bun application. The user permits substantial academy backend redesign for justified maintainability/extensibility; architectureReview compares options and requires final approval before implementation. Preserve teacher originals, identity, transactional safety and shared/native owners, not necessarily existing classes or module layout.',
    admission:'The user explicitly approved recommendation 2026-10-08-a1. S5 now implements the bounded B1-B4 academy architecture and gang-a visual adoption, with scoped tests and compatible rollout gates. Source/authentication/recovery and teacher finalization remain separate exact boundaries. Preserve prior S0-S3 evidence, originals, other writers and failed candidates; no old worker, budget or queue resumes.',
    excluded:['Official academy mutation','Paper generation or printing','Parent delivery','New paid services/accounts/DNS/IAM','Installed Hermes/Host/other-container changes','Automatic replay of stopped D4/P2 worker assignments'],
    priorities:[
      {id:'S0_teacher_safety',dependsOn:[],outcome:'Authenticated scene-bound teacher commands, protected refused originals and fresh-policy reconciliation across sibling UI/HTTP/storage paths.',targets:['src/academy/application.ts','src/academy/server.ts','src/academy/records.ts','src/academy/postgresStore.ts','src/academy/web/client.ts','src/academy/web/clinicWorkView.ts','src/academy/web/teacherObservationEditor.ts'],verification:'Existing R10/R12/R13 RED regressions plus actor-switch, missing-expectation, refused/replayed/uncertain/restarted request negatives, isolated PostgreSQL and actual UI/application readback.',recovery:'Freeze predecessor files before edits; restore only unchanged owned deltas. No production activation while required safety regressions fail.'},
      {id:'S1_student_domain_sync',dependsOn:['S0_teacher_safety'],outcome:'One stable-ID-scoped request coordinates independently qualified areas, durable request recovery, duplicate exclusion and stale-generation guards. Preserve each failed area last-successful evidence and teacher originals.',targets:['src/academy/refresh.ts','src/academy/nativeConnector.ts','src/academy/sourceBridge.ts','src/academy/postgresStore.ts','src/academy/main.ts','src/lms/academyHttpClient.ts'],verification:'Review stopped D4 without adopting its FAIL status as acceptance; close both remaining recovery defects, preserve direct provenance, test partial failures/cross-tab/process loss, then fresh exact-source-to-store readback for each connected family.',recovery:'Retain prior heads on failure and reconcile original request before retry. Unqualified families remain blocked/unknown rather than silently successful.'},
      {id:'S2_teacher_workflow_coverage',dependsOn:['S1_student_domain_sync'],outcome:'Connect registration, attendance/schedule, journal/homework, prestudy, section grading/wrong-answer clinics and DT/ZT/progress through shared typed queries and teacher work scenes.',targets:['src/academy/teacherWorkContext.ts','src/academy/classroomCyclePolicy.ts','src/academy/application.ts','src/academy/web','Existing exact src/lms adapters'],verification:'For every area: real scoped retrieval, interpretation, identity/range/page validation, protected saved readback and displayed evidence. Separate not-supported, not-mapped, not-observed, failed and verified-empty states.',recovery:'No name-only joins, source-generated assignments, overwritten teacher completion or removal of existing Main/SPT consumers.'},
      {id:'S3_live_human_agent_acceptance',dependsOn:['S0_teacher_safety','S1_student_domain_sync','S2_teacher_workflow_coverage'],outcome:'Restore the existing protected application and exercise a normal teacher workflow, real native WebMCP and failure/recovery; measure usefulness with the teacher.',targets:['src/academy/main.ts','src/academy/server.ts','src/academy/web/client.ts','src/academy/recovery.ts','Existing private teacher runtime and exact owned hostname'],verification:'Actual same-target auth/source/store/UI readback, source outage and later correction, independent restore, real native tool discovery/invocation and teacher acceptance. Report each missing gate separately.',recovery:'Compatible staged cutover only after exact identity/history/backup qualification. Never recreate an account, alter unknown listeners or substitute a fake WebMCP implementation.'},
      {id:'S4_design_evaluation',dependsOn:['S0_teacher_safety'],outcome:'Compare synthetic teacher tasks in a protected reusable design lab; evaluate design references and maintainable shared UI/agent context without resuming S1/S2.',targets:['src/academy/web/designLab.ts','src/academy/web/designLabCatalog.ts','src/academy/server.ts','src/academy/runtimeStatus.ts','harness/academy_service_status.ts'],verification:'Authenticated gallery HTTP and exact deployed HTML; equivalent facts across themes, scope rejection, responsive native browser and keyboard checks; teacher comparison feedback remains separate.',recovery:'Keep predecessor release and exact existing DB/auth/tunnel. Never reacquire academy data, restart healthy components, adopt uninspected gang-a or renew a worker budget.'},
      {id:'S5_gang_a_architecture_adoption',dependsOn:['S4_design_evaluation'],outcome:'Implement user-approved architectureReview B1-B4 and faithful gang-a visual adoption across the existing teacher application.',targets:['src/academy/application.ts','src/academy/postgresStore.ts','src/academy/refresh.ts','src/academy/teacherWorkContext.ts','src/academy/web','src/academy/server.ts','tests/academy','tests/architecture'],verification:'Test-first shared contracts and narrow ports; coherent read snapshots and unchanged transactional command invariants; actual styled UI/gallery, isolated PostgreSQL and compatible same-target deployment/readback. Teacher acceptance and native WebMCP remain separately reported.',recovery:'Preserve prestate and existing healthy runtime; retain legacy readers, original records and prior release. No automatic source acquisition, worker resume, schema loss or foreign cleanup.'},
      {id:'S6_mathcrew_production_assurance',dependsOn:[],outcome:'Prepare the user-confirmed refined B public and teacher release against the actual retained baseline: attention-first homework and attributable carryover, minimized source/teacher evidence, real EN/KO, scoped regression and accessibility gates. This independently selectable source unit grants no live effects and accepts no old prerequisite or worker budget by implication.',targets:['src/academy/web','tests/academy','tests/architecture','harness/academy_browser_rehearsal.ts','Existing approved mathCrew public artifact'],verification:'Source-bound RED/GREEN, exact baseline/candidate pins, preserved actor/target/revision/idempotency/draft guards, every EN/KO route/state, current independent source review and actual native browser. Live auth/source/store, whole WCAG and operating recovery remain separate required mission evidence.',recovery:'Retain the actual release, originals and mixed source. Use explicit candidate paths and finite fresh native admission; no official teacher save, parent send, credential interchange, whole-tree publication, permanent model supervisor or implied Host effects.'},
    ],
    currentUnit:'S6_mathcrew_production_assurance',
    productionExecution:{
      revision:'2026-10-10-production-direction-1',
      source:{kind:'current_user_and_native_clarification',directionCheckpoint:'confirmed',asOf:'2026-10-10'},
      purpose:'Show the exact homework due for every student in the teacher-owned October12 scheduled classes, plus attributable previously deferred or unfinished work. Missing evidence remains unknown, never inferred nonperformance.',
      design:{family:'refined_B_two_column_proof',workingLayout:'attention_first_rail',attention:'static_Pulse_links_to_exact_review',evidence:'closed_minimum_human_readable_source_and_teacher_facts',languages:['ko','en'],selectedFixture:'/opt/data/workspace/frontend-production-execution-20261010/proposals/delivered/focus-rail-v2.html'},
      implementationPlan:'/opt/data/workspace/frontend-design-discovery-20261010-617a6e/implementation-plan.json',
      baseline:'The actual pinned retained S5 runtime and accepted site-v5-r3 artifact, not the whole dirty checkout or an assumed identical published tree.',
      sourceScope:{transport:'qualified_direct_http_api',lessonDate:'2026-10-12',coverage:'all_teacher_owned_scheduled_occurrences',fields:'necessary roster/course/homework and attributable relevant history',persistence:'protected_versioned_app_store_with_identity_revision_and_readback_guards',browserCookieExport:false,officialAcademyWrites:false},
      productAuthentication:{accountIdentifier:'kcpalantir',origin:'https://dc.kcpalantir.tech',credentialOwner:'native_masked_credential_consumer',sourceAndProductCredentialsInterchangeable:false},
      regressions:{writes:'isolated_synthetic_or_dedicated_canary_only',realTeacherJudgment:'reserved',officialFinalization:'reserved',parentDelivery:'reserved'},
      accessibility:{standard:'WCAG_2.2_AA',coverage:'all_agreed_public_private_routes_and_relevant_states',externalCertificateRequired:false,agentOwnedAssistiveTechnologyPreparation:true,userPcInstallationByImplication:false,accessibilityTreeEqualsScreenReader:false,unperformedCriteria:'explicit_incomplete_not_pass'},
      recovery:{backupRestoreBeforeDisruption:true,maintenance:'outside_lessons',maximumSingleDisruptionMinutes:5,recordLoss:'not_accepted',boundaries:['app','database','tunnel','client_gateway_disconnect','native_host_exit','container_restart','host_boot'],beyondBackend:'exact_supported_owner_route_required',finiteModelAsSupervisor:false},
      deployment:{targets:['https://kcpalantir.tech/','https://www.kcpalantir.tech/','https://dc.kcpalantir.tech/'],scope:'operating_deployment_only',gitCommitPushPr:false,wholeDirtyTreePublication:false,unrelatedDnsMailChanges:false},
      sequencing:'Protect current state and qualify rollback; prepare scoped data and isolated candidates; implement and verify regressions/accessibility/independent review; deploy and exercise real use; complete agreed recovery boundaries. Park only an unavailable lane.',
      authority:'This records the current user direction. Source context still grants no native, data, credential, deployment, supervisor or Host permission; qualify every actual effect through its owner.',
      completion:'No production-complete claim until every named live, accessibility, deployment, recovery and user-acceptance criterion has actual evidence.',
      resumesPriorAssignments:false,
    },
    retainedS1Result:{ref:'review/s1-sync-operational-continuation-2026-10-08.ts',status:'s1_retained_scope_live_sync_verified_full_delivery_pending',meaning:'Preserve prior S0/S1 evidence, FAIL and spent budgets. Per-area sync, dated receipts and stale-scope guards pass isolated gates. User-admitted roster reconstruction/current direct qualification preserve the expired pilot. Local encrypted restore/query parity passed before and after intake; user accepted whole-Backend-loss risk. Existing protected site has real teacher login and five-student/nine-book readback. One explicit refresh completed all112 retained scopes with terminal UI recovery. S1 operator recovery/efficiency, S2 coverage, native WebMCP, broader publication and teacher acceptance remain open.'},
    currentResult:{ref:'review/gang-a-adoption-2026-10-08.ts',status:'s5_implemented_verified_deployed_teacher_acceptance_pending',meaning:'B1-B4 engineering is implemented, tested and deployed. PR31 merged at 14bdcd7 after exact-head CI success. Native browser cases and five retained student scenes passed; original history, auth, DB, source runtime and tunnel were preserved. Primary mixed work and audit/D4 candidates remain untouched by cleanup. Teacher visual/usefulness acceptance, root/image fonts, native WebMCP and independent recovery are not claimed. No old queue resumes.'},
    parallelWork:'Current user retains only classroom-record session 20261007_151433_6047b3 and reports other development sessions stopped. Preserve its operational records and runtime handles. This Lead now selects product Work at the canonical checkpoint; prior L2/P0/P1/L1 results remain historical evidence, not terminated or restarted by this metadata. The blocked P2 implementation-worker lane remains a separate common-owner capability, not authority to bypass restrictions.',
    completion:'No whole-system completion until every requested area has actual end-to-end evidence and the teacher accepts the useful workflow. A stopped operational lane remains an explicit incomplete criterion.',
  },
  architectureReview: {
    revision:'2026-10-08-a1',status:'implemented_verified_deployed',researchRef:'review/architecture-research-2026-10-08.ts',
    goal:'Adopt the actual gang-a visual identity across the teacher product and establish maintainable business boundaries with shared human/agent operations, preserving useful teacher work and recoverable originals.',
    confirmed:{visualDirection:'gang_a_actual_visual_design',substantialBackendChangeMayBeProposed:true,implementationRequiresFinalApproval:true,fontSetupSeparatelyRequested:true},
    options:[
      {id:'A_visual_only',recommendation:'not_preferred',meaning:'Transfer the visual design with the current application/store coupling mostly intact.',benefit:'Least immediate code churn.',cost:'Leaves presentation contracts tied to backend implementation and future feature changes concentrated in the same classes.'},
      {id:'B_business_modules',recommendation:'recommended',meaning:'Reorganize the academy backend around business modules, narrow ports, explicit UI/agent query and command contracts, and one transactional PostgreSQL owner. Keep the current deployment footprint unless evidence calls for a later split.',benefit:'Substantial internal redesign with isolated tests, clearer responsibility and practical migration/recovery.',cost:'More work than CSS changes; contracts, transaction boundaries and legacy readers need regression and parity checks.'},
      {id:'C_distributed_replacement',recommendation:'not_justified_by_current_evidence',meaning:'Split independently deployed services and potentially introduce separate read stores/full event sourcing.',benefit:'Useful when independent teams, deployments or resource isolation are proven requirements.',cost:'Extra services, synchronization, recovery and deployment complexity; new infrastructure/cost admission and a real benchmark would be required.'},
    ],
    recommendedArchitecture:{
      businessModules:['identity_and_enrollment','curriculum_and_learning_work','source_evidence_and_refresh','teacher_observation_and_clinic','teacher_queries_and_projections'],
      delivery:'One deployable TypeScript/Bun app initially; modules are responsibility boundaries, not new servers.',
      ports:'Business-facing interfaces for coherent scoped query snapshots, transactional teacher commands and qualified source intake. PostgreSQL and direct HTTP implement them; tests supply isolated adapters.',
      consistency:'Keep critical target/policy/revision checks under the same locked transaction as append/outcome. Pure domain validators may be shared by ingress and transaction code; do not move enforcement solely to the client or pre-transaction checks.',
      queries:'Explicit versioned result contracts shared by teacher UI and agent consumers, rather than deriving public data shapes from concrete application class return types. Separate read projections from command processing over the same DB; no message broker or eventual-consistency read store prerequisite.',
      context:'Extend the existing TeacherWorkContext producer and classroomCyclePolicy owner. DATA/LOGIC/ACTION/GOVERNANCE are typed aspects consumed across business modules, not four duplicate policy catalogs or four arbitrary folders.',
      referenceReuse:'Reuse gang-a visual structure, narrow interface ideas, strict input validation and failure-preserving transitions. Do not copy managed Sites header auth, in-memory production storage, whole-student CAS granularity, fake live connector availability or native governance substitutes.',
      storage:'Retain existing PostgreSQL, exact IDs, append-only teacher/source versions and command outcomes. Add narrowly justified schema changes only with compatible readers, empty-target restore and explicit cutover evidence; no destructive rewrite required merely to reorganize code.',
      nativeBoundary:'Hermes still owns Session/Project/Task, execution controls and agent lifecycle; ontology-platform owns shared Ontology. Academy app redesign does not replace either.',
    },
    trace:{teacherGoal:'Inspect one assigned section/item attempt and retain an attributable teacher decision.',data:'Existing source identity, catalog/assignment/attempt revisions and original observation clocks feed the scoped query snapshot.',logic:'classroomCyclePolicy and exact work projection determine independent solving/correction/teacher states; missing evidence remains unknown.',action:'A scene-bound teacher command carries exact target, expected revisions, actor and request identity; transaction checks, append and outcome readback precede success.',governance:'Authentication and current effect guards authorize the call; merely including context fields grants nothing.',experience:'The same result appears inline under the selected gang-a-style row and in the scoped agent query; original evidence and later corrections stay inspectable.',evaluation:'Cross-owner, stale target/policy, actor switch, lost response, retry, source outage and restart cases; actual teacher workflow acceptance remains required.'},
    stages:[
      {id:'B1_contract_seams',proposedNewFiles:['src/academy/contracts/teacherOperations.ts','src/academy/ports/teacherStore.ts'],existingTargets:['src/academy/application.ts','src/academy/postgresStore.ts','src/academy/refresh.ts','src/academy/teacherWorkContext.ts'],result:'Explicit query/command types and narrow transactional interfaces; keep public facade compatibility while callers migrate.',verification:['RED/GREEN interface and wrong-owner/target tests','Same query outputs and durable write outcomes before/after','Pure module import-direction checks plus real isolated PostgreSQL tests'],recovery:'No production schema or original-record changes in this stage; revert only owned code deltas.'},
      {id:'B2_business_slices',proposedNewFiles:['src/academy/usecases/studentScene.ts','src/academy/usecases/teacherObservation.ts','src/academy/usecases/teacherClinic.ts'],existingTargets:['src/academy/application.ts','src/academy/postgresStore.ts','src/academy/refresh.ts','src/academy/sourceSynchronization.ts','src/academy/classroomCyclePolicy.ts'],result:'Separate query composition and existing teacher commands by business purpose, preserving precise transaction contracts and current qualified source adapter behavior.',verification:['Preserve S0 actor-switch/refused-original/CAS/replay regressions','No domain imports from web/PostgreSQL adapters','Coherent scene and locked write revalidation under concurrent source/teacher changes'],recovery:'Keep facade and legacy readers until equivalent behavior is proven; no unchecked generic append escape hatch.'},
      {id:'B3_gang_a_experience',proposedNewFiles:['src/academy/web/teacherRails.ts','src/academy/web/designTokens.ts'],existingTargets:['src/academy/web/page.ts','src/academy/web/client.ts','src/academy/web/learningWorkView.ts','src/academy/web/clinicWorkView.ts','src/academy/web/teacherObservationEditor.ts','src/academy/web/designLab.ts','src/academy/web/designLabCatalog.ts','src/academy/server.ts'],result:'Faithful paper/ink/accent/typography/spacing and book/unit/inline-evidence design across the teacher workspace, not an isolated restyled leaf. Preserve date/cohort coverage and actual existing commands. Reusable protected gallery uses the same components with explicit synthetic fixtures.',verification:['Actual desktop/mobile/keyboard screenshots against pinned gang-a reference','Real existing query contract drives UI and agent projections','Preserved input and safe stale-scene/uncertain-save recovery','Bundled licensed Korean fonts; no dependence on remote device font installation'],recovery:'Keep the prior release and route/contract compatibility; do not replace actual missing source data with samples.'},
      {id:'B4_rehearsal_and_cutover',proposedNewFiles:[],existingTargets:['harness/academy_browser_rehearsal.ts','tests/architecture','tests/academy','src/academy/recovery.ts','Existing protected release'],result:'Cross-layer safety, data parity, restore and useful teacher workflow verification, then compatible staged update of the existing protected site when the exact release gate is satisfied.',verification:['bun run test:teacher-observation','bun run test:teacher-clinic','bun run test:academy','bun run test:architecture','bun run test:workflow','bun run typecheck','bun run typecheck:harness','bun run cloud:check','Current authenticated same-target readback and separate teacher acceptance'],recovery:'No disruptive classroom cutover, unreviewed schema loss, new account/tunnel or broad cleanup; retain the previous release and verified recovery path.'},
    ],
    finalApproval:{approved:true,source:{session:'20261008_082108_9617ea',userQuote:'권고대로 작업 진행하자.'},questionId:'architecture_redesign_final_approval',coversIfApproved:'New bounded B1-B4 engineering programme, scoped tests and compatible rollout gates; not automatic replay of prior S1/S2 or worker queues.',notIncluded:['Unqualified new academy acquisition','Official academy save/generation/printing/parent send','New paid service/account/DNS/IAM','Installed Hermes/Host/other-container modification','Unreviewed destructive data migration'],reopenIf:'A new service/provider cost, data-loss risk, unavoidable interruption or materially changed teacher workflow is discovered.'},
  },
  designEvaluation: {
    source: {session:'20261008_082108_9617ea',kind:'current_user_request_and_native_clarification'},
    goal:'A persistent teacher-authenticated design comparison gallery, with synthetic-only examples and no product/source writes.',
    route:'/design-lab',
    baseline:'Preserve the existing teacher app and its shared application/context/domain/storage boundaries. Prior Notion/Linear/card comparisons were rejected. The concrete visual reference is the inspected gang-a book/unit rail frontend; its exact commit and limits are in gangAInspection.',
    implementation:['Add a closed typed sample/theme registry and deterministic HTML renderer.','Authenticate the gallery with the existing teacher context and no-store/CSP headers; never query the product DB from a sample.','Expose a teacher-workspace link and reuse the existing in-memory browser rehearsal for visual checks.'],
    verification:['RED/GREEN HTTP authentication and foreign actor negatives.','Same sample facts across themes; unknown, prior inspection and next-action states remain distinct.','No scripts, external assets, forms, source refresh or student data in sample rendering.','Desktop and narrow-screen actual browser inspection; source tests and exact deployed HTTP readback.'],
    runtime:'Reuse the exact existing DB/release/tunnel; preserve all identities and records. A normal conversation close is not a reason to restart. Container recreation can remove processes despite persistOnRelease. Recovery remains bounded to existing resources, never initdb/migration/new tunnel or an automatic worker resume.',
    governance:'The user requests broader routine autonomy and owns the current config edits. Do not silently overwrite those settings. Routine implementation/testing/recovery for this exact goal is Lead-owned; native refusals, failed safety evaluation, teacher finalization and external delivery remain separate boundaries, not audit-only automatic approvals.',
    recovery:'Keep predecessor bytes and release. No broad stage/reset/stash; publish/deploy only exact owned presentation deltas after validation. Do not claim independent Backend-loss durability.',
    resultRef:'review/design-interview-2026-10-08.ts',
    status:'gang_a_visual_and_architecture_adoption_approved_implementation_in_progress',
    gangAInspection:{ref:'review/gang-a-design-inspection-2026-10-08.ts',commit:'d60498707b49ae75ef6916fecdbb7458b2ac58ea',access:'verified_existing_gh_binding',visualDirection:'Preserve the actual paper-like book/unit rails and inline evidence, not generic dashboard cards.',transfer:'Recommend a pure view adapter over existing TeacherWorkContext while retaining date/cohort navigation, teacher commands, auth and PostgreSQL. Reference managed Sites identity and unavailable transport are not production replacements.',productionChange:false},
    teacherFeedback:'The user strongly rejects all old generic samples and explicitly very much likes the actual gang-a visual design. Actively adopt its visual identity, not merely its information structure. Product implementation waits for research/interview/final architecture approval; preserve running services and originals.',
    acceptance:'A working protected gallery is not adoption of any design, native WebMCP acceptance, completed S1/S2 or whole-product teacher acceptance.',
  },
  userDecisions: {
    execution: 'The user approved architectureReview 2026-10-08-a1. Lead owns bounded B1-B4 implementation, tests, integration and qualified compatible rollout without repeated plumbing interviews. New material risk/cost/disclosure or native refusal remains a stop; no old worker budgets resume.',
    academy: 'General source access uses qualified direct HTTP/API. The completed Oct5 journal exception is historical, not a current or recurring grant. Product evidence writes, official DayRecord projection and human parent delivery are separate. No generation, printing or parent send is activated by this plan. Current decisions are in handoffs/workflow-current-state.json.',
    initialScope: 'Current enrollment/books/progress/homework and recent lessons/results first; qualified historical backfill follows without pretending all-time coverage.',
    refresh: 'Qualified new/changed submission and grading reflection while the teacher scene is active, plus selected/whole-cohort manual refresh. Reuse unchanged completed evidence. This requirement does not install a loop, scheduler or unattended authentication, or bypass native controls.',
    site: 'A private personal site under kcpalantir.tech; preserve existing root/Bible/other consumers.',
    ontology: 'All owned product/code/data architecture connects purpose, hierarchical typed meaning, evidence, deterministic logic, allowed Actions, human/agent experience, evaluation and recovery.',
    retention: 'Minimized decision-relevant source versions and attributable teacher originals; no credentials, original-media copy, contacts or full transcript mirror.',
    collaboration: 'The current user-assigned Lead reuses attributable operational collection and corrections while owning code/schema/site integration and the engineering checkpoint. Preserve original capture, peer tasks and the foreign contract-audit worktree; an assignment is not runtime termination or a repository lock.',
    runtimeUpdates: 'Existing protected site updates during class are admitted only when verified non-disruptive and backward-compatible. Preserve authentication, source evidence, student history and current consumers; uncertain interruption or loss blocks runtime application.',
    clinics: 'Current scope is source grading query, wrong/similar target preparation, teacher confirmation and official-screen handoff. Actual clinic generation and physical printing remain excluded and require later contracts/admission.',
  },
  leadSelections: {
    hostnameCandidate: 'dc.kcpalantir.tech',
    application: 'One modular TypeScript/Bun application, shared by teacher UI, scoped queries and standard browser WebMCP when actually supported.',
    store: 'Private Backend PostgreSQL, one logical student partition per owner/student, shared source catalogs and indexed append-only versions; no per-student physical DB/Sheet tab.',
    network: 'Preserve the existing private PostgreSQL Unix socket, loopback teacher app and exact owned Cloudflare Tunnel/hostname. Recover their existing processes without new DNS/tunnel/IAM/account/Host changes; authenticate the teacher before student disclosure.',
    ingestion: 'Require supported direct HTTP/API authentication, exact reviewed source operations and validated append-only intake. The earlier browser acquisition is historical evidence, not the current default or a silent fallback. Until secure direct credential ingress qualifies, block acquisition, retain the protected source records and expose the real connection state.',
    nextIntegration: 'Evolve temporary teacher-note JSON into dedicated validated source/assignment/teacher-revision records with a compatible legacy reader. Connect persistent video completion and delta refresh to the existing TeacherApplication, then the same teacher UI/WebMCP query. Do not add a parallel registry or dispatcher.',
    authority: 'Native source identifiers remain in separate namespaces. Current authenticated instructor/student/course rows and independent book-progress tuples bind identities; user examples are not manufactured evidence.',
  },
  ontology: {
    hierarchy: ['book_edition', 'major_unit', 'middle_unit', 'minor_unit', 'printed_page', 'problem'],
    separateResources: ['video_lecture_label', 'electronic_board_lecture', 'paper', 'assessment_attempt', 'lesson_occurrence'],
    studentEdges: ['source_identity_binding', 'book_assignment_revision', 'lesson_membership', 'assigned_activity', 'attempt_evidence', 'teacher_report_revision'],
    invariants: ['No name-only or same-number cross-namespace joins', 'Unknown hierarchy/time/enrollment remains unknown', 'Course learning dates are not silently assignment validity dates', 'Missing source row does not end an assignment or prove nonperformance', 'Stored grade is not teacher inspection/mastery', 'Book replacement appends history and preserves previous editions/evidence', 'Shared metadata is not copied per student', 'Read refresh cannot mutate the academy'],
    agentContext: 'Explicit domain/query/tool contracts deliver scene scope, hierarchy, evidence references, allowed operations, freshness and unknowns; no native context injector or dispatcher.',
  },
  steps: [
    { id: 'source_evidence_intake', prerequisites: ['source_bridge'], targets: ['src/academy/sourceEvidence.ts', 'tests/academy/sourceEvidence.test.ts', 'Private owner-qualified academy record heads'], gate: 'Current native teacher principal and all nine book/student tuples, 102 exact existing-result records in twelve public prepared batches, source audit/CAS/append-only intake and exact per-student readback. Preserve month-day precision, separate source namespaces, grades versus teacher judgment and unresolved full hierarchy. Academy stays read-only. On intake failure preserve partial acknowledgements and requery exact entity/idempotency keys; do not delete history.' },
    { id: 'meaning_and_store', prerequisites: [], targets: ['src/academy/domain.ts', 'src/academy/postgresStore.ts', 'src/academy/application.ts'], gate: 'Real hierarchy/partition/revision/permissions/retry tests and actual PostgreSQL transactions/readback' },
    { id: 'source_bridge', prerequisites: ['meaning_and_store'], targets: ['src/academy/sourceBridge.ts', 'src/lms/academyReadProtocol.ts'], gate: 'All five independently matched current identities, current source semantics, minimized snapshots and same-target DB readback' },
    { id: 'teacher_site', prerequisites: ['source_bridge'], targets: ['src/academy/server.ts', 'src/academy/web'], gate: 'Actual protected query/navigation/selected-refresh/whole-refresh behavior, no foreign rows, explicit outage/freshness' },
    { id: 'domain_publish', prerequisites: ['teacher_site'], targets: ['New owned hostname/tunnel/access application only'], gate: 'Current domain/account authority, verified Free Tier, authentication/TLS/cross-origin denial and exact DNS/resource readback' },
    { id: 'recovery_and_acceptance', prerequisites: ['source_bridge', 'teacher_site'], targets: ['src/academy/recovery.ts', 'review/teacher-ontology-cohort-db-2026-10-04.json'], gate: 'Actual consistent export/empty-target restore/query parity; independently placed encrypted copy distinguished from same-volume recovery; exact-head CI/merge/owned cleanup' },
  ],
  failurePolicy: {
    authentication: 'Source expiry blocks only acquisition; keep last successful observation and mark auth required. Secure native reauthentication, no keepalive or cookie bridge.',
    sourceDrift: 'Reject changed headers/tuples/wire/namespace/page contracts; keep original last-verified data and explicit coverage limits.',
    storage: 'Append/CAS/idempotency in one transaction; exact outcome/readback before retry after uncertain acknowledgement.',
    publishing: 'No student disclosure before actual teacher-only authentication; no root/Bible overwrite, protection bypass or billing upgrade.',
    recovery: 'No hash-only independent durability claim; preserve exact source/copy/high-water mark and actually restore a separate empty target.',
    worker: 'Mechanical work uses code. New agent workers require fresh finite task-specific native controls; no inherited queue/budget or unrestricted substitute.',
  },
  currentDirection: {
    schemaVersion: 1,
    phase: 'source_context_slice_verified_product_pending',
    source: { sessionId: '20261007_070233_b8e88b', kind: 'current_teacher_interview', lessonDate: '2026-10-07' },
    executionWindow: {
      desiredTeacherUseAt: '2026-10-07T14:00:00+09:00', tradeoff: 'full_scope_over_deadline',
      admitted: 'staged_product_delivery_with_qualified_live_effects', liveDataAndRuntime: 'admitted_after_source_identity_and_recovery_qualification', scopeReductionForDeadline: false,
      focusNow: 'The current user reopened product implementation through actual-use verification under systemRefactor. S0 repairs actor attribution and protected original/reconciliation behavior; retain the exact failed predecessor and do not deploy a partial source fix. Preserve the disjoint L2 governance owner and old spent budgets.',
      nextSourceUnit: 'Follow systemRefactor priorities S0 through S3. Actual scoped direct reads, protected intake and compatible existing-site recovery remain conditional on source, identity and recovery qualification. Native WebMCP and teacher acceptance remain distinct required gates, not inferred from DOM tests.',
      parallelPreparation: 'Disjoint view/accessibility and failure-test preparation may use a frozen current contract while Lead owns domain/storage semantics. Live-source qualification and production application remain separate and do not gate source-only work.',
    },
    goal: 'Expand the existing domain application, direct HTTP adapters and actual WebMCP operations across the teacher work lifecycle. Each DATA/LOGIC/ACTION/GOVERNANCE unit must carry typed practical context consumed by runtime behavior. The Oct7 class is a proving case, not the scope ceiling.',
    programmeScope: ['class_preparation', 'classroom_observation_and_inspection', 'assessment_and_clinics', 'correction_explanation_and_carryover', 'student_history_and_schedule_exceptions', 'lesson_review_and_next_assignment', 'learning_counseling_and_parent_explanation', 'separately_governed_official_finalization'],
    teacherInput: {
      disposition: 'confirmed_input_partly_consumed_by_domain_policy',
      dutyOwner: 'src/academy/classroomCyclePolicy.ts',
      displayBookExample: '가우스 5-2-2',
      sectionLabels: {
        elementaryGauss: ['개념 이해하기', '개념정복', '필수예제', '유형다지기', '실력쌓기', '개념복습', '4M 듣기와 쓰기', '4M 읽기와 쓰기', '대단원 총괄평가'],
        middleGauss: ['개념 백지 테스트', '개념 예제', '개념 쏙 생각 쑥', '기본 문제', '필수 예제', '유형 다지기', 'Daily Restudy', '대단원 총괄평가'],
      },
      expectedWork: 'assigned_section_and_item_range_not_every_catalog_entry',
      comprehensiveAssessment: 'eligible_after_designated_minor_unit_boundary_not_every_minor_unit',
      clinic: { solving: 'student', grading: 'teacher', review: 'teacher', completion: 'explicit_teacher_input_after_repeated_correction_and_explanation' },
    },
    recordDestinations: [
      { kind: 'source_evidence', owner: 'source_and_private_versioned_copy', automaticProjection: false, qualification: 'Fresh exact direct HTTP source identity/field/page checks; minimize retained copies and preserve original clocks and revisions.' },
      { kind: 'teacher_clinic_history', owner: 'private_product_postgresql', automaticProjection: false, qualification: 'Existing logical owner/student partitions; exact section/paper/item/attempt, authenticated teacher completion and append/CAS/readback. No physical per-student DB and no academy mutation.' },
      { kind: 'official_dayrecord', owner: 'academy_official_record', automaticProjection: false, qualification: 'A separately reviewed minimal projection, exact current target/fields/before/after approval and qualified independent readback. Preserve the detailed product history separately.' },
      { kind: 'parent_delivery', owner: 'teacher_final_sender', automaticProjection: false, qualification: 'Teacher final action with exact message/recipient evidence; a draft, DayRecord save or teacher report is not a delivery receipt.' },
    ],
    contextFieldPlan: [
      { unit: 'DATA', typedFields: ['purpose', 'ownerStudentScope', 'bookEditionRef', 'contentScope', 'assignmentRef', 'paperRef', 'attemptRef', 'sourceAndTeacherEvidenceRefs', 'eventObservedRecordedClocks', 'coverage'], consumers: ['src/academy/records.ts', 'src/academy/postgresStore.ts', 'src/academy/application.ts'], acceptance: 'Validated persisted records retain exact subject, practical purpose, source/teacher distinction and unknowns; no free-text context bag or type-only implementation claim.' },
      { unit: 'LOGIC', typedFields: ['appliesTo', 'expectedAssignedWork', 'prerequisiteScope', 'responsibleActor', 'decisionAuthority', 'policyRevision', 'requiredEvidence', 'unknownHandling'], consumers: ['src/academy/classroomCyclePolicy.ts', 'src/academy/preparationHistory.ts'], acceptance: 'Assigned work and eligibility determine gaps; missing evidence is unknown; student solving cannot satisfy teacher grading or final completion.' },
      { unit: 'ACTION', typedFields: ['userGoal', 'trustedSceneRef', 'targetScope', 'preconditions', 'permittedEffect', 'expectedRevision', 'requestIdentity', 'resultEvidence', 'recoveryState'], consumers: ['src/academy/application.ts', 'src/academy/server.ts', 'src/academy/web/client.ts'], acceptance: 'UI and WebMCP invoke one operation; exact target/revision checks and uncertain-outcome reconciliation precede any retry.' },
      { unit: 'GOVERNANCE', typedFields: ['trustedActorScope', 'teacherDirectiveRef', 'disclosureScope', 'approvalTargetAndRevision', 'currentEffectAdmission', 'refusalReason', 'recoveryRequirement'], consumers: ['src/academy/operationalContract.ts', 'src/academy/application.ts', 'src/academy/server.ts'], acceptance: 'Server/native guards consume the fields; client role strings, schema annotations and previous budgets grant no permission. Original observation retention is not approval.' },
    ],
    contentModel: {
      naming: 'Derive a compact series/grade/term/volume display name from qualified mappings; retain school stage, edition, literal source title/key and mapping provenance. Never join by display name.',
      hierarchy: ['book_edition', 'major_unit', 'middle_unit', 'minor_unit', 'learning_section', 'printed_page', 'problem'],
      sectionPlacement: 'Section definitions and occurrences are distinct. Bind to their actual major/middle/minor scope and prerequisites; do not clone every template label into every minor unit or infer printed membership from a sample.',
      paperRelations: 'Link a versioned paper and ordered/renumbered items to one or more content scopes, then student assignment and solving attempt. Reprint identity and repeated solving must not overwrite prior evidence. No paper generation/printing is admitted.',
      compatibility: 'Preserve original sample metadata, source namespaces, existing records and readers. Teacher section labels are current input, not proof that every edition or printed source uses identical spelling.',
    },
    ui: {
      layout: 'Teacher workbench: date/cohort navigation beside an expandable student-book content tree and aligned stage columns; selected paper/item evidence and append-only teacher decisions in a detail panel. No marketing hero or undifferentiated card grid.',
      states: ['not_assigned', 'prerequisite_pending', 'assigned_nonperformance_confirmed', 'source_unknown', 'student_solving', 'teacher_grading_pending', 'correction_or_explanation_required', 'teacher_review_pending', 'teacher_completed', 'reopened'],
      completionAction: 'An explicit teacher-only completion control bound to exact items/paper/attempt after correction and explanation, with saved readback and later reopen/correction history. No automatic DayRecord or send.',
      palette: { background: '#faf8f2', surface: '#faf8f2', text: '#27322d', action: '#376f59', attention: '#ba4c2c', complete: '#376f59' },
      typography: 'The user selects the actual gang-a visual direction: preserve its serif display/sans reading roles, book numbering, spacing and fine rules. Licensed Noto Sans KR/Noto Serif KR are installed in the active Backend profile; bundle appropriate web assets for remote teachers. Improve measured legibility/accessibility without replacing the selected aesthetic.',
      accessibility: 'Text and icons accompany color; keyboard expansion and visible focus, preserved selection, reduced motion, explicit saving/uncertain/failed states. Source unknown and student nonperformance never share a label.',
      skills: ['frontend-design', 'dogfood'],
    },
    deliveryUnits: [
      { id: 'typed_context_and_learning_scope', prerequisites: [], targets: ['src/academy/domain.ts', 'src/academy/classroomCyclePolicy.ts', 'src/academy/records.ts', 'docs/academy-student-evidence-contract.json', 'docs/academy-teacher-workspace-tool-contract.json'], acceptance: ['RED/GREEN source-bound actor, assignment, section-placement and namespace cases', 'Runtime ingress and shared query consume practical-context fields, not merely documentation', 'Existing source/teacher history remains readable; explicit schema transition before real writes'] },
      { id: 'qualified_refresh_and_recovery', prerequisites: ['typed_context_and_learning_scope'], targets: ['src/academy/nativeConnector.ts', 'src/academy/refresh.ts', 'src/academy/postgresStore.ts', 'review/d4-direct-source-consumer-2026-10-06.json'], acceptance: ['Preserve D4 predecessor; reconcile exact candidate/owner and repair storage/cross-tab recovery under a fresh bounded unit', 'Current teacher/student/Oct7 and prior-homework scope; qualify changing submission/grade/correction families beyond book registration', 'No lost request identity, partial-success overclaim or unverified intake; exact stored readback and recovery qualification'] },
      { id: 'teacher_clinic_and_hierarchy_experience', prerequisites: ['typed_context_and_learning_scope', 'qualified_refresh_and_recovery'], targets: ['src/academy/application.ts', 'src/academy/server.ts', 'src/academy/web/client.ts', 'src/academy/web/preparationView.ts', 'src/academy/postgresStore.ts'], acceptance: ['Real authenticated teacher can trace assigned section/paper/items, record completion and reopen without changing academy source', 'Student solving, teacher grading, repeated correction/explanation and explicit completion remain separate', 'Reload/process restart, conflicting human/agent revisions, failure and cross-tab tests preserve attributable history', 'Actual rendered hierarchy, Korean labels, keyboard/focus and responsive layout; teacher usability remains separate acceptance'] },
      { id: 'native_webmcp_and_oct7_outcome', prerequisites: ['teacher_clinic_and_hierarchy_experience'], targets: ['src/academy/web/client.ts', 'src/academy/application.ts', 'src/academy/server.ts', 'harness/academy_browser_rehearsal.ts'], acceptance: ['Supported native browser discovers/invokes the real tools; no polyfill, engine change or safety bypass', 'Agent receives purpose/scope/evidence/rules/allowed operations and refuses changed scene, foreign subject or stale revision', 'All verified Oct7 occurrences, latest qualified evidence, teacher next-action judgment and recoverable local record; report coverage gaps', 'Complete this proving case without claiming whole-programme or parent-delivery acceptance'] },
    ],
    deferredEffects: ['Historical worker/reviewer/Cron budgets', 'Official academy writes without new exact approval', 'Clinic generation or printing', 'Parent sending', 'New services/accounts/DNS/IAM/billing', 'Installed Hermes/Host/other-container changes', 'Foreign work adoption or publication'],
    interviewVerification: { scope: 'interview_continuation_and_source_only_not_product_acceptance', focusedTestsPassed: 58, architectureTestsPassed: 41, typecheck: 'passed', cloudCheck: 'passed_with_environment_dependent_skips', contextReadback: 'validated_non_executing', preservedHistoricalUnit: true, publication: 'not_performed' },
    sourceProgress: { scope: 'section_catalog_and_student_context_read_projection', reviewRef: 'review/teacher-work-context-source-2026-10-07.ts', status: 'verified_synthetic_consumers_only', fullDeliveryUnitComplete: false },
    evidence: { d3: 'review/d3-consumer-integration-2026-10-06.json', d4: 'review/d4-direct-source-consumer-2026-10-06.json', currentRuntimeQualified: false, liveReadsPerformed: false, wholeDirectionImplemented: false, studentReadContextImplemented: true, teacherAccepted: false, nativeWebMcpAccepted: false },
  } as const satisfies TeacherWorkDirection,
  historicalUnit: {
    id: 'academy_direct_http_journal_webmcp',
    admission: 'Current user explicitly requires completion of direct HTTP credential ingress, actual journal execution/readback, native browser control and standard WebMCP acceptance. Retain the Oct5 four-student exact-final-value approval condition and human parent sending.',
    scope: 'Qualify one supported native profile-secret consumer and fixed-origin ephemeral HTTP client, reuse source readers, add a separately approved field writer and exercise the same protected teacher app through real headless native/browser-standard WebMCP. No source browser transport follows.',
    effects: ['Owned TypeScript/Bun code/tests/dependencies and permitted Git lifecycle', 'Native secure input and supported active-profile browser configuration; headless only while the dedicated desktop is stopped', 'Direct HTTP authentication and exact admitted source reads; private evidence and append-only intake', 'Oct5 four-student official journal fields only after exact current final-value approval and field contract qualification', 'Compatible restart of the existing teacher app/tunnel only'],
    excluded: ['Academy browser acquisition or cookie/password export', 'Unqualified authentication or synthetic WebMCP API presented as real acceptance', 'Automatic production schema migration or teacher identity recreation', 'New services/schedules/accounts/DNS/IAM/billing/installed-engine/Host effects', 'Other-date record changes, official finalization or parent send'],
    targets: ['src/academy/nativeConnector.ts', 'src/academy/main.ts', 'src/academy/postgresStore.ts', 'src/academy/application.ts', 'src/academy/web/client.ts', 'Existing private runtime configuration and process handles'],
    sequence: [
      {id: 'native_credential_ingress', result: 'Native masked Skill secret input and native profile getter/declared child environment; no .env dump, password argv, website vault export or saved-session replay.'},
      {id: 'direct_read', result: 'RED/GREEN fixed-origin login encoding, fresh cookie issuer, exact teacher/college principal and existing six-family validators; live requested-subject/date readback and original clinic-header qualification.'},
      {id: 'journal_execution', result: 'Inspect current actual field handlers without invoking them; qualify before/after/wire/independent-readback and uncertain-outcome recovery. Present exact final values, consume current teacher approval and apply only that batch.'},
      {id: 'native_webmcp', result: 'Headless native driver, actual protected teacher login and browser-owned document.modelContext discovery/invocation, wrong-subject/authentication negatives; no forged/polyfilled API or GUI fallback.'},
      {id: 'verification_publication', result: 'Focused/full gates, privacy/self-review, exact-head CI/merge/remote readback and owned cleanup. Live gates, teacher acceptance and publication remain distinct.'},
    ],
    failureDesign: {
      absentProcesses: 'Discriminate app health, tunnel readiness and public route independently; no DNS change when the existing ingress validates.',
      sourceMismatch: 'An active legacy browser executor violates the latest transport decision; refuse before credential or network use and keep retained records queryable.',
      runtimeDrift: 'Reject missing authentication, missing storage contracts or foreign listener instead of creating identity/schema or killing a peer.',
      unknownShutdownCause: 'Process absence and lost historical handles do not prove why the processes stopped; preserve that causal uncertainty.',
      secretPropagation: 'Discriminate native getter presence from child env presence without revealing values. Use only the supported getter seam, current profile and two declared keys; decline blocks the lane.',
      loginFailure: 'One authentication attempt per entered credential generation; discriminate login form, response, redirect and independent principal. No automatic bad-password retries or another account.',
      uncertainWrite: 'Preserve approved identity, before-values and field-attempt outcome; independently read before any retry or recovery. Reversion is a new exact approved change, not an automatic compensation.',
      standardSupport: 'Discriminate actual binary version, secure origin, Chrome trial/feature acceptance and real API/tool invocation; registration text and HTTP200 are insufficient.',
    },
    secureSourceSuccessor: 'Qualify a supported origin-bound non-browser credential consumer with its actual owner, then exercise fresh academy authentication/read/save/readback. Do not add a working-labelled empty client or weaken the secure-input boundary.',
    recovery: 'Stop only newly owned process handles and revert only this source unit if needed. Preserve existing DB, authentication files, tunnel configuration, source clocks/history and foreign work. Persisted processes are not restart/reboot/24-hour acceptance.',
  },
  status: 'system_refactor_in_progress_historical_assignments_not_resumed',
  activeSourceUnit: {
    id: 'exact_learning_work_and_teacher_completion',
    status:'current_safety_repair_in_progress_not_accepted',
    reviewRef:'review/exact-learning-work-2026-10-07.ts',
    remainingFindings:['R10','R12','R13'],
    continuation:'Current user reopens product implementation under systemRefactor/S0. Reproduce the retained defects, repair sibling consumers, verify isolated persistence and exact-generation review before advancing. The broader programme and operational gates remain incomplete; concurrent L2 and denied P2 are not reassigned.',
    admission: 'Current user clarification in session 20261007_182212_d36637 admits staged implementation through actual use, subject to exact source/authentication/identity/recovery qualification. Preserve earlier failed generations and dirty originals; no old worker budget or official academy effect is resumed.',
    ownership: {lead:'dc-gang-a-dev',project:'p_a5676068',checkout:'/opt/data/workspace/dc-gang-a',preserve:['foreign contract audit','stopped D4','pre-existing backend profile/governance changes']},
    sequence: [
      {id:'identity',targets:['src/academy/records.ts','src/academy/postgresStore.ts','src/academy/learningWork.ts','tests/academy/learningWork.test.ts'],result:'Version-bound actual assigned sections/items, paper issuance/reissuance and repeated attempts; no catalog-implied assignment or source generation.'},
      {id:'teacher_action',targets:['src/academy/application.ts','src/academy/server.ts','tests/academy/teacherClinic.test.ts'],result:'Authenticated exact-item teacher stage/completion/reopen revisions, CAS, original-request recovery and visible historical corrections.'},
      {id:'shared_consumers',targets:['src/academy/teacherWorkContext.ts','src/academy/web/client.ts','src/academy/web/clinicWorkView.ts','harness/academy_browser_rehearsal.ts'],result:'Human controls and native semantic tools use the same protected application; synthetic visual/WebMCP execution remains distinct from teacher/live acceptance.'},
    ],
    failures: [
      {cause:'stale or foreign binding',probe:'Cross owner/student/course/catalog/assignment/attempt and stale-head tests',recovery:'Reject atomically; preserve originals and requery exact target.'},
      {cause:'uncertain acknowledgement or concurrent writers',probe:'Held requests/responses, identical retries, restart, second tab and conflicting CAS',recovery:'Read the original actor/request outcome; no new intent until resolved.'},
      {cause:'late scene or changed source basis',probe:'Old scene after confirmed write and revised assignment/attempt before commit',recovery:'Retain input and earlier judgments; block new completion until refreshed target.'},
      {cause:'native browser capability or control refusal',probe:'Current native API/lease and owned synthetic fixture only',recovery:'Preserve actual refusal; no polyfill, engine/config bypass, production substitution or false acceptance.'},
    ],
    verification:'RED/GREEN exact consumers; real isolated PostgreSQL, HTTP, client and native synthetic cases; frozen source independent review. Applicable full portable gates and owned fixture cleanup.',
    authority:'This plan is not authentication, teacher judgment, deployment authority, a native Task state store or permission to renew a spent Bot budget.',
  },
} as const;

/** Development decision input is untrusted reporting, never a native capability or effect grant. */
type Parser<T> = (value: unknown, path: string) => T;
type Parsed<P> = P extends Parser<infer T> ? T : never;
const fail = (path: string, code: string): never => { throw new Error(`${path}:${code}`); };
const text: Parser<string> = (v, p) => typeof v === 'string' && v.length <= 256 && !/[\u0000-\u001f]/.test(v) ? v : fail(p, 'bounded_text_required');
const token: Parser<string> = (v, p) => typeof v === 'string' && /^[A-Za-z0-9_.:/@-]{1,160}$/.test(v) ? v : fail(p, 'opaque_reference_required');
const bool: Parser<boolean> = (v, p) => typeof v === 'boolean' ? v : fail(p, 'boolean_required');
const integer = (min: number, max: number): Parser<number> => (v, p) => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max ? v : fail(p, 'bounded_integer_required');
const choice = <const T extends readonly (string | number | boolean)[]>(...values: T): Parser<T[number]> => (v, p) => values.includes(v as T[number]) ? v as T[number] : fail(p, 'enum_required');
const list = <T>(parse: Parser<T>): Parser<T[]> => (v, p) => Array.isArray(v) && v.length <= 16 ? v.map((x, i) => parse(x, `${p}.${i}`)) : fail(p, 'bounded_list_required');
const optional = <T>(parse: Parser<T>): Parser<T | undefined> => (v, p) => v === undefined ? undefined : parse(v, p);
const dataObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
  && [Object.prototype, null].includes(Object.getPrototypeOf(v))
  && Object.values(Object.getOwnPropertyDescriptors(v)).every(d => Object.hasOwn(d, 'value'));
const object = <S extends Record<string, Parser<unknown>>>(shape: S): Parser<{ [K in keyof S]: Parsed<S[K]> }> => (v, p) => {
  if (!dataObject(v)) return fail(p, 'object_required');
  const row = v as Record<string, unknown>;
  // Never echo unexpected keys: even a key can contain a credential or private record.
  if (Object.keys(row).some(k => !Object.hasOwn(shape, k))) return fail(p, 'unexpected_field');
  const out: Record<string, unknown> = {};
  for (const [k, parse] of Object.entries(shape)) out[k] = parse(row[k], `${p}.${k}`);
  return out as { [K in keyof S]: Parsed<S[K]> };
};
const utc: Parser<string> = (v, p) => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(v)) return fail(p, 'utc_required');
  const time = Date.parse(v);
  return Number.isFinite(time) && new Date(time).toISOString().replace('.000Z', 'Z') === v ? v : fail(p, 'utc_required');
};
const effects = choice('repo_read', 'repo_write', 'synthetic_gui', 'external_message', 'routine_activation', 'product_read', 'product_write', 'unknown');
const reasoning = choice('low', 'medium', 'high', 'xhigh');
const sha256: Parser<string> = (v, p) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v) ? v : fail(p, 'sha256_required');
const schema = object({
  schemaVersion: choice(1),
  action: choice('engineering', 'browser_dom', 'native_chrome', 'screen_start', 'bot_message', 'profile_cli_message', 'room_turn', 'routine'),
  observation: object({ observedAtUtc: utc, validUntilUtc: utc }),
  assignment: object({
    id: token, ownerProfile: token, purpose: text,
    role: choice('trusted_lead', 'restricted_worker', 'restricted_reviewer'), judgment: choice('complex', 'negligible'),
    inputs: list(token), ownedPaths: list(token), outputs: list(token), verification: list(token), recovery: token, completion: text,
    model: choice('gpt-6.1-sol', 'gpt-6.1-sol-900k', 'gpt-6-astra-900k', 'gpt-6-luna'), provider: token, reasoning,
    effects: list(effects), tools: list(token), maxTurns: integer(1, 1000), maxSeconds: integer(1, 86400), maxConcurrency: integer(1, 16),
    guiConcurrency: integer(1, 16), maxRetries: integer(0, 10), freshBudget: bool,
  }),
  caller: object({
    profile: token, sessionId: token, sessionKind: choice('canonical_bot_chat', 'ordinary', 'kanban'), canonicalTitle: text,
    managedInstall: bool, protocolEnabled: bool, binding: choice('native_tool_context', 'shell_only', 'unknown'),
    restrictions: choice('native_enforced', 'declared_only', 'none'), guiToolExposed: bool,
  }),
  messaging: object({
    toolExposed: bool, toolDispatchable: bool, peer: token, route: choice('exact', 'ambiguous', 'unknown'),
    admission: choice('current_assignment', 'missing'), payload: choice('minimized_synthetic', 'minimized_source', 'private', 'unknown'),
    roomAuthority: token, roomEpochAdmitted: integer(0, 1000000), roomEpochCurrent: integer(0, 1000000), roomHeld: bool,
    roomPolicy: choice('target_native_current', 'unknown'), routineAdmission: choice('bounded_native', 'missing'),
  }),
  screen: object({
    supported: bool, installed: bool, running: bool, profile: token,
    placement: choice('gateway', 'terminal:docker', 'terminal:ssh', 'terminal:singularity', 'unknown'),
    holder: choice('agent', 'human', 'unknown'), epochAdmitted: integer(0, 1000000), epochCurrent: integer(0, 1000000),
    batchOwner: token, otherOwners: choice('none', 'present', 'unknown'), afterHumanHandoff: bool, userContinue: bool,
  }),
  target: object({
    id: token, kind: choice('synthetic', 'product', 'academy_source'), effect: effects,
    surface: choice('browser_dom', 'native_chrome', 'repository'), origin: choice('backend_local', 'external', 'unknown'),
    identity: choice('owned_exact', 'unknown'), privateData: bool,
    browserProvenance: choice('native_managed_local', 'user_cdp', 'cloud', 'unknown'),
    challenge: choice('none', 'login', 'two_factor', 'captcha', 'payment'),
  }),
  remote: object({
    requestOrigin: choice('backend_cli', 'windows_client', 'unknown'), route: choice('qualified_backend', 'unknown'),
    pathOwner: choice('linux_backend', 'windows_client', 'unknown'), artifactOwner: choice('linux_backend', 'unknown'),
  }),
  rehearsal: object({
    source: choice('existing_date_class', 'unknown'), buildTests: choice('passed', 'missing'), freshPage: bool,
    browserCases: choice('passed_current_source', 'missing'), immediateCapture: bool,
    inactivity: choice('native_120s_no_keepalive', 'modified', 'unknown'),
    cleanup: choice('owned_same_target_readback', 'missing'), inheritedHumanOrWindowsAcceptance: bool,
  }),
  execution: object({
    model: token, provider: token, reasoning, turnsUsed: integer(0, 1000), elapsedSeconds: integer(0, 86400),
    activeAssignments: integer(0, 16), retryCount: integer(0, 10), previousEffect: choice('none', 'failed', 'uncertain', 'confirmed'),
    readback: choice('same_target', 'missing'), nativeDecision: choice('not_requested', 'accepted', 'denied', 'unknown'),
    approvalMode: choice('smart', 'manual', 'off'), headlessPolicy: choice('deny', 'allow'), redaction: bool,
  }),
  // Transient reports about an existing native Work, never a persisted graph or dispatcher.
  // Legacy single-action inputs remain readable; coordinated work supplies this section.
  coordination: optional(object({
    pattern: choice('single', 'sequence', 'parallel', 'fan_in', 'dialogue'),
    lifecycle: choice('kanban', 'bounded_cli', 'bot_chat', 'hosted_room'),
    inputRevision: token, observedInputRevision: token,
    parents: list(object({ reference: token, expectedRevision: token, observedRevision: token, status: choice('accepted', 'pending', 'failed', 'unknown') })),
    ownership: choice('single_owner', 'disjoint_targets', 'overlap', 'unknown'),
    integrationOwner: token, cancellation: choice('native_owned_handle', 'missing'),
    resultTrust: choice('untrusted_until_verified', 'authority_grant'),
  })),
  dialogue: optional(object({
    correlationId: token, kind: choice('information', 'question', 'proposal', 'result'),
    maxMessages: integer(1, 16), messagesUsed: integer(0, 16), maxHops: integer(1, 4), hopsUsed: integer(0, 4),
    termination: choice('answer_budget_or_stop'), duplicateDelivery: bool, transfersAuthority: bool,
  })),
  // One admitted CLI invocation, not a Bot DM, sender impersonation or native receipt verifier.
  profileCli: optional(object({
    recipientProfile: token, recipientMode: choice('existing_bot_chat', 'existing_session', 'fresh_session'),
    expectedSessionId: optional(token), selection: choice('preserve_existing', 'explicit_new'),
    model: token, provider: token, reasoning, maxTurns: integer(1, 1000), maxSeconds: integer(1, 86400),
    maxInvocations: choice(1), invocationsUsed: integer(0, 1), freshBudget: bool,
    purpose: choice('receipt_only', 'source_question'),
    outcome: choice('not_started', 'queued', 'claimed', 'completed', 'refused', 'uncertain'),
    refusal: choice('none', 'SESSION_NOT_OWNED', 'native_denial', 'other'),
    observedSessionId: optional(token), observedTitle: optional(text),
    expectedRequestSha256: sha256, observedRequestSha256: optional(sha256),
    readback: choice('missing', 'exact_request_and_reply'), replySchema: choice('missing', 'valid'),
  })),
});
export type BotDevelopmentRequest = Parsed<typeof schema>;
export function parseBotRequest(value: unknown): BotDevelopmentRequest { return schema(value, 'request'); }

/** Closed, source-only analyst schemas; reports never grant native execution authority. */
const narrative: Parser<string> = (v, p) => typeof v === 'string' && v.trim().length > 0
  && Buffer.byteLength(v, 'utf8') <= 4096 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v)
  ? v : fail(p, 'bounded_narrative_required');
const profileName: Parser<string> = (v, p) => typeof v === 'string' && /^[a-z][a-z0-9_-]{0,63}$/.test(v) ? v : fail(p, 'profile_required');
const dialogueList = <T>(parse: Parser<T>): Parser<T[]> => (v, p) => {
  if (!Array.isArray(v) || Object.getPrototypeOf(v) !== Array.prototype) return fail(p, 'bounded_list_required');
  const descriptors = Object.getOwnPropertyDescriptors(v) as unknown as Record<string, PropertyDescriptor>, length = descriptors.length?.value;
  if (!Number.isSafeInteger(length) || length > 16 || Reflect.ownKeys(descriptors).length !== length + 1
    || Object.values(descriptors).some(d => !Object.hasOwn(d, 'value'))) return fail(p, 'bounded_list_required');
  const out: T[] = [];
  for (let i = 0; i < length; i++) {
    if (!Object.hasOwn(descriptors, String(i))) return fail(p, 'bounded_list_required');
    out.push(parse(descriptors[String(i)]!.value, `${p}.${i}`));
  }
  return out;
};
const dialogueSource = choice('bot_development_contract', 'bot_development_runbook', 'bot_development_consumer', 'bot_dialogue_consumer', 'bot_dialogue_tests',
  'context_routing_consumer', 'workflow_checkpoint_consumer', 'atomic_context_consumer', 'operational_contract_consumer', 'disclosure_audit_consumer', 'package_scripts');
const dialoguePhase = choice('proposal', 'critique', 'decision', 'review');
const dialogueWorkSchema = object({
  schemaVersion: choice(1), assignmentId: token, actorProfile: profileName, phase: dialoguePhase,
  purpose: narrative, question: narrative, completion: narrative, recovery: narrative,
  expectedContextRevision: sha256, sourceIds: dialogueList(dialogueSource),
  controls: object({
    model: choice('gpt-6.1-sol'), provider: choice('openai-codex'), reasoning,
    maxTurns: integer(1, 1000), maxSeconds: integer(1, 1800),
    maxInvocations: integer(1, 16), invocationsUsed: integer(0, 16), maxMessages: integer(1, 16), messagesUsed: integer(0, 16),
    maxHops: integer(1, 4), hopsUsed: integer(0, 4), maxConcurrency: choice(1), maxRetries: choice(0),
    freshBudget: bool, duplicateDelivery: bool, nativeDecision: choice('not_requested', 'accepted', 'denied', 'unknown'),
  }),
});
export type BotDialogueWork = Parsed<typeof dialogueWorkSchema>;
export function parseBotDialogueWork(value: unknown): BotDialogueWork { return dialogueWorkSchema(value, 'request'); }
const replyBase = { schemaVersion: choice(1), assignmentId: token, packetRevision: sha256 };
const replyTail = { peerMessage: narrative, limitations: dialogueList(narrative) };
const dialogueReplySchemas = {
  proposal: object({ ...replyBase, phase: choice('proposal'), ranked: dialogueList(object({
    id: token, rank: integer(1, 16), change: narrative, consumer: narrative, paths: dialogueList(token), evidence: narrative, tests: dialogueList(narrative), risk: narrative,
  })), ...replyTail }),
  critique: object({ ...replyBase, phase: choice('critique'), recommendation: choice('accept', 'revise', 'reject', 'insufficient'), review: dialogueList(narrative), tests: dialogueList(narrative), ...replyTail }),
  decision: object({ ...replyBase, phase: choice('decision'), recommendation: choice('adopt', 'defer', 'reject', 'insufficient'), implementationScope: dialogueList(narrative), tests: dialogueList(narrative), ...replyTail }),
  review: object({ ...replyBase, phase: choice('review'), verdict: choice('PASS', 'FAIL', 'INSUFFICIENT'), findings: dialogueList(object({
    id: token, severity: choice('blocker', 'non_blocking'), path: token, description: narrative, requiredChange: narrative,
  })), ...replyTail }),
};
export type BotDialogueReply = Parsed<typeof dialogueReplySchemas[keyof typeof dialogueReplySchemas]>;
export function parseBotDialogueReply(value: unknown): BotDialogueReply {
  if (!dataObject(value)) return fail('request', 'object_required');
  const phase = dialoguePhase(value.phase, 'request.phase');
  return dialogueReplySchemas[phase](value, 'request');
}
export const botDialogueReplyFormats = {
  proposal: { ranked: [{ id: 'unique reference', rank: 1, change: 'source proposal', consumer: 'actual consumer', paths: ['source path'], evidence: 'source evidence', tests: ['test'], risk: 'remaining risk' }] },
  critique: { recommendation: 'accept | revise | reject | insufficient', review: ['source-grounded critique'], tests: ['test'] },
  decision: { recommendation: 'adopt | defer | reject | insufficient', implementationScope: ['bounded scope'], tests: ['test'] },
  review: { verdict: 'PASS | FAIL | INSUFFICIENT', findings: [{ id: 'unique reference', severity: 'blocker | non_blocking', path: 'one supplied source path', description: 'finding', requiredChange: 'repair' }] },
} as const;

// Execution receipts belong to their task, not this reusable advisory input
// contract. The dated r1 receipt is preserved; its fixed stopped-Screen outcome
// must not constrain future observations or pretend to be native verification.

interface NativeSource {
  id: string;
  owner: 'official_docs' | 'installed_native_source' | 'repo_policy' | 'upstream_compatibility';
  reference: string;
  semantics: string;
}
interface DevelopmentContract {
  schemaVersion: 1;
  kind: 'advisory_bot_development_contract';
  nativeStateOwner: 'Hermes';
  orchestration: {
    stateOwner: 'Hermes'; advisoryOnly: true; nativeStateMirror: false;
    dependencyOwner: 'native_kanban_parents_and_handoffs';
    inputOnlyOwner: 'bounded_native_cli_and_terminal_process';
    integrationOwner: 'dc-gang-a-dev'; resultAuthority: 'untrusted_until_exact_consumer_verification';
    controls: readonly string[]; acceptanceDimensions: readonly string[];
  };
  profile: 'dc-gang-a-dev';
  permissionGranted: false;
  session: { botPrimitive: 'Profile'; canonicalTitle: 'Bot Chat'; ordinaryAndKanbanAreCanonical: false; messagingRequires: readonly string[] };
  profileCommunication: { stateOwner:'Hermes'; nativeBotDm:'message_agent'; cliAction:'profile_cli_message'; recipientModes:readonly string[]; admission:string; receipt:string; noAutomaticFallback:true };
  sourceDialogue: { owner:'repo_source_contract'; phases:readonly string[]; prepare:string; consume:string; inputMaxBytes:number; sourceIds:readonly string[]; workFields:readonly string[]; meaning:string };
  roles: Readonly<Record<BotDevelopmentRequest['assignment']['role'], { nativeRestrictionsRequired: boolean; effectCeiling: readonly string[] }>>;
  modelSelection: {
    provider: 'openai-codex'; sol: 'gpt-6.1-sol'; observedLeadModel: 'gpt-6.1-sol-900k'; supportedSolEfforts: readonly ['low', 'medium', 'high', 'xhigh'];
    leadContextVariants: readonly ['gpt-6.1-sol-900k', 'gpt-6-astra-900k'];
    effortPolicy: 'explicit_current_work_selection_matched_to_native_execution'; roleEffortDefault: null;
    luna: { model: 'gpt-6-luna'; role: 'restricted_worker'; judgment: 'negligible' };
  };
  routing: { browserDom: 'browser_exec'; nativeChrome: 'computer_use'; academySource: 'qualified_direct_http'; fallbackOnDenial: false };
  safety: { approvalMode: 'smart'; headless: 'deny'; oneGuiOwner: true; leaseIsOsSandbox: false; handbackRequiresUserContinue: true; secretsInInput: false };
  rehearsalLoop: {
    server: 'harness/academy_browser_rehearsal.ts'; browserCases: 'tests/academy/dateClassBrowserCases.ts';
    caseExport: 'runDateClassBrowserCases'; historicalReceipt: 'review/bot-screen-date-class-trial-2026-10-05.json';
    historicalCaseCount: 9; currentSourceCaseCount: 11; liveTrialByThisWorker: false;
    order: readonly ['build_test', 'fresh_owned_page_and_lease', 'current_browser_cases', 'immediate_same_profile_composited_screen', 'owned_cleanup_and_readback'];
    nativeInactivitySeconds: 120; keepalive: false; sourceFixtureDatesAreCurrentAcademyDates: false;
  };
  sources: readonly NativeSource[];
}
export const botDevelopmentContract = {
  schemaVersion: 1, kind: 'advisory_bot_development_contract', nativeStateOwner: 'Hermes', profile: 'dc-gang-a-dev', permissionGranted: false,
  orchestration: {
    stateOwner: 'Hermes', advisoryOnly: true, nativeStateMirror: false,
    dependencyOwner: 'native_kanban_parents_and_handoffs', inputOnlyOwner: 'bounded_native_cli_and_terminal_process',
    integrationOwner: 'dc-gang-a-dev', resultAuthority: 'untrusted_until_exact_consumer_verification',
    controls: ['current_goal_and_effect_envelope', 'exact_input_and_predecessor_revisions', 'native_actor_and_effective_tools', 'task_selected_model_provider_effort', 'fresh_turn_time_concurrency_retry_and_dialogue_limits', 'disjoint_mutation_targets_not_just_profile_names', 'native_owned_cancellation_and_uncertain_effect_readback', 'minimized_disclosure_and_no_message_authority_transfer', 'independent_review_before_integration'],
    acceptanceDimensions: ['source_contract', 'synthetic_consumer', 'native_execution', 'actual_visual_and_keyboard', 'protected_storage_recovery', 'teacher_acceptance', 'production_and_source_qualification', 'publication_exact_head'],
  },
  session: {
    botPrimitive: 'Profile', canonicalTitle: 'Bot Chat', ordinaryAndKanbanAreCanonical: false,
    messagingRequires: ['protocol_enabled', 'any_managed_profile_on_install', 'canonical_session_resolved_by_native_title', 'schema_injected', 'dispatchable_tool', 'exact_peer_and_disclosure_admission'],
  },
  roles: {
    trusted_lead: { nativeRestrictionsRequired: false, effectCeiling: ['current_assignment_only'] },
    restricted_worker: { nativeRestrictionsRequired: true, effectCeiling: ['native_enforced_current_assignment_only'] },
    restricted_reviewer: { nativeRestrictionsRequired: true, effectCeiling: ['repo_read_only'] },
  },
  profileCommunication: {
    stateOwner:'Hermes',nativeBotDm:'message_agent',cliAction:'profile_cli_message',
    recipientModes:['existing_bot_chat','existing_session','fresh_session'],
    admission:'Resolve exact recipient and current minimized disclosure, one fresh finite invocation and reply-only purpose before sending. An ordinary caller may use the supported native CLI without pretending canonical message_agent exposure. Common owner questions and actual implementation require different Work authority.',
    receipt:'Match native recipient/session, exact request bytes and terminal structured reply; invocation success is not delivery, and a reply is not implementation/test qualification. Native CLI transcript authorship is not authenticated Bot-DM attribution.',
    noAutomaticFallback:true,
  },
  sourceDialogue: {
    owner:'repo_source_contract',phases:['proposal','critique','decision','review'],
    prepare:'dialogue prepare --stdin',consume:'dialogue consume --stdin',inputMaxBytes:262144,
    sourceIds:['bot_development_contract','bot_development_runbook','bot_development_consumer','bot_dialogue_consumer','bot_dialogue_tests','context_routing_consumer','workflow_checkpoint_consumer','atomic_context_consumer','operational_contract_consumer','disclosure_audit_consumer','package_scripts'],
    workFields:['schemaVersion','assignmentId','actorProfile','phase','purpose','question','completion','recovery','expectedContextRevision','sourceIds','controls'],
    meaning:'Reusable current-Work/source preparation and complete phase reply validation. Schema, budget and exported stream claims remain report-only; exact native attribution, permission and mission counters keep their native/Lead owner. No dispatch, DB write, registry or implied confidentiality certification.',
  },
  modelSelection: {
    provider: 'openai-codex', sol: 'gpt-6.1-sol', observedLeadModel: 'gpt-6.1-sol-900k', supportedSolEfforts: ['low', 'medium', 'high', 'xhigh'],
    leadContextVariants: ['gpt-6.1-sol-900k', 'gpt-6-astra-900k'],
    effortPolicy: 'explicit_current_work_selection_matched_to_native_execution', roleEffortDefault: null,
    luna: { model: 'gpt-6-luna', role: 'restricted_worker', judgment: 'negligible' },
  },
  routing: { browserDom: 'browser_exec', nativeChrome: 'computer_use', academySource: 'qualified_direct_http', fallbackOnDenial: false },
  safety: { approvalMode: 'smart', headless: 'deny', oneGuiOwner: true, leaseIsOsSandbox: false, handbackRequiresUserContinue: true, secretsInInput: false },
  rehearsalLoop: {
    server: 'harness/academy_browser_rehearsal.ts', browserCases: 'tests/academy/dateClassBrowserCases.ts', caseExport: 'runDateClassBrowserCases',
    historicalReceipt: 'review/bot-screen-date-class-trial-2026-10-05.json', historicalCaseCount: 9, currentSourceCaseCount: 11, liveTrialByThisWorker: false,
    order: ['build_test', 'fresh_owned_page_and_lease', 'current_browser_cases', 'immediate_same_profile_composited_screen', 'owned_cleanup_and_readback'],
    nativeInactivitySeconds: 120, keepalive: false, sourceFixtureDatesAreCurrentAcademyDates: false,
  },
  sources: [
    { id: 'kanban-docs', owner: 'official_docs', reference: 'https://hermes-agent.nousresearch.com/docs/user-guide/features/kanban', semantics: 'Durable dependencies, scoped handoffs and review belong to the native board. Card creation is not dispatcher liveness or accepted worker output.' },
    { id: 'worker-lanes-docs', owner: 'official_docs', reference: 'https://hermes-agent.nousresearch.com/docs/user-guide/features/kanban-worker-lanes', semantics: 'A lane executes one native card; native lifecycle and provenance remain authoritative. A zero-tool reader must not receive an impossible lifecycle obligation.' },
    { id: 'goals-docs', owner: 'official_docs', reference: 'https://hermes-agent.nousresearch.com/docs/user-guide/features/goals', semantics: 'Finite same-task continuation is distinct from a dependency graph. A model judge cannot waive exact effect or acceptance gates; resume can reset a counter and needs current budget.' },
    { id: 'learning-docs', owner: 'official_docs', reference: 'https://hermes-agent.nousresearch.com/docs/user-guide/features/skills#learning-a-skill-from-sources-learn', semantics: '/learn is a standards-guided ordinary agent turn using skill_manage, not a separate ingestion engine. Extend an existing task skill; preserve native learning and prompt/cache owners.' },
    { id: 'hooks-docs', owner: 'official_docs', reference: 'https://hermes-agent.nousresearch.com/docs/user-guide/features/hooks', semantics: 'Observers, transforms and veto-capable controls are different. A registered warning hook is not deterministic effect enforcement.' },
    { id: 'bot-docs', owner: 'official_docs', reference: 'https://hermes-agent.nousresearch.com/docs/user-guide/bot-mode', semantics: 'Profile-backed canonical chats; routines are native cron; peers and rooms need independent routing and authority.' },
    { id: 'cli-profile-message', owner: 'installed_native_source', reference: '/opt/hermes/tools/bot_relay.py:BOT_CHAT_TURN_ARGS/local_delivery_command; hermes chat --help', semantics: 'Supported --query-file, --continue/--resume and fresh-session CLI entry. Direct CLI use is not the message_agent tool or its native author-stamping/live-mailbox path. Preserve actual existing selection and native ownership refusal; use fresh per-invocation caps.' },
    { id: 'screen-docs', owner: 'official_docs', reference: 'https://hermes-agent.nousresearch.com/docs/user-guide/features/bot-screen', semantics: 'Backend placement, shared-user threat model, human takeover and explicit continue; no OS isolation from a Screen lease.' },
    { id: 'cua-docs', owner: 'official_docs', reference: 'https://hermes-agent.nousresearch.com/docs/user-guide/features/computer-use', semantics: 'Native window/chrome control, background-first; browser-page work uses browser tools. Smart is not bounded manifest enforcement.' },
    { id: 'browser-docs', owner: 'official_docs', reference: 'https://hermes-agent.nousresearch.com/docs/user-guide/features/browser', semantics: 'Named browser sessions and route provenance; same session name is not authority or target ownership.' },
    { id: 'canonical-chat', owner: 'installed_native_source', reference: '/opt/hermes/tui_gateway/methods_profiles.py:161-193', semantics: 'Exact Bot Chat title resolves native lineage; worker sources are excluded. Do not create a local session pointer.' },
    { id: 'messaging-injection', owner: 'installed_native_source', reference: '/opt/hermes/tools/bot_mode_dm.py:123-164', semantics: 'Protocol plus canonical title plus managed install; injection also publishes valid_tool_names.' },
    { id: 'managed-marker', owner: 'installed_native_source', reference: '/opt/hermes/tools/bot_mode_probe.py:110-129', semantics: 'Any real profile.yaml ui_meta.hermes-bots block on install qualifies management; protocol prose alone does not.' },
    { id: 'screen-cli', owner: 'installed_native_source', reference: '/opt/hermes/hermes_cli/subcommands/computer_use_screen.py:12-59', semantics: 'Status exit 1 when stopped; start normal profile only; stop without force preserves a human holder.' },
    { id: 'home-binding', owner: 'installed_native_source', reference: '/opt/hermes/hermes_constants.py:111-118', semantics: 'Actual context-local home overrides process environment; shell profile metadata does not prove a tool caller context.' },
    { id: 'display-binding', owner: 'installed_native_source', reference: '/opt/hermes/tools/bot_desktop/runtime.py:344-401', semantics: 'desktop_env leaves environment unchanged if stopped; therefore do not probe GUI on a stopped fallback. Placement refusal is not a host grant.' },
    { id: 'lease', owner: 'installed_native_source', reference: '/opt/hermes/tools/bot_desktop/lease.py:82-101,233-241', semantics: 'Corrupt lease fails closed; current agent holder and epoch are native tool fences, not external effect grants.' },
    { id: 'cua-fence', owner: 'installed_native_source', reference: '/opt/hermes/tools/computer_use/tool.py:325-382', semantics: 'All actions including captures are lease-gated; changed epoch voids results before persistence.' },
    { id: 'browser-fence', owner: 'installed_native_source', reference: '/opt/hermes/tools/browser_tool_session.py:765-810', semantics: 'Fence follows local provenance; cloud/user CDP paths are not fenced by the profile Screen and cannot be assumed equivalent.' },
    { id: 'browser-exec', owner: 'installed_native_source', reference: '/opt/hermes/tools/browser_use_cli.py:628-696', semantics: 'Native backend resolver, named session and Bot Desktop sentinel select fenced dispatch; no substitute launcher.' },
    { id: 'room-session', owner: 'installed_native_source', reference: '/opt/hermes/tui_gateway/hosted_room_driver.py:1-7', semantics: 'Hosted rooms reuse Group: <room_id> sessions, not the canonical Bot Chat. Do not apply message_agent injection prerequisites to room turns.' },
    { id: 'room-policy', owner: 'installed_native_source', reference: '/opt/hermes/gateway/hosted_room_execution_policy.py:30-65,87-110', semantics: 'Target-issued native room execution policy binds profile/toolsets/approval/max iterations/digest; a local JSON claim or digest is not native enforcement.' },
    { id: 'placement-fix', owner: 'upstream_compatibility', reference: 'https://github.com/NousResearch/hermes-agent/commit/399d9569036d6e85420635c2f54e0177fb8b8d45', semantics: '2026-09-28 terminal-placement correction; installed paths inspected, not live route acceptance or update authority.' },
    { id: 'remote-owner-fix', owner: 'upstream_compatibility', reference: 'https://github.com/NousResearch/hermes-agent/commit/7bc75c083830d8e61cd42f08738d17c3957eb8f1', semantics: '2026-09-12 connection/profile portal isolation correction; matching Windows client behavior remains untested.' },
    { id: 'operating-policy', owner: 'repo_policy', reference: 'docs/backend-autonomy-operating-contract.ts', semantics: 'Keep smart/headless deny; native controls for assignments and separate product target/field/recovery admission.' },
    { id: 'domain-policy', owner: 'repo_policy', reference: 'docs/academy-operational-contract.json', semantics: 'Current main boundary-validated owner, consumed by workflow:context and endpoint:query --contract-topic. The original dirty audit candidate remains preserved; local integration does not grant effects or prove deployment.' },
    { id: 'historical-measurement', owner: 'repo_policy', reference: '/opt/data/attachments/dc-bot-dev-measurement-f98793.json', semantics: '2026-10-05 metadata observation only: native Project cursor, canonical title row and running agent-held Screen do not prove page binding or present effect/model allowances.' },
    { id: 'audit-peer-drift', owner: 'repo_policy', reference: '/opt/data/artifacts/academy-contract-audit-20261005-433a20/premerge-peer-drift.json', semantics: 'Separate candidate has its own owner and uncommitted changes. Preserve it; no takeover/merge/duplication by this development module.' },
    { id: 'rehearsal-server', owner: 'repo_policy', reference: 'harness/academy_browser_rehearsal.ts:10-67', semantics: 'Existing actual client/Application/HTTP synthetic actor and in-memory reader; exact profile/scratch and localhost only. No production DB, real login or cookies qualified.' },
    { id: 'rehearsal-cases', owner: 'repo_policy', reference: 'tests/academy/dateClassBrowserCases.ts:3-52', semantics: 'Existing runDateClassBrowserCases checks localhost plus synthetic marker, exact literal dates/keys, late responses, outage, current refresh cases and same-origin font. Current source has 11 cases, not the dated receipt 9.' },
    { id: 'prior-screen-loop', owner: 'repo_policy', reference: 'review/bot-screen-date-class-trial-2026-10-05.json:20-52', semantics: 'Dated browser/Screen trial: build first, owned target/cases, immediate composited Screen. Preserve native 120s inactivity without keepalive; real DB failures, human takeover and Windows acceptance remain separate.' },
  ],
} as const satisfies DevelopmentContract;

/** Synthetic reports only. Generated timestamps make the CLI example usable, not authoritative. */
export const syntheticBotRequest: BotDevelopmentRequest = {
  schemaVersion: 1, action: 'browser_dom',
  coordination: undefined, dialogue: undefined, profileCli: undefined,
  observation: { observedAtUtc: '2026-10-06T02:59:00Z', validUntilUtc: '2026-10-06T03:05:00Z' },
  assignment: {
    id: 'synthetic-assignment', ownerProfile: 'dc-gang-a-dev', purpose: 'Reuse existing date-class synthetic application rehearsal without private data', role: 'trusted_lead', judgment: 'complex',
    inputs: ['harness/academy_browser_rehearsal.ts', 'tests/academy/dateClassBrowserCases.ts'], ownedPaths: ['scratch/owned-date-class-rehearsal'], outputs: ['synthetic-readback'], verification: ['current-source-browser-cases', 'immediate-composited-screen'], recovery: 'close-only-owned-page-and-fixture-server', completion: 'Retain exact synthetic readback and list unperformed real acceptance',
    model: 'gpt-6.1-sol', provider: 'openai-codex', reasoning: 'high', effects: ['synthetic_gui'], tools: ['browser_exec', 'computer_use', 'terminal'],
    maxTurns: 8, maxSeconds: 600, maxConcurrency: 1, guiConcurrency: 1, maxRetries: 0, freshBudget: true,
  },
  caller: { profile: 'dc-gang-a-dev', sessionId: 'synthetic-session', sessionKind: 'canonical_bot_chat', canonicalTitle: 'Bot Chat', managedInstall: true, protocolEnabled: true, binding: 'native_tool_context', restrictions: 'none', guiToolExposed: true },
  messaging: { toolExposed: true, toolDispatchable: true, peer: 'synthetic-peer@backend', route: 'exact', admission: 'current_assignment', payload: 'minimized_synthetic', roomAuthority: 'synthetic-backend', roomEpochAdmitted: 1, roomEpochCurrent: 1, roomHeld: false, roomPolicy: 'unknown', routineAdmission: 'missing' },
  screen: { supported: true, installed: true, running: true, profile: 'dc-gang-a-dev', placement: 'gateway', holder: 'agent', epochAdmitted: 1, epochCurrent: 1, batchOwner: 'synthetic-session', otherOwners: 'none', afterHumanHandoff: false, userContinue: false },
  target: { id: 'owned-date-class-rehearsal-page', kind: 'synthetic', effect: 'synthetic_gui', surface: 'browser_dom', origin: 'backend_local', identity: 'owned_exact', privateData: false, browserProvenance: 'native_managed_local', challenge: 'none' },
  remote: { requestOrigin: 'backend_cli', route: 'qualified_backend', pathOwner: 'linux_backend', artifactOwner: 'linux_backend' },
  rehearsal: { source: 'existing_date_class', buildTests: 'passed', freshPage: true, browserCases: 'passed_current_source', immediateCapture: true, inactivity: 'native_120s_no_keepalive', cleanup: 'owned_same_target_readback', inheritedHumanOrWindowsAcceptance: false },
  execution: { model: 'gpt-6.1-sol', provider: 'openai-codex', reasoning: 'high', turnsUsed: 0, elapsedSeconds: 0, activeAssignments: 0, retryCount: 0, previousEffect: 'none', readback: 'missing', nativeDecision: 'not_requested', approvalMode: 'smart', headlessPolicy: 'deny', redaction: true },
};

import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { parseBotDialogueWork, parseBotDialogueReply, botDialogueReplyFormats, type BotDialogueWork } from '../docs/bot-development-contract';
import { contextSourcePaths, entryReadPlan, readCurrentContextSource } from './context_routing';
import { validateWorkflowCheckpoint } from './workflow_checkpoint';
import { selectAtomicContext } from './atomic_context';
import { loadAcademyOperationalContract } from '../src/academy/operationalContract';
import { scanPublicationText } from './tools/prepush_audit';

export const BOT_DIALOGUE_MAX_BYTES = 262144;
const rootDefault = resolve(import.meta.dir, '..');
const fail = (code: string): never => { throw new Error('dialogue:' + code); };
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
function dataTree(value: unknown, active = new Set<object>(), depth = 0): void {
  if (depth > 64) fail('invalid_packet');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') { if (!Number.isFinite(value)) fail('invalid_packet'); return; }
  if (typeof value !== 'object') fail('invalid_packet');
  const object = value as object, array = Array.isArray(object), prototype = Object.getPrototypeOf(object);
  if (active.has(object) || (array ? prototype !== Array.prototype : ![Object.prototype, null].includes(prototype))) fail('invalid_packet');
  const descriptors = Object.getOwnPropertyDescriptors(object) as Record<string, PropertyDescriptor>, keys = Reflect.ownKeys(descriptors);
  if (keys.some(key => typeof key !== 'string') || Object.values(descriptors).some(d => !Object.hasOwn(d, 'value'))) fail('invalid_packet');
  if (array) {
    const length = descriptors.length?.value;
    if (!Number.isSafeInteger(length) || length < 0 || length > BOT_DIALOGUE_MAX_BYTES || keys.length !== length + 1) fail('invalid_packet');
    for (let i = 0; i < length; i++) if (!Object.hasOwn(descriptors, String(i))) fail('invalid_packet');
  }
  active.add(object);
  for (const descriptor of Object.values(descriptors)) dataTree(descriptor.value, active, depth + 1);
  active.delete(object);
}
function protectedStrings(value: unknown): boolean {
  if (typeof value === 'string') return scanPublicationText('dialogue.json', value).length > 0;
  if (Array.isArray(value)) return value.some(protectedStrings);
  if (value !== null && typeof value === 'object') return Object.values(value).some(protectedStrings);
  return false;
}
function canonical(value: any): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
function exact(value: unknown, keys: string[]): asserts value is Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some(k => !Object.hasOwn(value, k))) fail('invalid_packet');
}
function budget(work: BotDialogueWork) {
  const c = work.controls;
  if (!c.freshBudget || c.duplicateDelivery || c.invocationsUsed >= c.maxInvocations || c.messagesUsed >= c.maxMessages || c.hopsUsed >= c.maxHops) fail('reported_budget_exhausted');
  if (c.nativeDecision === 'denied' || c.nativeDecision === 'unknown') fail('native_stop_reported');
}
export function currentBotDialogueContext(root = rootDefault, now = new Date()) {
  const bytes = readCurrentContextSource(root, 'engineering_checkpoint');
  const checkpoint = validateWorkflowCheckpoint(JSON.parse(bytes.toString('utf8')));
  const routingBytes = readCurrentContextSource(root, 'routing_contract');
  const routing = JSON.parse(routingBytes.toString('utf8')).contextReadRouting;
  const plan = entryReadPlan(root, routing, 'bot_development', ['engineering_checkpoint', 'routing_contract', 'operational_contract', 'backend_profile', 'profile_ontology_plan'], 'current');
  if (!plan.ok || plan.requiredReads.find(s => s.id === 'engineering_checkpoint')?.sha256 !== sha(bytes)
    || plan.requiredReads.find(s => s.id === 'routing_contract')?.sha256 !== sha(routingBytes)) fail('current_context_unavailable');
  const context = selectAtomicContext(checkpoint, loadAcademyOperationalContract(root), plan, now);
  const work = context.atoms.find(a => a.kind === 'work_intent');
  if (!work || work.kind !== 'work_intent' || work.value.stage !== 'in_progress') fail('current_work_closed');
  return context;
}
function sources(root: string, work: BotDialogueWork) {
  if (!work.sourceIds.length || new Set(work.sourceIds).size !== work.sourceIds.length) fail('unique_sources_required');
  return work.sourceIds.map(id => {
    const bytes = readCurrentContextSource(root, id), content = bytes.toString('utf8'), path = contextSourcePaths[id];
    if (bytes.length > 131072 || scanPublicationText(path, content).length) fail('source_disclosure_refused');
    return { id, path, sha256: sha(bytes), coverage: 'complete_file' as const, content };
  });
}
/** Read only the selected owner and closed public-source vocabulary. No native process or state API. */
export function prepareBotDialogue(value: unknown, root = rootDefault, now = new Date()) {
  const work = parseBotDialogueWork(value); budget(work);
  if (protectedStrings(work)) fail('disclosure_refused');
  const context = currentBotDialogueContext(root, now);
  if (context.revision !== work.expectedContextRevision) fail('stale_context_revision');
  const base = {
    schemaVersion: 1, kind: 'advisory_source_dialogue_packet', permissionGranted: false, nativeEvidenceVerified: false, executesEffects: false,
    origin: 'agent_composed_reviewed_source_not_a_new_human_command', work, context, sources: sources(root, work),
    replyContract: { ...botDialogueReplyFormats[work.phase], schemaVersion: 1, assignmentId: work.assignmentId,
      packetRevision: 'Copy the top-level packetRevision exactly.', phase: work.phase, peerMessage: 'Advice only; no authority transfer.', limitations: ['Explicit unknown or unperformed gate.'] },
    nativeBoundary: 'Input-only fresh native CLI requires independently qualified disabled_toolsets=[all], current admission, exact model/provider/effort and fresh finite caps. This packet does not dispatch, authenticate, register a Bot, grant a retry, qualify an implementation worker or change native safety/learning.',
  };
  const packet = { ...base, packetRevision: sha(canonical(base)) };
  const complete = { ...packet, consumeBinding: { work, packetRevision: packet.packetRevision } };
  if (protectedStrings(complete)) fail('disclosure_refused');
  if (Buffer.byteLength(JSON.stringify(complete), 'utf8') > BOT_DIALOGUE_MAX_BYTES) fail('packet_too_large');
  return complete;
}
function validatePacket(value: unknown, root: string, now: Date) {
  exact(value, ['schemaVersion', 'kind', 'permissionGranted', 'nativeEvidenceVerified', 'executesEffects', 'origin', 'work', 'context', 'sources', 'replyContract', 'nativeBoundary', 'packetRevision', 'consumeBinding']);
  const expected = prepareBotDialogue(value.work, root, now);
  if (canonical(value) !== canonical(expected)) fail('packet_revision_or_source_drift');
  return expected;
}
function checkedReply(packet: ReturnType<typeof prepareBotDialogue>, raw: unknown) {
  const reply = parseBotDialogueReply(raw);
  if (reply.assignmentId !== packet.work.assignmentId || reply.packetRevision !== packet.packetRevision || reply.phase !== packet.work.phase) fail('reply_binding_mismatch');
  if (protectedStrings(reply)) fail('disclosure_refused');
  if (reply.phase === 'proposal') {
    const intent = packet.context.atoms.find(a => a.kind === 'work_intent');
    const selected = packet.context.atoms.find(a => a.kind === 'work_step' && intent?.kind === 'work_intent' && a.value.unit === intent.value.unit);
    const allowed = new Set([...packet.sources.map(s => s.path), ...(selected?.kind === 'work_step' ? selected.value.targetRefs : [])]);
    if (!reply.ranked.length || new Set(reply.ranked.map(r => r.id)).size !== reply.ranked.length
      || reply.ranked.some((r, i) => r.rank !== i + 1 || !r.paths.length || !r.tests.length || r.paths.some(path => !allowed.has(path)))) fail('invalid_ranked_reply');
  }
  if (reply.phase === 'critique' && (!reply.review.length || !reply.tests.length)
    || reply.phase === 'decision' && (!reply.implementationScope.length || !reply.tests.length)) fail('incomplete_reply');
  if (reply.phase === 'review') {
    const blocker = reply.findings.some(f => f.severity === 'blocker');
    if (new Set(reply.findings.map(f => f.id)).size !== reply.findings.length
      || reply.verdict === 'PASS' && blocker || reply.verdict === 'FAIL' && !blocker
      || reply.findings.some(f => !packet.sources.some(s => s.path === f.path))) fail('review_contradiction_or_unknown_source');
  }
  return reply;
}
/** Complete schema/binding validation only; caller-supplied replies and exported streams are not native proof. */
export function consumeBotDialogue(value: unknown, root = rootDefault, now = new Date()) {
  dataTree(value);
  const bindingMode = Object.hasOwn(value as object ?? {}, 'binding'), response = Object.hasOwn(value as object ?? {}, 'streamJsonl') ? 'streamJsonl' : 'reply';
  exact(value, [bindingMode ? 'binding' : 'packet', response]);
  let packet: ReturnType<typeof prepareBotDialogue>;
  if (bindingMode) {
    exact(value.binding, ['work', 'packetRevision']);
    packet = prepareBotDialogue(value.binding.work, root, now);
    if (value.binding.packetRevision !== packet.packetRevision) fail('packet_revision_or_source_drift');
  } else packet = validatePacket(value.packet, root, now);
  let raw = value.reply, nativeReportedSessionId: string | null = null;
  if (Object.hasOwn(value, 'streamJsonl')) {
    if (typeof value.streamJsonl !== 'string') fail('invalid_stream');
    const events = value.streamJsonl.split('\n').filter(Boolean).map((s: string) => { try { return JSON.parse(s); } catch { return fail('invalid_stream'); } });
    const results = events.filter((e: any) => e?.type === 'result'), init = events.filter((e: any) => e?.type === 'system' && e.subtype === 'init');
    if (results.length !== 1 || init.length !== 1 || events[0] !== init[0] || events.at(-1) !== results[0]
      || events.slice(1, -1).some((e: any) => e?.type !== 'text') || results[0].exit_code !== 0 || typeof results[0].text !== 'string'
      || typeof results[0].session_id !== 'string' || init[0].session_id !== results[0].session_id || init[0].model !== packet.work.controls.model
      || events.some((e: any) => !['system', 'text', 'result'].includes(e?.type))) fail('stream_unsettled_or_tool_effect');
    if (!/^[A-Za-z0-9_-]{1,160}$/.test(results[0].session_id)
      || scanPublicationText('dialogue.json', results[0].session_id).length) fail('stream_metadata_disclosure_refused');
    nativeReportedSessionId = results[0].session_id;
    try { raw = JSON.parse(results[0].text); } catch { fail('invalid_reply_json'); }
  }
  const validatedReply = checkedReply(packet, raw), c = packet.work.controls;
  return { schemaVersion: 1, kind: 'validated_source_dialogue_reply', schemaValid: true,
    permissionGranted: false, nativeEvidenceVerified: false, executesEffects: false, nativeReportedSessionId,
    validatedReply, peerInput: { trust: 'schema_checked_analyst_data_not_native_DM_or_permission', assignmentId: packet.work.assignmentId,
      packetRevision: packet.packetRevision, reply: validatedReply },
    reportedUsageAfter: { invocationsUsed: c.invocationsUsed + 1, messagesUsed: c.messagesUsed + 1, hopsUsed: c.hopsUsed + 1 },
    requiredNativeReadback: ['actual recipient/session/model/provider and effective restrictions', 'exact native stored input and terminal reply; distinct tool calls', 'current native authority, stop and remaining mission budget; no metadata reset or automatic next dispatch'],
  };
}

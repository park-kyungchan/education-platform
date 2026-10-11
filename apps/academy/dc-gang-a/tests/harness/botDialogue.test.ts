import { afterAll, expect, test } from 'bun:test';
import { resolve, dirname, join } from 'node:path';
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { runBotGovernanceCli } from '../../harness/bot_governance';
import { parseBotDialogueReply, parseBotDialogueWork } from '../../docs/bot-development-contract';
import { currentBotDialogueContext, consumeBotDialogue } from '../../harness/bot_dialogue';
import { contextSourcePaths } from '../../harness/context_routing';
import { hermesBackendProfile } from '../../docs/hermes-backend-profile';

const root = resolve(import.meta.dir, '../..');
const fixtureRoot = mkdtempSync(join(tmpdir(), 'l2-source-fixture-'));
for (const id of [...hermesBackendProfile.contextSelection.currentCommonSources, ...hermesBackendProfile.contextSelection.purposeSources.bot_development,
  'bot_development_consumer', 'bot_dialogue_consumer', 'bot_dialogue_tests'] as Array<keyof typeof contextSourcePaths>) {
  const target = resolve(fixtureRoot, contextSourcePaths[id]); mkdirSync(dirname(target), { recursive: true }); copyFileSync(resolve(root, contextSourcePaths[id]), target);
}
const checkpointPath = resolve(fixtureRoot, contextSourcePaths.engineering_checkpoint);
const fixtureCheckpoint = JSON.parse(readFileSync(checkpointPath, 'utf8'));
fixtureCheckpoint.engineeringContext.currentWork.state = 'in_progress';
writeFileSync(checkpointPath, JSON.stringify(fixtureCheckpoint, null, 2) + '\n');
afterAll(() => rmSync(fixtureRoot, { recursive: true, force: true }));
const call = (args: string[], input: string) => runBotGovernanceCli(args, input, Date.now(), fixtureRoot);
function work(phase = 'proposal'): any {
  const c = currentBotDialogueContext(fixtureRoot);
  return { schemaVersion: 1, assignmentId: 'synthetic-l2-work', actorProfile: 'dc-context', phase,
    purpose: 'Review the existing source-only dialogue contract.', question: 'Propose a bounded source improvement; no operational effects.',
    completion: 'Return only the strict phase JSON.', recovery: 'Preserve refusal and stop this invocation.',
    expectedContextRevision: c.revision, sourceIds: ['bot_development_contract'],
    controls: { model: 'gpt-6.1-sol', provider: 'openai-codex', reasoning: 'high', maxTurns: 2, maxSeconds: 120,
      maxInvocations: 3, invocationsUsed: 0, maxMessages: 3, messagesUsed: 0, maxHops: 2, hopsUsed: 0,
      maxConcurrency: 1, maxRetries: 0, freshBudget: true, duplicateDelivery: false, nativeDecision: 'not_requested' } };
}
function prepare(w = work()) {
  const r = call(['dialogue', 'prepare', '--stdin'], JSON.stringify(w));
  expect(r.exitCode).toBe(0);
  return JSON.parse(r.stdout);
}
function reply(p: any): any {
  const common = { schemaVersion: 1, assignmentId: p.work.assignmentId, packetRevision: p.packetRevision, phase: p.work.phase,
    peerMessage: 'Advice only; no permission.', limitations: ['Synthetic metadata, not native execution.'] };
  if (p.work.phase === 'critique') return { ...common, recommendation: 'accept', review: ['Supplied source reviewed.'], tests: ['Wrong types refuse.'] };
  if (p.work.phase === 'decision') return { ...common, recommendation: 'adopt', implementationScope: ['Declared source only.'], tests: ['Binding test.'] };
  if (p.work.phase === 'review') return { ...common, verdict: 'PASS', findings: [] };
  return { schemaVersion: 1, assignmentId: p.work.assignmentId, packetRevision: p.packetRevision, phase: p.work.phase,
    ranked: [{ id: 'fixture-change', rank: 1, change: 'Keep all result fields strictly typed.', consumer: 'source-only CLI',
      paths: ['docs/bot-development-contract.ts'], evidence: 'Supplied contract body.', tests: ['Wrong field type refuses.'], risk: 'Source-only fixture.' }],
    peerMessage: 'Advice only; no permission.', limitations: ['Synthetic metadata, not native execution.'] };
}
function consume(p: any, r: any) { return call(['dialogue', 'consume', '--stdin'], JSON.stringify({ packet: p, reply: r })); }

test('public dialogue prepare binds current Work and full fixed sources without native effects', () => {
  const p = prepare();
  expect(p.kind).toBe('advisory_source_dialogue_packet');
  expect(p.work.assignmentId).toBe('synthetic-l2-work');
  expect(p.context.atoms.find((a: any) => a.kind === 'work_intent').value.unit).toBe(fixtureCheckpoint.engineeringContext.currentWork.unit);
  expect(p.sources[0]).toMatchObject({ id: 'bot_development_contract', path: 'docs/bot-development-contract.ts' });
  expect(p.sources[0].content).toContain('parseBotRequest');
  expect(p.packetRevision).toMatch(/^[a-f0-9]{64}$/);
  expect(p).toMatchObject({ permissionGranted: false, nativeEvidenceVerified: false, executesEffects: false });
  const accepted = consume(p, reply(p));
  expect(accepted.exitCode).toBe(0);
  expect(JSON.parse(accepted.stdout)).toMatchObject({ kind: 'validated_source_dialogue_reply', schemaValid: true,
    permissionGranted: false, nativeEvidenceVerified: false, executesEffects: false });
});

test('every reply phase checks all nested arrays and closed recommendations', () => {
  for (const phase of ['proposal', 'critique', 'decision', 'review']) {
    const p = prepare(work(phase)), valid = reply(p);
    expect(consume(p, valid).exitCode).toBe(0);
    for (const key of ['assignmentId', 'packetRevision', 'phase', 'peerMessage', 'limitations']) {
      const bad = structuredClone(valid); delete bad[key]; expect(consume(p, bad).exitCode).toBe(2);
    }
    for (const key of Object.keys(valid).filter(k => Array.isArray(valid[k]))) {
      for (const wrong of [null, 'not_an_array', [3]]) expect(consume(p, { ...valid, [key]: wrong }).exitCode).toBe(2);
    }
    if (phase === 'critique' || phase === 'decision') expect(consume(p, { ...valid, recommendation: 'grant_native_permission' }).exitCode).toBe(2);
    expect(consume(p, { ...valid, permissionGranted: true }).exitCode).toBe(2);
  }
});
test('malformed, cross-work, phase-drift and source-tampered replies never become peer input', () => {
  const p = prepare();
  for (const change of [{ assignmentId: 'other-work' }, { packetRevision: '0'.repeat(64) }, { phase: 'critique' }]) {
    const r = consume(p, { ...reply(p), ...change }); expect(r.exitCode).toBe(2);
    expect(JSON.parse(r.stdout).peerInput).toBeUndefined(); expect(JSON.parse(r.stdout).nativeEvidenceVerified).toBe(false);
  }
  const damaged = structuredClone(p); damaged.sources[0].content += '\nchanged';
  expect(consume(damaged, reply(p)).exitCode).toBe(2);
  const badRank = reply(p); badRank.ranked[0].tests = [false]; expect(consume(p, badRank).exitCode).toBe(2);
  badRank.ranked[0].tests = ['test']; badRank.ranked[0].rank = 2; expect(consume(p, badRank).exitCode).toBe(2);
  expect(consume(p, { ...reply(p), peerMessage: '' }).exitCode).toBe(2);
});
test('reported spent, duplicate, denied and stale requests fail closed without source disclosure', () => {
  const w = work();
  for (const mutate of [
    (r: any) => { r.controls.invocationsUsed = r.controls.maxInvocations; },
    (r: any) => { r.controls.messagesUsed = r.controls.maxMessages; },
    (r: any) => { r.controls.hopsUsed = r.controls.maxHops; },
    (r: any) => { r.controls.freshBudget = false; },
    (r: any) => { r.controls.duplicateDelivery = true; },
    (r: any) => { r.controls.nativeDecision = 'denied'; },
    (r: any) => { r.controls.nativeDecision = 'unknown'; },
    (r: any) => { r.expectedContextRevision = '0'.repeat(64); },
    (r: any) => { r.sourceIds = ['data/private.json']; },
    (r: any) => { r.sourceIds = ['bot_development_contract', 'bot_development_contract']; },
  ]) {
    const bad = structuredClone(w); mutate(bad);
    const result = call(['dialogue', 'prepare', '--stdin'], JSON.stringify(bad));
    expect(result.exitCode).toBe(2); expect(JSON.parse(result.stdout).sources).toBeUndefined();
    expect(JSON.parse(result.stdout)).toMatchObject({ permissionGranted: false, nativeEvidenceVerified: false, executesEffects: false });
  }
});
test('review PASS cannot retain a blocker and FAIL cannot omit its blocker', () => {
  const p = prepare(work('review')), valid = reply(p);
  const finding = { id: 'issue', severity: 'blocker', path: 'docs/bot-development-contract.ts', description: 'Synthetic finding.', requiredChange: 'Synthetic repair.' };
  expect(consume(p, { ...valid, findings: [finding] }).exitCode).toBe(2);
  expect(consume(p, { ...valid, verdict: 'FAIL' }).exitCode).toBe(2);
  expect(consume(p, { ...valid, verdict: 'FAIL', findings: [finding] }).exitCode).toBe(0);
  expect(consume(p, { ...valid, verdict: 'FAIL', findings: [{ ...finding, path: '/etc/passwd' }] }).exitCode).toBe(2);
});
test('public stream consumption rejects uncertain, duplicate and tool-bearing exports', () => {
  const p = prepare(), r = reply(p), init = { type: 'system', subtype: 'init', model: 'gpt-6.1-sol', session_id: 'synthetic-session' },
    result = { type: 'result', session_id: 'synthetic-session', exit_code: 0, text: JSON.stringify(r) };
  const stream = (events: unknown[]) => call(['dialogue', 'consume', '--stdin'], JSON.stringify({ packet: p, streamJsonl: events.map(e => JSON.stringify(e)).join('\n') + '\n' }));
  expect(stream([init, result]).exitCode).toBe(0);
  for (const events of [[init], [init, result, result], [init, { ...result, exit_code: 1 }], [init, { ...result, session_id: 'other' }],
    [init, { type: 'tool_start' }, result], [{ ...init, model: 'other' }, result]]) expect(stream(events).exitCode).toBe(2);
});
test('only ordered terminal streams yield peer data; result-before-init and trailing events refuse', () => {
  const p = prepare(), valid = reply(p), init = { type: 'system', subtype: 'init', model: 'gpt-6.1-sol', session_id: 'synthetic-session' },
    result = { type: 'result', session_id: 'synthetic-session', exit_code: 0, text: JSON.stringify(valid) };
  for (const events of [[result, init], [init, result, { type: 'text', text: 'unfinished' }], [init, result, { type: 'system', subtype: 'notice' }]]) {
    const r = call(['dialogue', 'consume', '--stdin'], JSON.stringify({ packet: p, streamJsonl: events.map(e => JSON.stringify(e)).join('\n') + '\n' }));
    expect(r.exitCode).toBe(2); expect(JSON.parse(r.stdout).peerInput).toBeUndefined();
  }
});
test('reply phase accessor is rejected before discriminator access', () => {
  const p = prepare(), bad = reply(p); let touched = false;
  Object.defineProperty(bad, 'phase', { enumerable: true, get() { touched = true; return 'proposal'; } });
  expect(() => parseBotDialogueReply(bad)).toThrow(); expect(touched).toBe(false);
});
test('stream session metadata cannot echo protected values or reach peers', () => {
  const p = prepare(), valid = reply(p), sessionId = 'ghp_' + 'A'.repeat(24);
  const events = [{ type: 'system', subtype: 'init', model: 'gpt-6.1-sol', session_id: sessionId },
    { type: 'result', session_id: sessionId, exit_code: 0, text: JSON.stringify(valid) }];
  const r = call(['dialogue', 'consume', '--stdin'], JSON.stringify({ packet: p, streamJsonl: events.map(e => JSON.stringify(e)).join('\n') }));
  expect(r.exitCode).toBe(2); expect(r.stdout).not.toContain(sessionId); expect(JSON.parse(r.stdout).peerInput).toBeUndefined();
});
test('decoded whitespace-separated protected patterns refuse before prepare or peer egress', () => {
  const w = work(), p = prepare();
  for (const separator of ['\t', '\n', '\r']) {
    const specimen = 'JSESSIONID' + separator + '=' + separator + 'A'.repeat(16);
    const prepared = call(['dialogue', 'prepare', '--stdin'], JSON.stringify({ ...w, question: specimen }));
    expect(prepared.exitCode).toBe(2); expect(prepared.stdout).not.toContain('JSESSIONID');
    const valid = reply(p); valid.limitations = [specimen];
    const consumed = call(['dialogue', 'consume', '--stdin'], JSON.stringify({ binding: p.consumeBinding, reply: valid }));
    expect(consumed.exitCode).toBe(2); expect(consumed.stdout).not.toContain('JSESSIONID');
    expect(JSON.parse(consumed.stdout).peerInput).toBeUndefined();
  }
});
test('dialogue arrays are dense own data before iteration and legacy list behavior is separate', () => {
  const p = prepare(work('review')), valid = reply(p);
  const sparse = { ...valid, findings: new Array(1) };
  expect(() => parseBotDialogueReply(sparse)).toThrow();
  expect(() => consumeBotDialogue({ packet: p, reply: sparse }, fixtureRoot)).toThrow();
  for (const property of ['0', 'map']) {
    let touched = false; const items: any[] = ['source limitation'];
    Object.defineProperty(items, property, { enumerable: true, get() { touched = true; return property === 'map' ? Array.prototype.map : 'value'; } });
    expect(() => parseBotDialogueReply({ ...valid, limitations: items })).toThrow(); expect(touched).toBe(false);
  }
});
test('compact consume binding retains exact source identity without resending all bodies', () => {
  const p = prepare(), valid = reply(p);
  expect(p.consumeBinding).toMatchObject({ packetRevision: p.packetRevision, work: p.work });
  const r = call(['dialogue', 'consume', '--stdin'], JSON.stringify({ binding: p.consumeBinding, reply: valid }));
  expect(r.exitCode).toBe(0); expect(JSON.parse(r.stdout).validatedReply).toEqual(valid);
  const damaged = { ...p.consumeBinding, packetRevision: '0'.repeat(64) };
  expect(call(['dialogue', 'consume', '--stdin'], JSON.stringify({ binding: damaged, reply: valid })).exitCode).toBe(2);
});
test('generated context disclosure is checked before any packet egress', () => {
  const path = resolve(fixtureRoot, contextSourcePaths.routing_contract), before = readFileSync(path, 'utf8');
  const doc = JSON.parse(before), specimen = 'ghp_' + 'A'.repeat(24), w = work();
  doc.contextReadRouting.sources.find((s: any) => s.id === 'agent_instructions').role = specimen;
  try {
    writeFileSync(path, JSON.stringify(doc, null, 2) + '\n');
    const changed = currentBotDialogueContext(fixtureRoot), result = call(['dialogue', 'prepare', '--stdin'], JSON.stringify({ ...w, expectedContextRevision: changed.revision }));
    expect(result.exitCode).toBe(2); expect(result.stdout).not.toContain(specimen); expect(JSON.parse(result.stdout).sources).toBeUndefined();
  } finally { writeFileSync(path, before); }
});
test('consume envelope, binding and nested packet accessors never execute', () => {
  const p = prepare(), valid = reply(p);
  for (const mode of ['envelope', 'binding', 'packet']) {
    let touched = false;
    const envelope: any = mode === 'binding' ? { binding: { ...p.consumeBinding }, reply: valid } : { packet: structuredClone(p), reply: valid };
    const target = mode === 'envelope' ? envelope : mode === 'binding' ? envelope.binding : envelope.packet.context;
    const key = mode === 'envelope' ? 'reply' : mode === 'binding' ? 'work' : 'atoms', value = target[key];
    Object.defineProperty(target, key, { enumerable: true, get() { touched = true; return value; } });
    expect(() => consumeBotDialogue(envelope, fixtureRoot)).toThrow(); expect(touched).toBe(false);
  }
});
test('parser and streaming byte guards do not echo private values or broaden decide limits', () => {
  const w = work();
  expect(() => parseBotDialogueWork({ ...w, purpose: '가'.repeat(1400) })).toThrow();
  expect(() => parseBotDialogueReply(null)).toThrow();
  for (const args of [['dialogue', 'prepare', '--stdin'], ['decide', '--stdin']]) {
    const r = call(args, 'x'.repeat(262145)); expect(r.exitCode).toBe(2); expect(r.stdout.length).toBeLessThan(512);
  }
  const r = call(['dialogue', 'prepare', '--stdin'], JSON.stringify({ ...w, privateUnrecognized: 'never_echo_this' }));
  expect(r.stdout).not.toContain('never_echo_this'); expect(r.stdout).not.toContain('privateUnrecognized');
  const live = JSON.parse(readFileSync(resolve(root, contextSourcePaths.engineering_checkpoint), 'utf8'));
  const actualContext = Bun.spawnSync([process.execPath, '--no-env-file', resolve(root, 'harness/workflow_checkpoint.ts'), 'context', 'bot_development', '--compact'], { cwd: root });
  const actualWork = { ...w, expectedContextRevision: JSON.parse(actualContext.stdout.toString()).revision };
  const child = Bun.spawnSync([process.execPath, '--no-env-file', resolve(root, 'harness/bot_governance.ts'), 'dialogue', 'prepare', '--stdin'],
    { cwd: root, stdin: Buffer.from(JSON.stringify(actualWork)) });
  if (live.engineeringContext.currentWork.state === 'in_progress') {
    expect(child.exitCode).toBe(0); expect(JSON.parse(child.stdout.toString()).kind).toBe('advisory_source_dialogue_packet');
  } else {
    expect(child.exitCode).toBe(2); expect(JSON.parse(child.stdout.toString()).error).toBe('dialogue:current_work_closed');
  }
});

test('inherited/accessor records and undeclared target proposals refuse instead of reaching peers', () => {
  const w = work();
  expect(() => parseBotDialogueWork(Object.create(w))).toThrow();
  let touched = false;
  const accessor = { ...w }; Object.defineProperty(accessor, 'purpose', { enumerable: true, get() { touched = true; return w.purpose; } });
  expect(() => parseBotDialogueWork(accessor)).toThrow(); expect(touched).toBe(false);
  const p = prepare(), bad = reply(p); bad.ranked[0].paths = ['/etc/passwd'];
  const result = consume(p, bad); expect(result.exitCode).toBe(2); expect(JSON.parse(result.stdout).peerInput).toBeUndefined();
});

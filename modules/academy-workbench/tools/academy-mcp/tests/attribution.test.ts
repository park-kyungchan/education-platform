import { describe, expect, test } from 'bun:test';
import { normalizedRequestTextHash, verifyAttribution, type AttributionEnvelope, type AttributionOwnerPort } from '../src/attribution.ts';

const NOW = Date.parse('2026-10-26T00:00:00+09:00');
const BLOCKS = ['실제 저장해줘', '수업1부만'];
const ACTION = 'a'.repeat(64);

function envelope(over: Partial<AttributionEnvelope> = {}): AttributionEnvelope {
  return {
    schemaVersion: 'academy.attribution-envelope/1',
    runtime: 'muse',
    runtimeSessionId: 'synthetic-session',
    requestRef: 'synthetic-request',
    requestTextSha256: normalizedRequestTextHash(BLOCKS),
    currentUserEventRef: 'synthetic-request',
    issuedAt: '2026-10-25T23:00:00+09:00',
    expiresAt: '2026-10-26T01:00:00+09:00',
    actionDigests: [ACTION],
    ...over,
  };
}
const owner = (found: unknown): AttributionOwnerPort => ({ lookup: async () => found as never });
const live = { textBlocks: BLOCKS, currentUserEventRef: 'synthetic-request', superseded: false };

describe('P1 attribution envelope v2 (synthetic only)', () => {
  test('valid envelope verifies for its bound action in all runtimes', async () => {
    for (const runtime of ['muse', 'codex', 'hermes'] as const) {
      expect(await verifyAttribution(envelope({ runtime }), ACTION, owner(live), () => NOW)).toEqual({ status: 'verified', actionDigest: ACTION });
    }
  });
  test('expired envelope is rejected', async () => {
    expect(await verifyAttribution(envelope(), ACTION, owner(live), () => Date.parse('2026-10-26T02:00:00+09:00'))).toEqual({ status: 'rejected', reason: 'expired' });
  });
  test('action not bound to the envelope is rejected', async () => {
    expect(await verifyAttribution(envelope(), 'b'.repeat(64), owner(live), () => NOW)).toEqual({ status: 'rejected', reason: 'action_not_bound' });
  });
  test('hash mismatch from different normalization is rejected', async () => {
    const wrong = { ...live, textBlocks: [BLOCKS.join(' ')] };
    expect(await verifyAttribution(envelope(), ACTION, owner(wrong), () => NOW)).toEqual({ status: 'rejected', reason: 'hash_mismatch' });
  });
  test('cancelled/superseded instruction is rejected by owner lookup', async () => {
    expect(await verifyAttribution(envelope(), ACTION, owner({ ...live, superseded: true }), () => NOW)).toEqual({ status: 'rejected', reason: 'superseded' });
  });
  test('missing request and stale current-event pointer are rejected', async () => {
    expect(await verifyAttribution(envelope(), ACTION, owner(null), () => NOW)).toEqual({ status: 'rejected', reason: 'request_not_found' });
    expect(await verifyAttribution(envelope(), ACTION, owner({ ...live, currentUserEventRef: 'newer-event' }), () => NOW)).toEqual({ status: 'rejected', reason: 'current_event_mismatch' });
  });
});

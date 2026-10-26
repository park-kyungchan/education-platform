import { createHash } from 'node:crypto';
import { z } from 'zod';

/** Runtime-neutral attribution envelope (P1 v2). Runtime adapters only build
 * this from their own session store; judgement and consumption stay with the
 * owner. Reads need no envelope. This module validates form only plus the
 * owner-lookup checks; it performs no academy effect. */
export const attributionEnvelopeSchema = z.object({
  schemaVersion: z.literal('academy.attribution-envelope/1'),
  runtime: z.enum(['muse', 'codex', 'hermes']),
  runtimeSessionId: z.string().min(1).max(256),
  requestRef: z.string().min(1).max(256),
  requestTextSha256: z.string().regex(/^[a-f0-9]{64}$/),
  currentUserEventRef: z.string().min(1).max(256),
  issuedAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }),
  actionDigests: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1).max(32),
}).strict();
export type AttributionEnvelope = z.infer<typeof attributionEnvelopeSchema>;

/** Normalization fixed by spec: text blocks in order, joined by LF, no
 * trimming, UTF-8. Any runtime normalizing differently produces a different
 * hash and is rejected. */
export function normalizedRequestTextHash(textBlocks: readonly string[]): string {
  return createHash('sha256').update(textBlocks.join('\n'), 'utf8').digest('hex');
}

export interface AttributionOwnerPort {
  /** Owner-side lookup, never an adapter claim: the pinned request event and
   * whether it is still the current (not cancelled/superseded) instruction. */
  lookup(requestRef: string): Promise<{ textBlocks: string[]; currentUserEventRef: string; superseded: boolean } | null>;
}

export type AttributionVerdict =
  | { status: 'verified'; actionDigest: string }
  | { status: 'rejected'; reason: 'malformed' | 'expired' | 'action_not_bound' | 'request_not_found' | 'superseded' | 'current_event_mismatch' | 'hash_mismatch' };

export async function verifyAttribution(
  envelope: unknown,
  actionDigest: string,
  owner: AttributionOwnerPort,
  now: () => number = Date.now,
): Promise<AttributionVerdict> {
  const parsed = attributionEnvelopeSchema.safeParse(envelope);
  if (!parsed.success) return { status: 'rejected', reason: 'malformed' };
  const e = parsed.data;
  if (Date.parse(e.expiresAt) <= now() || Date.parse(e.issuedAt) > now()) return { status: 'rejected', reason: 'expired' };
  if (!e.actionDigests.includes(actionDigest)) return { status: 'rejected', reason: 'action_not_bound' };
  const found = await owner.lookup(e.requestRef);
  if (!found) return { status: 'rejected', reason: 'request_not_found' };
  if (found.superseded) return { status: 'rejected', reason: 'superseded' };
  if (found.currentUserEventRef !== e.currentUserEventRef) return { status: 'rejected', reason: 'current_event_mismatch' };
  if (normalizedRequestTextHash(found.textBlocks) !== e.requestTextSha256) return { status: 'rejected', reason: 'hash_mismatch' };
  return { status: 'verified', actionDigest };
}

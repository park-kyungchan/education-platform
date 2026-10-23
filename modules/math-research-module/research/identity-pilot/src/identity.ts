import { createHash, randomUUID } from 'node:crypto';
import { TYPE_LAYER } from './model.ts';
import type { Core, EntityType, Json, Ref, Revision } from './model.ts';
export const RESEARCH_ID = /^mred:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const ARTIFACT_ID = /^[a-z][a-z0-9-]*:(project|task|proposal|decision|evidence|verification|run):[a-z0-9][a-z0-9._:-]*$/;
export const SLUG = /^[a-z][a-z0-9-]*$/;
export const SHA256 = /^[a-f0-9]{64}$/;
export const key = (r: Ref): string => `${r.id}@${r.version}`;
export const ref = (r: Revision): Ref => ({ id: r.id, version: r.version });
export function canonical(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value === 'object' && value && Object.getPrototypeOf(value) === Object.prototype)
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(',')}}`;
  throw new TypeError('Only finite JSON values may be hashed');
}
export const hash = (value: unknown): string => createHash('sha256').update(canonical(value)).digest('hex');
/** Caller persists this set atomically in a real store. Local allocation is not global registration. */
export function issueId(existing: Set<string>, uuid: () => string = randomUUID): string {
  for (let attempt = 0; attempt < 32; attempt++) {
    const id = `mred:${uuid()}`;
    if (!RESEARCH_ID.test(id)) throw new TypeError('Expected an opaque RFC 4122 UUIDv4');
    if (!existing.has(id)) { existing.add(id); return id; }
  }
  throw new Error('ID collision limit reached; no identity was issued');
}
export function makeRevision(input: Omit<Revision, 'layer' | 'semanticCoreHash' | 'revisionHash'>): Revision {
  if (!RESEARCH_ID.test(input.id) || !Number.isInteger(input.version) || input.version < 1) throw new TypeError('Invalid revision identity');
  if (!(input.type in TYPE_LAYER)) throw new TypeError('Unknown entity type');
  const body = structuredClone({ id: input.id, version: input.version, type: input.type, classification: input.classification, core: input.core, layer: TYPE_LAYER[input.type], semanticCoreHash: hash(input.core) });
  return { ...body, revisionHash: hash(body) };
}
export function nextRevision(previous: Revision, changes: { type?: EntityType; classification?: Revision['classification']; core?: Core }): Revision {
  return makeRevision({ id: previous.id, version: previous.version + 1, type: changes.type ?? previous.type, classification: changes.classification ?? previous.classification, core: changes.core ?? previous.core });
}
export const emptyCore = (statement: string, status: Core['epistemicStatus'] = 'definition'): Core => ({ statement, epistemicStatus: status, evidenceRefs: [], sourceRefs: [], targetRefs: [], probeRefs: [], limitations: [], synthetic: true, details: {} as Record<string, Json> });

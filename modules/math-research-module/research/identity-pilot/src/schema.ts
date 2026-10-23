import { EDGE_RULES, TYPE_LAYER } from './model.ts';
export type Schema = { [key: string]: any };
const string = { type: 'string', minLength: 1 };
const bool = { type: 'boolean' };
const hash = { type: 'string', pattern: '^[a-f0-9]{64}$' };
const researchId = { type: 'string', pattern: '^mred:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' };
const slug = { type: 'string', pattern: '^[a-z][a-z0-9-]*$' };
const artifactId = { type: 'string', pattern: '^[a-z][a-z0-9-]*:(project|task|proposal|decision|evidence|verification|run):[a-z0-9][a-z0-9._:-]*$' };
const arr = (items: Schema, minItems = 0): Schema => ({ type: 'array', items, minItems });
const object = (properties: Record<string, Schema>, optional: string[] = []): Schema => ({ type: 'object', properties, required: Object.keys(properties).filter(k => !optional.includes(k)), additionalProperties: false });
const ref = object({ id: researchId, version: { type: 'integer', minimum: 1 } });
const core = object({ statement: string, epistemicStatus: { enum: ['definition', 'observed', 'reported', 'inference', 'hypothesis', 'rule', 'pending', 'recorded'] }, evidenceRefs: arr(ref), sourceRefs: arr(ref), targetRefs: arr(ref), probeRefs: arr(ref), limitations: arr(string), synthetic: bool, details: { type: 'object', additionalProperties: true } });
const revision = object({ id: researchId, version: { type: 'integer', minimum: 1 }, layer: { enum: ['DATA', 'LOGIC', 'ACTION', 'GOVERNANCE'] }, type: { enum: Object.keys(TYPE_LAYER) }, classification: object({ label: string, semanticPath: arr(string, 1) }), core, semanticCoreHash: hash, revisionHash: hash });
const harness = object({ id: artifactId, projectId: slug, kind: { enum: ['project', 'task', 'proposal', 'decision', 'evidence', 'verification', 'run'] }, sourcePath: string, sourceSha256: hash });
export const BUNDLE_SCHEMA: Schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'urn:math-research-module:identity-pilot:0.1.0',
  title: 'Math Research Identity Pilot (module-local)',
  description: 'Structural schema only. Graph, evidence, immutable revisions and reference/source authenticity require additional checks. No authority or actual user acceptance is inferred.',
  ...object({
    schemaVersion: { const: '0.1.0-pilot' }, semanticOwner: { const: 'math-research-module' }, namespace: { const: 'mred' }, registryScope: { const: 'module-local-pilot' },
    coverage: object({ fixtureCount: { type: 'integer', minimum: 0 }, realLearnersDiagnosed: { const: 0 }, full105TypesDiagnosed: { const: false } }),
    authority: object({ nativePermissionGranted: { const: false }, actualAcceptanceInferred: { const: false }, grantsExecution: { const: false } }),
    revisions: arr(revision, 1), edges: arr(object({ id: string, relation: { enum: Object.keys(EDGE_RULES) }, from: ref, to: ref })),
    presentations: arr(object({ id: string, subject: ref, semanticCoreHash: hash, renderMode: { const: 'exact-core' }, tone: { enum: ['neutral', 'teacher-warm', 'teacher-concise'] }, language: { const: 'ko' } })),
    harnessRecords: arr(harness), workContexts: arr(object({ projectId: slug, workId: { type: 'string', minLength: 1, maxLength: 256 }, sourcePath: string, sourceSha256: hash })),
    crosswalk: arr(object({ relation: { enum: ['createdBy', 'uses', 'verifiedBy', 'acceptedBy'] }, research: ref, harnessArtifactId: artifactId })),
  }),
};
/** Deliberately small structural checker for the exact schema above, not a general JSON Schema engine. */
export function structureErrors(value: unknown, schema: Schema = BUNDLE_SCHEMA, path = '$'): string[] {
  const errors: string[] = [];
  const fail = (text: string) => errors.push(`${path}: ${text}`);
  if ('const' in schema && value !== schema.const) fail(`must equal ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) fail('must be an enumerated value');
  const type = schema.type;
  const valid = !type || (type === 'array' ? Array.isArray(value) : type === 'object' ? !!value && typeof value === 'object' && !Array.isArray(value) : type === 'integer' ? Number.isInteger(value) : typeof value === type);
  if (!valid) { fail(`expected ${type}`); return errors; }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) fail('too short');
    if (schema.maxLength !== undefined && value.length > schema.maxLength) fail('too long');
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) fail('pattern mismatch');
  }
  if (typeof value === 'number' && (!Number.isFinite(value) || (schema.minimum !== undefined && value < schema.minimum))) fail('number out of range');
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) fail('too few items');
    if (schema.items) value.forEach((v, i) => errors.push(...structureErrors(v, schema.items, `${path}[${i}]`)));
  }
  if (value && typeof value === 'object' && !Array.isArray(value) && schema.type === 'object') {
    const obj = value as Record<string, unknown>;
    for (const field of schema.required ?? []) if (!(field in obj)) fail(`missing ${field}`);
    for (const [field, item] of Object.entries(obj)) {
      if (schema.properties?.[field]) errors.push(...structureErrors(item, schema.properties[field], `${path}.${field}`));
      else if (schema.additionalProperties === false) fail(`unexpected ${field}`);
    }
  }
  return errors;
}

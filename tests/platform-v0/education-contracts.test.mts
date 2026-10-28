import { describe, expect, test } from 'bun:test';
import { canonicalJson } from '../../apps/academy/dc-gang-a/src/learning/model';
import { TypedReadRefusal, fullFieldMask, projectLinkInterval, type TypedReadErrorCode } from '../../apps/academy/dc-gang-a/src/academy/nativeTypedRead';
import { validateKnowledge, validateObjectRef, validateRevision, scopeIdentity } from '../../apps/academy/dc-gang-a/src/academy/contracts/prerequisiteRecords';
import { ctx, evidence, fixture, knownK, mapFixtureViews, nativeRef, objectRef, request, testTemporal, unknownK, withTemporal } from './synthetic-read.mts';

// Tests name the original catalog IDs. Partial subcase support is explicit in README.md.
// These call product APIs against a synthetic read port, never a service or native store.
async function refusal(run: Promise<unknown>, code: TypedReadErrorCode, status: number) {
  let observed: unknown;
  try { await run; } catch (error) { observed = error; }
  expect(observed).toBeInstanceOf(TypedReadRefusal);
  const error = observed as TypedReadRefusal;
  expect({ code: error.code, status: error.httpStatus }).toEqual({ code, status });
  return { code: error.code, status: error.httpStatus, evidence: error.requiredEvidence };
}
const progress = () => objectRef('DailyProgress', 'progress-a', 'rev-progress');

describe('V0-01 governed read / source mutation / structured identity', () => {
  test('01.changed returns the changed canonical progress value and exact new revision', async () => {
    const baseline = fixture();
    const first = await baseline.service.typedRead(ctx, request({ selector: { kind: 'EXACT_OBJECT', objectRef: progress() } }));
    const a = first.items.find(i => i.kind === 'OBJECT');
    expect(a).toMatchObject({ kind: 'OBJECT', record: { revision: 'rev-progress', note: knownK('Synthetic progress') } });
    const changed = fixture();
    mapFixtureViews(changed.store, view => ({ ...view, current: async (owner, student) =>
      (await view.current(owner, student)).map(row => row.entityId !== 'progress-a' ? row : {
        ...row, revisionId: 'progress-rB', payload: { ...row.payload, note: knownK('Changed synthetic progress') } as typeof row.payload,
      }),
    }));
    const second = await changed.service.typedRead(ctx, request({ selector: { kind: 'EXACT_OBJECT', objectRef: { ...progress(), revision: 'progress-rB' } } }));
    expect(second.items.find(i => i.kind === 'OBJECT')).toMatchObject({ kind: 'OBJECT', record: { revision: 'progress-rB', note: knownK('Changed synthetic progress') } });
    expect(second.items.find(i => i.kind === 'OBJECT')).not.toEqual(a);
    expect(second.asOf).toBe('2026-10-24T00:00:00.000Z');
  });

  test('01.scope-projection keeps scope identity distinct and rejects a scalar RevisionToken', () => {
    const one = objectRef('Student', 'same-key');
    const two = structuredClone(one);
    two.identity.scopeRef.basis.scope.scopeKey = 'another-scope';
    two.identity.scopeRef.objectKey = 'another-scope';
    expect(() => validateObjectRef(one)).not.toThrow();
    expect(() => validateObjectRef(two)).not.toThrow();
    expect(canonicalJson(two.identity)).not.toBe(canonicalJson(one.identity));
    expect(JSON.parse(canonicalJson(one))).toEqual(one);
    expect(() => validateRevision({ scheme: 'OWNER_REVISION', value: 'revision-rA' })).not.toThrow();
    expect(() => validateRevision('revision-rA' as never)).toThrow();
  });

  test('01.interval-inclusive-from/through and outside-through retain inclusive query dates', () => {
    const interval = projectLinkInterval('2026-10-01', '2026-10-11', [evidence()]);
    expect(interval).toMatchObject({ validFrom: '2026-10-01', validThrough: { state: 'known', value: '2026-10-10' } });
    // Fixed expected dates are independent of the product projection algorithm.
    const through = interval.validThrough;
    if (through.state !== 'known') throw Error('expected_known_interval@tests/platform-v0/education-contracts.test.ts:58');
    expect(['2026-10-01', '2026-10-10', '2026-10-11'].map(date => date >= interval.validFrom && date <= through.value)).toEqual([true, true, false]);
  });

  test('01.interval-open-end/unknown-end preserve the scoped evidence distinction', () => {
    expect(projectLinkInterval('2026-10-01', null, [evidence()]).validThrough).toEqual({ state: 'unknown', reason: 'NOT_APPLICABLE', evidence: [evidence()], requiredEvidence: ['NATIVE_RELATION_MAPPING'] });
    expect(projectLinkInterval('2026-10-01', null, []).validThrough).toEqual({ state: 'unknown', reason: 'UNVERIFIED', evidence: [], requiredEvidence: ['NATIVE_RELATION_MAPPING'] });
  });
});

describe('V0-02 homework and prior assessment', () => {
  test('02.distinct preserves assessment identity and its exact homework reference', async () => {
    const f = fixture();
    const assessment = objectRef('PreviousHomeworkAssessment', 'assessment-a', 'rev-assessment');
    const result = await f.service.typedRead(ctx, request({ selector: { kind: 'EXACT_OBJECT', objectRef: assessment } }));
    const record = result.items.find(i => i.kind === 'OBJECT');
    expect(record).toMatchObject({ kind: 'OBJECT', record: { identity: assessment.identity, revision: assessment.revision, homeworkRef: objectRef('HomeworkAssignment', 'homework-a', 'rev-homework') } });
    expect(result.items.some(i => i.kind === 'OBJECT' && i.record.identity.objectType === 'HomeworkAssignment')).toBe(false);
    expect(result.gaps.find(g => g.path === 'links.assessmentOfHomework')).toMatchObject({ reason: 'UNVERIFIED', requiredEvidence: ['NATIVE_RELATION_MAPPING'] });
    expect(result.enumeration).toBe('UNKNOWN');
  });
});

describe('V0-03 namespace / occurrence collisions', () => {
  test('03.namespaces refuses cross-type casts and cross-namespace reads', async () => {
    const student = objectRef('Student', 'same-key');
    expect(() => validateObjectRef(student, ['Teacher'])).toThrow();
    const other = structuredClone(student); other.identity.namespace = 'different-namespace';
    expect(canonicalJson(student.identity)).not.toBe(canonicalJson(other.identity));
    const f = fixture();
    await refusal(f.service.typedRead(ctx, request({ selector: { kind: 'EXACT_OBJECT', objectRef: other } })), 'PERMISSION_DENIED', 403);
    expect(f.store.projectionCalls).toBe(0);
  });

  test('03.lessons keeps same-day occurrences in separate scope identities', () => {
    const one = { studentRef: objectRef('Student', 'sA'), classGroupRef: objectRef('ClassGroup', 'cA'), businessDate: '2026-10-24', lessonRef: objectRef('LessonSession', 'lA') };
    const two = { ...one, lessonRef: objectRef('LessonSession', 'lB') };
    expect(scopeIdentity(one)).not.toBe(scopeIdentity(two));
    expect(scopeIdentity({ ...one, studentRef: { ...one.studentRef, revision: 'student-rB' } })).toBe(scopeIdentity(one));
  });
});

describe('V0-04 explicit unknowns', () => {
  test('04.unknown preserves exact unknown evidence and refuses a malformed required field', async () => {
    const f = fixture();
    mapFixtureViews(f.store, view => ({ ...view, current: async (owner, student) => (await view.current(owner, student)).map(row => row.entityId === 'progress-a' ? { ...row, payload: { ...row.payload, note: unknownK() } as typeof row.payload } : row) }));
    const result = await f.service.typedRead(ctx, request({ selector: { kind: 'EXACT_OBJECT', objectRef: progress() } }));
    expect(result.items.find(i => i.kind === 'OBJECT')).toMatchObject({ record: { note: { state: 'unknown', reason: 'UNVERIFIED', requiredEvidence: ['SOURCE_FIELD'], evidence: [] } } });
    expect(result.enumeration).toBe('UNKNOWN');
    const malformed = fixture();
    mapFixtureViews(malformed.store, view => ({ ...view, current: async (owner, student) => (await view.current(owner, student)).map(row => {
      if (row.entityId !== 'progress-a') return row;
      const payload = { ...row.payload } as Record<string, unknown>; delete payload.note;
      return { ...row, payload } as unknown as typeof row;
    }) }));
    await refusal(malformed.service.typedRead(ctx, request({ selector: { kind: 'EXACT_OBJECT', objectRef: progress() } })), 'CONTRACT_UNVERIFIABLE', 409);
  });

  test('04.unknown known zero and conflicting evidence remain separate branches', () => {
    const zero = knownK(0), missing = unknownK<number>(), conflicting = { ...unknownK<number>(), reason: 'CONFLICTING' as const };
    for (const value of [zero, missing, conflicting]) expect(() => validateKnowledge(value, n => { if (typeof n !== 'number') throw Error('expected_number'); })).not.toThrow();
    expect(zero).toMatchObject({ state: 'known', value: 0 });
    expect(Object.hasOwn(missing, 'value')).toBe(false);
    expect(conflicting.reason).toBe('CONFLICTING');
    expect(() => validateKnowledge({ ...missing, value: 0 } as never, () => {})).toThrow();
  });
});

describe('V0-05 uniform permission denial', () => {
  test('05.object paired hidden-only changes expose neither items nor existence', async () => {
    const denials = [];
    for (const hiddenKey of ['student-a', 'not-present']) {
      const f = fixture(), ref = objectRef('Student', hiddenKey); ref.identity.namespace = 'hidden-namespace';
      denials.push(await refusal(f.service.typedRead(ctx, request({ selector: { kind: 'EXACT_OBJECT', objectRef: ref } })), 'PERMISSION_DENIED', 403));
      expect(f.store.projectionCalls).toBe(0);
      expect(f.store.commitCalls).toBe(0);
    }
    expect(denials[0]).toEqual(denials[1]);
  });
});

describe('V0-06 semantic request binding', () => {
  test('06.native-changed-date/occurrence retain distinct semantic digests', async () => {
    const original = request();
    const changedDate = withTemporal(structuredClone(original), testTemporal({ businessDate: '2026-10-23' }));
    const changedOccurrence = withTemporal(structuredClone(original), testTemporal({ occurrence: { mode: 'EXACT', lessonRef: objectRef('LessonSession', 'lesson-b') } }));
    expect(changedDate.temporalSelection.functionRequestDigest).not.toBe(original.temporalSelection.functionRequestDigest);
    expect(changedOccurrence.temporalSelection.functionRequestDigest).not.toBe(original.temporalSelection.functionRequestDigest);
    expect(changedDate.temporalSelection.functionRequestDigest).not.toBe(changedOccurrence.temporalSelection.functionRequestDigest);
  });

  test('06.revoked current teacher rights precede privileged query diagnostics', async () => {
    const outcomes = [];
    for (const registry of ['a'.repeat(64), 'b'.repeat(64)]) {
      const f = fixture(); f.store.binding = null;
      const input = request(); if (input.selector.kind !== 'REGISTERED_QUERY') throw Error('expected_query');
      input.selector.query.registrySha256 = registry;
      outcomes.push(await refusal(f.service.typedRead(ctx, input), 'PERMISSION_DENIED', 403));
      expect(f.store.projectionCalls).toBe(0);
    }
    expect(outcomes[0]).toEqual(outcomes[1]);
  });
});

describe('V0-09 defining pin drift', () => {
  test('09.tamper refuses a defining-object hash change before object projection', async () => {
    const f = fixture(), input = request();
    if (input.selector.kind !== 'REGISTERED_QUERY') throw Error('expected_query');
    input.selector.query.baseType.definitionSha256 = '0'.repeat(64);
    await refusal(f.service.typedRead(ctx, input), 'CONTRACT_UNVERIFIABLE', 409);
    expect(f.store.projectionCalls).toBe(0);
    expect(f.store.commitCalls).toBe(0);
  });
});

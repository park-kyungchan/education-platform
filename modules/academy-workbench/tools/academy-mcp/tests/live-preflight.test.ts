import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assessInjectionReadiness, type InjectionPresence } from '../src/live-preflight.ts';

const ALL_ON: InjectionPresence = {
  hasFlockLock: true,
  hasRunner: true,
  hasDocker: true,
  hasImage: true,
  hasPinnedArtifacts: true,
  hasEnvGetterKey: true,
  scopeAdmitsDate: true,
};

const ALL_OFF: InjectionPresence = {
  hasFlockLock: false,
  hasRunner: false,
  hasDocker: false,
  hasImage: false,
  hasPinnedArtifacts: false,
  hasEnvGetterKey: false,
  scopeAdmitsDate: false,
};

describe('live injection preflight (D2, synthetic flags only)', () => {
  test('full chain present reports ready with no blockers', () => {
    expect(assessInjectionReadiness(ALL_ON)).toEqual({ ready: true, missing: [] });
  });
  test('broken chain reports every missing link by name, never a secret value', () => {
    const result = assessInjectionReadiness(ALL_OFF);
    expect(result.ready).toBe(false);
    expect(result.missing).toHaveLength(7);
    for (const code of result.missing) {
      expect(code).toMatch(/^[a-z0-9_]+$/);
    }
  });
  test('out-of-admission date alone blocks injection (owner gate G1 path)', () => {
    const result = assessInjectionReadiness({ ...ALL_ON, scopeAdmitsDate: false });
    expect(result).toEqual({ ready: false, missing: ['lesson_date_out_of_admitted_scope'] });
  });
  test('mapping schema ships exactly the one live-proven binding', () => {
    const schema = JSON.parse(
      readFileSync(join(import.meta.dir, '..', 'docs', 'saved-to-native-id-mapping.schema.json'), 'utf8'),
    );
    expect(schema.status).toBe('partially_proven');
    expect(schema.bindings).toHaveLength(2);
    expect(schema.bindings[0]).toMatchObject({
      savedStudentId: 'stu_c7c07d590b374817a8169633d2b625e7',
      nativeStudentId: '1293067',
      evidence: {source: 'live DT inventory observation', observedAt: '2026-10-26T12:40:00Z'},
    });
  });
  test('admission wiring: range opens the week, absence fails closed', () => {
    const admission = {
      schemaVersion: 'academy.owner-admission/1' as const,
      decider: 'user' as const,
      decidedAt: '2026-10-26',
      sourceNamespace: 'academy.lms.dayrecord' as const,
      teacherId: '1292923',
      allowedFrom: '2026-10-23',
      allowedThrough: '2026-10-26',
      failClosedDefault: '2026-10-23' as const,
    };
    expect(assessInjectionReadiness({...ALL_ON, lessonDate: '2026-10-26', admission}).ready).toBe(true);
    expect(assessInjectionReadiness({...ALL_ON, lessonDate: '2026-10-27', admission}).missing)
      .toEqual(['lesson_date_out_of_admitted_scope']);
    expect(assessInjectionReadiness({...ALL_ON, lessonDate: '2026-10-26'}).missing)
      .toEqual(['lesson_date_out_of_admitted_scope']);
    expect(assessInjectionReadiness({...ALL_ON, lessonDate: '2026-10-23'}).ready).toBe(true);
  });
});

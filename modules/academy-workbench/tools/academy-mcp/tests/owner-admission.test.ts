import {describe, expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {admissionBlocker, isDateAdmitted, ownerAdmissionSchema} from '../src/owner-admission.ts';

const doc = JSON.parse(readFileSync(join(import.meta.dir, '..', 'docs', 'owner-admission-20261026.json'), 'utf8'));
const admission = ownerAdmissionSchema.parse(doc);

describe('owner admission record (G1)', () => {
  test('committed record opens 2026-10-23 through 2026-10-26 by user decision', () => {
    expect(doc.decider).toBe('user');
    expect(doc.failClosedDefault).toBe('2026-10-23');
    for (const date of ['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26']) {
      expect(isDateAdmitted(date, admission)).toBe(true);
    }
  });
  test('out-of-range and malformed dates are denied', () => {
    for (const date of ['2026-10-22', '2026-10-27', '2026-13-01', 'tomorrow', '']) {
      expect(isDateAdmitted(date, admission)).toBe(false);
      expect(admissionBlocker(date, admission)).toBe('lesson_date_out_of_admitted_scope');
    }
    expect(admissionBlocker('2026-10-26', admission)).toBeNull();
  });
  test('no admission record fails closed to the verified date only', () => {
    expect(isDateAdmitted('2026-10-23', null)).toBe(true);
    expect(isDateAdmitted('2026-10-26', null)).toBe(false);
  });
  test('inverted ranges are rejected', () => {
    expect(() => ownerAdmissionSchema.parse({...doc, allowedFrom: '2026-10-26', allowedThrough: '2026-10-23'}))
      .toThrow('admission_range_inverted');
  });
  test('explicit version 2 may admit unbounded dates without weakening historical records', () => {
    const open = ownerAdmissionSchema.parse({...doc, schemaVersion:'academy.owner-admission/2', allowedFrom:null, allowedThrough:null});
    for (const date of ['2026-10-21', '2026-10-26', '2026-10-28', '2040-01-01'])
      expect(isDateAdmitted(date, open)).toBe(true);
    for (const date of ['2026-02-29', '2026-13-01', 'tomorrow']) expect(isDateAdmitted(date, open)).toBe(false);
    expect(() => ownerAdmissionSchema.parse({...doc, allowedFrom:null, allowedThrough:null})).toThrow();
    const onlyThrough = ownerAdmissionSchema.parse({...open, allowedThrough:'2026-10-28'});
    expect(isDateAdmitted('2026-10-28', onlyThrough)).toBe(true);
    expect(isDateAdmitted('2026-10-29', onlyThrough)).toBe(false);
  });
});

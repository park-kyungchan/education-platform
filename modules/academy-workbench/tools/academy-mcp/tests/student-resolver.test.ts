import {describe, expect, test} from 'bun:test';
import {DailyRecordService} from '../src/dailyrecord.ts';
import {resolveStudentByName} from '../src/student-resolver.ts';
import {backend, clock, learningPolicy, safeguard} from './dailyrecord-fixture.ts';

const row = (studentKey: string, studentName: string) => ({studentKey, studentName});
const port = (rows: unknown) => ({searchByName: async () => rows});

describe('student name resolver (G2, synthetic names only)', () => {
  test('exactly one same-name row resolves to its native key', async () => {
    expect(await resolveStudentByName('Invented Student', port([row('77001', 'Invented Student')])))
      .toEqual({status: 'resolved', studentKey: '77001', displayName: 'Invented Student'});
  });
  test('surrounding whitespace is trimmed, inner text stays exact', async () => {
    expect(await resolveStudentByName('  Invented Student ', port([row('77001', 'Invented Student')])))
      .toEqual({status: 'resolved', studentKey: '77001', displayName: 'Invented Student'});
  });
  test('zero rows is not_found, never a guess', async () => {
    expect(await resolveStudentByName('Nobody Here', port([])))
      .toEqual({status: 'unavailable', reasonCode: 'student_name_not_found'});
  });
  test('two distinct keys under one name is ambiguous', async () => {
    expect(await resolveStudentByName('Same Name', port([row('77001', 'Same Name'), row('77002', 'Same Name')])))
      .toEqual({status: 'unavailable', reasonCode: 'student_name_ambiguous'});
  });
  test('foreign-name rows are a scope conflict, not a partial match', async () => {
    expect(await resolveStudentByName('Wanted Name', port([row('77001', 'Other Name')])))
      .toEqual({status: 'unavailable', reasonCode: 'student_name_scope_conflict'});
  });
  test('empty, blank, overlong and non-string names are invalid', async () => {
    for (const bad of ['', '   ', 'x'.repeat(201), null, 77001]) {
      expect(await resolveStudentByName(bad, port([row('77001', 'Invented Student')])))
        .toEqual({status: 'unavailable', reasonCode: 'student_name_invalid'});
    }
  });
  test('malformed rows and throwing ports are unqualified without retry', async () => {
    let calls = 0;
    const flaky = {searchByName: async () => {calls++; throw new Error('synthetic_source_failure');}};
    expect(await resolveStudentByName('Invented Student', flaky))
      .toEqual({status: 'unavailable', reasonCode: 'student_resolve_search_unqualified_no_automatic_retry'});
    expect(await resolveStudentByName('Invented Student', flaky))
      .toEqual({status: 'unavailable', reasonCode: 'student_resolve_search_unqualified_no_automatic_retry'});
    expect(calls).toBe(2);
    expect(await resolveStudentByName('Invented Student', port([{studentKey: 'nope'}])))
      .toEqual({status: 'unavailable', reasonCode: 'student_resolve_search_unqualified_no_automatic_retry'});
  });
  test('oversized result pages are unqualified', async () => {
    const many = Array.from({length: 201}, () => row('77001', 'Invented Student'));
    expect(await resolveStudentByName('Invented Student', port(many)))
      .toEqual({status: 'unavailable', reasonCode: 'student_resolve_search_unqualified_no_automatic_retry'});
  });
});

describe('resolver service wiring (backend-injection pattern)', () => {
  const input = {purpose: 'Invented read', currentRequestRef: 'invented-request', displayName: 'Invented Student'};
  test('no search backend reports not_configured and writes nothing', async () => {
    const service = new DailyRecordService(null, safeguard, () => clock, learningPolicy);
    expect(await service.resolveStudent(input)).toMatchObject(
      {status: 'unavailable', reasonCode: 'student_resolve_backend_not_configured', academyWrites: 0, parentSends: 0});
  });
  test('injected fake backend resolves through the service queue', async () => {
    const service = new DailyRecordService(
      {...backend(), searchStudentsByName: async () => [row('77001', 'Invented Student')]},
      safeguard, () => clock, learningPolicy);
    expect(await service.resolveStudent(input)).toMatchObject(
      {status: 'resolved', studentKey: '77001', academyWrites: 0, parentSends: 0});
  });
  test('service surfaces ambiguity from the backend without latching', async () => {
    let calls = 0;
    const service = new DailyRecordService({...backend(), searchStudentsByName: async () => {
      calls++; return [row('77001', 'Same Name'), row('77002', 'Same Name')];}},
      safeguard, () => clock, learningPolicy);
    const again = {...input, displayName: 'Same Name'};
    expect(await service.resolveStudent(again)).toMatchObject({status: 'unavailable', reasonCode: 'student_name_ambiguous'});
    expect(await service.resolveStudent(again)).toMatchObject({status: 'unavailable', reasonCode: 'student_name_ambiguous'});
    expect(calls).toBe(2);
  });
});

import {describe, expect, test} from 'bun:test';
import {fileURLToPath} from 'node:url';
import {DailyRecordService} from '../src/dailyrecord.ts';
import {NativeDailyRecordBackend} from '../src/native-dailyrecord-backend.ts';
import {backend as injectedBackend, clock, learningPolicy, safeguard} from './dailyrecord-fixture.ts';

const admission = {
  teacherId: '99001', teacherLabel: 'Invented Teacher', date: '2040-01-04',
  students: [{studentId: '77001', displayName: 'Invented Student'}],
  sourceBundleSha256: 'b'.repeat(64),
};
const credential = () => ({username: 'fictional', password: 'fictional'});
const clientBase = {
  authenticate: async () => {},
  discoverDayRecordGroups: async () => ({groups: []}),
  execute: async () => ({dayRecords: []}),
  journalState: async () => { throw Error('synthetic_no_journal'); },
  close: () => {},
};
const resolveInput = (displayName: string) =>
  ({purpose: 'Invented read', currentRequestRef: 'invented-request', displayName});

if (process.env.ACADEMY_NAME_SEARCH_CASES === 'isolated') {
  await import('./network-deny.ts');

describe('name-only search port (REA contract, synthetic names only)', () => {
  test('the wire port receives a name-only input, never a key', async () => {
    const seen: unknown[] = [];
    const port = {...clientBase, searchStudentsByName: async (input: unknown) => {
      seen.push(input);
      return [{studentKey: '77001', studentName: 'Invented Student', paperKey: '1', attemptKey: '2'}];
    }};
    const service = new DailyRecordService(
      new NativeDailyRecordBackend(port, admission, credential), safeguard, () => clock, learningPolicy);
    expect(await service.resolveStudent(resolveInput('Invented Student'))).toMatchObject(
      {status: 'resolved', studentKey: '77001', academyWrites: 0, parentSends: 0});
    expect(seen).toHaveLength(1);
    expect(seen[0]).toEqual({teacherLabel: 'Invented Teacher', studentName: 'Invented Student'});
    expect(JSON.stringify(seen[0])).not.toContain('77001');
  });

  test('zero, ambiguous and foreign-name rows are unavailable, never guesses', async () => {
    const service = (rows: unknown) => new DailyRecordService(
      new NativeDailyRecordBackend({...clientBase, searchStudentsByName: async () => rows}, admission, credential),
      safeguard, () => clock, learningPolicy);
    expect(await service([]).resolveStudent(resolveInput('Nobody Here')))
      .toMatchObject({status: 'unavailable', reasonCode: 'student_name_not_found'});
    expect(await service([{studentKey: '77001', studentName: 'Same Name'}, {studentKey: '77002', studentName: 'Same Name'}])
      .resolveStudent(resolveInput('Same Name')))
      .toMatchObject({status: 'unavailable', reasonCode: 'student_name_ambiguous'});
    expect(await service([{studentKey: '77001', studentName: 'Other Name'}]).resolveStudent(resolveInput('Wanted Name')))
      .toMatchObject({status: 'unavailable', reasonCode: 'student_name_scope_conflict'});
  });

  test('without a wire port the owner admission table resolves exact names only', async () => {
    const service = new DailyRecordService(
      new NativeDailyRecordBackend(clientBase, admission, credential), safeguard, () => clock, learningPolicy);
    expect(await service.resolveStudent(resolveInput('Invented Student')))
      .toMatchObject({status: 'resolved', studentKey: '77001', academyWrites: 0, parentSends: 0});
    expect(await service.resolveStudent(resolveInput('Nobody Here')))
      .toMatchObject({status: 'unavailable', reasonCode: 'student_name_not_found'});
  });

  test('malformed wire rows and throwing ports are unqualified per request, without latching', async () => {
    let calls = 0;
    const flaky = {...clientBase, searchStudentsByName: async () => { calls++; throw Error('synthetic_source_failure'); }};
    const service = new DailyRecordService(
      new NativeDailyRecordBackend(flaky, admission, credential), safeguard, () => clock, learningPolicy);
    for (let i = 0; i < 2; i++)
      expect(await service.resolveStudent(resolveInput('Invented Student')))
        .toMatchObject({status: 'unavailable', reasonCode: 'student_resolve_search_unqualified_no_automatic_retry'});
    expect(calls).toBe(2);
    const malformed = new DailyRecordService(new NativeDailyRecordBackend(
      {...clientBase, searchStudentsByName: async () => [{studentKey: 'nope'}]}, admission, credential),
      safeguard, () => clock, learningPolicy);
    expect(await malformed.resolveStudent(resolveInput('Invented Student')))
      .toMatchObject({status: 'unavailable', reasonCode: 'student_resolve_search_unqualified_no_automatic_retry'});
  });

  test('backend-injection parity: null backend stays not_configured with zero writes', async () => {
    const service = new DailyRecordService(injectedBackend(), safeguard, () => clock, learningPolicy);
    expect(await service.resolveStudent(resolveInput('Invented Student')))
      .toMatchObject({status: 'unavailable', reasonCode: 'student_resolve_backend_not_configured', academyWrites: 0, parentSends: 0});
  });

  test('resolved rows carry no credential material', async () => {
    const service = new DailyRecordService(
      new NativeDailyRecordBackend(clientBase, admission, credential), safeguard, () => clock, learningPolicy);
    const result = await service.resolveStudent(resolveInput('Invented Student'));
    expect(JSON.stringify(result)).not.toContain('fictional');
  });
});

} else {
  test('name-only scenarios preserve strict network denial in an isolated process', async () => {
    const child = Bun.spawn([process.execPath, 'test', '--preload='+fileURLToPath(new URL('./network-deny.ts', import.meta.url)),
      fileURLToPath(import.meta.url)], {
      env: {PATH: process.env.PATH, AGENT_PLATFORM_ROOT: process.env.AGENT_PLATFORM_ROOT,
        AGENT_PLATFORM_SOURCE_MODE: process.env.AGENT_PLATFORM_SOURCE_MODE, ACADEMY_NAME_SEARCH_CASES: 'isolated'},
      stdout: 'inherit', stderr: 'inherit',
    });
    expect(await child.exited).toBe(0);
  }, 30000);
}

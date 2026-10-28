import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isClassDay, validateRouting, validateTimetable } from '../validate.ts';
import { checkRouting } from '../check-routing.ts';
import { checkAdmission } from '../check-admission.ts';

const fictionalStudent = () => ({
  name: 'fiction-a',
  classDays: ['Wed', 'Fri'],
  session: '2부',
  courseId: null,
  provenance: { kind: 'user_confirmed', date: '2026-10-27', detail: 'fiction' },
});
const fictionalTimetable = () => ({ schema: 'academy.class-timetable/1', students: [fictionalStudent()] });

test('class days accept weekday enum and reject anything else', () => {
  assert.equal(validateTimetable(fictionalTimetable()).students.length, 1);
  for (const bad of [[], ['Funday'], ['Wed', 'Wed'], 'Wed', null]) {
    assert.throws(() =>
      validateTimetable({ schema: 'academy.class-timetable/1', students: [{ ...fictionalStudent(), classDays: bad }] }),
    );
  }
});
test('duplicate names, unknown sessions and missing provenance fail closed', () => {
  const two = fictionalTimetable();
  two.students.push(fictionalStudent());
  assert.throws(() => validateTimetable(two), /student_identity/);
  assert.throws(() =>
    validateTimetable({
      schema: 'academy.class-timetable/1',
      students: [{ ...fictionalStudent(), session: '3부' }],
    }),
  );
  assert.throws(() =>
    validateTimetable({
      schema: 'academy.class-timetable/1',
      students: [{ ...fictionalStudent(), provenance: { kind: 'guessed', date: '', detail: '' } }],
    }),
  );
  assert.throws(() => validateTimetable({ schema: 'academy.class-timetable/1', students: [{ ...fictionalStudent(), provenance: { kind: 'user_confirmed', date: '2026-02-31', detail: 'fiction' } }] }), /provenance_required/);
});
test('isClassDay matches calendar weekdays without inventing membership', () => {
  const s = fictionalStudent() as Parameters<typeof isClassDay>[0];
  const window = {from: '2026-10-27', to: '2026-10-31'};
  assert.equal(isClassDay(s, '2026-10-28', window), true);
  assert.equal(isClassDay(s, '2026-10-30', window), true);
  assert.equal(isClassDay(s, '2026-10-27', window), false);
  assert.equal(isClassDay(s, '2026-10-26', window), null);
  assert.equal(isClassDay(s, '2026-10-26', {from: '2026-10-01', to: '2026-10-31'}), null);
  assert.equal(isClassDay(s, '2026-11-01', window), null);
  assert.equal(isClassDay(s, '2026-10-28'), null);
  assert.throws(() => isClassDay(s, '2026-10-28', {from: '2026-10-31', to: '2026-10-27'}), /timetable_window_invalid/);
});
test('routing rejects missing targets instead of promising sources', () => {
  assert.throws(() =>
    validateRouting({ schema: 'academy.class-timetable-routing/1', routes: [{ question: 'q', target: 'no/such/file.ts' }] }, '/'),
  );
});
test('private admission rejects changed bytes without emitting them', async () => {
  const root = await mkdtemp(join(tmpdir(), 'class-admission-test-'));
  try {
    const path = 'modules/academy-workbench/context/class-timetable/timetable.json';
    await mkdir(join(root, 'modules/academy-workbench/context/class-timetable'), { recursive: true });
    await mkdir(join(root, 'provenance'), { recursive: true });
    const content = 'fictional bytes';
    await writeFile(join(root, path), content);
    await writeFile(join(root, 'provenance/class-timetable-admission-20261028.json'), JSON.stringify({ schema: 'education.class-timetable-private-admission.v1', repository: 'park-kyungchan/education-platform', visibility: 'private', file: path, sha256: createHash('sha256').update(content).digest('hex') }));
    await checkAdmission(root);
    await writeFile(join(root, path), 'changed fictional bytes');
    await assert.rejects(checkAdmission(root), /class_timetable_admission_hash_mismatch/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('route-only check reads routing metadata and fails when an actual target disappears', async () => {
  const root = await mkdtemp(join(tmpdir(), 'class-routing-test-'));
  try {
    const routing = join(root, 'routing.json');
    const target = join(root, 'source.ts');
    await writeFile(routing, JSON.stringify({ schema: 'academy.class-timetable-routing/1', routes: [{ question: 'fiction', target: 'source.ts' }] }));
    await writeFile(target, 'fictional source');
    const route = (target: string) => ({ schema: 'academy.class-timetable-routing/1', routes: [{ question: 'fiction', target }] });
    assert.throws(() => validateRouting(route('/etc/passwd'), root), /route_target_invalid/);
    assert.throws(() => validateRouting(route('../outside'), root), /route_target_invalid/);
    await symlink(target, join(root, 'link'));
    assert.throws(() => validateRouting(route('link'), root), /route_target_symlink/);
    // No timetable.json exists in this isolated root.
    assert.equal(await checkRouting(routing, root), 1);
    await rm(target);
    await assert.rejects(checkRouting(routing, root), /route_target_missing/);
    await writeFile(routing, '{');
    await assert.rejects(checkRouting(routing, root), SyntaxError);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test('isClassDay rejects invalid and non-canonical dates', () => {
  const s = fictionalStudent() as Parameters<typeof isClassDay>[0];
  for (const date of ['2026-02-31', '2026-02-29', '2026-13-01', '2026-00-01', '2026-1-01', '2026-10-28T00:00:00Z', '']) {
    assert.throws(() => isClassDay(s, date), /lesson_date_invalid/);
  }
  assert.equal(isClassDay(s, '2024-02-29'), null);
});
test('unconfirmed provenance remains unknown on matching and non-matching weekdays', () => {
  for (const kind of ['unknown', 'inferred'] as const) {
    const student = { ...fictionalStudent(), provenance: { kind, date: '2026-10-27', detail: 'fiction' } };
    const validated = validateTimetable({ schema: 'academy.class-timetable/1', students: [student] }).students[0]!;
    assert.equal(isClassDay(validated, '2026-10-28'), null);
    assert.equal(isClassDay(validated, '2026-10-27'), null);
    assert.throws(() => isClassDay(validated, '2026-02-31'), /lesson_date_invalid/);
  }
});

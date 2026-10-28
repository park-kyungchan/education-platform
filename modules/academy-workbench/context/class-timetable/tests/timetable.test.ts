import test from 'node:test';
import assert from 'node:assert/strict';
import { isClassDay, validateRouting, validateTimetable } from '../validate.ts';

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
});
test('isClassDay matches calendar weekdays without inventing membership', () => {
  const s = fictionalStudent() as Parameters<typeof isClassDay>[0];
  assert.equal(isClassDay(s, '2026-10-28'), true);
  assert.equal(isClassDay(s, '2026-10-30'), true);
  assert.equal(isClassDay(s, '2026-10-26'), false);
  assert.equal(isClassDay(s, '2026-10-27'), false);
});
test('routing rejects missing targets instead of promising sources', () => {
  assert.throws(() =>
    validateRouting({ schema: 'academy.class-timetable-routing/1', routes: [{ question: 'q', target: 'no/such/file.ts' }] }, '/'),
  );
});
test('isClassDay rejects invalid and non-canonical dates', () => {
  const s = fictionalStudent() as Parameters<typeof isClassDay>[0];
  for (const date of ['2026-02-31', '2026-02-29', '2026-13-01', '2026-00-01', '2026-1-01', '2026-10-28T00:00:00Z', '']) {
    assert.throws(() => isClassDay(s, date), /lesson_date_invalid/);
  }
  assert.equal(isClassDay(s, '2024-02-29'), false);
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

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

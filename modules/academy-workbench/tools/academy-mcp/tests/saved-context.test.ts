import { describe, expect, test } from 'bun:test';
import { queryInputSchema, queryResultSchema } from '../src/contracts.ts';
import { syntheticContext } from './fixtures.ts';

describe('preserved academy query semantics', () => {
  test('a complete saved roster page does not establish the whole teacher roster', () => {
    const result = syntheticContext().query({ query: { kind: 'roster' }, limit: 25 });
    expect(queryResultSchema.safeParse(result).success).toBe(true);
    expect(result.records).toHaveLength(5);
    expect(result.page.exhausted).toBe(true);
    expect(result.status).toBe('partial');
    expect(result.scope.completeTeacherRosterVerified).toBe(false);
    expect(result.scope.totalTeacherManagedStudents).toBeNull();
  });
  test('cursor continuation preserves order and exact subject scope', () => {
    const context = syntheticContext(), query = { kind: 'student_records', studentId: 'synthetic-student-1', facet: 'sections' };
    const first = context.query({ query, limit: 2 });
    const second = context.query({ query, limit: 2, cursor: first.page.nextCursor });
    expect(first.records.map(row => (row.value as { id: string }).id)).toEqual(['section-a', 'placeholder']);
    expect(second.records[0]!.source.jsonPointer).toBe('/students/0/sections/2');
    expect(second.page.exhausted).toBe(true);
    const changed = context.query({ query: { ...query, studentId: 'synthetic-student-2' }, cursor: first.page.nextCursor });
    expect(changed.code).toBe('cursor_scope_or_snapshot_conflict');
  });
  test('stale snapshot, malformed and overlong cursors fail closed', () => {
    const context = syntheticContext();
    const first = context.query({ query: { kind: 'roster' }, limit: 1 });
    const value = JSON.parse(Buffer.from(first.page.nextCursor!, 'base64url').toString());
    value.snapshot = 'c'.repeat(64);
    const stale = Buffer.from(JSON.stringify(value)).toString('base64url');
    expect(context.query({ query: { kind: 'roster' }, cursor: stale }).code).toBe('cursor_scope_or_snapshot_conflict');
    expect(context.query({ query: { kind: 'roster' }, cursor: 'broken!' }).code).toBe('cursor_scope_or_snapshot_conflict');
    expect(queryInputSchema.safeParse({ query: { kind: 'roster' }, cursor: 'a'.repeat(2049) }).success).toBe(false);
  });
  test('an unknown student is unavailable, not a demo fallback or a false membership claim', () => {
    const result = syntheticContext().query({ query: { kind: 'student_summary', studentId: 'not-preserved' } });
    expect(result.status).toBe('unavailable');
    expect(result.code).toBe('student_not_in_preserved_roster');
    expect(result.records).toEqual([]);
    expect(result.page.totalInSavedSelection).toBeNull();
    expect(result.page.exhausted).toBe(false);
  });
  test('historical records survive the reported website window and keep original scores', () => {
    const result = syntheticContext().query({ query: { kind: 'student_records', studentId: 'synthetic-student-1', facet: 'attempts' } });
    expect(result.records[0]!.value).toEqual({ id: 'old-attempt', score: 75, displayedAt: '2020-01-01 10:00', teacherReview: 'unknown' });
    expect(result.currentAcademyServerQueried).toBe(false);
    expect(result.absenceProvesNonperformance).toBe(false);
  });
  test('empty assignment evidence and empty dated lesson evidence remain unknown', () => {
    const context = syntheticContext();
    for (const query of [
      { kind: 'student_records', studentId: 'synthetic-student-1', facet: 'assignments' },
      { kind: 'lesson_context', studentId: 'synthetic-student-1', date: '2020-01-01' },
    ]) {
      const result = context.query({ query });
      expect(result.records).toEqual([]);
      expect(result.status).toBe('partial');
      expect(result.unknowns.some(text => text.includes('does not prove') || text.includes('remain unknown'))).toBe(true);
      expect(result.absenceProvesNonperformance).toBe(false);
    }
  });
  test('teacher reports, supplied context, source observations and drafts stay distinct', () => {
    const context = syntheticContext();
    const result = context.query({ query: { kind: 'lesson_context', studentId: 'synthetic-student-1', date: '2026-10-14' } });
    expect(result.records.map(row => row.classification)).toEqual(['teacher_report', 'user_supplied_context', 'source_observation_snapshot']);
    const drafts = context.query({ query: { kind: 'student_records', studentId: 'synthetic-student-1', facet: 'daily_record_drafts' } });
    expect(drafts.records[0]!.classification).toBe('unsaved_draft');
    expect((drafts.records[0]!.value as Record<string, unknown>).serverSaved).toBe(false);
  });
  test('book filtering preserves edition identity and original source pointer', () => {
    const context = syntheticContext();
    const result = context.query({ query: { kind: 'student_records', studentId: 'synthetic-student-1', facet: 'sections', bookEditionId: 'edition-b' } });
    expect(result.records).toHaveLength(1);
    expect(result.records[0]!.source.jsonPointer).toBe('/students/0/sections/2');
    expect(context.query({ query: { kind: 'student_records', studentId: 'synthetic-student-1', facet: 'sections', bookEditionId: 'guessed-edition' } }).code).toBe('book_edition_not_in_preserved_student_scope');
  });
  test('source snapshots cannot mutate under an unchanged hash', () => {
    const context = syntheticContext();
    expect(Object.isFrozen(context.inputs.audit.students[0]!.sections[0])).toBe(true);
    expect(() => { context.inputs.audit.students[0]!.sections[0]!.rowKind = 'completed'; }).toThrow();
  });
  test('network, credentials, source mutations and invalid calendar dates are not query inputs', () => {
    for (const input of [
      { sourceMode: 'live_read', query: { kind: 'roster' } },
      { query: { kind: 'roster' }, url: 'https://dc.gang-a.kr/' },
      { query: { kind: 'roster' }, cookie: 'synthetic-not-a-real-session' },
      { query: { kind: 'save_daily_record', studentId: 'synthetic-student-1' } },
      { query: { kind: 'lesson_context', studentId: 'synthetic-student-1', date: '2026-02-30' } },
      { query: { kind: 'roster' }, limit: 251 },
    ]) expect(queryInputSchema.safeParse(input).success).toBe(false);
  });
});

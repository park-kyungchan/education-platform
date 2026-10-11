import { describe, expect, test } from 'bun:test';
import { dateClassView, occurrenceIdentity, requestGate } from '../../src/academy/web/dateClassView';
import type { TeacherApplication } from '../../src/academy/application';
import {buildStudentPreparation} from '../../src/academy/preparationHistory';
import {academyConnectionStatus} from '../../src/academy/nativeConnector';
type Preparation = Awaited<ReturnType<TeacherApplication['classPreparation']>>;
const cohort = [{ id: 'fixture-a', displayName: 'Invented Learner A' }, { id: 'fixture-b', displayName: 'Invented Learner B' }];
function preparation(): Preparation {
  return { schemaVersion: 1, kind: 'date_class_preparation', date: '2090-01-02', rowCount: 3, scope: 'verified_occurrences_in_observed_calendar_window_not_all_history',
    knowledge: { missingRows: 'not_evidence_of_absence_or_nonperformance', completeCurrentRoster: 'not_established' }, connection:academyConnectionStatus,officialSaved: false, parentSent: false,
    rows: [0, 1, 2].map(index => ({ studentId: index === 1 ? 'fixture-b' : 'fixture-a', studentName: index === 1 ? 'Invented Learner B' : 'Invented Learner A',
      occurrence: { date: '2090-01-02', groupId: index === 2 ? '22001' : '21001', courseKey: '99001', recordKey: String(41001 + index), membershipKey: String(81001 + index) },
      fields: { attendance: index === 1 ? 'N' : 'Y', homework: 'Invented range', memo: index === 2 ? 'Invented makeup label' : '' },
      revisionId: 'fixture-revision-' + index, sourceObservedAt: '2090-01-02T00:00:00Z', lastVerifiedAt: '2090-01-02T00:00:01Z',
      preparation:buildStudentPreparation({namespace:'academy_student',literalKey:String(91001+index)},[],'2090-01-02'),
      knowledge: { prestudyHomeworkJoin: 'unknown', homeworkAttemptJoin: 'unknown', correctionInspection: 'unknown', teacherReview: 'unknown' } })) };
}
describe('date-first occurrence presentation', () => {
  test('retains all occurrences including literal N attendance and a second group for the same student', () => {
    const source = preparation(), view = dateClassView(source, '2090-01-02', cohort);
    expect(view.occurrenceCount).toBe(3);
    expect(view.studentCount).toBe(2);
    expect(view.rows.map(row => row.occurrence.recordKey)).toEqual(['41001', '41002', '41003']);
    expect(view.rows[1].fields.attendance).toBe('N');
    expect(view.completeRoster).toBe('not_established');
    expect(view.rows[2].knowledge.correctionInspection).toBe('unknown');
    expect(source).toEqual(preparation());
  });
  test('refuses a response for another date, wrong totals or a student outside the authenticated cohort', () => {
    const source = preparation();
    expect(() => dateClassView(source, '2090-01-03', cohort)).toThrow('date_scene_scope_conflict');
    expect(() => dateClassView({ ...source, rowCount: 2 }, source.date, cohort)).toThrow('date_scene_count_conflict');
    expect(() => dateClassView(source, source.date, cohort.slice(0, 1))).toThrow('date_scene_student_conflict');
    expect(() => dateClassView({ ...source, rows: [source.rows[0], source.rows[1], source.rows[0]] }, source.date, cohort)).toThrow('duplicate_lesson_occurrence');
  });
  test('keeps an empty observed date unknown rather than claiming no students or absence', () => {
    const source = { ...preparation(), rows: [], rowCount: 0 };
    expect(dateClassView(source, source.date, cohort)).toMatchObject({ occurrenceCount: 0, studentCount: 0, completeRoster: 'not_established' });
  });
  test('refuses source fields or occurrence identities that no longer match the selected date', () => {
    const source = preparation();
    const row = { ...source.rows[0], occurrence: { ...source.rows[0].occurrence, date: '2090-01-03' } };
    expect(() => dateClassView({ ...source, rows: [row], rowCount: 1 }, source.date, cohort)).toThrow('date_scene_scope_conflict');
  });
  test('allows only the latest pending selection to render after out-of-order responses', () => {
    const gate = requestGate(), earlier = gate.begin(), latest = gate.begin();
    expect(gate.current(earlier)).toBe(false);
    expect(gate.current(latest)).toBe(true);
  });
  test('rejects an unknown ID with missing display name instead of matching two undefined values',()=>{
    const source=preparation(),row={...source.rows[0],studentId:'foreign',studentName:undefined};
    expect(()=>dateClassView({...source,rows:[row],rowCount:1} as unknown as Preparation,source.date,cohort)).toThrow('date_scene_student_conflict');
  });
  test('uses the full occurrence tuple even when record and membership labels repeat',()=>{
    const row=preparation().rows[0];
    expect(occurrenceIdentity(row)).not.toBe(occurrenceIdentity({...row,occurrence:{...row.occurrence,groupId:'22001'}}));
    expect(occurrenceIdentity(row)).not.toBe(occurrenceIdentity({...row,occurrence:{...row.occurrence,courseKey:'99002'}}));
  });
});

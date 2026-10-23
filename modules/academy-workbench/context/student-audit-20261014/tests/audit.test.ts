import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeBook, classifyReadBlocker, sameScope, summarizeStage, summarizeVideos, type Scope, type StageProjection } from '../audit.ts';
const scope: Scope = { studentId: 'fiction-a', bookCode: 'fiction-book', edition: 1, unitLabel: '1-1', sectionLabel: 'required', attemptId: 'fiction-attempt', targetKind: 'attempt', reviewRoute: 'original_error' };
const e = <T>(value: T) => ({ scope: { ...scope }, value, sourceRef: 'synthetic-evidence', observedAt: null, occurredAt: null });
const input = (): StageProjection => ({ scope: { ...scope }, source: { score: null, clinic: null }, teacher: [], printed: null, distributed: null, answered: null, sourceCoverage: 'bounded' });
test('teacher completion survives a source unstudied string', () => {
  const x = input(); x.teacher = [e('confirmed_complete')]; x.source.clinic = e({ rawText: '미학습', routeState: 'unstudied' });
  assert.equal(summarizeStage(x).teacher, 'confirmed_complete'); assert.equal(summarizeStage(x).lmsDiscrepancy, 'teacher_complete_source_unstudied');
});
test('100 points do not prove teacher review or paper completion', () => {
  const x = input(); x.source.score = e(100); const p = summarizeStage(x);
  assert.equal(p.teacher, 'not_checked'); assert.equal(p.completeness, 'not_determined'); assert.equal(p.printed, null);
});
test('printing is neither distribution nor answers nor teacher completion', () => {
  const x = input(); x.printed = e(true); const p = summarizeStage(x);
  assert.equal(p.distributed, null); assert.equal(p.answered, null); assert.equal(p.teacher, 'not_checked');
});
test('grading is not corrected work', () => { const x = input(); x.source.score = e(72); x.teacher = [e('confirmed_incomplete')]; assert.equal(summarizeStage(x).teacher, 'confirmed_incomplete'); });
for (const key of ['studentId', 'bookCode', 'edition', 'unitLabel', 'sectionLabel', 'attemptId', 'reviewRoute', 'targetKind'] as const) {
  test(`rejects mismatched ${key}`, () => { const x = input(); x.source.score = e(80); (x.source.score.scope as any)[key] = key === 'edition' ? 2 : 'different'; assert.throws(() => summarizeStage(x), /cross_scope/); });
}
test('unknown original attempt must not join a known attempt', () => { assert.equal(sameScope(scope, { ...scope, attemptId: null }), false); });
test('conflicting teacher assertions are not last-write-wins', () => { const x = input(); x.teacher = [e('confirmed_complete'), e('confirmed_incomplete')]; assert.equal(summarizeStage(x).teacher, 'conflicting'); });
test('unspecified teacher check cannot erase completion', () => { const x = input(); x.teacher = [e('confirmed_complete'), e('not_checked')]; assert.equal(summarizeStage(x).teacher, 'confirmed_complete'); });
test('empty exhaustive source never proves paper nonperformance', () => { const x = input(); x.sourceCoverage = 'exhausted'; assert.equal(summarizeStage(x).paperNonperformanceProven, false); });
test('invalid numeric scores fail', () => { for (const n of [NaN, Infinity, -1, 101]) { const x = input(); x.source.score = e(n); assert.throws(() => summarizeStage(x), /invalid_score/); } });
test('evidence requires a source', () => { const x = input(); x.printed = { ...e(true), sourceRef: '' }; assert.throws(() => summarizeStage(x), /source_reference/); });
test('video waiting is not inspected', () => { const r = summarizeVideos([{ state: 'waiting', sourceRef: 'synthetic', uploadedAt: '2026-10-14T14:11:00+09:00', observedAt: '2026-10-14T16:37:00+09:00' }], false); assert.equal(r.reviewedObservations, 0); assert.equal(r.waitingObservations, 1); assert.equal(r.allAssignedVideosReviewed, null); });
test('zero visible pending rows does not mean all reviewed', () => { assert.equal(summarizeVideos([], true).allAssignedVideosReviewed, null); });
test('upload time and observation clock remain independent', () => { assert.equal(summarizeVideos([{ state: 'reviewed', sourceRef: 'synthetic', uploadedAt: '2026-10-01T10:00:00Z', observedAt: null }], null).latestObservation, null); });
test('visible extension overlay alone is not a read blocker', () => { assert.equal(classifyReadBlocker({ overlayVisible: true, normalNameEnter: 'not_tried', officialResultsMenu: 'not_tried', launcherRequired: true }).assessmentRead, 'not_fully_tested'); });
test('normal Enter success establishes scoped read despite launcher warning', () => { const x = classifyReadBlocker({ overlayVisible: true, normalNameEnter: 'succeeded', officialResultsMenu: 'not_tried', launcherRequired: true }); assert.equal(x.assessmentRead, 'available'); assert.equal(x.printLauncher, 'separate_launcher_requirement'); });
test('book transition retains past book and never closes its clinics', () => { const t = { studentId: 'fiction', previous: '5-2-2', current: '5-1-2', effectiveDate: '2026-10-07', sourceRef: 'synthetic' }; assert.equal(activeBook(t, '2026-10-06').active, '5-2-2'); assert.deepEqual(activeBook(t, '2026-10-07'), { active: '5-1-2', historicalBookPreserved: '5-2-2', previousClinicCompletion: 'not_determined' }); });

test('two unidentified attempts cannot join', () => { assert.equal(sameScope({ ...scope, attemptId: null }, { ...scope, attemptId: null }), false); });
test('explicit section-level teacher evidence stays separate from attempts', () => { const section = { ...scope, targetKind: 'section' as const, attemptId: null }; assert.equal(sameScope(section, section), true); assert.equal(sameScope(scope, section), false); });
test('original-error and similar-clinic outcomes are separate stages', () => { const x = input(); x.teacher = [e('confirmed_complete')]; const y = input(); y.scope.reviewRoute = 'similar_clinic'; y.teacher = [{ ...e('confirmed_incomplete'), scope: y.scope }]; assert.equal(summarizeStage(x).teacher, 'confirmed_complete'); assert.equal(summarizeStage(y).teacher, 'confirmed_incomplete'); });
test('mixed timezone clocks compare instants not strings', () => { const rows = ['2026-10-14T16:00:00+09:00', '2026-10-14T08:00:00Z'].map(observedAt => ({ state: 'waiting' as const, sourceRef: 'synthetic', uploadedAt: null, observedAt })); assert.equal(summarizeVideos(rows, false).latestObservation, '2026-10-14T08:00:00Z'); });
test('repeated video snapshots count observations, never distinct videos', () => { const row = { state: 'waiting' as const, sourceRef: 'synthetic', uploadedAt: null, observedAt: null }; assert.equal(summarizeVideos([row, row], false).waitingObservations, 2); assert.equal(summarizeVideos([row, row], false).distinctVideoCount, null); });

test('unknown book or edition is representable but cannot be auto-joined', () => { for (const unknown of [{...scope, bookCode:null},{...scope, edition:null}]) assert.equal(sameScope(unknown,unknown),false); });

test('unmapped mixed clinic columns cannot establish route-specific discrepancy', () => { const x = input(); x.teacher = [e('confirmed_complete')]; x.source.clinic=e({rawText:'학습 미학습',routeState:'unmapped'}); assert.equal(summarizeStage(x).lmsDiscrepancy,'not_established'); });

test('empty identity, invalid edition and hybrid section-attempt scope do not join', () => { for(const x of [{...scope,studentId:''},{...scope,bookCode:''},{...scope,edition:0},{...scope,edition:1.5},{...scope,targetKind:'section' as const}]) assert.equal(sameScope(x,x),false); });

/** Domain-only offline evidence projections. No network, mutation or shared harness replacement. */
export type ObservationState = 'observed' | 'not_observed_in_scope' | 'not_checked' | 'mapping_unknown';
export type TeacherState = 'confirmed_complete' | 'confirmed_incomplete' | 'not_checked' | 'conflicting';
export interface Scope { studentId: string; bookCode: string | null; edition: number | null; unitLabel: string; sectionLabel: string; attemptId: string | null; targetKind: 'attempt' | 'section'; reviewRoute: 'original_error' | 'similar_clinic' | 'daily_test' | 'prestudy'; }
export interface Evidence<T> { scope: Scope; value: T; sourceRef: string; observedAt: string | null; occurredAt: string | null; }
export interface StageProjection {
  scope: Scope;
  source: { score: Evidence<number> | null; clinic: Evidence<{ rawText: string; routeState: 'studied' | 'unstudied' | 'unmapped' }> | null; };
  teacher: Evidence<TeacherState>[];
  printed: Evidence<boolean> | null;
  distributed: Evidence<boolean> | null;
  answered: Evidence<boolean> | null;
  sourceCoverage: 'bounded' | 'exhausted' | 'unknown';
}
export function sameScope(a: Scope, b: Scope): boolean {
  if (a.bookCode === null || b.bookCode === null || a.edition === null || b.edition === null) return false;
  for (const x of [a,b]) if (![x.studentId,x.bookCode,x.unitLabel,x.sectionLabel].every(v=>typeof v==='string' && v.trim()) || !Number.isInteger(x.edition) || x.edition! < 1 || (x.targetKind === 'section' && x.attemptId !== null)) return false;
  if (a.targetKind === 'attempt' && (!a.attemptId || !b.attemptId)) return false;
  return (['studentId', 'bookCode', 'edition', 'unitLabel', 'sectionLabel', 'attemptId', 'targetKind', 'reviewRoute'] as const).every(k => a[k] === b[k]);
}
export function summarizeStage(input: StageProjection) {
  const evidence = [input.source.score, input.source.clinic, input.printed, input.distributed, input.answered, ...input.teacher].filter(x => x !== null);
  for (const e of evidence) {
    if (!sameScope(input.scope, e.scope)) throw Error('cross_scope_evidence');
    if (!e.sourceRef.trim()) throw Error('source_reference_required');
  }
  if (input.source.score && (!Number.isFinite(input.source.score.value) || input.source.score.value < 0 || input.source.score.value > 100)) throw Error('invalid_score');
  const values = new Set(input.teacher.map(x => x.value).filter(x => x !== 'not_checked'));
  const teacher: TeacherState = values.size > 1 || values.has('conflicting') ? 'conflicting' : [...values][0] ?? 'not_checked';
  return {
    teacher,
    sourceClinicText: input.source.clinic?.value.rawText ?? null,
    numericScore: input.source.score?.value ?? null,
    printed: input.printed?.value ?? null,
    distributed: input.distributed?.value ?? null,
    answered: input.answered?.value ?? null,
    // Even exhaustive reads cannot prove unrecorded physical work did not occur.
    paperNonperformanceProven: false as const,
    lmsDiscrepancy: teacher === 'confirmed_complete' && input.source.clinic?.value.routeState === 'unstudied' ? 'teacher_complete_source_unstudied' : 'not_established',
    completeness: 'not_determined' as const,
  };
}
/** Counts observations, not unique assignments/videos: snapshots may repeat the same upload. */
export interface VideoObservation { state: 'reviewed' | 'waiting' | 'unknown'; observedAt: string | null; uploadedAt: string | null; sourceRef: string; }
export function summarizeVideos(rows: VideoObservation[], sourceExhausted: boolean | null) {
  const clocks = rows.flatMap(r => {
    if (r.observedAt === null) return [];
    if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(r.observedAt) || !Number.isFinite(Date.parse(r.observedAt))) throw Error('invalid_observation_clock');
    return [r.observedAt];
  });
  return { reviewedObservations: rows.filter(r => r.state === 'reviewed').length, waitingObservations: rows.filter(r => r.state === 'waiting').length,
    unknownObservations: rows.filter(r => r.state === 'unknown').length, sourceExhausted,
    distinctVideoCount: null, allAssignedVideosReviewed: null,
    latestObservation: clocks.sort((a, b) => Date.parse(a) - Date.parse(b)).at(-1) ?? null };
}
export function classifyReadBlocker(input: { overlayVisible: boolean; normalNameEnter: 'not_tried' | 'succeeded' | 'failed'; officialResultsMenu: 'not_tried' | 'succeeded' | 'failed'; launcherRequired: boolean; }) {
  return { assessmentRead: input.normalNameEnter === 'succeeded' || input.officialResultsMenu === 'succeeded' ? 'available' : input.normalNameEnter === 'failed' && input.officialResultsMenu === 'failed' ? 'blocked_in_tested_routes' : 'not_fully_tested',
    printLauncher: input.launcherRequired ? 'separate_launcher_requirement' : 'not_established', overlayVisible: input.overlayVisible };
}
export interface BookTransition { studentId: string; previous: string; current: string; effectiveDate: string; sourceRef: string; }
export function activeBook(transition: BookTransition, date: string) {
  if (transition.previous === transition.current || !transition.sourceRef || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{4}-\d{2}-\d{2}$/.test(transition.effectiveDate)) throw Error('invalid_transition');
  return { active: date < transition.effectiveDate ? transition.previous : transition.current, historicalBookPreserved: transition.previous, previousClinicCompletion: 'not_determined' };
}

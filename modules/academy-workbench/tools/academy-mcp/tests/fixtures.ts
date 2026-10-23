import type { Audit } from '../../../app/student-audit-viewer/model.ts';
import type { LessonOverlay } from '../../../app/student-audit-viewer/lesson.ts';
import { SavedContext } from '../src/saved-context.ts';

export function syntheticInputs() {
  const audit: Audit = {
    schemaVersion: 'academy.audit.normalized/1.0.0', collectedAt: '2026-10-14T08:00:00Z',
    students: Array.from({ length: 5 }, (_, index) => ({
      studentId: `synthetic-student-${index + 1}`, name: `Synthetic Student ${index + 1}`,
      books: [{ sourceBookEditionId: 'edition-a', displayName: 'Synthetic Book A' }, { sourceBookEditionId: 'edition-b', displayName: 'Synthetic Book B' }],
      sections: [{ id: 'section-a', bookEditionId: 'edition-a', rowKind: 'section' }, { id: 'placeholder', bookEditionId: 'edition-a', rowKind: 'placeholder' }, { id: 'section-b', bookEditionId: 'edition-b', rowKind: 'section' }],
      attempts: [{ id: 'old-attempt', score: 75, displayedAt: '2020-01-01 10:00', teacherReview: 'unknown' }],
      prepVideosHistorical: [{ id: 'video-observation-1', sourceVideo: 'same-video' }, { id: 'video-observation-2', sourceVideo: 'same-video' }],
      effectiveAssignments: [], DTZT: { historyEvidence: 'preserved-only', completeLmsAnswerEntryAudit: false },
      liveDailyRecords: [{ date: '2020-01-01', progress: '', homework: '', observedAt: '2020-01-01T10:00:00Z', emptyInterpretation: 'not_nonperformance' }],
    })),
  };
  const lesson: LessonOverlay = {
    schemaVersion: 'academy.lesson-overlay/1', lessonDate: '2026-10-14', preparedAt: '2026-10-14T13:05:00Z',
    students: [{
      studentId: 'synthetic-student-1',
      teacherEvents: [
        { id: 'teacher-event', studentId: 'synthetic-student-1', sourceKind: 'teacher_report', recordedAt: '2026-10-14T12:00:00Z', facts: [{ kind: 'scoped_judgment', state: 'teacher_reported_only' }] },
        { id: 'context-event', studentId: 'synthetic-student-1', sourceKind: 'user_supplied_message_context', recordedAt: '2026-10-14T12:01:00Z', facts: [{ kind: 'parent_reported_observation' }] },
      ],
      observations: [{ kind: 'dailyRecord', observedAt: '2026-10-14T11:00:00Z', progress: '', homework: '' }],
      dailyRecordDraft: { status: 'local_draft_only_not_saved', serverSaved: false, parentSent: false },
    }],
  };
  return { audit, lesson, auditHash: 'a'.repeat(64), lessonHash: 'b'.repeat(64) };
}
export const syntheticContext = () => new SavedContext(syntheticInputs());

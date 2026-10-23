import { digest, instant } from '../../architecture/logical-model-v2.ts';
import type { AssessmentIdentity, ServerClinicObservation, TeacherClinicJudgment } from './context.types.ts';

function exactIdentity(identity: AssessmentIdentity) {
  if (!identity.originalTestId.trim() || !identity.unitId.trim()) throw Error('exact-assessment-identity-required');
  instant(identity.attemptedAt);
  return digest(identity);
}
/** Pure context projection: keeps both ledgers; never writes the source server or retracts a teacher decision. */
export function projectClinicJudgment(judgment: TeacherClinicJudgment, source: ServerClinicObservation) {
  if (exactIdentity(judgment.identity) !== exactIdentity(source.identity) || judgment.path !== source.path) throw Error('assessment-or-path-mismatch');
  if (!judgment.evidenceRef.trim()) throw Error('teacher-evidence-required');
  instant(source.capturedAt);
  return { teacher: structuredClone(judgment), server: structuredClone(source),
    effectiveTeacherOutcome: judgment.outcome, conflict: source.rawStatus === '미학습', execution: 'none' as const };
}

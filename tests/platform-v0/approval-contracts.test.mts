import { describe, expect, test } from 'bun:test';
import { assertApprovalUsable } from '../../apps/academy/dc-gang-a/src/academy/nativePrerequisiteStore';
import { assertProposalTexts, nativeProposalTexts, type ProposalSources } from '../../apps/academy/dc-gang-a/src/academy/nativeCompleteness';
import type { Knowledge } from '../../apps/academy/dc-gang-a/src/academy/contracts/prerequisiteRecords';
import { approval, closure, draft, hash, instant, nativeRef, objectRef, unknown } from './synthetic-approval.mts';

// DTO gate checks are only a subset of the V0 Action/Function cases. No dispatcher,
// Function Result, approval issuer, native receipt or simulated commit is emulated.
const at = '2026-10-24T00:01:00.000Z';
const native = (ref: ReturnType<typeof objectRef>) => nativeRef(ref.identity.nativeKey);
function proposal() {
  const sources: ProposalSources = {
    progress: [{ ref: objectRef('DailyProgress', 'pA'), payload: { note: 'Synthetic progress' } }],
    homework: [{ ref: objectRef('HomeworkAssignment', 'hCurrent'), payload: { task: 'Synthetic current homework' } }],
    attempts: [{ ref: objectRef('DailyTestAttempt', 'a1'), payload: { score: { state: 'known', value: 0 } } }],
    previousAssessments: [{ ref: objectRef('PreviousHomeworkAssessment', 'aPrior'), payload: { homeworkRef: objectRef('HomeworkAssignment', 'hPrior') } }],
  };
  const text = nativeProposalTexts(sources), p = draft();
  const evidence = (rows: ProposalSources['progress']) => rows.map(row => ({ sourceRef: native(row.ref), sourceRevision: row.ref.revision, locator: 'synthetic-only', observedAt: instant }));
  p.progressText = { state: 'known', value: text.progressText, evidence: evidence(sources.progress) };
  p.homeworkText = { state: 'known', value: text.homeworkText, evidence: evidence([...sources.homework, ...sources.previousAssessments]) };
  p.noteText = { state: 'known', value: text.noteText, evidence: evidence(sources.attempts) };
  return { p, sources };
}

describe('V0-07 evidence consistency before an approved transition', () => {
  test('07.mismatch known contradictory text refuses source consistency', () => {
    const { p, sources } = proposal();
    expect(() => assertProposalTexts(p, sources, native)).not.toThrow();
    p.progressText = { ...(p.progressText as Knowledge<string> & { state: 'known' }), value: 'Contradictory synthetic claim' };
    expect(() => assertProposalTexts(p, sources, native)).toThrow('completeness_unverified_prose:TEXT_EVIDENCE');
  });

  test('07.unknown unavailable evidence stays distinct from a known text contradiction', () => {
    const { p, sources } = proposal();
    p.progressText = unknown();
    expect(() => assertProposalTexts(p, sources, native)).toThrow('completeness_unknown:TEXT_EVIDENCE');
    expect(p.progressText).toEqual({ state: 'unknown', reason: 'UNVERIFIED', evidence: [], requiredEvidence: ['SOURCE_FIELD'] });
  });

  test('07.mismatch source revision drift and extra citations refuse the original text', () => {
    const { p, sources } = proposal();
    sources.progress[0]!.ref.revision = 'progress-rB';
    expect(() => assertProposalTexts(p, sources, native)).toThrow('completeness_unverified_prose:TEXT_EVIDENCE');
    const extra = proposal();
    if (extra.p.progressText.state !== 'known') throw Error('expected_known_text@tests/platform-v0/approval-contracts.test.mts:46');
    extra.p.progressText.evidence.push({ sourceRef: nativeRef('unlisted'), sourceRevision: 'unlisted-r1', locator: 'synthetic-only', observedAt: instant });
    expect(() => assertProposalTexts(extra.p, extra.sources, native)).toThrow('completeness_source_conflict:TEXT_EVIDENCE');
  });
});

describe('V0-08 exact approval DTO binding', () => {
  test('08.teacher/target/action/principal each require the original exact closure', () => {
    expect(() => assertApprovalUsable(approval(), closure(), at, hash)).not.toThrow();
    const changes = [
      { teacherRef: nativeRef('other-teacher') },
      { targets: [{ ...closure().targets[0]!, ref: nativeRef('other-target') }] },
      { scopeBinding: 'b'.repeat(64) },
      { occurrenceId: 'other-occurrence' },
      { action: { ...closure().action, version: '2.0.0' } },
      { executorPrincipalBinding: 'b'.repeat(64) },
      { admissionId: 'other-admission' },
    ];
    for (const change of changes) {
      const original = approval();
      expect(() => assertApprovalUsable(original, { ...closure(), ...change }, at, hash)).toThrow('approval_closure_mismatch');
    }
  });
});

describe('V0-11 expiry / semantic digest / revocation / CAS DTO gates', () => {
  test('11.expiry exact 900-second upper bound is exclusive', () => {
    expect(() => assertApprovalUsable(approval(), closure(), '2026-10-24T00:14:59.999Z', hash)).not.toThrow();
    for (const time of ['2026-10-24T00:15:00.000Z', '2026-10-24T00:30:00.000Z'])
      expect(() => assertApprovalUsable(approval(), closure(), time, hash)).toThrow('approval_expired');
    expect(() => assertApprovalUsable(approval(), closure(), '2026-10-23T23:59:59.999Z', hash)).toThrow('approval_expired');
    expect(() => assertApprovalUsable({ ...approval(), expiresAt: '2026-10-24T00:15:00.001Z' }, closure(), at, hash)).toThrow('approval_validity');
  });

  test('11.digest text/source semantic digest drift requires a new exact approval', () => {
    for (const change of [{ changeDigest: 'b'.repeat(64) }, { requestIntentDigest: 'b'.repeat(64) }])
      expect(() => assertApprovalUsable(approval(), { ...closure(), ...change }, at, hash)).toThrow('approval_closure_mismatch');
  });

  test('11.revoke revoked approval refuses at the exact DTO gate', () => {
    const revoked = { ...approval(), state: 'REVOKED' as const };
    expect(() => assertApprovalUsable(revoked, closure(), at, hash)).toThrow('approval_revoked');
  });

  test('11.cas target and link revisions cannot be silently rebased', () => {
    const changedTarget = { ...closure(), targets: [{ ...closure().targets[0]!, expected: { scheme: 'OWNER_REVISION' as const, value: 'draft-rB' } }] };
    const changedLink = { ...closure(), linkExpectations: [{ ...closure().linkExpectations[0]!, expected: { scheme: 'OWNER_REVISION' as const, value: 'link-rB' } }] };
    for (const changed of [changedTarget, changedLink])
      expect(() => assertApprovalUsable(approval(), changed, at, hash)).toThrow('approval_closure_mismatch');
  });
});

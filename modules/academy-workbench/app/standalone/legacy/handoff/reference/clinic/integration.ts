/** Offline composition only. No HTTP client, handler evaluator, session, deployment or MCP. */
import { createHash } from 'node:crypto';
import { resolveObservedHeader, type CandidateSelection, type HeaderCandidate, type DiscoveryEvidence, type DiscoverySummary } from './live-coverage.ts';
import type { AssessmentKey, SourceRef } from './adapter-contract.ts';
import { businessContextAssertions, resolveBusinessRoute, type ReconstructedContext } from '../../architecture/context-adapter-v2.ts';
import { clinicPolicy, currentWrongSubset, digest, instant, resolveUserContext, type Evidence, type OriginalTest, type TestingSnapshot, type TestingKey, type AssessmentJoinProof } from '../../architecture/logical-model-v2.ts';

export type SavedFixture = {
  observedAt: string;
  judgment: { url: string; icons?: string[]; rows: Array<{
    pNo: string; testingNo: string; priNo: number | string; studentName: string; score?: number;
    examResultList: Array<{ _examNo: number; ox: string; __ox?: string; examScore?: number; examScoreMax?: number }>;
  }> };
  answer: { url: string; header: string; items: Array<{ ordinal: number; label: string; answerText?: string }> };
};
export type Snapshot = {
  id: string; evidenceKind: 'saved_actual_dom' | 'synthetic_fixture'; sourceDigest: string;
  /** An observed alias has its own evidence. Never auto-strip/normalize the student suffix. */
  observedHeaderAliases: Array<{ header: string; evidenceId: string; sourceDigest: string; observedAt: string }>;
  expectedAssessment: AssessmentKey; fixture: SavedFixture;
};
export type OfflineScope = {
  mode: 'offline_fixture_replay'; allowedStudentKeys: string[];
  authority: 'caller_supplied_local_test_scope_not_lms_permission';
};
export type ClinicReadRequest = {
  operation: 'read_current_wrong_subset' | 'read_historical_print';
  evidenceMode: 'saved_snapshot';
  student: { sourceKey?: string; exactName?: string };
  printHeader: string;
  /** Optional exact identifiers disambiguate; they never override a conflicting header. */
  assessment?: { originalPaperId: string; testingNo: string };
  includeAnswers?: boolean;
  candidateSelection?: CandidateSelection;
};
export type Provenance = Omit<SourceRef, 'kind'> & {
  kind: 'saved_actual_dom' | 'synthetic_fixture';
  observationTimeScope: 'combined_saved_fixture_per_page_times_unavailable';
};
export type UnknownFact = { code: string; consequence: string; blocking: boolean };
export type EffectiveContext = {
  routeId: 'resolve_clinic_header'; sourceDigest: string; observedAt: string;
  timeMeaning: 'context_snapshot_generatedAt_not_individual_fact_authoredAt';
  purposes: Array<{ id: string; statement: string; sourceId: string }>;
  decisions: Array<{ id: string; statement: string; sourceId: string }>;
  supersededExcludedIds: string[]; unverifiedDecisionIds: string[]; unresolvedRefs: string[];
  actionAuthorization: 'none_from_context';
};
export type ClinicReadSuccess = {
  ok: true; execution: 'offline_fixture_replay'; evidenceKind: Snapshot['evidenceKind'];
  context: EffectiveContext; observedAt: string; projectedAt: string;
  assessment: AssessmentKey; headerExact: string;
  join: { basis: 'verified_shared_assessment_ordinals'; originalItemCount: number; originalOrderDigest: string; membershipVersion: string; judgmentRevision: string; revisionMeaning: 'local_content_hash_not_server_revision' };
  wrongItems: Array<{ ordinal: number; label: string; answerText?: string }>;
  clinic: { recommendation: 'required' | 'not_required_default' | 'unknown'; teacherReview: 'pending'; learningCompletion: 'unknown'; scope: 'this_assessment_only'; action: 'none' };
  provenance: Provenance[]; unknowns: UnknownFact[]; discovery?: DiscoverySummary;
};
export type ClinicReadFailure = {
  ok: false; execution: 'offline_fixture_replay'; code: string; projectedAt: string;
  context?: EffectiveContext; candidates?: HeaderCandidate[]; discovery?: DiscoverySummary; unknowns: UnknownFact[]; action: 'none';
};
export type ClinicReadResult = ClinicReadSuccess | ClinicReadFailure;

class ContractError extends Error { readonly code: string; constructor(code: string) { super(code); this.code = code; } }
function fail(code: string): never { throw new ContractError(code); }
function check(condition: unknown, code: string): asserts condition { if (!condition) fail(code); }
function nonempty(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0; }
function same(a: unknown, b: unknown): boolean { return digest(a) === digest(b); }
function plain(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function onlyKeys(value: Record<string, unknown>, keys: string[]): void { check(Object.keys(value).every(k => keys.includes(k)), 'UNSUPPORTED_REQUEST_FIELD'); }
function parseRequest(input: unknown): ClinicReadRequest {
  check(plain(input), 'MALFORMED_REQUEST');
  onlyKeys(input, ['operation', 'evidenceMode', 'student', 'printHeader', 'assessment', 'includeAnswers', 'candidateSelection']);
  check(['read_current_wrong_subset', 'read_historical_print'].includes(String(input.operation)), 'OPERATION_NOT_SUPPORTED');
  check(input.evidenceMode === 'saved_snapshot', 'LIVE_READ_NOT_IMPLEMENTED');
  check(nonempty(input.printHeader), 'HEADER_REQUIRED');
  check(plain(input.student), 'STUDENT_REQUIRED');
  onlyKeys(input.student, ['sourceKey', 'exactName']);
  check(nonempty(input.student.sourceKey) || nonempty(input.student.exactName), 'STUDENT_REQUIRED');
  for (const v of Object.values(input.student)) check(nonempty(v), 'MALFORMED_STUDENT');
  if (input.assessment !== undefined) {
    check(plain(input.assessment), 'MALFORMED_ASSESSMENT');
    onlyKeys(input.assessment, ['originalPaperId', 'testingNo']);
    check(nonempty(input.assessment.originalPaperId) && nonempty(input.assessment.testingNo), 'MALFORMED_ASSESSMENT');
  }
  if (input.candidateSelection !== undefined) {
    check(plain(input.candidateSelection), 'MALFORMED_CANDIDATE_SELECTION');
    onlyKeys(input.candidateSelection, ['fullTestingName', 'section', 'observedIds']);
    check(nonempty(input.candidateSelection.fullTestingName) && nonempty(input.candidateSelection.section) && plain(input.candidateSelection.observedIds), 'MALFORMED_CANDIDATE_SELECTION');
    onlyKeys(input.candidateSelection.observedIds, ['assNo', 'pNo', 'testingNo', 'priNo']);
    const observedIds = input.candidateSelection.observedIds;
    check(['assNo', 'pNo', 'testingNo', 'priNo'].every(k => nonempty(observedIds[k])), 'MALFORMED_CANDIDATE_SELECTION');
  }
  check(input.includeAnswers === undefined || typeof input.includeAnswers === 'boolean', 'MALFORMED_REQUEST');
  return input as ClinicReadRequest;
}

/** Resolve the existing context contract, then follow explicit replacement chains for route decisions. */
export function effectiveClinicContext(input: ReconstructedContext, sourceDigest: string, contextObservedAt: string): EffectiveContext {
  check(input.authorityGrant === false, 'CONTEXT_CANNOT_GRANT_AUTHORITY');
  instant(contextObservedAt);
  check(new Set(input.facts.map(f => f.id)).size === input.facts.length, 'DUPLICATE_CONTEXT_FACT');
  check(new Set(input.sources.map(s => s.id)).size === input.sources.length, 'DUPLICATE_CONTEXT_SOURCE');
  const routeInput = input.decisionRoutes.filter(r => r.id === 'resolve_clinic_header');
  check(routeInput.length === 1, 'CONTEXT_ROUTE_MISSING_OR_AMBIGUOUS');
  const factIds = new Set(input.facts.map(f => f.id));
  check([...routeInput[0]!.purposeIds, ...routeInput[0]!.decisionIds, ...routeInput[0]!.unresolvedIds].every(id => factIds.has(id)), 'REQUIRED_CONTEXT_MISSING');
  const base = resolveBusinessRoute(input, 'resolve_clinic_header', contextObservedAt);
  const route = input.decisionRoutes.find(r => r.id === 'resolve_clinic_header')!;
  const assertions = businessContextAssertions(input, contextObservedAt);
  const resolved = resolveUserContext(assertions, 'pilot');
  const byId = new Map(assertions.map(a => [a.id, a]));
  const needed = [...route.purposeIds, ...route.decisionIds.filter(id => byId.has(id))];
  const keys = new Set(needed.map(id => byId.get(id)!.key));
  check(!resolved.conflicts.some(k => keys.has(k)), 'CONTEXT_DECISION_AMBIGUOUS');
  const activeByKey = new Map(resolved.active.map(a => [a.key, a]));
  // A previously observed decision must still resolve; deliberately unverified design rules stay visible.
  for (const id of needed) {
    const assertion = byId.get(id)!;
    if (assertion.evidenceConfidence === 'observed') check(activeByKey.has(assertion.key), 'REQUIRED_CONTEXT_MISSING');
  }
  const project = (ids: string[]) => [...new Set(ids.map(id => byId.get(id)?.key).filter((x): x is string => !!x))]
    .flatMap(key => { const a = activeByKey.get(key); if (!a) return []; const value = a.value as {statement: string}; return [{id: a.id, statement: value.statement, sourceId: a.provenance.reference}]; });
  const purposes = project(route.purposeIds), decisions = project(route.decisionIds);
  check(purposes.length === route.purposeIds.length, 'REQUIRED_CONTEXT_MISSING');
  const selected = new Set([...purposes, ...decisions].map(a => a.id));
  return { routeId: 'resolve_clinic_header', sourceDigest, observedAt: contextObservedAt, timeMeaning: 'context_snapshot_generatedAt_not_individual_fact_authoredAt', purposes, decisions,
    supersededExcludedIds: assertions.filter(a => a.status === 'superseded' || (keys.has(a.key) && !selected.has(a.id) && a.evidenceConfidence === 'observed')).map(a => a.id),
    unverifiedDecisionIds: route.decisionIds.filter(id => byId.has(id) && !activeByKey.has(byId.get(id)!.key)),
    unresolvedRefs: base.unresolvedRefs, actionAuthorization: 'none_from_context' };
}

/** Port of validated DOM projection, strengthened for input shape/order and logical-model join proof. */
function projectSnapshot(snapshot: Snapshot, expected: AssessmentKey) {
  const f = snapshot.fixture;
  instant(f.observedAt);
  check(nonempty(f.answer.header), 'MISSING_CANONICAL_HEADER');
  const detail = new URL(f.judgment.url), answer = new URL(f.answer.url);
  for (const u of [detail, answer]) {
    check(u.origin === 'https://dc.gang-a.kr' && !u.username && !u.password, 'SOURCE_ORIGIN_MISMATCH');
    for (const parameter of ['p_no', 'testing_no', 'p_process']) check(u.searchParams.getAll(parameter).length === 1, 'AMBIGUOUS_SOURCE_PARAMETER');
    check(u.searchParams.get('p_no') === expected.originalPaperId, 'PAPER_MISMATCH');
    check(u.searchParams.get('testing_no') === expected.testingNo, 'ATTEMPT_MISMATCH');
  }
  check(detail.pathname === '/servlet/controller.tutor.na.TestPageListServlet' && detail.searchParams.get('p_process') === 'PupilSearch', 'UNVERIFIED_JUDGMENT_ROUTE');
  check(answer.pathname === '/servlet/controller.tutor.base.TestPageListServlet' && answer.searchParams.get('p_process') === 'ViewAnswerList', 'UNVERIFIED_MEMBERSHIP_ROUTE');
  const rows = f.judgment.rows.filter(r => String(r.priNo) === expected.studentKey && r.pNo === expected.originalPaperId && r.testingNo === expected.testingNo);
  check(rows.length === 1, 'EXACT_STUDENT_ASSESSMENT_REQUIRED');
  const row = rows[0]!, records = row.examResultList;
  check(nonempty(row.studentName), 'MISSING_STUDENT_IDENTITY');
  check(records.length > 0, 'EMPTY_REQUIRES_SEPARATE_EVIDENCE');
  check(records.length === f.answer.items.length, 'PARTIAL_RESPONSE');
  check(f.answer.items.every((r, i) => r.ordinal === i + 1 && nonempty(r.label)), 'ORIGINAL_ORDER_OR_LABEL_UNVERIFIED');
  const ordinals = records.map(r => r._examNo).sort((a, b) => a - b);
  check(same(ordinals, Array.from({length: records.length}, (_, i) => i + 1)), 'JUDGMENT_ORDINAL_COVERAGE');
  if (f.judgment.icons !== undefined) check(f.judgment.icons.length === records.length, 'ICON_SCOPE_UNVERIFIED');
  records.forEach((r, i) => {
    check(['X', 'O'].includes(r.ox), 'UNOBSERVED_GRADING_ENUM');
    if (r.__ox !== undefined) check(r.ox === r.__ox, 'DIRTY_OR_CONFLICTING_GRADING');
    if (f.judgment.icons !== undefined) check(f.judgment.icons[i] === (r.ox === 'X' ? '/image/score/wrong_bts.png' : '/image/score/right_bts.png'), 'DOM_FLAG_CONFLICT');
  });
  const identity: TestingKey = { studentId: expected.studentKey, originalTestId: expected.originalPaperId, testing: {namespace: 'NA.testing_no', value: expected.testingNo} };
  const members = f.answer.items.map(i => ({ordinal: i.ordinal, sourceItemKey: null, labelExact: i.label, printedPageLabel: null, sectionId: null}));
  const judgments = records.map(i => ({ordinal: i._examNo, state: i.ox === 'X' ? 'incorrect' as const : 'correct' as const, rawEnum: i.ox})).sort((a, b) => a.ordinal - b.ordinal);
  const membershipVersion = digest(members), judgmentRevision = digest(judgments);
  const evidence: Evidence = { id: snapshot.id, sourceKind: snapshot.evidenceKind === 'saved_actual_dom' ? 'runtime_dom' : 'design', evidenceConfidence: snapshot.evidenceKind === 'saved_actual_dom' ? 'observed' : 'unverified', sourceVersion: {kind: 'sha256', value: snapshot.sourceDigest}, observedAt: f.observedAt, occurredAt: null, scopeDigest: digest({identity, membershipVersion, judgmentRevision}), claim: 'Exact saved student/paper/attempt ordinal join; no historical print claim.' };
  // Synthetic tests exercise the same proof validator using explicit simulated runtime evidence.
  // Their externally reported kind remains synthetic_fixture and cannot become production evidence.
  const simulatedProof = snapshot.evidenceKind === 'synthetic_fixture' ? {...evidence, sourceKind: 'runtime_dom' as const, evidenceConfidence: 'observed' as const, claim: 'SYNTHETIC runtime proof for local contract test only.'} : evidence;
  const original: OriginalTest = {id: expected.originalPaperId, sourcePaper: {namespace: 'NA.p_no', value: expected.originalPaperId}, membershipVersion, members, coverage: {state: 'complete', expectedCount: members.length}, evidence: [evidence]};
  const testing: TestingSnapshot = {key: identity, membershipVersion, judgmentRevision, judgments, coverage: {state: 'complete', expectedCount: judgments.length}, evidence: [evidence]};
  const proof: AssessmentJoinProof = {identity, membershipVersion, judgmentRevision, basis: 'same_assessment_ordinals', evidence: simulatedProof};
  const joined = currentWrongSubset(original, testing, identity, proof);
  check(joined.unknownOrdinals.length === 0, 'ITEM_JUDGMENTS_UNAVAILABLE');
  let maximum: number | null = null, score: number | null = null;
  if (row.score !== undefined) {
    check(Number.isFinite(row.score) && row.score >= 0, 'MALFORMED_SCORE');
    if (records.every(r => Number.isFinite(r.examScoreMax) && r.examScoreMax! > 0 && Number.isFinite(r.examScore) && r.examScore! >= 0 && r.examScore! <= r.examScoreMax!)) {
      maximum = records.reduce((n, r) => n + r.examScoreMax!, 0);
      score = row.score;
      check(score <= maximum && score === records.reduce((n, r) => n + r.examScore!, 0), 'SCORE_EVIDENCE_CONFLICT');
    }
  }
  return { f, joined, original, testing, score, maximum };
}

const normalUnknowns = (): UnknownFact[] => [
  {code: 'NOT_LIVE', consequence: 'Saved observation only; no latest server state was queried.', blocking: false},
  {code: 'SERVER_REVISIONS_AND_ATOMICITY_UNKNOWN', consequence: 'Saved fixture has a combined observation time; per-page times, server revisions and atomic read consistency remain unknown.', blocking: false},
  {code: 'HISTORICAL_PRINT_MEMBERSHIP_UNKNOWN', consequence: 'Current-at-observation wrong items cannot identify a previously generated, printed or distributed clinic.', blocking: false},
  {code: 'LEARNING_COMPLETION_UNKNOWN', consequence: 'No teacher review or learning-completion event was supplied.', blocking: false},
];

export function createOfflineClinicReader(config: {context: ReconstructedContext; contextDigest: string; contextObservedAt: string; snapshots: Snapshot[]; scope: OfflineScope; discovery?: DiscoveryEvidence}) {
  const trusted = structuredClone(config);
  check(trusted.scope.mode === 'offline_fixture_replay' && trusted.scope.authority === 'caller_supplied_local_test_scope_not_lms_permission', 'INVALID_OFFLINE_SCOPE');
  return (rawRequest: unknown, projectedAt: string): ClinicReadResult => {
    let context: EffectiveContext | undefined;
    let discovery: DiscoverySummary | undefined;
    let discoveryCandidates: HeaderCandidate[] | undefined;
    try {
      instant(projectedAt);
      let request = parseRequest(rawRequest);
      context = effectiveClinicContext(trusted.context, trusted.contextDigest, trusted.contextObservedAt);
      if (request.operation === 'read_historical_print') fail('PRINT_INSTANCE_NOT_RESOLVED');
      if (request.student.sourceKey) check(trusted.scope.allowedStudentKeys.includes(request.student.sourceKey), 'STUDENT_SCOPE_UNVERIFIED');
      const available = trusted.snapshots.filter(s => trusted.scope.allowedStudentKeys.includes(s.expectedAssessment.studentKey));
      const studentCandidates = available.filter(s => (!request.student.sourceKey || s.expectedAssessment.studentKey === request.student.sourceKey) && (!request.student.exactName || s.fixture.judgment.rows.some(r => String(r.priNo) === s.expectedAssessment.studentKey && r.studentName === request.student.exactName)));
      const studentIds = new Set(studentCandidates.map(s => s.expectedAssessment.studentKey));
      check(studentIds.size > 0, 'STUDENT_NOT_RESOLVED');
      check(studentIds.size === 1, 'STUDENT_AMBIGUOUS');
      let selectedObservedCandidate = false;
      if (trusted.discovery) {
        const route = resolveObservedHeader(trusted.discovery, {studentKey: [...studentIds][0]!, header: request.printHeader, selection: request.candidateSelection});
        discovery = route.summary;
        if (discovery) check(Date.parse(discovery.observedAt) <= Date.parse(projectedAt), 'OBSERVATION_AFTER_PROJECTION');
        if (route.state === 'blocked') {discoveryCandidates = route.candidates; fail(route.code);}
        if (route.state === 'selected') {
          selectedObservedCandidate = true;
          const selected = {originalPaperId: route.candidate.observedIds.pNo, testingNo: route.candidate.observedIds.testingNo};
          if (request.assessment) check(same(request.assessment, selected), 'ASSESSMENT_HEADER_CONFLICT');
          request = {...request, printHeader: route.candidate.fullTestingName, assessment: selected};
        }
      } else if (request.candidateSelection) fail('DISCOVERY_EVIDENCE_UNAVAILABLE');
      const headerCandidates = studentCandidates.filter(s => s.fixture.answer.header === request.printHeader || s.observedHeaderAliases.some(a => a.header === request.printHeader));
      check(headerCandidates.length > 0, selectedObservedCandidate ? 'ASSESSMENT_SNAPSHOT_UNAVAILABLE' : 'HEADER_NOT_RESOLVED');
      const candidates = headerCandidates.filter(s => !request.assessment || (s.expectedAssessment.originalPaperId === request.assessment.originalPaperId && s.expectedAssessment.testingNo === request.assessment.testingNo));
      check(candidates.length > 0, 'ASSESSMENT_HEADER_CONFLICT');
      check(candidates.length === 1, 'HEADER_AMBIGUOUS');
      const snapshot = candidates[0]!;
      const p = projectSnapshot(snapshot, snapshot.expectedAssessment);
      check(Date.parse(p.f.observedAt) <= Date.parse(projectedAt), 'OBSERVATION_AFTER_PROJECTION');
      const compiled100Statement = '확정 100점인 해당 평가 범위는 오답·유사클리닉을 기본 출력하지 않는다. 실제 학습 확인을 위한 사용자 별도 요청은 그 범위의 예외로 남긴다.';
      const hasOriginal100Policy = context.decisions.some(d => d.id === 'rule-100' && d.statement === compiled100Statement);
      // Changed natural-language policy is never silently compiled as the old executable rule.
      const policy = hasOriginal100Policy ? clinicPolicy({assessmentScopeConfirmed: true, coverage: 'complete', score: p.score, maximum: p.maximum, wrongCount: p.joined.ordinals.length, teacherConfirmed: false}) : {clinic: 'unknown' as const};
      const unknowns = normalUnknowns();
      if (discovery) unknowns.push({code: 'DISCOVERY_HISTORY_COVERAGE_INCOMPLETE', consequence: 'Only the observed NA filter window and current page were checked; complete history, expanded dates and second-page transition remain unverified.', blocking: false});
      if (!hasOriginal100Policy) unknowns.push({code: 'POLICY_BINDING_REVIEW_REQUIRED', consequence: 'The latest decision replaced the executable clinic policy; raw reading is valid, recommendation withheld.', blocking: false});
      if (p.score === null || p.maximum === null) unknowns.push({code: 'SCORE_SCALE_UNKNOWN', consequence: 'No confirmed perfect-score exemption can be inferred.', blocking: false});
      const wrongItems = p.joined.ordinals.map(ordinal => {
        const item = p.f.answer.items[ordinal - 1]!;
        if (request.includeAnswers) check(nonempty(item.answerText), 'OFFICIAL_ANSWER_UNAVAILABLE');
        return {ordinal, label: item.label, ...(request.includeAnswers ? {answerText: item.answerText!} : {})};
      });
      const provenance: Provenance[] = ['judgment', 'answer'].map(section => ({evidenceId: `${snapshot.id}#/${section}`, observedAt: p.f.observedAt, kind: snapshot.evidenceKind, operationId: section === 'judgment' ? 'PupilSearch' : 'ViewAnswerList', sourceDigest: snapshot.sourceDigest, pointer: `snapshot:${snapshot.id}#/${section}`, observationTimeScope: 'combined_saved_fixture_per_page_times_unavailable'}));
      const alias = snapshot.observedHeaderAliases.find(a => a.header === request.printHeader);
      if (alias) provenance.push({evidenceId: alias.evidenceId, observedAt: alias.observedAt, kind: snapshot.evidenceKind, operationId: 'saved_header_alias_resolution', sourceDigest: alias.sourceDigest, pointer: `snapshot:${alias.evidenceId}`, observationTimeScope: 'combined_saved_fixture_per_page_times_unavailable'});
      return {ok: true, execution: 'offline_fixture_replay', evidenceKind: snapshot.evidenceKind, context, observedAt: p.f.observedAt, projectedAt, assessment: snapshot.expectedAssessment, headerExact: p.f.answer.header,
        join: {basis: 'verified_shared_assessment_ordinals', originalItemCount: p.original.members.length, originalOrderDigest: digest(p.f.answer.items.map(i => ({ordinal: i.ordinal, label: i.label}))), membershipVersion: p.original.membershipVersion, judgmentRevision: p.testing.judgmentRevision, revisionMeaning: 'local_content_hash_not_server_revision'},
        wrongItems, clinic: {recommendation: policy.clinic, teacherReview: 'pending', learningCompletion: 'unknown', scope: 'this_assessment_only', action: 'none'}, provenance, unknowns, ...(discovery ? {discovery} : {})};
    } catch (error) {
      const code = error instanceof ContractError ? error.code : error instanceof Error && /^[a-z_]+$/.test(error.message) ? error.message.toUpperCase() : 'MALFORMED_SOURCE_OR_CONTEXT';
      return {ok: false, execution: 'offline_fixture_replay', code, projectedAt, ...(context ? {context} : {}), ...(discoveryCandidates ? {candidates: discoveryCandidates} : {}), ...(discovery ? {discovery} : {}), unknowns: [{code, consequence: 'Requested result withheld; no external action was attempted.', blocking: true}], action: 'none'};
    }
  };
}

export function sha256Bytes(bytes: string | Uint8Array): string { return createHash('sha256').update(bytes).digest('hex'); }

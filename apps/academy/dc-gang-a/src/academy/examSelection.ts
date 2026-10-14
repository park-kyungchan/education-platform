import {assertExactKeys, assertInstant, assertKnowledge, assertRefs, canonicalJson, digest, immutableCopy, requireText, stableId, type Knowledge} from '../learning/model';
import {validateSourceKey, type SourceKey} from './domain';

/** The accepted elementary exam shape. Point bands do not establish difficulty. */
export const elementaryExamRequirement = immutableCopy({
  revision: 'elementary-written-24-100-v1', responseMode: 'constructed_response',
  questions: 24, points: 100, durationMinutes: 80,
  pointBands: [{points: 3, questions: 12}, {points: 5, questions: 8}, {points: 6, questions: 4}],
} as const);

export interface ExamCandidateBody {
  readonly sourceItem: SourceKey;
  readonly edition: Knowledge<SourceKey>;
  readonly observedAt: string;
  readonly sourceRef: string;
  readonly evidenceRefs: readonly string[];
  readonly content: Knowledge<string>;
  readonly answer: Knowledge<string>;
  readonly responseMode: Knowledge<'constructed_response' | 'multiple_choice'>;
  /** A retained source claim or teacher assessment, never inferred from assigned points. */
  readonly difficulty: Knowledge<{level: string; basis: 'source_claim' | 'teacher_assessment'; sourceRef: string}>;
}
export interface ExamCandidate extends ExamCandidateBody {
  readonly kind: 'exam_candidate'; readonly id: string; readonly revisionId: string;
}
export interface ExamSelection {
  readonly candidateId: string; readonly candidateRevisionId: string;
  readonly points: 3 | 5 | 6; readonly rationale: string;
}
export interface ExamSelectionWorkspace {
  readonly kind: 'exam_selection_workspace'; readonly schemaVersion: 1;
  readonly requirementRevision: typeof elementaryExamRequirement.revision;
  readonly title: string;
  readonly examDate: Knowledge<string>;
  readonly timeZone: Knowledge<string>;
  readonly selections: readonly ExamSelection[];
}

function boundedText(value: unknown, cap: number): asserts value is string {
  if (typeof value!=='string') throw Error('invalid_exam_text');
  requireText(value, 'exam field');
  if ((value as string).length > cap || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value as string)) throw Error('invalid_exam_text');
}
function boundedKnowledge<T>(value: Knowledge<T>, check: (value: T)=>void) {
  assertKnowledge(value, check);
  if (value.state==='unknown') boundedText(value.reason, 1000);
  else {
    if (value.evidenceRefs.length>64) throw Error('exam_evidence_cap');
    value.evidenceRefs.forEach(ref=>boundedText(ref,1000));
  }
}
function isoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value+'T00:00:00Z')) || new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value) throw Error('invalid_exam_date');
}
function candidateBody(candidate: ExamCandidate): ExamCandidateBody {
  const {kind, id, revisionId, ...body} = candidate;
  return body;
}
function validateBody(body: ExamCandidateBody) {
  assertExactKeys(body, ['sourceItem','edition','observedAt','sourceRef','evidenceRefs','content','answer','responseMode','difficulty']);
  canonicalJson(body); validateSourceKey(body.sourceItem); assertInstant(body.observedAt);
  boundedText(body.sourceRef, 1000); assertRefs(body.evidenceRefs);
  if (body.evidenceRefs.length > 64) throw Error('exam_evidence_cap');
  body.evidenceRefs.forEach(ref=>boundedText(ref,1000));
  boundedKnowledge(body.edition, validateSourceKey);
  boundedKnowledge(body.content, value => boundedText(value, 32000));
  boundedKnowledge(body.answer, value => boundedText(value, 16000));
  boundedKnowledge(body.responseMode, value => {if (!['constructed_response','multiple_choice'].includes(value)) throw Error('invalid_exam_response_mode');});
  boundedKnowledge(body.difficulty, value => {
    assertExactKeys(value, ['level','basis','sourceRef']); boundedText(value.level, 200); boundedText(value.sourceRef, 1000);
    if (!['source_claim','teacher_assessment'].includes(value.basis)) throw Error('invalid_exam_difficulty_basis');
  });
}
/** Pure source projection. Authentication, acquisition and persistence remain adapter responsibilities. */
export function createExamCandidate(body: ExamCandidateBody): ExamCandidate {
  validateBody(body);
  const id = stableId('exam_item', body.sourceItem.namespace, body.sourceItem.literalKey);
  return immutableCopy({...body, kind:'exam_candidate', id, revisionId:stableId('exam_candidate_revision', id, digest(body))});
}
export function validateExamCandidate(candidate: ExamCandidate) {
  canonicalJson(candidate);
  assertExactKeys(candidate, ['kind','id','revisionId','sourceItem','edition','observedAt','sourceRef','evidenceRefs','content','answer','responseMode','difficulty']);
  const expected = createExamCandidate(candidateBody(candidate));
  if (candidate.kind!=='exam_candidate' || candidate.id!==expected.id || candidate.revisionId!==expected.revisionId) throw Error('exam_candidate_revision_conflict');
}
export function validateExamWorkspace(workspace: ExamSelectionWorkspace) {
  canonicalJson(workspace);
  assertExactKeys(workspace, ['kind','schemaVersion','requirementRevision','title','examDate','timeZone','selections']);
  if (workspace.kind!=='exam_selection_workspace' || workspace.schemaVersion!==1 || workspace.requirementRevision!==elementaryExamRequirement.revision) throw Error('exam_requirement_conflict');
  boundedText(workspace.title, 200);
  boundedKnowledge(workspace.examDate, isoDate);
  boundedKnowledge(workspace.timeZone, value => {boundedText(value, 100);try {new Intl.DateTimeFormat('en', {timeZone:value});} catch {throw Error('invalid_exam_timezone');}});
  if (!Array.isArray(workspace.selections) || workspace.selections.length>24) throw Error('exam_selection_cap');
  const seen = new Set<string>();
  for (const selection of workspace.selections) {
    assertExactKeys(selection, ['candidateId','candidateRevisionId','points','rationale']);
    boundedText(selection.candidateId, 200); boundedText(selection.candidateRevisionId, 200); boundedText(selection.rationale, 4000);
    if (![3,5,6].includes(selection.points)) throw Error('invalid_exam_point_band');
    if (seen.has(selection.candidateId)) throw Error('duplicate_exam_item');
    seen.add(selection.candidateId);
  }
}
/** Readiness is an engineering projection, never teacher acceptance or permission to print/publish. */
export function inspectExamSelection(workspace: ExamSelectionWorkspace, candidates: readonly ExamCandidate[]) {
  validateExamWorkspace(workspace);
  if (!Array.isArray(candidates) || candidates.length>2000) throw Error('exam_candidate_cap');
  const revisions = new Map<string, ExamCandidate>();
  for (const candidate of candidates) {
    validateExamCandidate(candidate);
    if (revisions.has(candidate.revisionId)) throw Error('duplicate_exam_candidate_revision');
    revisions.set(candidate.revisionId, candidate);
  }
  const issues: {candidateId: string|null; code: string}[] = [];
  const rows = workspace.selections.map(selection => {
    const candidate = revisions.get(selection.candidateRevisionId);
    if (!candidate || candidate.id!==selection.candidateId) throw Error('selected_exam_candidate_unavailable');
    for (const field of ['edition','content','answer','difficulty'] as const) if (candidate[field].state==='unknown') issues.push({candidateId:candidate.id, code:field+'_unknown'});
    if (candidate.responseMode.state==='unknown' || candidate.responseMode.value!=='constructed_response') issues.push({candidateId:candidate.id, code:'constructed_response_unverified'});
    return {selection, candidate};
  });
  const bands = elementaryExamRequirement.pointBands.map(band => ({...band, selected:workspace.selections.filter(selection => selection.points===band.points).length}));
  for (const band of bands) if (band.selected!==band.questions) issues.push({candidateId:null, code:'point_band_'+band.points+'_incomplete'});
  if (workspace.examDate.state==='unknown') issues.push({candidateId:null, code:'exam_date_unknown'});
  if (workspace.timeZone.state==='unknown') issues.push({candidateId:null, code:'exam_timezone_unknown'});
  return immutableCopy({kind:'exam_selection_inspection' as const, requirement:elementaryExamRequirement,
    selectedQuestions:rows.length, selectedPoints:workspace.selections.reduce((total, selection) => total+selection.points, 0), bands, rows, issues,
    readiness:issues.length===0?'ready_for_teacher_review' as const:'incomplete' as const,
    sourceVerification:'not_performed_by_this_projection' as const,
    teacherAccepted:false as const, printed:false as const, published:false as const, academyWrites:0 as const});
}

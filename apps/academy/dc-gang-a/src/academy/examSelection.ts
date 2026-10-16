import {assertExactKeys, assertInstant, assertKnowledge, assertRefs, canonicalJson, digest, immutableCopy, known, unknown, requireText, stableId, type Knowledge} from '../learning/model';
import {validateSourceKey, validateHierarchy, traceHierarchy, type CatalogNode, type SourceKey} from './domain';
import {teacherExamSelectionContract} from '../../docs/teacher-exam-selection-contract';

/** The accepted elementary exam shape. Point bands do not establish difficulty. */
export const elementaryExamRequirement = immutableCopy({
  revision: 'elementary-written-24-100-v1',
  responseMode: teacherExamSelectionContract.acceptedRequirement.responseMode,
  questions: teacherExamSelectionContract.acceptedRequirement.questions,
  points: teacherExamSelectionContract.acceptedRequirement.totalPoints,
  durationMinutes: teacherExamSelectionContract.acceptedRequirement.durationMinutes,
  pointBands: teacherExamSelectionContract.acceptedRequirement.pointBands,
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

/** Declared unit scope uses the existing edition hierarchy, not a second exam catalog. */
export type ExamPreselectionUnitScope = Knowledge<{
  readonly catalog: readonly CatalogNode[];
  readonly unitIds: readonly string[];
}>;

/** Pure analysis before item selection. Declared source claims never authenticate source truth. */
export function inspectExamPreselection(
  workspace: ExamSelectionWorkspace,
  candidates: readonly ExamCandidate[],
  unitScope: ExamPreselectionUnitScope = unknown('Exact exam unit scope and edition have not been supplied'),
) {
  validateExamWorkspace(workspace);
  if (workspace.selections.length) throw Error('exam_preselection_requires_empty_selections');
  // Reuse the existing candidate/revision validator without proposing any selected rows.
  inspectExamSelection(workspace, candidates);
  canonicalJson(unitScope);
  boundedKnowledge(unitScope, scope => {
    assertExactKeys(scope, ['catalog', 'unitIds']);
    if (!Array.isArray(scope.catalog) || scope.catalog.length > 1000 || !Array.isArray(scope.unitIds) || !scope.unitIds.length || scope.unitIds.length > elementaryExamRequirement.questions) throw Error('exam_unit_scope_cap');
    validateHierarchy(scope.catalog);
    scope.unitIds.forEach(id => boundedText(id, 200));
    if (new Set(scope.unitIds).size !== scope.unitIds.length) throw Error('duplicate_exam_scope_unit');
  });
  type Allocation = {unitId:string;sourceKey:SourceKey;label:string;pathIds:string[];questions:number};
  let unitDistribution: Knowledge<{basis:'equal_count_in_declared_order';allocations:Allocation[]}> = unknown('Exact exam unit scope and edition have not been supplied');
  if (unitScope.state === 'unknown') unitDistribution = unitScope;
  else {
    const {catalog, unitIds} = unitScope.value;
    const units = unitIds.map(id => {
      const unit = catalog.find(node => node.id === id);
      if (!unit || !['major_unit','middle_unit','minor_unit'].includes(unit.kind)) throw Error('exam_scope_unit_unavailable');
      return {unit, path:traceHierarchy(catalog, id)};
    });
    if (new Set(units.map(({unit}) => canonicalJson(unit.sourceKey))).size !== units.length) throw Error('duplicate_exam_scope_source_unit');
    if (units.some(({path}) => path.state !== 'known')) unitDistribution = unknown('Declared unit ancestry or edition is incomplete');
    else {
      const editions = new Set(units.map(({path}) => canonicalJson(path.path[0]!.sourceKey)));
      if (editions.size !== 1) throw Error('mixed_exam_scope_editions');
      for (const {unit, path} of units) if (path.path.some(node => node.id !== unit.id && unitIds.includes(node.id))) throw Error('overlapping_exam_scope_units');
      const base = Math.floor(elementaryExamRequirement.questions / units.length), remainder = elementaryExamRequirement.questions % units.length;
      unitDistribution = known({basis:'equal_count_in_declared_order', allocations:units.map(({unit,path},index) => ({unitId:unit.id, sourceKey:unit.sourceKey, label:unit.label, pathIds:path.path.map(node => node.id), questions:base + (index < remainder ? 1 : 0)}))}, unitScope.evidenceRefs);
    }
  }
  const fields = ['edition','content','answer','difficulty','responseMode'] as const;
  const rows = candidates.map(candidate => ({
    candidateId:candidate.id, candidateRevisionId:candidate.revisionId,
    sourceItem:candidate.sourceItem, sourceRef:candidate.sourceRef, evidenceRefs:candidate.evidenceRefs,
    observedAt:candidate.observedAt, edition:candidate.edition,
    missingFields:fields.filter(field => candidate[field].state === 'unknown'),
    constructedResponseClaim:candidate.responseMode.state === 'known' && candidate.responseMode.value === elementaryExamRequirement.responseMode,
  }));
  const requirement = teacherExamSelectionContract.acceptedRequirement;
  const minutes = (time:string) => Number(time.slice(0,2)) * 60 + Number(time.slice(3));
  const end = minutes(requirement.localStartTime) + requirement.durationMinutes;
  const localExamEndTime = String(Math.floor(end / 60)).padStart(2,'0') + ':' + String(end % 60).padStart(2,'0');
  const unknowns = ['source_currentness_unverified','source_inventory_completeness_unverified','item_to_unit_coverage_unverified','teacher_judgment_unobserved'];
  if (workspace.examDate.state === 'unknown') unknowns.push('exam_date_unknown');
  if (workspace.timeZone.state === 'unknown') unknowns.push('exam_timezone_unknown');
  if (unitDistribution.state === 'unknown') unknowns.push('unit_distribution_unknown');
  for (const field of fields) if (rows.some(row => row.missingFields.includes(field))) unknowns.push(field + '_unknown');
  if (rows.some(row => !row.constructedResponseClaim)) unknowns.push('constructed_response_unverified');
  return immutableCopy({
    kind:'exam_preselection_analysis' as const,
    requirement, requirementRevision:elementaryExamRequirement.revision,
    originalSource:teacherExamSelectionContract.source,
    boundary:teacherExamSelectionContract.preselection,
    scoring:{bands:requirement.pointBands, calculatedPoints:requirement.pointBands.reduce((sum,band) => sum + band.points * band.questions, 0), difficultyFromPoints:false as const},
    timing:{localStartTime:requirement.localStartTime, durationMinutes:requirement.durationMinutes, localExamEndTime, localSessionEndTime:requirement.localSessionEndTime, gradingAndPeerHavrutaMinutes:minutes(requirement.localSessionEndTime) - end, examDate:workspace.examDate, timeZone:workspace.timeZone, calendarInstantResolved:false as const},
    coverage:{observedCandidateRevisions:rows.length, distinctSourceItems:new Set(candidates.map(candidate => candidate.id)).size, rows,
      inventoryCompleteness:unknown('No independently qualified complete source inventory is supplied'),
      itemToUnitCoverage:unknown('Candidate records do not establish exact item-to-unit coverage')},
    proposals:{unitDistribution, reviewStatus:'proposal_only' as const, basis:'Equal counts are a starting proposal, not a difficulty or source-coverage judgment; teacher review may change them.'},
    unknowns, selectedQuestions:0 as const, selectedPoints:0 as const, finalMembershipCreated:false as const,
    candidateCreation:false as const, sourceVerification:'not_performed_by_this_projection' as const,
    teacherAccepted:false as const, printed:false as const, published:false as const, academyWrites:0 as const,
  });
}

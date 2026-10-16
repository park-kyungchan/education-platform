import type {teacherExamSelectionContract} from '../../dc-gang-a/docs/teacher-exam-selection-contract';
import type {ExamCandidate, inspectExamPreselection} from '../../dc-gang-a/src/academy/examSelection';

export type ExamRequirement = typeof teacherExamSelectionContract.acceptedRequirement;
type Preselection = ReturnType<typeof inspectExamPreselection>;
export type PublicPreselection = Pick<Preselection,'selectedQuestions'|'selectedPoints'|'finalMembershipCreated'|'sourceVerification'>
  & {readonly coverage:Pick<Preselection['coverage'],'inventoryCompleteness'|'itemToUnitCoverage'>};
export interface DisplayItem {
  readonly candidate: ExamCandidate;
  readonly label: string;
  readonly unitLabel: string;
  readonly tags: readonly string[];
  readonly provenance: 'synthetic_fixture';
}
export interface PreviewData {
  readonly schema: 'academy.month-end-static-preview.v1';
  readonly requirement: ExamRequirement;
  readonly analysis: PublicPreselection;
  readonly examples: readonly DisplayItem[];
  readonly sourceMode: 'synthetic_examples_only';
  readonly actualInventory: 'unknown';
}
export interface Filters {readonly query: string; readonly unit: string; readonly completeness: string}

export function missingFields(item: DisplayItem): string[] {
  const fields = {edition:'판본', content:'원문', answer:'정답', difficulty:'난이도 근거', responseMode:'응답 형식'} as const;
  return Object.entries(fields).filter(([key]) => item.candidate[key as keyof typeof fields].state === 'unknown').map(([, label]) => label);
}

/** Display filtering never ranks, creates, chooses or persists exam membership. */
export function filterItems(items: readonly DisplayItem[], filters: Filters): DisplayItem[] {
  const query = filters.query.trim().toLocaleLowerCase('ko');
  return items.filter(item => {
    const complete = missingFields(item).length === 0;
    const text = [item.label, item.unitLabel, ...item.tags, item.candidate.sourceItem.literalKey,
      item.candidate.content.state === 'known' ? item.candidate.content.value : ''].join(' ').toLocaleLowerCase('ko');
    return (!query || text.includes(query)) && (!filters.unit || item.unitLabel === filters.unit)
      && (!filters.completeness || (filters.completeness === 'complete' ? complete : !complete));
  });
}

export function requirePreviewData(value: unknown): PreviewData {
  if (!value || typeof value !== 'object') throw Error('preview_data_missing');
  const data = value as PreviewData;
  if (data.schema !== 'academy.month-end-static-preview.v1' || data.sourceMode !== 'synthetic_examples_only'
    || data.actualInventory !== 'unknown' || !Array.isArray(data.examples)
    || data.examples.some(item => item.provenance !== 'synthetic_fixture' || item.candidate.sourceItem.namespace !== 'synthetic_month_end_preview')
    || !data.requirement || data.analysis.selectedQuestions !== 0 || data.analysis.finalMembershipCreated !== false) throw Error('preview_boundary_conflict');
  return data;
}

/** ISO calendar dates stay independent from timezone knowledge. */
export function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + 'T00:00:00Z'))
    && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
}

export function validTimeZone(value: string): boolean {
  try {new Intl.DateTimeFormat('ko', {timeZone:value}); return value.length > 0;} catch {return false;}
}

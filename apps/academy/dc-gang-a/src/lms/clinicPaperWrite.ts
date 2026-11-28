import {GatedWriteRefusal,canonicalJson,sha256Hex} from './gatedWriteLedger';
import {selectSourceFunction} from './sourceFunctionText';

/**
 * The wire protocol of the gated wrong-note and clinic paper creation (specs/academy-mcp/gated-writes.md):
 * the two pinned page handlers, the qualification of a review request into one frozen change, the exact
 * `TestpageSelectExServlet` forms of the write and its read-only readbacks, and the checks of their answers.
 * Pure: no request is sent here (the service of src/clinic-write-tools.ts sends them through its port).
 */

/** The ledger family of both tools: a token made by `academy_clinic_paper_review` is for `academy_clinic_paper_save` only (R4). */
export const CLINIC_TOOL_FAMILY = 'academy_clinic_paper';
export const TESTPAGE_SELECT_EX_PATH = '/servlet/controller.common.TestpageSelectExServlet';
export const BOOK_INCORRECT_PAGE = '/servlet/controller.coursemanage.TextBookManageServlet?reqCmd=getTextBookMain';
export const CLINIC_PAGE = '/servlet/controller.tutor.fa.TestPageListGrpServlet?p_process=Main';

/**
 * Pinned production wire hashes: the SHA-256 of the inline handler of the page, `selectSourceFunction` over the
 * page text with `\r\n` normalized to `\n`. `createBookIncorrectPapers` is on the getTextBookMain page and
 * `externOnCreateOneClinicPaper` on the tutor.fa TestPageListGrpServlet Main page. The static
 * `/jsutil/module.js` (`MODULE.Typeset.createResultPaper`, `CLINIC_MODE`) is not fetched again on each call
 * (specs/academy-mcp/gated-writes.md "Wire hash"): that gap is accepted.
 */
export const BOOK_INCORRECT_WIRE_SHA256 = '4794a5e8353e93f481d3f5cb4bc448c42e0b314413e55068900d51165893bf8c';
export const CLINIC_WIRE_SHA256 = '3f726b828586a15d3ed7c2071e63207a54cec231f168e1f838ffdae0f75447fa';
export type ClinicKind = 'book_incorrect' | 'clinic';
export interface ExpectedWireHashes {bookIncorrect?: string; clinic?: string}
export const CLINIC_WIRE = {
  book_incorrect: {page: BOOK_INCORRECT_PAGE, handler: 'createBookIncorrectPapers', pinned: BOOK_INCORRECT_WIRE_SHA256},
  clinic: {page: CLINIC_PAGE, handler: 'externOnCreateOneClinicPaper', pinned: CLINIC_WIRE_SHA256},
} as const;
/** The hash the page of `kind` must show: a test-only override, else the pinned production constant. */
export const expectedWireHash = (kind: ClinicKind, override?: ExpectedWireHashes): string =>
  (kind === 'book_incorrect' ? override?.bookIncorrect : override?.clinic) ?? CLINIC_WIRE[kind].pinned;

/** The wire hash of a page's inline handler, or null when the handler is absent, ambiguous or cannot be selected. */
export function wireSha256OfPage(kind: ClinicKind, html: string): string | null {
  try {
    const handler = selectSourceFunction(html.replaceAll('\r\n', '\n'), CLINIC_WIRE[kind].handler);
    return handler ? sha256Hex(handler) : null;
  } catch { return null; }
}

// ---- input qualification --------------------------------------------------------------------------

/** A key is at most 15 digits, so `Number(key)` in the posted condition is exact and converts back to the same text. */
const KEY = /^[1-9][0-9]{0,14}$/;
const PUBLIC_MEMBER = /public|all|everyone|every|academy|school|wide|global|pool/i;
const KNOWN_MEMBERS = ['kind', 'studentKey', 'courseKey', 'bookNo', 'testingNo', 'testingNos', 'clinicMode', 'createSimilar', 'similarCount', 'createAdvance', 'advanceCount', 'patList'] as const;
export const CLINIC_MODES = ['multiply', 'divide', 'custom'] as const;
export type ClinicMode = typeof CLINIC_MODES[number];
const MAX_TESTING_NOS = 50;
const MAX_PATTERNS = 100;
/** Bound of each of the four difficulty counts of a custom pattern (a choice of this unit; the page leaves it open). */
const MAX_PATTERN_COUNT = 100;

const invalid = (): never => { throw new GatedWriteRefusal('clinic_input_invalid'); };
const publicScope = (): never => { throw new GatedWriteRefusal('public_scope_forbidden'); };
const isKey = (v: unknown): v is string => typeof v === 'string' && KEY.test(v);
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;

export interface CustomPattern {pat_no: number; d4_cnt: number; d3_cnt: number; d2_cnt: number; d1_cnt: number}
export type SimilarWire = {create: 0} | {create: 1; mode: ClinicMode; exam_cnt: number; pat_list?: CustomPattern[]};
export type AdvanceWire = {create: 0} | {create: 1; mode: ClinicMode; exam_cnt: number};
export interface BookIncorrectChange {kind: 'book_incorrect'; studentKey: string; courseKey: string; bookNo: string; testingNos: string[]}
export interface ClinicPaperChange {kind: 'clinic'; studentKey: string; testingNo: string; clinicMode: ClinicMode; similar: SimilarWire; advance: AdvanceWire}
export type ClinicChange = BookIncorrectChange | ClinicPaperChange;
export interface BookIncorrectRequest {kind: 'book_incorrect'; studentKey: string; courseKey: string; bookNo: string; testingNos: string[] | null}

/** R7 and R15: the scope of a request or change, found from the input alone. */
function checkScope(raw: Record<string, unknown>, known: readonly string[], targets: readonly string[]): void {
  for (const member of Object.keys(raw)) {
    if (!known.includes(member) && PUBLIC_MEMBER.test(member)) publicScope();
  }
  if (!isKey(raw.studentKey)) publicScope();
  for (const member of targets) if (!isKey(raw[member])) publicScope();
  for (const member of Object.keys(raw)) if (!known.includes(member)) invalid();
}
const CHANGE_MEMBERS = ['kind', 'studentKey', 'courseKey', 'bookNo', 'testingNos', 'testingNo', 'clinicMode', 'similar', 'advance'] as const;

function qualifyPatterns(value: unknown): CustomPattern[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_PATTERNS) return invalid();
  const seen = new Set<number>();
  return value.map(item => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) return invalid();
    const p = item as Record<string, unknown>;
    if (Object.keys(p).sort().join(',') !== 'd1_cnt,d2_cnt,d3_cnt,d4_cnt,pat_no') return invalid();
    if (!isInt(p.pat_no, 1, 9007199254740991) || seen.has(p.pat_no)) return invalid();
    seen.add(p.pat_no);
    for (const m of ['d4_cnt', 'd3_cnt', 'd2_cnt', 'd1_cnt'] as const) if (!isInt(p[m], 0, MAX_PATTERN_COUNT)) return invalid();
    const d4 = p.d4_cnt as number, d3 = p.d3_cnt as number, d2 = p.d2_cnt as number, d1 = p.d1_cnt as number;
    if (d4 + d3 + d2 + d1 < 1) return invalid();
    return {pat_no: p.pat_no as number, d4_cnt: d4, d3_cnt: d3, d2_cnt: d2, d1_cnt: d1};
  });
}

/** The `similar` and `advance` wire objects of a clinic mode (the mode literals are the `CLINIC_MODE` values of `/jsutil/module.js`). */
export function clinicWireObjects(input: {clinicMode: unknown; createSimilar: unknown; similarCount: unknown; createAdvance: unknown; advanceCount: unknown; patList: unknown}): {clinicMode: ClinicMode; similar: SimilarWire; advance: AdvanceWire} {
  const mode = input.clinicMode;
  if (typeof mode !== 'string' || !(CLINIC_MODES as readonly string[]).includes(mode)) return invalid();
  const clinicMode = mode as ClinicMode;
  const similarOn = input.createSimilar === true, advanceOn = input.createAdvance === true;
  if (input.createSimilar !== undefined && typeof input.createSimilar !== 'boolean') return invalid();
  if (input.createAdvance !== undefined && typeof input.createAdvance !== 'boolean') return invalid();
  if (!similarOn && !advanceOn) return invalid();
  if (!similarOn && (input.similarCount !== undefined || input.patList !== undefined)) return invalid();
  if (!advanceOn && input.advanceCount !== undefined) return invalid();
  if (clinicMode !== 'custom' && input.patList !== undefined) return invalid();
  let similar: SimilarWire = {create: 0}, advance: AdvanceWire = {create: 0};
  if (similarOn) {
    if (clinicMode === 'multiply') {
      const n = input.similarCount === undefined ? 1 : input.similarCount;
      if (!isInt(n, 1, 20)) return invalid();
      similar = {create: 1, mode: 'multiply', exam_cnt: n};
    } else if (clinicMode === 'divide') {
      const n = input.similarCount === undefined ? 10 : input.similarCount;
      if (!isInt(n, 1, 100)) return invalid();
      similar = {create: 1, mode: 'divide', exam_cnt: n};
    } else {
      if (input.similarCount !== undefined) return invalid();
      similar = {create: 1, mode: 'custom', exam_cnt: 0, pat_list: qualifyPatterns(input.patList)};
    }
  }
  if (advanceOn) {
    if (clinicMode === 'divide') {
      const n = input.advanceCount === undefined ? 10 : input.advanceCount;
      if (!isInt(n, 1, 100)) return invalid();
      advance = {create: 1, mode: 'divide', exam_cnt: n};
    } else {
      if (input.advanceCount !== undefined && input.advanceCount !== 1) return invalid();
      advance = {create: 1, mode: clinicMode, exam_cnt: 1};
    }
  }
  return {clinicMode, similar, advance};
}

export const scopeKeyOf = (change: ClinicChange | BookIncorrectRequest): string =>
  change.kind === 'book_incorrect' ? 'book_incorrect:' + change.courseKey + ':' + change.bookNo : 'clinic:' + change.testingNo;

const testingNosOf = (value: unknown): string[] => {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_TESTING_NOS || !value.every(isKey) || new Set(value).size !== value.length) return invalid();
  return [...value as string[]].sort((a, b) => Number(a) - Number(b));
};

/**
 * A review request of the tool input: refuses `public_scope_forbidden` for a missing or non-numeric target key, a student
 * of `0` or `all`, or any public, all-student, all-class or academy-wide member (R7), and `clinic_input_invalid` for any other
 * member that does not fit its kind. A clinic request is the whole change; a book request still lacks its resolved testing numbers.
 */
export function qualifyClinicRequest(raw: unknown): ClinicPaperChange | BookIncorrectRequest {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return invalid();
  const r = raw as Record<string, unknown>;
  const kind = r.kind;
  if (kind !== 'book_incorrect' && kind !== 'clinic') return invalid();
  if (kind === 'book_incorrect') {
    checkScope(r, KNOWN_MEMBERS, ['courseKey', 'bookNo']);
    for (const m of ['testingNo', 'clinicMode', 'createSimilar', 'similarCount', 'createAdvance', 'advanceCount', 'patList']) if (r[m] !== undefined) invalid();
    return {kind, studentKey: r.studentKey as string, courseKey: r.courseKey as string, bookNo: r.bookNo as string,
      testingNos: r.testingNos === undefined ? null : testingNosOf(r.testingNos)};
  }
  checkScope(r, KNOWN_MEMBERS, ['testingNo']);
  for (const m of ['courseKey', 'bookNo', 'testingNos']) if (r[m] !== undefined) invalid();
  const wire = clinicWireObjects({clinicMode: r.clinicMode, createSimilar: r.createSimilar, similarCount: r.similarCount, createAdvance: r.createAdvance, advanceCount: r.advanceCount, patList: r.patList});
  return {kind, studentKey: r.studentKey as string, testingNo: r.testingNo as string, ...wire};
}

/** The reviewed change of a save call, requalified: R7 refusals keep their code and any other difference is `review_token_invalid` (R4). */
export function qualifyClinicChange(raw: unknown): ClinicChange {
  try {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return invalid();
    const c = raw as Record<string, unknown>;
    if (c.kind === 'book_incorrect') {
      checkScope(c, CHANGE_MEMBERS, ['courseKey', 'bookNo']);
      if (Object.keys(c).sort().join(',') !== 'bookNo,courseKey,kind,studentKey,testingNos') return invalid();
      const rebuilt: BookIncorrectChange = {kind: 'book_incorrect', studentKey: c.studentKey as string, courseKey: c.courseKey as string, bookNo: c.bookNo as string, testingNos: testingNosOf(c.testingNos)};
      if (canonicalJson(rebuilt) !== canonicalJson(c)) return invalid();
      return rebuilt;
    }
    if (c.kind === 'clinic') {
      checkScope(c, CHANGE_MEMBERS, ['testingNo']);
      if (Object.keys(c).sort().join(',') !== 'advance,clinicMode,kind,similar,studentKey,testingNo') return invalid();
      const similar = c.similar as Record<string, unknown> | null, advance = c.advance as Record<string, unknown> | null;
      if (similar === null || typeof similar !== 'object' || advance === null || typeof advance !== 'object') return invalid();
      const wire = clinicWireObjects({clinicMode: c.clinicMode, createSimilar: similar.create === 1, createAdvance: advance.create === 1,
        similarCount: similar.create === 1 && c.clinicMode !== 'custom' ? similar.exam_cnt : undefined,
        advanceCount: advance.create === 1 ? advance.exam_cnt : undefined,
        patList: similar.create === 1 && c.clinicMode === 'custom' ? similar.pat_list : undefined});
      const rebuilt: ClinicPaperChange = {kind: 'clinic', studentKey: c.studentKey as string, testingNo: c.testingNo as string, ...wire};
      if (canonicalJson(rebuilt) !== canonicalJson(c)) return invalid();
      return rebuilt;
    }
    return invalid();
  } catch (error) {
    if (error instanceof GatedWriteRefusal && error.code === 'public_scope_forbidden') throw error;
    throw new GatedWriteRefusal('review_token_invalid');
  }
}

// ---- wire forms ------------------------------------------------------------------------------------

export type WireFields = {p_process: string} & Record<string, string>;
const create = (n: 0 | 1) => ({create: n});

/** `getWrongAnswerNoteResult` of one exact course, book and student (a read; the review's resolution and the book readback). */
export const wrongNoteFields = (c: {studentKey: string; courseKey: string; bookNo: string}): WireFields => ({
  p_process: 'getWrongAnswerNoteResult',
  answerNoteResult: JSON.stringify({courseKeyList: [c.courseKey], bookNoList: [c.bookNo], userKeyList: [c.studentKey]})});

/** The one write request of a reviewed change: `create:1` for the wrong-note paper of a book, or the similar and advance clinic papers. */
export function writeFields(change: ClinicChange): WireFields {
  if (change.kind === 'book_incorrect') {
    if (change.testingNos.length === 1) {
      return {p_process: 'getStudyResultSingleTestingSingleUser', condition: JSON.stringify({
        testing_no: Number(change.testingNos[0]), pri_no: Number(change.studentKey), student_name: '',
        score: create(0), incorrect: create(1), similar: create(0), advance: create(0), report: create(0)})};
    }
    return {p_process: 'getStudyResultMultiTestingMultiUser', condition: JSON.stringify({
      score: create(0), incorrect: create(1), similar: create(0), advance: create(0), report: create(0),
      user_list: [{pri_no: Number(change.studentKey), student_name: '', testing_list: change.testingNos.map(n => ({testing_no: Number(n)}))}]})};
  }
  return {p_process: 'getStudyResultSingleTestingSingleUser', condition: JSON.stringify({
    testing_no: Number(change.testingNo), pri_no: Number(change.studentKey), student_name: '',
    score: create(0), incorrect: create(0), similar: change.similar, advance: change.advance, report: create(0)})};
}

/** The scope readback of a clinic: the score view of the student's attempt, `score.create:1` and no creation (classed read). */
export const clinicReadbackFields = (change: {studentKey: string; testingNo: string}): WireFields => ({
  p_process: 'getStudyResultSingleTestingSingleUser', condition: JSON.stringify({
    testing_no: Number(change.testingNo), pri_no: Number(change.studentKey), student_name: '',
    score: create(1), incorrect: create(0), similar: create(0), advance: create(0), report: create(0)})});

// ---- answer checks --------------------------------------------------------------------------------

const asRecord = (v: unknown): Record<string, unknown> | null => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null;
const keyOf = (v: unknown): string | null => {
  const s = typeof v === 'number' && Number.isSafeInteger(v) ? String(v) : typeof v === 'string' ? v : null;
  return s !== null && KEY.test(s) ? s : null;
};
function parseJson(text: string): Record<string, unknown> {
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw Error('clinic_response_unverified'); }
  return asRecord(value) ?? (() => { throw Error('clinic_response_unverified'); })();
}
function validPrintList(value: unknown, studentKey: string | null): Record<string, unknown>[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 200) throw Error('clinic_response_unverified');
  return value.map(item => {
    const paper = asRecord(item);
    if (!paper || !Array.isArray(paper.exam_list) || paper.exam_list.length < 1 || paper.exam_list.length > 5000) throw Error('clinic_response_unverified');
    for (const raw of paper.exam_list) { const exam = asRecord(raw); if (!exam || keyOf(exam.exam_no) === null) throw Error('clinic_response_unverified'); }
    if (studentKey !== null && paper.pri_no !== undefined && keyOf(paper.pri_no) !== studentKey) throw Error('clinic_response_unverified');
    return paper;
  });
}

/**
 * The answer of the write: `{result: 'OK', print_list}` with a non-empty list whose papers each hold exam items. Gives the hash of
 * the whole body, the hash of the print list and the sorted paper keys (`p_no` or `paper_no`, when the papers carry one). Anything
 * else throws `clinic_response_unverified`: the write is then neither confirmed nor denied.
 */
export function parseWriteResponse(text: string, studentKey: string): {responseSha256: string; printListSha256: string; paperKeys: string[]; paperCount: number} {
  const body = parseJson(text);
  if (body.result !== 'OK') throw Error('clinic_response_unverified');
  const papers = validPrintList(body.print_list, studentKey);
  const keys = new Set<string>();
  for (const paper of papers) for (const member of ['p_no', 'paper_no']) { const k = keyOf(paper[member]); if (k) keys.add(k); }
  return {responseSha256: sha256Hex(text), printListSha256: sha256Hex(canonicalJson(body.print_list)), paperKeys: [...keys].sort((a, b) => Number(a) - Number(b)), paperCount: papers.length};
}

/** The testing numbers of the rows of `getWrongAnswerNoteResult` for one exact course and student; every row must carry the student key as `pri_no` and a `cls_no` of 0 (the live LMS) or the course key; the course is verified by the request scope (`wrongNoteFields`: one course, one book, one student). */
export function parseWrongNoteResult(text: string, scope: {studentKey: string; courseKey: string}): string[] {
  let body: Record<string, unknown>;
  try { body = parseJson(text); } catch { throw Error('clinic_scope_unresolved'); }
  if (body.result !== 'ok' || !Array.isArray(body.noteResultList) || body.noteResultList.length > 1000) throw Error('clinic_scope_unresolved');
  const nos = new Set<string>();
  for (const raw of body.noteResultList) {
    const row = asRecord(raw);
    if (!row || keyOf(row.pri_no) !== scope.studentKey || !(row.cls_no === 0 || row.cls_no === '0' || keyOf(row.cls_no) === scope.courseKey)) throw Error('clinic_scope_unresolved');
    const no = keyOf(row.testing_no);
    if (no === null) throw Error('clinic_scope_unresolved');
    nos.add(no);
  }
  return [...nos].sort((a, b) => Number(a) - Number(b));
}

/** The score-view readback of a clinic: `{result: 'OK', print_list}` of the student's own attempt. Throws `clinic_response_unverified`. */
export function parseClinicReadback(text: string, studentKey: string): void {
  const body = parseJson(text);
  if (body.result !== 'OK') throw Error('clinic_response_unverified');
  validPrintList(body.print_list, studentKey);
}

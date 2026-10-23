// Run: node --experimental-strip-types test-teacher-overlay-ui.ts
// Entirely synthetic. No Site operation, production data, network, or file writes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {Window} from 'happy-dom';
import {attachTeacherOverlay, mountTeacherOverlay, type TeacherOverlay} from './src/teacher-overlay.ts';

const workspace = fileURLToPath(new URL('.', import.meta.url));
const frozenHash = 'b'.repeat(64), overlayHash = 'a'.repeat(64);
// Special selector characters intentionally exercise exact attribute-value joins.
const key = (n: number) => `record:synthetic/${n}?slot="${n}"[x]`;
const attemptKey = (n: number) => `attempt_synthetic_${n}`;
const candidates = Array.from({length: 21}, (_, index) => {
  const number = index + 1, done = ![11, 20, 21].includes(number);
  return {
    number, sourceRecordKey: key(number), sourceAttemptKey: attemptKey(number),
    score: 80 + number % 19, attemptRawDate: `09-${String(number).padStart(2, '0')} 21:43`,
    appCatalogCode: `APP-SYNTHETIC-${number}`,
    originalWrongReview: done ? 'teacher_confirmed_complete' : 'unknown',
    similarClinicReview: done ? 'teacher_confirmed_complete' : 'unknown',
    printHeaderVerified: false, printExistence: 'unknown', verifiedPrintTestCode: null,
    reviewEvidence: done ? {
      originalWrong: {evidenceClass: 'user_confirmed', recordedAt: '2026-10-07T13:00:00+09:00'},
      similarClinic: {evidenceClass: 'user_confirmed', recordedAt: '2026-10-07T13:00:00+09:00'},
    } : {originalWrong: null, similarClinic: null},
    deliveryPlan: done ? null : {
      state: 'planned', pickupAtLocal: '2026-10-07T16:00:00+09:00', precision: 'approximate',
      generatedAt: null, printedAt: null, deliveredAt: null,
    },
  };
}) as TeacherOverlay['candidates'];
const projection: TeacherOverlay = {
  version: '1.2.0', sha256: overlayHash, sourceSnapshotSha256: frozenHash,
  studentId: 'page_synthetic_current', sourceRevision: 'revision_0002',
  summary: {completedOriginalAttempts: 18, completedPathDecisions: 36,
    deliveryPlannedOriginalAttempts: 3, deliveryPlannedPathCandidates: 6, actualPrintedSheetCount: null},
  candidates,
};
function view() {
  const records = Object.fromEntries(Array.from({length: 22}, (_, index) => {
    const n = index + 1, candidate = candidates[index];
    const attempt = {nativeAttemptId: attemptKey(n), score: candidate?.score ?? 100,
      dateRaw: candidate?.attemptRawDate ?? '09-22 21:43', clinicText: '미학습',
      sourceResultLabel: 'synthetic original grade', yearState: 'unknown', timezoneState: 'unknown'};
    const r = {recordId: key(n), tocNodeRef: 'toc_synthetic', sectionDisplayLabel: `Synthetic section ${n}`,
      sectionSourceLabel: `Synthetic source label ${n}`, publicSectionLabel: `Synthetic public label ${n}`,
      unitLabel: '1', unitTitle: 'Synthetic unit', lessonIndex: null,
      catalogCode: candidate?.appCatalogCode ?? 'APP-SYNTHETIC-100',
      performanceState: 'observed', evidenceState: 'observed', mappingState: 'observed',
      sectionApplicabilityState: 'observed', catalogPresence: 'observed',
      teacherVerdict: {state: 'not_determined', value: null, note: null},
      paperEvidence: {state: 'not_checked'}, progressDecision: 'not_determined',
      attemptEvidence: [attempt], diaryAssertions: [], sourceUrls: [],
      sourceOriginal: {attempt, immutableLabel: `original-${n}`, sourceSha256: frozenHash}};
    return [key(n), r];
  }));
  const row = {id: 'toc_synthetic', label: '1', title: 'Synthetic unit', level: 'major', parentId: null,
    recordIds: Object.keys(records), raw: {printedStartPage: null, tocEvidencePdfPage: null}};
  return {studentLabel: 'Synthetic student', sourceContractVersion: 'synthetic', sourceAsOf: {},
    inputSha256: frozenHash, records, notebookEvidence: [], unmappedAssertions: [], raw: {},
    questionCoverage: {state: 'not_captured', observedItemCount: 0, totalItems: null},
    books: [{key: 'synthetic-book', label: 'Synthetic book', edition: 'synthetic', rows: [row],
      raw: {originalBookTitle: 'Synthetic book', bookCode: 'SYN', sourceEditionBinding: {publicRevisionLabel: 'synthetic'}, sectionFlow: []},
      tocCoverage: {state: 'native_catalog_only'}, performanceCoverage: {attemptObservationCount: 22}}]};
}
const clone = <T>(object: T): T => structuredClone(object);
function freeze<T>(object: T): T {
  if (object && typeof object === 'object') {
    Object.freeze(object);
    Object.values(object).forEach(freeze);
  }
  return object;
}
const firstWindow: any = new Window({url: 'https://synthetic-overlay.example.invalid'});
// rails.ts needs document at module initialization; it receives only an empty synthetic document.
(globalThis as any).document = firstWindow.document;
const {mountC2ProgressRails} = await import('./src/rails.ts');
delete (globalThis as any).document;
await firstWindow.happyDOM.close();

const tick = async () => {await Promise.resolve(); await new Promise(resolve => setTimeout(resolve, 8));};
// happy-dom toggles <details> before ancestor click listeners; real Chromium is
// is reserved for hosted browser QA. A generic bubbling Event avoids that emulator quirk.
const click = (ui: any, element: any) => element.dispatchEvent(new ui.w.Event('click', {bubbles: true, cancelable: true}));
const rowFor = (root: any, recordKey: string) => [...root.querySelectorAll('[data-record-container]')]
  .find((row: any) => row.getAttribute('data-record-container') === recordKey) as any;
function setup(customProjection: TeacherOverlay | null = projection, source = view()) {
  const w: any = new Window({url: 'https://synthetic-overlay.example.invalid', settings: {
    enableJavaScriptEvaluation: false, disableCSSFileLoading: true, disableJavaScriptFileLoading: true, disableErrorCapturing: true}});
  w.HTMLElement.prototype.scrollIntoView = function() {};
  w.addEventListener('error', (event: any) => {throw event.error;});
  let networkRequests = 0, storageWrites = 0;
  w.fetch = () => {networkRequests++; throw Error('network forbidden');};
  w.localStorage.setItem = () => {storageWrites++; throw Error('storage forbidden');};
  w.sessionStorage.setItem = () => {storageWrites++; throw Error('storage forbidden');};
  w.document.body.innerHTML = '<main id="c2-root"></main>';
  const root = w.document.querySelector('#c2-root'), beforeSource = JSON.stringify(source);
  const rails = mountC2ProgressRails(freeze(source), root), beforeHTML = root.innerHTML;
  const overlay = attachTeacherOverlay(customProjection === null ? null : freeze(customProjection), root);
  return {w, root, source, rails, overlay, beforeHTML, beforeSource,
    row: (n: number) => rowFor(root, key(n)),
    async close() {
      assert.equal(JSON.stringify(source), beforeSource, 'source view/record/attempt objects stay unchanged');
      assert.equal(networkRequests, 0); assert.equal(storageWrites, 0);
      overlay.dispose(); rails.dispose(); await w.happyDOM.close();
    }};
}
const passed: string[] = [];
async function test(name: string, fn: () => any) {await fn(); passed.push(name);}
async function withUI(fn: (ui: ReturnType<typeof setup>) => any, overlay: TeacherOverlay | null = clone(projection), source = view()) {
  const ui = setup(overlay, source);
  try {await fn(ui);} finally {await ui.close();}
}

await test('null projection adds nothing for other students', () => withUI(ui => {
  assert.equal(ui.root.innerHTML, ui.beforeHTML);
  assert.equal(ui.root.querySelectorAll('[data-teacher-overlay-owned]').length, 0);
  ui.overlay.refresh(); ui.overlay.afterRecordRender();
}, null));

await test('compact summary and all 21 exact record-key bindings', () => withUI(ui => {
  const summary = ui.root.querySelector('.teacher-overlay-summary');
  assert.equal(summary.nextElementSibling.id, 'c2-books');
  for (const text of ['원응시 18건 ×', '36건', '원응시 3건 × 2경로', '6후보', '실제 인쇄 장수 미확인']) assert(summary.textContent.includes(text));
  assert.equal(ui.root.querySelectorAll('.teacher-overlay-row').length, 21);
  for (let n = 1; n <= 21; n++) {
    assert.equal(ui.row(n).querySelector('.teacher-overlay-number').textContent, `#${n}`);
    const text = ui.row(n).querySelector('.teacher-overlay-row-state').textContent;
    assert.equal(text, ![11, 20, 21].includes(n) ? '교사 확인: 원오답 완료 · 유사클리닉 완료' : '원오답·유사클리닉 전달 예정');
  }
  assert.equal(ui.row(22).querySelector('.teacher-overlay-row'), null);
}));

await test('scores dates raw clinic and original teacher judgments remain separate', () => withUI(ui => {
  assert.equal(ui.rails.view, ui.source);
  for (let n = 1; n <= 22; n++) {
    const row = ui.row(n), r = ui.source.records[key(n)];
    assert(row.querySelector('.numeric').textContent.includes(String(r.attemptEvidence[0].score)));
    assert.equal(row.querySelector('.raw-date').textContent, r.attemptEvidence[0].dateRaw);
    assert.equal(row.querySelector('.teacher').textContent, '교사 판단완료 미확인');
  }
  const detail = ui.row(1).querySelector('.inline-evidence');
  assert(detail.querySelector('.detail-columns').textContent.includes('미학습'));
  assert(detail.querySelector('.detail-columns').textContent.includes('교사 판정완료 미확인'));
  assert.equal(detail.lastElementChild.className, 'teacher-overlay-detail');
  assert.equal(ui.row(2).querySelector('.inline-evidence').children.length, 0);
}));

await test('delegated click restoration survives repeated close and reopen', () => withUI(async ui => {
  const summary = ui.row(11).querySelector('[data-record-id]');
  assert.equal(summary.isConnected, true);
  assert.equal(summary.dataset.recordId, key(11));
  assert.equal(summary.closest('[data-record-id]'), summary);
  assert.equal(ui.root.contains(summary), true);
  let clicks = 0; ui.root.addEventListener('click', () => {clicks++;});
  click(ui, summary); await tick();
  assert.equal(clicks, 1, 'synthetic summary click bubbles');
  for (let repeat = 0; repeat < 3; repeat++) {
    const body = ui.row(11).querySelector('.inline-evidence');
    assert.equal(body.querySelectorAll('.teacher-overlay-detail').length, 1, JSON.stringify({repeat,open:ui.row(11).open, selected:ui.rails.getSelectedId(), summary:ui.root.querySelectorAll('.teacher-overlay-summary').length, body:body.innerHTML.slice(0,300)}));
    assert.equal(body.lastElementChild.className, 'teacher-overlay-detail');
    for (const text of ['생성 미확인', '인쇄 미확인', '수령 미확인', '머리글 미검증', '코드 미검증', '2026-10-07T16:00:00+09:00', '대략적인 예정 시각']) assert(body.textContent.includes(text));
    assert(body.querySelector('.detail-columns').textContent.includes('미학습'));
    click(ui, body.querySelector('[data-close-record]')); await tick();
    assert.equal(ui.row(11).open, false);
    click(ui, summary); await tick(); assert.equal(ui.row(11).open, true);
  }
}));

await test('delegated keyboard preserves C2 selection and native controls', () => withUI(async ui => {
  const summary = ui.row(20).querySelector('[data-record-id]');
  summary.dispatchEvent(new ui.w.KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true})); await tick();
  assert.equal(ui.rails.getSelectedId(), key(20)); assert.equal(ui.row(20).open, true);
  assert.equal(ui.row(20).querySelectorAll('.teacher-overlay-detail').length, 1);
  summary.dispatchEvent(new ui.w.KeyboardEvent('keydown', {key: 'Escape', bubbles: true, cancelable: true})); await tick();
  assert.equal(ui.row(20).open, false);
  summary.dispatchEvent(new ui.w.KeyboardEvent('keydown', {key: ' ', bubbles: true, cancelable: true})); await tick();
  assert.equal(ui.row(20).open, true);
  assert.equal(summary.getAttribute('aria-expanded'), 'true');
}));

await test('programmatic selection has synchronous hook and observer restoration', () => withUI(async ui => {
  ui.rails.selectRecord(key(21));
  assert.equal(ui.row(21).querySelector('.teacher-overlay-detail'), null);
  ui.overlay.afterRecordRender(key(21));
  assert.equal(ui.row(21).querySelectorAll('.teacher-overlay-detail').length, 1);
  ui.rails.selectRecord(key(18)); await tick();
  assert.equal(ui.row(18).querySelectorAll('.teacher-overlay-detail').length, 1);
  const html = ui.root.innerHTML;
  await tick(); await tick(); assert.equal(ui.root.innerHTML, html, 'no mutation/refresh loop');
  ui.overlay.refresh(); ui.overlay.afterRecordRender();
  assert.equal(ui.row(18).querySelectorAll('.teacher-overlay-detail').length, 1);
}));

await test('fixed labels survive shuffled input and shared record keys', async () => {
  const reversed = clone(projection); (reversed as any).candidates.reverse();
  await withUI(ui => {
    assert.equal(ui.row(1).querySelector('.teacher-overlay-number').textContent, '#1');
    assert.equal(ui.row(21).querySelector('.teacher-overlay-number').textContent, '#21');
  }, reversed);
  const shared = clone(projection); (shared as any).candidates[1].sourceRecordKey = key(1);
  await withUI(ui => {
    assert.deepEqual([...ui.row(1).querySelectorAll('.teacher-overlay-number')].map((n: any) => n.textContent), ['#1', '#2']);
    assert.equal(ui.row(2).querySelector('.teacher-overlay-row'), null);
    assert.equal(ui.row(1).querySelectorAll('.teacher-overlay-candidate').length, 2);
  }, shared);
});

await test('100 points and missing review never imply teacher completion or failure', () => {
  const unknown: any = clone(projection), source = view();
  unknown.candidates = [{...unknown.candidates[0], score: 100, originalWrongReview: undefined, similarClinicReview: undefined, reviewEvidence: null}];
  unknown.summary = {...unknown.summary, completedOriginalAttempts: 0, completedPathDecisions: 0, deliveryPlannedOriginalAttempts: 0, deliveryPlannedPathCandidates: 0};
  source.records[key(1)].attemptEvidence[0].score = 100;
  return withUI(ui => {
    assert.equal(ui.row(1).querySelector('.teacher-overlay-row-state').textContent, '교사 확인: 원오답 미확인 · 유사클리닉 미확인');
    assert(!ui.row(1).querySelector('.teacher-overlay-row-state').textContent.includes('미완료'));
    assert.equal(ui.row(22).querySelector('.teacher-overlay-row'), null);
  }, unknown, source);
});

await test('completion plans and print checks remain independent axes', () => {
  const mixed: any = clone(projection);
  mixed.candidates = [{...mixed.candidates[0], similarClinicReview: 'unknown', deliveryPlan: clone(projection.candidates[10].deliveryPlan)}];
  mixed.summary = {...mixed.summary, completedOriginalAttempts: 0, completedPathDecisions: 1, deliveryPlannedOriginalAttempts: 1, deliveryPlannedPathCandidates: 2};
  return withUI(ui => {
    const text = ui.row(1).querySelector('.teacher-overlay-row-state').textContent;
    assert(text.includes('원오답 완료')); assert(text.includes('유사클리닉 미확인')); assert(text.includes('전달 예정'));
    assert(ui.row(1).querySelector('.teacher-overlay-detail').textContent.includes('인쇄 미확인'));
    assert.equal(ui.source.records[key(1)].paperEvidence.state, 'not_checked');
  }, mixed);
});

await test('v1.3 print confirmation never implies solving review receipt headers or sheet count', async () => {
  const printed: any = clone(projection);
  printed.version = '1.3.0';
  printed.summary.printedOriginalAttempts = 3; printed.summary.printedPathCandidates = 6;
  for (const number of [11, 20, 21]) {
    printed.candidates[number - 1].printExistence = 'user_confirmed_present';
    printed.candidates[number - 1].deliveryPlan = {...printed.candidates[number - 1].deliveryPlan, printExecutionState: 'user_confirmed_complete', handoffState: 'not_confirmed', receiptState: 'not_confirmed'};
    printed.candidates[number - 1].printConfirmation = {
      state: 'user_confirmed_complete', recordedAt: '2026-10-07T14:00:00+09:00',
      printedTimeRaw: '지금', printedAt: null, printedAtState: 'relative_time_only_no_authoritative_timestamp',
      eventId: 'synthetic-print-event', remediationPaths: ['original_wrong', 'similar_clinic'],
      printedPageCount: null, actualPrintedSheetCount: null, materialIds: null,
      printHeaderVerified: false, sourceMessageId: 'synthetic-user-print-confirmation',
    };
  }
  await withUI(async ui => {
    assert(ui.root.querySelector('.teacher-overlay-summary').textContent.includes('v1.3.0'));
    assert(ui.root.querySelector('.teacher-overlay-summary').textContent.includes('실제 인쇄 장수 미확인'));
    assert(ui.root.querySelector('.teacher-overlay-summary').textContent.includes('인쇄 교사 확인 원응시 3건 · 6경로 후보'));
    for (const number of [11, 20, 21]) {
      ui.rails.selectRecord(key(number)); ui.overlay.afterRecordRender(key(number));
      const row = ui.row(number), text = row.querySelector('.teacher-overlay-row-state').textContent;
      assert(text.includes('인쇄: 교사 확인 완료'));
      assert(text.includes('전달·수령 미확인'));
      const detail = row.querySelector('.teacher-overlay-detail');
      for (const status of ['인쇄 시각 미확인', '생성 시각 미확인', '수령 미확인',
        '인쇄 사건 시각null', '머리글 미검증', '코드 미검증', 'synthetic-user-print-confirmation', '"지금" (사용자 원문)', '정확한 인쇄 사건 시각 미확인', 'null / null / null']) assert(detail.textContent.includes(status));
      assert(row.querySelector('.detail-columns').textContent.includes('미학습'));
      assert.equal(ui.source.records[key(number)].teacherVerdict.state, 'not_determined');
      const fields = detail.querySelector('.teacher-overlay-fields').textContent;
      assert(fields.includes('원오답 검토교사 확인 미확인'));
      assert(fields.includes('유사클리닉 검토교사 확인 미확인'));
      assert(text.includes('전달 예정'));
    }
    await tick();
    assert.equal(ui.root.querySelectorAll('.teacher-overlay-summary').length, 1);
  }, printed);
});

await test('provenance uses exact hashes keys original dates and plain text', () => {
  const hostile: any = clone(projection);
  hostile.candidates[0].appCatalogCode = '<img src=x onerror="throw 1">';
  return withUI(ui => {
    const section = ui.row(1).querySelector('.teacher-overlay-detail');
    for (const text of [overlayHash, frozenHash, key(1), attemptKey(1), 'revision_0002', candidates[0].attemptRawDate, 'user_confirmed', hostile.candidates[0].appCatalogCode]) assert(section.textContent.includes(text));
    assert.equal(section.querySelector('img'), null);
    assert.equal(ui.root.querySelector('form,input,textarea,[contenteditable]'), null);
    assert.equal(ui.w.ACADEMY_QA, undefined); assert.equal(ui.w.C2_PROGRESS_QA, undefined);
  }, hostile);
});

await test('disposal cancels queued restoration and restores original HTML', () => withUI(async ui => {
  ui.overlay.refresh(); ui.overlay.dispose();
  assert.equal(ui.root.innerHTML, ui.beforeHTML);
  click(ui, ui.row(3).querySelector('[data-record-id]')); await tick();
  assert.equal(ui.root.querySelector('[data-teacher-overlay-owned]'), null);
  ui.overlay.refresh(); ui.overlay.afterRecordRender();
  assert.equal(ui.root.querySelector('[data-teacher-overlay-owned]'), null);
}));

await test('repeat mount replaces one overlay and null removes it', () => withUI(async ui => {
  click(ui, ui.row(4).querySelector('[data-record-id]'));
  const replacement = mountTeacherOverlay(clone(projection), ui.root);
  await tick();
  assert.equal(ui.root.querySelectorAll('.teacher-overlay-summary').length, 1);
  assert.equal(ui.root.querySelectorAll('.teacher-overlay-row').length, 21);
  assert.equal(ui.row(4).querySelectorAll('.teacher-overlay-detail').length, 1);
  mountTeacherOverlay(null, ui.root); await tick(); replacement.refresh();
  assert.equal(ui.root.querySelector('[data-teacher-overlay-owned]'), null);
}));

await test('replacing C2 root cannot restore old student overlay', () => withUI(async ui => {
  ui.rails.dispose();
  const another = view(); another.studentLabel = 'Synthetic different student';
  const replacementRails = mountC2ProgressRails(another, ui.root);
  ui.overlay.refresh(); await tick(); ui.overlay.afterRecordRender();
  assert.equal(ui.root.querySelector('[data-teacher-overlay-owned]'), null);
  assert(ui.root.querySelector('h1').textContent.includes('different student'));
  replacementRails.dispose();
}));

await test('malformed projections fail before changing source UI', () => withUI(ui => {
  ui.overlay.dispose();
  for (const change of [
    (p: any) => p.version = '1.2.1', (p: any) => p.sha256 = 'truncated',
    (p: any) => p.summary.completedPathDecisions = null,
    (p: any) => p.summary.actualPrintedSheetCount = -1,
    (p: any) => p.candidates[0].number = 22,
    (p: any) => p.candidates[1].number = 1,
    (p: any) => p.candidates[1].sourceAttemptKey = p.candidates[0].sourceAttemptKey,
    (p: any) => p.candidates[0].originalWrongReview = 'score_implied_complete',
    (p: any) => p.candidates[0].printConfirmation = {state: 'user_confirmed_complete', recordedAt: 'synthetic', sourceMessageId: 'synthetic', printedAt: 'inferred-date'},
  ]) {
    const broken = clone(projection); change(broken);
    assert.throws(() => attachTeacherOverlay(broken, ui.root), /teacher_overlay_/);
    assert.equal(ui.root.innerHTML, ui.beforeHTML);
  }
}));

await test('production module contains no network browser storage global QA or source mutations', () => {
  const code = readFileSync(workspace + 'src/teacher-overlay.ts', 'utf8');
  assert(!/\b(fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage)\b/.test(code));
  assert(!/globalThis|window\.|ACADEMY_QA|C2_PROGRESS_QA|innerHTML\s*=/.test(code));
  const css = readFileSync(workspace + 'src/teacher-overlay.css', 'utf8');
  assert(!/\.numeric|\.raw-date|\.evidence-status|\.teacher\s*[,{]/.test(css));
});

await test('CSS keeps labels readable and secondary metadata at least 12px', () => withUI(ui => {
  const css = readFileSync(workspace + 'src/teacher-overlay.css', 'utf8');
  const fonts = [...css.matchAll(/font-size:\s*(\d+)px/g)].map(match => Number(match[1]));
  assert(fonts.length > 0 && fonts.every(size => size >= 12));
  const style = ui.w.document.createElement('style');
  style.textContent = readFileSync(workspace + 'src/rails.css', 'utf8') + css;
  ui.w.document.head.append(style);
  for (const [selector, size] of [
    ['.teacher-overlay-summary', 14], ['.teacher-overlay-row-state', 14],
    ['.teacher-overlay-number', 12], ['.teacher-overlay-detail-state', 14],
    ['.teacher-overlay-fields', 14], ['.teacher-overlay-detail-title', 16],
  ] as const) {
    assert.equal(ui.w.getComputedStyle(ui.root.querySelector(selector)).fontSize, `${size}px`, selector);
  }
}));

console.log(JSON.stringify({passed: true, checks: passed.length, tests: passed,
  fixture: 'synthetic_only', productionDataRead: false, siteOperations: false,
  browser: 'not_run_OS_socket_sandbox_blocker', layout: 'synthetic_DOM_and_computed_CSS_only' }));

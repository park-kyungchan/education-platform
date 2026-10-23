/**
 * Read-only presentation of the selected student's validated teacher-review projection.
 * Mount AFTER mountC2ProgressRails. Load teacher-overlay.css after rails.css.
 * The owner must scope the projection to the selected student and pinned snapshot,
 * pass null for every other student, and dispose before replacing the C2 view.
 * This module is not an authorization or source-hash verification boundary.
 */
export type TeacherReviewState = 'teacher_confirmed_complete' | 'unknown';
export type TeacherReviewEvidence = Readonly<{
  evidenceClass: string;
  recordedAt: string | null;
}>;
export type TeacherPrintConfirmation = Readonly<{
  state: 'user_confirmed_complete';
  recordedAt: string;
  printedTimeRaw: string;
  printedAt: null;
  printedAtState: 'relative_time_only_no_authoritative_timestamp';
  sourceMessageId: string;
  eventId: string;
  remediationPaths: readonly ('original_wrong' | 'similar_clinic')[];
  printedPageCount: null;
  actualPrintedSheetCount: null;
  materialIds: null;
  printHeaderVerified: false;
}>;
export type TeacherDeliveryPlan = Readonly<{
  state: 'planned';
  pickupAtLocal: string;
  precision: 'approximate' | 'exact';
  generatedAt: string | null;
  printedAt: string | null;
  deliveredAt: string | null;
  printExecutionState?: 'user_confirmed_complete' | 'unknown';
  handoffState?: 'not_confirmed';
  receiptState?: 'not_confirmed';
}>;
export type TeacherOverlayCandidate = Readonly<{
  /** A fixed source label. Never a join key or a new ordinal. */
  number: number;
  sourceRecordKey: string;
  sourceAttemptKey: string;
  score: number;
  attemptRawDate: string;
  appCatalogCode: string;
  originalWrongReview?: TeacherReviewState;
  similarClinicReview?: TeacherReviewState;
  printHeaderVerified: boolean;
  printExistence: 'unknown' | 'verified' | 'user_confirmed_present';
  verifiedPrintTestCode: string | null;
  /** User's printing confirmation; never a generated/printed timestamp or sheet count. */
  printConfirmation?: TeacherPrintConfirmation | null;
  reviewEvidence: Readonly<{
    originalWrong?: TeacherReviewEvidence | null;
    similarClinic?: TeacherReviewEvidence | null;
  }> | null;
  deliveryPlan: TeacherDeliveryPlan | null;
}>;
export type TeacherOverlay = Readonly<{
  version: '1.2.0' | '1.3.0';
  sha256: string;
  sourceSnapshotSha256: string;
  studentId: string;
  sourceRevision: string;
  summary: Readonly<{
    completedOriginalAttempts: number;
    completedPathDecisions: number;
    deliveryPlannedOriginalAttempts: number;
    deliveryPlannedPathCandidates: number;
    actualPrintedSheetCount: number | null;
    printedOriginalAttempts?: number;
    printedPathCandidates?: number;
  }>;
  candidates: readonly TeacherOverlayCandidate[];
}>;
export type TeacherOverlayHandle = Readonly<{
  /** Idempotent refresh. Does not modify C2 selection, source objects, or grades. */
  refresh(): void;
  /** Optional synchronous hook after rails.selectRecord(recordKey). */
  afterRecordRender(recordKey?: string): void;
  dispose(): void;
}>;

const mounted = new WeakMap<HTMLElement, TeacherOverlayHandle>();
const ownedAttribute = 'data-teacher-overlay-owned';
const complete = (state: TeacherReviewState | undefined) => state === 'teacher_confirmed_complete';
const stateText = (state: TeacherReviewState | undefined) => complete(state) ? '완료' : '미확인';
const present = (value: string | null | undefined) => value || '미확인';

function validateProjection(overlay: TeacherOverlay): void {
  if (!['1.2.0', '1.3.0'].includes(overlay.version) || !/^[a-f0-9]{64}$/.test(overlay.sha256)
    || !/^[a-f0-9]{64}$/.test(overlay.sourceSnapshotSha256)
    || !overlay.studentId || !overlay.sourceRevision || !Array.isArray(overlay.candidates)) {
    throw new Error('teacher_overlay_projection_invalid');
  }
  const summary = overlay.summary;
  const counts = [summary?.completedOriginalAttempts, summary?.completedPathDecisions,
    summary?.deliveryPlannedOriginalAttempts, summary?.deliveryPlannedPathCandidates];
  const printed = summary?.actualPrintedSheetCount;
  if (counts.some(n => typeof n !== 'number' || !Number.isInteger(n) || n < 0)
    || (printed !== null && (typeof printed !== 'number' || !Number.isInteger(printed) || printed < 0))) {
    throw new Error('teacher_overlay_summary_invalid');
  }
  if ((summary.printedOriginalAttempts !== undefined || summary.printedPathCandidates !== undefined)
    && [summary.printedOriginalAttempts, summary.printedPathCandidates].some(n =>
      typeof n !== 'number' || !Number.isInteger(n) || n < 0)) {
    throw new Error('teacher_overlay_summary_invalid');
  }
  const labels = new Set<number>(), attempts = new Set<string>();
  for (const candidate of overlay.candidates) {
    if (!Number.isInteger(candidate.number) || candidate.number < 1 || candidate.number > 21
      || labels.has(candidate.number) || !candidate.sourceRecordKey || !candidate.sourceAttemptKey
      || attempts.has(candidate.sourceAttemptKey)
      || [candidate.originalWrongReview, candidate.similarClinicReview].some(s =>
        s !== undefined && s !== 'unknown' && s !== 'teacher_confirmed_complete')) {
      throw new Error('teacher_overlay_candidate_invalid');
    }
    labels.add(candidate.number);
    attempts.add(candidate.sourceAttemptKey);
    const print = candidate.printConfirmation;
    if (print && (print.state !== 'user_confirmed_complete' || !print.recordedAt
      || !print.printedTimeRaw || print.printedAt !== null
      || print.printedAtState !== 'relative_time_only_no_authoritative_timestamp'
      || !print.sourceMessageId || !print.eventId || print.printedPageCount !== null
      || print.actualPrintedSheetCount !== null || print.materialIds !== null
      || print.printHeaderVerified !== false || !Array.isArray(print.remediationPaths)
      || print.remediationPaths.length !== 2 || !print.remediationPaths.includes('original_wrong')
      || !print.remediationPaths.includes('similar_clinic'))) {
      throw new Error('teacher_overlay_print_confirmation_invalid');
    }
  }
}

function rowText(candidate: TeacherOverlayCandidate): string {
  const review = `교사 확인: 원오답 ${stateText(candidate.originalWrongReview)} · 유사클리닉 ${stateText(candidate.similarClinicReview)}`;
  let text = review;
  if (candidate.deliveryPlan?.state === 'planned') {
    const planned = '원오답·유사클리닉 전달 예정';
    text = complete(candidate.originalWrongReview) || complete(candidate.similarClinicReview)
      ? `${review} · ${planned}` : planned;
  }
  if (candidate.printConfirmation?.state === 'user_confirmed_complete') {
    text += ' · 인쇄: 교사 확인 완료 (전달·수령 미확인)';
  }
  return text;
}

/** Alias retained for a simple owner integration: mountTeacherOverlay(overlay, root). */
export const mountTeacherOverlay = attachTeacherOverlay;

export function attachTeacherOverlay(overlay: TeacherOverlay | null, target: HTMLElement): TeacherOverlayHandle {
  if (overlay !== null) validateProjection(overlay);
  mounted.get(target)?.dispose();
  if (overlay === null) return {refresh() {}, afterRecordRender() {}, dispose() {}};

  const books = target.querySelector<HTMLElement>('#c2-books');
  if (!books) throw new Error('teacher_overlay_requires_mounted_c2');
  const document = target.ownerDocument;
  const groups = new Map<string, TeacherOverlayCandidate[]>();
  for (const candidate of overlay.candidates) {
    const group = groups.get(candidate.sourceRecordKey) ?? [];
    group.push(candidate);
    groups.set(candidate.sourceRecordKey, group);
  }
  let disposed = false, pending = false;
  const ownedNodes = new Set<HTMLElement>();
  const own = (node: HTMLElement, kind: string) => {
    node.setAttribute(ownedAttribute, kind);
    ownedNodes.add(node);
    return node;
  };
  const make = (tag: string, className: string, text?: string) => {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const pair = (list: HTMLElement, label: string, value: string) => {
    list.append(make('dt', '', label), make('dd', '', value));
  };
  const active = () => !disposed && target.contains(books);
  const evidenceText = (evidence?: TeacherReviewEvidence | null) => evidence
    ? `${evidence.evidenceClass} · 기록 시각 ${present(evidence.recordedAt)}` : '근거 미제공';

  function appendCandidateDetail(section: HTMLElement, candidate: TeacherOverlayCandidate): void {
    const article = make('div', 'teacher-overlay-candidate');
    article.append(make('p', 'teacher-overlay-detail-state', `#${candidate.number} · ${rowText(candidate)}`));
    const list = make('dl', 'teacher-overlay-fields');
    pair(list, '원오답 검토', `교사 확인 ${stateText(candidate.originalWrongReview)}`);
    pair(list, '유사클리닉 검토', `교사 확인 ${stateText(candidate.similarClinicReview)}`);
    const plan = candidate.deliveryPlan;
    pair(list, '전달 계획', plan?.state === 'planned'
      ? `${plan.pickupAtLocal} · ${plan.precision === 'approximate' ? '대략적인 예정 시각' : '예정 시각'}` : '미제공');
    const print = candidate.printConfirmation;
    pair(list, '교사 인쇄 확인', print?.state === 'user_confirmed_complete'
      ? `완료 · 사용자 기록 시각 ${print.recordedAt}` : '미확인');
    if (print) pair(list, '인쇄 시각 원문', `"${print.printedTimeRaw}" (사용자 원문) · 정확한 인쇄 사건 시각 미확인`);
    pair(list, '생성 / 인쇄 / 수령', print?.state === 'user_confirmed_complete'
      ? `생성 시각 ${present(plan?.generatedAt)} · 인쇄 시각 ${present(plan?.printedAt)} · 수령 ${present(plan?.deliveredAt)}`
      : `생성 ${present(plan?.generatedAt)} · 인쇄 ${present(plan?.printedAt)} · 수령 ${present(plan?.deliveredAt)}`);
    pair(list, '인쇄물 존재 근거', candidate.printExistence === 'user_confirmed_present'
      ? '교사 사용자 확인 · 실물·머리글·코드 검증 별도'
      : candidate.printExistence === 'verified' ? '별도 근거로 확인' : '미확인');
    pair(list, '인계 / 수령 확인', '인계 미확인 · 수령 미확인');
    pair(list, '인쇄 머리글 / 코드', `머리글 ${candidate.printHeaderVerified ? '확인' : '미검증'} · 코드 ${present(candidate.verifiedPrintTestCode) === '미확인' ? '미검증' : candidate.verifiedPrintTestCode}`);
    article.append(list);
    const source = make('details', 'teacher-overlay-provenance');
    source.append(make('summary', '', '대조 대상·출처·확인 시각'));
    const fields = make('dl', 'teacher-overlay-fields');
    pair(fields, '고정 후보 번호', String(candidate.number));
    pair(fields, '원본 기록 키', candidate.sourceRecordKey);
    pair(fields, '원본 응시 키', candidate.sourceAttemptKey);
    pair(fields, '원본 점수 / 날짜', `${candidate.score}점 · ${candidate.attemptRawDate}`);
    pair(fields, '앱 목록 코드', `${candidate.appCatalogCode} · 인쇄 코드와의 대응 미검증`);
    pair(fields, '원오답 확인 근거', evidenceText(candidate.reviewEvidence?.originalWrong));
    pair(fields, '유사클리닉 확인 근거', evidenceText(candidate.reviewEvidence?.similarClinic));
    if (print) {
      pair(fields, '인쇄 확인 출처', `${print.sourceMessageId} · ${print.eventId}`);
      pair(fields, '인쇄 확인 경로', print.remediationPaths.join(' · '));
      pair(fields, '인쇄 사건 시각', 'null · 상대 시각 원문만 보존 (정확한 시각 미확인)');
      pair(fields, '페이지 / 장수 / 자료 ID', 'null / null / null · 미확인');
    }
    pair(fields, '학생 / 리비전', `${overlay!.studentId} · ${overlay!.sourceRevision}`);
    pair(fields, '교사 대조 SHA-256', overlay!.sha256);
    pair(fields, '원본 스냅샷 SHA-256', overlay!.sourceSnapshotSha256);
    source.append(fields);
    article.append(source);
    section.append(article);
  }

  function restoreInline(recordKey?: string): void {
    if (!active()) return;
    for (const row of books!.querySelectorAll<HTMLElement>('[data-record-container]')) {
      const key = row.getAttribute('data-record-container')!;
      if (recordKey !== undefined && key !== recordKey) continue;
      const candidates = groups.get(key);
      if (!candidates) continue;
      const body = row.querySelector<HTMLElement>('.inline-evidence');
      // Wait for normal C2 evidence. Never replace or create the original detail body.
      if (!body || ![...body.children].some(node => !node.hasAttribute(ownedAttribute))
        || [...body.children].some(node => node.getAttribute(ownedAttribute) === 'detail')) continue;
      const section = own(make('section', 'teacher-overlay-detail'), 'detail');
      section.setAttribute('aria-label', '독립된 교사 대조 근거');
      section.append(make('h6', 'teacher-overlay-detail-title', '교사 대조 · 별도 확인 축'));
      section.append(make('p', 'teacher-overlay-separation', '이 대조는 응시별 원오답·유사클리닉 검토입니다. 원본의 섹션 교사 판단·앱 점수·클리닉 상태와 별도로 보존합니다. 점수 100이나 검토 근거 없음으로 완료·미완료를 판단하지 않습니다. 전달 계획은 실제 생성·인쇄·수령 확인을 대신하지 않습니다.'));
      candidates.forEach(candidate => appendCandidateDetail(section, candidate));
      body.append(section);
    }
  }

  function refresh(): void {
    if (!active()) return;
    // Prune detached details after the source renderer replaces its detail HTML.
    for (const node of ownedNodes) if (!target.contains(node)) ownedNodes.delete(node);
    if (!target.querySelector(`[${ownedAttribute}="summary"]`)) {
      const s = overlay!.summary;
      const completed = s.completedPathDecisions === s.completedOriginalAttempts * 2
        ? `원응시 ${s.completedOriginalAttempts}건 × 원오답·유사클리닉 2경로 완료 (${s.completedPathDecisions}건)`
        : `원응시 ${s.completedOriginalAttempts}건 · 원오답·유사클리닉 ${s.completedPathDecisions}경로 완료`;
      const printed = s.actualPrintedSheetCount === null ? '미확인' : `${s.actualPrintedSheetCount}장`;
      const printConfirmation = s.printedOriginalAttempts === undefined ? ''
        : ` · 인쇄 교사 확인 원응시 ${s.printedOriginalAttempts}건 · ${s.printedPathCandidates}경로 후보`;
      const summary = own(make('p', 'teacher-overlay-summary', `교사 대조 v${overlay!.version}: ${completed} · 전달 예정 원응시 ${s.deliveryPlannedOriginalAttempts}건 × 2경로 (${s.deliveryPlannedPathCandidates}후보)${printConfirmation} · 실제 인쇄 장수 ${printed} · ${overlay!.sourceRevision} 응시별 대조 (원본 섹션 판단 별도)`), 'summary');
      summary.setAttribute('aria-label', '교사 대조 요약');
      books!.before(summary);
    }
    for (const row of books!.querySelectorAll<HTMLElement>('[data-record-container]')) {
      const candidates = groups.get(row.getAttribute('data-record-container')!);
      const label = row.querySelector<HTMLElement>('.record-summary .record-label');
      if (!candidates || !label || label.querySelector(`[${ownedAttribute}="row"]`)) continue;
      const badges = own(make('span', 'teacher-overlay-row'), 'row');
      for (const candidate of candidates) {
        const badge = make('span', 'teacher-overlay-row-entry');
        badge.append(make('span', 'teacher-overlay-number', `#${candidate.number}`), make('span', 'teacher-overlay-row-state', rowText(candidate)));
        badges.append(badge);
      }
      label.append(badges);
    }
    restoreInline();
  }

  function scheduleRestore(): void {
    if (pending || !active()) return;
    pending = true;
    queueMicrotask(() => {pending = false; if (active()) refresh();});
  }
  const delegated = (event: Event) => {
    const node = event.target as Node | null;
    const element = node?.nodeType === 1 ? node as Element : node?.parentElement;
    if (element?.closest('[data-record-id], [data-close-record]')) scheduleRestore();
  };
  target.addEventListener('click', delegated);
  target.addEventListener('keydown', delegated);

  // Covers programmatic C2 selection as well as delegated clicks/keyboard events.
  // Ignore our own appended sections to avoid a mutation-refresh loop.
  const Observer = document.defaultView?.MutationObserver;
  const observer = Observer ? new Observer(mutations => {
    if (!active()) {dispose(); return;}
    if (mutations.some(mutation => {
      const element = mutation.target as Element;
      return element.nodeType === 1 && element.matches('.inline-evidence')
        && [...mutation.addedNodes, ...mutation.removedNodes].some(node =>
          node.nodeType !== 1 || !(node as Element).hasAttribute(ownedAttribute));
    })) scheduleRestore();
  }) : null;
  function dispose(): void {
    if (disposed) return;
    disposed = true;
    observer?.disconnect();
    target.removeEventListener('click', delegated);
    target.removeEventListener('keydown', delegated);
    for (const node of ownedNodes) node.remove();
    ownedNodes.clear();
    if (mounted.get(target) === handle) mounted.delete(target);
  }
  const handle: TeacherOverlayHandle = {refresh, afterRecordRender: restoreInline, dispose};
  mounted.set(target, handle);
  refresh();
  observer?.observe(target, {childList: true, subtree: true});
  return handle;
}

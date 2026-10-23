(() => {
  // ../academy-fieldbook-v20-synthetic-qa/v21app/fixture.ts
  var SYNTHETIC_NOTICE = "완전 합성 QA · 실제 학생 0명 · 로그인·학원 서버·native WebMCP 검증 아님";
  var hash = (n) => n.toString(16).padStart(64, "0");
  var stamp = "2030-01-08T00:00:00.000Z";
  var students = Array.from({ length: 5 }, (_, n) => ({ id: `fiction-student-${n + 1}`, displayName: ["가상학생 가람", "가상학생 나래", "가상학생 다온", "가상학생 라온", "가상학생 마루"][n], managementState: "active" }));
  var sections = ["개념 정리", "기본 문제", "응용 문제", "단원 마무리"];
  function makeView(id) {
    const number = students.findIndex((s) => s.id === id), records = {}, books = [], includedContents = [], candidates = [];
    for (let b = 1;b <= 3; b++) {
      const rows = [], bookCode = `FICTION-${b}`, bookTitle = ["가상 수학 탐구 A", "가상 수학 탐구 B: 긴 교재명 반응형 검수", "가상 개념 연습 C"][b - 1];
      for (let m = 1;m <= 2; m++) {
        const major = `${id}-book${b}-major${m}`;
        rows.push({ id: major, label: `${m}`, title: `가상 대단원 ${m}`, level: "major", parentId: null, recordIds: [], raw: { printedStartPage: 10 * m, tocEvidencePdfPage: null } });
        for (let u = 1;u <= 2; u++) {
          const rowId = `${major}-unit${u}`, unitLabel = `${m}.${u}`, unitTitle = u === 1 ? "가상 수의 관계" : "길이가 긴 가상 단원 제목과 수학적 표현을 탐구하는 연습", recordIds = [];
          for (let s = 0;s < 4; s++) {
            const rid = `${rowId}-section${s}`, withAttempt = (s + u + b + number) % 2 === 0, catalogCode = `F${b}M${m}U${u}S${s}`, score = [65, 80, 95, 100][(s + m + u + number) % 4];
            const attempt = { sourceAttemptId: `${rid}-attempt1`, sourceAttemptKey: `${rid}-attempt1`, score, dateRaw: "1월 7일 (합성)", yearState: "unknown", timezoneState: "unknown", occurredAt: null, effectiveAt: null, observedAt: null, recordedAt: stamp, nativeAttemptId: null, sourceResultLabel: "합성 점수 관찰", clinicText: "합성 클리닉 메모", sourceUrl: null };
            records[rid] = { recordId: rid, tocNodeRef: rowId, bookCode, bookDisplayName: bookTitle, edition: 2030, unitLabel, unitTitle, sectionDisplayLabel: sections[s], sectionSourceLabel: sections[s], publicSectionLabel: sections[s], publicSectionTemplateRef: `section-${s}`, catalogCode, lessonIndex: s + 1, performanceState: withAttempt ? "observed" : s === 2 ? "observed_absent" : "not_checked", evidenceState: withAttempt ? "observed" : "not_checked", mappingState: s === 3 ? "mapping_unknown" : "provisional_catalog_join", sectionApplicabilityState: "observed_in_native_catalog", catalogPresence: "observed_in_native_catalog", attemptEvidence: withAttempt ? [attempt] : [], teacherVerdict: { state: "not_determined", value: "unknown", note: "합성 테스트에서 완료를 추정하지 않습니다." }, paperEvidence: { state: "not_checked" }, progressDecision: "not_determined", diaryAssertions: [], sourceUrls: [] };
            recordIds.push(rid);
            if (withAttempt && candidates.length < 12)
              candidates.push({ number: candidates.length + 1, sourceRecordKey: rid, sourceAttemptKey: attempt.sourceAttemptKey, score, attemptRawDate: attempt.dateRaw, appCatalogCode: catalogCode, originalWrongReview: candidates.length % 3 === 0 ? "teacher_confirmed_complete" : "unknown", similarClinicReview: candidates.length % 4 === 0 ? "teacher_confirmed_complete" : "unknown", printHeaderVerified: false, printExistence: "unknown", verifiedPrintTestCode: null, reviewEvidence: { originalWrong: { evidenceClass: "fictional_teacher_report", recordedAt: stamp }, similarClinic: null }, deliveryPlan: candidates.length % 2 === 0 ? { state: "planned", pickupAtLocal: "2030-01-09T16:00:00", precision: "approximate", generatedAt: null, printedAt: null, deliveredAt: null } : null });
          }
          rows.push({ id: rowId, label: unitLabel, title: unitTitle, level: "subunit", parentId: major, recordIds, raw: { printedStartPage: 10 * m + u, tocEvidencePdfPage: null } });
          includedContents.push({ sourceRecordKey: `${rowId}-included`, printedSourceLabel: "서술형 합성 포함 내용", tocNodeRef: rowId, parentSourceRecordId: recordIds[3], parentCatalogCode: records[recordIds[3]].catalogCode, parentLessonIndex: 4, nativeBindingState: "fictional_inclusion_only" });
        }
      }
      books.push({ key: `${id}-book${b}`, label: bookTitle, edition: 2030, rows, raw: { bookCode, originalBookTitle: bookTitle, sourceEditionBinding: { publicRevisionLabel: "합성 판본" }, sectionFlow: sections.map((sourceLabel, order) => ({ sourceLabel, order, cacheRef: `section-${order}` })) }, tocCoverage: { state: "native_catalog_only" }, performanceCoverage: { attemptObservationCount: rows.flatMap((r) => r.recordIds).filter((r) => records[r].attemptEvidence.length).length } });
    }
    const view = { studentLabel: students[number].displayName, books, records, unmappedRecordIds: [], sourceContractVersion: "synthetic-qa-only/1", sourceAsOf: { studentPerformance: null, editionCacheVerifiedAt: null }, unmappedAssertions: [{ dateRaw: "합성 날짜", statement: "합성 일지 연결 미확정 원문", reason: "화면 검수를 위한 허구", sourceUrl: null }], raw: { currentHomeworkSource: "가상 문제집 p.12~15 · 가상 배정" }, inputSha256: hash(1), notebookEvidence: [], questionCoverage: { state: "not_captured", observedItemCount: 0, totalItems: null }, terminologyPolicy: { synthetic: true } };
    for (const candidate of candidates)
      if (candidate.number % 3 === 0) {
        candidate.printExistence = "user_confirmed_present";
        candidate.printConfirmation = { state: "user_confirmed_complete", recordedAt: stamp, printedTimeRaw: "합성 인쇄 보고 날짜", printedAt: null, printedAtState: "relative_time_only_no_authoritative_timestamp", sourceMessageId: `fiction-print-message-${candidate.number}`, eventId: `fiction-print-event-${candidate.number}`, remediationPaths: ["original_wrong", "similar_clinic"], printedPageCount: null, actualPrintedSheetCount: null, materialIds: null, printHeaderVerified: false };
      }
    return { view, includedContents, candidates };
  }
  var sourceHash = hash(1);
  var gradingPin = hash(2);
  var evidencePin = hash(3);
  var assessmentPin = hash(4);
  var teacherPin = hash(5);
  var scopePin = hash(6);
  var domainPin = hash(7);
  var bindingPin = hash(8);
  var assessmentContract = hash(9);
  var catalogPin = hash(10);
  var membershipPin = hash(11);
  var registryPin = hash(12);
  function makeEvidence(studentId, view) {
    const evidenceRecords = [], decisionRecords = [], recordEvidenceIds = {}, recordDecisionIds = {};
    for (const r of Object.values(view.records))
      if (r.attemptEvidence.length) {
        const eid = `${r.recordId}-evidence`, did = `${r.recordId}-decision`;
        evidenceRecords.push({ evidenceId: eid, sourceKind: "imported_snapshot", verificationStatus: "unverified", claim: { type: "grading_observation", value: { score: r.attemptEvidence[0].score, eventTimeRaw: "1월 7일 (합성)" } }, observedAt: null, reportedAt: null, recordedAt: stamp, timeRaw: "합성 시각, 실제 사건 아님", supersedesEvidenceIds: [], retractsEvidenceIds: [], conflictingEvidenceIds: [], sourceRef: { reference: "fiction-generated-in-this-harness", jsonPointer: `/fiction/records/${r.recordId}` }, revision: "synthetic-1" });
        decisionRecords.push({ decisionId: did, decisionAuthority: { role: "합성 교사" }, decisionStatus: "pending", ruleVersion: "synthetic-1" });
        recordEvidenceIds[r.recordId] = [eid];
        recordDecisionIds[r.recordId] = [did];
      }
    return { version: "1.0.0", studentId, sourceSnapshotSha256: sourceHash, namespaceBinding: { bindingId: `${studentId}-binding`, studentId, studentPageId: `fiction-page-${studentId}`, spaceStudentId: studentId }, externalSourceQueried: false, lastSuccessfulRefreshedAt: null, queriedAt: null, evidenceRecords, decisionRecords, recordEvidenceIds, recordDecisionIds, assignments: [{ assignmentId: `${studentId}-assignment`, nativeBookTitleRaw: "가상 수학 탐구 A", appGradingUnitCount: 2, tentativeNextAttendanceDate: "2030-01-09", scopeItems: Object.values(view.records).slice(0, 2).map((r) => ({ scopeItemId: r.recordId, existingRecordRef: r.recordId, nativeGroupingLabel: r.unitLabel, nativeTitleRaw: r.unitTitle, nativeSectionLabelRaw: r.sectionDisplayLabel, lessonIndex: r.lessonIndex, catalogCode: r.catalogCode, embeddedContents: [] })) }] };
  }
  function events(studentId) {
    const displayName = students.find((s) => s.id === studentId).displayName;
    return { schemaVersion: "academy.student-current/1.0.0", sourceMode: "saved_snapshot", liveRefreshConnected: false, persistentWriteAdapterConnected: false, automaticPageSiteSyncConnected: false, executionAuthorityGranted: false, verification: { eventBundleHashVerified: true, modelContractHashVerified: true, runtimeSchemaValidated: true, syntheticFixtureOnly: true }, studentIds: [studentId], assignments: [{ studentId, displayName, assignmentId: `${studentId}-assignment`, label: "가상 수학 탐구 A · 연습 두 단원", assignmentStatus: "teacher_confirmed", studentCompletion: "unknown", lmsEntry: "unknown", parentMessageSent: "unknown", effectiveDue: { date: "2030-01-09" }, dueState: "confirmed" }], checklist: [{ studentId, displayName, stage: "practice", labelRaw: "가상 문제 풀이", state: "unknown", checked: false, authorityGranted: false }, { studentId, displayName, stage: "review", labelRaw: "가상 오답 검토", state: "planned", checked: false, authorityGranted: false }], schedules: [], references: [], conflicts: [], sourceEvidence: [], attendance: [], dateCohorts: [], sourceFreshness: { latestSourceReportedAt: stamp, latestSourceObservedAt: null } };
  }
  function makeSnapshot(studentId = students[0].id) {
    if (!students.some((s) => s.id === studentId))
      throw Error("unknown_fiction_student");
    const { view, includedContents, candidates } = makeView(studentId), teacherOverlay = { version: "1.3.0", studentId, sha256: teacherPin, sourceSnapshotSha256: sourceHash, sourceRevision: "synthetic-1", summary: { completedOriginalAttempts: 4, completedPathDecisions: 7, deliveryPlannedOriginalAttempts: 6, deliveryPlannedPathCandidates: 12, actualPrintedSheetCount: null, printedOriginalAttempts: 4, printedPathCandidates: 8 }, candidates };
    const snapshot = { sourceHash, view, sourceCoverage: [{ module: "가상 학습 기록", sourceAsOf: null, completeness: "합성 QA 전용", queryScope: "실제 학원 조회 0회" }], unresolvedAttempts: [{ sourceAttemptId: `${studentId}-unbound`, displayedAt: { raw: "합성 날짜" }, score: 75, fictional: true }] };
    const projectionMap = (pin) => Object.fromEntries(students.map((s) => [s.id, pin]));
    return { status: "success", studentId, selectedStudent: { id: studentId, pageId: `fiction-page-${studentId}`, enrollments: [{ id: `${studentId}-enrollment`, courseTitle: "합성 정규반", validFrom: null, validTo: null, status: "합성 등록" }] }, snapshot, gradingProjection: { version: "1.1.0", studentId, sourceSnapshotSha256: sourceHash, view, includedContents, excludedStandaloneRecordIds: [], completionDenominator: null }, teacherOverlay, evidenceProjection: makeEvidence(studentId, view), assessmentProjection: { version: "1.0.0", studentId, sourceSnapshotSha256: sourceHash, sourceEvidenceProjectionSha256: evidencePin, namespaceBindingSha256: bindingPin, coverage: { state: "not_collected", actualAttemptCount: 0, queriedAt: null, lastSuccessfulRefreshedAt: null }, assessmentAttempts: [], diaryCoverage: { state: "partial", projectedDiaryCount: 1, dtMentionCount: 1, sourceDiaryCount: 1, nonEmptyProgressCount: 1, emptyProgressCount: 0 }, diaryEvidence: [{ sourceDiaryId: `${studentId}-diary`, priorProjectionState: "preserved_unbound", mentionsDT: true, evidence: { claim: { value: { dateRaw: "1월 8일 (합성)", progressSummary: "합성 일지: DT 활동 언급, 실제 시험 응시 아님.", homeworkSummary: "합성 연습 문제", originalSource: { fileName: "fiction-generated", jsonPointer: "/fiction/diary/0", fileSha256: sourceHash } } } } }] }, studentEventOverlay: events(studentId), refreshReadiness: { studentId, state: "unavailable", reason: "LIVE_ADAPTER_NOT_CONNECTED", nativeIdentityVerified: false, backendAttemptStarted: false, lastBackendAttemptAt: null, lastSuccessfulRefreshedAt: null, externalRequests: 0, areas: [{ areaId: "fiction", label: "합성 학습 기록", stages: { menu_observed: false, request_captured: false, offline_parser_verified: false, auth_connected: false, live_read_verified: false, published_verified: false }, blockers: ["합성 UI 검수"] }] }, verification: { contextGatePassed: true, navigationGatePassed: true, syntheticFixtureOnly: true, authenticatedOwnerPrivateDispatch: false, externalSourceQueried: false }, receipt: { loadStatus: "verified", runtimeReceipt: true, scopeFingerprint: scopePin, syntheticFixtureOnly: true }, navigationReceipt: { loadStatus: "verified", runtimeReceipt: true, scopeFingerprint: scopePin, syntheticFixtureOnly: true }, domainReceipt: { studentId, runtimeSchemaValidated: true, fullContractByteHashVerified: true, namespaceBindingValidated: true, evidenceProjectionSha256: evidencePin, contextScopeFingerprint: scopePin, contractSha256: domainPin, namespaceBindingSha256: bindingPin, contractVersion: "synthetic-renderer-contract", syntheticFixtureOnly: true }, assessmentReceipt: { studentId, runtimeSchemaValidated: true, fullContractByteHashVerified: true, assessmentProjectionSha256: assessmentPin, contractSha256: assessmentContract, contextScopeFingerprint: scopePin, syntheticFixtureOnly: true }, scope: { studentId, gradingProjectionSha256: gradingPin, evidenceProjectionSha256: evidencePin, assessmentProjectionSha256: assessmentPin, teacherOverlayProjectionSha256: teacherPin, sourceRevisions: { gradingProjection: gradingPin, evidenceProjection: evidencePin, domainContract: domainPin, namespaceBinding: bindingPin, assessmentProjection: assessmentPin, assessmentContract, teacherOverlayProjection: teacherPin, teacherOverlaySource: teacherPin, teacherOverlayRevision: "synthetic-1" } }, meta: { students, rosterRevision: "synthetic-roster-1", registrySha256: registryPin, snapshotProjectionSha256: projectionMap(sourceHash), gradingProjectionSha256: projectionMap(gradingPin), evidenceProjectionSha256: projectionMap(evidencePin), assessmentProjectionSha256: projectionMap(assessmentPin), teacherOverlayProjectionSha256: projectionMap(teacherPin), domainContractSha256: domainPin, assessmentContractSha256: assessmentContract, bundleBuiltAt: "2030-01-08 (합성 테스트 날짜)", sourceMode: "saved_snapshot", liveRefreshConnected: false } };
  }
  function makeWorkflow(input) {
    const policies = Array.from({ length: 4 }, (_, i) => ({ policyId: `fiction-policy-${i + 1}`, labelRaw: ["합성 숙제 확인 기준", "합성 오답 검토 기준", "합성 수업 준비 기준", "합성 교사 확인 기준"][i], domain: "teaching_coaching", lifecycle: "active" }));
    const result = { schemaVersion: "academy.work-context/1.0.0", view: input.view, revisions: { catalogRevision: catalogPin, membershipRevision: membershipPin, registrySha256: registryPin, rosterRevision: "synthetic-roster-1" }, verification: { contextGatePassed: true, fullContractByteHashVerified: true, authenticatedOwnerPrivateDispatch: true, registryVersion: "1.2.0", contextScopeFingerprint: scopePin, studentRecordsChanged: false, nativeWebMcpVerified: false, externalSourceQueried: false, liveAdapterConnected: false, syntheticFixtureOnly: true } };
    if (input.view === "policy-index") {
      const matching = policies.filter((p) => !input.domain || p.domain === input.domain), offset = input.offset ?? 0, limit = input.limit ?? 8;
      return { ...result, policies: matching.slice(offset, offset + limit), domains: [], pagination: { offset, limit, total: matching.length, hasMore: offset + limit < matching.length } };
    }
    const nodes = (input.policyIds ?? []).flatMap((id) => {
      const p = policies.find((x) => x.policyId === id);
      return [{ id, kind: "policy", domain: p.domain, labelRaw: p.labelRaw, knowledge: "unknown", lifecycle: "active", applicability: { activationRaw: "합성 기준" }, cadenceRaw: "합성 주기", deadlineRaw: "미정", scopeRaw: "합성 UI 검수", responsibilityRaw: "가상 교사", preconditions: [], exceptions: [], sourceAnchorIds: [] }, { id: id + "-step", kind: "step", labelRaw: "가상 근거 확인", order: 0, sourceAnchorIds: [] }];
    });
    return { ...result, preparation: { kind: "workflow_preparation_reference", requestedDate: input.date, timezone: "Asia/Seoul", actionBoundary: { externalSourceQueried: false, studentRecordsChanged: false }, studentWork: { taskCount: null, emptyMeansNoTasks: false, assignments: { state: "not_loaded" }, executionAttempts: { state: "not_loaded" } }, dateCohorts: { classDate: input.date, timezone: "Asia/Seoul", source: { sha256: membershipPin, confirmedAsOf: "2000-01-01", receivedAt: stamp }, rosterRevision: { rosterRevision: "synthetic-roster-1" }, coverage: { attendanceInferred: false, liveLmsQueryPerformed: false }, unverified: [], cohorts: [1, 2].filter((n) => input.session === "all" || input.session === n).map((n) => ({ classDate: input.date, sessionSlot: { ordinal: n }, attendanceState: "not_assessed", taskCount: null, emptyMeansNoClass: false, members: students.filter((_, i) => i % 2 === n - 1).map((s) => ({ ...s, studentId: s.id, liveVerified: false, effectiveFrom: null, effectiveTo: null, confirmedAsOf: "2000-01-01", sessionSlot: { ordinal: n }, applicability: "projected_pattern_not_date_verified", enrollmentWeekdayPattern: { label: "합성 요일 패턴" } })) })) }, workflowTemplate: { nodes, relations: (input.policyIds ?? []).map((id) => ({ kind: "contains", from: id, to: id + "-step", order: 0 })), sources: [], meaning: "selected_policy_reference_not_student_tasks", revision: catalogPin }, sourceCoverage: [] }, unconfirmedRosterStudentCount: 0 };
  }
  function makeToday(input) {
    return { status: "success", result: { domain: "academy", kind: "daily_preparation", sourceMode: "saved_snapshot", liveRefreshConnected: false, requestedDate: input.date, current: { state: "unverified" }, sessions: [{ session: "1", state: "unverified" }, { session: "2", state: "unverified" }] } };
  }

  // ../academy-fieldbook-v20-synthetic-qa/v21app/safety.ts
  var calls = [];
  var blocked = [];
  var errors = [];
  var clicks = [];
  var failNext = null;
  var qa = { fixtureOnly: true, nativeIdentityVerified: false, nativeWebMcpVerified: false, externalRequests: 0, calls, blocked, errors, notice: SYNTHETIC_NOTICE, failNext: (status = 401) => {
    failNext = status;
  } };
  Object.defineProperty(window, "SYNTHETIC_QA", { value: qa });
  Object.defineProperty(document, "modelContext", { value: undefined, configurable: false });
  window.fetch = async (url, options = {}) => {
    const path = typeof url === "string" ? url : "";
    if (!["/api/init", "/api/student-snapshot", "/api/academy/work-context", "/api/academy/today"].includes(path) || options.method !== "POST" || options.credentials !== "same-origin" || options.redirect !== "manual") {
      blocked.push({ kind: "fetch", path });
      throw Error("synthetic_fixture_network_blocked");
    }
    if (options.signal?.aborted)
      throw new DOMException("Aborted", "AbortError");
    const payload = JSON.parse(options.body ?? "{}");
    calls.push({ path, payload, fixtureOnly: true });
    if (failNext) {
      const status = failNext;
      failNext = null;
      return Response.json({ status: "synthetic_forced_failure" }, { status });
    }
    const result = path === "/api/init" ? makeSnapshot() : path === "/api/student-snapshot" ? makeSnapshot(payload.studentId) : path === "/api/academy/work-context" ? { status: "success", result: makeWorkflow(payload) } : makeToday(payload);
    return Response.json(result);
  };
  for (const name of ["XMLHttpRequest", "WebSocket", "EventSource", "Worker", "SharedWorker"]) {
    Object.defineProperty(window, name, { value: class {
      constructor() {
        blocked.push({ kind: name });
        throw Error("synthetic_fixture_network_blocked");
      }
    }, configurable: false });
  }
  Object.defineProperty(window, "open", { value: () => {
    blocked.push({ kind: "window.open" });
    return null;
  } });
  try {
    Object.defineProperty(navigator, "sendBeacon", { value: () => {
      blocked.push({ kind: "sendBeacon" });
      return false;
    } });
  } catch {}
  document.addEventListener("click", (event) => {
    const target = event.target;
    const button = target?.closest("button");
    if (button)
      clicks.push({ label: button.textContent, studentId: button.getAttribute("data-student-id"), inShell: !!button.closest("#app-shell"), defaultPrevented: event.defaultPrevented, trusted: event.isTrusted });
    const link = event.target?.closest("a");
    if (link && !link.getAttribute("href")?.startsWith("#")) {
      event.preventDefault();
      blocked.push({ kind: "source_link", href: link.getAttribute("href") });
    }
  }, true);
  document.addEventListener("submit", (event) => {
    event.preventDefault();
    blocked.push({ kind: "submit" });
  }, true);
  window.addEventListener("error", (event) => errors.push(String(event.error ?? event.message)));
  window.addEventListener("unhandledrejection", (event) => errors.push(String(event.reason)));
  qa.dimensions = () => ({ innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, desktop: document.body.classList.contains("desktop-academy"), recordCount: document.querySelectorAll("[data-record-id]").length, books: document.querySelectorAll(".book").length, student: document.querySelector('[data-student-id][aria-pressed="true"]')?.textContent, errors: [...errors], lastClicks: clicks.slice(-4), studentNavUnderShell: !!document.querySelector("#app-shell .student-nav"), lastCalls: calls.slice(-4).map((c) => ({ path: c.path, studentId: c.payload.studentId })), loadErrors: [...document.querySelectorAll(".load-error")].map((n) => n.textContent), overflowElements: [...document.body.querySelectorAll("*")].map((node) => ({ node: node.tagName.toLowerCase() + (node.className ? " ." + String(node.className).replace(/ /g, ".") : ""), left: Math.round(node.getBoundingClientRect().left), right: Math.round(node.getBoundingClientRect().right) })).filter((n) => n.left < -1 || n.right > document.documentElement.clientWidth + 1).slice(0, 8) });
})();

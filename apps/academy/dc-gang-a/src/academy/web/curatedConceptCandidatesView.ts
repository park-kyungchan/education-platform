import type {
  CuratedConceptCandidateReply,
  ElementaryConceptDomain,
} from "../contracts/curatedConceptCandidates";

const labels: Record<ElementaryConceptDomain, string> = {
  "number-and-operations": "수와 연산",
  "change-and-relationships": "변화와 관계",
  "shapes-and-measurement": "도형과 측정",
  "data-and-likelihood": "자료와 가능성",
};
function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = "") {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}
/** Public-source definition candidates have no teacher-write or student-link action. */
export function curatedConceptCandidatesView(
  read: () => Promise<CuratedConceptCandidateReply>,
) {
  const section = element("section");
  section.id = "curated-concept-candidates-workspace";
  section.className = "concept-graph";
  section.append(
    element("h2", "초등 수학 개념 후보"),
    element(
      "p",
      "공식 교육과정의 범위에 연결한 정의 후보입니다. 교사가 작성·검토한 정의와 학생 근거 관계는 별도로 유지합니다.",
    ),
  );
  const button = element("button", "개념 후보와 출처 보기");
  button.type = "button";
  button.dataset.role = "curated-catalog-load";
  const status = element("p");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const content = element("div");
  section.append(button, status, content);
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      const reply = await read();
      if (!section.isConnected) return;
      if (
        reply.state !== "ready" ||
        reply.qualification !== "curated_candidate_snapshot" ||
        reply.semanticAcceptance !== "unknown" ||
        reply.teacherPersistence !== false ||
        reply.studentRelations.length
      )
        throw Error("candidate_scope_conflict");
      const snapshot = reply.snapshot;
      content.replaceChildren();
      status.textContent =
        "정의 후보 " +
        snapshot.coverage.candidateConcepts +
        "개 · 성취기준 " +
        snapshot.coverage.officialUniqueElementaryStandardCodesObserved +
        "개 중 " +
        snapshot.coverage.referencedOfficialCodes +
        "개에 범위 참조 · 미연결 " +
        snapshot.coverage.unmappedOfficialCodes.length +
        "개 · atomicity 검토 미확정";
      content.append(
        element(
          "p",
          "교육과정 edition: " + snapshot.curriculumEdition.literalKey,
        ),
        element(
          "p",
          "학년군 1–2 / 3–4 / 5–6 · 4개 영역의 12개 칸에 후보가 있습니다. 개념 분해의 완전성이나 학생의 숙련도를 뜻하지 않습니다.",
        ),
      );
      const applicability = element("details");
      applicability.append(element("summary", "적용 시기와 개정 범위"));
      for (const band of ["1-2", "3-4", "5-6"] as const)
        applicability.append(
          element(
            "p",
            band +
              "학년: " +
              snapshot.applicability.original2022StartDates[band] +
              "부터 2022 교육과정 적용",
          ),
        );
      applicability.append(
        element(
          "p",
          "확인한 2026-1 고시의 개정 대상은 별책 1·2·3·4·15입니다. 수학 별책8을 새로운 2026 수학 edition으로 바꾸지 않았습니다. 다른 별책8 개정의 전수 확인 및 실제 학생 교재 적용은 미확정입니다.",
        ),
      );
      const amendment = element("a", "공식 2026 고시 PDF · 원문 3·4·7쪽");
      amendment.href =
        "https://www.ne.go.kr/component/file/ND_fileDownload.do?q_fileSn=666&q_fileId=b741961e-773c-4f93-a396-1f3a9608ea11";
      amendment.rel = "noreferrer";
      applicability.append(amendment);
      content.append(applicability);
      const gaps = element("details");
      gaps.dataset.role = "curated-catalog-gaps";
      gaps.append(element("summary", "연결하지 않은 성취기준 62개와 한계"));
      const codes = element(
        "p",
        snapshot.coverage.unmappedOfficialCodes.join(" · "),
      );
      codes.dataset.role = "unmapped-standard-codes";
      gaps.append(codes);
      gaps.append(
        element(
          "p",
          "공식 성취기준 전체의 atomic concept 분해는 제공하지 않습니다. HWP 물리적 쪽수·수식·도형 배치, 출판사·교재 edition 및 학기 배치는 확인하지 않았습니다. 기존 Task crosswalk와 출판사 배치 제안은 공식 standardRefs와 별개입니다.",
        ),
      );
      content.append(gaps);
      for (const band of ["1-2", "3-4", "5-6"] as const)
        for (const domain of Object.keys(labels) as ElementaryConceptDomain[]) {
          const group = element("details");
          group.dataset.bandDomain = band + "/" + domain;
          const rows = snapshot.concepts.filter(
            (row) => row.primaryGradeBand === band && row.domain === domain,
          );
          group.append(
            element(
              "summary",
              band +
                "학년 · " +
                labels[domain] +
                " · 후보 " +
                rows.length +
                "개",
            ),
          );
          for (const row of rows) {
            const card = element("details");
            card.dataset.candidateId = row.candidateId;
            card.className = "concept-node";
            card.append(
              element("summary", row.conceptRevision.label + " · 정의 후보"),
              element("p", row.conceptRevision.definition),
              element(
                "p",
                "Atomicity: 검토 미확정 · " + row.atomicity.rationale,
              ),
              element("p", "출판사·교재 배치: 미확정"),
            );
            const references = element("ul");
            for (const ref of row.standardRefs) {
              const item = element("li"),
                link = element("a", ref.code + " · 공식 수학과 교육과정 별책8");
              link.href = ref.sourceUrl;
              link.rel = "noreferrer";
              item.append(
                link,
                element(
                  "p",
                  "성취기준 범위와의 연결 제안 · 실제 인용 또는 의미 검토의 수락을 뜻하지 않습니다.",
                ),
              );
              const locator = element(
                "small",
                "원문 " +
                  ref.sourceMember +
                  " · " +
                  ref.locator.stream +
                  " · record " +
                  ref.locator.recordOrdinal +
                  " · byte " +
                  ref.locator.decompressedRecordByteOffset +
                  " · 물리적 쪽수 미확인",
              );
              item.append(
                locator,
                element("small", "HWP SHA256 " + ref.sourceSha256),
                element(
                  "small",
                  "record payload SHA256 " + ref.locator.rawPayloadSha256,
                ),
                element("small", "원문 수집 " + ref.retrievedAtUtc),
              );
              references.append(item);
            }
            card.append(
              references,
              element(
                "small",
                "정의 revision " + row.conceptRevision.revisionId,
              ),
            );
            group.append(card);
          }
          content.append(group);
        }
      const provenance = element("details");
      provenance.append(
        element("summary", "Candidate snapshot 출처와 버전"),
        element(
          "p",
          "공개 공식 원문에서 유도한 작성자 제안입니다. Semantic Acceptance는 미확정입니다.",
        ),
        element("p", "Snapshot SHA256 " + reply.snapshotSha256),
        element("p", "Catalog revision " + reply.catalogRevisionId),
        element(
          "p",
          "연구 catalog SHA256 " +
            snapshot.sourceResearch.originalCatalogSha256,
        ),
        element(
          "p",
          "교사 저장·검토 생성 0건 · 학생 관계 생성 0건 · 숙련도·인과 추론 없음",
        ),
      );
      content.append(provenance);
    } catch {
      if (section.isConnected) {
        content.replaceChildren();
        status.textContent =
          "개념 후보의 출처와 버전을 확인하지 못했습니다. 교사 작성 정의와 학생 근거는 그대로 유지됩니다.";
      }
    } finally {
      button.disabled = false;
    }
  });
  return section;
}

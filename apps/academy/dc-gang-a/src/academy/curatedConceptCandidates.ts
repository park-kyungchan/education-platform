import { createHash } from "node:crypto";
import { constants, openSync, fstatSync, readSync, closeSync } from "node:fs";
import { assertExactKeys } from "../learning/model";
import { validateConcept } from "./conceptEvidenceGraph";
import type { TrustedTeacherContext } from "./application";
import { assertTeacherScope } from "./usecases/requestRecovery";
import type {
  CuratedConceptSnapshot,
  CuratedConceptCandidateReply,
} from "./contracts/curatedConceptCandidates";

export const curatedConceptSnapshotSha256 =
  "a69c85a8b38fc194ff23e34103f86833516e93533973c1c4c9d8fc912e67d053";
export const curatedConceptResearchSha256 =
  "8d3c7f084eb1f43b49a0938493593ca858fcf968864064b8e4dc259defac1f16";
const hwpSha256 =
    "aab8eed59ecf244223d04afad75f4cf5ac5085fadcfc3cf52c2f6d54ddfc7856",
  zipSha256 =
    "b37a372a90d6d00bb3985888bbb41caae7a35f28877dc243a6f4b28861c53146";
const officialUrl =
  "https://www.moe.go.kr/boardCnts/fileDown.do?m=0404&s=moe&fileSeq=1512facbda6c234a1641ac7e9c156ca2";
const bands = ["1-2", "3-4", "5-6"] as const,
  domains = [
    "number-and-operations",
    "change-and-relationships",
    "shapes-and-measurement",
    "data-and-likelihood",
  ] as const;
const sameEdition = (value: unknown) =>
  !!value &&
  typeof value === "object" &&
  Object.keys(value).length === 2 &&
  (value as { namespace?: unknown }).namespace ===
    "official_curriculum_edition" &&
  (value as { literalKey?: unknown }).literalKey ===
    "KR:MOE:2022-33:annex8:mathematics";
/** The content validator is separate from byte admission so negative source fixtures can exercise semantic holds. */
export function assertCuratedConceptSnapshot(
  value: unknown,
): asserts value is CuratedConceptSnapshot {
  if (!value || typeof value !== "object")
    throw Error("curated_catalog_shape_conflict");
  assertExactKeys(value, [
    "schema",
    "catalogId",
    "qualification",
    "sourceResearch",
    "curriculumEdition",
    "applicability",
    "sourceLayers",
    "concepts",
    "coverage",
    "explicitGaps",
    "effects",
  ]);
  const source = value as CuratedConceptSnapshot;
  if (
    source.schema !== "academy.curated-concept-candidate-snapshot.v1" ||
    source.catalogId !== "kr.math.2022.elementary.candidate-52.v1" ||
    source.qualification !== "curated_candidate_snapshot"
  )
    throw Error("curated_catalog_shape_conflict");
  if (!sameEdition(source.curriculumEdition))
    throw Error("curated_catalog_edition_conflict");
  if (
    source.sourceResearch.originalCatalogSha256 !==
      curatedConceptResearchSha256 ||
    source.sourceResearch.semanticAcceptance !== "unknown" ||
    source.sourceResearch.retiredCurriculumInitiativeResumed !== false ||
    source.sourceResearch.freshAcademyA11 !== true
  )
    throw Error("curated_catalog_provenance_conflict");
  if (!Array.isArray(source.concepts) || source.concepts.length !== 52)
    throw Error("curated_catalog_coverage_conflict");
  const ids = new Set<string>(),
    codes = new Set<string>(),
    cells = new Map<string, number>();
  for (const candidate of source.concepts) {
    assertExactKeys(candidate, [
      "candidateId",
      "mathematicalKind",
      "primaryGradeBand",
      "standardScopeGradeBands",
      "domain",
      "atomicity",
      "supportingTerm",
      "standardRefs",
      "publisherPlacement",
      "conceptRevision",
    ]);
    if (
      !/^[a-z0-9-]{1,100}$/.test(candidate.candidateId) ||
      ids.has(candidate.candidateId) ||
      !bands.includes(candidate.primaryGradeBand) ||
      !domains.includes(candidate.domain)
    )
      throw Error("curated_catalog_candidate_conflict");
    ids.add(candidate.candidateId);
    const cell = candidate.primaryGradeBand + "/" + candidate.domain;
    cells.set(cell, (cells.get(cell) ?? 0) + 1);
    validateConcept(candidate.conceptRevision);
    if (
      candidate.conceptRevision.semanticReview.state !== "unknown" ||
      candidate.atomicity.reviewRequired !== true ||
      candidate.atomicity.status !==
        "candidate-single-object-relation-or-invariant" ||
      candidate.publisherPlacement.state !== "unknown"
    )
      throw Error("curated_catalog_acceptance_conflict");
    if (
      candidate.conceptRevision.curriculumEdition.state !== "known" ||
      !sameEdition(candidate.conceptRevision.curriculumEdition.value)
    )
      throw Error("curated_catalog_edition_conflict");
    if (
      candidate.conceptRevision.sourceKey.literalKey !==
      "kr.math.2022.elementary." + candidate.candidateId
    )
      throw Error("curated_catalog_revision_scope_conflict");
    if (
      !Array.isArray(candidate.standardRefs) ||
      !candidate.standardRefs.length ||
      candidate.standardRefs.length > 12
    )
      throw Error("curated_catalog_pointer_conflict");
    for (const ref of candidate.standardRefs) {
      if (
        !sameEdition(ref.edition) ||
        !/^([246])수0[1-4]-\d{2}$/.test(ref.code) ||
        ref.sourceClass !== "official-ministerial-curriculum-original" ||
        ref.relation !==
          "candidate-component-alignment-to-official-standard-scope" ||
        ref.sourceSha256 !== hwpSha256 ||
        ref.containerSha256 !== zipSha256 ||
        ref.sourceUrl !== officialUrl ||
        ref.sourceMember !== "[별책8] 수학과 교육과정.hwp" ||
        !Number.isFinite(Date.parse(ref.retrievedAtUtc))
      )
        throw Error("curated_catalog_pointer_conflict");
      if (
        !ref.locator ||
        ref.locator.page !== null ||
        !/^Root Entry\/BodyText\/Section\d+$/.test(ref.locator.stream) ||
        !Number.isSafeInteger(ref.locator.recordOrdinal) ||
        ref.locator.recordOrdinal < 0 ||
        !Number.isSafeInteger(ref.locator.decompressedRecordByteOffset) ||
        ref.locator.decompressedRecordByteOffset < 0 ||
        !/^[a-f0-9]{64}$/.test(ref.locator.rawPayloadSha256)
      )
        throw Error("curated_catalog_pointer_conflict");
      codes.add(ref.code);
    }
  }
  const coverage = source.coverage;
  if (
    coverage.candidateConcepts !== 52 ||
    coverage.officialUniqueElementaryStandardCodesObserved !== 121 ||
    coverage.referencedOfficialCodes !== 59 ||
    codes.size !== 59 ||
    !Array.isArray(coverage.unmappedOfficialCodes) ||
    coverage.unmappedOfficialCodes.length !== 62 ||
    new Set(coverage.unmappedOfficialCodes).size !== 62 ||
    coverage.unmappedOfficialCodes.some(
      (code) => codes.has(code) || !/^([246])수0[1-4]-\d{2}$/.test(code),
    )
  )
    throw Error("curated_catalog_coverage_conflict");
  for (const band of bands)
    for (const domain of domains)
      if (
        !cells.get(band + "/" + domain) ||
        coverage.primaryBandDomainCells[band][domain] !==
          cells.get(band + "/" + domain)
      )
        throw Error("curated_catalog_coverage_conflict");
  const effects = source.effects;
  assertExactKeys(effects, [
    "teacherReportsCreated",
    "teacherReviewsCreated",
    "studentLinksCreated",
    "mastery",
    "causality",
    "officialSaved",
    "parentSent",
  ]);
  if (
    effects.teacherReportsCreated !== 0 ||
    effects.teacherReviewsCreated !== 0 ||
    effects.studentLinksCreated !== 0 ||
    effects.mastery !== "not_inferred" ||
    effects.causality !== "not_inferred" ||
    effects.officialSaved !== false ||
    effects.parentSent !== false
  )
    throw Error("curated_catalog_effect_inference_refused");
}
function readFixedSnapshot(): Uint8Array {
  const file = new URL(
    "../../data/curated-concepts/elementary-2022-candidates.json",
    import.meta.url,
  );
  const fd = openSync(
    file,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    const before = fstatSync(fd);
    if (!before.isFile() || before.size < 1 || before.size > 256000)
      throw Error("curated_catalog_file_refused");
    const bytes = Buffer.alloc(before.size);
    let offset = 0;
    while (offset < bytes.length) {
      const count = readSync(fd, bytes, offset, bytes.length - offset, offset);
      if (!count) throw Error("curated_catalog_short_read");
      offset += count;
    }
    const after = fstatSync(fd);
    if (
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.size !== after.size ||
      before.mtimeMs !== after.mtimeMs ||
      before.ctimeMs !== after.ctimeMs
    )
      throw Error("curated_catalog_file_changed");
    return bytes;
  } finally {
    closeSync(fd);
  }
}
export function createCuratedConceptCandidateAccess(
  ownerId: string,
  readBytes: () => Uint8Array = readFixedSnapshot,
) {
  return {
    read(context: TrustedTeacherContext): CuratedConceptCandidateReply {
      assertTeacherScope(ownerId, context);
      const bytes = readBytes();
      if (
        bytes.byteLength > 256000 ||
        createHash("sha256").update(bytes).digest("hex") !==
          curatedConceptSnapshotSha256
      )
        throw Error("curated_catalog_pin_conflict");
      const snapshot: unknown = JSON.parse(Buffer.from(bytes).toString("utf8"));
      assertCuratedConceptSnapshot(snapshot);
      return {
        state: "ready",
        qualification: "curated_candidate_snapshot",
        snapshotSha256: curatedConceptSnapshotSha256,
        catalogRevisionId:
          "curated_concept_catalog_" + curatedConceptSnapshotSha256,
        snapshot,
        studentRelations: [],
        teacherPersistence: false,
        semanticAcceptance: "unknown",
      };
    },
  };
}

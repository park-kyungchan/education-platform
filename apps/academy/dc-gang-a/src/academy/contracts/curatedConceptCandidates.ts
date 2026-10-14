import type { ConceptRevision } from "../conceptEvidenceGraph";
import type { SourceKey } from "../domain";

export type ElementaryGradeBand = "1-2" | "3-4" | "5-6";
export type ElementaryConceptDomain =
  | "number-and-operations"
  | "change-and-relationships"
  | "shapes-and-measurement"
  | "data-and-likelihood";
export interface OfficialStandardPointer {
  readonly edition: SourceKey;
  readonly code: string;
  readonly relation: "candidate-component-alignment-to-official-standard-scope";
  readonly sourceClass: "official-ministerial-curriculum-original";
  readonly sourceUrl: string;
  readonly sourceSha256: string;
  readonly containerSha256: string;
  readonly sourceMember: string;
  readonly retrievedAtUtc: string;
  readonly locator: {
    readonly stream: string;
    readonly recordOrdinal: number;
    readonly decompressedRecordByteOffset: number;
    readonly rawPayloadSha256: string;
    readonly page: null;
    readonly pageReason: string;
  };
}
export interface CuratedConceptCandidate {
  readonly candidateId: string;
  readonly mathematicalKind:
    "object" | "relation" | "representation" | "invariant";
  readonly primaryGradeBand: ElementaryGradeBand;
  readonly standardScopeGradeBands: readonly ElementaryGradeBand[];
  readonly domain: ElementaryConceptDomain;
  readonly atomicity: {
    readonly status: "candidate-single-object-relation-or-invariant";
    readonly rationale: string;
    readonly reviewRequired: true;
  };
  readonly supportingTerm: string;
  readonly standardRefs: readonly OfficialStandardPointer[];
  readonly publisherPlacement: {
    readonly state: "unknown";
    readonly reason: string;
  };
  readonly conceptRevision: ConceptRevision;
}
export interface CuratedConceptSnapshot {
  readonly schema: "academy.curated-concept-candidate-snapshot.v1";
  readonly catalogId: "kr.math.2022.elementary.candidate-52.v1";
  readonly qualification: "curated_candidate_snapshot";
  readonly sourceResearch: {
    readonly originalCatalogSha256: string;
    readonly sourceClass: "public-official-source-derived-author-candidates";
    readonly semanticAcceptance: "unknown";
    readonly freshAcademyA11: true;
    readonly retiredCurriculumInitiativeResumed: false;
  };
  readonly curriculumEdition: SourceKey;
  readonly applicability: {
    readonly asOf: string;
    readonly schoolYear: number;
    readonly schoolStage: "elementary";
    readonly gradeBands: readonly ElementaryGradeBand[];
    readonly original2022StartDates: Readonly<
      Record<ElementaryGradeBand, string>
    >;
    readonly basis: {
      readonly officialPdfSha256: string;
      readonly pdfPages: readonly number[];
      readonly amendment2026ScopeAnnexes: readonly number[];
      readonly mathematicsAnnex8ListedAs2026Amendment: false;
    };
    readonly limits: readonly string[];
  };
  readonly sourceLayers: Readonly<
    Record<
      | "officialStandards"
      | "definitions"
      | "publisherPlacement"
      | "studentRelations",
      string
    >
  >;
  readonly concepts: readonly CuratedConceptCandidate[];
  readonly coverage: {
    readonly candidateConcepts: 52;
    readonly officialUniqueElementaryStandardCodesObserved: 121;
    readonly codeBearingRecords: 155;
    readonly referencedOfficialCodes: 59;
    readonly primaryBandDomainCells: Readonly<
      Record<
        ElementaryGradeBand,
        Readonly<Record<ElementaryConceptDomain, number>>
      >
    >;
    readonly all12BandDomainCellsHaveCandidates: true;
    readonly unmappedOfficialCodes: readonly string[];
    readonly coverageMeaning: string;
  };
  readonly explicitGaps: readonly string[];
  readonly effects: {
    readonly teacherReportsCreated: 0;
    readonly teacherReviewsCreated: 0;
    readonly studentLinksCreated: 0;
    readonly mastery: "not_inferred";
    readonly causality: "not_inferred";
    readonly officialSaved: false;
    readonly parentSent: false;
  };
}
export interface CuratedConceptCandidateReply {
  readonly state: "ready";
  readonly qualification: "curated_candidate_snapshot";
  readonly snapshotSha256: string;
  readonly catalogRevisionId: string;
  readonly snapshot: CuratedConceptSnapshot;
  readonly studentRelations: readonly [];
  readonly teacherPersistence: false;
  readonly semanticAcceptance: "unknown";
}

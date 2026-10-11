import {
  compileFragmentReviewRequestDocument,
  type FragmentReviewProposal,
  type FragmentReviewRequest,
} from "./compile-fragment-review-proposal.ts";
import { parseStrictJsonProposalDocument } from "./parse-strict-json-document.ts";

const EVIDENCE_REVIEW_PACKET_SCHEMA_VERSION =
  "mathematics-cartography.fragment-evidence-review-packet.v1" as const;
const DECISION_RECORD_ID =
  "INTERVIEW_AND_TDD_FRAGMENT_EVIDENCE_REVIEW_PACKET_001" as const;

type EvidenceOccurrence = FragmentReviewRequest["evidence"][number];

type EvidenceOccurrenceReview = Readonly<{
  evidenceId: string;
  subjectId: string;
  subjectRevision: string | null;
  evidenceClass: EvidenceOccurrence["evidenceClass"];
  statement: string;
  supports: readonly EvidenceOccurrence["supports"][number][];
  uncertaintyCodes: readonly string[];
}>;

export type FragmentEvidenceReviewPacket = Readonly<{
  schemaVersion: typeof EVIDENCE_REVIEW_PACKET_SCHEMA_VERSION;
  decisionRecordId: typeof DECISION_RECORD_ID;
  proposalId: string;
  requestId: string;
  supersedesProposalId: string | null;
  fragment: Readonly<{
    fragmentId: string;
    content: string;
  }>;
  candidateKind: FragmentReviewProposal["candidateKind"];
  identityReview: Readonly<{
    targetAtomId: string;
    judgment: FragmentReviewProposal["identityJudgment"]["judgment"];
    evidenceIds: readonly string[];
    evidenceOccurrences: readonly EvidenceOccurrenceReview[];
    uncertainty: readonly string[];
  }>;
  relationReviews: readonly Readonly<{
    relationKind: FragmentReviewProposal["relationProposals"][number]["relationKind"];
    sourceId: string;
    targetId: string;
    evidenceIds: readonly string[];
    evidenceOccurrences: readonly EvidenceOccurrenceReview[];
    uncertainty: readonly string[];
  }>[];
  unusedEvidenceOccurrences: readonly EvidenceOccurrenceReview[];
  recommendedDisposition: FragmentReviewProposal["recommendedDisposition"];
  humanDecision: "PENDING";
  canonicalApplication: "NOT_PERFORMED";
}>;

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(
      value as unknown as Record<string, unknown>,
    )) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
}

function isJsonDeepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    if (
      !Array.isArray(left) ||
      !Array.isArray(right) ||
      left.length !== right.length ||
      Reflect.ownKeys(left).length !== left.length + 1 ||
      Reflect.ownKeys(right).length !== right.length + 1
    ) {
      return false;
    }
    for (let index = 0; index < left.length; index += 1) {
      if (
        !Object.hasOwn(left, index) ||
        !Object.hasOwn(right, index) ||
        !isJsonDeepEqual(left[index], right[index])
      ) {
        return false;
      }
    }
    return true;
  }
  if (
    left === null ||
    right === null ||
    typeof left !== "object" ||
    typeof right !== "object"
  ) {
    return false;
  }
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] &&
        Object.hasOwn(rightRecord, key) &&
        isJsonDeepEqual(leftRecord[key], rightRecord[key]),
    )
  );
}

function copyEvidenceOccurrence(
  occurrence: EvidenceOccurrence,
): EvidenceOccurrenceReview {
  return {
    evidenceId: occurrence.evidenceId,
    subjectId: occurrence.subjectId,
    subjectRevision: occurrence.subjectRevision,
    evidenceClass: occurrence.evidenceClass,
    statement: occurrence.statement,
    supports: [...occurrence.supports],
    uncertaintyCodes: [...occurrence.uncertaintyCodes],
  };
}

export function compileFragmentEvidenceReviewPacket(
  requestInput: unknown,
  proposalInput: unknown,
): FragmentEvidenceReviewPacket {
  if (typeof requestInput !== "string") {
    throw new Error("INVALID_JSON_DOCUMENT:request:EXPECTED_STRING");
  }
  if (typeof proposalInput !== "string") {
    throw new Error("INVALID_JSON_DOCUMENT:proposal:EXPECTED_STRING");
  }
  const { request, proposal: expectedProposal } =
    compileFragmentReviewRequestDocument(requestInput);
  const parsedProposal = parseStrictJsonProposalDocument(proposalInput);
  if (!isJsonDeepEqual(parsedProposal, expectedProposal)) {
    throw new Error("EVIDENCE_REVIEW_PROPOSAL_REQUEST_MISMATCH");
  }
  const proposal = expectedProposal;
  const evidenceById = new Map(
    request.evidence.map((occurrence) => [occurrence.evidenceId, occurrence]),
  );
  const resolveEvidence = (evidenceId: string): EvidenceOccurrenceReview => {
    const occurrence = evidenceById.get(evidenceId);
    if (occurrence === undefined) {
      throw new Error(`EVIDENCE_REVIEW_OCCURRENCE_NOT_FOUND:${evidenceId}`);
    }
    return copyEvidenceOccurrence(occurrence);
  };
  const citedEvidenceIds = new Set([
    ...proposal.identityJudgment.evidenceIds,
    ...proposal.relationProposals.flatMap((relation) => relation.evidenceIds),
  ]);

  const packet: FragmentEvidenceReviewPacket = {
    schemaVersion: EVIDENCE_REVIEW_PACKET_SCHEMA_VERSION,
    decisionRecordId: DECISION_RECORD_ID,
    proposalId: proposal.proposalId,
    requestId: proposal.requestId,
    supersedesProposalId: proposal.supersedesProposalId,
    fragment: {
      fragmentId: proposal.fragment.fragmentId,
      content: proposal.fragment.content,
    },
    candidateKind: proposal.candidateKind,
    identityReview: {
      targetAtomId: proposal.identityJudgment.targetAtomId,
      judgment: proposal.identityJudgment.judgment,
      evidenceIds: [...proposal.identityJudgment.evidenceIds],
      evidenceOccurrences: proposal.identityJudgment.evidenceIds.map(
        resolveEvidence,
      ),
      uncertainty: [...proposal.identityJudgment.uncertainty],
    },
    relationReviews: proposal.relationProposals.map((relation) => ({
      relationKind: relation.relationKind,
      sourceId: relation.sourceId,
      targetId: relation.targetId,
      evidenceIds: [...relation.evidenceIds],
      evidenceOccurrences: relation.evidenceIds.map(resolveEvidence),
      uncertainty: [...relation.uncertainty],
    })),
    unusedEvidenceOccurrences: request.evidence
      .filter((occurrence) => !citedEvidenceIds.has(occurrence.evidenceId))
      .map(copyEvidenceOccurrence),
    recommendedDisposition: proposal.recommendedDisposition,
    humanDecision: "PENDING",
    canonicalApplication: "NOT_PERFORMED",
  };

  return deepFreeze(packet);
}

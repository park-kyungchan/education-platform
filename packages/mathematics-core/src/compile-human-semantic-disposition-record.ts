import { compileFragmentEvidenceReviewPacket } from "./compile-fragment-evidence-review-packet.ts";
import { parseStrictJsonProposalDocument } from "./parse-strict-json-document.ts";

const INPUT_SCHEMA_VERSION =
  "mathematics-cartography.human-semantic-disposition-input.v1" as const;
const RECORD_SCHEMA_VERSION =
  "mathematics-cartography.human-semantic-disposition-record.v1" as const;
const DECISION_RECORD_ID =
  "IMMUTABLE_HUMAN_SEMANTIC_DISPOSITION_RECORD_001" as const;
const TRIGGER =
  "EVIDENCE_REVIEW_PACKET_READY_FOR_HUMAN_DISPOSITION" as const;
const IDENTIFIER_PATTERN = /^[a-z][a-z0-9.-]{2,127}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const DECIDED_AT_UTC_PATTERN =
  /^([0-9]{4})-(0[1-9]|1[0-2])-([0-2][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]Z$/;
const HUMAN_DISPOSITIONS = ["CANONICALIZE", "REJECT", "DEFER"] as const;
const REASON_CODES = [
  "ADDITIONAL_EVIDENCE_REQUIRED",
  "EVIDENCE_CONFIRMS_RECOMMENDATION",
  "HUMAN_EVIDENCE_INTERPRETATION_DIFFERS",
  "INSUFFICIENT_IDENTITY_EVIDENCE",
  "MISSING_CONTEXT_UNSPECIFIED",
  "MISSING_LOGARITHM_BASE",
  "MISSING_REAL_DOMAIN_CONDITIONS",
] as const;
const DISPOSITION_INPUT_KEYS = [
  "schemaVersion",
  "dispositionRecordId",
  "supersedesDispositionRecordId",
  "actor",
  "trigger",
  "requestId",
  "proposalId",
  "requestSha256",
  "proposalSha256",
  "evidenceReviewPacketSha256",
  "humanDisposition",
  "decisionReasonCodes",
  "citedEvidenceIds",
  "decidedAtUtc",
] as const;

type HumanDisposition = "CANONICALIZE" | "REJECT" | "DEFER";
type RecommendedDisposition = HumanDisposition;

type DispositionInput = Readonly<{
  schemaVersion: typeof INPUT_SCHEMA_VERSION;
  dispositionRecordId: string;
  supersedesDispositionRecordId: string | null;
  actor: "HUMAN_SEMANTIC_REVIEWER";
  trigger: typeof TRIGGER;
  requestId: string;
  proposalId: string;
  requestSha256: string;
  proposalSha256: string;
  evidenceReviewPacketSha256: string;
  humanDisposition: HumanDisposition;
  decisionReasonCodes: readonly string[];
  citedEvidenceIds: readonly string[];
  decidedAtUtc: string;
}>;

export type HumanSemanticDispositionRecord = Readonly<{
  schemaVersion: typeof RECORD_SCHEMA_VERSION;
  decisionRecordId: typeof DECISION_RECORD_ID;
  dispositionRecordId: string;
  supersedesDispositionRecordId: string | null;
  actor: "HUMAN_SEMANTIC_REVIEWER";
  trigger: typeof TRIGGER;
  requestId: string;
  proposalId: string;
  requestSha256: string;
  proposalSha256: string;
  evidenceReviewPacketSha256: string;
  recommendedDisposition: RecommendedDisposition;
  humanDisposition: HumanDisposition;
  decisionReasonCodes: readonly string[];
  citedEvidenceIds: readonly string[];
  decidedAtUtc: string;
  canonicalApplication: "NOT_PERFORMED";
}>;

type Hash = {
  update(value: string, encoding: "utf8"): Hash;
  digest(encoding: "hex"): string;
};

declare const process: {
  getBuiltinModule(name: "node:crypto"): {
    createHash(algorithm: "sha256"): Hash;
  };
};

const { createHash } = process.getBuiltinModule("node:crypto");

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

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
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false;
    }
    return left.every((value, index) => isJsonDeepEqual(value, right[index]));
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

function requireRecord(value: unknown, code: string): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(code);
  }
}

function requireState(condition: boolean, code: string): asserts condition {
  if (!condition) {
    throw new Error(code);
  }
}

function rejectUndeclaredProperties(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
): void {
  const allowedKeys = new Set(allowed);
  const undeclared = Object.keys(value)
    .filter((key) => !allowedKeys.has(key))
    .sort()[0];
  if (undeclared !== undefined) {
    throw new Error(`UNDECLARED_PROPERTY:${path}:${undeclared}`);
  }
}

function requireIdentifier(value: unknown, path: string): asserts value is string {
  requireState(
    typeof value === "string" &&
      IDENTIFIER_PATTERN.test(value) &&
      !CONTROL_CHARACTER_PATTERN.test(value),
    `INVALID_IDENTIFIER:${path}`,
  );
}

function requireSha256(value: unknown, path: string): asserts value is string {
  requireState(
    typeof value === "string" && SHA256_PATTERN.test(value),
    `INVALID_SHA256:${path}`,
  );
}

function requireUnique(values: readonly string[], code: string): void {
  requireState(new Set(values).size === values.length, code);
}

function requireDecidedAtUtc(value: unknown): asserts value is string {
  requireState(typeof value === "string", "INVALID_DECIDED_AT_UTC");
  const match = DECIDED_AT_UTC_PATTERN.exec(value);
  requireState(match !== null, "INVALID_DECIDED_AT_UTC");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  requireState(
    year >= 1 && day >= 1 && day <= (daysInMonth[month - 1] ?? 0),
    "INVALID_DECIDED_AT_UTC",
  );
}

function validateDispositionInput(
  value: unknown,
): asserts value is DispositionInput {
  requireRecord(value, "INVALID_HUMAN_DISPOSITION_INPUT");
  rejectUndeclaredProperties(value, DISPOSITION_INPUT_KEYS, "dispositionInput");
  requireState(
    value.schemaVersion === INPUT_SCHEMA_VERSION,
    "INVALID_HUMAN_DISPOSITION_SCHEMA_VERSION",
  );
  requireIdentifier(value.dispositionRecordId, "dispositionRecordId");
  if (value.supersedesDispositionRecordId !== null) {
    requireIdentifier(
      value.supersedesDispositionRecordId,
      "supersedesDispositionRecordId",
    );
    requireState(
      value.supersedesDispositionRecordId !== value.dispositionRecordId,
      "SELF_SUPERSESSION",
    );
  }
  requireState(value.actor === "HUMAN_SEMANTIC_REVIEWER", "INVALID_ACTOR");
  requireState(value.trigger === TRIGGER, "INVALID_TRIGGER");
  requireIdentifier(value.requestId, "requestId");
  requireIdentifier(value.proposalId, "proposalId");
  requireSha256(value.requestSha256, "requestSha256");
  requireSha256(value.proposalSha256, "proposalSha256");
  requireSha256(
    value.evidenceReviewPacketSha256,
    "evidenceReviewPacketSha256",
  );
  requireState(
    typeof value.humanDisposition === "string" &&
      HUMAN_DISPOSITIONS.includes(value.humanDisposition as HumanDisposition),
    "INVALID_HUMAN_DISPOSITION",
  );
  requireState(
    Array.isArray(value.decisionReasonCodes),
    "INVALID_ARRAY:decisionReasonCodes",
  );
  value.decisionReasonCodes.forEach((code, index) => {
    requireState(
      typeof code === "string" &&
        REASON_CODES.includes(code as (typeof REASON_CODES)[number]),
      `INVALID_REASON_CODE:decisionReasonCodes[${index}]`,
    );
  });
  requireUnique(value.decisionReasonCodes as string[], "DUPLICATE_REASON_CODE");
  requireState(
    Array.isArray(value.citedEvidenceIds),
    "INVALID_ARRAY:citedEvidenceIds",
  );
  value.citedEvidenceIds.forEach((evidenceId, index) => {
    requireIdentifier(evidenceId, `citedEvidenceIds[${index}]`);
  });
  requireUnique(
    value.citedEvidenceIds as string[],
    "DUPLICATE_CITED_EVIDENCE_ID",
  );
  requireDecidedAtUtc(value.decidedAtUtc);
}

function requireJsonText(
  value: unknown,
  role: "request" | "proposal" | "evidenceReviewPacket" | "dispositionInput",
): asserts value is string {
  if (typeof value !== "string") {
    throw new Error(`INVALID_JSON_DOCUMENT:${role}:EXPECTED_STRING`);
  }
}

function parseStrictRoleDocument(
  value: string,
  role: "evidenceReviewPacket" | "dispositionInput",
): unknown {
  try {
    return parseStrictJsonProposalDocument(value);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("INVALID_JSON_DOCUMENT:proposal:")
    ) {
      throw new Error(
        `INVALID_JSON_DOCUMENT:${role}:${error.message.slice("INVALID_JSON_DOCUMENT:proposal:".length)}`,
      );
    }
    throw error;
  }
}

export function compileHumanSemanticDispositionRecord(
  requestInput: unknown,
  proposalInput: unknown,
  evidenceReviewPacketInput: unknown,
  dispositionInput: unknown,
): HumanSemanticDispositionRecord {
  requireJsonText(requestInput, "request");
  requireJsonText(proposalInput, "proposal");
  requireJsonText(evidenceReviewPacketInput, "evidenceReviewPacket");
  requireJsonText(dispositionInput, "dispositionInput");

  const expectedPacket = compileFragmentEvidenceReviewPacket(
    requestInput,
    proposalInput,
  );
  const parsedPacket = parseStrictRoleDocument(
    evidenceReviewPacketInput,
    "evidenceReviewPacket",
  );
  if (!isJsonDeepEqual(parsedPacket, expectedPacket)) {
    throw new Error("HUMAN_DISPOSITION_PACKET_TUPLE_MISMATCH");
  }
  const parsedDisposition = parseStrictRoleDocument(
    dispositionInput,
    "dispositionInput",
  );
  validateDispositionInput(parsedDisposition);
  const input = parsedDisposition;
  const requestSha256 = sha256(requestInput);
  const proposalSha256 = sha256(proposalInput);
  const evidenceReviewPacketSha256 = sha256(evidenceReviewPacketInput);
  requireState(
    input.requestSha256 === requestSha256,
    "HUMAN_DISPOSITION_REQUEST_SHA256_MISMATCH",
  );
  requireState(
    input.proposalSha256 === proposalSha256,
    "HUMAN_DISPOSITION_PROPOSAL_SHA256_MISMATCH",
  );
  requireState(
    input.evidenceReviewPacketSha256 === evidenceReviewPacketSha256,
    "HUMAN_DISPOSITION_PACKET_SHA256_MISMATCH",
  );
  requireState(
    input.requestId === expectedPacket.requestId,
    "HUMAN_DISPOSITION_REQUEST_ID_MISMATCH",
  );
  requireState(
    input.proposalId === expectedPacket.proposalId,
    "HUMAN_DISPOSITION_PROPOSAL_ID_MISMATCH",
  );
  const isOverride =
    input.humanDisposition !== expectedPacket.recommendedDisposition;
  const hasReasons = input.decisionReasonCodes.length > 0;
  const hasCitations = input.citedEvidenceIds.length > 0;
  if (
    isOverride ||
    input.humanDisposition === "DEFER" ||
    hasReasons ||
    hasCitations
  ) {
    requireState(
      hasReasons && hasCitations,
      "HUMAN_DISPOSITION_REASON_AND_CITATION_REQUIRED",
    );
  }
  const conclusionEvidenceIds = new Set([
    ...expectedPacket.identityReview.evidenceIds,
    ...expectedPacket.relationReviews.flatMap(
      (relation) => relation.evidenceIds,
    ),
  ]);
  for (const evidenceId of input.citedEvidenceIds) {
    requireState(
      conclusionEvidenceIds.has(evidenceId),
      `HUMAN_DISPOSITION_CITED_EVIDENCE_NOT_CONCLUSION_BOUND:${evidenceId}`,
    );
  }
  const citedEvidenceSet = new Set(input.citedEvidenceIds);
  for (const reasonCode of input.decisionReasonCodes) {
    if (reasonCode === "EVIDENCE_CONFIRMS_RECOMMENDATION") {
      requireState(
        !isOverride,
        `INVALID_REASON_CODE_FOR_OVERRIDE:${reasonCode}`,
      );
    } else if (reasonCode === "HUMAN_EVIDENCE_INTERPRETATION_DIFFERS") {
      requireState(
        isOverride,
        `INVALID_REASON_CODE_FOR_ALIGNED_DISPOSITION:${reasonCode}`,
      );
    } else if (reasonCode === "ADDITIONAL_EVIDENCE_REQUIRED") {
      requireState(
        input.humanDisposition === "DEFER",
        `INVALID_REASON_CODE_FOR_HUMAN_DISPOSITION:${reasonCode}`,
      );
    } else {
      requireState(
        input.humanDisposition === "DEFER" &&
          expectedPacket.identityReview.uncertainty.includes(reasonCode) &&
          expectedPacket.identityReview.evidenceOccurrences.some(
            (occurrence) =>
              citedEvidenceSet.has(occurrence.evidenceId) &&
              occurrence.uncertaintyCodes.includes(reasonCode),
          ),
        `HUMAN_DISPOSITION_UNCERTAINTY_REASON_NOT_CITED:${reasonCode}`,
      );
    }
  }
  if (
    input.humanDisposition === "DEFER" &&
    expectedPacket.identityReview.judgment === "UNKNOWN"
  ) {
    requireState(
      input.decisionReasonCodes.some(
        (reasonCode) =>
          expectedPacket.identityReview.uncertainty.includes(reasonCode) &&
          expectedPacket.identityReview.evidenceOccurrences.some(
            (occurrence) =>
              citedEvidenceSet.has(occurrence.evidenceId) &&
              occurrence.uncertaintyCodes.includes(reasonCode),
          ),
      ),
      "HUMAN_DISPOSITION_DEFER_REQUIRES_PACKET_UNCERTAINTY",
    );
  }

  return deepFreeze({
    schemaVersion: RECORD_SCHEMA_VERSION,
    decisionRecordId: DECISION_RECORD_ID,
    dispositionRecordId: input.dispositionRecordId,
    supersedesDispositionRecordId: input.supersedesDispositionRecordId,
    actor: input.actor,
    trigger: input.trigger,
    requestId: input.requestId,
    proposalId: input.proposalId,
    requestSha256,
    proposalSha256,
    evidenceReviewPacketSha256,
    recommendedDisposition:
      expectedPacket.recommendedDisposition as RecommendedDisposition,
    humanDisposition: input.humanDisposition,
    decisionReasonCodes: [...input.decisionReasonCodes],
    citedEvidenceIds: [...input.citedEvidenceIds],
    decidedAtUtc: input.decidedAtUtc,
    canonicalApplication: "NOT_PERFORMED",
  });
}

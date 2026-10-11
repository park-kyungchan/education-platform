import { parseStrictJsonRequestDocument } from "./parse-strict-json-document.ts";

const REQUEST_SCHEMA_VERSION =
  "mathematics-cartography.fragment-review-request.v1" as const;
const PROPOSAL_SCHEMA_VERSION =
  "mathematics-cartography.fragment-review-proposal.v1" as const;
const DECISION_RECORD_ID =
  "INTERVIEW_AND_TDD_MATHEMATICAL_FRAGMENT_IDENTITY_AND_RELATION_001" as const;
const REQUIRED_REAL_LOGARITHM_CONDITIONS = [
  "REAL_BASE_POSITIVE",
  "BASE_NOT_ONE",
  "REAL_ARGUMENT_POSITIVE",
] as const;

type CandidateKind = "DEFINITION" | "PROPOSITION";
type EvidenceClass =
  | "SUBMITTED_FRAGMENT"
  | "USER_SUPPLIED_CONTEXT"
  | "ACCEPTED_ATOM_SNAPSHOT"
  | "LOCAL_VERIFICATION";
type EvidenceSupport =
  | "DEFINITIONAL_EQUIVALENCE"
  | "COUNTEREXAMPLE"
  | "MISSING_CONTEXT"
  | "RELATION";
type IdentityJudgment = "SAME" | "DISTINCT" | "UNKNOWN";
type RelationKind = "INVERSE_OF" | "REQUIRES_CONDITION" | "CONTRADICTS";
type RecommendedDisposition = "CANONICALIZE" | "REJECT" | "DEFER";
type RealLogarithmConditionCode =
  (typeof REQUIRED_REAL_LOGARITHM_CONDITIONS)[number];

const EXPECTED_CONDITION_STATEMENTS: Readonly<
  Record<RealLogarithmConditionCode, readonly string[]>
> = {
  REAL_BASE_POSITIVE: ["b > 0", "b = 2 > 0"],
  BASE_NOT_ONE: ["b != 1", "b = 2 != 1"],
  REAL_ARGUMENT_POSITIVE: [
    "x > 0",
    "x = 1, y = 1, and x + y = 2 are positive",
  ],
};
const COUNTEREXAMPLE_STATEMENT =
  "At b = 2, x = 1, and y = 1, the left side is 1 and the right side is 0.";
const LOGARITHM_DEFINITION_FRAGMENT = "log_b(x) = y iff b^y = x";
const LOGARITHM_DEFINITION_ATOM_ID = "atom.logarithm.definition";
const LOGARITHM_DEFINITION_ATOM_STATEMENT =
  "For real b, x, and y, if b > 0, b != 1, and x > 0, then log_b(x) = y iff b^y = x.";
const INVALID_LOGARITHM_SUM_FRAGMENT =
  "log_b(x + y) = log_b(x) + log_b(y)";
const NO_GENERAL_SUM_RULE_ATOM_ID = "atom.logarithm.no-general-sum-rule";
const NO_GENERAL_SUM_RULE_ATOM_STATEMENT =
  "There is no general real-logarithm identity log_b(x + y) = log_b(x) + log_b(y); b = 2, x = 1, and y = 1 give a counterexample.";
const EXPONENTIATION_FUNCTION_ATOM_STATEMENT =
  "For fixed real b > 0 with b != 1, exponentiation y -> b^y and logarithm x -> log_b(x) are inverse functions on their real domains.";
const REAL_DOMAIN_CONDITIONS_ATOM_STATEMENT =
  "A real logarithm log_b(x) requires b > 0, b != 1, and x > 0.";
const DEFINITION_CONDITION_STATEMENTS: Readonly<
  Record<RealLogarithmConditionCode, string>
> = {
  REAL_BASE_POSITIVE: "b > 0",
  BASE_NOT_ONE: "b != 1",
  REAL_ARGUMENT_POSITIVE: "x > 0",
};
const EXPECTED_RELATION_TARGETS: Readonly<Record<RelationKind, string>> = {
  INVERSE_OF: "atom.exponentiation.function",
  REQUIRES_CONDITION: "atom.logarithm.real-domain-conditions",
  CONTRADICTS: NO_GENERAL_SUM_RULE_ATOM_ID,
};
const DEFINITION_CONTEXT_STATEMENT = "b > 0; b != 1; x > 0";
const COUNTEREXAMPLE_CONTEXT_STATEMENT = "b = 2; x = 1; y = 1";
const MISSING_CONTEXT_STATEMENT =
  "No logarithm base or real-domain conditions were supplied.";
const FIXTURE_ATOM_REVISION = "revision.1";
const EXPECTED_ATOM_SNAPSHOTS: Readonly<
  Record<string, Readonly<{ revision: string; statement: string }>>
> = {
  [LOGARITHM_DEFINITION_ATOM_ID]: {
    revision: FIXTURE_ATOM_REVISION,
    statement: LOGARITHM_DEFINITION_ATOM_STATEMENT,
  },
  "atom.exponentiation.function": {
    revision: FIXTURE_ATOM_REVISION,
    statement: EXPONENTIATION_FUNCTION_ATOM_STATEMENT,
  },
  "atom.logarithm.real-domain-conditions": {
    revision: FIXTURE_ATOM_REVISION,
    statement: REAL_DOMAIN_CONDITIONS_ATOM_STATEMENT,
  },
  [NO_GENERAL_SUM_RULE_ATOM_ID]: {
    revision: FIXTURE_ATOM_REVISION,
    statement: NO_GENERAL_SUM_RULE_ATOM_STATEMENT,
  },
};

const CANDIDATE_KINDS: readonly CandidateKind[] = [
  "DEFINITION",
  "PROPOSITION",
];
const EVIDENCE_CLASSES: readonly EvidenceClass[] = [
  "SUBMITTED_FRAGMENT",
  "USER_SUPPLIED_CONTEXT",
  "ACCEPTED_ATOM_SNAPSHOT",
  "LOCAL_VERIFICATION",
];
const EVIDENCE_SUPPORTS: readonly EvidenceSupport[] = [
  "DEFINITIONAL_EQUIVALENCE",
  "COUNTEREXAMPLE",
  "MISSING_CONTEXT",
  "RELATION",
];
const RELATION_KINDS: readonly RelationKind[] = [
  "INVERSE_OF",
  "REQUIRES_CONDITION",
  "CONTRADICTS",
];
const IDENTIFIER_PATTERN = /^[a-z][a-z0-9.-]{2,127}$/;
const CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,127}$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

export type FragmentReviewRequest = Readonly<{
  schemaVersion: typeof REQUEST_SCHEMA_VERSION;
  requestId: string;
  proposalId: string;
  supersedesProposalId: string | null;
  actor: "HUMAN_SEMANTIC_REVIEWER";
  trigger: "FRAGMENT_SUBMITTED_FOR_IDENTITY_REVIEW";
  fragment: Readonly<{
    fragmentId: string;
    content: string;
    candidateKindProposal: CandidateKind;
    provenanceClass: "SUBMITTED_FRAGMENT";
  }>;
  identityTargetAtomId: string;
  acceptedAtoms: readonly Readonly<{
    atomId: string;
    revision: string;
    statement: string;
    provenanceClass: "ACCEPTED_ATOM_SNAPSHOT";
  }>[];
  explicitConditions: readonly Readonly<{
    code: RealLogarithmConditionCode;
    statement: string;
    provenanceClass: "USER_SUPPLIED_CONTEXT";
  }>[];
  evidence: readonly Readonly<{
    evidenceId: string;
    subjectId: string;
    subjectRevision: string | null;
    evidenceClass: EvidenceClass;
    statement: string;
    supports: readonly EvidenceSupport[];
    uncertaintyCodes: readonly string[];
  }>[];
  relationCandidates: readonly Readonly<{
    relationKind: RelationKind;
    sourceId: string;
    targetId: string;
    evidenceIds: readonly string[];
    uncertainty: readonly string[];
  }>[];
}>;

export type FragmentReviewProposal = Readonly<{
  schemaVersion: typeof PROPOSAL_SCHEMA_VERSION;
  decisionRecordId: typeof DECISION_RECORD_ID;
  proposalId: string;
  requestId: string;
  supersedesProposalId: string | null;
  actor: "HUMAN_SEMANTIC_REVIEWER";
  trigger: "FRAGMENT_SUBMITTED_FOR_IDENTITY_REVIEW";
  fragment: Readonly<{
    fragmentId: string;
    content: string;
  }>;
  candidateKind: CandidateKind;
  identityJudgment: Readonly<{
    targetAtomId: string;
    judgment: IdentityJudgment;
    evidenceIds: readonly string[];
    uncertainty: readonly string[];
  }>;
  relationProposals: readonly Readonly<{
    relationKind: RelationKind;
    sourceId: string;
    targetId: string;
    evidenceIds: readonly string[];
    uncertainty: readonly string[];
  }>[];
  recommendedDisposition: RecommendedDisposition;
  humanDecision: "PENDING";
  canonicalApplication: "NOT_PERFORMED";
}>;

function requireState(condition: boolean, code: string): asserts condition {
  if (!condition) {
    throw new Error(code);
  }
}

function requireRecord(
  value: unknown,
  path: string,
): asserts value is Record<string, unknown> {
  requireState(
    value !== null && typeof value === "object" && !Array.isArray(value),
    `INVALID_OBJECT:${path}`,
  );
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
    typeof value === "string" && IDENTIFIER_PATTERN.test(value),
    `INVALID_IDENTIFIER:${path}`,
  );
}

function requireCode(value: unknown, path: string): asserts value is string {
  requireState(
    typeof value === "string" && CODE_PATTERN.test(value),
    `INVALID_CODE:${path}`,
  );
}

function requireStatement(value: unknown, path: string): asserts value is string {
  requireState(
    typeof value === "string" &&
      Array.from(value).length >= 1 &&
      Array.from(value).length <= 4096 &&
      !CONTROL_CHARACTER_PATTERN.test(value),
    `INVALID_STATEMENT:${path}`,
  );
}

function requireEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  code: string,
): asserts value is T {
  requireState(
    typeof value === "string" && allowed.includes(value as T),
    code,
  );
}

function requireRecordArray(
  value: unknown,
  keys: readonly string[],
  path: string,
): Record<string, unknown>[] {
  requireState(Array.isArray(value), `INVALID_ARRAY:${path}`);
  return value.map((item, index) => {
    const itemPath = `${path}[${index}]`;
    requireRecord(item, itemPath);
    rejectUndeclaredProperties(item, keys, itemPath);
    return item;
  });
}

function requireUnique(values: readonly string[], code: string): void {
  requireState(new Set(values).size === values.length, code);
}

function requireNonEmpty(values: readonly unknown[], path: string): void {
  requireState(values.length > 0, `EMPTY_ARRAY:${path}`);
}

function requireProvenance(
  value: unknown,
  expected: string,
  path: string,
): void {
  requireState(value === expected, `INVALID_PROVENANCE:${path}`);
}

function validateClosedRequest(
  input: unknown,
): asserts input is FragmentReviewRequest {
  requireRecord(input, "request");
  rejectUndeclaredProperties(
    input,
    [
      "schemaVersion",
      "requestId",
      "proposalId",
      "supersedesProposalId",
      "actor",
      "trigger",
      "fragment",
      "identityTargetAtomId",
      "acceptedAtoms",
      "explicitConditions",
      "evidence",
      "relationCandidates",
    ],
    "request",
  );

  requireRecord(input.fragment, "fragment");
  rejectUndeclaredProperties(
    input.fragment,
    [
      "fragmentId",
      "content",
      "candidateKindProposal",
      "provenanceClass",
    ],
    "fragment",
  );

  requireIdentifier(input.requestId, "requestId");
  requireIdentifier(input.proposalId, "proposalId");
  if (input.supersedesProposalId !== null) {
    requireIdentifier(input.supersedesProposalId, "supersedesProposalId");
    requireState(
      input.supersedesProposalId !== input.proposalId,
      "SELF_SUPERSESSION",
    );
  }
  requireIdentifier(input.fragment.fragmentId, "fragment.fragmentId");
  requireStatement(input.fragment.content, "fragment.content");
  requireEnum(
    input.fragment.candidateKindProposal,
    CANDIDATE_KINDS,
    "INVALID_CANDIDATE_KIND",
  );
  requireProvenance(
    input.fragment.provenanceClass,
    "SUBMITTED_FRAGMENT",
    "fragment",
  );
  requireIdentifier(input.identityTargetAtomId, "identityTargetAtomId");

  const acceptedAtoms = requireRecordArray(
    input.acceptedAtoms,
    ["atomId", "revision", "statement", "provenanceClass"],
    "acceptedAtoms",
  );
  requireNonEmpty(acceptedAtoms, "acceptedAtoms");
  acceptedAtoms.forEach((atom, index) => {
    requireIdentifier(atom.atomId, `acceptedAtoms[${index}].atomId`);
    requireIdentifier(atom.revision, `acceptedAtoms[${index}].revision`);
    requireStatement(atom.statement, `acceptedAtoms[${index}].statement`);
    requireProvenance(
      atom.provenanceClass,
      "ACCEPTED_ATOM_SNAPSHOT",
      `acceptedAtoms[${index}]`,
    );
  });
  requireUnique(
    acceptedAtoms.map((atom) => atom.atomId as string),
    "DUPLICATE_ACCEPTED_ATOM_ID",
  );

  const explicitConditions = requireRecordArray(
    input.explicitConditions,
    ["code", "statement", "provenanceClass"],
    "explicitConditions",
  );
  explicitConditions.forEach((condition, index) => {
    requireEnum(
      condition.code,
      REQUIRED_REAL_LOGARITHM_CONDITIONS,
      `INVALID_CONDITION_CODE:explicitConditions[${index}]`,
    );
    requireStatement(
      condition.statement,
      `explicitConditions[${index}].statement`,
    );
    requireProvenance(
      condition.provenanceClass,
      "USER_SUPPLIED_CONTEXT",
      `explicitConditions[${index}]`,
    );
  });
  requireUnique(
    explicitConditions.map((condition) => condition.code as string),
    "DUPLICATE_CONDITION_CODE",
  );

  const evidence = requireRecordArray(
    input.evidence,
    [
      "evidenceId",
      "subjectId",
      "subjectRevision",
      "evidenceClass",
      "statement",
      "supports",
      "uncertaintyCodes",
    ],
    "evidence",
  );
  requireNonEmpty(evidence, "evidence");
  evidence.forEach((item, index) => {
    requireIdentifier(item.evidenceId, `evidence[${index}].evidenceId`);
    requireIdentifier(item.subjectId, `evidence[${index}].subjectId`);
    if (item.subjectRevision !== null) {
      requireIdentifier(
        item.subjectRevision,
        `evidence[${index}].subjectRevision`,
      );
    }
    requireEnum(
      item.evidenceClass,
      EVIDENCE_CLASSES,
      `INVALID_EVIDENCE_CLASS:evidence[${index}]`,
    );
    requireStatement(item.statement, `evidence[${index}].statement`);
    requireState(Array.isArray(item.supports), `INVALID_ARRAY:evidence[${index}].supports`);
    requireNonEmpty(item.supports, `evidence[${index}].supports`);
    item.supports.forEach((support) => {
      requireEnum(
        support,
        EVIDENCE_SUPPORTS,
        `INVALID_EVIDENCE_SUPPORT:evidence[${index}]`,
      );
    });
    requireUnique(
      item.supports as string[],
      `DUPLICATE_EVIDENCE_SUPPORT:evidence[${index}]`,
    );
    requireState(
      Array.isArray(item.uncertaintyCodes),
      `INVALID_ARRAY:evidence[${index}].uncertaintyCodes`,
    );
    item.uncertaintyCodes.forEach((code, codeIndex) => {
      requireCode(code, `evidence[${index}].uncertaintyCodes[${codeIndex}]`);
    });
    requireUnique(
      item.uncertaintyCodes as string[],
      `DUPLICATE_UNCERTAINTY_CODE:evidence[${index}]`,
    );
  });
  requireUnique(
    evidence.map((item) => item.evidenceId as string),
    "DUPLICATE_EVIDENCE_ID",
  );

  const relations = requireRecordArray(
    input.relationCandidates,
    ["relationKind", "sourceId", "targetId", "evidenceIds", "uncertainty"],
    "relationCandidates",
  );
  relations.forEach((relation, index) => {
    requireEnum(
      relation.relationKind,
      RELATION_KINDS,
      `INVALID_RELATION_KIND:relationCandidates[${index}]`,
    );
    requireIdentifier(
      relation.sourceId,
      `relationCandidates[${index}].sourceId`,
    );
    requireIdentifier(
      relation.targetId,
      `relationCandidates[${index}].targetId`,
    );
    requireState(
      Array.isArray(relation.evidenceIds),
      `INVALID_ARRAY:relationCandidates[${index}].evidenceIds`,
    );
    requireNonEmpty(
      relation.evidenceIds,
      `relationCandidates[${index}].evidenceIds`,
    );
    relation.evidenceIds.forEach((evidenceId, evidenceIndex) => {
      requireIdentifier(
        evidenceId,
        `relationCandidates[${index}].evidenceIds[${evidenceIndex}]`,
      );
    });
    requireUnique(
      relation.evidenceIds as string[],
      `DUPLICATE_RELATION_EVIDENCE_ID:relationCandidates[${index}]`,
    );
    requireState(
      Array.isArray(relation.uncertainty),
      `INVALID_ARRAY:relationCandidates[${index}].uncertainty`,
    );
    relation.uncertainty.forEach((code, codeIndex) => {
      requireCode(
        code,
        `relationCandidates[${index}].uncertainty[${codeIndex}]`,
      );
    });
    requireUnique(
      relation.uncertainty as string[],
      `DUPLICATE_RELATION_UNCERTAINTY:relationCandidates[${index}]`,
    );
  });
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

function requireExactContextEvidence(
  request: FragmentReviewRequest,
  support: EvidenceSupport,
  expectedStatement: string,
): void {
  const contextEvidence = request.evidence.filter(
    (evidence) =>
      evidence.evidenceClass === "USER_SUPPLIED_CONTEXT" &&
      evidence.subjectId === request.fragment.fragmentId &&
      evidence.subjectRevision === null &&
      evidence.supports.includes(support),
  );
  requireState(
    contextEvidence.length > 0 &&
      contextEvidence.every(
        (evidence) => evidence.statement === expectedStatement,
      ),
    `CONTEXT_EVIDENCE_MISMATCH:${support}`,
  );
}

type Evidence = FragmentReviewRequest["evidence"][number];

function evidenceBindingKey(evidence: Evidence): string {
  return JSON.stringify([
    evidence.evidenceClass,
    evidence.subjectId,
    evidence.subjectRevision,
    evidence.statement,
  ]);
}

function expectedRelationEvidenceKeys(
  relationKind: RelationKind,
  fragmentId: string,
): string[] {
  const key = (
    evidenceClass: EvidenceClass,
    subjectId: string,
    subjectRevision: string | null,
    statement: string,
  ): string =>
    JSON.stringify([evidenceClass, subjectId, subjectRevision, statement]);

  switch (relationKind) {
    case "INVERSE_OF":
      return [
        key(
          "USER_SUPPLIED_CONTEXT",
          fragmentId,
          null,
          DEFINITION_CONTEXT_STATEMENT,
        ),
        key(
          "ACCEPTED_ATOM_SNAPSHOT",
          "atom.exponentiation.function",
          FIXTURE_ATOM_REVISION,
          EXPONENTIATION_FUNCTION_ATOM_STATEMENT,
        ),
      ].sort();
    case "REQUIRES_CONDITION":
      return [
        key(
          "USER_SUPPLIED_CONTEXT",
          fragmentId,
          null,
          DEFINITION_CONTEXT_STATEMENT,
        ),
        key(
          "ACCEPTED_ATOM_SNAPSHOT",
          "atom.logarithm.real-domain-conditions",
          FIXTURE_ATOM_REVISION,
          REAL_DOMAIN_CONDITIONS_ATOM_STATEMENT,
        ),
      ].sort();
    case "CONTRADICTS":
      return [
        key(
          "ACCEPTED_ATOM_SNAPSHOT",
          NO_GENERAL_SUM_RULE_ATOM_ID,
          FIXTURE_ATOM_REVISION,
          NO_GENERAL_SUM_RULE_ATOM_STATEMENT,
        ),
        key(
          "LOCAL_VERIFICATION",
          fragmentId,
          null,
          COUNTEREXAMPLE_STATEMENT,
        ),
      ].sort();
  }
}

function compileFragmentReviewProposalValue(
  input: unknown,
): FragmentReviewProposal {
  validateClosedRequest(input);
  const request = input;
  requireState(
    request.schemaVersion === REQUEST_SCHEMA_VERSION,
    "INVALID_REQUEST_SCHEMA_VERSION",
  );
  requireState(request.actor === "HUMAN_SEMANTIC_REVIEWER", "INVALID_ACTOR");
  requireState(
    request.trigger === "FRAGMENT_SUBMITTED_FOR_IDENTITY_REVIEW",
    "INVALID_TRIGGER",
  );

  const atomIds = new Set(request.acceptedAtoms.map((atom) => atom.atomId));
  const evidenceIds = new Set(
    request.evidence.map((evidence) => evidence.evidenceId),
  );
  const evidenceOccurrenceSignatures = request.evidence.map((evidence) =>
    JSON.stringify([
      evidenceBindingKey(evidence),
      [...evidence.supports].sort(),
      [...evidence.uncertaintyCodes].sort(),
    ]),
  );
  requireUnique(
    evidenceOccurrenceSignatures,
    "DUPLICATE_EVIDENCE_OCCURRENCE",
  );

  const identityTarget = request.acceptedAtoms.find(
    (atom) => atom.atomId === request.identityTargetAtomId,
  );
  requireState(
    identityTarget !== undefined,
    "IDENTITY_TARGET_NOT_IN_ACCEPTED_SNAPSHOT",
  );
  const referencedAtomIds = new Set([
    request.identityTargetAtomId,
    ...request.relationCandidates.map((relation) => relation.targetId),
  ]);
  for (const atomId of referencedAtomIds) {
    const atom = request.acceptedAtoms.find((candidate) => candidate.atomId === atomId);
    requireState(atom !== undefined, "RELATION_TARGET_NOT_IN_ACCEPTED_SNAPSHOT");
    const expected = EXPECTED_ATOM_SNAPSHOTS[atomId];
    requireState(expected !== undefined, `ATOM_NOT_FIXTURE_EXACT:${atomId}`);
    requireState(
      atom.revision === expected.revision,
      `ATOM_REVISION_NOT_FIXTURE_EXACT:${atomId}`,
    );
    requireState(
      atom.statement === expected.statement,
      `ATOM_STATEMENT_NOT_FIXTURE_EXACT:${atomId}`,
    );
  }

  for (const evidence of request.evidence) {
    if (evidence.evidenceClass === "ACCEPTED_ATOM_SNAPSHOT") {
      const subject = request.acceptedAtoms.find(
        (atom) => atom.atomId === evidence.subjectId,
      );
      requireState(
        subject !== undefined &&
          evidence.subjectRevision === subject.revision &&
          evidence.statement === subject.statement,
        `ACCEPTED_ATOM_EVIDENCE_MISMATCH:${evidence.evidenceId}`,
      );
    } else {
      requireState(
        evidence.subjectId === request.fragment.fragmentId &&
          evidence.subjectRevision === null,
        `FRAGMENT_EVIDENCE_SUBJECT_MISMATCH:${evidence.evidenceId}`,
      );
    }
  }

  const submittedFragmentEvidence = request.evidence.filter(
    (evidence) =>
      evidence.evidenceClass === "SUBMITTED_FRAGMENT" &&
      evidence.subjectId === request.fragment.fragmentId &&
      evidence.subjectRevision === null,
  );
  requireState(
    submittedFragmentEvidence.length > 0,
    "SUBMITTED_FRAGMENT_EVIDENCE_NOT_FOUND",
  );
  const exactSubmittedFragmentEvidence = submittedFragmentEvidence.filter(
    (evidence) => evidence.statement === request.fragment.content,
  );
  requireState(
    exactSubmittedFragmentEvidence.length > 0,
    "FRAGMENT_EVIDENCE_MISMATCH",
  );

  const acceptedAtomEvidence = request.evidence.filter(
    (evidence) => evidence.evidenceClass === "ACCEPTED_ATOM_SNAPSHOT",
  );
  requireState(
    acceptedAtomEvidence.length > 0,
    "IDENTITY_ATOM_EVIDENCE_NOT_FOUND",
  );
  const identityTargetEvidence = acceptedAtomEvidence.filter(
    (evidence) =>
      evidence.subjectId === identityTarget.atomId &&
      evidence.subjectRevision === identityTarget.revision &&
      evidence.statement === identityTarget.statement,
  );
  requireState(
    identityTargetEvidence.length > 0,
    "IDENTITY_ATOM_EVIDENCE_MISMATCH",
  );

  for (const condition of request.explicitConditions) {
    requireState(
      EXPECTED_CONDITION_STATEMENTS[condition.code].includes(
        condition.statement,
      ),
      `CONDITION_STATEMENT_MISMATCH:${condition.code}`,
    );
  }
  const conditionCodes = new Set(
    request.explicitConditions.map((condition) => condition.code),
  );
  let uncertainty = [
    ...new Set(
      request.evidence
        .filter((evidence) =>
          evidence.supports.some((support) => support !== "RELATION"),
        )
        .flatMap((evidence) => evidence.uncertaintyCodes),
    ),
  ];
  const missingContextEvidence = request.evidence.filter((evidence) =>
    evidence.supports.includes("MISSING_CONTEXT"),
  );
  const hasMissingContextSupport = missingContextEvidence.length > 0;
  if (hasMissingContextSupport) {
    requireState(
      request.explicitConditions.length === 0,
      "MISSING_CONTEXT_CONTRADICTS_EXPLICIT_CONDITIONS",
    );
    requireExactContextEvidence(
      request,
      "MISSING_CONTEXT",
      MISSING_CONTEXT_STATEMENT,
    );
    requireState(
      missingContextEvidence.every(
        (evidence) =>
          (evidence.evidenceClass === "SUBMITTED_FRAGMENT" &&
            evidence.subjectId === request.fragment.fragmentId &&
            evidence.subjectRevision === null &&
            evidence.statement === request.fragment.content) ||
          (evidence.evidenceClass === "USER_SUPPLIED_CONTEXT" &&
            evidence.subjectId === request.fragment.fragmentId &&
            evidence.subjectRevision === null &&
            evidence.statement === MISSING_CONTEXT_STATEMENT) ||
          (evidence.evidenceClass === "ACCEPTED_ATOM_SNAPSHOT" &&
            evidence.subjectId === identityTarget.atomId &&
            evidence.subjectRevision === identityTarget.revision &&
            evidence.statement === identityTarget.statement),
      ),
      "MISSING_CONTEXT_EVIDENCE_NOT_BOUND",
    );
  }
  const hasMissingContext =
    hasMissingContextSupport || uncertainty.length > 0;
  if (hasMissingContextSupport && uncertainty.length === 0) {
    uncertainty = ["MISSING_CONTEXT_UNSPECIFIED"];
  }

  const counterexampleEvidence = request.evidence.filter((evidence) =>
    evidence.supports.includes("COUNTEREXAMPLE"),
  );
  const hasCounterexampleSupport = counterexampleEvidence.length > 0;
  if (hasCounterexampleSupport) {
    requireExactContextEvidence(
      request,
      "COUNTEREXAMPLE",
      COUNTEREXAMPLE_CONTEXT_STATEMENT,
    );
    requireState(
      request.fragment.content === INVALID_LOGARITHM_SUM_FRAGMENT,
      "COUNTEREXAMPLE_FRAGMENT_NOT_FIXTURE_EXACT",
    );
    requireState(
      request.fragment.candidateKindProposal === "PROPOSITION",
      "CANDIDATE_KIND_INCOMPATIBLE_WITH_IDENTITY_EVIDENCE",
    );
    requireState(
      identityTarget.atomId === NO_GENERAL_SUM_RULE_ATOM_ID &&
        identityTarget.statement === NO_GENERAL_SUM_RULE_ATOM_STATEMENT,
      "COUNTEREXAMPLE_TARGET_NOT_FIXTURE_EXACT",
    );
  }
  const localCounterexampleEvidence = request.evidence.filter(
    (evidence) =>
      evidence.evidenceClass === "LOCAL_VERIFICATION" &&
      evidence.subjectId === request.fragment.fragmentId &&
      evidence.subjectRevision === null &&
      evidence.supports.includes("COUNTEREXAMPLE"),
  );
  if (localCounterexampleEvidence.length > 0) {
    requireState(
      localCounterexampleEvidence.every(
        (evidence) => evidence.statement === COUNTEREXAMPLE_STATEMENT,
      ),
      "COUNTEREXAMPLE_STATEMENT_MISMATCH",
    );
  }
  const allCounterexampleEvidenceBound = counterexampleEvidence.every(
    (evidence) =>
      (evidence.evidenceClass === "SUBMITTED_FRAGMENT" &&
        evidence.subjectId === request.fragment.fragmentId &&
        evidence.subjectRevision === null &&
        evidence.statement === INVALID_LOGARITHM_SUM_FRAGMENT) ||
      (evidence.evidenceClass === "USER_SUPPLIED_CONTEXT" &&
        evidence.subjectId === request.fragment.fragmentId &&
        evidence.subjectRevision === null &&
        evidence.statement === COUNTEREXAMPLE_CONTEXT_STATEMENT) ||
      (evidence.evidenceClass === "ACCEPTED_ATOM_SNAPSHOT" &&
        evidence.subjectId === identityTarget.atomId &&
        evidence.subjectRevision === identityTarget.revision &&
        evidence.statement === NO_GENERAL_SUM_RULE_ATOM_STATEMENT) ||
      (evidence.evidenceClass === "LOCAL_VERIFICATION" &&
        evidence.subjectId === request.fragment.fragmentId &&
        evidence.subjectRevision === null &&
        evidence.statement === COUNTEREXAMPLE_STATEMENT),
  );
  const hasCounterexample =
    hasCounterexampleSupport &&
    allCounterexampleEvidenceBound &&
    localCounterexampleEvidence.some(
      (evidence) => evidence.statement === COUNTEREXAMPLE_STATEMENT,
    ) &&
    exactSubmittedFragmentEvidence.some((evidence) =>
      evidence.supports.includes("COUNTEREXAMPLE"),
    ) &&
    identityTargetEvidence.some((evidence) =>
      evidence.supports.includes("COUNTEREXAMPLE"),
    );
  if (hasCounterexampleSupport) {
    requireState(hasCounterexample, "COUNTEREXAMPLE_EVIDENCE_NOT_BOUND");
  }

  const definitionEvidence = request.evidence.filter((evidence) =>
    evidence.supports.includes("DEFINITIONAL_EQUIVALENCE"),
  );
  const hasDefinitionSupport = definitionEvidence.length > 0;
  if (hasDefinitionSupport) {
    requireExactContextEvidence(
      request,
      "DEFINITIONAL_EQUIVALENCE",
      DEFINITION_CONTEXT_STATEMENT,
    );
    requireState(
      request.fragment.content === LOGARITHM_DEFINITION_FRAGMENT,
      "DEFINITION_FRAGMENT_NOT_FIXTURE_EXACT",
    );
    requireState(
      request.fragment.candidateKindProposal === "DEFINITION",
      "CANDIDATE_KIND_INCOMPATIBLE_WITH_IDENTITY_EVIDENCE",
    );
    requireState(
      identityTarget.atomId === LOGARITHM_DEFINITION_ATOM_ID &&
        identityTarget.statement === LOGARITHM_DEFINITION_ATOM_STATEMENT,
      "DEFINITION_TARGET_NOT_FIXTURE_EXACT",
    );
    requireState(
      REQUIRED_REAL_LOGARITHM_CONDITIONS.every((conditionCode) =>
        request.explicitConditions.some(
          (condition) =>
            condition.code === conditionCode &&
            condition.statement ===
              DEFINITION_CONDITION_STATEMENTS[conditionCode],
        ),
      ),
      "DEFINITION_CONDITIONS_NOT_FIXTURE_EXACT",
    );
  }
  const hasBoundDefinitionEvidence =
    definitionEvidence.every(
      (evidence) =>
        (evidence.evidenceClass === "SUBMITTED_FRAGMENT" &&
          evidence.subjectId === request.fragment.fragmentId &&
          evidence.subjectRevision === null &&
          evidence.statement === LOGARITHM_DEFINITION_FRAGMENT) ||
        (evidence.evidenceClass === "USER_SUPPLIED_CONTEXT" &&
          evidence.subjectId === request.fragment.fragmentId &&
          evidence.subjectRevision === null &&
          evidence.statement === DEFINITION_CONTEXT_STATEMENT) ||
        (evidence.evidenceClass === "ACCEPTED_ATOM_SNAPSHOT" &&
          evidence.subjectId === identityTarget.atomId &&
          evidence.subjectRevision === identityTarget.revision &&
          evidence.statement === LOGARITHM_DEFINITION_ATOM_STATEMENT),
    ) &&
    exactSubmittedFragmentEvidence.some((evidence) =>
      evidence.supports.includes("DEFINITIONAL_EQUIVALENCE"),
    ) &&
    identityTargetEvidence.some((evidence) =>
      evidence.supports.includes("DEFINITIONAL_EQUIVALENCE"),
    );
  if (hasDefinitionSupport) {
    requireState(
      hasBoundDefinitionEvidence,
      "DEFINITIONAL_EQUIVALENCE_EVIDENCE_NOT_BOUND",
    );
  }
  const hasCompleteDefinitionEvidence =
    hasBoundDefinitionEvidence &&
    REQUIRED_REAL_LOGARITHM_CONDITIONS.every((condition) =>
      conditionCodes.has(condition),
    );
  const hasInsufficientIdentityEvidence =
    !hasMissingContext && !hasCounterexample && !hasCompleteDefinitionEvidence;
  if (hasInsufficientIdentityEvidence && uncertainty.length === 0) {
    uncertainty = ["INSUFFICIENT_IDENTITY_EVIDENCE"];
  }

  const judgment: IdentityJudgment =
    hasMissingContext || hasInsufficientIdentityEvidence
    ? "UNKNOWN"
    : hasCounterexample
      ? "DISTINCT"
      : "SAME";
  const recommendedDisposition: RecommendedDisposition =
    hasMissingContext || hasInsufficientIdentityEvidence
    ? "DEFER"
    : hasCounterexample
      ? "REJECT"
      : "CANONICALIZE";

  const relationSignatures = request.relationCandidates.map((relation) =>
    [
      relation.relationKind,
      relation.sourceId,
      relation.targetId,
      [...relation.evidenceIds].sort().join(","),
      [...relation.uncertainty].sort().join(","),
    ].join("|"),
  );
  requireUnique(relationSignatures, "DUPLICATE_RELATION_CANDIDATE");

  if (judgment === "UNKNOWN") {
    requireState(
      request.relationCandidates.length === 0,
      "RELATION_PROPOSAL_REQUIRES_KNOWN_IDENTITY_JUDGMENT",
    );
  } else {
    const compatibleRelationKinds: readonly RelationKind[] =
      judgment === "SAME"
        ? ["INVERSE_OF", "REQUIRES_CONDITION"]
        : ["CONTRADICTS"];
    requireState(
      request.relationCandidates.every((relation) =>
        compatibleRelationKinds.includes(relation.relationKind),
      ),
      "RELATION_KIND_INCOMPATIBLE_WITH_IDENTITY_JUDGMENT",
    );
    for (const requiredKind of compatibleRelationKinds) {
      const matchingCount = request.relationCandidates.filter(
        (relation) => relation.relationKind === requiredKind,
      ).length;
      requireState(
        matchingCount > 0,
        `MISSING_REQUIRED_RELATION:${requiredKind}`,
      );
      requireState(
        matchingCount === 1,
        `DUPLICATE_RELATION_KIND:${requiredKind}`,
      );
    }
  }

  for (const relation of request.relationCandidates) {
    requireState(
      relation.sourceId === request.fragment.fragmentId,
      "RELATION_SOURCE_NOT_SUBMITTED_FRAGMENT",
    );
    requireState(
      relation.targetId === EXPECTED_RELATION_TARGETS[relation.relationKind],
      `RELATION_TARGET_INCOMPATIBLE_WITH_KIND:${relation.relationKind}`,
    );
    requireState(
      atomIds.has(relation.targetId),
      "RELATION_TARGET_NOT_IN_ACCEPTED_SNAPSHOT",
    );
    requireState(
      relation.evidenceIds.every((evidenceId) => evidenceIds.has(evidenceId)),
      "RELATION_EVIDENCE_NOT_FOUND",
    );
    const relationEvidence = relation.evidenceIds.map((evidenceId) =>
      request.evidence.find((evidence) => evidence.evidenceId === evidenceId),
    );
    requireState(
      relationEvidence.every(
        (evidence) =>
          evidence !== undefined && evidence.supports.includes("RELATION"),
      ),
      `RELATION_EVIDENCE_NOT_BOUND:${relation.relationKind}`,
    );
    const resolvedRelationEvidence = relationEvidence.filter(
      (evidence): evidence is Evidence => evidence !== undefined,
    );
    const relationTarget = request.acceptedAtoms.find(
      (atom) => atom.atomId === relation.targetId,
    );
    requireState(
      relationTarget !== undefined &&
        resolvedRelationEvidence.some(
          (evidence) =>
            evidence.evidenceClass === "ACCEPTED_ATOM_SNAPSHOT" &&
            evidence.subjectId === relationTarget.atomId &&
            evidence.subjectRevision === relationTarget.revision &&
            evidence.statement === relationTarget.statement,
        ),
      `RELATION_TARGET_EVIDENCE_NOT_BOUND:${relation.relationKind}`,
    );
    requireState(
      JSON.stringify(resolvedRelationEvidence.map(evidenceBindingKey).sort()) ===
        JSON.stringify(
          expectedRelationEvidenceKeys(
            relation.relationKind,
            request.fragment.fragmentId,
          ),
        ),
      `RELATION_EVIDENCE_NOT_KIND_BOUND:${relation.relationKind}`,
    );
  }

  const uncertaintyEvidence = request.evidence.filter(
    (evidence) =>
      evidence.supports.includes("MISSING_CONTEXT") ||
      (evidence.uncertaintyCodes.length > 0 &&
        evidence.supports.some((support) => support !== "RELATION")),
  );
  const identityEvidence =
    judgment === "SAME"
      ? definitionEvidence
      : judgment === "DISTINCT"
        ? counterexampleEvidence
        : uncertaintyEvidence.length > 0
          ? uncertaintyEvidence
          : [...exactSubmittedFragmentEvidence, ...identityTargetEvidence];

  const proposal: FragmentReviewProposal = {
    schemaVersion: PROPOSAL_SCHEMA_VERSION,
    decisionRecordId: DECISION_RECORD_ID,
    proposalId: request.proposalId,
    requestId: request.requestId,
    supersedesProposalId: request.supersedesProposalId,
    actor: request.actor,
    trigger: request.trigger,
    fragment: {
      fragmentId: request.fragment.fragmentId,
      content: request.fragment.content,
    },
    candidateKind: request.fragment.candidateKindProposal,
    identityJudgment: {
      targetAtomId: request.identityTargetAtomId,
      judgment,
      evidenceIds: identityEvidence.map((evidence) => evidence.evidenceId),
      uncertainty,
    },
    relationProposals: request.relationCandidates.map((relation) => ({
      relationKind: relation.relationKind,
      sourceId: relation.sourceId,
      targetId: relation.targetId,
      evidenceIds: [...relation.evidenceIds],
      uncertainty: [...relation.uncertainty],
    })),
    recommendedDisposition,
    humanDecision: "PENDING",
    canonicalApplication: "NOT_PERFORMED",
  };

  return deepFreeze(proposal);
}

export type CompiledFragmentReviewRequestDocument = Readonly<{
  request: FragmentReviewRequest;
  proposal: FragmentReviewProposal;
}>;

/** @internal Parser-owned bridge for the evidence-packet compiler. */
export function compileFragmentReviewRequestDocument(
  input: unknown,
): CompiledFragmentReviewRequestDocument {
  const parsed = parseStrictJsonRequestDocument(input);
  const proposal = compileFragmentReviewProposalValue(parsed);
  const request = deepFreeze(parsed as FragmentReviewRequest);
  return Object.freeze({ request, proposal });
}

export function compileFragmentReviewProposal(
  input: unknown,
): FragmentReviewProposal {
  return compileFragmentReviewRequestDocument(input).proposal;
}

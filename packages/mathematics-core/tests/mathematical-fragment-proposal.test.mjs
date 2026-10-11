import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { compileFragmentReviewProposal as compileFragmentReviewProposalFromJson } from "../src/compile-fragment-review-proposal.ts";

function compileFragmentReviewProposal(request) {
  return compileFragmentReviewProposalFromJson(JSON.stringify(request));
}

const fixtureUrl = new URL(
  "../fixtures/logarithm-definition-equivalence.fixture.json",
  import.meta.url,
);
const invalidIdentityFixtureUrl = new URL(
  "../fixtures/invalid-logarithm-sum-identity.fixture.json",
  import.meta.url,
);
const missingContextFixtureUrl = new URL(
  "../fixtures/missing-logarithm-context.fixture.json",
  import.meta.url,
);
const contractUrl = new URL(
  "../contracts/mathematical-fragment-review.v1.schema.json",
  import.meta.url,
);

test("compiles an equivalent logarithm definition into a proposal without applying it", async () => {
  const fixture = JSON.parse(await readFile(fixtureUrl, "utf8"));

  const actual = compileFragmentReviewProposal(fixture.request);

  assert.deepEqual(actual, fixture.expected);
  assert.equal(Object.isFrozen(actual), true);
  assert.equal(Object.isFrozen(actual.identityJudgment), true);
  assert.equal(Object.isFrozen(actual.relationProposals), true);
});

test("rejects a false logarithm identity with explicit counterexample evidence", async () => {
  const fixture = JSON.parse(await readFile(invalidIdentityFixtureUrl, "utf8"));
  const left = Math.log2(1 + 1);
  const right = Math.log2(1) + Math.log2(1);

  assert.equal(left, 1);
  assert.equal(right, 0);
  assert.notEqual(left, right);

  const actual = compileFragmentReviewProposal(fixture.request);

  assert.deepEqual(actual, fixture.expected);
});

test("preserves unknown when logarithm context is missing", async () => {
  const fixture = JSON.parse(await readFile(missingContextFixtureUrl, "utf8"));

  const actual = compileFragmentReviewProposal(fixture.request);

  assert.deepEqual(actual, fixture.expected);
});

test("rejects undeclared properties at every request boundary", async () => {
  const fixture = JSON.parse(await readFile(fixtureUrl, "utf8"));
  const mutations = [
    ["request", (request) => (request.unexpected = true)],
    ["fragment", (request) => (request.fragment.unexpected = true)],
    ["acceptedAtoms[0]", (request) => (request.acceptedAtoms[0].unexpected = true)],
    ["explicitConditions[0]", (request) => (request.explicitConditions[0].unexpected = true)],
    ["evidence[0]", (request) => (request.evidence[0].unexpected = true)],
    ["relationCandidates[0]", (request) => (request.relationCandidates[0].unexpected = true)],
  ];

  for (const [path, mutate] of mutations) {
    const request = structuredClone(fixture.request);
    mutate(request);

    assert.throws(
      () => compileFragmentReviewProposal(request),
      { message: `UNDECLARED_PROPERTY:${path}:unexpected` },
    );
  }
});

test("rejects non-data request properties without executing accessors", async () => {
  const fixture = JSON.parse(await readFile(fixtureUrl, "utf8"));
  let accessorCallCount = 0;
  const mutations = [
    (request) =>
      Object.defineProperty(request, "hidden", {
        value: true,
        enumerable: false,
      }),
    (request) => (request[Symbol("hidden")] = true),
    (request) =>
      Object.defineProperty(request.fragment, "hidden", {
        value: true,
        enumerable: false,
      }),
    (request) => (request.fragment[Symbol("hidden")] = true),
    (request) => {
      const schemaVersion = request.schemaVersion;
      Object.defineProperty(request, "schemaVersion", {
        enumerable: true,
        configurable: true,
        get() {
          accessorCallCount += 1;
          return schemaVersion;
        },
      });
    },
    (request) => {
      const atom = request.acceptedAtoms[0];
      Object.defineProperty(request.acceptedAtoms, "0", {
        enumerable: true,
        configurable: true,
        get() {
          accessorCallCount += 1;
          return atom;
        },
      });
    },
  ];

  for (const mutate of mutations) {
    const request = structuredClone(fixture.request);
    mutate(request);

    assert.throws(
      () => compileFragmentReviewProposalFromJson(request),
      { message: "INVALID_JSON_DOCUMENT:request:EXPECTED_STRING" },
    );
  }
  assert.equal(accessorCallCount, 0);
});

test("rejects values outside the language-neutral request contract", async () => {
  const fixture = JSON.parse(await readFile(fixtureUrl, "utf8"));
  const mutations = [
    ["INVALID_IDENTIFIER:requestId", (request) => (request.requestId = "request.invalid\n")],
    ["INVALID_CANDIDATE_KIND", (request) => (request.fragment.candidateKindProposal = "TAXONOMY")],
    ["INVALID_IDENTIFIER:acceptedAtoms[0].revision", (request) => (request.acceptedAtoms[0].revision = "")],
    ["INVALID_EVIDENCE_CLASS:evidence[0]", (request) => (request.evidence[0].evidenceClass = "UNTRUSTED")],
    ["INVALID_EVIDENCE_SUPPORT:evidence[0]", (request) => request.evidence[0].supports.push("GUESS")],
    ["DUPLICATE_EVIDENCE_ID", (request) => request.evidence.push(structuredClone(request.evidence[0]))],
    ["INVALID_RELATION_KIND:relationCandidates[0]", (request) => (request.relationCandidates[0].relationKind = "IS_SIMILAR_TO")],
    ["INVALID_CODE:evidence[0].uncertaintyCodes[0]", (request) => request.evidence[0].uncertaintyCodes.push("bad code")],
  ];

  for (const [message, mutate] of mutations) {
    const request = structuredClone(fixture.request);
    mutate(request);

    assert.throws(
      () => compileFragmentReviewProposal(request),
      { message },
    );
  }
});

test("rejects malformed provenance and reference-bearing fields", async () => {
  const fixture = JSON.parse(await readFile(fixtureUrl, "utf8"));
  const mutations = [
    ["INVALID_IDENTIFIER:proposalId", (request) => (request.proposalId = "proposal/invalid")],
    ["INVALID_IDENTIFIER:supersedesProposalId", (request) => (request.supersedesProposalId = "proposal/invalid")],
    ["INVALID_IDENTIFIER:fragment.fragmentId", (request) => (request.fragment.fragmentId = "fragment/invalid")],
    ["INVALID_STATEMENT:fragment.content", (request) => (request.fragment.content = "")],
    ["INVALID_PROVENANCE:fragment", (request) => (request.fragment.provenanceClass = "MODEL_INFERRED")],
    ["EMPTY_ARRAY:acceptedAtoms", (request) => (request.acceptedAtoms = [])],
    ["INVALID_IDENTIFIER:acceptedAtoms[0].atomId", (request) => (request.acceptedAtoms[0].atomId = "atom/invalid")],
    ["INVALID_PROVENANCE:acceptedAtoms[0]", (request) => (request.acceptedAtoms[0].provenanceClass = "MODEL_INFERRED")],
    ["INVALID_CONDITION_CODE:explicitConditions[0]", (request) => (request.explicitConditions[0].code = "ASSUMED_CONDITION")],
    ["INVALID_PROVENANCE:explicitConditions[0]", (request) => (request.explicitConditions[0].provenanceClass = "MODEL_INFERRED")],
    ["EMPTY_ARRAY:evidence", (request) => (request.evidence = [])],
    ["INVALID_STATEMENT:evidence[0].statement", (request) => (request.evidence[0].statement = "")],
    ["EMPTY_ARRAY:evidence[0].supports", (request) => (request.evidence[0].supports = [])],
    ["DUPLICATE_EVIDENCE_SUPPORT:evidence[0]", (request) => request.evidence[0].supports.push("DEFINITIONAL_EQUIVALENCE")],
    ["INVALID_IDENTIFIER:relationCandidates[0].sourceId", (request) => (request.relationCandidates[0].sourceId = "fragment/invalid")],
    ["EMPTY_ARRAY:relationCandidates[0].evidenceIds", (request) => (request.relationCandidates[0].evidenceIds = [])],
    ["INVALID_CODE:relationCandidates[0].uncertainty[0]", (request) => request.relationCandidates[0].uncertainty.push("bad code")],
  ];

  for (const [message, mutate] of mutations) {
    const request = structuredClone(fixture.request);
    mutate(request);

    assert.throws(
      () => compileFragmentReviewProposal(request),
      { message },
    );
  }
});

test("binds identity evidence to the exact fragment and accepted atom statement", async () => {
  const fixture = JSON.parse(await readFile(fixtureUrl, "utf8"));
  const mutations = [
    [
      "SUBMITTED_FRAGMENT_EVIDENCE_NOT_FOUND",
      (request) => (request.evidence[0].evidenceClass = "USER_SUPPLIED_CONTEXT"),
    ],
    [
      "FRAGMENT_EVIDENCE_MISMATCH",
      (request) => (request.evidence[0].statement = "log_b(x) resembles b^x"),
    ],
    [
      "IDENTITY_ATOM_EVIDENCE_MISMATCH",
      (request) => {
        request.evidence[2].evidenceClass = "USER_SUPPLIED_CONTEXT";
        request.evidence[2].subjectId = request.fragment.fragmentId;
        request.evidence[2].subjectRevision = null;
      },
    ],
    [
      "ATOM_STATEMENT_NOT_FIXTURE_EXACT:atom.logarithm.definition",
      (request) => (request.acceptedAtoms[0].statement = "A different accepted statement."),
    ],
  ];

  for (const [message, mutate] of mutations) {
    const request = structuredClone(fixture.request);
    mutate(request);

    assert.throws(
      () => compileFragmentReviewProposal(request),
      { message },
    );
  }
});

test("keeps relation proposals compatible with the identity judgment", async () => {
  const sameFixture = JSON.parse(await readFile(fixtureUrl, "utf8"));
  sameFixture.request.relationCandidates[0].relationKind = "CONTRADICTS";
  assert.throws(
    () => compileFragmentReviewProposal(sameFixture.request),
    { message: "RELATION_KIND_INCOMPATIBLE_WITH_IDENTITY_JUDGMENT" },
  );

  const distinctFixture = JSON.parse(
    await readFile(invalidIdentityFixtureUrl, "utf8"),
  );
  distinctFixture.request.relationCandidates[0].relationKind = "INVERSE_OF";
  assert.throws(
    () => compileFragmentReviewProposal(distinctFixture.request),
    { message: "RELATION_KIND_INCOMPATIBLE_WITH_IDENTITY_JUDGMENT" },
  );

  const unknownFixture = JSON.parse(
    await readFile(missingContextFixtureUrl, "utf8"),
  );
  unknownFixture.request.relationCandidates.push({
    relationKind: "INVERSE_OF",
    sourceId: unknownFixture.request.fragment.fragmentId,
    targetId: unknownFixture.request.identityTargetAtomId,
    evidenceIds: ["evidence.atom.logarithm-definition"],
    uncertainty: ["MISSING_LOGARITHM_BASE"],
  });
  assert.throws(
    () => compileFragmentReviewProposal(unknownFixture.request),
    { message: "RELATION_PROPOSAL_REQUIRES_KNOWN_IDENTITY_JUDGMENT" },
  );
});

test("binds decisive judgments to authoritative evidence and exact fixture statements", async () => {
  const unboundDefinition = JSON.parse(await readFile(fixtureUrl, "utf8"));
  unboundDefinition.request.evidence[0].supports = ["RELATION"];
  unboundDefinition.request.evidence[2].supports = ["RELATION"];
  assert.throws(
    () => compileFragmentReviewProposal(unboundDefinition.request),
    { message: "DEFINITIONAL_EQUIVALENCE_EVIDENCE_NOT_BOUND" },
  );

  const unverifiedCounterexample = JSON.parse(
    await readFile(invalidIdentityFixtureUrl, "utf8"),
  );
  unverifiedCounterexample.request.evidence[3].supports = ["RELATION"];
  assert.throws(
    () => compileFragmentReviewProposal(unverifiedCounterexample.request),
    { message: "COUNTEREXAMPLE_EVIDENCE_NOT_BOUND" },
  );

  const unboundCounterexampleTarget = JSON.parse(
    await readFile(invalidIdentityFixtureUrl, "utf8"),
  );
  unboundCounterexampleTarget.request.evidence[2].supports = ["RELATION"];
  assert.throws(
    () => compileFragmentReviewProposal(unboundCounterexampleTarget.request),
    { message: "COUNTEREXAMPLE_EVIDENCE_NOT_BOUND" },
  );

  const contradictoryCondition = JSON.parse(await readFile(fixtureUrl, "utf8"));
  contradictoryCondition.request.explicitConditions[0].statement = "b <= 0";
  assert.throws(
    () => compileFragmentReviewProposal(contradictoryCondition.request),
    { message: "CONDITION_STATEMENT_MISMATCH:REAL_BASE_POSITIVE" },
  );

  const falseCounterexample = JSON.parse(
    await readFile(invalidIdentityFixtureUrl, "utf8"),
  );
  falseCounterexample.request.evidence[3].statement =
    "At b = 2, x = 1, and y = 1, both sides are 0.";
  assert.throws(
    () => compileFragmentReviewProposal(falseCounterexample.request),
    { message: "COUNTEREXAMPLE_STATEMENT_MISMATCH" },
  );
});

test("requires the complete fixture relation set with bound relation evidence", async () => {
  const sameWithoutRelations = JSON.parse(await readFile(fixtureUrl, "utf8"));
  sameWithoutRelations.request.relationCandidates = [];
  assert.throws(
    () => compileFragmentReviewProposal(sameWithoutRelations.request),
    { message: "MISSING_REQUIRED_RELATION:INVERSE_OF" },
  );

  const distinctWithoutRelations = JSON.parse(
    await readFile(invalidIdentityFixtureUrl, "utf8"),
  );
  distinctWithoutRelations.request.relationCandidates = [];
  assert.throws(
    () => compileFragmentReviewProposal(distinctWithoutRelations.request),
    { message: "MISSING_REQUIRED_RELATION:CONTRADICTS" },
  );

  const unboundRelationSupport = JSON.parse(await readFile(fixtureUrl, "utf8"));
  const unboundContextEvidence = unboundRelationSupport.request.evidence.find(
    (item) => item.evidenceId === "evidence.context.real-logarithm",
  );
  unboundContextEvidence.supports = ["DEFINITIONAL_EQUIVALENCE"];
  assert.throws(
    () => compileFragmentReviewProposal(unboundRelationSupport.request),
    { message: "RELATION_EVIDENCE_NOT_BOUND:INVERSE_OF" },
  );

  const missingTargetEvidence = JSON.parse(await readFile(fixtureUrl, "utf8"));
  missingTargetEvidence.request.relationCandidates[0].evidenceIds = [
    "evidence.context.real-logarithm",
  ];
  assert.throws(
    () => compileFragmentReviewProposal(missingTargetEvidence.request),
    { message: "RELATION_TARGET_EVIDENCE_NOT_BOUND:INVERSE_OF" },
  );

  const misleadingRelationEvidence = JSON.parse(
    await readFile(fixtureUrl, "utf8"),
  );
  misleadingRelationEvidence.request.evidence.push({
    evidenceId: "evidence.context.unbound-relation",
    subjectId: misleadingRelationEvidence.request.fragment.fragmentId,
    subjectRevision: null,
    evidenceClass: "USER_SUPPLIED_CONTEXT",
    statement: "An unrelated statement.",
    supports: ["RELATION"],
    uncertaintyCodes: [],
  });
  misleadingRelationEvidence.request.relationCandidates[0].evidenceIds.push(
    "evidence.context.unbound-relation",
  );
  assert.throws(
    () => compileFragmentReviewProposal(misleadingRelationEvidence.request),
    { message: "RELATION_EVIDENCE_NOT_KIND_BOUND:INVERSE_OF" },
  );

  const duplicateRelation = JSON.parse(await readFile(fixtureUrl, "utf8"));
  duplicateRelation.request.relationCandidates.push(
    structuredClone(duplicateRelation.request.relationCandidates[0]),
  );
  assert.throws(
    () => compileFragmentReviewProposal(duplicateRelation.request),
    { message: "DUPLICATE_RELATION_CANDIDATE" },
  );
});

test("fails closed with explicit uncertainty and successor-only correction lineage", async () => {
  const missingCodes = JSON.parse(
    await readFile(missingContextFixtureUrl, "utf8"),
  );
  for (const evidence of missingCodes.request.evidence) {
    evidence.uncertaintyCodes = [];
  }
  const missingCodesProposal = compileFragmentReviewProposal(missingCodes.request);
  assert.equal(missingCodesProposal.identityJudgment.judgment, "UNKNOWN");
  assert.deepEqual(missingCodesProposal.identityJudgment.uncertainty, [
    "MISSING_CONTEXT_UNSPECIFIED",
  ]);
  assert.equal(missingCodesProposal.recommendedDisposition, "DEFER");

  const undecidable = JSON.parse(
    await readFile(missingContextFixtureUrl, "utf8"),
  );
  for (const evidence of undecidable.request.evidence) {
    evidence.supports = ["RELATION"];
    evidence.uncertaintyCodes = [];
  }
  const undecidableProposal = compileFragmentReviewProposal(undecidable.request);
  assert.equal(undecidableProposal.identityJudgment.judgment, "UNKNOWN");
  assert.deepEqual(undecidableProposal.identityJudgment.uncertainty, [
    "INSUFFICIENT_IDENTITY_EVIDENCE",
  ]);
  assert.equal(undecidableProposal.recommendedDisposition, "DEFER");

  const selfSupersession = JSON.parse(await readFile(fixtureUrl, "utf8"));
  selfSupersession.request.supersedesProposalId =
    selfSupersession.request.proposalId;
  assert.throws(
    () => compileFragmentReviewProposal(selfSupersession.request),
    { message: "SELF_SUPERSESSION" },
  );

  const successor = JSON.parse(await readFile(fixtureUrl, "utf8"));
  successor.request.requestId =
    "request.logarithm-definition-equivalence-correction";
  successor.request.proposalId =
    "proposal.logarithm-definition-equivalence-correction";
  successor.request.supersedesProposalId =
    "proposal.logarithm-definition-equivalence";
  const successorProposal = compileFragmentReviewProposal(successor.request);
  assert.equal(
    successorProposal.supersedesProposalId,
    "proposal.logarithm-definition-equivalence",
  );
  assert.equal(successorProposal.canonicalApplication, "NOT_PERFORMED");
});

test("keeps JSON Schema and runtime string boundaries equivalent", async () => {
  const contract = JSON.parse(await readFile(contractUrl, "utf8"));
  assert.deepEqual(contract.$defs.identityJudgmentValue.enum, [
    "SAME",
    "DISTINCT",
    "UNKNOWN",
  ]);
  for (const definition of ["identifier", "statement", "stringCode"]) {
    assert.deepEqual(contract.$defs[definition].not, {
      pattern: "[\\u0000-\\u001F\\u007F]",
    });
  }

  const acceptedBoundary = JSON.parse(
    await readFile(missingContextFixtureUrl, "utf8"),
  );
  const acceptedStatement = "😀".repeat(4096);
  acceptedBoundary.request.fragment.content = acceptedStatement;
  acceptedBoundary.request.evidence[0].statement = acceptedStatement;
  assert.equal(
    compileFragmentReviewProposal(acceptedBoundary.request).identityJudgment
      .judgment,
    "UNKNOWN",
  );

  const rejectedBoundary = structuredClone(acceptedBoundary.request);
  const rejectedStatement = "😀".repeat(4097);
  rejectedBoundary.fragment.content = rejectedStatement;
  rejectedBoundary.evidence[0].statement = rejectedStatement;
  assert.throws(
    () => compileFragmentReviewProposal(rejectedBoundary),
    { message: "INVALID_STATEMENT:fragment.content" },
  );
});

test("keeps semantic judgments and relation targets inside the approved fixture", async () => {
  const differentDefinition = JSON.parse(await readFile(fixtureUrl, "utf8"));
  differentDefinition.request.fragment.content = "u = v iff p = q";
  differentDefinition.request.evidence[0].statement = "u = v iff p = q";
  assert.throws(
    () => compileFragmentReviewProposal(differentDefinition.request),
    { message: "DEFINITION_FRAGMENT_NOT_FIXTURE_EXACT" },
  );

  const wrongDefinitionKind = JSON.parse(await readFile(fixtureUrl, "utf8"));
  wrongDefinitionKind.request.fragment.candidateKindProposal = "PROPOSITION";
  assert.throws(
    () => compileFragmentReviewProposal(wrongDefinitionKind.request),
    { message: "CANDIDATE_KIND_INCOMPATIBLE_WITH_IDENTITY_EVIDENCE" },
  );

  const specializedDefinition = JSON.parse(await readFile(fixtureUrl, "utf8"));
  specializedDefinition.request.explicitConditions[0].statement = "b = 2 > 0";
  specializedDefinition.request.explicitConditions[1].statement = "b = 2 != 1";
  specializedDefinition.request.explicitConditions[2].statement =
    "x = 1, y = 1, and x + y = 2 are positive";
  assert.throws(
    () => compileFragmentReviewProposal(specializedDefinition.request),
    { message: "DEFINITION_CONDITIONS_NOT_FIXTURE_EXACT" },
  );

  const differentCounterexample = JSON.parse(
    await readFile(invalidIdentityFixtureUrl, "utf8"),
  );
  differentCounterexample.request.fragment.content = "log_b(x) = x";
  differentCounterexample.request.evidence[0].statement = "log_b(x) = x";
  assert.throws(
    () => compileFragmentReviewProposal(differentCounterexample.request),
    { message: "COUNTEREXAMPLE_FRAGMENT_NOT_FIXTURE_EXACT" },
  );

  const wrongRelationTarget = JSON.parse(await readFile(fixtureUrl, "utf8"));
  wrongRelationTarget.request.relationCandidates[0].targetId =
    "atom.logarithm.real-domain-conditions";
  wrongRelationTarget.request.relationCandidates[0].evidenceIds = [
    "evidence.context.real-logarithm",
    "evidence.atom.real-domain-conditions",
  ];
  assert.throws(
    () => compileFragmentReviewProposal(wrongRelationTarget.request),
    { message: "RELATION_TARGET_INCOMPATIBLE_WITH_KIND:INVERSE_OF" },
  );
});

test("rejects contradictory user-supplied context before a known judgment", async () => {
  const definition = JSON.parse(await readFile(fixtureUrl, "utf8"));
  definition.request.evidence[1].statement = "b <= 0; b = 1; x <= 0";
  assert.throws(
    () => compileFragmentReviewProposal(definition.request),
    { message: "CONTEXT_EVIDENCE_MISMATCH:DEFINITIONAL_EQUIVALENCE" },
  );

  const counterexample = JSON.parse(
    await readFile(invalidIdentityFixtureUrl, "utf8"),
  );
  counterexample.request.evidence[1].statement = "b = 3; x = -1; y = -1";
  assert.throws(
    () => compileFragmentReviewProposal(counterexample.request),
    { message: "CONTEXT_EVIDENCE_MISMATCH:COUNTEREXAMPLE" },
  );

  const missingContext = JSON.parse(
    await readFile(missingContextFixtureUrl, "utf8"),
  );
  missingContext.request.evidence[1].statement =
    "A logarithm base and real-domain conditions were supplied.";
  assert.throws(
    () => compileFragmentReviewProposal(missingContext.request),
    { message: "CONTEXT_EVIDENCE_MISMATCH:MISSING_CONTEXT" },
  );
});

test("rejects added unbound evidence even when a valid decisive witness remains", async () => {
  const definitionFragmentConflict = JSON.parse(
    await readFile(fixtureUrl, "utf8"),
  );
  definitionFragmentConflict.request.evidence.push({
    evidenceId: "evidence.fragment.conflicting-definition",
    subjectId: definitionFragmentConflict.request.fragment.fragmentId,
    subjectRevision: null,
    evidenceClass: "SUBMITTED_FRAGMENT",
    statement: "log_b(x) = b^x",
    supports: ["DEFINITIONAL_EQUIVALENCE"],
    uncertaintyCodes: [],
  });
  assert.throws(
    () => compileFragmentReviewProposal(definitionFragmentConflict.request),
    { message: "DEFINITIONAL_EQUIVALENCE_EVIDENCE_NOT_BOUND" },
  );

  const definitionTargetConflict = JSON.parse(
    await readFile(fixtureUrl, "utf8"),
  );
  definitionTargetConflict.request.evidence.push({
    evidenceId: "evidence.atom.conflicting-definition",
    subjectId: "atom.logarithm.definition",
    subjectRevision: "revision.1",
    evidenceClass: "ACCEPTED_ATOM_SNAPSHOT",
    statement: "A different accepted definition.",
    supports: ["DEFINITIONAL_EQUIVALENCE"],
    uncertaintyCodes: [],
  });
  assert.throws(
    () => compileFragmentReviewProposal(definitionTargetConflict.request),
    {
      message:
        "ACCEPTED_ATOM_EVIDENCE_MISMATCH:evidence.atom.conflicting-definition",
    },
  );

  const counterexampleConflict = JSON.parse(
    await readFile(invalidIdentityFixtureUrl, "utf8"),
  );
  counterexampleConflict.request.evidence.push({
    evidenceId: "evidence.local.conflicting-counterexample",
    subjectId: counterexampleConflict.request.fragment.fragmentId,
    subjectRevision: null,
    evidenceClass: "LOCAL_VERIFICATION",
    statement: "At b = 2, x = 1, and y = 1, both sides are 0.",
    supports: ["COUNTEREXAMPLE"],
    uncertaintyCodes: [],
  });
  assert.throws(
    () => compileFragmentReviewProposal(counterexampleConflict.request),
    { message: "COUNTEREXAMPLE_STATEMENT_MISMATCH" },
  );

  const missingContextConflict = JSON.parse(
    await readFile(missingContextFixtureUrl, "utf8"),
  );
  missingContextConflict.request.evidence.push({
    evidenceId: "evidence.fragment.conflicting-missing-context",
    subjectId: missingContextConflict.request.fragment.fragmentId,
    subjectRevision: null,
    evidenceClass: "SUBMITTED_FRAGMENT",
    statement: "A different fragment.",
    supports: ["MISSING_CONTEXT"],
    uncertaintyCodes: ["MISSING_LOGARITHM_BASE"],
  });
  assert.throws(
    () => compileFragmentReviewProposal(missingContextConflict.request),
    { message: "MISSING_CONTEXT_EVIDENCE_NOT_BOUND" },
  );
});

test("projects only judgment-relevant evidence into the identity result", async () => {
  const fixture = JSON.parse(await readFile(fixtureUrl, "utf8"));
  fixture.request.evidence.push({
    evidenceId: "evidence.unbound.unreferenced-relation",
    subjectId: fixture.request.fragment.fragmentId,
    subjectRevision: null,
    evidenceClass: "LOCAL_VERIFICATION",
    statement: "An unrelated relation claim.",
    supports: ["RELATION"],
    uncertaintyCodes: [],
  });

  const proposal = compileFragmentReviewProposal(fixture.request);

  assert.deepEqual(proposal.identityJudgment.evidenceIds, [
    "evidence.fragment.exact",
    "evidence.context.real-logarithm",
    "evidence.atom.logarithm-definition",
  ]);
  assert.equal(
    proposal.relationProposals.some((relation) =>
      relation.evidenceIds.includes("evidence.unbound.unreferenced-relation"),
    ),
    false,
  );
});

test("keeps relation-only uncertainty from changing a known identity judgment", async () => {
  const fixture = JSON.parse(await readFile(fixtureUrl, "utf8"));
  fixture.request.evidence.push({
    evidenceId: "evidence.relation.scope-uncertain",
    subjectId: fixture.request.fragment.fragmentId,
    subjectRevision: null,
    evidenceClass: "LOCAL_VERIFICATION",
    statement: "The scope of a separate relation is unresolved.",
    supports: ["RELATION"],
    uncertaintyCodes: ["AMBIGUOUS_RELATION_SCOPE"],
  });

  const proposal = compileFragmentReviewProposal(fixture.request);

  assert.deepEqual(proposal, fixture.expected);
});

test("keeps relation-only evidence out of unknown identity lineage", async () => {
  const fixture = JSON.parse(await readFile(missingContextFixtureUrl, "utf8"));
  fixture.request.evidence.push({
    evidenceId: "evidence.relation.scope-uncertain",
    subjectId: fixture.request.fragment.fragmentId,
    subjectRevision: null,
    evidenceClass: "LOCAL_VERIFICATION",
    statement: "The scope of a separate relation is unresolved.",
    supports: ["RELATION"],
    uncertaintyCodes: ["AMBIGUOUS_RELATION_SCOPE"],
  });

  const proposal = compileFragmentReviewProposal(fixture.request);

  assert.deepEqual(proposal, fixture.expected);
});

test("projects only comparison anchors when identity evidence is insufficient", async () => {
  const fixture = JSON.parse(await readFile(missingContextFixtureUrl, "utf8"));
  for (const evidence of fixture.request.evidence) {
    evidence.supports = ["RELATION"];
    evidence.uncertaintyCodes = [];
  }
  const expected = structuredClone(fixture.expected);
  expected.identityJudgment.evidenceIds = [
    "evidence.fragment.missing-context",
    "evidence.atom.logarithm-definition",
  ];
  expected.identityJudgment.uncertainty = [
    "INSUFFICIENT_IDENTITY_EVIDENCE",
  ];

  const proposal = compileFragmentReviewProposal(fixture.request);

  assert.deepEqual(proposal, expected);
});

test("binds evidence subjects, revisions, relation roles, and missing-context consistency", async () => {
  const identityRevision = JSON.parse(await readFile(fixtureUrl, "utf8"));
  identityRevision.request.acceptedAtoms[0].revision = "revision.2";
  assert.throws(
    () => compileFragmentReviewProposal(identityRevision.request),
    { message: "ATOM_REVISION_NOT_FIXTURE_EXACT:atom.logarithm.definition" },
  );

  const relationRevision = JSON.parse(await readFile(fixtureUrl, "utf8"));
  relationRevision.request.acceptedAtoms[1].revision = "revision.2";
  assert.throws(
    () => compileFragmentReviewProposal(relationRevision.request),
    { message: "ATOM_REVISION_NOT_FIXTURE_EXACT:atom.exponentiation.function" },
  );

  const identityEvidenceSubject = JSON.parse(await readFile(fixtureUrl, "utf8"));
  identityEvidenceSubject.request.evidence[2].subjectId =
    "atom.exponentiation.function";
  assert.throws(
    () => compileFragmentReviewProposal(identityEvidenceSubject.request),
    { message: "ACCEPTED_ATOM_EVIDENCE_MISMATCH:evidence.atom.logarithm-definition" },
  );

  const crossRelationEvidence = JSON.parse(await readFile(fixtureUrl, "utf8"));
  crossRelationEvidence.request.relationCandidates[0].evidenceIds.push(
    "evidence.atom.real-domain-conditions",
  );
  assert.throws(
    () => compileFragmentReviewProposal(crossRelationEvidence.request),
    { message: "RELATION_EVIDENCE_NOT_KIND_BOUND:INVERSE_OF" },
  );

  const crossFixtureEvidence = JSON.parse(await readFile(fixtureUrl, "utf8"));
  crossFixtureEvidence.request.evidence.push({
    evidenceId: "evidence.local.false-sum-copy",
    subjectId: crossFixtureEvidence.request.fragment.fragmentId,
    subjectRevision: null,
    evidenceClass: "LOCAL_VERIFICATION",
    statement:
      "At b = 2, x = 1, and y = 1, the left side is 1 and the right side is 0.",
    supports: ["RELATION"],
    uncertaintyCodes: [],
  });
  crossFixtureEvidence.request.relationCandidates[0].evidenceIds.push(
    "evidence.local.false-sum-copy",
  );
  assert.throws(
    () => compileFragmentReviewProposal(crossFixtureEvidence.request),
    { message: "RELATION_EVIDENCE_NOT_KIND_BOUND:INVERSE_OF" },
  );

  const wrongSnapshotStatement = JSON.parse(await readFile(fixtureUrl, "utf8"));
  wrongSnapshotStatement.request.acceptedAtoms[1].statement =
    "A real logarithm log_b(x) requires b > 0, b != 1, and x > 0.";
  wrongSnapshotStatement.request.evidence[3].statement =
    wrongSnapshotStatement.request.acceptedAtoms[1].statement;
  assert.throws(
    () => compileFragmentReviewProposal(wrongSnapshotStatement.request),
    {
      message:
        "ATOM_STATEMENT_NOT_FIXTURE_EXACT:atom.exponentiation.function",
    },
  );

  const semanticDuplicate = JSON.parse(await readFile(fixtureUrl, "utf8"));
  const duplicateEvidence = structuredClone(semanticDuplicate.request.evidence[3]);
  duplicateEvidence.evidenceId = "evidence.atom.exponentiation-function-copy";
  semanticDuplicate.request.evidence.push(duplicateEvidence);
  semanticDuplicate.request.relationCandidates[0].evidenceIds.push(
    duplicateEvidence.evidenceId,
  );
  assert.throws(
    () => compileFragmentReviewProposal(semanticDuplicate.request),
    { message: "DUPLICATE_EVIDENCE_OCCURRENCE" },
  );

  const missingWithConditions = JSON.parse(
    await readFile(missingContextFixtureUrl, "utf8"),
  );
  missingWithConditions.request.explicitConditions = [
    {
      code: "REAL_BASE_POSITIVE",
      statement: "b > 0",
      provenanceClass: "USER_SUPPLIED_CONTEXT",
    },
  ];
  assert.throws(
    () => compileFragmentReviewProposal(missingWithConditions.request),
    { message: "MISSING_CONTEXT_CONTRADICTS_EXPLICIT_CONDITIONS" },
  );

  const definitionWithMissing = JSON.parse(await readFile(fixtureUrl, "utf8"));
  definitionWithMissing.request.evidence.push({
    evidenceId: "evidence.context.conflicting-missing",
    subjectId: definitionWithMissing.request.fragment.fragmentId,
    subjectRevision: null,
    evidenceClass: "USER_SUPPLIED_CONTEXT",
    statement: "No logarithm base or real-domain conditions were supplied.",
    supports: ["MISSING_CONTEXT"],
    uncertaintyCodes: ["MISSING_LOGARITHM_BASE"],
  });
  definitionWithMissing.request.relationCandidates = [];
  assert.throws(
    () => compileFragmentReviewProposal(definitionWithMissing.request),
    { message: "MISSING_CONTEXT_CONTRADICTS_EXPLICIT_CONDITIONS" },
  );
});

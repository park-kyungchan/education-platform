import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { compileFragmentEvidenceReviewPacket as compileFragmentEvidenceReviewPacketFromJson } from "../src/compile-fragment-evidence-review-packet.ts";

function compileFragmentEvidenceReviewPacket(request, proposal) {
  return compileFragmentEvidenceReviewPacketFromJson(
    JSON.stringify(request),
    JSON.stringify(proposal),
  );
}

const fixtureUrl = new URL(
  "../fixtures/logarithm-definition-evidence-review-packet.fixture.json",
  import.meta.url,
);
const contractUrl = new URL(
  "../contracts/fragment-evidence-review-packet.v1.schema.json",
  import.meta.url,
);

function assertDeepFrozen(value) {
  if (value === null || typeof value !== "object") {
    return;
  }
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) {
    assertDeepFrozen(child);
  }
}

test("builds a complete evidence review packet without applying canonical meaning", async () => {
  const fixture = JSON.parse(await readFile(fixtureUrl, "utf8"));

  const actual = compileFragmentEvidenceReviewPacket(
    fixture.request,
    fixture.proposal,
  );

  assert.deepEqual(actual, fixture.expected);
  assertDeepFrozen(actual);
});

test("rejects a proposal that is not the complete request-derived proposal", async () => {
  const fixture = JSON.parse(await readFile(fixtureUrl, "utf8"));
  const tamperedProposal = structuredClone(fixture.proposal);
  tamperedProposal.identityJudgment.judgment = "UNKNOWN";
  tamperedProposal.identityJudgment.uncertainty = ["UNRESOLVED_IDENTITY"];
  tamperedProposal.relationProposals = [];
  tamperedProposal.recommendedDisposition = "DEFER";

  assert.throws(
    () =>
      compileFragmentEvidenceReviewPacket(
        fixture.request,
        tamperedProposal,
      ),
    { message: "EVIDENCE_REVIEW_PROPOSAL_REQUEST_MISMATCH" },
  );
});

test("rejects sparse proposal arrays at the serialized tuple boundary", async () => {
  const fixture = JSON.parse(await readFile(fixtureUrl, "utf8"));
  const mutations = [
    (proposal) => delete proposal.relationProposals[0],
    (proposal) => delete proposal.identityJudgment.evidenceIds[0],
    (proposal) => delete proposal.relationProposals[0].evidenceIds[0],
  ];

  for (const mutate of mutations) {
    const proposal = structuredClone(fixture.proposal);
    mutate(proposal);

    assert.throws(
      () => compileFragmentEvidenceReviewPacket(fixture.request, proposal),
      { message: "EVIDENCE_REVIEW_PROPOSAL_REQUEST_MISMATCH" },
    );
  }
});

test("rejects non-string proposal inputs without executing accessors", async () => {
  const fixture = JSON.parse(await readFile(fixtureUrl, "utf8"));
  let accessorCallCount = 0;
  const mutations = [
    (proposal) =>
      Object.defineProperty(proposal, "hidden", {
        value: true,
        enumerable: false,
      }),
    (proposal) => (proposal[Symbol("hidden")] = true),
    (proposal) =>
      Object.defineProperty(proposal.identityJudgment, "hidden", {
        value: true,
        enumerable: false,
      }),
    (proposal) => (proposal.identityJudgment[Symbol("hidden")] = true),
    (proposal) =>
      Object.defineProperty(proposal.identityJudgment, "judgment", {
        enumerable: true,
        configurable: true,
        get() {
          accessorCallCount += 1;
          return "SAME";
        },
      }),
    (proposal) => {
      const relation = proposal.relationProposals[0];
      Object.defineProperty(proposal.relationProposals, "0", {
        enumerable: true,
        configurable: true,
        get() {
          accessorCallCount += 1;
          return relation;
        },
      });
    },
    (proposal) => (proposal.relationProposals.unexpected = true),
  ];
  const requestText = JSON.stringify(fixture.request);

  for (const mutate of mutations) {
    const proposal = structuredClone(fixture.proposal);
    mutate(proposal);

    assert.throws(
      () => compileFragmentEvidenceReviewPacketFromJson(requestText, proposal),
      { message: "INVALID_JSON_DOCUMENT:proposal:EXPECTED_STRING" },
    );
  }
  assert.equal(accessorCallCount, 0);
});

test("declares a strict Draft 2020-12 EvidenceReviewPacket contract", async () => {
  const contract = JSON.parse(await readFile(contractUrl, "utf8"));

  assert.equal(contract.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(contract.type, "object");
  assert.equal(contract.additionalProperties, false);
  assert.deepEqual(contract.required, [
    "schemaVersion",
    "decisionRecordId",
    "proposalId",
    "requestId",
    "supersedesProposalId",
    "fragment",
    "candidateKind",
    "identityReview",
    "relationReviews",
    "unusedEvidenceOccurrences",
    "recommendedDisposition",
    "humanDecision",
    "canonicalApplication",
  ]);
  assert.equal(contract.$defs.evidenceOccurrence.additionalProperties, false);
});

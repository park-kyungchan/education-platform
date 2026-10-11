import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { compileFragmentEvidenceReviewPacket } from "../src/compile-fragment-evidence-review-packet.ts";
import { compileHumanSemanticDispositionRecord } from "../src/compile-human-semantic-disposition-record.ts";

const packetFixtureUrl = new URL(
  "../fixtures/logarithm-definition-evidence-review-packet.fixture.json",
  import.meta.url,
);
const contractUrl = new URL(
  "../contracts/human-semantic-disposition-record.v1.schema.json",
  import.meta.url,
);
const dispositionFixtureUrl = new URL(
  "../fixtures/logarithm-human-semantic-disposition.fixture.json",
  import.meta.url,
);
const packetCoverageResultUrl = new URL(
  "../results/IMMUTABLE_HUMAN_SEMANTIC_DISPOSITION_RECORD-R1/logarithm-cluster.evidence-review-packets.json",
  import.meta.url,
);

function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function assertDeepFrozen(value) {
  if (value === null || typeof value !== "object") {
    return;
  }
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) {
    assertDeepFrozen(child);
  }
}

test("compiles one aligned Human disposition for one exact reviewed tuple", async () => {
  const fixture = JSON.parse(await readFile(packetFixtureUrl, "utf8"));
  const requestJsonText = JSON.stringify(fixture.request);
  const proposalJsonText = JSON.stringify(fixture.proposal);
  const evidenceReviewPacketJsonText = JSON.stringify(fixture.expected);
  const dispositionInput = {
    schemaVersion: "mathematics-cartography.human-semantic-disposition-input.v1",
    dispositionRecordId:
      "disposition.fixture.logarithm-definition-equivalence.1",
    supersedesDispositionRecordId: null,
    actor: "HUMAN_SEMANTIC_REVIEWER",
    trigger: "EVIDENCE_REVIEW_PACKET_READY_FOR_HUMAN_DISPOSITION",
    requestId: fixture.request.requestId,
    proposalId: fixture.proposal.proposalId,
    requestSha256: sha256(requestJsonText),
    proposalSha256: sha256(proposalJsonText),
    evidenceReviewPacketSha256: sha256(evidenceReviewPacketJsonText),
    humanDisposition: "CANONICALIZE",
    decisionReasonCodes: [],
    citedEvidenceIds: [],
    decidedAtUtc: "2026-01-01T00:00:00Z",
  };

  const actual = compileHumanSemanticDispositionRecord(
    requestJsonText,
    proposalJsonText,
    evidenceReviewPacketJsonText,
    JSON.stringify(dispositionInput),
  );

  assert.deepEqual(actual, {
    schemaVersion:
      "mathematics-cartography.human-semantic-disposition-record.v1",
    decisionRecordId: "IMMUTABLE_HUMAN_SEMANTIC_DISPOSITION_RECORD_001",
    dispositionRecordId: dispositionInput.dispositionRecordId,
    supersedesDispositionRecordId: null,
    actor: "HUMAN_SEMANTIC_REVIEWER",
    trigger: "EVIDENCE_REVIEW_PACKET_READY_FOR_HUMAN_DISPOSITION",
    requestId: fixture.request.requestId,
    proposalId: fixture.proposal.proposalId,
    requestSha256: dispositionInput.requestSha256,
    proposalSha256: dispositionInput.proposalSha256,
    evidenceReviewPacketSha256:
      dispositionInput.evidenceReviewPacketSha256,
    recommendedDisposition: "CANONICALIZE",
    humanDisposition: "CANONICALIZE",
    decisionReasonCodes: [],
    citedEvidenceIds: [],
    decidedAtUtc: "2026-01-01T00:00:00Z",
    canonicalApplication: "NOT_PERFORMED",
  });

  const contract = JSON.parse(await readFile(contractUrl, "utf8"));
  assert.equal(contract.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(contract.additionalProperties, false);
});

test("checks every public argument as a primitive string before parsing", async () => {
  const fixture = JSON.parse(await readFile(packetFixtureUrl, "utf8"));
  const requestJsonText = JSON.stringify(fixture.request);
  const proposalJsonText = JSON.stringify(fixture.proposal);
  const evidenceReviewPacketJsonText = JSON.stringify(fixture.expected);
  const dispositionInputJsonText = JSON.stringify({
    schemaVersion: "mathematics-cartography.human-semantic-disposition-input.v1",
    dispositionRecordId:
      "disposition.fixture.logarithm-definition-equivalence.1",
    supersedesDispositionRecordId: null,
    actor: "HUMAN_SEMANTIC_REVIEWER",
    trigger: "EVIDENCE_REVIEW_PACKET_READY_FOR_HUMAN_DISPOSITION",
    requestId: fixture.request.requestId,
    proposalId: fixture.proposal.proposalId,
    requestSha256: sha256(requestJsonText),
    proposalSha256: sha256(proposalJsonText),
    evidenceReviewPacketSha256: sha256(evidenceReviewPacketJsonText),
    humanDisposition: "CANONICALIZE",
    decisionReasonCodes: [],
    citedEvidenceIds: [],
    decidedAtUtc: "2026-01-01T00:00:00Z",
  });
  const validInputs = [
    requestJsonText,
    proposalJsonText,
    evidenceReviewPacketJsonText,
    dispositionInputJsonText,
  ];
  const expectedLabels = [
    "request",
    "proposal",
    "evidenceReviewPacket",
    "dispositionInput",
  ];
  const hookCalls = [];
  const nonString = new Proxy(
    {},
    {
      get() {
        hookCalls.push("get");
        throw new Error("CALLER_HOOK_EXECUTED");
      },
      getPrototypeOf() {
        hookCalls.push("getPrototypeOf");
        throw new Error("CALLER_HOOK_EXECUTED");
      },
      ownKeys() {
        hookCalls.push("ownKeys");
        throw new Error("CALLER_HOOK_EXECUTED");
      },
    },
  );
  const originalParse = JSON.parse;
  let parseCount = 0;
  JSON.parse = (...arguments_) => {
    parseCount += 1;
    return Reflect.apply(originalParse, JSON, arguments_);
  };
  try {
    for (let index = 0; index < validInputs.length; index += 1) {
      const inputs = [...validInputs];
      inputs[index] = nonString;
      parseCount = 0;
      assert.throws(
        () => compileHumanSemanticDispositionRecord(...inputs),
        {
          message: `INVALID_JSON_DOCUMENT:${expectedLabels[index]}:EXPECTED_STRING`,
        },
      );
      assert.equal(parseCount, 0);
    }
  } finally {
    JSON.parse = originalParse;
  }
  assert.deepEqual(hookCalls, []);
});

test("preserves strict JSON errors for packet and disposition document roles", async () => {
  const fixture = JSON.parse(await readFile(packetFixtureUrl, "utf8"));
  const requestJsonText = JSON.stringify(fixture.request);
  const proposalJsonText = JSON.stringify(fixture.proposal);
  const evidenceReviewPacketJsonText = JSON.stringify(fixture.expected);
  const malformed = '{"a":1,"\\u0061":2}';

  assert.throws(
    () =>
      compileHumanSemanticDispositionRecord(
        requestJsonText,
        proposalJsonText,
        malformed,
        "{}",
      ),
    {
      message:
        "INVALID_JSON_DOCUMENT:evidenceReviewPacket:DUPLICATE_KEY",
    },
  );
  assert.throws(
    () =>
      compileHumanSemanticDispositionRecord(
        requestJsonText,
        proposalJsonText,
        evidenceReviewPacketJsonText,
        malformed,
      ),
    { message: "INVALID_JSON_DOCUMENT:dispositionInput:DUPLICATE_KEY" },
  );
});

test("rejects stale request proposal and packet SHA-256 bindings", async () => {
  const fixture = JSON.parse(await readFile(packetFixtureUrl, "utf8"));
  const requestJsonText = JSON.stringify(fixture.request);
  const proposalJsonText = JSON.stringify(fixture.proposal);
  const evidenceReviewPacketJsonText = JSON.stringify(fixture.expected);
  const baseInput = {
    schemaVersion: "mathematics-cartography.human-semantic-disposition-input.v1",
    dispositionRecordId:
      "disposition.fixture.logarithm-definition-equivalence.1",
    supersedesDispositionRecordId: null,
    actor: "HUMAN_SEMANTIC_REVIEWER",
    trigger: "EVIDENCE_REVIEW_PACKET_READY_FOR_HUMAN_DISPOSITION",
    requestId: fixture.request.requestId,
    proposalId: fixture.proposal.proposalId,
    requestSha256: sha256(requestJsonText),
    proposalSha256: sha256(proposalJsonText),
    evidenceReviewPacketSha256: sha256(evidenceReviewPacketJsonText),
    humanDisposition: "CANONICALIZE",
    decisionReasonCodes: [],
    citedEvidenceIds: [],
    decidedAtUtc: "2026-01-01T00:00:00Z",
  };
  const mutations = [
    ["requestSha256", "HUMAN_DISPOSITION_REQUEST_SHA256_MISMATCH"],
    ["proposalSha256", "HUMAN_DISPOSITION_PROPOSAL_SHA256_MISMATCH"],
    [
      "evidenceReviewPacketSha256",
      "HUMAN_DISPOSITION_PACKET_SHA256_MISMATCH",
    ],
  ];

  for (const [field, message] of mutations) {
    const input = structuredClone(baseInput);
    input[field] = "0".repeat(64);
    assert.throws(
      () =>
        compileHumanSemanticDispositionRecord(
          requestJsonText,
          proposalJsonText,
          evidenceReviewPacketJsonText,
          JSON.stringify(input),
        ),
      { message },
    );
  }
});

test("rejects disposition identifiers outside the exact reviewed tuple", async () => {
  const fixture = JSON.parse(await readFile(packetFixtureUrl, "utf8"));
  const requestJsonText = JSON.stringify(fixture.request);
  const proposalJsonText = JSON.stringify(fixture.proposal);
  const evidenceReviewPacketJsonText = JSON.stringify(fixture.expected);
  const baseInput = {
    schemaVersion: "mathematics-cartography.human-semantic-disposition-input.v1",
    dispositionRecordId:
      "disposition.fixture.logarithm-definition-equivalence.1",
    supersedesDispositionRecordId: null,
    actor: "HUMAN_SEMANTIC_REVIEWER",
    trigger: "EVIDENCE_REVIEW_PACKET_READY_FOR_HUMAN_DISPOSITION",
    requestId: fixture.request.requestId,
    proposalId: fixture.proposal.proposalId,
    requestSha256: sha256(requestJsonText),
    proposalSha256: sha256(proposalJsonText),
    evidenceReviewPacketSha256: sha256(evidenceReviewPacketJsonText),
    humanDisposition: "CANONICALIZE",
    decisionReasonCodes: [],
    citedEvidenceIds: [],
    decidedAtUtc: "2026-01-01T00:00:00Z",
  };
  const mutations = [
    ["requestId", "request.other", "HUMAN_DISPOSITION_REQUEST_ID_MISMATCH"],
    ["proposalId", "proposal.other", "HUMAN_DISPOSITION_PROPOSAL_ID_MISMATCH"],
  ];

  for (const [field, value, message] of mutations) {
    const input = structuredClone(baseInput);
    input[field] = value;
    assert.throws(
      () =>
        compileHumanSemanticDispositionRecord(
          requestJsonText,
          proposalJsonText,
          evidenceReviewPacketJsonText,
          JSON.stringify(input),
        ),
      { message },
    );
  }
});

test("rejects undeclared and malformed disposition input fields", async () => {
  const fixture = JSON.parse(await readFile(packetFixtureUrl, "utf8"));
  const requestJsonText = JSON.stringify(fixture.request);
  const proposalJsonText = JSON.stringify(fixture.proposal);
  const evidenceReviewPacketJsonText = JSON.stringify(fixture.expected);
  const baseInput = {
    schemaVersion: "mathematics-cartography.human-semantic-disposition-input.v1",
    dispositionRecordId:
      "disposition.fixture.logarithm-definition-equivalence.1",
    supersedesDispositionRecordId: null,
    actor: "HUMAN_SEMANTIC_REVIEWER",
    trigger: "EVIDENCE_REVIEW_PACKET_READY_FOR_HUMAN_DISPOSITION",
    requestId: fixture.request.requestId,
    proposalId: fixture.proposal.proposalId,
    requestSha256: sha256(requestJsonText),
    proposalSha256: sha256(proposalJsonText),
    evidenceReviewPacketSha256: sha256(evidenceReviewPacketJsonText),
    humanDisposition: "CANONICALIZE",
    decisionReasonCodes: [],
    citedEvidenceIds: [],
    decidedAtUtc: "2026-01-01T00:00:00Z",
  };
  const mutations = [
    ["UNDECLARED_PROPERTY:dispositionInput:unexpected", (input) => (input.unexpected = true)],
    ["INVALID_HUMAN_DISPOSITION_SCHEMA_VERSION", (input) => (input.schemaVersion = "v2")],
    ["INVALID_IDENTIFIER:dispositionRecordId", (input) => (input.dispositionRecordId += "\n")],
    ["INVALID_IDENTIFIER:supersedesDispositionRecordId", (input) => (input.supersedesDispositionRecordId = "disposition/invalid")],
    ["INVALID_ACTOR", (input) => (input.actor = "MODEL")],
    ["INVALID_TRIGGER", (input) => (input.trigger = "AUTO_APPLY")],
    ["INVALID_SHA256:requestSha256", (input) => (input.requestSha256 = "A".repeat(64))],
    ["INVALID_HUMAN_DISPOSITION", (input) => (input.humanDisposition = "APPLY")],
    ["INVALID_ARRAY:decisionReasonCodes", (input) => (input.decisionReasonCodes = "NONE")],
    ["INVALID_REASON_CODE:decisionReasonCodes[0]", (input) => input.decisionReasonCodes.push("FREE_TEXT")],
    ["DUPLICATE_REASON_CODE", (input) => (input.decisionReasonCodes = ["ADDITIONAL_EVIDENCE_REQUIRED", "ADDITIONAL_EVIDENCE_REQUIRED"])],
    ["INVALID_ARRAY:citedEvidenceIds", (input) => (input.citedEvidenceIds = null)],
    ["INVALID_IDENTIFIER:citedEvidenceIds[0]", (input) => input.citedEvidenceIds.push("evidence/invalid")],
    ["DUPLICATE_CITED_EVIDENCE_ID", (input) => (input.citedEvidenceIds = ["evidence.fragment.exact", "evidence.fragment.exact"])],
  ];

  for (const [message, mutate] of mutations) {
    const input = structuredClone(baseInput);
    mutate(input);
    assert.throws(
      () =>
        compileHumanSemanticDispositionRecord(
          requestJsonText,
          proposalJsonText,
          evidenceReviewPacketJsonText,
          JSON.stringify(input),
        ),
      { message },
    );
  }
});

test("requires an explicit canonical UTC decision time without ambient clock access", async () => {
  const fixture = JSON.parse(await readFile(packetFixtureUrl, "utf8"));
  const requestJsonText = JSON.stringify(fixture.request);
  const proposalJsonText = JSON.stringify(fixture.proposal);
  const evidenceReviewPacketJsonText = JSON.stringify(fixture.expected);
  const baseInput = {
    schemaVersion: "mathematics-cartography.human-semantic-disposition-input.v1",
    dispositionRecordId:
      "disposition.fixture.logarithm-definition-equivalence.1",
    supersedesDispositionRecordId: null,
    actor: "HUMAN_SEMANTIC_REVIEWER",
    trigger: "EVIDENCE_REVIEW_PACKET_READY_FOR_HUMAN_DISPOSITION",
    requestId: fixture.request.requestId,
    proposalId: fixture.proposal.proposalId,
    requestSha256: sha256(requestJsonText),
    proposalSha256: sha256(proposalJsonText),
    evidenceReviewPacketSha256: sha256(evidenceReviewPacketJsonText),
    humanDisposition: "CANONICALIZE",
    decisionReasonCodes: [],
    citedEvidenceIds: [],
    decidedAtUtc: "2024-02-29T23:59:59Z",
  };
  const originalNow = Date.now;
  let nowCallCount = 0;
  Date.now = () => {
    nowCallCount += 1;
    throw new Error("AMBIENT_CLOCK_ACCESSED");
  };
  try {
    const record = compileHumanSemanticDispositionRecord(
      requestJsonText,
      proposalJsonText,
      evidenceReviewPacketJsonText,
      JSON.stringify(baseInput),
    );
    assert.equal(record.decidedAtUtc, "2024-02-29T23:59:59Z");
  } finally {
    Date.now = originalNow;
  }
  assert.equal(nowCallCount, 0);

  for (const invalid of [
    "0000-01-01T00:00:00Z",
    "2026-02-29T00:00:00Z",
    "2026-04-31T00:00:00Z",
    "2026-01-01T24:00:00Z",
    "2026-01-01T00:00:60Z",
    "2026-01-01T00:00:00.000Z",
    "2026-01-01T00:00:00+00:00",
  ]) {
    const input = { ...baseInput, decidedAtUtc: invalid };
    assert.throws(
      () =>
        compileHumanSemanticDispositionRecord(
          requestJsonText,
          proposalJsonText,
          evidenceReviewPacketJsonText,
          JSON.stringify(input),
        ),
      { message: "INVALID_DECIDED_AT_UTC" },
    );
  }
});

test("creates correction successors and rejects self-supersession", async () => {
  const fixture = JSON.parse(await readFile(packetFixtureUrl, "utf8"));
  const requestJsonText = JSON.stringify(fixture.request);
  const proposalJsonText = JSON.stringify(fixture.proposal);
  const evidenceReviewPacketJsonText = JSON.stringify(fixture.expected);
  const input = {
    schemaVersion: "mathematics-cartography.human-semantic-disposition-input.v1",
    dispositionRecordId:
      "disposition.fixture.logarithm-definition-equivalence.2",
    supersedesDispositionRecordId:
      "disposition.fixture.logarithm-definition-equivalence.1",
    actor: "HUMAN_SEMANTIC_REVIEWER",
    trigger: "EVIDENCE_REVIEW_PACKET_READY_FOR_HUMAN_DISPOSITION",
    requestId: fixture.request.requestId,
    proposalId: fixture.proposal.proposalId,
    requestSha256: sha256(requestJsonText),
    proposalSha256: sha256(proposalJsonText),
    evidenceReviewPacketSha256: sha256(evidenceReviewPacketJsonText),
    humanDisposition: "CANONICALIZE",
    decisionReasonCodes: [],
    citedEvidenceIds: [],
    decidedAtUtc: "2026-01-02T00:00:00Z",
  };

  const successor = compileHumanSemanticDispositionRecord(
    requestJsonText,
    proposalJsonText,
    evidenceReviewPacketJsonText,
    JSON.stringify(input),
  );
  assert.equal(
    successor.supersedesDispositionRecordId,
    "disposition.fixture.logarithm-definition-equivalence.1",
  );

  const selfSupersession = {
    ...input,
    supersedesDispositionRecordId: input.dispositionRecordId,
  };
  assert.throws(
    () =>
      compileHumanSemanticDispositionRecord(
        requestJsonText,
        proposalJsonText,
        evidenceReviewPacketJsonText,
        JSON.stringify(selfSupersession),
      ),
    { message: "SELF_SUPERSESSION" },
  );
});

test("requires controlled reasons and exact cited evidence for every override", async () => {
  const fixture = JSON.parse(await readFile(packetFixtureUrl, "utf8"));
  const requestJsonText = JSON.stringify(fixture.request);
  const proposalJsonText = JSON.stringify(fixture.proposal);
  const evidenceReviewPacketJsonText = JSON.stringify(fixture.expected);
  const baseInput = {
    schemaVersion: "mathematics-cartography.human-semantic-disposition-input.v1",
    dispositionRecordId:
      "disposition.fixture.logarithm-definition-equivalence.override.1",
    supersedesDispositionRecordId: null,
    actor: "HUMAN_SEMANTIC_REVIEWER",
    trigger: "EVIDENCE_REVIEW_PACKET_READY_FOR_HUMAN_DISPOSITION",
    requestId: fixture.request.requestId,
    proposalId: fixture.proposal.proposalId,
    requestSha256: sha256(requestJsonText),
    proposalSha256: sha256(proposalJsonText),
    evidenceReviewPacketSha256: sha256(evidenceReviewPacketJsonText),
    humanDisposition: "REJECT",
    decisionReasonCodes: ["HUMAN_EVIDENCE_INTERPRETATION_DIFFERS"],
    citedEvidenceIds: ["evidence.fragment.exact"],
    decidedAtUtc: "2026-01-03T00:00:00Z",
  };

  const override = compileHumanSemanticDispositionRecord(
    requestJsonText,
    proposalJsonText,
    evidenceReviewPacketJsonText,
    JSON.stringify(baseInput),
  );
  assert.equal(override.recommendedDisposition, "CANONICALIZE");
  assert.equal(override.humanDisposition, "REJECT");
  assert.deepEqual(override.decisionReasonCodes, [
    "HUMAN_EVIDENCE_INTERPRETATION_DIFFERS",
  ]);
  assert.deepEqual(override.citedEvidenceIds, ["evidence.fragment.exact"]);

  for (const [decisionReasonCodes, citedEvidenceIds] of [
    [[], []],
    [["HUMAN_EVIDENCE_INTERPRETATION_DIFFERS"], []],
    [[], ["evidence.fragment.exact"]],
  ]) {
    assert.throws(
      () =>
        compileHumanSemanticDispositionRecord(
          requestJsonText,
          proposalJsonText,
          evidenceReviewPacketJsonText,
          JSON.stringify({
            ...baseInput,
            decisionReasonCodes,
            citedEvidenceIds,
          }),
        ),
      { message: "HUMAN_DISPOSITION_REASON_AND_CITATION_REQUIRED" },
    );
  }
});

test("binds controlled reason semantics to conclusion evidence", async () => {
  const fixture = JSON.parse(await readFile(packetFixtureUrl, "utf8"));
  const requestJsonText = JSON.stringify(fixture.request);
  const proposalJsonText = JSON.stringify(fixture.proposal);
  const evidenceReviewPacketJsonText = JSON.stringify(fixture.expected);
  const baseInput = {
    schemaVersion: "mathematics-cartography.human-semantic-disposition-input.v1",
    dispositionRecordId:
      "disposition.fixture.logarithm-definition-equivalence.override.2",
    supersedesDispositionRecordId: null,
    actor: "HUMAN_SEMANTIC_REVIEWER",
    trigger: "EVIDENCE_REVIEW_PACKET_READY_FOR_HUMAN_DISPOSITION",
    requestId: fixture.request.requestId,
    proposalId: fixture.proposal.proposalId,
    requestSha256: sha256(requestJsonText),
    proposalSha256: sha256(proposalJsonText),
    evidenceReviewPacketSha256: sha256(evidenceReviewPacketJsonText),
    humanDisposition: "REJECT",
    decisionReasonCodes: ["HUMAN_EVIDENCE_INTERPRETATION_DIFFERS"],
    citedEvidenceIds: ["evidence.fragment.exact"],
    decidedAtUtc: "2026-01-04T00:00:00Z",
  };

  for (const evidenceId of [
    "evidence.relation.scope-uncertain",
    "evidence.not-present",
  ]) {
    assert.throws(
      () =>
        compileHumanSemanticDispositionRecord(
          requestJsonText,
          proposalJsonText,
          evidenceReviewPacketJsonText,
          JSON.stringify({ ...baseInput, citedEvidenceIds: [evidenceId] }),
        ),
      {
        message:
          `HUMAN_DISPOSITION_CITED_EVIDENCE_NOT_CONCLUSION_BOUND:${evidenceId}`,
      },
    );
  }

  assert.throws(
    () =>
      compileHumanSemanticDispositionRecord(
        requestJsonText,
        proposalJsonText,
        evidenceReviewPacketJsonText,
        JSON.stringify({
          ...baseInput,
          decisionReasonCodes: ["EVIDENCE_CONFIRMS_RECOMMENDATION"],
        }),
      ),
    { message: "INVALID_REASON_CODE_FOR_OVERRIDE:EVIDENCE_CONFIRMS_RECOMMENDATION" },
  );
  assert.throws(
    () =>
      compileHumanSemanticDispositionRecord(
        requestJsonText,
        proposalJsonText,
        evidenceReviewPacketJsonText,
        JSON.stringify({
          ...baseInput,
          humanDisposition: "CANONICALIZE",
          decisionReasonCodes: ["HUMAN_EVIDENCE_INTERPRETATION_DIFFERS"],
        }),
      ),
    {
      message:
        "INVALID_REASON_CODE_FOR_ALIGNED_DISPOSITION:HUMAN_EVIDENCE_INTERPRETATION_DIFFERS",
    },
  );

  const deferredOverride = compileHumanSemanticDispositionRecord(
    requestJsonText,
    proposalJsonText,
    evidenceReviewPacketJsonText,
    JSON.stringify({
      ...baseInput,
      humanDisposition: "DEFER",
      decisionReasonCodes: ["ADDITIONAL_EVIDENCE_REQUIRED"],
    }),
  );
  assert.equal(deferredOverride.humanDisposition, "DEFER");
});

test("enforces the aligned disposition policy across all three proposal cases", async () => {
  const cases = [
    {
      fixtureUrl: new URL(
        "../fixtures/logarithm-definition-equivalence.fixture.json",
        import.meta.url,
      ),
      humanDisposition: "CANONICALIZE",
      decisionReasonCodes: [],
      citedEvidenceIds: [],
    },
    {
      fixtureUrl: new URL(
        "../fixtures/invalid-logarithm-sum-identity.fixture.json",
        import.meta.url,
      ),
      humanDisposition: "REJECT",
      decisionReasonCodes: [],
      citedEvidenceIds: [],
    },
    {
      fixtureUrl: new URL(
        "../fixtures/missing-logarithm-context.fixture.json",
        import.meta.url,
      ),
      humanDisposition: "DEFER",
      decisionReasonCodes: [
        "MISSING_LOGARITHM_BASE",
        "MISSING_REAL_DOMAIN_CONDITIONS",
      ],
      citedEvidenceIds: [
        "evidence.fragment.missing-context",
        "evidence.context.not-supplied",
      ],
    },
  ];
  let deferInputs;

  for (const [index, testCase] of cases.entries()) {
    const source = JSON.parse(await readFile(testCase.fixtureUrl, "utf8"));
    const requestJsonText = JSON.stringify(source.request);
    const proposalJsonText = JSON.stringify(source.expected);
    const packet = compileFragmentEvidenceReviewPacket(
      requestJsonText,
      proposalJsonText,
    );
    const evidenceReviewPacketJsonText = JSON.stringify(packet);
    const dispositionInput = {
      schemaVersion:
        "mathematics-cartography.human-semantic-disposition-input.v1",
      dispositionRecordId: `disposition.fixture.${source.request.proposalId.slice("proposal.".length)}.1`,
      supersedesDispositionRecordId: null,
      actor: "HUMAN_SEMANTIC_REVIEWER",
      trigger: "EVIDENCE_REVIEW_PACKET_READY_FOR_HUMAN_DISPOSITION",
      requestId: source.request.requestId,
      proposalId: source.request.proposalId,
      requestSha256: sha256(requestJsonText),
      proposalSha256: sha256(proposalJsonText),
      evidenceReviewPacketSha256: sha256(evidenceReviewPacketJsonText),
      humanDisposition: testCase.humanDisposition,
      decisionReasonCodes: testCase.decisionReasonCodes,
      citedEvidenceIds: testCase.citedEvidenceIds,
      decidedAtUtc: `2026-01-05T00:00:0${index}Z`,
    };
    const record = compileHumanSemanticDispositionRecord(
      requestJsonText,
      proposalJsonText,
      evidenceReviewPacketJsonText,
      JSON.stringify(dispositionInput),
    );
    assert.equal(record.recommendedDisposition, testCase.humanDisposition);
    assert.equal(record.humanDisposition, testCase.humanDisposition);
    assert.equal(record.canonicalApplication, "NOT_PERFORMED");
    if (testCase.humanDisposition === "DEFER") {
      deferInputs = {
        requestJsonText,
        proposalJsonText,
        evidenceReviewPacketJsonText,
        dispositionInput,
      };
    }
  }

  assert.ok(deferInputs);
  assert.throws(
    () =>
      compileHumanSemanticDispositionRecord(
        deferInputs.requestJsonText,
        deferInputs.proposalJsonText,
        deferInputs.evidenceReviewPacketJsonText,
        JSON.stringify({
          ...deferInputs.dispositionInput,
          decisionReasonCodes: [],
          citedEvidenceIds: [],
        }),
      ),
    { message: "HUMAN_DISPOSITION_REASON_AND_CITATION_REQUIRED" },
  );
});

test("returns a deterministic deeply frozen record isolated from caller input", async () => {
  const fixture = JSON.parse(await readFile(packetFixtureUrl, "utf8"));
  const requestJsonText = JSON.stringify(fixture.request);
  const proposalJsonText = JSON.stringify(fixture.proposal);
  const evidenceReviewPacketJsonText = JSON.stringify(fixture.expected);
  const dispositionInput = {
    schemaVersion: "mathematics-cartography.human-semantic-disposition-input.v1",
    dispositionRecordId:
      "disposition.fixture.logarithm-definition-equivalence.immutable.1",
    supersedesDispositionRecordId: null,
    actor: "HUMAN_SEMANTIC_REVIEWER",
    trigger: "EVIDENCE_REVIEW_PACKET_READY_FOR_HUMAN_DISPOSITION",
    requestId: fixture.request.requestId,
    proposalId: fixture.proposal.proposalId,
    requestSha256: sha256(requestJsonText),
    proposalSha256: sha256(proposalJsonText),
    evidenceReviewPacketSha256: sha256(evidenceReviewPacketJsonText),
    humanDisposition: "CANONICALIZE",
    decisionReasonCodes: [],
    citedEvidenceIds: [],
    decidedAtUtc: "2026-01-06T00:00:00Z",
  };
  const dispositionInputJsonText = JSON.stringify(dispositionInput);

  const first = compileHumanSemanticDispositionRecord(
    requestJsonText,
    proposalJsonText,
    evidenceReviewPacketJsonText,
    dispositionInputJsonText,
  );
  dispositionInput.humanDisposition = "REJECT";
  dispositionInput.decisionReasonCodes.push(
    "HUMAN_EVIDENCE_INTERPRETATION_DIFFERS",
  );
  const second = compileHumanSemanticDispositionRecord(
    requestJsonText,
    proposalJsonText,
    evidenceReviewPacketJsonText,
    dispositionInputJsonText,
  );

  assert.deepEqual(second, first);
  assertDeepFrozen(first);
  assert.equal(first.humanDisposition, "CANONICALIZE");
  assert.throws(() => first.decisionReasonCodes.push("ADDITIONAL_EVIDENCE_REQUIRED"), TypeError);
});

test("declares strict schema parity for identifiers hashes and DEFER evidence", async () => {
  const contract = JSON.parse(await readFile(contractUrl, "utf8"));

  assert.deepEqual(contract.required, [
    "schemaVersion",
    "decisionRecordId",
    "dispositionRecordId",
    "supersedesDispositionRecordId",
    "actor",
    "trigger",
    "requestId",
    "proposalId",
    "requestSha256",
    "proposalSha256",
    "evidenceReviewPacketSha256",
    "recommendedDisposition",
    "humanDisposition",
    "decisionReasonCodes",
    "citedEvidenceIds",
    "decidedAtUtc",
    "canonicalApplication",
  ]);
  assert.deepEqual(contract.$defs.identifier.not, {
    pattern: "[\\u0000-\\u001F\\u007F]",
  });
  assert.equal(contract.$defs.sha256.pattern, "^[0-9a-f]{64}$");
  assert.equal(contract.$defs.sha256.minLength, 64);
  assert.equal(contract.$defs.sha256.maxLength, 64);
  assert.deepEqual(contract.$defs.sha256.not, {
    pattern: "[\\u0000-\\u001F\\u007F]",
  });
  assert.equal(contract.properties.decidedAtUtc.format, "date-time");
  assert.equal(contract.properties.decidedAtUtc.minLength, 20);
  assert.equal(contract.properties.decidedAtUtc.maxLength, 20);
  assert.deepEqual(contract.properties.decidedAtUtc.not, {
    pattern: "[\\u0000-\\u001F\\u007F]",
  });
  const decidedAtUtcPattern = new RegExp(
    contract.properties.decidedAtUtc.pattern,
  );
  for (const valid of [
    "2000-02-29T00:00:00Z",
    "2024-02-29T23:59:59Z",
    "2026-04-30T00:00:00Z",
  ]) {
    assert.equal(decidedAtUtcPattern.test(valid), true);
  }
  for (const invalid of [
    "1900-02-29T00:00:00Z",
    "2026-02-29T00:00:00Z",
    "2026-04-31T00:00:00Z",
  ]) {
    assert.equal(decidedAtUtcPattern.test(invalid), false);
  }
  assert.deepEqual(contract.allOf[0], {
    if: {
      properties: { humanDisposition: { const: "DEFER" } },
      required: ["humanDisposition"],
    },
    then: {
      properties: {
        decisionReasonCodes: { minItems: 1 },
        citedEvidenceIds: { minItems: 1 },
      },
    },
  });
});

test("declares schema-local parity for disposition reason combinations", async () => {
  const contract = JSON.parse(await readFile(contractUrl, "utf8"));
  const dispositions = ["CANONICALIZE", "REJECT", "DEFER"];
  const alignedDispositionPairs = dispositions.map((disposition) => ({
    properties: {
      recommendedDisposition: { const: disposition },
      humanDisposition: { const: disposition },
    },
    required: ["recommendedDisposition", "humanDisposition"],
  }));
  const overrideDispositionPairs = dispositions.flatMap((recommended) =>
    dispositions
      .filter((human) => human !== recommended)
      .map((human) => ({
        properties: {
          recommendedDisposition: { const: recommended },
          humanDisposition: { const: human },
        },
        required: ["recommendedDisposition", "humanDisposition"],
      })),
  );

  assert.deepEqual(contract.allOf.slice(1), [
    {
      if: {
        properties: { decisionReasonCodes: { minItems: 1 } },
        required: ["decisionReasonCodes"],
      },
      then: { properties: { citedEvidenceIds: { minItems: 1 } } },
      else: { properties: { citedEvidenceIds: { maxItems: 0 } } },
    },
    {
      if: { anyOf: overrideDispositionPairs },
      then: {
        properties: {
          decisionReasonCodes: { minItems: 1 },
          citedEvidenceIds: { minItems: 1 },
        },
      },
    },
    {
      if: {
        properties: {
          decisionReasonCodes: {
            contains: { const: "ADDITIONAL_EVIDENCE_REQUIRED" },
            minContains: 1,
          },
        },
        required: ["decisionReasonCodes"],
      },
      then: { properties: { humanDisposition: { const: "DEFER" } } },
    },
    {
      if: {
        properties: {
          decisionReasonCodes: {
            contains: { const: "EVIDENCE_CONFIRMS_RECOMMENDATION" },
            minContains: 1,
          },
        },
        required: ["decisionReasonCodes"],
      },
      then: { anyOf: alignedDispositionPairs },
    },
    {
      if: {
        properties: {
          decisionReasonCodes: {
            contains: { const: "HUMAN_EVIDENCE_INTERPRETATION_DIFFERS" },
            minContains: 1,
          },
        },
        required: ["decisionReasonCodes"],
      },
      then: { anyOf: overrideDispositionPairs },
    },
    {
      if: {
        properties: {
          decisionReasonCodes: {
            contains: {
              enum: [
                "INSUFFICIENT_IDENTITY_EVIDENCE",
                "MISSING_CONTEXT_UNSPECIFIED",
                "MISSING_LOGARITHM_BASE",
                "MISSING_REAL_DOMAIN_CONDITIONS",
              ],
            },
            minContains: 1,
          },
        },
        required: ["decisionReasonCodes"],
      },
      then: { properties: { humanDisposition: { const: "DEFER" } } },
    },
  ]);
});

test("replays all three complete disposition golden records", async () => {
  const fixture = JSON.parse(await readFile(dispositionFixtureUrl, "utf8"));
  assert.equal(fixture.fixture_authority, "TEST_ONLY_NOT_HUMAN_DISPOSITION_INSTANCES");
  assert.equal(fixture.cases.length, 3);

  for (const testCase of fixture.cases) {
    const source = JSON.parse(
      await readFile(new URL(`../${testCase.source_fixture_path}`, import.meta.url), "utf8"),
    );
    const requestJsonText = JSON.stringify(source.request);
    const proposalJsonText = JSON.stringify(source.proposal ?? source.expected);
    const packet = compileFragmentEvidenceReviewPacket(
      requestJsonText,
      proposalJsonText,
    );
    const evidenceReviewPacketJsonText = JSON.stringify(packet);

    const actual = compileHumanSemanticDispositionRecord(
      requestJsonText,
      proposalJsonText,
      evidenceReviewPacketJsonText,
      JSON.stringify(testCase.disposition_input),
    );

    assert.deepEqual(actual, testCase.expected);
    assert.deepEqual(Object.keys(actual), Object.keys(testCase.expected));
  }
});

test("binds all disposition goldens to the exact persisted packet-result tuples", async () => {
  const dispositionFixture = JSON.parse(
    await readFile(dispositionFixtureUrl, "utf8"),
  );
  const packetResult = JSON.parse(
    await readFile(packetCoverageResultUrl, "utf8"),
  );
  const packetsByProposalId = new Map(
    packetResult.cases.map((testCase) => [testCase.proposal_id, testCase]),
  );

  assert.equal(dispositionFixture.cases.length, packetResult.cases.length);
  for (const testCase of dispositionFixture.cases) {
    const proposalId = testCase.disposition_input.proposalId;
    const packetCase = packetsByProposalId.get(proposalId);
    assert.ok(packetCase, `missing persisted packet case for ${proposalId}`);
    assert.deepEqual(
      {
        sourceFixturePath: testCase.source_fixture_path,
        requestSha256: testCase.disposition_input.requestSha256,
        proposalSha256: testCase.disposition_input.proposalSha256,
        evidenceReviewPacketSha256:
          testCase.disposition_input.evidenceReviewPacketSha256,
      },
      {
        sourceFixturePath: packetCase.source_fixture_path,
        requestSha256: packetCase.request_sha256,
        proposalSha256: packetCase.proposal_sha256,
        evidenceReviewPacketSha256: packetCase.packet_sha256,
      },
      `tuple mismatch for ${proposalId}`,
    );
  }
});

test("requires aligned UNKNOWN to DEFER from exact packet uncertainty", async () => {
  const source = JSON.parse(
    await readFile(
      new URL("../fixtures/missing-logarithm-context.fixture.json", import.meta.url),
      "utf8",
    ),
  );
  const requestJsonText = JSON.stringify(source.request);
  const proposalJsonText = JSON.stringify(source.expected);
  const packet = compileFragmentEvidenceReviewPacket(
    requestJsonText,
    proposalJsonText,
  );
  const evidenceReviewPacketJsonText = JSON.stringify(packet);
  const input = {
    schemaVersion: "mathematics-cartography.human-semantic-disposition-input.v1",
    dispositionRecordId: "disposition.fixture.missing-logarithm-context.2",
    supersedesDispositionRecordId: null,
    actor: "HUMAN_SEMANTIC_REVIEWER",
    trigger: "EVIDENCE_REVIEW_PACKET_READY_FOR_HUMAN_DISPOSITION",
    requestId: source.request.requestId,
    proposalId: source.request.proposalId,
    requestSha256: sha256(requestJsonText),
    proposalSha256: sha256(proposalJsonText),
    evidenceReviewPacketSha256: sha256(evidenceReviewPacketJsonText),
    humanDisposition: "DEFER",
    decisionReasonCodes: ["EVIDENCE_CONFIRMS_RECOMMENDATION"],
    citedEvidenceIds: ["evidence.fragment.missing-context"],
    decidedAtUtc: "2026-01-07T00:00:00Z",
  };

  assert.throws(
    () =>
      compileHumanSemanticDispositionRecord(
        requestJsonText,
        proposalJsonText,
        evidenceReviewPacketJsonText,
        JSON.stringify(input),
      ),
    {
      message:
        "HUMAN_DISPOSITION_DEFER_REQUIRES_PACKET_UNCERTAINTY",
    },
  );
});

test("registers the disposition contract in the canonical npm test suite", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  assert.match(
    packageJson.scripts.test,
    /tests\/human-semantic-disposition-record\.test\.mjs/,
  );
});

test("persists exact three-case packet coverage without Human instances", async () => {
  const result = JSON.parse(await readFile(packetCoverageResultUrl, "utf8"));
  assert.equal(result.packet_count, 3);
  assert.equal(result.human_disposition_instance_count, 0);
  assert.equal(result.canonical_application_count, 0);
  assert.deepEqual(
    result.cases.map((testCase) => testCase.proposal_id),
    [
      "proposal.logarithm-definition-equivalence",
      "proposal.invalid-logarithm-sum-identity",
      "proposal.missing-logarithm-context",
    ],
  );

  for (const testCase of result.cases) {
    const source = JSON.parse(
      await readFile(new URL(`../${testCase.source_fixture_path}`, import.meta.url), "utf8"),
    );
    const requestJsonText = JSON.stringify(source.request);
    const proposalJsonText = JSON.stringify(source.proposal ?? source.expected);
    const packet = compileFragmentEvidenceReviewPacket(
      requestJsonText,
      proposalJsonText,
    );
    assert.deepEqual(testCase.packet, packet);
    assert.equal(testCase.request_sha256, sha256(requestJsonText));
    assert.equal(testCase.proposal_sha256, sha256(proposalJsonText));
    assert.equal(testCase.packet_sha256, sha256(JSON.stringify(packet)));
    assert.equal(testCase.packet.humanDecision, "PENDING");
    assert.equal(testCase.packet.canonicalApplication, "NOT_PERFORMED");
  }
});

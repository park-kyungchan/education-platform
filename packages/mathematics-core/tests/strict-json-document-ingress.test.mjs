import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { compileFragmentEvidenceReviewPacket } from "../src/compile-fragment-evidence-review-packet.ts";
import { compileFragmentReviewProposal } from "../src/compile-fragment-review-proposal.ts";
import {
  parseStrictJsonProposalDocument,
  parseStrictJsonRequestDocument,
} from "../src/parse-strict-json-document.ts";

const requestFixtureUrl = new URL(
  "../fixtures/logarithm-definition-equivalence.fixture.json",
  import.meta.url,
);
const packetFixtureUrl = new URL(
  "../fixtures/logarithm-definition-evidence-review-packet.fixture.json",
  import.meta.url,
);

function throwingProxy(target, calls) {
  const record = (trap) => {
    calls.push(trap);
    throw new Error(`CALLER_HOOK_EXECUTED:${trap}`);
  };
  return new Proxy(target, {
    apply() {
      return record("apply");
    },
    construct() {
      return record("construct");
    },
    defineProperty() {
      return record("defineProperty");
    },
    deleteProperty() {
      return record("deleteProperty");
    },
    get() {
      return record("get");
    },
    getOwnPropertyDescriptor() {
      return record("getOwnPropertyDescriptor");
    },
    getPrototypeOf() {
      return record("getPrototypeOf");
    },
    has() {
      return record("has");
    },
    isExtensible() {
      return record("isExtensible");
    },
    ownKeys() {
      return record("ownKeys");
    },
    preventExtensions() {
      return record("preventExtensions");
    },
    set() {
      return record("set");
    },
    setPrototypeOf() {
      return record("setPrototypeOf");
    },
  });
}

test("uses primitive serialized JSON as the only public compiler ingress", async () => {
  const requestFixture = JSON.parse(await readFile(requestFixtureUrl, "utf8"));
  const packetFixture = JSON.parse(await readFile(packetFixtureUrl, "utf8"));
  const requestText = JSON.stringify(requestFixture.request);
  const packetRequestText = JSON.stringify(packetFixture.request);
  const proposalText = JSON.stringify(packetFixture.proposal);

  assert.deepEqual(
    compileFragmentReviewProposal(requestText),
    requestFixture.expected,
  );
  assert.deepEqual(
    compileFragmentEvidenceReviewPacket(packetRequestText, proposalText),
    packetFixture.expected,
  );

  const hookCalls = [];
  const revokedObject = Proxy.revocable({}, {});
  const revokedFunction = Proxy.revocable(() => undefined, {});
  revokedObject.revoke();
  revokedFunction.revoke();
  const coerciveObject = {
    [Symbol.toPrimitive]() {
      hookCalls.push("toPrimitive");
      throw new Error("CALLER_HOOK_EXECUTED:toPrimitive");
    },
    toString() {
      hookCalls.push("toString");
      throw new Error("CALLER_HOOK_EXECUTED:toString");
    },
  };
  const nonStrings = [
    requestFixture.request,
    [],
    null,
    0,
    false,
    () => undefined,
    Symbol("input"),
    1n,
    new String(requestText),
    throwingProxy({}, hookCalls),
    throwingProxy([], hookCalls),
    throwingProxy(new Uint8Array([123, 125]), hookCalls),
    throwingProxy(() => undefined, hookCalls),
    revokedObject.proxy,
    revokedFunction.proxy,
    coerciveObject,
  ];

  for (const value of nonStrings) {
    assert.throws(
      () => compileFragmentReviewProposal(value),
      { message: "INVALID_JSON_DOCUMENT:request:EXPECTED_STRING" },
    );
  }
  for (const value of nonStrings) {
    assert.throws(
      () => compileFragmentEvidenceReviewPacket(value, proposalText),
      { message: "INVALID_JSON_DOCUMENT:request:EXPECTED_STRING" },
    );
    assert.throws(
      () => compileFragmentEvidenceReviewPacket(packetRequestText, value),
      { message: "INVALID_JSON_DOCUMENT:proposal:EXPECTED_STRING" },
    );
  }
  assert.deepEqual(hookCalls, []);

  const requestWithoutActor = structuredClone(requestFixture.request);
  delete requestWithoutActor.actor;
  const requestWithoutActorText = JSON.stringify(requestWithoutActor);
  let inheritedGetterCalls = 0;
  const previousActorDescriptor = Object.getOwnPropertyDescriptor(
    Object.prototype,
    "actor",
  );
  Object.defineProperty(Object.prototype, "actor", {
    configurable: true,
    get() {
      inheritedGetterCalls += 1;
      return "HUMAN_SEMANTIC_REVIEWER";
    },
  });
  try {
    assert.throws(
      () => compileFragmentReviewProposal(requestWithoutActorText),
      { message: "INVALID_ACTOR" },
    );
  } finally {
    if (previousActorDescriptor === undefined) {
      delete Object.prototype.actor;
    } else {
      Object.defineProperty(
        Object.prototype,
        "actor",
        previousActorDescriptor,
      );
    }
  }
  assert.equal(inheritedGetterCalls, 0);
});

test("checks every packet argument type before parsing either document", async () => {
  const fixture = JSON.parse(await readFile(packetFixtureUrl, "utf8"));
  const requestText = JSON.stringify(fixture.request);
  const proposalText = JSON.stringify(fixture.proposal);
  const originalParse = JSON.parse;
  let parseCount = 0;
  JSON.parse = (...arguments_) => {
    parseCount += 1;
    return Reflect.apply(originalParse, JSON, arguments_);
  };
  try {
    assert.throws(
      () => compileFragmentEvidenceReviewPacket(requestText, {}),
      { message: "INVALID_JSON_DOCUMENT:proposal:EXPECTED_STRING" },
    );
    assert.equal(parseCount, 0);
    assert.throws(
      () => compileFragmentEvidenceReviewPacket({}, proposalText),
      { message: "INVALID_JSON_DOCUMENT:request:EXPECTED_STRING" },
    );
    assert.equal(parseCount, 0);
  } finally {
    JSON.parse = originalParse;
  }
});

test("rejects duplicate decoded object keys before value collapse", () => {
  const duplicates = [
    '{"a":1,"a":2}',
    '{"a":1,"\\u0061":2}',
    '{"nested":{"a":1,"\\u0061":2}}',
    '{"":1,"":2}',
    '{"😀":1,"\\uD83D\\uDE00":2}',
    '{"__proto__":1,"\\u005f_proto__":2}',
  ];

  for (const document of duplicates) {
    assert.throws(
      () => parseStrictJsonRequestDocument(document),
      { message: "INVALID_JSON_DOCUMENT:request:DUPLICATE_KEY" },
    );
  }

  const parsed = parseStrictJsonRequestDocument(
    '{"":{"value":1},"__proto__":{"polluted":true}}',
  );
  assert.equal(Object.getPrototypeOf(parsed), null);
  assert.equal(Object.getPrototypeOf(parsed[""]), null);
  assert.equal(Object.hasOwn(parsed, "__proto__"), true);
  assert.equal(Object.prototype.polluted, undefined);
});

test("normalizes empty BOM and malformed JSON documents to stable errors", () => {
  const cases = [
    ["", "EMPTY_DOCUMENT"],
    [" \t\r\n", "EMPTY_DOCUMENT"],
    ["\uFEFF{}", "BOM_NOT_ALLOWED"],
    [" \n\uFEFF{}", "BOM_NOT_ALLOWED"],
    ['{/* comment */"a":1}', "SYNTAX"],
    ['{"a":1,}', "SYNTAX"],
    ["{} true", "SYNTAX"],
    ["{'a':1}", "SYNTAX"],
    ["{a:1}", "SYNTAX"],
    ['"\\x20"', "SYNTAX"],
    ['"line\nfeed"', "SYNTAX"],
    ["[1,]", "SYNTAX"],
    ["[", "SYNTAX"],
  ];

  for (const [document, reason] of cases) {
    assert.throws(
      () => parseStrictJsonRequestDocument(document),
      { message: `INVALID_JSON_DOCUMENT:request:${reason}` },
    );
    assert.throws(
      () => parseStrictJsonProposalDocument(document),
      { message: `INVALID_JSON_DOCUMENT:proposal:${reason}` },
    );
  }

  const parsed = parseStrictJsonRequestDocument(
    ' \r\n { "a" : \n [ true , null ] } \t',
  );
  assert.equal(parsed.a[0], true);
  assert.equal(parsed.a[1], null);
});

test("accepts exact JSON numbers only when their result is finite", () => {
  const finite = [
    ["0", 0],
    ["-0", -0],
    ["17", 17],
    ["-17", -17],
    ["1.25", 1.25],
    ["1e3", 1000],
    ["1.7976931348623157e308", Number.MAX_VALUE],
    ["1e-400", 0],
  ];
  for (const [document, expected] of finite) {
    assert.equal(
      Object.is(parseStrictJsonRequestDocument(document), expected),
      true,
    );
  }

  for (const document of ["1e400", "-1e400"]) {
    assert.throws(
      () => parseStrictJsonRequestDocument(document),
      { message: "INVALID_JSON_DOCUMENT:request:NON_FINITE_NUMBER" },
    );
    assert.throws(
      () => parseStrictJsonProposalDocument(document),
      { message: "INVALID_JSON_DOCUMENT:proposal:NON_FINITE_NUMBER" },
    );
  }

  for (const document of ["01", "+1", ".1", "1.", "1e", "NaN", "Infinity"]) {
    assert.throws(
      () => parseStrictJsonRequestDocument(document),
      { message: "INVALID_JSON_DOCUMENT:request:SYNTAX" },
    );
  }
});

test("accepts Unicode scalar values and rejects unpaired surrogates", () => {
  const rawHigh = String.fromCharCode(0xd83d);
  const rawLow = String.fromCharCode(0xde00);
  const valid = [
    '"😀"',
    '"\\uD83D\\uDE00"',
    `"${rawHigh}\\uDE00"`,
    `"\\uD83D${rawLow}"`,
    '"line\u2028separator"',
    '"paragraph\u2029separator"',
  ];
  for (const document of valid) {
    assert.doesNotThrow(() => parseStrictJsonRequestDocument(document));
  }

  const invalid = [
    '"\\uD83D"',
    '"\\uDE00"',
    '"\\uDE00\\uD83D"',
    '"\\uD83Dx"',
    `"${rawHigh}"`,
    `"${rawLow}"`,
  ];
  for (const document of invalid) {
    assert.throws(
      () => parseStrictJsonRequestDocument(document),
      { message: "INVALID_JSON_DOCUMENT:request:INVALID_UNICODE" },
    );
    assert.throws(
      () => parseStrictJsonProposalDocument(document),
      { message: "INVALID_JSON_DOCUMENT:proposal:INVALID_UNICODE" },
    );
  }

  const normalizationDistinct = parseStrictJsonRequestDocument(
    '{"é":1,"e\\u0301":2}',
  );
  assert.deepEqual(Object.keys(normalizationDistinct), ["é", "é"]);
});

test("enforces the inclusive UTF-8 document byte limit", () => {
  const asciiAtLimit = `"${"a".repeat(65_534)}"`;
  const asciiOverLimit = `"${"a".repeat(65_535)}"`;
  const multibyteAtLimit = `"${"😀".repeat(16_383)}aa"`;
  const multibyteOverLimit = `"${"😀".repeat(16_383)}aaa"`;

  assert.equal(Buffer.byteLength(asciiAtLimit, "utf8"), 65_536);
  assert.equal(Buffer.byteLength(multibyteAtLimit, "utf8"), 65_536);
  assert.doesNotThrow(() => parseStrictJsonRequestDocument(asciiAtLimit));
  assert.doesNotThrow(() => parseStrictJsonRequestDocument(multibyteAtLimit));

  for (const document of [asciiOverLimit, multibyteOverLimit]) {
    assert.equal(Buffer.byteLength(document, "utf8"), 65_537);
    assert.throws(
      () => parseStrictJsonRequestDocument(document),
      { message: "INVALID_JSON_DOCUMENT:request:MAX_BYTES_EXCEEDED" },
    );
    assert.throws(
      () => parseStrictJsonProposalDocument(document),
      { message: "INVALID_JSON_DOCUMENT:proposal:MAX_BYTES_EXCEEDED" },
    );
  }
});

test("enforces inclusive container depth and JSON value node limits iteratively", () => {
  const nestedArrays = (depth) =>
    `${"[".repeat(depth)}null${"]".repeat(depth)}`;
  const nestedObjects = (depth) =>
    `${'{"a":'.repeat(depth)}null${"}".repeat(depth)}`;
  const arrayWithValues = (count) =>
    `[${Array(count).fill("0").join(",")}]`;

  assert.doesNotThrow(() => parseStrictJsonRequestDocument(nestedArrays(64)));
  assert.doesNotThrow(() => parseStrictJsonRequestDocument(nestedObjects(64)));
  for (const document of [nestedArrays(65), nestedObjects(65)]) {
    assert.throws(
      () => parseStrictJsonRequestDocument(document),
      { message: "INVALID_JSON_DOCUMENT:request:MAX_DEPTH_EXCEEDED" },
    );
  }

  assert.doesNotThrow(() =>
    parseStrictJsonRequestDocument(arrayWithValues(4_095)),
  );
  assert.throws(
    () => parseStrictJsonRequestDocument(arrayWithValues(4_096)),
    { message: "INVALID_JSON_DOCUMENT:request:MAX_NODES_EXCEEDED" },
  );
  assert.throws(
    () => parseStrictJsonProposalDocument(arrayWithValues(4_096)),
    { message: "INVALID_JSON_DOCUMENT:proposal:MAX_NODES_EXCEEDED" },
  );

  assert.throws(
    () => parseStrictJsonRequestDocument(nestedArrays(10_000)),
    { message: "INVALID_JSON_DOCUMENT:request:MAX_DEPTH_EXCEEDED" },
  );
  assert.throws(
    () => parseStrictJsonRequestDocument(arrayWithValues(5_000)),
    { message: "INVALID_JSON_DOCUMENT:request:MAX_NODES_EXCEEDED" },
  );
});

test("runs iterative limits before its single whole-document parse", () => {
  const originalParse = JSON.parse;
  let parseCount = 0;
  JSON.parse = (...arguments_) => {
    parseCount += 1;
    return Reflect.apply(originalParse, JSON, arguments_);
  };
  try {
    const tooDeep = `${"[".repeat(65)}null${"]".repeat(65)}`;
    assert.throws(
      () => parseStrictJsonRequestDocument(tooDeep),
      { message: "INVALID_JSON_DOCUMENT:request:MAX_DEPTH_EXCEEDED" },
    );
    assert.equal(parseCount, 0);

    const parsed = parseStrictJsonRequestDocument('{"nested":{"value":1}}');
    assert.equal(parseCount, 1);
    assert.equal(Object.getPrototypeOf(parsed), null);
    assert.equal(Object.getPrototypeOf(parsed.nested), null);
  } finally {
    JSON.parse = originalParse;
  }
});

test("keeps the JSON value matrix and fixed-seed malformed corpus deterministic", async () => {
  const validDocuments = [
    "null",
    "false",
    "true",
    "0",
    '"text"',
    "[]",
    "{}",
    '[null,false,true,0,"text",[],{}]',
  ];
  for (const document of validDocuments) {
    assert.doesNotThrow(() => parseStrictJsonRequestDocument(document));
  }

  const seed = 0x6d2b79f5;
  const bases = [
    "null",
    "true",
    "0",
    '"text"',
    "[]",
    "{}",
    '[1,{"a":true}]',
    '{"a":[null,false]}',
  ];
  const alphabet = '{}[],:"\\0123456789tfnrue abc/\uFEFF';
  const makeCorpus = () => {
    let state = seed;
    const random = () => {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return state >>> 0;
    };
    const documents = [];
    for (let index = 0; index < 512; index += 1) {
      const base = bases[random() % bases.length];
      const position = random() % (base.length + 1);
      const character = alphabet[random() % alphabet.length];
      const operation = random() % 3;
      if (operation === 0) {
        documents.push(`${base.slice(0, position)}${character}${base.slice(position)}`);
      } else if (operation === 1 && base.length > 0) {
        const deletion = Math.min(position, base.length - 1);
        documents.push(`${base.slice(0, deletion)}${base.slice(deletion + 1)}`);
      } else {
        const replacement = Math.min(position, Math.max(base.length - 1, 0));
        documents.push(
          base.length === 0
            ? character
            : `${base.slice(0, replacement)}${character}${base.slice(replacement + 1)}`,
        );
      }
    }
    return documents;
  };
  const corpus = makeCorpus();
  assert.deepEqual(corpus, makeCorpus());

  const classify = (document) => {
    try {
      return { status: "PASS", value: JSON.stringify(parseStrictJsonRequestDocument(document)) };
    } catch (error) {
      assert.equal(error.constructor, Error);
      assert.equal(error.name, "Error");
      assert.match(
        error.message,
        /^INVALID_JSON_DOCUMENT:request:(?:MAX_BYTES_EXCEEDED|EMPTY_DOCUMENT|BOM_NOT_ALLOWED|DUPLICATE_KEY|MAX_DEPTH_EXCEEDED|MAX_NODES_EXCEEDED|NON_FINITE_NUMBER|INVALID_UNICODE|SYNTAX)$/,
      );
      return { status: "REJECT", error: error.message };
    }
  };
  const first = corpus.map(classify);
  const second = corpus.map(classify);
  assert.deepEqual(second, first);
  assert.equal(first.some((outcome) => outcome.status === "PASS"), true);
  assert.equal(first.some((outcome) => outcome.status === "REJECT"), true);

  const fixture = JSON.parse(await readFile(requestFixtureUrl, "utf8"));
  const requestText = JSON.stringify(fixture.request);
  fixture.request.fragment.content = "mutated after serialization";
  assert.deepEqual(
    compileFragmentReviewProposal(requestText),
    fixture.expected,
  );
});

test("propagates strict ingress failures through both public compiler labels", async () => {
  const fixture = JSON.parse(await readFile(packetFixtureUrl, "utf8"));
  const requestText = JSON.stringify(fixture.request);
  const malformed = [
    ['{"a":1,"\\u0061":2}', "DUPLICATE_KEY"],
    ["1e400", "NON_FINITE_NUMBER"],
    ['"\\uD800"', "INVALID_UNICODE"],
    [`${"[".repeat(65)}null${"]".repeat(65)}`, "MAX_DEPTH_EXCEEDED"],
    [`[${Array(4_096).fill("0").join(",")}]`, "MAX_NODES_EXCEEDED"],
  ];

  for (const [document, reason] of malformed) {
    assert.throws(
      () => compileFragmentReviewProposal(document),
      { message: `INVALID_JSON_DOCUMENT:request:${reason}` },
    );
    assert.throws(
      () => compileFragmentEvidenceReviewPacket(requestText, document),
      { message: `INVALID_JSON_DOCUMENT:proposal:${reason}` },
    );
  }

  for (const document of ["null", "false", "0", '"text"', "[]"]) {
    assert.throws(
      () => compileFragmentReviewProposal(document),
      (error) => error.constructor === Error && error.message === "INVALID_OBJECT:request",
    );
  }
  assert.throws(
    () => compileFragmentEvidenceReviewPacket(requestText, "null"),
    { message: "EVIDENCE_REVIEW_PROPOSAL_REQUEST_MISMATCH" },
  );
});

test("ignores record-key order but rejects proposal array-order tampering", async () => {
  const fixture = JSON.parse(await readFile(packetFixtureUrl, "utf8"));
  const reverseRecordKeys = (value) => {
    if (Array.isArray(value)) {
      return value.map(reverseRecordKeys);
    }
    if (value === null || typeof value !== "object") {
      return value;
    }
    return Object.fromEntries(
      Object.entries(value)
        .reverse()
        .map(([key, child]) => [key, reverseRecordKeys(child)]),
    );
  };
  const reorderedRequestText = JSON.stringify(reverseRecordKeys(fixture.request));
  const reorderedProposalText = JSON.stringify(reverseRecordKeys(fixture.proposal));
  assert.deepEqual(
    compileFragmentEvidenceReviewPacket(
      reorderedRequestText,
      reorderedProposalText,
    ),
    fixture.expected,
  );

  const reversedRelations = structuredClone(fixture.proposal);
  reversedRelations.relationProposals.reverse();
  assert.throws(
    () =>
      compileFragmentEvidenceReviewPacket(
        JSON.stringify(fixture.request),
        JSON.stringify(reversedRelations),
      ),
    { message: "EVIDENCE_REVIEW_PROPOSAL_REQUEST_MISMATCH" },
  );

  const reversedEvidence = structuredClone(fixture.proposal);
  reversedEvidence.identityJudgment.evidenceIds.reverse();
  assert.throws(
    () =>
      compileFragmentEvidenceReviewPacket(
        JSON.stringify(fixture.request),
        JSON.stringify(reversedEvidence),
      ),
    { message: "EVIDENCE_REVIEW_PROPOSAL_REQUEST_MISMATCH" },
  );
});

import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  createCuratedConceptCandidateAccess,
  assertCuratedConceptSnapshot,
  curatedConceptSnapshotSha256,
} from "../../src/academy/curatedConceptCandidates";
import {
  createConceptRevision,
  conceptDefinitionDigest,
} from "../../src/academy/conceptEvidenceGraph";
import type { CuratedConceptSnapshot } from "../../src/academy/contracts/curatedConceptCandidates";
import {
  conceptDefinitionFromInput,
  type ConceptDefinitionInput,
} from "../../src/academy/conceptWorkspace";
import { createTeacherServerHandler } from "../../src/academy/server";
import { signTeacherSession } from "../../src/academy/auth";
import type { TeacherApplication } from "../../src/academy/application";

const actor = {
  ownerId: "synthetic-catalog-owner",
  actorId: "synthetic-catalog-teacher",
  role: "teacher" as const,
};
const bytes = readFileSync(
  new URL(
    "../../data/curated-concepts/elementary-2022-candidates.json",
    import.meta.url,
  ),
);
const fresh = () => JSON.parse(bytes.toString()) as CuratedConceptSnapshot;
const manualInput: ConceptDefinitionInput = {
  expectedRevisionId: null,
  idempotencyKey: "synthetic-manual-definition",
  reportedAt: "2025-01-01T00:00:00Z",
  definition: {
    sourceKey: {
      namespace: "academy_atomic_concept",
      literalKey: "synthetic-manual",
    },
    label: "Synthetic manual teacher wording",
    definition: "Synthetic manually entered candidate.",
    curriculumEdition: {
      state: "unknown",
      reason: "No edition chosen in this synthetic manual report",
    },
    sourceRefs: ["synthetic-teacher-source"],
  },
  review: {
    decision: "candidate",
    confirmedDefinitionReview: false,
    expectedDefinitionDigest: null,
    sourceRef: null,
  },
};

test("pinned public candidate reader preserves all 52 revisions, 12 cells and explicit 62-code gaps without student or teacher inference", () => {
  const access = createCuratedConceptCandidateAccess(actor.ownerId),
    reply = access.read(actor);
  expect(reply.snapshotSha256).toBe(curatedConceptSnapshotSha256);
  expect(reply.catalogRevisionId).toBe(
    "curated_concept_catalog_" + curatedConceptSnapshotSha256,
  );
  expect(reply.qualification).toBe("curated_candidate_snapshot");
  expect(reply.teacherPersistence).toBe(false);
  expect(reply.semanticAcceptance).toBe("unknown");
  expect(reply.studentRelations).toEqual([]);
  expect(reply.snapshot.concepts).toHaveLength(52);
  expect(reply.snapshot.coverage.unmappedOfficialCodes).toHaveLength(62);
  expect(reply.snapshot.coverage.referencedOfficialCodes).toBe(59);
  expect(
    reply.snapshot.coverage.officialUniqueElementaryStandardCodesObserved,
  ).toBe(121);
  expect(
    reply.snapshot.concepts.every(
      (row) =>
        row.conceptRevision.semanticReview.state === "unknown" &&
        row.atomicity.reviewRequired &&
        row.publisherPlacement.state === "unknown",
    ),
  ).toBe(true);
  const cells = new Set(
    reply.snapshot.concepts.map(
      (row) => row.primaryGradeBand + "/" + row.domain,
    ),
  );
  expect(cells.size).toBe(12);
  expect(reply.snapshot.effects).toEqual({
    teacherReportsCreated: 0,
    teacherReviewsCreated: 0,
    studentLinksCreated: 0,
    mastery: "not_inferred",
    causality: "not_inferred",
    officialSaved: false,
    parentSent: false,
  });
  const serialized = JSON.stringify(reply);
  for (const denied of [
    "/home/",
    "/opt/data/",
    "studentId",
    "password",
    "sourceUsername",
    "nativeSessionId",
  ])
    expect(serialized).not.toContain(denied);
  // Caller mutation never becomes a new admitted source or a cached read result.
  (reply.snapshot.concepts[0]!.conceptRevision as { label: string }).label =
    "caller changed";
  expect(
    access.read(actor).snapshot.concepts[0]!.conceptRevision.label,
  ).not.toBe("caller changed");
});
test("missing, changed and oversized source bytes hold, and foreign owner or non-teacher cannot even read source bytes", () => {
  let reads = 0;
  const access = createCuratedConceptCandidateAccess(actor.ownerId, () => {
    reads++;
    return bytes;
  });
  expect(() =>
    access.read({ ...actor, ownerId: "synthetic-foreign-owner" }),
  ).toThrow("owner_scope_conflict");
  expect(() => access.read({ ...actor, role: "student" as "teacher" })).toThrow(
    "owner_scope_conflict",
  );
  expect(reads).toBe(0);
  expect(() =>
    createCuratedConceptCandidateAccess(actor.ownerId, () => {
      throw Error("ENOENT");
    }).read(actor),
  ).toThrow("ENOENT");
  expect(() =>
    createCuratedConceptCandidateAccess(actor.ownerId, () =>
      Buffer.concat([bytes, Buffer.from(" ")]),
    ).read(actor),
  ).toThrow("curated_catalog_pin_conflict");
  expect(() =>
    createCuratedConceptCandidateAccess(actor.ownerId, () =>
      Buffer.alloc(256001),
    ).read(actor),
  ).toThrow("curated_catalog_pin_conflict");
});
test("content validation separately refuses unknown edition, borrowed semantic review, student inference, locator substitution and hidden coverage loss", () => {
  const edition = fresh();
  (edition as any).curriculumEdition = {
    state: "unknown",
    reason: "synthetic unresolved",
  };
  expect(() => assertCuratedConceptSnapshot(edition)).toThrow(
    "curated_catalog_edition_conflict",
  );
  const definitionEdition = fresh(),
    prior = definitionEdition.concepts[0]!.conceptRevision,
    { kind, id, revisionId, ...body } = prior;
  (definitionEdition.concepts[0] as any).conceptRevision =
    createConceptRevision({
      ...body,
      curriculumEdition: { state: "unknown", reason: "synthetic unresolved" },
    });
  expect(() => assertCuratedConceptSnapshot(definitionEdition)).toThrow(
    "curated_catalog_edition_conflict",
  );
  const inferred = fresh();
  (inferred.effects as any).studentLinksCreated = 1;
  expect(() => assertCuratedConceptSnapshot(inferred)).toThrow(
    "curated_catalog_effect_inference_refused",
  );
  const reviewed = fresh();
  (reviewed.concepts[0]!.atomicity as any).reviewRequired = false;
  expect(() => assertCuratedConceptSnapshot(reviewed)).toThrow(
    "curated_catalog_acceptance_conflict",
  );
  const borrowed = fresh(),
    {
      kind: borrowedKind,
      id: borrowedId,
      revisionId: borrowedRevision,
      ...borrowedBody
    } = borrowed.concepts[0]!.conceptRevision;
  (borrowed.concepts[0] as any).conceptRevision = createConceptRevision({
    ...borrowedBody,
    semanticReview: {
      state: "known",
      value: {
        definitionDigest: conceptDefinitionDigest(borrowedBody),
        reviewerId: "synthetic-unadmitted-reviewer",
        sourceRef: "synthetic-borrowed-review",
        reviewedAt: "2025-01-01T00:00:00Z",
      },
      evidenceRefs: ["synthetic-borrowed-review"],
    },
  });
  expect(() => assertCuratedConceptSnapshot(borrowed)).toThrow(
    "curated_catalog_acceptance_conflict",
  );
  const pointer = fresh();
  (pointer.concepts[0]!.standardRefs[0]!.locator as any).page = 10;
  expect(() => assertCuratedConceptSnapshot(pointer)).toThrow(
    "curated_catalog_pointer_conflict",
  );
  const placement = fresh();
  (placement.concepts[0]!.publisherPlacement as any).state = "known";
  expect(() => assertCuratedConceptSnapshot(placement)).toThrow(
    "curated_catalog_acceptance_conflict",
  );
  const coverage = fresh();
  (coverage.coverage.unmappedOfficialCodes as string[]).pop();
  expect(() => assertCuratedConceptSnapshot(coverage)).toThrow(
    "curated_catalog_coverage_conflict",
  );
});
test("authenticated GET route refuses anonymous/foreign scope, parameters and writes; manual teacher flow remains explicit and separate", async () => {
  const origin = "https://synthetic-curated-catalog.test",
    key = "synthetic-catalog-session-key-01234567890123456789";
  let readCalls = 0,
    manualWrites = 0,
    linkWrites = 0;
  const access = createCuratedConceptCandidateAccess(actor.ownerId, () => {
    readCalls++;
    return bytes;
  });
  const app = {
    ownerId: actor.ownerId,
    saveConceptDefinition: async (
      context: typeof actor,
      input: ConceptDefinitionInput,
    ) => {
      manualWrites++;
      return {
        sourceQualification: "teacher_reported_definition_not_curated_catalog",
        payload: conceptDefinitionFromInput(context, input),
      };
    },
    saveStudentConceptLink: async () => {
      linkWrites++;
      throw Error("must_not_link");
    },
  } as unknown as TeacherApplication;
  const handler = createTeacherServerHandler({
    app,
    origin,
    sessionKey: key,
    identity: {
      actorId: actor.actorId,
      username: "synthetic",
      passwordHash: "not-a-real-password",
    },
    invitationDigest: null,
    saveIdentity: async () => {
      throw Error("must_not_save_identity");
    },
    curatedConceptCandidates: access,
  });
  const path = origin + "/api/curated-concept-candidates",
    cookie =
      "dc_teacher=" + signTeacherSession(key, actor.ownerId, actor.actorId),
    headers = { Cookie: cookie, Origin: origin };
  expect((await handler(new Request(path))).status).toBe(401);
  expect(
    (
      await handler(
        new Request(path, {
          headers: {
            Cookie:
              "dc_teacher=" +
              signTeacherSession(key, "foreign-owner", actor.actorId),
          },
        }),
      )
    ).status,
  ).toBe(401);
  expect(readCalls).toBe(0);
  for (const query of [
    "?ownerId=foreign",
    "?studentId=foreign",
    "?edition=unknown",
    "?candidateId=zero-cardinality",
  ])
    expect((await handler(new Request(path + query, { headers }))).status).toBe(
      400,
    );
  for (const method of ["POST", "PUT", "DELETE"])
    expect((await handler(new Request(path, { method, headers }))).status).toBe(
      405,
    );
  expect(readCalls).toBe(0);
  const response = await handler(new Request(path, { headers }));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect((await response.json()).qualification).toBe(
    "curated_candidate_snapshot",
  );
  expect(readCalls).toBe(1);
  expect(manualWrites).toBe(0);
  expect(linkWrites).toBe(0);
  const manual = await handler(
    new Request(origin + "/api/concept-definition", {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        "X-Teacher-Owner": actor.ownerId,
        "X-Teacher-Actor": actor.actorId,
      },
      body: JSON.stringify(manualInput),
    }),
  );
  expect(manual.status).toBe(200);
  const reported = await manual.json();
  expect(reported.sourceQualification).toBe(
    "teacher_reported_definition_not_curated_catalog",
  );
  expect(reported.payload.label).toBe(manualInput.definition.label);
  expect(reported.payload.semanticReview.state).toBe("unknown");
  expect(reported.payload.curriculumEdition.state).toBe("unknown");
  expect(manualWrites).toBe(1);
  expect(linkWrites).toBe(0);
});
test("authenticated source refusal is bounded and leaks neither private paths nor substituted candidates", async () => {
  const key = "synthetic-catalog-error-key-012345678901234567890",
    origin = "https://synthetic-catalog-error.test",
    app = { ownerId: actor.ownerId } as TeacherApplication;
  for (const readBytes of [
    () => {
      throw Error("/private/synthetic/missing.json");
    },
    () => Buffer.concat([bytes, Buffer.from("changed")]),
  ]) {
    const handler = createTeacherServerHandler({
      app,
      origin,
      sessionKey: key,
      identity: {
        actorId: actor.actorId,
        username: "synthetic",
        passwordHash: "not-used",
      },
      invitationDigest: null,
      saveIdentity: async () => {
        throw Error("not_used");
      },
      curatedConceptCandidates: createCuratedConceptCandidateAccess(
        actor.ownerId,
        readBytes,
      ),
    });
    const response = await handler(
      new Request(origin + "/api/curated-concept-candidates", {
        headers: {
          Cookie:
            "dc_teacher=" +
            signTeacherSession(key, actor.ownerId, actor.actorId),
        },
      }),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "curated_concept_candidates_unavailable",
      teacherPersistence: false,
      studentLinksCreated: 0,
    });
  }
});

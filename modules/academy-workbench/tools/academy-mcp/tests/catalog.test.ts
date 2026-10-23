import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { CATALOG_SOURCE_PATH, loadCatalog, parseCatalog } from "../src/catalog.ts";
import { hierarchy, primaryWorkflow, SOURCE_DOMAIN_IDS, WORKFLOW_IDS, WORKFLOW_RELATIONS } from "../src/taxonomy.ts";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

function synthetic() {
  return {
    schema: "academy.function-relation-map/1", status: "metadata_only",
    domains: [{ id: "lesson", label: "Lessons", entities: ["LessonOccurrence"],
      defaultVisibility: "pilot_candidate", whyRetain: "Dated lesson identity" }],
    operations: [{ id: "synthetic_read", origin: "canonical_registry", domain: "lesson",
      operation: "Main", method: "POST", pathTemplate: "/synthetic?reqCmd=Main",
      sourceDeclaredEffect: "read", sourceEvidenceGrade: "synthetic_source",
      sourceEvidenceDate: "2026-10-14", joinKeyCandidates: ["record_seq"],
      sourceRefs: ["synthetic-source.ts:1"], runtimeCallable: false,
      productActivation: "mapped_only", relationshipMeaning: "Synthetic metadata only" }],
  };
}

describe("hierarchical business taxonomy", () => {
  test("each of the thirteen source domains has exactly one primary parent", () => {
    const tree = hierarchy();
    expect(tree.children.map((node) => node.id)).toEqual([...WORKFLOW_IDS]);
    const domains = tree.children.flatMap((workflow) => workflow.children.map((domain) => ({ domain: domain.id, workflow: workflow.id })));
    expect(domains).toHaveLength(13);
    expect(new Set(domains.map((node) => node.domain)).size).toBe(13);
    expect(domains.map((node) => node.domain).sort()).toEqual([...SOURCE_DOMAIN_IDS].sort());
    for (const node of domains) expect(primaryWorkflow(node.domain)).toBe(node.workflow);
    expect(primaryWorkflow("curriculum")).toBe("materials");
    expect(primaryWorkflow("clinic")).toBe("assessment");
    expect(primaryWorkflow("device")).toBe("source_support");
    expect(() => primaryWorkflow("invented" as never)).toThrow("CATALOG_UNKNOWN_DOMAIN");
  });

  test("cross-workflow links remain design relations outside the tree", () => {
    const tree = hierarchy();
    expect(tree).not.toHaveProperty("relations");
    expect(WORKFLOW_RELATIONS.some((relation) => relation.from === "assessment" && relation.to === "materials")).toBe(true);
    for (const relation of WORKFLOW_RELATIONS) {
      expect(WORKFLOW_IDS).toContain(relation.from);
      expect(WORKFLOW_IDS).toContain(relation.to);
      expect(relation.status).toBe("design_relation_requires_source_join_evidence");
    }
  });
});

describe("full source inventory", () => {
  test("retains all 95 IDs, all domains and exact raw source metadata", async () => {
    const bytes = await readFile(`${repoRoot}/${CATALOG_SOURCE_PATH}`);
    const original = JSON.parse(bytes.toString("utf8"));
    const catalog = await loadCatalog(repoRoot);
    expect(catalog.operations).toHaveLength(95);
    expect(catalog.domains).toHaveLength(13);
    expect(catalog.operations.map((operation) => operation.id)).toEqual(original.operations.map((operation: { id: string }) => operation.id));
    expect(catalog.source.sha256).toBe(createHash("sha256").update(bytes).digest("hex"));
    expect(catalog.source.hashBasis).toBe("source_file_bytes");
    for (const operation of original.operations) {
      const kept = catalog.get(operation.id);
      expect(kept.raw).toEqual(operation);
      expect(kept.sourceRefs).toEqual(operation.sourceRefs);
      expect(kept.sourcePathTemplate).toBe(operation.pathTemplate);
      expect(kept.evidenceGrade).toBe(operation.sourceEvidenceGrade);
      expect(kept.evidenceDate).toBe(operation.sourceEvidenceDate);
      expect(kept.runtimeCallable).toBe(false);
      expect(kept.execution).toBe("not_available");
    }
  });

  test("read declarations stay candidates and all eleven write GETs remain excluded", async () => {
    const catalog = await loadCatalog(repoRoot);
    expect(catalog.stats().effects).toEqual({ read: 30, write: 19, unknown: 44, open_send_screen: 1, send: 1 });
    expect(catalog.stats().mutatingGETs.count).toBe(11);
    expect([...catalog.stats().mutatingGETs.operationIds].sort()).toEqual([
      "day_record_udtprg", "day_record_udthw", "day_record_udtmemo", "day_record_udtstumemo", "day_record_udtattn",
      "candidate:paper_create", "candidate:student_approval", "candidate:fa_paper_create",
      "candidate:na_paper_create", "candidate:da_paper_create", "candidate:grading_helper",
    ].sort());
    for (const id of ["day_record_udtprg", "day_record_udthw", "day_record_udtmemo", "day_record_udtstumemo", "day_record_udtattn"]) {
      expect(catalog.stats().mutatingGETs.operationIds).toContain(id);
      expect(catalog.get(id).effectDisposition).toBe("excluded_write");
    }
    for (const operation of catalog.operations) {
      if (operation.declaredEffect === "read") expect(operation.effectDisposition).toBe("read_candidate");
      if (operation.declaredEffect === "unknown") expect(operation.effectDisposition).toBe("unknown_effect");
      expect(operation.availability).toBe("metadata_only");
    }
    expect(catalog.get("alimtalk_send").effectDisposition).toBe("excluded_send");
    expect(catalog.get("alimtalk_send_screen").effectDisposition).toBe("excluded_send_screen");
  });

  test("pagination covers the inventory exactly once and returns compact entries", async () => {
    const catalog = await loadCatalog(repoRoot);
    const ids: string[] = [];
    let offset: number | null = 0;
    while (offset !== null) {
      const page = catalog.list({ offset, limit: 13 });
      expect(page.items.length).toBeLessThanOrEqual(13);
      expect(page.total).toBe(95);
      for (const item of page.items) {
        expect(item).not.toHaveProperty("raw");
        expect(item).not.toHaveProperty("sourcePathTemplate");
        ids.push(item.id);
      }
      offset = page.nextOffset;
    }
    expect(ids).toEqual(catalog.operations.map((operation) => operation.id));
    expect(new Set(ids).size).toBe(95);
    expect(catalog.list({ workflow: "assessment" }).total).toBe(30);
    expect(catalog.list({ workflow: "materials" }).total).toBe(20);
    expect(catalog.list({ domain: "clinic" }).total).toBe(3);
    expect(catalog.list({ workflow: "people", domain: "lesson" }).total).toBe(0);
    expect(catalog.list({ offset: 96 })).toEqual({ items: [], total: 95, nextOffset: null });
  });
});

describe("fail-closed catalog parsing and queries", () => {
  test("rejects duplicate operation IDs and duplicate domains", () => {
    const operations = synthetic();
    operations.operations.push(structuredClone(operations.operations[0]!));
    expect(() => parseCatalog(operations)).toThrow("CATALOG_DUPLICATE_OPERATION");
    const domains = synthetic();
    domains.domains.push(structuredClone(domains.domains[0]!));
    expect(() => parseCatalog(domains)).toThrow("CATALOG_DUPLICATE_DOMAIN");
  });

  test("rejects unknown or undeclared domain, effect and method", () => {
    for (const [field, value, code] of [
      ["domain", "invented", "CATALOG_OPERATION_DOMAIN_UNDECLARED"],
      ["domain", "assessment", "CATALOG_OPERATION_DOMAIN_UNDECLARED"],
      ["sourceDeclaredEffect", "read_if_get", "CATALOG_INVALID_EFFECT"],
      ["method", "DELETE", "CATALOG_INVALID_METHOD"],
    ] as const) {
      const input = synthetic();
      Object.assign(input.operations[0]!, { [field]: value });
      expect(() => parseCatalog(input)).toThrow(code);
    }
    const input = synthetic();
    input.domains[0]!.id = "invented";
    expect(() => parseCatalog(input)).toThrow("CATALOG_UNKNOWN_DOMAIN");
  });

  test("rejects executable status and malformed evidence instead of promoting metadata", () => {
    const executable = synthetic();
    executable.operations[0]!.runtimeCallable = true;
    expect(() => parseCatalog(executable)).toThrow("CATALOG_EXECUTION_CLAIM_REJECTED");
    const active = synthetic();
    active.operations[0]!.productActivation = "active";
    expect(() => parseCatalog(active)).toThrow("CATALOG_EXECUTION_CLAIM_REJECTED");
    const date = synthetic();
    date.operations[0]!.sourceEvidenceDate = "2026-02-30";
    expect(() => parseCatalog(date)).toThrow("CATALOG_INVALID_EVIDENCE_DATE");
    expect(() => parseCatalog(synthetic(), "not-a-digest")).toThrow("CATALOG_INVALID_SOURCE_HASH");
  });

  test("rejects invalid pagination, unsupported filters and fuzzy identity", () => {
    const catalog = parseCatalog(synthetic());
    for (const limit of [0, -1, 1.5, 51, NaN, Infinity]) expect(() => catalog.list({ limit })).toThrow("CATALOG_INVALID_LIMIT");
    for (const offset of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(() => catalog.list({ offset })).toThrow("CATALOG_INVALID_OFFSET");
    expect(() => catalog.list({ workflow: "invented" as never })).toThrow("CATALOG_UNKNOWN_WORKFLOW");
    expect(() => catalog.list({ domain: "invented" as never })).toThrow("CATALOG_UNKNOWN_DOMAIN");
    expect(() => catalog.list({ url: "https://example.invalid" } as never)).toThrow("CATALOG_INVALID_FILTER");
    for (const id of ["Main", " synthetic_read", "synthetic_read ", "", "missing"]) expect(() => catalog.get(id)).toThrow("CATALOG_OPERATION_NOT_FOUND");
  });

  test("parsed metadata is isolated from caller mutations", () => {
    const input = synthetic();
    const catalog = parseCatalog(input);
    input.operations[0]!.sourceDeclaredEffect = "write";
    input.operations[0]!.sourceRefs.push("untrusted-later-change");
    expect(catalog.get("synthetic_read").declaredEffect).toBe("read");
    expect(catalog.get("synthetic_read").sourceRefs).toEqual(["synthetic-source.ts:1"]);
    expect(Object.isFrozen(catalog.get("synthetic_read").raw)).toBe(true);
    expect(Object.isFrozen(catalog.get("synthetic_read").raw.sourceRefs)).toBe(true);
    expect(catalog.source.hashBasis).toBe("json_value_serialization");
  });
});

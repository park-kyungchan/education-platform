import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  isSourceDomain, isWorkflow, primaryWorkflow,
  type SourceDomainId, type WorkflowId,
} from "./taxonomy.ts";

export const CATALOG_SOURCE_PATH = "architecture/function-relation-map.json";
export const MAX_CATALOG_PAGE_SIZE = 50;
export const DECLARED_EFFECTS = ["read", "write", "unknown", "open_send_screen", "send"] as const;
export type DeclaredEffect = (typeof DECLARED_EFFECTS)[number];
export type SourceMethod = "GET" | "POST" | null;
export type EffectDisposition =
  | "read_candidate" | "excluded_write" | "unknown_effect"
  | "excluded_send_screen" | "excluded_send";

type JsonValue = null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue };
export interface SourceDomain {
  readonly id: SourceDomainId;
  readonly label: string;
  readonly entities: readonly string[];
  readonly defaultVisibility: "dependency_only" | "pilot_candidate";
  readonly whyRetain: string;
  readonly raw: Readonly<Record<string, JsonValue>>;
}

export interface CompactOperation {
  readonly id: string;
  readonly workflow: WorkflowId;
  readonly domain: SourceDomainId;
  readonly operation: string;
  readonly method: SourceMethod;
  readonly declaredEffect: DeclaredEffect;
  readonly effectDisposition: EffectDisposition;
  readonly evidenceGrade: string;
  readonly evidenceDate: string | null;
  readonly runtimeCallable: false;
  readonly availability: "metadata_only";
  readonly execution: "not_available";
}

export interface SourceOperation extends CompactOperation {
  readonly origin: "canonical_registry" | "source_candidate";
  readonly sourcePathTemplate: string;
  readonly sourceRefs: readonly string[];
  readonly joinKeyCandidates: readonly string[];
  readonly relationshipMeaning: string;
  /** Original source metadata, including its exact field names and nonportable locators. */
  readonly raw: Readonly<Record<string, JsonValue>>;
}

export interface CatalogListInput {
  workflow?: WorkflowId;
  domain?: SourceDomainId;
  offset?: number;
  limit?: number;
}

export interface CatalogPage {
  readonly items: readonly CompactOperation[];
  readonly total: number;
  readonly nextOffset: number | null;
}

export interface CatalogStats {
  readonly total: number;
  readonly effects: Readonly<Record<DeclaredEffect, number>>;
  readonly domains: Readonly<Partial<Record<SourceDomainId, number>>>;
  readonly workflows: Readonly<Partial<Record<WorkflowId, number>>>;
  readonly mutatingGETs: { readonly count: number; readonly operationIds: readonly string[] };
}

export interface OperationCatalog {
  readonly source: {
    readonly path: typeof CATALOG_SOURCE_PATH;
    readonly sha256: string;
    readonly hashBasis: "source_file_bytes" | "json_value_serialization";
  };
  readonly status: "metadata_only";
  readonly domains: readonly SourceDomain[];
  readonly operations: readonly SourceOperation[];
  list(input?: CatalogListInput): CatalogPage;
  get(id: string): SourceOperation;
  stats(): CatalogStats;
}

function reject(code: string): never { throw new Error(code); }
function record(value: unknown, code: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) reject(code);
  return value as Record<string, unknown>;
}
function string(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) reject(code);
  return value;
}
function stringArray(value: unknown, code: string): string[] {
  if (!Array.isArray(value)) reject(code);
  return value.map((item) => string(item, code));
}
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
function rawJson(value: Record<string, unknown>): Readonly<Record<string, JsonValue>> {
  const seen = new Set<object>();
  const check = (item: unknown): void => {
    if (item === null || typeof item === "string" || typeof item === "boolean") return;
    if (typeof item === "number" && Number.isFinite(item)) return;
    if (typeof item !== "object" || item === null || seen.has(item)) reject("CATALOG_INVALID_JSON_METADATA");
    seen.add(item);
    if (!Array.isArray(item)) record(item, "CATALOG_INVALID_JSON_METADATA");
    for (const child of Object.values(item)) check(child);
    seen.delete(item);
  };
  check(value);
  return deepFreeze(structuredClone(value)) as Readonly<Record<string, JsonValue>>;
}
function sourceDate(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)
    || !Number.isFinite(Date.parse(`${value}T00:00:00Z`))
    || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) reject("CATALOG_INVALID_EVIDENCE_DATE");
  return value;
}
function disposition(effect: DeclaredEffect): EffectDisposition {
  return ({ read: "read_candidate", write: "excluded_write", unknown: "unknown_effect",
    open_send_screen: "excluded_send_screen", send: "excluded_send" } as const)[effect];
}
function compact(operation: SourceOperation): CompactOperation {
  const { id, workflow, domain, method, declaredEffect, effectDisposition, evidenceGrade,
    evidenceDate, runtimeCallable, availability, execution } = operation;
  return Object.freeze({ id, workflow, domain, operation: operation.operation, method, declaredEffect,
    effectDisposition, evidenceGrade, evidenceDate, runtimeCallable, availability, execution });
}

export function parseCatalog(value: unknown, sourceHash?: string): OperationCatalog {
  const root = record(value, "CATALOG_INVALID_ROOT");
  if (root.schema !== "academy.function-relation-map/1" || root.status !== "metadata_only") reject("CATALOG_INVALID_SCHEMA_OR_STATUS");
  if (!Array.isArray(root.domains) || !Array.isArray(root.operations)) reject("CATALOG_ARRAYS_REQUIRED");
  if (sourceHash !== undefined && !/^[a-f0-9]{64}$/.test(sourceHash)) reject("CATALOG_INVALID_SOURCE_HASH");
  const domainIds = new Set<SourceDomainId>();
  const domains = root.domains.map((entry): SourceDomain => {
    const domain = record(entry, "CATALOG_INVALID_DOMAIN");
    if (!isSourceDomain(domain.id)) reject("CATALOG_UNKNOWN_DOMAIN");
    if (domainIds.has(domain.id)) reject("CATALOG_DUPLICATE_DOMAIN");
    domainIds.add(domain.id);
    if (domain.defaultVisibility !== "dependency_only" && domain.defaultVisibility !== "pilot_candidate") reject("CATALOG_INVALID_DOMAIN_VISIBILITY");
    return deepFreeze({ id: domain.id, label: string(domain.label, "CATALOG_DOMAIN_LABEL_REQUIRED"),
      entities: stringArray(domain.entities, "CATALOG_INVALID_DOMAIN_ENTITIES"),
      defaultVisibility: domain.defaultVisibility, whyRetain: string(domain.whyRetain, "CATALOG_DOMAIN_REASON_REQUIRED"), raw: rawJson(domain) });
  });
  const byId = new Map<string, SourceOperation>();
  const operations = root.operations.map((entry): SourceOperation => {
    const operation = record(entry, "CATALOG_INVALID_OPERATION");
    const id = string(operation.id, "CATALOG_OPERATION_ID_REQUIRED");
    if (id !== id.trim()) reject("CATALOG_INVALID_OPERATION_ID");
    if (byId.has(id)) reject("CATALOG_DUPLICATE_OPERATION");
    if (!isSourceDomain(operation.domain) || !domainIds.has(operation.domain)) reject("CATALOG_OPERATION_DOMAIN_UNDECLARED");
    if (!DECLARED_EFFECTS.includes(operation.sourceDeclaredEffect as DeclaredEffect)) reject("CATALOG_INVALID_EFFECT");
    if (operation.method !== null && operation.method !== "GET" && operation.method !== "POST") reject("CATALOG_INVALID_METHOD");
    if (operation.origin !== "canonical_registry" && operation.origin !== "source_candidate") reject("CATALOG_INVALID_ORIGIN");
    if (operation.runtimeCallable !== false || operation.productActivation !== "mapped_only") reject("CATALOG_EXECUTION_CLAIM_REJECTED");
    const effect = operation.sourceDeclaredEffect as DeclaredEffect;
    const parsed: SourceOperation = deepFreeze({
      id, domain: operation.domain, workflow: primaryWorkflow(operation.domain),
      operation: string(operation.operation, "CATALOG_OPERATION_NAME_REQUIRED"),
      origin: operation.origin, method: operation.method, declaredEffect: effect,
      effectDisposition: disposition(effect),
      evidenceGrade: string(operation.sourceEvidenceGrade, "CATALOG_EVIDENCE_GRADE_REQUIRED"),
      evidenceDate: sourceDate(operation.sourceEvidenceDate),
      sourcePathTemplate: string(operation.pathTemplate, "CATALOG_SOURCE_PATH_REQUIRED"),
      sourceRefs: stringArray(operation.sourceRefs, "CATALOG_INVALID_SOURCE_REFS"),
      joinKeyCandidates: stringArray(operation.joinKeyCandidates, "CATALOG_INVALID_JOIN_KEYS"),
      relationshipMeaning: string(operation.relationshipMeaning, "CATALOG_RELATIONSHIP_MEANING_REQUIRED"),
      runtimeCallable: false, availability: "metadata_only", execution: "not_available", raw: rawJson(operation),
    });
    byId.set(id, parsed);
    return parsed;
  });
  const effects: Record<DeclaredEffect, number> = { read: 0, write: 0, unknown: 0, open_send_screen: 0, send: 0 };
  const domainCounts: Partial<Record<SourceDomainId, number>> = {};
  const workflowCounts: Partial<Record<WorkflowId, number>> = {};
  for (const operation of operations) {
    effects[operation.declaredEffect]++;
    domainCounts[operation.domain] = (domainCounts[operation.domain] ?? 0) + 1;
    workflowCounts[operation.workflow] = (workflowCounts[operation.workflow] ?? 0) + 1;
  }
  const mutatingGETs = operations.filter((operation) => operation.method === "GET" && operation.declaredEffect === "write").map((operation) => operation.id);
  const statistics: CatalogStats = deepFreeze({ total: operations.length, effects, domains: domainCounts,
    workflows: workflowCounts, mutatingGETs: { count: mutatingGETs.length, operationIds: mutatingGETs } });
  const catalog: OperationCatalog = {
    source: Object.freeze({ path: CATALOG_SOURCE_PATH,
      sha256: sourceHash ?? createHash("sha256").update(JSON.stringify(value)).digest("hex"),
      hashBasis: sourceHash === undefined ? "json_value_serialization" : "source_file_bytes" }),
    status: "metadata_only", domains: Object.freeze(domains), operations: Object.freeze(operations),
    list(input: CatalogListInput = {}): CatalogPage {
      const filters = record(input, "CATALOG_INVALID_FILTER");
      if (Object.keys(filters).some((key) => !["workflow", "domain", "offset", "limit"].includes(key))) reject("CATALOG_INVALID_FILTER");
      if (filters.workflow !== undefined && !isWorkflow(filters.workflow)) reject("CATALOG_UNKNOWN_WORKFLOW");
      if (filters.domain !== undefined && !isSourceDomain(filters.domain)) reject("CATALOG_UNKNOWN_DOMAIN");
      const offset = filters.offset === undefined ? 0 : filters.offset;
      const limit = filters.limit === undefined ? 20 : filters.limit;
      if (typeof offset !== "number" || !Number.isSafeInteger(offset) || offset < 0) reject("CATALOG_INVALID_OFFSET");
      if (typeof limit !== "number" || !Number.isSafeInteger(limit) || limit < 1 || limit > MAX_CATALOG_PAGE_SIZE) reject("CATALOG_INVALID_LIMIT");
      const selected = operations.filter((operation) => (filters.workflow === undefined || filters.workflow === operation.workflow)
        && (filters.domain === undefined || filters.domain === operation.domain));
      const items = Object.freeze(selected.slice(offset, offset + limit).map(compact));
      return Object.freeze({ items, total: selected.length,
        nextOffset: offset + items.length < selected.length ? offset + items.length : null });
    },
    get(id: string): SourceOperation {
      if (typeof id !== "string" || !byId.has(id)) reject("CATALOG_OPERATION_NOT_FOUND");
      return byId.get(id)!;
    },
    stats(): CatalogStats { return statistics; },
  };
  return Object.freeze(catalog);
}

export async function loadCatalog(repoRoot: string): Promise<OperationCatalog> {
  const bytes = await readFile(join(repoRoot, CATALOG_SOURCE_PATH));
  return parseCatalog(JSON.parse(bytes.toString("utf8")), createHash("sha256").update(bytes).digest("hex"));
}

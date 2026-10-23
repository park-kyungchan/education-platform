/** book-flow v1.0.0 — non-sensitive domain contract; no student payloads.
 * Shared by the UI and semantic tools through a replaceable storage adapter.
 * This file does not implement WebMCP, a database, or an LMS connector.
 */
export type Id = string;
export type Instant = string; // ISO 8601 with an explicit offset when known
export type SchoolLevel = "elementary" | "middle" | "high" | "unknown";
export type Provenance = { sourceIds: Id[]; coverageIds: Id[]; originalLabel?: string };
export type MappingState = "exact" | "partial" | "ambiguous" | "unresolved";
export interface BookEdition {
  id: Id; schoolLevel: SchoolLevel; series: string;
  grade: number | null; semester: number | null; volume: number | null;
  nativeBookCode: string | null; version: string | null;
  originalLabel: string; displayName: string; schoolLevelBadge: string;
  namingState: "verified_components" | "partial_components";
  sourceIds: Id[]; fieldEvidence: Record<string, Id[]>;
}
export interface OutlineNode {
  id: Id; bookEditionId: Id;
  level: "major_unit" | "middle_unit" | "subunit" | "section" | "unknown";
  label: string; originalLabel: string; parentId: Id | null;
  parentRelation: "source_confirmed" | "unresolved";
  sectionDefinitionId: Id | null; sourceLabel: string;
  aliasState: "exact_literal" | "verified_alias" | "candidate_unconfirmed" | "unmapped";
  nativeTestCodes: string[]; sourceIds: Id[];
  structureCoverage: "partial" | "complete" | "unknown";
  missingLevels: Array<"major_unit" | "middle_unit" | "subunit">;
}
export interface RequirementFacts {
  applicability: "applicable" | "not_applicable" | "unknown";
  assignment: "assigned" | "explicitly_unassigned" | "unknown";
  requiredness: "required" | "optional" | "unknown";
  completion: "confirmed_complete" | "confirmed_incomplete" | "unknown" | "disputed";
  effort: "not_started_confirmed" | "started_confirmed" | "unknown";
  mapping: MappingState;
  coverage: "complete" | "partial" | "not_queried" | "blocked" | "unsupported";
  deadline: "not_due" | "due_now" | "past_due" | "unknown";
  evidencePresence: "present" | "absent_in_verified_query" | "partial" | "unknown" | "conflicting";
  supportingEvidenceIds: Id[]; relevantAssertionIsExact: boolean; unresolvedConflict: boolean;
  homeAppRequired: boolean | null;
  dueDate: string | null; dueAt: Instant | null; dueTimezone: string | null; cutoffPolicy: string | null;
}
export interface WorkScope {
  id: Id; studentId: Id; bookEditionId: Id; assignmentId: Id; enrollmentId: Id | null;
  nodeIds: Id[]; scopeLabel: string;
  requirementKind: "preview_video" | "problem_section" | "paper_practice" | "correction" | "clinic" | "unresolved";
  sectionDefinitionId: Id | null; facts: RequirementFacts;
  sourceObservationRefs: Id[]; teacherAssertionRefs: Id[]; coverageRefs: Id[];
  mappingLimitations: string[]; asOf: Instant;
}
export interface StudentBookBinding {
  id: Id; studentId: Id; bookEditionId: Id; enrollmentId: Id | null;
  bindingKind: "enrollment" | "assignment_only";
  assignmentIds: Id[]; workScopeIds: Id[]; observationRefs: Id[]; sourceIds: Id[];
}
export interface DerivedAttention {
  ruleVersion: "book-flow-attention/1.0.0";
  headline: string; badges: string[];
  confirmedMissing: boolean; confirmedNeverStarted: boolean;
  factIds: Id[]; acceptedEvidenceIds: Id[];
  excludedEvidenceWithReasons: Array<{ evidenceId: Id; reason: string }>;
  conflictIds: Id[]; coverageIds: Id[]; derivedAt: Instant; asOf: Instant;
}
/** Effective/occurred time is not import time. Null means genuinely unknown. */
export interface HistoryEvent {
  id: Id; schemaVersion: string; revision: number;
  kind: "assignment_created" | "requirement_changed" | "deadline_changed"
    | "source_observed" | "teacher_assertion_recorded" | "mapping_changed"
    | "coverage_recorded" | "correction_recorded" | "class_scheduled" | "class_occurred";
  target: { studentId: Id; bookEditionId: Id | null; nodeId: Id | null;
    assignmentId: Id | null; requirementId: Id | null; classSessionId: Id | null };
  occurredAt: Instant | null; effectiveAt: Instant | null;
  observedAt: Instant | null; recordedAt: Instant;
  sourceEventTimezone: string | null;
  payloadReference: CanonicalRef; provenance: Provenance;
  supersedesEventIds: Id[]; correctionReason: string | null;
  factState: "observed" | "user_confirmed" | "derived" | "disputed";
  synthetic: boolean;
}
export interface CanonicalRef {
  entityId: Id; entityKind: string; schemaVersion: string; revision: number;
  contentHash: string | null;
}
export interface RecordEnvelope<T> {
  ref: CanonicalRef; value: T; parentIds: Id[];
  recordedAt: Instant; sourceIds: Id[]; coverageIds: Id[];
  supersedes: CanonicalRef[]; migrationId: Id | null;
}
export type ReadResult<T> =
  | { state: "found"; record: RecordEnvelope<T> }
  | { state: "not_found" | "denied" | "unavailable"; reason: string };
export interface ScopedQuery {
  actorScopeId: Id; managedStudentIds: Id[];
  entityKinds: string[]; bookEditionIds?: Id[];
  occurredFrom?: Instant; occurredTo?: Instant;
  cursor?: string; limit: number;
}
export interface QueryResult<T> {
  records: Array<RecordEnvelope<T>>; nextCursor: string | null;
  exhausted: boolean | null; coverageIds: Id[]; limitations: string[];
}
export interface MutationAuthority {
  actorId: Id; sourceReference: string; allowedStudentIds: Id[];
  operation: "append_revision" | "append_history" | "update_managed_projection";
}
export interface CommitReceipt {
  requestId: Id; state: "committed" | "partial" | "conflict" | "denied" | "unknown";
  committedRefs: CanonicalRef[]; rejectedRefs: CanonicalRef[];
  readbackVerified: boolean; error: string | null;
}
export interface ManagedProjectionPatch {
  pageId: string;
  changes: Array<{ blockId: string; expectedHash: string; markdown: string }>;
  protectedManualBlockIds: string[];
}
/** Space is one adapter, not a relational or transactional database guarantee. */
export interface BookFlowStore {
  readonly capabilities: {
    atomicMultiRecordCommit: "supported" | "unsupported" | "unknown";
    conditionalWrites: "supported" | "unsupported" | "unknown";
    nativeRelationalQueries: "supported" | "unsupported" | "unknown";
  };
  read<T>(ref: CanonicalRef): Promise<ReadResult<T>>;
  query<T>(query: ScopedQuery): Promise<QueryResult<T>>;
  appendRevision<T>(input: { requestId: Id; expected: CanonicalRef | null;
    next: RecordEnvelope<T>; authority: MutationAuthority }): Promise<CommitReceipt>;
  appendHistory(input: { requestId: Id; event: HistoryEvent;
    authority: MutationAuthority }): Promise<CommitReceipt>;
  updateManagedProjection(input: { requestId: Id; patch: ManagedProjectionPatch;
    authority: MutationAuthority }): Promise<CommitReceipt>;
}
export interface MigrationPlan {
  id: Id; fromSchema: string; toSchema: string; additive: boolean;
  sourceHashes: string[]; preservesEntityIds: true; destructive: false;
  verification: "planned" | "validated" | "published_readback_verified";
}
/** Required implementation rules:
 * - Empty query does not prove nonperformance, even with exhausted coverage.
 * - Completion/assignment/applicability are independent.
 * - Vocabulary entries are not unit instances and do not imply assignment.
 * - Accept only scoped evidence; preserve old attempts without crediting new work.
 * - Emit history only for real observed/confirmed changes, never invented past events.
 * - Managed Space blocks require matching hashes; human notes survive migration.
 */


export interface DataContext {
  id: Id; practicalContextIds: Id[]; purpose: string;
  recordRefs: CanonicalRef[]; provenance: Provenance;
  scope: { studentIds: Id[]; bookEditionIds: Id[]; assignmentIds: Id[] };
  asOf: Instant | null; coverageIds: Id[]; limitations: string[];
}
export interface LogicContract {
  ruleId: Id; version: string; practicalContextIds: Id[];
  rationale: string; inputDataContextIds: Id[];
  inputSchemaRef: string; outputSchemaRef: string;
  uncertaintyPolicy: string[]; sourceIds: Id[];
}
export interface ActionContract {
  id: Id; version: string; practicalContextIds: Id[];
  intent: string; dataContextIds: Id[]; logicRuleIds: Id[];
  targetSchemaRef: string; preconditions: string[]; sideEffects: string[];
  authorization: { evaluatedAtRuntime: true; allowedScopeRequired: true;
    explicitAuthorityForEffects: boolean; documentGrantsPermission: false };
  idempotency: { strategy: string; uncertainOutcomePolicy: string };
  verification: string[]; auditEventType: "ActionAttempt";
  webMcp: { toolName: string; registrationState: "not_verified";
    executionImplemented: false };
}
export interface ActionAttempt {
  id: Id; actionContractId: Id; contractVersion: string;
  requestId: Id; intent: string; targetRefs: CanonicalRef[];
  dataContextIds: Id[]; ruleVersions: Array<{ ruleId: Id; version: string }>;
  authorizationReference: string | null;
  state: "planned" | "started" | "success_verified" | "failed" | "unknown" | "cancelled";
  performedAt: Instant | null; recordedAt: Instant;
  verificationEvidenceIds: Id[]; resultingHistoryEventIds: Id[];
}
/** DATA -> LOGIC -> ACTION must retain practical context, provenance and scope.
 * An action audit event is not proof of a student's activity.
 * WebMCP registration above describes intended wiring, not observed support.
 */


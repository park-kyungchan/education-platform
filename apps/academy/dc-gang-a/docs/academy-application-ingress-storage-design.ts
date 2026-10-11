/** Source-grounded design only. Importing this file starts no server, reader, store or native job. */
import type { Knowledge, ContentScope, LessonContext } from '../src/learning/model';

export interface TrustedApplicationContextDesign {
  readonly ownerId: string;
  readonly actorId: string;
  readonly actorKind: 'authenticated_teacher' | 'admitted_task_agent';
  readonly permissionBasisRef: string;
  readonly scene: { readonly id: string; readonly revision: string; readonly studentIds: readonly string[] };
  readonly admittedOperations: readonly string[];
  readonly admittedFields: readonly string[];
  readonly expiresAt: string;
  readonly revocationRevision: string;
}
export interface SourceDomainBridgeDesign {
  readonly id: string;
  readonly existingSource: string;
  readonly disposition: 'retain_and_qualify' | 'retain_metadata_only' | 'retain_source_only' | 'reject_legacy_projection';
  readonly sourceIdentity: readonly string[];
  readonly fieldMappings: readonly { readonly from: string; readonly to: string; readonly condition: string }[];
  readonly domainDefinitions: readonly string[];
  readonly queryConsumers: readonly string[];
  readonly prohibitedPromotions: readonly string[];
  readonly runtimeGates: readonly string[];
}
export interface VersionBoundaryDesign {
  readonly payloadDefinitionRef: string;
  readonly partition: { readonly ownerId: string; readonly studentId: Knowledge<string> };
  readonly entityId: string;
  readonly expectedHeadRef: string | null;
  readonly idempotencyKey: string;
  readonly commandDigest: string;
  readonly sourceObservedAt: Knowledge<string>;
  readonly recordedAt: string;
  readonly sourceRevisionRefs: readonly string[];
  readonly mappingRevisionRefs: readonly string[];
  readonly context: Knowledge<LessonContext>;
  readonly content: ContentScope;
}
export interface ApplicationIngressStorageDesign {
  readonly schemaVersion: 1;
  readonly kind: 'application_ingress_source_bridge_protected_store_design';
  readonly designVersion: '1';
  readonly status: 'design_only_runtime_not_implemented';
  readonly authority: { readonly current: readonly string[]; readonly excluded: readonly string[] };
  readonly decisions: readonly { readonly id: string; readonly provenance: 'user_answer' | 'lead_recommendation'; readonly statement: string }[];
  readonly ingress: {
    readonly deployment: 'unselected_not_started';
    readonly identityOwners: readonly string[];
    readonly stages: readonly { readonly id: string; readonly checks: readonly string[]; readonly failure: string }[];
    readonly operations: readonly { readonly name: string; readonly effect: string; readonly permission: string; readonly resultDefinition: string }[];
    readonly sourceIntake: readonly string[];
    readonly browserBoundary: readonly string[];
  };
  readonly bridges: readonly SourceDomainBridgeDesign[];
  readonly persistence: {
    readonly recommendation: string;
    readonly selectedResource: null;
    readonly candidates: readonly { readonly name: string; readonly benefit: string; readonly limit: string; readonly admission: string }[];
    readonly tables: readonly { readonly name: string; readonly keys: readonly string[]; readonly purpose: string; readonly scope: string }[];
    readonly transaction: readonly string[];
    readonly retention: readonly string[];
    readonly acknowledgement: readonly string[];
  };
  readonly recovery: {
    readonly primaryPlacement: string;
    readonly independentPlacement: string;
    readonly confirmedDestinations: readonly never[];
    readonly bundleContents: readonly string[];
    readonly restoreProcedure: readonly string[];
    readonly outageRules: readonly string[];
    readonly failureCases: readonly { readonly id: string; readonly observation: string; readonly response: string; readonly acceptance: string }[];
  };
  readonly delivery: readonly { readonly id: string; readonly state: string; readonly paths: readonly string[]; readonly acceptance: readonly string[]; readonly recovery: string }[];
  readonly acceptanceLimits: readonly string[];
  readonly references: readonly string[];
}

export const academyApplicationDesign = {
  schemaVersion: 1,
  kind: 'application_ingress_source_bridge_protected_store_design',
  designVersion: '1',
  status: 'design_only_runtime_not_implemented',
  authority: {
    current: ['Complete this design and canonical checkpoint', 'Inspect and integrate retained reader code with useful validation', 'Commit, push, PR, exact-head checks, normal merge/readback and classified owned legacy cleanup', 'Apply supported scoped native approval optimization while preserving safety', 'Plan and qualify the operational resource/migration/academy/worker categories delegated by the latest user'],
    excluded: ['Worker/model dispatch without fresh effective native controls', 'Unqualified service/account/IAM/billing effects', 'Production DB creation or student migration before exact protected target/cost/access/restore qualification', 'Academy website changes, official-record finalization or parent-send replay', 'Deletion of unknown or uniquely unpreserved work', 'Native lifecycle mirror, dispatcher or context injector'],
  },
  decisions: [
    { id: 'external_protected_candidate', provenance: 'user_answer', statement: 'A teacher-only externally protected primary and an independent encrypted recovery copy are allowed as design candidates. Exact resources, access, region/privacy, costs and migration still require separate admission.' },
    { id: 'integration_admitted', provenance: 'user_answer', statement: 'The user expanded the design-only kickoff to autonomous code-level integration/publication, classified legacy removal and supported approval optimization. Operational categories are delegated; exact resource/effect/privacy/cost/recovery and current native-control prerequisites remain. Old worker budgets/identities do not transfer.' },
    { id: 'minimal_retention', provenance: 'lead_recommendation', statement: 'Retain minimal decision-relevant source fields and their versions, teacher originals/revisions and required evidence references. Do not mirror whole HTML/JSON/media. The second answer expanded engineering authority rather than explicitly selecting a raw retention policy; exact real-data scope remains a production gate.' },
    { id: 'modular_application', provenance: 'lead_recommendation', statement: 'One TypeScript/Bun application boundary owns query/command validation and store transactions. Human UI and owned-origin WebMCP are adapters, not separate logic, authentication proxies or databases.' },
    { id: 'relational_first_candidate', provenance: 'lead_recommendation', statement: 'Compare managed PostgreSQL first for constrained relations, append/CAS/idempotency and recovery. No provider is selected. Keep relational payloads/versioned edges exportable; later KG queries do not block this unit.' },
  ],
  ingress: {
    deployment: 'unselected_not_started',
    identityOwners: [
      'Product login binds the actual teacher through a selected supported identity provider; the host is not yet selected.',
      'The native academy browser/vault owns academy sign-in. Never transfer its cookies, password, session or provider tokens to the product web app.',
      'Native Hermes owns task/model/tool execution and admission. Product checks an explicit narrow invocation grant; it does not duplicate native Session/Project/Task state.',
      'TrustedApplicationContextDesign is server-produced metadata. Its TypeScript shape is neither an authentication implementation nor permission proof.',
    ],
    stages: [
      { id: 'authenticate', checks: ['Verify the actual principal and current session/grant through the selected supported owner', 'Reject client ownerId/actorRole/authenticated booleans', 'Recheck expiry and revocation; do not log identifiers or credential headers'], failure: 'authentication_required; no data or side effect' },
      { id: 'bind_scene', checks: ['Load current teacher-owned scene and revision', 'Intersect requested students/date/content/operations/fields with actual permission and scene', 'Do not treat a caller sceneId, cursor or tool-discovery result as authority'], failure: 'scope_conflict or stale_revision; no foreign data' },
      { id: 'validate_input', checks: ['Reuse workspace and student schema definitions', 'Validate real calendar/IANA zone, range order, catalog conjunction and exact reference partitions', 'Bind cursors to owner/actor grant/scene/query/view revision and stable order; invalidate on drift rather than silently skip rows'], failure: 'contract_rejected; no arbitrary URL, SQL or script execution' },
      { id: 'qualify_sources', checks: ['Use the existing endpoint catalog and exact adapter contract, not a catalog executor', 'Check current semantic effect, source namespace, exact subject/effective time and requested page coverage', 'Classify last-verified data separately from current source acquisition'], failure: 'partial with explicit unknowns or blocked affected source; never synthetic facts' },
      { id: 'execute_domain', checks: ['Use Knowledge/ContentScope/LessonContext and explicit expanded DTO mappings', 'Separate retained-history queries from currentRevisions/timeline projections', 'Reconciliation needs concrete targets and independent teacher inspection, never an aggregate grade'], failure: 'unverified_join or explicit unresolved intake' },
      { id: 'commit_product_write', checks: ['Require protected resource admission and actual grant', 'Resolve exact teacherDirectiveRef outside caller content; reject inspection/approval through agent reported lane', 'Reload/CAS/append/idempotency/readback in one provider-qualified transaction'], failure: 'stale_base, idempotency_reuse or uncertain; retain original request identity' },
      { id: 'return_same_context', checks: ['Recheck scene and grant before disclosure', 'Validate exact tool/view/result scope, rowCount, unique identities and pagination', 'Expose opaque authorized evidence/media handles; exclude raw URLs and untrusted text as instructions'], failure: 'scope_conflict; a cancelled write may still have committed' },
    ],
    operations: [
      { name: 'query_class_preparation', effect: 'read_compute', permission: 'date-scoped authorized class across all requested groups/pages; completeness independently proven', resultDefinition: 'ToolReadResult' },
      { name: 'query_student_learning', effect: 'read_compute', permission: 'one student and bounded period or exact entity/sequence history', resultDefinition: 'ToolReadResult' },
      { name: 'explain_learning_evidence', effect: 'read_compute', permission: 'claim/evidence handle already admitted to this scene', resultDefinition: 'ToolReadResult' },
      { name: 'draft_lesson_review', effect: 'unsaved_proposal', permission: 'exact evidence basis; no model call implicit in transport', resultDefinition: 'DraftProposal' },
      { name: 'record_teacher_observation', effect: 'protected_product_write', permission: 'separately admitted narrow task-agent invocation plus attributable teacher directive; reported lane only', resultDefinition: 'WriteAcknowledgement' },
      { name: 'human_review_operation', effect: 'protected_product_write_human_only_future', permission: 'interactive authenticated teacher intent/user-presence proof; no public WebMCP inspection/mastery/approval operation', resultDefinition: 'TeacherRevision' },
    ],
    sourceIntake: [
      'A private read preparation is not an authenticated server ingress. Browser booleans and sanitized audit hashes are not trusted attestations.',
      'First supported source path remains manual native-browser acquisition under exact teacher/student/date/field scope. A future product importer needs explicit teacher-owned ingestion admission and exact provenance verification.',
      'Bind an intake to a server-issued one-use acquisition request, reviewed operation/version, literal expected identities and field/page limits; compare actual source scope and independently corroborated joins.',
      'A MAC of a received payload proves integrity from a qualified collector, not truth of academy facts. No native signing/attestation API is assumed to exist.',
      'Until a supported collector-to-product identity channel is qualified, autonomous ingestion is blocked. Use reviewed manual intake only after its protected destination is admitted.',
      'No backend academy proxy, saved-session client, broad cold-capture ingestion, hidden cross-origin fetch or default shared Sheet student export.',
    ],
    browserBoundary: [
      'Owned private origin only. Secure same-origin session cookies, TLS, Origin/CSRF checks for writes, restrictive CSP and no unsafe raw HTML rendering are required future implementation.',
      'Same teacher browser cookies cannot distinguish an agent invocation from a human judgment. Caller transport/surface headers or JS role strings are not authority.',
      'Reads and reported writes require server-bound narrow invocation capabilities. If real browser/Hermes cannot establish a supported agent/teacher grant, keep consequential tools unavailable; do not create a substitute dispatcher.',
      'Human judgment needs a distinct interactive teacher confirmation/user-presence channel. A tool annotation, dialog registration or generic authenticated fetch is insufficient.',
      'Verify the actual supported modelContext API and standard fields on the admitted owned origin. No academy-site injection, browser flags, shim or sandbox bypass.',
      'Same UI/application outputs must be exercised via real discovery/invocation and denied-scope, stale-scene, source-outage and cancellation cases. Schema PASS/registration is not WebMCP acceptance.',
    ],
  },
  bridges: [
    {
      id: 'catalog', existingSource: 'src/lms/endpointCatalog.ts', disposition: 'retain_metadata_only',
      sourceIdentity: ['original operation ID', 'source family', 'literal selector placement', 'source revision'],
      fieldMappings: [{ from: 'semanticEffect/sourceRefs/requestGate', to: 'qualified operation prerequisite', condition: 'Metadata never enables catalog execution; callable remains zero' }],
      domainDefinitions: [], queryConsumers: ['all queries: qualification only'], prohibitedPromotions: ['known route -> permitted live request', '95 catalog entries -> complete server coverage'], runtimeGates: ['current exact adapter and source ownership/effect/response/page contract'],
    },
    {
      id: 'textbook', existingSource: 'src/lms/academyReadProtocol.ts', disposition: 'retain_and_qualify',
      sourceIdentity: ['studentKey', 'courseKey', 'bookNo', 'paperKey', 'attemptKey', 'originalOrdinal', 'lectureKey or unknown'],
      fieldMappings: [
        { from: 'score', to: 'AssessmentAttempt.originalScore', condition: 'Literal retained source score; not earliest-grade chronology or teacher assessment' },
        { from: 'items[].originalOrdinal/scoring/lectureKey', to: 'AssessmentItemOutcome.originalOrdinal/storedResult/sourceItem', condition: 'Unique original ordinal per attempt; never clinic position or synthetic LEC identity' },
        { from: 'sourceDate.literal/precision', to: 'KnowledgeTime/source_apply_date', condition: 'Month-day stays month-day; do not invent year/timezone/grade time or assign a lesson by read date' },
        { from: 'courseKey/bookNo', to: 'BookAssignment and shared catalog references', condition: 'Separate effective enrollment and exact edition bindings required; title selection is not edition proof' },
      ], domainDefinitions: ['AssessmentAttempt', 'BookAssignment', 'SourceEvidence', 'CoverageObservation'], queryConsumers: ['query_student_learning', 'query_class_preparation', 'explain_learning_evidence'],
      prohibitedPromotions: ['existing graded rows -> whole-book assignment inventory', 'O/X -> handwritten solving/clinic completion/mastery', 'source title -> exact catalog identity'],
      runtimeGates: ['qualified native origin/principal/read operation', 'exact source-to-product student binding', 'effective course/book/edition/occurrence and page scope', 'same-generation item/time and response validation'],
    },
    {
      id: 'daily_zero', existingSource: 'src/lms/assessmentReadProtocol.ts', disposition: 'retain_and_qualify',
      sourceIdentity: ['studentKey', 'attemptKey', 'paperKey'],
      fieldMappings: [{ from: 'score/itemCount/correctCount/wrongCount', to: 'source_evidence stored_grade summary', condition: 'Current reader emits aggregates, not item O/X rows; cannot satisfy AssessmentAttempt.items or synthesize them' }],
      domainDefinitions: ['SourceEvidence', 'CoverageObservation'], queryConsumers: ['query_student_learning', 'query_class_preparation'], prohibitedPromotions: ['recent search -> all-history coverage', 'DT/ZT stored grade -> DayRecord DailyTest judgment', 'grade summary -> per-item evidence'],
      runtimeGates: ['exact selected attempt and score-only variant admission', 'product student binding and paper namespace', 'qualify itemized result separately before AssessmentAttempt promotion'],
    },
    {
      id: 'day_record', existingSource: 'src/lms/dayRecordReadProtocol.ts', disposition: 'retain_and_qualify',
      sourceIdentity: ['teacherKey', 'date', 'groupId', 'studentKey', 'courseKey', 'recordKey', 'membershipKey'],
      fieldMappings: [
        { from: 'matching passive handler tuple + independent SelSglRecord', to: 'LessonOccurrence source identity and literal lesson date', condition: 'Current principal proof, source signatures and actual column semantics required; lesson/makeup lane needs its own evidence' },
        { from: 'attendance/progress/homework/lessonMemo/persistentMemo', to: 'SourceEvidence distinct official field snapshots', condition: 'Do not turn text into activity/correctness; persistentMemo is student-scoped, other fields occurrence-scoped; literal attendance scale remains source-qualified' },
      ], domainDefinitions: ['LessonOccurrence', 'SourceEvidence', 'CoverageObservation'], queryConsumers: ['query_class_preparation', 'draft_lesson_review'], prohibitedPromotions: ['requested names/groups -> all scheduled roster', 'onFo handler name -> observed header classification', 'current memo -> immutable prior approval/sent text', 'one row per name -> all occurrences per student'],
      runtimeGates: ['native DOM control/XML refusals', 'independently reviewed header/column mapping or fail-closed unavailable collector', 'current separate teacher and occurrence proof', 'complete regular/makeup/date/group/page inventory'],
    },
    {
      id: 'student_course', existingSource: 'src/lms/studentCourseRead.ts', disposition: 'retain_and_qualify',
      sourceIdentity: ['academy_student_course', 'studentKey', 'collegeKey', 'courseKey', 'userCourseKey'],
      fieldMappings: [{ from: 'three matching passive tuples', to: 'IdentityBinding and enrollment candidate', condition: 'Seven sourceCells remain literal until their headers/effective dates/book semantics are qualified; userCourseKey is not cm_seq' }],
      domainDefinitions: ['IdentityBinding', 'BookAssignment', 'UnresolvedIntake'], queryConsumers: ['query_student_learning'], prohibitedPromotions: ['one course row -> full enrollment', 'sourceCells dates -> verified effective period', 'same numeric spelling -> cross-namespace equality'], runtimeGates: ['current principal and exact college/search scope', 'header/cell semantics and pagination', 'effective identity and catalog binding'],
    },
    {
      id: 'item_metadata', existingSource: 'src/lms/itemMetadataRead.ts', disposition: 'retain_and_qualify',
      sourceIdentity: ['academy_item', 'lectureKey', 'outerLectureKey', 'sourceId'],
      fieldMappings: [{ from: 'unit/pattern/difficulty/play_seconds', to: 'qualified shared source metadata', condition: 'Preserve lecture versus outer lecture identity; answers omitted; concept edition/page/problem mapping is separately reviewed' }],
      domainDefinitions: [], queryConsumers: ['explain_learning_evidence', 'query_student_learning'], prohibitedPromotions: ['play_seconds -> watched time', 'unit name -> concept/prerequisite binding', 'source difficulty -> student mastery'], runtimeGates: ['one previously verified literal source key and fixed GetLectureList variant', 'catalog and paper/item relation qualification'],
    },
    {
      id: 'spt_and_main', existingSource: 'docs/main-sheet-live-refresh-wiring.json', disposition: 'retain_source_only',
      sourceIdentity: ['SPT owner/student_id/class_date/event/request/import/chunk/receipt', 'Main workbook/tab/student mapping/revision'],
      fieldMappings: [{ from: 'classroom evidence and teacher notes', to: 'SourceEvidence/TeacherRevision or unresolved intake', condition: 'Preserve D1/R2 and teacher ownership; exact SPT-to-product bindings and attributable Main revisions required, not name/row position' }],
      domainDefinitions: ['SourceEvidence', 'TeacherRevision', 'UnresolvedIntake'], queryConsumers: ['all teacher scenes'], prohibitedPromotions: ['SPT receipt -> official DayRecord', 'hidden tab -> private store', 'Main latest cell -> complete history'], runtimeGates: ['exact source authorization and effective mapping', 'accepted-time original revision evidence', 'transition A consumer parity and approved shared-summary target before any Sheet change'],
    },
    {
      id: 'legacy_projection', existingSource: 'src/lms/lmsLiveQueryService.ts', disposition: 'reject_legacy_projection',
      sourceIdentity: ['historical compatibility parser inputs'], fieldMappings: [], domainDefinitions: [], queryConsumers: [],
      prohibitedPromotions: ['fabricated answer key/LEC/time -> RawAppAssessmentSubmission', 'retired saved-cookie calls -> supported source channel', 'synthetic fallback -> live evidence'], runtimeGates: ['retain explicit refusal and compatibility tests; no production path through legacy defaults'],
    },
  ],
  persistence: {
    recommendation: 'One private relational store with owner/student partitions and shared catalogs. Compare a managed PostgreSQL resource first; no resource/provider/account is selected or created. Preserve synthetic bun:sqlite solely as a test/reference adapter.',
    selectedResource: null,
    candidates: [
      { name: 'managed PostgreSQL candidate', benefit: 'Transactional constrained relations, bounded indexed history and explicit access policy; portable logical export', limit: 'No verified existing private resource, region, quotas, backup entitlement or zero bill; provider auth/RLS bypass and restore need real tests', admission: 'Exact teacher-owned resource/access/privacy/cost/restore before provisioning or ingestion' },
      { name: 'separate D1 candidate', benefit: 'Existing SPT source familiarity and SQLite dialect', limit: 'Do not reuse SPT production tables; D1 transaction/batch/CAS/session and export semantics are not local SQLite guarantees', admission: 'Separate reviewed resource and actual atomic/access/restore/Free Tier contract' },
      { name: 'Backend-local SQLite candidate', benefit: 'Small single-writer footprint and existing synthetic behavior witnesses', limit: 'Container/profile/path permissions are not a sandbox or independent durability; replacement/loss and direct-file access remain risks', admission: 'Exact protected durable volume, supported writer identity and independently recoverable copy; never rename synthetic store into production' },
    ],
    tables: [
      { name: 'shared_catalog_versions', keys: ['owner/catalog namespace', 'edition/unit/page/problem opaque key', 'version'], purpose: 'One validated hierarchy; exact references to consumed versions', scope: 'qualified shared metadata, not duplicated by student' },
      { name: 'identity_binding_versions', keys: ['ownerId', 'source namespace/literal key', 'effective period', 'revision'], purpose: 'Auditable mappings; conflicting/unknown periods never implicitly open-ended', scope: 'teacher-only mapping' },
      { name: 'record_versions', keys: ['ownerId', 'studentId or explicit owner-level lane', 'entityId', 'sequence', 'revisionId'], purpose: 'Minimized source DTO snapshots and non-regenerable teacher originals in append-only version envelopes', scope: 'logical student or explicit owner-protected unresolved/coverage/paper lane' },
      { name: 'entity_heads', keys: ['ownerId', 'lane/partition', 'entityId'], purpose: 'CAS pointer to latest committed revision; rebuildable from verified complete history', scope: 'same owner/reference constraints' },
      { name: 'command_outcomes', keys: ['ownerId', 'actor grant', 'idempotencyKey'], purpose: 'Original request digest and attributable commit/outcome; not native task telemetry', scope: 'only consequential product commands; no universal per-read ledger' },
      { name: 'evidence_relations', keys: ['ownerId', 'studentId', 'from revision', 'typed relation', 'to revision'], purpose: 'Version-qualified occurrence/content/attempt/basis/carryover joins', scope: 'no cross-student edges without separately modeled shared catalog relation' },
      { name: 'query_cache', keys: ['ownerId', 'admitted scope', 'basis revisions', 'query version'], purpose: 'Expendable projections; no authority/freshness clock replacement', scope: 'purgeable and rebuilt under current permissions' },
    ],
    transaction: [
      'Authenticate and validate the original request; create no durable student record under a merely valid schema.',
      'Compute a versioned canonical digest of exact client intent plus stable trusted actor/partition/basis. Server-generated recordedAt is assigned once on first acceptance, not recomputed into retry equality.',
      'In one actual provider-qualified transaction: look up original idempotency outcome first; identical intent returns original outcome even after later revisions; changed intent conflicts.',
      'Load current head and necessary catalog/binding/evidence revisions under the same consistency boundary; verify owner/student/reference equality, date/content semantics and expected head.',
      'Append full original payload and version envelope; update CAS head and command outcome together with database uniqueness/reference enforcement. No partial success across related rows.',
      'Persist recordedAt/actor attribution server-side. Preserve source time precision, sourceObservedAt, event/lesson date and approval time separately.',
      'Commit before claiming history_saved_read_back; re-read the exact committed version through the protected reader. Failed/uncertain commit/readback remains uncertain; reconcile original request before retry.',
      'Reuse learning/revisions canonicalJson/digest/expected-head/idempotency/transition principles, not a cast of expanded DTOs into LearningRecord. Version the expanded union and compatibility envelope explicitly.',
      'Pure previewRevision validates a supplied whole ledger. An indexed production store needs validated complete chain/head witnesses and partition/reference constraints; it cannot trust an arbitrary history slice.',
      'Unkeyed chains do not detect a forged complete rewrite or a valid truncated tail. Bind exports to independently retained manifest counts/heads and protected authenticity; do not claim cryptographic authorship from hashes.',
    ],
    retention: [
      'Keep exact source keys, literal fields needed for decisions, source contract/mapping versions, literal time precision, scope/page coverage and original observation time.',
      'Keep original teacher note/draft/review/approval/correction intent without fixed expiry as already decided; later corrections append, not overwrite prior accepted-time evidence.',
      'Keep original media at its source. Store only private authorized handles/references; a link is not durable media retention or permission to redistribute.',
      'New routine acquisition uses minimized transformation then removes its owned raw scratch once validation/readback is successful. Diagnostic raw retention requires a separate exact private scope. Do not delete predecessor evidence or private raw acquisitions under this design.',
      'No credentials, browser sessions, whole transcripts, shared-profile mirror or raw students in Git/common owners/logs. Free-text/opaque IDs still require confidentiality review.',
      'A CoverageObservation is retained only as basis for a consequential claim; an ordinary empty query is not automatic nonperformance or an obligatory ledger entry.',
    ],
    acknowledgement: ['input_received is not durable', 'history_saved_read_back identifies exact committed revision', 'independent_copy_verified covers exact revision and named failure domain', 'restore_verified covers an actually restored bounded manifest, not all future writes', 'uncertain retains original request/target and blocks blind retry', 'officialSaved=false and parentSent=false throughout these product commands'],
  },
  recovery: {
    primaryPlacement: 'Proposed private external relational primary, distinct from replaceable execution/container workspace. Actual provider/resource/region and account are unselected.',
    independentPlacement: 'Proposed portable authenticated encrypted export to a separately protected teacher-only recovery account/location outside the primary provider and Backend lifecycle. A private Drive file is only a candidate, never the academy workbook or inherited bot writer.',
    confirmedDestinations: [],
    bundleContents: ['schema/digest algorithm/version and catalog versions', 'all included record revisions in dependency order', 'effective identity mappings and typed reference edges', 'original command outcomes/retry identity', 'entity heads, sequences/counts and independently trusted manifest digest', 'source/page/time coverage and explicit unknown joins', 'encryption format and key-recovery instructions without keys or credentials'],
    restoreProcedure: [
      'Obtain exact source/copy/empty-destination/access/region/effect admission; fresh writers must be non-conflicting.',
      'Select a consistent committed snapshot/high-water mark. Include all reference dependencies or an explicit authorized unresolved boundary; do not export current heads alone.',
      'Encrypt before transfer using a reviewed authenticated scheme and teacher-owned recoverable key outside the failed primary/Backend; existing native credentials do not prove a recovery key exists.',
      'Read back exact ciphertext/object identity, version, bytes/digest and ACL. A same-provider replica or same-volume export is not the admitted independent failure domain.',
      'Verify authenticity/manifest, decrypt in an approved private restore location and validate versions/counts/full chains/heads/partitions/catalog/binding references.',
      'Import only into a separately admitted empty target; no implicit merge, remap, overwrite or engine/other-container administration.',
      'Requery original teacher revisions, accepted-time basis, later corrections, unresolved joins and original idempotency outcomes. Compare exact target/manifest and UI/query results.',
      'Report restored high-water mark and uncovered later commands. Promote consumers only after reviewed parity/recovery and target admission; retain predecessor until accepted.',
    ],
    outageRules: [
      'Source outage: show lastVerifiedAt and scope/limits without changing them on view opening; keep source coverage partial/unknown.',
      'Product-primary outage: no saved/readback acknowledgement. Teacher drafts continue only through a separately qualified protected capture path; an unsaved browser draft/outbox is visibly unsaved and not the sole original.',
      'No independent copy: show the uncovered committed range and recovery risk; do not claim lossless Backend/provider recovery. Recovery cadence/RPO/RTO are unmeasured, not invented.',
      'Scene navigation/cancellation stops new work and disclosure. A previously admitted write can commit; status uses original target/request after reconnection and fresh authentication.',
      'Revocation blocks new reads/writes. Reconcile an uncertain admitted write by exact identity; never silently mint a new retry key.',
      'Independent source retention and original media ownership remain intact; encrypted DB export does not prove recovery of external media.',
    ],
    failureCases: [
      { id: 'foreign_scope', observation: 'Request/cursor/evidence handle belongs to another owner/student/scene', response: 'Refuse before disclosure and transaction', acceptance: 'No foreign rows or write in human and actual WebMCP paths' },
      { id: 'source_drift', observation: 'Changed effect/selector/header/control/XML/key/time/page contract', response: 'Block affected adapter; preserve prior observation and unknowns', acceptance: 'Positive/negative source-native cases with exact current contract; no fallback' },
      { id: 'partial_roster', observation: 'Unknown group/page inventory or duplicate occurrences', response: 'Partial result; no complete preparation label or missing-work inference', acceptance: 'All requested scheduled lanes/pages independently counted at routine teacher scale' },
      { id: 'retry_conflict', observation: 'Same key changed intent or expected head drift', response: 'Conflict or identical original replay; no duplicate append', acceptance: 'Actual multi-connection provider transaction and delayed retry tests' },
      { id: 'lost_ack', observation: 'Commit/readback interruption or browser cancellation', response: 'Uncertain; read exact command outcome before deliberate retry', acceptance: 'Fault after commit and after response loss retains original IDs and history' },
      { id: 'primary_loss', observation: 'Execution Backend or primary resource unavailable', response: 'Restore admitted independent manifest into empty protected target', acceptance: 'Actual restoration with independent key/ACL and consumed query parity; no simulation certifies production' },
      { id: 'history_tamper', observation: 'Wrong digest, truncated valid tail, reference gap or schema drift', response: 'Refuse restore/promotion; preserve failed copy', acceptance: 'Compare independently trusted heads/counts and authenticated export, not recomputable local hashes alone' },
    ],
  },
  delivery: [
    { id: 'reader_integration', state: 'current_user_admitted_code_and_git_only', paths: ['harness/endpoints.ts', 'harness/academy_read_prepare.ts', 'src/lms/academyReadProtocol.ts', 'src/lms/dayRecordReadProtocol.ts', 'src/lms/studentCourseRead.ts', 'src/lms/itemMetadataRead.ts', 'tests/lms/dayRecordNativeDomCases.ts'], acceptance: ['All retained changes dispositioned; unique evidence and staged/unstaged originals recoverable before classified legacy retirement', 'Actual offline CLI preparation/audit for qualified families', 'Native synthetic DOM refusals; unqualified source-header and source joins remain blocked', 'Exact-head portable CI and normal merge/readback'], recovery: 'Use the verified private recovery archive and published successor; no deletion of unknown work or academy replay' },
    { id: 'source_domain_adaptation', state: 'next_bounded_implementation_requires_explicit_scope', paths: ['src/learning/model.ts', 'src/learning/revisions.ts', 'src/learning/reconciliation.ts', 'docs/academy-student-evidence-contract.json'], acceptance: ['Explicit expanded revision DTO compatibility', 'Unknown effective joins/aggregate grades stay unknown', 'Current/as-of/history and source-to-scene parity'], recovery: 'Versioned adapter with preserved original source observations; no remap of historical partitions' },
    { id: 'protected_resource_qualification', state: 'resource_privacy_cost_and_effect_admission_required', paths: ['docs/student-database-architecture-2026-10-01.json', 'src/storage/syntheticLearningSqlite.ts', 'docs/academy-application-ingress-storage-design.ts'], acceptance: ['Exact resource/owner/ACL/region/Free Tier and concurrency', 'Actual atomic access/retry/readback', 'Independent encrypted copy and empty-target restore at admitted scope'], recovery: 'No provisioning/ingestion now; refuse drift and preserve independently qualified originals' },
    { id: 'teacher_webmcp_ingress', state: 'future_runtime_and_deployment_admission_required', paths: ['docs/academy-teacher-workspace-tool-contract.json', 'docs/academy-application-ingress-storage-design.ts'], acceptance: ['Supported teacher authentication and narrow task grants', 'One application implementation for UI and actual browser/Hermes', 'User-presence distinction for judgment; CSRF/origin/scope/revocation/navigation tests', 'Normal teacher-day/outage/correction acceptance before Main transition'], recovery: 'Keep Main/shared/SPT consumers unchanged; unsupported tools stay unavailable, no shim or runtime bypass' },
  ],
  acceptanceLimits: ['Typed design validation is not authenticated access enforcement', 'Code/CI/native synthetic DOM is not fresh academy field/page/teacher acceptance', 'No operational primary/copy/restore or server/frontend has been created', 'No actual browser WebMCP/Hermes discovery or product invocation is established', 'Git integration does not complete the 95-entry/17-family academy program or approve production effects'],
  references: ['docs/academy-whole-lens-target-architecture.json', 'docs/academy-student-evidence-contract.json', 'docs/academy-teacher-workspace-tool-contract.json', 'docs/learning/domain-design.json', 'src/learning/model.ts', 'src/learning/revisions.ts', 'src/learning/reconciliation.ts', 'src/storage/syntheticLearningSqlite.ts', 'src/lms/endpointCatalog.ts', 'docs/academy-backend-reengineering-contract.ts', 'docs/main-sheet-live-refresh-wiring.json', '/opt/data/shared-llm-wiki/concepts/ontology-aip-evals-sdlc-agent-start.md', 'https://www.postgresql.org/docs/current/backup.html', 'https://bun.sh/docs/runtime/sqlite', 'https://developer.chrome.com/docs/ai/webmcp/secure-tools', 'https://developer.chrome.com/docs/ai/webmcp/imperative-api'],
} as const satisfies ApplicationIngressStorageDesign;

/** Design only: no network implementation, endpoints, authentication export, or production effects. */
export type SourceRef = {
  evidenceId: string;
  observedAt: string;
  kind: 'current_dom' | 'current_response' | 'historical_source' | 'user_print_snapshot';
  operationId: string | null;
  sourceDigest: string | null;
  pointer: string;
  // A server-private provenance reference, never an LMS session URL or credential.
};
export type AssessmentKey = {
  studentKey: string; originalPaperId: string; testingNo: string;
};
export type HeaderMatch =
  | { kind: 'unique_original'; assessment: AssessmentKey; evidence: SourceRef[] }
  | { kind: 'ambiguous'; candidates: AssessmentKey[]; evidence: SourceRef[] }
  | { kind: 'unresolved'; reason: string; evidence: SourceRef[] };
export type OriginalMember = {
  ordinal: number; itemKey: string | null; label: string; evidence: SourceRef[];
};
export type ItemJudgment = {
  // Independent from original membership; false/empty is never the default.
  ordinal: number; itemKey: string | null;
  state: 'correct' | 'incorrect' | 'ungraded' | 'unknown';
  rawStatus: string | null;
  evidence: SourceRef[];
};
export type ReadFailureCode =
  | 'AUTH_REQUIRED' | 'AUTH_EXPIRED' | 'SESSION_CONFLICT_UNCONFIRMED'
  | 'ACCESS_DENIED' | 'UPSTREAM_TIMEOUT' | 'UPSTREAM_UNAVAILABLE'
  | 'SOURCE_CONTRACT_UNVERIFIED' | 'READ_CHANNEL_UNAVAILABLE'
  | 'HEADER_AMBIGUOUS' | 'STUDENT_SCOPE_UNVERIFIED' | 'ASSESSMENT_JOIN_UNVERIFIED'
  | 'SOURCE_CHANGED' | 'PARTIAL_RESPONSE' | 'MALFORMED_RESPONSE'
  | 'ITEM_JUDGMENTS_UNAVAILABLE' | 'ORIGINAL_MEMBERSHIP_UNAVAILABLE'
  | 'PRINT_INSTANCE_NOT_RESOLVED';
export type ReadFailure = {
  ok: false; code: ReadFailureCode; message: string;
  observedAt: string; retry: 'none' | 'supported_sign_in' | 'later_same_read';
  evidence: SourceRef[];
};
export type ReadSuccess<T> = { ok: true; value: T; observedAt: string; evidence: SourceRef[] };
export type ReadResult<T> = ReadSuccess<T> | ReadFailure;
export type Coverage = {
  state: 'complete' | 'partial' | 'unknown';
  expectedCount: number | null; observedCount: number;
};
export type OriginalMembership = { assessment: AssessmentKey; members: OriginalMember[]; coverage: Coverage };
export type AssessmentJudgments = { assessment: AssessmentKey; judgments: ItemJudgment[]; coverage: Coverage };
export type WrongSubset = {
  assessment: AssessmentKey;
  // Join by verified item keys, or explicitly proven same-response ordinal mapping.
  joinBasis: 'verified_item_keys' | 'proven_same_response_ordinals' | 'verified_shared_assessment_ordinals';
  originalCoverage: Coverage; judgmentCoverage: Coverage;
  incorrectItems: OriginalMember[]; unknownOrdinals: number[];
};
export type PrintSnapshot = {
  kind: 'immutable_print_snapshot'; snapshotId: string;
  source: 'user_supplied' | 'verified_existing_print_artifact';
  digest: string; capturedAt: string;
  originalAssessment: AssessmentKey | null;
  printedHeader: string; orderedLabels: string[];
  // Never deduced from current wrong subset, candidate counts, or regenerated similar questions.
  evidence: SourceRef[];
};
export type SessionLease = {
  // Non-secret reference to a supported isolated server/browser session; not a session cookie.
  leaseId: string; ownerId: string; permittedOrigin: 'https://dc.gang-a.kr';
  state: 'authenticated' | 'expired' | 'unknown'; validatedAt: string | null;
  channel: 'supported_authenticated_browser' | 'verified_ephemeral_server_channel';
};
export interface VerifiedReadProvider {
  // Browser-backed observations may implement these methods only after exact effect/identity validation.
  // No guessed GetExamDetail, generation, print interception, or cookie transfer fallback.
  resolveOriginalHeader(input: { header: string; studentKey: string }, lease: SessionLease): Promise<ReadResult<HeaderMatch>>;
  readOriginalMembership(key: AssessmentKey, lease: SessionLease): Promise<ReadResult<OriginalMembership>>;
  readItemJudgments(key: AssessmentKey, lease: SessionLease): Promise<ReadResult<AssessmentJudgments>>;
}
export const adapterSafety = {
  deploymentStatus: 'design_only',
  itemJudgmentProviderStatus: 'three_actual_dom_reads_verified_no_server_adapter',
  serverSessionBridgeStatus: 'not_established',
  clientSuppliedUrls: 'rejected',
  secretsInFrontendOrLovablePrompt: 'forbidden',
  sessionExportOrImportFallback: 'forbidden',
  externalStudentDataTransfer: 'requires_explicit_recipient_and_purpose_approval',
  cachePolicy: 'owner_scoped_with_timestamp_no_stale_as_live',
  transientFailurePolicy: 'preserve_last_evidence_and_mark_stale_never_return_empty_success',
  wrongSubsetPolicy: 'complete_only_when_membership_judgments_and_join_are_proven',
} as const;

/** Current official JavaScript declaration, NOT a verified server read contract. */
export type WrongAnswerNoteCandidateInput = {
  // Current UI constructs exactly one string element in each list.
  courseKeyList: [string]; bookNoList: [string]; userKeyList: [string];
};
export type WrongAnswerNoteCandidateForm = {
  p_process: 'getWrongAnswerNoteResult';
  answerNoteResult: string; // JSON.stringify(WrongAnswerNoteCandidateInput)
};
export type WrongAnswerNoteStaticResponseUsage = {
  result: unknown; // Client compares with lowercase 'ok'; no live response observed.
  noteResultList?: Array<{
    pri_no: unknown; name: unknown; testing_no: unknown;
    // Other fields, including any wrong flags, are unobserved. No inferred schema.
  }>;
};
export const wrongAnswerNoteCandidate = {
  evidenceKind: 'current_static_javascript',
  method: 'POST',
  observedPath: '/servlet/controller.common.TestpageSelectExServlet',
  operation: 'getWrongAnswerNoteResult',
  wireConstruction: 'jQuery ajax data string: p_process=...&answerNoteResult=JSON.stringify(input)',
  asyncOption: false,
  responseGate: "data.result == 'ok'",
  responseFieldsUsed: ['noteResultList[].pri_no', 'noteResultList[].name', 'noteResultList[].testing_no'],
  serverEffect: 'unverified',
  runtimeInvoked: false,
  perItemJudgmentsObserved: false,
  wrapper: 'createBookIncorrectPapers',
  unsafeContinuation: 'nonempty noteResultList -> incorrect.create=1 -> Typeset.createResultPaper',
  safeToBindProvider: false,
  blockedOn: ['independent_supported_authenticated_channel', 'server_read_effect_verification', 'actual_response_schema_and_scope'],
} as const;

/** Verified initial-page DOM contract for one observed NA assessment, not a generic HTTP provider. */
export type PupilSearchObservedResult = {
  pNo: string; testingNo: string; priNo: string | number;
  examResultList: Array<{ _examNo: number; ox: unknown; __ox?: unknown }>;
};
export const pupilSearchReadEvidence = {
  method: 'GET', path: '/servlet/controller.tutor.na.TestPageListServlet',
  operation: 'PupilSearch', source: 'URL_construction_observed_in_official_onPopupViewTestResultButtonClick',
  handlerExecutionAllowedAsPureRead: false,
  handlerSideEffectUnknown: 'MODULE.TagManager.saveTag(tag) runs before URL construction; persistence effect unverified',
  verifiedExecutionBoundary: 'direct_observed_PupilSearch_GET_and_DOM_only',
  channel: 'supported_authenticated_browser_navigation_and_DOM_read',
  rowSource: 'EXTERN_DIALOG.testResultList',
  judgmentFields: ['examResultList[]._examNo', 'examResultList[].ox'],
  knownFlags: { X: 'incorrect', O: 'correct' },
  corroboratingDom: 'td.exam-type-1/2 img src wrong_bts.png or right_bts.png',
  labelSource: 'ViewAnswerList with exact same p_no/testing_no',
  join: 'verified_shared_assessment_ordinals',
  verifiedFixtureCount: 3,
  initialReadObserved: true,
  pageWriteControlsExcluded: true,
  genericHeaderAutomationComplete: false,
  serverHttpProviderImplemented: false,
  mcpImplemented: false,
  provesHistoricalPrintedState: false,
} as const;

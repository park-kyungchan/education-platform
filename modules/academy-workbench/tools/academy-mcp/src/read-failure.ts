import {z} from 'zod';

export type ReadFailureCategory='authentication'|'policy_denial'|'identity_ambiguity'|'contract_drift'|'malformed_response'|'partial_coverage'|'endpoint_absence'|'upstream_unavailable';
const catalog={
  authentication_required:['authentication','source-owner:authentication-boundary'],
  daily_history_selector_drift:['contract_drift','source-owner:daily-history-selectors'],
  student_paper_search_wire_drift:['contract_drift','source-owner:student-paper-search'],
  student_paper_owner_drift:['policy_denial','source-owner:student-paper-principal'],
  daily_search_principal_conflict:['policy_denial','source-owner:daily-search-principal'],
  result_list_missing_or_ambiguous:['malformed_response','source-owner:assessment-result-list'],
  daily_search_response_rejected:['malformed_response','source-owner:daily-search-response'],
  item_transport_failed:['upstream_unavailable','source-owner:item-answer-read'],
  item_answer_missing_or_schema_drift:['contract_drift','source-owner:item-answer-read'],
  item_answer_read_failed:['upstream_unavailable','source-owner:item-answer-read'],
  native_name_search_unqualified_no_automatic_retry:['malformed_response','src/native-dailyrecord-backend.ts:searchStudentsByName'],

  source_authentication_failed:['authentication','src/native-dailyrecord-backend.ts:#authenticate'],
  native_metadata_scope_refused:['policy_denial','src/native-dailyrecord-backend.ts:readStudentMetadata'],
  metadata_namespace_not_admitted:['policy_denial','src/native-dailyrecord-backend.ts:readStudentMetadataByName'],
  native_dailyrecord_scope_refused:['policy_denial','src/native-dailyrecord-backend.ts:readDailyRecord'],
  native_dated_name_ambiguous:['identity_ambiguity','src/native-dailyrecord-backend.ts:searchStudentsByName'],
  native_dated_name_scope_conflict:['contract_drift','src/native-dailyrecord-backend.ts:searchStudentsByName'],
  script_digest_drift:['contract_drift','source-owner:script-digest'],
  native_dailyrecord_identity_conflict:['contract_drift','src/native-dailyrecord-backend.ts:readDailyRecord'],
  native_dailyrecord_state_conflict:['contract_drift','src/native-dailyrecord-backend.ts:readDailyRecord'],
  native_metadata_row_identity_conflict:['contract_drift','src/native-dailyrecord-backend.ts:projectStudentMetadata'],
  native_metadata_period_conflict:['contract_drift','src/native-dailyrecord-backend.ts:projectStudentMetadata'],
  native_metadata_selector_conflict:['contract_drift','src/native-dailyrecord-backend.ts:projectStudentMetadata'],
  native_dailyrecord_occurrence_unverified:['partial_coverage','src/native-dailyrecord-backend.ts:readDailyRecord'],
  native_metadata_method_unavailable:['endpoint_absence','src/native-dailyrecord-backend.ts:readStudentMetadata'],
  unknown_tool:['endpoint_absence','src/neutral-server.ts:call'],
  release_pointer_missing:['contract_drift','src/neutral-server.ts:activeRelease'],
  release_upstream_admission_mismatch:['contract_drift','src/neutral-server.ts:call'],
  release_payload_unqualified:['contract_drift','src/runtime-release.ts:loadRuntimeRelease'],
  release_endpoint_identity_mismatch:['contract_drift','src/runtime-release.ts:verifyEndpointIdentity'],
  release_bridge_identity_mismatch:['contract_drift','src/runtime-release.ts:loadRuntimeRelease'],
  release_artifact_mismatch:['contract_drift','src/runtime-release.ts:verifyReleaseArtifacts'],
  release_pointer_changed:['contract_drift','src/runtime-release.ts:readPointer'],
  release_base_unqualified:['policy_denial','src/runtime-release.ts:readPointer'],
  release_pointer_unqualified:['policy_denial','src/runtime-release.ts:readPointer'],
  label_snapshot_hash_mismatch:['contract_drift','src/item-label-store.ts:readPinnedLocalBytes'],
  observation_ticket_expired_or_foreign:['policy_denial','src/neutral-server.ts:call'],
  fresh_before_state_changed_reconcile:['contract_drift','src/neutral-server.ts:call'],
  dailyrecord_route_upstream_failed_no_retry:['upstream_unavailable','src/neutral-server.ts:call'],
} as const satisfies Record<string,readonly [ReadFailureCategory,string]>;
export class AcademyReadFailure extends Error {
  constructor(readonly category:ReadFailureCategory,readonly code:string,readonly evidenceLocator:string){super(code);}
}
export type ReleaseBaseFailureReason='relative_path'|'noncanonical_path'|'not_directory'|'writable_by_others'|'owner_mismatch';
export class ReleaseBaseUnqualified extends Error {
  constructor(readonly reason:ReleaseBaseFailureReason){super('release_base_unqualified');}
}
/** Public error text is a finite domain catalog, never an upstream message pattern. */
export function publicReadFailure(error:unknown,fallback='source_read_unavailable'){
  if(error instanceof ReleaseBaseUnqualified)
    return {category:'policy_denial' as const,code:'release_base_unqualified' as const,evidenceLocator:catalog.release_base_unqualified[1],automaticRetryAllowed:false as const,reason:error.reason};
  if(error instanceof AcademyReadFailure && error.code==='source_authentication_failed')
    return {category:'authentication' as const,code:error.code,evidenceLocator:catalog.source_authentication_failed[1],automaticRetryAllowed:false as const};
  if(error instanceof z.ZodError || error instanceof SyntaxError)
    return {category:'malformed_response' as const,code:'source_response_malformed',evidenceLocator:'academy-mcp:response-contract',automaticRetryAllowed:false as const};
  const code=error instanceof Error&&Object.hasOwn(catalog,error.message)?error.message as keyof typeof catalog:null;
  return code?{category:catalog[code][0],code,evidenceLocator:catalog[code][1],automaticRetryAllowed:false as const}:
    {category:'upstream_unavailable' as const,code:fallback,evidenceLocator:'academy-mcp:owner-read-boundary',automaticRetryAllowed:false as const};
}
export function readFailureResult(error:unknown,fallback:string){
  const failure=publicReadFailure(error,fallback);return {reasonCode:failure.code,failure};
}

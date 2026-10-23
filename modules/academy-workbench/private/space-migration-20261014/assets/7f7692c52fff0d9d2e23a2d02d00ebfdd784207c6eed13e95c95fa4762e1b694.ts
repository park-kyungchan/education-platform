/** Non-sensitive reconciliation contract. Source datasets remain immutable. */
export type BindingStatus = 'candidate' | 'composite_supported' | 'authoritatively_verified' | 'conflicted' | 'unmatched' | 'rejected';
export interface EvidenceReference { kind: 'source_record' | 'published_record' | 'task_scope' | 'user_decision'; documentSha256: string | null; pointerOrMessageId: string; }
export interface IdentityScope { authority: string; tenant: string; namespace: string; stableNonReused: boolean; }
export interface NativeIdentity { value: string; scope: IdentityScope; canonicalAssociationDocumented: boolean; }
export interface BookClaim { key: string | null; series: string; school: string | null; grade: number | null; semester: number | null; volume: number | null; version: string | null; }
export interface StudentFacts { id: string; label: string; nativeIdentity: NativeIdentity | null; books: BookClaim[]; groups: string[]; }
export interface BindingContext { userDesignatedClosedPopulation: boolean; sameRoster: boolean; snapshotSha256: string; registrySha256: string; sourceScopeRef: EvidenceReference; }
export interface PairSupport { exactBookKeys: number; partialBookMatches: number; matchedKnownBooks: number; knownBooks: number; missingKnownBooks: number; matchedGroups: number; knownGroups: number; groupDisagreement: boolean; }
export interface LocalIdentityResolution {
  id: string; rulesVersion: '1.0.0'; snapshotStudentId: string;
  candidateCanonicalStudentIds: string[]; resolvedCanonicalStudentId: string | null;
  status: BindingStatus; method: 'composite_evidence_local_binding' | 'scoped_authoritative_id' | null;
  confidence: 'supported_within_user_designated_population' | 'authoritative' | 'insufficient' | 'conflicting';
  scope: { snapshotSha256: string; registrySha256: string; crossSnapshotReuse: false };
  support: PairSupport | null; reasons: string[]; evidence: EvidenceReference[];
  nativeIdVerified: boolean; sourceIdentityMutated: false; publicationAuthorizedByThisRecord: false;
}
export interface IncrementalComparison {
  comparisonKind: 'observation_inventory_only'; sourceSnapshotSha256: string; baselineSha256: string;
  locallySupportedStudents: number; blockedStudents: number;
  sourceCounts: Record<string, number>; detailEventDelta: null;
  detailEventDeltaReason: 'baseline_is_summary_and_native_event_ids_absent';
  deletionsProposed: 0; completionClaimsAdded: 0; historyCompletenessPromoted: false;
}

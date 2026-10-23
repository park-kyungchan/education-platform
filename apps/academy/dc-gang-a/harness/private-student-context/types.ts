/** Private evidence transfer only; not a production write API. */
export type ProvenanceKind = 'user_report' | 'space_snapshot' | 'historical_artifact' | 'derived_view' | 'schema';
export type Coverage = 'complete_for_declared_scope' | 'partial' | 'unknown';
export interface Artifact {
  /** Relative to the fixed dated package; never a remote URL or absolute path. */
  path: string;
  sha256: string;
  bytes: number;
  provenanceKind: ProvenanceKind;
  sourceReferences: string[];
  coverage: Coverage;
}
export interface PrivateStudentManifest {
  schemaVersion: 'academy.private-student-context/1.0';
  dataClass: 'real_student_evidence';
  asOf: string;
  timezone: 'Asia/Seoul';
  publication: {
    repository: 'park-kyungchan/dc-gang-a';
    visibility: 'private';
    mergeAllowed: false;
    productionMutation: false;
    syntheticReplacement: false;
    authorizationMessageIds: string[];
  };
  artifacts: Artifact[];
  /** Coverage gaps never become fabricated facts or completed retrievals. */
  limitations: string[];
}

/** Compatibility lane with gang-a academy.evidence/2.0.1, not a copied owner. */
export interface EvidenceCompatibility {
  sourceSchema: 'academy.evidence/2.0.1';
  sourceKind: 'user_report' | 'imported_snapshot' | 'direct_lms_observation' | 'inference';
  sourceMessageId: string | null;
  reportedAt: string | null;
  reportedEventAt: string | null;
  observedAt: string | null;
  capturedAt: string | null;
  nativeStudentBinding: 'verified' | 'unresolved';
  nativeStudentId: string | null;
  conversionStatus: 'not_converted' | 'requires_owner_schema_validation';
}

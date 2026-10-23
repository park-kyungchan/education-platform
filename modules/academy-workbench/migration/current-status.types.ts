/** Additive documentation contract; grants no execution authority. */
export type GateId = "real_data" | "credential_setup" | "private_storage" | "recovery" | "hosting" | "scope_parity" | "release_hash";
export interface Source { id: string; path: string; commit: string; checkedAt: string; url: string; meaning: string; }
export interface ResolvedScope { id: string; domain: string; status: "resolved"; claim: string; sourceIds: string[]; nextVerification: string[]; }
export interface OpenGate { id: GateId; domain: string; status: "open"; requirement: string; dependencies: GateId[]; next: string[]; sourceIds: string[]; }
export interface CurrentStatus {
  $schema: "./current-status.schema.json";
  schemaVersion: "academy.current-migration-status/1";
  checkedAt: string; sourceCommit: string;
  authority: { grantsActionPermission: false; containsStudentValues: false; containsCredentials: false; runtimeModified: false; };
  precedence: { currentEntry: string; historicalEntry: string; rule: string; supersededHistoricalClaims: { id: string; resolvedScope: string; }[]; };
  sources: Source[]; resolvedScopes: ResolvedScope[]; remainingGates: OpenGate[];
  boundaries: { realDataRuntimeActivated: false; operationalAuthConfigured: false; externalHostingSupported: false; sourceLiveRefreshIntegrated: false; sourceDeletionEligible: false; sourceCompletenessVerified: false; };
  coverageLimits: string[];
  verification: { performed: string[]; notPerformed: string[]; completionMeaning: string; };
}

/** Documentation contract only. This module grants no execution or data-sharing authority. */
export type Status = "failed" | "blocked" | "unverified" | "approval_pending" | "resolved";
export type Domain = "environments" | "auth" | "source-read" | "integration" | "privacy" | "deployment" | "migration";
export type ScopeClassification = "mandatory_gate" | "coverage_limit" | "conditional_research" | "resolved_scope" | "example_only";
export type InputKind = "none" | "tooling" | "artifact" | "implementation" | "evidence" | "decision";
export interface EvidenceReference {
  readonly sourceId: string;
  /** null means the exact source observation time is unknown; generatedAt must not fill it. */
  readonly observedAt: string | null;
  readonly observationMeaning: string;
  readonly jsonPointer?: string;
}
export interface AttemptedMethod {
  readonly method: string;
  readonly outcome: string;
  readonly evidenceSourceIds: readonly string[];
}
export interface AcceptanceCheck {
  readonly id: string;
  readonly criterion: string;
  readonly evidenceNeeded: string;
}
export interface LimitBase {
  readonly id: string;
  readonly domainPath: readonly [Domain, string];
  readonly title: string;
  readonly currentFact: string;
  readonly impactedGoals: readonly string[];
  /** Gate for the scoped project goal, not a claim that documentation cannot be delivered. */
  readonly requiredForCurrentDelivery: boolean;
  readonly scopeClassification: ScopeClassification;
  /** This limit requires each referenced limit. The overall prerequisite graph must be a DAG. */
  readonly dependencies: readonly string[];
  readonly evidence: readonly EvidenceReference[];
  readonly attemptedMethods: readonly AttemptedMethod[];
  readonly whatNotToRetry: readonly string[];
  readonly smallestRequiredInput: { readonly kind: InputKind; readonly description: string };
  readonly acceptanceChecks: readonly AcceptanceCheck[];
  readonly ownership: { readonly accountableRole: string; readonly supportingRoles: readonly string[] };
  readonly nextSafeAction: string;
}
export type FailedLimit = LimitBase & {
  readonly status: "failed";
  readonly failure: { readonly stage: string; readonly code: string; readonly retryPolicy: string; readonly taskId?: string };
};
export type BlockedLimit = LimitBase & {
  readonly status: "blocked";
  readonly blocker: { readonly kind: "missing_prerequisite" | "not_implemented" | "privacy_boundary" | "release_gate"; readonly reason: string };
};
export type UnverifiedLimit = LimitBase & {
  readonly status: "unverified";
  readonly verification: { readonly claimToEstablish: string; readonly currentEvidenceInsufficientBecause: string };
};
export type ApprovalPendingLimit = LimitBase & {
  readonly status: "approval_pending";
  readonly approval: {
    readonly action: string;
    readonly target: string;
    readonly requestedAt: string | null;
    readonly approvalState: "not_granted";
    readonly executeUntilApproved: false;
  };
};
export type ResolvedLimit = LimitBase & {
  readonly status: "resolved";
  readonly resolution: { readonly resolvedScope: string; readonly remainingLimits: readonly string[] };
};
export type HardLimit = FailedLimit | BlockedLimit | UnverifiedLimit | ApprovalPendingLimit | ResolvedLimit;
export interface WorkflowCycle {
  readonly id: string;
  readonly purpose: string;
  readonly stages: readonly string[];
  readonly transitions: readonly { readonly from: string; readonly to: string }[];
  readonly executionEnabled: false;
}
export interface HardLimitRegistry {
  readonly $schema: "./hardlimits.schema.json";
  readonly schemaVersion: "1.0.0";
  readonly generatedAt: string;
  readonly artifactKind: "sanitized_handoff_documentation" | "synthetic_schema_example";
  readonly intendedRepository: "park-kyungchan/academy-workbench";
  readonly repositoryVisibilityRequired: "private";
  readonly authority: {
    readonly grantsActionPermission: false;
    readonly historicalPermissionsAreCurrentGrants: false;
    readonly sourceFilesEmbedded: false;
    readonly studentValuesEmbedded: false;
    readonly credentialValuesEmbedded: false;
    readonly writesPerformedByThisArtifact: false;
  };
  readonly currentState: {
    readonly sites: { readonly productionVersion: number; readonly productionCommit: string; readonly storedCandidateVersion: number; readonly storedCandidateCommit: string; readonly candidateDeployed: boolean; readonly rollbackVersion: number };
    readonly coverageAxes: { readonly officialUiReadSupportedCatalogEntries: number; readonly historicalCatalogEntries: number; readonly observedMenuEntries: number; readonly independentlyActivatedProductionSourceApiAdapters: number; readonly siteLiveSourceRefreshIntegrated: boolean; readonly uiReadMeaning: string };
    readonly qa: { readonly responsiveChromiumWidthsPassed: readonly number[]; readonly actualMobileDeviceVerified: boolean; readonly safariTouchVerified: boolean; readonly fullWcagAuditVerified: boolean; readonly nativeWebMcpVerified: boolean; readonly actualDeviceIsAdditionalMandatoryGate: false };
    readonly pilotAudience: "owner_only";
    readonly evidenceCutoff: string;
  };
  readonly goals: readonly { readonly id: string; readonly description: string }[];
  readonly domainHierarchy: readonly { readonly id: Domain; readonly children: readonly string[] }[];
  readonly statusSemantics: Readonly<Record<Status, string>>;
  readonly limits: readonly HardLimit[];
  readonly dependencyGraph: { readonly semantics: string; readonly edges: readonly { readonly from: string; readonly to: string; readonly relation: "requires" }[] };
  /** Workflow loops are intentionally separate from prerequisite dependencies. */
  readonly workflowCycles: readonly WorkflowCycle[];
  readonly evidenceManifest: "./evidence-manifest.json";
}
export interface SourceEvidenceBase {
  readonly id: string;
  readonly observedAt: string | null;
  readonly recordedAt: string;
  readonly timeMeaning: string;
  readonly scope: string;
}
export interface FileHashReference extends SourceEvidenceBase {
  readonly kind: "file_hash_reference";
  readonly relativePath: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly exportDisposition: "reference_only_source_contents_excluded";
}
export interface ReportedEvidence extends SourceEvidenceBase {
  readonly kind: "reported_status" | "reported_scope";
  readonly exportDisposition: "sanitized_summary_only";
  readonly facts?: Readonly<Record<string, string | number | boolean | null>>;
}
export interface EvidenceManifest {
  readonly schemaVersion: "1.0.0";
  readonly generatedAt: string;
  readonly purpose: string;
  readonly sourceFilesEmbedded: false;
  readonly historicalEvidenceIsAuthorization: false;
  readonly sources: readonly (FileHashReference | ReportedEvidence)[];
}
/** Consumers must switch on status, not assume every entry is a failed execution. */
export function statusReason(limit: HardLimit): string {
  switch (limit.status) {
    case "failed": return `${limit.failure.stage}: ${limit.failure.code}`;
    case "blocked": return limit.blocker.reason;
    case "unverified": return limit.verification.currentEvidenceInsufficientBecause;
    case "approval_pending": return `Pending: ${limit.approval.action} / ${limit.approval.target}`;
    case "resolved": return limit.resolution.resolvedScope;
    default: { const exhaustive: never = limit; return exhaustive; }
  }
}

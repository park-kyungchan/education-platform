/** Local module semantics. Shared Artifact and Work contracts are imported, never reproduced. */
import type { Artifact, ProjectArtifact, TaskArtifact, RunArtifact, DecisionArtifact, EvidenceArtifact, VerificationArtifact } from '@agent-platform/ontology-types';
import type { ContinuityCheckpoint, CompletedEffect, PendingTask } from '@agent-platform/work-context-types';
export type { Artifact, ProjectArtifact, TaskArtifact, RunArtifact, DecisionArtifact, EvidenceArtifact, VerificationArtifact, ContinuityCheckpoint, CompletedEffect, PendingTask };

export interface ModuleManifest {
  schemaVersion: 'academy.consumer-module/1';
  moduleId: 'academy-workbench';
  projectRef: string;
  canonicalDependency: { lockPath: 'harness/agent-platform.lock.json'; consumption: 'pinned-source'; copiedImplementation: false };
  registration: { status: 'local-module-record'; globallyRegistered: false; centralIssuer: 'not-established' };
  surfaces: { runtime: 'app/standalone'; offlineAdapter: 'app/offline-import-adapter'; userContext: 'context/business-decisions.json'; historicalGates: 'migration/current-status.json'; selectedUserContext: 'context/user-context/records.json' };
  relationships: Array<{ moduleId: string; relation: 'uses-canonical-source' | 'research-context-only'; automaticDataTransfer: false }>;
  capability: BoundedCapability;
  acceptance: { status: 'not-observed'; inferredFromTests: false };
}
export interface BoundedCapability {
  profile: 'synthetic-offline-development';
  executionEnabled: false;
  authority: 'none';
  nativePermissionGranted: false;
  nativeRegistrationPerformed: false;
  allowedDevelopmentInputs: string[];
  liveStudentReadEnabled: false;
  sourceMutationEnabled: false;
  printEnabled: false;
  sendEnabled: false;
  credentialSetupEnabled: false;
  deploymentEnabled: false;
}
/** A classification overlay, not a replacement for original typed evidence or an authority source. */
export type ContextClass = 'intent' | 'decision' | 'proposal' | 'evidence' | 'verification' | 'acceptance';
export interface ContextReference {
  kind: ContextClass;
  sourcePath: string;
  sourceLocator: string;
  provenance: 'actual-user-answer' | 'generalized-handoff-summary' | 'observation' | 'synthetic-example';
  artifactId?: string;
  executionAuthority: 'none';
}
export interface EffectLedger {
  completed: CompletedEffect[];
  pending: PendingTask[];
  uncertainEffects: ContinuityCheckpoint['uncertainEffects'];
  uninterpretedInputs: ContinuityCheckpoint['uninterpretedInputs'];
}

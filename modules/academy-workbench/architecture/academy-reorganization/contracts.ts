// Architecture-local types. Canonical identity and operational state remain imported owner types.
// This absolute locator is an external source-audit dependency, not an Academy consumer pin upgrade.
import type {LogicalIdentity, TaskOperationalState} from '/home/palantirkc/projects/agent-platform/packages/work-continuity/src/git-work/types.ts';

export interface ArchitectureWork {
  id: string;
  domainId: LogicalIdentity['domainId'];
  projectId: LogicalIdentity['projectId'];
  issueId: LogicalIdentity['issueId'];
  specRef: string;
  planRef: string;
  accountableSubLead: string | null;
  role: string;
  registration: 'local-canonical-record-created' | 'proposed-not-created';
  tabId: string | null;
  nativeSessionId: string | null;
  assignmentStatus: 'observed-current' | 'unassigned-proposal';
}
export interface OutcomeNode {
  id: string;
  workId: string;
  outcome: string;
  dependsOn: string[];
  accountableRole: string;
  writeScope: string;
  state: 'source-preparation' | 'awaiting-approval';
  milestone: 'execution-and-verification' | 'actual-user-approval';
  actualNativeOccurrence: null;
}
export interface ModuleBoundary {
  id: string;
  repository: string;
  path: string;
  responsibility: string;
  observedState: string;
  boundary: string;
}
export interface DependencyEdge {from: string; to: string; type: string}
export interface InfrastructureNode {
  id: string;
  type: 'host' | 'container' | 'native-runtime' | 'native-working-tree' | 'repository' | 'git-worktree' | 'installed-executable';
  owner: string;
}
export interface InfrastructureEdge {
  from: string;
  to: string;
  relation: 'hosts' | 'contains-runtime' | 'contains-working-tree' | 'hosts-source-checkout' | 'worktree-of' | 'contains-installed-executable';
  qualification: string;
}
export interface ReviewAssignment {
  logicalWorkId: string;
  taskRef: LogicalIdentity['taskId'];
  role: 'independent-architecture-reviewer';
  requestedCLI: 'codex';
  requestedModel: 'gpt-6-astra';
  requestedEffort: 'xhigh';
  tabId: null;
  paneId: null;
  nativeSessionId: null;
  launchState: 'not-launched-awaiting-architecture-approval';
}
export interface CapabilityObservation {
  environmentId: 'codex' | 'antigravity' | 'muse' | 'claude' | 'grok-cli' | 'hermes-tui';
  host: string;
  nativeExecutable: string | null;
  declared: {herdrKind: string; herdrKindIsHarnessProof: false};
  implemented: {commonAdapter: string | null; missingMeaning: string};
  configured: {nativeInstallObserved: boolean; academyCommonHarnessAdoption: 'unknown'; credentialsInspected: false};
  behaviorallyVerified: {thisSurvey: string; priorEvidence: string; actualWorkTurn: null};
  gap: string;
  nextWork: string;
  dispatchEligible: string;
}
export interface ArchitecturePacket {
  modules: ModuleBoundary[];
  dependencyEdges: DependencyEdge[];
  works: ArchitectureWork[];
  nodes: OutcomeNode[];
  reviewer: ReviewAssignment;
  capabilities: CapabilityObservation[];
}
export interface DispatchReceiptDesign {
  logical: LogicalIdentity;
  accountableRole: string;
  cli: string;
  requestedModel: string | null;
  requestedEffort: string | null;
  observedModel: string | null;
  observedEffort: string | null;
  exactCommit: string;
  exactTree: string;
  ownedPaths: string[];
  forbiddenEffects: string[];
  dependenciesQualifiedBy: string[];
  nativeSessionId: string | null;
  nativeInvocationId: string | null;
  herdrTabId: string | null;
  herdrPaneId: string | null;
  resultLocator: string;
  operationalState: TaskOperationalState;
}

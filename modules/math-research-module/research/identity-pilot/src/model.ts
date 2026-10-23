/** Module-owned semantic contract. Does not alter the shared Artifact envelope. */
export const TYPE_LAYER = {
  concept_family: 'DATA', atomic_concept: 'DATA', contextual_unit: 'DATA', source_document: 'DATA', item: 'DATA', observation: 'DATA',
  reasoning_family: 'LOGIC', evidence_claim: 'LOGIC', capability_hypothesis: 'LOGIC', strategy_hypothesis: 'LOGIC', diagnostic_rule: 'LOGIC',
  action_family: 'ACTION', action_definition: 'ACTION', probe_definition: 'ACTION', action_event: 'ACTION', teacher_action: 'ACTION', system_action: 'ACTION',
  governance_family: 'GOVERNANCE', source_claim: 'GOVERNANCE', provenance_record: 'GOVERNANCE', review_record: 'GOVERNANCE', acceptance_record: 'GOVERNANCE', authorization_policy: 'GOVERNANCE',
} as const;
export type EntityType = keyof typeof TYPE_LAYER;
export type Layer = typeof TYPE_LAYER[EntityType];
export type Json = null | string | number | boolean | Json[] | { [key: string]: Json };
export interface Ref { id: string; version: number }
export interface Core {
  statement: string;
  epistemicStatus: 'definition' | 'observed' | 'reported' | 'inference' | 'hypothesis' | 'rule' | 'pending' | 'recorded';
  evidenceRefs: Ref[];
  sourceRefs: Ref[];
  targetRefs: Ref[];
  probeRefs: Ref[];
  limitations: string[];
  synthetic: boolean;
  details: { [key: string]: Json };
}
export interface Revision {
  id: string;
  version: number;
  layer: Layer;
  type: EntityType;
  classification: { label: string; semanticPath: string[] };
  core: Core;
  semanticCoreHash: string;
  revisionHash: string;
}
export const FAMILIES: EntityType[] = ['concept_family', 'reasoning_family', 'action_family', 'governance_family'];
export const DEFINITIONS: EntityType[] = ['atomic_concept', 'contextual_unit', 'action_definition', 'probe_definition'];
const CLAIMS: EntityType[] = ['evidence_claim', 'capability_hypothesis', 'strategy_hypothesis', 'source_claim'];
const EVIDENCE: EntityType[] = ['observation', 'evidence_claim', 'source_claim'];
const ALL = Object.keys(TYPE_LAYER) as EntityType[];
export const EDGE_RULES = {
  is_a: { domain: [...FAMILIES, ...DEFINITIONS, 'capability_hypothesis', 'strategy_hypothesis', 'diagnostic_rule', 'authorization_policy'] as EntityType[], range: FAMILIES, sameLayer: true, dag: 'strict-parent' },
  part_of: { domain: ALL, range: [...FAMILIES, 'contextual_unit'] as EntityType[], sameLayer: true, dag: 'strict-parent' },
  prerequisite: { domain: [...DEFINITIONS, 'capability_hypothesis', 'strategy_hypothesis'] as EntityType[], range: [...DEFINITIONS, 'capability_hypothesis', 'strategy_hypothesis'] as EntityType[], sameLayer: false, dag: 'prerequisite' },
  uses: { domain: ALL, range: ALL, sameLayer: false, dag: null },
  observes: { domain: ['observation'] as EntityType[], range: ['item', 'action_event', 'teacher_action', 'system_action'] as EntityType[], sameLayer: false, dag: null },
  supports: { domain: EVIDENCE, range: CLAIMS, sameLayer: false, dag: null },
  refutes: { domain: EVIDENCE, range: CLAIMS, sameLayer: false, dag: null },
  probes: { domain: ['probe_definition'] as EntityType[], range: ['capability_hypothesis', 'strategy_hypothesis'] as EntityType[], sameLayer: false, dag: null },
  instance_of: { domain: ['action_event', 'teacher_action', 'system_action'] as EntityType[], range: ['action_definition', 'probe_definition'] as EntityType[], sameLayer: false, dag: null },
  derived_from: { domain: ['source_claim', 'provenance_record', 'evidence_claim'] as EntityType[], range: ['source_document', 'observation', 'source_claim'] as EntityType[], sameLayer: false, dag: null },
} as const;
export type Relation = keyof typeof EDGE_RULES;
export interface Edge { id: string; relation: Relation; from: Ref; to: Ref }
export type HarnessKind = 'project' | 'task' | 'proposal' | 'decision' | 'evidence' | 'verification' | 'run';
/** A source-pinned reference catalog, not a second Artifact implementation. */
export interface HarnessRecord {
  id: string; projectId: string; kind: HarnessKind; sourcePath: string; sourceSha256: string;
}
export interface WorkContextRef { projectId: string; workId: string; sourcePath: string; sourceSha256: string }
export interface Crosswalk {
  relation: 'createdBy' | 'uses' | 'verifiedBy' | 'acceptedBy';
  research: Ref; harnessArtifactId: string;
}
export interface Presentation {
  id: string; subject: Ref; semanticCoreHash: string;
  renderMode: 'exact-core'; tone: 'neutral' | 'teacher-warm' | 'teacher-concise';
  language: 'ko';
}
export interface Bundle {
  schemaVersion: '0.1.0-pilot'; semanticOwner: 'math-research-module';
  namespace: 'mred'; registryScope: 'module-local-pilot';
  coverage: { fixtureCount: number; realLearnersDiagnosed: 0; full105TypesDiagnosed: false };
  authority: { nativePermissionGranted: false; actualAcceptanceInferred: false; grantsExecution: false };
  revisions: Revision[]; edges: Edge[]; presentations: Presentation[];
  harnessRecords: HarnessRecord[]; workContexts: WorkContextRef[]; crosswalk: Crosswalk[];
}
export interface Issue { code: string; path: string; message: string }

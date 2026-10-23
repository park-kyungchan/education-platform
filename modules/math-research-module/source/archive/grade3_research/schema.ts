/** Portable research schema. No renderer and no student-state assumptions. */
export type EvidenceStatus =
  | 'publisher-aligned'
  | 'organizational-proposal'
  | 'proposed-original'
  | 'pedagogical-inference';
export type Relation = 'essential' | 'helpful' | 'recommended-order' | 'application';
export type NodeKind = 'root' | 'unit' | 'content' | 'prerequisite-summary' | 'problem-type';
export interface ExampleVariant {
  id: string;
  title: string;
  contentIds: string[];
  exampleAndAnswer: string;
  diagnosticNotes: string;
  evidenceStatus: EvidenceStatus;
}
export interface CurriculumNode {
  id: string;
  title: string;
  /** Structural containment only. Never read as a prerequisite edge. */
  parentId: string | null;
  kind: NodeKind;
  evidenceStatus: EvidenceStatus;
  contentIds?: string[];
  exampleAndAnswer?: string;
  diagnosticNotes?: string;
  variants?: ExampleVariant[];
  standardIds?: string[];
  sourceIds?: string[];
  alignmentNote?: string;
}
export interface PrerequisiteEdge {
  id: string;
  source: string;
  target: string;
  relation: Relation;
  evidenceStatus: 'pedagogical-inference';
  reason: string;
  /** Preconditions apply only to this method or task condition, never a mastery lock. */
  scopeCondition?: string;
}
export interface ResearchGraph {
  version: string;
  verifiedAt: string;
  scope: string;
  sources: {id: string; url: string; role: string}[];
  counts: {coreProblemTypes: number; illustrativeVariants: number};
  nodes: CurriculumNode[];
  prerequisiteEdges: PrerequisiteEdge[];
  notes: string[];
  tagDimensions: Record<string, string[]>;
}

export interface ConnectedContentNode {
  id: string;
  title: string;
  parentId: null;
  kind: 'connected-content';
  connectionRole: 'core-related' | 'boundary-support';
  standardIds: string[];
  officialGradeBand: '3~4' | '5~6';
  observedPlacement: string;
  placementStatus: 'grade-band-only' | 'verified-official-example-not-national-mandate';
  sourceIds: string[];
  evidenceStatus: 'curriculum-aligned';
  scopeNote: string;
}
export interface ConnectedResearchGraph {
  version: string;
  verifiedAt: string;
  scope: string;
  externalNodeIds: string[];
  sources: {id: string; url: string; role: string; pages?: string}[];
  nodes: ConnectedContentNode[];
  edges: PrerequisiteEdge[];
  notes: string[];
}

export interface FourLevelNode {
  id: string;
  title: string;
  parentId: string | null;
  level: '대단원' | '중단원' | '소단원' | '세부단원';
  originalContentIds: string[];
  evidenceStatus: 'organizational-proposal';
  note: string;
}
export interface FourLevelHierarchy {
  version: string;
  status: string;
  levels: string[];
  nodes: FourLevelNode[];
  typeLinks: {typeId: string; detailContentIds: string[]; relation: 'task-applies-to-content'}[];
  proposedRevisions: string[];
  notes: string[];
  contentCrossLinks: {source: string; target: string; relation: 'also-applies-to'; note: string}[];
}
export interface UpperProblemType {
  id: string;
  parentId: string;
  kind: 'problem-type';
  title: string;
  example: string;
  answer: string;
  diagnosticNotes: string;
  reusedCoreTypeIds: string[];
  conditionTags: string[];
  evidenceStatus: 'proposed-original';
  sourceIds: string[];
  alignmentNote: string;
}
export interface UpperProblemCatalog {
  version: string;
  scope: string;
  types: UpperProblemType[];
  notes: string[];
}

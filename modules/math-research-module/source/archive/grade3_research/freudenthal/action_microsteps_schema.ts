/** Project-authored observation/design schema, not a validated scale or a fixed developmental sequence. */
export type PsychologySourceId = 'IES21' | 'IES07' | 'RJ06' | 'SC85' | 'RAMS02';
export type EvidenceRelation = 'official_recommendation' | 'primary_study_finding' | 'project_application_inference';
export interface MicroAction {
  id: string;
  phase: 'prerequisite' | 'orient' | 'represent' | 'execute' | 'connect' | 'explain' | 'check' | 'transfer';
  cue: string; // Exact short teacher/student-facing prompt; one principal demand.
  observableStudentAction: string; // Point, mark, move, write, choose, compare, or say a specified object/relation.
  expectedUnderstanding: string; // Hypothesized understanding, NOT direct mind-reading or observed learning.
  mathematicalPurpose: string; // Why THIS content/numeral/representation matters here.
  designIntent: string; // Why the cue/support and sequencing were selected.
  teacherCheck: { evidence: string; nonEvidence: string; nextDecision: string };
  likelyError: string;
  scaffold: string; // Contingent response to that error, not another full lecture.
  fading: { remove: string; readinessEvidence: string; restoreIf: string };
  separationReason: string; // Distinct decision, unit, representation, or diagnosable error boundary.
  evidence: { sourceId: PsychologySourceId; relation: EvidenceRelation; applicationInference: string }[];
  // Research versions may carry complex reasoning, but child execution must expose a bounded segment.
  childFacingSegment: string;
}
export interface ActionMicrostepDesign {
  subtypeId: string;
  status: 'research_design_unvalidated';
  example: { prompt: string; answer: string };
  prerequisites: { skill: string; quickCheck: string; ifNotReady: string }[];
  segmentation: { chunks: { label: string; actionIds: string[]; exitEvidence: string }[]; presentationRule: string };
  microActions: MicroAction[]; // Variable length. Never pad to a mandatory count.
  independentTransfer: { prompt: string; answer: string; evidenceToCollect: string; changedFeature: string };
  boundaryProbe: { prompt: string; answer: string; distinguishes: string };
  interpretationLimits: string[];
}

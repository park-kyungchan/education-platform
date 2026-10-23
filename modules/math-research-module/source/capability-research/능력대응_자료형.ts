/** 연구용 데이터 교환 자료형. 실행 코드나 학생 진단 모형이 아니다. */
export type EvidenceLevel =
  | 'related_construct_directly_studied'
  | 'theoretical_or_synthesis_support'
  | 'project_task_analysis'
  | 'abstract_or_summary_only';
export interface CapabilityCandidate {
  id: string;
  name: string;
  layer: '수학적 구조 능력 후보' | '횡단적 관찰 차원';
  definition: string;
  subskills: string[];
  observable: string;
  boundary: string;
  representativeTypeIds: string[];
  allMappedTypeIds: string[];
  mappedCount: number;
  status: string;
  literatureCrosswalk?: unknown;
}
export interface TypeCapabilityMapping {
  typeId: string;
  title: string;
  structuralCandidateIds: string[];
  explicitProcessProbeIds: string[];
  originalPrompt: string;
  originalAnswer: string;
  designTarget: string;
  designPrompt: string;
  evidenceScope: 'task_content_and_authored_design_only_no_student_observation';
  interpretation: string;
}
export interface ResearchCapabilityReport {
  status: string;
  scope: {
    detailTypeCount: 105;
    domainCounts: { HM: 38; HD: 36; HC: 31 };
    structuralCandidateCount: 22;
    crossCuttingObservationDimensionCount: 6;
    scopeWarning: string;
  };
  abilities: CapabilityCandidate[];
  mapping: TypeCapabilityMapping[];
  literatureStatus: string;
  sources: string[];
  additionalCandidateRequiringTaskSampling: unknown;
  literatureReview?: unknown;
}

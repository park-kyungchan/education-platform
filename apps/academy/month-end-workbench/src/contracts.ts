/** Browser-safe domain contracts. Research identity belongs to math-research-module;
 * Academy pat_no and lecture_key are separate native namespaces. No Artifact validator is forked here. */
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export const SOURCE_REVISION = '07edb2dea2e5997aea4318f0fa2efa21dde633df';
export type SourceMode = 'unavailable' | 'synthetic' | 'native-readonly';
export interface SourceRef { owner: string; revision: string; path: string; sha256: string; pointer: string }
export interface ResearchUnit { id: string; title: string; parentId: string | null; level: string; originalContentIds?: string[]; evidenceStatus: string; source: SourceRef }
export interface Example { id: string; typeId: string; kind: 'basic' | 'variant'; prompt: string; answer: string; source: SourceRef }
export interface ResearchType { id: string; title: string; detailId: string; scope: 'grade3' | 'upper'; original: Record<string, Json>; examples: Example[]; source: SourceRef }
export interface ResearchDesign { typeId: string; original: Record<string, Json>; source: SourceRef; microsteps: Microstep[] }
export interface Microstep { id: string; typeId: string; original: Record<string, Json>; source: SourceRef }
export interface ResearchLink { relation: 'contains' | 'type-membership' | 'prerequisite' | 'literature-evidence' | 'review-of' | 'capability-hypothesis' | 'content-connection'; originalRelation?: string; rationale?: string; scopeCondition?: string; from: string; to: string; source: SourceRef; status: 'original-research' | 'proposal' }
export interface Projection {
  schema: 'month-end.research-projection.v1'; owner: 'math-research-module'; revision: string;
  authority: { nativePermissionGranted: false; actualAcceptanceInferred: false; grantsExecution: false };
  manifest: { path: string; sha256: string }[];
  contentObjects: Record<string, Json>[]; units: ResearchUnit[]; types: ResearchType[]; designs: ResearchDesign[]; links: ResearchLink[];
  sources: Record<string, Json>[]; capabilityResearch: Record<string, Json>; identityPilot: Record<string, Json>; assessmentResearch: Record<string, Json>;
  warnings: { id: string; typeId: string; status: 'proposed_not_applied'; title: string; conclusion: string; source: SourceRef }[];
  coverage: { grade3Types: number; upperTypes: number; basicExamples: number; variantExamples: number; designs: number; microsteps: number; archiveBlobs: number };
}
export interface StudyScope { researchTypeIds: string[]; researchRevision: string; edition: string | null; unit: string | null }
export type ComparisonAxis = 'structure' | 'reasoning' | 'representation' | 'conditions' | 'errors' | 'transfer';
export interface StudyReport { scope: StudyScope; studied: boolean; summary: string; evidenceNotes: string[]; attribution: 'teacher-reported'; acceptance: false }
export interface DesiredQuestionIntent { axes: Record<ComparisonAxis, string>; notes: string }
export interface SourceContext { owner: string; sourceRevision: string; scopeId: string; edition: string | null; unit: string | null; observationHash?: string; sourceHandle?: string; observedAt?: string; revisionMeaning?: string }
export interface AcademyCategory { id: string; parentId: string | null; name: string; level: string; nativeScope?: {cl1:number;cl2:number;cl3:number;cl4:number}; depth?:number; isLazy?:boolean; isFolder?:boolean; canReadLabels?:boolean|null }
export interface AcademyTypeLabel { pat_no: string; name: string; categoryId: string; sourceRevision: string; questionCount: number | null }
export interface AcademyQuestion { lecture_key: string; pat_no: string; sourceRevision: string; metadata: Record<string, Json>; answer: string | null; preview: { state: 'available' | 'unavailable' | 'held'; url: string | null }; q_code?: string | null; paperKey?: string | null }
export interface SourceScopeRequest { context: SourceContext | null; view?: 'hierarchy' | 'labels'; hierarchyId?: string; parentId?: string | null; offset?: number; limit?: number }
export interface SourceScopeResult { mode: SourceMode; availability: 'available' | 'unavailable' | 'held'; context: SourceContext | null; categories: AcademyCategory[]; labels: AcademyTypeLabel[]; limitations: string[]; nextOffset?: number | null; sourceEvidence?: Json }
export interface SourceFindRequest { context: SourceContext; study: StudyReport; intent: DesiredQuestionIntent; query: string; categoryId: string | null; limit: number }
export interface AxisEvidence { axis: ComparisonAxis; state: 'unknown' | 'evidenced' | 'conflicting'; note: string; sourceRefs: SourceRef[] }
export interface AlignmentCandidate { label: AcademyTypeLabel; retrieval: 'lexical-only' | 'inspected-evidence'; lexicalTerms: string[]; axes: AxisEvidence[]; status: 'provisional' | 'held'; reasons: string[] }
export interface SourceFindResult { mode: SourceMode; context: SourceContext; candidates: AlignmentCandidate[]; limitations: string[] }
export interface SourceReviewRequest { context: SourceContext; study: StudyReport; intent: DesiredQuestionIntent; pat_no: string; cursor: string | null; limit: number }
export interface SourceReviewResult { mode: SourceMode; context: SourceContext; pat_no: string; questions: AcademyQuestion[]; nextCursor: string | null; limitations: string[] }
export interface SourcePort {
  readonly mode: SourceMode;
  close?(): Promise<void>;
  scope(request: SourceScopeRequest): Promise<SourceScopeResult>;
  find(request: SourceFindRequest): Promise<SourceFindResult>;
  review(request: SourceReviewRequest): Promise<SourceReviewResult>;
}
export interface QuestionRevisionRef { lecture_key:string; sourceRevision:string }
export type AlignmentJudgment = 'unknown' | 'supports' | 'conflicts';
export interface AlignmentAxisInput { state:AlignmentJudgment; note:string; questionRefs:QuestionRevisionRef[] }
export interface AlignmentProposalRequest { context:SourceContext; study:StudyReport; intent:DesiredQuestionIntent; pat_no:string; axes:Record<ComparisonAxis,AlignmentAxisInput> }
export interface AlignmentQuestionEvidence { question:QuestionRevisionRef; source:SourceRef; digestMeaning:'validated-question-projection-sha256'; contentScope:'returned-source-fields-only' }
export interface AlignmentProposal { id:string; status:'proposal_not_accepted'; attribution:'teacher-proposed'; acceptance:false; finalMembership:false; current:boolean; historicalReason:string|null; context:SourceContext; studyScope:StudyScope; intent:DesiredQuestionIntent; pat_no:string; researchRefs:SourceRef[]; inspectedQuestions:AlignmentQuestionEvidence[]; axes:Record<ComparisonAxis,{state:AlignmentJudgment;note:string;evidence:AlignmentQuestionEvidence[]}>; limitations:string[] }
export interface ApplicationState { scope: StudyScope; study: StudyReport | null; intent: DesiredQuestionIntent; sourceContext: SourceContext | null; alignmentProposals:AlignmentProposal[]; history: { kind: string; message: string; evidence?: Json }[] }
export interface ResearchDetail { type: ResearchType; design: ResearchDesign | null; links: ResearchLink[]; warnings: Projection['warnings']; capabilityMappings: Json[] }
export interface AssessmentContext {
  title: string; sourceRevision: string; sourceMode: SourceMode; constraints: { items: 24; points: 100; durationMinutes: 80; startTime: '15:00'; bands: { count: number; points: number }[]; deadline: '2026-10-19'; examDate: null; timezone: null; edition: null; unitInventory: null };
  limitations: string[]; stages: string[]; governance: { layer: string; children: string[]; crossesLayers: boolean }[]; coverage: Projection['coverage']; warnings: Projection['warnings'];
}

export interface NavigationResult { pathIds: string[]; levels: { level: string; parentId: string | null; siblings: ResearchUnit[]; selectedId: string | null }[]; types: ResearchType[] }
export interface Application {
 context(): Promise<AssessmentContext>; research(input: {typeId: string}): Promise<ResearchDetail>; navigate(pathIds: string[]): Promise<NavigationResult>;
 setScope(scope: StudyScope): Promise<ApplicationState>; study(report: StudyReport): Promise<ApplicationState>; intent(intent: DesiredQuestionIntent): Promise<ApplicationState>;
 sourceScope(request: SourceScopeRequest): Promise<SourceScopeResult>; find(request: SourceFindRequest): Promise<SourceFindResult>; review(request: SourceReviewRequest): Promise<SourceReviewResult>; alignmentProposal(request:AlignmentProposalRequest):Promise<AlignmentProposal>; snapshot(): ApplicationState;
}

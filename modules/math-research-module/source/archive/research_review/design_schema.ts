/** Project-authored operationalization, not a Freudenthal-authored rubric or validated instrument. */
export type SourceId = 'F78' | 'F83' | 'F91' | 'MP84';
export type Scope = 'grade3_core' | 'grade3_deepening' | 'grade4_6_connection';
export interface ParadigmaticDesign {
  subtypeId: string;
  status: 'paradigmatic_design_intent_unvalidated';
  attribution: 'project_authored_interpretation_not_freudenthal_endorsement';
  sourceIds: SourceId[];
  originalExample: { prompt: string; answer: string };
  revisedExample: { prompt: string; answer: string; solution: string[] };
  targetStructure: string;
  generalizationDomain: string;
  phenomenonToOrganize: string;
  designRationale: { context: string; numbers: string; conditions: string; representation: string; contrastWithAlternative: string };
  expectedStrategies: string[];
  anticipatedErrors: string[];
  invariant: string;
  transfer: { prompt: string; answer: string; preservedStructure: string };
  boundaryCase: { prompt: string; answer: string; changedCondition: string };
  adjacentTypeContrast: string;
  guidanceSequence: string[];
  scope: Scope;
  prerequisites: string[];
  grade4_6Connection?: string;
  observationPlan: string[];
  learningEffectClaim: 'hypothesis_not_observed';
}

export type DecisionKind = 'purpose' | 'business_rule' | 'output_rule' | 'scope';
export interface BusinessDecision { id:string; kind:DecisionKind; status:'active'; statement:string; implementationImplication:string; executionAuthority:'none'; }
export interface SanitizedBusinessDecisions { schemaVersion:'academy.sanitized-business-decisions/1.0.0'; preparedAt:string; purpose:string; authorityGranted:false; containsStudentData:false; provenanceMode:string; decisions:BusinessDecision[]; openQuestions:string[]; }

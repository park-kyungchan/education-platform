export type Evidence = 'yes'|'no'|'unknown';
export interface PrintRoute {printed:Evidence;teacherFinal:Evidence;}
export interface ClinicGateInput {
 kind:'clinic_pair';
 sourceAttemptScore:number|null;
 teacherSourceReview:Evidence;
 similarPrintQuestionAnswered:boolean;
 similar:PrintRoute;
 original:PrintRoute;
 teacherFinalForScope:Evidence;
 teacherRaisedValidityConcern:boolean;
 scopeConfirmation: 'explicit'|'ambiguous';
}
export interface ClinicGateProjection {
 originalApplicability:'not_applicable'|'potentially_applicable'|'unknown';
 similarApplicability:'teacher_decision_required';
 blockers:string[];
 overall:'blocked'|'teacher_final_confirmed_for_explicit_scope';
}
/** Projects explicit teacher evidence only; never authors a judgment or writes to LMS. */
export function projectClinicGate(x:ClinicGateInput):ClinicGateProjection {
 if(x.kind!=='clinic_pair')throw Error('clinic_gate_route_mismatch');
 if(x.sourceAttemptScore!==null&&(!Number.isFinite(x.sourceAttemptScore)||x.sourceAttemptScore<0||x.sourceAttemptScore>100))throw Error('invalid_score');
 const blockers:string[]=[];
 if(x.scopeConfirmation!=='explicit')blockers.push('clarify_teacher_activity_scope');
 if(x.sourceAttemptScore===null)blockers.push('source_attempt_applicability_unknown');
 if(x.sourceAttemptScore!==null&&x.sourceAttemptScore<100&&x.original.printed!=='yes')blockers.push('original_print_execution_unconfirmed');
 if(x.teacherSourceReview!=='yes')blockers.push('teacher_source_review_required');
 if(!x.similarPrintQuestionAnswered||x.similar.printed==='unknown')blockers.push('ask_teacher_whether_similar_clinic_printed');
 if(x.similar.printed==='yes'&&x.similar.teacherFinal!=='yes')blockers.push('similar_print_teacher_final_required');
 if(x.sourceAttemptScore!==100&&x.original.printed==='yes'&&x.original.teacherFinal!=='yes')blockers.push('original_print_teacher_final_required');
 if(x.teacherFinalForScope!=='yes')blockers.push('explicit_scoped_teacher_final_required');
 if(x.teacherRaisedValidityConcern)blockers.push('teacher_validity_review_unresolved');
 return {originalApplicability:x.sourceAttemptScore===100?'not_applicable':x.sourceAttemptScore===null?'unknown':'potentially_applicable',similarApplicability:'teacher_decision_required',blockers,overall:blockers.length?'blocked':'teacher_final_confirmed_for_explicit_scope'};
}

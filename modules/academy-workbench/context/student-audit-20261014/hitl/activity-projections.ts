/** Pure projections of supplied evidence. No teacher decisions, persistence or LMS writes. */
export interface ActivityScope { studentId:string; activityId:string; }
export interface TeacherFinalEvidence {
 sourceRef:string; scope:ActivityScope; explicit:boolean;
 judgment:'final_complete'|'not_complete';
}
export type RecordObservation='observed'|'not_recorded'|'unverified';
function validScope(s:ActivityScope){if(!s||![s.studentId,s.activityId].every(x=>typeof x==='string'&&x.trim()))throw Error('exact_activity_scope_required');}
function sameScope(a:ActivityScope,b:ActivityScope){return a.studentId===b.studentId&&a.activityId===b.activityId;}
function finalState(scope:ActivityScope,evidence:TeacherFinalEvidence|null){
 validScope(scope);
 if(!evidence)return 'unknown' as const;
 validScope(evidence.scope);
 if(!sameScope(scope,evidence.scope))throw Error('cross_activity_teacher_evidence');
 if(!evidence.sourceRef.trim())throw Error('teacher_source_required');
 if(!evidence.explicit)return 'unknown' as const;
 return evidence.judgment==='final_complete'?'teacher_finalized' as const:'not_complete' as const;
}
function validateRecord(x:RecordObservation){if(!['observed','not_recorded','unverified'].includes(x))throw Error('invalid_record_observation');}
export function projectDailyTest(x:{scope:ActivityScope;teacherFinal:TeacherFinalEvidence|null;appAnswerEntry:RecordObservation;appGrading:RecordObservation}){
 validateRecord(x.appAnswerEntry);validateRecord(x.appGrading);
 const paperLearning=finalState(x.scope,x.teacherFinal);
 return {paperLearning,appAnswerEntry:x.appAnswerEntry,appGrading:x.appGrading,
  reconciliation:x.appAnswerEntry==='not_recorded'||x.appGrading==='not_recorded'?'app_record_missing':x.appAnswerEntry==='unverified'||x.appGrading==='unverified'?'app_record_unverified':'app_record_observed',
  externalWrites:false as const};
}
export function projectMindmap(x:{scope:ActivityScope;assignment:'teacher_assigned'|'teacher_not_assigned'|'unknown';conceptBlankExplanation:{eventId:string;studentId:string;activityId:string;mode:'board'|'oral';sourceRef:string}|null;teacherFinal:TeacherFinalEvidence|null}){
 validScope(x.scope);
 if(!['teacher_assigned','teacher_not_assigned','unknown'].includes(x.assignment))throw Error('invalid_assignment');
 const link=x.conceptBlankExplanation;
 if(link&&(![link.eventId,link.activityId,link.sourceRef].every(v=>typeof v==='string'&&v.trim())||link.studentId!==x.scope.studentId||!['board','oral'].includes(link.mode)))throw Error('invalid_concept_explanation_link');
 if(x.assignment!=='teacher_assigned'&&x.teacherFinal)throw Error('unassigned_mindmap_teacher_evidence_conflict');
 const teacherState=finalState(x.scope,x.teacherFinal);
 return {assignment:x.assignment,paperFormat:'one_sheet' as const,purpose:'final_consolidation_of_concept_blank_explanation' as const,
  applicability:x.assignment==='teacher_not_assigned'?'not_applicable':x.assignment==='unknown'?'unknown':'assigned',
  explanationLink:link?{...link}:null,explanationMapping:link?'linked':'unverified',teacherState,
  completionClaimAllowed:x.assignment==='teacher_assigned'&&!!link&&teacherState==='teacher_finalized',
  automaticallyRequired:false as const,externalWrites:false as const};
}
export type CompletionCoverage={kind:'whole_activity'}|{kind:'known_subset';questionIds:string[]}|{kind:'unknown_subset'};
export function projectCompletionCoverage(x:{scope:ActivityScope;teacherFinal:TeacherFinalEvidence|null;coverage:CompletionCoverage}){
 const teacherState=finalState(x.scope,x.teacherFinal);
 if(x.coverage.kind==='known_subset'&&(!x.coverage.questionIds.length||x.coverage.questionIds.some(v=>!v.trim())||new Set(x.coverage.questionIds).size!==x.coverage.questionIds.length))throw Error('invalid_question_subset');
 const scopeState=teacherState!=='teacher_finalized'?teacherState:x.coverage.kind==='whole_activity'?'teacher_finalized_whole':'teacher_finalized_partial';
 return {scopeState,wholeActivityComplete:teacherState==='teacher_finalized'&&x.coverage.kind==='whole_activity',coverage:x.coverage.kind==='known_subset'?{kind:'known_subset' as const,questionIds:[...x.coverage.questionIds]}:{kind:x.coverage.kind},externalWrites:false as const};
}
export interface AssignmentHistory {scope:ActivityScope;paperIdentity:string;learningEventIds:string[];logistics:LogisticsEvent[];}
export interface LogisticsEvent {id:string;kind:'reprint'|'redistribute'|'carryover';assignmentId:string;paperIdentity:string;sourceRef:string;}
export function appendLogistics(history:AssignmentHistory,event:LogisticsEvent):AssignmentHistory{
 validScope(history.scope);
 if(!event.id.trim()||!event.sourceRef.trim()||!history.paperIdentity.trim()||event.assignmentId!==history.scope.activityId||event.paperIdentity!==history.paperIdentity||!['reprint','redistribute','carryover'].includes(event.kind))throw Error('same_assignment_and_paper_required');
 if(history.logistics.some(e=>e.id===event.id))throw Error('duplicate_logistics_event');
 return {scope:{...history.scope},paperIdentity:history.paperIdentity,learningEventIds:[...history.learningEventIds],logistics:[...history.logistics.map(e=>({...e})),{...event}]};
}
export interface ReviewHistory {scope:ActivityScope;events:ReviewEvent[];}
export type ReviewEvent={id:string;sourceRef:string;scope:ActivityScope;actor:'teacher'|'lms'|'assistant';explicit:boolean;kind:'final_complete'|'recheck_requested'|'observation'};
export function projectReviewHistory(history:ReviewHistory){
 validScope(history.scope);const seen=new Set<string>();let state:'unknown'|'teacher_finalized'|'reopened'='unknown';const finalEventIds:string[]=[];
 for(const e of history.events){
  validScope(e.scope);
  if(!sameScope(history.scope,e.scope)||!e.id.trim()||!e.sourceRef.trim()||seen.has(e.id))throw Error('invalid_review_history');seen.add(e.id);
  if(e.kind!=='observation'&&(e.actor!=='teacher'||!e.explicit))throw Error('explicit_teacher_judgment_required');
  if(e.kind==='final_complete'){state='teacher_finalized';finalEventIds.push(e.id);}
  if(e.kind==='recheck_requested')state='reopened';
 }
 return {state,priorFinalEventIds:[...finalEventIds],history:history.events.map(e=>({...e,scope:{...e.scope}})),externalWrites:false as const};
}

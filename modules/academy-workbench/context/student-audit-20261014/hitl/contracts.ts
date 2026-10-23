/** Domain event vocabulary only; not an execution or teacher-decision authority. */
export type Stage = 'source_answer_entry'|'teacher_source_review'|'pdf_generated'|'paper_printed'|'paper_distributed'|'paper_attempted'|'teacher_first_grading'|'correction_attempted'|'teacher_final_review'|'lms_record_reconciled';
export type LearningRoute='original_wrong'|'similar_clinic'|'daily_test'|'prep_video'|'concept_blank'|'mindmap'|'textbook_section';
export interface Scope {
 studentId:string;
 book:{sourceNamespace:string;nativeBookId:string|null;editionId:string|null;series:{state:'known'|'unknown'|'not_applicable';value:string|null}};
 unitId:string|null;sectionId:string|null;
 originalAttempt:{nativeId:string|null;sourceRecordKey:string|null;occurredAt:string|null;identityVerified:boolean};
 route:LearningRoute;
 printSnapshot:{id:string|null;pdfSha256:string|null;questionMembership:string[]|null;identityVerified:boolean}|null;
 questionSubset:{kind:'whole_snapshot'}|{kind:'known_subset';questionIds:string[]}|{kind:'unknown_subset'};
}
export type StageState='unknown'|'reported_done'|'observed_done'|'partial'|'explicitly_not_done'|'not_applicable'|'reopened';
export interface EvidenceEvent {
 id:string;scope:Scope;stage:Stage;state:StageState;
 source:{kind:'teacher_report'|'lms_observation'|'artifact_observation';sourceId:string;reportedAt:string|null;observedAt:string;occurredAt:string|null};
 assertion:string;
 supersedesEventIds:string[];
 changesExternalSource:false;
}
export const nonEquivalence = [
 ['lms_score','teacher_source_review'],['pdf_generated','paper_printed'],
 ['paper_printed','paper_distributed'],['paper_distributed','paper_attempted'],
 ['teacher_first_grading','teacher_final_review'],['teacher_final_review','lms_record_reconciled']
] as const;
export const deferredInterviewTopics = ['video_detailed_review_rubric'] as const;

/** Optional consolidation of an exact concept-blank explanation, not a universal task. */
export interface MindmapContext {
 assignment: 'teacher_assigned' | 'teacher_not_assigned' | 'unknown';
 paperFormat: 'one_sheet';
 purpose: 'final_consolidation_of_concept_blank_explanation';
 conceptBlankEventIds: string[];
 explanationModes: Array<'board' | 'oral'>;
 teacherFinal: 'yes' | 'no' | 'unknown';
}
export interface DailyTestProjection {
 paperLearning: 'teacher_finalized' | 'partial' | 'pending' | 'unknown';
 appAnswerEntry: 'observed' | 'not_recorded' | 'unverified';
 appGrading: 'observed' | 'not_recorded' | 'unverified';
}

/** Student-scoped versioned JSON persistence contract. No runtime DB or LMS writes. */
export interface StudentRubric {schemaVersion:'academy.student-eval-rubric/1';rubricId:string;studentId:string;version:number;bookScope:{nativeBookId:string;display:string}[];effectiveAt:string|null;sources:string[];targets:{dailyTest:{sessionsPerSubunit:2;totalQuestions:8;targetCorrect:[5,6];exactPercent:[62.5,75];aboveTargetCorrect:[7,8]};semesterArithmetic:{goal:string;measurementDefinition:null|string}};teacherFinalIndependent:true;automaticCompletion:false;otherStudentsApplicable:false;history:{version:number;sourceMessageId:string;previousVersion:number|null}[];persistence:{mode:'versioned_private_json';runtimeDatabaseImplemented:false;lmsWritePerformed:false};}
export function validateRubric(x:StudentRubric,studentId:string):StudentRubric{
 if(x?.schemaVersion!=='academy.student-eval-rubric/1'||x.studentId!==studentId||!Number.isInteger(x.version)||x.version<1||!x.rubricId||!Array.isArray(x.bookScope)||x.bookScope.length===0||!Array.isArray(x.sources)||!x.sources.length)throw Error('rubric_identity_scope_invalid');
 const d=x.targets?.dailyTest;if(!d||d.sessionsPerSubunit!==2||d.totalQuestions!==8||JSON.stringify(d.targetCorrect)!=='[5,6]'||JSON.stringify(d.exactPercent)!=='[62.5,75]'||JSON.stringify(d.aboveTargetCorrect)!=='[7,8]')throw Error('rubric_goal_invalid');
 if(!x.teacherFinalIndependent||x.automaticCompletion!==false||x.otherStudentsApplicable!==false||x.persistence?.mode!=='versioned_private_json'||x.persistence.runtimeDatabaseImplemented!==false||x.persistence.lmsWritePerformed!==false)throw Error('rubric_authority_invalid');
 if(!Array.isArray(x.history)||!x.history.some(h=>h.version===x.version&&x.sources.includes(h.sourceMessageId)))throw Error('rubric_history_missing');return x;
}
export function assessRubricTarget(r:StudentRubric,studentId:string,bookId:string,correct:number,total:number){
 validateRubric(r,studentId);if(!r.bookScope.some(b=>b.nativeBookId===bookId))throw Error('rubric_book_outside_scope');
 if(!Number.isInteger(correct)||correct<0||correct>total||total!==8)throw Error('rubric_observation_denominator_invalid');
 return {correct,total,percent:correct/total*100,targetRelation:correct<5?'below_target':correct<=6?'within_target':'above_target',teacherFinal:'not_determined' as const,automaticCompletion:false as const};
}

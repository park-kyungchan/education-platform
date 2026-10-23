/** Current policy only. Never rewrites historical print/clinic events or executes printing. */
export const PERFECT_SCORE_POLICY={version:'academy.clinic-perfect-score/1.0.0',sourceMessageId:'export-redacted-message',sourcePage:'https://example.invalid/export-redacted-source',sourcePageSequence:6,rule:'검증된 해당 원본 평가 100점은 오답·유사클리닉 기본 면제. 교사의 해당 평가 명시적 예외 요청만 별도 적용.'} as const;
interface Scope {studentId:string;assessmentAttemptId:string;}
interface Evidence extends Scope {evidenceIds:readonly string[];}
export interface PerfectScoreInput {
 scope:Scope;
 grade:(Evidence&{kind:'original_assessment';verification:'verified'|'unverified';coverage:'complete'|'partial';scorePercent:number|null})|null;
 teacherReview:(Evidence&{state:'complete'|'unknown'})|null;
 exception:(Evidence&{kind:'explicit_teacher_request';clinicKinds:readonly ('error'|'similar')[]})|null;
}
const supported=(v:Evidence|null,scope:Scope)=>!!v&&v.studentId===scope.studentId&&v.assessmentAttemptId===scope.assessmentAttemptId&&Array.isArray(v.evidenceIds)&&v.evidenceIds.length>0&&v.evidenceIds.every(id=>typeof id==='string'&&id.trim());
export function evaluatePerfectScorePolicy(input:PerfectScoreInput){
 if(!input.scope.studentId||!input.scope.assessmentAttemptId)throw Error('missing_original_assessment_scope');
 const grade=input.grade;
 const perfect=!!grade&&supported(grade,input.scope)&&grade.kind==='original_assessment'&&grade.verification==='verified'&&grade.coverage==='complete'&&grade.scorePercent===100;
 const reviewed=supported(input.teacherReview,input.scope)&&input.teacherReview?.state==='complete';
 const exception=supported(input.exception,input.scope)&&input.exception?.kind==='explicit_teacher_request'?input.exception:null;
 const clinics=(['error','similar'] as const).map(kind=>({kind,requirement:exception?.clinicKinds.includes(kind)?'requested_by_teacher':perfect?'waived_by_policy':'unknown',completed:false,printAuthorized:false}));
 return {policy:PERFECT_SCORE_POLICY,scope:input.scope,clinics,correctionRequirement:perfect&&reviewed?'not_applicable_after_teacher_confirmation':'unknown',teacherReviewComplete:reviewed,closeScope:'clinic_remediation_branch_only',closeEligible:perfect&&reviewed&&!exception,rewritesHistory:false,externalActionPerformed:false};
}

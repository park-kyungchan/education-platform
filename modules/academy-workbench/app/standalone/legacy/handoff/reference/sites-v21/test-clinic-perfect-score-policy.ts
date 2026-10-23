import assert from 'node:assert/strict';
import {evaluatePerfectScorePolicy,type PerfectScoreInput} from './src/domain/clinic-perfect-score-policy.ts';
const scope={studentId:'s',assessmentAttemptId:'a'};const input:PerfectScoreInput={scope,grade:{...scope,evidenceIds:['grade'],kind:'original_assessment',verification:'verified',coverage:'complete',scorePercent:100},teacherReview:null,exception:null};
let r=evaluatePerfectScorePolicy(input);assert(r.clinics.every(c=>c.requirement==='waived_by_policy'&&!c.completed&&!c.printAuthorized));assert(!r.teacherReviewComplete&&!r.closeEligible);assert.equal(r.correctionRequirement,'unknown');
r=evaluatePerfectScorePolicy({...input,teacherReview:{...scope,evidenceIds:['review'],state:'complete'}});assert(r.closeEligible);assert.equal(r.correctionRequirement,'not_applicable_after_teacher_confirmation');
r=evaluatePerfectScorePolicy({...input,exception:{...scope,evidenceIds:['teacher'],kind:'explicit_teacher_request',clinicKinds:['similar']}});assert.equal(r.clinics[1].requirement,'requested_by_teacher');assert.equal(r.clinics[0].requirement,'waived_by_policy');assert(!r.closeEligible);
for(const grade of [{...input.grade!,coverage:'partial' as const},{...input.grade!,verification:'unverified' as const},{...input.grade!,assessmentAttemptId:'other'},{...input.grade!,scorePercent:99},{...input.grade!,evidenceIds:[' ']}])assert(evaluatePerfectScorePolicy({...input,grade}).clinics.every(c=>c.requirement==='unknown'));
assert(!evaluatePerfectScorePolicy({...input,teacherReview:{...scope,assessmentAttemptId:'other',evidenceIds:['r'],state:'complete'}}).teacherReviewComplete);
console.log('PASS scoped verified 100% waivers, explicit teacher exceptions, independent review, no historical rewrite/print execution');

import test from 'node:test';import assert from 'node:assert/strict';
import {projectClinicGate,type ClinicGateInput} from '../hitl/policy.ts';
const input=():ClinicGateInput=>({kind:'clinic_pair',sourceAttemptScore:100,teacherSourceReview:'yes',similarPrintQuestionAnswered:false,similar:{printed:'unknown',teacherFinal:'unknown'},original:{printed:'no',teacherFinal:'unknown'},teacherFinalForScope:'unknown',teacherRaisedValidityConcern:false,scopeConfirmation:'explicit'});
test('100 is original N/A but not overall completion or similar exemption',()=>{const p=projectClinicGate(input());assert.equal(p.originalApplicability,'not_applicable');assert.ok(p.blockers.includes('ask_teacher_whether_similar_clinic_printed'));assert.equal(p.overall,'blocked');});
test('printed similar must retain its own scoped teacher final',()=>{const x=input();x.similarPrintQuestionAnswered=true;x.similar={printed:'yes',teacherFinal:'no'};assert.ok(projectClinicGate(x).blockers.includes('similar_print_teacher_final_required'));});
test('a score never resolves teacher reported validity concern',()=>{const x=input();x.teacherRaisedValidityConcern=true;assert.ok(projectClinicGate(x).blockers.includes('teacher_validity_review_unresolved'));});
test('explicit teacher final and confirmed applicability can project that exact scope',()=>{const x=input();x.similarPrintQuestionAnswered=true;x.similar={printed:'no',teacherFinal:'yes'};x.teacherFinalForScope='yes';assert.deepEqual(projectClinicGate(x).blockers,[]);assert.equal(projectClinicGate(x).overall,'teacher_final_confirmed_for_explicit_scope');});

test('perfect preparation cannot imply final understanding review',()=>{const x=input();x.similarPrintQuestionAnswered=true;x.similar={printed:'no',teacherFinal:'unknown'};assert.ok(projectClinicGate(x).blockers.includes('explicit_scoped_teacher_final_required'));});
test('completed original paper cannot promote unfinished similar paper',()=>{const x=input();x.sourceAttemptScore=70;x.original={printed:'yes',teacherFinal:'yes'};x.similarPrintQuestionAnswered=true;x.similar={printed:'yes',teacherFinal:'unknown'};x.teacherFinalForScope='yes';assert.ok(projectClinicGate(x).blockers.includes('similar_print_teacher_final_required'));});

test('ambiguous teacher wording cannot finalize multiple activities',()=>{const x=input();x.similarPrintQuestionAnswered=true;x.similar.printed='no';x.teacherFinalForScope='yes';x.scopeConfirmation='ambiguous';assert.ok(projectClinicGate(x).blockers.includes('clarify_teacher_activity_scope'));});
test('under-100 original print missing cannot become complete from generic final',()=>{const x=input();x.sourceAttemptScore=80;x.teacherFinalForScope='yes';assert.ok(projectClinicGate(x).blockers.includes('original_print_execution_unconfirmed'));});

test('clinic gate refuses other learning routes at runtime',()=>{const x={...input(),kind:'daily_test'};assert.throws(()=>projectClinicGate(x as unknown as ClinicGateInput),/clinic_gate_route_mismatch/);});

import {z} from 'zod';
import {StudentId,EvidenceId} from '../domain/ids.ts';
import {Evidence} from '../domain/evidence.ts';
import {LocalDate} from '../domain/operational-makeup.ts';

const base={studentId:StudentId,weekStart:LocalDate.refine(s=>new Date(s+'T00:00:00Z').getUTCDay()===0,'week_must_start_sunday'),assessmentKind:z.literal('daily_test_activity')};
export const CismDtReview=z.discriminatedUnion('state',[
 z.strictObject({...base,state:z.literal('not_checked')}),
 z.strictObject({...base,state:z.literal('checked_no_issue'),reviewEvidenceId:EvidenceId}),
 z.strictObject({...base,state:z.literal('issue_reported'),reviewEvidenceId:EvidenceId,note:z.string().min(1),numericScore:z.strictObject({value:z.number().min(0).max(100),evidenceId:EvidenceId}).nullable()})
]);
/** A reported issue can prepare a section; UI numeric/narrative write mapping remains unverified. */
export function prepareCismDtSection(input:unknown,evidenceInputs:readonly unknown[]=[]){
 const review=CismDtReview.parse(input),evidence=evidenceInputs.map(e=>Evidence.parse(e)),byId=new Map(evidence.map(e=>[e.evidenceId,e]));
 if(byId.size!==evidence.length)throw Error('duplicate_cism_evidence');
 if(review.state==='not_checked')return {state:review.state,entryRequired:null,score:null,writeMapping:'unverified' as const};
 const e=byId.get(review.reviewEvidenceId);
 if(!e||e.scope.studentId!==review.studentId||e.source.kind!=='user_report'||!['teacher','reviewer'].includes(e.source.actor.role)||!e.source.statementProvenanceConfirmed||e.verificationStatus==='contradicted'||e.claim.type!=='dt_week_issue_review')throw Error('cism_issue_review_evidence_required');
 const value=z.strictObject({weekStart:LocalDate,state:z.enum(['checked_no_issue','issue_reported'])}).parse(e.claim.value);
 if(value.weekStart!==review.weekStart||value.state!==review.state)throw Error('cism_issue_review_scope_mismatch');
 if(review.state==='checked_no_issue')return {state:review.state,entryRequired:false,score:null,writeMapping:'unverified' as const};
 if(review.numericScore){const score=byId.get(review.numericScore.evidenceId);if(!score||score.scope.studentId!==review.studentId||score.verificationStatus==='contradicted'||score.claim.type!=='dt_week_numeric_score'||!['user_report','imported_snapshot'].includes(score.source.kind)||score.source.kind==='user_report'&&(!score.source.statementProvenanceConfirmed||!['teacher','reviewer'].includes(score.source.actor.role)))throw Error('cism_supplied_score_evidence_required');const claim=z.strictObject({weekStart:LocalDate,value:z.number().min(0).max(100)}).parse(score.claim.value);if(claim.weekStart!==review.weekStart||claim.value!==review.numericScore.value)throw Error('cism_supplied_score_mismatch');}
 return {state:review.state,entryRequired:true,note:review.note,score:review.numericScore?.value??null,writeMapping:'unverified' as const};
}

import {z} from 'zod';
import {StudentId,EntityId,EvidenceId} from './ids.ts';
import {Evidence} from './evidence.ts';

export const LocalDate=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>{const date=new Date(s+'T00:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===s;},'invalid_local_date');
export const MakeupPlan=z.strictObject({studentId:StudentId,absenceId:EntityId,absenceDate:LocalDate,reasonKind:z.literal('original_absence'),requiredMinutes:z.number().int().positive(),sessions:z.array(z.strictObject({sessionId:EntityId,plannedOn:LocalDate.nullable(),plannedMinutes:z.number().int().positive(),actualMinutes:z.number().int().nonnegative().nullable(),actualEvidenceIds:z.array(EvidenceId)}))}).superRefine((p,c)=>{
 if(new Set(p.sessions.map(s=>s.sessionId)).size!==p.sessions.length)c.addIssue({code:'custom',message:'duplicate_makeup_session'});
 for(const s of p.sessions){if(new Set(s.actualEvidenceIds).size!==s.actualEvidenceIds.length)c.addIssue({code:'custom',message:'duplicate_makeup_evidence'});if((s.actualMinutes===null)!==(s.actualEvidenceIds.length===0))c.addIssue({code:'custom',message:'actual_makeup_requires_separate_evidence'});}
});
export type MakeupPlan=z.infer<typeof MakeupPlan>;
/** Calendar arithmetic aid. End-of-month clamping is explicit; operational edge adjudication stays human. */
export function calendarMonthDeadlineCandidate(input:unknown){
 const date=LocalDate.parse(input),[year,month,day]=date.split('-').map(Number),last=new Date(Date.UTC(year,month+1,0)).getUTCDate(),clamped=day>last;
 const candidate=new Date(Date.UTC(year,month,Math.min(day,last))).toISOString().slice(0,10);
 return {date:candidate,endOfMonthClamped:clamped,requiresEndpointReview:clamped,provesExecution:false as const};
}
/** Shares student IDs/evidence scope while the academy policy catalog contains no student records. */
export function summarizeMakeupPlan(planInput:unknown,evidenceInputs:readonly unknown[]=[]){
 const plan=MakeupPlan.parse(planInput),evidence=evidenceInputs.map(e=>Evidence.parse(e)),byId=new Map(evidence.map(e=>[e.evidenceId,e]));
 if(byId.size!==evidence.length)throw Error('duplicate_makeup_evidence_input');
 const claim=z.strictObject({absenceId:EntityId,sessionId:EntityId,minutes:z.number().int().nonnegative()});
 let actualMinutes=0,verifiedSessions=0;
 for(const session of plan.sessions){
  if(session.actualMinutes===null)continue;
  for(const id of session.actualEvidenceIds){const e=byId.get(id);if(!e||e.scope.studentId!==plan.studentId||!e.scope.entityIds.includes(session.sessionId)||!e.scope.entityIds.includes(plan.absenceId))throw Error('makeup_actual_evidence_scope_mismatch');
   if(e.source.kind!=='user_report'||e.source.actor.role!=='teacher'||!e.source.statementProvenanceConfirmed||e.verificationStatus==='contradicted'||e.claim.type!=='makeup_session_attendance')throw Error('makeup_actual_requires_teacher_report');
   const value=claim.parse(e.claim.value);if(value.absenceId!==plan.absenceId||value.sessionId!==session.sessionId||value.minutes!==session.actualMinutes)throw Error('makeup_actual_duration_mismatch');
  }
  actualMinutes+=session.actualMinutes;verifiedSessions++;
 }
 return {studentId:plan.studentId,absenceId:plan.absenceId,requiredMinutes:plan.requiredMinutes,plannedMinutes:plan.sessions.reduce((n,s)=>n+s.plannedMinutes,0),actualMinutes:verifiedSessions?actualMinutes:null,actualCoverage:verifiedSessions===0?'not_checked' as const:verifiedSessions<plan.sessions.length?'partial' as const:'reported_all_sessions' as const,remainingMinutes:Math.max(0,plan.requiredMinutes-actualMinutes),timeRequirementReportedFulfilled:actualMinutes>=plan.requiredMinutes,teacherCompletionState:'unknown' as const,deadline:calendarMonthDeadlineCandidate(plan.absenceDate),liveAttendanceVerified:false as const};
}

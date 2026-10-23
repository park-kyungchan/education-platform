import type {EntityRef, EffectiveFact, StageState} from './student-events.ts';
/** Definitions are review prompts, never assignments or evidence of non-performance. */
export const WORKFLOW_CHECKPOINTS = [
 ['preview_video','예습영상'],['notes','필기노트'],['book_solve','배정 교재 섹션 풀이'],
 ['submission','제출 확인'],['preview_review','강사 예습 확인'],['concept_test','개념백지테스트'],
 ['book_grading','교재 채점'],['clinic_prepare','클리닉 준비'],['clinic_print','실제 인쇄'],
 ['clinic_distribute','학생 배부'],['clinic_solve','클리닉 풀이'],['clinic_grade','현장 채점'],
 ['lms_entry','서버 채점 입력'],['correction','오답 재풀이'],['teacher_recheck','교사 재확인'],
 ['daily_test','DailyTest'],['next_assignment','다음 숙제 결정'],['dailyrecord_review','DailyRecord 최종 검토']
] as const;
export type Checkpoint = typeof WORKFLOW_CHECKPOINTS[number][0];
export interface CoverageAssignment { studentId:string; assignmentId:string; assignmentStatus:string; label:string; evidenceEventIds:readonly string[]; }
/** Bindings must be verified for this precise assignment/checkpoint; series-name guesses are prohibited. */
export interface CheckpointBinding { studentId:string; assignmentId:string; checkpoint:Checkpoint; applicability:'required'|'waived'|'deferred'; evidenceIds:readonly string[]; reason:string; stageTarget?:EntityRef; stage?:import('./student-events.ts').Stage; }
const evidence=(ids:readonly string[])=>Array.isArray(ids)&&ids.length>0&&ids.every(id=>typeof id==='string'&&id.trim().length>0);
export function projectWorkflowCoverage(assignments:readonly CoverageAssignment[],facts:readonly EffectiveFact[],allowed:readonly string[],bindings:readonly CheckpointBinding[]=[]){
 const visible=assignments.filter(a=>allowed.includes(a.studentId)&&['teacher_confirmed','issued_user_report'].includes(a.assignmentStatus)&&evidence(a.evidenceEventIds));
 return visible.map(a=>({studentId:a.studentId,assignmentId:a.assignmentId,label:a.label,definitionOnly:true as const,createsAssignment:false as const,assignmentEvidenceIds:[...a.evidenceEventIds],checkpoints:WORKFLOW_CHECKPOINTS.map(([checkpoint,label])=>{
  const matching=bindings.filter(b=>b.studentId===a.studentId&&b.assignmentId===a.assignmentId&&b.checkpoint===checkpoint);
  if(matching.length>1)throw Error('ambiguous_checkpoint_binding');
  const b:CheckpointBinding|undefined=matching.length?matching[0]:undefined;
  if(b&&(!['required','waived','deferred'].includes(b.applicability)||!Array.isArray(b.evidenceIds)||!b.evidenceIds.length||b.evidenceIds.some(id=>typeof id!=='string'||!id.trim())||!b.reason.trim()||b.stageTarget?.studentId&&b.stageTarget.studentId!==a.studentId))throw Error('unsupported_checkpoint_binding');
  if(b&&((!!b.stageTarget)!=(!!b.stage)))throw Error('partial_stage_binding');
  const f=b?.stageTarget?facts.find(f=>f.studentId===a.studentId&&f.target.id===b.stageTarget!.id&&f.target.kind===b.stageTarget!.kind&&f.target.namespace===b.stageTarget!.namespace&&f.claims[0]?.kind==='stage_assertion'&&f.claims[0].stage===b.stage):undefined;
  const claim=f?.claims[0];
  const state:StageState|'conflicted'|'not_started'=f?.status==='conflicted'?'conflicted':claim?.kind==='stage_assertion'?(claim.state==='not_performed'?'not_started':claim.state):'unknown';
  return {checkpoint,label,applicability:b?.applicability??'unknown',state,checked:state==='complete',reason:b?.reason??'실제 배정 범위·교재 정책과의 연결 확인 필요',bindingEvidenceIds:b?[...b.evidenceIds]:[],factEvidenceIds:f?.claims.map(e=>e.eventId)??[],blocksNextStep:false as const,authorityGranted:false as const};
 })}));
}
export interface TeachingSession {date:string; assignedTeacher:'user'|'delegated'|'unknown'; scheduleState:'confirmed'|'cancelled'|'unknown'; evidenceIds:readonly string[];}
/** Caller supplies verified dated schedule, not weekday assumptions. No side effects or reminder creation. */
export interface WorkdayReminders { preparationCheckLocalTime:string; timeZone:string; }
export function preparationReminderDecision(date:string,localTime:string,sessions:readonly TeachingSession[],workdayReminders:WorkdayReminders){
 const today=sessions.filter(s=>s.date===date&&evidence(s.evidenceIds)&&s.scheduleState==='confirmed');
 const notify=localTime===workdayReminders.preparationCheckLocalTime&&today.some(s=>s.assignedTeacher==='user');
 return {notify,auditDelegatedSessions:today.some(s=>s.assignedTeacher==='delegated'),reason:notify?'verified_user_teaching_day':'no_verified_user_class_at_configured_time',timezone:workdayReminders.timeZone,assumesActualProgress:false};
}

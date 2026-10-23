import {validateRubric,type StudentRubric} from './rubric.ts';
import {readFileSync,lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import type {Audit,Row} from './model.ts';
// Teacher-reported scope is never widened to a whole book or activity inventory.
export type HomeworkFact =
 | {kind:'assigned_homework_judgment';bookLabelRaw:string;scope:'current_assigned_homework_only';status:'teacher_final_complete';exactActivityMembership:null;bookWideCompletion:false}
 | {kind:'homework_page_progress';bookLabelRaw:string;status:'student_performed_reported';fromPage:null;throughPage:number;teacherFinal:'not_established';pageActivityMapping:'unverified'}
 | {kind:'homework_page_progress';bookLabelRaw:string;status:'explicitly_not_done';fromPage:number;throughPage:number;inclusivePageCount:number;pageActivityMapping:'unverified'}
 | {kind:'daily_homework_scheduling_requirement';status:'design_requested_not_implemented';workflow:string[];datesAssigned:false;lmsWritePerformed:false;notificationsConfigured:false};
export type LessonTimingFact =
 | {kind:'lesson_workload_estimate';activityLabel:string;status:'teacher_observed_pace_estimate';scope:'today_lesson_only';estimatedUntil:string;teacherFinal:'pending';generalizedAbilityInference:false}
 | {kind:'conditional_lesson_extension';activityLabel:string;status:'may_remain';possibleUntil:string;actualStayed:'unknown';actualDepartureAt:null;completion:'not_implied'}
 | {kind:'lesson_plan_capacity';status:'possible_time_conflict';priorityActivity:string;preservedPriorPlan:string;priorPlanCancelled:false;rescheduledDate:null};
export interface EveningHomeworkCounselingPlan {
 kind:'evening_homework_counseling_plan';status:'teacher_confirmed_plan';plannedStartAt:string;plannedEndAt:string;plannedMinutes:30;activities:string[];
 actualStartedAt:null;actualFinishedAt:null;actualDepartureAt:null;teacherFinal:'not_implied';parentConsent:'unverified';parentMessageStatus:'draft_output_only_not_sent';
}
export type ParentReplyContextFact =
 | {kind:'lesson_plan_replacement';status:'teacher_message_sent_parent_followup_unobserved';supersedesCurrentPlan:'evening-homework-counseling';replacementDate:string;replacementTime:string;timezone:'Asia/Seoul';actualAttendance:'unverified';todayDepartureAt:null;parentSubsequentConfirmation:'unobserved'}
 | {kind:'parent_effort_observation';status:'parent_report_only';observation:string;teacherPaceObservation:'separate_today_lesson_evidence';effortDeficitInference:false}
 | {kind:'instruction_support_plan';status:'planned_not_assigned';supports:string[];specificAssignedScope:null;diagnosisInferred:false};
export interface TeacherEvent extends Row {id:string;studentId:string;sourceKind:'teacher_report'|'user_supplied_message_context';recordedAt:string;facts?:Row[];rawLabels?:string[];}
export interface LessonStudent {studentId:string;teacherEvents:TeacherEvent[];observations:Row[];rubric?:StudentRubric;dailyRecordDraft?:Row;}
export interface LessonOverlay {schemaVersion:'academy.lesson-overlay/1';lessonDate:string;preparedAt:string;contextCutoff?:string;students:LessonStudent[];}
export interface PinnedLesson {data:LessonOverlay;sha256:string;}
export function parseLesson(text:string,audit:Audit):LessonOverlay{
 const x=JSON.parse(text);const allowed=new Set(audit.students.map(s=>s.studentId)),seen=new Set<string>();
 if(x?.schemaVersion!=='academy.lesson-overlay/1'||!/^\d{4}-\d{2}-\d{2}$/.test(x.lessonDate)||!Number.isFinite(Date.parse(x.preparedAt))||!Array.isArray(x.students))throw Error('lesson_schema_invalid');
 for(const s of x.students){
  if(!allowed.has(s?.studentId)||seen.has(s.studentId)||!Array.isArray(s.teacherEvents)||!Array.isArray(s.observations))throw Error('lesson_student_scope_invalid');seen.add(s.studentId);
  if(s.rubric)validateRubric(s.rubric,s.studentId);
  if(s.dailyRecordDraft?.student?.studentId&&s.dailyRecordDraft.student.studentId!==s.studentId)throw Error('draft_student_scope_invalid');
  const ids=new Set<string>();
  for(const e of s.teacherEvents){if(e?.studentId!==s.studentId||!['teacher_report','user_supplied_message_context'].includes(e.sourceKind)||typeof e.id!=='string'||ids.has(e.id)||!Number.isFinite(Date.parse(e.recordedAt))||(e.facts!==undefined&&!Array.isArray(e.facts))||(e.rawLabels!==undefined&&(!Array.isArray(e.rawLabels)||e.rawLabels.some((l:unknown)=>typeof l!=='string'))))throw Error('lesson_event_invalid');ids.add(e.id);}
  for(const o of s.observations){if(!o||!['assessment','assessment_timing','dailyTests','pendingVideo','pendingVideos','dailyRecord'].includes(o.kind)||!Number.isFinite(Date.parse(o.observedAt)))throw Error('lesson_observation_invalid');}
 }
 return x;
}
export function readPinnedLesson(path:string,sha:string,audit:Audit):PinnedLesson{
 if(!/^[a-f0-9]{64}$/.test(sha))throw Error('explicit_lesson_sha256_required');
 const stat=lstatSync(path);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>32*1024*1024)throw Error('lesson_file_invalid');
 const bytes=readFileSync(path);if(createHash('sha256').update(bytes).digest('hex')!==sha)throw Error('lesson_hash_mismatch');
 return {data:parseLesson(new TextDecoder('utf-8',{fatal:true}).decode(bytes),audit),sha256:sha};
}
export interface LessonCard {kind:string;label:string;state:string;reportedAt:string;eventAt:string|null;sourceId:string;note:string;}
export function projectLesson(s:LessonStudent):LessonCard[]{
 const cards=new Map<string,LessonCard>();
 const events=[...s.teacherEvents].sort((a,b)=>Date.parse(a.recordedAt)-Date.parse(b.recordedAt));
 for(const e of events){
  for(const f of e.facts??[]){
   let key='',label='',state='',note='';
   if(f.kind==='attendance_arrival'){key='attendance';label='출석';state='교사 보고 출석';note='서버 출결 확인과 별개';}
   if(f.kind==='solution_explanation'&&f.status==='started'){key='question:'+f.questionLabel;label='문항 '+f.questionLabel+' 풀이 설명';state='진행 중';note='최종 판정 전';}
   if(f.kind==='teacher_final_judgment'&&f.status==='final_complete'){key='question:'+f.questionLabel;label='문항 '+f.questionLabel+' 풀이 설명';state='교사 최종 완료';note='명시된 문항만 완료. 다른 과제로 전파하지 않음';}
   if(f.kind==='concept_blank_test'){key='concept:'+f.bookLabelRaw+':'+f.subunitLabelRaw;label=String(f.bookLabelRaw)+' · '+String(f.subunitLabelRaw)+' 개념백지테스트';state=f.status==='in_progress'?'진행 중':'확인 필요';note='원문 교재·소단원 유지. 서버 판본 연결 미확인';}
   if(f.kind==='homework_performance'&&f.status==='explicitly_not_done'){key='homework:'+f.activityLabel;label=String(f.activityLabel);state='미수행 · 교사 명시';note='숙제를 해오지 않았다는 교사 보고. 다른 과제 상태로 전파하지 않음';}
   if(f.kind==='homework_performance'&&f.status==='brought_completed_by_student_ungraded'){key='homework:'+f.activityLabel;label=String(f.activityLabel);state='해옴 · 교사 채점 전';note='학생 풀이 수행과 교사 최종 완료는 별개. 정확한 문항 범위 미확인';}
   if(f.kind==='clinic_plan'&&f.status==='planned_today'){key='clinic-plan:'+f.unitRangeRaw;label='클리닉 · '+String(f.unitRangeRaw);state='오늘 진행 계획';note='교사 보관 프린트. 배부·학생 풀이·교사 완료를 뜻하지 않음';}
   if(f.kind==='daily_test_plan'&&f.status==='likely_not_today'){key='daily-test-plan:'+JSON.stringify(f.units);label='Daily Test · '+(Array.isArray(f.units)?f.units.join(', '):'범위 미확인')+' · 총 '+String(f.totalSessions)+'회';state='오늘 진행 어려울 것으로 예상';note='소단원당 '+String(f.sessionsPerUnit)+'회. 확정 취소·다음 수업 배정 아님';}
   if(f.kind==='assigned_homework_judgment'&&f.scope==='current_assigned_homework_only'&&f.status==='teacher_final_complete'){key='assigned-homework:'+f.bookLabelRaw;label=String(f.bookLabelRaw)+' · 이번 숙제';state='교사 최종 완료';note='이번 배정 숙제에만 해당. 교재 전체·다른 활동의 완료 아님. 정확한 활동 목록 대응 미확인';}
   if(f.kind==='homework_page_progress'&&f.status==='student_performed_reported'){key='page-progress:'+f.bookLabelRaw+':'+f.throughPage;label=String(f.bookLabelRaw)+' · p.'+String(f.throughPage)+'까지';state='학생 수행 보고 · 교사 최종 검토 별도';note='시작 쪽수 미확인. 페이지와 실제 활동 대응 미확인. 교사 최종 완료로 승격하지 않음';}
   if(f.kind==='homework_page_progress'&&f.status==='explicitly_not_done'){key='page-missing:'+f.bookLabelRaw+':'+f.fromPage+':'+f.throughPage;label=String(f.bookLabelRaw)+' · p.'+String(f.fromPage)+'~'+String(f.throughPage);state='미숙제 · '+String(f.inclusivePageCount)+'쪽';note='양 끝 포함 페이지 수. 문항 수·활동 수와 다름. 페이지와 실제 활동 대응 미확인';}
   if(f.kind==='daily_homework_scheduling_requirement'&&f.status==='design_requested_not_implemented'){key='scheduling-requirement';label='학생별 일단위 집 예습 계획 → 학원 앱 기록 → 교사 알림';state='설계 요구 · 미구현';note='날짜 배정·학원 서버 기록·알림 설정은 아직 하지 않음';}
   if(f.kind==='lesson_workload_estimate'&&f.status==='teacher_observed_pace_estimate'&&f.scope==='today_lesson_only'){key='workload:'+f.activityLabel;label=String(f.activityLabel);state='오늘 작업량 예상 · '+clockTime(f.estimatedUntil)+'까지';note='교사의 오늘 현장 수행 속도 관찰·예상. 실제 완료 시각이나 학생의 고정 능력 판정 아님';}
   if(f.kind==='conditional_lesson_extension'&&f.status==='may_remain'){key='conditional-extension:'+f.activityLabel;label=String(f.activityLabel)+' · 잔류 가능성';state=clockTime(f.possibleUntil)+'까지 가능 · 조건부';note='실제 잔류·귀가 시각·학습 완료가 확인된 것은 아님';}
   if(f.kind==='lesson_plan_capacity'&&f.status==='possible_time_conflict'){key='plan-capacity';label='수업 계획 · 시간 부족 가능성';state=String(f.priorityActivity)+' 우선';note=String(f.preservedPriorPlan)+' 계획도 보존. 두 계획의 시간 상충 가능성; 임의 취소·재배정하지 않음';}
   if(f.kind==='evening_homework_counseling_plan'&&f.status==='teacher_confirmed_plan'){
    // Supersede only the current uncertainty card; immutable prior raw event remains.
    for(const [oldKey,card] of cards)if(card.kind==='conditional_lesson_extension')cards.delete(oldKey);
    key='evening-homework-counseling';label='숙제 마무리 · 상담';state=clockTime(f.plannedStartAt)+' ~ '+clockTime(f.plannedEndAt)+' · '+String(f.plannedMinutes)+'분 예정';note='교사 확정 계획. 실제 실시·완료·귀가 아님. 학부모 안내는 초안만 출력, 외부 미발송·학부모 동의 미확인';
   }
   if(f.kind==='lesson_plan_replacement'&&f.status==='teacher_message_sent_parent_followup_unobserved'&&f.supersedesCurrentPlan==='evening-homework-counseling'){
    cards.delete('evening-homework-counseling');
    key='current-followup-lesson-plan';label='금요일 조기 등원 안내';state=String(f.replacementDate)+' '+String(f.replacementTime)+' KST · 교사 답장 전송됨';note='오늘 잔류 계획 대신 안내. 학부모의 후속 확인·실제 금요일 출석·오늘 귀가 시각 미확인. 답장 정확한 발신 시각 미상';
   }
   if(f.kind==='parent_effort_observation'&&f.status==='parent_report_only'){key='parent-effort-observation';label='학부모의 집 학습 관찰';state=String(f.observation);note='학부모 보고. 교사의 오늘 현장 풀이 속도 관찰과 별개이며 노력 부족·고정 능력을 추론하지 않음';}
   if(f.kind==='instruction_support_plan'&&f.status==='planned_not_assigned'){key='instruction-support-plan';label='향후 지도 계획';state=Array.isArray(f.supports)?f.supports.join(' · '):'구체 범위 확인 필요';note='계획 단계. 구체 숙제량·페이지·문항은 아직 배정하지 않음. 진단 아님';}
   if(f.kind==='weekly_pacing_proposal'&&f.status==='teacher_proposal_not_assigned'){key='weekly-pacing-proposal';label='부원장 협의 · 주단위 진도';state=String(f.proposal)+' 제안';note='DM 초안 제공, 외부 미발송·부원장 승인 미확인. 새 진도표 배정이나 기존 교재·완료 상태 변경 아님';}
   if(f.kind==='director_message_status'&&f.status==='user_reported_sent'){key='weekly-pacing-proposal';label='부원장 DM · 지도 방향 협의';state='사용자 직접 발송 보고';note='기존 초안 이력 보존. 부원장 수신·회신·승인 미확인. 진도 감축 확정·새 진도표 배정 아님';}
   if(f.kind==='parent_understanding_report'&&f.status==='teacher_reported_parent_understands'){key='parent-understanding';label='학부모 상황 이해';state='어머니도 상황 이해 · 사용자 보고';note='사용자가 전한 내용이며 독립 확인이나 모든 후속 계획 동의로 확대하지 않음';}
   if(f.kind==='course_duration_estimate'&&f.status==='teacher_estimate_not_calculated'){key='course-duration-estimate';label='진행 기간에 대한 우려';state=String(f.estimateRaw);note='사용자의 예상. 계산으로 검증한 기간·정확한 교재 완료일 아님';}
   if(f.kind==='concept_blank_teacher_final'&&f.status==='teacher_final_complete'){
    for(const [k,c] of cards)if(c.kind==='concept_blank_test'&&c.label.includes(String(f.bookLabelRaw))&&c.label.includes(String(f.subunitLabelRaw)))cards.delete(k);
    key='concept-final:'+f.bookLabelRaw+':'+f.subunitLabelRaw;label=String(f.bookLabelRaw)+' · '+String(f.subunitLabelRaw)+' 개념백지테스트';state='교사 최종 완료';note='명시된 개념백지테스트만 완료. 소단원 모든 활동 완료 아님';
   }
   if(f.kind==='daily_test_teacher_completion'){key='dt-final:'+JSON.stringify(f.units);label='DailyTest · '+(Array.isArray(f.units)?f.units.join(', '):'범위 확인');state='교사 완료 보고';note='두 소단원 DT만 해당. 상세 회차·문항 범위 미지정. 서버 원점수와 교사 판정 별도';}
   if(f.kind==='daily_test_answer_entry'){key='dt-entry:'+JSON.stringify(f.units);label='DailyTest 앱 답안 입력';state='교사 입력 보고 · 서버 관찰 별도';note='아래 저장된 서버 응시 기록과 대조. 조회만으로 모든 개별 답안 완전성 단정 안 함';}
   if(f.kind==='paper_assessment_plan'){key='paper-assessment:'+String(f.labelRaw??f.label);label=String(f.labelRaw??f.label);state='수업 진행·앱 입력 계획';note='교사 최종 완료·실제 앱 입력은 미확인. 과거 96점과 오늘 프린트를 동일 사건으로 합치지 않음';}
   if(f.kind==='homework_reassigned'){key='page-missing:'+f.bookLabelRaw+':'+f.fromPage+':'+f.throughPage;label=String(f.bookLabelRaw)+' p.'+f.fromPage+'~'+f.throughPage;state='기존 미숙제 재배정';note='새 수행 완료 아님. 제출 기한 미지정';}
   if(f.kind==='clinic_plan_result'&&f.status==='not_performed_today'){for(const [k,c] of cards)if(c.kind==='clinic_plan')cards.delete(k);key='clinic-today';label='클리닉 '+String(f.unitRangeRaw);state='오늘 미진행 · 교사 보고';note='이전 진행 계획은 원문 이력에 보존';}
   if(f.kind==='assessment_guided_solving'){key='guided-assessment';label=String(f.labelRaw);state='교사 문제풀이 지도 중';note='최종 완료 선언 없음';}
   if(f.kind==='pacing_analysis_request'){key='pacing-analysis';label='회당 학습량 조정';state='처음의 느린 속도 고려 · 점진 증가 분석 요청';note='초기 속도를 고정 능력으로 외삽하지 않음. 증가 보장·새 일별 배정 아님';}
   if(f.kind==='print_completion_report'){key='print-and-homework';label='프린트 출력과 실제 숙제';state=String(f.sourceSectionCount)+'개 원천 섹션 출력 보고 · 숙제는 지정 2개만';note='가우스1-1 필수예제·다빈치1-1 분수의 나눗셈(1) 필수예제. 오답/유사 종류·물리 장수 미확인';}
   if(f.kind==='course_duration_goal'){key='course-duration-estimate';label='교재 진행 목표';state=String(f.months)+'개월 · 사용자 목표';note='과거6개월 예상은 이력 보존. 확정 완료일·일별 시행 배정 아님';}
   if(f.kind==='planning_holiday_correction'){key='course-plan-capacity';label='2026-10-16~2027-01-14 월수금 계획창';state='39회 − 사용자 확인 휴일2일 = 37회';note='12/25·1/1 제외. 전체21단위 기준 약1.76회/단위; 남은 미완료 단위수와 다름. 결석 미예측';}
   if(f.kind==='draft_plan_scope_closed'){key='draft-plan-status';label='이현승 학습 계획';state='초안 범위 정리 완료';note='최종 시행 승인·runtime DB 저장·일별 배정 완료 아님';}
   if(f.kind==='parent_message_draft_request'){key='parent-latest-draft';label='학부모 안내 초안';state='스니펫 제공 · 실제 발송 미확인';note='부원장 협의 방향과 목표 안내. 학부모 동의·자동 발송 권한 없음';}
   if(f.kind==='instruction_direction_adopted'&&f.status==='teacher_adopted_direction'){key='weekly-pacing-proposal';label='부원장 협의 · 사용자 채택 방향';state='부원장 답변 확보 · 교사가 지도 방향 채택';note='필요 부분 개념 설명·학기 연산 정확성·중난도 DT 성취 방향. 세부 일별 배정 확정이나 모든 계획 승인으로 확대하지 않음';}
   if(f.kind==='homework_assignment_added'){key='assessment-homework';label=String(f.activity);state='숙제 추가 배정 · '+String(f.dueDate)+'까지';note='남은 문제 풀이와 오답 보완. 기존 두 프린트 유지. 수행·교사 최종 완료 아님';}
   if(f.kind==='homework_daily_answer_entry_schedule'){for(const [k,c] of cards)if(c.kind==='homework_reassigned')cards.delete(k);key='daily-answer-entry-plan';label='다빈치 일별 답안 입력 계획';state=(Array.isArray(f.dailyPlan)?f.dailyPlan:[]).map((p:Row)=>String(p.date)+' p.'+(Array.isArray(p.pages)?p.pages.join('~'):'미확인')+' '+String(p.deadline)).join(' / ');note='마지막 날은 18:00 등원 전. 구간 시작·나머지는 기존 p.112~140에서 도출. 실제 입력·교사 최종 완료 아님';}
   if(key)cards.set(key,{kind:String(f.kind),label,state,reportedAt:e.recordedAt,eventAt:typeof f.eventAt==='string'?f.eventAt:null,sourceId:e.id,note});
  }
  if(e.judgment==='explicit_teacher_final_complete'&&e.scope==='listed_clinic_labels_only'){
   for(const label of new Set(e.rawLabels??[]))cards.set('clinic:'+label,{kind:'clinic',label,state:'교사 최종 완료',reportedAt:e.recordedAt,eventAt:null,sourceId:e.id,note:'종이 채점 전부 정답. 원응시 점수와 별개. 중복 라벨의 실물 장수는 미확인'});
  }
 }
 return [...cards.values()];
}
const esc=(v:unknown)=>String(v??'미확인').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const clockTime=(v:unknown)=>typeof v==='string'&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleTimeString('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false})+' KST':String(v??'미확인');
const time=(v:unknown)=>typeof v==='string'&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour12:false})+' KST':String(v??'미확인');
export function renderLesson(pinned:PinnedLesson|undefined,studentId:string):string{
 if(!pinned)return '';
 const s=pinned.data.students.find(s=>s.studentId===studentId);
 const header=`<section class="book-panel" aria-label="오늘 수업 기록"><h2>${esc(pinned.data.lessonDate)} 수업 기록</h2><p class="hint">별도 수업 자료 구성 시각 ${esc(time(pinned.data.preparedAt))} · 아래 교사 보고 시각과 서버 조회 시각은 각각 다릅니다. 화면 열기 시 재조회하지 않습니다. 맥락 정리 기준 ${esc(time(pinned.data.contextCutoff??pinned.data.preparedAt))}.</p>`;
 if(!s)return header+'<p>이 학생의 수업 추가 자료가 없습니다. 학습 미수행을 뜻하지 않습니다.</p></section>';
 const cards=projectLesson(s).map(c=>`<article class="section-card"><div class="section-body"><b>${esc(c.label)}</b><p>${esc(c.state)}${c.eventAt?' · '+esc(time(c.eventAt)):''}</p><p class="hint">${esc(c.note)}<br>자료 기록 ${esc(time(c.reportedAt))}</p></div></article>`).join('');
 const rubric=s.rubric?`<article class="notice"><h3>개인 평가 기준 · v${esc(s.rubric.version)}</h3><p>소단원당 DailyTest 2회 총8문항 중5~6문항 정답 목표. 정확히62.5~75%, 7~8문항은 목표 이상입니다. 교사 최종 완료·오답 보완은 별도입니다.</p><p class="hint">학기 연산 정확성의 구체 측정 기준은 미정. 필요한 개념 설명 지원. 이 학생·명시 교재에만 적용. 버전 있는 JSON으로 보존하며 runtime DB는 미구현.</p></article>`:'';
 const draftStudent=s.dailyRecordDraft?.student as Row|undefined; const parentInput=draftStudent?.parentInput as Row|undefined;
 const draft=s.dailyRecordDraft?`<article class="notice"><h3>학원 수업일지 · 저장 전 초안</h3><p>서버 조회502 차단 보고. 이 배치에서는 서버 저장·학부모 발송을 하지 않았습니다. 화면 내용은 저장 성공 증거가 아닙니다.</p><p class="hint">${esc(JSON.stringify(draftStudent?.assignedFields??{}))}</p>${['progress','homework','memo'].map(k=>`<h4>${({progress:'진도',homework:'숙제',memo:'메모'} as Record<string,string>)[k]}</h4><p>${parentInput?.[k]===null||parentInput?.[k]===undefined?'미배정 · 기존 서버 값 삭제 금지':esc(parentInput[k]).replace(/\n/g,'<br>')}</p>`).join('')}</article>`:'';
 const timeline=`<details class="evidence"><summary>오늘 전체 근거 이력 · ${s.teacherEvents.length}개 사건 · 확정/보고/계획/미결 구분</summary>${s.teacherEvents.map(e=>`<article><p><b>${esc(time(e.recordedAt))}</b> · ${esc(e.sourceKind)} · ${esc(e.id)}</p><p>${esc(e.sourceText??'전문은 보강 출처를 참조; 이 사건의 최초 기록은 요약')}</p><pre>${esc(JSON.stringify(e.facts??[],null,2))}</pre></article>`).join('')}</details>`;
 const observations=s.observations.map(o=>{const labels:Record<string,string>={assessment:'앱 원응시·채점',assessment_timing:'다빈치 응시일 간격 · 공부 시간 아님',dailyTests:'DailyTest 앱 기록',pendingVideo:'영상 검사 대기',pendingVideos:'영상 검사 대기',dailyRecord:'수업일지 서버 기록'};const rows=Array.isArray(o.rows)?o.rows as Row[]:[];return `<details class="evidence"><summary>${esc(labels[String(o.kind)])} · 조회 ${esc(time(o.observedAt))}${o.scope?' · '+esc(o.scope):''}</summary>${o.kind==='assessment_timing'?'<p class="hint">'+esc(o.scope)+' '+rows.length+'행 범위의 저장된 관찰입니다. 화면 원필드 ‘응시일’, 분 단위, 한국시간 가정. 최초 답안 입력·제출·수정 중 어떤 시각인지는 미확인입니다. 간격은 실제 공부 시간이 아닙니다. p.111 수행 / p.112~140 미숙제는 별도 교사 보고이며 이 기록에서 추정하지 않습니다.</p>':''}${rows.map(r=>`<p>${esc(r.label)} · ${esc(r.sourceAttemptAt??r.sourceUploadedAt)}${r.score!==undefined?' · 원응시 '+esc(r.score)+'점':''}${r.statusRaw!==undefined?' · '+esc(r.statusRaw):''}${o.kind==='assessment_timing'?' · 직전 표시 시각과 '+(r.gapMinutes===null?'비교 기준 없음':esc(r.gapMinutes)+'분 간격')+(r.crossesDate?' · 날짜 넘어감':''):''}</p>`).join('')}${o.kind==='dailyRecord'?`<p>진도: ${esc(o.progress||'빈 칸')}<br>숙제: ${esc(o.homework||'빈 칸')}</p><p class="hint">빈 칸은 결석·미수행의 증거가 아닙니다.</p>`:''}</details>`;}).join('');
 return header+`<h3>교사 보고 · 오늘의 판정</h3>${cards}${rubric}${draft}${timeline}<h3>저장된 서버 관찰</h3><p class="hint">앱의 미학습 표시나 점수로 위 교사 최종 판정을 취소하지 않습니다. 조회 범위 밖 기록·종이 숙제 수행 여부는 추정하지 않습니다.</p>${observations}<p class="hint">수업 자료 SHA-256 ${esc(pinned.sha256)}</p></section>`;
}

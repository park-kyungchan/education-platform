import {mountStudentEventView} from './student-event-view.ts';
import {academyDate} from './academy-read-model.ts';

/** Receives only authenticated response data; never imports private history fixtures. */
function reportText(event:any,studentId:string,hasLaterPlan:boolean):string {
 if(!event||event.source!=='user_report'||event.studentId!==studentId||!event.payload||typeof event.payload!=='object')throw Error('invalid_teacher_report');
 const p=event.payload;
 const text=(v:unknown)=>{if(typeof v!=='string'||!v.length||v.length>2000)throw Error('invalid_report_text');return v;};
 const count=(v:unknown)=>{if(!Number.isSafeInteger(v)||(v as number)<0||(v as number)>1000)throw Error('invalid_report_count');return v;};
 if(event.kind==='assignment_due_update'){
  if(typeof p.dueDate!=='string'||!/^\d{4}-\d\d-\d\d$/.test(p.dueDate)||!p.makeup||p.makeup.status!=='confirmed_existing_schedule')throw Error('invalid_due_update');
  return '숙제 기한 변경: '+text(p.dueDate)+' '+text(p.deadlineContext)+' · 보강 '+text(p.makeup.start)+'~'+text(p.makeup.end)+' '+text(p.makeup.teacher)+' 선생님 · 다음 정규 출석 '+text(p.nextRegularAttendanceDate);
 }
 if(event.kind==='care_update'){
  const checklist=event.effectiveChecklist??p.checklist;
  if(!Array.isArray(checklist)||checklist.length>30)throw Error('invalid_checklist');
  const labels:Record<string,string>={pending:'완료 미확인',reported_missing:'미완료 사용자 확인',assigned:'숙제 배정',planned:'예정',completed_user_report:'사용자 완료 확인'};
  return checklist.map((c:any)=>{if(!c||!Object.hasOwn(labels,c.status)||typeof c.dueDate!=='string'||!/^\d{4}-\d\d-\d\d$/.test(c.dueDate)||c.completedAt!==null||c.evidence!=='user_report')throw Error('invalid_checklist_item');return text(c.label)+' ['+labels[c.status]+'] · '+c.dueDate+' · '+text(c.detail);}).join('\n');
 }
 if(event.kind==='class_activity'){
  if(p.status!=='in_progress'||p.distribution!=='planned')throw Error('invalid_activity_state');
  return (hasLaterPlan?'이전 교사 보고: ':'교사 보고: ')+text(p.activity)+' 진행 중 · '+(hasLaterPlan?'종료 여부 미확인':text(p.afterwards)+' 예정');
 }
 if(event.kind==='instruction_update'){
  if(p.planStatus!=='planned'||p.gradingCompletedAt!==null||p.clinicDistribution!=='deferred_after_textbook_work'||!Array.isArray(p.pages)||p.pages.length!==2||!p.pages.every((x:unknown)=>Number.isSafeInteger(x)&&(x as number)>0&&(x as number)<10000)||!Array.isArray(p.priorityPlan)||p.priorityPlan.length<1||p.priorityPlan.length>5)throw Error('invalid_instruction_plan');
  return '최신 교사 계획: '+text(p.bookRaw)+' p.'+p.pages.join('~')+' '+text(p.sectionRaw)+' · '+p.priorityPlan.map(text).join(' → ')+' 우선 · 클리닉 배부 후순위 · 완료 미확인';
 }
 if(event.kind==='printing'){if(p.distribution!=='planned')throw Error('invalid_print_plan');return '교사 보고: 프린트 헤더 '+count(p.printedHeaderCount)+'건 인쇄 · 당시 배부 예정';}
 if(event.kind==='video_plan'){if(p.status!=='planned'||p.filmedAt!==null||p.uploadedAt!==null)throw Error('invalid_video_plan');return '교사 보고: 미업로드 영상 '+count(p.missingUploadCount)+'개 · '+text(p.plan);}
 return '';
}

/** A user-triggered saved-summary read. Never triggers a live refresh. */
export function mountTodayPreparation(target:HTMLElement,onUnauthorized:()=>void){
  const document=target.ownerDocument,section=document.createElement('section');section.className='today-preparation';section.setAttribute('aria-label','오늘 수업 준비');
  const title=document.createElement('h2');title.textContent='오늘 수업 준비';
  const date=document.createElement('p');date.className='today-date';date.textContent=academyDate()+' · 한국 시간';
  const status=document.createElement('p');status.setAttribute('role','status');status.textContent='오늘 학원 자료 미조회 · 확인된 오늘 할 일 수는 미확인입니다.';
  const sessions=document.createElement('div');sessions.className='today-sessions';
  for(const label of ['1부','2부']){const row=document.createElement('p');row.textContent=label+' · 학생 배정·숙제·검토 범위 미확인';sessions.append(row);}
  const button=document.createElement('button');button.type='button';button.textContent='오늘 준비 요약 확인';button.setAttribute('data-today-summary','');
  const note=document.createElement('p');note.className='today-note';note.textContent='저장자료에서 확인 가능한 범위를 봅니다. 빈 목록은 할 일이 없다는 뜻이 아닙니다. 학생별 과거 근거는 아래 레일에서 확인하세요.';
  const detail=document.createElement('p');detail.className='today-note';detail.textContent='과거: 저장 근거 · 미확인: 오늘 DailyRecord와 1·2부 배정 · 상충: 오늘 자료 대조 전';
  section.append(title,date,status,sessions,button,note,detail);target.prepend(section);
  let currentEventHandle:ReturnType<typeof mountStudentEventView>|null=null;
  let active=true,request:AbortController|null=null;
  const click=async()=>{request?.abort();request=new AbortController();button.disabled=true;status.textContent='보호된 저장 요약을 확인하고 있습니다.';
    try{const response=await fetch('/api/academy/today',{method:'POST',credentials:'same-origin',redirect:'manual',headers:{'Content-Type':'application/json'},body:JSON.stringify({date:academyDate(),session:'all'}),signal:request.signal});
      if(!active)return;
      if(response.status===401||response.status===403||response.type==='opaqueredirect'||response.redirected||(response.status>=300&&response.status<400)||!response.headers.get('content-type')?.includes('application/json')){onUnauthorized();return;}
      const data=await response.json();if(!active)return;
      const result=data.result;if(!response.ok||data.status!=='success'||result?.domain!=='academy'||result?.kind!=='daily_preparation'||result?.sourceMode!=='saved_snapshot'||result?.liveRefreshConnected!==false||!['unverified','preserved_partial_evidence'].includes(result?.current?.state))throw Error('verified_today_summary_required');
      currentEventHandle?.dispose();currentEventHandle=null;if(result.studentEventOverlay)currentEventHandle=mountStudentEventView(section,result.studentEventOverlay);
      date.textContent=result.requestedDate+' · 한국 시간';
      if(result.current.state==='preserved_partial_evidence'){
        const tasks=result.current.tasks;
        if(result.requestedDate!==academyDate()||!Array.isArray(tasks)||tasks.length!==result.taskCount||!tasks.length||tasks.some((t:any)=>typeof t.studentId!=='string'||typeof t.displayName!=='string'||![1,2].includes(t.session)||t.assignment?.dueDate!==result.requestedDate||typeof t.assignment?.text!=='string'||t.completion!=='unknown'||t.teacherDecision!==null||t.bookId!==null||t.sectionId!==null)||result.historyImport?.coverage!=='partial'||result.historyImport?.liveRefreshConnected!==false)throw Error('invalid_preserved_today');
        const reportTexts=new Map(tasks.map((task:any)=>{
          const reports=task.relatedUserReports??[];if(!Array.isArray(reports)||reports.length>100)throw Error('invalid_report_list');
          return [task.studentId,reports.map((e:any)=>reportText(e,task.studentId,reports.some((x:any)=>x.kind==='instruction_update'))).filter(Boolean)];
        }));
        sessions.replaceChildren();
        for(const part of [1,2]){
          const heading=document.createElement('h3');heading.textContent=part+'부';sessions.append(heading);
          for(const task of tasks.filter((t:any)=>t.session===part)){
            const row=document.createElement('p');row.textContent=task.displayName+' · '+task.assignment.text+' · 숙제 완료/교사 확인 미확인';sessions.append(row);
            for(const text of (reportTexts.get(task.studentId)??[]) as string[]){const item=document.createElement('p');item.className='today-note';item.textContent=text;item.style.whiteSpace='pre-line';sessions.append(item);}
          }
        }
        status.textContent='보존된 오늘 과제 '+tasks.length+'건 · 실시간 재조회 아님';
        detail.textContent='조회 근거와 교사 보고를 구분했습니다. 교재·소단원 ID 연결은 확인 중이며, 반 배정은 출석 확인을 뜻하지 않습니다. 최신 관측: '+(result.historyImport.latestObservedAt??'미확인');
        return;
      }
      sessions.replaceChildren();for(const label of ['1부','2부']){const row=document.createElement('p');row.textContent=label+' · 학생 배정·숙제·검토 범위 미확인';sessions.append(row);}
      status.textContent='저장 요약 확인 · 오늘 학원 자료는 아직 미조회입니다.';
      detail.textContent='현재 할 일: 미확인 · 과거: 학생별 저장 근거 · 미확인: 오늘 DailyRecord와 반 배정 · 상충: 오늘 자료 대조 전';
    }catch(error){if(active&&!(error instanceof Error&&error.name==='AbortError'))status.textContent='저장 요약을 확인하지 못했습니다. 오늘 자료는 미확인 상태로 유지합니다.';}
    finally{if(active)button.disabled=false;}
  };
  button.addEventListener('click',click);
  return {dispose(){active=false;currentEventHandle?.dispose();request?.abort();button.removeEventListener('click',click);section.remove();}};
}

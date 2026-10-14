import {conceptGraphView} from './conceptGraphView';
import {bookCertificationView} from './bookCertificationView';
import {teacherActivitySummary} from '../teacherWorkspace';
import {examWorkspaceView} from './examWorkspaceView';
import {teacherWorkspaceView} from './teacherWorkspaceView';
import {operatingWorkspaceView} from './operatingWorkspaceView';
import type { StudentLearningScene as Scene,TeacherCohort as Cohort } from '../contracts/teacherOperations';
import { dateClassView, occurrenceIdentity, requestGate, type DateClassPreparation, type DateClassRow } from './dateClassView';
import {preparationView} from './preparationView';
import {connectionView} from './connectionView';
import {observationEditor} from './teacherObservationEditor';
import {learningWorkView,catalogKindLabels} from './learningWorkView';
import {clinicWorkView,revealClinicProposal} from './clinicWorkView';
import {clinicDecisionKinds,type ClinicDecision} from '../classroomCyclePolicy';
import {sameClinicTarget} from '../learningWork';
import {sameTeacherScope,teacherActionHeaders} from '../teacherActionScope';
import {SourceRefreshRequest,type SourceRefreshReply} from './sourceRefreshRequest';
import {privateArtifactView} from './privateArtifactView';

const element=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const status=(text:string)=>{element('status').textContent=text;};
let setupMode=false,recoveryReady=false,selectedStudentId:string|null=null,currentScene:Scene|null=null;
let cohortStudents:Cohort['students']=[],selectedOccurrence:DateClassRow|null=null,lastClass:DateClassPreparation|null=null;
const classRequests=requestGate(),studentRequests=requestGate();
let refreshRunning=false;
let sourceRefreshDisabled=true,sourceAreaRefresh=false;
let cohortScope:Cohort['teacherScope']|null=null,sourceRequests:SourceRefreshRequest|null=null;
function sourceController(){
  const scope=currentScene?.teacherScope??cohortScope;if(!scope)throw Error('teacher_scene_required');
  if(!sourceRequests||!sameTeacherScope(sourceRequests.scope,scope))sourceRequests=new SourceRefreshRequest(scope,
    input=>api('/api/refresh',{method:'POST',headers:{'Content-Type':'application/json',...teacherActionHeaders(scope)},body:JSON.stringify(input)}),
    ()=>api('/api/source-refresh-pending'),id=>api('/api/source-refresh-result?requestId='+encodeURIComponent(id)));
  return sourceRequests;
}
async function recoverSourceRefresh(cursor:string|null=null){
  const button=element<HTMLButtonElement>('recover-source-refresh');if(refreshRunning)return;button.disabled=true;
  try{
    const controller=sourceController(),result=cursor===null?await controller.recover():null;
    const page=result?null:controller.history(await api('/api/source-refresh-history'+(cursor?'?cursor='+encodeURIComponent(cursor):'')));
    const currentScope=currentScene?.teacherScope??cohortScope;
    if(!currentScope||!sameTeacherScope(controller.scope,currentScope))return;
    element('refresh-status').textContent=result?'기존 갱신 요청 · '+result.status+' · 새 조회를 시작하지 않았습니다.':'보존된 갱신 요청 결과를 확인했습니다. 새 조회를 시작하지 않았습니다.';
    showSourceAreas(result);
    document.getElementById('source-refresh-history')?.remove();
    if(page){
      const history=node('section','');history.id='source-refresh-history';history.append(node('h3','보존된 갱신 요청 (요청 ID순, 최신순 아님)'));
      if(!page.rows.length)history.append(node('p','이 범위에서 보존된 요청이 없습니다. 원본 자료의 완전성을 뜻하지 않습니다.'));
      for(const row of page.rows){const label=row.studentId?(cohortStudents.find(student=>student.id===row.studentId)?.displayName??'기존 요청 학생'):'전체 학생';history.append(node('p',label+(row.date?' · '+row.date:'')+' · '+row.status+' · '+row.requestId+(row.reason?' · '+row.reason:'')));if(row.areas?.length)history.append(sourceAreaDetails(row));}
      if(page.nextCursor){const next=node('button','다음 요청 보기') as HTMLButtonElement;next.type='button';next.addEventListener('click',()=>{next.disabled=true;void recoverSourceRefresh(page.nextCursor).finally(()=>{next.disabled=false;});});history.append(next);}
      element('refresh-status').insertAdjacentElement('afterend',history);
    }
  }catch{element('refresh-status').textContent='기존 갱신 요청 결과를 확인하지 못했습니다. 새 조회 없이 원래 요청을 유지합니다.';}
  finally{button.disabled=false;}
}
async function api<T>(path:string,options:RequestInit={}):Promise<T>{
  const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options});
  const data=await response.json();if(!response.ok)throw Object.assign(Error(data.error??data.reason??'request_failed'),{requestOutcome:data.requestOutcome??null});return data as T;
}
const post=<T>(path:string,value:unknown)=>api<T>(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
function node(tag:string,text:string,className=''):HTMLElement{const result=document.createElement(tag);result.textContent=text;result.className=className;return result;}
function sourceAreaDetails(reply:SourceRefreshReply){
  const details=node('details',''),labels:Record<string,string>={student_course:'수강 등록',day_record:'수업·숙제',textbook:'교재 성적',daily_zero:'DT/ZT'},states={observed:'조회·저장 확인',pending:'확인 대기',blocked:'조회 보류',failed:'검증·저장 실패'};
  details.append(node('summary','추가 영역별 갱신 결과'+(reply.date?' · '+reply.date:'')));
  for(const area of reply.areas??[]){const name=cohortStudents.find(student=>student.id===area.studentId)?.displayName??'기존 요청 학생';details.append(node('p',name+' · '+(labels[area.family]??area.family)+' · '+states[area.status]+(area.observedAt?' · source 조회 '+area.observedAt:'')+(area.reason?' · '+area.reason:'')));}
  details.append(node('p','기존에 연결된 범위의 결과입니다. 새 과제·새 시험·전체 목록의 발견이나 학습 완료를 뜻하지 않습니다. 실패한 영역의 이전 근거는 유지합니다.','muted'));
  return details;
}
function showSourceAreas(reply:SourceRefreshReply|null){
  document.getElementById('source-area-results')?.remove();
  if(reply?.areas?.length){const details=sourceAreaDetails(reply);details.id='source-area-results';element('refresh-status').insertAdjacentElement('afterend',details);}
}
function renderConnection(value:unknown){
  const view=connectionView(value);sourceRefreshDisabled=view.refreshDisabled;sourceAreaRefresh=view.areaRefreshEnabled;
  const target=element('source-connection');target.hidden=false;
  target.textContent=[view.retainedLabel,view.acquisitionLabel,view.journalLabel,view.sendLabel].join('\n');
  element<HTMLButtonElement>('refresh-all').disabled=refreshRunning||sourceRefreshDisabled;
  element<HTMLButtonElement>('refresh-student').disabled=refreshRunning||sourceRefreshDisabled||!currentScene;
}
let observationLifetime:AbortController|null=null;
function renderScene(scene:Scene){
  observationLifetime?.abort();observationLifetime=new AbortController();
  const lifetime=observationLifetime,sceneTicket=studentRequests.snapshot();
  currentScene=scene;selectedStudentId=scene.student.id;
  // Capture this scene, not whichever actor or student is current at dispatch time.
  const write=<T>(path:string,value:unknown)=>api<T>(path,{method:'POST',headers:{'Content-Type':'application/json',...teacherActionHeaders(scene.teacherScope)},body:JSON.stringify(value)});
  const adoptScene=(fresh?:Scene,occurrence?:DateClassRow)=>{
    if(!lifetime.signal.aborted&&currentScene===scene&&studentRequests.current(sceneTicket)&&selectedStudentId===scene.student.id&&element<HTMLInputElement>('lesson-date').value===scene.preparation.date){
      if(fresh){if(occurrence){selectedOccurrence=occurrence;renderOccurrence(occurrence);}studentRequests.begin();renderScene(fresh);}else void showStudent(scene.student.id,selectedOccurrence);
    }
  };
  renderConnection(scene.connection);
  element('student-title').textContent=scene.student.displayName;element<HTMLButtonElement>('refresh-student').disabled=refreshRunning||sourceRefreshDisabled;
  const target=element('scene');target.replaceChildren();
  target.append(node('div','학원 근거를 읽어온 시각과 DB에 보존한 시각을 구분합니다. 원본 채점은 교사 검토·숙련도 판정이 아닙니다.','notice'));
  const tags=node('details','','hierarchy-scope scope-note');tags.append(node('summary','목차 연결 범위'));
  const levels=node('ul','');for(const level of scene.hierarchy.levels)levels.append(node('li',catalogKindLabels[level]+(scene.hierarchy.unknownLevels.includes(level)?' · 연결 미확인':' · 보존 목차 있음')));tags.append(levels);target.append(tags);
  const grid=node('div','','grid');
  for(const book of scene.books){
    if(book.source.kind!=='source_book_registration')continue;
    const card=node('section','','card');card.append(node('div','교재 · 변경 이력 보존','muted'),node('h3',book.displayName,'label'),node('div',book.source.sourceProgressLiteral,'metric'));
    card.append(node('p','source 상태: '+book.source.sourceStatus,'muted'));
    card.append(node('p','마지막 source 검증: '+new Date(book.lastVerifiedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}),'muted'));
    card.append(node('p','주교재/부교재 역할과 실제 배정 유효기간은 별도 교사 근거가 필요합니다.','muted'));
    const detail=node('details','');detail.append(node('summary','원문 라벨·근거·버전 보기'),node('pre',JSON.stringify({sourceCourse:book.source.sourceCourse,sourceBook:book.source.sourceBook,sourceUserCourse:book.source.sourceUserCourse,sourceLearningRange:book.source.sourceLearningRangeLiteral,revisionId:book.revisionId,recordedAt:book.recordedAt,evidenceRefs:book.source.evidenceRefs},null,2)));card.append(detail);grid.append(card);
  }
  const registrationDetails=node('details','','card');registrationDetails.append(node('summary','교재 등록·원문 근거'),grid);
  target.append(learningWorkView(scene.workContext,{studentId:scene.student.id,date:scene.preparation.date,revision:scene.sceneRevision}),registrationDetails);
  target.append(clinicWorkView(scene,api,write,lifetime.signal,adoptScene));
  const preparation=preparationView(scene.preparation,scene.preparation.date),history=node('section','','card');
  history.append(node('h3','소단원별 보존 이력 · '+preparation.date),node('p',preparation.coverageLabel+' · 영상 완료는 문제풀이·종이 검사 완료가 아닙니다.','notice'));
  for(const book of preparation.books){const detail=node('details','');detail.append(node('summary',book.label+' · '+book.coverageLabel));
    for(const unit of book.units){const line=node('div','','card');line.append(node('strong',unit.label),node('p',unit.videoLabel),node('p',unit.dutyLabel,'muted'));
      if(unit.referenceSubmissionCount)line.append(node('p','추가 참고 제출 '+unit.referenceSubmissionCount+'건 · 기존 완료 유지','muted'));
      const refs=node('details','');refs.append(node('summary','판정·원본 참조'),node('pre',JSON.stringify({teacherRevisionRefs:unit.teacherRevisionRefs,sourceVideoRefs:unit.sourceVideoRefs},null,2)));line.append(refs);detail.append(line);}
    history.append(detail);}
  target.append(history);
  target.append(observationEditor(scene,selectedOccurrence,api,write,lifetime.signal,adoptScene));
  target.append(teacherWorkspaceView(scene,api,write,lifetime.signal));
  target.append(bookCertificationView(scene,api,lifetime.signal));
  target.append(conceptGraphView(scene,api,write,lifetime.signal));
  const evidence=node('section','','card');evidence.append(node('h3','수업·문항·채점 근거'));
  evidence.append(node('p',scene.evidence.length?'원문 source와 독립 상태를 유지한 근거가 있습니다.':'아직 연결된 수업·문항·성적 근거가 없습니다. 미수행으로 판정하지 않습니다.','muted'));
  for(const row of scene.evidence){const detail=node('details','');detail.append(node('summary',row.payload.kind+' · '+new Date(row.lastVerifiedAt).toLocaleString('ko-KR')),node('pre',JSON.stringify(row.payload,null,2)));evidence.append(detail);}target.append(evidence);
  const context=node('details','','card');context.append(node('summary','에이전트와 교사를 위한 typed 업무 맥락'),node('pre',JSON.stringify({workContext:scene.workContext,connection:scene.connection,allowedOperations:scene.allowedOperations,knowledge:scene.knowledge,limits:scene.limits},null,2)));target.append(context);
  document.querySelectorAll('[data-student-id]').forEach(button=>{const data=(button as HTMLElement).dataset;button.classList.toggle('selected',data.studentId===scene.student.id&&(!data.occurrenceIdentity||(selectedOccurrence!==null&&data.occurrenceIdentity===occurrenceIdentity(selectedOccurrence))));});
}
function renderOccurrence(row:DateClassRow|null){
  const target=element('occurrence-context');target.replaceChildren();
  if(!row){target.append(node('p','등록 학생의 전체 근거 보기입니다. 특정 수업·과제와의 연결을 뜻하지 않습니다.','muted'));return;}
  const card=node('section','','card');card.append(node('h3',row.occurrence.date+' · '+row.studentName+' · 선택 수업 원문'));
  card.append(node('p','group '+row.occurrence.groupId+' · record '+row.occurrence.recordKey+' · membership '+row.occurrence.membershipKey,'muted'));
  const table=node('table','','source-fields');for(const [key,value] of Object.entries(row.fields)){const tr=node('tr','');tr.append(node('th',key),node('td',value||'원문 빈 값 · 미수행 판정 아님'));table.append(tr);}card.append(table);
  card.append(node('p','source 관측: '+row.sourceObservedAt+' · 마지막 검증: '+row.lastVerifiedAt,'muted'));
  card.append(node('p','과제↔예습 · 과제↔풀이/채점 · 오답 교사 확인 · 교사 검토: 모두 연결 미확인. 아래 학생 전체 근거가 이 수업의 과제라는 뜻은 아닙니다.','notice'));
  target.append(card);
}
async function showStudent(id:string,occurrence:DateClassRow|null=null){
  observationLifetime?.abort();
  const ticket=studentRequests.begin();selectedStudentId=id;selectedOccurrence=occurrence;currentScene=null;
  element('scene').replaceChildren(node('p','선택 학생의 근거 조회 중…','muted'));element('student-title').textContent=cohortStudents.find(student=>student.id===id)?.displayName??'학생 근거 조회 중';element<HTMLButtonElement>('refresh-student').disabled=true;
  renderOccurrence(occurrence);status('학생 근거 조회 중…');
  const date=occurrence?.occurrence.date??element<HTMLInputElement>('lesson-date').value;
  try{const scene=await api<Scene>('/api/student?id='+encodeURIComponent(id)+'&date='+encodeURIComponent(date));if(!studentRequests.current(ticket))return;if(scene.student.id!==id||scene.preparation.date!==date)throw Error('student_scene_scope_conflict');renderScene(scene);status('보존된 학생 전체 근거를 표시했습니다. 선택 수업 연결과 source 검증 시각은 별개입니다.');}
  catch(error){if(studentRequests.current(ticket))status('조회하지 못했습니다: '+(error as Error).message);}
}
async function showDate(date:string,preferred:DateClassRow|null=null){
  observationLifetime?.abort();
  const ticket=classRequests.begin(),selectionAtStart=studentRequests.begin();selectedStudentId=null;selectedOccurrence=null;currentScene=null;
  element<HTMLButtonElement>('refresh-student').disabled=true;element('student-title').textContent='수업 또는 등록 학생을 선택하세요';element('scene').replaceChildren();element('occurrence-context').replaceChildren();
  element('class-list').querySelectorAll('button').forEach(button=>(button as HTMLButtonElement).disabled=true);
  element('class-status').textContent=date+' 조회 중…'+(lastClass?' 이전 '+lastClass.date+' 근거는 현재 선택 날짜의 결과가 아닙니다.':'');
  try{
    const source=await api<DateClassPreparation>('/api/class?date='+encodeURIComponent(date));if(!classRequests.current(ticket))return;
    const view=dateClassView(source,date,cohortStudents);lastClass=source;
    element('class-title').textContent=date+' · 수업 준비';element('class-status').textContent='관측된 수업 '+view.occurrenceCount+'건 · 학생 '+view.studentCount+'명 · 현재 출석 명단 완전성 미확인. '+(view.occurrenceCount?'같은 학생의 다른 group/수업도 생략하지 않습니다.':'이 날짜의 검증된 수업 근거가 없습니다. 학생 없음·결석·미수행을 뜻하지 않습니다.');
    const list=element('class-list');list.replaceChildren();
    for(const row of view.rows){const button=node('button','','class-occurrence') as HTMLButtonElement;button.dataset.studentId=row.studentId;button.dataset.recordKey=row.occurrence.recordKey;button.dataset.membershipKey=row.occurrence.membershipKey;button.dataset.occurrenceIdentity=occurrenceIdentity(row);
      button.append(node('strong',row.studentName),node('span','group '+row.occurrence.groupId+' · record '+row.occurrence.recordKey),node('small',Object.entries(row.fields).map(([key,value])=>key+': '+value).join(' · ')),node('small','마지막 source 검증: '+row.lastVerifiedAt));button.addEventListener('click',()=>showStudent(row.studentId,row));list.append(button);}
    history.replaceState(null,'','/?date='+encodeURIComponent(date));
    const selected=preferred?view.rows.find(row=>occurrenceIdentity(row)===occurrenceIdentity(preferred)):view.rows[0];
    if(selected&&studentRequests.current(selectionAtStart))await showStudent(selected.studentId,selected);
  }catch(error){if(classRequests.current(ticket))element('class-status').textContent=date+' 조회 실패: '+(error as Error).message+(lastClass?' · 이전 '+lastClass.date+' 근거와 검증 시각을 유지합니다.':' · 이전 검증 근거 없음.');}
}
async function loadWorkspace(){
  const cohort=await api<Cohort>('/api/cohort');element('auth').hidden=true;element('workspace').hidden=false;
  document.getElementById('source-refresh-history')?.remove();
  document.getElementById('source-area-results')?.remove();
  if(!cohortScope||!sameTeacherScope(cohortScope,cohort.teacherScope))element('refresh-status').textContent='';
  cohortScope=cohort.teacherScope;
  document.getElementById('operating-workspace')?.remove();
  const operating=operatingWorkspaceView(cohort.teacherScope,api,<T>(path:string,value:unknown)=>api<T>(path,{method:'POST',headers:{'Content-Type':'application/json',...teacherActionHeaders(cohort.teacherScope)},body:JSON.stringify(value)}));
  element('workspace').querySelector('main')!.append(operating);
  document.getElementById('exam-workspace')?.remove();
  element('workspace').querySelector('main')!.append(examWorkspaceView(cohort.teacherScope,api,<T>(path:string,value:unknown)=>api<T>(path,{method:'POST',headers:{'Content-Type':'application/json',...teacherActionHeaders(cohort.teacherScope)},body:JSON.stringify(value)})));
  document.getElementById('private-artifact-workspace')?.remove();
  element('workspace').querySelector('main')!.append(privateArtifactView(()=>api('/api/private-artifacts')));
  if(!document.getElementById('recover-source-refresh')){
    const recover=node('button','기존 갱신 요청·결과 확인') as HTMLButtonElement;recover.id='recover-source-refresh';recover.type='button';
    recover.addEventListener('click',()=>recoverSourceRefresh());element('refresh-all').insertAdjacentElement('afterend',recover);
  }
  renderConnection(cohort.connection);
  const list=element('students');list.replaceChildren();for(const student of cohort.students){const button=node('button',student.displayName) as HTMLButtonElement;button.dataset.studentId=student.id;button.addEventListener('click',()=>showStudent(student.id));list.append(button);}
  cohortStudents=cohort.students;const dates=element('observed-dates');dates.replaceChildren();for(const date of cohort.availableLessonDates){const option=document.createElement('option');option.value=date;dates.append(option);}
  const requested=new URLSearchParams(location.search).get('date');
  element<HTMLInputElement>('lesson-date').value=requested??new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  await showDate(element<HTMLInputElement>('lesson-date').value);
}
async function refresh(studentId:string|null){
  if(sourceRefreshDisabled){element('refresh-status').textContent='직접 HTTP 인증 연결 전에는 학원 갱신을 실행하지 않습니다. 보존 자료는 계속 조회할 수 있습니다.';return;}
  if(refreshRunning)return;refreshRunning=true;
  const priorId=selectedStudentId,priorOccurrence=selectedOccurrence,date=element<HTMLInputElement>('lesson-date').value;
  const classTicket=classRequests.snapshot(),studentTicket=studentRequests.snapshot();
  const label=studentId?(cohortStudents.find(student=>student.id===studentId)?.displayName??'선택 학생'):'전체 학생';
  const refreshStatus=(text:string)=>{element('refresh-status').textContent=label+' · '+text;};
  refreshStatus('source 갱신 중…');
  for(const id of ['refresh-all','refresh-student'])element<HTMLButtonElement>(id).disabled=true;
  try{
    const controller=sourceController(),result=await controller.refresh(studentId,sourceAreaRefresh?date:undefined),scope=currentScene?.teacherScope??cohortScope;
    if(!scope||!sameTeacherScope(controller.scope,scope))return;
    const actualLabel=result.studentId?(cohortStudents.find(student=>student.id===result.studentId)?.displayName??'기존 요청 학생'):'전체 학생';
    element('refresh-status').textContent=actualLabel+(result.date?' · '+result.date:'')+' · 갱신 요청 결과: '+result.status+(result.reason?' · '+result.reason:'')+' · 다른 영역과 이전 검증 근거는 유지합니다.';
    showSourceAreas(result);
    if(!['observed','partial'].includes(result.status)||result.studentId!==studentId||result.date!==undefined&&result.date!==date)return;
    if(classRequests.current(classTicket)&&studentRequests.current(studentTicket)&&priorId===selectedStudentId&&priorOccurrence===selectedOccurrence&&date===element<HTMLInputElement>('lesson-date').value){
      if(priorOccurrence)await showDate(date,priorOccurrence);else if(priorId)await showStudent(priorId);
    }
  }catch(error){refreshStatus('갱신하지 못했습니다: '+(error as Error).message+' · 이전 근거는 유지합니다.');}
  finally{refreshRunning=false;element<HTMLButtonElement>('refresh-all').disabled=sourceRefreshDisabled;element<HTMLButtonElement>('refresh-student').disabled=sourceRefreshDisabled||!currentScene;}
}
element<HTMLFormElement>('login-form').addEventListener('submit',async event=>{
  event.preventDefault();const button=element<HTMLButtonElement>('login-submit');button.disabled=true;
  try{await post(setupMode?'/api/setup-user':'/api/login',{username:element<HTMLInputElement>('username').value,password:element<HTMLInputElement>('password').value});element<HTMLInputElement>('password').value='';await loadWorkspace();await registerSemanticTools();status('교사 계정으로 연결됐습니다.');}
  catch(error){status('로그인하지 못했습니다: '+(error as Error).message);}
  finally{button.disabled=false;}
});
element('refresh-all').addEventListener('click',()=>refresh(null));element('refresh-student').addEventListener('click',()=>refresh(selectedStudentId));
element('load-class').addEventListener('click',()=>showDate(element<HTMLInputElement>('lesson-date').value));
element('lesson-date').addEventListener('change',()=>showDate(element<HTMLInputElement>('lesson-date').value));
element<HTMLButtonElement>('request-recovery').addEventListener('click',async()=>{
  const button=element<HTMLButtonElement>('request-recovery');button.disabled=true;
  try{
    const result=await post<{requestRef:string;expiresAt:number}>('/api/password-recovery-request',{});
    element('recovery-request').textContent='복구 요청: '+result.requestRef+' · 요청 기한: '+new Date(result.expiresAt*1000).toISOString();
    element('recovery-request').dataset.expiresAt=String(result.expiresAt);
    status('소유자 확인을 기다립니다. 요청 번호만으로는 비밀번호를 변경할 수 없습니다. 승인 후 이 페이지를 새로고침하세요.');
  }catch{button.disabled=false;status('복구 요청을 만들지 못했습니다. 잠시 후 다시 확인하세요.');}
});
element<HTMLFormElement>('password-reset-form').addEventListener('submit',async event=>{
  event.preventDefault();
  if(!recoveryReady)return;
  const password=element<HTMLInputElement>('reset-password'),confirmation=element<HTMLInputElement>('reset-password-confirm'),button=element<HTMLButtonElement>('password-reset-submit');
  if(password.value!==confirmation.value){status('새 비밀번호와 확인 값이 다릅니다.');return;}
  button.disabled=true;
  try{
    const result=await post<{username:string}>('/api/password-reset',{password:password.value});
    password.value='';confirmation.value='';recoveryReady=false;
    element('password-recovery').hidden=true;element('auth').hidden=false;
    element<HTMLInputElement>('username').value=result.username;element<HTMLInputElement>('password').value='';
    history.replaceState(null,'','/');status('비밀번호를 변경했습니다. 기존 로그인은 만료됐습니다. 새 비밀번호로 로그인하세요.');
  }catch(error){status('재설정 응답을 확인하지 못했습니다: '+(error as Error).message+' · 저장됐을 수도 있으므로 먼저 새 비밀번호로 로그인하세요. 링크를 다시 제출하지 마세요.');}
  finally{button.disabled=false;}
});
async function registerSemanticTools(){
  const modelContext=(document as Document&{modelContext?:{registerTool:(tool:unknown)=>unknown}}).modelContext;
  if(!modelContext?.registerTool)return;
  await modelContext.registerTool({
    name:'propose_clinic_review',description:'Open an exact currently selected assignment/attempt/item for visible teacher review. This proposal does not record inspection or completion. The teacher must explicitly inspect and confirm in the same UI; no academy generation, printing, official save or send.',
    inputSchema:{type:'object',additionalProperties:false,required:['studentId','date','sceneRevision','assignmentRevisionId','attemptEntityId','attemptRevisionId','assignedItemId','expectedRevisionId','decision'],properties:{studentId:{type:'string',maxLength:200},date:{type:'string',maxLength:10},sceneRevision:{type:'string',maxLength:200},assignmentRevisionId:{type:'string',maxLength:200},attemptEntityId:{type:'string',maxLength:200},attemptRevisionId:{type:'string',maxLength:200},assignedItemId:{type:'string',maxLength:200},expectedRevisionId:{type:['string','null'],maxLength:200},decision:{type:'string',enum:clinicDecisionKinds}}},
    annotations:{readOnlyHint:false,untrustedContentHint:true},
    execute:async(input:{studentId:string;date:string;sceneRevision:string;assignmentRevisionId:string;attemptEntityId:string;attemptRevisionId:string;assignedItemId:string;expectedRevisionId:string|null;decision:ClinicDecision})=>{
    const fields=['studentId','date','sceneRevision','assignmentRevisionId','attemptEntityId','attemptRevisionId','assignedItemId','expectedRevisionId','decision'];
    if(!input||typeof input!=='object'||Object.keys(input).length!==fields.length||Object.keys(input).some(key=>!fields.includes(key))||fields.some(key=>key!=='expectedRevisionId'&&(typeof input[key as keyof typeof input]!=='string'||String(input[key as keyof typeof input]).length>200))||!(input.expectedRevisionId===null||typeof input.expectedRevisionId==='string')||!clinicDecisionKinds.includes(input.decision))throw Error('invalid_clinic_proposal');
    const selected=currentScene,ticket=studentRequests.snapshot();
    if(!selected||selected.student.id!==input.studentId||selected.preparation.date!==input.date||selected.sceneRevision!==input.sceneRevision)throw Error('clinic_proposal_scene_conflict');
    const fresh=await api<Scene>('/api/student?id='+encodeURIComponent(input.studentId)+'&date='+encodeURIComponent(input.date));
    if(!studentRequests.current(ticket)||currentScene!==selected||fresh.sceneRevision!==input.sceneRevision||fresh.student.id!==input.studentId||fresh.preparation.date!==input.date||!sameTeacherScope(selected.teacherScope,fresh.teacherScope))throw Error('clinic_proposal_scene_conflict');
    const work=fresh.workContext.data.exactWork.assignments.find(row=>row.record.revisionId===input.assignmentRevisionId),attempt=work?.attempts.find(row=>row.record.entityId===input.attemptEntityId&&row.record.revisionId===input.attemptRevisionId),item=attempt?.items.find(row=>row.item.assignedItemId===input.assignedItemId);
    if(!item?.writable||item.expectedRevisionId!==input.expectedRevisionId)throw Error('clinic_proposal_target_conflict');
    if(fresh.clinicRecovery.some(row=>row.resolution==='pending'&&sameClinicTarget(row.input,input)))throw Error('clinic_proposal_pending_request');
    revealClinicProposal(element('clinic-work'),input);
    return {content:[{type:'text',text:JSON.stringify({status:'awaiting_teacher_confirmation',target:input,recorded:false,officialSaved:false,parentSent:false})}]};
  }});
  await modelContext.registerTool({name:'query_student_concept_graph',description:'Read the selected teacher-owned student graph with exact retained evidence and concept revisions. Candidate, teacher-supported and contradicted relationships remain distinct from definition review, curated catalog adoption, mastery and causality. This query does not acquire source data or author a teacher judgment.',inputSchema:{type:'object',additionalProperties:false,required:['studentId'],properties:{studentId:{type:'string',maxLength:200}}},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:async(input:{studentId:string})=>{const reply=await api<any>('/api/concept-graph?studentId='+encodeURIComponent(input.studentId));return {content:[{type:'text',text:JSON.stringify(reply)}]};}});
  await modelContext.registerTool({name:'query_student_learning',description:'Read protected retained student evidence and typed practical DATA/LOGIC/ACTION/GOVERNANCE context: content hierarchy, distinct student/teacher stages, original evidence, source clocks, available operations and blocked effects. This query does not refresh the academy, complete a clinic, save a journal or send a parent report.',inputSchema:{type:'object',additionalProperties:false,required:['studentId'],properties:{studentId:{type:'string',maxLength:200,description:'An authorized student ID from the current teacher cohort.'},date:{type:'string',maxLength:10,description:'ISO lesson date; defaults to the selected teacher date.'}}},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:async(input:{studentId:string;date?:string})=>{const date=input.date??element<HTMLInputElement>('lesson-date').value;const scene=await api<Scene>('/api/student?id='+encodeURIComponent(input.studentId)+'&date='+encodeURIComponent(date));return {content:[{type:'text',text:JSON.stringify({student:scene.student.displayName,studentId:scene.student.id,sceneRevision:scene.sceneRevision,workContext:scene.workContext,connection:scene.connection,allowedOperations:scene.allowedOperations,books:scene.books.map(book=>({revisionId:book.revisionId,sourceObservedAt:book.sourceObservedAt,lastVerifiedAt:book.lastVerifiedAt})),preparation:scene.preparation,teacherWorkspaces:(scene.teacherWorkspaces??[]).map(row=>({entityId:row.entityId,revisionId:row.revisionId,kind:row.payload.kind,summary:row.payload.kind==='teacher_activity_review'?teacherActivitySummary(row.payload):{date:row.payload.date,state:row.payload.state,teacherReviewed:row.payload.teacherReviewed,officialSaved:false,parentSent:false}})),unknownLevels:scene.hierarchy.unknownLevels,knowledge:scene.knowledge,limits:scene.limits})}]};}});
  await modelContext.registerTool({name:'query_date_class',description:'Read every protected retained lesson occurrence for the selected date with original fields, source clocks, preparation, coverage unknowns and connection blockers. No academy refresh, official save or parent send.',inputSchema:{type:'object',additionalProperties:false,properties:{date:{type:'string',maxLength:10,description:'ISO lesson date; defaults to the selected teacher date.'}}},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:async(input:{date?:string})=>{const date=input.date??element<HTMLInputElement>('lesson-date').value;const source=await api<DateClassPreparation>('/api/class?date='+encodeURIComponent(date));dateClassView(source,date,cohortStudents);return {content:[{type:'text',text:JSON.stringify(source)}]};}});
}
(async()=>{
  const recoveryToken=new URLSearchParams(location.hash.slice(1)).get('password_recovery');
  if(location.pathname==='/reset'||recoveryToken){
    history.replaceState(null,'','/reset');element('auth').hidden=true;element('workspace').hidden=true;element('password-recovery').hidden=false;
    try{
      const result=recoveryToken?await post<{username:string}>('/api/password-recovery-session',{token:recoveryToken}):await api<{username:string}>('/api/password-recovery-status');
      recoveryReady=true;element('password-reset-form').hidden=false;element('recovery-account').textContent='교사 계정: '+result.username;
      element('request-recovery').hidden=true;element('recovery-request').hidden=true;
      status('복구 링크를 확인했습니다. 새 비밀번호를 입력하세요. 학생 이력과 교사 식별자는 유지됩니다.');
    }catch{status(recoveryToken?'복구 링크가 만료됐거나 이미 사용됐습니다. 새 소유자 확인 요청이 필요합니다.':'소유자 확인 요청을 눌러 계정 복구를 시작하세요.');}
    return;
  }
  const invitation=new URLSearchParams(location.hash.slice(1)).get('owner_invite');
  if(invitation){history.replaceState(null,'','/setup');try{await post('/api/setup-session',{invitation});setupMode=true;element('auth-title').textContent='나의 교사 계정 설정';element('login-submit').textContent='교사 계정 등록';element<HTMLInputElement>('password').autocomplete='new-password';status('Backend 소유자 초대가 검증됐습니다. 전용 계정 비밀번호를 설정하세요.');}catch(error){status('초대를 확인하지 못했습니다: '+(error as Error).message);}return;}
  try{await loadWorkspace();await registerSemanticTools();}catch{status('교사 로그인 후 학생 근거를 조회합니다.');}
})();

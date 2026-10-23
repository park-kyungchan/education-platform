import {academyDate} from '../../shared/date.ts';
import type {WorkContextArguments,WorkContextResult,Preparation,OperationNode,PolicyNode as Policy,SourceAnchor} from '../../shared/workflow.ts';
type IndexResult=Extract<WorkContextResult,{view:'policy-index'}>;
type PreparationResult=Extract<WorkContextResult,{view:'preparation'}>;
type Domain='administration'|'middle_school'|'elementary_school'|'teaching_coaching';
type Registry={registerTool(tool:{name:string;description:string;inputSchema:object;annotations?:object;execute(input:unknown):unknown|Promise<unknown>},options?:{signal?:AbortSignal}):void|Promise<void>};
export interface WorkflowViewOptions{
 onUnauthorized():void;
 canSelectStudent(studentId:string):boolean;
 selectStudent(studentId:string):Promise<unknown>;
 now?:()=>Date;
}
const domains:Record<Domain,string>={administration:'학원 운영',middle_school:'중등',elementary_school:'초등',teaching_coaching:'수업·코칭'};
const knowledge:Record<string,string>={user_confirmed:'사용자 확인',source_described:'문서 기준',observed_structure:'관찰된 구조',recommendation:'제안',unknown:'미확인'};
const lifecycle:Record<string,string>={active:'현행 기준',historical:'과거 기준',superseded:'이전 기준',expired:'만료',deferred:'보류'};
const relationLabels:Record<string,string>={precedes:'선행 순서',depends_on:'필요한 선행 기준',performed_by_role:'담당',produces_artifact:'결과물',reported_to_role:'보고 대상',uses_reference:'참조 자료',uses_concept:'연결 개념',related_policy:'관련 기준'};
const object=(v:unknown):v is Record<string,any>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const validDate=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
const positive=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0;
const shown=(v:unknown)=>typeof v==='string'&&v? v:'미확인';
function parseInput(raw:unknown):WorkContextArguments{
 if(!object(raw))throw Error('invalid_work_context_arguments');
 const input:Record<string,any>={...raw,...(raw.view==='preparation'&&!('session'in raw)?{session:'all'}:{})};
 if(input.view==='policy-index'){
  if(Object.keys(input).some(key=>!['view','domain','offset','limit'].includes(key))||('domain'in input&&!Object.hasOwn(domains,input.domain))||('offset'in input&&(!Number.isSafeInteger(input.offset)||input.offset<0||input.offset>10000))||('limit'in input&&(!Number.isSafeInteger(input.limit)||input.limit<1||input.limit>20)))throw Error('invalid_policy_index_arguments');
 }else if(input.view==='preparation'){
  if(Object.keys(input).some(key=>!['view','date','session','policyIds','expectedCatalogRevision','expectedMembershipRevision','expectedRosterRevision'].includes(key))||!validDate(input.date)||(input.session!=='all'&&input.session!==1&&input.session!==2)||!Array.isArray(input.policyIds)||input.policyIds.length>12||new Set(input.policyIds).size!==input.policyIds.length||input.policyIds.some((id:unknown)=>typeof id!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(id)||id.length>160)||!hash(input.expectedCatalogRevision)||!hash(input.expectedMembershipRevision)||typeof input.expectedRosterRevision!=='string'||!input.expectedRosterRevision||input.expectedRosterRevision.length>512)throw Error('invalid_preparation_arguments');
 }else throw Error('invalid_work_context_view');
 return input as WorkContextArguments;
}
function assertResponse(value:unknown,input:WorkContextArguments):asserts value is WorkContextResult{
 if(!object(value)||value.schemaVersion!=='academy.work-context/2.0.0'||value.view!==input.view||!object(value.revisions)||!hash(value.revisions.catalogRevision)||!hash(value.revisions.membershipRevision)||!hash(value.revisions.registrySha256)||typeof value.revisions.rosterRevision!=='string'||!value.revisions.rosterRevision||value.verification?.storageScopeChecked!==true||value.verification?.sourceIdentityIndependentlyVerified!==false||value.verification?.studentRecordsChanged!==false||value.verification?.externalSourceQueried!==false||value.verification?.liveAdapterConnected!==false)throw Error('verified_work_context_required');
 if(input.view==='policy-index'){
  if(!Array.isArray(value.policies)||value.policies.length>(input.limit??12)||!Array.isArray(value.domains)||!object(value.pagination)||value.pagination.offset!==(input.offset??0)||!Number.isSafeInteger(value.pagination.total)||typeof value.pagination.hasMore!=='boolean'||value.policies.some((p:any)=>!object(p)||typeof p.policyId!=='string'||typeof p.labelRaw!=='string'||!Object.hasOwn(domains,p.domain)||(input.domain!==undefined&&p.domain!==input.domain)))throw Error('invalid_policy_index_scope');
 }else{
  const p=value.preparation;
  if(value.revisions.catalogRevision!==input.expectedCatalogRevision||value.revisions.membershipRevision!==input.expectedMembershipRevision||value.revisions.rosterRevision!==input.expectedRosterRevision||!object(p)||p.kind!=='workflow_preparation_reference'||p.requestedDate!==input.date||p.timezone!=='Asia/Seoul'||p.actionBoundary?.externalSourceQueried!==false||p.actionBoundary?.studentRecordsChanged!==false||p.studentWork?.taskCount!==null||p.studentWork?.emptyMeansNoTasks!==false||p.studentWork?.assignments?.state!=='not_loaded'||p.studentWork?.executionAttempts?.state!=='not_loaded'||p.dateCohorts?.classDate!==input.date||p.dateCohorts?.timezone!=='Asia/Seoul'||p.dateCohorts?.source?.sha256!==input.expectedMembershipRevision||p.dateCohorts?.rosterRevision?.rosterRevision!==input.expectedRosterRevision||p.dateCohorts?.coverage?.attendanceInferred!==false||p.dateCohorts?.coverage?.liveLmsQueryPerformed!==false||!Array.isArray(p.dateCohorts?.cohorts)||!Array.isArray(p.dateCohorts?.unverified)||!Array.isArray(p.workflowTemplate?.nodes)||!Array.isArray(p.workflowTemplate?.relations)||!Array.isArray(p.workflowTemplate?.sources)||p.workflowTemplate?.meaning!=='selected_policy_reference_not_student_tasks'||p.workflowTemplate?.revision!==input.expectedCatalogRevision||(input.policyIds.length===0&&(p.workflowTemplate.nodes.length!==0||p.workflowTemplate.relations.length!==0||p.workflowTemplate.sources.length!==0))||input.policyIds.some(id=>!p.workflowTemplate.nodes.some((n:any)=>n.kind==='policy'&&n.id===id)))throw Error('invalid_preparation_scope');
  for(const cohort of p.dateCohorts.cohorts){if(cohort.classDate!==input.date||!Array.isArray(cohort.members)||(input.session!=='all'&&cohort.sessionSlot?.ordinal!==input.session)||cohort.attendanceState!=='not_assessed'||cohort.taskCount!==null||cohort.emptyMeansNoClass!==false||cohort.members.some((m:any)=>typeof m.studentId!=='string'||typeof m.displayName!=='string'||m.liveVerified!==false||(m.effectiveFrom===null&&input.date<m.confirmedAsOf)))throw Error('invalid_date_cohort_scope');}
 }
}

/** Protected owner read only. UI and browser tools share this exact action. */
export function mountWorkflowView(target:HTMLElement,options:WorkflowViewOptions){
 const document=target.ownerDocument;
 const make=<K extends keyof HTMLElementTagNameMap>(tag:K,className='',text?:string)=>{const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;};
 const section=make('section','workflow-view');section.setAttribute('aria-label','오늘 수업과 업무 흐름');section.dataset.workflowView='';
 const header=make('div','workflow-heading'),title=make('h2','','오늘 수업과 업무 흐름'),sourceBadge=make('span','workflow-source-badge','저장 근거 · 학원 실시간 미연결');header.append(title,sourceBadge);
 const controls=make('div','workflow-controls');
 const dateLabel=make('label','','날짜'),date=make('input');date.type='date';date.value=academyDate(options.now?.()??new Date());date.setAttribute('data-workflow-date','');dateLabel.append(date);
 const sessionLabel=make('label','','수업'),session=make('select');session.setAttribute('data-workflow-session','');for(const [value,label] of [['all','전체'],['1','1부'],['2','2부']]){const opt=make('option','',label);opt.value=value;session.append(opt);}sessionLabel.append(session);
 const reload=make('button','workflow-reload','다시 확인');reload.type='button';reload.dataset.workflowReload='';controls.append(dateLabel,sessionLabel,reload,make('span','workflow-timezone','한국 시간'));
 const status=make('p','workflow-status','보호된 수업 배정 근거를 확인하고 있습니다.');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const cohorts=make('div','workflow-cohorts');
 const note=make('p','workflow-note','확인된 요일·수업 배정으로 묶습니다. 실제 출석·숙제·완료 상태는 별도 근거가 필요합니다.');
 const details=make('details','workflow-details'),summary=make('summary','','업무 기준 찾아보기');
 const workspace=make('div','workflow-workspace'),policyNav=make('div','workflow-policy-nav');
 const domainLabel=make('label','','업무 영역'),domain=make('select');domain.dataset.workflowDomain='';const all=make('option','','모든 영역');all.value='';domain.append(all);for(const [value,label]of Object.entries(domains)){const opt=make('option','',label);opt.value=value;domain.append(opt);}domainLabel.append(domain);
 const policyList=make('div','workflow-policy-list');policyList.setAttribute('aria-label','업무 기준 선택');
 const pages=make('div','workflow-pages'),previous=make('button','','이전'),next=make('button','','다음'),pageLabel=make('span');previous.type=next.type='button';previous.dataset.workflowPrevious='';next.dataset.workflowNext='';pages.append(previous,pageLabel,next);
 policyNav.append(domainLabel,policyList,pages);
 const policyDetail=make('div','workflow-policy-detail');policyDetail.append(make('p','workflow-note','기준을 선택하면 계층, 명시된 선행 조건, 근거를 확인할 수 있습니다.'));
 workspace.append(policyNav,policyDetail);details.append(summary,make('p','workflow-note','업무 기준은 절차 참고용입니다. 선택한 학생에게 생긴 오늘의 미완료 업무를 뜻하지 않습니다.'),workspace);
 const provenance=make('details','workflow-provenance');provenance.append(make('summary','','배정 근거와 확인 범위'));
 section.append(header,controls,status,cohorts,note,details,provenance);target.prepend(section);
 let active=true,epoch=0,request:AbortController|null=null,index:IndexResult|null=null,prepared:PreparationResult|null=null,selectedPolicyIds:string[]=[],selectedNodeId:string|null=null,lastError:string|null=null;
 const lifecycleController=new AbortController();
 const isCurrent=(token:number)=>active&&epoch===token;
 const ensureCurrent=(token:number)=>{if(!isCurrent(token))throw Error('superseded_work_context');};
 function setBusy(busy:boolean){section.setAttribute('aria-busy',String(busy));reload.disabled=busy;}
 function showError(error:unknown){if(!active)return;lastError=error instanceof Error?error.message:'work_context_failed';status.textContent=prepared?'업무 기준 목록을 확인하지 못했습니다. 마지막 확인된 배정 근거를 유지합니다.':'수업·업무 근거를 확인하지 못했습니다. 날짜별 배정과 실제 할 일은 미확인 상태입니다.';status.dataset.state='error';if(!prepared)policyDetail.replaceChildren(make('p','workflow-note','검증된 업무 기준을 불러오지 못했습니다. 다시 확인해 주세요.'));}
 function clearReadView(){prepared=null;cohorts.replaceChildren();policyDetail.replaceChildren(make('p','workflow-note','선택한 날짜와 업무 기준을 확인하고 있습니다.'));provenance.replaceChildren(make('summary','','배정 근거와 확인 범위'));}
 function buildPreparationArgs():WorkContextArguments{
  if(!index)throw Error('work_context_index_required');
  return parseInput({view:'preparation',date:date.value,session:session.value==='all'?'all':Number(session.value),policyIds:selectedPolicyIds,...{expectedCatalogRevision:index.revisions.catalogRevision,expectedMembershipRevision:index.revisions.membershipRevision,expectedRosterRevision:index.revisions.rosterRevision}});
 }
 function indexArgs(offset=0):WorkContextArguments{return parseInput({view:'policy-index',limit:8,offset,...(domain.value?{domain:domain.value}:{})});}
 async function fetchResult(input:WorkContextArguments,token:number,signal:AbortSignal):Promise<WorkContextResult>{
  const response=await fetch('/api/academy/work-context?input='+encodeURIComponent(JSON.stringify(input)),{method:'GET',credentials:'same-origin',redirect:'error',headers:{Accept:'application/json'},signal});
  ensureCurrent(token);
  const mediaType=response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if(response.status===401||response.status===403||response.type==='opaqueredirect'||response.redirected||(response.status>=300&&response.status<400)||!(mediaType==='application/json'||mediaType?.endsWith('+json'))){options.onUnauthorized();throw Error('protected_identity_response_required');}
  const envelope:unknown=await response.json();ensureCurrent(token);
  if(!response.ok||!object(envelope)||envelope.status!=='success')throw Error(object(envelope)&&typeof envelope.status==='string'?envelope.status:'work_context_read_failed');
  assertResponse(envelope.result,input);return envelope.result;
 }
 function renderIndex(result:IndexResult){
  index=result;policyList.replaceChildren();
  for(const policy of result.policies){const button=make('button','workflow-policy','');button.type='button';button.dataset.workflowPolicy=policy.policyId;button.setAttribute('aria-pressed',String(selectedPolicyIds.includes(policy.policyId)));button.append(make('span','',policy.labelRaw),make('small','',`${domains[policy.domain as Domain]} · ${lifecycle[policy.lifecycle]??policy.lifecycle}`));button.addEventListener('click',()=>{selectedPolicyIds=[policy.policyId];selectedNodeId=policy.policyId;details.open=true;void refreshPreparation().catch(()=>{});});policyList.append(button);}
  if(result.policies.length===0)policyList.append(make('p','workflow-note','이 범위에 표시할 업무 기준이 없습니다.'));
  const start=result.pagination.total===0?0:result.pagination.offset+1,end=result.pagination.offset+result.policies.length;pageLabel.textContent=`${start}–${end} / ${result.pagination.total}`;previous.disabled=result.pagination.offset===0;next.disabled=!result.pagination.hasMore;
 }
 function renderCohorts(p:Preparation){
  cohorts.replaceChildren();
  for(const cohort of p.dateCohorts.cohorts){const row=make('div','workflow-cohort');row.append(make('h3','',cohort.sessionSlot.ordinal+'부'));const people=make('div','workflow-people');
   for(const member of cohort.members){const button=make('button','workflow-student',member.displayName);button.type='button';button.dataset.workflowStudent=member.studentId;button.disabled=!options.canSelectStudent(member.studentId);button.title=button.disabled?'현재 허용된 학생 범위와 연결되지 않았습니다.':'학생의 저장 학습 근거 열기';button.addEventListener('click',async()=>{if(!active||!options.canSelectStudent(member.studentId))return;button.disabled=true;try{await options.selectStudent(member.studentId);if(active){const rail=document.querySelector<HTMLElement>('#c2-root');rail?.scrollIntoView?.({behavior:'smooth',block:'start'});}}catch{if(active){status.textContent='학생 저장 근거를 열지 못했습니다. 현재 선택과 자료를 유지합니다.';}}finally{if(active)button.disabled=!options.canSelectStudent(member.studentId);}});people.append(button);}
   if(!cohort.members.length)people.append(make('p','workflow-note',p.dateCohorts.unverified.some(u=>u.reason==='historical_start_unknown')?'등록 시작일 미확인 · 이 날짜의 배정은 판단할 수 없습니다.':'이 날짜에 적용 가능한 배정 근거가 없습니다. 수업이 없다는 뜻은 아닙니다.'));
   row.append(people);const projected=cohort.members.some(m=>m.applicability==='projected_pattern_not_date_verified');row.append(make('p','workflow-cohort-note',projected?'확인된 요일 패턴의 예상 배정 · 해당 날짜 실제 편성 미확인':cohort.members.length?'사용자 확인 기준 · 출석 미확인':'배정 미확인 · 출석 미확인'));cohorts.append(row);
  }
  provenance.replaceChildren(make('summary','','배정 근거와 확인 범위'));
  provenance.append(make('p','',`사용자 확인 기준일: ${shown(p.dateCohorts.source.confirmedAsOf)} · 확인 내용 수신 시각: ${shown(p.dateCohorts.source.receivedAt)}`),make('p','','등록 시작·종료가 미확인인 학생은 확인일 이전 날짜에 소급 배정하지 않습니다. 이후 날짜는 확인된 요일 패턴의 예상 배정입니다.'),make('p','','조회 범위: 명시적으로 확인한 학생만 · 학원 전체 명단 아님 · 휴원·보강·반 변경 미대조'),make('p','','학원 실시간 조회: 하지 않음 · 날짜별 과제·실행·현재 판정: 불러오지 않음'));
  for(const cohort of p.dateCohorts.cohorts)for(const m of cohort.members)provenance.append(make('p','',`${m.displayName}: ${m.enrollmentWeekdayPattern.label} · ${m.sessionSlot.ordinal}부 · 등록 시작 ${shown(m.effectiveFrom)} / 종료 ${shown(m.effectiveTo)}`));
  if(p.dateCohorts.unverified.length)provenance.append(make('p','',`선택 날짜에 적용 여부 미확인: ${p.dateCohorts.unverified.length}명. 이름을 과거 반 명단으로 제시하지 않습니다.`));
 }
 function renderSourceList(anchors:readonly SourceAnchor[],all:readonly SourceAnchor[]){
  const list=make('div','workflow-sources');
  for(const source of anchors){const entry=make('details','workflow-source'),label=source.kind==='user_statement'?'사용자 확인':source.kind==='assistant_inference'?'추론':source.kind==='ui_structure'?'관찰된 구조':'문서 근거';entry.append(make('summary','',`${label} · ${source.sourceAlias}`),make('p','',source.assertionRaw),make('p','workflow-note',`원문 날짜 ${shown(source.dateRaw)} · 전달 ${shown(source.reportedAt)} · 관찰 ${shown(source.observedAt)} · 저장 ${shown(source.capturedAt)}`));
   if(source.supersedesAnchorIds.length){entry.append(make('p','workflow-note','수정한 이전 근거:'));for(const id of source.supersedesAnchorIds){const older=all.find(s=>s.id===id);entry.append(make('p','workflow-note',older?`${older.sourceAlias}: ${older.assertionRaw}`:`이전 근거 ID: ${id}`));}}
   entry.append(make('p','workflow-note','이 근거는 실시간 학생 조회나 실행 완료를 증명하지 않습니다.'));list.append(entry);
  }
  if(!anchors.length)list.append(make('p','workflow-note','이 노드에 직접 연결된 근거가 없습니다.'));
  return list;
 }
 function renderTemplate(p:Preparation){
  policyDetail.replaceChildren();const template=p.workflowTemplate,nodes=template.nodes,byId=new Map(nodes.map(node=>[String(node.id),node]));
  if(!selectedPolicyIds.length){policyDetail.append(make('p','workflow-note','기준을 선택하면 계층, 명시된 선행 조건, 근거를 확인할 수 있습니다.'));return;}
  const chosen=nodes.find(node=>node.kind==='policy'&&selectedPolicyIds.includes(node.id)) as Policy|undefined;
  if(!chosen){policyDetail.append(make('p','workflow-note','선택한 기준의 검증된 내용을 표시할 수 없습니다.'));return;}
  policyDetail.append(make('h3','',chosen.labelRaw),make('p','workflow-policy-meta',`${knowledge[chosen.knowledge]??chosen.knowledge} · ${lifecycle[chosen.lifecycle]??chosen.lifecycle} · 절차 참고용`));
  const policySource=p.sourceCoverage?.find(source=>source.sourceKind==='operating_policy_checkpoint');if(policySource)policyDetail.append(make('p','workflow-note',`운영 기준 저장본의 기준일: ${shown(policySource.sourceAsOf)} · 학원 실시간 조회 자료 아님`));
  const tree=make('div','workflow-tree');tree.setAttribute('aria-label','업무 기준 계층');
  const contains=template.relations.filter((edge):edge is Extract<typeof edge,{kind:'contains'}>=>edge.kind==='contains'),hierarchyKinds=['academy_root','domain','policy','step'];
  const displayNodes=nodes.filter(n=>hierarchyKinds.includes(n.kind)),parents=new Set(contains.map(e=>String(e.to)));
  const rootNodes=displayNodes.filter(node=>!parents.has(node.id));
  const addBranch=(node:OperationNode,seen:Set<string>):HTMLElement=>{
   const item=make('li'),button=make('button','workflow-node');button.type='button';button.dataset.workflowNode=node.id;button.setAttribute('aria-pressed',String((selectedNodeId??chosen.id)===node.id));button.textContent=node.kind==='domain'?domains[node.domain]:node.kind==='academy_root'?'학원 업무 기준':node.labelRaw;
   if(node.kind==='step')button.append(make('small','','절차 표시 순서 '+(node.order+1)));
   button.addEventListener('click',()=>{selectedNodeId=node.id;renderTemplate(p);Array.from(policyDetail.querySelectorAll<HTMLButtonElement>('[data-workflow-node]')).find(button=>button.dataset.workflowNode===node.id)?.focus();});item.append(button);
   const nextSeen=new Set(seen).add(node.id),children=contains.filter(e=>e.from===node.id).sort((a,b)=>(a.kind==='contains'?a.order:0)-(b.kind==='contains'?b.order:0)).flatMap(e=>{const child=byId.get(e.to);return child&&hierarchyKinds.includes(child.kind)&&!nextSeen.has(child.id)?[child]:[];});
   if(children.length){const childList=make('ul');children.forEach(child=>childList.append(addBranch(child,nextSeen)));item.append(childList);}return item;
  };
  const branches=make('ul');rootNodes.forEach(node=>branches.append(addBranch(node,new Set())));tree.append(branches);policyDetail.append(tree);
  const selected=byId.get(selectedNodeId??chosen.id)??chosen;
  const focused=make('section','workflow-node-detail');focused.append(make('h4','',selected.labelRaw));
  if(selected.kind==='policy'){
   const values=[['적용',selected.applicability.activationRaw],['주기',selected.cadenceRaw],['기한',selected.deadlineRaw],['범위',selected.scopeRaw],['담당',selected.responsibilityRaw]];
   const dl=make('dl');for(const [term,value]of values){dl.append(make('dt','',term),make('dd','',value));}focused.append(dl);
   if(selected.preconditions.length){focused.append(make('h5','','적용 전 확인'));const list=make('ul');for(const condition of selected.preconditions)list.append(make('li','',condition.labelRaw+' · '+({required:'필요',unconfirmed:'미확인',not_applicable:'해당 없음'}[condition.state])));focused.append(list);}
   if(selected.exceptions.length){const exception=make('details');exception.append(make('summary','','예외와 적용 범위'));selected.exceptions.forEach(text=>exception.append(make('p','',text)));focused.append(exception);}
  }
  const edges=template.relations.filter(edge=>edge.kind!=='contains'&&(edge.from===selected.id||edge.to===selected.id));
  focused.append(make('h5','','명시된 연결'));
  if(edges.length){const list=make('ul','workflow-relations');for(const edge of edges){const from=byId.get(edge.from),to=byId.get(edge.to);let text=edge.kind==='depends_on'?`${to?.labelRaw??edge.to} → ${from?.labelRaw??edge.from}`:`${from?.labelRaw??edge.from} → ${to?.labelRaw??edge.to}`;list.append(make('li','',`${relationLabels[edge.kind]??edge.kind}: ${text}`));}focused.append(list);}else focused.append(make('p','workflow-note','이 노드에 명시된 선행·참조 연결이 없습니다. 표시 순서만으로 선행 조건을 만들지 않습니다.'));
  const allPrerequisites=template.relations.filter(edge=>edge.kind==='precedes'||edge.kind==='depends_on');
  if(allPrerequisites.length){const prerequisite=make('details');prerequisite.append(make('summary','','선택 범위 전체의 명시된 선행 조건'));for(const edge of allPrerequisites){const from=byId.get(edge.from),to=byId.get(edge.to);prerequisite.append(make('p','',edge.kind==='depends_on'?`${to?.labelRaw??edge.to} → ${from?.labelRaw??edge.from}`:`${from?.labelRaw??edge.from} → ${to?.labelRaw??edge.to}`));}focused.append(prerequisite);}
  focused.append(make('h5','','실행·재시도'),make('p','workflow-note','학생별 실행 시도·재시도·재개 기록은 불러오지 않았습니다. 이 계층과 선행 조건으로 완료 여부를 판단하지 않습니다.'));
  const sources=make('details','workflow-source-details');sources.append(make('summary','',`선택한 항목의 근거 ${selected.sourceAnchorIds.length}개`),renderSourceList(template.sources.filter(source=>selected.sourceAnchorIds.includes(source.id)),template.sources));focused.append(sources);policyDetail.append(focused);
 }
 function accept(result:WorkContextResult,input:WorkContextArguments){
  lastError=null;
  if(result.view==='policy-index'){renderIndex(result);if(input.view==='policy-index')domain.value=input.domain??'';status.textContent=prepared?`${prepared.preparation.requestedDate} · 배정 근거 확인. 업무 기준은 별도로 선택하세요.`:'업무 기준 목록 확인 · 날짜별 배정 근거를 확인합니다.';}
  else if(input.view==='preparation'){
   date.value=input.date;const value=String(input.session);if(!Array.from(session.options).some(option=>option.value===value)){const option=make('option','',value+'부');option.value=value;session.append(option);}session.value=value;selectedPolicyIds=[...input.policyIds];prepared=result;renderCohorts(result.preparation);renderTemplate(result.preparation);if(index)renderIndex(index);
   status.textContent=`${result.preparation.requestedDate} · 확인된 배정 근거 기준. 실제 출석·과제·완료는 미확인입니다.`;status.dataset.state='ready';if(input.policyIds.length)details.open=true;
  }
 }
 async function execute(raw:unknown):Promise<WorkContextResult>{
  const input=parseInput(raw);if(!active)throw Error('work_context_disposed');const token=++epoch;request?.abort();request=new AbortController();setBusy(true);status.textContent='보호된 저장 근거를 확인하고 있습니다.';
  if(input.view==='preparation')clearReadView();
  try{const result=await fetchResult(input,token,request.signal);ensureCurrent(token);accept(result,input);return result;}catch(error){if(isCurrent(token)&&!(error instanceof Error&&error.name==='AbortError'))showError(error);throw error;}finally{if(isCurrent(token))setBusy(false);}
 }
 async function refreshPreparation(){return execute(buildPreparationArgs());}
 async function initialize(){
  try{const result=await execute(indexArgs());if(!active||result.view!=='policy-index')return;await refreshPreparation();}catch{}
 }
 const refresh=()=>{if(!validDate(date.value)){epoch++;request?.abort();setBusy(false);clearReadView();status.textContent='확인할 날짜를 올바르게 선택해 주세요.';return;}void(index?refreshPreparation():initialize()).catch(()=>{});};
 date.addEventListener('change',refresh);session.addEventListener('change',refresh);reload.addEventListener('click',refresh);
 domain.addEventListener('change',()=>{void execute(indexArgs()).catch(()=>{});});previous.addEventListener('click',()=>{void execute(indexArgs(Math.max(0,(index?.pagination.offset??0)-(index?.pagination.limit??8)))).catch(()=>{});});next.addEventListener('click',()=>{void execute(indexArgs((index?.pagination.offset??0)+(index?.pagination.limit??8))).catch(()=>{});});
 // Optional browser tool registration is not part of this independent runtime.
 const ready=initialize();
 function dispose(){if(!active)return;active=false;epoch++;request?.abort();request=null;lifecycleController.abort();index=null;prepared=null;selectedPolicyIds=[];selectedNodeId=null;section.replaceChildren();section.remove();document.defaultView?.removeEventListener('pagehide',dispose);}
 document.defaultView?.addEventListener('pagehide',dispose,{once:true});
 return {element:section,ready,execute,attach(nextTarget:HTMLElement){if(active)nextTarget.prepend(section);},getState(){return {active,date:date.value,session:session.value,selectedPolicyIds:[...selectedPolicyIds],hasPreparation:prepared!==null,lastError};},dispose};
}

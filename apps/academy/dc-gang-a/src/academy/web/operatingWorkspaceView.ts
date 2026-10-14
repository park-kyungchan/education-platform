import type {TrustedTeacherContext} from '../contracts/teacherOperations';
import type {TeacherOperationalCase} from '../teacherWorkspace';
import {workspaceEntityId,validateTeacherWorkspace} from '../teacherWorkspace';
import {workspaceNode as node,workspaceDraft,workspaceControls,editorText,editorSelect,editorCheck} from './workspaceEditor';
const categories=[['counseling','상담'],['cism','CISM 준비'],['makeup','보강'],['onboarding','신규 배정'],['withdrawal','퇴원'],['materials','교재·자료'],['forms','서류·신청서']] as const;
const suggestions:Record<string,string[]>={counseling:['D-A03','D-A05'],cism:['D-A02'],makeup:['D-A07','D-A09','D-A10','D-A11'],onboarding:['D-A03','D-A04','D-A25'],withdrawal:['D-A23'],materials:['D-A15','D-A16','D-A17','D-A18'],forms:['D-A08','D-A24']};
type Read=<T>(path:string)=>Promise<T>;type Write=<T>(path:string,input:unknown)=>Promise<T>;
export function operatingWorkspaceView(scope:Pick<TrustedTeacherContext,'ownerId'|'actorId'>,read:Read,write:Write):HTMLElement {
 const card=node('section');card.id='operating-workspace';card.className='operating-workspace card';card.append(node('h3','운영 업무 · 정책과 내부 사례 기록'),node('p','71개 원본 정책의 역할·근거·유보 사항을 확인하고 내부 준비 이력을 남깁니다. 연락·제출·발송·실행 사실은 이 저장으로 확인되지 않습니다.'));
 const list=node('div'),catalogView=node('details');catalogView.append(node('summary','전체 정책과 출처 범위'));card.append(catalogView,list);
 let catalog:any;
 const showContext=async(policyIds:string[],revision:string,parent:HTMLElement)=>{
  const selection=await read<any>('/api/operating-context?revision='+encodeURIComponent(revision)+policyIds.map(id=>'&policyId='+encodeURIComponent(id)).join(''));
  parent.replaceChildren();
  for(const policy of selection.nodes.filter((value:any)=>value.kind==='policy')){const detail=node('details');detail.append(node('summary',policy.id+' · '+policy.labelRaw),node('p','담당 역할: '+policy.responsibilityRaw+' · 적용: '+policy.applicability.status+' · '+policy.lifecycle+' / '+policy.automation),node('p','기한: '+policy.deadlineRaw),node('pre',JSON.stringify({preconditions:policy.preconditions,exceptions:policy.exceptions,completionRequirements:policy.completionRequirements},null,2)));parent.append(detail);}
  const source=node('details');source.append(node('summary','출처·개정 이력·검증되지 않은 항목'),node('pre',JSON.stringify({sources:selection.sources,investigations:selection.investigations,references:selection.references,executionAuthority:selection.executionAuthority},null,2)));parent.append(source);return selection;
 };
 const renderCase=async(prior:any|null,category:string)=>{
  const initial:TeacherOperationalCase={kind:'teacher_operational_case',reportedAt:new Date().toISOString(),studentBinding:null,evidenceRevisionIds:[],caseId:crypto.randomUUID(),category:category as any,policyIds:suggestions[category]??[],policyRevision:catalog.revision,title:categories.find(([key])=>key===category)?.[1]??'내부 업무',state:'open',note:'',checklist:[],actualAssignmentConfirmed:false,roleBoundaryAcknowledged:false,completionNote:'',executed:false,transmitted:false,received:false,officialSaved:false};
  const identity=prior?.entityId??workspaceEntityId(initial),state=workspaceDraft(JSON.stringify([scope,identity]),prior?.payload??initial,prior?.revisionId??null,prior?.sequence??0),value=state.value as TeacherOperationalCase;
  const details=node('details');details.open=!prior;details.dataset.operationalCase=value.caseId;details.append(node('summary',value.title+' · '+value.state));const form=node('div');form.className='workspace-form';form.dataset.entityId=identity;details.append(form);list.append(details);
  const changed=()=>{state.dirty=true;};editorText(form,'내부 업무 제목',value.title,text=>{value.title=text;changed();},'case-title',1);
  const policyPicker=node('fieldset');policyPicker.append(node('legend','관련 정책 · 의무 자동 생성 아님'));const selected=new Set(value.policyIds);
  for(const policy of catalog.policies){editorCheck(policyPicker,policy.id+' · '+policy.labelRaw,selected.has(policy.id),checked=>{checked?selected.add(policy.id):selected.delete(policy.id);changed();},'policy-'+policy.id);}form.append(policyPicker);
  const context=node('div'),refresh=node('button','선택 정책의 역할·출처·절차 보기') as HTMLButtonElement;refresh.type='button';const steps=node('div');
  const load=async()=>{try{const selectedContext=await showContext([...selected],value.policyRevision,context);steps.replaceChildren();
   const allowed=new Set(selectedContext.nodes.filter((value:any)=>value.kind==='step').map((value:any)=>value.id));value.checklist=value.checklist.filter(row=>allowed.has(row.stepId));
   for(const step of selectedContext.nodes.filter((value:any)=>value.kind==='step')){let item=value.checklist.find(row=>row.stepId===step.id);if(!item){item={stepId:step.id,state:'not_checked',note:''};value.checklist.push(item);}const row=item;editorSelect(steps,step.labelRaw+' · '+step.ownerRoleId,row.state,[['not_checked','미확인'],['prepared','내부 준비'],['human_reported_done','교사 수행 보고 · 독립 실행 검증 아님']],text=>{row.state=text as any;changed();},'step-'+step.id);editorText(steps,'절차 메모',row.note,text=>{row.note=text;changed();},'step-note-'+step.id,2);}
  }catch(error){context.textContent='정책 조회 보류 · '+(error as Error).message;}};
  refresh.addEventListener('click',()=>void load());form.append(refresh,context,steps);void load();
  editorSelect(form,'내부 처리 상태',value.state,[['open','진행 전'],['prepared','준비됨'],['awaiting_human','담당자 확인 대기'],['locally_closed','내부 사례 종결'],['reopened','다시 검토']],text=>{value.state=text as any;changed();},'case-state');
  editorText(form,'확인한 사실·다음 조치·미확인 사항',value.note,text=>{value.note=text;changed();},'case-note');editorCheck(form,'이 정책에 필요한 실제 담당 배정을 확인했습니다',value.actualAssignmentConfirmed,checked=>{value.actualAssignmentConfirmed=checked;changed();},'case-assignment');editorCheck(form,'담당 역할과 인계 범위를 확인했습니다. 이 기록은 외부 연락·제출이 아닙니다',value.roleBoundaryAcknowledged,checked=>{value.roleBoundaryAcknowledged=checked;changed();},'case-boundary');editorText(form,'내부 종결 / 재검토 근거',value.completionNote,text=>{value.completionNote=text;changed();},'case-completion');
  workspaceControls(form,state,scope,null,'/api/owner-workspace',()=>{value.policyIds=[...selected];validateTeacherWorkspace(value);return value;},read,write);
 };
 void (async()=>{
  try{catalog=await read<any>('/api/operating-catalog');catalogView.append(node('p','정책 '+catalog.policies.length+'개 · 원본 개정 '+catalog.revision+' · 원본 자료 누락·유보 상태를 유지합니다.'));for(const policy of catalog.policies){const detail=node('details');detail.append(node('summary',policy.id+' · '+policy.labelRaw+' · '+policy.lifecycle),node('p',policy.scopeRaw),node('p','담당 '+policy.responsibilityRaw+' · 자동화 '+policy.automation));catalogView.append(detail);}const coverage=node('details');coverage.append(node('summary','원본 자료의 범위와 누락'),node('pre',JSON.stringify(catalog.coverage,null,2)));catalogView.append(coverage);
   const toolbar=node('div');toolbar.className='class-toolbar';for(const [category,label] of categories){const button=node('button',label+' 사례 준비') as HTMLButtonElement;button.type='button';button.dataset.category=category;button.addEventListener('click',()=>void renderCase(null,category));toolbar.append(button);}card.insertBefore(toolbar,list);
   try{const reply=await read<{rows:any[]}>('/api/owner-workspaces');for(const row of reply.rows){if(row.payload.kind==='teacher_operational_case')await renderCase(row,row.payload.category);}}catch{list.append(node('p','운영 사례 저장소가 아직 준비되지 않았거나 조회되지 않습니다. 원본 정책은 계속 확인할 수 있습니다.'));}
  }catch(error){list.append(node('p','운영 정책을 조회하지 못했습니다. '+(error as Error).message));}
 })();return card;
}

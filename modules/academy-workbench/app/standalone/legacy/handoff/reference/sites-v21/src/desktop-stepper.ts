/**
 * Desktop-only, read-only navigation. React Bits Stepper visual adaptation.
 * Copyright (c) 2026 David Haz. MIT + Commons Clause, see vendor/react-bits/LICENSE.md.
 * No React/Motion dependency is added. Step selection NEVER records completion.
 * Receives the same protected, validated projections as the original rail renderer.
 */
import type {TeacherOverlay} from './teacher-overlay.ts';

type Stage='preview'|'practice'|'review'|'teacher';
export interface DesktopStepperOptions {
 studentId:string;
 studentName:string;
 sourcePageId:string;
 view:any;
 teacherOverlay:TeacherOverlay|null;
 selectRecord(recordId:string):void;
}
const stages:ReadonlyArray<{id:Stage;label:string;eyebrow:string;title:string;description:string}>=[
 {id:'preview',label:'예습',eyebrow:'교재와 범위',title:'배정과 교재부터 확인해요',description:'등록된 교재와 보존된 과제를 살펴보세요. 예습 수행 여부는 아직 별도 확인이 필요합니다.'},
 {id:'practice',label:'풀이',eyebrow:'풀이와 채점',title:'풀이의 근거를 한곳에서',description:'저장된 채점 관찰을 원본 날짜와 함께 봅니다. 점수는 학습 완료 판정과 구분합니다.'},
 {id:'review',label:'오답',eyebrow:'오답과 클리닉',title:'오답 검토의 근거를 확인해요',description:'원문 오답과 유사 클리닉을 나눠 봅니다. 교사가 확인한 범위만 표시합니다.'},
 {id:'teacher',label:'교사 검토',eyebrow:'교사의 독립된 판단',title:'확인한 것과 남은 것을 구분해요',description:'저장된 교사 확인을 살펴보세요. 검토 완료, 인쇄, 배부는 각각 다른 상태입니다.'}
];
const text=(value:unknown,fallback='미확인')=>typeof value==='string'&&value.length?value:fallback;
const reviewText=(state:unknown)=>state==='teacher_confirmed_complete'?'교사 완료 확인':'미확인';

export function mountDesktopStepper(shell:HTMLElement,root:HTMLElement,extra:HTMLElement,options:DesktopStepperOptions){
 const doc=shell.ownerDocument,win=doc.defaultView;
 const media=win?.matchMedia('(min-width: 1100px)');
 let stage:Stage='preview',active=false,disposed=false,search='',page=0;
 let sidebar:HTMLElement|null=null,workspace:HTMLElement|null=null,drawers:HTMLElement|null=null;
 let pane:HTMLElement|null=null,tabs:HTMLElement|null=null,live:HTMLElement|null=null;
 const restores:Array<{node:HTMLElement;placeholder:Comment}>=[];
 const make=<K extends keyof HTMLElementTagNameMap>(tag:K,className='',value?:string)=>{const node=doc.createElement(tag);if(className)node.className=className;if(value!==undefined)node.textContent=value;return node;};
 const button=(label:string,cls:string,action:()=>void)=>{const node=make('button',cls,label);node.type='button';node.addEventListener('click',action);return node;};
 const allRecords=Object.values(options.view.records) as any[];
 const attempts=allRecords.filter(record=>record.attemptEvidence.length>0);
 const candidates=options.teacherOverlay?.candidates??[];
 const relocate=(node:HTMLElement|null,parent:HTMLElement)=>{if(!node)return;const placeholder=doc.createComment('desktop-restore');node.before(placeholder);restores.push({node,placeholder});parent.append(node);};
 const jump=(target:HTMLElement|null)=>{if(!target)return;for(let parent:HTMLElement|null=target.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')(parent as HTMLDetailsElement).open=true;target.scrollIntoView?.({behavior:win?.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});if(target.matches('button,a,summary,[tabindex]'))target.focus({preventScroll:true});};
 const openRecord=(id:string)=>{options.selectRecord(id);const target=Array.from(root.querySelectorAll<HTMLElement>('[data-record-id]')).find(node=>node.dataset.recordId===id)??null;jump(target);};
 function badge(label:string,kind='unknown'){return make('span','desktop-badge desktop-badge--'+kind,label);}
 function item(label:string,sub:string,meta:string,action:()=>void){
  const row=make('article','desktop-evidence-item'),body=make('div','desktop-item-copy');body.append(make('h3','',label),make('p','',sub));
  row.append(body,make('span','desktop-item-meta',meta),button('근거 보기 ↗','desktop-item-open',action));return row;
 }
 function renderPane(){
  if(!pane||!tabs)return;
  const selected=stages.find(entry=>entry.id===stage)!;
  tabs.style.setProperty('--selected-step',String(stages.indexOf(selected)));
  for(const tab of tabs.querySelectorAll<HTMLButtonElement>('[data-desktop-stage]')){const selected=tab.dataset.desktopStage===stage;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;tab.dataset.state=selected?'active':'idle';}
  pane.setAttribute('aria-labelledby','desktop-step-'+stage);pane.dataset.stage=stage;pane.replaceChildren();
  const heading=make('div','desktop-pane-heading'),copy=make('div');copy.append(make('p','desktop-eyebrow',selected.eyebrow),make('h2','',selected.title),make('p','desktop-pane-description',selected.description));heading.append(copy,badge('저장 근거 탐색'));
  const grid=make('div','desktop-pane-grid'),main=make('section','desktop-stage-evidence'),context=make('aside','desktop-stage-context');
  if(stage==='preview'){
   main.append(make('div','desktop-section-heading','등록 교재'));
   const books=make('div','desktop-book-grid');
   for(const [index,book] of options.view.books.entries()){
    const card=button('','desktop-book-card',()=>jump(root.querySelector('#c2-book-'+index)));
    const cover=make('span','desktop-book-cover'),spine=make('span','desktop-book-spine',String(index+1).padStart(2,'0'));cover.append(spine,make('span','desktop-book-cover-label',text(book.raw.bookCode,'교재')));
    const copy=make('span','desktop-book-copy');copy.append(make('strong','',text(book.label)),make('span','',`판본 ${book.edition??'미확인'} · 저장 목차`),make('span','desktop-card-link','교재 근거 열기 ↗'));card.append(cover,copy);books.append(card);
   }
   if(!options.view.books.length)books.append(make('p','desktop-empty','등록 교재 근거가 공급되지 않았습니다. 미배정을 뜻하지 않습니다.'));
   main.append(books);
   const saved=make('div','desktop-saved-prompt');saved.append(make('div','', '오늘 과제와 교사 보고'),make('p','','최근 보존된 계획과 과제를 확인할 수 있습니다. 실제 수행과 완료 여부는 각 원문을 기준으로 봅니다.'),button('저장 요약 확인','desktop-primary',()=>{const details=shell.querySelector<HTMLDetailsElement>('.legacy-today-detail');if(details)details.open=true;jump(details?.querySelector('[data-today-summary]')??null);}));main.append(saved);
   context.append(make('p','desktop-context-kicker','이 단계의 확인 범위'),make('h3','','예습 수행은 미확인'),make('p','','교재 등록과 예습 완료는 별개입니다. 정확한 과제 범위와 수행 근거를 먼저 확인하세요.'),make('div','desktop-context-rule'),make('span','desktop-context-label','기준 자료'),make('strong','', '선택 학생의 저장본'),make('p','desktop-small','학원 실시간 재조회 없음'));
  }else{
   const title=stage==='practice'?'채점 근거가 있는 기록':stage==='review'?'오답·클리닉 검토 근거':'교사 확인 원문';
   const listHeading=make('div','desktop-list-heading');listHeading.append(make('h3','',title));
   const filter=make('input','desktop-search');filter.type='search';filter.placeholder='교재 · 단원 · 코드 찾기';filter.setAttribute('aria-label','이 단계의 저장 근거 검색');filter.value=search;filter.addEventListener('input',()=>{search=filter.value;page=0;renderList();});listHeading.append(filter);main.append(listHeading);
   const list=make('div','desktop-evidence-list'),pagination=make('div','desktop-pagination');list.tabIndex=-1;list.setAttribute('role','region');list.setAttribute('aria-label',title+' 목록');main.append(list,pagination);
   function renderList(){
    list.replaceChildren();pagination.replaceChildren();
    const needle=search.trim().toLocaleLowerCase();
    const records=stage==='practice'?attempts:candidates;
    const filtered=records.filter((record:any)=>{const source=stage==='practice'?record:options.view.records[record.sourceRecordKey];return !needle||[source?.bookDisplayName,source?.unitTitle,source?.sectionDisplayLabel,source?.catalogCode,record.appCatalogCode].filter(Boolean).join(' ').toLocaleLowerCase().includes(needle);});
    const limit=5,start=page*limit,visible=filtered.slice(start,start+limit);
    for(const entry of visible as any[]){
     if(stage==='practice'){
      const scores=entry.attemptEvidence.filter((attempt:any)=>typeof attempt.score==='number').map((attempt:any)=>`${attempt.score}점`).join(' / ')||'점수 미제공';
      const row=item(text(entry.sectionDisplayLabel),`${text(entry.unitTitle)} · ${text(entry.catalogCode,'코드 미관찰')}`,scores,()=>openRecord(entry.recordId));row.dataset.desktopRecordId=entry.recordId;row.querySelector('.desktop-item-copy')!.append(make('small','',entry.attemptEvidence.map((attempt:any)=>text(attempt.dateRaw,'날짜 미제공')).join(' / ')));list.append(row);
     }else{
      const source=options.view.records[entry.sourceRecordKey],row=item(text(source?.sectionDisplayLabel,entry.appCatalogCode),`${text(source?.unitTitle)} · ${entry.appCatalogCode}`,`${entry.score}점 · ${entry.attemptRawDate}`,()=>openRecord(entry.sourceRecordKey));row.dataset.desktopRecordId=entry.sourceRecordKey;
      const states=make('div','desktop-review-states');states.append(badge('원문 오답 · '+reviewText(entry.originalWrongReview),entry.originalWrongReview==='teacher_confirmed_complete'?'verified':'unknown'),badge('유사 클리닉 · '+reviewText(entry.similarClinicReview),entry.similarClinicReview==='teacher_confirmed_complete'?'verified':'unknown'));
      row.querySelector('.desktop-item-copy')!.append(states);
      if(stage==='teacher'){
       const meta=make('p','desktop-review-provenance',`사용자 확인 근거 · 인쇄 ${entry.printConfirmation?'사용자 완료 확인':'미확인'} · 배부 ${entry.deliveryPlan?'예정, 완료 미확인':'미확인'}`);row.querySelector('.desktop-item-copy')!.append(meta);
      }
      list.append(row);
     }
    }
    if(!filtered.length)list.append(make('div','desktop-empty',needle?'검색어와 일치하는 저장 근거가 없습니다.':stage==='practice'?'이 저장본에 채점 관찰이 연결된 기록이 없습니다. 실제 미수행을 뜻하지 않습니다.':'이 학생에게 연결된 별도 교사 검토 근거가 없습니다. 검토 미실시를 뜻하지 않습니다.'));
    const previous=button('← 이전','desktop-secondary',()=>{page--;renderList();list.focus({preventScroll:true});}),next=button('다음 →','desktop-secondary',()=>{page++;renderList();list.focus({preventScroll:true});});previous.disabled=page===0;next.disabled=start+limit>=filtered.length;
    pagination.append(make('span','',`${filtered.length?start+1:0}–${Math.min(start+limit,filtered.length)} / 저장 근거 ${filtered.length}건`),previous,next);
   }
   renderList();
   context.append(make('p','desktop-context-kicker','판단의 기준'),make('h3','',stage==='practice'?'점수와 완료는 별개':stage==='review'?'두 검토 경로를 구분':'완료 근거는 원문대로'),make('p','',stage==='practice'?'채점 점수와 날짜는 저장 관찰값입니다. 100점이어도 교사 완료 판정을 대신하지 않습니다.':stage==='review'?'원문 오답과 유사 클리닉의 교사 확인을 각각 표시합니다. 인쇄 또는 배부 계획을 검토 완료로 바꾸지 않습니다.':'사용자가 확인한 검토 범위만 표시합니다. 원문 날짜, 기록 시각, 완료 시각을 서로 대신하지 않습니다.'),make('div','desktop-context-rule'),make('span','desktop-context-label','현재 탐색'),make('strong','',selected.label),make('p','desktop-small','이 단계 선택은 완료 기록을 만들지 않습니다.'));
   context.append(button('전체 교재 근거 보기 ↗','desktop-text-button',()=>jump(root.querySelector('#c2-books'))));
  }
  grid.append(main,context);pane.append(heading,grid);
  const footer=make('div','desktop-stepper-footer');footer.append(make('p','','단계는 탐색용입니다. 학습 상태와 완료 근거는 원문에 따릅니다.'));
  const index=stages.findIndex(entry=>entry.id===stage);const controls=make('div','desktop-stepper-actions');if(index>0)controls.append(button('← '+stages[index-1].label,'desktop-secondary',()=>selectStage(stages[index-1].id,true)));if(index<stages.length-1)controls.append(button(stages[index+1].label+' 살펴보기 →','desktop-primary',()=>selectStage(stages[index+1].id,true)));else controls.append(button('예습으로 돌아가기 ↗','desktop-secondary',()=>selectStage('preview',true)));footer.append(controls);pane.append(footer);
 }
 function selectStage(next:Stage,focus=false){if(!active||!stages.some(entry=>entry.id===next))return;stage=next;search='';page=0;renderPane();if(live)live.textContent=stages.find(entry=>entry.id===stage)!.label+' 근거 탐색. 학습 상태는 변경되지 않았습니다.';if(focus)tabs?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();}
 function activate(){
  if(active||disposed)return;const inner=shell.querySelector<HTMLElement>('.shell-inner');if(!inner)return;active=true;doc.body.classList.add('desktop-academy');root.dataset.desktopEvidenceRail='';extra.dataset.desktopEvidenceRail='';
  sidebar=make('aside','desktop-sidebar');sidebar.setAttribute('aria-label','학생 작업 공간');
  const brand=make('div','desktop-brand');brand.append(make('span','desktop-brand-symbol','k'),make('span','','학습 워크스페이스'));sidebar.append(brand,make('p','desktop-sidebar-label','학생'));
  relocate(inner.querySelector('.student-nav'),sidebar);
  const sidebarFoot=make('div','desktop-sidebar-footer');sidebarFoot.append(make('span','desktop-private-dot'),make('span','','본인 전용 · 읽기 화면'));sidebar.append(sidebarFoot);
  const originalTitle=inner.querySelector<HTMLElement>('.app-title');if(originalTitle){relocate(originalTitle,sidebar);originalTitle.classList.add('desktop-original-title');}
  workspace=make('section','desktop-workspace');workspace.dataset.desktopStepper='';workspace.setAttribute('aria-label','학습 단계별 근거 탐색');
  const topbar=make('div','desktop-topbar');topbar.append(make('p','','학생 학습 / '+options.studentName),badge('저장 자료 · 실시간 미연결'));
  const heading=make('div','desktop-workspace-heading'),copy=make('div');copy.append(make('p','desktop-eyebrow','LEARNING WORKSPACE'),make('h1','',options.studentName+'의 학습 확인'),make('p','','필요한 단계에 집중하고, 판단은 근거와 함께.'));const source=make('a','desktop-source-link','학생 원본 ↗');source.href='https://chatgpt.com/space/'+encodeURIComponent(options.sourcePageId);source.target='_blank';source.rel='noopener noreferrer';heading.append(copy,source);
  const frame=make('div','desktop-stepper-frame');tabs=make('div','desktop-stepper-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','학습 단계 탐색, 완료 상태 아님');
  tabs.append(make('span','desktop-step-glider'));
  stages.forEach((entry,index)=>{const tab=button('','desktop-step',()=>selectStage(entry.id));tab.id='desktop-step-'+entry.id;tab.dataset.desktopStage=entry.id;tab.setAttribute('role','tab');tab.setAttribute('aria-controls','desktop-stage-panel');tab.append(make('span','desktop-step-number',String(index+1)),make('span','desktop-step-label',entry.label));tab.addEventListener('keydown',event=>{let target=index;if(event.key==='ArrowRight')target=(index+1)%stages.length;else if(event.key==='ArrowLeft')target=(index+stages.length-1)%stages.length;else if(event.key==='Home')target=0;else if(event.key==='End')target=stages.length-1;else return;event.preventDefault();selectStage(stages[target].id,true);});tabs!.append(tab);});
  pane=make('div','desktop-stepper-pane');pane.id='desktop-stage-panel';pane.setAttribute('role','tabpanel');pane.tabIndex=0;live=make('div','desktop-sr-only');live.setAttribute('role','status');live.setAttribute('aria-live','polite');frame.append(tabs,pane);workspace.append(topbar,heading);relocate(inner.querySelector('.student-event-view'),workspace);workspace.append(frame,live);
  drawers=make('div','desktop-context-drawers');const work=make('details','desktop-drawer'),provenance=make('details','desktop-drawer');work.append(make('summary','','수업 배정 · 업무 기준'));provenance.append(make('summary','','자료 범위 · 조회 시각 · 연결 상태'));
  relocate(inner.querySelector('.workflow-view'),work);relocate(inner.querySelector('.refresh-state'),provenance);relocate(inner.querySelector('.coverage-details'),provenance);relocate(inner.querySelector('.refresh-readiness'),provenance);drawers.append(work);relocate(inner.querySelector('.legacy-today-detail'),drawers);drawers.append(provenance);
  inner.prepend(sidebar,workspace);inner.append(drawers);renderPane();
 }
 function deactivate(){if(!active)return;const focusWasInDesktop=!!(workspace?.contains(doc.activeElement)||sidebar?.contains(doc.activeElement));active=false;for(const {node,placeholder}of restores.splice(0)){if(placeholder.parentNode)placeholder.replaceWith(node);else node.remove();node.classList.remove('desktop-original-title');}sidebar?.remove();workspace?.remove();drawers?.remove();sidebar=workspace=drawers=pane=tabs=live=null;doc.body.classList.remove('desktop-academy');delete root.dataset.desktopEvidenceRail;delete extra.dataset.desktopEvidenceRail;if(focusWasInDesktop)shell.querySelector<HTMLButtonElement>('[data-student-id][aria-pressed="true"]')?.focus({preventScroll:true});}
 const onChange=()=>{if(media?.matches)activate();else deactivate();};
 media?.addEventListener('change',onChange);onChange();
 return {selectStage,getStage:()=>stage,get active(){return active;},dispose(){if(disposed)return;disposed=true;media?.removeEventListener('change',onChange);deactivate();}};
}

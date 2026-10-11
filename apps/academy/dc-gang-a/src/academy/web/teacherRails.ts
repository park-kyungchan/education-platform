import type {TeacherSourceResult} from '../teacherWorkContext';
export interface EvidenceRailRow {
 readonly id:string;readonly title:string;readonly code:string;readonly status:string;readonly value:string|null;readonly date:string;readonly teacherState:string;
 readonly columns:readonly {title:string;fields:readonly (readonly [string,string])[]}[];
 readonly items?:readonly {label:string;correctness:'O'|'X'}[];readonly note:string;
}
export const escapeRailText=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const e=escapeRailText;
/** Shared read-only presentation for protected real scenes and explicitly synthetic gallery fixtures. */
export function renderEvidenceRailRow(row:EvidenceRailRow,open=false):string{
 const id='rail-'+encodeURIComponent(row.id);
 return `<details class="record" name="teacher-source-evidence" data-source-evidence="true" data-record-container="${e(row.id)}" ${open?'open':''}><summary class="record-summary" data-record-id="${e(row.id)}" aria-controls="${e(id)}"><span class="glyph observed" aria-hidden="true">⊙</span><span class="record-label">${e(row.title)}</span><span class="code">${e(row.code)}</span><span class="evidence-status observed">${e(row.status)}</span><span class="numeric ${row.value===null?'empty':''}">${row.value===null?'채점 근거 별도':e(row.value)+'<small>점</small>'}<span class="raw-date">${e(row.date)}</span></span><span class="teacher">${e(row.teacherState)}</span><span class="expand-sign" aria-hidden="true">+</span></summary><div class="inline-evidence" id="${e(id)}" role="region" aria-label="${e(row.title)} 근거"><div class="detail-line"><h5>${e(row.title)}</h5></div><div class="detail-columns">${row.columns.map(column=>`<section><h6>${e(column.title)}</h6><dl>${column.fields.map(([key,value])=>`<dt>${e(key)}</dt><dd>${e(value)}</dd>`).join('')}</dl></section>`).join('')}</div>${row.items?.length?`<div class="item-result-list" aria-label="원본 문항별 채점">${row.items.map(item=>`<span class="item-result" data-correctness="${e(item.correctness)}">${e(item.label)}번 ${e(item.correctness)}</span>`).join('')}</div>`:''}<p class="read-only-note">${e(row.note)}</p></div></details>`;
}
export function sourceEvidenceRail(result:TeacherSourceResult):EvidenceRailRow{
 const record=result.record;
 return {id:result.revisionRef+':'+record.paperKey+':'+record.attemptKey,title:record.sourceTitle,code:'프린트 '+record.paperKey,status:'원본 채점',value:String(record.score),date:record.sourceDate.literal??'원문 날짜 미제공',teacherState:'교사 판단 별도',columns:[
  {title:'정확한 대상과 연결 범위',fields:[['원문 라벨',record.sourceTitle],['과정',record.courseKey],['교재',record.bookNo],['프린트',record.paperKey],['응시',record.attemptKey],['목차 대응','섹션 연결 미확인 · 이름으로 연결하지 않음']]},
  {title:'채점과 원본 날짜',fields:[['원본 점수',String(record.score)+'점'],['원문 날짜',record.sourceDate.literal??'미제공'],['날짜 정밀도',record.sourceDate.precision==='month_day'?'월·일만 제공 · 연도 미확인':'미확인'],['날짜 의미','원문 적용일 · 정확한 채점 시각 아님'],['교사 완료','점수에서 추정하지 않음']]},
  {title:'보존된 근거의 시각',fields:[['원천 관측',result.sourceObservedAt],['마지막 확인',result.lastVerifiedAt],['보존 시각',result.recordedAt],['근거 버전',result.revisionRef]]},
 ],items:record.items.map(item=>({label:item.originalOrdinal,correctness:item.scoring})),note:'정답·풀이 과정·교사 검사는 별개입니다. 이 채점 기록을 실제 배정이나 교사 완료로 바꾸지 않습니다. 정확한 배정·풀이 검사는 별도 교사 기록에서 확인합니다.'};
}
/** Only local expansion/focus; no network, record mutation or global draft ownership. */
export function wireEvidenceRails(root:HTMLElement):()=>void{
 const summaries=()=>[...root.querySelectorAll<HTMLElement>('details.record[data-source-evidence] > summary[data-record-id]')];
 const toggle=(summary:HTMLElement,open:boolean)=>{
  if(open)for(const other of summaries())if(other!==summary){(other.parentElement as HTMLDetailsElement).open=false;other.setAttribute('aria-expanded','false');}
  (summary.parentElement as HTMLDetailsElement).open=open;summary.setAttribute('aria-expanded',String(open));
 };
 const click=(event:Event)=>{const summary=(event.target as HTMLElement).closest<HTMLElement>('summary[data-record-id]');if(!summary||!root.contains(summary))return;event.preventDefault();toggle(summary,!(summary.parentElement as HTMLDetailsElement).open);};
 const keydown=(event:KeyboardEvent)=>{const summary=(event.target as HTMLElement).closest<HTMLElement>('summary[data-record-id]');if(!summary||!root.contains(summary))return;
  if(['Enter',' ','Escape'].includes(event.key)){event.preventDefault();toggle(summary,event.key==='Escape'?false:!(summary.parentElement as HTMLDetailsElement).open);return;}
  const all=summaries(),index=all.indexOf(summary);let next=index;
  if(event.key==='ArrowDown')next=Math.min(all.length-1,index+1);else if(event.key==='ArrowUp')next=Math.max(0,index-1);else if(event.key==='Home')next=0;else if(event.key==='End')next=all.length-1;else return;
  event.preventDefault();all[next]?.focus();
 };
 root.addEventListener('click',click);root.addEventListener('keydown',keydown);
 return()=>{root.removeEventListener('click',click);root.removeEventListener('keydown',keydown);};
}

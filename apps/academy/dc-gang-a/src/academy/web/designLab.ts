import {designLabThemes,designLabFilters,designLabSamples,selectDesignLab,type DesignLabSelection} from './designLabCatalog';
import {teacherStyles} from './teacherStyles';
import {escapeRailText as e,renderEvidenceRailRow,type EvidenceRailRow} from './teacherRails';
const url=(selection:DesignLabSelection)=>'/design-lab?'+new URLSearchParams({...selection}).toString();
/** No product store or private data: the exact same rail renderer receives closed synthetic examples. */
export function renderDesignLab(query=new URLSearchParams()):string {
 const selected=selectDesignLab(query),theme=designLabThemes[0];
 const rows=designLabSamples.filter(row=>selected.filter==='all'||row.state===selected.filter),focus=rows.find(row=>row.id===selected.focus)??rows[0];
 const records=rows.map(row=>{
  const rail:EvidenceRailRow={id:'sample-'+row.id,title:row.name+' · '+row.task,code:'합성 예시 '+row.id.toUpperCase(),status:row.label,value:null,date:'합성 수업 장면',teacherState:'교사 판단 별도',columns:[
   {title:row.book,fields:row.evidence.map(f=>[f.label,f.value] as const)},
   {title:'교사 원문과 상황',fields:[['관찰',row.note],['자료 범위','화면 비교용 합성 자료 · 실제 원본 아님']]},
   {title:'다음 확인과 동작 범위',fields:[['다음 확인',row.next],['샘플 경계',row.guard]]},
  ],note:'합성 예시입니다. 실제 학생의 배정·시도·교사 원본을 불러오거나 저장하지 않습니다.'};
  return '<div data-sample="'+row.id+'"'+(row.id===focus?.id?' data-detail="'+row.id+'"':'')+'>'+renderEvidenceRailRow(rail,row.id===focus?.id)+'</div>';
 }).join('');
 return `<!doctype html><html lang="ko" data-theme="gang-a"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>디자인 실험실 · DC Gang A</title><style>${teacherStyles}
.lab-filters{display:flex;gap:20px;flex-wrap:wrap;margin:24px 0}.lab-filters a{font-size:13px;text-decoration:none;padding:6px 0;border-bottom:2px solid transparent}.lab-filters a[aria-current=page]{color:var(--accent);border-color:var(--accent)}.lab-reference{font-size:12px;color:var(--muted);margin-top:34px}.lab-reference summary{cursor:pointer}.lab-empty{font-size:14px;padding:30px 0;color:var(--muted)}
</style></head><body class="teacher-rails" data-design="gang-a"><a class="skip" href="#work">수업 샘플로 바로 이동</a><div class="frame"><div class="topline"><span class="wordmark">DC GANG A · DESIGN LAB</span><a href="/">실제 교사 화면으로 돌아가기</a></div><header class="hero"><div><p class="overline">선택한 디자인 · gang-a</p><h1>디자인 실험실</h1><p class="hero-note">교재의 흐름을 따라, 필요한 근거를 같은 행 아래에서.<br>실제 앱과 같은 서체·간격·행 구성으로 교사 장면을 살펴봅니다.</p></div><div><div class="count-line"><span><strong>${designLabSamples.length}</strong> <small>합성 장면</small></span><span><strong>1</strong> <small>선택한 디자인</small></span></div><p class="source-time">실제 학생 정보나 학원 자료를 조회하지 않습니다.<br>샘플 선택은 교사 판단이나 공식 저장이 아닙니다.</p></div></header>
<p class="notice" data-synthetic-only="true"><b>합성 데이터 전용</b><span>교사 기록 저장·학원 조회·메시지 발송은 하지 않습니다.</span></p>
<nav class="book-nav" aria-label="디자인 참고"><a data-theme="gang-a" aria-current="page" href="${e(url(selected))}">${e(theme.name)} <span>${e(theme.subtitle)}</span></a></nav>
<nav class="lab-filters" aria-label="작업 상태 필터">${designLabFilters.map(row=>`<a href="${e(url({...selected,filter:row.id}))}" ${row.id===selected.filter?'aria-current="page"':''}>${e(row.label)}</a>`).join('')}</nav>
<section class="book" id="work" aria-labelledby="work-title"><div class="book-head"><span class="book-number">01</span><div><h2 id="work-title">수업 중, 다음 확인</h2><div class="identity">정답 · 풀이 · 교사 검사 · 근거 미확인을 따로 읽습니다.</div></div><div class="coverage">현재 조건 ${rows.length}개 장면<br>전체 수업의 완료율이 아닙니다.</div></div><nav class="book-nav" aria-label="합성 장면 선택">${rows.map(row=>`<a href="${e(url({...selected,focus:row.id}))}#work">${e(row.name)}</a>`).join('')}</nav><div class="record-stack">${records||'<p class="lab-empty" data-empty>이 조건에 해당하는 합성 예시가 없습니다. 수업 전체 완료를 뜻하지 않습니다.</p>'}</div></section>
<details class="lab-reference"><summary>디자인 출처와 샘플 범위</summary><p>${e(theme.reference)}</p><p>원형의 종이색·먹색·강조색, 교재 번호와 얇은 행, 같은 행 아래의 근거를 유지했습니다. 실제 앱과 같은 구성요소를 사용하며 한국어 웹폰트는 자체 제공합니다.</p><p>예전 비교안 주소도 현재 선택한 디자인으로 연결됩니다. 이 화면의 모든 문구는 합성 예시이며 학생 원본을 복제하지 않습니다.</p></details><footer class="footer"><div><h2>근거와 판단은 각각 그대로</h2><p>기록이 없다는 이유로 미수행을 판정하지 않습니다. 점수와 교사 완료를 합치지 않습니다.</p></div><p>Teacher-only design lab · sample revision 2 · 실제 제품 기록과 독립된 합성 장면</p></footer></div></body></html>`;
}

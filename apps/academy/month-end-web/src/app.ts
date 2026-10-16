import {filterItems, missingFields, requirePreviewData, validDate, validTimeZone, type DisplayItem} from './model';

const app = document.querySelector<HTMLElement>('#app')!;
function el<K extends keyof HTMLElementTagNameMap>(tag:K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); node.textContent = text; node.className = className; return node;
}
function button(text:string, action:()=>void, className = '') {
  const node = el('button',text,className);node.type='button';node.addEventListener('click',action);return node;
}
function field(label:string, input:HTMLElement) {const wrapper=el('label',label,'field');wrapper.append(input);return wrapper;}
function pill(text:string, tone='') {return el('span',text,`pill ${tone}`);}
const data = requirePreviewData(JSON.parse(document.querySelector('#preview-data')!.textContent!));
const requirement=data.requirement;
let view: 'pool'|'match'|'assessment'|'source' = 'pool';
let examples = true;
let query = '', unit = '', completeness = '';
let openItem: string|null = null;
let examDate = '', timeZone = '', desired = '', learned = '';
const tabs = [['pool','라벨 탐색'],['match','유사 라벨 찾기'],['assessment','월말평가 분석'],['source','연결 상태']] as const;

const sidebar=el('aside','','sidebar'), brand=el('div','','brand');
brand.append(el('span','강아','brand-mark'),el('span','문항실','brand-title'),el('span','TEACHER WORKBENCH','eyebrow'));
const nav=el('nav','','main-nav');nav.setAttribute('aria-label','주 메뉴');
const navButtons = tabs.map(([key,label],index)=>{
  const node=button('',()=>{view=key;openItem=null;render();});
  node.append(el('span',String(index+1).padStart(2,'0'),'nav-index'),el('span',label));
  node.dataset.view=key;nav.append(node);return node;
});
const sideNote=el('div','','side-note');sideNote.append(el('span','OCTOBER / GRADE 3','eyebrow'),el('p','잘 고른 한 문항이\n깊은 배움으로.'),el('small','기존 문항과 라벨의 근거를 살펴보고,\n교사의 판단으로 평가를 준비합니다.'));
const sideFooter=el('div','','side-footer');sideFooter.append(el('span','●','connection-dot'),el('span','독립 화면 미리보기'),el('small','원천 연결 전 · 합성 자료'));
sidebar.append(brand,nav,sideNote,sideFooter);
const frame=el('div','','frame'),topbar=el('header','','topbar');
const breadcrumbs=el('div','','breadcrumbs');breadcrumbs.append(el('span','학원 워크벤치'),el('span','/'),el('strong','문항실'));
topbar.append(breadcrumbs,pill('읽기 전용 미리보기','green'));
const main=el('main','','main');main.id='main';
const footer=el('footer','','footer');footer.append(el('span','문항의 출처와 교사의 판단을 함께 보존합니다.'),el('span','ACADEMY · INDEPENDENT PREVIEW'));
frame.append(topbar,main,footer);app.append(sidebar,frame);

function heading(kicker:string,title:string,description:string) {
  const section=el('div','','page-heading'),copy=el('div');
  copy.append(el('p',kicker,'eyebrow'),el('h1',title),el('p',description,'subtitle'));section.append(copy);return section;
}
function banner() {
  const node=el('div','','preview-banner');
  node.append(el('span','예시 모드','banner-label'),el('p',examples
    ? '지금 보이는 8개 라벨과 문항은 화면 검증용 합성 예시입니다. 실제 학원 pool과 연결되지 않았습니다.'
    : '실제 학원 pool의 문항·라벨·위계는 아직 입력되지 않았습니다. 전체 개수와 현재 상태는 미확인입니다.'));
  node.append(button(examples?'실제 자료 상태 보기':'합성 예시로 화면 보기',()=>{examples=!examples;openItem=null;query='';unit='';completeness='';render();},'text-button'));
  return node;
}
function assessmentSummary() {
  const aside=el('aside','','assessment-rail');aside.setAttribute('aria-label','월말평가 조건');
  aside.append(el('p','ASSESSMENT NOTE','eyebrow'),el('h2','10월 월말평가'),el('p','초등 3학년 · 서술형','muted'));
  const numbers=el('div','','assessment-numbers');
  for(const [value,label] of [['24','문항'],['100','점'],['80','분']]){const cell=el('div');cell.append(el('strong',value),el('span',label));numbers.append(cell);}
  aside.append(numbers);
  const bands=el('div','','bands');for(const band of requirement.pointBands){const row=el('div');row.append(el('span',`${band.points}점`),el('span',`${band.questions}문항`));bands.append(row);}
  aside.append(bands,el('p','15:00 시작 → 16:20 시험 종료','timing-note'),el('p','정확한 날짜 · 시간대 미확정','small-note'));
  const progress=el('div','','selection-note');progress.append(el('span','선택된 시험 문항'),el('strong','0 / 24'),el('small','라벨 탐색은 시험 문항 선택과 구분합니다.'));
  aside.append(progress,button('평가 조건 살펴보기 ↗',()=>{view='assessment';render();},'secondary-button'));
  const note=el('div','','rail-note');note.append(el('span','먼저, 유형을 이해하기','serif-note'),el('p','세부 유형을 학습한 뒤 원하는 문항의 특징을 정리하고, 기존 위계에서 유사한 라벨을 찾습니다.'));
  aside.append(note);return aside;
}
function itemDetail(item:DisplayItem) {
  const panel=el('section','','item-detail');panel.dataset.role='item-detail';
  panel.append(el('p',`${item.label} · 합성 예시`,'eyebrow'),el('h3','문항과 라벨의 근거'));
  const candidate=item.candidate;
  panel.append(el('p',candidate.content.state==='known'?candidate.content.value:'원문 미확인','question-body'));
  const answer=el('details','','answer');answer.append(el('summary','정답 예시 확인'),el('p',candidate.answer.state==='known'?candidate.answer.value:'정답 근거가 입력되지 않았습니다.'));
  panel.append(answer);
  const info=el('dl','','detail-facts');
  for(const [label,value] of [
    ['예시 라벨',item.tags.join(' · ')],['예시 단원',item.unitLabel],['라벨 ID',candidate.sourceItem.literalKey],
    ['출처','처음부터 만든 화면 검증용 자료'],['난이도',candidate.difficulty.state==='known'?`${candidate.difficulty.value.level} · 합성 원천 주장`:'근거 미확인'],
    ['판본',candidate.edition.state==='known'?candidate.edition.value.literalKey:'미확인'],
  ]){info.append(el('dt',label),el('dd',value));}
  panel.append(info,el('p','위 라벨과 단원은 실제 학원 분류체계가 아닙니다. 배점으로 난이도나 유사도를 추정하지 않습니다.','small-note'));
  return panel;
}
function renderPool() {
  const head=heading('QUESTION LABEL LIBRARY','익숙한 유형에서,\n찾고 싶은 문항까지.','라벨과 원문을 나란히 살펴보고, 원하는 문항의 특징을 구체화하세요.');
  head.append(button('유사 라벨 찾기 ↗',()=>{view='match';render();},'primary-button'));
  main.append(head,banner());
  const layout=el('div','','workspace-layout'),work=el('section','','pool-work');
  const filters=el('div','','filters');
  const search=el('input');search.type='search';search.placeholder='라벨, 문항, 유형 키워드 검색';search.value=query;search.id='label-search';
  const select=el('select');select.setAttribute('aria-label','예시 단원');select.append(new Option('모든 예시 단원',''));
  for(const label of [...new Set(data.examples.map(item=>item.unitLabel))])select.append(new Option(label,label));select.value=unit;
  const status=el('select');status.setAttribute('aria-label','근거 상태');status.append(new Option('모든 근거 상태',''),new Option('입력 항목 있음','complete'),new Option('미확인 항목 있음','partial'));status.value=completeness;
  filters.append(field('문자 검색',search),field('예시 범위',select),field('근거 상태',status));work.append(filters);
  const count=el('p','','result-count');count.setAttribute('aria-live','polite');
  const list=el('div','','item-list');list.dataset.role='item-list';
  const update=()=>{
    const visible=examples?filterItems(data.examples,{query,unit,completeness}):[];
    count.textContent=examples?`합성 예시 ${visible.length}개 / ${data.examples.length}개 · 원래 입력 순서 · 실제 pool 개수 미확인`:'실제 pool 미연결 · 조회 결과가 0개라는 뜻이 아닙니다.';
    list.replaceChildren();
    if(!visible.length){const empty=el('div','','empty-state');empty.append(el('span','—','empty-symbol'),el('h2',examples?'일치하는 예시가 없습니다.':'아직 원천 라벨을 불러오지 않았습니다.'),el('p',examples?'검색어나 필터를 바꾸어 살펴보세요.':'기존 MCP의 라벨 조회 도구와 연결하면 원래 ID와 위계를 그대로 표시합니다.'));if(examples)empty.append(button('검색과 필터 초기화',()=>{query='';unit='';completeness='';render();},'secondary-button'));list.append(empty);}
    for(const item of visible){
      const row=el('article','','item-row'),left=el('div','','item-number');left.append(el('span',item.label.replace('예시 ','')),el('small','DEMO'));
      const body=el('div','','item-copy');body.append(el('p',`${item.unitLabel} / 화면 검증용 판본`,'item-path'),el('h2',item.tags.filter(tag=>!tag.includes('미확인')).join(' · ')),el('p',item.candidate.content.state==='known'?item.candidate.content.value:'원문 미확인','item-excerpt'));
      const tags=el('div','','tags');tags.append(pill('서술형'),pill(missingFields(item).length?'근거 미확인':'합성 근거 입력',missingFields(item).length?'amber':'green'));body.append(tags);
      const action=button(openItem===item.candidate.id?'닫기 −':'근거 보기 ＋',()=>{openItem=openItem===item.candidate.id?null:item.candidate.id;update();},'detail-button');action.setAttribute('aria-expanded',String(openItem===item.candidate.id));
      const detailId=`detail-${item.candidate.sourceItem.literalKey}`;action.setAttribute('aria-controls',detailId);
      row.append(left,body,action);if(openItem===item.candidate.id){const detail=itemDetail(item);detail.id=detailId;row.append(detail);}list.append(row);
    }
  };
  search.addEventListener('input',()=>{query=search.value;update();});select.addEventListener('change',()=>{unit=select.value;update();});status.addEventListener('change',()=>{completeness=status.value;update();});
  work.append(count,list);update();layout.append(work,assessmentSummary());main.append(layout);
}

function renderMatch() {
  main.append(heading('FROM UNDERSTANDING TO DISCOVERY','어떤 문항을 찾고 있나요?','학습한 세부 유형과 원하는 문항의 특징을 먼저 정리합니다. 실제 라벨의 비교는 기존 위계를 기준으로 합니다.'),banner());
  const layout=el('div','','workspace-layout'),form=el('section','','form-panel');
  form.append(el('p','01 · 탐색 의도','eyebrow'),el('h2','유형을 이해한 다음, 라벨 찾기'));
  const learnedInput=el('input');learnedInput.placeholder='학습한 세부 유형 또는 정확한 위계 ID';learnedInput.value=learned;learnedInput.addEventListener('input',()=>{learned=learnedInput.value;});
  const desiredInput=el('textarea');desiredInput.rows=5;desiredInput.placeholder='예: 계산값보다 풀이의 오류를 설명하는 문항을 찾고 싶어요.\n수의 범위, 필요한 사고, 표현 방식 등을 적어 주세요.';desiredInput.value=desired;desiredInput.addEventListener('input',()=>{desired=desiredInput.value;});
  form.append(field('학습한 세부 유형',learnedInput),field('찾고 싶은 문항의 특징',desiredInput));
  const result=el('div','','query-status');result.setAttribute('role','status');
  form.append(button('조회 준비 확인',()=>{
    result.replaceChildren();
    if(!learned.trim()||!desired.trim()){result.append(el('p','학습한 세부 유형과 원하는 문항의 특징을 모두 입력해 주세요.'));return;}
    result.append(el('strong','탐색 의도를 정리했습니다.'),el('p','실제 라벨 스냅샷과 원래 위계 ID가 아직 연결되지 않아 조회는 실행하지 않았습니다. 입력 내용은 이 화면의 메모리에만 유지됩니다.'),el('p','MCP 조회 → 동일 위계 내 라벨 후보 → 원문 비교 근거 → 교사 판단 순서로 이어집니다.'));
  },'primary-button'),result);
  const steps=el('ol','','match-steps');for(const [title,note] of [
    ['유형 학습','완료 여부는 교사가 판단합니다.'],['기존 위계로 범위 지정','새 위계나 라벨 ID를 추정하지 않습니다.'],['유사 라벨 비교','검색 방식과 비교 근거를 함께 확인합니다.'],['문항 원문 검토','라벨 유사도는 최종 문항 적합성 판단과 다릅니다.'],
  ]){const step=el('li');step.append(el('strong',title),el('p',note));steps.append(step);}
  form.append(steps);layout.append(form,assessmentSummary());main.append(layout);
}

function renderAssessment() {
  main.append(heading('OCTOBER ASSESSMENT','평가의 조건부터, 명확하게.','이미 확인된 조건과 교사의 결정이 필요한 정보를 한곳에서 살펴봅니다.'));
  const grid=el('div','','metric-grid');for(const [value,label,note] of [['24','서술형 문항','초등 3학년 · 10월'],['100','총 배점','3점×12 + 5점×8 + 6점×4'],['80','시험 시간 / 분','15:00 시작 · 16:20 종료']]){const metric=el('section','','metric');metric.append(el('span',label,'eyebrow'),el('strong',value),el('p',note));grid.append(metric);}main.append(grid);
  const layout=el('div','','workspace-layout'),panel=el('section','','form-panel');panel.append(el('p','CALENDAR & SCOPE','eyebrow'),el('h2','날짜와 시간대는 각각 확인합니다.'));
  const dateInput=el('input');dateInput.type='date';dateInput.value=examDate;dateInput.dataset.role='exam-date';
  const zoneInput=el('input');zoneInput.type='text';zoneInput.placeholder='확인된 IANA 시간대';zoneInput.value=timeZone;zoneInput.dataset.role='exam-timezone';zoneInput.setAttribute('list','timezone-options');
  const options=el('datalist');options.id='timezone-options';for(const value of ['Asia/Seoul','Etc/UTC'])options.append(new Option(value,value));
  const status=el('p','','calendar-status');status.setAttribute('role','status');
  const update=()=>{
    const dateState=examDate?(validDate(examDate)?examDate:'잘못된 날짜'):'시험일 미확정';
    const zoneState=timeZone?(validTimeZone(timeZone)?timeZone:'유효한 시간대인지 확인해 주세요'):'시간대 미확정';
    status.textContent=`${dateState} · ${zoneState} · 화면 메모이며 저장되지 않습니다.`;
  };
  dateInput.addEventListener('input',()=>{examDate=dateInput.value;update();});zoneInput.addEventListener('input',()=>{timeZone=zoneInput.value;update();});update();
  const fields=el('div','','calendar-fields');fields.append(field('시험일 · 확정 전에는 빈칸',dateInput),field('시간대 · 별도로 입력',zoneInput));panel.append(fields,options,status);
  const timeline=el('div','','timeline');for(const [time,title,note] of [['15:00','시험 시작','80분 동안 서술형 평가'],['16:20','시험 종료','채점과 학생 간 하브루타'],['18:00','수업 종료','시험 후 100분의 세부 배분 미확정']]){const row=el('div');row.append(el('strong',time),el('span',title),el('small',note));timeline.append(row);}panel.append(timeline);
  const unresolved=el('section','','unresolved');unresolved.append(el('h3','다음에 확인할 정보'));const ul=el('ul');for(const text of ['정확한 교재 판본과 겹치지 않는 단원 범위','실제 라벨·문항 목록과 문항→유형 연결 근거','난이도 원천 주장 또는 교사 판단 근거','원천 자료의 현재 상태와 조회 범위'])ul.append(el('li',text));unresolved.append(ul);panel.append(unresolved);
  layout.append(panel,assessmentSummary());main.append(layout);
}

function renderSource() {
  main.append(heading('SOURCE & CONNECTION','근거는 이어가고, 의존성은 줄입니다.','화면은 MagicPath 없이 정적 파일만으로 실행됩니다. 실제 학원 조회와 교사의 판단은 각각의 소유자를 유지합니다.'));
  const panel=el('section','','source-panel');panel.append(el('h2','현재 연결 상태'));
  const rows=[['독립 프론트엔드','실행 가능','정적 HTML · CSS · JavaScript · 로컬 폰트'],['실제 문항 라벨 pool','화면 미연결','전체 문항수 · 평가 단원 범위 · 원문 현재 상태 미확인'],['기존 custom MCP','별도 조회 검증','기존 위계 → 유형 라벨 → 문항 정보·미리보기 참조'],['라벨 유사도 조회','별도 도구 준비','유형 학습 완료 후 기존 위계 안에서 원문 라벨 대조'],['MagicPath 원본 화면','접근 미확인','API 한도 소진 · 공개 주소는 홈페이지로 이동'],['시험 문항 구성','사용자 결정 전','선택 0개 · 생성·최종 구성·저장 없음']];
  const table=el('table');const caption=el('caption','화면 실행과 실제 원천 연결은 별도 상태입니다.');table.append(caption);const thead=el('thead'),header=el('tr');for(const title of ['영역','상태','확인 범위'])header.append(el('th',title));thead.append(header);table.append(thead);const tbody=el('tbody');for(const [name,state,note] of rows){const row=el('tr');row.append(el('th',name),el('td',state),el('td',note));tbody.append(row);}table.append(tbody);panel.append(table);
  const details=el('details','','source-details');details.append(el('summary','DATA / LOGIC / ACTION / GOVERNANCE 경계'));const dl=el('dl');for(const [title,note] of [['DATA','기존 라벨 ID·위계·원문·개정·조회 범위를 보존합니다.'],['LOGIC','라벨 비교 근거와 최종 문항 적합성을 구분합니다.'],['ACTION','이번 미리보기는 탐색·필터·근거 확인만 제공합니다.'],['GOVERNANCE','학원 원천은 읽기 전용이며 실제 자료와 자격증명을 정적 페이지에 넣지 않습니다.']])dl.append(el('dt',title),el('dd',note));details.append(dl);panel.append(details);main.append(panel);
}
function render() {
  main.replaceChildren();for(const node of navButtons){const selected=node.dataset.view===view;node.classList.toggle('active',selected);if(selected)node.setAttribute('aria-current','page');else node.removeAttribute('aria-current');}
  document.title=`${tabs.find(([key])=>key===view)![1]} · 문항실`;
  if(view==='pool')renderPool();else if(view==='match')renderMatch();else if(view==='assessment')renderAssessment();else renderSource();
}
render();

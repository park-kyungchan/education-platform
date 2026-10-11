/** Presentation fixtures, NOT canonical students, classroom policy or product state. */
export const designLabThemes=[
  {id:'gang-a',name:'gang-a · 교재와 근거',subtitle:'선택한 원형 · 종이색과 행별 근거',reference:'park-kyungchan/gang-a@d60498707b49ae75ef6916fecdbb7458b2ac58ea; original rails/CSS with licensed Korean fonts and measured readability adaptations'},
] as const;
export type DesignLabTheme=typeof designLabThemes[number]['id'];
export const designLabFilters=[{id:'all',label:'전체 보기'},{id:'review',label:'교사 검토 대기'},{id:'unknown',label:'근거 미확인'},{id:'completed',label:'확인 완료'}] as const;
export type DesignLabFilter=typeof designLabFilters[number]['id'];
interface DesignLabSample {
  readonly id:'a'|'b'|'c'|'d';readonly name:string;readonly book:string;
  readonly state:'review'|'unknown';readonly label:string;readonly task:string;readonly next:string;
  readonly evidence:readonly {label:string;value:string}[];readonly note:string;readonly guard:string;
}
export const designLabSamples=[
  {id:'a',name:'예시 학생 A',book:'합성 교재 · 분수의 나눗셈',state:'review',label:'설명 확인 대기',task:'12번은 정답 O, 풀이 기록은 없음',next:'12번의 풀이 과정을 설명하도록 요청',evidence:[{label:'원본 채점',value:'정답 O · 합성 원본 시도 r1'},{label:'풀이 기록',value:'미작성 · 정답과 풀이 상태는 별개'},{label:'교사 판단',value:'설명 확인 전 · 완료로 처리하지 않음'}],note:'정답은 맞혔지만 계산 과정이 남아 있지 않음. 설명을 듣고 다음 판단을 기록할 장면입니다.',guard:'샘플에서는 설명 요청이나 검사 완료를 저장하지 않습니다.'},
  {id:'b',name:'예시 학생 B',book:'합성 교재 · 일차방정식',state:'review',label:'새 근거 확인 대기',task:'이전 시도 검사는 완료, 새 제출은 미검토',next:'이전 검사 이력을 보존하고 새 제출만 비교',evidence:[{label:'이전 교사 기록',value:'합성 시도 r1 검사 완료 · 이력 보존'},{label:'새 제출',value:'합성 시도 r2 · 별도 검사 필요'},{label:'현재 판단',value:'이전 완료를 새 시도 완료로 옮기지 않음'}],note:'새 자료가 들어와도 이전에 확인한 내용은 사라지지 않습니다. 이번에 확인할 차이를 분리해 보여줍니다.',guard:'채점 결과와 교사 검사 완료는 서로 다른 근거입니다.'},
  {id:'c',name:'예시 학생 C',book:'합성 교재 · 도형의 성질',state:'unknown',label:'연결 근거 미확인',task:'교재 범위는 보이지만 실제 과제 연결은 없음',next:'배정된 문제 범위를 확인한 뒤 다음 작업 결정',evidence:[{label:'교재 목록',value:'합성 단원 표시 있음'},{label:'실제 배정',value:'미확인 · 전체 단원을 숙제로 추정하지 않음'},{label:'학습 상태',value:'자료 부족 · 미수행 판정 불가'}],note:'목록에 있다는 이유만으로 과제가 배정된 것은 아닙니다. 무엇을 모르는지 먼저 드러냅니다.',guard:'확인되지 않은 배정·문항·시도는 자동 연결하지 않습니다.'},
  {id:'d',name:'예시 학생 D',book:'합성 교재 · 비와 비율',state:'unknown',label:'갱신 결과 미확인',task:'새 조회는 실패, 마지막 확인 근거는 보존',next:'기존 근거의 시점을 확인하고 재조회 여부 결정',evidence:[{label:'마지막 확인',value:'합성 이전 관측 · 최신이라고 표시하지 않음'},{label:'새 조회',value:'실패 상태 예시 · 실제 요청 없음'},{label:'교사 원문',value:'기존 기록 보존 · 자동 재전송 없음'}],note:'화면을 다시 열었다는 사실과 학원 자료가 새로 조회됐다는 사실을 구분하는 장면입니다.',guard:'이 샘플은 장애 화면 비교용이며 실제 네트워크 재시도를 하지 않습니다.'},
] as const satisfies readonly DesignLabSample[];
export type DesignLabFocus=typeof designLabSamples[number]['id'];
export interface DesignLabSelection {theme:DesignLabTheme;filter:DesignLabFilter;focus:DesignLabFocus}
export function selectDesignLab(query:URLSearchParams):DesignLabSelection {
  const fields=['theme','filter','focus'];
  if([...query.keys()].some(key=>!fields.includes(key))||fields.some(key=>query.getAll(key).length>1))throw Error('invalid_design_selection');
  const requested=query.get('theme')??'gang-a',theme=['baseline','notion','linear'].includes(requested)?'gang-a':requested,filter=query.get('filter')??'all';
  if(!designLabThemes.some(row=>row.id===theme)||!designLabFilters.some(row=>row.id===filter))throw Error('invalid_design_selection');
  const visible=designLabSamples.filter(row=>filter==='all'||row.state===filter);
  const focus=query.get('focus')??visible[0]?.id??'a';
  if(!designLabSamples.some(row=>row.id===focus))throw Error('invalid_design_selection');
  return {theme:theme as DesignLabTheme,filter:filter as DesignLabFilter,focus:focus as DesignLabFocus};
}

import React, { useState } from 'react';
import { ActionExplorer } from './ActionExplorer';
import { RESEARCH_DESIGNS, RESEARCH_SOURCES } from './ResearchData';
const scopes: Record<string, string> = {
  grade3_core: '초3 핵심',
  grade3_deepening: '초3 심화',
  grade4_6_connection: '초4–6 연결'
};
const whyLabels: Record<string, string> = {
  context: '상황 선택',
  numbers: '수치 선택',
  conditions: '조건 설정',
  representation: '표현과 대응',
  contrastWithAlternative: '다른 예와 비교'
};
const sourceClaims: Record<string, string> = {
  F78: '일반적 관념을 떠올리게 하는 한 예를 paradigm으로 설명한다. 예 하나의 학습효과를 보장하는 주장은 아니다.',
  F83: '조직할 현상에서 출발하며, 하나의 paradigm만으로 충분하지 않을 수 있다고 설명한다. 수치 한 쌍만으로 일반성이 드러나는 것은 아니다.',
  F91: '학습자의 발명 활동과 이를 둘러싼 교수 환경을 함께 다룬다. 본 설계의 단계별 도움 질문은 이를 해석한 창작이다.',
  MP84: '특정 사례에서 일반성을 보는 일은 제시 방식과 학습자의 관점에 달려 있다. Freudenthal의 직접 주장이 아닌 후속 연구다.'
};
function Text({
  children
}: {
  children: any;
}) {
  return <p className="research-text">{Array.isArray(children) ? children.join('\n') : children}</p>;
}
function List({
  items,
  ordered = false
}: {
  items: string[];
  ordered?: boolean;
}) {
  const Tag = ordered ? 'ol' : 'ul';
  return <Tag className="research-list">{items?.map((x, i) => <li key={i}>{x}</li>)}</Tag>;
}
export function ResearchProblem({
  typeId
}: {
  typeId: string;
}) {
  const d = RESEARCH_DESIGNS[typeId];
  const [answer, setAnswer] = useState(false);
  if (!d) return <div className="research-unavailable">이 유형의 연구 설계 원고가 아직 연결되지 않았습니다.</div>;
  return <article className="me-problem research-problem" aria-label="전형성 의도 연구 설계안" data-research-type={typeId}>
  <div className="problem-top"><span className="me-chip">전형성 의도 설계안 · 연구용</span><span>{typeId}</span></div>
  <div className="research-status"><span>{scopes[d.scope]}</span><span>연구자 창작·해석</span><span>학습효과 미검증</span></div>
  {typeId === 'HC11-d1-T02' && <aside className="research-correction-notice" role="note"><strong>수학 정합성 수정 검토 중</strong><p>아래 원문 연구 설계의 세 점 A, B, C가 같은 원 위의 서로 다른 점이고 LA=LB=LC=4cm가 정확한 길이라면 L은 그 원의 유일한 중심입니다. 중심이라고 말한 학생을 오개념으로 판정하지 않습니다. 두 점만 비교하는 별도 경계 사례와 구분하세요. 원문과 29필드 교정 제안은 별도로 보존했고 아직 교정안을 적용하지 않았습니다.</p><p>이 충분성의 증명은 교사용 검토이며 초3에게 필수로 요구하지 않습니다.</p></aside>}
  <p className="research-reading-note">연구자 검토용 화면입니다. 학생에게는 아래 행동 분석에서 준비도에 맞는 짧은 구간만 제시합니다.</p>
  <section className="research-target"><h2>이 예에서 읽어 낼 구조</h2><Text>{d.targetStructure}</Text><p className="research-domain"><strong>일반화의 범위</strong> {d.generalizationDomain}</p></section>
  <h2>연구 설계 문항</h2><p className="problem-text">{d.revisedExample.prompt}</p>
  <button className="me-primary" aria-expanded={answer} onClick={() => setAnswer(!answer)}>{answer ? '연구 문항 정답·풀이 접기' : '연구 문항 정답·풀이 보기'} <span>{answer ? '−' : '+'}</span></button>
  {answer && <div className="answer-content"><section><h3>정답</h3><p className="answer-value">{d.revisedExample.answer}</p></section><section><h3>구조가 드러나는 풀이</h3><List items={d.revisedExample.solution} ordered /></section><section><h3>수치가 달라도 보존되는 것</h3><Text>{d.invariant}</Text></section></div>}
  <div className="research-panels">
   <details className="research-panel action-panel"><summary><span>행동</span> 풀이를 행동 단위로 보기 <small>한 번에 한 행동씩</small></summary><div className="research-panel-body"><ActionExplorer design={d.actionDesign} scope={d.scope} /></div></details>
   <details className="research-panel"><summary><span>01</span> 왜 이렇게 설계했나 <small>상황·수치·조건·표현</small></summary><div className="research-panel-body"><div className="research-callout"><h3>학습자가 조직할 현상</h3><Text>{d.phenomenonToOrganize}</Text></div>{Object.entries(whyLabels).map(([key, label]) => <section key={key}><h3>{label}</h3><Text>{d.designRationale[key]}</Text></section>)}<section><h3>인접한 유형과의 결정적 차이</h3><Text>{d.adjacentTypeContrast}</Text></section></div></details>
   <details className="research-panel"><summary><span>02</span> 전이·경계 사례 <small>구조의 유지와 조건의 변화</small></summary><div className="research-panel-body"><section><h3>전이: 다른 사례에서도 같은 이유가 통할까?</h3><Text>{d.transfer.prompt}</Text><details className="research-answer"><summary>전이 정답과 보존 구조</summary><Text>{d.transfer.answer}</Text><p className="research-kicker">보존되는 구조</p><Text>{d.transfer.preservedStructure}</Text></details></section><section><h3>경계: 어떤 조건이 달라지면 적용할 수 없을까?</h3><Text>{d.boundaryCase.prompt}</Text><details className="research-answer"><summary>경계 사례 정답과 달라진 조건</summary><Text>{d.boundaryCase.answer}</Text><p className="research-kicker">바뀐 조건</p><Text>{d.boundaryCase.changedCondition}</Text></details></section><div className="research-callout"><h3>불변 구조</h3><Text>{d.invariant}</Text></div></div></details>
   <details className="research-panel"><summary><span>03</span> 지도·관찰 계획 <small>전략·오류·도움 질문</small></summary><div className="research-panel-body"><p className="research-caution">아래 전략과 오류는 예상입니다. 실제 학생 반응이나 관찰 결과가 아닙니다.</p><section><h3>예상 전략</h3><List items={d.expectedStrategies} /></section><section><h3>예상 오류</h3><List items={d.anticipatedErrors} /></section><section><h3>안내 질문의 순서</h3><List items={d.guidanceSequence} ordered /></section><section><h3>선수 지식과 학년 범위</h3><p>{scopes[d.scope]}</p><List items={d.prerequisites} />{d.grade4_6Connection && <Text>{d.grade4_6Connection}</Text>}</section><section><h3>이 설계를 검증하려면</h3><List items={d.observationPlan} /><p className="research-caution">학습효과는 아직 관찰하지 않았습니다. 정답 여부와 구조 설명·전이 수행을 구분해 기록해야 합니다.</p></section></div></details>
   <details className="research-panel"><summary><span>04</span> 연구 근거 <small>원문 사실과 우리 설계의 구분</small></summary><div className="research-panel-body"><div className="research-evidence"><section><h3>원문에서 확인한 사실</h3><p>아래 서지와 쪽수는 이 설계가 참조한 이론의 위치입니다. 이 창작 문항 자체가 원저에 실려 있다는 뜻은 아닙니다.</p></section><section><h3>이 지도의 해석과 창작</h3><p>‘전형성 의도 설계안’이라는 작업 정의, 문항, 수치 선정, 전이·경계 사례, 지도·관찰 계획은 원문을 참고해 이 지도를 위해 새로 작성했습니다. Freudenthal의 공식 루브릭이나 인증이 아닙니다.</p></section><section><h3>아직 확인하지 않은 것</h3><p>특정 학생이 일반 구조를 파악했는지, 전이했는지, 학습효과가 있었는지는 검증하지 않았습니다. 학생의 실제 기록이나 점수도 사용하지 않았습니다.</p></section></div>{d.sourceIds.map((id: string) => {
            const s = RESEARCH_SOURCES.find((x: any) => x.id === id);
            return s && <section className="research-source" key={id}><h3>{s.id} · {s.author} ({s.year})</h3><a href={s.url} target="_blank" rel="noopener noreferrer">{s.title} ↗</a><p className="research-pages">인쇄면 {s.pages}쪽</p><Text>{sourceClaims[id]}</Text><p className="research-access">{id === 'F83' ? '확인 범위: 연구 사이트에 공개된 원저 전자판 사본의 해당 쪽. 출판사 전체본 직접 열람과는 구분합니다.' : id === 'MP84' ? '확인 범위: 저자 업로드 원논문 본문의 관련 문단.' : id === 'F91' ? '확인 범위: 출판사 미리보기 45–46쪽. 48쪽의 재인용 문구는 직접 인용하지 않습니다.' : '확인 범위: 출판사 미리보기 170–171쪽.'}</p>{s.fulltext && <a className="research-original-link" href={s.fulltext} target="_blank" rel="noopener noreferrer">확인한 원문 자료 ↗</a>}</section>;
          })}<p className="research-caution">‘전형적’은 쉽거나 자주 나오는 문제라는 뜻으로 사용하지 않습니다. 한 사례에서 특정 수치를 넘어서는 구조를 읽어 내게 하려는 설계 의도입니다. 한국어 번역 계보 전체를 확정한 용어 표기는 아닙니다.</p></div></details>
  </div>
 </article>;
}
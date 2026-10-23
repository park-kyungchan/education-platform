import React, { useEffect, useRef, useState } from 'react';
import { DATA } from './MathData';
import { ResearchProblem } from './ResearchProblem';
import './MathExplorer.css';
type Item = {
  id: string;
  title: string;
  parentId?: string;
  level?: string;
  [key: string]: any;
};
const roots = [{
  id: 'U-M',
  name: '곱셈',
  mark: '×',
  desc: '자릿값에서 분수와 소수의 곱셈까지',
  color: 'mint'
}, {
  id: 'U-D',
  name: '나눗셈',
  mark: '÷',
  desc: '똑같이 나누기에서 분수의 나눗셈까지',
  color: 'blue'
}, {
  id: 'U-C',
  name: '원',
  mark: '○',
  desc: '중심과 반지름에서 원의 넓이까지',
  color: 'sand'
}];
for (const d of DATA.details) {
  if (!DATA.nodes.some((n: Item) => n.id === d.id)) DATA.nodes.push({
    ...d,
    id: d.id,
    title: d.title,
    parentId: d.parentContentId,
    level: '세부단원'
  });
}
const nodeMap: Record<string, Item> = Object.fromEntries([...DATA.core, ...DATA.upper, ...DATA.nodes].map((x: Item) => [x.id, x]));
const detailMap: Record<string, any> = Object.fromEntries(DATA.details.map((x: any) => [x.id, x]));
const typeMap: Record<string, any> = Object.fromEntries(DATA.details.flatMap((d: any) => d.types.map((t: any) => [t.id, {
  ...t,
  detailId: d.id
}])));
const textValue = (v: any) => Array.isArray(v) ? v.join('\n') : v;
function pathTo(id: string): string[] {
  const out: string[] = [];
  let n = nodeMap[id];
  let guard = 0;
  while (n && guard++ < 10) {
    out.unshift(n.id);
    n = nodeMap[n.parentId || ''];
  }
  return out.filter(i => i !== 'G3S2');
}
function Icon({
  kind
}: {
  kind: string;
}) {
  return <svg viewBox="0 0 240 140" aria-hidden="true"><defs><pattern id={'dots-' + kind} width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="currentColor" opacity=".16" /></pattern></defs><rect width="240" height="140" fill={'url(#dots-' + kind + ')'} />{kind === 'U-M' ? <g>{Array.from({
        length: 12
      }, (_, i) => <rect key={i} x={51 + i % 4 * 35} y={20 + Math.floor(i / 4) * 35} width="25" height="25" rx="7" fill="currentColor" opacity={i < 8 ? .7 : .25} />)}<path d="M36 23V112M37 112H190" stroke="currentColor" strokeWidth="2" fill="none" /></g> : kind === 'U-D' ? <g>{[0, 1, 2].map(j => <g key={j}><rect x={28 + j * 65} y="22" width="52" height="96" rx="18" stroke="currentColor" fill="none" strokeWidth="2" />{[0, 1, 2, 3].map(i => <circle key={i} cx={44 + j * 65 + i % 2 * 18} cy={53 + Math.floor(i / 2) * 32} r="6" fill="currentColor" />)}</g>)}</g> : <g><circle cx="119" cy="70" r="51" stroke="currentColor" fill="none" strokeWidth="2" /><circle cx="119" cy="70" r="4" fill="currentColor" /><path d="M68 70H170M119 70L150 30" stroke="currentColor" strokeWidth="2" /><circle cx="150" cy="30" r="4" fill="currentColor" /><path d="M68 130H170" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" /></g>}</svg>;
}
export const GeneratedComponent = () => {
  const [path, setPath] = useState<string[]>([]),
    [selectedType, setSelectedType] = useState<string | null>(null),
    [showAnswer, setShowAnswer] = useState(false),
    [showSources, setShowSources] = useState(false),
    [returnPath, setReturnPath] = useState<string[] | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const initial = useRef(true);
  const current = path.length ? nodeMap[path[path.length - 1]] : null;
  const detail = current ? detailMap[current.id] : null;
  const children: Item[] = current ? DATA.nodes.filter((n: Item) => n.parentId === current.id) : [];
  const upperDetails = current ? DATA.details.filter((d: any) => d.parentContentId === current.id) : [];
  const types = detail?.types || [];
  const type = selectedType ? typeMap[selectedType] : null;
  const relevantIds = current ? new Set([current.id, ...(current.originalContentIds || [])]) : new Set();
  const links = DATA.edges.filter((e: any) => relevantIds.has(e.source) || relevantIds.has(e.target));
  const go = (id: string) => {
    setPath(pathTo(id));
    setSelectedType(null);
    setShowAnswer(false);
    setShowSources(false);
  };
  const home = () => {
    setPath([]);
    setSelectedType(null);
    setReturnPath(null);
    setShowAnswer(false);
  };
  const back = () => {
    if (selectedType) {
      setSelectedType(null);
      setShowAnswer(false);
    } else if (returnPath && path.length === 1) {
      setPath(returnPath);
      setReturnPath(null);
    } else {
      setPath(path.slice(0, -1));
      setShowSources(false);
    }
  };
  const navigateRelated = (id: string) => {
    if (nodeMap[id]?.kind === 'connected-content') {
      setReturnPath(path);
      go(id);
    } else {
      const match = DATA.nodes.find((n: Item) => n.level === '소단원' && n.originalContentIds?.includes(id));
      if (match) go(match.id);else go(id);
    }
  };
  useEffect(() => {
    if (initial.current) {
      initial.current = false;
      return;
    }
    titleRef.current?.focus({
      preventScroll: true
    });
  }, [path, selectedType]);
  const contextColumns: {
    label: string;
    selected?: string;
    items: Item[];
    isType?: boolean;
  }[] = [];
  if (current) {
    path.forEach((id, index) => {
      const n = nodeMap[id];
      let siblings: Item[] = index === 0 ? roots.some(r => r.id === id) ? roots.map(r => nodeMap[r.id]) : DATA.upper.filter((x: Item) => x.id.split('-')[0] === n.id.split('-')[0] && x.kind === n.kind) : DATA.nodes.filter((x: Item) => x.parentId === path[index - 1]);
      if (!siblings.some(x => x.id === id)) siblings = [n, ...siblings];
      contextColumns.push({
        label: n.level || '연결 개념',
        selected: id,
        items: siblings
      });
    });
    if (types.length) contextColumns.push({
      label: '세분 유형',
      selected: selectedType || undefined,
      items: types,
      isType: true
    });else if (children.length || upperDetails.length) contextColumns.push({
      label: children[0]?.level || '세부단원',
      items: children.length ? children : upperDetails
    });
  }
  const nextLabel = current?.level === '대단원' ? '중단원' : current?.level === '중단원' ? '소단원' : current?.level === '소단원' ? '세부단원' : '세분 유형';
  return <div className="math-explorer">
  <header className="me-header"><button className="me-brand" onClick={home} aria-label="수학 개념 탐험 처음으로"><span className="brand-icon">m<span>·</span></span><span>수학 개념 탐험<small>MATH CONCEPT EXPLORER</small></span></button><span className="me-badge">2022 개정 기반 <i /> 3–6학년</span></header>
  <main className="me-main">
   {!current ? <>
    <section className="me-intro"><p className="me-eyebrow">한 번에 하나씩, 더 깊게</p><h1 ref={titleRef} tabIndex={-1}>개념을 연결하면,<br /><span>수학이 보입니다.</span></h1><p>배우고 싶은 단원에서 시작하세요.<br />작은 개념을 따라가며 예제의 설계 이유와 행동 단위 풀이를 검토합니다.</p></section>
    <section className="me-root-grid" aria-label="시작할 대단원 선택">{roots.map((r, i) => <button key={r.id} className={'me-root ' + r.color} onClick={() => go(r.id)}><div className="root-top"><span>0{i + 1}</span><span className="root-mark">{r.mark}</span></div><Icon kind={r.id} /><h2>{r.name}</h2><p>{r.desc}</p><div className="root-foot"><span>단원 탐험하기</span><span aria-hidden="true">↗</span></div></button>)}</section>
    <div className="me-guidance"><span className="guide-symbol">⌁</span><div><strong>깊이 들어가도, 지나온 개념은 함께.</strong><p>대단원부터 세분 유형까지, 선택한 경로와 주변 항목이 함께 펼쳐집니다.</p></div></div>
    <div className="research-home-note"><span>연구자 검토용 · 151개 세분 유형</span><p>문항마다 왜 이렇게 설계했는지, 어떤 행동을 기대하는지, 무엇을 관찰해야 하는지 살펴봅니다. 모든 설계는 창작 시안이며 학습효과는 아직 검증하지 않았습니다.</p></div>
   </> : <>
    <nav className="me-breadcrumb" aria-label="현재 탐색 위치"><button onClick={home}>처음</button>{path.map((id, i) => <React.Fragment key={id}><span aria-hidden="true">/</span><button aria-current={!selectedType && i === path.length - 1 ? 'page' : undefined} onClick={() => {
              setPath(path.slice(0, i + 1));
              setSelectedType(null);
              setShowAnswer(false);
            }}>{nodeMap[id]?.title || detailMap[id]?.title}</button></React.Fragment>)}{type && <><span>/</span><span aria-current="page">세분 유형</span></>}</nav>
    <section className="me-context" aria-label="이전 단계와 형제 항목을 함께 보는 연결 지도">
     <div className="context-heading"><div><span className="context-symbol" aria-hidden="true">⌁</span><h2>지나온 개념, 이어지는 배움</h2></div><span><i /> 선택한 경로</span></div>
     <p className="context-help">이전 단계와 같은 단계의 다른 항목도 남아 있어요. 작은 카드를 누르면 그 지점에서 다시 탐험합니다.</p>
     {returnPath && <div className="context-origin"><span>이전 탐색에서 연결</span><div>{returnPath.map((id, index) => <React.Fragment key={id}>{index > 0 && <span aria-hidden="true">→</span>}<button onClick={() => {
                  go(id);
                  setReturnPath(null);
                }}>{nodeMap[id]?.title}</button></React.Fragment>)}<span aria-hidden="true">↗</span></div></div>}
     <div className="context-columns" style={{
            '--column-count': contextColumns.length
          } as React.CSSProperties}>
      {contextColumns.map((column, index) => <section className={'context-column ' + (column.selected ? 'has-selection' : 'next-column')} key={index} aria-label={column.label + ' 단계'}>
       <div className="context-level"><span className="context-dot">{String(index + 1).padStart(2, '0')}</span><h3>{column.label}</h3></div>
       <div className="context-cards">{column.items.map(n => <button key={n.id} data-context-id={n.id} className={'context-card ' + (column.selected === n.id ? 'is-selected' : '')} aria-pressed={column.selected === n.id} onClick={() => {
                  if (column.isType) {
                    setSelectedType(n.id);
                    setShowAnswer(false);
                  } else go(n.id);
                }}><span>{n.title}</span>{column.selected === n.id && <small>{index === contextColumns.length - 1 ? '현재 선택' : '선택 경로'} <span aria-hidden="true">↘</span></small>}</button>)}</div>
      </section>)}
     </div>
     <div className="context-focus-marker"><span aria-hidden="true">↓</span> 선택한 개념을 아래에서 자세히 봅니다</div>
    </section>
    <button className="me-back" onClick={back}>← {type ? '유형 목록으로' : returnPath && path.length === 1 ? '이전 개념으로' : '한 단계 뒤로'}</button>
    <div className="me-page-heading"><div><p className="me-eyebrow">{type ? '세분 유형 · 전형성 의도 연구 설계' : current.level || '연결 개념'}{current.observedPlacement ? ' · ' + current.observedPlacement + ' 편성 예시' : ''}</p><h1 ref={titleRef} tabIndex={-1}>{type?.title || current.title}</h1><p>{type ? '문항의 구조를 살펴보고, 설계 이유와 전이·경계 사례까지 검토하세요.' : detail ? '작은 차이를 구분하며 개념을 단단하게 만듭니다.' : '살펴볼 ' + nextLabel + '을 선택하세요.'}</p></div><span className="me-stage">{type ? '05' : String(Math.max(1, path.length)).padStart(2, '0')}<small>EXPLORE</small></span></div>
    {path[0]?.startsWith('G') && <p className="me-scope-note">3–6학년 연결 범위 · 초3 본체 평가 범위와 구분하여 탐색합니다. {nodeMap[path[0]]?.connectionRole === 'boundary-support' ? '선수·지원 개념으로만 표시하며 평가 문항은 확장하지 않습니다.' : ''}</p>}
    <div className={'me-content-layout ' + (links.length ? 'has-links' : '')}><section aria-label={type ? '예시 문항' : '다음 학습 단계'}>
    {type ? <><ResearchProblem key={type.id} typeId={type.id} /><details className="research-original"><summary>기존 기본문항 · 정답·풀이·변형 보존</summary><article className="me-problem"><div className="problem-top"><span className="me-chip">대표 예시 · 직접 창작</span><span>{type.id}</span></div><h2>문제</h2><p className="problem-text">{textValue(type.example?.prompt)}</p><button className="me-primary" aria-expanded={showAnswer} onClick={() => setShowAnswer(!showAnswer)}>{showAnswer ? '정답과 풀이 접기' : '정답과 풀이 보기'} <span>{showAnswer ? '−' : '+'}</span></button>{showAnswer && <div className="answer-content"><section><h3>정답</h3><p className="answer-value">{textValue(type.example?.answer)}</p></section><section><h3>짧은 풀이</h3><p>{textValue(type.example?.solution)}</p></section><section className="misconception"><h3>이렇게 생각하기 쉬워요</h3><p>{textValue(type.example?.misconception)}</p></section></div>}{type.variants?.length > 0 && <section className="me-variants"><h3>같은 유형의 변형 문항</h3>{type.variants.map((v: any) => <details key={v.id}><summary>{v.title}</summary><p>{textValue(v.prompt)}</p><details><summary>변형 문항 정답·풀이</summary><p><strong>{textValue(v.answer)}</strong></p><p>{textValue(v.solution)}</p><p>주의: {textValue(v.misconception)}</p></details></details>)}</section>}<div className="problem-source"><strong>출처와 작성 구분</strong><p>문항·정답·풀이·오개념 설명은 이 지도를 위해 직접 작성했습니다. 공식 자료의 문항을 인용한 것이 아닙니다.</p><p>교육과정 범위 근거: {(type.sourceIds || detail?.sourceIds || []).join(', ') || '아래 출처 참고'}</p><button className="text-button" onClick={() => setShowSources(true)}>근거 자료 보기 ↗</button></div></article></details></> : children.length ? <div className="me-list">{children.map((n, i) => <button className="me-row" key={n.id} onClick={() => go(n.id)}><span className="row-number">{String(i + 1).padStart(2, '0')}</span><span><small>{n.level}</small><strong>{n.title}</strong></span><span className="row-arrow">→</span></button>)}</div> : types.length ? <div className="me-list">{types.map((t: any, i: number) => <button className="me-row" key={t.id} onClick={() => {
                setSelectedType(t.id);
                setShowAnswer(false);
              }}><span className="row-number">{String(i + 1).padStart(2, '0')}</span><span><small>세분 유형 · 연구 설계 + 기존 기본문항</small><strong>{t.title}</strong></span><span className="row-arrow">→</span></button>)}</div> : upperDetails.length ? <div className="me-list">{upperDetails.map((d: any, i: number) => <button className="me-row" key={d.id} onClick={() => go(d.id)}><span className="row-number">{String(i + 1).padStart(2, '0')}</span><span><small>세부단원 · {d.types.length}개 유형</small><strong>{d.title}</strong></span><span>→</span></button>)}</div> : <div className="me-empty"><h2>연결을 위한 기초 개념</h2><p>이 개념은 선수 학습을 설명하기 위한 요약입니다. 이 지도에서는 해당 개념의 전체 단원과 문항까지 확장하지 않습니다.</p></div>}
    </section>{links.length > 0 && <aside className="me-relations" aria-label="선택한 개념의 학습 연결"><div className="relation-heading"><span>⌁</span><h2>이 개념의 연결</h2></div><p>선택한 개념과 바로 이어지는 배움만 보여줍니다.</p>{['before', 'after'].map(direction => {
              const rel = links.filter((e: any) => direction === 'before' ? relevantIds.has(e.target) : relevantIds.has(e.source));
              return rel.length > 0 && <section key={direction}><h3>{direction === 'before' ? '먼저 익히면 좋아요' : '다음 배움으로'}</h3>{rel.map((e: any) => {
                  const id = direction === 'before' ? e.source : e.target;
                  return <button key={e.id} className="relation-card" onClick={() => navigateRelated(id)}><strong>{nodeMap[id]?.title || id} <span>↗</span></strong><small>{e.reason}</small></button>;
                })}</section>;
            })}<div className="inference-note">연결 방향은 교수·학습 설계에 따른 제안입니다. 교육과정이 정한 유일한 학습 순서는 아닙니다.</div></aside>}</div>
   </>}
   <footer className="me-footer"><span>개념을 작게 나누고, 배움을 이어 갑니다.</span><button onClick={() => setShowSources(!showSources)} aria-expanded={showSources}>범위·출처 안내 {showSources ? '−' : '+'}</button></footer>
   {showSources && <section className="me-sources" aria-label="범위와 출처"><h2>범위와 근거</h2><p>초3 곱셈·나눗셈·원에서 출발해 직접 관련된 3–6학년 개념을 연결합니다. 세부 분류와 문제 유형은 수업 탐색을 위한 제안이며, 학기 표기는 출처의 편성 예시입니다. 전국 공통의 강제 배치를 뜻하지 않습니다.</p><p>모든 예시 문항은 직접 창작했습니다. 학생의 실제 학습 기록이나 점수는 사용하지 않았습니다.</p>{DATA.sources.map((s: any) => <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer"><span>{s.id}</span><strong>{s.role || s.title || s.name}</strong><small>{s.pages ? '참고 쪽: ' + s.pages : ''} ↗</small></a>)}<button className="text-button" onClick={() => setShowSources(false)}>안내 닫기</button></section>}
  </main>
 </div>;
};
import React, { useState } from 'react';
import { PSYCHOLOGY_SOURCES } from './ResearchData';
const phaseNames: Record<string, string> = {
  prerequisite: '준비',
  orient: '문제 읽기',
  represent: '표현하기',
  execute: '실행하기',
  connect: '연결하기',
  explain: '설명하기',
  check: '확인하기',
  transfer: '전이하기'
};
const evidenceNames: Record<string, string> = {
  official_recommendation: '공식 실천 지침',
  primary_study_finding: '1차 연구 결과',
  project_application_inference: '이 문항에 대한 설계 추론'
};
function Field({
  label,
  value
}: {
  label: string;
  value: any;
}) {
  return <section className="action-field"><h4>{label}</h4><p>{Array.isArray(value) ? value.join('\n') : value}</p></section>;
}
export function ActionExplorer({
  design,
  scope
}: {
  design: any;
  scope: string;
}) {
  const [index, setIndex] = useState(0);
  const a = design?.microActions?.[index];
  if (!a) return <p className="research-caution">행동 단위 설계가 아직 연결되지 않았습니다.</p>;
  return <div className="action-explorer">
  <p className="research-caution">예상 이해는 설계 가설입니다. 아이의 말과 행동을 확인하기 전에는 실제 이해나 학습효과로 판단하지 않습니다.{scope === 'grade4_6_connection' ? ' 이 유형은 상위 학년 연결입니다. 초3 학생에게 상위 공식이나 절차를 직접 요구하지 않습니다.' : ''}</p>
  <details className="research-answer"><summary>시작 전 확인할 선수 지식</summary>{design.prerequisites?.map((p: any, i: number) => <div className="action-prerequisite" key={i}><Field label="확인할 기능" value={p.skill} /><Field label="짧은 확인 과제" value={p.quickCheck} /><Field label="아직 준비되지 않았다면" value={p.ifNotReady} /></div>)}</details>
  <p className="action-presentation">{design.segmentation?.presentationRule}</p>
  <div className="action-layout">
   <nav className="action-steps" aria-label="풀이 행동 단계 선택">{design.microActions.map((step: any, i: number) => <button key={step.id} aria-pressed={index === i} onClick={() => setIndex(i)} className={index === i ? 'selected' : ''}><span>{String(i + 1).padStart(2, '0')} · {phaseNames[step.phase] || step.phase}</span><strong>{step.childFacingSegment || step.cue}</strong></button>)}</nav>
   <div className="action-detail" key={a.id} aria-live="polite">
    <div className="action-count">행동 {index + 1} / {design.microActions.length} · {phaseNames[a.phase] || a.phase}</div>
    <h3>{a.childFacingSegment || a.cue}</h3>
    <div className="action-cue"><span>아이에게 줄 짧은 질문·지시</span><p>{a.cue}</p></div>
    <Field label="눈으로 확인할 학생의 행동" value={a.observableStudentAction} />
    <Field label="기대하는 이해 · 아직 관찰하지 않은 가설" value={a.expectedUnderstanding} />
    <details className="research-answer"><summary>이 행동의 수학적 목적과 설계 의도</summary><Field label="수학적 목적" value={a.mathematicalPurpose} /><Field label="왜 이 순서와 도움인가" value={a.designIntent} /><Field label="왜 별도 행동으로 나누었나" value={a.separationReason} /></details>
    <details className="research-answer"><summary>무엇을 보고 이해 여부를 판단할까?</summary><Field label="이해의 근거로 수집할 행동" value={a.teacherCheck?.evidence} /><Field label="이것만으로는 부족한 근거" value={a.teacherCheck?.nonEvidence} /><Field label="관찰 뒤 다음 결정" value={a.teacherCheck?.nextDecision} /></details>
    <details className="research-answer"><summary>막힐 때의 도움, 그리고 도움 줄이기</summary><Field label="예상 오류 · 관찰 결과 아님" value={a.likelyError} /><Field label="그 오류에 대응하는 도움" value={a.scaffold} /><Field label="준비되면 제거할 도움" value={a.fading?.remove} /><Field label="도움을 줄여도 되는 관찰 근거" value={a.fading?.readinessEvidence} /><Field label="이때는 도움을 다시 제공" value={a.fading?.restoreIf} /></details>
    <details className="research-answer"><summary>이 행동 설계의 학습심리학 근거</summary>{a.evidence?.map((e: any, i: number) => {
            const s = PSYCHOLOGY_SOURCES.find((p: any) => p.id === e.sourceId);
            return <section className="action-evidence" key={i}><p className="action-evidence-kind">{evidenceNames[e.relation] || e.relation} · {e.sourceId}</p><Field label="이 행동에 적용한 추론" value={e.applicationInference} />{s ? <><a href={s.url} target="_blank" rel="noopener noreferrer">{s.citation} ↗</a><Field label="원연구 대상과 맥락" value={s.populationKo || s.population} /><Field label="원자료의 주장" value={s.sourceFindingKo || s.sourceFinding} /><Field label="확인 범위" value={s.verifiedSectionsKo || s.verifiedSections} /><Field label="적용의 한계" value={s.limitsKo || s.limits} /></> : <p>근거 서지 연결을 확인해야 합니다.</p>}</section>;
          })}</details>
    <div className="action-controls"><button disabled={index === 0} onClick={() => setIndex(index - 1)}>← 이전 행동</button><button disabled={index === design.microActions.length - 1} onClick={() => setIndex(index + 1)}>다음 행동 →</button></div>
   </div>
  </div>
  <details className="research-answer"><summary>여러 행동을 묶어 제시할 때의 기준</summary>{design.segmentation?.chunks?.map((c: any, i: number) => <div key={i}><Field label={c.label} value={'행동 ' + c.actionIds.map((id: string) => design.microActions.findIndex((a: any) => a.id === id) + 1).join(', ')} /><Field label="이 묶음을 마쳤다고 볼 근거" value={c.exitEvidence} /></div>)}</details>
  <details className="research-answer"><summary>도움 없는 전이·경계 확인과 해석 한계</summary><Field label="독립 전이 과제" value={design.independentTransfer?.prompt} /><Field label="전이 정답" value={design.independentTransfer?.answer} /><Field label="수집할 근거" value={design.independentTransfer?.evidenceToCollect} /><Field label="바뀐 특징" value={design.independentTransfer?.changedFeature} /><Field label="경계 확인 과제" value={design.boundaryProbe?.prompt} /><Field label="경계 정답" value={design.boundaryProbe?.answer} /><Field label="무엇을 구별하는가" value={design.boundaryProbe?.distinguishes} /><Field label="해석의 한계" value={design.interpretationLimits} /></details>
 </div>;
}
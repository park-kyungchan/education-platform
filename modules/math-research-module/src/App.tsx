import { GeneratedComponent } from './components/generated/GeneratedComponent';

export default function App() {
  return <>
    <aside className="module-status" aria-label="연구 모듈 상태">
      <strong>수학교육 연구 파일럿</strong>
      <span>151유형 · 원문 170예제 보존 · 학습효과 미검증</span>
      <details><summary>검토 범위와 주의 사항</summary>
        <p>문헌 근거, 연구자 설계, 기술 검증, 사용자 수락은 서로 다른 상태입니다. 전체 예제의 수학·교수학 전면 감사는 진행 전입니다.</p>
        <p>HC11-d1-T02의 원 중심 설명에는 수정 검토가 필요합니다. 원 위 서로 다른 세 점에서 같은 거리에 있는 점은 원의 중심 하나로 결정됩니다. 원문은 그대로 보존했습니다.</p>
        <p>실제 학생 기록이나 개인 DB는 없으며, 진단·반 배정·점수 산정에 사용할 수 있는 검증된 모형이 아닙니다.</p>
      </details>
    </aside>
    <GeneratedComponent />
  </>;
}

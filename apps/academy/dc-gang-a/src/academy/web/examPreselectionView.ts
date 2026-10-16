import {inspectExamPreselection, type ExamCandidate, type ExamSelectionWorkspace, type ExamPreselectionUnitScope} from '../examSelection';
import {workspaceNode as node} from './workspaceEditor';

const labels:Record<string,string> = {
  source_currentness_unverified:'원천 자료의 현재 상태 미검증',
  source_inventory_completeness_unverified:'원천 문항 목록의 완전성 미검증',
  item_to_unit_coverage_unverified:'문항과 정확한 단원 연결 미검증',
  teacher_judgment_unobserved:'실제 교사 판정 미관측',
  exam_date_unknown:'정확한 시험일 미확정', exam_timezone_unknown:'시간대 미확정',
  unit_distribution_unknown:'정확한 단원 범위가 없어 문항수 분배 제안 보류',
  edition_unknown:'판본 미확인', content_unknown:'원문 미확인', answer_unknown:'답 미확인',
  difficulty_unknown:'난이도 근거 미확인', responseMode_unknown:'원본 응답 형식 미확인',
  constructed_response_unverified:'서술형 원문 근거 미확인',
};

/** No read/write callbacks or controls: rendering cannot acquire or persist exam data. */
export function examPreselectionView(workspace:ExamSelectionWorkspace,candidates:readonly ExamCandidate[],unitScope?:ExamPreselectionUnitScope):HTMLElement {
  const section=node('section');section.dataset.role='exam-preselection';
  section.append(node('h4','월말평가 · 문항 선택 전 분석'));
  try {
    const analysis=inspectExamPreselection(workspace,candidates,unitScope),requirement=analysis.requirement;
    section.dataset.state='analysis';
    section.append(node('p',`초등 ${requirement.grade}학년 · ${requirement.month}월 · 서술형 ${requirement.questions}문항 · ${requirement.totalPoints}점`),
      node('p',analysis.scoring.bands.map(band=>`${band.points}점 ${band.questions}문항`).join(' / ')+` · 합계 ${analysis.scoring.calculatedPoints}점. 배점은 난이도를 증명하지 않습니다.`),
      node('p',`${analysis.timing.localStartTime} 시작 · ${analysis.timing.durationMinutes}분 · ${analysis.timing.localExamEndTime} 시험 종료. 시험 종료부터 ${analysis.timing.localSessionEndTime}까지 남은 ${analysis.timing.gradingAndPeerHavrutaMinutes}분에 채점과 학생 간 하브루타를 진행합니다. 실제 시간 배분은 미확정입니다.`),
      node('p','시험일: '+(analysis.timing.examDate.state==='known'?analysis.timing.examDate.value:analysis.timing.examDate.reason)+' · 시간대: '+(analysis.timing.timeZone.state==='known'?analysis.timing.timeZone.value:analysis.timing.timeZone.reason)),
      node('p',`현재 입력 근거: ${analysis.coverage.distinctSourceItems}개 원문 식별자 / ${analysis.coverage.observedCandidateRevisions}개 개정. 전체 원천 문항수나 단원 coverage를 뜻하지 않습니다.`));
    const distribution=node('details');distribution.append(node('summary','단원별 문항수 제안 · 검토 전'));
    if(analysis.proposals.unitDistribution.state==='unknown')distribution.append(node('p','정확한 판본·단원 범위가 확인되지 않아 분배를 제안하지 않았습니다.'));
    else {
      const list=node('ul');
      for(const allocation of analysis.proposals.unitDistribution.value.allocations)list.append(node('li',`${allocation.label}: ${allocation.questions}문항 · ${allocation.sourceKey.namespace}/${allocation.sourceKey.literalKey}`));
      distribution.append(node('p','입력된 단원 순서에 따른 균등 문항수 제안입니다. 원천의 완전성·난이도·수업 범위를 검증한 결과가 아니며 교사 검토가 필요합니다.'),list);
    }
    const holds=node('ul');holds.dataset.role='exam-preselection-unknowns';
    for(const code of analysis.unknowns)holds.append(node('li',labels[code]??code));
    const sources=node('details');sources.append(node('summary','요구조건 원문과 입력 근거'));
    const references=node('ul');
    analysis.originalSource.sourceKeys.forEach((key,index)=>references.append(node('li',`${analysis.originalSource.projectId} · ${key} · 원문 SHA256 ${analysis.originalSource.originalTextSha256[index]}`)));
    for(const row of analysis.coverage.rows)references.append(node('li',`${row.sourceItem.namespace}/${row.sourceItem.literalKey} · ${row.sourceRef} · 관측 ${row.observedAt} · ${row.candidateRevisionId}`));
    sources.append(references);
    section.append(distribution,node('h5','미확인 항목'),holds,sources,node('p','선택한 문항 0개. 문항 생성·선택·저장·인쇄를 하지 않는 분석입니다. 다음 문항 선택과 최종 구성은 사용자가 결정합니다.'));
  } catch(error) {
    section.dataset.state='held';
    const status=node('p','선택 전 분석 보류 · '+(error as Error).message);status.setAttribute('role','status');section.append(status);
  }
  return section;
}

import type {TeacherSelector} from './teacher-source-binding.ts';

type Row = Record<string,unknown>;
const row = (value:unknown):Row => value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Row:{};
const list = (value:unknown):unknown[] => Array.isArray(value)?value:[];
// Source text stays on one numbered report line; it never becomes report structure or instructions.
const text = (value:unknown, fallback='미확인'):string => typeof value==='string'&&value.trim()?value.replace(/[\r\n\u0000-\u001f\u007f]/g,' '):fallback;
const literal = (value:unknown) => text(row(value).literalKey);
const valueText = (value:unknown):string => typeof value==='string'?text(value):typeof value==='number'||typeof value==='boolean'?String(value):value===null?'미확인':JSON.stringify(value);
const knowledge = (value:unknown):string => {const k=row(value);return k.state==='known'?valueText(k.value):`미확인 (${text(k.reason)})`;};
const ref = (value:unknown) => text(row(value).revisionId);
const states:Record<string,string> = {
  completed:'교사 최종완료',prior_revision_completed:'이전 응시판본 교사 완료 보존; 현재 응시판본 완료는 미확인',
  source_unknown:'미확인',teacher_confirmed_resolved:'교사 확인 완료',teacher_evidence_not_reported:'교사 판정 미확인',
  teacher_reinspection_required:'교사 재확인 필요',active:'배정 확인',withdrawn:'배정 취소',replaced:'대체됨',
};
const state = (value:unknown) => states[text(value)]??text(value);
const activity = (value:unknown) => ({daily_test:'DT',prestudy_review:'예습 확인',wrong_clinic:'원오답 클리닉',similar_clinic:'유사문제 클리닉'}[text(value)]??text(value));
const clocks = (value:unknown):string => {const v=row(value);return `원천 관측 ${text(v.sourceObservedAt)} / 검증 ${text(v.lastVerifiedAt)} / 교사 보고 ${text(row(v.payload).reportedAt)} / 기록 ${text(v.recordedAt)}`;};
const evidence = (value:unknown):string => {const v=row(value);return `[근거 ${text(v.revisionId)}; ${clocks(v)}]`;};

/** Display only edges actually present in the pinned catalog; siblings are separate paths. */
function catalogPaths(catalog:Row[]):string[]{
  const byId=new Map(catalog.map(node=>[node.id,node]));
  const parents=new Set(catalog.flatMap(node=>row(node.parent).state==='known'?[row(node.parent).value]:[]));
  const covered=new Set<unknown>(),lines:string[]=[],groups=new Map<unknown,Row[]>();
  const targets=catalog.filter(node=>node.kind!=='book_edition'&&!parents.has(node.id));
  const emit=(node:Row)=>{
    const path:Row[]=[],seen=new Set<unknown>();let current:Row|undefined=node,gap='';
    while(current){
      if(seen.has(current.id)){gap='상위 순환 연결 미확인';break;}
      seen.add(current.id);covered.add(current.id);path.unshift(current);
      if(current.kind==='book_edition')break;
      const parent=row(current.parent);
      if(parent.state!=='known'){gap=`상위 연결 미확인 (${text(parent.reason)})`;break;}
      current=byId.get(parent.value);
      if(!current)gap=`상위 노드 ${text(parent.value)} 미확인`;
    }
    return `${path.map(part=>`${text(part.label)} [${text(part.id)}]`).join(' > ')}${gap?` (${gap})`:''}`;
  };
  for(const node of targets){const parent=row(node.parent),key=parent.state==='known'?parent.value:node.id;groups.set(key,[...(groups.get(key)??[]),node]);}
  for(const [parentId,nodes] of groups){
    if(nodes.length>1)lines.push(`      - 형제 항목 / 같은 상위 ${text(byId.get(parentId)?.label)} [${text(parentId)}]`);
    for(const node of nodes)lines.push(`      - 계층 경로: ${emit(node)}`);
  }
  // Preserve disconnected/cyclic/missing-parent records instead of silently dropping them.
  for(const node of catalog)if(node.kind!=='book_edition'&&!covered.has(node.id))lines.push(`      - 계층 경로: ${emit(node)}`);
  if(!lines.length)lines.push('      - 단원 계층 미확인');
  return lines;
}

const keyId=(value:unknown):string|null=>{const k=row(value);return typeof k.namespace==='string'&&typeof k.literalKey==='string'?JSON.stringify([k.namespace,k.literalKey]):null;};
function reviewLines(value:unknown,assigned:Row,attempt:Row|undefined,indent:string,label:string):string[]{
  const review=row(value),record=row(review.record),payload=row(record.payload),summary=row(review.summary);
  const binding=row(payload.attemptBinding),issued=row(row(payload.paper).issuance),assignedPaper=row(row(row(assigned.record).payload).paper);
  const issuanceKey=issued.state==='known'?row(issued.value).issuanceKey:null;
  const matchesAssignment=keyId(issuanceKey)!==null&&assignedPaper.state==='known'&&keyId(issuanceKey)===keyId(row(assignedPaper.value).issuanceKey);
  const matchesAttempt=attempt!==undefined&&review.attemptBindingQualified===true&&binding.state==='known'
    &&row(binding.value).attemptEntityId===row(attempt.record).entityId
    &&row(binding.value).attemptRevisionId===row(attempt.record).revisionId
    &&keyId(issuanceKey)===keyId(row(row(attempt.record).payload).paperIssuanceKey);
  const lines=[`${indent}- ${label} 교사 판정 ${valueText(review.summary)}; 응시 연결 ${String(review.attemptBindingQualified===true)} ${evidence(record)}`];
  for(const [stage,title] of [['printed','출력'],['distributed','배부']]){
    const observation=row(row(summary.paperStages)[stage]),observed=row(observation.value);
    const observationMatches=keyId(observed.issuanceKey)!==null&&keyId(observed.issuanceKey)===keyId(issuanceKey);
    const stageLabel=observation.state==='known'?(observed.state==='done'?'교사 보고 완료':observed.state==='not_done'?'교사 보고 미실행':'미확인'):knowledge(observation);
    const exact=matchesAssignment&&matchesAttempt&&observationMatches;
    lines.push(`${indent}  - ${title}: ${stageLabel}; 대상 발행 ${valueText(observation.state==='known'?observed.issuanceKey:issuanceKey)}; 관측 ${text(observed.observedAt)}; 근거 ${list(observation.evidenceRefs).map(v=>text(v)).join(', ')||'미확인'}; ${exact?'현재 응시·발행 연결 확인':'현재 응시·발행 연결 미확인; 해당 발행 관측만 보존'}`);
  }
  return lines;
}

function preparationBooks(preparation:unknown, number:number, start:number):{lines:string[];next:number} {
  const lines:string[]=[];let section=start;
  for(const raw of list(row(preparation).books)){
    const book=row(raw);
    lines.push(`  ${number}.${section++} ${text(book.labelLiteral)} / 원천 교재 ${literal(book.sourceBook)} / 판본·권 연결 미확인`);
    for(const rawUnit of list(book.units)){
      const unit=row(rawUnit);
      lines.push(`    - ${text(unit.labelLiteral)} [원천 단원 ${literal(unit.sourceMinorUnit)}]: 범위 ${text(unit.duty)}; 예습 ${state(row(unit.video).state)}; 숙제 배정 여부 별도`);
      for(const rawActivity of list(unit.teacherActivities)){
        const a=row(rawActivity);
        lines.push(`      - ${activity(a.activity)}: ${state(a.state)} [현재 판정 ${list(a.currentRevisionRefs).map(v=>text(v)).join(', ')||'미확인'}; 이전 완료 근거 ${list(a.priorAcceptanceRevisionRefs).map(v=>text(v)).join(', ')||'미확인'}]`);
      }
    }
    if(!list(book.units).length)lines.push('    - 단원 목록 미확인; 미완료 숙제로 계산하지 않음');
  }
  return {lines,next:section};
}

function exactAssignments(scene:Row,number:number,start:number):{lines:string[];next:number} {
  const lines:string[]=[];let section=start;
  const exact=row(row(row(scene.workContext).data).exactWork);
  for(const raw of list(exact.assignments)){
    const assigned=row(raw),record=row(assigned.record),payload=row(record.payload);
    const catalog=list(assigned.catalog).map(row),edition=catalog.find(node=>node.kind==='book_edition');
    lines.push(`  ${number}.${section++} ${text(edition?.label,'교재 연결 미확인')} / 판본 ${text(edition?.id)} / 등록 ${text(payload.registrationRevisionId)}`);
    lines.push(`    - ${activity(payload.activity)} / ${state(assigned.obligationState)} [배정 ${ref(record)}]`);
    lines.push(...catalogPaths(catalog));
    lines.push(`      - 적용일 ${text(payload.effectiveDate)}; 기한 ${knowledge(payload.dueDate)}; 권 정보 미확인`);
    lines.push(`      - 대체 연결: 이전 ${knowledge(row(assigned.replacement).replaces)} / 이후 ${knowledge(row(assigned.replacement).replacedBy)}`);
    lines.push(`      - 시험지 발행 ${knowledge(payload.paper)}; 발행·점수만으로 실제 출력·배부를 확정하지 않음. 응시·발행별 교사 관측은 별도 표시.`);
    lines.push(`      - ${evidence(record)}`);
    for(const rawArchive of list(assigned.archived)){
      const archive=row(rawArchive);lines.push(`      - 과거 배정판본 ${ref(archive.record)}: ${state(archive.obligationState)}; 현재 배정으로 재계산하지 않음`);
    }
    for(const rawAttempt of list(assigned.attempts)){
      const attempt=row(rawAttempt),attemptRecord=row(attempt.record),ap=row(attemptRecord.payload);
      lines.push(`      - 응시 ${literal(ap.attemptKey)} / 응시판본 ${ref(attemptRecord)} / 발생 ${knowledge(ap.occurredAt)} / 정정 전 판본 ${text(ap.previousAttemptRevisionId)}`);
      lines.push(`        - 원천 응시 단계 ${text(ap.state)}; 출력·배부·교정·교사 검토·앱 입력은 각 단계의 별도 근거 필요`);
      lines.push(`        - 원천 점수 근거 ${knowledge(attempt.scoreBasis)}; 기본 클리닉 적격성 ${valueText(attempt.defaultClinicTargets)}; 명시 배정과 별개`);
      for(const [stage,status] of Object.entries(row(ap.stages)))lines.push(`        - 단계 ${stage}: ${knowledge(status)}`);
      for(const rawItem of list(attempt.items)){
        const item=row(rawItem);
        lines.push(`        - 문항 ${text(row(item.item).labelLiteral)} [${text(row(item.item).assignedItemId)}]: ${state(item.state)}; 원천 채점 ${knowledge(item.sourceGrade)}; 확인 기준 ${text(item.inspectionBasis)}; 교사 완료 근거 ${ref(item.completion)}; 보존 완료 근거 ${ref(item.retainedCompletion)}`);
        if(item.completion)lines.push(`          - 현재 교사 완료 ${evidence(item.completion)}`);
        if(item.retainedCompletion&&ref(item.retainedCompletion)!==ref(item.completion))lines.push(`          - 보존된 교사 완료 ${evidence(item.retainedCompletion)}`);
      }
      for(const rawReview of list(attempt.activityReviews)){
        lines.push(...reviewLines(rawReview,assigned,attempt,'        ','응시 범위'));
      }
      lines.push(`        - ${evidence(attemptRecord)}`);
    }
    for(const rawReview of list(assigned.activityReviews)){
      const binding=row(row(row(row(rawReview).record).payload).attemptBinding);
      const bound=binding.state==='known'?list(assigned.attempts).map(row).find(a=>row(a.record).revisionId===row(binding.value).attemptRevisionId&&row(a.record).entityId===row(binding.value).attemptEntityId):undefined;
      lines.push(...reviewLines(rawReview,assigned,bound,'      ','배정 범위'));
    }
    if(!list(assigned.attempts).length)lines.push('      - 응시 미확인; 미수행·미완료로 확정하지 않음');
  }
  for(const rawResult of list(row(row(scene.workContext).data).sourceResults)){
    const source=row(rawResult),r=row(source.record);
    lines.push(`  ${number}.${section++} 원천 평가 / 단원 연결 ${text(source.sectionBinding)}`);
    lines.push(`    - ${text(r.sourceTitle)} / 시험지 ${text(r.paperKey)} / 응시 ${text(r.attemptKey)} / 원천 점수 ${valueText(r.score)}; 교사 완료 추론 없음 [근거 ${text(source.revisionRef)}; ${clocks(source)}]`);
  }
  return {lines,next:section};
}

/** Presentation of canonical fields only. No sorting/selecting teacher judgments or score-derived learning state. */
export function renderTeacherReport(document:unknown,selector:Exclude<TeacherSelector,{kind:'cohort'}>):string[] {
  const doc=row(document),lines:string[]=[];
  const date=selector.date;
  const students: {scene:Row;occurrences:Row[];name:string;id:string}[]=[];
  if(selector.kind==='student'){
    if(doc.kind!=='student_learning_scene'||row(doc.student).id!==selector.studentId||row(doc.preparation).date!==date||row(row(doc.workContext).scene).studentId!==selector.studentId||row(row(doc.workContext).scene).date!==date)throw Error('teacher_report_scope_conflict');
    students.push({scene:doc,occurrences:[],name:text(row(doc.student).displayName),id:selector.studentId});
  }else{
    if(doc.kind!=='date_class_preparation'||doc.date!==date||!Array.isArray(doc.rows))throw Error('teacher_report_scope_conflict');
    for(const raw of doc.rows){
      const occurrence=row(raw),scope=row(occurrence.occurrence),id=text(occurrence.studentId,'');
      if(!id||scope.date!==date||(selector.groupId!==undefined&&scope.groupId!==selector.groupId)||row(occurrence.preparation).date!==date)throw Error('teacher_report_scope_conflict');
      const prior=students.find(student=>student.id===id);
      if(prior){if(prior.name!==text(occurrence.studentName))throw Error('teacher_report_scope_conflict');prior.occurrences.push(occurrence);}
      else students.push({scene:{preparation:occurrence.preparation},occurrences:[occurrence],name:text(occurrence.studentName),id});
    }
  }
  const classLabel=selector.kind==='class_preparation'?(selector.groupId===undefined?'관측된 날짜 수업':`원천 반 ${text(selector.groupId)}`):'학생 상세 / 반 연결 미확인';
  lines.push(`[${date} 학원 수업 맥락 / ${classLabel} ${students.map(student=>student.name).join(', ')}]`);
  lines.push('조회 범위: 보존된 정식 조회 결과의 부분 근거. 현재 원서버 갱신·전체 이력·현재 전체 반 명단은 확인되지 않음.');
  lines.push('저장 student_history는 선택된 9개 facet만 포함하며 별도 날짜 lesson_context 관측은 포함하지 않음. 최신 적용 교사 정정은 해당 원천에 보존된 범위만 표시.');
  if(selector.kind==='class_preparation')lines.push('날짜·반 준비 조회: 관측된 수업행과 준비 이력. 상세 응시·교사 판정은 별도 student 선택으로 확인.');
  if(!students.length)lines.push('일치하는 보존 수업행 미확인; 결석·배정 없음·미수행을 뜻하지 않음.');
  for(const [index,student] of students.entries()){
    const number=index+1,scene=student.scene;
    lines.push('',`${number}. ${student.name}`,`  ${number}.1 당일 흐름`);
    if(!student.occurrences.length)lines.push('    - 날짜·반 출결, 실제 수업 순서, 기존 숙제 확인은 이 학생 상세 조회만으로 미확인');
    for(const raw of list(scene.evidence)){
      const version=row(raw),payload=row(version.payload);
      if(payload.kind==='teacher_reported_note')lines.push(`    - 교사 원문 메모 (상태·배정 추론 없음): ${text(payload.text)} ${evidence(version)}`);
    }
    for(const occurrence of student.occurrences){
      lines.push(`    - 수업 발생 ${valueText(occurrence.occurrence)}; 원천 필드 ${valueText(occurrence.fields)} [근거 ${text(occurrence.revisionId)}; ${clocks(occurrence)}]`);
    }
    const prep=preparationBooks(scene.preparation,number,2);lines.push(...prep.lines);
    const assignments=exactAssignments(scene,number,prep.next);lines.push(...assignments.lines);
    lines.push(`  ${number}.${assignments.next} 오늘 할 일·확인 필요`);
    const obligations=list(row(row(row(scene.workContext).data).exactWork).currentObligations);
    for(const obligation of obligations)lines.push(`    - 현재 명시 배정 ${text(row(obligation).assignmentRevisionId)}; 완료 여부는 위의 응시·문항별 판정 참조 (배정 목록은 미완료 목록이 아님)`);
    if(!obligations.length)lines.push('    - 현재 명시 배정 목록 미확인; 미완료 숙제 수로 환산하지 않음');
    lines.push('    - 지도 제안: 연결 미확인인 판본·발생·응시와 아직 없는 교사 판정을 해당 범위에서 확인. 새 배정·확정 기한으로 간주하지 않음.');
  }
  return lines;
}

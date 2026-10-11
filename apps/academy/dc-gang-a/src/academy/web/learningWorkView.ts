import type {CatalogKind, CatalogNode} from '../domain';
import type {TeacherWorkContext, TeacherWorkScene} from '../teacherWorkContext';
import {renderEvidenceRailRow,sourceEvidenceRail,wireEvidenceRails} from './teacherRails';

export const catalogKindLabels:Record<CatalogKind,string>={book_edition:'교재',major_unit:'대단원',middle_unit:'중단원',minor_unit:'소단원',learning_section:'세부 섹션',printed_page:'페이지',problem:'문항'};
const labels=catalogKindLabels;
const stageLabels={written_solving:'풀이',grading:'채점',correction_and_explanation:'오답 보완·설명',review:'검토',completion:'완료 판정'} as const;
const node=(tag:string,text='',className='')=>{const result=document.createElement(tag);result.textContent=text;result.className=className;return result;};

/** Render the same server-derived context sent to the semantic tool. No independent completion logic. */
export function learningWorkView(context:TeacherWorkContext,selected:TeacherWorkScene):HTMLElement {
  if(context.scene.studentId!==selected.studentId||context.scene.date!==selected.date||context.scene.revision!==selected.revision)throw Error('work_context_scene_conflict');
  const sourceResults=context.data.sourceResults??[];
  if(sourceResults.some(row=>row.record.studentKey!==context.data.studentKey.literalKey))throw Error('work_context_source_student_conflict');
  const bookOrder=[...new Set(context.data.books.map(book=>book.catalogNodeId))];let sourceOrdinal=0;
  const panel=node('section','','card learning-workbench');panel.id='learning-workbench';
  const heading=node('h3','교재별 학습 구조');heading.id='learning-workbench-title';panel.setAttribute('aria-labelledby',heading.id);
  const sceneEvidence=node('details','','scene-evidence');
  sceneEvidence.append(node('summary',`기준 수업일 ${context.scene.date}`),node('p',`조회 리비전 ${context.scene.revision}`,'muted'));
  sceneEvidence.append(node('p','연결된 목차를 보여줍니다. 목차 전체·순서와 실제 배정·프린트 문항 연결은 별도 검증 대상입니다.','muted'));
  panel.append(heading,sceneEvidence);
  const index=new Map(context.data.curriculum.map(item=>[item.id,item]));
  const children=new Map<string,CatalogNode[]>();
  for(const item of context.data.curriculum)if(item.parent.state==='known'){
    const siblings=children.get(item.parent.value)??[];siblings.push(item);children.set(item.parent.value,siblings);
  }
  const visiting=new Set<string>();
  const render=(item:CatalogNode,sourceBook:CatalogNode['sourceKey'],bookName?:string):HTMLElement=>{
    if(visiting.has(item.id))throw Error('work_context_catalog_cycle');visiting.add(item.id);
    const line=node('li', '',item.kind==='book_edition'?'book':'catalog-node');line.dataset.catalogId=item.id;
    const nested=children.get(item.id)??[],detail=node('details') as HTMLDetailsElement;
    detail.open=item.kind==='book_edition';
    const summary=node('summary');
    if(item.kind==='book_edition'){
      detail.className='book-content';summary.className='book-head';
      const title=node('div');title.append(node('h2',bookName??item.label),node('div','보존된 교재 · 원문 근거와 실제 배정은 별개','identity'));
      summary.append(node('span',String(bookOrder.indexOf(item.id)+1).padStart(2,'0'),'book-number'),title,node('div','원본 채점과 교사 판단을\n각각 보존합니다.','coverage'));
    }else{
      detail.className=item.kind==='major_unit'?'major':'catalog-branch';summary.className=item.kind==='major_unit'?'major-summary':'catalog-row';
      summary.append(node('span',labels[item.kind],item.kind==='major_unit'?'major-sign':'content-kind'),node('strong',item.label,item.kind==='major_unit'?'major-title':''));
      if(item.kind==='major_unit')summary.append(node('span',`하위 목차 ${nested.length}`,'major-count'));
    }
    detail.append(summary);
    if(item.kind==='book_edition'){
      const registrations=context.data.books.filter(book=>book.catalogNodeId===item.id);
      const results=sourceResults.filter(row=>row.bookBinding==='current_registration'&&registrations.some(book=>book.sourceBook.literalKey===row.record.bookNo&&book.sourceCourse.literalKey===row.record.courseKey));
      const unit=node('section','','unit');unit.append(node('h4','보존된 채점 근거','source-record-heading'),node('p','교재·과정은 연결되어 있습니다. 원문 라벨이 같아도 세부 목차·배정·교사 판정으로 자동 연결하지 않습니다.','muted'));
      // Only the shared fixed-markup renderer supplies HTML; it escapes every dynamic field/attribute.
      const stack=node('div','','record-stack');stack.innerHTML=results.map(row=>renderEvidenceRailRow(sourceEvidenceRail(row),sourceOrdinal++===0)).join('');
      unit.append(stack);if(!results.length)unit.append(node('p','이 교재에 연결된 채점 관측이 없습니다. 미수행 판정이 아닙니다.','no-records'));detail.append(unit);
    }
    if(item.kind==='learning_section'||item.kind==='problem'){
      const assignments=context.data.exactWork.assignments.filter(row=>row.record.payload.status==='assigned'&&(item.kind==='learning_section'?row.record.payload.sectionNodeIds.includes(item.id):row.record.payload.items.some(assigned=>assigned.contentNodeId===item.id)));
      line.dataset.workState=assignments.length?'assigned_exact':'source_unknown';
      detail.append(node('p',assignments.length?`보존 배정 ${assignments.length}건 · 배정 시점 목차와 문항별 판단은 아래에서 확인`:'배정·수행 근거 미확인','work-state'));
    }
    if(item.kind==='minor_unit'){
      const rows=context.data.unitWork.filter(row=>row.sourceBook.namespace===sourceBook.namespace&&row.sourceBook.literalKey===sourceBook.literalKey&&row.sourceMinorUnit.namespace===item.sourceKey.namespace&&row.sourceMinorUnit.literalKey===item.sourceKey.literalKey);
      for(const row of rows){
        const course=node('div','','course-work');course.dataset.courseKey=row.sourceCourse.literalKey;course.dataset.courseNamespace=row.sourceCourse.namespace;
        course.append(node('h5',`과정 ${row.sourceCourse.literalKey}`));
        course.append(node('p',row.duty==='current_duty'?'누적 점검 대상 · 세부 문항 배정은 별도':row.duty==='outside_current_audit_scope'?'현재 누적 점검 범위 밖':'현재 점검 범위 미확인','work-state'));
        for(const activity of row.teacherActivities.filter(activity=>activity.activity==='wrong_clinic'||activity.activity==='similar_clinic')){
          const title=activity.activity==='wrong_clinic'?'오답클리닉':'유사클리닉';
          const state=activity.state==='teacher_confirmed_resolved'?'교사 완료 기록':activity.state==='teacher_reinspection_required'?'교사 재검토 필요':'교사 판정 근거 미확인';
          course.append(node('p',`${title}: ${state} · 과정 ${row.sourceCourse.literalKey} · 소단원 범위, 프린트·문항 연결 미확인`,'work-state'));
        }
        detail.append(course);
      }
    }
    if(nested.length){const list=node('ul','','catalog-children');for(const child of nested)list.append(render(child,sourceBook));detail.append(list);}
    line.append(detail);visiting.delete(item.id);return line;
  };
  const roots=node('ul','','curriculum-tree'),shown=new Set<string>();
  for(const book of context.data.books){
    if(shown.has(book.catalogNodeId))continue;
    const root=index.get(book.catalogNodeId);if(!root)throw Error('work_context_book_binding_conflict');
    const bookTree=render(root,book.sourceBook,book.displayName),evidence=node('details','','registration-evidence');
    evidence.append(node('summary','과정별 교재 근거'),node('p','보존된 근거의 시각입니다. 현재 원천 접속이나 최신성을 보장하지 않습니다.','muted'));
    for(const registration of context.data.books.filter(row=>row.catalogNodeId===book.catalogNodeId)){
      const fields=node('dl');
      for(const [label,value] of [['과정',registration.sourceCourse.literalKey],['원천 관측',registration.sourceObservedAt],['마지막 확인',registration.lastVerifiedAt],['등록 리비전',registration.revisionRef]])fields.append(node('dt',label),node('dd',value));
      evidence.append(fields);
    }
    bookTree.querySelector('details')!.append(evidence);
    roots.append(bookTree);shown.add(root.id);
  }
  panel.append(roots);
  const unmatched=sourceResults.filter(row=>row.bookBinding==='unmatched_retained');
  if(unmatched.length){const retained=node('details','','scope-note');retained.append(node('summary',`현재 교재 연결이 없는 보존 채점 ${unmatched.length}건`));const stack=node('div','','record-stack');stack.innerHTML=unmatched.map(row=>renderEvidenceRailRow(sourceEvidenceRail(row))).join('');retained.append(stack);panel.append(retained);}
  if(!shown.size)panel.append(node('p','아직 연결된 교재 목차가 없습니다. 학습 미수행을 뜻하지 않습니다.','muted'));
  panel.append(node('h4','클리닉의 책임과 완료 기준'));
  const stages=node('ol','','clinic-stages');
  for(const stage of context.logic.clinicWorkflow.stages)stages.append(node('li',`${stageLabels[stage.stage]}: ${stage.responsibleActor==='student'?'학생':'교사'}`));
  panel.append(stages,node('p','오답 보완과 설명은 필요한 만큼 반복하며, 선생님의 명시적인 완료 입력으로 마칩니다.','muted'));
  const completion=context.action.operations.find(action=>action.operation==='record_clinic_completion');
  if(completion?.availability==='requires_exact_work_and_teacher_confirmation'&&!context.data.exactWork.assignments.length)panel.append(node('p','문항별 완료 입력은 확인된 실제 배정·풀이·문항 연결과 교사의 직접 확인이 필요합니다. 목차만으로 활성화하지 않습니다.','notice'));
  panel.append(node('p','상세 교사 이력은 웹앱에 보존합니다. DayRecord 반영과 학부모 전송은 별도이며 자동 실행하지 않습니다.','muted'));
  wireEvidenceRails(panel);
  return panel;
}

import type {StudentPreparationHistory} from '../preparationHistory';
const labels:Record<string,string>={teacher_confirmed_resolved:'교사 확인 완료',teacher_reinspection_required:'교사 재검사 지시 · 보완 필요',awaiting_teacher_review:'업로드 관찰 · 교사 확인 대기',source_reviewed_teacher_acceptance_unqualified:'서버 확인 표시 · 교사 판정 연결 미확정',source_not_loaded:'제출 근거 미연결 · 미수행 판정 아님',not_required:'영상 의무 없음'};
/** Presentation only; the application query remains the decision/evidence owner. */
export function preparationView(source:StudentPreparationHistory,requestedDate:string){
 if(source.kind!=='student_preparation_history'||source.date!==requestedDate)throw Error('preparation_scene_date_conflict');
 return {date:source.date,coverageLabel:'전체 숙제 범위·문항 연결 미확정',books:source.books.map(book=>({label:book.labelLiteral,coverageLabel:book.unitInventoryCoverage==='all_returned_course_units'?'조회된 교재 소단원 전체':'보존된 소단원 참조 · 전체 목차 검증과 별개',units:book.units.map(unit=>({label:unit.labelLiteral,videoLabel:labels[unit.video.state]??'상태 해석 미확정',referenceSubmissionCount:unit.video.referenceVideoRefs.length,teacherRevisionRefs:unit.video.teacherRevisionRefs,sourceVideoRefs:unit.video.sourceVideoRefs,dutyLabel:unit.duty==='current_duty'?'현재 누적 점검 범위':unit.duty==='outside_current_audit_scope'?'현재 누적 점검 범위 밖':'현재 배정 범위 미확정'}))}))};
}

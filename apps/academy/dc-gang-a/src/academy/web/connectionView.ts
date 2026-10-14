/** Presentation of the shared application's actual connection result, not a permission gate. */
export function connectionView(value:unknown){
  const source=value as {schemaVersion?:unknown;retainedQuery?:unknown;acquisition?:{transport?:unknown;state?:unknown;reason?:unknown;browserFallback?:unknown;scope?:unknown;authentication?:unknown;lastObservedAt?:unknown};officialJournalSave?:unknown;parentSend?:unknown}|null|undefined;
  const common=source?.schemaVersion===1&&source.retainedQuery==='available'
    &&source.acquisition?.transport==='direct_http_api'&&source.acquisition.browserFallback===false
    &&source.officialJournalSave==='not_implemented'&&source.parentSend==='teacher_owned';
  const acquisition=source?.acquisition;
  const configured=common&&acquisition?.state==='available'&&acquisition.reason==='explicit_scoped_read_only'
    &&['registered_course_book_only','registered_books_and_retained_exact_scopes'].includes(String(acquisition.scope))&&acquisition.authentication==='fresh_per_explicit_request'
    &&(acquisition.lastObservedAt===null||typeof acquisition.lastObservedAt==='string'&&Number.isFinite(Date.parse(acquisition.lastObservedAt)));
  const retainedOnly=common&&acquisition?.state==='blocked'&&acquisition.reason==='retained_only_selected';
  const blocked=common&&acquisition?.state==='blocked'&&['direct_http_authentication_not_qualified','native_http_identifier_required','retained_only_selected'].includes(String(acquisition.reason));
  const known=configured||blocked;
  return {
    retainedLabel:known?'보존 자료 조회 가능 · 조회 시각은 학원 갱신 시각이 아닙니다.':'보존 자료 연결 상태 미확인',
    acquisitionLabel:retainedOnly?'보존 자료 전용 · 학원 source 조회 없이 교사 판단을 독립 저장합니다.':configured?(acquisition?.scope==='registered_books_and_retained_exact_scopes'?'등록·교재와 보존된 수업·성적 범위 조회 준비됨 · 영역별 결과를 확인하세요. 새 과제·시험 발견이나 전체 연결 성공을 뜻하지 않습니다.':'등록·교재 조회 연결 준비됨 · 요청마다 직접 HTTP 인증과 대상 확인이 필요합니다. 다른 영역 갱신·실시간 연결·저장 성공을 뜻하지 않습니다.'):blocked?'실시간 학원 조회 보류 · 직접 HTTP 인증 연결 필요 · 브라우저로 우회하지 않습니다.':'학원 연결 상태 미확인 · 갱신을 활성화하지 않습니다.',
    journalLabel:known?'학원 일지 저장 미지원 · 초안과 최종 저장은 별개입니다.':'학원 일지 저장 연결 상태 미확인',
    sendLabel:'학부모 최종 점검·전송은 선생님이 진행합니다.',
    refreshDisabled:!configured,
    areaRefreshEnabled:configured&&acquisition?.scope==='registered_books_and_retained_exact_scopes',
  };
}

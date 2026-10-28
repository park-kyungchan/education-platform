# 수업 편성 라우팅 (class-timetable)

에이전트가 수업 준비 전에 먼저 읽는 편성 소유 모듈이다. 요일 패턴 추정을 금지하는 대신, 확정된 편성을 여기서 제공한다.

## 소비 순서

1. `timetable.json`: 학생별 수업 요일·부·출처. `provenance.kind`가 `user_confirmed`가 아니면 인용하지 말 것.
2. `routing.json`: 질문→원천 파일 지도. 평과 숫자 의미·수업 사이클·DailyRecord 문구는 원천 파일을 직접 읽을 것.
3. 수업 없는 날의 DailyRecord 부재는 정상이다. 미기록으로 보고하지 말 것.

`isClassDay`는 유효한 날짜에 대해 사용자 확정 편성만 `true` 또는 `false`로 반환한다. `inferred`와 `unknown` 출처는 요일과 무관하게 `null`(미확인)이다. 이 결과는 출석이나 날짜별 편성 변경을 확정하지 않는다.

## 소유 경계

- 편성 변경(요일·부·신규 학생)은 사용자 확정 후에만 이 파일에 반영한다. 에이전트가 추론으로 추가하지 않는다.
- 평가 척도표는 `apps/academy/dc-gang-a/src/lms/lessonJournalHttp.ts`의 `assessmentLabels`가 원천이다. 이 모듈에 복제하지 않는다.
- 어드미션 기간(`timetable.json`의 `admission`)은 소유자 발급 범위를 옮겨 적은 것이다. 에이전트가 넓힐 수 없다.
- 실 학생 데이터는 검증 로직·테스트 픽스처에 넣지 않는다. 테스트는 fictional 데이터만 사용한다.

## 검증

- `bun context/class-timetable/validate.ts` (workbench 루트에서 실행)
- `bun test context/class-timetable/tests/`
- `bun run check:class-timetable`은 타입 검사, 실제 라우팅 메타데이터의 대상 존재 검사, 가상 데이터 테스트를 실행한다. 라우팅 검사는 학생 시간표나 대상 파일의 내용을 읽지 않는다.
- `bun run test:class-timetable`은 가상 데이터 테스트만 실행한다.

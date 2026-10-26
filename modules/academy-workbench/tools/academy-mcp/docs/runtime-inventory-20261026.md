# Academy MCP runtime 노출·주입 목록 (2026-10-26)

범위: P2/P3 읽기 공용화의 첫 단계. 설계·목록화까지만이며 코드 추출, 쓰기 도구 개방, 실제 학생 데이터 접근은 포함하지 않는다. 문제 정의는 dc-gang-a `docs/academy-mcp-runtime-agnostic-problems.md` (P1~P7)를 따른다.

## (a) runtime별 도구 노출 대조

상류 academy-mcp가 등록하는 도구 (src 기준): academy_capabilities, academy_source_status, academy_query, academy_teacher_query, academy_teacher_report, academy_student_metadata, academy_dailyrecord_intake, academy_dailyrecord_review, academy_cism_section, academy_item_label_scope, academy_find_item_labels, academy_review_type_questions, academy_pool_source_contract, academy_pool_question_content, academy_review_candidate_set, academy_prepare_paper_plan, academy_verify_paper_preparation, academy_verify_paper_output.

| runtime | 노출 확인 | 빠진 것 | 근거 |
| --- | --- | --- | --- |
| Muse | 17개 (dailyrecord 2, paper1 6, class2 paper 6, saved 3) | academy_cism_section, academy_student_metadata, teacher_query/report, item-label, pool 계열 | Muse bridge registry.json 실측. bridge server.ts가 saved의 dailyrecord/cism/item-label 도구와 dailyrecord의 cism_section을 등록 단계에서 제외 |
| Codex | academy MCP 미등록 확인 | 상류 도구 전부 | 전역 `/root/.codex/config.toml`과 프로젝트 `.codex/config.toml`에서 mcp_servers 섹션 자체가 없다 (이름·존재만 확인, credential 값은 읽지 않았다). Codex는 지금까지 MCP가 아닌 날짜 고정 실행분(control/worker)으로 저장 경로를 썼다 |
| Hermes | academy MCP 미등록 확인 | 상류 도구 전부 (MCP 기준) | dc-gang-a-dev 프로필 config.yaml의 mcp_servers는 cloudflare·vercel·github 3개뿐이다. academy 접근은 MCP가 아니라 프로필 native 경로(소유자 설정과 직접 client 실행)로 이뤄진다. 프로필 기본 도구 목록 단위의 대조는 미확인으로 남긴다 |

미확인 항목을 노출된 것으로 단정하지 않는다. 남은 미확인: Hermes 프로필 기본 도구 이름 목록과 academy 도구 이름의 겹침 여부.

## (b) backend 주입 지점

| 지점 | 주입하는 것 | credential 경계 |
| --- | --- | --- |
| DailyRecordService 생성자 (academy-mcp/src/dailyrecord.ts) | DailyRecordReadBackend (readDailyRecord, readStudentMetadata, readCismSection). 없으면 각 도구가 unavailable 반환 | backend 구현이 자격을 가진다. 도구 입력으로 credential을 받지 않는다 |
| Muse bridge (academy-runtime server.ts + endpoints.json) | endpoint별 upstream 프로세스 실행 (dailyrecord, paper1, paper2, saved). dailyrecord/paper는 컨테이너 안 owner 프로세스가 비밀번호를 자기 안에서만 읽는다 | 비밀번호는 컨테이너 owner 프로세스 밖으로 나오지 않는다. bridge는 해시 receipt만 남긴다 |
| AcademyHttpClient (dc-gang-a/src/lms) | teacher principal로 직접 HTTP 읽기·쓰기. journalState/applyJournalAction | 인증은 client 내부 세션만. 저장 승인은 JournalHttpAdmission이 별도로 강제한다 |
| saved_context 서버 | 보존 스냅샷 읽기 (academy_query 등) | live 원천이 아니다. coverage/freshness를 결과에 명시한다 |

## (c) P6 이름 충돌 후보

- `academy_dailyrecord_intake`, `academy_dailyrecord_review`: Muse bridge와 상류 서버 양쪽에 같은 이름이 있다. 공용화 시 등록 주체를 하나로 정해야 한다.
- `class2_academy_*` 접두 도구: Muse bridge가 paper2 endpoint를 접두사로 구분한 것이다. 공용 서버에서는 접두가 아닌 명시적 source 구분으로 바꿀 후보이다.
- `academy_query`, `academy_teacher_query`: 이름이 비슷해 runtime별 라우팅이 섞일 수 있다.
- Hermes 프로필 쪽 기존 도구와의 충돌은 미확인이다. 등록 전에 프로필 도구 목록과 대조한다.

## (d) 공용 서버 추출 최소 단위와 수용 테스트

최소 단위 제안: academy-mcp 서버 패키지 하나(도구 등록 + 스키마 + DailyRecordService)를 그대로 공용 서버로 삼고, runtime 차이는 연결 설정으로만 둔다. bridge의 도구 제외 목록은 제거 대상이 아니라, 서버 설정 한 곳의 노출 선언으로 옮긴다. backend 주입은 owner 프로세스 한 곳에서 한다.

수용 테스트 (전부 fixture, 실제 학생 데이터 금지):
1. 세 runtime에서 tools/list 결과가 동일한지 대조한다.
2. 같은 fixture 입력으로 intake/review/cism_section의 structured 결과 해시가 runtime 간에 일치하는지 확인한다.
3. backend 미주입 상태에서 세 도구가 unavailable을 반환하고, 어떤 쓰기도 일어나지 않는지 확인한다.
4. 실패 1건 뒤에도 다음 요청이 새 판정을 받는지 (latch가 세션을 막지 않는지) 확인한다.
5. credential 문자열이 로그·receipt·결과 어디에도 없는지 검사한다.

## STOP 지점

여기까지가 이번 GO 범위이다. 코드 추출 착수, Codex·Hermes 설정 대조, 쓰기 도구 개방은 다음 GO에서 결정한다.

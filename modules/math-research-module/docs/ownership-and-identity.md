# 소유권·정체성·검증 경계

## 공통과 도메인

Canonical implementation/schema owner는 고정된 `agent-platform`의 각 package입니다. 이 repository는 Artifact/WorkContext 공통 의미를 복제하지 않고 검증된 실제 source를 import합니다. 소비자 로더와 setup script는 경로·pin·import resolution을 검증하는 연결 코드입니다.

Upper Ontology semantic owner는 ontology-foundation에 남습니다. 수학 연구의 개념·문항·능력 후보·지도 행동·관계 의미 및 연구 객체 identity 정책은 이 모듈의 도메인 소유입니다. 둘 사이의 명시적 crosswalk는 정체성의 동일화나 새 중앙 발급 체계가 아닙니다.

Codex/Hermes native owner가 loop/session/dispatch/retry/tool/profile/credential/permission을 계속 소유합니다. 이 앱은 이를 설정·수정·등록하지 않습니다. 사용자 원문, 연구 원본과 후속 검토 기록은 이 모듈의 데이터 소유 범위에만 보존합니다. 기존 Work/학생/학원 operational store를 옮기지 않습니다.

## 작업 추적

- domainId: `mathematics-education`
- projectId: `math-research-module`
- Project Artifact: `math-research-module:project:manifest`
- workId: `standalone-harness-adoption-20261013`
- Task: `math-research-module:task:standalone-harness-adoption-20261013`
- Run: `math-research-module:run:standalone-harness-adoption-20261013-01`
- Verification: `math-research-module:verification:standalone-harness-adoption-20261013`

이 ID는 현재 모듈 안에서 선택한 규약 적합 ID입니다. 중앙 발급이나 글로벌 유일성 예약을 주장하지 않습니다. Work는 Artifact kind가 아니므로 `harness/work-context.json` 선택 레코드와 executor-local canonical checkpoint/request로 연결합니다. 루트가 다른 환경의 기존 checkpoint를 자동 재등록하지 않습니다.

초기 기록은 `harness/history/records-initial-20261013.json`에 보존합니다. current records의 변경은 초기 관찰을 지우지 않습니다. userDecisions의 accepted는 해당 실제 요청의 수신·지시 상태이며 이 구현 결과의 AcceptanceDecision이 아닙니다.

## 연구 객체와 관계

연구 객체 ID는 Work/Task/Run에서 파생하지 않습니다. 기존 `HM…`, `HD…`, `HC…` 등의 ID와 original examples는 바꾸지 않으며 새 연구 객체에서 legacy reference로 가리킵니다. DATA/LOGIC/ACTION/GOVERNANCE는 각각 type·내부 계층·typed topology를 갖는 도메인 분류입니다. ACTION의 실행 절차 정의와 실제 한 번의 Run, 소속 계층과 선수/근거/파생 관계는 구분합니다.

synthetic 관찰 사례는 실제 학생의 관찰로 승격하지 않으며 completion·verification·acceptance는 서로 다른 주장입니다. 실제 학생 데이터를 추가하는 작업이나 운영상 결정을 승인하는 시스템이 아닙니다.

## 검증과 수락

- Original: 바이트와 locator가 보존된 입력
- User decision: 원문 메시지와 fixed hash로 뒷받침된 사용자 지시
- Proposal: 채택 전 설계 또는 교정 제안
- Evidence: 실제 수행한 관찰과 제한, 실패/부분/성공 구분
- Verification: 대상과 기준별 pass/fail/unverified
- AcceptanceDecision: 별도 수락, 테스트 성공으로 만들지 않음

`authority=none`, `nativePermissionGranted=false`, `actualUserAdoptionInferred=false`를 유지합니다. 과거 실제 effects는 이번 실행에서 관찰하지 않았으므로 `unverified`입니다. 빈 completed 목록을 과거 효과가 없었다는 증거로 쓰지 않습니다.

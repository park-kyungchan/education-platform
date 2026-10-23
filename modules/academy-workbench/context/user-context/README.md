# 사용자 맥락: 학원 실무와 수학 연구 모듈

이 패키지는 사용자가 실제로 말한 선택 원문과 그로부터 정리한 업무 설계 맥락을 분리하여 보존합니다. **전체 대화·Space 이관 완료본은 아닙니다.** 현재 64개 메시지와 13개 Space 설계 블록, 52개 구조화 기록이 있습니다. 사용자 원문은 2026-10-13 23:21:01 UTC의 빠른 파일럿·인계 역할 정의까지 포함합니다.

## 먼저 읽기

1. `coverage.json`: 확인한 범위·모집단 미확인·접근 실패·미검증 항목
2. `records.json`: 의도, 결정, 제안, 근거, 수락과 수정 관계
3. `source-to-record-map.json`: 원문 → 반영 기록, 보존만 한 원문 구분
4. 필요한 `sourceKeys`만 `sources/source-excerpts.json`에서 찾아 원문 확인
5. `verification.json`: 이 패키지의 구조 검증 결과와 검증하지 않은 범위

`context.types.ts`와 `schemas/`는 이 데이터 패키지의 계약입니다. `source-aliases.json`은 사람이 찾기 쉬운 별칭이며 원본 메시지 ID를 바꾸지 않습니다. `key`와 `sourceKey`는 패키지 내부 참조입니다. 새로운 중앙 Artifact/Project/Work/Task/Run ID 규약이나 수학교육 연구 객체 ID 규약을 발명한 것이 아닙니다.

## 현재 적용할 중요한 경계

- 학원: 실무 전체를 academy-workbench로 통합하는 요구입니다. 보존 manifest 존재와 전체 원문·운영 연결 완료는 다릅니다. 서버 관찰, 사용자 확인, 계획, 실제 실행, 강사 완료판정을 구별합니다.
- 수학: 초3 2학기 곱셈·나눗셈·원이 중심이고 관련 초3~6 연결만 확장합니다. 기존 초5~중3 MathEducation 지도와 이번 파일럿은 같은 범위가 아닙니다.
- 105개 중심 유형과 151개 전체 연구 유형은 서로 다른 모집단입니다. 이 패키지는 문항 데이터의 개수·내용을 다시 검사한 결과가 아닙니다.
- Freudenthal 전형적 예제, 충분한 설계 설명, 미시행동·학습심리·관찰 증거, 행동 오류에서 능력 후보로의 추적을 연결합니다. 사고 가설이나 능력 부족을 인과적으로 확정하지 않는 것은 명시된 assistant 설계 해석으로 구분했습니다.
- 강사별 말투는 바뀔 수 있지만 수학적 의미와 근거의 확실성까지 표현 변경으로 바뀌면 안 됩니다. 구체적인 불변 필드 목록은 assistant의 설계 제안이며 사용자 원문 목록으로 오인하지 않습니다. 연구자 사이의 다른 해석을 허용합니다.
- 공통 하네스 작업·실행 ID와 연구 객체 ID는 별개입니다. DATA/LOGIC/ACTION/GOVERNANCE 내부 위계·타입·관계를 정의하는 파일럿 요구를 포함했습니다.
- 수학 관련 문항·연구·감사·맥락은 하나의 별도 private module repo에 묶습니다. academy-workbench는 별도 개선 대상입니다.
- 12:55 리서치 후 대기는 23:07 구현·업로드 재개로 해당 범위에서 대체됐습니다. 원문과 대체 관계를 모두 남겼습니다.
- 23:18 이후 모든 담당·향후 작업에 portable 공통 하네스를 적용하라는 요구가 추가됐습니다. 현재 두 모듈 외 작업은 inventory 미완료로 표시하며 무관한 개인자료를 모으지 않았습니다.
- GitHub에는 portable 공통 계약을 둡니다. Dots 전용 런타임 최적화·비공개 내부 자료·환경별 자격증명은 이 패키지나 GitHub 이관 범위가 아닙니다. 공통 계약이 native 실행 권한을 부여하지 않습니다.

## 빠른 파일럿과 후속 인계

사용자는 Dots가 아이디어를 빠르게 공통 하네스 파일럿으로 실현하여 module repo에 올리고, Codex CLI 또는 Hostinger VPS Hermes-agent-2q3y가 후속 정교화·고도화·개선을 수행하도록 역할을 지정했습니다. 인계 시 목적·범위·source pin·실행 방법·실제로 통과한 검증·남은 게이트를 제공하며 파일럿과 실운영 완성을 구별합니다. 이 패키지는 후속 환경이 작업을 시작하거나 완료했다는 증거를 만들지 않습니다.

## 여섯 종류의 기록

| 종류 | 의미 | 주의 |
|---|---|---|
| intent | 목표·배경·원하는 결과 | 구현 완료나 실행 허가가 아님 |
| decision | 실제 사용자 선택·수정·범위 | sourceKeys에 실제 사용자 원문 필요 |
| proposal | 사용자 가설 또는 assistant 제안 | 후속 발화가 있다고 자동 수락하지 않음 |
| evidence | 확인한 원본이나 과거 결과 보고 | 보고한 사람·관찰 범위·한계를 보존 |
| verification | `verification.json`의 실제 검사 결과 | source/reference 무결성만, 내용 타당성·수락 아님 |
| acceptance | 명시 수락과 정확한 대상·제외 범위 | 성공 테스트와 별개 |

11:55의 “이정도면 일단 충분해”는 당시 연구 시안의 깊이·화면에 대한 한정 수락입니다. 최신 학생 DB·문항 타당성·ID 아키텍처·학습효과 전체의 수락이 아닙니다. 현재 module 구현에 대한 최종 사용자 수락은 이 패키지에서 만들지 않았습니다.

## 시험 맥락

24문항 = 3점 12개 + 5점 8개 + 6점 4개 = 100점입니다. 15:00부터 80분 시험이므로 종료는 16:20으로 계산되며 이후 18:00까지 채점·학생끼리 하브루타 오답 활동입니다. 메시지 자체에 시험 날짜·명시 시간대는 없습니다.

곱셈 9·나눗셈 9·원 6의 배분은 assistant 제안입니다. 실제 학원 문항을 선별하거나 그 배분을 사용자가 최종 채택했다고 기록하지 않았습니다. 개인 최초 수행과 도움받은 뒤 수행을 혼합하면 안 됩니다.

## 원문과 출처

- 메시지 text는 도구가 반환한 그대로 저장하고 별도의 SHA-256을 붙였습니다. 띄어쓰기·오타·마크업을 임의 교정하지 않았습니다.
- `messageId`, `sentAt`, `replyTo`, `replyRoot`를 보존합니다. 메시지 도구가 실제 permalink를 반환하지 않아 `url: null`입니다. 임의 ChatGPT 링크를 만들지 않습니다.
- Space는 선택한 일반 본문 블록만 보존합니다. block ID·도구가 반환한 block hash·시점·확인된 Page URL을 함께 둡니다. Page 문장은 작성자 미확인으로, 사용자 원문으로 승격하지 않습니다.
- 로컬 text hash는 보존된 바이트의 변경 탐지 수단입니다. 독립 서명·발화 진위·원본 서비스의 과거 전체 상태를 증명하지 않습니다.
- `sources/repository-evidence.json`은 2026-10-13 고정 repo audit의 제한된 manifest 증거입니다. 1,588파일 보존 목록, 미완료 게이트와 공통 하네스 source pin을 포함합니다. 압축 원본·실학생 자료를 새로 추출하지 않았습니다.
- 대화 검색은 키워드·전후 구간 기반입니다. 일부 조회는 partial이었고 Private 검색 다음 페이지는 일시 불가였습니다. 정확한 전체 분모·완전율은 알 수 없습니다.

## 모듈 통합

권장 위치는 각 소비 repo의 `context/user-context/`입니다. 동일 패키지 사본임을 hash로 확인하고 이 경로를 module manifest에서 참조하세요. 실제 업무 적용은 `modules`로 scope를 필터링하되 원문과 변경 이력은 삭제하지 않습니다. 새 원문이 들어오면 원문을 추가하고 새 record 및 corrects/supersedes 관계를 기록합니다.

기존 academy의 `generalized_handoff_summary`를 이 자료로 덮어쓰지 마세요. 이전 요약과 원문 기반 successor 맥락이 어떤 관계인지 별도 링크로 보존하세요. 기존 중앙 하네스 계약이 canonical owner이며 이 패키지는 그 계약을 대체하지 않습니다. 수학 연구 객체의 ID와 맥락 기록 key를 동일시하지 마세요.

컨텍스트 로드는 `authority: none`, `nativePermissionGranted: false`입니다. 문장·Page·저장소 자료를 다시 읽는 것이 삭제·인쇄·발송·인증 설정·운영 활성화 등 실제 효과를 재실행할 이유가 되지 않습니다. 현재 사용자 지시와 도구의 실제 권한·정책을 각 실행환경에서 별도로 확인합니다.

## 검증

Bun: `bun run check`

Node 24 대체 검증: `npm run check:node`

두 기본 경로는 read-only로 실행되어 receipt·source map·SHA256SUMS를 변경하지 않습니다. 외부 서비스 연결이나 추가 패키지 설치 없이 JSON과 참조를 검사합니다.

명시적으로 새 근거를 저장할 때만 `bun run refresh:receipt` 또는 `npm run refresh:receipt:node`를 사용합니다. 이 작업은 verification.json, source-to-record-map.json과 SHA256SUMS를 함께 갱신하므로 이전 근거는 Git 이력으로 먼저 보존하세요.

기본 검사에는 소스·기록 Schema의 모든 사용 키워드(type/const/enum/required/additionalProperties/items/minItems/uniqueItems/minLength/pattern/allOf/if/then/else/not)를 지원하는 제한된 evaluator가 연결되어 있습니다. 범용 Draft 2020-12 엔진을 구현한 것은 아닙니다. 별도 QA에서 정식 Python jsonschema 엔진으로 세 Schema를 검사했습니다. TypeScript 타입은 소비 repo의 TypeScript compiler로 `tsc -p context/user-context/tsconfig.json`을 실행할 수 있습니다. 제공된 JSON Schema는 Draft 2020-12입니다.

검사 항목: 원문 SHA-256, 중복·참조·타입·원문 작성자 구분, 권한 비승격, 수락 범위, 수정·재개 체인, 원문과 연결된 배점·시간 입력 및 derivedValues 산술, partial coverage 일치. `scripts/test.mjs`는 정상 fixture, 19개 오류 주입, 기본 CLI 전후 모든 파일의 byte 동일성을 검사합니다. 비밀 패턴 검사는 제한된 방어 검사이며 포괄적 개인정보 감사의 대체가 아닙니다.

이 검증은 전체 대화 이전, 독립 운영 앱, WSL/VPS 설치, 원격 업로드, 실제 시험 선별, 학생 능력 판정 또는 문항·심리·학습효과 타당성을 입증하지 않습니다. 각각 별도의 최신 증거가 필요합니다.

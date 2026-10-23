# Academy context entrypoint (2026-10-21)

Start with [the academy context catalog](context/academy-context/README.md) for the current owner-preserving scope, date/class/student navigation, source references, scoped decisions and identified bottlenecks. `bun run context:academy inspect` reads discovery metadata only. The selected-history coverage remains partial; original student records and historical repositories keep their existing custody. Earlier dated material below remains source history.

# Five-student evidence audit and cloud instruction topology

The [2026-10-14 audit](context/student-audit-20261014/README.ko.md) separates academic source records, teacher judgments, paper stages, historical snapshots and bounded current observations. [Typed instruction topology](context/student-audit-20261014/instruction-topology.json) and its pure planner constrain cloud reads and migration readiness without enabling production actions. Private data is not a runtime fixture.

# Academy Workbench

For source-only repository restructuring, [the common Git Work route](work/academy-workbench/academy-repository-restructure-20261019/inputs/AR-WORKFLOW-ROUTE.json) selects this project's own Work and the separately pinned canonical reader. This does not replace the existing consumer lock, checkpoints or runtime/operational gates. Academy MCP and month-end feature implementation belongs to another PR owner.

The [2026-10-15 continuation and CI successor](docs/harness/continuation-ci.md) adds bounded current-source inspection, read-only known-checkpoint continuation, fresh check invocation identity and exact-head V2 independent-review CI. Existing consumer records and operational gates remain historical source evidence. The generated finite upstream dependency cache is a byte copy with pinned provenance, not Academy-maintained canonical implementation.

## 학원 조회 맥락 추가본 (2026-10-14)

[`context/academy-inquiry`](context/academy-inquiry/README.ko.md)는 제한된 화면 조회·확장 프로그램 차단·10/9 휴원 정정·교사 판정과 원서버 충돌을 비식별 typed 기록으로 보존합니다. DATA/LOGIC/ACTION/GOVERNANCE 위계와 별도 로컬 Work/Task/Run을 사용하며 전체 진도표·학생별 전체 감사·운영 동기화 완료를 주장하지 않습니다. 기존 대화 패키지·원본 아카이브·운영 게이트를 덮어쓰지 않습니다.

## 공통 하네스 소비 모듈 (2026-10-13)

[`project.json`](project.json)과 [`harness/module.json`](harness/module.json)에 Project·모듈 경계, 이번 Work/Task/Run ID, 로컬 등록 범위를 기록합니다. 공통 구현은 `agent-platform@ffba2462…`의 고정 외부 dependency에서 가져오며 복제하지 않습니다. [설치·검사](docs/harness/bootstrap.ko.md)와 [맥락·근거·수락·효과 계약](docs/harness/README.ko.md)을 읽으세요. 선택 대화·Space 원문과 후속 맥락은 [`context/user-context`](context/user-context/README.md)에 별도로 추가하며, 기존 일반화 요약을 덮어쓰지 않습니다. 전체 맥락 이관은 아직 부분 범위입니다. Bun 개발 검사는 기존 Node 24 합성 앱과 분리됩니다. 이 적용은 실제 학원 운영, 전역/native 등록, 사용자 수락 또는 아래 7개 운영 게이트 완료를 뜻하지 않습니다.

## 최신 작업 기준 (2026-10-13)

후속 작업은 [`migration/current-status.json`](migration/current-status.json)부터 읽으세요. 대응하는 [TypeScript 계약](migration/current-status.types.ts)과 [JSON Schema](migration/current-status.schema.json)에 실자료→운영 화면, 인증, 저장·복구, 외부 배포 등 남은 7개 게이트와 출처 커밋·다음 검증 조건을 기록했습니다. `migration/hardlimits.json` 및 아래 초기 인수인계는 역사적 기록이며, 독립 로컬 앱으로 이미 해결된 범위는 최신 상태 색인의 명시적 대응표를 우선합니다. 로컬 합성 검증·오프라인 자료 보존은 실자료 운영 활성화나 외부 배포 완료가 아닙니다.

## 비공개 원본 보존

감사된 학원 원본과 업무 맥락은 [`archives/academy-20261013`](archives/academy-20261013/README.md)에 압축 보존됩니다. 네 묶음의 1,588개 파일을 해시로 검증하고 원래 경로 별칭으로 복원할 수 있습니다. 런타임 데이터로 자동 사용하지 않습니다. dc 원본의 명시된 폰트 3개 등 누락·범위 한계는 아카이브 문서에 기록되어 있으며, 원본 저장소 삭제는 하지 않았습니다.

## 독립 실행 앱 (2026-10-13)

현재 실행 가능한 로컬 앱은 [`app/standalone`](app/standalone/README.md)에 있습니다. Node.js 24 이상에서 다음 명령으로 실행합니다.

```sh
cd app/standalone
node src/server/main.ts
```

같은 컴퓨터의 http://127.0.0.1:8787/ 을 여세요. ChatGPT/Sites 로그인, 플랫폼 런타임, 외부 서비스 연결 또는 node_modules 없이 제공된 정적 자산과 로컬 SQLite로 실행합니다. 처음부터 만든 가상 학생 5명의 읽기 전용 검증 앱입니다.

- 새 코드의 실제 검사: runtime 43개, UI 4개, 독립 경계 검사 13개 그룹. 동결 파일 목록은 `app/standalone/release-manifest.json`, 런타임 의존성 감사는 `app/standalone/validation/runtime-dependency-audit.json`입니다.
- 실제 학원 데이터의 운영 매핑·가져오기, 운영 인증 설정, 실시간 원천 연동, 인쇄·발송·외부 변경은 아직 완료되지 않았습니다. 별도 보존 아카이브가 자동으로 런타임 데이터가 되는 것은 아닙니다.
- 초기 132파일 인수인계는 기존 경로 및 `app/standalone/legacy/handoff`에 보존됩니다. 역사적 플랫폼 의존 소스는 실행 경로에 포함되지 않습니다. 원본 저장소 삭제·배포·권한 변경은 하지 않았습니다.

아래는 초기 인수인계 당시의 기록입니다. 그 당시 미구현 설명과 새 독립 앱의 현재 상태를 구분하세요.

---

# Academy Workbench handoff

개인 학생 데이터 없이 다른 개발 환경에서 이어가기 위한 인수인계 패키지입니다. 기존 UI와 업무 계약을 보존하며, 독립 운영 앱 완성을 뜻하지 않습니다.

## 지금 열어 볼 수 있는 것

`npm run preview` 또는 `python3 -m http.server 8765 --bind 127.0.0.1 --directory preview/v21` 실행 후 http://127.0.0.1:8765/preview.html 을 여세요. Node 패키지 설치 없이 Python 3 정적 서버로 기존 빌드 화면을 볼 수 있습니다. 원본을 새로 빌드하지 않았습니다.

- `preview/v21/`: 기존 v21 UI와 처음부터 만든 가상 학생 5명의 합성 API 응답. 실제 학생·서버 자료를 익명화한 것이 아닙니다.
- API 요청은 안전 래퍼가 메모리에서 답하며 CSP가 네트워크 연결을 막습니다. 로그인·실제 갱신·학원 저장·발송·인쇄·native WebMCP 성공을 증명하지 않습니다.
- 합성 응답에 있는 검증 성공 플래그와 해시는 화면 조건을 만족시키기 위한 모의 입력입니다. 서버 권한 검증 결과로 쓰면 안 됩니다.
- 넓이 전환은 iframe 반응형 검수입니다. 실제 모바일·터치·Safari 검수가 아닙니다.

## 코드와 설계

- `reference/sites-v21/`: 허용 목록으로 선별한 UI, 도메인, 계약, 검증 코드 및 스키마. 데이터 의존 파일과 비공개 설정을 제외했으므로 원래 패키지의 build/test는 실행 가능한 전체 제품이 아닙니다. 원래 package/lock 파일은 버전 참고용입니다.
- `architecture/`: 개인정보 없는 논리 모형과 타입. 실제 학원 DB 스키마로 확정한 자료가 아닙니다.
- `context/`: 사용자 업무 목적과 확정된 판단 기준을 일반화한 typed JSON. 학생별 사실, 원문 대화, 개인 계정·권한은 포함하지 않습니다.
- `migration/`: 남은 어댑터·인증·배포·도구 검증과 그 한계.
- `validation/`: 원본/내보낸 파일 해시, 변경·제외 목록과 이번 패키지의 정적 검수 범위.

## 현재 상태와 다음 작업

기존 운영 버전과 검수 후보를 구별하세요. v21은 이 패키지의 UI/소스 후보이며 운영 배포 확인이 아닙니다. 공식 화면 일부 읽기 검증이 있어도 독립 서버 인증/조회 어댑터나 앱 통합 완료는 아닙니다. 먼저 `migration/README.md`와 `MIGRATION_PLAN.md`를 읽으세요.

독립 앱의 인증 제공자, 서버 측 권한, 비공개 저장소, 원천 조회 어댑터, 지속 기록, 운영 배포는 여기서 구현하지 않았습니다. Sites 고유 로그인과 바인딩을 그대로 옮겨 동작한다고 가정하지 마세요. 새 환경에서 필요한 비밀은 지원되는 보안 절차로 따로 구성하고 Git에 넣지 않습니다.

이번 인수인계는 정적 파일 검사만 수행합니다. 앱 빌드/유닛/통합/브라우저 검사를 새로 실행했다는 주장을 하지 않습니다. 기존 테스트 소스와 기존 합성 화면을 보존했으며, 인수 환경에서 해당 검사를 다시 실행해야 합니다.

## 오프라인 보존 어댑터

[`app/offline-import-adapter`](app/offline-import-adapter/README.md)는 원본 기록을 출처·타입·관계와 함께 오프라인 보존 형식으로 검증하는 별도 도구입니다. 앱의 현재 학생 상태로 투영하거나 DB·서버에 넣지 않습니다. 실제 자료 보존본은 [`private/offline-preservation-20261013`](private/offline-preservation-20261013/README.md)에 별도로 둡니다. 해당 보존은 실제 학원 업무의 운영 활성화·전체 상태 이관 완료를 뜻하지 않습니다.

Sites 복구 보충본은 [`archives/academy-20261013/supplements/sites-source-gap`](archives/academy-20261013/supplements/sites-source-gap/README.md)에 있으며 원문·이력 확보 한계를 포함합니다.

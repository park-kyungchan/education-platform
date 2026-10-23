# 수학교육 연구 모듈

For source-only repository restructuring, [the common Git Work route](work/math-research-module/academy-repository-restructure-20261019/inputs/AR-WORKFLOW-ROUTE.json) selects this project's own qualified Work and the separately pinned canonical reader. Existing source/research/intent locks, historical Work and domain semantics remain unchanged. This route does not select questions or activate native work.

## 다른 CLI/VPS에서 바로 이어가기

먼저 [현재 인수인계와 실행 순서](docs/CONTINUE.ko.md)를 읽으세요. 이미 승인된 GitHub 읽기 접근과 Bun 1.4.2+/Node 24+가 있으면 `bun run bootstrap`, 이후 `bun run dev`를 사용합니다. 준비된 환경의 반복 검증은 `bun run verify`입니다. [현재 인수인계 색인](harness/current-handoff.json)에 관측한 main 게시 커밋과 Domain/Project/Work/Task/Run 연결이 있습니다. 기존 기록의 “게시 대기”는 과거 관측이며 새 작업이나 완료 Run의 재실행 지시가 아닙니다.

비공개 연구 파일럿입니다. React/TypeScript/Bun으로 독립 실행하며 ChatGPT, dot, MagicPath 런타임·계정·API 키가 필요하지 않습니다. 문헌과 연구 설계를 검토하는 앱이며, 실제 학생 DB나 검증된 진단·배정 시스템이 아닙니다.

## 빠른 실행

필요: Bun 1.4.2 이상, Node 24 이상(현재 DOM 테스트용), Git. Python 3은 추가 산술 재검증용입니다. 이미 승인된 비공개 저장소를 clone한 디렉터리에서:

```sh
bun install --frozen-lockfile --ignore-scripts
bun run check
bun start
```

앱: `http://127.0.0.1:4173`. 기본 바인딩은 localhost입니다. `PORT=4174 bun start`로 포트를 바꿀 수 있습니다. 외부 서비스에 자동 연결하지 않으며 문헌 링크는 사용자가 클릭할 때 열립니다. 공개 배포·인증·방화벽 변경을 자동 수행하지 않습니다.

## 공통 하네스 검증

UI 실행과 도메인 검사는 외부 native runtime 없이 가능합니다. 공통 작업 계약 검증에는 기존 GitHub 권한으로 `park-kyungchan/agent-platform`의 고정 커밋을 받아야 합니다.

```sh
bun run setup:harness --fetch
bun run check:all
bun run context:init
```

- source pin: `ffba2462a08b9f8c83c6f87b1043403e5cb748d7`
- `harness/agent-platform.lock.json`의 SHA-256 및 Git blob pins, 실제 resolve된 immutable Ontology 0.2.0 패키지를 검증합니다.
- 기존 checkout을 재사용하려면 `AGENT_PLATFORM_ROOT=/절대/경로/agent-platform`을 지정합니다. tracked source drift는 중단하며 reset하지 않습니다.
- `context:init`만 최초 executor-local checkpoint를 만듭니다. 이미 있으면 source와 계약을 검사하고 bytes·completed effects·version을 보존합니다. `check:harness`는 읽기 전용입니다. `bun run context:prepare`는 최신 checkpoint hash가 반영된 전체 request JSON을 stdout으로 출력하고 오래된 request 파일을 재사용하지 않습니다.
- `pinned-snapshot` 모드는 원격에서 고정 blob으로 materialize한 검증 환경용이며, full Git clone이나 전체 native-provider 검증을 의미하지 않습니다.
- WSL2 Codex와 `hermes-agent-2q3y`에서 동일 명령을 사용할 수 있도록 작성했지만 이 두 환경에서의 실제 실행은 미검증입니다.

## 범위와 현황

월말평가 연구를 이어갈 때는 `context/monthly-assessment-20261016/README.md`에서 시작해 requirements/history/chronology/coverage를 확인합니다. 이식성 개선은 병합된 맥락·원문과 기존 question-selection 경계를 유지합니다.

- 151개 세분유형: 초3 핵심 105(곱셈 38, 나눗셈 36, 원 31) + 초4–6 연결 46
- 기존 예제 170(대표 151 + 변형 19), 미시행동 1,216 보존
- 능력 후보: 수학 구조 22 + 횡단 관찰 차원 6; 105유형과의 대응은 연구자 과제 분석입니다.
- `source/archive/`는 Library 입력 109파일을 바이트 그대로 보존합니다. 그 안의 과거 `final-validated` 같은 표현은 당시 특정 검증 기록이며 현재의 전면 완료 상태가 아닙니다.
- 출판사 유료/저작 PDF와 실제 학생 개인정보는 포함하지 않았습니다.

## 검증 상태를 구분합니다

통과: 원문 해시·구조·산술식 재계산, TypeScript, production build, 151설계/1,216행동 DOM 회귀, HTTP smoke, canonical Artifact/WorkContext 계약 검증. 최신 상세 결과는 `verification/current.json`을 확인하세요.

미검증: 전체 151예제의 수학·교수학 전면 감사, 실제 학습효과, WSL2/VPS 실행, 최신 구현에 대한 사용자 최종 수락. 실제 브라우저는 현재 cloud executor의 Chromium socket 제한 및 지원 클라우드 브라우저의 localhost 연결 실패로 검증하지 못했습니다. DOM 통과를 브라우저 통과로 표시하지 않습니다.

알려진 문제: `HC11-d1-T02`의 정확한 세 점 조건에서는 L이 유일한 원의 중심입니다. 이를 확정하는 학생을 과도한 일반화로 다루는 설명이 있어 화면에 검토 경고를 표시합니다. 원문은 변경하지 않았고 `docs/review/correction-proposals.v1.json`에 29필드 교정안을 별도 제안했습니다. 교정안 적용·수락은 아직 이루어지지 않았습니다.

## 디렉터리

| 경로 | 역할 |
|---|---|
| `src/` | 호스트 의존성을 제거한 연구 앱 |
| `source/archive/` | 원래 109파일, 역사적 wrapper·스크립트·검증 포함, 수정 금지 |
| `source/capability-research/` | 105유형 능력후보 연구 원문 3파일 |
| `source/user-intent/` | 실제 사용자 메시지 원문과 고정 provenance pins |
| `research/` | 도메인 구조 검사 및 51 revision/95 edge semantic identity 파일럿 |
| `context/user-context/` | 선별한 대화 64메시지·Space 13블록과 typed 52개 맥락 기록 |
| `harness/` | module-owned 작업 ID·상태·고정 공통 source pin |
| `docs/review/` | 독립 구조·산술 점검과 versioned 교정 제안 |
| `verification/` | 이번 실행에서 관찰한 증거·한계 |
| `.local/` | git 제외 executor-local checkpoint/테스트 출력 |

원문의 하드코딩 경로는 역사 보존을 위해 archive에만 남깁니다. 실행 코드·현재 테스트는 repo 상대경로입니다. 원래 생성 스크립트를 무심코 재실행하면 후속 수정을 잃을 수 있으므로 archive의 `build_*`는 기본 명령에 포함하지 않습니다.

## 추가 검사

```sh
python3 -m venv .local/validation-venv
.local/validation-venv/bin/pip install -r requirements-validation.txt
.local/validation-venv/bin/python scripts/check-json-schemas.py
python3 docs/review/independent_audit.py
bun run test:server
# Chromium이 지원되는 환경에서만:
bunx playwright install chromium
bun run test:browser
```

폰트는 SIL OFL이며 원 라이선스를 `source/archive/fonts/OFL.txt`와 CSS에 보존했습니다. 이 모듈의 비공개 보존은 제3자 문헌·폰트의 재라이선스를 뜻하지 않습니다.

## CI 검증

[소스 CI와 독립 검토 경계](docs/CI.ko.md)를 확인하세요. `bun run verify`는 CI 계약 검사까지 포함합니다. Hosted gate는 고정 canonical dependency 접근과 exact-head 독립 native review가 없으면 통과하지 않습니다.

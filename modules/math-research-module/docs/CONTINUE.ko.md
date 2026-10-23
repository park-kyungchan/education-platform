# 새 환경에서 이어가기

이 문서와 `harness/current-handoff.json`을 먼저 읽고, 아래 경로를 그대로 사용합니다. 개발 환경마다 공통 계약이나 ID 체계를 다시 설계할 필요는 없습니다.

## 현재 코드와 과거 작업 구분

`harness/current-handoff.json`은 마지막으로 직접 관찰한 main 게시 커밋과 기존 Domain/Project/Work/Task/Run 연결을 기록합니다. 커밋 링크와 관측 시각이 있는 게시 사실만 갱신한 색인입니다. 이전 Task/Run/Verification에 남은 “게시 대기”는 해당 과거 검증 시점의 기록입니다. 게시를 다시 실행하지 마세요. 최신 main 여부는 작업 시작 시 Git으로 확인합니다.

- Project와 Domain은 이 모듈의 지속적인 정체성입니다.
- 현재 기록의 Work/Task/Run은 2026-10-13 구현 시도의 ID입니다. 새 작업에서 완료된 Run ID를 재사용하지 않습니다.
- 같은 Work를 다른 실행 환경에서 계속한다면 기존 owner의 현재 checkpoint와 완료·불확실 효과를 먼저 읽습니다. clone에 native 상태가 자동 이관된다고 가정하지 않습니다.
- 새 목표라면 구현 전에 새 Work ID와 그 Work의 Task/Run을 owner의 지원 방식으로 선택·기록합니다. 로컬 이름은 project 범위에서 충돌 여부를 확인합니다. Work는 별도 projectId/workId 계약이며 Artifact kind를 추가하지 않습니다.
- 로컬 계약 검사는 중앙 ID 발급·전역 등록·native 세션 등록이 아닙니다. 공통 구현과 Upper Ontology를 복제하거나 재정의하지 않습니다.

## 처음 clone한 환경

필요: Bun 1.4.2 이상, Node 24 이상, Git, 이미 승인된 private GitHub 읽기 접근. 토큰을 파일·명령에 넣거나 새 접근 권한을 자동 생성하지 않습니다.

```sh
bun run bootstrap
bun run dev
```

bootstrap은 frozen dependency 설치 → 고정 agent-platform checkout 준비 → verify를 실행합니다. 최초 네트워크 의존성 준비에는 기존 Git 인증과 package registry 접근이 필요합니다. source drift나 기존 다른 HEAD는 자동 reset하지 않고 멈춥니다. 인증이 없는 경우 supported secure login으로 접근을 준비한 뒤 같은 명령을 다시 실행합니다.

## 이미 설치된 환경에서 pull한 뒤

```sh
git pull --ff-only
bun run bootstrap
```

다른 branch/commit 또는 수정 중인 파일이 있으면 먼저 사람이 의도한 작업 기준을 확인합니다. bootstrap은 모듈 파일을 reset하거나 기존 checkpoint를 초기화하지 않습니다. dependency pin이 바뀌면 이전 dependency checkout을 자동 바꾸지 않습니다. 새 경로에 검토된 pin을 준비하고 AGENT_PLATFORM_ROOT로 선택합니다.

## 준비된 dependency 또는 source snapshot

Git checkout은 AGENT_PLATFORM_ROOT로 선택하고 bootstrap을 실행합니다. 고정 blob으로 별도 준비한 source snapshot은 clone 검증을 대신하지 않으므로 다음 읽기 전용 검증 경로만 사용합니다.

```sh
export AGENT_PLATFORM_ROOT=/absolute/path/to/verified/agent-platform
export AGENT_PLATFORM_SOURCE_MODE=pinned-snapshot
bun install --frozen-lockfile --ignore-scripts
bun run verify
bun run dev
```

source snapshot 자체는 이 저장소에 복사하지 않습니다. Git이 없는 snapshot에서 setup:harness를 실행하면 의도적으로 거절합니다.

Hosted CI의 `compiled-canonical-ci-projection` 모드는 검토된 생성 API와 test fixture만 사용합니다. `harness/agent-platform.lock.json`의 ffba pin 및 Ontology 0.2.0 원본 bytes를 보존하며 이 mode는 physical checkout/native-provider 설치로 기록하지 않습니다. 검토된 생성물, 생성기와 frozen 외부 의존성을 `bun ci/verify-projection.ts`로 확인합니다. `docs/CI.ko.md`에 별도 review API pin과 실제 native 독립 검토 gate를 설명합니다.

## 맥락을 읽고 다음 목표 정하기

월말평가 관련 작업은 먼저 `context/monthly-assessment-20261016/README.md`, `requirements.json`, `history.json`, `chronology.json`, `coverage.json`을 읽습니다. 이 추가 맥락은 PR3으로 main에 병합되었으며 이번 onboarding 변경은 그 원문·해시를 수정하지 않습니다. 24문항·100점·80분의 확인된 요구와 9/9/6 배분 제안, 실제 문항 선택, 부분 수락 및 미확인 이력을 구분합니다. 출제 마감과 시행일도 구분하고 이식성 검사로 문항 선택·학생 운영·교육적 타당성 승인을 만들지 않습니다.

`bun run context:prepare`는 기존 `.local/work-context/checkpoint.json`이 있으면 현재 bytes와 hash를 읽고 보존합니다. 없으면 아직 저장되지 않은 projection의 request를 출력하므로 실제 사용 전에 `bun run context:init`으로 최초 생성합니다. 초기화는 이미 존재하는 checkpoint를 덮지 않습니다. 다른 root에서 복사된 상태, source drift나 변조된 사용자 원문은 실패하며 자동 재핀하지 않습니다. 기존 상태의 과거 게시 대기는 검사 과정에서 고치지 않고 dated handoff의 게시 사실과 대조해 owner가 판단합니다.

연구객체 ID·revision·typed edge와 legacy crosswalk는 `research/identity-pilot/README.ko.md`를 따릅니다. 51 revisions / 95 edges의 파일럿 범위이며 연구 원문 전체가 새 identity로 완전 이관되었다는 뜻이 아닙니다. Work ID와 연구 객체 ID를 동일화하지 않습니다. 알려진 교정안·남은 수학/교수학 감사는 `docs/next-work.md`, 선별한 원문 맥락은 `context/user-context/README.md`를 봅니다.

기본 작업 단위의 의미와 완료 효과는 native owner가 계속 소유합니다. 여기서 출력한 JSON은 실행 권한이나 자동 재개 명령이 아닙니다. 안전한 외부 행동의 승인 범위도 별도로 확인해야 합니다.

## 검증과 실행 범위

verify는 dated handoff와 ID 연결, 원문 무손실, TypeScript, 연구 구조, secret 휴리스틱, 단위/DOM/HTTP/build, 연구 identity, 사용자 맥락, pinned canonical 검사, 맥락 preparation을 실행합니다. 실제 브라우저 검사는 별도 `bun run test:browser`이며 DOM 통과로 대체하지 않습니다. dev는 Bun 연구 앱을 localhost:4173에서 실행합니다. 실제 학생 DB나 학습효과 검증은 포함하지 않습니다.

통과는 이 모듈의 검증 범위에만 적용됩니다. WSL/VPS 실실행, native 등록·수락, 실제 사용자 최종 수락은 직접 관찰하기 전까지 미검증입니다. localhost는 실행한 환경의 주소이며, 이 명령은 public bind·방화벽·인증·배포를 구성하지 않습니다.

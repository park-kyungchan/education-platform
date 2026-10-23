# 공통 하네스 소비 계약

Academy Workbench는 `agent-platform`의 공통 구현을 **외부 고정 소스 의존성**으로 소비합니다. 이 저장소의 `scripts/agent-platform.ts`는 경로 선택, 해시 확인, import만 수행하는 연결 코드입니다. Artifact와 WorkContext의 스키마·검증 구현을 복제하거나 새 중앙 정책을 만들지 않습니다.

## 먼저 읽기

1. `project.json`: 공통 Artifact 형식의 Project
2. `harness/module.json` / `module.schema.json` / `contracts.ts`: 학원 모듈에만 적용되는 엄격한 소비 계약
3. `harness/work/identity.json`, `task.json`, `run.json`: 이번 변경 작업의 ID 및 진행 상태
4. `migration/current-status.json`: 기존 운영 게이트. 이 하네스 적용으로 완료되지 않음
5. `context/user-context/README.md`: 선택 원문과 successor 맥락, partial coverage 및 해시
6. [환경별 설치·검사](bootstrap.ko.md)와 [다음 개선 작업](next-improvements.ko.md)

Canonical pin: `park-kyungchan/agent-platform@ffba2462a08b9f8c83c6f87b1043403e5cb748d7`. `harness/agent-platform.lock.json`은 선택 validator import closure, 관련 metadata 및 immutable Ontology 0.2.0 release의 파일 해시를 고정합니다. 설치된 Ontology package도 실제 해석된 위치에서 같은 해시인지 검사합니다. 전체 native provider closure, 계정 인증, source provenance의 진실성이나 실행 권한을 증명하지는 않습니다.

## ID와 등록 범위

- domainId: `academy-operations`
- projectId: `academy-workbench`
- Project Artifact: `academy-workbench:project:manifest`
- Work: `harness-consumer-upgrade-20261013`
- Task: `academy-workbench:task:harness-consumer-upgrade-20261013`
- Run: `academy-workbench:run:harness-consumer-upgrade-20261013-01`

Project/Task/Run은 canonical Artifact validator로 검증합니다. Work는 별도 `projectId/workId` 쌍을 사용하는 canonical WorkContext 계약을 따릅니다. 공통 Artifact에 Work kind를 추가하지 않습니다. 이 값은 저장소 로컬에서 기록한 ID이며 중앙 발급·예약·전역 등록·native Work 선택을 완료했다는 뜻이 아닙니다. suffix 발급 중앙 규칙은 확인되지 않았으므로 날짜를 포함한 로컬 이름 규약을 사용했습니다. 연구 객체 ID, 학생·응시·인쇄물의 도메인 정체성은 Task/Run과 독립입니다.

## 맥락과 효과

- intent: 목적과 범위. 공통 Artifact의 새 kind로 만들지 않고 명시적인 도메인 맥락으로 보관합니다.
- decision: 실제 사용자 원문·출처·범위가 있는 결정. 기존 `context/business-decisions.json`은 일반화된 인수인계 요약이므로 `actual-user-answer`나 현재 실행 승인으로 승격하지 않습니다.
- proposal: 채택 전 제안. 승인이나 권한이 아닙니다.
- evidence: 어떤 입력·시각·방법으로 무엇을 관찰했는지와 실패·한계.
- verification: 선언한 대상과 기준에 대한 pass/fail/unverified. 실행 성공과 사용자 수락을 대신하지 않습니다.
- acceptance: 별도 사용자/도메인 수락 결정. 현재 모듈은 `not-observed`이고 테스트에서 추론하지 않습니다.

완료 효과에는 pinned evidence와 `replay=do-not-repeat`를 요구합니다. pending은 미완료 작업, uncertainEffects는 결과가 불명확해 관찰이 먼저 필요한 효과, uninterpretedInputs는 아직 해석되지 않은 원문입니다. 불확실한 효과를 바로 재시도 큐에 넣거나 completed를 pending으로 되돌리지 않습니다. `completed.verificationRefs`라는 필드명만으로 실제 Verification의 전 기준 pass를 보장하지 않으므로 근거를 직접 검토해야 합니다.

The current `context:inspect` behavior is specified in [continuation-ci.md](continuation-ci.md). It reports observed Git/source identity and reads a known owned checkpoint through the pinned canonical validators without saving or overwriting it. The original consumer projection, including publication-pending, is retained under `historical` and never becomes a current completion claim. Fresh checkpoint construction still refuses an existing checkpoint. A fresh invocation UUID is a local check occurrence, not a native Run or authenticated authorship.

## 소유권과 모듈 관계

- 공통 구현 owner: agent-platform. Upper Ontology의 의미 owner: ontology-foundation
- 학원 의미·데이터·과거 기록: Academy Workbench와 기존 원천 owner
- loop/session/dispatch/retry/tool/profile/credential: 선택한 native Codex 또는 Hermes
- `math-research-module`: 연구 맥락을 참조할 수 있는 별도 모듈. 이 관계 선언은 데이터 공유·실제 학생 해석·자동 객체 매핑을 승인하지 않습니다.

기본 profile은 합성·오프라인 개발입니다. live student read, 학원 수정, print, send, credential setup, deployment 및 native 등록은 모두 비활성입니다. 경로나 JSON·schema·hash가 존재한다는 이유로 이 경계를 열 수 없습니다.

## 보존과 검증 한계

기존 `archives/`, `private/`, 역사적 reference, standalone release 파일과 7개 운영 게이트를 수정하지 않습니다. 이번 구현은 실제 학생 본문·secret·아카이브 내용의 읽기나 재검증을 하지 않았습니다. `harness/preservation-baseline.json`은 선택한 비민감 파일의 bytes와 기존 Git tree metadata 보존 기준입니다. 전체 원문 복원·전체 대화 이관·실자료 projection 완료를 주장하지 않습니다.

기존 Node 24 읽기 전용 런타임은 공통 하네스를 실행 의존성으로 갖지 않습니다. ChatGPT, dot, Sites, 사용자 PC 또는 특정 VPS가 없어도 기존 합성 앱은 실행됩니다. 새 하네스 검사는 Bun을 사용하는 개발 단계이며 기본 서버에 외부 네트워크나 플랫폼 로그인 의존성을 넣지 않습니다.

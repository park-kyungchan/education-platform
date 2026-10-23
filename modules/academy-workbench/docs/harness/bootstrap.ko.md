# WSL2 Codex CLI / VPS Hermes 독립 설치

이 명령은 두 환경 중 사용자가 선택한 곳의 새 작업 폴더에서 실행합니다. WSL2에 있는 파일이 VPS에 자동으로 존재하지 않습니다. 이 변경을 작성하면서 실제 사용자 WSL2나 `hermes-agent-2q3y`에서 명령을 실행하지 않았습니다.

## 전제조건

- Git, PATH에 있는 Bun 1.3.14 이상(개발 검증 1.4.2), 합성 앱용 Node 24 이상
- 이미 승인된 방법으로 두 private 저장소를 읽을 수 있는 GitHub 접근
- native Codex/Hermes의 기존 설치·권한은 각자 별도. 이 절차는 전역 설정, 도구 권한, 자격증명, 로그인/세션 또는 persistent access를 변경하지 않습니다.

토큰·비밀번호를 명령, `.env`, Git 또는 manifest에 넣지 마세요. Git 인증이 없으면 supported secure login을 사용자에게 요청하고 멈춥니다. 새 토큰을 자동 발급하거나 credential helper를 구성하지 않습니다.

## 새 clone에서

```sh
git clone https://github.com/park-kyungchan/academy-workbench.git
cd academy-workbench
# 작업할 승인된 branch/commit을 선택한 다음:
bun install --frozen-lockfile --ignore-scripts
bun run setup:harness --fetch
bun run check
bun run test
bun run test:synthetic-runtime
bun run test:offline-adapter
```

`setup:harness --fetch`는 dependency 폴더가 없을 때만 고정 공식 repo를 `.harness-deps/agent-platform`에 clone하고 pin commit을 detached checkout합니다. 기존 경로가 있으면 원격 갱신/reset/checkout을 하지 않고 정확한 HEAD와 tracked 변경 여부를 먼저 검사합니다. canonical root에서 `bun install --frozen-lockfile --ignore-scripts`로 그 repo의 의존성을 설치합니다. 사용자 수정·third-state bytes를 자동 덮어쓰지 않습니다. source mismatch는 검토 후 별도 새 checkout으로 해결합니다.

최초 install은 package registry 및 두 private repository 읽기 접근이 필요합니다. 기존 기본 GitHub Actions token이 다른 private repo에 접근할 수 있다고 가정하지 않았고, CI용 secret이나 권한 설정은 추가하지 않았습니다. 이미 승인된 CI 환경이 있다면 같은 명령을 재사용하세요.

## 기존 고정 checkout 또는 오프라인 캐시

```sh
export AGENT_PLATFORM_ROOT=/absolute/path/to/reviewed/agent-platform
bun run setup:harness
bun run check
bun run test
```

이 경로는 현재 환경의 경로여야 합니다. credential·native Work store 경로가 아닙니다. 같은 pinned commit과 설치된 package cache가 필요하고, 패키지가 빠져 있으면 오프라인 setup이 성공한다고 약속할 수 없습니다. setup은 실패를 숨기거나 lock을 재작성하지 않습니다.

Git 없는 **명시적으로 준비한 source snapshot**을 검증하는 경우에만:

```sh
export AGENT_PLATFORM_ROOT=/absolute/path/to/verified/source-snapshot
export AGENT_PLATFORM_SOURCE_MODE=pinned-snapshot
bun run check
bun run test
```

snapshot에는 lock의 모든 source 파일과 검증 가능한 immutable Ontology package 및 잠긴 third-party dependencies가 있어야 합니다. snapshot 모드는 clone/HEAD 검증을 대신 주장하지 않습니다. `setup:harness`는 snapshot을 재구성하거나 변경하지 않고 거절합니다. source 파일을 소비 저장소에 복제해 별도 관리하는 방식으로 사용하지 않습니다. pin을 올리려면 upstream 변경을 검토하고 후속 pin·타입·테스트 근거를 별도 변경으로 제출합니다.

## 합성 앱

```sh
cd app/standalone
node src/server/main.ts
```

같은 환경에서 `http://127.0.0.1:8787/`을 여세요. VPS의 loopback은 사용자 PC loopback과 다릅니다. 임의 public bind, 인증 변경, 포트 공개, 방화벽 변경, 배포를 이 작업의 후속 조치로 수행하지 않습니다. 앱은 이미 commit된 assets와 Node built-ins를 사용하므로 하네스 dependency와 독립입니다.

## 검증 수준

- 이 변경에서 실행: dot cloud에서 고정 source snapshot의 canonical validators, consumer TypeScript, 새 synthetic negative tests, 기존 합성 runtime 및 offline adapter tests
- 이 변경에서 실행하지 않음: 실제 WSL2/VPS fresh clone 설치, 해당 native CLI/agent 통합, 원문 archive 내용 재검사, 실자료 운영, 운영 인증, 외부 배포, 실제 print/send
- 설치형 운영 수락, 하네스 채택 수락, 실제 학원 업무 완료는 테스트 pass와 별개입니다.

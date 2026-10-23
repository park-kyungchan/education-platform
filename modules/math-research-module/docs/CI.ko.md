# 소스 검증 CI

`.github/workflows/source.yml`은 PR의 정확한 head 또는 main push SHA에서 소스 검사, 고정 canonical 계약, 독립 native review를 별도 검사하고 모두 success일 때만 source gate를 통과시킵니다.

- source job: frozen dependency 설치, 원문 보존·타입·연구 구조·비밀정보 휴리스틱·단위·DOM·HTTP·build 검사
- contracts job: 고정 ffba canonical API의 검토된 생성 bundle로 전체 verify를 실행합니다. 17개 원래 source pin과 immutable Ontology 0.2.0의 38개 파일을 그대로 검증해 생성하며, 기존 물리 source import-shadow 검사는 같은 생성기의 55개 입력 test fixture를 독점 임시 디렉터리에 materialize해 실행합니다.
- native-review job: 별도 `harness/common-ci-provider.json`의 canonical owner-scoped API 생성 bundle을 실행합니다. Math의 고정 repository/project/domain/semantic-owner 정책으로 exact-head 상태 발행자, 전체 reviewed tree, 실제 native reviewer 원문 및 별도 불변 Evidence/Verification을 검증합니다. 기존 ffba Artifact/Work pin과 legacy/common v2 review 의미는 유지됩니다.

Hosted CI는 private cross-repository checkout 없이 검토된 self-contained 생성물을 읽습니다. 하나의 `ci/generate-projection.ts`가 불변 Git 입력, 0.2.0 bytes, 도달한 compiler graph와 실제 frozen AJV 외부 의존성을 고정합니다. 재생성에는 정확한 원래 source와 Bun 1.4.3 compiler가 필요합니다. runtime 검사는 생성물·생성기·외부 package bytes 및 import shadow를 확인합니다. 이 과정은 실제 clone/native-provider 설치 증거를 만들지 않습니다.

신뢰할 수 있는 publisher가 실제 native 독립 검토 뒤 게시한 exact-head receipt/status가 없으면 review gate는 계속 실패합니다. 실제 reviewer 원문 R0 → normalized result/Evidence/Verification E → receipt R1의 불변 참조를 canonical API가 확인합니다. 로컬 synthetic 통과로 실제 native review PASS를 발급하지 않습니다. token·secret·repository/native trust 설정은 변경하지 않습니다.

2026-10-14 CI Work/Task/Run은 `harness/ci`에 보존합니다. 이번 후속 source 작업은 `harness/ci/successor-20261017`에 따로 기록합니다. 기존 `harness/records.json`, work-context와 완료·불확실 효과는 그대로 유지하고 반복 검증은 새 execution ID로 관찰합니다. 월말평가 PR3의 requirements/history/chronology/coverage와 curated originals도 수정하지 않습니다.

로컬 전체 검사: bun run verify. 통과는 hosted CI, native runtime 실행, 수학·교수학 전수 감사, 실제 학습효과 또는 사용자 수락의 증거가 아닙니다. Branch protection 설정은 별도이며 workflow 추가만으로 강제되지 않습니다.

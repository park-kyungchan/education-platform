# 수학교육 장기 객체 ID 규약 파일럿

이 패키지는 math-research-module이 의미를 소유하는 연구 객체 규약이다. 공통 하네스의 ID·스키마·권한·실행 정책을 대체하거나 확장하지 않는다. 공통 소스는 수정하지 않았다.

## 구현 결과와 한계

- DATA/LOGIC/ACTION/GOVERNANCE 4개 계층에 23개 세부 타입을 정의했다.
- 장기 객체 ID는 `mred:<UUIDv4>`이며 계층·학년·교재·표시 경로·세션·Work를 포함하지 않는다.
- 합성 곱셈 24×3, 나눗셈, 원 사례 3개에 객체 revision 51개와 typed edge 95개를 제공한다.
- 원 연구의 HM11-d3-T02, HD11-d1-T01, HC11-d1-T01을 source hash 및 JSON Pointer와 함께 보존한다. 새 문항은 해당 설계의 축약·변형이며 원문과 동일한 문항이라고 하지 않는다.
- 실제 학습자 진단 0건. 기존 105유형 전체의 능력 진단·인지구인 타당화·학습효과 검증을 완료했다는 주장이 아니다.
- 이 파일럿은 중앙 registry 등록, 실제 사용자 수락, native permission, 외부 실행을 만들지 않는다.
- 작업 맥락 연결은 createdBy/uses만 102개다. verifiedBy와 acceptedBy는 각각 대상별 검증·별도 수락 admission이 없어 0건이며 validator가 거절한다.

## 파일과 실행

- `src/model.ts`: 소유권, entity/revision, 관계별 domain/range, crosswalk 타입
- `src/identity.ts`: UUID 발급·중복 충돌 확인, deterministic JSON hash, revision 생성
- `src/schema.ts`: 구조 schema 원천 및 이 schema만 지원하는 제한된 구조 검사기
- `schemas/research-bundle.schema.json`: 위 원천에서 생성한 Draft 2020-12 schema
- `src/validation.ts`: closed-set 참조·typed graph·불변 revision·presentation·권한 분리 검사
- `src/source-checks.ts`: 실제 원문 bytes/hash/Artifact ID·kind/Work 쌍/원문 locator 대조
- `samples/research-bundle.json`: 앱에서 읽을 정적 JSON. 브라우저에서 Node crypto 모듈을 import하지 않는다.
- `samples/legacy-crosswalk.json`: 원 연구 ID 및 locator를 유지하는 adaptedFrom 연결
- `samples/fixture-index.json`: 합성 사례별 주요 객체 lookup
- `docs/design.ko.md`: 의미·버전·관계·수락 경계 설계
- `tests/pilot.test.ts`: positive/negative 테스트

Node 24 이상에서 `npm run check`를 실행한다. 런타임 npm 의존성은 없다. 독립 표준 JSON Schema 검사는 Python `jsonschema`를 사용하며 검증 환경은 4.26.0이다. `npm test`는 Node만 있으면 실행된다. TypeScript 정적 검사는 TypeScript 및 `@types/node`가 있는 소비자 환경에서 `tsc -p tsconfig.json`으로 실행한다.

샘플을 재생성하려면 `npm run build:samples`를 실행한다. 기본 입력은 형제 `math-research-module` 폴더이며 `MATH_MODULE_ROOT`와 `MATH_HARNESS_RECORDS`로 위치를 지정할 수 있다. 스크립트는 이 패키지 밖의 자료를 읽기만 한다. 형제 폴더 배치와 소유 module 내부로 중첩한 배치를 모두 탐지한다. 파일을 옮긴 뒤에는 build:samples를 다시 실행하면 실제 배치에 맞는 상대 sourcePath로 재생성한다. 다른 디렉터리 배치는 MATH_MODULE_ROOT로 명시한다.

공통 Artifact의 authoritative validation은 math-research-module의 기존 `check:harness`가 실제 pinned 공통 소스를 로드하여 수행한다. 이 패키지는 그 검증기를 복제하지 않는다. `verifySourcePins`는 bytes와 참조의 일치를 확인하며 공통 스키마 검증이나 실제 권한 인증을 대신하지 않는다.

## 앱 통합

정적 화면은 `samples/research-bundle.json`과 `samples/legacy-crosswalk.json`을 읽으면 된다. 핵심 필드는 `revisions[].id/type/layer/classification/core`, `edges`, `presentations`, `crosswalk`다. UI 표시 문구는 presentation에서 선택하되 `core.statement`, `epistemicStatus`, evidence refs, limitations는 반드시 그대로 표시한다.

`renderPresentation`은 허용된 톤별 안내 제목만 바꾸고 semantic core는 그대로 반환한다. 자유 생성된 교사 문장이 새 의미를 덧붙였는지 자동으로 증명하는 기능은 없다. 자유로운 재서술을 도입할 때는 별도 검토·버전 정책이 필요하다.

공통 하네스 기록이 갱신되면 bytes/hash가 달라진다. 최신 records를 재관찰하고 샘플 crosswalk를 재생성한 뒤 `npm run check`를 다시 실행한다. 과거 발급 기록은 하네스의 immutable history에 남으며 연구 객체 ID는 바뀌지 않는다.

# 설계: 작업의 정체성과 연구 객체의 정체성

## 1. 확인한 공통 계약과 이번 소유 범위

공통 저장소 park-kyungchan/agent-platform의 고정 commit ffba2462a08b9f8c83c6f87b1043403e5cb748d7에서 다음 원문을 읽었다.

- AGENTS.md와 project.json
- architecture/capability-source-owners.json
- packages/ontology/AGENTS.md
- packages/ontology/schemas/artifact.schema.json
- packages/ontology/schemas/operational.schema.json
- packages/work-continuity/src/context/types.ts
- 이번 조사 보고서 harness-research-report.ko.md

공통 Artifact는 `projectId:kind:suffix`이며 kind는 project/task/proposal/decision/evidence/verification/run이다. Work는 별도 context의 projectId/workId 쌍이다. Domain→Project→Work→Task→Run의 중앙 전체 5계층 강제나 전역 ID 예약 서비스는 확인하지 않았다. Upper Ontology semantic owner와 module semantic owner를 합치지 않는다.

새 연구 ID 정책의 semantic owner는 math-research-module이며 registryScope는 module-local-pilot이다. 기존 공통 Artifact ID 발급 절차와 native 실행/인증/permission은 그대로 둔다.

## 2. ID, 의미, 분류, 버전, presentation

`mred:<UUIDv4>`는 장기 identity이다. UUID는 의미를 넣지 않으며 표시 경로·학년·교재·Work·type으로부터 파생하지 않는다. 충돌은 module-local 저장 집합에서 확인하며 최대 32회 후 실패한다. 실제 여러 프로세스가 동시에 발급하려면 저장소의 unique constraint와 원자적 reservation이 추가로 필요하다. 현재 메모리 Set은 전역 uniqueness 증명이나 분산 lock이 아니다.

- identity: id
- revision identity: (id, version). version은 1부터 연속 증가
- semantic core: statement, epistemic status, evidence/source/target/probe refs, limitations, synthetic, bounded details
- semanticCoreHash: 정규화 JSON core의 SHA-256. 내용 동일성 검사이며 객체 ID를 대신하지 않는다.
- classification: label, semanticPath. 계층 재분류와 이름 변경은 새 revision으로 기록하되 같은 id 유지
- type/layer: 별도 분류 필드. type의 layer 대응과 core 계약을 검증한다.
- revisionHash: 위 불변 revision 본문 전체의 SHA-256
- presentation: 별도 표시 record. 정확한 subject revision과 semanticCoreHash에 pin한다.

이 파일럿의 JSON 정규화는 key sort/finite JSON 기반의 module 계약이며 RFC 8785 준수 주장은 하지 않는다. 다른 언어 구현은 동일 테스트 벡터로 검증해야 한다.

같은 revision을 고쳐 새 hash만 쓰는 행위는 이전 bundle 비교에서 거절한다. 과거 revision과 그 revision을 참조하는 edge는 append-only다. 계층을 바꾸려면 새 revision 및 새 endpoint edge를 추가한다. 서로 다른 의미의 개념을 병합하거나 분리하는 경우 새 identity와 별도 검토가 필요하며 자동 재사용하지 않는다. 기존 id를 교체하는 마이그레이션은 제공하지 않는다.

## 3. 네 계층 내부 타입

DATA:
- concept_family: 분류 상위 항목
- atomic_concept: 이번 분석에서 최소 개념 단위로 정한 객체
- contextual_unit: 개념·표상·조건이 결합된 단위
- source_document, item, observation: 출처·문항·관찰을 구분

LOGIC:
- reasoning_family: 추론 분류
- evidence_claim: 실제 또는 합성 관찰에 의해 제한된 주장. observation refs와 한계 필수
- capability_hypothesis: 능력 작동에 관한 검증 가능한 가설
- strategy_hypothesis: 행동 경로·전략에 관한 가설. 능력 자체와 구분
- diagnostic_rule: 다음 관찰·probe 선택 규칙. 확정 진단이 아님

ACTION:
- action_family: 행동 분류
- action_definition / probe_definition: 재사용할 수 있는 행동·탐색 과제 정의
- action_event: 한 번의 일반 실행
- teacher_action / system_action: 한 번의 실행을 행위자별로 구분. timestamp/source/actorRole 및 별도 정의에 대한 instance_of 필수

GOVERNANCE:
- governance_family: governance 분류
- source_claim: 출처가 주장하는 내용과 attribution/qualification
- provenance_record: 출처 이력
- review_record: 검토 이력
- acceptance_record: 별도 수락 관찰을 위한 연구 record. 현재 파일럿은 pending만 허용
- authorization_policy: 정책 정의. nativePermissionGranted=false를 명시하고 실제 권한을 부여하지 않음

최소 개념 단위의 선택과 능력 taxonomy는 module-local 설계 가설이다. 타입 이름과 schema 유효성 자체가 교육학적 실체나 인지구인 타당화를 입증하지 않는다.

## 4. Graph 계약

모든 endpoint는 id만이 아니라 revision까지 pin한다. 끊긴 참조, 중복 edge ID/tuple, self edge는 거절한다.

- is_a: 정의/분류형 객체 → 같은 layer의 family. 관찰·실제 event는 subtype으로 분류하지 않음
- part_of: 객체 → 같은 layer의 family 또는 contextual_unit. strict containment
- prerequisite: atomic_concept/contextual_unit/action_definition/probe_definition/능력·전략 가설 간 선행 관계
- uses: 모든 타입 간 사용 관계. 권한 부여나 참·거짓 판단이 아님
- observes: observation → item/action_event/teacher_action/system_action
- supports: observation/evidence_claim/source_claim → evidence_claim/능력·전략 가설/source_claim
- refutes: supports와 동일 domain/range의 반박 관계
- probes: probe_definition → 능력·전략 가설
- instance_of: 실행 event → action/probe definition
- derived_from: source_claim/provenance_record/evidence_claim → source_document/observation/source_claim

정확한 domain/range 목록은 src/model.ts의 EDGE_RULES가 원천이며 schemas/relation-registry.json으로 내보낸다.

is_a와 part_of는 합쳐서 strict-parent DAG로 검사한다. prerequisite는 별도 DAG로 검사한다. 두 그래프를 무조건 합치거나 전체 graph를 DAG로 강제하지 않는다. uses와 그 밖의 관계는 순환을 허용한다. 실제 샘플의 action_definition↔diagnostic_rule uses는 의도적으로 허용된 순환이다. 역사적 edge는 각 revision의 관계이므로 현재 view를 만들 때는 소비자가 latest revision projection을 명시적으로 선택해야 한다.

## 5. Evidence-first pipeline

세 사례는 모두 가상 관찰이다. source_document → observation → evidence_claim → capability_hypothesis/strategy_hypothesis → probe_definition → refuting observation을 연결한다. 한 번의 정답/발화로 학생의 실제 인지상태, 숙달, 잠재능력을 단정하지 않는다. 원문 source_claim의 이론적 지지는 관찰 자료나 실증 검증과 별개다.

반박 관찰이 생기면 기존 주장/가설을 지우지 않고 새 revision으로 범위·한계를 고친다. hypothesis 상태를 observed/fact로 자동 승격하지 않는다. 하나의 원인으로 확정하거나 진단규칙의 출력과 내재 능력을 동일시하지 않는다.

자유문장 자체에 포함된 과도한 단정을 완전 자동 판별하지는 못한다. 구조 검사는 상태·근거·한계·추가 probe와 알려진 위험 선언을 강제하며, semantic review가 여전히 필요하다.

## 6. 공통 작업 ID와 연구 ID의 typed crosswalk

실제로 발급된 math-research-module/harness/records.json을 읽고 file hash와 ID·kind를 대조한다. 작업 ID는 연구 UUID에서 만들지 않는다.

- createdBy: 연구 revision → 생성 작업 Task/Run
- uses: Task/Run → 연구 revision. JSON 필드는 항상 research/harnessArtifactId이며 방향은 relation으로 해석
- verifiedBy: 연구 revision → 그 revision을 직접 대상으로 검증한 Verification Artifact. 계약만 예약하며 이번 파일럿은 항상 fail-closed로 거절한다. 기존 Task-target Verification은 원 archive integrity·작업 기준을 검사하며 각 research revision/hash 검증을 의미하지 않으므로 연결하지 않는다.
- acceptedBy: 연구 revision → 별도 Decision. 이름과 계약만 예약되어 있고 이번 파일럿 validator는 항상 fail-closed로 거절

verifiedBy는 정확한 대상 revision 및 semanticCoreHash/revisionHash, 검증 기준, 결과와 evidence를 owner-reviewed adapter가 함께 admission하기 전에는 채울 수 없다. 이름이 Verification인 Artifact를 catalog에 보유하거나 Task의 테스트가 통과한 사실만으로 생성하지 않는다. 현재 실제 crosswalk는 createdBy/uses 102개이며 verifiedBy 0개다.

acceptedBy를 로컬 mirror/boolean으로 통과시킬 수 없다. 현재 실제 수락은 없으며 `acceptance` mirror 필드 자체가 schema에 없다. 향후 owner-reviewed adapter가 canonical Decision 및 권한 actor/scope, 실제 사용자 답변/독립 수락 근거의 출처를 관찰하는 절차를 마련하기 전에는 이 관계를 채우지 않는다. 통과한 테스트·성공한 Run·Verification은 수락으로 바뀌지 않는다. 향후 수락이 관찰되더라도 native permission은 별도다.

`verifySourcePins`는 실제 원문 bytes, 정확한 ID/kind, Work 쌍, JSON Pointer를 대조한다. 단순히 hash 문법이 맞는다고 provenance를 신뢰하지 않는다. canonical Artifact/closed-set 계약은 mathmodule의 기존 공통 consumer loader가 검사한다. 두 검사는 역할이 다르다. 서명·사용자 identity 인증·외부 효과 완료를 증명하는 기능은 없다.

## 7. 원 데이터 보존과 배포

legacy ID는 바꾸거나 전역 UUID로 강제 치환하지 않는다. adaptedFrom은 동일 identity라는 뜻이 아니다. 원문 파일과 JSON Pointer/hash가 별도로 남는다. 새 합성 item·관찰·가설만 pilot identity를 받는다. 105유형 전체 migration이나 진단은 수행하지 않았다.

공통 source/provider files와 native stores는 읽기만 했다. module-local 파일만 생성했고 설치·계정·보안 설정·학원 데이터·인쇄·발송을 변경하지 않았다.

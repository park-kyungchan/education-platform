# 월말평가 교육·운영 요구사항 및 변경 이력

수집 기준: 2026-10-16. 확인된 사용자 발언, 과거 assistant 제안, 기존 저장소의 보고를 분리한다. 전체 대화/삭제 버전의 분모는 알 수 없으므로 “모든 이력 복원 완료”를 주장하지 않는다. 학생 개별 개인정보는 포함하지 않는다.

## 핵심 요약
- 초3 10월 평가: 24문항, 3점 12개·5점 8개·6점 4개 = 100점. 전부 주관식/서술형. 기존 학원 서버 라벨 문항을 선별하는 목적이다.
- 출제 마감 2026-10-19(월). 시험 시행일은 미확인. 15:00 시작 80분이므로 16:20 종료는 계산값이며, 이후 18:00까지 채점·학생 간 하브루타 오답 활동이다.
- 단원 배분은 제안 요청이다. 곱셈9·나눗셈9·원6(36·39·25점)은 assistant 제안으로, 확정·실제 문항 선택·시험지 완성을 뜻하지 않는다.
- 초3 곱셈·나눗셈·원이 파일럿 중심이고 초3~6 연결 개념은 연구 확장이다. 고학년 확장 내용을 초3 시험 범위에 자동 포함하지 않는다.

## 월말평가의 실무 목적·출제 규격

### math-exam-context
초3 10월 월말평가 24문항: 3점 12개·5점 8개·6점 4개, 총100점. 전부 주관식/서술형이며 학원 문항 중 선별하려는 맥락이다.
- 유형/근거/상태: intent / explicit_user_message / active
- 출처: Sentinel_6c10c77b7ee48191a65771fbde707150
- 한계: 사용자는 이 시점 단원별 배분 제안만 요청했다.
- 한계: 실제 학원 문항 조회·선별·시험지 변경을 수행했다는 뜻이 아니다.
- 한계: 과거 패키지 not_selected는 당시 보고 상태이며 현재 미선정 또는 선정완료를 단정할 근거가 아니다.

### math-exam-timing
시험은 15:00 시작 80분으로 16:20 종료이며 이후 18:00까지 채점과 학생끼리 하브루타 오답 활동을 진행한다.
- 유형/근거/상태: decision / explicit_user_message / active
- 출처: Sentinel_2aea7acc8ff8819182a0af4fc465c1fe
- 한계: 대화에서 시험 날짜와 명시 시간대는 이 두 메시지에 제시되지 않았다.

### math-exam-deadline
출제 마감은 2026-10-19(월). 원래 10/19(화)라고 쓴 요일 오타를 사용자가 바로잡았다.
- 유형/근거/상태: correction / explicit_user_message / active
- 출처: Sentinel_71577bf027588191a45ed2b98003396a, Sentinel_a29fd32a2b908191af883aa93a8d3b88
- 한계: 화요일 회의의 정확한 날짜를 사용자가 별도로 재확정한 근거는 이 자료에 없다.
- 한계: 출제 마감일과 시험 시행일은 다르며 시험 날짜는 미확인.

### math-distribution-request
세부유형 총수를 확인하고 24문항을 적절히 배분하는 제안을 요구했다.
- 유형/근거/상태: request / explicit_user_message / requested
- 출처: Sentinel_09c825d4bf308191bb95d67a5aa83d7f
- 한계: 제안 요청은 자동 선택·최종 출제 승인과 다르다.

### math-exam-distribution
곱셈9·나눗셈9·원6, 점수36·39·25의 배분안.
- 유형/근거/상태: proposal / assistant_interpretation / proposed
- 출처: Sentinel_b4ea79d108188191a5120482630c279d
- 한계: 사용자가 최종 채택했다고 확인되지 않았다.
- 한계: 배점과 난이도는 같지 않다.
- 한계: 초4~6 연결 개념을 초3 시험 범위에 자동 포함하지 않는다.

## 교육과정·범위·계열성

### math-core-scope
이번 파일럿의 중심은 초3 2학기 2-1 곱셈·2-2 나눗셈·2-3 원이다.
- 유형/근거/상태: decision / explicit_user_message / active
- 출처: Sentinel_2d70aa5091b08191ae0ab6701fbfd8f3

### math-curriculum-version
2022 개정 수학과 교육과정 또는 그 이후 최신 교육과정 근거를 사용한다.
- 유형/근거/상태: decision / explicit_user_message / active
- 출처: Sentinel_374bfcfca4c081919d8d1435e6db4125, Sentinel_f4a77b7dd80c8191b96dbcfc1d380588
- 한계: 자료 작성 연도와 개정 교육과정 적용을 혼동하지 않는다.
- 한계: 이 패키지는 교육과정 최신성이나 모든 내용의 수학적 정확성을 재검증하지 않았다.

### math-connected-scope
확장 연구는 위 세 단원과 연결되는 초3~6 개념만 대상으로 하며 일반 초·중·고 전 범위를 자동 포함하지 않는다.
- 유형/근거/상태: decision / explicit_user_message / active
- 출처: Sentinel_5613555764908191b86e479993dc1ef0

### math-topology-and-visualization
세부 유형 연구 후 수학교육의 위계와 계열성을 유지하는 시각화를 구성한다.
- 유형/근거/상태: decision / explicit_user_message / active
- 출처: Sentinel_9f8d5c62867c81918dd689e613c00bac, Sentinel_8bbdaf519d208191bb4976da2a6df214

## 문항 설계와 근본 능력 연구

### math-typical-example
Freudenthal의 전형적인 예를 원문 연구하고 각 세부 유형의 예제 선정 기준에 적용한다.
- 유형/근거/상태: decision / explicit_user_message / active
- 출처: Sentinel_1f20328b135c819194b15011c7efd6da

### math-complex-examples
연구 목적상 예시는 어렵고 복잡해도 되며 설계 이유를 충분히 설명해야 한다.
- 유형/근거/상태: decision / explicit_user_message / active
- 출처: Sentinel_2e6892f7b1ac81919594b92571b16b09
- 한계: 난도를 높이는 것 자체를 전형성이나 교육적 타당성으로 간주하지 않는다.

### math-micro-actions
실제 풀이를 매우 상세히 분해하고 초3 학습수준에 맞는 학습심리 이론, 세부 행동에서 기대한 이해와 설계 이유를 제시한다.
- 유형/근거/상태: decision / explicit_user_message / active
- 출처: Sentinel_e4fcfb7607d08191b13eee8f7e71855e

### math-typical-example-interpretation
일반 구조를 드러내는 중심 문항에 설계 이유·일반화 관계·전이 질문·경계 사례를 연결한다.
- 유형/근거/상태: proposal / assistant_interpretation / proposed
- 출처: Sentinel_c02f2c139c088191be6e7f2a546296a9
- 한계: Freudenthal 원문 그 자체가 아닌 assistant의 적용 설계안이다.
- 한계: 학습효과 검증 결과가 아니다.

### math-capability-research
초3 중심 105개 세부 유형을 근본 수학 능력 후보에 다대다로 묶으며 후보 수를 임의 제한하지 않는다. 근거 문헌을 먼저 제시한다.
- 유형/근거/상태: decision / explicit_user_message / active
- 출처: Sentinel_828a6d5285a88191814d30b5f51c9f5f, Sentinel_f4637ced191c8191931ed4ee51ac8709

### math-nctm-preference
NCTM의 Developing Essential Understanding of Multiplication and Division 원문을 찾을 수 있으면 근거로 삼되 없으면 기존 문헌으로 진행한다.
- 유형/근거/상태: decision / explicit_user_message / active
- 출처: Sentinel_3e1f640013a881919698a1882a6a3266
- 한계: 요청된 전문을 확보했다는 증거가 아니다.

### math-capability-candidate-model
22개 구조 능력 후보와 6개 횡단 관찰 차원은 문헌과 과제 분석을 조합한 잠정 연구 모델이다.
- 유형/근거/상태: proposal / assistant_interpretation / proposed
- 출처: Sentinel_2ad3d29f28ac819186b5ea2f8ffa5b39, Sentinel_370e0f92093c8191821d33980195c613
- 한계: 28개의 독립·선천적 능력 확정이나 표준 진단검사로 해석하지 않는다.
- 한계: 105유형 대응 완전성은 이 대화 패키지에서 재검증하지 않는다.

### math-backward-tracing
서술형 풀이의 세분 행동 오류에서 더 근본적 능력 후보까지 감사·추적할 수 있게 예제와 학생별 DB 아키텍처를 설계한다.
- 유형/근거/상태: decision / explicit_user_message / active
- 출처: Sentinel_f5e2573509b88191a4bd4c9f0335a550, Sentinel_d4aaf66c6d0c8191a1adaa6ca5d5fe67

### math-no-causal-certainty
DATA는 원자 개념, LOGIC은 경쟁 가능한 사고 가설, ACTION은 관찰 행동으로 두며 동일 행동에서 사고·능력 부족의 인과를 확정하지 않는다.
- 유형/근거/상태: proposal / assistant_interpretation / proposed
- 출처: Sentinel_d8e3dde586948191a5d4bb8c8ff8f192
- 한계: 행동이 계획과 다르거나 관찰되지 않은 경우를 실패·능력부족으로 자동 변환하지 않는다.

## 강사 연구 설명과 표현/의미 경계

### math-human-readable-research
typed 연구 객체와 관계를 강사들이 이해하고 의견을 나눌 수 있는 자연어 연구 문장에 연결한다.
- 유형/근거/상태: decision / explicit_user_message / active
- 출처: Sentinel_fa97dd88407481919becb7e7a427c9aa, Sentinel_d6d8c08f24208191afee73a63589ff96

### math-research-disagreement
강사용 연구 설명에서 에이전트별 추론·판단 불일치를 허용한다.
- 유형/근거/상태: decision / explicit_user_message / active
- 출처: Sentinel_d6d8c08f24208191afee73a63589ff96
- 한계: 서로 다른 해석을 사용자 확정 판단 하나로 합치지 않는다.
- 한계: 출처·관찰 사실과 연구자 해석은 별도다.

### math-tone-previous-interpretation
강사별 말투·용어·깊이·예시 방식 매핑이라는 assistant의 초기 해석.
- 유형/근거/상태: proposal / assistant_interpretation / superseded
- 출처: Sentinel_28cdc289c3348191bd9dbb41c41e1a0c

### math-tone-mapping
강사별 톤앤매너를 매핑하고 관련 피드백 맥락을 저장소에 포함한다.
- 유형/근거/상태: decision / explicit_user_message / active
- 출처: Sentinel_f7bae8a6bffc8191addb617944e9aa72

### math-tone-change-boundary
톤앤매너는 언제든 변경 가능하게 하되 바꿔도 되는 표현과 바뀌면 안 되는 핵심의 경계를 설계한다.
- 유형/근거/상태: decision / explicit_user_message / active
- 출처: Sentinel_011cc2ef7c00819190d62db3bc7e0ada

### math-tone-invariants-proposal
말투·길이·용어 풀이·제시 순서는 표현층으로, 수학 조건·정답·출처·관찰 기준·불확실성은 의미층으로 관리한다. 의미 변경은 연구 리비전이다.
- 유형/근거/상태: proposal / assistant_interpretation / proposed
- 출처: Sentinel_b6e2e33eed7c8191aca1325379c66b87
- 한계: 사용자가 이 구체적 필드 목록 전부를 명시 승인한 것은 아니다.

## 연구 객체와 공통 하네스의 경계

### math-palantir-research
Palantir DATA/LOGIC/ACTION/SECURITY를 연구하여 문항 연구 객체와 관계를 구분하는 근거로 사용한다.
- 유형/근거/상태: decision / explicit_user_message / active
- 출처: Sentinel_493e92916be481919a26f52f15c1ae85

### math-palantir-user-analogy
사용자는 DATA를 atomic concepts, LOGIC을 학생이 세부 ACTION 수행에 앞서 거치는 사고과정으로 보는 대응을 제안했고 연구 결과에 따른 반박·평가를 허용했다.
- 유형/근거/상태: proposal / user_hypothesis / open_to_revision
- 출처: Sentinel_1322b7cb02d8819185ecb4ac7051fc41
- 한계: Palantir 공식 문서의 교육이론 정의가 아니다.

### math-id-boundary
공통 하네스의 작업·실행 ID와 DATA/LOGIC/ACTION/GOVERNANCE 연구 객체 ID는 별도 영역이다. 서로 대체하지 않는다.
- 유형/근거/상태: decision / explicit_user_message / active
- 출처: Sentinel_c27ba16860188191ae566c090fdd5712, Sentinel_25e6e8eacffc819181e611cd26437aa1

### math-object-id-pilot
각 DATA/LOGIC/ACTION/GOVERNANCE 내부 topology·hierarchy·typed 구조와 수학교육 ID 규약을 이번 파일럿에서 만든다.
- 유형/근거/상태: decision / explicit_user_message / active
- 출처: Sentinel_25e6e8eacffc819181e611cd26437aa1
- 한계: 이 맥락 패키지의 local record key는 새로운 중앙 ID 규약이 아니다.

### math-id-model-proposal
정의 객체·실제 관찰 사건·사고 가설·진단 규칙·검토와 승인·표현층을 분리하며 Run과 연구 객체 버전은 다대다로 연결한다.
- 유형/근거/상태: proposal / assistant_interpretation / proposed
- 출처: Sentinel_93e97d95c4b881919e4d358ce0e4a493
- 한계: 공통 Domain→Project→Work→Task→Run을 단일 발급 형식으로 가정할 수 없다. 실제 소스 계약을 우선한다.
- 한계: 이전 설명은 설계 제안이며 canonical 구현 증거가 아니다.

## 독립 저장소·이식성·구현 변경 이력

### math-single-module-repo
수학 파일럿의 문항·모델·감사 추적·강사용 설명·대화맥락·하네스 설정을 하나의 별도 private module 저장소로 묶는다.
- 유형/근거/상태: decision / explicit_user_message / active
- 출처: Sentinel_6e09a83825f081919c532aaf409096ea, Sentinel_579261100d48819198fdb9871b6d8f18
- 한계: academy-workbench까지 같은 저장소에 합친다는 뜻은 아니다.

### module-portable-setup
clone 후 WSL2 Codex CLI와 VPS Hermes에서 의존성·환경별 준비·실행·검증·Git 작업을 이어가기 쉽게 맥락과 설정을 제공한다.
- 유형/근거/상태: decision / explicit_user_message / active
- 출처: Sentinel_9be47a47419c8191aa8e3bb12b255868, Sentinel_08d2a6244600819187ca20a8b1478fb0
- 한계: 환경 간 자격증명·권한·native runtime 설정을 복제하거나 동일하게 취급하지 않는다.
- 한계: 클라우드 검증은 WSL/VPS 실행 성공 증거가 아니다.

### module-cloud-work
현재 이후 작업은 assistant의 클라우드 파일시스템 기반으로 진행한다.
- 유형/근거/상태: decision / explicit_user_message / active
- 출처: Sentinel_fc46ffc302088191964a9039b4b0ebda
- 한계: 운영 권한은 현재 도구 권한과 최신 사용자 지시를 따른다. 역사 기록 자체는 인증·접근 권한을 부여하지 않는다.

### module-harness-first
공통 하네스 실제 규약 확인이 작업 ID 부여에 선행하며 임의 규약 적용을 중단했던 이력을 보존한다.
- 유형/근거/상태: decision / explicit_user_message / active
- 출처: Sentinel_37a84ea80a748191b4975a73e3d130e7

### module-research-hold
리서치까지만 진행하고 구현·업로드를 기다리라는 과거 중단 지시.
- 유형/근거/상태: decision / explicit_user_message / superseded
- 출처: Sentinel_8466119dbe048191ae3d97ce10600618

### module-resume
공통 하네스 적용에 맞춰 academy-workbench와 새 private module을 개선하고 업로드하라는 구현 재개 지시.
- 유형/근거/상태: decision / explicit_user_message / active
- 출처: Sentinel_bee6c1fa21448191a070f10f8a46eac9, Sentinel_e195237d33bc8191b4c43df7dd55ec69
- 한계: 실제 서비스 운영·실자료 활성화·원본 영구 삭제까지 완료 또는 승인된 것으로 자동 승격하지 않는다.
- 한계: 소스 기록은 native 권한을 부여하지 않는다.

### math-pilot-result
이전 assistant는 151유형·1,216 행동 단위 연구 시안과 화면 반영을 보고했다.
- 유형/근거/상태: evidence / assistant_report / reported
- 출처: Sentinel_863b14c144b88191a1e2825f53281ace
- 한계: 본 맥락 수집 작업이 그 151유형·1,216 행동 단위와 화면을 재검증한 것은 아니다.
- 한계: 초3 중심 105유형과 전체 연구 범위 151유형은 서로 다른 모집단이다.

### math-pilot-sufficient
사용자는 당시 파일럿의 설명 깊이·화면을 일단 충분하다고 평가하고 독립 저장소 이동을 요청했다.
- 유형/근거/상태: acceptance / explicit_user_message / accepted_scoped
- 출처: Sentinel_08d2a6244600819187ca20a8b1478fb0, Sentinel_863b14c144b88191a1e2825f53281ace

## 남은 확인 사항

- 실제 시험 시행 날짜 (not_verified)
- 곱셈9·나눗셈9·원6 제안을 최종 채택했는지 (not_verified)
- 학원 서버 원문과 문항라벨의 최종 선택 목록, 교재 판본·범위·난도 검증 (not_verified)
- 부분점수·서술형 채점기준·난도별 시간 모델 (not_verified)
- 시험지를 가지고 참석할 화요일 회의의 정확한 날짜 (not_reconfirmed_after_deadline_correction)
- Freudenthal/NCTM 원문 확보 범위, 105유형 대응 완전성, 잠정 능력 모델의 독립 교육적 검증 (not_revalidated_by_context_collection)
- 삭제된 버전까지 포함한 전체 대화·Space·MagicPath 이력의 완전성 (unknown_denominator)

## 출처 검증 범위
- 요구사항 43개와 관련 출처 51개. 기존 저장소 출처 중 이번 room read/search로 같은 원문을 재확인한 것은 27개다. 나머지는 기존 보존 원문을 출처 수준 그대로 승계했다.
- sourceKey는 검색 가능한 원문 식별자다. 제공되지 않은 대화 URL을 만들지 않았다.
- 실제 교육적 타당성 검증, 시험지 작성, 현재 운영 환경 적용 여부는 이 맥락 정리만으로 확정하지 않는다.

## 반드시 보존할 DATA·LOGIC·ACTION·SECURITY 사례

사용자 2026-10-13의 요청은 단순 명칭 나열이 아니다. 세부 유형 예제를 매우 상세한 행동 단위로 분해하고, 기대했던 이해와 설계 이유를 설명하며, 서술형 풀이에서 근본 능력 후보까지 감사·추적하도록 설계하는 것이다. 그 뒤 DATA/LOGIC/ACTION/SECURITY와 ID 경계를 구체화했다. 사용자 출처: Sentinel_e4fcfb7607d08191b13eee8f7e71855e, Sentinel_f5e2573509b88191a4bd4c9f0335a550, Sentinel_1322b7cb02d8819185ecb4ac7051fc41, Sentinel_c27ba16860188191ae566c090fdd5712.

### 당시 구체적 설명: 24 × 3
출처 Sentinel_bdf7a9d530888191a903d73680416c4d. 아래는 assistant 연구용 해석안이며 실제 학생 진단/검증 또는 사용자 최종 승인으로 바꾸지 않는다.
- DATA: 24를 20과4로 분해하는 자릿값, 같은 크기의 묶음, 부분과 전체.
- LOGIC: 각각3배하기,24를 세 번 더하기,외운 절차 재현하기라는 경쟁 사고 가설.
- ACTION: 실제 식·그림·수정 흔적·구두 설명. 서면과 구두 관찰은 구별한다.
- SECURITY: 자료·판정·공유 권한. 인지 요소에 억지로 매핑하지 않는다.
- 답72만 있으면 사고는 미확인이다.20×3+4×3을 써도 의미 설명이 없으면 절차 재현 가능성이 남는다. 의미 설명은 정확하고 합계만 틀리면 개념 이해와 계산 실수를 분리한다.

### 각 영역 내부의 위계와 관계
출처 Sentinel_93e97d95c4b881919e4d358ce0e4a493, assistant 구조안. 사용자 경계 정정과 구체 구현안을 혼동하지 않는다.
- DATA: 영역→개념군→개념→원자 개념. 응답·수행 기록→관찰 증거는 별도 가지다.
- LOGIC: 전략군→전략→판단·전환→미시 사고 단계. 경쟁 가설→증거 해석 규칙→추가 질문 선택은 별도 진단 로직이다.
- ACTION: 수행군→행동 묶음→세부 행동→관찰 기준. 실제 관찰 사건 및 교사·시스템의 검토·보류·질문 배정·승인은 구별한다.
- GOVERNANCE: 개념·문항·규칙의 버전, 출처, 검토/이견, 승인/보류, 접근권한을 횡단 적용한다. 톤 변경이 수학 의미나 증거 확실성을 바꾸면 안 된다.
- 하위개념·선행조건·사용·증거지원은 다른 관계다. 하나의 부모·자식 트리로 평탄화하지 않는다. Run과 연구 객체 버전은 다대다이며 작업 ID와 연구 ID는 서로 대체하지 않는다.

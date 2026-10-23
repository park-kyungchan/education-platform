# 원자료 무결성·구조 독립 점검 v1

검토 버전: 2026-10-13.v1

## 결론

- `source/archive` 실제 109파일 중 자체 manifest를 제외한 108파일의 SHA-256이 `FILES.sha256.json`과 모두 일치한다. 원본은 수정하지 않았다.
- 151 연구유형 = 초3 105 + 상위 연결 46. 원예시 170 = 유형 대표예시 151 + 변형예시 19이다. 170을 170개의 연구유형 또는 170개의 능력으로 해석하면 안 된다.
- 초3 105유형은 곱셈 38, 나눗셈 36, 원 31이다. 총 미시행동 1216개는 각각 270, 442, 164, 상위 연결 340개다.
- 점검한 유형·변형·행동·능력후보 ID 중복, 참조 누락, 분절 청크의 행동 누락/중복, 설계 및 원예시의 대응 불일치는 발견되지 않았다. 부모 계층과 연결 간선의 순환도 발견되지 않았다.
- 저장된 산술 검사 278개 출현분(231개 고유 검사 정의)을 독립 재계산했으며 전부 통과했다. 저장된 `passed` 값을 그대로 신뢰한 결과가 아니다.
- `HC11-d1-T02`의 정확한 세 점 등거리 조건과 교사용 해석 방향 사이에 정합성 문제가 있다. 29개 필드 교정 제안을 별도 버전 파일에 작성했으며, 원자료에는 적용하지 않았다.

## 자료 구조와 실제 위치

1. `source/archive/research_review/original_170_examples_and_hierarchy.json`
   - `nodes`: 탐색용 계층 88개
   - `core`: 기존 초3 내용/유형 노드 55개
   - `upper`: 상위 연결/경계 지원 내용 15개
   - `edges`: 선수/연결 간선 45개
   - `details`: 상세 단원 82개 = 초3 55 + 상위 27
   - `details[].types[]`: 연구유형 151개
   - 각 유형의 `example`: 원래 대표 문항의 prompt, answer, solution 등
   - 각 유형의 `variants[]`: 총 19개 추가 원예시. 변형 ID가 항상 `-V`를 포함하는 것은 아니므로 문자열 패턴으로 유형 수를 세면 안 된다.

2. `source/archive/research_review/{multiplication,division,circle,upper}_designs.json`
   - 곱셈은 유형 ID를 키로 하는 객체, 나머지는 `designs[]` 배열이다.
   - `originalExample`은 원예시를 보존한다. 모든 유형에서 원자료와 prompt·answer 일치를 확인했다.
   - `revisedExample`, `transfer`, `boundaryCase`는 연구자가 설계한 중심/전이/경계 과제다. 원예시 170개에 추가로 더해 세는 원자료 변형 목록이 아니다.
   - `actionDesign.microActions[]`: 1216개의 미시행동. `segmentation.chunks[].actionIds`의 전수 대응을 확인했다.
   - `actionDesign.example`, `independentTransfer`, `boundaryProbe`가 각각 상위 과제의 prompt·answer와 일치한다.
   - 같은 이름의 `source/archive/grade3_research/freudenthal/` 파일 네 개는 byte 단위로 동일하다.

3. `source/archive/app_snapshot/src/components/generated/`
   - `MathData.ts`의 DATA는 원예시/계층 JSON과 동일하다.
   - `ResearchDataPart01.ts`부터 `07.ts`까지의 DATA_PART를 합친 151 설계는 연구 JSON과 동일하다.
   - 앱 스냅샷은 실행하지 않고 JSON 리터럴만 읽어 비교했다.

4. `source/capability-research/초3_105유형_능력후보_근거대응.json`
   - `mapping` 105개는 초3 유형 전체를 한 번씩 포함하며 상위 연결 46유형은 포함하지 않는다.
   - `abilities` 28개는 구조 후보 22개와 횡단 관찰 차원 6개다.
   - 유형→후보 및 후보→유형 역방향 대응, 문항/설계 문구 대응, 후보·문헌 ID 참조를 점검했다.
   - 이 구조 정합성은 28개 후보가 타당화된 잠재능력 분류임을 뜻하지 않는다.

## HC11-d1-T02: 확인된 문제와 교정 방향

정확한 위치:

- 원예시: `original_170_examples_and_hierarchy.json#/details/39/types/1/example`
- 재설계: `circle_designs.json#/designs/1`
- 문제 조건: `/designs/1/centralTask/prompt`, `/designs/1/designRationale/conditions`
- 주요 해석 위험: `/designs/1/targetStructure`, `/designs/1/actionDesign/microActions/3/designIntent`, `/designs/1/actionDesign/microActions/3/separationReason`
- 앱 복제: `ResearchDataPart04.ts`, DATA_PART의 `HC11-d1-T02`
- 능력후보 문구: `mapping[75].designTarget`

문제는 A·B·C가 같은 원 위의 서로 다른 세 점이고, L까지의 거리가 반올림 측정이 아닌 정확한 4·4·4cm라고 명시한다. 그러므로 L은 그 원의 유일한 중심이다. 같은 원 위 서로 다른 세 점은 비공선이고, 세 점까지 등거리인 점은 두 수직이등분선의 유일한 교점이며 원의 중심도 그 교점에 있다.

원문 답은 L을 명시적으로 '중심이 아니다' 또는 '중심 결정 못함'이라고 쓰지는 않는다. '모순 없는 후보'라고만 하고, 미시행동 A04는 중심 확정을 과도한 일반화처럼 취급한다. 이 때문에 올바른 L 중심 판단을 교사가 오류로 기록할 위험이 있다. '초3에게 상급 기하 증명을 요구하지 않음'은 타당하지만, 참인 결론을 불충분 조건처럼 취급하는 근거가 되지는 않는다.

권장 교정은 세 점 조건을 유지하면서 L 중심 결론을 정확히 명시하고, A04에서 이를 정답으로 인정하는 것이다. 증명은 교사용 검토에만 두며 초3 필수 성취/채점 조건으로 추가하지 않는다. K의 거리 불일치에 의한 배제, 두 점만 등거리인 경계 사례의 불충분성은 그대로 타당하다. 원래 예시는 O가 이미 중심이라고 주었으므로 수정하지 않는다.

`correction-proposals.v1.json`은 대상 해시, 선택자, 실제 JSON pointer, 변경 전 검사(test), 변경 후 제안(replace), 복제 위치 및 능력후보 문구 대응안을 포함한다. 선택한 설계 객체에 대한 29개 변경을 메모리에서 재생하여 검증했다. 적용 여부는 별도 결정이며, 원본 archive를 덮어쓰지 않는 파생 검토 계층용 제안이다.

## 재현과 검토 범위

실행: `python docs/review/independent_audit.py`

산출물:

- `source-integrity-audit.v1.json`: 개수, 식별자, 참조, 순환, 복제 자료, 해시 및 범위 한계
- `numeric-check-replay.v1.json`: 각 산술 검사의 실제 원본 JSON 위치와 재계산 결과
- `correction-proposals.v1.json`: HC11 대상 교정 제안

이번 결과는 전체 151유형·170예시의 수학·교수학 전면감사 완료를 뜻하지 않는다. 자유서술의 모든 계산·증명, 도형 실현 가능성, 모든 문제 조건의 충분성, 교육과정 배치 및 외부 문헌 주장, 수업 용어의 적절성은 전면 검토하지 않았다. 체크섬은 제공 manifest와의 보존 일치를 뜻하며 자료 내용의 진실성이나 외부 출처 진본성을 보증하지 않는다.

학생 관찰 데이터가 없으며 학습효과, 능력의 인과적 진단, 학생 숙달 판정은 검증되지 않았다. 저장 산술검사가 모두 참이어도 설명의 논리적 정합성이나 교수학적 타당성은 별도 검토가 필요하다.

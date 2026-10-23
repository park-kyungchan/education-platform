# 월말평가 연구·MagicPath 피드백 인계

이 폴더는 월말평가를 계기로 진행한 수학교육 연구의 사용자 맥락을 보존하는 추가 인계 자료다. 기존 `source/archive`, `source/user-intent`, `context/user-context` 원문과 source pins를 변경하지 않는다. 대화 전체가 복원되었다고 주장하지 않으며, 확인하지 못한 과거 버전·삭제 이력과 원문 부재는 coverage에 남긴다.

## 읽는 순서

1. `requirements.json`: 월말평가 목적·범위·시간·배점·문항 선택 경계와 사용자 정정.
2. `history.json`: MagicPath 화면·연구 설계에 대한 피드백 및 시간 순서.
3. `dossier.json`: 출처와 연결된 계층·유형·관계 및 기존 맥락 레코드 crosswalk.
4. `coverage.json`: 이번 수집 범위, 확인되지 않은 내용, 제외한 자료.
5. `verification.json`: 이 추가 데이터에 실제 실행한 검사와 미실행 검사.

원문은 `sources.json`에 한 번만 보존한다. `chronology.json`은 시간순 출처 인덱스이며, `history:*` 레코드는 동일 근거를 다른 각도로 읽는 투영이지 독립된 재확인이 아니다.

`requirements.md`와 `history.md`는 한국어 읽기용이며 JSON이 출처·상태·관계의 구조화 표현이다. 데이터와 문서를 함께 검토한다.

## 핵심 구분

- 사용자 지시, 연구 가설, assistant 제안, 당시 실행 보고, 실제 검증과 범위 한정 수락은 서로 다르다.
- 24문항·100점의 초3 10월 월말평가는 15:00부터 80분이다. 일반 운영 문서의 100분 시험과 범위를 섞지 않는다.
- 곱셈9·나눗셈9·원6 배분은 제안이며, 실제 문항 선정·사용자 채택이 아니다. 점수는 난이도의 증거가 아니다.
- DATA / LOGIC / ACTION / SECURITY(GOVERNANCE) 연구는 각 층 내부의 위계·typed 구조와 층 사이 관계를 구분한다. 최초 사용자 대응은 수정 가능한 연구 가설로 보존한다. 관찰 행동만으로 학생의 사고·능력 부족을 인과적으로 확정하지 않는다.
- 연구 예제와 실제 시험 문항, 초3 핵심105유형과 전체151유형, 22+6 능력 후보 모델과 경험적으로 입증된 능력을 혼동하지 않는다.
- 기존 파일럿 화면이 충분하다는 평가는 전면 수학 감사·학습효과·실제 학원 운영의 최종 수락이 아니다.

## 소유권·보안·검증

이 자료는 math-research-module의 연구 맥락만 다룬다. 학생 식별 정보·학습 운영 기록·출판사 PDF·비밀정보·계정 상태·호스트별 실행 설정은 포함하지 않는다. GitHub에 전달할 파일은 manifest의 allowlist로 한정하며 원시 room 검색 결과를 포함하지 않는다.

공통 Artifact/WorkContext 구현은 기존 고정된 agent-platform 소유를 유지한다. 이 폴더의 타입은 로컬 연구 데이터 계약이며 공통 검증기를 복제하지 않는다. 새 데이터가 공통 하네스의 권한이나 수락을 부여하지 않는다. 기존 하네스·Task·Run의 완료 또는 불확실한 효과를 수정하거나 초기화하지 않는다.

연구 자료 추가만으로 기존 앱 화면·교육 효과·실제 학생 평가가 바뀌지 않는다. 원문 및 근거의 구조 검증과 수학교육적 타당성 검증을 분리한다. 원격 게시 이후에도 merge와 auto-merge는 하지 않는다.

## 로컬 검사

```sh
node context/monthly-assessment-20261016/scripts/validate.mjs
node context/monthly-assessment-20261016/scripts/test.mjs
```

이 검사는 출처 해시·참조·교정 이력·가설 상태·ontology 층 보존을 검사한다. 기존 `bun run check:all` 및 고정 upstream을 이용한 `check:harness`는 별도이며 이번 클라우드 환경에 Bun이 없어 실행하지 않았다. 기존 파일·pin·앱 코드·공통 하네스 레코드는 변경하지 않는다.

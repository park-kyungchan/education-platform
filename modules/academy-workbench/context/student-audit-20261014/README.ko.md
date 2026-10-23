# 학생별 학습 근거 감사, 2026-10-14

이 모듈은 사용자 요청으로 수집한 다섯 학생의 **비공개 오프라인 감사**입니다. 운영 앱 데이터 가져오기, 서버 저장, 채점, 교사 판정 생성, 인쇄 또는 발송을 실행하지 않습니다. 합성 런타임 fixture에 실제 학생을 넣지 않습니다.

## 분리하는 근거

- 교재와 판본 → 소단원 → 원문 섹션 → 응시/점수와 원천 클리닉 표기
- 예습영상 업로드 시각과 교사 검사 상태, 실제 조회 시각
- 교사의 정확한 범위별 완료/미완료 판정
- 준비된 프린트, 실제 인쇄, 배부, 학생 답안, 채점, 수정 확인
- DailyTest 프린트/수행 근거와 앱 답안/채점 근거
- 과거 저장 스냅샷, 현재 공식 화면의 제한된 관측, Space의 후속 교사 맥락

미관찰은 미수행이 아니며, 점수는 교사 검토 완료가 아닙니다. 앱의 `미학습`은 교사의 완료 판정을 취소하지 않습니다. 소단원 단위 teacher 사실을 범위가 불명인 다른 섹션에 전파하지 않습니다. Placeholder를 실제 교재 섹션이나 숙제 건수로 계산하지 않습니다.

## 자료와 검증

비공개 학습 자료는 `../../private/student-audit-20261014/`에 별도 저장합니다. 이름·학습 근거는 요청한 비공개 저장소에서만 보존하며 원시 대화, 보안정보, 불필요한 가족 사정은 포함하지 않습니다. 이 위치는 정적 웹 배포 대상이 아닙니다.

`audit.ts`는 정확한 학생·교재·판본·소단원·섹션·응시 범위를 맞추는 순수 함수입니다. 공통 하네스의 Artifact/WorkContext 검증을 복제하지 않습니다. `work/identity.json`은 저장소 로컬 작업 ID이며 native/전역 등록이나 실행권한을 만들지 않습니다.

검사: `node --test context/student-audit-20261014/tests/*.test.ts`

전체 현재 이력 및 앱 기록 누락 여부는 수집 범위와 원시험지/답안 연결까지 검증되어야 합니다. 오래된 성공 이력이나 단일 기본 화면을 전체 최신 감사로 승격하지 않습니다. 최종 수집 범위, 미확인 항목과 별도 검증 결과는 데이터의 coverage 및 validation receipt를 읽으세요.

## 지침도 typed graph로 관리

`instruction-topology.json`은 지시·출처·범위·supersedes 그래프와 읽기 경로·요구조건·fallback 그래프를 분리합니다. `instruction-topology.ts`는 중복/단절/순환/교차범위 fallback을 거절합니다. 환경, 권한, 대상 범위는 서로 대체할 수 없는 동시 조건입니다. Prose 문서는 설명이며 실행 결정은 검증된 typed 입력과 현재 host 권한이 함께 있어야 합니다.

`check-work.ts`는 기존 pinned agent-platform의 Artifact/reference validator를 사용합니다. 새 Work를 공유 Artifact kind에 추가하지 않습니다. WSL2/VPS/native runtime의 실행 loop, session, dispatch, credential 소유권은 그대로 두며 이번 테스트를 Dots/WSL/VPS 통합 성공으로 해석하지 않습니다. 선택 source closure의 pinned-snapshot 검증은 완전한 Git checkout 또는 native provider 검증과 다릅니다.

`validate-data.ts`의 성공은 구조·해시·학생별 응시 참조·건수 일치와 제한된 보안 패턴 검사만 의미합니다. 출처의 진실성, 모든 문항 답안 입력, 실물 과제 완료 또는 전체 최신 이력을 증명하지 않습니다.

## 코드 인도와 배포의 분리
사용자 2026-10-14 정정(Sentinel_05eb36feb9988191be983ac5c2f2b4c5, Sentinel_13b5e2bba2148191951c1d862943100b): 기존 academy-workbench 저장소에 commit/push/PR/merge하는 것이 현재 코드 인도 경로다. 별도 VPS 배포 위치 선택을 이 작업의 선행 조건으로 요구하지 않는다. 저장소 반영은 실행 중인 앱의 호스팅·배포·접속 성공 증거가 아니다. 최종 사용자 출력은 앱 프론트엔드이며 별도 HTML/ZIP 파일 전달로 대체하지 않는다.

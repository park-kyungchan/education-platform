# 수학 연구 파일럿: 원본 보존용 이관 자료

상태: **미완성 이관 입력 자료**. 바로 실행·배포할 수 있는 독립 repository가 아닙니다.
최종 MagicPath component: 460699302226984960
보존한 최종 revision: 460722308961701888

## 보존 범위
- app_snapshot/src: 실제 제출한 최종 소스 15파일. 화면·데이터 13파일 및 호스트 App.tsx/index.css 2파일.
- grade3_research: 교육과정·계층·기본문항·연구 설계의 원본 자료와 기존 작성 스크립트.
- research_review: 기존 연구 자료 ZIP의 24파일을 풀어서 포함. 전체 읽기용 해설, typed schema, 원고, 출처, 감사, OFL 라이선스 포함.
- tests_snapshot: 실제 사용한 3종 DOM 검사와 각 entry.
- reproduction: 합본·검증·폰트·검토 자료 생성 스크립트의 원본 사본.
- test_environment_snapshot: 검증 환경의 package/lockfile 사본. 독립 앱용 package가 아닙니다.
- fonts: 원본 Noto Sans KR TTF, OFL, 앱에 내장한 이름 변경 부분집합 WOFF.
- validation: 최종 검증 기록과 원고 해시.
- FILES.sha256.json / INVENTORY.json: 이 묶음의 파일 목록, 해시, 구성 설명.

151개 세부유형, 기존 기본151+변형19=170문항, 1,216개 미시행동을 보존했습니다.
학생의 실제 기록·점수·개인 DB는 없습니다. 학습효과는 실증하지 않았습니다.

## 그대로 실행하면 안 되는 이유
1. App.tsx가 호스트에서 제공하던 ./settings/types를 참조합니다. 이 파일은 export에 포함되지 않았습니다.
2. index.css는 호스트 Tailwind 설정, tailwindcss-animate와 Google Fonts의 MathExplorerKR import를 포함합니다. 독립 entry와 CSS 환경으로 정리해야 합니다.
3. 독립 앱 package.json, lockfile, index.html, main entry, bundler/TypeScript 설정은 아직 작성하지 않았습니다.
4. 테스트와 스크립트에는 기존 작업공간과 /tmp의 하드코딩 경로가 남아 있습니다. 이는 원본 바이트 보존을 위한 것으로, 새로운 repo 기준 상대 경로로 이관 담당자가 수정해야 합니다.
5. merge_research.py는 형제 grade3_research 폴더와 generated 출력 위치를 가정합니다. 현재 묶음의 디렉터리는 보존용이므로 그대로 실행할 경로 구조가 아닙니다.
6. embed_font.py는 fontTools와 기존 /tmp 폰트 경로를 사용합니다. 폰트 입력은 fonts에 함께 보존했습니다. 현재 앱을 보여 주는 데 재생성은 필요하지 않습니다.
7. 원본 작성용 build_* 스크립트는 역사적 자료입니다. 최종 수정·감사를 거친 *_designs.json을 정본으로 사용하고, 작성 스크립트 재실행 전에 차이를 확인해야 합니다.

## 확인된 의존성
화면 컴포넌트는 React 및 React DOM과 브라우저 DOM만 사용합니다. MagicPath SDK, Dots API, 백엔드 호출, 앱 환경변수 또는 자격증명은 필요하지 않습니다.
데이터·폰트는 포함돼 있으며 외부 링크는 문헌을 여는 데 사용됩니다.
실제 검증 환경: Node 24.19.0, Bun 1.4.2, React/React DOM 및 타입 19.3.0, jsdom 30.1.2, Python 3.12.14.
jsdom과 Python/fontTools는 검사·자료 재생성용이며 브라우저 런타임 의존성이 아닙니다.
이 버전 목록은 기존 검증 기록이지 새로운 공통 하네스 규약을 대신하는 권고가 아닙니다.

## 다음 구현 작업의 경계
- 먼저 사용자의 WSL2 공통 하네스 규약을 확인하고 그 규약에 맞춰 별도 private module repo를 구성합니다.
- 독립 실행·검증·commit/push/PR/merge 안내는 이후 구현 단계에서 작성해야 합니다.
- 이번 묶음은 코드의 내용을 변경하지 않았고 외부 GitHub repo에 쓰지 않았습니다.
- 단원 분배·시험 출제·학생별 DB 구축은 이 자료 작성으로 승인되거나 구현된 것이 아닙니다.

## 보안과 검증
인증정보, 쿠키, 토큰, 서명 업로드 URL, 브라우저 세션, 임시 preview URL, node_modules, 캐시, 대화 기록은 포함하지 않았습니다.
앱 소스 15파일은 최종 제출 검증 기록과 바이트 단위로 대조했습니다.
151/1216 전수 검사는 로컬 원고·DOM 검사이며 실제 브라우저 전체 행동을 모두 클릭했다는 뜻은 아닙니다.
대표 경로의 실제 브라우저 검수와 주요 띄어쓰기 수정 검수는 완료했습니다. 일부 과분리 띄어쓰기는 남아 있습니다.

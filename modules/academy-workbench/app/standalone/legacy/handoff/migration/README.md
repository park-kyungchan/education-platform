# Academy Workbench: 구조화된 현재 한계

2026-10-13 기준의 개인정보 없는 이관 문서입니다. 대상은 비공개 `park-kyungchan/academy-workbench`이며 첫 파일럿은 소유자 1명입니다. 앱 구현·학원 데이터 변경·운영 배포·접근 권한 부여는 수행하지 않습니다.

## 먼저 볼 파일

- `hardlimits.json`: 현재 한계·해결된 범위, 담당 역할, 다음 안전한 단계
- `hardlimits.types.ts`: 상태별 discriminated union과 참조 계약
- `hardlimits.schema.json`: JSON Schema 2020-12, 추가 필드 및 잘못된 상태 조합 거절
- `hardlimits.example.json`: 5개 상태를 모두 보여주는 가상 예제. 실제 승인 요청이 아닙니다.
- `evidence-manifest.json`: 원본 파일의 상대 경로·SHA-256·범위·관측 시각. 원문은 포함하지 않습니다.
- `validate.py`, `validation-result.json`: 구조·참조·DAG·타입·개인값 누출 방지 검사와 결과

## 현재 사실

1. Sites 운영은 v19입니다. v21 commit `54967bfc64278fb594d64887106b85c71facd80c`는 저장됐지만 미배포입니다. 운영 롤백 기준도 v19입니다.
2. Desktop Chromium의 1440/1100/1099/768/390/320 폭과 주요 키보드·표시 동작은 검증했습니다. 실제 모바일 기기·Safari/터치·전체 WCAG 감사는 미검증 범위이며 새 필수 요구사항이 아닙니다. 실제 native WebMCP 발견·호출·오류·상태 확인은 별도 필수 미검증입니다.
3. 95개 역사적 카탈로그 중 7개는 당일 공식 UI의 제한된 읽기 근거가 있습니다. 고정 GET과 범위가 정해진 NA POST 검색을 포함합니다. 독립적으로 운영 활성화한 원천 API 어댑터는 0이며, Site 실시간 원천 통합도 없습니다. 이 네 가지 축을 합치지 않습니다.
4. 저장된 cloud coding task의 컨테이너 생성 실패와 별도 cloud 파일/브라우저 정상 상태를 구분합니다. 독립 인증·DB 어댑터·합성 설정 생성기·서버 미구현도 각각 별도입니다.
5. 실제 academy APK가 없습니다. 공식 스토어는 앱 신원 근거입니다. 공개 샘플에 대한 REA/JDK/JADX 5개 성공은 도구 체인만 검증합니다.
6. 학생 namespace 직접 연결, 축약 제목 충돌, 필터·페이지 완전성, 원자적 revision, 과거 인쇄물 연결은 아직 제한이 있습니다. 최신 정확한 행·문항 순번 기준 아이콘 검증은 좁은 범위에서 해결됐지만 전역 아이콘 배열 결합은 허용되지 않습니다.
7. 기존 synthetic browser preview는 합성 데이터로 v21 UI를 보여주는 자료입니다. 운영 인증·지속 저장·원천 연동 또는 독립 실행 서버의 완성을 뜻하지 않습니다.

## 에이전트 해석 규칙

- `failed`: 실제 시도가 명확히 실패했습니다. stage/code와 재시도 조건을 확인합니다.
- `blocked`: 제한, 빠진 전제조건, 미구현으로 현재 범위의 진행이 막힙니다.
- `unverified`: 근거가 부족합니다. `mandatory_gate`와 `coverage_limit`을 구분합니다.
- `approval_pending`: 실제 특정 승인 요청이 미해결일 때만 씁니다. 현재 목록에는 억지로 생성하지 않았고 예제로만 포함합니다.
- `resolved`: 명시된 좁은 범위가 해결됐다는 뜻입니다. 주변 시스템 전체가 검증된 것은 아닙니다.

`requiredForCurrentDelivery`는 해당 프로젝트 목표의 게이트 여부입니다. 이 문서 자체를 전달할 수 없다는 뜻이 아닙니다. `conditional_research`는 Android 등 해당 조사를 계속할 때만 적용됩니다.

`domainPath`는 environments/auth/source-read/integration/privacy/deployment/migration의 2단계 계층입니다. `dependencies` 및 `dependencyGraph.edges`는 “from이 to를 필요로 함”인 DAG입니다. 학습·실무 반복 과정은 `workflowCycles`에 따로 두며 실행은 비활성입니다. 안정적인 ID는 제목이나 상태 변경 때문에 바꾸지 않습니다.

각 한계에는 영향을 받는 목표, 근거/관측 시각, 시도·결과, 반복하지 않을 방법, 가장 작은 필요 입력, 수용 검사, 담당 역할, 다음 안전한 행동이 있습니다. 역할은 실제 담당자 배정이나 권한 부여를 뜻하지 않습니다. 관측 시각을 모르면 null이며 문서 생성 시각으로 덮어쓰지 않습니다.

## 개인정보와 권한 경계

원본 학생 자료·원천 식별값·자격증명·연락처·세션 값은 포함하지 않습니다. 비공개 저장소여도 기존 private bundle, generated payload, 실제 학생 binding, DB export를 복사하면 안 됩니다. 깨끗한 allowlist와 새 합성 입력/설정으로 대체해야 합니다. 원본은 해시 참조만 남기므로 원본 파일이 이 저장소에 없는 것은 의도된 상태입니다. 기존 provenance·파일 경로는 역사적 위치이며 이관 저장소의 실행 경로로 간주하지 않습니다. import뿐 아니라 package script, runner/build 파일, 파일 읽기와 generated output 의존성도 전체 빌드 전에 검증해야 합니다.

이 문서는 행동 권한을 부여하지 않습니다. 과거 허용 여부는 현재 실행·공유·배포 권한으로 전환하지 않습니다. 명시적으로 막힌 자산·DevTools·overlay를 다른 수단으로 우회하지 않습니다. 재응시 reset, 생성·인쇄·발송은 읽기 작업과 분리합니다.

## 검증

이미 설치된 Python `jsonschema`가 있는 환경:

```sh
python3 validate.py
```

원본 해시·JSON pointer까지 확인하려면 원본 작업공간을 읽기 전용 입력으로 제공합니다. 이미 있는 TypeScript compiler만 사용합니다.

```sh
python3 validate.py --source-root /path/to/original-workspace --tsc /path/to/typescript/bin/tsc
```

설치나 원천 네트워크 요청을 하지 않습니다. 원본이 없으면 해시 재확인은 `not_run`으로 남고 구조 검사는 가능합니다. 이 폴더의 검사 통과는 앱 빌드·운영 인증·실제 native WebMCP·새 배포의 통과가 아닙니다.

`build-deliverables.py`와 `build-schema.py`는 원래 작업공간에서 문서를 생성한 도구입니다. 이관 파일 allowlist에는 필수 문서 8개만 사용해도 됩니다. 원본 해시가 달라지면 자동으로 덮어쓰지 말고 변경 근거와 관측 시각을 검토하세요.

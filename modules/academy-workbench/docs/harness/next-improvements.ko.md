# 다음 환경에서 이어갈 작업

이 변경은 아이디어를 검증 가능한 module pilot으로 정리한 출발점입니다. Codex CLI 또는 `hermes-agent-2q3y`에서 고도화할 때 다음 순서로 이어가세요. 항목의 존재는 해당 작업을 지금 실행할 권한이 아닙니다.

1. 승인된 branch/commit을 새 폴더에 clone하고 `bootstrap.ko.md`의 install/check/test를 실제 환경에서 실행합니다. 환경·버전·source pin·성공/실패/미실행을 새 근거로 기록합니다. 현재 cloud 검증을 해당 환경의 성공으로 복사하지 않습니다.
2. native Work를 선택·등록해야 한다면 그 owner의 기존 방식과 현재 승인을 확인합니다. `local-module-record`를 전역 등록으로 바꾸기 전에 실제 등록 결과와 출처를 확보합니다.
3. 선택 사용자 맥락의 원문·수정·제안·근거·검증·수락을 검토합니다. 기존 일반화 요약과 전체 대화가 동일하거나 이관 완료되었다고 가정하지 않습니다. 연구 모듈과 학원 실무의 자동 학생 데이터 연결을 만들지 않습니다.
4. `migration/current-status.json`의 7개 운영 게이트 중 실제 다음 목표 하나를 선택합니다. 기존 goal/status/source hashes를 보존하고 해당 범위의 새 evidence·verification·독립 acceptance를 추가합니다. 이 하네스 변경에서 게이트를 완료 처리하지 않았습니다.
5. 이후 실제 효과가 발생하면 completed/pending/uncertainEffects를 분리해 native owner checkpoint에 기록합니다. uncertain은 관찰 후 판단하며 완료 효과를 setup/test/retry로 반복하지 않습니다.

현재 적용 범위 밖: 원본 저장소 삭제, 배포, 운영 인증 구성, source write, print/send, 실자료 projection 활성화. 초기 앱은 Node 24 합성 읽기 전용 실행 범위를 유지합니다.

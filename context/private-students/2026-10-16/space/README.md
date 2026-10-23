# 학생 Space 자료 내보내기

5명 학생 Page와 하위 Page 목록을 확인하고 현재 원문을 보존했습니다. 지원 Page 5개는 학생들이 직접 참조한 교재·수업·출력 구조 자료입니다. 정확한 건수와 해시는 manifest.json을 따릅니다.

- *.page.json: 현재 Page의 원문, 블록 ID·해시, revision, 출처 URL.
- attachments/: 실제 읽은 첨부 원문과 원본 SHA-256.
- structured/: 제목 위계로 연결한 구조화 보기, 손실 없는 Markdown 및 JSON 첨부의 파싱 데이터.
- conversation-overlay.json: 현재 대화 정정. 같은 source message ID로 다른 이벤트 파일과 중복 억제합니다.
- redaction-manifest.json: 민감정보 검사 범위·제외와 한계.

서버의 과거 미학습/점수와 현장 교사 최종판정은 별도 자료입니다. 중복 응시·완료를 새로 계산하지 않습니다. 현재 Page에 남은 이전 이력은 보존했지만 삭제된 버전의 전체 감사로그를 가져온 것은 아닙니다. 학원 서버나 Space를 변경하지 않았습니다.

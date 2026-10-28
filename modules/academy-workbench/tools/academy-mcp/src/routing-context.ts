/** Agent routing metadata. Backend identifiers keep their original spelling;
 * Korean request phrases are user vocabulary, not new backend status meanings. */
type RoutingContext={requests:string;backend:string;meaning:string};
export const academyRoutingContext:Readonly<Record<string,RoutingContext>>={
 academy_dailyrecord_get:{requests:'오늘/지난 수업일의 DailyRecord·수업일지 진도, 숙제, 메모 조회',backend:'DayRecordServlet; p_process=Main; academy.lms.dayrecord',meaning:'Preferred exact-name read for current AND historical lesson dates. A historical lesson date does not select a saved snapshot. Authoring interviews do not make an observed read unavailable.'},
 academy_student_resolve:{requests:'학생 이름으로 해당 수업일의 원천 학생 키 확인',backend:'DayRecordServlet dated occurrence; source studentKey and teacherKey',meaning:'Resolve within the owner namespace; absence in one response is not roster absence. A resolved key does not authorize another namespace.'},
 academy_dailyrecord_intake:{requests:'DailyRecord 작성 전 기존 내용 확인·빠진 내용 인터뷰',backend:'DayRecordServlet and owner-qualified journal before-state',meaning:'Read/prepare before-state. Use academy_dailyrecord_get for a plain lookup; intake is not server save or parent send.'},
 academy_dailyrecord_review:{requests:'DailyRecord 문안 검토·기존 문안과 변경 비교',backend:'DailyRecord field projection; qualified before-state when available',meaning:'Review a proposed change without executing it. Current teacher facts and scoped corrections remain distinct from source observations.'},
 academy_student_metadata_get:{requests:'이름·수업일로 DailyTest(DT)·시험 결과 및 이력 메타데이터 확인',backend:'DtResultSearch; UserBySearchTestResult; academy.lms.metadata',meaning:'Preferred metadata route when only a name/date is known. Its own owner policy is required. Scores, page rows and relative periods do not prove assignment, submission, grading or clinic completion.'},
 academy_student_metadata:{requests:'이미 확인된 원천 학생 키로 시험 메타데이터 묶음 조회',backend:'DtResultSearch; UserBySearchTestResult; academy.lms.metadata',meaning:'Compatibility keyed route; use academy_student_metadata_get for a name/date request. Never invent keys or carry a DailyRecord admission into metadata.'},
 academy_daily_test_inventory:{requests:'DailyTest(DT) 결과 목록·점수 행 확인',backend:'DailyZeroTestServlet; reqCmd=DtResultSearch',meaning:'Observed source filter/page only. Zero/blank/absent rows do not establish ungraded or missing work; keep original-error and similar clinic status separate.'},
 academy_item_answer_lookup:{requests:'숫자 문항 라벨(lectureKey)의 공식 정답 원문 조회',backend:'TestPageShowExServlet; p_process=GetLectureList; lecture_list',meaning:'Exact item-answer literals, not type-label search or student answers. Delimiter candidates and mobile response UI are not a qualified official renderer or printed-version match.'},
 academy_item_label_scope:{requests:'교재·단원·유형의 실제 위계와 유형 라벨 확인',backend:'Owner-selected original hierarchy/type-label source',meaning:'Discover exact source IDs before type search. Type labels and numeric item-answer labels are different identities; retain source revision and original labels.'},
 academy_find_item_labels:{requests:'학습한 상세 유형과 문항 특징에 맞는 기존 유형 라벨 후보 찾기',backend:'Existing source hierarchy/type labels; lexical candidate retrieval',meaning:'Requires the teacher research/study context and exact hierarchy. Similarity is a candidate, not mastery, final item selection or a new question.'},
 academy_review_type_questions:{requests:'확인한 유형 라벨의 기존 문항·정답·메타데이터 검토',backend:'Previously returned source type label and hierarchy',meaning:'Read a bounded source page; retained labels alone do not establish current question inventory. Final assessment selection remains separate.'},
 academy_printed_paper_lookup:{requests:'학생과 출력 코드로 해당 시험·응시 원천 기록 확인',backend:'Owner-decoded printed code; source paper/attempt read contract',meaning:'Printed code, paper definition and student attempt are distinct. Not-found covers observed scope; no printing or grading is executed.'},
 academy_paper_definition_lookup:{requests:'출력 코드의 공통 시험지명·분류·수준·문항 수 확인',backend:'Owner-decoded shared paper definition',meaning:'Definition only; no student attempt, assignment, score or completion is established.'},
 academy_paper_headers:{requests:'여러 시험지의 표제·정의 정보 확인',backend:'Explicit owner-qualified paper headers/definitions',meaning:'Inspect source category/level/count metadata; a header is not a student result or evidence of physical printing.'},
 academy_paper_read_contracts:{requests:'시험 검색·TestPool 읽기 폼과 함수 계약 확인',backend:'Existing paper search and TestPool source contracts',meaning:'Inert source metadata, not a student-data result or authority to run a page handler.'},
 academy_source_read_contracts:{requests:'DT 카탈로그·출력 코드 변환기의 원천 계약 확인',backend:'DT catalog shell and printed-code converter source',meaning:'Contract inspection only. A catalog definition is not an assignment; metadata success is not a completed teacher task.'},
 academy_cism_section:{requests:'CISM의 정확한 보고기간·학생·학습부진아 지도 섹션 확인',backend:'CISM; 학습부진아 지도; exact owner-injected section reader',meaning:'Separate CISM report scope. It does not establish original-error/similar clinic state or authorize DailyRecord save/send.'},
 academy_query:{requests:'저장된 학습 이력·교사 메모·과거 수업 맥락 확인',backend:'Historical saved_context; student_history and dated lesson_context',meaning:'Preserved evidence only. For a source read of today OR a historical lesson date use academy_dailyrecord_get; saved collection/retrieval/lesson dates remain distinct.'},
 academy_source_status:{requests:'저장본 수집일·보존 범위·누락 확인',backend:'Saved-context coverage metadata',meaning:'Does not probe live DailyRecord. Do not infer current source failure from a historical access report.'},
 academy_capabilities:{requests:'지원하는 학원 업무·원천 계약·조회 범위 찾기',backend:'Pinned source-operation inventory and workflow metadata',meaning:'Discover contracts and supported routes; inventory entries are not executable tools or evidence of live availability.'},
 academy_runtime_identity:{requests:'현재 연결된 MCP release·브리지·원천 빌드 일치 확인',backend:'Bridge release graph; infrastructure metadata',meaning:'Hashes and loaded-process identity only, not source freshness, namespace permission or live academic evidence.'},
 academy_endpoint_identity:{requests:'개별 원천 실행 프로세스의 빌드·계약 식별',backend:'Owner endpoint identity manifest; infrastructure metadata',meaning:'Declared artifact identity only; no student read or authority is granted.'},
 academy_runtime_read_admission:{requests:'현재 DailyRecord 읽기 허용 설정의 일치 여부 확인',backend:'Owner DailyRecord read-admission digest',meaning:'An admission digest is not a release/source-bundle hash, login success or student record.'},
 academy_teacher_query:{requests:'날짜→관찰된 반→학생→교재 맥락을 저장 근거에서 찾기',backend:'Canonical retained teacher-source pages',meaning:'Read every required page and separate student_history from dated lesson_context; no live refresh or complete roster is implied.'},
 academy_teacher_report:{requests:'날짜·반·학생·교재·단원·활동별 교사 내부 보고서 읽기',backend:'Canonical retained teacher-source report projection',meaning:'Preserve scoped teacher decisions, occurrences, cancellations and unknowns. This is not parent transmission or a source update.'},
 academy_pool_source_contract:{requests:'문항 풀의 원래 난이도·응답 형식 명칭 확인',backend:'Original pool selectors, columns and formatter references',meaning:'Use original observed values/labels. Local scoring quotas do not define source difficulty.'},
 academy_pool_question_content:{requests:'이전에 확인된 정확한 문항의 원천 미리보기 읽기',backend:'Session-bound source-qualified question PNG reference',meaning:'No arbitrary URL or generated preview; image variant names do not prove problem/solution roles.'},
 academy_review_candidate_set:{requests:'교사 연구 맥락에 묶인 평가 후보 구성 검토',backend:'Local source-bound candidate metadata review; no backend command',meaning:'Review supplied evidence and the scoped plan, not final selection, generation, ranking or teacher acceptance.'},
 academy_prepare_paper_plan:{requests:'선택 문항과 원천 근거의 시험지 계획 메타데이터 준비',backend:'Local paper-plan metadata; no backend command',meaning:'Does not construct a paper, generate questions, print or write to the academy backend.'},
 academy_verify_paper_preparation:{requests:'준비 결과 메타데이터를 해당 시험지 계획과 비교',backend:'Local caller-reported preparation metadata; no backend command',meaning:'A matching report is not proof of source truth, payload bytes or execution.'},
 academy_verify_paper_output:{requests:'제공된 PDF·시각 검토 확인서 메타데이터 비교',backend:'Local caller-reported output receipts; no backend command',meaning:'Does not open/verify the PDF, print it, deliver it or authenticate a supplied completion receipt.'},
};
const marker='\n\nAcademy routing context: ';
const endMarker='\nEnd Academy routing context.';
export function academyRoutingDescription(name:string,description:string,sourceScope?:string):string{
 const saved=name.startsWith('saved_')||sourceScope==='saved';
 const originalName=name.startsWith('saved_')?name.slice(6):name;
 const base=originalName.startsWith('class2_')?originalName.slice(7):originalName;
 const context=academyRoutingContext[base];if(!context)return description;
 const start=description.indexOf(marker),end=start<0?-1:description.indexOf(endMarker,start);
 // Discovery may append current owner/date scope after the endpoint description.
 // Refresh only this bounded metadata block and retain that independent scope.
 const original=start<0?description:description.slice(0,start)+(end<0?'':description.slice(end+endMarker.length));
 const scope=saved?' Saved/preserved route; never claim a live refresh from this alias.':originalName.startsWith('class2_')?' Separate paper2 owner scope; the compatibility prefix does not prove a class/cohort or grant paper1 permission.':'';
 return original+marker+context.requests+'. Backend/source: '+context.backend+'. '+context.meaning+scope+endMarker;
}

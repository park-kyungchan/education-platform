# Backend terminology and teacher-request routing

Backend operation names, field names and observed values keep their original
spelling. Stable MCP tool IDs remain compatible. Each registered tool adds bounded
`Academy routing context` metadata from `src/routing-context.ts`, including Korean
teacher request phrases, the backend/source identity and the meaning of the result.
The neutral bridge applies the same mapping to its active discovery catalog.
Descriptions guide selection; they do not change admission, authentication or schemas.

| Teacher intent | MCP route | Backend/source and scope |
| --- | --- | --- |
| Read today's or a previous lesson date's DailyRecord | `academy_dailyrecord_get` | `DayRecordServlet`, `p_process=Main`; `academy.lms.dayrecord`. Resolve the dated occurrence within owner admission. A past lesson date is not a request for a saved snapshot. |
| Read DT/result metadata by exact student name/date | `academy_student_metadata_get` | `DtResultSearch`, `UserBySearchTestResult`; independently admitted `academy.lms.metadata`. The keyed `academy_student_metadata` route remains compatible. |
| Read an exact numeric item's official answer literal | `academy_item_answer_lookup` | `TestPageShowExServlet`, `p_process=GetLectureList`, `lecture_list`; numeric `lectureKey`. Literal candidates are not qualified official rendering. |
| Find existing type labels after teacher research | `academy_item_label_scope`, `academy_find_item_labels`, `academy_review_type_questions` | Original hierarchy IDs and type labels from the configured owner source. Keep these distinct from numeric answer labels and final item selection. |
| Read a printed-code paper definition or student attempt | `academy_paper_definition_lookup`, `academy_printed_paper_lookup` | Owner-decoded source code and paper/attempt identity. A common definition does not establish a student's assignment or attempt. |
| Read historical retained teacher context | `academy_query`, `academy_teacher_query`, `academy_teacher_report` | Preserved source only. Collection, retrieval and lesson dates remain separate. Continue required pages; do not claim a live refresh. |
| Inspect source contracts or runtime identity | `academy_capabilities`, source-contract and identity tools | Metadata only. Contract presence and artifact hashes do not establish current source availability or permission. |
| Review candidate or paper-plan metadata | Pool review/preparation tools | Local review with no backend command. Results do not establish generation, printing, delivery or teacher acceptance. |

The bridge retains `upstreamName` and endpoint ownership. A `class2_` compatibility
prefix means a separate `paper2` owner scope, not an inferred school class/cohort.
When saved and native tool names collide, the native name remains and the saved
route uses `saved_<original-name>`. Its description explicitly preserves historical
scope. Neither prefix grants permission to another endpoint or namespace.

Preserve backend fields and unknowns in answers. A score of zero, blank cell or
absent row does not identify submission, server grading or teacher final completion.
Original-error clinic, similar clinic, advanced clinic, CISM learning support, a
printed snapshot and distribution are separate observations. Do not translate a
local correctness calculation into server grading or clinic completion. Keep exact
book edition, unit/type hierarchy, source-issued identity and dated occurrence.

Only report coverage actually returned: source/endpoint, observation time, selected
period/filter/page, actor/subject namespace, and unknown or unavailable stages.
Past saved context and newly retrieved code are not live student-data coverage.
When source meaning or the teacher's intended subject/stage is ambiguous, ask a
focused interview question before choosing a conflicting meaning. Do not invent
keys or status crosswalks to make a tool callable.

Mobile operation names recovered from an APK are source evidence, not available
MCP capabilities. A mobile adapter requires a genuine admitted account/session,
current read-contract qualification and source-issued subject/operation IDs.
Web and mobile credentials, principal IDs, `p_no`, `testing_no`, `q_code` and
`lectureKey` require evidenced crosswalks; similar-looking values are insufficient.
No new save, send, print, grade or generation operation is introduced here.

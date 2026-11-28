# Direct-key historical lookup of textbook results: `academy_textbook_section_results_get`

## Purpose

`academy_textbook_section_results_get` finds a student's textbook through the live list
`getTextBookProgress`, which holds only the books in progress: an archived textbook or exam
(an old book number) is absent from it, so its results cannot be read today although the LMS
still answers for its keys. This contract adds a read-only fallback that takes the keys of
such a book from the `edu-academy-memory` bindings or from explicit verified parameters and
reads the results directly. It also fixes the read-only report views of `ReportViewServlet`
and the account-lock rule that every Academy read of the TypeScript server follows. It is
relied on by the teacher's lesson and counseling sessions, by the tool surface
([tool-surface.md](tool-surface.md)), and by the units that build and check the fallback.

## Requirements

- R1: When the live `getTextBookProgress` list holds the requested book, the tool answers as before and its answer has no `bindingSource` of `historical_key_registry`. A call with neither `bookLabel` nor the three keys of R2 is the live call of before in every case, an empty live list and its refusal included. Tests: `direct_key_r1_live_list_answers_as_before`.
- R2: When the live list does not hold the requested book, the tool takes `(courseKey, bookNo, studentKey)` from the student's active bindings of `edu-academy-memory` (the lines `- book_no=<n> course_key=<k> ...` of `## bindings (active)`, as `due` lists them under `bindings`) or, when the caller gives all three, from the explicit parameters `courseKey`, `bookNo` and `studentKey`. An explicit `studentKey` must be the key of the student that `displayName` names, or the call refuses with `historical_key_unverified` before any request of the fallback; explicit keys that the live list holds take the live path of R1. A live list with no book counts as a list without the requested book. Tests: `direct_key_r2_explicit_and_memory_keys`, `direct_key_r4_keys_verified_never_guessed`.
- R3: With those keys the tool sends only the read-only requests `getWrongAnswerNoteResult` and `getCourseBookReport` of the Interface and, when the call gives `sourceTitles`, the single-user result `getStudyResultSingleTestingSingleUser` of each attempt that the wrong-answer note answered for the requested title; it never sends the paper search `UserBySearchTestResult` or `UserByMain`. It answers the section results with `bindingSource: 'historical_key_registry'`. A requested title that the wrong-answer note does not hold refuses as not observed (`not_observed_in_either_source`), and no score is made up for it. Tests: `direct_key_r3_only_the_read_list`.
- R4: Keys are verified, never guessed: the course, book and student keys that the answered report page carries must equal the keys sent, or the call refuses with `historical_key_unverified` and answers no row. Every row of the wrong-answer note carries the student key as `pri_no` and a `cls_no` that is 0 or the course key (live fact, 2026-11-28: the LMS sends `cls_no` 0 on every row of `getWrongAnswerNoteResult`, so the course is verified by the request scope, `courseKeyList`, `bookNoList` and `userKeyList` each holding exactly the one requested key, and by the keys that the course-book report echoes; a nonzero `cls_no` that is not the course key, a missing or different `pri_no` refuses); the course-book report answers `SERVER_RET = OK` with a book title, the student's name, every key it echoes equal to the key sent, and, when a book label is known (the caller's `bookLabel` or the binding's label), a title that agrees with that label. A failed course-book report verifies nothing. A verified report with an empty wrong-answer note (an all-correct book) answers an empty index. Tests: `direct_key_r4_keys_verified_never_guessed`, `direct_key_r2_explicit_and_memory_keys`, `direct_key_cls_no_zero_rows_are_in_scope`, `direct_key_cls_no_other_course_refuses_historical_key_unverified`.
- R5: A book that neither the live list, an active binding nor explicit parameters give refuses with `historical_binding_missing`; two active bindings of the same `book_no` with different `course_key` refuse with `historical_binding_ambiguous`; neither sends a request after the live list. For a call with `bookLabel` and no explicit keys the order is: a label that selects one live book takes the live path; a label that fits several live books asks (`interview_required`) as before; otherwise the active bindings are read: one binding that the label selects (exact label first, then the loose brand, grade-term and volume match) whose `book_no` and `course_key` keep the key rule of R6 gives the keys of R2, and bindings of different books that the label fits are asked as `interview_required` with their `{bookLabel, bookNo}`. When no binding fits (also with no reader of the bindings, or a binding whose `course_key` is not a key such as `CK-12`), a live list with books asks with its own candidates as before, and an empty live list refuses with `historical_binding_missing`. Tests: `direct_key_r5_missing_and_ambiguous_bindings`.
- R6: A key that is not a positive integer of 1 to 16 ASCII digits, the first not 0, at most 2^53 − 1 (the largest safe integer), refuses with an invalid input before any LMS request, and so does a call that gives one or two of `courseKey`, `bookNo` and `studentKey` without the others. Tests: `direct_key_r6_key_rule_before_any_request`.
- R7: The fallback reads `edu-academy-memory` only: it never binds, unbinds or writes an observation. Tests: `direct_key_r7_memory_read_only`.
- R8: The report views of `ReportViewServlet` that a tool may read are exactly `SmartBookReportView`, `DiagReportView`, `NewStudentReportView`, `FaView`, `GaReportView` and `NaScoreResultView`, each only as `POST /servlet/controller.common.ReportViewServlet` with the form body `p_process=<View>&...` of the Interface (the form of `StudyLink.exe` at `0x4692e0`); such a POST is classed read, and the same path by any other method, with its view in the query, or with any other view name is classed write. Any other view name refuses with `report_view_name_invalid` before any request, and a view whose form the Interface does not give refuses with `report_view_form_unavailable` before any request. The answer is the JSON of `SERVER_RET = OK`; a login page, a session page or a redirect refuses with `authentication_required` (R11), any other page with `report_view_unqualified`. Tests: `direct_key_r8_report_view_names`, `direct_key_r8_report_views_are_read_by_post_only`, `direct_key_r8_report_views_post_their_exact_forms`, `direct_key_r8_batch2_report_views_post_their_exact_forms`, `official_report_report_views_read_only_read_class_routes_i1_write_forbidden`, `official_report_ganga_na_score_smart_book_read_only_read_class_routes_i1_write_forbidden`.
- R9: I1 `write_forbidden`: under a mock transport that answers `write_forbidden` to every request whose route is classed write (by its named route and operation, never by its method alone, as [tool-surface.md](tool-surface.md) "Request classes" states) or that is not in the read list of the Interface, every call of R2 to R8 on the synthetic fixtures completes or refuses with its own code, and the transport records 0 `write_forbidden` requests. Tests: `direct_key_r9_write_forbidden`.
- R10: Account lock: before its first LMS request a call of the TypeScript server takes the shared account lock of `docs/academy-account-lock.md`, waiting up to 45 seconds, and holds it until its last request; when the lock is still held after 45 seconds the call ends with a tool error carrying `owner_account_busy`, and 0 HTTP requests are sent. A Rust owner that finds the lock held fails at once with `owner_account_busy`, and `edu lesson` retries for up to its `lockWaitSeconds`, as that document states. Tests: `direct_key_r10_account_busy`.
- R11: A page that is the LMS login page, a session-error page or a redirect to either refuses the call with `authentication_required` and answers no row (fail closed). Tests: `direct_key_r11_login_page_fails_closed`.
- R12: No error and no log line of the fallback holds a student name, a record text or a key value. Tests: `direct_key_r12_no_value_in_errors`.

## Interface

### Requests (the read list)

| Read | Request |
| --- | --- |
| live list | `POST /servlet/controller.coursemanage.TextBookManageServlet?reqCmd=getTextBookProgress`, body `student_name=<name>` (the request the tool sends today) |
| the live path as built | every other request the tool sends today when the live list holds the book, as its existing tests' fixture transports record them (the login exchange, the paper search `p_process=UserBySearchTestResult` of `TestPageListServlet`, and the single-user result `p_process=getStudyResultSingleTestingSingleUser` of `TestpageSelectExServlet`) |
| wrong-answer note | `POST /servlet/controller.common.TestpageSelectExServlet`, body `p_process=getWrongAnswerNoteResult` with `answerNoteResult` naming the one course, book and student |
| section detail (R3, with `sourceTitles`) | `POST /servlet/controller.common.TestpageSelectExServlet`, body `p_process=getStudyResultSingleTestingSingleUser` with `condition` naming one attempt of the wrong-answer note and the student |
| course-book report | `POST /servlet/controller.coursemanage.TextBookManageServlet`, body `reqCmd=getCourseBookReport&course_key=%u&book_no=%u&student_pri_no=%u` |
| report views | `POST /servlet/controller.common.ReportViewServlet` with one view of R8 as the form's `p_process`: `DiagReportView`, `FaView`, `GaReportView` and `NaScoreResultView` with `p_process=<View>&p_testing_no=<testingNo>&p_pri_no=<studentKey>&p_cls_no=<classNo>&p_limit_date=<YYYY-MM-DD or empty>`; `NewStudentReportView` with `p_process=NewStudentReportView&p_p_no=<paperNo>&p_apply_code=<applyCode>&clg_no=<collegeKey>` (the owner's college key when none is given); `SmartBookReportView` with `p_process=SmartBookReportView&book_code=<bookCode>&pri_no=<studentKey>`, `<bookCode>` matching `^[A-Za-z0-9._-]{1,64}$` (any other refuses with `report_view_params_invalid` before any request) |

Every POST of this list is a read: it changes no Academy data. The read list is the whole set that the mock transport of R9 allows; R1 keeps the live path's requests in it, so the unchanged live path passes R9. An example of the binding line, with
invented values: `- book_no=1234 course_key=56 label=Invented Book 2-1`.

### Answer

The members the tool answers today, plus `bindingSource`: `historical_key_registry` when the
keys came from R2. An answer of R2 without `sourceTitles` (the index) also holds:

| Member | Value |
| --- | --- |
| `index` | the titles of the wrong-answer note, each with its `sourceDate` |
| `indexBasis` | `wrong_answer_note_only` |
| `reportSummary` | `{bookTitle, period, myAverage, allAverage, chapterCount}` of the course-book report |
| `coverage` | `historical_wrong_answer_note_and_course_book_report_only_all_correct_sections_omitted_from_wrong_note_index` |

With `sourceTitles` it holds `records[]` as the live read does (score and per-item O/X).

### Codes

| Code | When |
| --- | --- |
| `historical_key_unverified` | R2, R4 |
| `historical_binding_missing`, `historical_binding_ambiguous` | R5 |
| `owner_account_busy` | R10 |
| `authentication_required` | R8, R11 |
| `report_view_name_invalid`, `report_view_form_unavailable`, `report_view_params_invalid`, `report_view_unqualified` | R8 |

### Account lock

The shared lock file and its order are those of `docs/academy-account-lock.md`; in Rust the
lock is taken by `OwnerRoot::account`, which does not wait. The TypeScript server's installed
endpoint command takes the same file with `flock --wait 45 --conflict-exit-code 75`
(`modules/academy-workbench/tools/academy-mcp/src/upstream-process.ts`), so it waits up to 45
seconds; the bridge reports flock's exit 75, and no other exit status, as `owner_account_busy`.
An endpoint identity accepts that prefix with its two options in either order, and the earlier
`flock --nonblock`. The path is host configuration and is not in this repository.

### Tests

`modules/academy-workbench/tools/academy-mcp/tests/direct-key-lookup.test.ts` and, for the report
views read by `academy_official_report_pdf_get`, `tests/official-report-pdf.test.ts`, with invented
keys and synthetic pages only.

## Not included

- Discovering the keys of a book that no binding and no caller names.
- Complete history: the fallback answers what the two reads answer for the keys.
- Changing the bindings of `edu-academy-memory`; that is its own `bind` and `unbind`.
- The view pages' members beyond their being read-only.

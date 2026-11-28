# Gated Academy writes: `academy_clinic_paper_{review,save}` and `academy_exam_paper_{review,save}`

## Purpose

Making a wrong-note or clinic paper for a student, and creating and assigning a formative
assessment (FA) or unit-exam paper, are Academy writes that the teacher does by hand today.
This contract lets the TypeScript server do them in two phases, `review` then `save`, in the
pattern of the CISM write (`apps/academy/dc-gang-a/src/lms/cismWeeklyProtocol.ts`): the review
reads the live page, pins its form by `wireSha256` and returns a `reviewToken`; the save
writes only that reviewed change, only with the teacher's explicit approval, records each
attempt before it writes, and reads the result back. After a crash the review reconciles the
open attempt by a read-only readback before any retry, so an exam paper created but not yet
assigned resumes at its assignment step. It is relied on by the teacher, by the skills that
call the tools ([tool-surface.md](tool-surface.md)), and by the units that build and check the
writes. Every refusal before a write sends no write request, of any HTTP method.

## Requirements

Review

- R1: `academy_clinic_paper_review` and `academy_exam_paper_review` send only requests whose route is classed read (Interface, "Request classes"), 0 write requests: they read the live page of the write, compute `wireSha256` over its write program (Interface, "Wire hash"), and refuse with `wire_hash_mismatch` when it differs from the value pinned for that page. For the exam pair (amended, "FA and unit-exam papers"): `academy_exam_paper_review` sends only requests of the read-classed routes of that section (the students, the items, and the readback of an unresolved attempt) and reads none of the pages; it does not read `TestPageRegServlet?p_process=Auto`, which allocates a fresh paper number at each load, so that page is read only inside the save (R6, R8); its `wireSha256` is computed from the four pinned values. Tests: `gated_writes_r1_review_sends_only_read_requests_and_reads_the_live_page`, `gated_writes_r1_a_drifted_or_missing_handler_is_a_wire_hash_mismatch_with_0_write_requests`, `gated_writes_pins_the_two_production_wire_hashes_exactly`, `gated_writes_without_the_test_seam_a_synthetic_page_is_a_wire_hash_mismatch`, `gated_writes_route_classes_read_only_without_a_create_flag_and_write_otherwise`, `gated_writes_route_classes_the_two_wire_pages_read`., `exam_writes_pins_the_four_production_page_hashes_exactly`, `exam_writes_the_page_hash_is_over_the_functions_in_the_order_listed_with_line_ends_normalized`, `exam_writes_without_the_test_seam_a_synthetic_page_is_a_wire_hash_mismatch`, `exam_writes_route_classes_read_and_write_by_route_never_by_method`, `exam_writes_r1_review_sends_only_read_requests_and_answers_a_preview_without_other_student_data`, `exam_writes_r1_a_target_is_exactly_one_row_of_the_student_search`, `exam_writes_r1_fa_review_of_a_source_paper_copies_its_items_by_outer_lecture_key`, `exam_writes_r1_da_review_reads_the_course_paper_and_needs_exactly_30_items`, `exam_writes_the_paper_exam_list_carries_outer_lecture_key_or_null_and_refuses_an_out_of_bound_value`
- R2: A review that passes answers `status: 'reviewed'`, the exact change it would make, and a `reviewToken` that is the SHA-256 of the canonical JSON of the change, the student and scope keys, the `wireSha256` and the review's expiry time, so the same review of the same page at the same expiry gives the same token; a token expires 15 minutes after its review. For an exam the token has no `studentKey`: the sorted `targets` (the strings `iden!priNo!gradeNo!classNo`) enter the canonical JSON in its place. Tests: `gated_writes_r2_the_review_token_is_the_sha256_of_the_canonical_change_scope_wire_hash_and_expiry`., `exam_writes_r2_the_review_token_is_the_sha256_of_the_canonical_change_targets_scope_wire_hash_and_expiry`

Save

- R3: A `*_save` call without `userApproved: true` (absent, `false` or any other value) refuses with `user_approval_required`. Tests: `gated_writes_r3_save_without_user_approval_true_is_refused_with_0_http_requests`., `exam_writes_r3_save_without_user_approval_true_is_refused_with_0_requests`
- R4: A `*_save` call whose `reviewToken` is unknown, already used, or was made by the other tool, or whose change differs from the reviewed change in any member, refuses with `review_token_invalid`. Tests: `gated_writes_r4_an_unknown_used_foreign_or_changed_token_is_review_token_invalid_with_0_http_requests`., `exam_writes_r4_an_unknown_used_foreign_or_changed_token_is_review_token_invalid_with_0_requests`, `exam_writes_qualify_exam_change_rebuilds_exactly_the_reviewed_change`
- R5: A `*_save` call whose `reviewToken` is more than 15 minutes old refuses with `review_token_expired`. Tests: `gated_writes_r5_a_token_more_than_15_minutes_old_is_review_token_expired_with_0_http_requests`., `exam_writes_r5_a_token_more_than_15_minutes_old_is_review_token_expired_with_0_requests`
- R6: Before each write a `*_save` call reads the live page again and refuses with `wire_hash_mismatch` when its `wireSha256` differs from the reviewed one. For an exam the save compares each live page with its pinned hash (the creation page in step A, the assignment page in step C), and the token's `wireSha256` must still be the one the pinned values give; a differing page is `wire_hash_mismatch` with no further mutating request: at step A the allocating GET has been sent (R15), at step C the writes of steps A and B stand. Tests: `gated_writes_r6_a_wire_hash_that_drifted_since_the_review_refuses_before_the_write`., `exam_writes_r6_a_token_whose_pinned_hashes_changed_since_the_review_refuses_before_any_request`, `exam_writes_r8_a_page_that_differs_from_the_pin_is_refused_at_step_a_after_only_the_allocating_get`, `exam_writes_r8_the_assignment_page_must_match_its_pin_and_a_paper_with_assignment_holders_is_refused`
- R7: A change that would publish a paper school-wide (to every class or every student of the academy, or to the public pool) refuses with `public_scope_forbidden`, at review and at save; a paper is created and assigned only to the students and classes the change names. For an exam, a target is one student (`iden` 1): a class (`iden` 2 or a class member) is refused `class_target_deferred`, a grade (`iden` 3), an academy-wide, public or missing target, and a `private_chk` other than 1 are refused `public_scope_forbidden`, with 0 HTTP requests, at review and at save. Tests: `gated_writes_r7_public_all_student_or_missing_scope_is_refused_at_review_and_save_with_0_http_requests`, `gated_writes_r7_a_key_that_number_cannot_carry_exactly_is_refused_at_review_and_save_with_0_http_requests`., `exam_writes_r7_class_grade_and_academy_wide_targets_are_refused_with_0_requests`, `exam_writes_a_class_target_member_in_the_save_change_is_refused_too`
- R8: The requests of a save are only login requests, optionally one initial before-state read, and, for each step of the reviewed change (one step for a clinic paper; for an exam paper the creation step, then the assignment step), at most one pre-write read that yields the `wireSha256` (R6), one write request and one readback read (R14); every request is on the routes of the table "Tools", and a save sends no browse query. For an exam paper (amended, "FA and unit-exam papers"): three steps, A (stage the items), B (save the paper), C (assign it), each with one pre-write read that yields its pinned hash or its check, one write and one readback read; step A's pre-write read is the allocating GET, a write-class request, and step C has two pre-write reads (the assignment page and `Validate`). The save sends the four write-class requests allocating GET, `SaveMunhang`, paper `Save` and assignment `Save`; the assignment of an already saved paper (R13) sends step C alone. Tests: `gated_writes_r8_a_save_sends_one_pre_write_read_one_write_and_one_readback_read`, `gated_writes_clinic_posts_the_exact_condition_for_every_mode_and_flag_combination`, `gated_writes_clinic_refuses_inputs_that_do_not_fit_the_mode_before_any_request`, `gated_writes_book_incorrect_posts_the_single_or_multi_user_condition_of_the_frozen_testing_numbers`., `exam_writes_r8_a_fa_save_sends_the_allocating_get_then_the_three_steps_and_reads_each_back`, `exam_writes_r8_a_da_save_adds_the_course_and_keeps_the_page_values`, `exam_writes_r8_a_fa_save_of_a_source_paper_stages_its_copied_items`, `exam_client_a_method_refuses_a_route_of_the_other_class_before_any_request`, `exam_client_a_route_of_its_class_is_sent_with_the_form_the_page_uses`, `exam_client_without_a_session_or_with_a_login_answer_it_ends_with_authentication_required`, `exam_writes_parse_the_xml_answers_of_the_three_steps`

Lock and ledger

- R9: Before its first LMS request a review or save takes the shared account lock of `docs/academy-account-lock.md`, waiting up to 45 seconds, and holds it until its last request; when the lock is still held after 45 seconds the call ends with a tool error carrying `owner_account_busy`, and 0 HTTP requests are sent. Tests: `gated_writes_r9_a_held_account_lock_ends_each_call_with_owner_account_busy_and_sends_no_request`.
- R10: A save records an attempt in the attempt ledger (state `open`, the `reviewToken`, the change's hash, the time) and records each step before that step's write request, each record made durable (written and synced to disk) before the request is sent; when a record cannot be made the save refuses with `ledger_unavailable` and sends no further write request. An exam attempt is recorded in each of its three steps (`examStep` A, B, C) before the step's write request, and its records carry `targets` and, once the allocating GET has answered, the `testno`. R10 rule 1 (the repository root): the root a ledger may not lie in is the nearest ancestor of the running module's directory that contains a `.git` entry (file or directory); when there is none (an installed bundle) it is the running module's own directory. A ledger equal to or below that root is `ledger_unavailable`; every other check of R10 (absolute, normalized, directory owned by the process uid and not writable by group or others, file 0600, nlink 1, no symlink) is unchanged. Tests: `gated_writes_r10_an_unset_relative_symlinked_or_loose_ledger_is_ledger_unavailable_before_any_request`, `gated_writes_r10_the_ledger_is_created_0600_and_each_record_is_durable_before_the_request_it_guards`, `gated_writes_r10_a_record_that_cannot_be_made_refuses_ledger_unavailable_and_sends_no_write`, `gated_writes_r10_records_survive_a_separate_process_and_a_corrupt_line_makes_the_ledger_unavailable`, `gated_writes_bridge_a_saved_paper_records_academy_writes_1_and_an_unconfirmed_post_records_an_unknown_effect`., `exam_writes_r10_an_unset_ledger_is_ledger_unavailable_before_any_request`, `exam_writes_r10_a_record_that_cannot_be_made_before_a_write_refuses_ledger_unavailable_and_sends_no_write`, `exam_writes_the_ledger_validates_exam_records_by_their_own_rule_and_clinic_records_by_theirs`, `gated_writes_bridge_a_saved_exam_records_academy_writes_4_and_a_dropped_assignment_records_an_unknown_effect`, `gated_writes_r10_a_ledger_inside_the_repository_is_refused_when_run_from_source`, `gated_writes_r10_an_installed_bundle_accepts_a_ledger_outside_its_own_directory`, `gated_writes_r10_an_installed_bundle_refuses_a_ledger_in_its_own_directory`.
- R11: A save of a change for which the ledger holds an `open` attempt of the same student and scope whose call is still running refuses with `attempt_already_open`; one whose call has ended without resolving it (a crash, or R14's `unverified`) refuses with `reconcile_blocks_retry` until a review has reconciled it (R12). For an exam, an attempt of the same family (its `scopeKey` starts with `<family>:`) whose kept `targets` intersect the new targets, tested on the kept lists and not on hashes, blocks the save in the same way, with 0 requests. Tests: `gated_writes_r11_a_live_lock_refuses_attempt_already_open_with_0_http_requests`, `gated_writes_r11_a_stale_lock_is_removed_and_the_unresolved_attempt_blocks_with_reconcile_blocks_retry`, `gated_writes_r11_a_stale_lock_with_no_unresolved_attempt_is_cleaned_and_the_save_proceeds`, `gated_writes_r11_an_unresolved_attempt_of_the_same_student_and_scope_blocks_a_save_other_scopes_are_not_blocked`., `exam_writes_r11_an_open_attempt_of_the_same_family_with_an_intersecting_target_blocks_a_save_with_0_requests`, `exam_writes_r11_a_live_lock_refuses_attempt_already_open_with_0_requests`, `exam_writes_r11_a_stale_lock_with_an_overlapping_unresolved_attempt_blocks_and_a_clean_one_proceeds`
- R12: A review of a change with an unresolved `open` attempt first reconciles it by a read-only readback of the server, with requests classed read only: it marks the attempt `persisted` when the readback shows every step, `partially_persisted` when it shows the exam paper created but not assigned, and `absent` when it shows no step; a readback that fits none of these leaves the attempt `open` and the review refuses with `reconcile_blocks_retry`. For an exam the readback is by the recorded `testno` ("FA and unit-exam papers"); a review whose students intersect an open attempt but differ from its students is refused `reconcile_blocks_retry` with 0 requests and answers the attempt's student keys (keys only). Tests: `gated_writes_r12_r13_a_before_write_attempt_is_absent_and_the_review_answers_a_fresh_token`, `gated_writes_r12_r13_a_response_received_attempt_is_persisted_and_the_review_offers_nothing_to_save`, `gated_writes_r12_a_write_dispatched_attempt_or_a_failed_readback_stays_open_with_reconcile_blocks_retry`, `gated_writes_r12_r13_a_crashed_save_is_reconciled_end_to_end_through_the_review`., `exam_writes_r12_a_review_that_names_other_students_than_the_open_attempt_lists_its_keys_with_0_requests`, `exam_writes_r12_r13_an_attempt_with_no_recorded_testno_or_no_staged_item_is_absent_and_the_review_answers_a_fresh_token`, `exam_writes_r12_any_other_readback_leaves_the_attempt_open_and_the_review_refuses_reconcile_blocks_retry`
- R13: After reconciliation, a `persisted` attempt is answered as done and offers nothing to save; a `partially_persisted` exam attempt is answered with a review of the assignment step alone on the paper already created, whose save sends the requests of that step only and never creates a second paper; an `absent` attempt is answered with a review of the whole change, under a new `reviewToken`. One case is added for an exam (amended): items staged and the paper not saved is `partially_persisted` too, and no tool continues it; the answer names the `testno` and tells the teacher that the staged number stays unused in the LMS, and a new review and save create a new paper from step A. Tests: `gated_writes_r12_r13_a_before_write_attempt_is_absent_and_the_review_answers_a_fresh_token`, `gated_writes_r12_r13_a_response_received_attempt_is_persisted_and_the_review_offers_nothing_to_save`, `gated_writes_r12_r13_a_crashed_save_is_reconciled_end_to_end_through_the_review`., `exam_writes_r12_items_staged_and_the_paper_not_saved_is_partially_persisted_with_no_continuation`, `exam_writes_r13_a_saved_paper_without_assignment_is_answered_with_a_review_of_step_c_alone_that_never_creates_a_second_paper`, `exam_writes_r13_a_step_c_save_that_refuses_before_its_write_leaves_the_attempt_open_for_a_review`, `exam_writes_r12_r13_an_assignment_read_back_for_every_target_is_persisted_and_offers_nothing_to_save`
- R14: After each write a save reads the page back and answers `status: 'saved'` only when the readback shows every step of the reviewed change; otherwise it answers `status: 'unverified'`, keeps the attempt `open`, and sends no further write request (an exam paper whose creation is not read back is not assigned). For an exam, `saved` needs the readback of all three steps; an answer that fits none is `unverified` (or a refusal with `effectStatus` `unknown`), the attempt stays `open`, and no later step is written (an exam paper whose staging is not read back is not saved, and one whose saving is not read back is not assigned). Tests: `gated_writes_r14_an_unconfirmed_write_answers_unverified_and_keeps_the_attempt_open`, `gated_writes_r14_a_failed_write_request_leaves_the_attempt_open_at_write_dispatched_and_rejects`, `gated_writes_r8_a_save_sends_one_pre_write_read_one_write_and_one_readback_read`., `exam_writes_r14_a_failed_or_unconfirmed_step_leaves_the_attempt_open_and_sends_no_further_write`, `exam_writes_r10_a_request_that_fails_after_a_write_leaves_the_attempt_open_and_a_dropped_write_is_rethrown`

Refusals and privacy

- R15: Every refusal before a write (R1, R3 to R7, R9, R11, R12, an invalid input, and `ledger_unavailable` of a step not yet written) sends 0 write requests, of any HTTP method; the refusals found from the input alone (R3, R4, R5, R7) and R9 send 0 HTTP requests at all. Amended for the exam pair: a refusal at step A's pre-write read (`wire_hash_mismatch`, `option_not_on_page`, `make_college_missing`, no paper number) has sent exactly one write-class request, the allocating GET, and resolves the attempt `absent` (a number allocated, nothing staged); every other refusal before a write sends 0 write requests; no refusal sends a POST. Tests: `gated_writes_r15_every_refusal_sends_0_write_requests_of_any_method`., `exam_writes_r15_an_input_that_does_not_fit_is_refused_with_0_requests`
- R16: No answer, error, ledger record or log line holds a student name, record text, cookie or password; the ledger holds keys and hashes only. Amended for the exam pair: the review's answer (`preview` and `change`) may hold each target's `studentName` and class name, and the save's `change` carries `studentName` for step C's `Validate` query and readback; the ledger, every error, every save answer and every log line still hold none (the bridge log keeps only `resultSha256`). Tests: `gated_writes_r16_no_answer_or_record_holds_a_name_cookie_or_password`., `exam_writes_r16_no_save_answer_error_or_record_holds_a_name_cookie_or_password`

## Interface

### Tools

| Tool | Write | Routes |
| --- | --- | --- |
| `academy_clinic_paper_review` / `_save` | wrong-note paper of a book (`kind: 'book_incorrect'`), or the similar and advance clinic papers of one attempt (`kind: 'clinic'`); one step | `GET /servlet/controller.coursemanage.TextBookManageServlet?reqCmd=getTextBookMain` and `GET /servlet/controller.tutor.fa.TestPageListGrpServlet?p_process=Main` (the pages whose inline handlers are pinned; read), and `POST /servlet/controller.common.TestpageSelectExServlet`: `getWrongAnswerNoteResult` (read), `getStudyResultSingleTestingSingleUser` or `getStudyResultMultiTestingMultiUser` with a `create:1` condition (the write), and `getStudyResultSingleTestingSingleUser` with `score:{create:1}` and no other create flag (the clinic readback; read) |
| `academy_exam_paper_review` / `_save` | FA (`fa`) or unit-exam (`da`) paper and its assignment to named students, three steps: stage the items, save the paper, assign it | the routes of the section "FA and unit-exam papers": `TestPageRegServlet`, `TestHangServlet` (both under `controller.tutor.fa` and `controller.tutor.da`), `TestpageSelectServlet`, `TestpageSelectExServlet` (`getTestExamList`), `ObjectSelectServlet` and `DiagnostManageServlet` |

`*_save` takes exactly `reviewToken`, `userApproved` and the reviewed change; `*_review` takes
the change and its scope (student keys, book and section keys, or paper keys).

### Request classes

A request is classed read or write by its named route and operation, as
`apps/academy/dc-gang-a/src/lms/lmsRouteRegistry.ts` and
`apps/academy/dc-gang-a/src/lms/endpointCandidates.ts` class them, never by its HTTP method: a
GET can write and a POST can read. A route that neither classes is classed write until the
unit that adds it classes it.

`POST /servlet/controller.common.TestpageSelectExServlet` is classed by its operation (`p_process`) and, for the three
score and clinic operations, by its `condition` form member
(`testpageSelectExRequestEffect` in `lmsRouteRegistry.ts`, mirrored in the fixture classifier
`tests/network-deny.ts`): `getWrongAnswerNoteResult` and `getTestExamList` are read;
`getStudyResultSingleTestingSingleUser`, `getStudyResultSingleTestingMultiUser` and
`getStudyResultMultiTestingMultiUser` are read only when `condition` is present, parses to a JSON
object and none of `incorrect.create`, `similar.create`, `advance.create` equals 1 (the score
views send `score:{create:1}` and the other flags 0), and write when any of them equals 1 or when
`condition` is absent or malformed. The two pages `GET …TextBookManageServlet?reqCmd=getTextBookMain`
and `GET …tutor.fa.TestPageListGrpServlet?p_process=Main` are read.

The routes of the exam pair are classed by two standalone lists in `lmsRouteRegistry.ts` (`EXAM_READ_ROUTES` and `EXAM_WRITE_ROUTES`, mirrored for the fixtures in
`tests/network-deny.ts`; `endpointCandidates.ts`, the catalog and the function-relation map are not edited), by path, operation and method, never by the method alone:
read are `getTestExamList`, `DiagnostManageServlet` `reqCmd=GetPaperNo`, `ObjectSelectServlet` `reqCmd=getStudentList`, the `TestPageListServlet` `UserByMain` and
`UserBySearchTestResult` routes, the `TestPageRegServlet` `reqCmd=CheckMunhang` and `p_process=AutoModify` pages and the `TestHangServlet` `p_process=Main` and `reqCmd=Validate`
pages, each under `controller.tutor.fa` and `controller.tutor.da`; write (only inside the save, under the ledger lock) are the allocating `TestPageRegServlet?p_process=Auto`,
`TestpageSelectServlet?reqCmd=SaveMunhang`, the `TestPageRegServlet` `reqCmd=Save` POST and the `TestHangServlet` `reqCmd=Save`. A route neither list names is write. The client
refuses a route of the other class (`exam_route_class_mismatch`) before any request leaves. `TestPageListGrpServlet` is not used by the exam pair.

### Wire hash

`wireSha256` is the SHA-256 of the page's write program: the source text of the functions
the write calls, line ends normalized to `\n`, joined by `\n`, as the CISM write computes it.
The value for each page is pinned by the unit that implements its tool, in the tool's source
and its test; this contract pins the computation, not the values.

For the clinic tools the program hashed is the page's own inline handler, selected with
`selectSourceFunction` from the page text (`\r\n` normalized to `\n`): `createBookIncorrectPapers` on
the `getTextBookMain` page (`4794a5e8353e93f481d3f5cb4bc448c42e0b314413e55068900d51165893bf8c`) and
`externOnCreateOneClinicPaper` on the tutor.fa `TestPageListGrpServlet` `Main` page
(`3f726b828586a15d3ed7c2071e63207a54cec231f168e1f838ffdae0f75447fa`). Both call
`MODULE.Typeset.createResultPaper` and `CLINIC_MODE` of the static `/jsutil/module.js`, which is
not fetched again on each call, so that R8's one pre-write read holds: a change of that static file is
not seen by the wire hash. This gap is accepted. A test may replace the two pinned values through the
`expectedWireHashes` option of the service so that synthetic pages exercise every path; a test pins
the two production values themselves.

For the exam pair `wireSha256` of the token is the SHA-256 of the UTF-8 text `<family>:` + the pinned creation hash + `:` + the pinned assignment hash of that family. Each pinned
hash is that of `selectSourceFunction` of each named function of the page text (line ends normalized to `\n`), in the order listed, joined by one `\n`:

| Page | Functions | SHA-256 |
| --- | --- | --- |
| fa creation, `GET …tutor.fa.TestPageRegServlet?p_process=Auto` | `validationTestInfo`, `requestSave`, `onSaveButtonClick` | `7c1ae5a66888e6d4f5aa0b3089bee77dda8e75a3c3c8a4da3b40b0d0f111df1e` |
| da creation, the same route under `tutor.da` | the same | `2c1c72d5a81a117afce22dc1f83c460e9db6b79a6adfdfbb26519d574206af3d` |
| fa assignment, `GET …tutor.fa.TestHangServlet?p_process=Main&p_no=<testno>` | `validate`, `onSave`, `showSaveResult` | `ed6e161327a83e13a305891dcecd1a0afc4c9b42dbc0eead1bf674c7c2cda7f3` |
| da assignment, the same route under `tutor.da` | the same | `1fa2e96e224d105d39684bcba248b2b6ae8f054bc7dff8388c81eeb0afc20e67` |

The review reads none of these pages (the creation page allocates a number at each load); the save compares each live page with its pinned value. A test may replace the four values
through the `expectedWireHashes` option of the exam service; a test pins the four production values themselves.

### Attempt ledger

One private file of the server's owner (mode 0600), outside the repository (R10 rule 1 says which root that is), set by the launch
argument `--gated-write-ledger <absolute path>` or else the variable `ACADEMY_GATED_WRITE_LEDGER_PATH`;
there is no default path. A path that is unset, empty, relative, not normalized, inside the repository,
a symlink, readable or writable by group or others, in a directory others can write, or that cannot be
written is `ledger_unavailable`, before any HTTP request. Every record is one JSON line, appended and
synced to disk before the request it guards, and holds keys and hashes only:

- `reviewed` (written by a review): `tool`, `reviewToken`, `changeSha256`, `studentKey`, `scopeKey`, `wireSha256`, `reviewedAt`, `expiresAt`.
- `attempt` (written by a save at each step, and by a review that reconciles): `attemptId`, `tool`, `reviewToken`, `changeSha256`, `studentKey`, `scopeKey`, `step` (`before_write`, `write_dispatched`, `response_received`, `reconciled`), `responseSha256` and `paperKeys` where known, `state` (`open`, `persisted`, `partially_persisted`, `absent`), `at` and `runId`.

For the exam pair (`academy_exam_paper`) a record has no single student: `studentKey` is absent and the record keeps `targets`, the sorted list of the target strings
`iden!priNo!gradeNo!classNo` (keys only, so R16 holds, `iden` 1 for one student), and `scopeKey` is `<family>:` + the SHA-256 of the sorted targets joined by newline. An exam `attempt`
record also carries `examStep` (`A`, `B` or `C`) and, once step A's pre-write read has given it, `testno` (digits); `step` keeps its four values per exam step. A clinic record keeps its
numeric `studentKey` and none of these members; a record of either tool that fits neither shape makes the ledger unusable (`ledger_unavailable`).

The `tool` of both tools of a pair is one family name (`academy_clinic_paper`), so a token of the
other family is `review_token_invalid`. A token is used once: any `attempt` record that carries it
uses it. The attempt of a call is the records of its `attemptId`; its state is that of its last record.

A call takes `<ledger path>.lock` by an exclusive create (`wx`, mode 0600) holding `{pid, runId, at}`
and removes it when it ends. A lock whose process is alive (`kill(pid, 0)` succeeds or is refused for
permission) is a call still running: `attempt_already_open`, 0 HTTP requests. A lock of a dead process, or one that
cannot be read and is older than 5 seconds, is stale: it is removed, and a save then refuses with
`reconcile_blocks_retry` when the ledger holds an unresolved attempt of that lock's `runId` (of any
attempt when the lock cannot be read) or of its own student and scope, else it goes on; a review takes the lock itself.

### Codes

| Code | When |
| --- | --- |
| `wire_hash_mismatch` | R1, R6 |
| `user_approval_required` | R3 |
| `review_token_invalid` | R4 |
| `review_token_expired` | R5 |
| `public_scope_forbidden` | R7 |
| `owner_account_busy` | R9 |
| `ledger_unavailable` | R10 |
| `attempt_already_open` | R11 |
| `reconcile_blocks_retry` | R11, R12 |
| `clinic_input_invalid` | a review input that fits no mode or kind (a count out of range, `patList` on `multiply` or `divide`, a member of the other kind), R15 |
| `clinic_scope_unresolved` | the wrong-note list of a book is empty, holds another student or a nonzero `cls_no` that is not the course key, holds more than 50 testing numbers, or lacks a requested testing number |
| `clinic_response_unverified` | `unverified` after a write whose answer lacks `result: 'OK'` and a valid non-empty `print_list` |
| `clinic_readback_unverified` | `unverified` after a write whose read-only scope readback failed |
| `class_target_deferred` | an exam target that is a class (`iden` 2 or a class member); class targets are not built yet |
| `target_not_found` | the student search of a target holds not exactly one row with that name and key |
| `target_lookup_unreadable` | the student search answered another shape than `{result: 'OK', student_list: [...]}` |
| `option_not_on_page` | `testgubunNo` (or for `da` `courseNo`) is not an option of the creation page |
| `make_college_missing` | the creation page's `makecollege` has no selected option and no option other than `-1` and empty |
| `invalid_item_order` | exam items not in the OMR order `obj`, then `sbj`, then `des` |
| `too_many_items` | more than 30 exam items |
| `course_paper_missing` | `GetPaperNo` answered no `pNo`, `0` or a non-number |
| `da_item_count` | the course paper of a `da` exam does not hold exactly 30 items |
| `stage_conflict` | step A's `SaveMunhang` answered `result_sqlerr` |
| `check_munhang_<n>` | step B's `CheckMunhang` answered a count of `-n` (`n` 0 to 7), 0 writes of step B; `check_munhang_unreadable` for any other answer |
| `save_failed` | step B's paper `Save` answered `UPLOAD_FAIL` |
| `assign_duplicate` | step C's `Validate` names students who already hold the paper (the names are not echoed), 0 writes of step C |
| `assign_validate_unreadable` | step C's `Validate` answered XML that cannot be parsed or holds no `result` |
| `assign_failed` | step C's assignment `Save` did not answer `result` `success` |
| `exam_response_unverified` | `unverified` after an exam write whose answer cannot be read |
| `exam_readback_unverified` | `unverified` after an exam write whose read-only readback failed or did not show the step |
| `exam_source_port_unavailable`, `exam_source_failed` | no LMS port is configured, or a request of the exam pair failed |
| `exam_route_class_mismatch` | a client method was called with a route of the other class (a programming error) |

### Clinic and wrong-note papers

`academy_clinic_paper_review` takes `kind` (`book_incorrect` or `clinic`) and `studentKey`, and by kind:

- `book_incorrect`: `courseKey`, `bookNo`, and optionally `testingNos` (positive numeric keys; default every testing number of the student's wrong-note list for that course and book, read by `getWrongAnswerNoteResult` with `answerNoteResult={courseKeyList:[courseKey],bookNoList:[bookNo],userKeyList:[studentKey]}`). `scopeKey` is `book_incorrect:<courseKey>:<bookNo>`. The change is `{kind, studentKey, courseKey, bookNo, testingNos}` with the testing numbers sorted and frozen. The write is one `POST` of `getStudyResultSingleTestingSingleUser` with `condition = {testing_no, pri_no, student_name: '', score:{create:0}, incorrect:{create:1}, similar:{create:0}, advance:{create:0}, report:{create:0}}` for one testing number, or of `getStudyResultMultiTestingMultiUser` with the same flags and `user_list:[{pri_no, student_name: '', testing_list:[{testing_no}…]}]` for several. The readback is `getWrongAnswerNoteResult` again, which must answer `result: 'ok'` and still hold every reviewed testing number. Every row of that list carries the student key as `pri_no` and a `cls_no` that is 0 or the course key (live fact, 2026-11-28: the LMS sends `cls_no` 0 on every row); the course is verified by the request scope, which holds exactly the one course key, the one book key and the one student key. A row of another student, or of a nonzero `cls_no` that is not the course key, refuses with `clinic_scope_unresolved`. Tests: `clinic_book_incorrect_cls_no_zero_rows_are_in_scope`, `clinic_book_incorrect_cls_no_other_course_refuses_clinic_scope_unresolved`.
- `clinic`: `testingNo`, `clinicMode` (`multiply`, `divide` or `custom`, the values of `CLINIC_MODE` in `/jsutil/module.js`) and at least one of `createSimilar: true` and `createAdvance: true`. `scopeKey` is `clinic:<testingNo>`. A flag that is false or omitted is `{create:0}` with no other member. `multiply`: similar `{create:1, mode:'multiply', exam_cnt: similarCount ?? 1}` (1 to 20), advance `{create:1, mode:'multiply', exam_cnt:1}` (`advanceCount`, when given, must be 1). `divide`: similar `exam_cnt: similarCount ?? 10` and advance `exam_cnt: advanceCount ?? 10` (each 1 to 100). `custom`: similar `{create:1, mode:'custom', exam_cnt:0, pat_list}` with `patList` of 1 to 100 items `{pat_no ≥ 1, d4_cnt, d3_cnt, d2_cnt, d1_cnt}` (each count an integer from 0 to 100, their sum at least 1, `pat_no` unique), advance `{create:1, mode:'custom', exam_cnt:1}`. `patList` on another mode, or a count for a flag that is off, is refused. The write is one `POST` of `getStudyResultSingleTestingSingleUser` with `condition = {testing_no, pri_no, student_name: '', score:{create:0}, incorrect:{create:0}, similar, advance, report:{create:0}}`; the readback is the same operation with `score:{create:1}` and every other flag `{create:0}`, which must answer `result: 'OK'` and a non-empty `print_list` of the student.

`student_name` is `''` in every request: no name is sent or kept. R7 refuses, with 0 HTTP requests, a `studentKey` that is absent, not a positive number of at most 15 digits (so that `Number(key)` in the posted condition is exact), `0` or `all`, a target key (`courseKey`, `bookNo`, `testingNo`) that is absent or not such a number, and any member whose name says public, all, everyone, academy or school wide, or pool.

The write answers `{result: 'OK', print_list: [...]}`. R14 for these tools: a save is `saved` (with `paperKeys` where the papers carry `p_no` or `paper_no`, and `printListSha256`) only when that answer holds a non-empty `print_list` whose papers each hold `exam_list` items with an `exam_no`, and the read-only scope readback succeeded; otherwise it is `unverified` and the attempt stays `open`.

The LMS lists no previously created clinic or wrong-note papers (the printed-check state of the browser is local to it), so R12 can decide an unresolved attempt only from its last recorded step and a read-only scope readback, never from the papers themselves. When the readback succeeds: a last step `before_write` is `absent` (no write request was sent) and the review answers a fresh `reviewToken`; a last step `response_received` is `persisted` (the write was answered with a valid `print_list`) and the review answers done with nothing to save; a last step `write_dispatched` is indeterminate (the write request may or may not have made a paper). When the readback fails, every case is indeterminate. An indeterminate attempt stays `open` and the review refuses with `reconcile_blocks_retry`, the same code that a save gives. There is no automatic way out of it: the teacher inspects the LMS by hand, and the operator resolves the attempt in the private ledger file; no call retries a write blindly.

### FA and unit-exam papers

`academy_exam_paper_review` takes `family` (`fa` or `da`, the servlet package `controller.tutor.<family>`); `testName` (1 to 50 characters, no surrounding space or control character; it is also
`keyword_title`); `testgubunNo` (a positive integer that is an option of the creation page's `testgubun`, never -1); for `fa` exactly one of `sourcePaperNo` (an existing paper whose items are copied)
or `items` (1 to 30 `{key, type}` with `key` the `outer_lecture_key` in digits and `type` `obj`, `sbj` or `des`, in that order); for `da` `courseNo` (an option of the DA creation page's `courseNo`;
the 30 items are those of that course's paper, not chosen by the teacher); `targets` (1 to 40 `{studentName, studentKey}`, one student each); `start` and `end` (`YYYY-MM-DDTHH:MM`, start before end)
and `testingMinutes` (1 to 300). It answers `{reviewToken, wireSha256, preview, expiresAt}` and the frozen `change` the save takes back. The `preview` shows the family, the name, `testgubunNo`,
the item count by type, each target's `studentName` and class name, and the period, and no other student data.

What the review reads (all classed read): each target by `POST ObjectSelectServlet reqCmd=getStudentList` (exactly one row with that `pri_no` and `student_name`; its `grade_no` and `cls_no`
give the objecter entry `1!<pri_no>!<grade_no>!<cls_no>`); for `fa` with `sourcePaperNo` its `getTestExamList` (an item's key is its `outer_lecture_key`; a row without one is
`paper_exam_list_unverified`); for `da` `DiagnostManageServlet reqCmd=GetPaperNo&assNo=1000&courseNo=<n>&level_type=<1 when testgubunNo is 1320, else 0>` and then that paper's `getTestExamList`.
It does not read `TestPageRegServlet?p_process=Auto`.

The save runs three steps in one call, each recorded in the ledger before its write:

- Step A, stage the items. Pre-write read: `GET TestPageRegServlet?p_process=Auto`, a write-class request that allocates the paper number; it is recorded as dispatched first, its page is hashed against the pinned creation hash, its form1 must hold every member of the fa page, `p_original_testno` gives the `testno` (recorded in the ledger), and `testgubunNo` (and for `da` `courseNo`) must be an option of its selects. A refusal here has sent only that request and resolves the attempt `absent`. Write: `GET TestpageSelectServlet?reqCmd=SaveMunhang&p_original_testno=<testno>&exam_list=<key>|_|<1 obj, 2 sbj, 3 des> joined by |,|&ass_no=<1001 fa, 1000 da>&keyword_title=<testName>`; its XML answers `result_ok` with the staged totals (`result_sqlerr` is `stage_conflict`). Readback: `getTestExamList` of the `testno` has `total_cnt` items.
- Step B, save the paper. Pre-write read: `GET TestPageRegServlet?reqCmd=CheckMunhang` with the staged totals (count of 0 or less is `check_munhang_<n>`). Write: `POST multipart/form-data TestPageRegServlet?reqCmd=Save` (da adds `&courseNo=<n>`) with every form1 member of the Auto page at the page's value except `p_process=Save`, `testname`, `keyword_title`, an empty `title_option`, `testgubun`, `private_chk=1`, the staged totals, `grade`, `subject`, `book`, the four unit numbers, `p_original_testno`, `makecollege` (the selected option, else the first option other than -1 and empty) and, for `da`, `courseNo`; its answer page shows `UPLOAD_OK` (`UPLOAD_FAIL` is `save_failed`). Readback: `GET TestPageRegServlet?p_process=AutoModify&p_original_testno=<testno>` shows that number and the saved `testname`.
- Step C, assign. Pre-write reads: `GET TestHangServlet?p_process=Main&p_no=<testno>` (hash against the pinned assignment hash), then `GET TestHangServlet?reqCmd=Validate` with exactly the members of the save query (a `result` other than `success` names students who already hold the paper: `assign_duplicate`). Write: `GET TestHangServlet?reqCmd=Save&objecter=<targets, each followed by ->&title=<testName>&name=<testName>&munhangCount=<total_cnt>&sdate=Y-M-D (no zero padding)&shour&sminute&edate&ehour&eminute&testingTime&assYearMonth=<YYYY-MM of start>&applyType=1&pno=<testno>&testingno=&examPlayType=0&dummy=<time>`; its XML `result` is `success` (else `assign_failed`). Readback: `Validate` again with the same query: a non-success `result` that holds every target's `studentName` shows the assignment. This readback is inferred from the page's code and is confirmed or refused by the first approved live write; any other answer is `unverified` (R14).

The answer carries `academyWrites` (the write-class requests sent: a full save 4, step C alone 1, a refusal after the allocating GET 1, before it 0, or `null` when a sent write is not confirmed) and `effectStatus`: `persisted` (all three steps read back), `partially_persisted` (the last step read back, with the `testno`), `absent`, `none` (a refusal with 0 writes) or `unknown` (an attempt left open).

A save never resumes under its own token. The review is the only reconciler. It reads back by the recorded `testno` (`getTestExamList`, `AutoModify`, and step C's `Validate` with the review's own names and period) and answers: `absent` when no `testno` was recorded or the staged list is empty (a fresh review of the whole change); `persisted` when the paper exists and every target holds the assignment (nothing to save); the paper saved and no target assigned (R13): a review of step C alone on that paper under a new token, whose save sends only step C's requests and never a second paper (`munhangCount` is the staged list's length); items staged and the paper not saved (shown only by a readable AutoModify form1 that holds this `testno` and no name): no tool continues it, the answer names the `testno`; anything else, including a failed read, a staged count other than the reviewed item count and an assignment of only some targets, leaves the attempt open and is refused `reconcile_blocks_retry`.

Undo stays manual and unexposed: `TestHangServlet?p_process=Del&p_testingno=<id>` deletes an assignment; no tool deletes a paper. Not built: `TestHangServlet` `Modify`, `Del`, `ApplyDel`, `PreprocessForAutoScore`, `UpdateSave`, class targets and any academy- or grade-wide publication.

### Limits

| Limit | Value |
| --- | --- |
| Life of a `reviewToken` | 15 minutes |
| Wait for the account lock | 45 seconds |
| A page read | 2 MiB |

### Tests

The exam pair is tested by `tests/exam-paper-writes.test.ts` (the service over `tests/exam-write-fixture-lms.ts`, a recorded synthetic LMS that models the allocation, staging,
saving and assignment of a paper) and `tests/exam-write-client.test.ts` (the HTTP client's route classes); the bridge receipts are in `tests/gated-writes.test.ts`.

`modules/academy-workbench/tools/academy-mcp/tests/gated-writes.test.ts`, with a mock
transport that counts requests by route class (read or write) and by method, a scratch ledger
directory, synthetic pages and invented keys only. No test contacts the LMS. The synthetic LMS is
`tests/gated-write-fixture-lms.ts`; `tests/gated-write-fixture.ts` serves the audited clinic tools from it
as a dailyrecord endpoint, for the tests through the bridge (R9, and the write receipts of R10).

## Not included

- Deleting or changing a paper once created, and unassigning it (an exam assignment is undone by hand, see "FA and unit-exam papers").
- Printing the paper; that is `academy_paper_print_pdf_get`.
- Choosing which sections or items a clinic should hold; the review takes the change as given.
- The DailyRecord and CISM writes, which keep their own contracts.

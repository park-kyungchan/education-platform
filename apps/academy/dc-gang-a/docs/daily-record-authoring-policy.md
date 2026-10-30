# DailyRecord authoring policy

Revision: 2026-10-30. Owner: Academy DailyRecord workflow in this Education source checkout. This file records recurring user instructions; it is not a credential, effect approval, current student record or parent delivery receipt. It does not configure Hermes, Codex, Harness, a database or a global MCP client.

## Intake and field ownership

For each requested student and lesson date, include progress, homework, the previous lesson's homework assessment, today's DailyTest assessment, today's attendance and today's memo in the intake. Do not treat an earlier task's narrow field exclusion as a permanent ban when the user later includes a field.

| Field | Required source/decision |
| --- | --- |
| Progress and homework | Current user-provided or independently qualified exact student/lesson facts; preserve book, page and assigned scope. |
| Previous homework assessment | Independently identified previous lesson record and its assessment; it is not today's homework assignment or today's record key. |
| Today's DailyTest | Today's independently identified record and actual assessment option; question count and correct-answer rate do not establish the server's assessment value. |
| Today's attendance | Actual current input or an explicit user answer; a described lesson or test does not prove an attendance code. |
| Today's memo | A student-specific current notice or an explicit answer that there is no additional memo. `lessonMemo` is separate from persistent student notes. |

Use explicit user answers or qualified existing values. When a required value is absent, ambiguous or not attributable to the exact student/record, interview the user before writing that field. Never derive assessment codes, homework performance or attendance from a score, correct-answer rate, question count, activity narrative or assumed routine. Preserve values the user has already entered; do not replace them with a calculation or an older snapshot. Interview only for genuinely missing information, without repeating answers already supplied for that lesson.

Always ask about **today's student-specific memo** when no current content or explicit no-addition answer has been supplied. A prior lesson's “no memo” answer is not a permanent preference. “No memo” means no additional memo; it is not permission to erase an existing memo. Clearing or replacing existing text requires an explicit instruction for that field and record.

## Teacher-confirmed textbook and activity mapping

Before asking the teacher to identify an already mapped textbook, unit or printed section, consult the [printed textbook catalog and private binding entry](textbook-catalog.md). Reuse the qualified exact-edition result; ask only about a genuinely unresolved assignment or changed source binding. A book-level section guide is not a per-unit section inventory.

For preparation-time notebook and activity checks, use the separate
[class preparation checklist rubric](class-preparation-checklist-rubric.md).
Its notebook requirements do not imply that a student's notebooks were inspected.

Teacher correction dated 2026-10-28: assess homework against its actual assigned stages. When only solving was assigned, missing at-home grading or corrections is not incomplete homework. Corrections completed in class belong to that lesson's progress. Obtain the teacher's homework assessment code independently; this rule does not define an automatic grade or apply to an assignment that explicitly included corrections.

For an explicitly teacher-bound term-major-minor unit notation such as `1-4-2`, the first number is the semester, followed by major unit4 and minor unit2; there is no intermediate unit. Preserve the original notation and its attributable binding, then use the canonical major-minor coordinate `4-2` within that exact book. This rule is not permission to reinterpret other ambiguous historical three-number labels.

The teacher confirmed this notation on 2026-10-19. A textbook code such as `5-2-1` means grade5, semester2, series1. The last component is the series/volume, not a unit or test round. School stage, publisher and source namespace must come from the attributed source context; the numeric code alone does not identify them.

A unit code such as `2-1` means major unit2, subunit1. Do not introduce an intermediate unit. Keep the hierarchy `student -> textbook(stage/grade/semester/series) -> major unit -> subunit -> activity -> round`. Map the activity track separately from the textbook identity; vocabulary such as a clinic track name must not silently change the named publisher or book.

Do not interpret an ambiguous historical three-component unit label by stripping a prefix or treating a suffix as a round. Preserve its original literal and obtain an exact teacher/source binding. Apply a correction only to its identified activity and scope; do not remap all of a student's textbook history. Different activities can legitimately belong to different series.

Unless the teacher explicitly limits a DailyTest completion report to one round, it includes both basic and advanced rounds for each identified subunit. This default does not invent scores, a test date, physical print counts or completion of another activity. Correction of a previous DailyTest is separate from conducting a new DailyTest today. Class practice is separate from a homework assignment or an excluded homework activity.

A reported homework completion percentage does not establish a native letter grade. Obtain a teacher-bound grade for that case; do not turn one answer into a general conversion table. Keep internal conversion details out of the parent-facing memo unless the teacher explicitly requests them.

The machine-readable counterpart is `contracts/learning-activity-mapping-policy.json`. These rules describe interpretation, not verified native book/student/record IDs or permission to save or send.

## Parent-facing wording

Read relevant recent user-authored DailyRecords to align tone. Prior text is a style reference, not current evidence or a timeless rule. Preserve the user's meaning and previous edits. Keep parent progress, homework and today's memo separate from internal notes.

Remove internal judgment/status language such as “교사 완료판정”, “교사 최종 완료판정 대기” and internal approval/verification notes. Preserve distinctions between solving, grading, correction and later homework without claiming an unverified stage is complete. Use the existing `parentInternalLanguage` safeguard in `src/academy/teacherWorkspace.ts`; it is a bounded exclusion check, not complete language classification. Do not automatically strip words if that would change a factual statement or assignment instruction: rewrite for the parent with the user's meaning intact, or obtain clarification.

For clinic question lists, report the supported question count instead of individual item/type labels, IDs or label inventories. This does not remove necessary book names, pages or assigned unit ranges. Preserve the meaning of a supplied count, including duplicate-inclusive counts; do not silently deduplicate it. Unknown counts remain unknown. This parent-facing presentation rule does not change the exact type-label and question IDs required by the independent month-end search MCP.

Use only supplied or independently established homework deadlines. Do not invent dates to satisfy an older renderer's mandatory deadline input. A missing deadline is not today's date or the next routine lesson. A parent instruction copied from CISM must come from the exact teacher, requested reporting period and student's relevant section; restyle only that content. Do not create a weekly CISM conclusion from DailyRecord numbers, modify/submit CISM, or expose other students' original narratives.

## Compatibility and effect boundaries

`lessonJournalTemplates.ts` revision 3 retains the historical vocabulary/format and adds field-local parent-language blockers. A rendered legacy phrase is not clearance for parent text. Check its field blockers and the canonical parent-text safeguard before using it; excluded language must be rewritten and reviewed. Do not relax the canonical exclusion rule merely because a legacy fixture contains the phrase. Preserve original structured stages and evidence rather than rewriting their historical meaning.

The recurring intake preference does not grant future write authority. Every source save still needs current user scope, exact student/date/record/field binding, fresh before-state and the existing admission/readback checks. A prior completed or uncertain effect cannot be replayed under a new directory, preference or attempt ID. Resolve uncertain results by authoritative readback; do not automatically retry or roll back.

Saving DailyRecord fields and parent transmission are separate actions. Final sending, notifications, scheduling and bulk sending require a later explicit user instruction. Neither this policy, a template render, a successful save nor the existence of a pane grants that authority. Do not create clinics/homework assignments, alter unrelated attendance/assessments, generate papers, migrate a database or change global configuration as a side effect of authoring text.

Dated student-specific notices, one-day “no memo” answers, CISM narratives, credentials, source IDs and operational receipts stay in their private owner/work context. They are not copied into this policy, public frontend fixtures, repository history or the month-end label-search user context.

## Permanent line and mapping rules

Apply these rules on every new or explicitly replaced parent text field, independent of date, runtime or agent. Use only literal `- ` at the start of every nonempty line and a single LF between entries. Do not copy headings, numbered lists, tables or other formatting from historical tone samples. Existing stored teacher text remains untouched unless that field is explicitly selected for replacement. Empty text requires a separate explicit clear decision. `parentDailyRecordLines` in `teacherWorkspace.ts` owns the machine-checkable line grammar.

Keep the parent wording concise without losing any assigned scope. State each known deadline once above all entries to which it applies; render entries without a supplied deadline before dated groups so they cannot inherit a date. State a book once above its consecutive entries within each deadline group. Every line, including these shared lines, retains the `- ` prefix. Do not erase or shorten an existing field without a current instruction.

Group sections only for the same student, exact book edition, unit, activity and deadline. Whole minor units in the same exact edition may share one line when their activity and deadline are identical; list each unit code. Section-scoped work and chapter assessments retain their own unit and section mapping. Different activities or deadlines remain distinct. The display may omit `원본` before `오답클리닉` when that does not confuse it with another activity; preserve the original track and evidence in structured records. A missing deadline stays absent. Never join by book display name alone.

Three-number notation such as `가우스 5-1-2` means brand + grade5 + term1 + series2. Four-number notation such as `가우스 5-1-2-4` means brand + grade5 + term1 + major2 + minor4. The third number in a four-number coordinate is never the series. Resolve the student's actual edition independently; if multiple editions or school levels fit, always interview before linking. Unknown notation also requires an interview. New teacher answers are scoped corrections with evidence, not retroactive rewrites of imported originals or permission to alter native book registration.

Use `src/lms/dailyRecordLearning.ts` as the canonical runtime-neutral mapping/section validator and grouped renderer. Its trusted catalog is student/edition/unit scoped; MCP callers cannot supply a replacement catalog or verified flag. Book, unit and section refs must all resolve through the same binding. Keep printed/source/teacher-reported section bases distinct. Source status columns (homework, clinic, restudy status) do not become printed sections. Similar names are not aliases without explicit scoped evidence. `실력쌓기`, `실력다지기` and `실력올리기` remain different; chapter assessments retain their major node and never get an invented minor0/99. Middle-school Davinci has no inferred series; Gauss Plus is a separate brand.

Catalog coverage is observed-only. Missing sections, page boundaries and alias crosswalks remain unknown and require questions when needed; they are never unfinished homework. Teacher-confirmed completion survives an unresolved catalog link. An observed catalog does not prove a full printed TOC, current assignment or current source freshness. Keep real student catalogs and correction history in the existing private context repository; source tests use fictional students only.

The MCP review consumer requires the pinned owner learning validator and an explicitly configured namespace/teacher/student-to-retained-student bridge for changed progress/homework. Missing catalog, binding or section holds a catalog-mapped proposal for clarification. Rendering validates identity/format, not factual equivalence, assignment truth, approval, save or parent delivery. For progress reported by the teacher without an owner-catalog node, use the separate teacher-reported path: bind every displayed line verbatim to its scoped user-supplied fact, preserve existing text when adding to it, and keep any separately mapped lines under the canonical validator. This is an attributed teacher report, not a catalog binding or proof of completion. Never fabricate a textbook reference to pass a renderer. Homework still requires the catalog path.

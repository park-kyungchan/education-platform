# DailyRecord authoring policy

Revision: 2026-10-19. Owner: Academy DailyRecord workflow in this Education source checkout. This file records recurring user instructions; it is not a credential, effect approval, current student record or parent delivery receipt. It does not configure Hermes, Codex, Harness, a database or a global MCP client.

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

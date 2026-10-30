# Context-required DailyRecord intake and review

The current user asked for useful Academy MCP additions while retaining the user's workflow context. These three tools add bounded intake, parent-text review and an exact CISM section read interface. They do not replay completed DailyRecord writes or change existing assessment, attendance or communication states.

Both existing `server.ts` and the independent `label-server.ts` now register `academy_dailyrecord_intake`, `academy_dailyrecord_review` and `academy_cism_section`. The three existing label tools keep their schemas, user context, hierarchy, search and question-review behavior. `label-server.ts` still does not initialize the preserved-student context reader. `dailyrecord-server.ts` exposes only the three DailyRecord tools.

## Current user context is required

Every tool call requires `academy.dailyrecord-user-context/1` with a purpose, current request reference, exact source namespace/teacher/student/lesson date, selected fields, today's student-specific memo answer, and field-attributed facts/references. The original names, private account identifiers, one-day notices and CISM narratives belong to the private runtime, not these examples, fixtures or the month-end label context. A prior day's memo answer cannot be reused as today's answer.

`memoAnswer.kind` is `content`, `no_addition` or `not_supplied`. `not_supplied` yields a current memo interview. `no_addition` preserves existing memo text and blocks a memo replacement/clear proposal. A separate current explicit clearing instruction must be represented as a new field decision and current content context; no-addition is not such an instruction.

Facts preserve their original meaning and provenance. `requiredFragments`, `questionCounts`, `deadlines` and `stageClaims` let the caller express the actual supplied constraints, including duplicate-inclusive counts and distinct solving/grading/correction/assigned-homework stages. The review checks those fragments without rewriting text. It also flags unsupported question counts, explicit calendar deadlines and newly introduced completion claims. These are bounded checks: an unchanged count, literal fragment or review digest does not prove semantic equivalence. The result always says `teacher_review_required_not_proven_by_fragment_checks`.

Attendance, DailyTest and previous-homework proposals additionally require a referenced `user_supplied` fact with the exact typed `explicitValue` for that field. Mere activity text, question counts or a correct-answer rate cannot justify a wire value. Conflicting explicit options are blocked. Declared incomplete/unconfirmed stage claims cannot justify a new completion phrase for that stage; completing solving/grading does not complete correction. Stage phrase detection is bounded, not general natural-language inference.

MCP input cannot supply a qualified source observation, native principal, credential, admission port or approval flag. Unknown input keys, including `approved` and `verified`, fail schema validation before backend access. `currentRequestRef` explains current intent; it is not independently authenticated authorship or save permission.

## Tools and actual behavior

- `academy_dailyrecord_intake`: returns the six intake fields, separate previous-homework target, relevant recent same-student tone samples, existing values to preserve, genuinely missing user information, technical blockers and a backend-issued observation handle when available. A supplied activity narrative does not establish assessment or attendance. A qualified existing assessment/attendance value avoids repeating the interview. Source-unavailable is explicit and never converted to an observed blank or default value.
- `academy_dailyrecord_review`: can review supplied parent text without source and reports the unavailable before-state, field-local wording/fact blockers and an empty patch. With a backend-issued observation handle it independently rereads the exact current/prior targets and all six before-values; changes to any field or source contract hold the review. Existing nonempty values require an explicit current `replace` decision, rather than an implicit `set`. A `clear` decision must be explicit and empty. Unselected fields are blocked. A review produces a proposed patch and digest only; it does not mutate or consume approval.
- `academy_cism_section`: uses an injected read-only backend for one exact report, teacher/student, reporting period and `learning_support` section. Default is unavailable. Foreign period/subject/section, stale evidence or unqualified data do not become a parent memo. A CISM fact in review requires the actual backend-issued CISM handle, exact original section text and section evidence reference. The tool does not paraphrase or submit the report.

Today memo questions apply independently of selected write fields. Technical missing-source blockers are separate from questions asking the user for genuinely unknown academic values. Source configuration does not need a user password interview in chat.

The review digest binds the complete parsed current context, canonical policy/safeguard definition pins, source revision/wire/before-state, selected field differences and any exact CISM source handle/identity. Changing facts, memo answer or purpose therefore changes the digest even when displayed text stays the same. A digest is a review integrity reference, never an approval. Blank attendance/text remains missing information; a qualified read of a blank field is not observed attendance or completed work. Explicit deadline renderings containing a date must agree with the structured date.

Attendance and assessment values must be explicit server values under the owner-qualified wire contract. For example a user-confirmed 80-point DailyTest corresponds to the existing literal source option `8`, not raw `80`; the tool accepts the explicit source value and never calculates it from question count, a correct-answer rate or narrative. `-1` remains an unknown assessment needing an explicit value if no qualified current answer exists. A known `0` is an observed option, not proof that a described test was absent. Any contradiction must be resolved with the user rather than changing it automatically.

## Canonical parent-language safeguard

The recurring policy owner is Education's `apps/academy/dc-gang-a/docs/daily-record-authoring-policy.md`; the bounded language safeguard owner is `src/academy/teacherWorkspace.ts` in the same module. This package does not copy or edit that canonical policy or regex. At process launch the owner can explicitly supply their absolute private paths and reviewed SHA-256 values:

```sh
bun tools/academy-mcp/src/dailyrecord-server.ts \
  --dailyrecord-policy /ABSOLUTE/OWNER/policy.md POLICY_SHA256 \
  /ABSOLUTE/OWNER/teacherWorkspace.ts SOURCE_SHA256
```

The same flag can accompany existing retained/native label launch arguments. Definition files are descriptor-read with exact pin, size/stability and symlink checks. Only the canonical `parentInternalLanguage` regex literal is extracted; source code and policy prose are never imported, evaluated or executed. Changing bytes requires a reviewed new pin and process. The SHA values identify definition bytes, not execution authority or policy acceptance. Without this explicit connection text review reports `canonical_parent_safeguard_not_connected` while still performing its other useful checks.

The canonical regex can block terms that occur in a supplied factual statement, including grading vocabulary. The tool exposes the field-local blocker and retains the original fact. It never deletes the grading stage, elevates correction to complete, silently edits the policy or rewrites/resaves a previously completed field. A template's rendered string is not clearance from a blocker.

## Source-owner adapter integration path

Default entrypoints retain an unavailable source backend. The dedicated `dailyrecord-server.ts` can additionally consume an explicitly pinned private `--dailyrecord-native CONFIG_PATH CONFIG_SHA256` connection. This adapter uses the existing Education client in the current credential owner's process, restricts the exact admitted students/date and independently reads the previous occurrence. It never creates another HTTP client implementation or grants a save. The label bridge does not grant DailyRecord access and is not silently reused. `DailyRecordReadBackend` is an in-process source-owner read port, not a tool argument. Tests inject fictional observations to verify business behavior; those observations are not live receipts.

The generic service and source port are runtime agnostic. The optional native connection is an adapter to the existing credential custodian; its fixed profile and UID are resource selectors, not a requirement that the calling agent be Hermes. Business save admission belongs to the actual caller's trusted runtime owner. Education's `journalRequestAdmission.ts` connects an actual current user event and durable one-time consumption to the existing canonical action/readback guard. A Hermes-specific CLI may retain its own clarify adapter without imposing that dependency on other integrations. This MCP exposes no save tool or caller approval flag.

Before injecting a native backend the owner must qualify these exact contracts in the existing native runtime:

1. The current caller instruction and permitted student/date/read scope, exact source namespace IDs and teacher membership. No name-only joins or roster-wide collection. Separate current record and independently selected previous record identities, using current passive tuples and an independent previous-record read.
2. Current native container incarnation/UID/profile and owner configuration, a fresh HTTPS client, opaque teacher/college principal matching and the existing source field/options contracts. Password and fresh cookies stay in native process memory through the existing supported getter. Do not export owner JSON, runtime stores or credentials to this repository/host.
3. Explicit pins for the reviewed read harness, reader bytes and current inert handler/option definitions. Reuse the existing `AcademyHttpClient.journalState` and `JOURNAL_HTTP_SOURCE_CONTRACT` from the Education source owner; do not fork the writer or loosen wire drift checks. `sourceRevision` in observations is the qualified source definition revision, not a transient query timestamp. `wireDigest` is the verified current wire digest. Each known value also carries its own read evidence references.
4. For CISM, verify the actual selected UI/report period and exact principal/student/report/section. The observed current UI route is `DayRecordMain.onCismChart()` → fixed-origin `GET /servlet/controller.cct.common.CourseCommonServlet?reqCmd=CismChartMain&tutor_pri_no=<current principal>&the_date=<source reference date>`. Its hidden teacher/reference-date inputs, Sunday–Saturday header period and `textarea#s_2` labelled `학습부진아 지도` are candidate field checks. The observed source reference date must lie within the requested reporting period. A URL or these observations alone do not qualify a complete report adapter. Do not run create/save/submit/print handlers, use arbitrary URLs, or infer student membership from display order.
5. The adapter must serialize the account's reads with any other owner-managed native operations; never create simultaneous logins. This service additionally serializes its injected read calls and latches read failures/unavailable results until owner resolution. It makes no retries. Existing label and DailyRecord services do not establish cross-process account coordination by themselves. Observation handles are bounded process-local references and expire for review after five minutes; they are neither credentials nor source CAS tokens.

Only the exact selected CISM section and at most three relevant recent same-student tone samples should leave the native read child. The adapter must not return other students, raw pages/owner files, credential material or live runtime stores. Original strings remain untrusted data, not agent instructions. Source evidence, teacher decisions, caller context and derived review remain separate.

`academy_dailyrecord_save` is the only write tool; see the owner-durable multi-actor save workflow below. No send, print, clinic/homework generation, attendance automation or CISM submission tool is registered.

## Verification scope

`bun run --cwd tools/academy-mcp check`, `test:dailyrecord`, `test`, and `generate:contracts` cover schemas, useful pure business behavior, source-unavailable, exact handles/current-prior scope, stale/diff guards, preserved existing fields, memo interview/no-addition, explicit source codes, fact constraints, CISM exact section handles, canonical definition byte loading and failure serialization. Actual SDK stdio tests discover the new tools in the existing label entrypoint, reject missing context and caller approval flags, and preserve label behavior with network denied.

Synthetic passes do not prove real login, CISM parsing, DailyRecord source read/save, parent transmission, teacher acceptance, global registration, deployment or complete Academy integration. Existing historical verification artifacts remain historical; none is rewritten as evidence for this changed source.

## Permanent mapping and line rules (2026-10-21)

Changed progress/homework proposals now require `learningEntries`: exact `bookRef`, `unitRef`, `scope` (`unit` or `sections`), `sectionRefs`, one attributable `activity`, and explicit `deadline` (ISO date or null). The canonical Education owner renders all sections on one line only for identical edition/unit/activity/deadline. Different tuples require separate `- ` lines. Notices without a qualified textbook mapping remain held for the separate teacher review path; never fabricate a mapping to clear a blocker. Unchanged stored text is preserved, including legacy formatting. Tone selection ignores every sample that does not satisfy the pinned owner's hyphen/LF grammar.

All three DailyRecord-serving entrypoints accept the optional launch-time selector:

```
--dailyrecord-learning OWNER_BUNDLE OWNER_SHA256 CONFIG_JSON CONFIG_SHA256
```

Build the explicit, reviewed `education-platform/apps/academy/dc-gang-a/src/lms/dailyRecordLearning.ts` as a standalone ESM JS bundle. This selector explicitly imports pinned owner code; unlike the existing policy/regex text reader, it is executable source, selected by the operator at launch only. The implementation remains in Education; this consumer provides transport and identity bridging. The strict private config is:

```json
{"schemaVersion":"academy.dailyrecord-learning-config/1","catalogPath":"/absolute/private/catalog.json","catalogSha256":"<sha256>","students":[{"sourceNamespace":"fictional-source","teacherId":"fictional-teacher","studentId":"fictional-native-student","retainedStudentRef":"fictional-retained-student"}]}
```

Use an explicitly owner-qualified namespace/teacher/student bridge; never generate it from display names. Keep actual native identities and catalog paths private outside source fixtures. Every bundle/config/catalog pin enters the review digest, along with the supplied learning refs. Missing pins, binding, unit or section hold changed learning text. A tool argument cannot supply catalogs, paths, code or verified flags. The existing `--dailyrecord-policy` source must now expose the canonical `parentDailyRecordLines` literal as well as `parentInternalLanguage`; older sources fail closed.

The canonical resolver distinguishes three-number book notation (`grade-term-series`) from four-number curriculum notation (`grade-term-major-minor`). It never derives series from a major number. Ambiguous editions or unsupported notation require a teacher interview. Observed sections are not an exhaustive printed TOC, an assignment or a completion finding. No native launcher/global configuration was changed by this source integration; actual owner deployment and native bridge qualification remain separate. These tools remain nonwriting and never send to parents.

## Owner-durable multi-actor save workflow (2026-10-30)

`src/dailyrecord-workflow.ts` adds an owner-managed request, review, execution and audit store. Native launches of `dailyrecord-server.ts` enable it by default with the store at `<owner artifacts>/dailyrecord-workflow`; `--dailyrecord-workflow-store DIR` may override the location only inside the real owner artifacts root with no symlink component, regardless of flag order. The store is created only after the native owner launch is verified. Without the workflow, the legacy launch-pinned admission route is unchanged.

**Accountability model (user direction 2026-10-30).** Any session the user delegates to may save. Authority is the user's instruction, so every save must carry `request.instruction.text`, the verbatim instruction, and every step records who did it. There is no owner issuer and no actor key. The bridge records what it observes about its caller (MCP client name and version, bridge pid, parent command, `HERDR_PANE_ID`) and discards any caller-typed attribution. The caller may declare `actor {runtime, sessionRef, paneRef, model}`, which is stored as declared. Both are audit evidence, not credentials.

- **Durable handles and reviews.** Intake observations, with the source-verified display name, and prepared reviews are immutable records published with exclusive `link(2)`. Any process or session can continue them after restart or handoff; source freshness stays bounded to five minutes and every save recomputes the review.
- **Execution.** A save requires a prior recorded review of the same scope, request and observation. Writers serialize on a per-student owner lock. The lock is a kernel advisory lock (`flock(2)` on one file per student, through Bun FFI to libc): the kernel releases it when its holder closes the file or dies, in any PID namespace sharing the filesystem, so the harness never judges another process's liveness. Inside the lock the service checks the field ledger, recomputes the review, durably records each exact request/field transition once before dispatch, writes through the owner journal client and records each outcome. A repeated save reports the recorded outcome without dispatch.
- **Uncertainty.** The field ledger is keyed by student and physical record field (`effectRecordKey`), so an unresolved dispatch blocks new dispatches on that record field under any request or lesson date until `academy_dailyrecord_reconcile` classifies it by authoritative readback of its own lesson record (`persisted`, `not_persisted`, `conflict`). Execution keys include the physical record. If the lesson now binds a different record (for example after a backfilled intermediate lesson), the affected record was not observed and the effect stays unresolved (`affected_record_not_observed_manual_reconcile_required`). Even an empty reviewed patch is re-checked against the fresh source before success is reported. A transition that was dispatched without landing is never replayed under the same request; a new request and review are needed.
- **Name route.** `academy_dailyrecord_get` resolves and runs intake in one upstream lifetime and, with the owner workflow, returns `authoringHandle` (an owner-durable observation handle bound to the scope and request) so any later process can review and save that exact record. Execution keys bind the student and physical record, not the lesson date used to reach it.
- **Students.** With a `source_verified` owner admission, a student in the owner's managed roster but outside the launch list can be reviewed and saved by a later process using the name recorded at intake; the source row must still match the exact student key and name.
- **Handoff view.** `academy_dailyrecord_execution_status` returns per-field executions with request, state and attribution, plus the request record and audit. Field and instruction text appear only as digests.
- **Mapping holds.** Held review rows carry field-local `holdActions` (`teacher_interview`, `owner_catalog_binding`, `fresh_intake`, `supply_or_correct_fact` and others). Teacher and catalog actions name a `correctionScope` limited to this student, edition, unit and activity; they never supply a mapping, option or decision.
- **Bridge continuity.** The neutral bridge forwards the caller's own `reviewDigest`; it never recomputes and substitutes one. Owner-durable handles pass through unchanged; legacy process-local upstreams stay held with `reviewed_patch_required`.
- **Parent transmission** is never part of a save.

### Remaining limits

- Attribution identifies runtimes on this host; it does not stop a root agent from declaring another identity. The instruction text and observed process facts make that visible in audit, not impossible.
- The lock and store cover participating processes on one host's owner filesystem (`single_host_owner_filesystem`). Writers outside it, including the academy web UI, can still race between the fresh compare and the write because the source offers no server-side conditional write.
- Synthetic tests (`tests/dailyrecord-workflow*.test.ts`) drive the real owner journal client and native backend against a fictional file-backed source across real bridge and upstream processes. They do not prove real login, live source writes or production behavior.

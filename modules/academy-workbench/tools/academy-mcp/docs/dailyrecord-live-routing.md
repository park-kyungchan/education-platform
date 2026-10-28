# Live DailyRecord lookup

For a request to read today's DailyRecord, choose `academy_dailyrecord_get`.
Supply the user's exact student name, current purpose and request reference.
Omit `lessonDate` for today in `Asia/Seoul`, or use an explicit real ISO date.
The caller cannot supply a native student key, teacher, namespace, admission,
facts, memo answer, proposed values or approval flag to this tool.

The route checks the owner's admitted date range, resolves the exact name with
`academy_student_resolve`, and passes its returned key to
`academy_dailyrecord_intake`. Zero/ambiguous names, unavailable source,
unqualified or stale output, scope drift and dates outside admission stop
without automatic retry. Native current/prior record identity checks remain
in the existing intake/backend. The source fields and transmission state
remain observations. This lookup returns no review handle or patch.

With the explicit `source_verified` owner policy, the composed route passes
the lesson date to the resolver. The owner client discovers the source's dated
groups and projects the exact principal-qualified DailyRecord occurrence into
a name/key pair. A missing or ambiguous dated row stays unavailable; it does
not fall back to a recent test page or prove student absence. The later intake
independently verifies the dated current and previous occurrences.

`status: observed` and `sourceAvailability: observed` mean the read succeeded.
`preparation.interviews` records questions needed only if the user later asks
to author/review. No memo answer, attendance, assessment, fact or completion
is invented. Existing `academy_dailyrecord_intake` and review schemas retain
their complete current-context requirements and explicit source-option rules.

`academy_query` and `academy_source_status` concern preserved snapshots.
Their local retrieval time and historical access report neither refresh
the source nor establish current live availability. The status result now
states this scope and points to the live route.

## Owner admission

The native entrypoints accept a launch-only flag:

```sh
--dailyrecord-admission /ABSOLUTE/OWNER/admission.json REVIEWED_SHA256
```

The admission is descriptor-read with an exact pin, validated against
`ownerAdmissionSchema`, and bound to the native teacher and configured date.
Without it, the original exact single-date launch scope is retained. A range
changes neither the admitted student set nor any write/send authority.
`owner-admission-through-20261027.json` preserves the original October26
record and records the user's explicit read-only extension through October27.

## Neutral installation

`src/neutral-server.ts` is the maintained source for
`/root/.local/share/academy-mcp/server.ts` and its Bun bundle `server.mjs`.
`routing.json` selects only an admission path and its SHA256. The neutral
bridge resolves and intakes inside one upstream process/account-lock batch.
`endpoints.json` retains its original native getter, image, lock and artifact
pins; no credential value is included in registration or source.

Build the neutral bundle with `bun build src/neutral-server.ts --target=bun`.
Back up the installed registry before `--discover` (which refuses overwrite).
Discovery includes the route once, suppressing duplicate upstream copies.
Only new client processes load changed registry/endpoint bytes. Existing
sessions keep their loaded tools. Review tickets retain their existing
request/scope/signature/expiry checks; failures never latch later requests.
Receipts contain tool names, statuses, phase metadata and hashes only.

The fictional neutral SDK test runs with outbound networking denied and
proves a single upstream lifetime, strict caller schema and content-free
receipts. Fresh native E2E evidence is separate from source/synthetic tests;
the work record cites session/receipt metadata without student originals.

## Versioned read releases

An owner-issued `academy.owner-admission/2` record may explicitly use `null`
for either date bound. `studentScope` defaults to configured students; the
explicit `source_verified` option additionally permits an exact unique live
name/key match for the same request, with a five-minute in-process binding.
The DailyRecord row and previous occurrence still require exact principal,
student, course and membership qualification. This does not widen the
separate metadata namespace or authorize saves or sends.

An upgraded bridge optionally recognizes an owner-controlled `release.json`
under its existing install directory. The pointer references immutable,
SHA-256-pinned `routing`, `endpoints`, and `registry` files and is replaced
atomically only after those files and the routing-selected owner admission are
ready. It is read for every request, so already-running upgraded bridge clients
can converge on the new release without being restarted. The bridge compares
the selected admission digest with the spawned DailyRecord backend before any
source lookup. Invalid or mismatched releases, and removal of an adopted
pointer, fail closed. Existing pre-upgrade bridge processes cannot acquire this
behavior without a separately authorized upgrade. The release schema is
`academy.mcp-release/1`; see `src/runtime-release.ts` and synthetic release
tests for exact fields and checks. Do not mutate or overwrite pinned releases.

## Item answers

`academy_item_answer_lookup` reads a bounded set of exact numeric item labels
through the authenticated owner client. It returns the source's official
answer literal and explicit rendering/printed-paper limitations. It does not
interpret an unqualified literal as a rendered answer, infer a student
response, grade, save, print, or send. The existing source endpoint may return
an external solution reference instead of a literal answer. Production
exposure requires the owner bundle and neutral registry to be published as a
consistent verified release; local tests do not prove live availability.

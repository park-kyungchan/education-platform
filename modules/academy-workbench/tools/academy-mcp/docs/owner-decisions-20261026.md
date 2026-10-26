# Owner decisions 2026-10-26 (decider: user)

Recorded by the dedicated live-backend Lead. No credential values, no
private-store reads, no academy writes.

## G1 — admitted scope opened to 2026-10-26

- Range: 2026-10-23 through 2026-10-26 inclusive.
- Mechanism (D2 §6): the owner publishes an admission record
  (`docs/owner-admission-20261026.json`) carrying sourceNamespace, teacher,
  and the allowed date range. The bridge/backend compares the requested
  `lessonDate` against it and denies out-of-range dates with a named
  blocker. Fail-closed default stays 2026-10-23 when no admission record
  is present.

## G4+G3 — one resident owner process on this VPS

- Exactly one owner process holds the native chain (flock lock, docker
  image, pinned `/opt/data` artifacts, secret getter). Runtimes register
  connection-only entries (command + args, no env, no secrets).
- Secret material never enters files, registrations, receipts, or tests.

## G2 — resolver instead of a maintained table

- No hand-maintained saved↔native table. A name→native-ID resolver step is
  added to the tools: exact display-name match only; zero rows or
  multi-key collisions resolve to `unavailable` with a named blocker.
  No guessing, no sequential ID probing. Read-only, zero writes, failures
  close per request.
- One binding is live-proven (not maintained): on 2026-10-26T12:40Z a Meta
  session called `academy_daily_test_inventory(studentId=1293067)` and the
  returned row carried the saved-roster name, proving saved ↔ 1293067.
  Recorded with evidence in
  `docs/saved-to-native-id-mapping.schema.json`. All other students stay
  empty until resolver-confirmed.

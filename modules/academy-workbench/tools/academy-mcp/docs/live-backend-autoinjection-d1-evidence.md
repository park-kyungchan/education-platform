# D1 — Why academy_operations answers saved_context only (file-level evidence)

Date: 2026-10-26. Scope: read-only diagnosis. No credential values, no private
store reads, no academy writes. All paths below are exact file references.

## 1. Bridge mechanics

`server.ts` (bridge source, `/root/.local/share/muse/academy-runtime-20261023/`):

- `upstream()` (lines 13–18) spawns one child process per endpoint from
  `endpoints.json` and runs the call through a fresh MCP client each time.
- `--discover` (lines 19–32) builds `registry.json` with per-endpoint filters:
  the `saved` endpoint skips `academy_dailyrecord_*`, `cism`, `item_label`
  and review-type tools (line 24); the `dailyrecord` endpoint skips
  `academy_cism_section` (line 25). Tool exposure therefore differs by
  endpoint at registration time — the S4 defect.
- `call()` (lines 36–67) serializes all native batches through one promise
  chain (`tail`, line 71), writes dispatch/result/failure receipts with
  argument hashes only (lines 38–39, 60, 63–66), and records
  `academyWrites: 0, parentSends: 0, automaticRetryAllowed: false`.
- Any endpoint whose call errors or reports `sourceAvailability:
  'unavailable'` is added to `failed` (line 59) and every later call to it
  throws `source_reconciliation_required_no_automatic_retry` with no retry
  (line 14). One transient spawn failure latches the whole endpoint.
- DailyRecord review tickets are process-local, expire after 300 s, and are
  bound to scope + request ref; a fresh intake signature must match before
  review proceeds (lines 43–49, `signature()` line 35).

## 2. What the live upstream requires

`endpoints.json` declares 4 endpoints (keys only, no values reproduced):

- `dailyrecord`, `paper1`, `paper2`: `flock --nonblock <lock>` then
  `docker exec -i --user 10000` into a pinned image, where a python wrapper
  (a) verifies exact bytes+sha256 pins of the native bundle files
  (`native_launch_pin_drift` on mismatch), (b) requires the secret through
  the owner-side getter `get_env_value_prefer_dotenv` and exits
  (`native_http_secret_required`) when absent, then (c) execs the native
  MCP server with `--no-env-file` and hash-pinned arguments.
- `saved`: local `/usr/local/bin/bun --no-env-file .../src/server.ts`.
  No container, no secret, no lock.

Live DailyRecord additionally requires a qualified user context
(`registry.json`, intake schema): purpose, request ref, exact
teacher/student/date/namespace scope, selected fields, memo answer, facts.
`verify.ts` (lines 12–22) records the one owner-confirmed binding used on
2026-10-23 and the same-value review pattern (review returns `prepared`
with an empty patch and no write).

## 3. Registry and verification status

- `registry.json`: 17 tools — 3 `saved`, 2 `dailyrecord`, 6 `paper1`,
  6 `paper2` (paper2 exposed as `class2_*`). Native tool descriptions carry
  the pinned admission string for October 23, 2026.
- `verification.json`: `passed` at 2026-10-23T11:57:34Z (intake, review,
  class2 contracts). Point-in-time only; not proof of current liveness.
- Live `academy_source_status` on 2026-10-26: transport absent, direct
  server access unavailable, zero new reads, no automatic refresh.

## 4. Why this runtime is saved-only today

> Revision 2026-10-26T13:05Z: the "native spawn fails" claim below is
> PARTLY FALSIFIED by live evidence. `academy_daily_test_inventory`
> with the admitted ID returned live rows at 12:56:03Z from this very
> session (sourceRequests 5, auth 1). The paper1 chain works here; the
> earlier shell-PATH listing was not the bridge process's environment.
> The dailyrecord chain state in this run: latched (see §6). Saved-only
> remains true for unadmitted scopes and the latched endpoint.

Original 12:30Z observation (superseded for paper1):

Observed 2026-10-26 in the executing shell (names and presence only):

- Present: `flock`, lock file
  (`.../academy-class-operations-20261023/native-academy-account.lock`),
  `/usr/local/bin/bun`.
- Absent: the pinned container image (not in `docker images`), the
  `/opt/data/profiles/dc-gang-a-dev/artifacts/` tree, `docker`/`node` on
  PATH. Any `dailyrecord`/`paper1`/`paper2` spawn therefore fails before
  touching the academy server, and the bridge latches the endpoint.
- Secret presence was never probed by value; only the key name required by
  the wrapper is recorded here.

## 5. Per-runtime registration divergence (S4, confirmed by execution)

- Muse: `~/.config/muse/settings.json` → `mcpServers.academy_operations`
  runs the compiled bridge (`server.mjs`) with no env injection.
- Codex: `codex mcp list` (run 2026-10-26) returns no configured servers.
- Hermes: no CLI on PATH in this environment; profile wiring unverified.

## 6. Option-2 live findings 2026-10-26 (row-2 attempt for the owner candidate)

- Owner-maintained `academy-class-operations-20261023/native-config.json`
  holds an admitted-student table; the 이현승 row is the candidate ID used
  below (owner value, not guessed). Other rows are untouched and unproven.
- paper1 DT inventory with the candidate ID: `blocked /
  read_scope_not_admitted`, sourceRequests 0. The paper1 bundle's own
  admission does not include this ID. Deterministic; not retried.
- paper1 DT inventory with the proven ID (control): `observed`, live rows
  at 2026-10-26T12:56:03Z. Chain works from here.
- dailyrecord intake for the candidate on 2026-10-26: `blocked /
  source_reconciliation_required_no_automatic_retry` in this run and in a
  fresh subagent session sharing the bridge process — the endpoint latched
  after the run's first unavailable intake. No clean attempt is possible
  until a bridge restart (new run). Not retried.
- Row 2 stays empty. No fabrication.
- Update 2026-10-26T13:10Z (owner override A): paper1 admission extended
  (config 463→539 bytes, pins re-issued). Fresh-bridge probe at 13:00:36Z
  returned 3 rows, every row studentKey 1294575 / studentName 이현승.
  Row 2 FILLED as live-proven. Control 1293067 still observed (6 rows).
  The running session's bridge still holds old pins: paper1 calls there
  will pin-drift until bridge restart; new sessions use the new pins.
- Update 2026-10-26T13:20Z (G1 improvement): dailyrecord admission date
  2026-10-23 → 2026-10-26 (same bytes, new sha, pins re-issued).
  Fresh-bridge intake for 1294575/2026-10-26 → `interview_required`,
  source observed, observationHandle issued, target recordId 12, progress
  before known with native evidence. E2E path proven; no save performed.
  Tradeoff: 10-23 reads now refuse (single-date bundle). Revert = restore
  /tmp/owner-bak backups + re-pin. Running bridges (old pins) pin-drift
  on native calls until session restart.
- Same bridge, different connection material per runtime — exactly the
  structure S4 describes.

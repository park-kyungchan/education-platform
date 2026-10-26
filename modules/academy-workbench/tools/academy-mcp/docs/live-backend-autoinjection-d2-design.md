# D2 — Runtime-agnostic live-backend auto-injection (design)

Date: 2026-10-26. Follows D1 evidence. Read-only design; the October-23 to
today scope opening and the ID bindings below are owner gates, not decisions.

## 1. Principle

One MCP server, one exposure manifest, connection-only runtime differences.
The canonical manifest is `docs/runtime-exposure-manifest.json` (reads open,
writes closed). No per-runtime tool filter may remain in any bridge: the
`--discover` exclusions in the Muse bridge `server.ts` move into the single
manifest as data. Backend injection happens in exactly one owner process;
runtimes only carry connection material (command, transport, timeouts).

## 2. Owner process placement

Exactly one host holds the launch chain from D1 §2 (flock lock, docker
image, pinned `/opt/data` artifacts, secret getter). All runtimes reach the
native backends through that owner process. No CLI spawns `docker exec`
itself. Account-lock serialization stays in the owner, preserving the
one-batch-at-a-time contract (`server.ts` tail chain).

## 3. Per-runtime registration (connection only)

Each runtime registers the same server with its own connection entry:

- Muse: existing `mcpServers.academy_operations` entry stays, but env carries
  no secret material — only non-secret connection fields.
- Codex: add one `codex mcp add academy_operations -- <same server>` entry.
  Verified 2026-10-26 that none exists yet; adding it is an owner/user
  action, not done here.
- Hermes: register the same server in the profile MCP client when the owner
  confirms the profile host can reach the owner process. Unverified here.

No registration entry contains credential values. Ever.

## 4. Startup getter injection (implemented as pure preflight)

`src/live-preflight.ts` exports `assessInjectionReadiness()`, a pure
function over caller-supplied presence flags (booleans only — never secret
values, never IDs). Runtimes call it at startup to report which of the D1
§2 chain links is missing: flock/lock, bun runner, docker, image, pinned
artifacts, env getter key, admitted scope covering the requested date.
Missing links render tools `unavailable` with named blockers; nothing is
retried and nothing falls back to guessing.

## 5. Saved-to-native ID mapping (schema only, values owner-filled)

`docs/saved-to-native-id-mapping.schema.json` defines the `bindings` array.
Every value field ships `null`/empty: no binding is asserted by this change.
The bridge resolves `saved stu_*` → native numeric student, teacher,
namespace at intake time; unmapped scope returns `unavailable`, never a
guess. The single 2026-10-23 binding already proven in `verify.ts` is cited
by file reference only and is not copied into the schema.

## 6. Scope gate: October 23 → today (OWNER GATE G1, not implemented)

The admitted-date string is currently baked into native tool descriptions
and the verify scope. Opening it requires a source-owner admission change;
this design only specifies the mechanism: the owner publishes an admission
record (namespace, teacher, allowed date range); the bridge compares the
requested `lessonDate` against it and denies out-of-range dates with a
named blocker. The diff is marked `OWNER-GATED` wherever it appears.

## 7. Acceptance (fixtures only, no real student data)

1. Fresh-session `tools/list` identical across runtimes (manifest equality).
2. Same fixture intake/review structured-hash equality across runtimes.
3. Null backend → `held`/`unavailable`, zero writes (`backend-injection`
   pattern; `academyWrites: 0`).
4. One failed request never latches later requests (per-request pattern).
5. No credential or real-identity strings in logs, receipts, or results.
6. Mapping schema ships with zero concrete bindings (new test enforces).

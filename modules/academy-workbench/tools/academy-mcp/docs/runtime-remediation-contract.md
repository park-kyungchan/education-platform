# Local MCP remediation contract (2026-10-28)

Source proposal R1/R2/R5. This document grants no native activation, namespace
admission, deployment, credential or review authority. Existing admission files
are unchanged. Existing Codex/Muse registrations and sessions are not upgraded
by changing this source.

## Release identity

`academy.mcp-release/2` retains routing, endpoint and registry pins, adds the
exact compiled bridge pin, and requires one endpoint identity manifest for every
configured endpoint. `academy.endpoint-identity/1` names the endpoint, semantic
contract version, exact owner arguments digest and role-tagged entry/source,
policy/admission/config/dependency artifact pins. Artifact lists describe their
declared closure; a contract label is not independent semantic qualification.

An endpoint starts with `--runtime-identity PATH SHA256`. Its compiled entry and
all declared artifacts must match. Every used DailyRecord/metadata launch pin
must occur in that manifest. Identity discovery returns hashes/roles and contract
versions, with no paths, identities or policy bodies. The bridge validates launch
arguments, artifact hashes, endpoint identity and DailyRecord admission before
routing; it rechecks the active graph after the batch. Observation tickets bind
to their issuing graph. A bridge build change requires a fresh bridge process;
an existing process fails closed if the pointer expects different loaded bytes.

`academy_runtime_identity` reports the bridge load hash, process start, graph
hashes and endpoint identities. A v1/legacy graph is explicitly incomplete.
Reading identity does not prove source freshness, actual live source access,
reload of other clients or native endpoint qualification.

Discovery retains a native tool's public name when a saved endpoint advertises
the same name. The saved route remains callable as `saved_<original-name>`;
endpoint order never silently chooses the source. Any remaining duplicate or
invalid name rejects discovery before a registry is written.

`prepare-runtime-release.ts PLAN.json` verifies an explicit pinned plan and
writes a fresh `/tmp/academy-release-draft-*` proposal. It launches no endpoint,
changes no installed pointer/registration and consumes no approval. Endpoint
binaries and manifests must already be built/reviewed. `migration-review.json`
retains the exact-head, owner-admission, installation, fresh-client and Muse
holds. Native paper1/paper2 migration needs their separately owned sources and
identity contracts; registry advertisements cannot substitute for them.

### Paper scope routing (source only)

An optional `paperScopes` list in release-pinned routing bytes maps endpoint
names to existing configured student IDs. For the shared paper-header,
definition, printed-paper lookup, daily-inventory and paper/source contract
names, the bridge chooses
exactly one matching endpoint before starting a process. Missing, overlapping,
or unsupported mappings stop without probing or retrying other endpoints.
An explicitly named compatibility route is checked against the same map and
never redirected to a different endpoint. The
selected native endpoint continues to enforce its own authoritative admission;
the map is a routing hint, not a grant. Without the optional map, old releases
retain their existing behavior. A stale map can cause refusal but cannot widen
the native endpoint's scope.

Populate the map from the selected endpoints' verified current native
configuration as a separate private JSON file, and supply its path and digest
as the release preparation plan's optional `paperScopes` artifact pin. Preparation
copies the validated map into pinned routing bytes, rejects unknown endpoints,
and creates only an uninstalled draft. Never accept the map or a scope flag from
the MCP caller. The current legacy release has no paper scope map, so existing
clients remain unchanged until a separately qualified release is installed.
The pin proves the supplied map's bytes, not its correspondence to native
configuration. Installation must independently verify the map against each
exact selected endpoint configuration and qualify the released endpoints and
fresh clients. Synthetic tests do not establish current native availability.

## Metadata authorization and process lifetime

`--metadata-admission PATH SHA256` selects an owner-issued strict
`academy.metadata-admission/1` policy: metadata namespace, teacher, date bounds,
configured/source-verified subject rule, allowed operations and explicitly
allowed relative selectors. There is no default broad policy. Explicit paper
period endpoints must lie within policy bounds. Relative DT selectors require
separate admission because exact calendar bounds remain unknown.
Admission covers implicit reads as well: history qualifies selector `1` before
its requested periods, and printed-paper lookup may fall back to DT selector
`1`. Those operations require that selector before authentication or source reads.

`academy_student_metadata_get` accepts only exact display name, lesson date,
purpose/request and selected queries. In one serialized owner batch it authorizes
the metadata policy, checks managed names/capabilities, resolves one exact dated
teacher/name/student occurrence, then reads metadata. It accepts no caller keys,
proofs or policy flags and uses no previous-process resolution cache. Foreign,
ambiguous, missing and malformed identities stop before the metadata read.

The keyed `academy_student_metadata` compatibility route retains the old fixed
student/date admission when no metadata policy exists. An explicit metadata
policy can admit configured keys on other dates; it never admits dynamic keys
from a prior DailyRecord proof. DailyRecord and both paper families retain their
own policies and owners. Launch date is configuration identity, not an implicit
limit for an independently admitted metadata batch.

## Errors and protocol

Public failures use a finite domain code/category/locator catalog. Unknown
upstream messages are replaced with a fixed unavailable code. Authentication
failure stays in the owner process's retained promise, preventing automatic
login replay. Calls are serialized and evaluated individually; no retry/fallback
is introduced. SDK error results are sanitized at the bridge.
Structured item-answer blocked/partial reasons use the same finite public
catalog. Tool discovery sanitizes release validation errors; hot-release receipts
attribute operations using the active qualified registry. Metadata failures keep
request correlation and effects without echoing scope/purpose in both MCP forms.

SDK 2.3.1 silently discards JSON SyntaxError frames. The module's bounded 1 MiB
stdio framing adapter emits a fixed stderr diagnostic (maximum 16 per diagnostic emitter),
discards malformed frames and forwards valid JSON unchanged to SDK schema and
protocol handling. It reports a nonempty truncated EOF frame. It never logs the
input, exception or request ID. This is a diagnostic, not a fabricated JSON-RPC
success/error response or an HTTP/SSE claim.

## Preserved semantic gaps

R3/R4 source research used exact code-only source hashes and REA static analysis.
The available DailyTest client reads page 1 and relative selectors, exports no
expected-assignment definition, and does not qualify submission/grading stages.
Original-error and similar-clinic read contracts and the official answer renderer
are not qualified by this source change. Separate private app-source research
may provide additional contracts, subject to source and semantic review.
No new clinic, paging, completion or confirmed-answer behavior
is fabricated. Literal answers and delimiter candidates remain unqualified.

# Existing item labels after detailed type study

The user's current purpose is to study the detailed types relevant to a month-end assessment, describe the desired question, and find the most relevant **existing Academy labels**. Existing hierarchy and IDs must be reused. Label retrieval is separate from choosing final questions, generating a paper, printing, grading, storing official results or sending parent messages.

Each result includes `itemLabelUserContext`: purpose, workflow, retained grade-3/October/24-written-question/100-point requirements, study state interpretation, comparison axes and source/effect boundaries. The caller supplies the desired question features, exact returned hierarchy IDs and a teacher-reported learning state. An agent must not invent learning completion. The fixed context is explanatory domain data; it is not a credential, shared Work registration or external authority.

## Tools

- `academy_item_label_scope`: discover original hierarchy nodes, then page unranked labels for one exact returned hierarchy ID. This is also useful while studying types.
- `academy_find_item_labels`: after `learningState: "teacher_reported_complete"`, return lexical-overlap label candidates and comparison terms. `in_progress` returns `held` before source acquisition. The method is Jaccard overlap over literal words and character bigrams, **not a semantic probability**. Read the source labels to compare mathematical structure, reasoning, representation, number range and response format. Semantic relevance and final question suitability still need teacher review.

```json
{"view":"hierarchy","limit":20}
```

```json
{"view":"hierarchy","parentId":"<exact id returned by the previous call>"}
```

```json
{"view":"labels","hierarchyId":"<exact existing studied-scope id>","limit":20}
```

```json
{"intent":"<desired question features in the teacher's words>","hierarchyIds":["<exact existing studied-scope id>"],"learningState":"teacher_reported_complete","limit":10}
```

Native hierarchy IDs are adapter references derived from the exact source category tuple, not a replacement taxonomy. Results preserve the original numeric/string `nativeKey`, `cl1`–`cl4`, exact title and parent relationship. Label results retain `nativeId` (`pat_no`), exact `pat_name`, and raw source question counts. Counts do not establish difficulty or complete question inventory. Unknown IDs are rejected before any source request. Live comparison currently requires one returned level-3/4 scope; direct-only descendant exclusion is unqualified and refused.

The adapter may cache a complete source page internally, but caller-selected hierarchy IDs must first appear in a successfully returned MCP page. Rows outside the requested slice and rejected pages do not grant caller exposure. Internal ancestor traversal retains its separate cache lookup.

After choosing a type, review its existing questions using the exact label ID returned in that scope:

```json
{"hierarchyId":"<returned hierarchy id>","labelId":"<returned type label id>","purpose":"teacher_requested_review","page":1,"offset":0,"limit":10}
```

`academy_review_type_questions` returns unranked `lectureKey`, exact type/unit text, raw metadata and answers, plus preview references qualified against independently inspected original selector/helper revisions. It preserves untrusted source strings as data and excludes use-log records. It never fetches images or invokes selection callbacks. A source revision change suppresses image references. The caller can open a returned image reference for the chosen question; labels alone do not supply a question body. `purpose: "protocol_verification"` is reserved for truthful bounded engineering probes and must not stand in for a teacher's choice. Retained-label mode reports question reading unavailable.

## Default and retained mode

```sh
bun tools/academy-mcp/src/label-server.ts
```

With no input, the three tools report unavailable/unknown inventory and read no private student context. An explicitly selected absolute snapshot path and exact SHA-256 enable retained mode:

```sh
bun tools/academy-mcp/src/label-server.ts --label-snapshot /ABSOLUTE/PRIVATE/labels.json --label-sha256 EXACT_SHA256
```

`labelSnapshotSchema` is the source owner. It requires original hierarchy relationships, revision, source clock, declared coverage and evidence. A pin verifies bytes, not source truth or permission. Missing snapshots never become fictional records or an observed zero inventory. Files are descriptor-read with a size bound, stable metadata check, SHA verification and symlink rejection.

## Explicit native read mode

The independent Education source owner provides `harness/test_pool_inspect.ts`, using the existing `AcademyHttpClient`. Compile it from that checkout with Bun, keeping `jsdom` external to reuse the existing native runtime dependency. Its fixed reads are the original selector's `CategoryList`, `GetTypeTotal` and type-scoped `GetExamList` requests, plus the original preview helper script. The latter requires the source `make_school_key`, `category_iden` and `cl1`–`cl4`, and extracts JSON between `##START_DATA##` / `##END_DATA##` exactly as the original client does. No source script, create/save/use-log/print handler is executed.

```sh
bun tools/academy-mcp/src/label-server.ts --native-bridge /ABSOLUTE/PRIVATE/bridge.json --native-bridge-sha256 EXACT_SHA256
```

The separately selected, hash-pinned bridge JSON uses `academy.native-pool-read-bridge/1` with an existing SSH alias, exact container incarnation ID, owner UID 10000, absolute compiled-reader path and reader SHA. It contains no password or cookie. There is no default discovery or native/global configuration write. The source code is streamed to one bounded owned child, not installed over the native checkout. The installed Hermes getter consumes `DC_ACADEMY_HTTP_PASSWORD` only inside `/opt/data/profiles/dc-gang-a-dev`; fresh cookies stay in the ephemeral client. The existing owner configuration supplies the username and expected opaque principal. No SSH/SQL/DB inspection is part of label queries beyond this explicitly selected read transport.

This configuration selects a reviewed transport; it does not itself grant account or business authority. Use it only under the user's current source-read instruction. The tools advertise external-world access and do not advertise retry idempotence in this mode. Same-account requests serialize. An authentication refusal blocks further attempts for that process; new secure input and an explicit new invocation are required. Selector-source drift, foreign scopes and inconsistent native replies fail closed.

Hierarchy and label observations are retained immutably for the MCP process lifetime. Pagination and subsequent lexical comparisons reuse those observations without repeated authentication, downloads or reinterpretation of taxonomy. Source clocks remain the original read clocks. Restarting with an explicitly reviewed input obtains new observations; a cached result never claims automatic freshness. The three tools provide study/lookup/review without one tool per low-level endpoint. Question pages retain the original 50-row source page independently of the output limit (at most 20). `offset` pages that immutable observation; `nextOffset` is exhausted before advancing `nextPage`. The real source returned 23 rows for `rows=1`, so output bounds are not advertised as server-side pagination support.

## Verification and limits

```sh
bun run --cwd tools/academy-mcp check
bun run --cwd tools/academy-mcp test:labels
bun run --cwd tools/academy-mcp test
bun run --cwd tools/academy-mcp generate:contracts
```

Synthetic tests cover malformed/foreign scope, cycles, duplicates, missing parents, immutable snapshots, changed pins, symlinks, cold configuration, actual SDK/stdio discovery with network denied, paging, source drift, serialized calls and no credential retry. They never claim real Academy behavior.

The independent session additionally exercised the official SDK → custom MCP → supported native getter → real fixed-origin Academy route. It observed ten root categories and 28 labels in one bounded source scope, reused the retained snapshot, refused an invented scope and held a search with incomplete study. That was a read-contract probe, **not the teacher's chosen October edition/unit scope**. A further bounded engineering probe read one existing type page containing 23 question records, exposed one unranked question, reused the same snapshot, and verified one original preview PNG in memory without retaining image bytes. No teacher study completion, desired October-unit selection or semantic ranking was claimed. The source evidence report contains only minimized counts/hashes; label samples and transport configuration remain private outside Git.

The public Pages frontend uses synthetic fixtures and no private source connection. A frontend build, source test, code hash or one live label read does not establish complete Academy parity, student/parent shared-DB topology, all source history, production release or domain acceptance. Existing saved-student APIs and original workflow meanings remain separate. Global/native MCP registration, source mutations, official saves, printing, sending, deployment and push/PR/merge have not been performed by this source change.

# Academy MCP access investigation

Project: education-platform. Work: academy-mcp-access-20261028. Task: diagnose and improve read access across dates and client sessions. Run: local synthetic validation on the task branch. These identifiers are local only; no native registration or runtime activation is implied.

The initial request authorized investigation and read-only preparation for academy work, including October 26 and October 28. The user subsequently authorized the scoped runtime activation described below. Private student evidence remains in its source custody and is not copied into this Work; no academy record write or parent send is implied.

## Findings

- The installed neutral bridge reported an owner admission ending on 2026-10-27. Both the bridge and the native backend check the owner record; the bridge captures routing and admission at startup. Existing clients retain loaded processes. A source edit alone does not alter any running client.
- Exact student-name resolution returned `student_name_not_found`; that result alone does not establish whether the configured backend searched the live source or fell back to its admitted-student table. The backend also requires the student in its native admission list before reading a DailyRecord.
- Native student metadata has an independent exact launch-date restriction. A DailyRecord date change does not widen that other namespace.
- The optional name-only source port did not authenticate before calling its live implementation. The source fix authenticates once and distinguishes an unadmitted fallback name from an observed zero-row live search. A source-side implementation projects exact name/key pairs from the previously qualified one-page DT search; a zero result is not a full-roster absence. The first owner-bundle successor was installed and validated for the item-answer route.
- After the first runtime activation, a live requested-date read returned no name match on the recent-DT page. The successor source resolves the exact name from the requested date's independently qualified DailyRecord occurrence instead. It does not turn a missing row into an attendance or nonperformance claim, and it does not infer an ID or retry a failed source request.
- The previous fixed-range owner records remain immutable. A versioned successor format supports explicit unbounded date endpoints, still requiring a trusted pinned owner record. An additional explicit `source_verified` student policy allows a unique source-resolved identity from the owner's managed-name list only for the same request and for five minutes; current/prior DailyRecord identity checks and the teacher boundary remain required. Historical v1 records and omitted v2 policy retain configured-student-only behavior. This policy is read-only and does not widen metadata or other namespaces.
- Source repository branches containing the existing name-search and neutral-routing work have already been integrated into Education main. A separate CI test correction has the same test-file bytes as main. No unmerged solution to these runtime issues was identified among the inspected related commit histories.
- The 2026-10-26 class-1 source package exists in the retained dc-gang-a repository and was handed to the dedicated class owner for scoped read-only interpretation; no private package was imported here.
- Exact item-answer retrieval existed in the owner client, but had no exposed MCP tool. `academy_item_answer_lookup` now composes that existing source contract with explicit label input, strict identity and result limits, and zero business writes or print. Official answer literals are reported with their source rendering and printed-paper limitations; a missing renderer or external solution is not a completed answer. The initial source-only implementation did not query a real label; the later bounded live verification is described below.
- A versioned atomic release pointer allows an upgraded neutral bridge to read matching pinned routing, endpoint, registry and admission bytes per request. Before invoking an upgraded DailyRecord backend it compares the backend's admission digest to the release. Pointer disappearance after adoption or a mismatch fails closed; legacy startup remains available until a release is adopted. This requires one separately authorized installed-bridge upgrade; old already-running bridge processes do not acquire the new behavior by themselves.
- Neutral discovery previously removed the saved label tools and the DailyRecord CISM read from its registry. The source change keeps these read-only routes visible, while preserving their own unavailable or source-scope conditions and suppressing duplicates. It does not configure a CISM backend or claim live coverage.

## Remaining work

The versioned owner/bridge releases and Codex registration were activated after the user changed the original restriction. The item-answer route and the two requested dated reads were live-verified. Source-verified name bindings are per request and do not automatically survive a new upstream lifetime, including separate review operations. Other namespaces and clients retain their own qualified scope.

## Local verification

- `bun run status`: passed.
- `bun run check`: passed for local source and synthetic module integration. It does not establish native runtime acceptance or a deployed result.
- The Academy MCP synthetic suite passed 215 tests. The owner HTTP client and assessment protocol tests passed with fictional data.
- The first built neutral candidate passed six SDK tests, including tool discovery, item-answer projection, release changes, mismatch and removal handling, and receipt privacy. The local build files remain under `.generated/academy-mcp-access-20261028-r4/`; successor copies were later installed as described below. SHA-256: `academy-client.mjs` `52002eadca98091529f9ff1a3003c98bd41ac173fd7b86757e2c2e5eb5c39f5c`; `dailyrecord-server.mjs` `acfea4e4cb84c5b1bf5f48312b9482101e4c8c183fd27a5c9e999f7bdeb09c75`; `neutral-server.mjs` `04a76a91c505dc2d1ddb646607d38e852ce492572159a546aa45f2b952ee4577`.

## Runtime verification

The user subsequently authorized runtime activation. Version `mcp-access-bc29d07` was installed using successor artifacts and the existing account lock; its exact item-answer tool was observed once with zero academy writes or parent sends. The first requested historical DailyRecord read returned `student_name_not_found` from the bounded recent-test search, so that outcome was not treated as absence.

The `feaabcf` successor resolves the name through the requested date's qualified DailyRecord occurrence. Before publishing it, the same pinned successor and owner endpoint were exercised through an isolated release pointer: the 2026-10-26 and 2026-10-28 reads both returned `observed` on 2026-10-28 at 06:40 UTC, with zero academy writes or parent sends. The central release and Codex registration were then switched atomically, with their prior bytes retained as protected backups. The same class-session conversation was resumed and left waiting.

The successor MCP passed typecheck and 217 synthetic tests; the built neutral bridge passed six SDK tests, and imported-source/private-package integrity passed. The earlier complete `bun run check` passed before this narrowly scoped successor; a new complete repository-wide run has not yet been claimed. The live reads verify only the two named dates and student, not all history, every metadata namespace, or every external session.

Active successor pins: `academy-client.mjs` `52002eadca98091529f9ff1a3003c98bd41ac173fd7b86757e2c2e5eb5c39f5c`; `dailyrecord-server.mjs` `d0f5a76e7340ef942de0a1eb970986b0323b696ceec1a16d395edcd9999c9f1f`; `neutral-server.mjs` `b5755790bda36b174a1c58923fad27ffaa0ff96651968a189bd07d5f6ae818ec`; central release pointer `9c5b19ccb7009f82f9585b590c1b551144db0bd824c3dca74ea1cf568e552a26`.

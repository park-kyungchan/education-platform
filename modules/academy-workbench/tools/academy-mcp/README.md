# Academy Operations MCP

This first-stage MCP organizes the pinned academy source inventory and reads preserved local academic evidence. It targets all students managed by Park Kyungchan. The available snapshot contains five authorized students; their presence does not establish the complete current teacher roster.

The default server has no academy HTTP transport, live refresh, credential input, source writer, print/generation/reset/grading action or parent-send action. It starts only a stdio MCP transport. The operating-system owner launching this private repository controls access to its preserved academic data; no public HTTP endpoint or remote deployment is configured. The separate, explicitly configured item-label entry point below can use a bounded native read adapter; it does not activate transport for the existing saved-student tools.

## Item-label workflow (independent month-end source)

The dedicated question-pool entry point, original difficulty/presentation evidence, question PNG reads and 24-slot preferred/alternate proposal review are documented in [the research-bound pool workflow](docs/pool-readonly-workflow.md). `start:pool` exposes nine pool/review tools, including three [pure paper-preparation and receipt reviews](docs/paper-preparation-workflow.md), and does not load saved-student or DailyRecord services. Native source readiness is separate from local tool discovery and synthetic verification.

[Source-bound candidate explanations](docs/candidate-explanation-framework.md) add a pure consumer contract for atomic research units, prompt requirements, separately attributed solutions, explicit dimension coverage and evidence-backed comparisons among the actual same-slot alternatives. They register no additional tool or source action.

Current assessment context and optional bound research reads: [research binding and ownership](docs/assessment-research-binding.md).

Three additional tools carry the user's study purpose, retained requirements, exact existing hierarchy, caller learning state and comparison limits: `academy_item_label_scope`, `academy_find_item_labels` and `academy_review_type_questions`. The dedicated `start:labels` entry point needs no preserved student payloads. Its default is unavailable until an owner-selected pinned label snapshot or pinned native read bridge is supplied. Read [the workflow and source/effect contracts](docs/item-label-workflow.md). Changes remain local for review; source delivery does not assert teacher acceptance or complete Academy migration.

## DailyRecord intake and review

For live lookups by name, start with `academy_dailyrecord_get`. It resolves the exact name and invokes qualified intake using launch-owned namespace/teacher/date admission. `lessonDate` defaults to `today` in `Asia/Seoul`. A read can succeed while later authoring still requires a memo/assessment interview. The saved-context tools do not probe live availability. See [the natural-request route and neutral installation](docs/dailyrecord-live-routing.md).

The existing MCP entrypoints also register `academy_dailyrecord_intake`, `academy_dailyrecord_review` and `academy_cism_section`. Every call requires current user purpose, exact teacher/student/date scope, selected fields, today's memo answer and attributed facts. Intake preserves existing assessments/attendance and interviews only missing values. Review checks parent text and proposed field differences; exact source-before checks require backend-issued handles. Default source backends remain unconfigured; the dedicated entrypoint optionally connects the explicitly pinned private native DailyRecord read adapter. CISM remains unconfigured and no save/send tool is registered. Read [the context, canonical wording safeguard, adapter path and limits](docs/dailyrecord-workflow.md). `start:dailyrecord` starts only these three nonwriting tools, without loading preserved student data.

## Install and run

In the integrated Education repository, run `bun run setup` from its root first. This installs this package and prepares `.private/academy-teacher-fixture`: a detached sparse worktree of the exact local ancestor `8f8c9bd61bd5e55445780b5569ecc40effcecef6` (tree `ccb0fc6302f664abe069086881961cec99cf2d85`). Only the 74 exact files in `architecture/academy-teacher-test-fixture.json` are checked out and hash-verified: canonical DC/Gang-a source, two fictional fixture files, and frozen dependency/ignore metadata. The native reader's commit, tree and file-hash guards are unchanged. Full Git history is required (`source.yml` uses `fetch-depth: 0`); setup performs no remote fetch and refuses an existing changed/incomplete fixture. It does not use historical absolute host worktrees or private student originals. Root `bun run check` includes this package's typecheck and complete synthetic tests.

After root setup, run these package commands from `modules/academy-workbench`:

```sh
bun install --cwd tools/academy-mcp --frozen-lockfile --ignore-scripts --cache-dir "$PWD/.local/cache/bun"
bun run --cwd tools/academy-mcp check
bun run --cwd tools/academy-mcp test
bun run --cwd tools/academy-mcp verify:academy-mcp
bun run --cwd tools/academy-mcp start
```

The package lock pins the official MCP SDK 2.3.1, REA 6.5.0, Zod 4.4.3, TypeScript 7.0.2 and Bun types 1.4.2. The tested host uses Bun 1.3.14 and Node.js 22.22.1. REA's published runtime accepts this Node version. Its static JavaScript workflow needs no native decompiler. Dependency lifecycle scripts are disabled; native instrumentation providers are outside this first-stage delivery and are not claimed operational.

For a stdio MCP client, the executable is `bun` and its argument is the absolute path to `tools/academy-mcp/src/server.ts`. Data paths are resolved from this source file, so the caller's working directory does not select a different data directory. This repository does not change any global/native client registration. `mcp.launch.json` is a repository-relative template: replace its `workingDirectory` placeholder with your clone root, then translate the fields into the selected client's native configuration. It is not an applied configuration or evidence that an active Codex session has registered the server.

## Original three tools

| Tool | Purpose |
| --- | --- |
| `academy_capabilities` | Discover the business hierarchy, page source operations, inspect one exact source contract, or read preserved workflow rules. |
| `academy_query` | Read the preserved roster, one student summary, one evidence facet, or dated lesson context. |
| `academy_source_status` | Inspect saved coverage, teacher-population uncertainty and the reported visibility/access constraints. |

The hierarchy has eight workflows and thirteen source domains. Every one of the existing 95 source operations is retained. Its declared effect and source evidence remain metadata; none is executable. Eleven mutating GET operations are explicitly classified as excluded writes. Unknown-effect and sending operations are retained for inventory completeness with execution unavailable.

Examples of MCP arguments:

```json
{"view":"operations","workflow":"assessment","offset":0,"limit":10}
```

```json
{"query":{"kind":"roster"},"limit":10}
```

```json
{"query":{"kind":"student_records","studentId":"<exact ID returned by roster>","facet":"attempts"},"limit":10}
```

Query facets are books, sections, attempts, assignments, videos, DailyTest evidence, DailyRecord observations, teacher/context events and unsaved DailyRecord drafts. `lesson_context` additionally takes an exact ISO date. No join by a student's display name or guessed native identifier is performed. Book filtering uses the exact preserved edition ID.

Source records, teacher reports, supplied context, source-observation snapshots, drafts and derived summaries retain separate classifications. Original source clocks and values remain in the record. Each record includes its pinned file hash and JSON pointer. `retrievedAt` is the local query clock; it does not refresh the source.

Pagination binds a cursor to the immutable snapshot and exact query. Exhausting a saved selection does not prove exhaustive academic history. Empty results and unavailable subjects never become nonperformance or fabricated demonstration records. The server holds one frozen snapshot per process; changed source bytes require a reviewed new pin and a new process, rather than silently refreshing under an old cursor.

## Visibility and preservation

The user reports that the academy website hides student data after two weeks for server-cost management, and that permissions prevent direct server lookup. These remain attributed user reports. Website invisibility is not proof of deletion, a verified API retention contract or student nonperformance. Older local evidence is retained without an age filter. Unpreserved older records and the complete teacher-managed roster remain unknown.

`architecture/intent.json` records current decisions separately from source observations. `architecture/source-pins.json` binds the initial inputs to merged main `900616a`. `schemas/contracts.json` and `schemas/hierarchy.json` are generated inspection artifacts; the TypeScript/Zod definitions remain their source owners.

## Verification and REA

`verify:academy-mcp` launches the actual server through the official SDK with outbound HTTP/TCP denied, discovers the nine registered tools and exercises the original three saved-context tools and all nine saved facets, rejects unsupported/live/mutating requests, and checks that original input hashes are unchanged. Its private receipt is `.local/academy-mcp/verification.json`. That verifier reads the owner-preserved student evidence and requires its own permitted source scope. DailyRecord SDK tests instead use the independent label/DailyRecord entrypoints with fictional fixtures and no preserved student reader. Unit tests use fictional students and check scope, cursor, historical retention, classification, hash drift and symlink rejection.

On hosts where Bun's parent-process stdio stalls under a restricted sandbox, use `bun run --cwd tools/academy-mcp verify:academy-mcp:node`. This runs the same verifier with a Node.js parent while keeping the actual MCP server on Bun. Node.js 22.22.1 with `--experimental-transform-types` is the tested fallback. A timeout in the Bun parent and a successful Node-parent result are recorded separately; neither route contacts the academy.

```sh
bun run --cwd tools/academy-mcp generate:contracts
bun run --cwd tools/academy-mcp verify:mcp
bun run --cwd tools/academy-mcp analyze
```

The latter two commands verify the official REA stdio MCP and statically inspect the prebuilt synthetic `preview/v21/app.js` artifact. Complete REA evidence is exported before its owning session closes. Results stay under `.local/rea-api/`. REA's static graph is partial and does not prove live academy endpoints or server behavior. Its compact advertisement retains the same 207 REA tool names; measured catalog bytes are not a model-token or end-to-end latency measurement.

No shared harness adoption, outside-repository change, native registration, deployment, complete-roster ingestion, live integration or user acceptance follows from these tests. The agreed first-stage result is the local typed saved-context MCP. Further workflow adapters can be implemented incrementally against explicit source, identity and effect contracts.

# Education platform

Academy repository work starts with the typed [repository ownership and check plan](architecture/academy-repositories.json) and [common Git Work workflow](architecture/academy-workflow.json). `bun run academy:repositories` prints the plan without running module checks. `bun run harness:work validate <snapshot.json> --provider <pinned-agent-platform-root>`, `context <request.json>` and `source <snapshot.json> <repository-relative-path>` use the existing canonical reader; the provider commit and clean source must match the explicit pin. Follow context source pointers to the original answer before consequential work. The three maintained projects keep separate qualified Work identities. Existing module dependency locks, native profiles and historical Work remain with their owners. MCP and month-end feature implementation is handled by a separate PR owner.

Private source integration of independent mathematics, curriculum and education applications. Shared upper contracts consume the immutable `@palantirkc/ontology` **0.2.0** release. Native Hermes retains profiles, Projects, WorkStudio, tasks, sessions, credential consumers and operational data.

Run from this repository:

```sh
bun run setup
.private/runtimes/bun-1.4.3/bin/bun run status
.private/runtimes/bun-1.4.3/bin/bun run check
.private/runtimes/bun-1.4.3/bin/bun run module academy
.private/runtimes/bun-1.4.3/bin/bun run module mathematics-core verify
```

Setup installs dependencies from their existing locks and verifies downloaded project-private toolchains against npm registry SHA512 integrity and the official Node distribution SHA256. It supports Linux x64, changes no global toolchain, and preserves Node 26.7/npm 11.17 as mathematics reference, Bun 1.4.3 for all maintained Bun modules. Dependencies and executables stay excluded from Git.

Bun checks reuse the invoking Bun 1.4.3 executable and place its directory first on the child PATH, including nested package scripts. An existing Bun 1.4.3 installation can run `bun run status` and `bun run check`; the private Bun executable is the optional setup route. Setup still provisions the separate Node/npm mathematics reference. Compile-time Bun type packages remain at their existing locked versions. Historical verification receipts describe their original runtimes; the successor check scope is recorded in `verification/bun-currentness-20261016.json`.

The existing root Actions workflow retains Bun 1.4.2 only as a setup bootstrap and for its separate generated native-review JavaScript job. Setup permits that bootstrap only with the Actions `GITHUB_PATH` contract and appends the installed Bun 1.4.3 directory for subsequent source verification steps. Local setup and all maintained module checks require Bun 1.4.3. The nested curriculum workflow selects Bun 1.4.3 directly.

| Module | Usable entrypoints | Source/runtime boundary |
| --- | --- | --- |
| `packages/mathematics-core` | strict JSON ingress, fragment review compiler, evidence review packet compiler, human disposition compiler; `npm run verify` | Exact native code/spec snapshot; Node/npm reference. R4 review and human acceptance remain pending. |
| `packages/curriculum` | `bun run preview`, `bun run project:ui`, `bun run validate`; `integration.ts` source inventory | Preserved 48 UI envelopes and original export provenance. Five canonical inputs are absent; boundary pin conflict is unresolved. |
| `apps/academy` | `bun run check`, `integration.ts`; package-local native `academy:serve`/HTTP/query commands and gang-a code modules | Composite DC code/spec and gang-a code baseline. Native profiles, credentials, PostgreSQL and student originals retain their owners. |
| `apps/mathcrew` | bilingual static build, routing handlers, `bun run test`, `bun run check` | Maintained Bun 1.4.3 product, fonts and publication allowlist; historical source links identify private maintained successors. |
| `examples/clinic-workbench` | `bun run demo`, `bun run build`, `bun run check` | Synthetic snapshot consuming both academy source semantics; no official save or parent send. |

`architecture/source-map.json` retains original Project/native bindings and observed commits. A native worktree HEAD does not identify its dirty content: `provenance/imported-files.json` hashes the selected actual bytes, while `provenance/adaptations.json` records each intentional integration change. Full Git histories, refs and selected native raw source archives are retained by the Hermes owner outside Git; `provenance/history-custody.json` carries restore locators and hashes without publishing those bundles.

The inspected gang-a `d604987` archive remains a reference-only native binding. The separately imported GitHub `7b5cf56` code baseline adds later work; integration does not silently replace the native binding. Existing native serving paths remain compatibility entrypoints until their actual consumers are reviewed.

Local tests establish bounded source and synthetic behavior. `verification/integration.json` records exact checks and `verification/consumer-parity.json` lists unresolved acceptance, PostgreSQL/browser, canonical-input and native-consumer boundaries. Old repositories and operational roots remain preserved; their retirement requires the program owner's exact closure review.

## Academy repository integration

Current integration ownership and preserved native/privacy boundaries are recorded in `architecture/academy-integration.json`. Workbench source lives in `modules/academy-workbench`; mathematical research source lives in `modules/math-research-module`. Their domain identities, original source pins and historical Work records remain distinct. Common harness algorithms remain owned by agent-platform.

Start with `bun run context:academy entry` (or `entry --date YYYY-MM-DD`). Use `reading-plan --topic academy.class-preparation` before bounded `select`; follow every required page. `resolve --source <source-id>` maps a selected historical reference to its integrated path and compares hashes without printing source text. Private student originals have their own explicitly admitted namespace and unchanged manifests; they never become synthetic fixtures or public assets. Run `bun run verify:academy-integration` for exact source/package preservation checks.

This is a local integration candidate. Source checks, independent review, shared publication, native activation and teacher acceptance remain separate. Root October23 operational work and fixed academy runtime are excluded.

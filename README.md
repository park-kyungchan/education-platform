# Education platform

Private source integration of independent mathematics, curriculum and education applications. Shared upper contracts consume the immutable `@palantirkc/ontology` **0.2.0** release. Native Hermes retains profiles, Projects, WorkStudio, tasks, sessions, credential consumers and operational data.

Run from this repository:

```sh
bun run setup
.private/runtimes/bun-1.4.2/bin/bun run status
.private/runtimes/bun-1.4.2/bin/bun run check
.private/runtimes/bun-1.4.2/bin/bun run module academy
.private/runtimes/bun-1.4.2/bin/bun run module mathematics-core verify
```

Setup installs dependencies from their existing locks and verifies downloaded project-private toolchains against npm registry SHA512 integrity and the official Node distribution SHA256. It supports Linux x64, changes no global toolchain, and preserves Node 26.7/npm 11.17 as mathematics reference, Bun 1.4.2 for the integration and Bun 1.4.1 for mathCrew. Dependencies and executables stay excluded from Git.

| Module | Usable entrypoints | Source/runtime boundary |
| --- | --- | --- |
| `packages/mathematics-core` | strict JSON ingress, fragment review compiler, evidence review packet compiler, human disposition compiler; `npm run verify` | Exact native code/spec snapshot; Node/npm reference. R4 review and human acceptance remain pending. |
| `packages/curriculum` | `bun run preview`, `bun run project:ui`, `bun run validate`; `integration.ts` source inventory | Preserved 48 UI envelopes and original export provenance. Five canonical inputs are absent; boundary pin conflict is unresolved. |
| `apps/academy` | `bun run check`, `integration.ts`; package-local native `academy:serve`/HTTP/query commands and gang-a code modules | Composite DC code/spec and gang-a code baseline. Native profiles, credentials, PostgreSQL and student originals retain their owners. |
| `apps/mathcrew` | bilingual static build, routing handlers, `bun run test`, `bun run check` | Original Bun 1.4.1 product, fonts and publication allowlist; historical source links identify private maintained successors. |
| `examples/clinic-workbench` | `bun run demo`, `bun run build`, `bun run check` | Synthetic snapshot consuming both academy source semantics; no official save or parent send. |

`architecture/source-map.json` retains original Project/native bindings and observed commits. A native worktree HEAD does not identify its dirty content: `provenance/imported-files.json` hashes the selected actual bytes, while `provenance/adaptations.json` records each intentional integration change. Full Git histories, refs and selected native raw source archives are retained by the Hermes owner outside Git; `provenance/history-custody.json` carries restore locators and hashes without publishing those bundles.

The inspected gang-a `d604987` archive remains a reference-only native binding. The separately imported GitHub `7b5cf56` code baseline adds later work; integration does not silently replace the native binding. Existing native serving paths remain compatibility entrypoints until their actual consumers are reviewed.

Local tests establish bounded source and synthetic behavior. `verification/integration.json` records exact checks and `verification/consumer-parity.json` lists unresolved acceptance, PostgreSQL/browser, canonical-input and native-consumer boundaries. Old repositories and operational roots remain preserved; their retirement requires the program owner's exact closure review.

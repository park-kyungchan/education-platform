# gang-a learning rails

A code-only, owner-private academy learning application. All bundled students, records, messages, identity claims and credentials are synthetic. Student records remain in their typed canonical Space; the Site is a private visualization and never becomes a second source of truth.

This refactor starts from private main `b64d13196247530cb940109ed6ba065ad87e5a80`. `BASELINE_MANIFEST.json` records the original 33-file export. It is historical provenance, not the current source manifest. The original three-student snapshots are frozen in `tests/golden/baseline-fixtures.json`.

## Reproduce

Use Bun 1.4.2. This is one Bun package with one lockfile and one build chain. The `packages/` folders are logical modules, not independently deployed packages.

1. `bun install --frozen-lockfile --ignore-scripts`
2. `bun run validate`

`validate` builds the browser and Worker bundles, runs all five legacy regression suites, the refactor golden tests, the static offline parser tests and architecture checks, checks every TypeScript module/test, and scans deliverable sources. Tests make no real academy request. Generated outputs stay in `dist/`, `src/generated/` and `test-results/` and must not be committed.

## Boundaries

- `packages/domain`: branded local/native IDs, students, textbook hierarchy, scope, assignments, source evidence, decisions, assessment kinds, and independent print/delivery axes
- `packages/application`: read-only projections, legacy normalization, selected-student partial refresh policy, and source-contract reuse/reinspection policy
- `packages/ports`: owner authorization, source transport, trusted receipt verification and revision-leased storage contracts
- `packages/adapters`: managed Sites dispatch, the in-memory fixture store, unavailable transport, and the one statically verified StudentNameSearch HTML contract/parser
- `packages/security`: owner-private context gates, immutable full-byte contract pins and student namespace checks
- `packages/audit`: canonical content hashes and append-only correction/retraction events
- `packages/schema`: strict runtime/wire schemas, versioned v1 compatibility and reversible preparation-only migration
- `src/ui`: schema-narrowed application state, selectors and read-only components

See [architecture](docs/ARCHITECTURE.md), [migration and rollback](docs/MIGRATION.md), and [verification boundaries](docs/VERIFICATION.md).

The [academy operating checkpoint](docs/ACADEMY_OPERATING_CONTEXT.md) adds a byte-pinned common policy graph, completed common-policy interview, distinct Gauss book-final certification rule and scoped inspection command. Certification catalog inspection is offline; actual learner results and book-final bindings remain unobserved. It connects roles, triggers, ordered steps, artifacts, source corrections and open questions without creating student records or granting external-action authority. Inspect with `bun inspect-operational-context.ts D-A02`; validate with `bun run lint` and `bun run validate`.

## Operational limits

The shipped transport is explicitly unavailable. Request syntax, an uploaded capture, fixture success, a schema-valid receipt and a source document do not prove live retrieval, authentication, read-only effects, native identity, source completeness, or source permission. The offline request builder remains blocked unless its nonstudent form fields come from an explicit verified nonsecret policy. No such real values are bundled.

The managed Sites adapter may run only behind independently verified sole-owner managed dispatch. Its injected identity headers are not safe authorization on a direct/untrusted Worker origin. This repository has no deployment config, credentials, cookie/session handling, persistent backend, scheduled queries or real HTTP connector.

DT means DailyTest, a classroom activity. Daily Restudy is a separate textbook section. Diary mentions cannot create assessment attempts, grades, native identity, teacher completion or a Daily Restudy binding. Embedded written-response content in a final lesson creates no additional progress cell or denominator.

Keep production snapshots, actual student data, private bindings, raw HAR files, secrets and platform access proofs outside this repository, even when private. The source scan is a regression guard, not a complete data-loss prevention guarantee.

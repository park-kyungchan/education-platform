# Continuous V0 contract tests

Run `bun --no-env-file test ./tests/platform-v0` with Bun 1.4.3 after the repository's normal setup.
The existing root `bun test ./tests` discovers these tests, including the module-scoped TypeScript check.
No workflow, qualified source, immutable release, native service or real data is changed.

`catalog.json` preserves the exact 12 case IDs and 124 subcase IDs from
`reports/v3/verification-catalog.v1.json` at its recorded SHA256. It is a traceability
index, not a verdict or an executable substitute for that catalog.

The executable tests call the existing education product APIs with synthetic DTOs and
an in-memory prerequisite read port. Read fixtures are adapted from the owning module's
source tests; they do not implement a query evaluator, Function runner or Action executor.
Assertions use fixed synthetic expected values and closed refusals. Approval DTO tests
never issue, dispatch or consume a teacher approval. No test is skipped to conceal a gap.

## Exact coverage and remaining interfaces

Every row below is **partial or unavailable**. Passing this suite is not a V0 case PASS,
V1 qualification, native write qualification, runtime smoke or P8 Acceptance.

| Original case | Executable subset | Remaining contract behavior |
| --- | --- | --- |
| V0-01 | `01.changed`, `01.scope-projection`, interval projection for `01.interval-inclusive-from`, `01.interval-inclusive-through`, `01.interval-outside-through`, `01.interval-open-end`, `01.interval-unknown-end` | Full authorized closure and temporal membership/teaching query outcomes, whole-history exhaustion, generic query identity projection |
| V0-02 | `02.distinct`: exact assessment identity and homework ref retained, unresolved relation explicit | Full current-versus-prior homework Function result; `02.missing-assessment` |
| V0-03 | `03.namespaces` native denial and reference type validation; `03.lessons` scope identity distinction | Public day enumeration/ambiguous draft refusal, exact attempt/score chain and edition collision query |
| V0-04 | `04.unknown` source-field unknown retention/malformed field refusal, known zero and CONFLICTING branches | Complete empty collection/applicability proof; scoped correction lineage/conflicting correction query |
| V0-05 | `05.object` paired cross-namespace existence denial before projection | Field/predicate/order/link/cursor/temporal relation authorization matrix |
| V0-06 | `06.revoked` rights-before-diagnostic native denial; semantic digest portions of `06.native-changed-date`/`06.native-changed-occurrence` | Protected paged continuation in query/native/Function domains, immutable snapshots, monotonic whole-query revisions, tied ordering |
| V0-07 | Text/citation consistency portions of `07.mismatch` and `07.unknown` | Public `CheckDailyRecordCompleteness` Result, all eight checks, approval/save flags, interval history failure mapping |
| V0-08 | DTO closure binding portions of `08.teacher`, `08.target`, `08.action`, `08.principal` | Authenticated approval verification/dispatch refusal for every listed case, including missing/forged proof and counted zero effects |
| V0-09 | `09.tamper` defining-object hash refusal before projection | Full pin-copy import guard and AP/CH-context/CH-native/HH registration closure |
| V0-10 | Unavailable | Public **pure simulation** idempotency/concurrency/occurrence-index/mode/ambiguous-ACK executor; native store execution is not a substitute |
| V0-11 | DTO portions of expiry, digest, revoke and object/link revision mismatch | Commit-time current authority/CAS linearization and counted effect deltas through the simulation executor |
| V0-12 | Unavailable | Qualified public Function capability runner, alternate effect interception and original correlation/error mappings through all three education Functions |

The inspected R02 ontology transfer units expose artifact/evidence/operational validation,
not the missing generic query/Function/simulation interfaces. These gaps must be assigned
to their actual code owner; this test suite does not invent a replacement implementation.

## Runtime smoke prerequisite and procedure

Once the native owner identifies a supported public query, draft or manual-handoff entry:
observe each installed Codex, Claude Code, Muse, agy and Hermes runtime identity/version;
submit one bounded synthetic request through that entry; verify an actual runtime response
with its exact request/result correlation and refused mutation boundary. Preserve native
profile/session ownership and use no private store parsing. Record one concise result per
runtime in the operational HANDOFF, with missing interfaces/identities stated explicitly.
Grok is excluded until installation. This plan has not executed a runtime smoke.

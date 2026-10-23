# Read-only continuation and source CI

This successor ports the still-needed CI, current-context and invocation provenance intent of historical Academy PR 2 onto current main. Original archives, consumer identity, Task/Run records and operational gates are preserved. The governing integrated recovery Task is referenced in `harness/continuation-source.json`; Academy remains the source-owning Project. That reference does not duplicate the upstream Work ledger or bind a native Run.

`bun run context:inspect` observes the current local Git head/tree, branch, tracked-change presence and selected source hashes. `observedOriginMain` is a local tracking-ref observation; inspection does not fetch or claim remote freshness. Context source bodies and private student records are not printed. The original `harness-consumer-upgrade-20261013` projection remains explicitly historical, including its publication-pending record. This does not mean the delivered original patch is pending today.

If `.harness-runtime/checkpoint.json` exists, inspection uses the existing pinned canonical checkpoint/request validators and source reader. It preserves all completed, pending, uncertain and uninterpreted state and never writes a checkpoint. Root/project/Work mismatch, unsafe paths or malformed checkpoints fail; source drift reports a held continuation. Select another already-known Work explicitly:

```sh
bun run context:inspect --work-id KNOWN_WORK --checkpoint .harness-runtime/owned-checkpoint.json
```

An absent default checkpoint is reported as absent, with no current next action inferred from historical records. An explicitly requested absent checkpoint fails. Native continuation, checkpoint ownership and native session custody remain with the selected native owner. Large retained checkpoints that exceed the 24,000-character inspection bound require that owner's bounded reader.

Inspection pins and validates the exact local identity bytes before using their Project/Work meaning. Only a matching schema-valid `harness/work/identity.json` supports `local-module-record`; an explicitly owned other Work checkpoint is reported as `known-checkpoint-only` with registration `unverified`. Neither case verifies native binding or global registration.

After assembling all initial context and Git/status observations, inspection rechecks checkpoint presence/bytes/source status, historical source pins including the initial identity/schema proof, context source hashes, and Git head/tree/branch/origin/status. The tree is always resolved from the observed head SHA. A detected change holds inspection without writing or replaying retained state. This is a bounded consistency check, not atomic linearizability or a multi-file lock; changes after a component's final read remain possible and require a fresh owner observation before consequential execution.

Every harness check and context inspection gets a new `academy-invocation:<UUID>` with an observation timestamp. This is local command invocation identity. `nativeRunId=null` and `nativeAuthorshipVerified=false` are deliberate: inherited environment/session IDs and historical Run records do not authenticate the current author or create a native Run. No source tests establish operational acceptance.

## CI without cross-repository credentials

Use Bun 1.4.2 and Node 24.14.1 for the same checks as hosted CI:

```sh
bun install --frozen-lockfile --ignore-scripts
bun run setup:ci
export AGENT_PLATFORM_SOURCE_MODE=pinned-snapshot
bun run check
bun run check:ci
bun run test
bun run test:synthetic-runtime
bun run test:offline-adapter
bun run context:inspect
```

The committed compressed JSON dependency cache contains exactly the 17 source files already pinned at `agent-platform@ffba2462…`. `generatedDependencyCopy=true` records that the bytes are copied; `independentlyMaintainedImplementation=false` records canonical ownership. The original consumer pin and historical module fields stay unchanged. The cache includes no Work ledger, native session state, credentials, real student fixtures or live runtime. It is not a claim of a Git checkout or the full native provider closure.

Restore verifies generated output hashes, compressed/uncompressed size limits, exact member count/order/path/type, duplicate exclusion and each immutable source hash before extraction. It creates only the ignored `.harness-deps/agent-platform` root. Existing source is verified and never overwritten or repaired. Frozen public package dependencies are installed under `ci/dependency-install/node_modules`, then the canonical sources resolve through a checked local dependency link. Canonical validators and installed Ontology bytes are verified again in a fresh process. Missing/drifted source requires owner review or a new checkout.

The native-review command is generated from current pinned common `ci/source-check.ts` and its two canonical receipt dependencies. Academy adds only a bounded transport version policy that checks the actual response consumed by that gate and requires V2. Canonical code owns authenticated status-creator checks, immutable same-repository receipt/result provenance, exact head/tree/source-manifest identity and zero-finding review validation. The CI token is read-only; no credentials, account configuration, deployment, source-server access or auto-merge are added. The aggregate gate requires both source checks and exact-head V2 review to pass. Missing publisher repository variables or an absent exact-head status intentionally fails; source tests cannot substitute for them.

An explicit merge creates a new main commit SHA. The responsible Lead must independently bind the reviewed tree to that exact main, account for any new findings, join the actual native review completion, then publish the immutable V2 result/receipt and authenticated exact-main status. If the merge-push review gate ran before publication, the Lead explicitly reruns the invalidated failed review/aggregate jobs afterward. Keep the main push gate enabled: an earlier PR-head pass, absent receipt, zero-finding claim invalidated by later findings, custom publisher or automatic retry does not substitute for this evidence sequence.

To regenerate from explicitly selected, clean upstream checkouts:

```sh
AGENT_PLATFORM_ROOT=/path/to/exact-ffba-checkout \
COMMON_CI_SOURCE_ROOT=/path/to/reviewed-common-checkout \
bun scripts/generate-ci.ts
bun run check:ci
```

Review `ci/provider.json`, source pins, generated output hashes and the complete candidate before delivery. The original Academy PR 2 remains historical until a responsible Lead delivers and verifies its successor, then explicitly reconciles that PR. This patch does not perform a push, PR, merge, native activation or cleanup.

Monthly evaluation scope remains analysis and handoff immediately before the user selects existing Academy-server questions. These checks generate no 24-question assessment and select or persist no real question membership. All Academy source/server writes, print/send, authentication and deployment remain outside this source change.

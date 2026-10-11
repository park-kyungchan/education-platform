# Version transition and rollback

The additive `academy.operations/1.1.0` catalog has its own exact-byte manifest, original-versus-canonical input hash lineage and Git revision rollback. The prior 1.0.0 checkpoint remains reproducible at its pinned Git revision; 1.1.0 adds explicit partial-resolution structure, revision-bound sources and the follow-up practices. Restore the whole pinned revision (code plus catalog/manifest) for rollback rather than passing a 1.0.0 catalog into a 1.1.0 strict loader. It does not migrate student evidence, modify student wire v1 or provide a new student database. Future context corrections preserve earlier source anchors and use revision leases; [the operating guide](ACADEMY_OPERATING_CONTEXT.md) documents update and rollback boundaries.

## Preserved external surface

The v1 HTTP routes and selected-response wire shape remain. Original root/source import entrypoints are thin compatibility facades for baseline consumers. They contain no parallel implementations. `src/app.ts` and `src/worker.ts` remain actual build entrypoints.

Facade groups:

- `academy-domain.ts` exposes historical v1 contracts and pure policies
- `src/domain/*` exposes versioned v1 evidence/projection schemas and validation
- `src/gate/*` exposes the relocated managed-context guard
- original renderer and handler entrypoints re-export their single canonical implementation

New code imports the canonical `packages/` or `src/ui/` modules directly. Facades can be removed in the next breaking release after every repository consumer and deployment/build entrypoint uses the new paths, no downstream consumer still imports a v1 path, and all golden/security/UI regressions pass. Removing them is not required to publish this backwards-compatible refactor.

## v2 semantic contract

Canonical evidence nests discriminated source provenance instead of allowing a flat source kind with unrelated optional fields. The direct-source spelling is `direct_lms_observation`. User-reported event time is explicitly `reportedEventAt`; it is not an observed tool timestamp. Local/native student/entity IDs are separate branded types. Decisions have explicit schema version, scope, evidence references and rule version.

`normalizeLegacyEvidence` is read-only application adaptation and preserves the v1 wire object. `migrateEvidenceV1` prepares a persistent migration only from exact UTF-8 original bytes with a matching SHA. Its typed manifest declares breaking changes, preservation and blocked cases. It returns a separate immutable-byte copy for rollback. No store write or deployment happens in this function.

Direct v1 observations are blocked pending independent trusted adapter validation. Inference with no explicit input evidence IDs is blocked instead of inventing lineage. A user confirmation never promotes source verification or native identity.

## Rollback

`prepareEvidenceRollback` requires the typed manifest, original bytes, original SHA and matching current/expected revision. Modified bytes or a stale revision are rejected. Actual storage rollback would need an authorized store adapter and compare-and-append audit event; there is no deployed persistent adapter here. Prior source/evidence/teacher events are never deleted or rewritten.

## Test-fixture transition

The original three snapshots are byte-derived semantic golden fixtures. The 103 original regression checks remain. The client-only security fixture previously used incomplete pseudo-receipts. It now supplies the complete strict response contract; receipt-distinction checks use real fingerprints instead of a noncontract `fixtureScope` property. The renderer source inspection follows its canonical implementation, not a compatibility facade.

The v6 assessment schema/UI was copied only from a sanitized code-only delta. Its source provenance is in `V6_POLICY_DELTA.json`; those producer hashes describe the imported source revision, not hashes of the adapted refactor files. No private projection or operational Site data was migrated.

The v1 diary projection's `dailyRestudyBindingState='unverified'` is a historical compatibility value. It does not reactivate a current DT/Daily Restudy equivalence. The current canonical policy distinguishes DailyTest activity from textbook Daily Restudy and rejects that equivalence. No old diary assertion is automatically rebound.

The unavailable connector returns a distinct `unavailable` result without `attemptedAt`. It preserves all state, revision and source clocks. A UI preparation/click timestamp must never become a backend-attempt or source-success timestamp.

## Lossless supplied-clock correction (evidence 2.0.1)

Imported snapshots retain their supplied report/upload instant as `source.reportedAt`, including null when unknown, and preserve `sourceRef.sourceMessageId`. This is provenance of supplying/reporting the snapshot. It is not the snapshot's observed, captured, event, recording or query-success time. Normalization copies each existing clock without fallback, timestamp substitution or source-trust promotion.

Inference retains the same nullable supplied report clock and message reference. Its declared legacy observation/capture clock claims are retained under typed `source.providedClocks`; actual inference `source.observedAt` and `source.capturedAt` stay null. These supplied claims do not establish direct source observation or retrieval success. `recordedAt` remains its original separate recording clock.

Canonical evidence version 2.0.1 marks this lossless correction. Re-normalize from pinned original v1 evidence to recover clocks missing from an earlier normalized result; do not invent them from recording time. Original-byte preservation alone is insufficient when a known clock is absent from the canonical model. The migration still returns unchanged original evidence/bytes and rollback still requires the original SHA and revision lease.

# Migration plan

## 1. Establish a clean development baseline

Import only this reviewed text-only folder into the intended private repository. Do not import old Git history, archive files, generated worker configuration, source snapshots, raw responses, screenshots, browser profiles or credentials. Verify `validation/source-hashes.json` and `validation/manifest.json`. No repository clone, commit, push or deployment is performed by this export step.

## 2. Run the preserved UI safely

Serve `preview/v21` on loopback using the README command. Keep its fictional fixtures and network blocking. Inspect student switching, repeated selection, stage changes, close/cancel, failure recovery, breakpoint transitions and keyboard behavior. Verify source/bundle hashes before rebuilding. Test the native WebMCP contract separately in a supported environment; the synthetic preview deliberately disables native tool registration.

## 3. Establish explicit data and runtime boundaries

Keep presentation/domain contracts reusable. Replace Sites-only authentication and dispatch only after choosing an authorized independent host/provider. Design per-request user/academy/student scope validation, server-only storage and data retention before adding real records. Browser login does not establish reusable independent-server credentials. Private IDs and enrollment bindings must be collected in the intended private runtime, not committed to Git.

## 4. Complete one read-only vertical slice

Pick an authorized student and bounded source domain in the new runtime. Resolve identity explicitly, record source version and query scope, exhaust pagination where required, validate unknown enums and retries, retain evidence timestamps, test negative joins, and expose partial/blocked/stale states. Verify original paper ↔ attempt ↔ grading membership before deriving wrong-item sets. Static endpoint observations are candidate contracts until their effects and response scope are proven.

## 5. Rebuild projections and audit events

Use context/business-decisions.json and the architecture types. Keep assignment, actual work, grading, correction, teacher review, printing and delivery independent. Restore private data from a newly authorized source into server-only storage; do not regenerate history from today's values. Import and durable ledger code is reference-only until its backing storage, caller authority, bindings and idempotency are revalidated.

## 6. Integrate actions only after reads are correct

Separate prepare, approve, execute and verify. Add save/send/print adapters with explicit effect declarations and approvals. Saving a DailyRecord is distinct from sending it. Existing source `composeDailyRecordSections` partitions evidence atoms; it is not by itself the final parent-facing formatter. Apply the parent-output rules to the outward projection, including removal of internal completion/teacher-status language without moving it automatically to memo.

## 7. Verify and deploy

Run full dependency installation/build/typecheck/unit/negative/integration/browser checks in the selected coding environment after the source is made self-contained. Do not present omitted/generated data or mocked receipts as real validation. Validate native WebMCP separately; describe real-device/Safari coverage accurately without inventing it as a mandatory new gate. Deploy only with authorization and verify the exact deployed revision, caller scope, smoke flows and rollback.

## Restore omitted dependencies

- Generated student payloads, overlays, source snapshots and enrollment pins: newly authorized server-side ingestion with minimization; never restore into browser JS or Git.
- Source contracts/catalog bytes used by hash pins: retrieve authorized nonprivate definitions, validate full bytes, then create new versioned pins. Old hashes are traceability, not usable payloads.
- Confirmed workflow bindings and approved deltas: rederive from explicit scoped evidence in private storage; retain uncertainty and event history.
- Runtime owner/auth/DB configuration: create through the chosen host's supported setup and keep it outside version control.
- Old tests/build scripts with live/private fixtures: use purpose-built fictional fixtures and update imports in the selected environment; do not disable safety gates merely to make tests pass.

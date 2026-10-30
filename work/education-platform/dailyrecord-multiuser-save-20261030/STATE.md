# DailyRecord multi-actor save workflow, 2026-10-30

Owner: Claude Code (Opus 5.5) in Herdr w0:t2 / w0:pB, implementation owner by direct user transfer. Codex remains lesson owner for Session 2 preparation.
Branch: `work/dailyrecord-multiuser-save-20261030` from main `11e28960e955ff076f2080d94b207c894c5bffa0`, PR #53. Its temporary worktree is removed after merge; the merge commit is recorded in the private handoff `DAILYRECORD-MCP-PREPARATION.md`.
Gate: user authorized source implementation, synthetic E2E verification and `bun run status`/`check`. Production configuration, deployment, native activation, live saves and parent transmission are not authorized by this Work. User directed commit, push, PR, merge and cleanup on 2026-10-30; source merge does not deploy, register or activate any runtime.
Status: source implementation and synthetic verification complete. Not deployed, not registered, no native or live effect.
Next: operational use additionally needs (1) an owner-trusted issuer that observes the actual user event and signs `academy.dailyrecord-save-authorization/1`, (2) owner-registered actor keys provisioned to each runtime's bridge launch, (3) owner launch flags on the native DailyRecord server, all as separately authorized owner configuration. Until then saves fail closed.
Holds: no owner-trusted issuer that observes actual user events exists; without it the request-bound save path must fail closed with a precise reason. No authenticated actor credentials are provisioned to any runner. Existing launch-pinned admission belongs to a different request and is not widened or reused. Private operational and student facts stay in the private lesson handoff directory, never in this public Work.
Private operational context: `/home/palantirkc/operations/academy-lesson-handoff-20261030/STATE.md` and `DAILYRECORD-MCP-PREPARATION.md` (private, outside the repository).

## Handoff log
- 2026-10-30 Claude Code took implementation ownership from the Codex lesson agent at user direction after loading the handoff, Hindsight (installed 1.1.0 `a5a619b5ca59c5c39e0f96be6f7a31fabd136bd5`; official Coding Agents guide `hindsight-integrations/coding-agents/README.md`, official test `hindsight-integrations/coding-agents/src/core/knowledge-tools.test.ts`) and bounded academy context.

## Verified starting defects (main 11e2896)
- `neutral-server.ts:184-192`: bridge save recomputes review and forwards the recomputed digest; the caller's `reviewDigest` is never read. A prior caller review is not required.
- `neutral-server.ts:96,245`, `dailyrecord.ts:146`: observation tickets/handles and serialization are process-local; each upstream call is a fresh process.
- `dailyrecord-save-admission.ts:18-53`, `native-dailyrecord-backend.ts:414-421`: one launch-pinned admission per process; no per-request owner-trusted authorization.
- `lessonJournalHttp.ts:91-93`: before-compare then write; not a server-side conditional write.

## Implementation (PR #53)
- New `src/dailyrecord-workflow.ts`: immutable owner store (exclusive `link(2)` publish), append-only metadata audit, per-student cross-process lock breaking only dead holders, Ed25519 actor proofs (registry, payload digest, tool, freshness, single-use nonce), owner-signed per-request authorization schema/verifier (`parentTransmission: not_authorized`), field execution states, request-bound approval adapter consumed once before dispatch, pinned launch flags.
- `src/dailyrecord.ts`: durable observation handles, authenticated review records, field-local `holdActions` with scoped `correctionScope`, request-bound save, `reconcile`, `executionStatus`; legacy path unchanged without the workflow.
- `src/neutral-server.ts`: forwards the caller's `reviewDigest` (no substitution), passes owner-durable handles through, strips caller `actorProof`, signs with the launch-configured actor key.
- `src/native-dailyrecord-backend.ts`: accepts a per-request approval; reports transport. Tools `academy_dailyrecord_reconcile` and `academy_dailyrecord_execution_status` registered; exposure manifest, tool pins, docs and adaptation hashes updated.

## Last runs (2026-10-30, pinned Bun 1.4.3 / Node 26.7.0, worktree above)
- `bun run status`: exit 0.
- `bun run check`: root typecheck, root tests, `verify:imports`, `verify:academy-integration` (unchanged 1509, adapted 36) and every module check pass; the final step `academy-workbench test:mcp` reports 285 pass, 2 fail.
- The 2 failures (`release-base-diagnostics.test.ts`: nonroot owner mismatch; post-dispatch receipt failure) also fail on untouched main 11e2896. Cause: `runuser -u nobody` cannot traverse `/home/palantirkc` (mode 750) to the bun binary; verified with `namei`. Environment-blocked, not run successfully here; host permissions were not changed.
- New: `tests/dailyrecord-workflow.test.ts` 13 pass (restart/handoff, duplicates, fail-closed trust codes, foreign scope, concurrent external modification, partial saves, readback failure and reconcile, transport uncertainty, hold actions, lock, launch flags, legacy route); `tests/dailyrecord-workflow-e2e.test.ts` 5 pass across real bridge and upstream processes (handoff, concurrent single dispatch, crash mid-dispatch then reconcile, bridge receipt failure, unkeyed runtime). Legacy neutral save tests now assert unreviewed or cross-lifetime saves never reach the backend.
- `verify:academy-mcp`: exit 0. Diff/new-file scan for private student or operational identifiers: no match.

## Holds
- Remaining trust gaps documented in `modules/academy-workbench/tools/academy-mcp/docs/dailyrecord-workflow.md`: no issuer, no provisioned actor keys, single-host lock scope, no server-side conditional write, root agents can read any key.
- October 30 Session 1 saves remain held; this Work does not authorize, issue or replay any save.
- 2026-10-30 user directed the full Git lifecycle. Official Hindsight guide check (installed 1.1.0, Coding Agents 0.8.2): linked worktrees resolve to the main checkout's bank and the installed config has `gitIngest: none`, so worktree/branch cleanup does not change Hindsight ingestion; main history is not rewritten.

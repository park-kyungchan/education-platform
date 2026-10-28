# Academy context and execution-contract entrypoint

The current user selected **preserve existing owners; integrate context entrypoints and execution contracts first**. Default navigation is **business date → class/cohort → student preparation and pending work**. Include internal teaching, progress, homework, assessment, wrong-answer work, attendance and journals. Counseling and parent communication are excluded from this Work.

`catalog.json` connects known context/history sources, current decision summaries, ownership, typed relationships and ACX finding IDs. It is discovery metadata, not another Memory store, native registry or executor. Entire conversation/Space coverage remains unknown. Original message excerpts, student records, archive payloads and credentials are not loaded by this catalog or selector.

## Use the bounded context

```sh
bun run context:academy inspect
bun run context:academy reading-plan --topic academy.class-preparation
bun run context:academy select --topic academy.class-preparation --max-bytes 24576
```

The CLI reads only this metadata catalog. `select` returns compact JSON within the specified UTF8 budget for the **whole serialized selection JSON response**. A native tool wrapper must separately budget its own framing. Follow `nextCursor` with the identical topic/budget/history arguments until it is null. A cursor is tied to the exact catalog and query; a changed catalog requires a fresh selection. Oversized required items produce an explicit error rather than silent loss. Add `--history` only when historical record text is needed. Required references crossing an excluded scope hold that selection instead of leaking the excluded text.

`reading-plan` distinguishes a small required-reference set from optional discovery references. References identify what must be qualified; they do not order the caller to ingest entire source bodies. Read only the necessary bounded fragments under the owning source's current rules. Class preparation includes the class-timetable guide; qualify its admission and provenance alongside dated teacher corrections. The broader discovery packet retains additional diagnosis/history pointers. No source body is opened automatically, including unread private locators with null hashes.

Current user decisions and unresolved issues precede supporting source lists. This improves first-page usefulness; it is not evidence of lower total token cost or faster native execution. Tests verify complete pagination, UTF8 accounting and explicit exclusions. No live latency measurement is claimed.

## Ownership and structure

| Owner | Retained responsibility |
| --- | --- |
| `dc-gang-a` / `dc-gang-a-dev` | Operational policy, teacher interpretation, qualified academy access and native/domain data |
| `education-platform` | Existing maintained education integration and `apps/academy/gang-a` implementation |
| `academy-workbench` | Preserved context, synthetic/offline consumer and this metadata entrypoint |
| `math-research-module` | Research meaning, assessment chronology and research object identity |
| `agent-platform` | Canonical Work/Memory/Recall algorithms and shared contracts |
| Native Codex/Hermes | Sessions, tools, dispatch, authentication, retries and actual effects |

Book-edition containment, task dependencies, semantic relationships, revision/provenance and repeating classroom cycles are different typed structures. The validator checks acyclic dimensions separately; semantic and workflow cycles can be valid. Repository build dependencies describe verification order and do not establish semantic parenthood or data custody.

`execution-contracts.ts` designs seven internal workflows with separate preparation, qualification, native/domain execution, readback, verification, teacher review and scoped acceptance. It defines inputs, evidence clocks, edition/section joins and unknown states. It imports no runtime and activates nothing. `repository-plan.json` gives phased source improvements without moving repositories or student originals.

## Work, findings and verification

Canonical local Work: `academy-workbench / academy-context-consolidation-20261021`; Issue `ACX-ISSUE-20261021`; Spec `ACX-SPEC@1`; Plan `ACX-PLAN@1`. Records live under `work/academy-workbench/academy-context-consolidation-20261021/`. Common Task IDs, catalog aliases, domain identities and native session IDs remain separate. Local source records do not establish global/native registration or formal shared completion.

`catalog.json` retains scoped ACX findings, evidence source IDs, owners/Tasks and next actions. `reviews/` preserves independent reviews including failed candidates and successor dispositions. A saved-data read, source test, immutable commit or synthetic SDK result is not live academy acceptance.

```sh
bun run check:academy-context
bun run test:academy-context
```

The existing Academy common-harness consumer lock remains `ffba2462…`. New GitWork records are checked with the separately pinned current common validator as an **external audit tool**; that is not a hidden consumer upgrade. Native effect receipts, prints, sends, runtime activation and production deployment are outside this Work. The user's latest instruction is to finish locally in this independent worktree and wait.

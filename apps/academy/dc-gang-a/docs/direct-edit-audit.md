# Direct-edit audit

Recurring workflow rule for DailyRecord authoring. When a pre-save fresh read
shows live values that differ from the last authoritative readback, and no
agent consumption/admission ledger covers those writes, record them as a
teacher/user direct site edit. This keeps every source change attributable
even when it bypasses agent tooling.

## When

Before every DailyRecord save, after the fresh `read` and before building
`actions.json`. Compare each target's fresh fields against the last
authoritative readback (or the last verification readback).

## What to record

Write one JSON file (`teacher-direct-edits-audit.json`, mode 0600) in the
private operations directory beside that save's control files:

- `subject`: lesson date, session, record key. No student names in git; the
  private file may name the student.
- `detection.windowStart` + evidence ref (last authoritative readback).
- `detection.discoveryReadIssuedAt` / `discoveryReadObservedAt` + evidence
  ref (fresh read dispatch timestamp and state-file timestamp).
- `changes[]`: one entry per drifted field with exact `before`/`after`.
- `actor`: `{type:'user_direct_site_edit', confidence:'inferred_by_elimination',
  basis:'...'}`. The basis must cite the ledgers checked (recovery ledger,
  current save ledger) and state that none covers the writes. Never present
  the actor as directly observed.
- `companionCheck`: other targets read in the same batch with no drift.
- `disposition`: how the pending save treats the detected edits.
- `recordedBy` (session id) and `recordedAt` (UTC).

## Preservation rule

Build the save's `after` on the fresh live value, retaining detected edits.
Never overwrite them with an older snapshot. The worker's whole-batch
preflight (`before` equality) and final readback enforce this; a drift error
stops the save for reconciliation, never for silent retry.

## Where it must not go

Student-identifying audit content stays in the private operations directory.
It is never committed to git, copied into fixtures, browser assets, hosted
previews, or public output. Only this PII-free convention is shared.

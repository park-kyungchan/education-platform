# Academy offline preservation adapter

This separate Node 24 package maps a recovered private source archive into the existing `academy.portable-dataset/1` contract. It creates a new private file package only. It imports no database/storage module, starts no server, makes no network requests and changes neither the frozen app nor its authentication. There are no npm dependencies.

```sh
npm test
node src/cli.ts /path/to/recovered-source /path/to/NEW-private-output
node src/verify-output.ts /path/to/NEW-private-output
```

Use a new directory outside the app, static/public roots and fixture directories. The CLI rejects existing destinations, source overlap, output symlink ancestors and recognized runtime roots. It creates private files with owner-only modes and refuses to overwrite them. Never upload outputs to a public repository or serve them in synthetic preview. The only approved sharing destination for this task is the user's existing private academy-workbench repository; the release pipeline must independently confirm that destination and inspect its manifest.

## Mapping boundary

- Portable student IDs are deterministic hashes of a fixed source namespace and exact source student ID. Original names, IDs and Page provenance are retained privately. Matching saved response identity with a D1 head is a structural corroboration only; independent source identity stays unverified.
- Every source file is byte-preserved and hash-checked. Every saved response is retained as an exact JSON-value roundtrip capsule with an internal pointer and SHA256. Unknown fields, teacher decisions, evidence relations, correction scopes, source labels/order and original timestamps remain in that capsule.
- Progress rows are indexed as preserved summaries, without turning scores or labels into completion decisions.
- Recovered ledger events must reproduce each D1 event_hash from JSON.stringify bytes. Original event IDs, source kind, scope, print snapshot/order and raw clocks remain intact. Only same-student resolved supersedes/retracts/conflicts become envelope relationships. Missing/cross-student targets are retained in raw JSON and explicitly reported without an invented join. `correctsEventId` is kept separate: a book-label correction is not whole-assignment supersession.
- Envelope kinds all begin `preserved_`; none activate the runtime's teacher-assignment, completion, membership or grading read models. `projections` is deliberately empty. Source-provided current/effective flags and authority claims remain untrusted data inside raw capsules.
- Source artifact, saved-page, identity evidence and progress record IDs include source content/version identity so revised snapshots do not overwrite immutable records. Portable student IDs remain stable. A later import with changed identity evidence still requires the frozen runtime's explicit reconciliation; this package does not bypass that gate.

The vendor validator is an exact copy from the audited standalone runtime, checksum-pinned in tests. Keeping it here makes the offline package independently runnable; it is not a fork of the server or an operational import command.

## Verified recovered scope and gaps

The reviewed dry-run covers 5 students, 38 saved-detail response pages, 717 progress summaries, 55 full ledger events, and 13 source files. It produces 815 preservation records and no active UI projections. Historical record pagination and the final unbound-evidence, unbound-decision and unresolved-attempt cursors are checked. Exhaustion means only the returned saved-projection scope, never complete academy history.

The original full source/build modules, original history/import bundle bytes and truncated D1 commit/import text are not restored here. Native academy student identity, current DailyRecord truth, detailed book/edition joins, teacher decision applicability and full Clinic print subset/order semantics remain reconciliation gates. Printed snapshot evidence must never be substituted with current grading or generated candidates. No send, print, delivery, attendance, video completion or operational decision is inferred.

`minute` and `approximate_minute` source clock precision have no exact equivalent in the frozen envelope; the normalized precision is conservative `unknown`, while the full original clock object remains unchanged in raw JSON. Raw source URLs are inert provenance; the adapter never fetches them. Bounded credential/signed-URL scanning rejects known patterns rather than silently stripping data, but is not a guarantee that every possible secret format is detected.

All automated implementation tests use synthetic inputs. The real dry-run is a separate private artifact and is excluded from this code package. Earlier local dry-run candidates are superseded; the reviewed final manifest identifies the accepted output.

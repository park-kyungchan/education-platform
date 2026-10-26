# REA note 2026-10-26 — name→key search contract in the pinned bundle

Method: static analysis of the pinned read-only bundle
`academy-class-operations-20261023/academy-client-period-r10.mjs`
(400,874 bytes; pins verified by the launcher, never modified).
No Ghidra needed: the bundle is JavaScript text, not a native binary.
No repo clone needed: all evidence is in the local pinned bundle.

## Finding 1 — DT result search is name-keyed on the wire

`searchDailyTestMetadata` sends only the name to the server:

- `POST /servlet/controller.dailyzerotest.DailyZeroTestServlet?reqCmd=DtResultSearch`
- body: `{sort_date: "1", stu_name: <studentName>}` (XHR, `credentials: same-origin`)

The `studentKey` input is used only for post-response row verification
(`inspectAssessmentSearchMetadata` + key/name equality checks), not for the
request itself. A name-only search against this servlet is contractually
possible; the key requirement is a bundle-side verification choice.

## Finding 2 — paper search is also name-keyed

`TestPageListServlet?p_process=UserBySearchTestResult&ass_no=1001` with
`stu_name` set from the input name (minimum length 2), plus college/class
filters copied from the live search form. Same conclusion: the wire needs
the name, not the key.

## Finding 3 — the response carries both sides of the mapping

DT result rows parse to `{studentKey, studentName, ...}`. The
2026-10-26T12:40Z live observation (1293067 ↔ saved-roster name) came from
exactly such a row. A name search therefore returns the native key
directly; no sequential ID probing is ever required.

## Constraints for the owner implementation

- The bundle pins page-script digests (e.g. `onSearchPage` digest
  `e1973c2e…`) and throws wire-drift on mismatch. Site changes break the
  pinned bundle by design; only the owner can re-pin.
- Session/auth lives in the owner process (`same-origin` fetcher,
  `authentication_required` handling, principal-conflict checks).
- `UserManageStudentServlet` is NOT called anywhere in the bundle. No new
  servlet is needed for name resolution; the DT servlet suffices.

## What remains owner-side (not doable from this environment)

1. Add a name-only search port method to the owner bundle (same DT servlet,
   same pins, no key upfront), or run the equivalent read in the
   credential owner's own process.
2. Run it once for the exact saved-roster name and return the row.
3. This Lead fills mapping row 2 from that row and proves the intake path.
   No guessing, no sequential probing, before or after.

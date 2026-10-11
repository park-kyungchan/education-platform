# Verification scope

The baseline passed a frozen-lockfile install, build, 103 synthetic checks and its original strict compiler configuration before edits. Baseline source hashes matched the exported main source bytes.

Current checks cover:

- Five preserved regression suites: 18 Worker/demo, 22 client-security, 17 teacher-overlay, 27 v1 domain, 19 evidence/decision checks
- Refactor golden/negative tests: original synthetic snapshots, provenance/time boundaries, native/local namespaces, teacher authority, partial updates, stale revisions, late results, trusted receipt isolation, missing live transport, scoped empty queries, DT separation, textbook hierarchy, embedded denominators, append-only audit, hash-pinned migration/rollback and strict packed payloads
- Offline request/parser tests: the one captured StudentNameSearch contract, synthetic HTML/AST decoding, exact scope/filter echo, forbidden side-effect actions, no script execution, no network, uncertain event time and unverified native field candidates
- Certification policy/results and catalog tests: inclusive 70-point threshold without a maximum/scale conversion, exact book/final/attempt evidence, unknown/ungraded states and unresolved retakes, static Main/Search descriptors, direct catalog rows, conflicting paper IDs, ambiguous filter echoes, script nonexecution, empty-list and score-template boundaries, and auth/redirect failures
- Architecture source lint/import scan and full strict TypeScript covering all modules, fixtures, scripts and tests
- Deliverable-source privacy scan
- Operating-context graph/source/coverage validation, strict and privacy-negative inputs, scoped revision-pinned selection, current versus superseded CISM rules, human LBAD/ST boundaries, 180-minute split makeup and evidence isolation, DT issue/score distinction, append-only nonstudent audit, preserved source/question hashes, explicit partial resolution, prior-notice makeup eligibility and soft contact timing, manager/teacher completion boundaries, scoped withdrawal markers/form separation, and book-date provenance without fallback inference. See [checkpoint ownership and limits](ACADEMY_OPERATING_CONTEXT.md).

`bun run lint` runs the existing architecture/explicit-any source lint and deliverable privacy scan directly. Git-ignored `.log` build/review outputs are excluded consistently with `.gitignore`. Tracked logs remain scanned; neither unrelated ignored logs nor private source inputs are published.

These checks do not prove real academy authentication, live transport, read-only effects, historical completeness, production owner policy, persistent storage, physical printing/delivery or production browser geometry. The DOM regression harness exercises interactions and computed CSS; it is not a fresh live-browser screenshot measurement.

Source-contract policy reuses a verified parser when source/contract/parser versions, response-schema fingerprint and automatic validation remain unchanged. New fields, failed validation or structural/version changes require narrow reinspection. Screen measurement is not required on every refresh. A disconnected or unauthenticated source still cannot execute even when its parser contract is reusable.

No real HTTP request, credentials/cookies, raw HAR, actual student record, platform-private ID, operational Site edit, GitHub write or deployment is part of these local tests. Generated test receipts describe synthetic execution only.

## Period-echo correctness correction

An independent synthetic replay showed that the initial offline parser could label a recent-one-week response, or a response with its date control removed, as recent-three-weeks. The corrected parser `academy.student-name-search-parser/1.1.1` requires one response `sort_date` control belonging to the search form, a supported enabled single select, exactly one explicit selected option, and its observed value/label matching the requested `3` / `최근3주` scope. Missing, conflicting, duplicate, disabled or ambiguous echoes return `DATE_FILTER_SCOPE_MISMATCH` with zero records. A missing selection never uses the HTML default-first rule to infer a period.

Successful static parsing records `filterEchoVerified` and `filterEvidenceSource='response_search_form_selected_option'`. This proves the supplied HTML's explicit filter echo only; it does not prove backend request execution, actual event-year bounds, complete history or live retrieval. Original v1/v2 delivery artifacts are preserved as historical provenance. Immutable delivery v3 includes the corrected source and period/query-echo/login regressions.

The selected option's unobserved `label` attribute is rejected, including a value matching its text. A nonempty attribute overrides text in the [HTML option-label algorithm](https://html.spec.whatwg.org/multipage/form-elements.html#the-option-element), so text alone cannot verify an option carrying that attribute. The narrow captured contract supports label-free options only.

The evidence 2.0.1 correction adds only synthetic reported/upload-time and message-provenance preservation checks for imported snapshots and inference, null preservation, separate clock semantics, unchanged source/trust and exact-byte migration rollback. It does not integrate operational Site configuration or richer private snapshots. The original code-only snapshots, legacy regressions and offline period parser remain separate validated baselines.

## Review acceptance regressions

Synthetic review witnesses exposed acceptance gaps in the canonical contracts: teacher authority derived from a claim label, duplicated evidence identities in audit events, and correction relations carried by ordinary append events. Confirmation now requires eligible teacher/reviewer source authority and a non-contradicted typed review statement. Audit events reject reused evidence IDs and require explicit, kind-consistent correction/retraction targets.

Additional regression checks cover missing/duplicate/row-bound unmapped records, complete disjoint ID-level evidence/decision display partitions, state decision-reference joins, independent delivery evidence, contradicted assessment identity, rollback migration identity/reversibility, and computed/spread overrides of decoded bootstrap data. These are minimum checks of existing invariants, not new source retrieval or deployment features.

Diary provenance can have two valid levels: a pinned canonical document and the baseline source preserved inside it. Their hashes and pointers need not be equal. Nonempty diary projections require `trustedDiarySourceLineage` in the validation context, derived independently from the selected student's pinned canonical source. Displayed baseline file name/hash/pointer must match that trusted lineage. Synthetic controls retain a valid distinct lineage while rejecting absent or mismatched expected provenance.

Bound/unbound display buckets classify evidence IDs, not every individual scope member. Evidence attached to at least one record belongs to the bound bucket; only fully unattached evidence belongs to the unbound bucket. Mixed-scope evidence keeps its complete original scope and source object. Rebucket an older derived projection without changing its underlying evidence, and track that bucket correction separately.

Offline parser 1.1.2 leaves `captureAt` unknown for arbitrary supplied HTML; `contractCaptureAt` remains the reference contract's separate timestamp. Labeling bytes `imported_capture` does not bind them to that reference capture. Static decoding rejects computed properties and spreads that could override its declared data. No response script or live source operation is executed.

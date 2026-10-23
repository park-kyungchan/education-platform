# Pure paper preparation and receipt review

The dedicated `pool-server.ts` registers three additional pure metadata tools. The existing five acquisition tools and candidate-set review retain their source and effect contracts. The saved-student entrypoint is unchanged. This module initializes no credential reader, source backend, file reader, native application, transport, model or agent runtime.

| Tool | Caller supplies | Result |
| --- | --- | --- |
| `academy_prepare_paper_plan` | Exact ordered selected question IDs and `sbj`/`des` variants; student and teacher layout/flag requirements; source hash/pointer bindings. | Deterministic plan and selection fingerprints; counts and derived expected student pages. |
| `academy_verify_paper_preparation` | That exact plan/fingerprint and a minimal projection from the caller's prepared template. | Positional ID/variant differences, source-binding drift and layout/flag differences; template hash only. |
| `academy_verify_paper_output` | That plan and caller-reported PDF/visual receipt summaries for both outputs. | Page/order/visual-coverage differences and bounded PDF/receipt hashes and page counts. |

All schemas are strict, with no raw 18-field native rows, original question text, answer values, images, URLs, owner IDs, private paths, credentials or arbitrary extra fields. An external owner projects only the declared metadata and retains the original private payloads and receipts. The tools do not construct a native Print envelope or persist selected membership.

## Plan contract

`schemaVersion` is `academy.paper-plan/1`. `selection` contains 2–24 unique `{questionId, variant}` entries. IDs are original numeric question identities, not native owner/student IDs. Even length is required because the student requirement is **exactly two questions on every physical page**. Order and response variant are significant. `sbj`/`des` identify selected source variants; those names alone never establish the actual prompt response mode or solution roles.

`student` requires `{examDisposeType:'d2', questionsPerPage:2, examSpacer, addAnswer:0, addExplain:0}`. `teacher` requires `{examDisposeType:'line', examSpacer, addAnswer:1, addExplain:1}`. `examSpacer` preserves the source-observed integer; a disabled UI showing zero does not authorize substituting zero for a stored value. Unsupported layouts are refused. The original symbolic label `LINE` corresponds to the lowercase wire value `line`.

`sourceBindings` has three required roles, `selection`, `nativeLayout` and `nativeOptions`. Each contains only `{sha256, jsonPointer}`. Hashes refer to caller-owned exact bytes, with a pointer into those bytes; no source location is resolved by these tools. JSON pointers may be empty for a whole document. Automatic repinning, source qualification and authentication are absent. A changed hash or pointer changes the plan fingerprint; prepared metadata must bind the same roles exactly.

The SHA-256 fingerprint hashes the UTF-8 domain prefix `academy.paper-plan/1`, one newline, then canonical JSON with recursively sorted object keys and preserved array order. The separate ordered-selection digest uses the prefix `academy.paper-selection/1`. Fingerprints include the complete strict parsed plan, including original source hashes/pointers and all declared options; they contain no clocks or machine paths. This is a domain fingerprint, not a new shared Harness, Ontology identity or execution permission.

The current first case has 24 teacher-selected questions, 16 `sbj` and 8 `des`, so the student plan derives **12 expected pages**. The earlier delivered four-page student PDF remains a historical official output and does not satisfy this later two-per-page requirement. The teacher retains `line`; its page count is unconstrained. The user's two distinct circle questions sharing one research type remain a separate explicit selection exception. No candidate ranking or retrospective preference is inferred here.

## Original layout evidence

The 2026-10-19 private source review bound original public module bytes SHA-256 `b0e0a011fa82b672886e20f84cc8846b76c663297226b058aeb672c8598594d3` and an inert selector-script export SHA-256 `b1053f5b9a1ac1df6dba70b3909e1e43c6611e78949b91f3c1e8e15285ac359a`. These are historical qualification evidence, not automatically current source pins or a runtime activation:

- `PCD_NS.DIV_TYPE` exposes `D2:'d2'` and `LINE:'line'` in module lines 103–107. `getDivTypeHtml`, selector lines 2130–2163, labels `d2` as two-partition intent.
- `getDivTypeUI`, selector lines 2685–2702, permits division selection for student answer/explanation `0/0` and forces `line` for teacher answer-plus-explanation mode. UI division changes leave the stored spacing value intact.
- `callCreatePrint`, selector lines 1380–1440, and `getEachModeTypesetObject`, module lines 1052–1080, serialize original layout and spacing values. They do not prove an actual physical PDF page count.

Fresh source qualification, native execution and actual PDF readback remain the external owner's responsibilities. These pure functions neither read those source files nor call the original functions.

## Output receipt contract and limits

Each caller-reported output includes its `pdfSha256`, `receiptSha256`, the exact `planFingerprint`, actual `pageCount`, ordered `pages` and `visualReview`. Each page identifies question starts in **numbered reading order**, with contiguous physical page numbers. Text-extraction traversal order alone is not sufficient: the earlier two-column output demonstrated that extraction can interleave columns differently from printed numbering.

The receipt fingerprint binds the caller's review target, not the historical native command. A fresh caller-reported review may compare an unchanged retained teacher PDF to a later student-layout plan; it must preserve the original teacher-generation record and identify the new review's own receipt hash. It does not rewrite a past native correlation or assert that the old teacher output was regenerated.

For the student, every physical page must contain exactly two approved question starts and the total must be `N/2`. Flattened question IDs must match the selection exactly, without cover/blank/extra/missing/duplicate questions. The teacher has no page-count constraint; continuation pages may contain no new question starts, but all selected starts must remain in order. Every physical page must be visually covered, with rendering and selected variants checked. Student answer/explanation visibility must be absent; teacher answer/explanation visibility must be present. Given worked examples in an original prompt are not answer-key overlays. Original answer/explanation graphics can be invisible to a text extractor, so missing extracted markers do not establish absence.

Two review methods can provide that caller-reported coverage. The existing `human_visual` method still requires every page in `reviewedPages`; `not_reviewed` still produces a hold. Alternatively, `jev_first_with_human_exceptions` requires the exact Gateway model ID `typesafe-ai/jev-1.14.0`, a `calibratedPilotReceiptSha256`, and one `pageReviews` entry per physical page. Each entry contains `pageNumber`, `sourcePdfSha256`, `pngSha256`, `responseReceiptSha256` and `modelStatus` (`pass`, `uncertain` or `issue`). Its PDF hash must equal the corresponding output receipt's PDF hash. Page numbers must cover the complete output uniquely and within range; a response receipt may cover a batch of pages.

This method also requires `humanReviewedPages` and `highRiskPages`, both unique and within the output's page range. Every page marked `uncertain` or `issue`, plus every declared high-risk page, must appear in `humanReviewedPages`. Model-pass pages do not require a human entry unless declared high risk. The shared `answers`, `explanations`, `variants` and `rendering` fields describe the caller's final review facts after exceptions are considered; unresolved facts still hold. Exception coverage alone does not establish that a reported issue was repaired or that a mathematical answer is correct.

The model name, pilot receipt, page PNG hashes, model statuses and human review entries are supplied metadata. This tool neither opens an image/PDF/receipt nor calls a model, checks the pilot's calibration or predicts mathematical correctness from model confidence. The external owner must retain the actual pilot, page-image mapping, original responses and human exception observations; their existence or adequacy is not independently proved here. No confidence threshold or acceptance decision is inferred from a `pass` label.

`consistent_caller_reported` means only that declared metadata satisfies these comparisons. It is never source-byte verification, an independently observed native result, mathematical/pedagogical acceptance, delivery or physical printing. Every result retains `classification:'caller_supplied_metadata_review'`, `sourceBytesVerified:false`, `nativeExecutionVerified:false`, `acceptance:'not_inferred'` and zero source/native/file effects. Unknown, unreviewed, stale or mismatched observations produce a hold. Private originals and any unknown native outcome stay with their existing owner; the tools cannot retry, resend, clear a hold or repair an output.

## Local verification

Run `bun run check` and `bun run test:pool` inside this package. Synthetic tests cover deterministic fingerprints, strict privacy boundaries, stale bindings, wrong order/variant, original spacing preservation, the old four-page student mismatch, twelve-page impostors, incomplete human review, Jev-first page/PDF bindings and human exception coverage, exact model/pilot requirements, separate teacher output, and actual SDK discovery of nine tools with outbound networking denied. These tests do not start or operate the official program and do not change native/global MCP registration. Shared Ontology 0.2.0 pins are unchanged.

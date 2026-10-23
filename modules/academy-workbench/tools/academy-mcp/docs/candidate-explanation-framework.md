# Source-bound candidate explanations

This reusable Academy domain contract explains a recommendation relative to the other actual options in the same slot. It consumes existing evidence and research. It does not acquire questions, call a model, establish student understanding, select final membership, generate a paper, run a PDF action, or change source/native authority. The existing question-pool read contracts and six-tool registration remain unchanged.

The authoritative semantics remain in Education's `apps/academy/month-end-workbench/docs/source-context.md` and the pinned `math-research-module@07edb2dea2e5997aea4318f0fa2efa21dde633df`. Shared Ontology 0.2.0 and canonical Harness validators are unchanged. This contract introduces Academy explanation objects, not shared Artifact kinds or a new agent runtime.

## What must be explainable

An ordinal and a generic similarity paragraph are insufficient. A reader should be able to trace:

1. Which original research type, example, design or microstep supplies the claim, at an exact owner/revision/path/hash/JSON pointer.
2. Which atomic quantities, relations and student actions the analyst has separated, and which dependencies connect them.
3. What the original prompt explicitly requires, what a possible method merely permits, what the official source solution shows, and what the assistant independently derived.
4. Which research activities the candidate actually elicits, partly elicits, does not elicit, or leaves unknown.
5. Why the preferred option is preferable to each same-slot alternate, and what each alternate offers or loses on the cited mathematical structure or required-process dimension.

No model or validator can establish these mathematical judgments merely by checking their shape. Incorrect interpretations can remain well-formed; they still need substantive independent review.

## Contract and layers

`src/pool-explanation-review.ts` exports `candidateExplanationPacketSchema`, `reviewCandidateExplanations` and `buildCandidateExplanationView`.

| Field | Meaning |
| --- | --- |
| `identity` | Existing Project/Work pair, explicitly local and not globally registered. It grants no authority. |
| `inputBindings` | SHA-256 of the exact candidate-set and research-projection JSON bytes, plus the immutable research revision. |
| `slots[].researchUnits` | Attributed atomic units with source references and dependencies. `source_observation` and `analyst_decomposition` remain distinct. |
| `slots[].layerCoverage` | Exactly one row for DATA, LOGIC, ACTION and GOVERNANCE. Missing original material is `not_recorded` or `uninterpreted`, with an explanation. |
| `candidates[].observations` | Separate `prompt_requirement`, `official_solution` and `assistant_derivation` observations with exact candidate evidence IDs and explicit/inferred/unknown certainty. |
| `candidates[].alignments` | Atomic unit-to-observation links, supported/partial/conflicting/unknown state, elicitation status, rationale and material differences. |
| `candidates[].dimensions` | Explicit coverage of structure, reasoning, representation, conditions, errors and transfer. Unassessed dimensions stay visible. |
| `pairwiseComparisons` | Every unordered same-slot pair. An established preference or tie needs two-sided alignment-bound facts. An unresolved historical ordinal keeps a null winner and explicit unknowns. Three options require three pairwise comparisons. |

DATA describes given quantities, representations and requested unknowns. LOGIC describes relations, invariants, constraints and reasoning dependencies. ACTION describes observable student work. The user's exact label `SECURITY(GOVERNANCE)` is retained alongside normalized `GOVERNANCE`. Original research material in that layer must be source-bound if represented; its absence must not be filled with invented original policy. The consumer separately exposes source-security controls (read scope, credential owner and original-image custody) and pedagogical governance (attributed judgments, decisions and acceptance boundaries). Both cross the other layers; neither authorizes an action.

An official worked solution is evidence of the source solution, not evidence that the prompt demands that method. An assistant derivation remains attributed analysis. A fully supported ACTION alignment therefore needs an explicitly elicited prompt requirement; an available or inferred method alone can only support a qualified partial/unknown claim. A numeric answer cannot prove the strategy a student used.

## Pure consumption

```ts
import {reviewCandidateExplanations, buildCandidateExplanationView}
  from './src/pool-explanation-review.ts';

const review = reviewCandidateExplanations(packet, {
  candidateSetJson,       // Exact already-authorized artifact bytes as UTF-8.
  researchProjectionJson // Exact source-owned projection bytes as UTF-8.
});
const view = buildCandidateExplanationView(review, 'D08');
```

The caller owns file access and authorization. These functions perform no filesystem or network operations. Do not hash a reserialized object and claim it is the original file: whitespace also changes file-byte identity. A changed locator-only portable projection has a different identity and needs its own review.

The existing `reviewCandidateSet` must pass independently. Source references must match the selected type's actual type/example/design/microstep references and pinned manifest. Observation IDs resolve only within the exact same candidate. Dependency cycles, foreign candidates, stale or uninspected evidence, unaddressed atomic units, unsupported dimension coverage and missing pairs prevent binding readiness. An established preference or tie also requires two-sided reasons. The view preserves available attributed content and displays its gaps, rather than concealing all research because a preference remains unknown. It is JSON data, not executable HTML or an action plan.

`readiness: reviewable` means the supplied binding/coverage graph is coherent. `preferenceReadiness` separately reports whether every supplied pair has an established comparative preference or includes ties/unresolved judgments. If the historical ranking lacks a genuine comparative explanation, use `preferenceState: unresolved`, `preferenceBasis: historical_ordinal_not_reestablished`, a null `preferredCandidateId` and substantive `unknowns`. Empty tradeoffs are valid in that case; do not fabricate an advantage to pass. The historical source ordinal is preserved separately, not retrospectively proved by this packet.

`buildCandidateExplanationView` returns `available_with_gaps` when preferences remain unresolved or binding issues exist; known research, observations, differences and explicit issues remain visible. A missing/invalid packet or slot is held. Automatic ranking remains disabled in every state. Source claims are caller-supplied and not independently authenticated; schema success is not mathematical acceptance, full-task equivalence or proof of complete pool search. Comparisons cover the inspected same-slot alternatives only.

## First case and separate user selection

The corrective explanation task belongs to the existing `education-platform / month-end-candidate-preparation-20261019` Work. Its historical proposal contains 24 distinct primary types and 57 original question identities: four candidates have strong judgments on both core axes, and 53 have at least one partial judgment. Keep those partial differences; do not upgrade them to make an explanation look complete.

The user subsequently selected 24 positions for the first native-PDF case and explicitly allowed the C3/C4 duplicate-type exception. That attributed selection is a separate input record, not a reason to mutate the historical 57-option set or weaken its distinct-type review. Record the user's exact positions, original candidate identities, exception scope and decision source/hash separately. Do not silently deduplicate, invent a new type, infer a general duplicate policy, or claim that a supplied selection was applied to the Academy server. The root-owned `month-end-native-pdf-20261019` Work owns any separately authorized PDF activity; this framework creates no additional Work and implements none of those actions.

Original Academy images, their embedded official answers/explanations, raw responses, authentication, native launch settings and private absolute paths remain outside published explanation packets. Preserve opaque evidence references and digests. Their absence from Git is an explicit reinspection limitation, not permission to fabricate an observed image or official solution.

Run `bun run test:pool` and `bun run check` from this package. New tests use entirely fictional research/evidence and exercise byte identity, original-source binding, solution/requirement separation, unknowns, dependency/coverage failures and relative-comparison completeness. They grant no native runtime or teacher acceptance.

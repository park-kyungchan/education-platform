# Academy operational context intake: local contract candidate

This document specifies a small domain intake and retrieval contract for review. It does not implement a store, approve a policy, activate a runtime, or authorize an Academy effect. Existing admitted owners and scope apply. The user's current instructions remain authoritative within their stated scope.

## Shared harness and ownership

The common harness is CLI agnostic, including Hermes. An Academy rule has the same meaning regardless of whether a Codex, Hermes or other supported client presents it. Client-specific adapters may differ in capabilities and authorization, but must preserve source identity, scope, uncertainty, and effect boundaries. A CLI name, session, workspace, or local path is not a domain identity or permission.

`dc-gang-a` owns Academy operational-policy meaning and qualified domain data. `academy-workbench` owns its context-discovery metadata, not a second policy store. `agent-platform` owns common Work, Memory, and Recall algorithms and shared contracts. Native owners retain profiles, authentication, sessions, execution, and existing data. This candidate does not prescribe an unverified common API or replace existing adapters.

## Intake and routing

1. Classify each input as an operational rule, dated occurrence or student observation, attributed teacher judgment, proposed action, or unresolved question. Preserve the distinction when an input contains several kinds.
2. Preserve the original statement and its provenance in the appropriate owner-controlled custody only when the input and destination are authorized. Record who supplied it, when it was received, and any known source revision. A discovery catalog stores bounded references, not private originals or a second canonical copy.
3. For a rule, record its subject and activity; applicable organization, class or cohort, date range and recurrence if actually established; conditions, outcomes, exceptions, and explicit unknowns. Distinguish a user instruction from an agent's interpretation or proposal. An unknown scope is not a global scope.
4. Link a policy to relevant workflows such as assessment preparation, attendance, makeup lessons, and class preparation. Links are discovery metadata; confirm the owner, current version, scope, and source before applying a rule. Multiple links point to one owned policy rather than duplicating its meaning. An occurrence belongs in its own dated source and is not proof that a rule was executed.
5. Preserve corrections as attributable, scoped successors with their relationship to the earlier statement. Different occurrences or scopes do not overwrite each other solely because of a later timestamp. If applicability or precedence is unresolved, surface the uncertainty rather than choose silently.
6. Retrieve by task and applicable scope, using bounded metadata first and only the necessary qualified source fragments next. Respect all pages, exclusions and existing byte limits. If a rule is unavailable, stale, ambiguous or outside the retained coverage, say so; do not infer an absence of a rule or an action.

The existing `context:academy entry`, `reading-plan`, and bounded `select` routes provide discovery today. This document is exposed by the entry as a locator only; it is not yet an automatically selected policy or an implemented intake pipeline. No token or latency improvement is claimed without measurement.

## Worked interpretation, not an admitted policy

The user described a monthly-assessment-period absence example: a student absent during the Monday-to-Wednesday assessment period does not take a separate test, receives a regular makeup lesson, and the examination paper is discarded; when absent Monday and attending makeup on Wednesday within that period, the student takes the test then. Preserve that exception alongside the initial rule. Do not infer the dates, academy-wide applicability, recurrence, or unmentioned cases. Do not derive a student event, a scheduled lesson, a completed test, or actual paper disposal from this statement.

This example explains representation. It is not a newly admitted policy record, a fixture containing student information, or authority to save, print, discard, grade, or send anything. Before persistent admission, qualify its owner, destination, scope and current authorization. Corrections and later instructions may narrow or replace only their established scope.

## Phased follow-through

- Now: review the domain contract and expose its bounded locator without changing runtime ownership or implementing a second common harness.
- During P6 and subsequent integration: map this contract to the actually accepted shared harness and owner adapter interfaces; define how current versions, scope, pagination, correction lineage, privacy and errors are represented across supported clients. Preserve immutable existing contracts and native ownership.
- P7: verify equivalent routing and scope/unknown handling with synthetic examples across admitted client adapters and their actual interfaces; measure token and latency costs against a stated baseline, including wrapper overhead and all pages.
- P8: have the user/teacher assess actual workflow usefulness and decide acceptance. Evidence of source tests or synthetic equivalence is not teacher acceptance or native activation. Later rollout depends on the relevant owner and effect gates.

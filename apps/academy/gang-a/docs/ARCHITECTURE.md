# Architecture and ownership

## Before

The baseline put runtime transport/authentication, JSON decoding, scope policy and response assembly in `src/worker-handler.ts`; mutable browser state and receipt checking in `src/app.ts`; projection schemas and business policies in `src/domain`; and multiple unrelated contracts in `academy-domain.ts`. Rendering used explicit `any` for most payloads. The old compiler configuration omitted the top-level domain contract, several tests and the Bun build scripts.

## After

One package and one build chain remain. Directory boundaries encode responsibility; no workspace micro-packages, generated repositories or independent deployment machinery were added.

Domain modules have no network, filesystem, UI or backend implementation. Canonical identities use distinct branded local and native keys. An unverified native candidate never becomes a local record key or verified native identity by label matching.

Application policies validate unknown inputs, preserve immutable source objects, and make selected-student updates under a revision lease. A failure changes attempt/error coverage while retaining prior observations, successful timestamps, teacher memo and teacher decisions. Other student objects remain untouched. Source success requires a trusted server-side receipt verifier and a matching verified native student identity. This verifier has no shipped live implementation.

Ports describe what a future adapter must supply. The in-memory store is a synthetic, in-process test adapter. It performs compare-and-append, rejects overwritten evidence history and never provisions a persistent store.

Managed Sites dispatch remains the owner authorization authority. Full pinned context bytes are checked before protected decoding. After decoding, strict schemas and graph/scope checks run before response emission. Schema assertions preserve original JSON order and source references when hash verification depends on exact serialized values. The client also validates the complete response schema before changing visible state and preserves request-sequence/auth-loss behavior.

The wire remains v1 for compatibility. Every runtime evidence projection is additionally normalized through the v2 discriminated-source and branded-ID contracts without rewriting its wire object. Persistent v2 migration is preparation-only and needs pinned original bytes plus a revision lease. Direct LMS records are refused because the live adapter is absent.

UI components receive validated data and own only their DOM/local state. Selectors keep source observation, teacher authority, completion, print, delivery and receipt independent. The rails renderer has no automatic global QA/bootstrap mutation. Teacher labels remain source labels. The legacy overlay preserves its original 1–21 source-label contract; canonical student/evidence/decision models have no roster-size limit.

## Source evidence

Canonical source variants are `user_report`, `imported_snapshot`, `direct_lms_observation`, and `inference`.

- User reports have reporting time and optional reported event time. Tool observation/capture times remain null.
- Imported snapshots require an immutable source reference and SHA.
- Direct observations require a native-tool receipt; receipt syntax alone is never trusted.
- Inference requires input evidence IDs and a rule version.

Decisions bind student/entity scope, evidence IDs and rule version. Teacher completion requires separate authorized teacher-review evidence. A high score, absent row, diary statement or inferred mapping cannot confirm completion.

Audit events are canonical-hashed and deeply frozen. Corrections/retractions append new events linked to prior evidence and preserve the old event. Revision conflicts fail rather than silently replacing teacher history.

## Assessments and hierarchy

DT=DailyTest class activity and Daily Restudy textbook section have different discriminants. Native identity comparison rejects differing kinds. The imported v6 assessment contract is available for empty/not-collected projections and exact diary-source preservation; it is not wired to the v5 demo response and does not claim an operational Site migration.

Textbook nodes bind book edition and parent relation state. Duplicate IDs, missing/cross-edition parents, cycles and row-record mismatches fail validation. Included written-response content stays attached to the final lesson and never creates a second grading unit or completion denominator.

## Extension rules

Add a new source only after verifying its operation, read effect, response shape, native identity and authorization independently. Keep transport secrets server-side and outside this repo. Introduce an independently deployed package only when a real deployment/dependency boundary requires it. Update schema version, migration/rollback contract and golden tests together.

`tests/architecture.test.ts` scans production/fixture imports and supplements strict TypeScript with explicit-any source lint. It prevents application-to-adapter and adapter-to-UI dependencies, restricts domain runtime imports, and bounds the documented v1 transition exceptions.

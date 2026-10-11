# Mathematics Cartography

## Scope and language

The Project name is `Mathematics Cartography`. Its only writable Project root is exactly `/opt/data/workspaces/mathematics-cartography`.

User-facing conversation is Korean-first. Every durable artifact, identifier, contract, schema, test, log, receipt, and handoff is English.

## Product

This Project builds academy-independent Mathematics Cartography: explicit mathematical meanings, canonical identities, evidence, and relations that remain useful without any academy, curriculum, textbook, learner-operation, vendor, or application context.

The first approved operational loop is:

```text
MathematicalFragment
-> candidate kind
-> SAME | DISTINCT | OVERLAP | UNKNOWN identity judgment
-> RelationProposal
-> evidence and uncertainty review
-> Human-approved canonicalization, rejection, or deferral
```

Model output is proposal-only. It never mutates canonical mathematical meaning by itself.

## Language and runtime boundary

- Canonical domain meaning and interchange contracts are language-neutral.
- The first executable compiler and verifier use strict TypeScript.
- Pinned Node.js is the reference runtime; npm is the canonical package manager.
- Python may later provide a thin Hermes or research adapter without duplicating domain semantics.
- Bun is deferred to a separate Node-parity experiment after a verified Node baseline.
- Rust is deferred until a measured native bottleneck and a portable parity judge justify it.
- Palantir OSDK, Functions, and Foundry dependencies are absent unless a later unit admits a real target and exact adapter boundary.

## Evidence and authority

Keep source facts, user-approved decisions, Lead-selected proposals, executable local evidence, `UNKNOWN`, and `DEFERRED` distinct. Source schemas and external products are evidence; they do not own canonical mathematics.

`ontology-control-plane` owns Hermes lifecycle and runtime compatibility. The `math-ontology` Lead stewards mathematical meaning. The user is final semantic and external-effect authority.

Treat academy `Today`, `Live Class`, Attention, Journal, mobile, and learner-operation artifacts as historical evidence only unless the user explicitly reopens them. Do not read protected academy data, credentials, cookies, student values, or PII.

This Project does not establish Foundry/AIP integration, compatibility, certification, or deployment.

## Engineering

For substantive multi-step work, load relevant skills first and initialize the Task API. Keep one item `in_progress`, use small dependency-ordered tasks, and close with zero pending work.

Use strict TDD for production behavior: one failing test, one minimal implementation, one green readback. Prefer `1 behavior + 1 negative + 1 deterministic command + 1 immutable result`.

Run exactly:

```bash
npm_config_offline=true npm_config_audit=false npm ci --ignore-scripts
npm run typecheck
npm test
npm run verify
hermes verify --phase test --skip-start --json /opt/data/workspaces/mathematics-cartography
```

Do not add a dependency, runtime, profile, plugin, MCP server, Cron job, Kanban task, gateway, service, external Action, or remote Git effect without a separately admitted unit.

## Historical foundation entry gate

`PROJECT_FOUNDATION_VERIFIED_NO_DOMAIN_IMPLEMENTATION` was the original entry gate. It is explicitly satisfied and does not describe the current repository checkpoint.

The committed foundation baseline is commit `4f55511400956f5c024ddb326bbd515f0c58db04`, tree `a686197c17d8a8e0dcc279305074b9ebf5ce3385`. That baseline contains no production ontology behavior.

## Current checkpoint and stop condition

### Reviewed R9 candidate

`INTERVIEW_AND_TDD_FRAGMENT_EVIDENCE_REVIEW_PACKET_001-R9` passed review as `PASS_REVIEWED_STRICT_JSON_TEXT_INGRESS_UNCOMMITTED` over the exact 19-path candidate aggregate `eb8921ae2f67f3d48da40ca127085f078e551b14d703b998986692d266d633c7`.

The candidate is proposal-only. It leaves `humanDecision=PENDING` and `canonicalApplication=NOT_PERFORMED`; Human disposition and canonical application remain separate future authorities.

### Post-reconciliation current state

Before the reconciliation commit containing this text, R9 is `REVIEWED_PASS_UNCOMMITTED`. In that one local commit and later, it is `REVIEWED_PASS_COMMITTED_LOCAL_NO_PUSH`. This transition records unchanged candidate and evidence bytes; it does not perform Human disposition, canonical application, a remote Git effect, or an external Action.

Current stop condition: `R9_REVIEWED_PASS_PROPOSAL_ONLY_COMMITTED_LOCAL_NO_PUSH_HUMAN_DECISION_PENDING_NO_CANONICAL_APPLICATION`.

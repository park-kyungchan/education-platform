# Mathematics Cartography

A source-independent workspace for small, executable Mathematics Cartography contracts.

## Status clocks

### Committed foundation baseline

Commit `4f55511400956f5c024ddb326bbd515f0c58db04`, tree `a686197c17d8a8e0dcc279305074b9ebf5ce3385`, is the original environment foundation. That baseline establishes the strict TypeScript and Node.js toolchain and contains no mathematical identity resolver or canonical graph.

### Reviewed R9 candidate

`INTERVIEW_AND_TDD_FRAGMENT_EVIDENCE_REVIEW_PACKET_001-R9` is a reviewed PASS over the exact 19-path aggregate `eb8921ae2f67f3d48da40ca127085f078e551b14d703b998986692d266d633c7`. It was reviewed as `PASS_REVIEWED_STRICT_JSON_TEXT_INGRESS_UNCOMMITTED`.

The candidate is proposal-only. It leaves `humanDecision=PENDING` and `canonicalApplication=NOT_PERFORMED`; Human disposition and canonical application remain separate future authorities.

### Post-reconciliation current state

Before the reconciliation commit containing this file, R9 is `REVIEWED_PASS_UNCOMMITTED`. The one local commit containing this file records it as `REVIEWED_PASS_COMMITTED_LOCAL_NO_PUSH`. The reconciliation edits only status prose and its foundation test; it records the already-reviewed R9 candidate without altering candidate bytes, mathematical meaning, or compiler behavior.

Current stop condition: `R9_REVIEWED_PASS_PROPOSAL_ONLY_COMMITTED_LOCAL_NO_PUSH_HUMAN_DECISION_PENDING_NO_CANONICAL_APPLICATION`.

## Runtime boundary

```text
language-neutral contract
-> strict TypeScript compiler/verifier
-> pinned Node reference runtime
-> optional thin Python seam later
-> Bun parity only after Node baseline
-> Rust only for a measured bottleneck
```

## Verify

```bash
npm_config_offline=true npm_config_audit=false npm ci --ignore-scripts
npm run typecheck
npm test
npm run verify
hermes verify --phase test --skip-start --json /opt/data/workspaces/mathematics-cartography
```

See `AGENTS.md` for authority, safety, and stop conditions.

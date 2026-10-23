# Work on this handoff

- Read README.md, MIGRATION_PLAN.md, context/business-decisions.json and migration/README.md first.
- This is a sanitized continuity package. The runnable part is a prebuilt synthetic renderer, not a production backend.
- Treat reference/sites-v21 as a partial source reference. Missing private data modules and hosted-runtime bindings are intentional. Do not silently synthesize real data to satisfy imports.
- Preserve unknown, conflicting, partial and stale states; never turn missing evidence into nonperformance or completion.
- Keep source facts, teacher decisions, plans, actions and derived projections separate. A JSON document or UI selection does not grant external authority.
- Keep original assessment, student attempt, current judgment, wrong-item subset, generated similar paper, printed snapshot, distribution and teacher review as distinct identities.
- Preserve exact edition-local section labels and hierarchy. Do not invent absent levels or conflate similar names.
- Require scoped evidence for 100-point clinic exemption. A score never proves print, distribution, correction or teacher review.
- Preserve already printed similar-clinic membership. Re-generation is a separate event and must not replace historical print evidence.
- Parent DailyRecord has progress, homework and parent-relevant memo projections. Internal teaching plans stay internal. Draft, review, server save and actual send remain separate states.
- Before uploading, validate all files including generated bundles for private identifiers, student data, credentials, compressed payloads and private source links.
- Do not deploy, contact people, print, mutate academy records or configure authentication merely because this package describes those operations.
- Do not treat historical validation receipts as a pass for a changed implementation. Record passed, failed and not-run checks separately.

## Pinned common harness consumer

- Read `project.json`, `harness/module.json`, `harness/work/identity.json` and `docs/harness/README.ko.md` before module changes.
- Shared schema and runtime validator logic belongs to the pinned `agent-platform` dependency. Keep only domain-specific types and consumer transport glue here. Never fork or regenerate canonical source into this repository.
- Record Project/Work/Task/Run identity before implementation, with local-record versus global/native registration stated explicitly. Work is a separate projectId/workId contract, not a new shared Artifact kind.
- Run `bun run check`, `bun run test`, `bun run test:synthetic-runtime`, and `bun run test:offline-adapter`. Report WSL/VPS/native integration and acceptance as unverified unless actually observed.
- Do not rewrite original archives, historical context, completed effects or remaining operational gates as a setup/check side effect. Context inspection emits only a non-authorizing projection and refuses an existing checkpoint.

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

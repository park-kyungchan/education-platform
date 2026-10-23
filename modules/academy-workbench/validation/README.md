# Export validation

manifest.json hashes every exported file except itself. source-hashes.json records the original and exported bytes of copied inputs; newly written handoff documents are identified by the final manifest. dependency-gaps.json is a static import scan of intentionally partial reference code, not a compiler result. omissions.json explains what was not copied and how to resume safely.

Run `node scripts/verify-export.mjs` to verify UTF-8/text-only files, prohibited paths/extensions, basic private-ID/secret/encoded-data patterns, JSON syntax and final hashes. This performs no app build, app test, source request, authentication or deployment.

During preparation, an additional non-exported comparison used the known source roster and provenance identifiers, with manual review of generic endpoint selectors, category enums and package integrity hashes. The exported verifier deliberately does not embed the real deny-list values. Static safety checks do not establish operational readiness. Any change requires new review and a refreshed manifest.

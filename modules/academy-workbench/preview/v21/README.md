# Existing synthetic v21 preview

Serve this directory on 127.0.0.1 and open preview.html (responsive iframe) or index.html (direct screen). No package build is needed. index.html contains the preserved app and safety bundles inline; app.js and safety.js are equivalent inspectable standalone outputs. All records in fixture.ts were originally created from zero for UI testing.

The app bundle and CSS match the vetted existing v21 renderer. This package does not rerun or replace the earlier browser validation. Original source snippets are in reference/sites-v21/src. The fixture wrapper intercepts allowed API requests and rejects unknown ones; CSP blocks external connections, links/forms are blocked, and native WebMCP registration is disabled.

The preview is not a source authentication test, a real worker contract/schema pass, a live adapter, a durable write service, a native WebMCP pass or a hosted deployment. Simulated receipt flags must remain visibly synthetic. The preserved test.ts uses happy-dom after an importer installs a compatible version in their chosen environment; it is not run as part of this export.

The old environment-specific build and TypeScript configuration files were omitted. Rebuild only after creating a self-contained, dependency-checked source tree in the target environment. Do not import private generated payloads to satisfy that build.

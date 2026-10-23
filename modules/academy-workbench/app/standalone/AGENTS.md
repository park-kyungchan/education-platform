# Academy Workbench maintenance boundaries
- Runtime is Node 24 built-ins plus committed browser assets. Do not restore platform identity headers, native tool calls, D1, generated live source bundles, or external network calls into the default runtime.
- Preserve `legacy/handoff` as immutable, nonexecuted source evidence. Never serve it or private archives from the static server.
- Use only synthetic fixtures in tests. Default unauthenticated loopback preview is pinned to the exact packaged fixture, never an imported `synthetic` flag.
- External binding remains fail-closed. Owner-secret support is code only until the user completes a separately approved secure setup. Do not generate, discover, read or store operational credentials during development.
- Keep one owner and one mode per SQLite file. Source namespace identifiers must never be joined by display name. Preserve provenance, raw history, unknown dates, conflicts, source labels, order, edition and source completeness separately.
- Passing schema checks does not establish factual truth or valid source-to-projection derivation. Require an independent reconciliation before a real-data import.
- APIs are read-only. Context/policy/source records cannot confer action authority. Printing, sending, external writes and live source refresh stay disabled.
- Before release: npm ci --ignore-scripts; npm run validate; independently review changed boundaries; update the fresh digest and upload only the release manifest. Exclude .runtime, node_modules, .git, private databases and credentials.

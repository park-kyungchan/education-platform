# Academy Workbench: independent local runtime

This candidate runs without ChatGPT, Sites, platform identity headers, hosted D1, cloud credentials, or network access to an external service. It is a runnable, read-only local app with persistent SQLite, committed browser assets, and five explicitly fictional students. It is not yet a completed migration of the actual academy data or workflows.

## Run without a platform login

Install Node.js 24 or newer from its official distribution. From this directory:

```sh
npm start
# or, without npm or any package installation:
node src/server/main.ts
```

Open http://127.0.0.1:8787/ in the browser on the same computer. The first run creates `.runtime/synthetic.sqlite`; later runs reuse it. `/health` is data-free. The default is `WORKBENCH_AUTH_MODE=loopback-preview`, restricted to 127.0.0.1 (or explicitly configured ::1), and verifies the exact packaged fixture at startup and on every protected request. Merely labeling other data synthetic does not authorize preview access. All non-loopback binds fail closed, including in owner mode.

`.env.example` documents settings; it is not loaded automatically. Use your shell environment, or Node's `--env-file` option for a separately prepared file. Do not put secrets or private datasets in this repository. No credential was created, read, configured or saved for this candidate.

## Development and reproducibility

The committed `package-lock.json` is from the actual verified official npm dependency installation. Development-only dependencies are exact-pinned TypeScript, esbuild, Happy DOM and Node types. There are no production npm dependencies.

```sh
npm ci --ignore-scripts
npm run validate
```

`validate` typechecks, rebuilds, runs server/SQLite and built-browser tests, and regenerates `validation/runtime-dependency-audit.json`. Node can start the committed assets without `node_modules`. A changed source or browser build invalidates the prior runtime digest. Development package installation requires access to the official npm registry; normal runtime does not.

## What is available

- Selected-student textbook rails, TOC/edition uncertainty, included contents, teacher candidate overlay, desktop stepper and responsive DOM behavior.
- Student event/assignment summary, Today saved-summary view, date/session policy browser, policy hierarchy and source drawer.
- Historical grading evidence, diary/assessment-coverage view and explicitly disabled live-refresh readiness.
- Seventeen work-domain filters with owner-scoped paged raw records, independent provenance timestamps and retained correction relationships.
- Atomic, idempotent SQLite imports through a typed internal adapter, immutable records, source-identity uniqueness, versioned projections and persisted import history. HTTP remains read-only; there is deliberately no private-import write command yet.

The synthetic dataset has 5 students, 144 records, 4 illustrative policies, and no actual academy records. Policies and date cohorts are stored references: matching a saved weekday pattern does not prove attendance, class occurrence or task completion. Retracted/superseded current events and memberships are excluded; conflicting completions are never checked. Historical evidence remains readable. Student event summaries show at most 100 assignments and 100 checkpoints with explicit partial-coverage counts. Read-model scopes above 10,000 raw records are unavailable; the raw-record API remains paged. These are explicit limits, not source-completeness claims.

## Readiness and remaining migration gates

1. **Local synthetic preview:** implemented and testable without any platform login.
2. **Owner authentication boundary:** implemented, with fixed synthetic in-memory test values only. It is not operationally configured. Owner mode requires an explicitly supplied existing private secret file and a distinct database path. The user must complete an approved secure setup before actual use. Header spoofing, forwarded headers, wrong hosts/origins and cross-site requests are rejected. There is no multi-user login, recovery, TLS termination or external deployment support.
3. **Actual academy source:** not connected or imported. The separate recovered private archive is not automatically a runtime dataset. Its byte/hash audit does not establish student bindings, current decisions, projection correctness or full source coverage. See `docs/private-import-contract.md`.
4. **Operational work:** real assessment parsing, schedules/attendance/corrections, full policy graph, attachments, forms, Clinic, authored material, delivery and consultation require explicit source mapping and reconciliation. Generic domain filters and restored UI do not implement every prior action. Printing, sending, external mutations and live queries remain disabled.

The Today panel honestly reports that today's source has not been queried. Imported assessment-domain rows without a verified display adapter produce an unprojected-record notice rather than an invented zero-attempt conclusion. All runtime receipts say `sourceIdentityIndependentlyVerified: false`; source facts and policy content cannot grant action authority.

## Verification and archives

Tests use real local HTTP, actual SQLite close/reopen persistence, hostile input, current-history exclusions, scope/auth gates and the built browser bundle with external fetch denied. The dependency audit traces the Node import closure and browser metafile. Any GUI observations are recorded separately in `validation/gui-smoke.json`, if present; DOM viewport tests are not physical-phone testing.

`legacy/handoff` preserves the original 132-file sanitized handoff at commit `0f5ecda4e3c02e0ebd04fffcc1707f986b9c1da7`. It contains historical platform-dependent code for reference only. No runtime import or static route reaches it. The active server serves only `/`, `/app.js` and `/app.css`; archive/database/environment paths return 404. React Bits attribution is retained under `licenses/`.

This is a fresh recovery candidate following the observed workspace reset. Earlier lost milestone hashes are not used as evidence for this tree. Repository upload receipts, when provided separately, determine what has actually been persisted remotely.

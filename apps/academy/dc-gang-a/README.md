# Native academy source compatibility

Code/spec selected from the native dc-gang-a worktree at observed HEAD 5074aeb5649c1a97ad06d33b9f895296fb4c3ad6. Per-file hashes, rather than HEAD alone, identify imported dirty source. Operational personal records, profile state, runtime credentials and excluded domain trees are absent.

Run `bun install --frozen-lockfile --ignore-scripts`, then `bun run check` for local synthetic source behavior. Existing server and HTTP/query paths remain available under the same package-local names. `academy:serve` still requires its exact owner profile and private native database/configuration; integration does not promote or activate it.

`data/raw_sessions` contains exactly two TypeScript type declarations required by original imports. It contains no raw session records.

## Retained owner runtime

`bun run academy:serve:retained` explicitly starts the existing teacher frontend,
TeacherAuthStore and PostgreSQL ledger with source acquisition disabled. It uses
the same existing `dc-gang-a-dev` owner directory, `owner.json`, `web-auth.json`,
database schema and loopback 8411 listener as `academy:serve`. It creates no
identity, credentials or database and does not migrate a production schema.
Normal `academy:serve` retains its existing direct-HTTP composition.

In retained mode the source-acquisition composition is not constructed. Refresh
requests fail closed; existing source-request history remains readable. Exact
local clinic judgments and teacher observations retain their original separate
contracts, actor scope, revision leases and durable outcome recovery. They are
not official Academy saves, parent sends or physical printing. Retained data
and a software test do not prove source truth or actual teacher acceptance.

For an isolated synthetic PostgreSQL database and installed Google Chrome:

```sh
DC_ACADEMY_TEST_SOCKET=/path/to/owned/test/socket \
DC_ACADEMY_BROWSER_OUTPUT=/path/to/private/test-evidence \
bun run test:retained-owner-browser
```

The project-pinned Playwright dependency drives the real shipped login form and
frontend over a task-owned HTTPS origin. The test uses the existing application
schema in `dc_academy_test`, a synthetic existing AuthStore identity and temporary
test TLS certificate. It stores one exact item judgment, restarts the server in
a new process, checks the browser/API and an independent database connection,
and verifies unchanged auth bytes and no application outbound fetch. It never
injects a signed login cookie or uses real student data. Screenshots and receipts
are implementation evidence; the user deliverable remains the application
frontend. Native production activation and real-data reconciliation are separate.

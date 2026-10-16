# Academy MCP source port

`createMcpSourcePort(undefined, projection)` returns unavailable without starting a process. This file is server-only; no launch paths, CLI bundle, bridge configuration or native records belong in static/frontend bundles.

The operator explicitly builds a standalone Bun bundle of the reviewed `academy-mcp/src/label-server.ts`, including its transitive dependencies, then records SHA-256 pins for the canonical Bun executable path, bundle and native bridge configuration. The operator supplies the object below directly to the backend factory. No browser request can supply it.

```ts
{
  executable: {path: '/absolute/canonical/bun', sha256: '...'},
  bundle: {path: '/absolute/private/label-server.bundle.js', sha256: '...'},
  source: {mode: 'native-readonly', bridge: {path: '/absolute/private/bridge.json', sha256: '...'}}
}
```

Actual child arguments are fixed: `bun --no-env-file BUNDLE --native-bridge CONFIG --native-bridge-sha256 SHA`. The child receives only a fixed PATH. It reuses the existing bounded native backend/getter; the adapter never reads/forwards credentials. Existing bridge ownership, immutable native pages, exact visited category/label guards and no authentication retry remain unchanged. Root/operator alone runs native verification.

For synthetic operator smoke, use `source: {mode:'synthetic', snapshot:{path,sha256}}`. Fixed arguments become `--label-snapshot FILE --label-sha256 SHA`. Fixtures must carry explicit synthetic provenance and original-shaped `nativeId` values. Retained label snapshots establish no question inventory. No fixture fallback is used by default.

Only `academy_item_label_scope`, `academy_find_item_labels`, and `academy_review_type_questions` can be called. Existing DailyRecord/CISM tools may be discovered but are never called. Every response must echo the exact research revision, source manifest pins, source context, scope-bound study report and desired axes with a digest. This is task binding, not authenticated source truth or authority. The adapter separately issues opaque source/cursor handles and refuses foreign or changed bindings. Label `pat_no` and question `lecture_key` remain different namespaces even if their numeric values happen to equal.

The source context revision describes selector/process observations, not global currentness. Pages of the same mode, owner, scope, revision, receipt hash and clock reuse one bounded context handle, preserving previously exposed labels and question cursors. Changed receipts get distinct handles; page offsets remain in source evidence. Native categories preserve their original coordinate tuple, depth and lazy/folder flags; label-read capability is exactly `cl3 > 0`. Unsupported native levels are refused locally before source access. Retained/synthetic snapshots without native tuples expose unknown capability. Teacher edition/unit declarations and native metadata remain distinct: only two known different literals hold comparison. Missing source metadata allows provisional read-only comparison with explicit limitations and stays null; it is never filled from the teacher declaration. Research revision, opaque handles, exact study report, intent and question cursors remain strictly bound. Question content revisions remain independently recorded. Lexical candidates are provisional; every unevidenced mathematical axis stays unknown. Close the returned port on session/server shutdown. Read refusal, transport failure or malformed source response closes the process and requires owner resolution without automatic retry.

Verification: `bun test tests/integrations` uses fictional SDK sources and the actual compiled label entrypoint with outbound HTTP/TCP denied. Passing synthetic checks does not verify native authentication, actual source reads, teacher study, mathematical acceptance or production integration.

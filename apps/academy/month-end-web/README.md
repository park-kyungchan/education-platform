# 문항실 · independent month-end frontend

A repository-owned static frontend for studying detailed question types, exploring existing labels, and reviewing month-end requirements. MagicPath, Sites, a remote design runtime, external fonts, accounts and API credentials are not runtime dependencies.

```sh
cd apps/academy/month-end-web
bun run check
bun run preview
```

Open `http://127.0.0.1:4173/` or `http://127.0.0.1:4173/education-platform/`. The second route exercises GitHub project-page asset resolution. The build is `dist/`; serve that directory with any ordinary static server. Paths are relative, and local licensed Noto Sans KR/Noto Serif KR assets are included with their OFL licenses.

`dist/review.html` is a self-contained review file with embedded script, styles, fonts and licenses. Open it directly in a browser without a server. Its inline script/styles are authorized by exact CSP hashes; external connections remain blocked.

The preview deliberately contains eight newly authored synthetic UI examples. They are neither Academy source questions nor an automatically generated examination paper. Real inventory, edition/unit scope, source currentness, and exact exam date/timezone remain unknown. Filtering preserves input order. No ranking, final membership, source requests, printing, storage or official writes occur in the browser. `connect-src 'none'` blocks remote data access. Real labels and authentication belong to the private custom MCP/backend, never to this public bundle.

`build.ts` consumes the existing `inspectExamPreselection` owner and `teacherExamSelectionContract`. It does not fork grading or selection logic. The separate frontend TypeScript project uses the native Academy module's strict compiler policy because its imported domain closure is not authored under the integration harness's `noUncheckedIndexedAccess` option.

`bun run test:browser` uses the existing Academy Playwright dependency. Install its browser in the repository-private `.private/browsers` directory, or use a host with the supported Playwright runtime. The source tests exercise actual Chromium search/filter/detail flows, untrusted text, unknown inventory, independent date/timezone changes, no API/storage effects and desktop-to-320px layouts. On a minimal Debian host, optional runtime libraries and Fontconfig can be unpacked under `.private/browser-libs`; no OS install or existing browser profile is required.

`.github/workflows/month-end-pages.yml` runs only on manual dispatch. Its default builds an artifact; deployment additionally requires `publish=true`. No push, PR, merge, workflow dispatch or Pages configuration has been performed. Repository Pages availability/plan and deployment protection remain a later reviewed release step. GitHub's [custom workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) describes the Pages configuration and deployment permissions.

The supplied MagicPath project could not be inspected: the connected API reported exhausted quota, and the ordinary project URL redirected to the homepage. This implementation reconstructs the source-owned workflow and recorded visual preferences; pixel equivalence to that private MagicPath project is not established.

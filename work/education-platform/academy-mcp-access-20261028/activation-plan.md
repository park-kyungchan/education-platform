# Proposed academy MCP activation (not executed)

Source candidate: Education `work/academy-mcp-access-20261028` at `64e9e8eb55b382f426ba96f6cc6ade37acb87db0`. Local build and synthetic verification are recorded in the adjacent README. No credentials or student record bodies are contained in this plan.

## Fixed observed targets

- Codex registration `academy_operations` is enabled and uses `/root/.local/share/academy-mcp/server.mjs` as a stdio endpoint. This is a running client configuration, separate from source.
- Installed neutral bridge `/root/.local/share/academy-mcp/server.mjs`: SHA-256 `c3d31d2bd72c438edea57f18f5ebb1dd39fc2159d78a9700f7113adb81d16390` at inspection.
- Native account lock: `/home/palantirkc/operations/academy-class-operations-20261023/native-academy-account.lock`.
- Fixed owner container at inspection: `/hermes-agent-2q3y-hermes-serve-1`, ID `4189cb30782e97cf38b97a0f91a99e14cb9dd1696990d2583c61304acde9d360`, image ID `sha256:1acfd8025bbc868e5d9dc668577e33d01a6a42211c5b7dc320564ab74568af25`, `/opt/data` writable mount.
- Owner artifact base: `/opt/data/profiles/dc-gang-a-dev/artifacts/class-operations-20261023`. Current launcher pins a native config, owner admission, DailyRecord bundle, and learning-policy inputs there.
- Class session currently identified by Herdr as `wV:p9`, Codex session ID `01a1810f-e982-7a83-b6a4-9a3be47e3b36`. Recheck identity and idle state before any resume; retain the conversation.

## Proposed effects and qualification

1. Recheck candidate hashes, the exact owner target, image, live container ID, existing account lock, and current registration. If any target differs or a required lock cannot be obtained without disturbing another task, stop and reconcile. Do not print credential values or real student records.
2. Create new versioned successor artifacts under the existing owner artifact base for the candidate owner client, DailyRecord server, updated owner admission, and a successor native config that changes only source bundle location and digest. Preserve the old artifacts, owner identity, existing student bindings, policy pins and lock. Validate hashes and owner permissions; do not edit existing pinned artifacts in place.
3. Create versioned neutral bridge, endpoint, routing and tool-registry artifacts under `/root/.local/share/academy-mcp/` and verify matching admission digests and tool discovery. Atomically publish the release pointer only after all pinned components are ready. No existing receipt, updater state, job, or transaction is edited.
4. Point the Codex `academy_operations` registration at the versioned neutral bridge so future Codex sessions can load it. This changes Codex MCP configuration and therefore requires the user's explicit authorization. Existing other sessions remain untouched; old loaded bridge processes do not become new processes automatically.
5. Resume the same `wV:p9` Codex conversation with its existing model/effort and the new tool registration, then check discovery and issue one user-requested read for item label `1341447`. Report the official literal or the exact source limitation; distinguish a literal from a verified rendering and from student/paper answers. A timeout or ambiguous result is reconciled, not blindly retried.

The selected 2026-10-28 owner admission is source-only until activation. DailyRecord reads, item-answer reads, and this activation do not authorize modifying academic records, printing, grading, sending, deploying a website, changing unrelated runtimes or touching other panes. Later historical, metadata, CISM, or multi-session access remains qualified by each actual backend and source contract, not inferred from this plan.

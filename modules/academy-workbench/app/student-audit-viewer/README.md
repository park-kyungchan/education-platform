# Portable private student audit viewer

Node.js 24 built-ins only. This new read-only module reads the five-student audit from an explicitly selected local JSON file. It does not require Sites, Space, D1, a browser extension, an MCP plugin or outbound network access. It preserves source facts, teacher decisions, history, unknown states and partial coverage separately. Its file hash proves bytes, not completeness or factual truth.

The existing synthetic standalone app remains unchanged. This module reuses its fail-closed owner authentication and loopback request-boundary helpers; it does not duplicate common agent-platform harness implementations. Work identity is local only. The WSL2/VPS/Dots native runtime remains responsible for execution and permissions. No actual WSL2/VPS environment has been configured or verified.

## Security and startup

No unauthenticated real-data mode exists. The application requires an existing, explicitly configured owner secret file (32–4096 bytes, no newlines, owner-only permissions, no symlink), an explicit audit JSON path and its SHA-256. It never creates/discovers/saves credentials. Creating operational credentials requires a separate approved secure procedure; no operational setup was performed for this module.

After that setup, an authorized operator can set AUDIT_DATA_FILE, AUDIT_SHA256 and AUDIT_OWNER_SECRET_FILE in the selected runtime environment and run:

    node app/student-audit-viewer/main.ts

Optional AUDIT_HOST accepts only 127.0.0.1 or ::1; AUDIT_PORT defaults to 8790. The browser uses Basic authentication with username owner and the already configured secret. Never send the secret in chat, logs, command arguments or Git. Remote exposure, reverse proxies, TLS setup, ports, tunnels and firewall/security changes are not implemented or authorized by this README. Do not bind 0.0.0.0 to make VPS access work.

## Views and source links

Each authorized selection shows one student: books and exact section labels, matching teacher routes, assignments, videos, current server observations, DT/ZT and historical attempts. Raw detail panels preserve unresolved evidence rather than inferring completion. The navigation roster shows five names; student detail APIs return one selected student. Current snapshots may contain overlapping observations and are not deduplicated or silently joined by names.

The source locator resolves to the exact local audit hash and /students/N JSON pointer. Historical Page identifiers are retained as inert provenance, never used for network lookup or active Space links. Private archives and filesystem paths are not exposed through arbitrary static-file routes. Source reading is performed once at startup; updating the file does not silently update the running snapshot.

## Validation

    node --test app/student-audit-viewer/tests/*.test.ts

Tests use five entirely fictional students and an in-memory test-only authentication value. No operational credential or actual student dataset is opened by HTTP tests. Tests cover hash pinning, scope, escaping, no external links, authentication, origin/host/proxy checks, path traversal and rejected writes.

See capabilities.json for explicit parity gaps. This is not a complete replacement for the old Site: append-report/import tools, durable ledger migration, native MCP tool parity, operational authentication, remote serving and recovery remain unimplemented/unverified. Do not delete the old Site based on viewer tests. The old hosted Site is unchanged.

## Rail/Pulse presentation

The preserved application rail stylesheet is reused by the portable presentation adapter. Student navigation precedes book and naturally ordered subunit rails (1-2 before 1-10). Section cards show source observations separately from original/similar teacher decisions. A filled pulse denotes an observed grading record, not completion. DaVinci has no third series dimension; raw source labels and revision identity remain unchanged. The core HITL interview is confirmed; detailed video-review criteria are deferred. This module does not create teacher completion decisions.

Local OS-authorized readers may use `node app/student-audit-viewer/cli.ts <audit.json> <sha256> [studentId]` without an HTTP listener. This is an internal diagnostic route, not a user deliverable. No operating credentials are generated.

Tests and type checks pass in the cloud executor. Browser pixel QA remains unverified: the cloud browser disallows file URLs and could not reach the executor's loopback synthetic test server. Actual WSL2/VPS execution remains unverified. The existing Sites deployment was not changed or deleted.

## User delivery boundary (latest instruction)

Only the final application frontend is a user deliverable. Do not create/send standalone HTML, ZIP or report-file exports, and do not substitute an attachment when frontend access is unavailable. Local source and migration preservation evidence are implementation inputs, not deliverables. The earlier export helper is withdrawn from the release path. Actual owner-accessible frontend deployment still needs a verified target and current authorization.

## Optional same-day lesson overlay

The frozen audit remains unchanged. To show a separately pinned lesson supplement,
set both `AUDIT_LESSON_FILE` and `AUDIT_LESSON_SHA256` alongside the existing audit
and existing owner-secret settings. With neither, the existing viewer behavior is
unchanged; setting only one fails closed. No credentials are generated or changed.

The overlay has its own preparation timestamp and per-observation server query
and teacher-report times. It is saved evidence, never a live refresh on page load.
Only the selected student's cards are rendered. Missing lesson data does not mean
no learning took place. Teacher arrival reports are distinct from server attendance.
The existing `/api/audit` and `/source` remain frozen-audit-only; no new raw-file,
lesson API, mutation, external bind, export, or unauthenticated route is introduced.

Teacher final judgment updates only the exact stated scope. Clinic labels are
unique scopes, not physical sheet counts; original app scores and paper all-correct
results remain distinct. New-book concept work retains the user's raw book label
until its native edition mapping is explicitly verified. No new snapshot replaces
`private/student-audit-20261014/audit.json`.

# Private migration envelope and integrity gates

The authoritative executable types and validator are `src/server/contracts.ts`. The envelope is `academy.portable-dataset/1`: datasetId, ownerId, mode, createdAt, students, records, artifacts, projections. For actual data, mode must be private and the target must be a distinct owner-authenticated SQLite file. The read-only `npm run inspect:import -- /path/to/dataset.json` checks syntax and scope without writing a database. It does not verify source truth.

## Identity and history

Portable student IDs are distinct from `{namespace, sourceId}` bindings. Choose a stable namespace for each original system/export identity; never infer identity from a name. One namespace/sourceId maps to one portable student within and across imports. Binding evidence must be scoped to that same student. Changing an existing binding or display name requires reconciliation rather than silent overwrite.

Records have immutable IDs, nullable studentId for owner-level context, a domain, kind, raw JSON data, provenance, and separate supersedes/retracts/conflicts ID lists. The referenced records must be included and have the same student scope. Retain original assertions and withdrawn reports; never transfer their dates or claims to another student. Current interpretation is explicit and conservative, not latest-timestamp-wins. Correction chains and source conflicts need factual reconciliation before production decisions.

Provenance contains sourceKind, sourceReference, sourceHash, sourceRevision, observedAt, reportedAt, occurredAt, recordedAt, originalTimeLabel, timePrecision, verification, completeness, queryScope, coverageWindow and pagination. Unknown/yearless dates stay unknown. Hashes are provenance, never live lookup keys. Source completeness is separate from local database pagination.

## Artifacts and projections

Artifact metadata is `{id,mime,filename,bytes,sha256,archivePath,sourceObjectId,acquiredAt,availability}`. No signed URLs, session keys or credentials are allowed in this contract. Paths are relative internal archive references. The current app exposes metadata only; serving binary attachments requires a separately audited owner-scoped adapter. Keep source attachment bytes outside the runtime/repository unless explicitly authorized for that private destination.

A projection names studentId and sourceRecordIds and contains view, includedContents and teacherOverlay. Structural validation checks the student/record scope, TOC graph, exact teacher attempt joins and safe counts. It does not prove that view content was factually derived from those records. Before actual import, independently reconcile each displayed claim against retained sources, preserve book edition identity and unresolved mappings, and retain source order, print order and current grading as separate fields.

## Supported and unprojected kinds

The current read models understand teacher_assignment, activity_checkpoint, grading_observation, saved_diary, confirmed_membership and workflow_policy. Other kinds remain visible in raw records and must not silently become a completion, absence, attendance, send, or grading decision. Membership supports sessions 1/2, effective dates and a source-confirmed date; unknown historical starts do not generate historical cohorts. Domain coverage is partial even where records exist.

Limits: 100 MiB serialized envelope, JSON depth 40, 1,000,000 nodes, arrays 50,000, explicit read-model cap 10,000 records. Event display summaries are bounded with partial flags; raw records are separately paged. A successful inspection is not permission to import or operationalize private records. No actual student records have been loaded by this release.

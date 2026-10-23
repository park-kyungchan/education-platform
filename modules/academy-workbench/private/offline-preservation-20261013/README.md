# Private offline preservation envelope

PRIVATE academy records. Authorized destination: park-kyungchan/academy-workbench only. This directory is an offline archive; it is not served, imported into a database or used as an active runtime projection.

Four binary parts reconstruct the exact pre-existing 1,747,827-byte tar.gz with SHA-256 66f017f0bfa0daee0c8b853d82abd1bb090ad8a859373861daed20ee2a15bc35. The archive preserves 16 files, including 13 byte-exact saved source files, an 815-record envelope with five students, a mapping report and the original package manifest. The envelope has zero active projections.

From this directory, verify without extracting:

    python3 restore_academy_archives.py

Restore the original academy-private-offline-envelope-20261013 directory alias:

    python3 restore_academy_archives.py --output /path/to/empty-output

The Python standard-library script checks each part, the unchanged complete tar, every member path and SHA-256, and conflicts before restoration. It rejects links and unsafe paths, never overwrites differing files, and performs no network call or code execution. Restored files use mode 0600. Use a private destination directory. No database import or runtime activation is performed by this script.

## Boundaries and gaps

This is lossless preservation of the available files, not a verified current-state migration. Original import/commit texts, source/build/history modules, videos and snapshots remain incomplete where documented. Saved student detail responses are projections; identity and current state require independent verification. Correction, withdrawal, conflict, print subset/order and delivery semantics remain raw. Source completeness and source-deletion eligibility are false.

Hash-linked reports in audits/ cover byte preservation, bounded credential scanning and independent adapter review. No actual credential or signed authentication URL was found. Student records and ordinary source provenance are preserved as authorized. Earlier archive packages remain unchanged.

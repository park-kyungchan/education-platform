# Private academy source archives

These files preserve the audited academy source and context packages byte for byte. This directory is archival data; it is not an application dependency. The destination must remain private.

## Verify without restoring

From this directory, run:

    python3 restore_academy_archives.py

The script joins multipart files in manifest order, verifies every part and compressed archive, then verifies every original file. It uses only Python standard-library modules and makes no network request.

## Restore original directory aliases

    python3 restore_academy_archives.py --output /path/to/empty-output

Optionally select one bundle with --bundle gang-a, pages-and-attachments, dc-source, or dc-context. Restored aliases are explicit in each bundle manifest. The script refuses unsafe paths, links, duplicate paths, and existing files with different contents. It never runs archived code. Newly created files have mode 0600.

- gang-a: recovery-gang-a/source-archive, github-metadata, derived-context
- pages-and-attachments: recovered-academy-source-archive-20261013/pages and attachments
- dc-source: recovery-dc/frozen-source
- dc-context: recovery-dc/context plus recovery-dc/context-freeze.json

Pages become readable JSON files after restoration; attachments retain exact original bytes. Original repository Git blob IDs and tree metadata remain preserved inside the packages. The manifests map every archive member to its restored alias, byte count, SHA-256, and Git blob SHA-1. Original security/provenance reports are in audits/ and are hash-linked from the manifests.

## Coverage limits

The dc source archive still lacks three declared font blobs: NanumGothic-Regular.ttf, NotoSansKR-variable.woff2, and NotoSerifKR-variable.woff2. Source-completeness and deletion eligibility remain false. Recovery wrappers and regenerated derived graphs do not claim byte identity with lost earlier wrappers. No source deletion or new execution permission is granted.

# Supplement: saved Sites student and ledger recovery

PRIVATE academy records. Authorized destination: park-kyungchan/academy-workbench only. This is independent archival data, never a live Sites/application dependency.

This supplement leaves the previously prepared four bundles unchanged. It preserves 13 exact files, including five students, 38 response pages, 717 progress records, 55 full events with original D1 SHA-256 matches, five ledger heads, and all 21 saved Site-version provenance entries.

Run the following from this supplement directory, separately from the main four-bundle catalog:

    python3 restore_academy_archives.py
    python3 restore_academy_archives.py --output /path/to/empty-output

The restore script verifies both multipart segments and the unchanged tar SHA-256, then all 13 original members. The original academy-sites-source-gap-audit-20261013 directory alias is restored. It uses only the Python standard library, makes no network call, rejects unsafe paths and conflicting files, and never executes archived code.

## Explicit gaps

Two original import-source raw_text values and eight original commit request_json values remain truncated. Full Site source/build modules, original videos, lost logs, and other unavailable source snapshots are not recovered by this supplement. Tool hash-chain flags are preserved claims; complete original commit bodies are needed for independent chain validation. Source completeness and deletion eligibility remain false.

The independent security/provenance report is in audits/ and is hash-linked from the bundle manifest. No credential or signed-authentication URL was found. Original student data and ordinary provenance IDs/links are preserved as authorized.

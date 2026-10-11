# Native academy source compatibility

Code/spec selected from the native dc-gang-a worktree at observed HEAD 5074aeb5649c1a97ad06d33b9f895296fb4c3ad6. Per-file hashes, rather than HEAD alone, identify imported dirty source. Operational personal records, profile state, runtime credentials and excluded domain trees are absent.

Run `bun install --frozen-lockfile --ignore-scripts`, then `bun run check` for local synthetic source behavior. Existing server and HTTP/query paths remain available under the same package-local names. `academy:serve` still requires its exact owner profile and private native database/configuration; integration does not promote or activate it.

`data/raw_sessions` contains exactly two TypeScript type declarations required by original imports. It contains no raw session records.

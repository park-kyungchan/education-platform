# Owner-scoped source review CI

The active generated gate calls the immutable common owner API at `7eabcdb20e358955c771e5aa0dc500448fa84534`. Its fixed repository, Project, domain, semantic owner, source scope and publisher policy are in the provider manifest and generation entry. It does not reuse common-only V2 ownership or Hermes provenance. Existing core and Ontology0.2.0 pins remain unchanged.

The finite publication topology is reviewed source H → unchanged actual native raw report R0 → normalized result plus canonical Evidence/Verification E → immutable receipt R1. The latest authenticated exact-head `native-independent-review` status must link R1; a newer hold/failure refuses older pass. Root publishes real independent output and explicitly merges only the expected reviewed head. Synthetic tests authenticate no native author and establish no teacher or production acceptance.

The existing canonical consumer generator compiles immutable Git object inputs, all38 immutable Ontology release files, and the six public dependency packages from SHA512-verified archives pinned in the exact common lock. Every loaded input and dependency archive/file digest is recorded. AJV is bundled; the review job needs no private cross-repository checkout or dependency install. The original dependency/core lock and private/native/data owners are preserved. Academy retains its exact original17-file dependency cache separately.

Regenerate with reviewed Bun1.4.3 (exact revision/binary pinned in the manifest), the explicit existing common Git object store, and a directory containing the six exact npm `.tgz` archives named `<package>-<version>.tgz`:

```sh
bun ci/generate-projection.ts COMMON_GIT_ROOT LOCKED_ARCHIVE_ROOT --write
bun ci/generate-projection.ts COMMON_GIT_ROOT LOCKED_ARCHIVE_ROOT
bun ci/verify-projection.ts
```

Use the repository's current generator path in place of ci/generate-projection.ts. Archive integrity, source hashes, compiler bytes, import graph and reproducibility must pass before source review. Generation reads immutable object bytes even when another working tree changes; it never resets or installs into that owner. CI verifies generated and generator hashes before executing. This source projection is neither a native store clone nor native permission/activation proof. Publication, actual hosted CI and final combined-source review remain separate gates.

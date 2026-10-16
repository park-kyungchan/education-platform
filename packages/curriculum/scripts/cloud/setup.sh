#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
command -v bun >/dev/null || { echo 'Bun 1.4.3 is missing from this execution PATH.' >&2; exit 1; }
test "$(bun --version)" = '1.4.3' || { echo 'Bun must be exactly 1.4.3.' >&2; exit 1; }
bun install --frozen-lockfile --ignore-scripts
bun run validate

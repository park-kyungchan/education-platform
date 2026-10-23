#!/bin/bash
set -euo pipefail
cd /workspace/scratch/3bd8c10a8771
cp magicpath_math_research/src/components/generated/* /tmp/math-research-test/generated/
.tooling/bun/bin/bun build /tmp/math-research-test/entry.tsx /tmp/math-research-test/research-entry.tsx /tmp/math-research-test/action-entry.tsx --outdir /tmp/math-research-test/build --target browser --format iife
node /tmp/math-research-test/contexttest.cjs
node /tmp/math-research-test/actiontest.cjs
node /tmp/math-research-test/researchtest.cjs

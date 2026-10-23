import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { moduleRoot, verifyPlatform } from './agent-platform.ts';
const { root } = await verifyPlatform();
const dir = resolve(moduleRoot, '.harness-runtime');
await mkdir(dir, { recursive: true });
const config = {
  compilerOptions: {
    target: 'ES2023', module: 'ESNext', moduleResolution: 'Bundler', strict: true,
    allowImportingTsExtensions: true, noEmit: true, skipLibCheck: true, types: ['bun-types'],
    paths: {
      '@agent-platform/ontology-types': [resolve(root, 'packages/ontology/src/generated/contracts.ts')],
      '@agent-platform/work-context-types': [resolve(root, 'packages/work-continuity/src/context/types.ts')],
    },
  },
  include: ['../scripts/agent-platform.ts', '../scripts/setup-harness.ts', '../scripts/typecheck-harness.ts', '../scripts/check-harness.ts', '../scripts/work-context.ts', '../scripts/generate-ci.ts', '../ci/restore-dependency.ts', '../ci/verify-projection.ts', '../ci/require-v2-receipt.ts', '../harness/**/*.ts', '../tests/harness/**/*.ts', '../tests/onboarding/**/*.ts'],
};
await writeFile(resolve(dir, 'tsconfig.json'), JSON.stringify(config, null, 2) + '\n');
execFileSync(process.execPath, [resolve(moduleRoot, 'node_modules/typescript/bin/tsc'), '-p', resolve(dir, 'tsconfig.json')], { stdio: 'inherit' });

import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { moduleRoot, readPin, verifyPlatform } from './agent-platform.ts';

const pin = await readPin();
const root = resolve(process.env.AGENT_PLATFORM_ROOT ?? resolve(moduleRoot, '.harness-deps/agent-platform'));
if (!existsSync(root)) {
  if (!process.argv.includes('--fetch')) throw Error('Dependency absent. Clone agent-platform yourself or use setup:harness --fetch with existing GitHub access.');
  await mkdir(dirname(root), { recursive: true });
  // The fixed private upstream is the only network target; no credential helper is configured.
  execFileSync('git', ['clone', '--no-checkout', pin.repository, root], { stdio: 'inherit' });
  execFileSync('git', ['-C', root, 'checkout', '--detach', pin.commit], { stdio: 'inherit' });
}
const source = await verifyPlatform({ root, installed: false });
if (source.mode !== 'git-checkout') throw Error('Snapshot mode is validation-only. Provision pinned dependencies separately; setup never rewrites a snapshot.');
// Runs in the operator-selected dependency checkout, never native Codex/Hermes configuration.
execFileSync(process.execPath, ['install', '--frozen-lockfile', '--ignore-scripts'], { cwd: root, stdio: 'inherit' });
console.log(JSON.stringify(await verifyPlatform({ root }), null, 2));

import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

import { packageRoot, repoRoot, resultRoot, reaEntry } from './paths.ts';
export { packageRoot, repoRoot, resultRoot, reaEntry } from './paths.ts';

export async function connectRea(profile: 'full' | 'compact') {
  const temporaryDirectory = resolve(resultRoot, 'tmp');
  await mkdir(temporaryDirectory, { recursive: true, mode: 0o700 });
  const transport = new StdioClientTransport({
    command: 'node',
    args: [reaEntry, 'mcp'],
    cwd: packageRoot,
    env: {
      PATH: process.env.PATH ?? '/usr/bin:/bin',
      TMPDIR: temporaryDirectory,
      XDG_CACHE_HOME: resolve(repoRoot, '.local/cache'),
      REA_LOG_LEVEL: 'error',
      REA_MCP_INPUT_SCHEMA_PROFILE: profile,
      REA_MCP_OUTPUT_SCHEMA_PROFILE: profile === 'compact' ? 'off' : 'full',
    },
    stderr: 'pipe',
    maxBufferSize: 64 * 1024 * 1024,
  });
  const client = new Client({ name: 'academy-rea-api-verification', version: '0.1.0' });
  const errors: string[] = [];
  transport.stderr?.on('data', chunk => { errors.push(String(chunk)); });
  try {
    await client.connect(transport);
    return { client, transport, errors };
  } catch (error) {
    await transport.close();
    throw error;
  }
}

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { connectRea, resultRoot } from './runtime.ts';

const observations = [];
const catalogs = [];
for (const profile of ['full', 'compact'] as const) {
  const started = performance.now();
  const session = await connectRea(profile);
  try {
    const tools = [];
    let cursor: string | undefined;
    do {
      const page = await session.client.listTools(cursor ? { cursor } : undefined);
      tools.push(...page.tools);
      cursor = page.nextCursor;
    } while (cursor);
    if (!tools.some(tool => tool.name === 'analyze_javascript_application')) {
      throw Error('rea_javascript_tool_not_advertised');
    }
    catalogs.push(tools);
    observations.push({
      profile,
      toolCount: tools.length,
      serializedCatalogBytes: Buffer.byteLength(JSON.stringify({ tools })),
      serializedInputSchemasBytes: Buffer.byteLength(JSON.stringify(tools.map(tool => tool.inputSchema))),
      maxInputSchemaBytes: Math.max(...tools.map(tool => Buffer.byteLength(JSON.stringify(tool.inputSchema)))),
      outputSchemaCount: tools.filter(tool => tool.outputSchema !== undefined).length,
      connectAndListElapsedMs: Math.round(performance.now() - started),
      stderr: session.errors,
    });
    await writeFile(resolve(resultRoot, `rea-tools-${profile}.json`), JSON.stringify({ tools }), { mode: 0o600 });
  } finally {
    await session.client.close();
    await session.transport.close();
  }
}
const sameTools = JSON.stringify(catalogs[0]!.map(tool => tool.name).sort()) === JSON.stringify(catalogs[1]!.map(tool => tool.name).sort());
if (!sameTools) throw Error('schema_profile_changed_tool_availability');
const report = {
  schemaVersion: 1,
  observedAt: new Date().toISOString(),
  installedVersion: '6.5.0',
  transport: 'official_rea_stdio_mcp',
  sameTools,
  observations,
  compactCatalogByteReduction: 1 - observations[1]!.serializedCatalogBytes / observations[0]!.serializedCatalogBytes,
  measurements: 'Parsed MCP tools/list JSON bytes and one sequential cold start per profile; not model token use or steady-state latency.',
  nativeCodexRegistrationChanged: false,
  academyRequests: 0,
  academyWrites: 0,
};
await writeFile(resolve(resultRoot, 'mcp-verification.json'), JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify({ ...report, javascriptTool: catalogs[1]!.find(tool => tool.name === 'analyze_javascript_application') }, null, 2));

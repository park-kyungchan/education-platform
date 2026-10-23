import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { connectRea, repoRoot, resultRoot } from './runtime.ts';

// This is a shipped synthetic frontend artifact. It is not the live academy server.
const targetRoot = resolve(repoRoot, 'preview/v21');
const target = resolve(targetRoot, 'app.js');
const hash = async () => createHash('sha256').update(await readFile(target)).digest('hex');
const beforeSha256 = await hash();
const session = await connectRea('compact');
try {
  const started = performance.now();
  const analysis = await session.client.callTool({
    name: 'analyze_javascript_application',
    arguments: {
      input_path: targetRoot,
      format: 'directory',
      source_paths: ['app.js'],
      integrity_policy: 'fail',
      detail: 'summary',
      max_heap_mb: 512,
      analysis_timeout_ms: 60000,
    },
  }, { timeout: 90000 });
  await writeFile(resolve(resultRoot, 'preview-analysis-summary.json'), JSON.stringify(analysis, null, 2) + '\n', { mode: 0o600 });
  if (analysis.isError) throw Error('rea_analysis_reported_error');
  // Retained references belong to this MCP session. Export before closing it.
  const bundlePath = resolve(resultRoot, `preview-evidence-${Date.now()}.json`);
  const exported = await session.client.callTool({
    name: 'export_evidence_bundle',
    arguments: { path: bundlePath, overwrite: false },
  });
  if (exported.isError) throw Error('rea_evidence_export_failed');
  const unchanged = beforeSha256 === await hash();
  if (!unchanged) throw Error('analyzed_artifact_changed');
  const report = {
    schemaVersion: 1,
    observedAt: new Date().toISOString(),
    reaVersion: '6.5.0',
    transport: 'official_rea_stdio_mcp',
    target: { path: 'preview/v21/app.js', sha256: beforeSha256, artifactKind: 'synthetic_prebuilt_frontend' },
    targetUnchanged: unchanged,
    selectedSources: ['app.js'],
    evidenceBundlePath: bundlePath,
    elapsedMs: Math.round(performance.now() - started),
    sourceExecuted: false,
    sourceClaim: 'Static frontend artifact analysis; no live academy API or backend equivalence claim.',
    academyRequests: 0,
    academyWrites: 0,
    analysisStructuredContent: analysis.structuredContent ?? null,
    exportReceipt: exported.structuredContent ?? exported.content,
    stderr: session.errors,
  };
  await writeFile(resolve(resultRoot, 'analysis-verification.json'), JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  console.log(JSON.stringify(report, null, 2));
} finally {
  await session.client.close();
  await session.transport.close();
}

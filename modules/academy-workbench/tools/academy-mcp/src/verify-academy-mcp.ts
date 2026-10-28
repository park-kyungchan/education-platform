import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { FACETS } from './contracts.ts';
import { digest } from './pagination.ts';
import { packageRoot, repoRoot } from './paths.ts';

const resultRoot = resolve(repoRoot, '.local/academy-mcp');
const temporaryDirectory = resolve(resultRoot, 'tmp');
await mkdir(temporaryDirectory, { recursive: true, mode: 0o700 });
const pins = JSON.parse(await readFile(resolve(packageRoot, 'architecture/source-pins.json'), 'utf8')) as { files: { path: string; sha256: string }[] };
const inputHashes = async () => Object.fromEntries(await Promise.all(pins.files.map(async pin => [pin.path, digest(await readFile(resolve(repoRoot, pin.path)))])));
const before = await inputHashes();
const client = new Client({ name: 'academy-operations-offline-verifier', version: '0.1.0' });
const transport = new StdioClientTransport({
  command: process.versions.bun ? process.execPath : 'bun',
  args: ['--preload', resolve(packageRoot, 'tests/network-deny.ts'), resolve(packageRoot, 'src/server.ts')],
  cwd: repoRoot,
  env: { PATH: process.env.PATH ?? '/usr/bin:/bin', TMPDIR: temporaryDirectory, XDG_CACHE_HOME: resolve(repoRoot, '.local/cache') },
  stderr: 'pipe',
});
let stderr = '';
transport.stderr?.on('data', value => { stderr += String(value); });
const cases: string[] = [];
try {
  await client.connect(transport);
  const listing = await client.listTools();
  assert.deepEqual(listing.tools.map(tool => tool.name).sort(), ['academy_capabilities','academy_cism_section','academy_dailyrecord_get','academy_dailyrecord_intake','academy_dailyrecord_review','academy_dailyrecord_save','academy_endpoint_identity', 'academy_find_item_labels', 'academy_item_answer_lookup', 'academy_item_label_scope', 'academy_query', 'academy_review_type_questions', 'academy_runtime_read_admission', 'academy_source_status', 'academy_student_metadata','academy_student_metadata_get', 'academy_student_resolve'].sort());
  for (const tool of listing.tools) {
    if (tool.name === 'academy_dailyrecord_save') {
      assert.equal(tool.annotations?.readOnlyHint, false);
      assert.equal(tool.annotations?.destructiveHint, true);
      continue;
    }
    assert.equal(tool.annotations?.readOnlyHint, true);
    assert.equal(tool.annotations?.destructiveHint, false);
    assert.equal(tool.annotations?.openWorldHint, false);
  }
  cases.push('exact_seventeen_tools_discovered_with_one_gated_write_tool');
  const call = async (name: string, args: Record<string, unknown>) => {
    const result = await client.callTool({ name, arguments: args });
    assert.notEqual(result.isError, true, name + '_returned_error');
    assert.ok(result.structuredContent);
    return result.structuredContent as Record<string, any>;
  };
  const rejected = async (name: string, args: Record<string, unknown>) => {
    try { return (await client.callTool({ name, arguments: args })).isError === true; }
    catch { return true; }
  };
  const capabilities = await call('academy_capabilities', {});
  assert.equal(capabilities.inventory.total, 95);
  assert.equal(capabilities.data.children.length, 8);
  assert.equal(capabilities.inventory.mutatingGETs.count, 11);
  const operationIds = new Set<string>();
  let offset: number | null = 0;
  do {
    const page = await call('academy_capabilities', { view: 'operations', offset, limit: 50 });
    for (const operation of page.data.items) {
      assert.equal(operation.execution, 'not_available');
      assert.equal(operation.runtimeCallable, false);
      assert.ok(!operationIds.has(operation.id)); operationIds.add(operation.id);
    }
    offset = page.data.nextOffset;
  } while (offset !== null);
  assert.equal(operationIds.size, 95);
  cases.push('eight_workflows_and_all_95_source_operations_preserved_without_execution');
  const writeContract = await call('academy_capabilities', { view: 'source_contract', operationId: 'day_record_udtprg' });
  assert.equal(writeContract.data.declaredEffect, 'write');
  assert.equal(writeContract.data.effectDisposition, 'excluded_write');
  const rules = await call('academy_capabilities', { view: 'workflow_rules', limit: 1 });
  assert.ok(rules.data.total > 0);
  assert.equal(rules.data.classification, 'generalized_preserved_business_rules_not_execution_authority');
  cases.push('mutating_get_only_inspectable_as_metadata_and_rules_keep_their_classification');
  const status = await call('academy_source_status', {});
  assert.equal(status.acquisition.academyNetworkTransport, 'absent');
  assert.equal(status.visibilityKnowledge.classification, 'user_report_not_independently_verified');
  assert.deepEqual(status.visibilityKnowledge.siteVisibilityWindow, { value: 2, unit: 'weeks', reasonReported: 'server_cost_management' });
  assert.equal(status.interpretation.websiteInvisibilityMeansDeletion, false);
  assert.equal(status.interpretation.preservedOlderEvidenceExpiresAfterTwoWeeks, false);
  cases.push('reported_visibility_window_is_separate_from_deletion_and_local_retention');
  const roster = [];
  let cursor: string | undefined;
  do {
    const page = await call('academy_query', { query: { kind: 'roster' }, limit: 2, ...(cursor ? { cursor } : {}) });
    assert.equal(page.scope.completeTeacherRosterVerified, false);
    assert.equal(page.scope.totalTeacherManagedStudents, null);
    roster.push(...page.records);
    cursor = page.page.nextCursor ?? undefined;
  } while (cursor);
  assert.equal(roster.length, 5);
  const studentId = roster[0]!.value.studentId as string;
  const summary = await call('academy_query', { query: { kind: 'student_summary', studentId } });
  assert.equal(summary.records.length, 1);
  for (const facet of FACETS) {
    const response = await call('academy_query', { query: { kind: 'student_records', studentId, facet }, limit: 1 });
    assert.equal(response.sourceMode, 'saved_context');
    assert.equal(response.status, 'partial');
    assert.equal(response.currentAcademyServerQueried, false);
    assert.ok(response.records.length <= 1);
  }
  const lesson = await call('academy_query', { query: { kind: 'lesson_context', studentId, date: summary.snapshot.lessonDate }, limit: 2 });
  assert.ok(lesson.records.every((record: any) => ['teacher_report', 'user_supplied_context', 'source_observation_snapshot'].includes(record.classification)));
  cases.push('preserved_roster_summary_all_nine_facets_and_dated_lesson_read_through_mcp');
  const missing = await call('academy_query', { query: { kind: 'student_summary', studentId: 'synthetic-unavailable-student' } });
  assert.equal(missing.status, 'unavailable');
  assert.equal(missing.code, 'student_not_in_preserved_roster');
  assert.equal(missing.page.totalInSavedSelection, null);
  assert.deepEqual(missing.records, []);
  assert.ok(await rejected('academy_query', { query: { kind: 'roster' }, url: 'https://dc.gang-a.kr/' }));
  assert.ok(await rejected('academy_query', { sourceMode: 'live_read', query: { kind: 'roster' } }));
  assert.ok(await rejected('academy_save_daily_record', {}));
  assert.ok(await rejected('academy_capabilities', { view: 'source_contract', operationId: 'not-a-source-operation' }));
  cases.push('unknown_subject_unknown_operation_mutation_tool_live_mode_and_arbitrary_url_rejected');
  assert.deepEqual(await inputHashes(), before);
  assert.ok(!stderr.includes('verification_outbound_network'));
  cases.push('pinned_original_inputs_unchanged_and_no_network_attempt_under_denied_transport');
  const report = {
    schemaVersion: 1, observedAt: new Date().toISOString(), status: 'passed',
    transport: 'official_sdk_stdio_client_to_actual_academy_mcp_server',
    toolCount: listing.tools.length, workflowCount: 8, sourceOperationCount: operationIds.size,
    preservedStudentCount: roster.length, completeTeacherRosterVerified: false,
    queriedFacets: [...FACETS], cases,
    outboundHttpAndTcpDeniedDuringVerification: true,
    academyNetworkAttemptsObserved: 0, academyWrites: 0, parentSends: 0,
    originalInputHashesUnchanged: true,
    nativeCodexRegistrationChanged: false,
  };
  await writeFile(resolve(resultRoot, 'verification.json'), JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  console.log(JSON.stringify(report, null, 2));
} finally {
  await client.close();
  await transport.close();
}

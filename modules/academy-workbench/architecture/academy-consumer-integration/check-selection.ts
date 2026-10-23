/** One bounded CON-01 source-selection check. No private loaders or production entrypoints. */
import {readFile, writeFile, readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {strict as assert} from 'node:assert';

const root = resolve(import.meta.dir, '../..');
const observations = resolve(import.meta.dir, 'observations');
const hash = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const json = async (path: string) => JSON.parse(await readFile(path, 'utf8'));
const run = async (command: string[], cwd = root) => {
  const child = Bun.spawn(command, {cwd, stdout: 'pipe', stderr: 'pipe'});
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
  ]);
  return {command, cwd, exitCode, stdout, stderr};
};
const git = async (cwd: string, args: string[]) => {
  const result = await run(['git', ...args], cwd);
  assert.equal(result.exitCode, 0, result.stderr);
  return result.stdout.trim();
};
const receipt: Record<string, unknown> = {
  schema: 'academy.consumer-selection-check.v1', createdAt: new Date().toISOString(),
  nativeThreadId: process.env.CODEX_THREAD_ID,
  runtime: {bun: Bun.version, node: process.version},
  scope: 'selected code/metadata, installed skill bytes and invented fixtures only',
  passed: [], failed: [], notRun: [
    'broad legacy check/test scripts: load private audit/student originals',
    'production MCP server/CLI startup: loads pinned private bodies',
    'QRY full graph/suites: exact source receiver qualification already received',
    'post-commit canonical snapshot/transition: Root exact commit required',
    'WSL/native/VPS production integration, teacher acceptance and original daily report',
  ],
  realStudentOriginalsRead: false, productionAdaptersImplemented: false,
};
const pass = (name: string) => (receipt.passed as string[]).push(name);
try {
  const selection = await json(resolve(import.meta.dir, 'source-selection.json'));
  assert.equal(await git(root, ['rev-parse', 'HEAD']), selection.sourceHead);
  let exactFiles = 0;
  for (const source of selection.sources) {
    assert.equal(await git(source.repositoryRoot, ['rev-parse', `${source.commit}^{tree}`]), source.tree);
    for (const file of [...source.files, ...(source.supportFiles ?? [])]) {
      const bytes = await readFile(resolve(source.repositoryRoot, file.path));
      assert.equal(bytes.length, file.byteLength);
      assert.equal(hash(bytes), file.sha256);
      const child = Bun.spawn(['git', 'show', `${source.commit}:${file.path}`], {cwd: source.repositoryRoot, stdout: 'pipe', stderr: 'pipe'});
      const [objectBytes, stderr, exitCode] = await Promise.all([new Response(child.stdout).arrayBuffer(), new Response(child.stderr).text(), child.exited]);
      assert.equal(exitCode, 0, stderr);
      assert.equal(hash(new Uint8Array(objectBytes)), file.sha256);
      exactFiles++;
    }
  }
  for (const file of selection.currentConsumerFiles) assert.equal(hash(await readFile(resolve(root, file.path))), file.sha256);
  assert.equal(hash(await readFile(selection.installedSkill.path)), selection.installedSkill.sha256);
  receipt.exactSourceFiles = exactFiles;
  pass('exact selected source trees/bytes, current predecessor bytes and installed skill hash');

  const contextRoot = selection.sources.find((source: any) => source.id === 'context').repositoryRoot;
  const {selectContext} = await import(resolve(contextRoot, 'context/academy-context/select.ts'));
  const {readingPlan} = await import(resolve(contextRoot, 'context/academy-context/reading-plan.ts'));
  const catalog = await json(resolve(contextRoot, 'context/academy-context/catalog.json'));
  const workflows = catalog.topics.filter((topic: any) => topic.kind === 'workflow' && !catalog.scope.excluded.includes(topic.id));
  assert.equal(workflows.length, 7);
  const selections: unknown[] = [];
  for (const workflow of workflows) {
    for (const includeHistory of [false, true]) {
      let cursor: string | undefined;
      const ids = new Set<string>(), sources = new Set<string>(), seenCursors = new Set<string>();
      const recordMetadata: unknown[] = [], findingMetadata: unknown[] = [];
      const pages: unknown[] = [];
      let closure: any, catalogHash: string | null = null;
      do {
        const page = selectContext(catalog, {topicId: workflow.id, includeHistory, maxBytes: 8192, ...(cursor ? {cursor} : {})});
        assert.equal(page.usedBytes, Buffer.byteLength(JSON.stringify(page)));
        assert.ok(page.usedBytes <= 8192);
        assert.equal(page.authority, 'none');
        assert.equal(page.nativePermissionGranted, false);
        assert.equal(page.coverage.complete, false);
        if (catalogHash !== null) assert.equal(page.catalogSha256, catalogHash);
        catalogHash = page.catalogSha256; closure = page.closure;
        for (const item of page.items) {
          const key = `${item.kind}:${item.value.id}`;
          assert.ok(!ids.has(key)); ids.add(key);
          if (item.kind === 'source') sources.add(item.value.id);
          if (item.kind === 'record') recordMetadata.push({id: item.value.id, kind: item.value.kind, status: item.value.status});
          if (item.kind === 'finding') findingMetadata.push({id: item.value.id, status: item.value.status});
        }
        pages.push({index: pages.length, usedBytes: page.usedBytes, itemCount: page.items.length, continued: page.nextCursor !== null});
        if (page.nextCursor !== null) {
          assert.ok(!seenCursors.has(page.nextCursor)); seenCursors.add(page.nextCursor);
          assert.ok(page.items.length > 0);
        }
        cursor = page.nextCursor ?? undefined;
        assert.ok(pages.length < 128);
      } while (cursor);
      assert.equal(ids.size, closure.itemCount);
      assert.equal(sources.size, closure.sourceCount);
      assert.ok(pages.length > 1, 'must observe and consume continuation');
      const plan = readingPlan(catalog, workflow.id);
      assert.equal(plan.sourceBodiesLoaded, false);
      assert.equal(plan.catalogSha256, catalogHash);
      for (const id of plan.requiredReferenceIds) assert.ok(sources.has(id));
      selections.push({workflowId: workflow.id, includeHistory, catalogSha256: catalogHash, closure, pages,
        sourceIds: [...sources].sort(), records: recordMetadata, findings: findingMetadata,
        requiredReferenceIds: plan.requiredReferenceIds, sourceBodiesLoaded: false});
    }
  }
  await writeFile(resolve(observations, 'CON-01-CONTEXT-PAGES-R1.json'), JSON.stringify({schema: 'academy.consumer-context-page-observation.v1', selections, sourceBodiesLoaded: false}, null, 2) + '\n');
  receipt.contextSelections = selections.length;
  pass('all pages consumed for every internal workflow, both current and history metadata; required reading-plan references present');

  const savedRoot = selection.sources.find((source: any) => source.id === 'savedMcp').repositoryRoot;
  const savedCheck = await run([process.execPath, 'test', 'tests/history-pagination.test.ts', 'tests/history-transport.test.ts'], resolve(savedRoot, 'tools/academy-mcp'));
  await writeFile(resolve(observations, 'CON-01-SAVED-TRANSPORT-R1.json'), JSON.stringify(savedCheck, null, 2) + '\n');
  assert.equal(savedCheck.exitCode, 0, 'selected saved transport tests failed; see exact observation');
  pass('selected df8b9f7 synthetic pagination and actual SDK dual CallToolResult/Unicode/refusal tests');

  const typecheck = await run([process.execPath, 'node_modules/typescript/bin/tsc', '--noEmit', '--strict', '--target', 'esnext', '--module', 'esnext', '--skipLibCheck', 'architecture/academy-consumer-integration/report-contract.ts']);
  await writeFile(resolve(observations, 'CON-01-REPORT-TYPECHECK-R1.json'), JSON.stringify(typecheck, null, 2) + '\n');
  assert.equal(typecheck.exitCode, 0);
  pass('report design typecheck; no runtime report/reducer implementation');

  const commonRoot = '/home/palantirkc/projects/agent-platform';
  assert.equal(await git(commonRoot, ['rev-parse', 'HEAD']), '712f90deac0676e662dc5d75d88d89f7b6773bfe');
  assert.equal(await git(commonRoot, ['status', '--porcelain']), '');
  const {assertRecord, taskVerificationTarget, openGitWork, validateGitWorkRecords} = await import(resolve(commonRoot, 'packages/work-continuity/src/git-work/index.ts'));
  const workRoot = resolve(root, 'work/academy-workbench/academy-consumer-integration-20261021');
  const task = await json(resolve(workRoot, 'tasks/academy-workbench%3Atask%3Aacademy-consumer-integration-20261021-con-01.json'));
  assertRecord(task);
  assertRecord(await json(resolve(workRoot, 'inputs/CON-01-EXECUTION-R1.json')));
  receipt.taskVerificationTarget = taskVerificationTarget(task);
  const reader = await openGitWork({repositoryRoot: root, repositoryId: 'park-kyungchan/academy-workbench', commit: selection.sourceHead, projectId: 'academy-workbench', workId: 'academy-consumer-integration-20261021'});
  const baseCheck = await validateGitWorkRecords(reader);
  assert.equal(baseCheck.valid, true, JSON.stringify(baseCheck.findings));
  receipt.canonicalBase = {commit: selection.sourceHead, ...baseCheck};
  pass('external clean common712f90de canonical existing Work snapshot and actual taskVerificationTarget; original consumer pin preserved');

  // Validate authored artifacts only. No scan of private originals, existing archives or credentials.
  const newFiles = [
    ...((await readdir(import.meta.dir)).filter(name => /\.(ts|json)$/.test(name)).map(name => resolve(import.meta.dir, name))),
    resolve(workRoot, 'inputs/CON-01-EXECUTION-R1.json'),
  ];
  for (const path of newFiles) {
    const text = await readFile(path, 'utf8');
    assert.ok(!/-----BEGIN [A-Z ]*PRIVATE KEY-----|sk-proj-[A-Za-z0-9]{16}|AKIA[A-Z0-9]{16}/.test(text));
    assert.ok(!/https?:\/\/[^\s"<>]+/.test(text), 'no source links or publication assets expected');
    if (path.endsWith('.json')) JSON.parse(text);
  }
  receipt.minimizedArtifactFilesChecked = newFiles.length;
  pass('allowlisted authored JSON/TS only; metadata/hash records, no student payload or private source links');
} catch (error) {
  (receipt.failed as string[]).push(error instanceof Error ? error.message : 'selection_check_failed');
  process.exitCode = 1;
} finally {
  receipt.finishedAt = new Date().toISOString();
  await writeFile(resolve(observations, 'CON-01-CHECKS-R1.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify({passed: receipt.passed, failed: receipt.failed, taskVerificationTarget: receipt.taskVerificationTarget}));
}

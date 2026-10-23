import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { selectContext } from './select.ts';
import { validateCatalog } from './validate.ts';
import { readingPlan } from './reading-plan.ts';

const usage = 'context:academy inspect | select --topic <topicId> [--max-bytes <integer>] [--cursor <cursor>] [--history] | reading-plan --topic <workflowId>';

/** Reads this reviewed metadata catalog only. Never opens paths named by its sources. */
export async function runContextCli(args: string[]) {
  const [command, ...rest] = args;
  const options: Record<string, string | boolean> = {};
  for (let i = 0; i < rest.length; i++) {
    const flag = rest[i]!;
    if (!['--topic', '--max-bytes', '--cursor', '--history'].includes(flag) || Object.hasOwn(options, flag)) throw Error(usage);
    if (flag === '--history') options[flag] = true;
    else {
      const value = rest[++i];
      if (!value || value.startsWith('--')) throw Error(usage);
      options[flag] = value;
    }
  }
  const path = fileURLToPath(new URL('./catalog.json', import.meta.url));
  const raw = await readFile(path);
  if (raw.byteLength > 1048576) throw Error('academy-context:catalog-too-large');
  const catalog = validateCatalog(JSON.parse(raw.toString('utf8')), {
    projectId: 'academy-workbench', workId: 'academy-context-consolidation-20261021',
  });
  if (command === 'inspect' && rest.length === 0) return {
    schemaVersion: catalog.schemaVersion, projectId: catalog.projectId, workId: catalog.workId,
    authority: catalog.authority, nativePermissionGranted: catalog.nativePermissionGranted,
    defaultNavigation: catalog.defaultNavigation, coverage: catalog.coverage, scope: catalog.scope,
    counts: Object.fromEntries(['repositories', 'sources', 'topics', 'records', 'relations', 'findings'].map(key => [key, catalog[key as 'sources'].length])),
    workflows: catalog.topics.filter(topic => topic.kind === 'workflow' && !catalog.scope.excluded.includes(topic.id)).map(topic => ({ id: topic.id, title: topic.title })),
    sourceBodiesLoaded: false,
  };
  const topicId = options['--topic'];
  if (typeof topicId !== 'string') throw Error(usage);
  if (command === 'reading-plan' && rest.length === 2) return readingPlan(catalog, topicId);
  if (command !== 'select') throw Error(usage);
  const max = options['--max-bytes'];
  if (max !== undefined && (typeof max !== 'string' || !/^[1-9][0-9]*$/.test(max) || !Number.isSafeInteger(Number(max)))) throw Error(usage);
  return selectContext(catalog, {
    topicId,
    ...(max !== undefined ? { maxBytes: Number(max) } : {}),
    ...(typeof options['--cursor'] === 'string' ? { cursor: options['--cursor'] } : {}),
    ...(options['--history'] === true ? { includeHistory: true } : {}),
  });
}

if (import.meta.main) {
  try {
    // Compact serialization matches the selector's complete UTF8 response budget exactly.
    process.stdout.write(JSON.stringify(await runContextCli(process.argv.slice(2))));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'academy-context:failed'}\n`);
    process.exitCode = 1;
  }
}

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { platformRoot, validateRouting } from './validate.ts';

const routingPath = resolve(dirname(fileURLToPath(import.meta.url)), 'routing.json');

/** Read only routing metadata; validate targets without opening their contents. */
export async function checkRouting(path: string = routingPath, root: string = platformRoot): Promise<number> {
  const routing = validateRouting(JSON.parse(await readFile(path, 'utf8')), root);
  return routing.routes.length;
}

if (import.meta.main) {
  if (process.argv.length !== 2) throw Error('routing_check_arguments_not_allowed');
  console.log(JSON.stringify({ status: 'pass', routes: await checkRouting() }));
}

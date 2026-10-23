import { loadService } from './service.ts';
import { repoRoot } from './paths.ts';

const service = await loadService(repoRoot);
const [command = 'hierarchy', argument] = Bun.argv.slice(2);
const value = command === 'hierarchy' ? service.capabilities({})
  : command === 'status' ? service.sourceStatus({})
  : command === 'roster' ? service.query({ query: { kind: 'roster' } })
  : command === 'contract' && argument ? service.capabilities({ view: 'source_contract', operationId: argument })
  : command === 'operations' ? service.capabilities({ view: 'operations', ...(argument ? { domain: argument } : {}) })
  : (() => { throw Error('usage_hierarchy_status_roster_contract_id_operations_domain'); })();
console.log(JSON.stringify(value, null, 2));

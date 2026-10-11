import {loadRepositoryOperatingContext} from './packages/adapters/repository-operating-context.ts';
import {selectOperationalContext} from './packages/application/select-operational-context.ts';
const bytes=await Bun.file(new URL('./context/academy/manifest.json',import.meta.url)).bytes();
// Local inspection uses the checked-out manifest. Runtime callers need their own trusted pin.
const loaded=await loadRepositoryOperatingContext(new Bun.CryptoHasher('sha256').update(bytes).digest('hex'));
const policyIds=Bun.argv.slice(2);if(!policyIds.length)throw Error('provide_one_or_more_policy_ids');
console.log(JSON.stringify(selectOperationalContext(loaded.context,loaded.revision,{policyIds,expectedRevision:loaded.revision}),null,2));

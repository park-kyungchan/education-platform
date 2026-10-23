// The root check is read-only; a standalone child verifier may generate its own receipt.
import { loadPackage, validatePackage } from '../context/user-context/scripts/validate.mjs';
const data=await loadPackage();const result=validatePackage(data);
if(result.errors.length)throw Error(result.errors.join('\n'));
const child=Bun.spawn(['node','context/user-context/scripts/test.mjs'],{stdout:'inherit',stderr:'inherit'});
if(await child.exited!==0)throw Error('Context negative tests failed');
console.log(`PASS selected user context: ${data.sources.sources.length} preserved sources, ${data.records.records.length} typed records, ${result.passed.length} checks; complete historical reconciliation is not claimed.`);

/** Native Bun subprocesses preserve package-local path semantics and ownership guards. */
import {resolve} from 'node:path';
const command=Bun.argv[2]??'check',root=import.meta.dir;
const routes:Record<string,readonly (readonly [string,string])[]>={check:[['gang-a','validate'],['dc-gang-a','check']],demo:[['gang-a','test:regression']],'academy:serve':[['dc-gang-a','academy:serve']]};
const route=routes[command];if(!route)throw Error('unknown_academy_entrypoint');
for(const [directory,script] of route){console.log(JSON.stringify({academySource:directory,script}));const process=Bun.spawn([globalThis.process.execPath,'run',script],{cwd:resolve(root,directory),stdout:'inherit',stderr:'inherit'});if(await process.exited!==0)globalThis.process.exit(1);}

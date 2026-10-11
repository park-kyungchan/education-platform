import {resolve} from 'node:path';
const entrypoints=['dc-gang-a/src/academy/main.ts','dc-gang-a/harness/academy_http.ts','dc-gang-a/harness/academy_journal_http.ts','dc-gang-a/harness/academy_query.ts'].map(path=>resolve(import.meta.dir,path));
const result=await Bun.build({entrypoints,target:'bun'});
if(!result.success){for(const log of result.logs)console.error(log);throw Error('native_compatibility_import_closure_failed');}
console.log(JSON.stringify({scope:'native-academy-current-entrypoint-import-closure',entrypoints:entrypoints.length,executed:false,nativeStoresOpened:false,profileOrPermissionGranted:false}));

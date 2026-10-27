/** Fixed MIGRATE occurrence only. Importing this module is inert. */
import {join} from 'node:path';
import {readNativeMemory} from './native_foundations_fixture';
import {assertFixedRunner,loadFixedRunnerInvocation,writeExclusivePrivateJson,type FixedRunnerInvocation} from './native_foundations_qualification';

export async function migrateNativeFoundations(i:FixedRunnerInvocation):Promise<void> {
 assertFixedRunner(i,'MIGRATE');
 if(i.config.stage!=='MIGRATE'||i.config.liveHelper!==null)throw Error('fixed_migrate_only');
 // Complete sealed input and revalidation precede claim and every effect.
 await readNativeMemory(i);
 const [{SQL},{PostgresAcademyStore}]=await Promise.all([import('bun'),import('../src/academy/postgresStore')]);
 i.claim();
 const c=i.config.base;
 const db=new SQL({adapter:'postgres',path:c.provider.socket,username:c.provider.username,database:c.provider.database,max:1});
 try{
  const store=new PostgresAcademyStore(db);
  i.assertCurrent();await store.migrate();await store.assertRuntimeReady();
  writeExclusivePrivateJson(join(c.metadataDirectory,'migrated.json'),{schema:'fixed-native-migrated.v1',runId:c.runId,ownerId:c.ownerId,occurrenceId:c.occurrenceId,manifestSha256:i.manifestSha256,sourceSetSha256:c.sourceSet.sha256,pid:process.pid,startTicks:c.executor.startTicks,ready:true,automaticRetry:false});
 }finally{await db.close();}
}
if(import.meta.main)void (async()=>migrateNativeFoundations(loadFixedRunnerInvocation(process.argv.slice(2),'MIGRATE')))().catch((error)=>{console.error(JSON.stringify({status:'RECONCILE',code:((e:unknown)=>{const m=e instanceof Error?e.message:'';const k=/^[a-z0-9_]{1,100}$/.test(m)?m:(e instanceof Error?e.constructor.name:'UNKNOWN')+(typeof (e as {code?:unknown})?.code==='string'?':'+String((e as {code:string}).code).slice(0,40):'');const at=e instanceof Error?[...(e.stack??'').matchAll(/\/([A-Za-z_]+\.ts):(\d+):\d+/g)].slice(0,3).map(x=>x[1]+':'+x[2]).join('<'):'';return at?k+'@'+at:k;})(error),automaticRetry:false}));process.exitCode=1;});

import {SQL} from 'bun';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {PostgresAcademyStore} from '../../src/academy/postgresStore';
import {TeacherAuthStore} from '../../src/academy/teacherAuthStore';
import {createRetainedTeacherRuntime} from '../../src/academy/retainedRuntime';
import {createTeacherServerHandler} from '../../src/academy/server';
import {teacherPage} from '../../src/academy/web/page';

// Isolated synthetic process; uses the shipped auth/handler/store/frontend, never a login bypass.
if(process.argv[2]!=='--synthetic-only'||!process.argv[3])throw Error('explicit_synthetic_fixture_required');
const directory=resolve(process.argv[3]);
const config=JSON.parse(readFileSync(resolve(directory,'owner.json'),'utf8')) as {syntheticOnly:boolean;ownerId:string;socket:string;port:number};
if(config.syntheticOnly!==true||!config.ownerId.startsWith('fixture-exact-'))throw Error('synthetic_owner_required');
let applicationFetchCalls=0;
globalThis.fetch=async()=>{applicationFetchCalls++;throw Error('synthetic_retained_outbound_fetch_denied');};
const db=new SQL({adapter:'postgres',path:config.socket,username:'hermes',database:'dc_academy_test',max:4});
const store=new PostgresAcademyStore(db);await store.assertRuntimeReady();
const authStore=new TeacherAuthStore(resolve(directory,'web-auth.json')),auth=authStore.readExistingIdentity();
const runtime=createRetainedTeacherRuntime(store,config.ownerId);
const build=await Bun.build({entrypoints:[resolve(import.meta.dir,'../../src/academy/web/client.ts')],target:'browser',format:'esm',minify:true});
if(!build.success)throw Error('teacher_client_build_failed');
let handler:(req:Request)=>Promise<Response>=async()=>new Response('Starting',{status:503});
const server=Bun.serve({hostname:'127.0.0.1',port:config.port,
  tls:{key:Bun.file(resolve(directory,'tls-key.pem')),cert:Bun.file(resolve(directory,'tls-cert.pem'))},fetch:req=>handler(req)});
const origin='https://127.0.0.1:'+server.port;
handler=createTeacherServerHandler({app:runtime.app,origin,sessionKey:auth.sessionKey,identity:auth.identity,invitationDigest:null,
  currentAuthentication:()=>authStore.readExistingIdentity(),saveIdentity:async()=>{throw Error('synthetic_existing_identity_only');},
  page:teacherPage,script:await build.outputs[0]!.text(),refresh:runtime.refresh,
  refreshResult:runtime.refreshResult,refreshPending:runtime.refreshPending,refreshHistory:runtime.refreshHistory});
writeFileSync(resolve(directory,'endpoint.json'),JSON.stringify({origin,port:server.port,syntheticOnly:true})+'\n',{mode:0o600});
let stopping=false;
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{
  if(stopping)return;stopping=true;
  await server.stop(true);await runtime.close();await db.close();
  writeFileSync(resolve(directory,'server-effects.json'),JSON.stringify({syntheticOnly:true,applicationFetchCalls,sourceAcquisition:false,officialSaved:false,parentSent:false})+'\n',{mode:0o600});
  process.exit(0);
});

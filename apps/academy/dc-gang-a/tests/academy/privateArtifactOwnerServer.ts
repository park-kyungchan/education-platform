import {SQL} from 'bun';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {PostgresAcademyStore} from '../../src/academy/postgresStore';
import {TeacherAuthStore} from '../../src/academy/teacherAuthStore';
import {createRetainedTeacherRuntime} from '../../src/academy/retainedRuntime';
import {createTeacherServerHandler} from '../../src/academy/server';
import {loadPrivateArtifactCatalog,type PrivateArtifactAccess} from '../../src/academy/privateArtifactCatalog';
import {teacherPage} from '../../src/academy/web/page';

// Actual application composition on invented owner files/Unix-only PG. No native profile or source connector.
if(process.argv[2]!=='--synthetic-only'||!process.argv[3]||!process.env.DC_ACADEMY_BROWSER_OUTPUT)throw Error('explicit_synthetic_fixture_required');
const directory=resolve(process.argv[3]),output=resolve(process.env.DC_ACADEMY_BROWSER_OUTPUT);
if(!directory.startsWith(output+sep+'synthetic-artifact-'))throw Error('owned_fixture_directory_required');
const config=JSON.parse(readFileSync(resolve(directory,'owner.json'),'utf8'));
if(config.syntheticOnly!==true||!config.ownerId.startsWith('fixture-exact-')||config.socket!==process.env.DC_ACADEMY_TEST_SOCKET||!/^\/tmp\/academy-a13-[^/]+\/\.s\.PGSQL\.55432$/.test(config.socket))throw Error('owned_synthetic_owner_and_socket_required');
let applicationFetchCalls=0,revocationObservations=0;
globalThis.fetch=Object.assign(async()=>{applicationFetchCalls++;throw Error('synthetic_retained_outbound_fetch_denied');},{preconnect:()=>{applicationFetchCalls++;throw Error('synthetic_retained_outbound_preconnect_denied');}});
const db=new SQL({adapter:'postgres',path:config.socket,username:'hermes',database:'dc_academy_test',max:4});
const store=new PostgresAcademyStore(db);await store.assertRuntimeReady();
const authStore=new TeacherAuthStore(resolve(directory,'web-auth.json')),auth=authStore.readExistingIdentity();
const runtime=createRetainedTeacherRuntime(store,config.ownerId);
const catalog=await loadPrivateArtifactCatalog(directory,config.ownerId,async(ownerId,studentId)=>(await store.students(ownerId)).some(student=>student.id===studentId));
// Fixture-only asynchronous barrier and revocation signal; existing authentication bytes are never rewritten.
const barrier=async(kind:'read'|'list')=>{if(!existsSync(resolve(directory,'synthetic-'+kind+'-armed')))return;writeFileSync(resolve(directory,'synthetic-entered'),kind,{mode:0o600});while(!existsSync(resolve(directory,'synthetic-release')))await Bun.sleep(10);};
const access:PrivateArtifactAccess={async list(context){await barrier('list');return catalog.list(context);},async read(context,id){await barrier('read');return catalog.read(context,id);}};
const build=await Bun.build({entrypoints:[resolve(import.meta.dir,'../../src/academy/web/client.ts')],target:'browser',format:'esm',minify:true});if(!build.success)throw Error('teacher_client_build_failed');
let handler:(request:Request)=>Promise<Response>=async()=>new Response('Starting',{status:503});
const server=Bun.serve({hostname:'127.0.0.1',port:config.port,tls:{key:Bun.file(resolve(directory,'tls-key.pem')),cert:Bun.file(resolve(directory,'tls-cert.pem'))},fetch:request=>handler(request)}),origin='https://127.0.0.1:'+server.port;
handler=createTeacherServerHandler({app:runtime.app,origin,sessionKey:auth.sessionKey,identity:auth.identity,invitationDigest:null,currentAuthentication:()=>{const state=authStore.readExistingIdentity();if(existsSync(resolve(directory,'synthetic-revoked'))){revocationObservations++;return {...state,identity:null};}return state;},saveIdentity:async()=>{throw Error('synthetic_existing_identity_only');},page:teacherPage,script:await build.outputs[0]!.text(),privateArtifacts:access,refresh:runtime.refresh,refreshResult:runtime.refreshResult,refreshPending:runtime.refreshPending,refreshHistory:runtime.refreshHistory});
writeFileSync(resolve(directory,'endpoint.json'),JSON.stringify({origin,port:server.port,syntheticOnly:true})+'\n',{mode:0o600});
let stopping=false;for(const signal of ['SIGTERM','SIGINT'])process.on(signal,async()=>{if(stopping)return;stopping=true;await server.stop(true);await runtime.close();await db.close();writeFileSync(resolve(directory,'server-effects.json'),JSON.stringify({syntheticOnly:true,applicationFetchCalls,revocationObservations,sourceAcquisition:false,authStoreWrites:0,officialSaved:false,parentSent:false})+'\n',{mode:0o600});process.exit(0);});

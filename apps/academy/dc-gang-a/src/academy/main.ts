import { SQL } from 'bun';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PostgresAcademyStore } from './postgresStore';
import { createTeacherServerHandler } from './server';
import { TeacherAuthStore } from './teacherAuthStore';
import { teacherPage } from './web/page';
import { createRetainedTeacherRuntime } from './retainedRuntime';

interface OwnerRuntime { ownerId:string;hostname:string;postgresSocket:string;database:string;teacherLabel:string;teacherSourceKey:string;collegeSourceKey:string;expectedStudentNames:string[];sourceUsername?:string }

const home=process.env.HERMES_HOME;
if(home!=='/opt/data/profiles/dc-gang-a-dev')throw Error('active_profile_required');
const args=process.argv.slice(2);
if(args.some(arg=>arg!=='--retained-only')||args.length>1)throw Error('unsupported_owner_runtime_argument');
const retainedOnly=args.includes('--retained-only');
const directory=resolve(home,'academy');
if(lstatSync(directory).isSymbolicLink()||(lstatSync(directory).mode&0o077)!==0)throw Error('private_product_directory_required');
const config=JSON.parse(readFileSync(resolve(directory,'owner.json'),'utf8')) as OwnerRuntime;
const file=resolve(directory,'web-auth.json');
const authStore=new TeacherAuthStore(file);
const auth=authStore.readExistingIdentity();
const db=new SQL({adapter:'postgres',path:config.postgresSocket,username:'hermes',database:config.database,max:5});
const store=new PostgresAcademyStore(db);await store.assertRuntimeReady();
const build=await Bun.build({entrypoints:[resolve(import.meta.dir,'web/client.ts')],target:'browser',format:'esm',minify:true});
if(!build.success)throw Error('teacher_client_build_failed');
const script=await build.outputs[0]!.text();
const trialFile=resolve(directory,'web-origin-trial.json');
let originTrialToken:string|undefined;
if(existsSync(trialFile)){
  const stat=lstatSync(trialFile);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size>20000)throw Error('owned_origin_trial_file_required');
  const trial=JSON.parse(readFileSync(trialFile,'utf8')) as {origin:string;token:string};
  if(trial.origin!=='https://'+config.hostname)throw Error('origin_trial_deployment_scope_conflict');
  originTrialToken=trial.token;
}
// Retained-only startup never constructs/imports the source-acquisition composition.
const runtime=retainedOnly?createRetainedTeacherRuntime(store,config.ownerId):await (async()=>{
  const {createTeacherSourceRuntime}=await import('./sourceRuntime');
  const source=createTeacherSourceRuntime(store,{ownerId:config.ownerId,teacherLabel:config.teacherLabel,teacherKey:config.teacherSourceKey,collegeKey:config.collegeSourceKey,studentNames:config.expectedStudentNames,username:config.sourceUsername??null});
  return {...source,refresh:(context:Parameters<typeof source.coordinator.refresh>[0],selection:{studentId:string|null;requestId:string;date?:string})=>source.coordinator.refresh(context,selection.studentId,selection.requestId,selection.date),
    refreshResult:source.coordinator.result.bind(source.coordinator),refreshPending:source.coordinator.pending.bind(source.coordinator),refreshHistory:source.coordinator.history.bind(source.coordinator)};
})();
const {app,connection,close:closeSource}=runtime;
const handler=createTeacherServerHandler({app,origin:'https://'+config.hostname,sessionKey:auth.sessionKey,identity:auth.identity,invitationDigest:auth.invitationDigest,page:teacherPage,script,
  currentAuthentication:()=>authStore.readExistingIdentity(),
  passwordRecovery:{claim:async token=>authStore.claimRecovery(token),status:async id=>authStore.recoveryStatus(id),complete:async(id,hash)=>authStore.completeRecovery(id,hash)},
  originTrialToken,
  refresh:runtime.refresh,
  refreshResult:runtime.refreshResult,
  refreshPending:runtime.refreshPending,
  refreshHistory:runtime.refreshHistory,
  consumeInvitation:async()=>{
    authStore.consumeInvitation(auth.invitationDigest!);
  },
  saveIdentity:async identity=>{
    authStore.registerIdentity(identity);
  }});
const server=Bun.serve({hostname:'127.0.0.1',port:8411,idleTimeout:255,fetch:handler,error:()=>new Response('Operation failed',{status:500,headers:{'Cache-Control':'no-store'}})});
console.log(JSON.stringify({status:'teacher_application_running',listen:'127.0.0.1:'+server.port,origin:'https://'+config.hostname,authentication:'existing_teacher_login',sourceMode:retainedOnly?'retained_only':'direct_http',academyAcquisition:connection().acquisition,academyEffect:'read_only',nativeSessionMirror:false}));
let stopping=false;
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,async()=>{if(stopping)return;stopping=true;const drained=server.stop();await closeSource();await drained;await db.close();process.exit(0);});

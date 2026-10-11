import {classifyTeacherRuntime,type TeacherRuntimeObservation} from '../src/academy/runtimeStatus';
const home='/opt/data/profiles/dc-gang-a-dev';
if(process.env.HERMES_HOME!==home||process.argv.length!==2)throw Error('active_profile_no_arguments_required');
const probe=async(url:string):Promise<TeacherRuntimeObservation['local']>=>{
  try{
    const response=await fetch(url,{signal:AbortSignal.timeout(5000),redirect:'manual'});
    if(response.status>=500)return 'unreachable';
    if(response.status!==200)return 'unexpected';
    const value=await response.json() as Record<string,unknown>;
    return value.status==='running'&&value.studentDisclosure===false?'healthy':'unexpected';
  }catch(error){return error instanceof SyntaxError?'unexpected':'unreachable';}
};
const postgres=async():Promise<TeacherRuntimeObservation['postgres']>=>{
  try{const child=Bun.spawn([home+'/runtime/postgresql-18.6/bin/pg_ctl','-D',home+'/academy/primary','status'],{stdout:'ignore',stderr:'ignore'});const code=await child.exited;return code===0?'running':code===3?'stopped':'unknown';}catch{return 'unknown';}
};
const [pg,local,pub]=await Promise.all([postgres(),probe('http://127.0.0.1:8411/health'),probe('https://dc.kcpalantir.tech/health')]);
const observation={postgres:pg,local,public:pub};
console.log(JSON.stringify({schemaVersion:1,kind:'teacher_runtime_readonly_status',observedAt:new Date().toISOString(),observation,...classifyTeacherRuntime(observation),scope:'existing_profile_db_loopback_app_and_exact_public_health_only',limits:['Does not authenticate a teacher, inspect student data or qualify academy access.','Healthy responses do not attest the release or DB contents.','No restart, migration, dispatch, config change or service installation.','persistOnRelease is not persistence across container replacement.']},null,2));

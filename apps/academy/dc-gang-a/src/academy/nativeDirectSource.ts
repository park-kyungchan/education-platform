import {spawn} from 'node:child_process';
import {readdirSync,readFileSync,mkdtempSync,rmdirSync} from 'node:fs';
import {reservePrivateJson,readPrivateJsonText} from '../../harness/academy_private_io';
import {canonicalJson,assertExactKeys} from '../learning/model';
import {createAcademyReadPlan,readLiteralKey,readLiteralName,type ScopedAcademyReadPlan} from '../lms/academyReadProtocol';
import {readInputRecord} from '../contracts/readInputRecord';
import type {SourceDiscoveryRequest} from './nativeBookSource';

export interface OwnedSourceProcess {argv:string[];env:NodeJS.ProcessEnv;deadlineMs?:number;graceMs?:number;signal?:AbortSignal}
/** The fixed-origin native CLI is the credential receiver; this caller never receives its password/session. */
export async function runNativeDirectDiscovery(input:{username:string;discover:SourceDiscoveryRequest},runner:typeof runOwnedSourceProcess=runOwnedSourceProcess,signal?:AbortSignal):Promise<unknown>{
 const home=process.env.HERMES_HOME;if(home!=='/opt/data/profiles/dc-gang-a-dev')throw Error('active_profile_required');
 canonicalJson(input);assertExactKeys(input,['username','discover']);readLiteralName(input.username);
 const scope=readInputRecord(input.discover);assertExactKeys(scope,['teacherLabel','teacherKey','collegeKey','studentNames']);
 readLiteralName(scope.teacherLabel);readLiteralKey(scope.teacherKey);readLiteralKey(scope.collegeKey);
 if(!Array.isArray(scope.studentNames)||!scope.studentNames.length||scope.studentNames.length>64||new Set(scope.studentNames).size!==scope.studentNames.length)throw Error('invalid_source_scope');scope.studentNames.forEach(readLiteralName);
 return runNativeExchange(home,input,runner,signal);
}
export async function runNativeDirectRead(input:{username:string;read:ScopedAcademyReadPlan['request']},runner:typeof runOwnedSourceProcess=runOwnedSourceProcess,signal?:AbortSignal):Promise<unknown>{
 const home=process.env.HERMES_HOME;if(home!=='/opt/data/profiles/dc-gang-a-dev')throw Error('active_profile_required');
 canonicalJson(input);assertExactKeys(input,['username','read']);readLiteralName(input.username);createAcademyReadPlan(input.read);
 return runNativeExchange(home,input,runner,signal);
}
async function runNativeExchange(home:string,input:unknown,runner:typeof runOwnedSourceProcess,signal?:AbortSignal):Promise<unknown>{
 const directory=mkdtempSync(home+'/cache/scratch/direct-source-request-');
 let request:ReturnType<typeof reservePrivateJson>|undefined,result:ReturnType<typeof reservePrivateJson>|undefined,retain=false;
 try{
  request=reservePrivateJson(home,directory+'/request.json',65536);request.write(input);
  result=reservePrivateJson(home,directory+'/result.json',131072);
  const child=await runner({argv:[process.execPath,'--no-env-file',new URL('../../harness/academy_http.ts',import.meta.url).pathname,'--request',request.path,'--output',result.path,'--owned-input-inode',request.identity,'--owned-output-inode',result.identity],env:{HOME:process.env.HOME,PATH:process.env.PATH,HERMES_HOME:home,TMPDIR:process.env.TMPDIR},signal});
  if(child.exitCode!==0){
   let reason='direct_http_consumer_failed';
   try{const value=readInputRecord(JSON.parse(child.stdout.trim().split('\n').at(-1)??''));if(typeof value.code==='string'&&/^[a-z][a-z0-9_]{1,100}$/.test(value.code))reason=value.code;}catch{}
   throw Error(reason);
  }
  return JSON.parse(readPrivateJsonText(home,result.path,result.identity));
 }catch(error){
  retain=error instanceof Error&&['source_group_termination_failed','source_group_termination_unverified'].includes(error.message);
  throw error;
 }finally{
  if(retain){request?.close();result?.close();}
  else try{request?.cleanup();}finally{result?.cleanup();try{rmdirSync(directory);}catch{}}
 }
}
/** Owned Linux group only. Neither native Hermes nor a foreign service is a cancellation target. */
export function runOwnedSourceProcess({argv,env,deadlineMs=120000,graceMs=700,signal:abortSignal}:OwnedSourceProcess):Promise<{exitCode:number;stdout:string}>{
 if(process.platform!=='linux'||!argv.length||!Number.isSafeInteger(deadlineMs)||deadlineMs<1||deadlineMs>120000||!Number.isSafeInteger(graceMs)||graceMs<1||graceMs>1000)throw Error('unsupported_source_process_control');
 return new Promise((resolve,reject)=>{
  if(abortSignal?.aborted){reject(Error('direct_source_cancelled'));return;}
  const child=spawn(argv[0]!,argv.slice(1),{env,detached:true,stdio:['ignore','pipe','pipe']});
  let reason:string|null=null,settled=false,stdout='',bytes=0;
  let escalation:ReturnType<typeof setTimeout>|undefined,confirmation:ReturnType<typeof setTimeout>|undefined;
  const groupLive=()=>{
   if(!child.pid)return false;
   for(const pid of readdirSync('/proc').filter(value=>/^\d+$/.test(value))){
    let text:string;try{text=readFileSync('/proc/'+pid+'/stat','utf8');}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')continue;throw error;}
    const fields=text.slice(text.lastIndexOf(')')+2).split(' ');
    if(Number(fields[2])===child.pid&&!['Z','X'].includes(fields[0]!))return true;
   }
   return false;
  };
  const signal=(name:NodeJS.Signals)=>{if(child.pid)try{process.kill(-child.pid,name);}catch(error){if((error as NodeJS.ErrnoException).code!=='ESRCH')reason='source_group_termination_failed';}};
  const finish=(code:number|null)=>{
   if(settled)return;settled=true;clearTimeout(deadline);clearTimeout(escalation);clearTimeout(confirmation);abortSignal?.removeEventListener('abort',abort);
   child.stdout.destroy();child.stderr.destroy();
   if(reason)reject(Error(reason));else resolve({exitCode:code??1,stdout});
  };
  const cancel=(code:string)=>{
   if(reason||settled)return;reason=code;signal('SIGTERM');
   // Do not clear this timer on outer process/pipe close: descendants can outlive both.
   escalation=setTimeout(()=>{
    signal('SIGKILL');confirmation=setTimeout(()=>{
     try{if(groupLive())reason='source_group_termination_failed';}catch{reason='source_group_termination_unverified';}
     finish(null);
    },200);
   },graceMs);
  };
  const deadline=setTimeout(()=>cancel('direct_source_deadline_exceeded'),deadlineMs);
  const abort=()=>cancel('direct_source_cancelled');abortSignal?.addEventListener('abort',abort,{once:true});
  child.stdout.on('data',(chunk:Buffer)=>{bytes+=chunk.length;if(bytes>65536)cancel('direct_source_process_output_too_large');else stdout+=chunk.toString('utf8');});
  child.stderr.on('data',(chunk:Buffer)=>{bytes+=chunk.length;if(bytes>65536)cancel('direct_source_process_output_too_large');});
  child.on('error',()=>{if(!child.pid){reason='direct_source_process_start_failed';finish(null);}else cancel('direct_source_process_failed');});
  child.on('close',code=>{
   if(reason||settled)return;
   try{if(groupLive()){cancel('direct_source_descendant_still_running');return;}}
   catch{cancel('source_group_termination_unverified');return;}
   finish(code);
  });
 });
}

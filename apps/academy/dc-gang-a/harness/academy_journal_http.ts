import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {AcademyHttpClient} from '../src/lms/academyHttpClient';
import {readInputRecord,readLiteralName} from '../src/lms/academyReadProtocol';
import {journalHttpActionDigest,journalApprovalReceiptName,validateJournalHttpAction,acceptNativeJournalDecision,type JournalHttpAction,type JournalHttpTarget} from '../src/lms/lessonJournalHttp';
import {canonicalJson,digest,assertExactKeys} from '../src/learning/model';
import {privateJsonPath,readPrivateJsonText,reservePrivateJson} from './academy_private_io';
const args=process.argv.slice(2);
if(!args.length||args[0]==='--help'){console.log(JSON.stringify({command:'bun --no-env-file run harness/academy_journal_http.ts --qualify|--apply --request <private.json> --output <private.json>',credentialOwner:'native_profile_skill_secret_input',approvalOwner:'actual_native_clarify_result_bound_to_review_digest',automaticRetry:false,parentSend:false,default:'qualify_read_only'}));process.exit(0);}
const home=process.env.HERMES_HOME;if(home!=='/opt/data/profiles/dc-gang-a-dev')throw Error('active_profile_required');
const nativeChild=args[0]==='--native-child';if(nativeChild)args.shift();
if(args.length!==5||!['--qualify','--apply'].includes(args[0]!)||args[1]!=='--request'||args[3]!=='--output')throw Error('invalid_journal_arguments');
const input=privateJsonPath(home,args[2]!),output=privateJsonPath(home,args[4]!),mode=args[0]!;
// The credential bridge forwards these immutable bytes; the child never rereads a mutable request path.
const requestText=nativeChild?await Bun.stdin.text():readPrivateJsonText(home,input);
if(Buffer.byteLength(requestText)>131072)throw Error('private_journal_input_too_large');
const data=readInputRecord(JSON.parse(requestText));
assertExactKeys(data,mode==='--qualify'?['username','targets']:['username','actions','approval']);readLiteralName(data.username);
const config=JSON.parse(readFileSync(resolve(home,'academy/owner.json'),'utf8')) as {teacherLabel:string;teacherSourceKey:string;collegeSourceKey:string;expectedStudentNames:string[]};
const actions=mode==='--apply'?data.actions as JournalHttpAction[]:[];
if(mode==='--apply'&&(!Array.isArray(actions)||!actions.length||actions.length>32||new Set(actions.map(a=>a.attemptId)).size!==actions.length))throw Error('invalid_journal_actions');
actions.forEach(validateJournalHttpAction);
const targets=mode==='--qualify'?data.targets as JournalHttpTarget[]:[...new Map(actions.map(a=>[canonicalJson(a.target),a.target])).values()];
if(!Array.isArray(targets)||!targets.length||targets.length>8||new Set(targets.map(canonicalJson)).size!==targets.length||targets.some(t=>!config.expectedStudentNames.includes(t.studentName)||t.teacherKey!==config.teacherSourceKey))throw Error('owned_journal_targets_required');
const reviewDigest=mode==='--apply'?digest(actions):'';
const approval=mode==='--apply'?readInputRecord(data.approval):null;
const minimalEnv={HOME:process.env.HOME,PATH:process.env.PATH,HERMES_HOME:home,TMPDIR:process.env.TMPDIR};
if(approval){
 assertExactKeys(approval,['sessionId','messageId','reviewDigest']);if(approval.reviewDigest!==reviewDigest||typeof approval.sessionId!=='string'||!Number.isSafeInteger(approval.messageId))throw Error('native_journal_approval_binding_required');
 journalApprovalReceiptName(approval.sessionId,approval.messageId as number,reviewDigest);
 // Mandatory in BOTH parent and effect-owning child. Environment assertions cannot bypass it.
 const reader=`import os,sys\nfrom pathlib import Path\nfrom hermes_state import SessionDB\nif os.environ.get('HERMES_HOME')!='/opt/data/profiles/dc-gang-a-dev':raise SystemExit('active_profile_required')\ndb=SessionDB(Path(os.environ['HERMES_HOME'])/'state.db',read_only=True)\ntry:\n row=db._read_one('SELECT content FROM messages WHERE id = ? AND session_id = ? AND role = ? AND tool_name = ?',(int(sys.argv[2]),sys.argv[1],'tool','clarify'))\n if row is None:raise SystemExit('native_journal_approval_missing')\n sys.stdout.write(row[0])\nfinally:db.close()\n`;
 const observed=Bun.spawnSync(['/opt/hermes/.venv/bin/python','-B','-c',reader,approval.sessionId,String(approval.messageId)],{env:minimalEnv,stdout:'pipe',stderr:'pipe'});
 if(observed.exitCode!==0||!acceptNativeJournalDecision(JSON.parse(observed.stdout.toString()),reviewDigest))throw Error('native_journal_approval_rejected');
}
if(!nativeChild){
 // Native getter is solely credential ingress, not the approval owner or another secret store.
 const bridge=`import os,subprocess,sys\nfrom hermes_cli.config import get_env_value_prefer_dotenv\nif os.environ.get('HERMES_HOME')!='/opt/data/profiles/dc-gang-a-dev':raise SystemExit('active_profile_required')\npayload=sys.stdin.read()\nsecret=get_env_value_prefer_dotenv('DC_ACADEMY_HTTP_PASSWORD')\nif not secret:raise SystemExit('native_http_secret_required')\nenv={k:os.environ[k] for k in ('HOME','PATH','HERMES_HOME','TMPDIR') if k in os.environ}\nenv['DC_ACADEMY_HTTP_PASSWORD']=secret\nr=subprocess.run([sys.argv[1],'--no-env-file',sys.argv[2],'--native-child',*sys.argv[3:]],input=payload,text=True,env=env,cwd=os.getcwd())\nsys.exit(r.returncode)\n`;
 const child=Bun.spawn(['/opt/hermes/.venv/bin/python','-B','-c',bridge,process.execPath,import.meta.path,...args],{env:minimalEnv,stdin:'pipe',stdout:'inherit',stderr:'inherit'});child.stdin.write(requestText);child.stdin.end();process.exit(await child.exited);
}
const resultFile=reservePrivateJson(home,output);
resultFile.write({kind:'journal_http_attempt_started',mode,reviewDigest,startedAt:new Date().toISOString(),automaticRetryAllowed:false,parentSends:0});
const client=new AcademyHttpClient({teacherLabel:config.teacherLabel,teacherKey:config.teacherSourceKey,collegeKey:config.collegeSourceKey});
const results:unknown[]=[];
try{
 await client.authenticate({username:data.username as string,password:process.env.DC_ACADEMY_HTTP_PASSWORD??''});
 if(mode==='--qualify')for(const target of targets)results.push(await client.journalState(target));
 else for(const action of actions){
  const receiptPath=resolve(home,'artifacts',journalApprovalReceiptName(approval!.sessionId as string,approval!.messageId as number,journalHttpActionDigest(action)));
  const result=await client.applyJournalAction(action,{consumeApproval:async actual=>{
   if(journalHttpActionDigest(actual)!==journalHttpActionDigest(action))return {status:'rejected'};
   const receipt=reservePrivateJson(home,receiptPath);try{receipt.write({kind:'exact_native_approved_journal_attempt',approval,action:actual,beforeWriteAt:new Date().toISOString(),automaticRetryAllowed:false,parentSends:0});}finally{receipt.close();}
   return {status:'verified',actionDigest:journalHttpActionDigest(actual)};
  }});
  results.push(result);resultFile.write({kind:'journal_http_attempt',mode,reviewDigest,results,parentSends:0,automaticRetryAllowed:false});
  if(!['persisted','noop'].includes(result.status)||result.transport==='uncertain')throw Error('journal_http_reconciliation_required');
 }
 resultFile.write({kind:'journal_http_result',mode,reviewDigest,observedAt:new Date().toISOString(),results,parentSends:0,automaticRetryAllowed:false});
 console.log(JSON.stringify({status:mode==='--qualify'?'observed':'read_back',targets:targets.length,results:results.length,output,parentSends:0,credentialsEmitted:false}));
}catch(error){resultFile.write({kind:'journal_http_blocked',mode,reviewDigest,code:error instanceof Error?error.message:'journal_http_failed',results,parentSends:0,automaticRetryAllowed:false});console.log(JSON.stringify({status:'blocked',code:error instanceof Error?error.message:'journal_http_failed',results:results.length,output,parentSends:0}));process.exitCode=1;}finally{client.close();resultFile.close();}

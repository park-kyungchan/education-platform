import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {AcademyHttpClient,AcademyHttpFailure} from '../src/lms/academyHttpClient';
import {createAcademyReadPlan,readInputRecord,readLiteralName,readLiteralKey} from '../src/lms/academyReadProtocol';
import {readPrivateJsonText} from './academy_private_io';
import {parseHttpInvocation} from './academy_http_invocation';

const args=process.argv.slice(2);
if(args.length===0||args[0]==='--help'){
  console.log(JSON.stringify({command:'bun run harness/academy_http.ts --request <private.json> --output <private.json>',credentialOwner:'native_profile_skill_secret_input',consumer:'fixed_origin_ephemeral_direct_http',sourceEffect:'read_only',textbookIndexInspection:'read_only_existing_headers_not_generated_paper_membership',browserFallback:false,passwordInArgv:false,sessionsPersisted:false}));process.exit(0);
}
const home=process.env.HERMES_HOME;if(home!=='/opt/data/profiles/dc-gang-a-dev')throw Error('active_profile_required');
const nativeChild=args[0]==='--native-child';if(nativeChild)args.shift();
const invocation=parseHttpInvocation(home,args),{input,output}=invocation;
const requestText=nativeChild?await Bun.stdin.text():readPrivateJsonText(home,input,invocation.inputIdentity);
if(Buffer.byteLength(requestText)>65536)throw Error('private_http_input_too_large');
const data=readInputRecord(JSON.parse(requestText));
if(!['read,username','inspectWire,read,username','inspectMetadata,read,username','inspectTextbookIndex,read,username','discover,username','studentPaperForm,username','studentPaperSearch,username'].includes(Object.keys(data).sort().join(','))
  ||('inspectWire' in data&&data.inspectWire!==true)||('inspectMetadata' in data&&data.inspectMetadata!==true)||('inspectTextbookIndex' in data&&data.inspectTextbookIndex!==true))throw Error('invalid_http_request');
readLiteralName(data.username);
const config=JSON.parse(readFileSync(resolve(home,'academy/owner.json'),'utf8')) as {teacherLabel:string;teacherSourceKey:string;collegeSourceKey:string;expectedStudentNames:string[]};
const discovery=data.discover?readInputRecord(data.discover):null;
const studentPaperForm=data.studentPaperForm||data.studentPaperSearch?readInputRecord(data.studentPaperForm??data.studentPaperSearch):null;
if(studentPaperForm){
  if(Object.keys(studentPaperForm).sort().join(',')!=='studentKey,studentName,teacherLabel'||studentPaperForm.teacherLabel!==config.teacherLabel||!config.expectedStudentNames.includes(readLiteralName(studentPaperForm.studentName)))throw Error('owned_student_paper_scope_required');
  readLiteralKey(studentPaperForm.studentKey);
}
if(discovery){
  if(Object.keys(discovery).sort().join(',')!=='collegeKey,studentNames,teacherKey,teacherLabel'||discovery.teacherLabel!==config.teacherLabel||discovery.teacherKey!==config.teacherSourceKey||discovery.collegeKey!==config.collegeSourceKey
    ||!Array.isArray(discovery.studentNames)||!discovery.studentNames.length||discovery.studentNames.some(name=>!config.expectedStudentNames.includes(name)))throw Error('owned_discovery_scope_required');
}
const plan=discovery||studentPaperForm||data.read===null?null:createAcademyReadPlan(data.read);
if(data.inspectTextbookIndex===true&&plan?.family!=='textbook')throw Error('textbook_index_scope_required');
if(plan){
  if(plan.request.teacherLabel!==config.teacherLabel)throw Error('teacher_scope_conflict');
  const names=plan.family==='day_record'?plan.request.studentNames:plan.family==='daily_zero'?plan.request.targets.map(x=>x.studentName):plan.family==='student_course'||plan.family==='textbook'?[plan.request.studentName]:[];
  if(names.some(name=>!config.expectedStudentNames.includes(name)))throw Error('owned_student_scope_required');
}
if(!nativeChild){
  // Native Python API is the necessary compatibility seam, not another secret store.
  const bridge=`import os,subprocess,sys\nfrom hermes_cli.config import get_env_value_prefer_dotenv\nif os.environ.get('HERMES_HOME')!='/opt/data/profiles/dc-gang-a-dev':raise SystemExit('active_profile_required')\npayload=sys.stdin.read()\nsecret=get_env_value_prefer_dotenv('DC_ACADEMY_HTTP_PASSWORD')\nif not secret:raise SystemExit('native_http_secret_required')\nenv={k:os.environ[k] for k in ('HOME','PATH','HERMES_HOME','TMPDIR') if k in os.environ}\nenv['DC_ACADEMY_HTTP_PASSWORD']=secret\nr=subprocess.run([sys.argv[1],'--no-env-file',sys.argv[2],'--native-child',*sys.argv[3:]],input=payload,text=True,env=env,cwd=os.getcwd())\nsys.exit(r.returncode)\n`;
  const child=Bun.spawn(['/opt/hermes/.venv/bin/python','-B','-c',bridge,process.execPath,import.meta.path,...args],{env:{HOME:process.env.HOME,PATH:process.env.PATH,HERMES_HOME:home,TMPDIR:process.env.TMPDIR},stdin:'pipe',stdout:'inherit',stderr:'inherit'});
  child.stdin.write(requestText);child.stdin.end();
  process.exit(await child.exited);
}
const resultFile=invocation.openResult();
const client=new AcademyHttpClient({teacherLabel:config.teacherLabel,teacherKey:config.teacherSourceKey,collegeKey:config.collegeSourceKey});
try{
  const authentication=await client.authenticate({username:data.username as string,password:process.env.DC_ACADEMY_HTTP_PASSWORD??''});
  const source=plan&&data.inspectTextbookIndex!==true?await client.execute(plan.request):null;
  const books=discovery?await client.discoverBooks(discovery as unknown as import('../src/academy/nativeBookSource').SourceDiscoveryRequest):undefined;
  const wire=data.inspectWire===true&&plan?await client.inspectDayRecordWire(plan.request):undefined;
  const metadataFields=data.inspectMetadata===true&&plan?await client.inspectItemHeader(plan.request):undefined;
  const textbookIndex=data.inspectTextbookIndex===true&&plan?await client.inspectTextbookIndex(plan.request):undefined;
  const studentPaperMetadata=data.studentPaperForm&&studentPaperForm?await client.inspectStudentPaperForm(studentPaperForm as unknown as {teacherLabel:string;studentName:string;studentKey:string}):undefined;
  const studentPaperSearchMetadata=data.studentPaperSearch&&studentPaperForm?await client.searchStudentPaperMetadata(studentPaperForm as unknown as {teacherLabel:string;studentName:string;studentKey:string}):undefined;
  resultFile.write({schemaVersion:1,observedAt:new Date().toISOString(),authentication,source,wire,metadataFields,textbookIndex,studentPaperMetadata,studentPaperSearchMetadata,books,academyWrites:0,parentSends:0});
  console.log(JSON.stringify({status:source?.status??'authenticated',sourceFamily:source?.family??null,rows:source?.dayRecords.length??0,rowMeaning:'day_records_only',studentPaperRows:studentPaperSearchMetadata?.rows.length??0,output,credentialsEmitted:false,browserRequests:0,academyWrites:0,parentSends:0}));
}catch(error){
  const code=error instanceof Error&&/^[a-z][a-z0-9_]{0,100}$/.test(error.message)?error.message:'direct_http_contract_failed';
  const diagnostic=error instanceof AcademyHttpFailure?{httpStatus:error.httpStatus,sourceOperation:error.sourceOperation}:{};
  const failure={status:'blocked',code,...diagnostic,observedAt:new Date().toISOString(),automaticRetryAllowed:false,academyWrites:0,parentSends:0};
  resultFile.write(failure);console.log(JSON.stringify(failure));process.exitCode=1;
}
finally{client.close();resultFile.close();}

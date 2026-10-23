import {spawn} from 'node:child_process';
import {isAbsolute} from 'node:path';
import {nativePoolDriver,type PoolReadRunner} from './native-pool-backend.ts';
import {readPinnedLocalBytes} from './item-label-store.ts';
import {operatorHash,operatorHello,operatorReadRequest,serveOperatorSocket,assertPrivateOperatorPath} from './native-pool-socket.ts';

export function operatorArguments(args:readonly string[]){
  if(args.length!==10||['--reader','--reader-sha256','--socket','--ssh-target','--container-name'].some((flag,i)=>args[i*2]!==flag)
    ||!isAbsolute(args[1])||!isAbsolute(args[5])||!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,100}$/.test(args[7])||args[9]!=='hermes-agent-2q3y-hermes-serve-1')throw Error('operator_arguments_invalid');
  return {reader:args[1],readerSha256:operatorHash.parse(args[3]),socket:args[5],sshTarget:args[7],containerName:args[9]};
}
const quote=(value:string)=>"'"+value.replaceAll("'","'\\''")+"'";

/** Fixed host loop, carried only through this one authenticated SSH channel. No remote files. */
export function operatorHostScript(){return `import os,sys,json,re,base64,hashlib,socket,subprocess,threading
NAME='hermes-agent-2q3y-hermes-serve-1'
DRIVER=base64.b64decode('${Buffer.from(nativePoolDriver,'utf8').toString('base64')}').decode('utf8')
MAX=2*1024*1024
def emit(value):
 data=json.dumps(value,separators=(',',':'))
 if len(data.encode())>MAX: data='{"status":"blocked","code":"operator_reply_size_limit"}'
 print(data,flush=True)
class SafeFailure(Exception):
 def __init__(self,stage,reason,exit_code=None,output_bytes=0):
  super().__init__('operator_'+stage+'_failed');self.metadata={'stage':stage,'reason':reason,'exitCode':exit_code,'outputBytes':output_bytes}
def run(argv,payload=None,timeout=30,allow_blocked_result=False,stage='native_read'):
 try: p=subprocess.Popen(argv,stdin=subprocess.PIPE if payload is not None else subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
 except OSError: raise SafeFailure(stage,'start_failed')
 timer=threading.Timer(timeout,p.kill);timer.start()
 try:
  if payload is not None: p.stdin.write(payload.encode());p.stdin.close()
  data=p.stdout.read(MAX+1)
  if len(data)>MAX: raise SafeFailure(stage,'output_limit',output_bytes=len(data))
  code=p.wait(timeout=2)
  if code and not allow_blocked_result: raise SafeFailure(stage,'nonzero_exit',code,len(data))
  try: result=json.loads(data)
  except (ValueError,UnicodeError): raise SafeFailure(stage,'invalid_json',code,len(data))
  # A failed child can explain a refusal, but can never qualify observed success.
  if code and (not isinstance(result,dict) or result.get('status')!='blocked' or not isinstance(result.get('code'),str) or not re.fullmatch('[a-z_]{1,100}',result['code'])):
   raise SafeFailure(stage,'nonzero_exit',code,len(data))
  return result
 finally:
  timer.cancel()
  if p.poll() is None: p.kill();p.wait()
INSPECT='{"id":{{json .Id}},"name":{{json .Name}},"image":{{json .Config.Image}},"imageId":{{json .Image}},"running":{{json .State.Running}},"pid":{{json .State.Pid}},"mounts":{{json .Mounts}}}'
def inspect():
 value=run(['docker','inspect','--type','container','--format',INSPECT,NAME],stage='container_inspect')
 if value['name']!='/'+NAME or not value['running'] or value['pid']<=0 or not re.fullmatch('[a-f0-9]{64}',value['id']): raise RuntimeError('operator_container_identity_invalid')
 return value
def argv(cid,program): return ['docker','exec','-i','--user','10000:10000','--env','HOME=/opt/data','--env','HERMES_HOME=/opt/data/profiles/dc-gang-a-dev',cid,'/opt/hermes/.venv/bin/python','-B','-c',program]
CHECK="import os,json,shutil,subprocess; print(json.dumps({'uid':os.getuid(),'gid':os.getgid(),'home':os.environ.get('HOME'),'hermesHome':os.environ.get('HERMES_HOME'),'cwd':os.getcwd(),'bunPath':shutil.which('bun'),'bunVersion':subprocess.check_output(['bun','--version'],text=True,timeout=10).strip()}))"
def validate(request):
 if not isinstance(request,dict) or request.get('operation') not in ['protocol','categories','labels','questions']: raise RuntimeError('operator_request_invalid')
 question=request['operation']=='questions'
 allowed={'operation','scope','expectedSelectorSha256'}|({'patNo','page','limit','offset'} if question else set())
 if set(request)-allowed: raise RuntimeError('operator_request_invalid')
 s=request.get('scope')
 if not isinstance(s,dict) or set(s)!={'cl1','cl2','cl3','cl4'} or any(type(x)!=int or x<0 or x>9007199254740991 for x in s.values()): raise RuntimeError('operator_request_invalid')
 if (not s['cl1'] and any(s[x] for x in ['cl2','cl3','cl4'])) or (not s['cl2'] and any(s[x] for x in ['cl3','cl4'])) or (not s['cl3'] and s['cl4']): raise RuntimeError('operator_request_invalid')
 if request['operation']=='protocol' and any(s.values()) or request['operation'] in ['labels','questions'] and not s['cl3']: raise RuntimeError('operator_request_invalid')
 if 'expectedSelectorSha256' in request and not re.fullmatch('[a-f0-9]{64}',str(request['expectedSelectorSha256'])): raise RuntimeError('operator_request_invalid')
 if question and (not isinstance(request.get('patNo'),str) or not re.fullmatch('[1-9][0-9]{0,15}',request.get('patNo','')) or type(request.get('page'))!=int or not 1<=request['page']<=100000 or type(request.get('limit'))!=int or not 1<=request['limit']<=50 or type(request.get('offset',0))!=int or not 0<=request.get('offset',0)<=49): raise RuntimeError('operator_request_invalid')
 return request
try:
 line=sys.stdin.buffer.readline(6*1024*1024+1)
 if len(line)>6*1024*1024: raise RuntimeError('operator_reader_size_limit')
 initial=json.loads(line)
 if set(initial)!={'readerBase64','readerSha256'} or not re.fullmatch('[a-f0-9]{64}',initial['readerSha256']): raise RuntimeError('operator_reader_identity_invalid')
 reader=base64.b64decode(initial['readerBase64'],validate=True)
 if len(reader)>4*1024*1024 or hashlib.sha256(reader).hexdigest()!=initial['readerSha256']: raise RuntimeError('operator_reader_identity_invalid')
 source=reader.decode('utf8');container=inspect();cid=container['id']
 native=run(argv(cid,CHECK),stage='native_identity')
 if native['uid']!=10000 or native['home']!='/opt/data' or native['hermesHome']!='/opt/data/profiles/dc-gang-a-dev' or not native['bunPath']: raise RuntimeError('operator_native_owner_invalid')
 mounts=[{'type':m.get('Type',''),'source':m.get('Source',''),'destination':m.get('Destination',''),'readWrite':bool(m.get('RW'))} for m in container['mounts']]
 emit({'status':'ready','schemaVersion':'academy.native-pool-operator.hello/1','readerSha256':initial['readerSha256'],'metadata':{'host':{'hostname':socket.gethostname(),'uid':os.getuid(),'home':os.path.expanduser('~')},'container':{'id':cid,'name':NAME,'image':container['image'],'imageId':container['imageId'],'pid':container['pid'],'mounts':mounts},'native':native}})
except Exception as error:
 result={'status':'blocked','code':str(error) if re.fullmatch('[a-z_]{1,100}',str(error)) else 'operator_preflight_failed'}
 if isinstance(error,SafeFailure): result['safeMetadata']=error.metadata
 emit(result);sys.exit(1)
authentication_refused=False
while True:
 line=sys.stdin.buffer.readline(16*1024+1)
 if not line: break
 if len(line)>16*1024: emit({'status':'blocked','code':'operator_request_size_limit'});break
 try:
  request=validate(json.loads(line))
  if authentication_refused: raise RuntimeError('native_pool_authentication_requires_new_input')
  if inspect()['id']!=cid: raise RuntimeError('operator_container_identity_changed')
  result=run(argv(cid,DRIVER),json.dumps({'source':source,'request':request}),115,True)
  if result.get('status')!='observed' or result.get('academyWrites')!=0 or result.get('passwordExported') is not False or result.get('cookiesExported') is not False:
   code=result.get('code','native_pool_read_unqualified')
   if not isinstance(code,str) or not re.fullmatch('[a-z_]{1,100}',code): code='native_pool_read_unqualified'
   raise RuntimeError(code)
  emit(result)
 except Exception as error:
  code=str(error) if re.fullmatch('[a-z_]{1,100}',str(error)) else 'operator_read_failed'
  if re.search('authentication_required|source_login_challenge|native_http_secret_required|teacher_.*conflict|login_wire_contract_drift',code): authentication_refused=True
  result={'status':'blocked','code':code}
  if isinstance(error,SafeFailure): result['safeMetadata']=error.metadata
  emit(result)
`;}

export function operatorSshArguments(target:string){
  if(!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,100}$/.test(target))throw Error('operator_ssh_target_invalid');
  return ['-T','-o','ControlMaster=no','-o','ControlPath=none','-o','StrictHostKeyChecking=yes','-o','NumberOfPasswordPrompts=1','-o','ConnectionAttempts=1',target,
    'python3 -u -B -c '+quote(operatorHostScript())];
}

export async function runOperatorCli(args:readonly string[]){
  const config=operatorArguments(args);await assertPrivateOperatorPath(config.socket,false);
  const {bytes}=await readPinnedLocalBytes(config.reader,config.readerSha256);
  const child=spawn('ssh',operatorSshArguments(config.sshTarget),{stdio:['pipe','pipe','inherit']});
  let buffer=Buffer.alloc(0),pending:{resolve:(value:unknown)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}|undefined,closed=false;
  const fail=(code:string)=>{if(pending){clearTimeout(pending.timer);pending.reject(Error(code));pending=undefined;}};
  child.stdin.on('error',()=>fail('operator_ssh_input_closed'));
  child.stdout.on('data',chunk=>{
    buffer=Buffer.concat([buffer,chunk]);if(buffer.length>2*1024*1024){fail('operator_reply_size_limit');child.kill();return;}
    const end=buffer.indexOf(10);if(end<0)return;
    if(!pending||buffer.subarray(end+1).toString().trim()){fail('operator_reply_frame_invalid');child.kill();return;}
    const current=pending;pending=undefined;clearTimeout(current.timer);
    try{current.resolve(JSON.parse(buffer.subarray(0,end).toString('utf8')));}catch{current.reject(Error('operator_reply_invalid'));}
    buffer=Buffer.alloc(0);
  });
  const stopped=new Promise<void>(resolve=>{child.once('close',()=>{closed=true;fail('operator_ssh_closed');resolve();});child.once('error',()=>{closed=true;fail('operator_ssh_start_failed');resolve();});});
  const exchange=(message:unknown,timeout:number)=>new Promise<unknown>((resolve,reject)=>{
    if(closed||pending){reject(Error('operator_ssh_not_ready'));return;}
    const timer=setTimeout(()=>{fail('operator_ssh_timeout');child.kill();},timeout);pending={resolve,reject,timer};
    child.stdin.write(JSON.stringify(message)+'\n');
  });
  const stop=()=>{child.stdin.end();child.kill();};process.once('SIGINT',stop);process.once('SIGTERM',stop);
  let server:Awaited<ReturnType<typeof serveOperatorSocket>>|undefined;
  try{
    const initial=await exchange({readerBase64:bytes.toString('base64'),readerSha256:config.readerSha256},180000) as Record<string,unknown>;
    if(initial.status==='blocked'){
      const error=Error(typeof initial.code==='string'&&/^[a-z_]{1,100}$/.test(initial.code)?initial.code:'operator_preflight_failed');
      Object.assign(error,{safeMetadata:operatorSafeMetadata(initial.safeMetadata)});throw error;
    }
    const hello=operatorHello.parse(initial);
    if(hello.readerSha256!==config.readerSha256)throw Error('operator_reader_identity_mismatch');
    const runner:PoolReadRunner=async request=>{
      const result=await exchange(operatorReadRequest.parse(request),120000) as Record<string,unknown>;
      if(result.status==='blocked')throw Error(typeof result.code==='string'&&/^[a-z_]{1,100}$/.test(result.code)?result.code:'operator_read_failed');
      return result as Awaited<ReturnType<PoolReadRunner>>;
    };
    server=await serveOperatorSocket(config.socket,hello,runner);
    console.log(JSON.stringify({...hello,socket:config.socket}));
    await stopped;
  }finally{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);stop();await server?.close();}
}
export function operatorSafeMetadata(value:unknown){
  if(!value||typeof value!=='object')return undefined;
  const record=value as Record<string,unknown>;
  if(!['container_inspect','native_identity','native_read'].includes(String(record.stage))||!['start_failed','output_limit','nonzero_exit','invalid_json'].includes(String(record.reason))
    ||record.exitCode!==null&&(!Number.isInteger(record.exitCode)||Number(record.exitCode)<-255||Number(record.exitCode)>255)
    ||!Number.isInteger(record.outputBytes)||Number(record.outputBytes)<0||Number(record.outputBytes)>2*1024*1024+1)return undefined;
  return {stage:record.stage,reason:record.reason,exitCode:record.exitCode,outputBytes:record.outputBytes};
}
if(import.meta.main)runOperatorCli(process.argv.slice(2)).catch(error=>{console.error(JSON.stringify({status:'blocked',code:error instanceof Error&&/^[a-z_]{1,100}$/.test(error.message)?error.message:'operator_failed',safeMetadata:operatorSafeMetadata(error?.safeMetadata)}));process.exitCode=1;});

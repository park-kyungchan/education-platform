import {expect,test} from 'bun:test';
import {mkdtemp,chmod,rm,symlink,writeFile,unlink,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createServer,connect} from 'node:net';
import {createHash} from 'node:crypto';
import {operatorArguments,operatorHostScript,operatorSshArguments,operatorSafeMetadata} from '../src/native-pool-operator.ts';
import {nativePoolDriver,type PoolReadRunner} from '../src/native-pool-backend.ts';
import {assertPrivateOperatorPath,loadOperatorPoolBackend,operatorHello,operatorReadRequest,operatorSocketExchange,serveOperatorSocket} from '../src/native-pool-socket.ts';

const sha='a'.repeat(64),zero={cl1:0,cl2:0,cl3:0,cl4:0};
const hello={status:'ready',schemaVersion:'academy.native-pool-operator.hello/1',readerSha256:sha,metadata:{
 host:{hostname:'synthetic-host',uid:1000,home:'/home/synthetic'},
 container:{id:'b'.repeat(64),name:'hermes-agent-2q3y-hermes-serve-1',image:'synthetic:1',imageId:'sha256:synthetic',pid:42,mounts:[]},
 native:{uid:10000,gid:10000,home:'/opt/data',hermesHome:'/opt/data/profiles/dc-gang-a-dev',cwd:'/opt/hermes',bunPath:'/usr/local/bin/bun',bunVersion:'synthetic'},
}};
const result=()=>({status:'observed' as const,page:{schemaVersion:1,sourceOperation:'test_pool_presentation_protocol',selectorSha256:sha,helpersSha256:sha,
 sourceHandlersExecuted:false,academyWrites:0,controls:[],gridColumns:[]},requests:1,academyWrites:0 as const,passwordExported:false as const,cookiesExported:false as const});
async function temporary<T>(run:(directory:string,path:string)=>Promise<T>){const directory=await mkdtemp(join(tmpdir(),'pool-operator-'));await chmod(directory,0o700);
 try{return await run(directory,join(directory,'pool.sock'));}finally{await rm(directory,{recursive:true,force:true});}}

test('operator CLI keeps a single interactive SSH channel, strict fixed options and the exact native getter driver',()=>{
 const valid=['--reader','/private/reader.js','--reader-sha256',sha,'--socket','/private/pool.sock','--ssh-target','existingAlias','--container-name','hermes-agent-2q3y-hermes-serve-1'];
 expect(operatorArguments(valid).readerSha256).toBe(sha);
 for(const [index,value] of [[1,'relative'],[3,'wrong'],[7,'-oProxyCommand=bad'],[9,'foreign-container'],[9,'hermes-agent-2q3y']] as const){const args=[...valid];args[index]=value;expect(()=>operatorArguments(args)).toThrow();}
 const args=operatorSshArguments('existingAlias');expect(args.slice(0,-1)).toEqual(['-T','-o','ControlMaster=no','-o','ControlPath=none','-o','StrictHostKeyChecking=yes','-o','NumberOfPasswordPrompts=1','-o','ConnectionAttempts=1','existingAlias']);
 expect(args.join(' ')).not.toContain('BatchMode=yes');expect(args.join(' ')).not.toContain('StrictHostKeyChecking=no');
 const script=operatorHostScript();expect(script).toContain(Buffer.from(nativePoolDriver).toString('base64'));expect(script).not.toContain('.Config.Env');
 expect(script).toContain("if inspect()['id']!=cid");expect(script).toContain('authentication_refused=True');expect(script).toContain(',115,True)');
 const syntax=spawnSync('python3',['-c','import sys; compile(sys.stdin.read(), "operator-host", "exec")'],{input:script,encoding:'utf8'});
 expect(syntax.status).toBe(0);expect(syntax.stderr).toBe('');
});

test('wire schemas forbid commands, URLs, credentials, foreign scopes and unqualified hello owners',()=>{
 expect(operatorReadRequest.parse({operation:'protocol',scope:zero}).operation).toBe('protocol');
 for(const request of [{operation:'Save',scope:zero},{operation:'protocol',scope:zero,command:'ls'},
  {operation:'protocol',scope:zero,url:'https://foreign.invalid'},{operation:'protocol',scope:zero,password:'not-admitted'},
  {operation:'protocol',scope:{...zero,cl1:3}},{operation:'labels',scope:zero},{operation:'questions',scope:{cl1:3,cl2:4,cl3:5,cl4:0},patNo:'1',page:0,limit:50}])expect(operatorReadRequest.safeParse(request).success).toBe(false);
 expect(operatorHello.safeParse(hello).success).toBe(true);
 expect(operatorHello.safeParse({...hello,metadata:{...hello.metadata,native:{...hello.metadata.native,uid:0}}}).success).toBe(false);
 expect(operatorHello.safeParse({...hello,metadata:{...hello.metadata,container:{...hello.metadata.container,name:'hermes-agent-2q3y'}}}).success).toBe(false);
});

test('preflight failures retain safe stage and exit status without exporting raw child output',async()=>temporary(async(directory)=>{
 const container={...hello.metadata.container,name:'/hermes-agent-2q3y-hermes-serve-1',running:true};
 const reader=Buffer.from('// Synthetic preflight only'),readerSha256=createHash('sha256').update(reader).digest('hex');
 for(const stage of ['container_inspect','native_identity'] as const){
  const fakeDocker=`#!/usr/bin/python3
import sys
assert sys.argv[-1]=='hermes-agent-2q3y-hermes-serve-1' if sys.argv[1]=='inspect' else True
if sys.argv[1]=='inspect' and ${stage==='native_identity'?'True':'False'}: print(${JSON.stringify(JSON.stringify(container))})
else:
 sys.stderr.write('synthetic-private-error-must-not-export')
 sys.exit(${stage==='container_inspect'?17:29})
`;
  await writeFile(join(directory,'docker'),fakeDocker,{mode:0o700});
  const child=spawnSync('/usr/bin/python3',['-B','-c',operatorHostScript()],{input:JSON.stringify({readerBase64:reader.toString('base64'),readerSha256})+'\n',encoding:'utf8',timeout:10000,env:{PATH:directory+':/usr/bin:/bin'},maxBuffer:2*1024*1024});
  expect(child.status).toBe(1);expect(child.stderr).toBe('');expect(child.stdout).not.toContain('synthetic-private-error');
  expect(JSON.parse(child.stdout)).toEqual({status:'blocked',code:'operator_'+stage+'_failed',safeMetadata:{stage,reason:'nonzero_exit',exitCode:stage==='container_inspect'?17:29,outputBytes:0}});
 }
 const allowed={stage:'native_identity',reason:'nonzero_exit',exitCode:29,outputBytes:0};
 expect(operatorSafeMetadata({...allowed,password:'must-not-export'})).toEqual(allowed);
 expect(operatorSafeMetadata({...allowed,stage:'arbitrary-command'})).toBeUndefined();
}));

for(const scenario of [
 {name:'zero exit qualifies observed success',exitCode:0,payload:JSON.stringify(result())+'\n',observed:true},
 {name:'nonzero exit cannot qualify observed success',exitCode:23,payload:JSON.stringify(result())+'\n',reason:'nonzero_exit'},
 {name:'nonzero authentication refusal latches later reads',exitCode:23,payload:JSON.stringify({status:'blocked',code:'source_login_challenge'})+'\n',refusal:true},
 {name:'nonzero nonobject JSON is blocked with exit metadata',exitCode:23,payload:'[]\n',reason:'nonzero_exit'},
 {name:'nonzero invalid refusal cannot export its code',exitCode:23,payload:JSON.stringify({status:'blocked',code:'synthetic private output'})+'\n',reason:'nonzero_exit'},
 {name:'nonzero invalid JSON is blocked',exitCode:23,payload:'not-json\n',reason:'invalid_json'},
 {name:'zero exit with invalid JSON is blocked',exitCode:0,payload:'not-json\n',reason:'invalid_json'},
])test('generated host loop: '+scenario.name,async()=>temporary(async(directory)=>{
 const container={...hello.metadata.container,name:'/hermes-agent-2q3y-hermes-serve-1',running:true},native=hello.metadata.native;
 const log=join(directory,'native-reads');
 const fakeDocker=`#!/usr/bin/python3
import sys
if sys.argv[1]=='inspect': print(${JSON.stringify(JSON.stringify(container))})
elif "shutil.which('bun')" in sys.argv[-1]: print(${JSON.stringify(JSON.stringify(native))})
else:
 sys.stdin.buffer.read()
 with open(${JSON.stringify(log)},'a') as file: file.write('read\\n')
 sys.stderr.write('synthetic-private-stderr')
 sys.stdout.write(${JSON.stringify(scenario.payload)})
 sys.exit(${scenario.exitCode})
`;
 await writeFile(join(directory,'docker'),fakeDocker,{mode:0o700});
 const reader=Buffer.from('// Synthetic reader is never executed'),readerSha256=createHash('sha256').update(reader).digest('hex');
 const requests=[{readerBase64:reader.toString('base64'),readerSha256},{operation:'protocol',scope:zero}];
 if(scenario.refusal)requests.push({operation:'protocol',scope:zero});
 const child=spawnSync('/usr/bin/python3',['-B','-c',operatorHostScript()],{input:requests.map(value=>JSON.stringify(value)+'\n').join(''),encoding:'utf8',timeout:10000,env:{PATH:directory+':/usr/bin:/bin'},maxBuffer:2*1024*1024});
 expect(child.status).toBe(0);expect(child.stderr).toBe('');expect(child.stdout).not.toContain('synthetic-private-stderr');expect(child.stdout).not.toContain('synthetic private output');
 const rows=child.stdout.trim().split('\n').map(line=>JSON.parse(line));expect(rows[0].status).toBe('ready');
 if(scenario.observed)expect(rows[1]).toEqual(result());
 else if(scenario.refusal){
  expect(rows[1]).toEqual({status:'blocked',code:'source_login_challenge'});
  expect(rows[2]).toEqual({status:'blocked',code:'native_pool_authentication_requires_new_input'});
 }else expect(rows[1]).toEqual({status:'blocked',code:'operator_native_read_failed',safeMetadata:{stage:'native_read',reason:scenario.reason,exitCode:scenario.exitCode,outputBytes:Buffer.byteLength(scenario.payload)}});
 expect(rows).toHaveLength(scenario.refusal?3:2);expect(await readFile(log,'utf8')).toBe('read\n');
}));

test('synthetic host loop propagates the exact driver missing-secret refusal and prevents another getter attempt',async()=>temporary(async(directory)=>{
 const configDirectory=join(directory,'hermes_cli');await (await import('node:fs/promises')).mkdir(configDirectory);
 await writeFile(join(configDirectory,'__init__.py'),'');
 const log=join(directory,'getter-calls');
 await writeFile(join(configDirectory,'config.py'),'def get_env_value_prefer_dotenv(name):\n with open('+JSON.stringify(log)+', "a") as file: file.write("called\\n")\n return None\n');
 const native=hello.metadata.native,container={...hello.metadata.container,name:'/hermes-agent-2q3y-hermes-serve-1',running:true};
 const fakeDocker=`#!/usr/bin/python3
import os,sys,json,subprocess
if sys.argv[1]=='inspect':
 assert sys.argv[-1]=='hermes-agent-2q3y-hermes-serve-1'
 print(${JSON.stringify(JSON.stringify(container))})
elif "shutil.which('bun')" in sys.argv[-1]: print(${JSON.stringify(JSON.stringify(native))})
else:
 env={'PATH':'/usr/bin:/bin','PYTHONPATH':${JSON.stringify(directory)},'HOME':'/opt/data','HERMES_HOME':'/opt/data/profiles/dc-gang-a-dev'}
 result=subprocess.run([sys.executable,'-B','-c',sys.argv[-1]],input=sys.stdin.buffer.read(),stdout=sys.stdout.buffer,stderr=sys.stderr.buffer,env=env)
 sys.exit(result.returncode)
`;
 await writeFile(join(directory,'docker'),fakeDocker,{mode:0o700});
 const reader=Buffer.from('// Synthetic reader must never execute'),readerSha256=createHash('sha256').update(reader).digest('hex');
 const input=[{readerBase64:reader.toString('base64'),readerSha256},{operation:'protocol',scope:zero},{operation:'protocol',scope:zero}].map(value=>JSON.stringify(value)+'\n').join('');
 const child=spawnSync('/usr/bin/python3',['-B','-c',operatorHostScript()],{input,encoding:'utf8',timeout:10000,env:{PATH:directory+':/usr/bin:/bin'},maxBuffer:2*1024*1024});
 expect(child.status).toBe(0);expect(child.stderr).toBe('');
 const rows=child.stdout.trim().split('\n').map(line=>JSON.parse(line));expect(rows[0].status).toBe('ready');
 expect(rows[1]).toEqual({status:'blocked',code:'native_http_secret_required'});
 expect(rows[2]).toEqual({status:'blocked',code:'native_pool_authentication_requires_new_input'});
 expect(await readFile(log,'utf8')).toBe('called\n');
}));

test('private socket boundary rejects permissive parents, symlinks, wrong modes and an existing target',async()=>temporary(async(directory,path)=>{
 await chmod(directory,0o755);await expect(assertPrivateOperatorPath(path,false)).rejects.toThrow('operator_socket_parent_not_private');await chmod(directory,0o700);
 const bridge=await serveOperatorSocket(path,hello,async()=>result());
 try{
  await expect(serveOperatorSocket(path,hello,async()=>result())).rejects.toThrow('operator_socket_already_exists');
  await symlink(path,join(directory,'link.sock'));await expect(assertPrivateOperatorPath(join(directory,'link.sock'))).rejects.toThrow('operator_socket_not_private');
  await chmod(path,0o666);await expect(assertPrivateOperatorPath(path)).rejects.toThrow('operator_socket_not_private');await chmod(path,0o600);
 }finally{await bridge.close();}
}));

test('backend loads without an operator and performs a pinned lazy handshake before the first source read',async()=>temporary(async(_directory,path)=>{
 const backend=await loadOperatorPoolBackend(['--operator-socket',path,'--reader-sha256',sha]);
 await expect(backend.protocol()).rejects.toThrow('operator_required');
 let reads=0;const bridge=await serveOperatorSocket(path,hello,async()=>{reads++;return result();});
 try{expect((await backend.protocol()).status).toBe('available');expect(reads).toBe(1);
  const mismatch=await loadOperatorPoolBackend(['--operator-socket',path,'--reader-sha256','c'.repeat(64)]);
  await expect(mismatch.protocol()).rejects.toThrow();expect(reads).toBe(1);
 }finally{await bridge.close();}
}));

test('socket requests serialize and authentication refusal holds later native reads without retries',async()=>temporary(async(_directory,path)=>{
 let active=0,peak=0,calls=0;const runner:PoolReadRunner=async()=>{calls++;active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,10));active--;return result();};
 const bridge=await serveOperatorSocket(path,hello,runner);
 try{const request={kind:'read',readerSha256:sha,request:{operation:'protocol',scope:zero}};
  const values=await Promise.all([operatorSocketExchange(path,request),operatorSocketExchange(path,request)]);
  expect(values).toHaveLength(2);expect(peak).toBe(1);expect(calls).toBe(2);
 }finally{await bridge.close();}
 let refusals=0;const held=await serveOperatorSocket(path,hello,async()=>{refusals++;throw Error('source_login_challenge');});
 try{const request={kind:'read',readerSha256:sha,request:{operation:'protocol',scope:zero}};
  expect(await operatorSocketExchange(path,request)).toEqual({status:'blocked',code:'source_login_challenge'});
  expect(await operatorSocketExchange(path,request)).toEqual({status:'blocked',code:'native_pool_authentication_requires_new_input'});expect(refusals).toBe(1);
 }finally{await held.close();}
}));

test('one-shot socket transport bounds timeout and output, and cleanup preserves replaced foreign files',async()=>temporary(async(_directory,path)=>{
 const malicious=createServer(client=>client.on('data',()=>client.end('x'.repeat(2*1024*1024+1))));
 await new Promise<void>(resolve=>malicious.listen(path,resolve));await chmod(path,0o600);
 try{await expect(operatorSocketExchange(path,{kind:'hello',readerSha256:sha})).rejects.toThrow('operator_reply_size_limit');}
 finally{await new Promise<void>(resolve=>malicious.close(()=>resolve()));}
 const silent=createServer(client=>client.on('data',()=>{}));await new Promise<void>(resolve=>silent.listen(path,resolve));await chmod(path,0o600);
 try{await expect(operatorSocketExchange(path,{kind:'hello',readerSha256:sha},20)).rejects.toThrow('operator_socket_timeout');}
 finally{await new Promise<void>(resolve=>silent.close(()=>resolve()));}
 const bridge=await serveOperatorSocket(path,hello,async()=>result());await unlink(path);await writeFile(path,'foreign-file',{mode:0o600});await bridge.close();
 expect(await readFile(path,'utf8')).toBe('foreign-file');
}));

test('abandoned queued clients cannot trigger later native credential reads',async()=>temporary(async(_directory,path)=>{
 let calls=0,started!:()=>void,release!:()=>void;const entered=new Promise<void>(resolve=>started=resolve),gate=new Promise<void>(resolve=>release=resolve);
 const bridge=await serveOperatorSocket(path,hello,async()=>{calls++;started();await gate;return result();});
 const message={kind:'read',readerSha256:sha,request:{operation:'protocol',scope:zero}};
 const first=operatorSocketExchange(path,message);await entered;
 const abandoned=connect(path);await new Promise<void>(resolve=>abandoned.once('connect',()=>{abandoned.write(JSON.stringify(message)+'\n');resolve();}));
 await new Promise(resolve=>setTimeout(resolve,10));abandoned.destroy();await new Promise(resolve=>setTimeout(resolve,10));release();
 try{await first;await new Promise(resolve=>setTimeout(resolve,10));expect(calls).toBe(1);}finally{release();abandoned.destroy();await bridge.close();}
}));

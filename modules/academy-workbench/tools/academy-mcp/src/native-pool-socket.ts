import {connect,createServer,type Socket} from 'node:net';
import {lstat,realpath,chmod,unlink,link} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {dirname,isAbsolute,normalize} from 'node:path';
import {z} from 'zod';
import {NativePoolLabelBackend,serializePoolReadRunner,type PoolReadRunner} from './native-pool-backend.ts';

export const operatorHash=z.string().regex(/^[a-f0-9]{64}$/);
const integer=z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const operatorReadRequest=z.object({operation:z.enum(['protocol','categories','labels','questions']),
  scope:z.object({cl1:integer,cl2:integer,cl3:integer,cl4:integer}).strict(),expectedSelectorSha256:operatorHash.optional(),
  patNo:z.string().regex(/^[1-9][0-9]{0,15}$/).optional(),page:z.number().int().min(1).max(100000).optional(),
  limit:z.number().int().min(1).max(50).optional(),offset:z.number().int().min(0).max(49).optional(),
}).strict().superRefine((v,c)=>{
  const s=v.scope;if(!s.cl1&&(s.cl2||s.cl3||s.cl4)||!s.cl2&&(s.cl3||s.cl4)||!s.cl3&&s.cl4)c.addIssue({code:'custom',message:'scope_gap'});
  if(v.operation==='protocol'&&Object.values(s).some(Boolean)||['labels','questions'].includes(v.operation)&&!s.cl3)c.addIssue({code:'custom',message:'scope_required'});
  if(v.operation==='questions'?v.patNo===undefined||v.page===undefined||v.limit===undefined:['patNo','page','limit','offset'].some(key=>key in v))c.addIssue({code:'custom',message:'question_fields_invalid'});
});
const metadataText=z.string().max(4096);
export const operatorHello=z.object({status:z.literal('ready'),schemaVersion:z.literal('academy.native-pool-operator.hello/1'),readerSha256:operatorHash,
  metadata:z.object({host:z.object({hostname:metadataText,uid:integer,home:metadataText}).strict(),
    container:z.object({id:operatorHash,name:z.literal('hermes-agent-2q3y-hermes-serve-1'),image:metadataText,imageId:metadataText,pid:integer,
      mounts:z.array(z.object({type:metadataText,source:metadataText,destination:metadataText,readWrite:z.boolean()}).strict()).max(128)}).strict(),
    native:z.object({uid:z.literal(10000),gid:integer,home:z.literal('/opt/data'),hermesHome:z.literal('/opt/data/profiles/dc-gang-a-dev'),
      cwd:metadataText,bunPath:metadataText,bunVersion:metadataText}).strict()}).strict(),
}).strict();
const wireRequest=z.discriminatedUnion('kind',[
  z.object({kind:z.literal('hello'),readerSha256:operatorHash}).strict(),
  z.object({kind:z.literal('read'),readerSha256:operatorHash,request:operatorReadRequest}).strict(),
]);
const observed=z.object({status:z.literal('observed'),page:z.unknown(),requests:integer,academyWrites:z.literal(0),passwordExported:z.literal(false),cookiesExported:z.literal(false)}).passthrough();
const safeCode=(error:unknown)=>error instanceof Error&&/^[a-z_]{1,100}$/.test(error.message)?error.message:'operator_transport_failed';
const maxRequest=16*1024,maxReply=2*1024*1024;

export function validateOperatorSocketPath(path:string){
  if(!isAbsolute(path)||normalize(path)!==path||Buffer.byteLength(path)>103||path.includes('\0'))throw Error('operator_socket_path_invalid');
}
export async function assertPrivateOperatorPath(path:string,socketRequired=true){
  validateOperatorSocketPath(path);
  const uid=process.getuid?.();if(uid===undefined)throw Error('operator_unix_uid_required');
  const parent=await lstat(dirname(path));
  if(!parent.isDirectory()||parent.isSymbolicLink()||parent.uid!==uid||(parent.mode&0o777)!==0o700||await realpath(dirname(path))!==dirname(path))throw Error('operator_socket_parent_not_private');
  if(!socketRequired)return;
  const info=await lstat(path);
  if(!info.isSocket()||info.isSymbolicLink()||info.uid!==uid||(info.mode&0o777)!==0o600||await realpath(path)!==path)throw Error('operator_socket_not_private');
  return info;
}

export async function operatorSocketExchange(path:string,message:unknown,timeoutMs=120000):Promise<unknown>{
  const before=await assertPrivateOperatorPath(path),wire=JSON.stringify(wireRequest.parse(message))+'\n';
  if(Buffer.byteLength(wire)>maxRequest)throw Error('operator_request_size_limit');
  return new Promise((resolve,reject)=>{
    const client=connect(path);let buffer=Buffer.alloc(0),done=false;
    const finish=(error?:Error,value?:unknown)=>{if(done)return;done=true;clearTimeout(timer);client.destroy();error?reject(error):resolve(value);};
    const timer=setTimeout(()=>finish(Error('operator_socket_timeout')),timeoutMs);
    client.on('connect',()=>{void (async()=>{
      const after=await assertPrivateOperatorPath(path);if(before!.dev!==after!.dev||before!.ino!==after!.ino)throw Error('operator_socket_identity_changed');
      client.write(wire);
    })().catch(()=>finish(Error('operator_socket_identity_changed')));});
    client.on('data',chunk=>{
      buffer=Buffer.concat([buffer,Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk)]);if(buffer.length>maxReply)return finish(Error('operator_reply_size_limit'));
      const end=buffer.indexOf(10);if(end<0)return;
      if(buffer.subarray(end+1).toString().trim())return finish(Error('operator_reply_frame_invalid'));
      try{finish(undefined,JSON.parse(buffer.subarray(0,end).toString('utf8')));}catch{finish(Error('operator_reply_invalid'));}
    });
    client.on('error',()=>finish(Error('operator_socket_unavailable')));client.on('close',()=>{if(!done)finish(Error('operator_socket_closed'));});
  });
}

/** Explicit private bind only; one strict NDJSON request per connection, no command forwarding. */
export async function serveOperatorSocket(path:string,helloInput:unknown,runner:PoolReadRunner){
  await assertPrivateOperatorPath(path,false);const hello=operatorHello.parse(helloInput),clients=new Set<Socket>();
  try{await lstat(path);throw Error('operator_socket_already_exists');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  let queued=0,tail=Promise.resolve();const run=serializePoolReadRunner(runner);
  const server=createServer(client=>{
    if(clients.size>=16){client.destroy();return;}clients.add(client);let data=Buffer.alloc(0),received=false;
    const idle=setTimeout(()=>client.destroy(),5000);client.on('error',()=>{});client.on('close',()=>{clearTimeout(idle);clients.delete(client);});
    const reply=(value:unknown)=>{const line=JSON.stringify(value)+'\n';client.end(Buffer.byteLength(line)<=maxReply?line:'{"status":"blocked","code":"operator_reply_size_limit"}\n');};
    client.on('data',chunk=>{
      if(received){client.destroy();return;}data=Buffer.concat([data,Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk)]);if(data.length>maxRequest){client.destroy();return;}
      const end=data.indexOf(10);if(end<0)return;received=true;clearTimeout(idle);
      let input:z.infer<typeof wireRequest>;
      try{if(data.subarray(end+1).toString().trim())throw Error();input=wireRequest.parse(JSON.parse(data.subarray(0,end).toString('utf8')));}
      catch{reply({status:'blocked',code:'operator_request_invalid'});return;}
      if(input.readerSha256!==hello.readerSha256){reply({status:'blocked',code:'operator_reader_identity_mismatch'});return;}
      if(input.kind==='hello'){reply(hello);return;}
      if(queued>=16){reply({status:'blocked',code:'operator_queue_limit'});return;}queued++;
      tail=tail.then(async()=>{try{if(!client.destroyed)reply(observed.parse(await run(input.request)));}catch(error){reply({status:'blocked',code:safeCode(error)});}finally{queued--;}});
    });
  });
  // libuv unlinks its bind pathname on close. Publish a hardlink so that automatic cleanup
  // cannot remove a replacement at the user-selected path before our inode guard runs.
  const privatePath=dirname(path)+'/.o-'+randomBytes(6).toString('hex');validateOperatorSocketPath(privatePath);
  let owned:Awaited<ReturnType<typeof lstat>>|undefined,closed=false;
  const close=async()=>{if(closed)return;closed=true;for(const client of clients)client.destroy();
    if(server.listening)await new Promise<void>(resolve=>server.close(()=>resolve()));
    for(const candidate of [path,privatePath])try{const current=await lstat(candidate);
      if(owned&&current.dev===owned.dev&&current.ino===owned.ino&&current.uid===process.getuid?.())await unlink(candidate);
    }catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  };
  try{
    await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(privatePath,()=>{server.removeListener('error',reject);resolve();});});
    owned=await lstat(privatePath);await chmod(privatePath,0o600);await assertPrivateOperatorPath(privatePath);
    await link(privatePath,path);const published=await assertPrivateOperatorPath(path);
    if(published!.dev!==owned.dev||published!.ino!==owned.ino)throw Error('operator_socket_identity_changed');
    return {close};
  }catch(error){await close();throw error;}
}

export async function loadOperatorPoolBackend(args:readonly string[]){
  if(args.length!==4||args[0]!=='--operator-socket'||args[2]!=='--reader-sha256')throw Error('operator_socket_arguments_invalid');
  const sha=operatorHash.parse(args[3]),path=args[1];validateOperatorSocketPath(path);
  let bound:Awaited<ReturnType<typeof assertPrivateOperatorPath>>;
  const handshake=async()=>{
    let current:Awaited<ReturnType<typeof assertPrivateOperatorPath>>;
    try{current=await assertPrivateOperatorPath(path);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')throw Error('operator_required');throw error;}
    if(bound){if(bound.dev!==current!.dev||bound.ino!==current!.ino)throw Error('operator_socket_identity_changed');return;}
    const reply=await operatorSocketExchange(path,{kind:'hello',readerSha256:sha},10000) as Record<string,unknown>;
    if(reply.status==='blocked')throw Error(typeof reply.code==='string'&&/^[a-z_]{1,100}$/.test(reply.code)?reply.code:'operator_hello_invalid');
    const parsed=operatorHello.safeParse(reply);if(!parsed.success)throw Error('operator_hello_invalid');
    if(parsed.data.readerSha256!==sha)throw Error('operator_reader_identity_mismatch');bound=current;
  };
  const runner:PoolReadRunner=async request=>{
    await handshake();
    const result=await operatorSocketExchange(path,{kind:'read',readerSha256:sha,request:operatorReadRequest.parse(request)});
    const refusal=z.object({status:z.literal('blocked'),code:z.string().regex(/^[a-z_]{1,100}$/)}).safeParse(result);
    if(refusal.success)throw Error(refusal.data.code);
    return observed.parse(result);
  };
  return new NativePoolLabelBackend(serializePoolReadRunner(runner));
}

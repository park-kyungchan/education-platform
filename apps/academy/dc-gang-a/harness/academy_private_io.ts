import {constants,openSync,closeSync,fstatSync,readSync,realpathSync,writeSync,ftruncateSync,fsyncSync,lstatSync,unlinkSync} from 'node:fs';
import {dirname,relative,resolve,isAbsolute,basename} from 'node:path';
export function privateJsonPath(home:string,path:string){
 const target=resolve(path),parent=realpathSync(dirname(target));
 if(parent!==dirname(target)||!target.endsWith('.json')||/^(auth|config|credentials)\./i.test(basename(target)))throw Error('private_json_path_required');
 if(!['artifacts','cache/scratch'].some(folder=>{const rel=relative(resolve(home,folder),parent);return rel===''||(!rel.startsWith('..')&&!isAbsolute(rel));}))throw Error('private_json_path_required');
 return target;
}
function checkDescriptor(fd:number,target:string){
 const stat=fstatSync(fd);let actual:string;try{actual=realpathSync('/proc/self/fd/'+fd);}catch{throw Error('private_json_target_changed');}
 if(!stat.isFile()||stat.nlink!==1||actual!==target||(stat.mode&0o077)!==0||stat.uid!==process.getuid?.())throw Error('private_json_target_changed');
 return stat;
}
export function readPrivateJsonText(home:string,path:string,identity?:string){
 const target=privateJsonPath(home,path),fd=openSync(target,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{
  const stat=checkDescriptor(fd,target);
  if(identity!==undefined&&stat.dev+':'+stat.ino!==identity)throw Error('private_json_target_changed');
  if(stat.size>131072)throw Error('private_json_input_too_large');
  // Bound the actual read too, including growth after fstat.
  const buffer=Buffer.alloc(131073);let size=0,bytes=0;
  while(size<buffer.length&&(bytes=readSync(fd,buffer,size,buffer.length-size,size))>0)size+=bytes;
  if(size>131072)throw Error('private_json_input_too_large');
  checkDescriptor(fd,target);return buffer.subarray(0,size).toString('utf8');
 }finally{closeSync(fd);}
}
/** Keep the exclusive descriptor: no reopening/truncating an attacker-replaced pathname. */
function privateWriter(fd:number,target:string,maxBytes:number){
 if(maxBytes!==Infinity&&(!Number.isSafeInteger(maxBytes)||maxBytes<1))throw Error('private_json_limit_required');
 const original=checkDescriptor(fd,target),identity=original.dev+':'+original.ino;let closed=false;
 const close=()=>{if(!closed){closed=true;closeSync(fd);}};
 return {path:target,identity,write:(value:unknown)=>{
   if(closed)throw Error('private_json_descriptor_closed');checkDescriptor(fd,target);
   const buffer=Buffer.from(JSON.stringify(value,null,2)+'\n');if(buffer.length>maxBytes)throw Error('private_json_output_too_large');let offset=0;
   while(offset<buffer.length)offset+=writeSync(fd,buffer,offset,buffer.length-offset,offset);
   ftruncateSync(fd,buffer.length);fsyncSync(fd);checkDescriptor(fd,target);
 },close,cleanup:()=>{
   try{
    if(closed)return;
    const actual=lstatSync(target);
    if(actual.isFile()&&!actual.isSymbolicLink()&&actual.nlink===1&&actual.dev===original.dev&&actual.ino===original.ino&&actual.uid===original.uid)unlinkSync(target);
   }catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}finally{close();}
 }};
}
export function reservePrivateJson(home:string,path:string,maxBytes=Infinity){
 if(maxBytes!==Infinity&&(!Number.isSafeInteger(maxBytes)||maxBytes<1))throw Error('private_json_limit_required');
 const target=privateJsonPath(home,path),fd=openSync(target,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
 try{return privateWriter(fd,target,maxBytes);}catch(error){closeSync(fd);throw error;}
}
/** A replacement fence, never a credential or permission grant. */
export function openOwnedPrivateJson(home:string,path:string,identity:string,maxBytes:number){
 if(!/^\d+:\d+$/.test(identity))throw Error('private_json_identity_required');
 const target=privateJsonPath(home,path),fd=openSync(target,constants.O_WRONLY|constants.O_NOFOLLOW);
 try{
  const stat=checkDescriptor(fd,target);if(stat.dev+':'+stat.ino!==identity)throw Error('private_json_target_changed');
  return privateWriter(fd,target,maxBytes);
 }catch(error){closeSync(fd);throw error;}
}

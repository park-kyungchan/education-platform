import {constants} from 'node:fs';
import {open,realpath,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {isAbsolute,join} from 'node:path';
import {z} from 'zod';
import {readPinnedLocalBytes} from './item-label-store.ts';
import {ownerAdmissionSchema} from './owner-admission.ts';

const pin=z.object({path:z.string().refine(isAbsolute),sha256:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
const releaseSchema=z.object({schemaVersion:z.literal('academy.mcp-release/1'),generation:z.string().regex(/^[a-zA-Z0-9._-]{1,64}$/),
  routing:pin,endpoints:pin,registry:pin}).strict();
const routingSchema=z.object({admissionPath:z.string().refine(isAbsolute),admissionSha256:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
const registrySchema=z.array(z.object({endpoint:z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
  upstreamName:z.string().regex(/^[a-z][a-z0-9_]{0,127}$/),
  tool:z.object({name:z.string().regex(/^[a-z][a-z0-9_]{0,127}$/)}).passthrough()}).strict()).max(256);

/** Read the owner-controlled pointer as one bounded regular file. A release is
 * activated by atomically replacing this pointer after all pinned files exist. */
async function readPointer(base:string):Promise<Buffer|null>{
  if(!isAbsolute(base)||await realpath(base)!==base)throw Error('release_base_unqualified');
  const directory=await stat(base),uid=process.getuid?.();
  if(!directory.isDirectory()||(directory.mode&0o022)!==0||(uid!==undefined&&directory.uid!==uid))throw Error('release_base_unqualified');
  let file;
  try{file=await open(join(base,'release.json'),constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);}
  catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error;}
  try{
    const before=await file.stat({bigint:true});
    if(!before.isFile()||before.nlink!==1n||before.size>65536n||(before.mode&0o022n)!==0n||(uid!==undefined&&before.uid!==BigInt(uid)))throw Error('release_pointer_unqualified');
    const data=Buffer.alloc(Number(before.size)+1),{bytesRead}=await file.read(data,0,data.length,0),after=await file.stat({bigint:true});
    if(BigInt(bytesRead)!==before.size||before.ino!==after.ino||before.size!==after.size||before.mtimeNs!==after.mtimeNs||before.ctimeNs!==after.ctimeNs)
      throw Error('release_pointer_changed');
    return data.subarray(0,bytesRead);
  }finally{await file.close();}
}

export async function loadRuntimeRelease(base:string){
  const pointer=await readPointer(base);if(pointer===null)return null;
  const release=releaseSchema.parse(JSON.parse(pointer.toString('utf8')));
  const read=async(ref:z.infer<typeof pin>)=>JSON.parse((await readPinnedLocalBytes(ref.path,ref.sha256)).bytes.toString('utf8'));
  const [rawRouting,endpoints,rawRegistry]=await Promise.all([read(release.routing),read(release.endpoints),read(release.registry)]);
  const routing=routingSchema.parse(rawRouting);
  const admission=ownerAdmissionSchema.parse(JSON.parse((await readPinnedLocalBytes(routing.admissionPath,routing.admissionSha256)).bytes.toString('utf8')));
  const registry=registrySchema.parse(rawRegistry);
  if(!endpoints||typeof endpoints!=='object'||Array.isArray(endpoints)||new Set(registry.map(r=>r.tool.name)).size!==registry.length
    ||registry.some(r=>!Object.hasOwn(endpoints,r.endpoint)))throw Error('release_payload_unqualified');
  const after=await readPointer(base);
  if(after===null||createHash('sha256').update(pointer).digest('hex')!==createHash('sha256').update(after).digest('hex'))throw Error('release_pointer_changed');
  return {generation:release.generation,admission,endpoints,registry};
}

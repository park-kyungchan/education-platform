import {open,realpath} from 'node:fs/promises';
import {constants} from 'node:fs';
import {isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {ItemLabelIndex} from './item-labels.ts';

/** Explicit owner-selected read-only input. No default path, discovery, source acquisition or credential access. */
export async function loadItemLabelIndex(args:readonly string[]):Promise<ItemLabelIndex|null> {
  if(!args.length)return null;
  if(args.length!==4||args[0]!=='--label-snapshot'||args[2]!=='--label-sha256'
    ||!isAbsolute(args[1])||!/^[a-f0-9]{64}$/.test(args[3]))throw Error('label_snapshot_arguments_invalid');
  const {bytes,sha256}=await readPinnedLocalBytes(args[1],args[3]);
  return new ItemLabelIndex(JSON.parse(bytes.toString('utf8')),sha256);
}

/** Shared bounded immutable local-input boundary for snapshots and explicit native reader configuration. */
export async function readPinnedLocalBytes(path:string,expectedSha256:string) {
  if(!isAbsolute(path)||!/^[a-f0-9]{64}$/.test(expectedSha256))throw Error('label_snapshot_arguments_invalid');
  if(await realpath(path)!==path)throw Error('label_snapshot_symlink_or_noncanonical_path');
  const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  try {
    const before=await file.stat({bigint:true});
    if(!before.isFile()||before.size>4n*1024n*1024n)throw Error('label_snapshot_file_invalid');
    // Bounded descriptor read, even if another owner grows the file after fstat.
    const bytes=Buffer.alloc(Number(before.size)+1),{bytesRead}=await file.read(bytes,0,bytes.length,0);
    const after=await file.stat({bigint:true});
    if(BigInt(bytesRead)!==before.size||after.size!==before.size||after.mtimeNs!==before.mtimeNs||after.ctimeNs!==before.ctimeNs)throw Error('label_snapshot_changed_during_read');
    const content=bytes.subarray(0,bytesRead),sha=createHash('sha256').update(content).digest('hex');
    if(sha!==expectedSha256)throw Error('label_snapshot_hash_mismatch');
    return {bytes:content,sha256:sha};
  } finally {await file.close();}
}

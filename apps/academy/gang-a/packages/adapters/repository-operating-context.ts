import {OperatingManifest} from '../schema/academy-operating-context.ts';
import {OperationalRevision} from '../domain/operational-context.ts';
import {validateOperationalContext} from '../application/validate-operational-context.ts';
import {deepFreeze} from '../audit/event-log.ts';

/** The caller supplies a trusted manifest byte pin. A source locator cannot authorize its own load. */
export async function loadRepositoryOperatingContext(expectedManifestSha256:unknown){
 const expected=OperationalRevision.parse(expectedManifestSha256),manifestBytes=await Bun.file(new URL('../../context/academy/manifest.json',import.meta.url)).bytes();
 if(new Bun.CryptoHasher('sha256').update(manifestBytes).digest('hex')!==expected)throw Error('operational_manifest_byte_pin_mismatch');
 const manifest=OperatingManifest.parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(manifestBytes))),file=manifest.files[0];
 const bytes=await Bun.file(new URL('../../context/academy/checkpoint.json',import.meta.url)).bytes(),sha256=new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
 if(bytes.length!==file.bytes||sha256!==file.sha256)throw Error('operational_context_byte_pin_mismatch');
 const context=validateOperationalContext(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)),manifest);
 return deepFreeze({manifest,context,revision:OperationalRevision.parse(sha256),manifestRevision:expected});
}

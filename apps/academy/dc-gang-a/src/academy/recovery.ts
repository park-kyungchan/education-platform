import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { canonicalJson } from '../learning/model';
const magic=Buffer.from('DCAIP1');
/** Authenticated encrypted portable JSON. A local file/key is not an independent failure domain. */
export function encryptRecovery(value:unknown,key:Uint8Array):Uint8Array {
  if(key.byteLength!==32)throw Error('recovery_key_size');
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
  const ciphertext=Buffer.concat([cipher.update(canonicalJson(value),'utf8'),cipher.final()]);
  return Buffer.concat([magic,iv,cipher.getAuthTag(),ciphertext]);
}
export function decryptRecovery(data:Uint8Array,key:Uint8Array):unknown {
  if(key.byteLength!==32||data.byteLength<magic.length+28)throw Error('invalid_recovery_bundle');
  const buffer=Buffer.from(data);if(!buffer.subarray(0,magic.length).equals(magic))throw Error('unknown_recovery_format');
  const iv=buffer.subarray(magic.length,magic.length+12),tag=buffer.subarray(magic.length+12,magic.length+28);
  const cipher=createDecipheriv('aes-256-gcm',key,iv);cipher.setAuthTag(tag);
  const plaintext=Buffer.concat([cipher.update(buffer.subarray(magic.length+28)),cipher.final()]).toString('utf8');
  const value:unknown=JSON.parse(plaintext);if(canonicalJson(value)!==plaintext)throw Error('noncanonical_recovery_payload');return value;
}

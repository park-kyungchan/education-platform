import {z} from 'zod';

// Only the source-reference primitives are adapted. The deployed student
// Evidence/Decision contracts keep their existing versions and semantics.
export const Sha256=z.string().regex(/^[a-f0-9]{64}$/).brand<'Sha256'>();
export const Instant=z.string().datetime({offset:true}).brand<'Instant'>();
export const EvidenceActor=z.strictObject({kind:z.enum(['user','assistant','native_tool','system']),role:z.enum(['teacher','source_collector','reviewer','maintainer','unknown']),id:z.string().nullable()});
export const EvidenceSourceRef=z.strictObject({sourceMessageId:z.string().min(1).nullable().optional(),reference:z.string().min(1).nullable(),sha256:Sha256.nullable(),jsonPointer:z.string().nullable()});
export const sha256=async(bytes:Uint8Array):Promise<string>=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',Uint8Array.from(bytes).buffer))).map(value=>value.toString(16).padStart(2,'0')).join('');
export type DeepReadonly<T>=T extends string|number|boolean|bigint|symbol|null|undefined?T:T extends (...args:any[])=>any?T:T extends readonly (infer U)[]?readonly DeepReadonly<U>[]:T extends object?{readonly [K in keyof T]:DeepReadonly<T[K]>}:T;
export function deepFreeze<T>(value:T):DeepReadonly<T>{
 if(value!==null&&typeof value==='object'&&!Object.isFrozen(value)){
  for(const child of Object.values(value))deepFreeze(child);
  Object.freeze(value);
 }
 return value as DeepReadonly<T>;
}

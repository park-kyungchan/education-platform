/** Owner-supplied, non-secret technical metadata only; this does not qualify a native reader. */
export interface NativeReadBuildDescriptor {
  readonly sourceSetSha256?:string|null;
  /** Opaque owner-observed reference, never a path, credential or raw principal ID. */
  readonly serviceInstanceRef?:string|null;
}

export const nativeReadDescriptorMaxBytes=4096;
export const nativeMetadataOperationIdPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Copy data properties once so subsequent option mutation/accessors cannot affect output. */
export function snapshotNativeReadBuildDescriptor(value:unknown):Readonly<{
  sourceSetSha256:string|null;serviceInstanceRef:string|null;
}>{
  const invalid=()=>{throw Error('native_read_build_descriptor_invalid');};
  if(value===undefined)return Object.freeze({sourceSetSha256:null,serviceInstanceRef:null});
  if(!value||typeof value!=='object')return invalid();
  const prototype=Object.getPrototypeOf(value);
  if(prototype!==Object.prototype&&prototype!==null)return invalid();
  const result:{sourceSetSha256:string|null;serviceInstanceRef:string|null}={sourceSetSha256:null,serviceInstanceRef:null};
  for(const key of Reflect.ownKeys(value)){
    if(key!=='sourceSetSha256'&&key!=='serviceInstanceRef')return invalid();
    const property=Object.getOwnPropertyDescriptor(value,key);
    if(!property||!('value' in property))return invalid();
    const field:unknown=property.value;
    if(field===undefined||field===null)continue;
    if(typeof field!=='string')return invalid();
    if(key==='sourceSetSha256'){
      if(field.length!==64||/[^0-9a-f]/.test(field))return invalid();
    }else if(field.length<1||field.length>128||!/^[A-Za-z0-9]/.test(field)||/[^A-Za-z0-9_-]/.test(field))return invalid();
    result[key]=field;
  }
  return Object.freeze(result);
}

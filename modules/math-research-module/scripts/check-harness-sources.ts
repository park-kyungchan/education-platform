import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { moduleRoot, sha256 } from './agent-platform';
/** Join the domain crosswalk to actual canonical Artifact records, not ID-shaped mirrors. */
export async function validatePinnedHarnessSources(platform:any,options:{root?:string;pilotRoot?:string;bundle?:any}={}){
 const root=options.root??moduleRoot,pilotRoot=options.pilotRoot??resolve(root,'research/identity-pilot');
 const bundle=options.bundle??JSON.parse(await readFile(resolve(pilotRoot,'samples/research-bundle.json'),'utf8'));
 const checked=new Map<string,any[]>();const hashes=new Map<string,string>();
 for(const reference of bundle.harnessRecords){
  const path=resolve(pilotRoot,reference.sourcePath);
  if(!checked.has(path)){
   const bytes=await platform.readExact(path,root,platform.localContextIo);
   if(sha256(bytes)!==reference.sourceSha256)throw Error('Harness crosswalk source drift');
   const parsed=JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(bytes));
   if(!Array.isArray(parsed))throw Error('Expected canonical closed Artifact array');
   for(const record of parsed){const result=platform.validateArtifact(record);if(!result.valid)throw Error(`Canonical crosswalk Artifact rejected: ${record.id}: ${JSON.stringify(result.issues)}`);}
   const refs=platform.validateReferences(parsed);if(!refs.valid)throw Error('Canonical crosswalk reference closure rejected');
   checked.set(path,parsed);hashes.set(path,sha256(bytes));
  }
  if(hashes.get(path)!==reference.sourceSha256)throw Error('Conflicting crosswalk source hash');
  const records=checked.get(path)!;
  if(!records.some(r=>r.id===reference.id&&r.kind===reference.kind&&r.projectId===reference.projectId))throw Error('Crosswalk identity does not match a canonical source record');
 }
 return {snapshots:checked.size,links:bundle.harnessRecords.length};
}

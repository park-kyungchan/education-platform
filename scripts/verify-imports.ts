import {createHash} from 'node:crypto';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {projectRoot} from '../src/modules';
interface File {module:string;path:string;sha256:string;bytes:number}
export const IMPORT_ARCHIVE={path:'architecture/r07-u-archive.v1.json',sha256:'65318131c4b89df64387b35787098bc49f92ef5e1100cc9e19a4a2b4115e8367'} as const;
export function verifyImports(root=projectRoot){
 const manifest=JSON.parse(readFileSync(resolve(root,'provenance/imported-files.json'),'utf8')) as {files:File[]};
 const changes=JSON.parse(readFileSync(resolve(root,'provenance/adaptations.json'),'utf8')) as {files:{path:string;sourceSha256:string;integrationSha256:string}[]};
 const adaptations=new Map(changes.files.map(file=>[file.path,file])),moved=new Map<string,string>();
 const hash=(value:Uint8Array)=>createHash('sha256').update(value).digest('hex'),fail=(code:string,path=''):never=>{throw Error(code+'@scripts/verify-imports.ts:1'+(path?' '+path:''));};
 if(existsSync(resolve(root,IMPORT_ARCHIVE.path))){
  const bytes=readFileSync(resolve(root,IMPORT_ARCHIVE.path));if(hash(bytes)!==IMPORT_ARCHIVE.sha256)fail('archive_import_manifest_stale');
  const archive=JSON.parse(bytes.toString()) as {entries:{from:string;to:string}[]};for(const pair of archive.entries)moved.set(pair.from,pair.to);
 }
 let unchanged=0,archived=0;
 for(const file of manifest.files){
  const p=file.module+'/'+file.path,relocated=moved.get(p),adaptation=adaptations.get(p),path=resolve(root,relocated??p);
  if(relocated&&(existsSync(resolve(root,p))||adaptation))fail('archive_import_original_conflict',p);
  if(!existsSync(path))fail('missing_import',p);const actual=hash(readFileSync(path));
  if(adaptation){if(adaptation.sourceSha256!==file.sha256||actual!==adaptation.integrationSha256)fail('adaptation_hash_mismatch',p);continue;}
  if(actual!==file.sha256)fail('import_hash_mismatch',p);unchanged++;if(relocated)archived++;
 }
 return {scope:'imported-code-spec-bytes',unchanged,archived,explicitAdaptations:[...adaptations.keys()],originalCustody:'external-private-bundles-and-source-tars'};
}
if(import.meta.main)console.log(JSON.stringify(verifyImports()));

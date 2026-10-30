import {readFileSync,lstatSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {validatePrivateStudentPackage} from '../apps/academy/dc-gang-a/harness/private-student-context/validate';

const root=resolve(import.meta.dir,'..');
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
function read(path:string){
 if(!path||path.includes('\\')||path.split('/').some(p=>!p||p==='.'||p==='..')||resolve(root,path)===root||!resolve(root,path).startsWith(root+sep))throw Error('integration_path_escape');
 let current=root;for(const part of path.split('/')){current=resolve(current,part);if(lstatSync(current).isSymbolicLink())throw Error('integration_symlink_rejected');}
 if(!lstatSync(current).isFile())throw Error('integration_regular_file_required');return readFileSync(current);
}
type Entry={path:string;sourcePath:string;sourceGitBlob:string;sha256:string;bytes:number;mode:string};
// An adaptation names the original it diverges from and why; its current bytes are tracked by Git and PR review.
type Adaptation={path:string;sourceSha256:string;reason:string};
const imported=JSON.parse(read('provenance/academy-source-integration.json').toString()) as {modules:{repository:string;destinationRoot:string;entries:Entry[]}[];helpers:{path:string;sha256:string}[];adaptations:Adaptation[]};
const adaptations=new Map<string,Adaptation>();
for(const item of imported.adaptations){if(adaptations.has(item.path)||!item.reason.trim())throw Error('invalid_integration_adaptation');adaptations.set(item.path,item);}
const seen=new Set<string>();let unchanged=0,adapted=0;
for(const module of imported.modules)for(const entry of module.entries){
 if(seen.has(entry.path)||entry.path!==module.destinationRoot+'/'+entry.sourcePath)throw Error('integration_source_path_mismatch');seen.add(entry.path);
 const bytes=read(entry.path),adaptation=adaptations.get(entry.path);
 if(adaptation){if(adaptation.sourceSha256!==entry.sha256)throw Error('integration_adaptation_source_mismatch');adapted++;}
 else{if(bytes.length!==entry.bytes||hash(bytes)!==entry.sha256)throw Error('integration_original_hash_mismatch');unchanged++;}
}
for(const path of adaptations.keys())if(!seen.has(path))throw Error('integration_adaptation_without_original');
for(const entry of imported.helpers)if(hash(read(entry.path))!==entry.sha256)throw Error('integration_helper_source_drift');
const privateContext=JSON.parse(read('provenance/private-context-integration.json').toString());
// These are historical admission fields. Current visibility is recorded separately
// in architecture/repository-visibility-policy.json; this check preserves evidence.
if(privateContext.targetRepository!=='park-kyungchan/education-platform'||privateContext.visibilityRequired!=='private'||privateContext.rootOctober23OperationalOutputsIncluded!==false||privateContext.nativeStoresIncluded!==false||privateContext.publicAssetUseAllowed!==false)throw Error('private_context_boundary_drift');
let privateFiles=0;
for(const pkg of privateContext.packages){
 if(pkg.proposedDestinationRoot!=='context/private-students/'+pkg.packageId||hash(read(pkg.proposedDestinationRoot+'/manifest.json'))!==pkg.manifestSha256)throw Error('private_context_manifest_drift');
 const result=validatePrivateStudentPackage(resolve(root,pkg.proposedDestinationRoot));
 if(result.artifactCount+1!==pkg.fileCount)throw Error('private_context_file_count_mismatch');privateFiles+=pkg.fileCount;
}
if(privateContext.additionalPrivatePackagesAdmitted!==true||privateContext.additionalCustody?.totalFiles!==246)throw Error('additional_private_admission_required');
let additionalFiles=0;
for(const group of privateContext.additionalCustody.groups){
 if(!group.destinationRoot.startsWith('modules/academy-workbench/')||group.destinationRoot!=='modules/academy-workbench/'+group.sourceRoot)throw Error('additional_private_scope_mismatch');
 const entries=imported.modules.flatMap(m=>m.entries).filter(e=>e.path.startsWith(group.destinationRoot+'/'));
 if(entries.length!==group.fileCount||entries.reduce((n,e)=>n+e.bytes,0)!==group.bytes)throw Error('additional_private_coverage_mismatch');additionalFiles+=entries.length;
}
if(additionalFiles!==246)throw Error('additional_private_denominator_mismatch');
console.log(JSON.stringify({status:'pass',scope:'imported-source-and-approved-private-package-integrity',unchanged,adapted,privateFiles:privateFiles+additionalFiles,studentBodiesEmitted:false,nativeEffects:0,teacherAcceptance:false}));

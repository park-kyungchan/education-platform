import {readFileSync,lstatSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {validateDataset} from '../vendor/runtime-contracts.ts';
import {sha} from './adapter.ts';
const dir=process.argv[2];
if(!dir||process.argv.length!==3)throw Error('Usage: node src/verify-output.ts PRIVATE_OUTPUT_DIRECTORY');
const root=resolve(dir);
if(lstatSync(root).isSymbolicLink())throw Error('output_symlink_rejected');
function safeRead(path:string){
 if(path.startsWith('/')||path.split('/').some(p=>p==='..'||p===''))throw Error('unsafe_output_path');
 let current=root;for(const part of path.split('/')){current=join(current,part);if(lstatSync(current).isSymbolicLink())throw Error('output_symlink_rejected');}
 const stat=lstatSync(current);if(!stat.isFile()||stat.size>100*1024*1024)throw Error('output_file_limit');return readFileSync(current);
}
const bytes=safeRead('private-dataset.json'),dataset:unknown=JSON.parse(bytes.toString('utf8'));validateDataset(dataset);
if(dataset.mode!=='private'||dataset.projections.length!==0||dataset.records.some(r=>!r.kind.startsWith('preserved_')))throw Error('preservation_only_boundary');
const report=JSON.parse(safeRead('mapping-report.json').toString('utf8'));if(sha(bytes)!==report.envelopeSha256)throw Error('envelope_hash_mismatch');
for(const a of dataset.artifacts){if(a.archivePath===null)throw Error('missing_archive_path');const b=safeRead(a.archivePath);if(b.length!==a.bytes||sha(b)!==a.sha256)throw Error('source_artifact_hash_mismatch');}
console.log(JSON.stringify({valid:true,mode:'private',students:dataset.students.length,records:dataset.records.length,artifactsVerified:dataset.artifacts.length,projections:0,databaseWritten:false,httpServerStarted:false,sourceIdentityIndependentlyVerified:false}));

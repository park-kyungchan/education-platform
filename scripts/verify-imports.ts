import {createHash} from 'node:crypto';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {projectRoot} from '../src/modules';
interface File {module:string;path:string;sha256:string;bytes:number}
const manifest=await Bun.file(resolve(projectRoot,'provenance/imported-files.json')).json() as {files:File[]};
const changes=await Bun.file(resolve(projectRoot,'provenance/adaptations.json')).json() as {files:{path:string;sourceSha256:string;integrationSha256:string}[]};
const adaptations=new Map(changes.files.map(file=>[file.path,file]));
let unchanged=0;for(const file of manifest.files){const p=file.module+'/'+file.path;const adaptation=adaptations.get(p);if(adaptation){if(adaptation.sourceSha256!==file.sha256||createHash('sha256').update(readFileSync(resolve(projectRoot,p))).digest('hex')!==adaptation.integrationSha256)throw Error('adaptation_hash_mismatch:'+p);continue;}const path=resolve(projectRoot,p);if(!existsSync(path))throw Error('missing_import:'+p);if(createHash('sha256').update(readFileSync(path)).digest('hex')!==file.sha256)throw Error('import_hash_mismatch:'+p);unchanged++;}
console.log(JSON.stringify({scope:'imported-code-spec-bytes',unchanged,explicitAdaptations:[...adaptations.keys()],originalCustody:'external-private-bundles-and-source-tars'}));

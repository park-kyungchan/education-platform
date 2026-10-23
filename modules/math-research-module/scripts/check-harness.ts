import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadPlatform, moduleRoot } from './agent-platform';
import { validatePinnedHarnessSources } from './check-harness-sources';
import { prepareContext } from './context-prepare';
const platform=await loadPlatform();
const records=JSON.parse(await readFile(resolve(moduleRoot,'harness/records.json'),'utf8'));
for(const record of records){const result=platform.validateArtifact(record);if(!result.valid)throw Error(`${record.id}: ${JSON.stringify(result.issues)}`);}
const references=platform.validateReferences(records);if(!references.valid)throw Error(JSON.stringify(references.issues));
const project=JSON.parse(await readFile(resolve(moduleRoot,'project.json'),'utf8'));
if(JSON.stringify(project)!==JSON.stringify(records.find((r:any)=>r.kind==='project')))throw Error('Project manifest mismatch');
const linked=await validatePinnedHarnessSources(platform);
const context=await prepareContext();
const bad=structuredClone(context.checkpoint); bad.nativePermissionGranted=true;
let rejected=false;try{platform.validateCheckpoint(bad);}catch{rejected=true;}
if(!rejected)throw Error('Canonical validator must reject native permission escalation');
const accepted=structuredClone(records.find((r:any)=>r.kind==='proposal'));
accepted.kind='decision';accepted.id='math-research-module:decision:unapproved-negative-fixture';accepted.payload={title:'Unapproved',status:'accepted',choice:'test',rationale:'must fail',evidenceRefs:[]};
if(platform.validateArtifact(accepted).valid)throw Error('Canonical validator must reject unscoped acceptance');
console.log(`PASS canonical Artifact validation (${records.length}), closed references and ${linked.snapshots} canonical crosswalk snapshots, module-owned Work checkpoint/request and two authority-negative probes; provider ${platform.source.commit} (${platform.source.mode}).`);

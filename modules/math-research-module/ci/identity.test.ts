import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkCiIdentity, validateCiIdentity } from './check-identity.ts';
const root=resolve(import.meta.dir,'..');
const read=(path:string)=>JSON.parse(readFileSync(resolve(root,path),'utf8'));
const values=()=>['harness/ci/identity.json','project.json','harness/ci/task.json','harness/ci/run.json'].map(read);
test('fresh CI implementation identity and repeated read-only execution identities',async()=>{
 const files=['harness/records.json','harness/work-context.json','harness/ci/run.json'];
 const before=files.map(p=>readFileSync(resolve(root,p),'utf8'));
 const a=await checkCiIdentity(),b=await checkCiIdentity();
 expect(a.executionId).not.toBe(b.executionId);
 expect(a.implementationRunId).not.toBe(read('harness/work-context.json').runRef);
 expect(files.map(p=>readFileSync(resolve(root,p),'utf8'))).toEqual(before);
});
for(const field of ['projectId','domainId','projectArtifactId','workId','taskId','runId'])test(`reject mismatched ${field}`,async()=>{
 const [i,p,t,r]=values();i[field]+='-wrong';await expect(validateCiIdentity(i,p,t,r)).rejects.toThrow();
});
for(const [field,value]of [['authority','execute'],['nativePermissionGranted',true],['globallyRegistered',true],['acceptanceDecisionObserved',true]] as const)test(`reject invented ${field}`,async()=>{
 const [i,p,t,r]=values();i[field]=value;await expect(validateCiIdentity(i,p,t,r)).rejects.toThrow();
});

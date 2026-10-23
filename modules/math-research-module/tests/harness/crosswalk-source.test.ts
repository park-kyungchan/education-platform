import { test, expect } from 'bun:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { loadPlatform, sha256 } from '../../scripts/agent-platform';
import { validatePinnedHarnessSources } from '../../scripts/check-harness-sources';
const api=await loadPlatform();
test('matching source hash and Artifact ID do not admit malformed canonical payload',async()=>{
 const root=await mkdtemp(resolve(tmpdir(),'math-invalid-artifact-'));try{
  const bad={schemaVersion:'1.0.0',kind:'project',id:'math-research-module:project:fixture',projectId:'math-research-module',domainId:'mathematics-education',createdAt:'2026-10-13T00:00:00Z',payload:{}};
  const bytes=JSON.stringify([bad]);await writeFile(resolve(root,'history.json'),bytes);
  const bundle={harnessRecords:[{id:bad.id,kind:bad.kind,projectId:bad.projectId,sourcePath:'history.json',sourceSha256:sha256(bytes)}]};
  await expect(validatePinnedHarnessSources(api,{root,pilotRoot:root,bundle})).rejects.toThrow('Canonical crosswalk Artifact rejected');
 }finally{await rm(root,{recursive:true});}
});
test('two references to one snapshot must agree on its exact source hash',async()=>{
 const root=await mkdtemp(resolve(tmpdir(),'math-conflicting-pin-'));try{
  const valid={schemaVersion:'1.0.0',kind:'project',id:'math-research-module:project:fixture',projectId:'math-research-module',domainId:'mathematics-education',createdAt:'2026-10-13T00:00:00Z',payload:{name:'fixture',status:'active',scope:'synthetic test',ontologyPackage:{name:'@palantirkc/ontology',version:'0.2.0'},commands:{check:'test'}}};
  const bytes=JSON.stringify([valid]);await writeFile(resolve(root,'history.json'),bytes);const reference={id:valid.id,kind:valid.kind,projectId:valid.projectId,sourcePath:'history.json',sourceSha256:sha256(bytes)};
  await expect(validatePinnedHarnessSources(api,{root,pilotRoot:root,bundle:{harnessRecords:[reference,{...reference,sourceSha256:'f'.repeat(64)}]}})).rejects.toThrow('Conflicting crosswalk source hash');
 }finally{await rm(root,{recursive:true});}
});

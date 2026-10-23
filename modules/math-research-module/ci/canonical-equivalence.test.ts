import { afterAll, expect, test } from 'bun:test';
import { readFile, writeFile, symlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { loadCanonicalProjection } from '../scripts/canonical-projection.ts';
import { materializeCanonicalTestFixture } from './materialize-canonical-fixture.ts';
const fixture=await materializeCanonicalTestFixture();afterAll(()=>fixture.cleanup());
const originalOntology=await import(pathToFileURL(resolve(fixture.root,'packages/ontology/src/validation.ts')).href);
const originalValidation=await import(pathToFileURL(resolve(fixture.root,'packages/work-continuity/src/context/validation.ts')).href);
const originalSource=await import(pathToFileURL(resolve(fixture.root,'packages/work-continuity/src/context/source.ts')).href);
const projected=await loadCanonicalProjection();
const root=resolve(import.meta.dir,'..');
test('compiled Artifact and reference results equal the exact immutable source oracle',async()=>{
 const records=JSON.parse(await readFile(resolve(root,'harness/records.json'),'utf8'));
 for(const record of records)expect(projected.validateArtifact(record)).toEqual(originalOntology.validateArtifact(record));
 expect(projected.validateReferences(records)).toEqual(originalOntology.validateReferences(records));
 expect(projected.validateArtifact({...records[0],kind:'work'})).toEqual(originalOntology.validateArtifact({...records[0],kind:'work'}));
});
const checkpoint={schema:'codex.continuity.checkpoint.v1',projectId:'fixture',workId:'fixture',root:fixture.root,owner:{agentId:'fixture',threadId:'fixture'},version:1,updatedAt:'2026-10-17T00:00:00Z',purpose:{objective:'Preserve synthetic source',successCriteria:['exact'],inScope:['fixture'],outOfScope:['native']},userDecisions:[],completed:[],pending:[],nextAction:{taskId:'next',action:'Read exact source'},nativeThreads:[],evidenceRefs:[],sourcePins:[],uncertainEffects:[],uninterpretedInputs:[],authority:'none',nativePermissionGranted:false};
const outcome=(fn:()=>unknown)=>{try{return {value:fn()};}catch(error){return {error:(error as Error).message};}};
test('compiled checkpoint and request guards preserve canonical positives and permission negatives',()=>{
 const request={schema:'codex.work-context.request.v1',projectId:'fixture',workId:'fixture',root:fixture.root,cwd:fixture.root,checkpointPath:resolve(fixture.root,'checkpoint.json'),checkpointSha256:'1'.repeat(64),maxChars:12000};
 for(const value of [checkpoint,{...checkpoint,nativePermissionGranted:true}])expect(outcome(()=>projected.validateCheckpoint(value))).toEqual(outcome(()=>originalValidation.validateCheckpoint(value)));
 for(const value of [request,{...request,maxChars:99999}])expect(outcome(()=>projected.validateWorkContextRequest(value))).toEqual(outcome(()=>originalValidation.validateWorkContextRequest(value)));
});
test('compiled source IO preserves actual bytes, drift status and symlink refusal',async()=>{
 const path=resolve(fixture.root,'source-fixture.json'),bytes='{"fixture":true}\n';await writeFile(path,bytes);
 const pin={path,sha256:createHash('sha256').update(bytes).digest('hex')};
 expect(Buffer.from(await projected.readExact(path,fixture.root,projected.localContextIo))).toEqual(Buffer.from(await originalSource.readExact(path,fixture.root,originalSource.localContextIo)));
 expect(await projected.checkSources([pin],fixture.root,projected.localContextIo)).toEqual(await originalSource.checkSources([pin],fixture.root,originalSource.localContextIo));
 await writeFile(path,'{"fixture":"drift"}\n');
 expect(await projected.checkSources([pin],fixture.root,projected.localContextIo)).toEqual(await originalSource.checkSources([pin],fixture.root,originalSource.localContextIo));
 const alias=resolve(fixture.root,'source-alias.json');await symlink(path,alias);
 await expect(projected.readExact(alias,fixture.root,projected.localContextIo)).rejects.toThrow('canonical');
 await expect(originalSource.readExact(alias,fixture.root,originalSource.localContextIo)).rejects.toThrow('canonical');
});

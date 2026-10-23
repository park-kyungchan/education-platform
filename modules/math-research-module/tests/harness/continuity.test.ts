import { test, expect } from 'bun:test';
import { mkdtemp, mkdir, readFile, writeFile, cp, rm, stat, symlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareContext } from '../../scripts/context-prepare';
import { moduleRoot, sha256 } from '../../scripts/agent-platform';
async function fixture() {
  await mkdir(resolve(moduleRoot,'.local/continuity-tests'),{recursive:true});
  const root=await mkdtemp(resolve(moduleRoot,'.local/continuity-tests/fixture-'));
  await cp(resolve(moduleRoot,'harness'),resolve(root,'harness'),{recursive:true});
  await cp(resolve(moduleRoot,'source/user-intent'),resolve(root,'source/user-intent'),{recursive:true});
  return root;
}
test('read-only verification does not create a checkpoint',async()=>{
 const root=await fixture();try{const result=await prepareContext({root});expect(result.persisted).toBe(false);expect(await stat(result.request.checkpointPath).then(()=>true,()=>false)).toBe(false);}finally{await rm(root,{recursive:true});}
});
test('completed effects survive repeat context checks byte for byte',async()=>{
 const root=await fixture();try{
  const initial=await prepareContext({root,initialize:true});
  const evidencePath=resolve(root,'synthetic-test-observation.json');const evidence=JSON.stringify({kind:'synthetic-test-evidence',notRealCompletion:true});await writeFile(evidencePath,evidence);
  const current=initial.checkpoint;current.version=7;const pin={path:evidencePath,sha256:sha256(evidence),role:'evidence'};
  current.sourcePins.push(pin);current.evidenceRefs.push({...pin,kind:'observation'});
  current.completed.push({id:'synthetic-test-only-completed',action:'A test fixture effect, never an external action',completedAt:'2026-10-13T23:00:00Z',verificationRefs:[evidencePath],replay:'do-not-repeat'});
  const before=JSON.stringify(current,null,2)+'\n';await writeFile(initial.request.checkpointPath,before);
  const again=await prepareContext({root,initialize:true});
  expect(again.checkpoint.version).toBe(7);expect(again.checkpoint.completed).toHaveLength(1);
  expect(await readFile(initial.request.checkpointPath,'utf8')).toBe(before);
 }finally{await rm(root,{recursive:true});}
});
test('one-byte user-answer drift fails without re-pinning',async()=>{
 const root=await fixture();try{
  const lock=JSON.parse(await readFile(resolve(root,'harness/user-intent.lock.json'),'utf8'));
  const path=resolve(root,lock.pins[0].relativePath);await writeFile(path,(await readFile(path,'utf8'))+'!');
  await expect(prepareContext({root,initialize:true})).rejects.toThrow('User-answer source drift');
 }finally{await rm(root,{recursive:true});}
});
test('an empty existing checkpoint fails without overwriting',async()=>{const root=await fixture();try{const initial=await prepareContext({root,initialize:true});await writeFile(initial.request.checkpointPath,'');await expect(prepareContext({root,initialize:true})).rejects.toThrow();expect(await readFile(initial.request.checkpointPath,'utf8')).toBe('');}finally{await rm(root,{recursive:true});}});
test('forged accepted answer with unchanged source pin is rejected',async()=>{const root=await fixture();try{const initial=await prepareContext({root,initialize:true});initial.checkpoint.userDecisions[0].answer='Forged permission';await writeFile(initial.request.checkpointPath,JSON.stringify(initial.checkpoint));await expect(prepareContext({root})).rejects.toThrow('differs from admitted original');}finally{await rm(root,{recursive:true});}});
test('a source labelled verification must contain a valid Verification Artifact',async()=>{const root=await fixture();try{const initial=await prepareContext({root,initialize:true});const path=resolve(root,'not-a-verification.json');const content='{}';await writeFile(path,content);initial.checkpoint.sourcePins.push({path,sha256:sha256(content),role:'evidence',recordKind:'verification'});await writeFile(initial.request.checkpointPath,JSON.stringify(initial.checkpoint));await expect(prepareContext({root})).rejects.toThrow('invalid-record');}finally{await rm(root,{recursive:true});}});
test('fresh request follows existing checkpoint hash without mutating it',async()=>{const root=await fixture();try{const first=await prepareContext({root,initialize:true});first.checkpoint.version=12;const bytes=JSON.stringify(first.checkpoint);await writeFile(first.request.checkpointPath,bytes);const next=await prepareContext({root});expect(next.request.checkpointSha256).toBe(sha256(bytes));expect(await readFile(first.request.checkpointPath,'utf8')).toBe(bytes);}finally{await rm(root,{recursive:true});}});
test('foreign project selection is rejected before checkpoint creation',async()=>{const root=await fixture();try{const p=resolve(root,'harness/work-context.json');const s=JSON.parse(await readFile(p,'utf8'));s.projectId='foreign-project';await writeFile(p,JSON.stringify(s));await expect(prepareContext({root,initialize:true})).rejects.toThrow('selection joins');}finally{await rm(root,{recursive:true});}});
test('selection cannot grant authority or unknown capabilities',async()=>{const root=await fixture();try{const p=resolve(root,'harness/work-context.json');const s=JSON.parse(await readFile(p,'utf8'));s.nativePermissionGranted=true;s.runAnything=true;await writeFile(p,JSON.stringify(s));await expect(prepareContext({root})).rejects.toThrow('selection authority or fields');}finally{await rm(root,{recursive:true});}});

test('initialization rejects a symlinked output directory before any external write',async()=>{
 const root=await fixture();const outside=await fixture();try{
  await mkdir(resolve(root,'.local'),{recursive:true});await symlink(outside,resolve(root,'.local/work-context'));
  await expect(prepareContext({root,initialize:true})).rejects.toThrow('initialization symlink');
  expect(await stat(resolve(outside,'checkpoint.json')).then(()=>true,()=>false)).toBe(false);
 }finally{await rm(root,{recursive:true});await rm(outside,{recursive:true});}
});

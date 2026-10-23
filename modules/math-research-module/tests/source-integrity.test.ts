import { test, expect } from 'bun:test';
import { mkdir, mkdtemp, cp, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { moduleRoot, sha256 } from '../scripts/agent-platform';
import { verifySource } from '../scripts/verify-source';
async function fixture(){await mkdir(resolve(moduleRoot,'.local/source-tests'),{recursive:true});const root=await mkdtemp(resolve(moduleRoot,'.local/source-tests/fixture-'));await cp(resolve(moduleRoot,'harness'),resolve(root,'harness'),{recursive:true});await cp(resolve(moduleRoot,'source'),resolve(root,'source'),{recursive:true});return root;}
test('source plus its inner manifest cannot be silently rewritten',async()=>{const root=await fixture();try{const path=resolve(root,'source/archive/README.md');await writeFile(path,(await readFile(path,'utf8'))+'altered');const mp=resolve(root,'source/archive/FILES.sha256.json');const m=JSON.parse(await readFile(mp,'utf8'));m['README.md']=sha256(await readFile(path));await writeFile(mp,JSON.stringify(m));await expect(verifySource(root)).rejects.toThrow('Admitted source pin drift');}finally{await rm(root,{recursive:true});}});
test('capability mapping bytes are included in fixed source admission',async()=>{const root=await fixture();try{const path=resolve(root,'source/capability-research/초3_105유형_능력후보_근거대응.json');await writeFile(path,(await readFile(path,'utf8'))+' ');await expect(verifySource(root)).rejects.toThrow('Admitted source pin drift');}finally{await rm(root,{recursive:true});}});

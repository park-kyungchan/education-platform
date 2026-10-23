import {test,expect} from 'bun:test';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {loadSourceAuditor,sourceAuditorSelection} from './source-auditor.ts';
test('loads the admitted canonical audit source without following mutable common main',async()=>{
  const api=await loadSourceAuditor();
  expect(typeof api.openGitWork).toBe('function');
  expect(typeof api.validateGitWorkRecords).toBe('function');
  expect(sourceAuditorSelection.commit).toBe('712f90deac0676e662dc5d75d88d89f7b6773bfe');
});
test('refuses another source revision before its module can execute',async()=>{
  const root=mkdtempSync(join(tmpdir(),'academy-wrong-auditor-'));
  const marker='__academy_wrong_auditor_executed';
  try{
    const module=join(root,'packages/work-continuity/src/git-work/index.ts');
    mkdirSync(join(module,'..'),{recursive:true});
    writeFileSync(module,`(globalThis as any)[${JSON.stringify(marker)}]=true;\n`);
    for(const args of [['init','-q'],['add','.'],['-c','user.name=Synthetic Audit Test','-c','user.email=synthetic@example.invalid','commit','-qm','Invented wrong audit source']]){
      const run=Bun.spawnSync(['git','-C',root,...args],{stdout:'pipe',stderr:'pipe'});expect(run.exitCode).toBe(0);
    }
    await expect(loadSourceAuditor(root)).rejects.toThrow('source_auditor_revision_or_bytes_changed');
    expect((globalThis as Record<string,unknown>)[marker]).toBeUndefined();
  }finally{rmSync(root,{recursive:true,force:true});}
});
test('refuses an unavailable source instead of falling back to another code owner',async()=>{
  await expect(loadSourceAuditor('/nonexistent/academy-auditor-fixture')).rejects.toThrow('source_auditor_unavailable');
});

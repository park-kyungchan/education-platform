import {expect,test} from 'bun:test';
import {mkdtempSync,existsSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {runOwnedSourceProcess} from '../../src/academy/nativeDirectSource';
test('runtime cancellation terminates its acquisition group before the normal deadline',async()=>{
 const controller=new AbortController(),start=Date.now();
 const operation=runOwnedSourceProcess({argv:[process.execPath,'--no-env-file','-e',"setInterval(()=>{},100)"],env:{PATH:process.env.PATH},deadlineMs:2000,graceMs:40,signal:controller.signal});
 const timer=setTimeout(()=>controller.abort(),100);
 try{await expect(operation).rejects.toThrow('direct_source_cancelled');expect(Date.now()-start).toBeLessThan(1500);}finally{clearTimeout(timer);}
});

test('an apparently successful relay cannot orphan a live redirected descendant',async()=>{
 const root=mkdtempSync(join(tmpdir(),'source-orphan-')),late=root+'/late';
 const grandchild=`import {writeFileSync} from 'node:fs';process.on('SIGTERM',()=>{});setTimeout(()=>writeFileSync(${JSON.stringify(late)},'late'),800);`;
 const relay=`import {spawn} from 'node:child_process';spawn(process.execPath,['--no-env-file','-e',${JSON.stringify(grandchild)}],{stdio:'ignore'});setTimeout(()=>process.exit(0),200);`;
 try{
  await expect(runOwnedSourceProcess({argv:[process.execPath,'--no-env-file','-e',relay],env:{PATH:process.env.PATH},deadlineMs:2000,graceMs:40})).rejects.toThrow('direct_source_descendant_still_running');
  await Bun.sleep(900);expect(existsSync(late)).toBe(false);
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('owned direct process cancellation covers a TERM-ignoring descendant even after relay pipe closure',async()=>{
 const module=await import('../../src/academy/nativeDirectSource').catch(()=>({runOwnedSourceProcess:undefined}));
 expect(typeof module.runOwnedSourceProcess).toBe('function');
 const root=mkdtempSync(join(tmpdir(),'source-cancel-')),ready=root+'/ready',late=root+'/late';
 const grandchild=`import {writeFileSync} from 'node:fs';process.on('SIGTERM',()=>{});writeFileSync(${JSON.stringify(ready)},'ready');setTimeout(()=>writeFileSync(${JSON.stringify(late)},'late'),1000);`;
 const relay=`import {spawn} from 'node:child_process';spawn(process.execPath,['--no-env-file','-e',${JSON.stringify(grandchild)}],{stdio:'ignore'});setInterval(()=>{},100);`;
 try{
  await expect(module.runOwnedSourceProcess!({argv:[process.execPath,'--no-env-file','-e',relay],env:{PATH:process.env.PATH},deadlineMs:500,graceMs:80})).rejects.toThrow('direct_source_deadline_exceeded');
  expect(existsSync(ready)).toBe(true);await Bun.sleep(700);expect(existsSync(late)).toBe(false);
 }finally{rmSync(root,{recursive:true,force:true});}
});

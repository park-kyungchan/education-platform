import {test,expect} from 'bun:test';
import {mkdtemp,mkdir,writeFile,rm,chmod,symlink,link} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createPrivateArtifactReader,type ReconciledPrivateArtifact} from '../../src/academy/privateArtifacts';

const context={ownerId:'synthetic-owner',actorId:'synthetic-teacher',role:'teacher' as const};
const receipt='1'.repeat(64),body=Buffer.from('Synthetic private source bytes.\n');
async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'academy-private-artifact-'));await chmod(root,0o700);await mkdir(join(root,'objects'),{mode:0o700});await writeFile(join(root,'objects','source.txt'),body,{mode:0o600});
 const metadata:ReconciledPrivateArtifact={id:'synthetic:artifact-a',ownerId:context.ownerId,studentId:'synthetic-student',sourceRecordId:'synthetic:source-a',mime:'text/plain',filename:'Synthetic source.txt',bytes:body.length,sha256:createHash('sha256').update(body).digest('hex'),archivePath:'objects/source.txt',reconciliationReceiptSha256:receipt};
 let lookups=0,owned=true;
 const config={root,uid:process.getuid!(),ownerId:context.ownerId,acceptedReceiptSha256:[receipt],resolveArtifact:async()=>{lookups++;return metadata;},studentIsOwned:async()=>owned};
 return {root,metadata,config,reader:()=>createPrivateArtifactReader(config),lookups:()=>lookups,foreign:()=>{owned=false;},cleanup:()=>rm(root,{recursive:true,force:true})};
}
test('resolved exact private bytes have download-only headers and never reveal archive paths',async()=>{
 const f=await fixture();try{const result=await f.reader().read(context,f.metadata.id);expect(result.body.equals(body)).toBe(true);expect(result.sha256).toBe(f.metadata.sha256);expect(result.headers['Content-Disposition']).toStartWith("attachment; filename*=UTF-8''");expect(result.headers['X-Content-Type-Options']).toBe('nosniff');expect(result.headers['Content-Security-Policy']).toContain('sandbox');expect(result.headers['Cache-Control']).toBe('private, no-store');expect(Object.hasOwn(result,'archivePath')).toBe(false);expect(result.sourceVerification).toBe('resolver_owned_not_inferred_from_byte_parity');}finally{await f.cleanup();}
});
test('cross-owner context cannot resolve metadata and foreign student/reconciliation claims cannot read bytes',async()=>{
 const f=await fixture();try{await expect(f.reader().read({...context,ownerId:'synthetic-foreign'},f.metadata.id)).rejects.toThrow('owner_scope_conflict');expect(f.lookups()).toBe(0);f.foreign();await expect(f.reader().read(context,f.metadata.id)).rejects.toThrow('artifact_student_scope_conflict');f.metadata.studentId=null;f.metadata.ownerId='synthetic-foreign';await expect(f.reader().read(context,f.metadata.id)).rejects.toThrow('artifact_reconciliation_required');f.metadata.ownerId=context.ownerId;f.metadata.reconciliationReceiptSha256='2'.repeat(64);await expect(f.reader().read(context,f.metadata.id)).rejects.toThrow('artifact_reconciliation_required');}finally{await f.cleanup();}
});
test('absolute/traversal/URL paths and header injection are refused',async()=>{
 const f=await fixture();try{for(const path of ['/etc/passwd','../source.txt','objects/../source.txt','objects//source.txt','https://synthetic.invalid/a','objects\\source.txt','objects/source.txt?token=a']){f.metadata.archivePath=path;await expect(f.reader().read(context,f.metadata.id)).rejects.toThrow('invalid_artifact_path');}f.metadata.archivePath='objects/source.txt';f.metadata.filename='source.txt\r\nX-Injected: true';await expect(f.reader().read(context,f.metadata.id)).rejects.toThrow('invalid_artifact_filename');}finally{await f.cleanup();}
});
test('symlink ancestors, symlink files, hardlinks and public file modes cannot escape private custody',async()=>{
 const f=await fixture();try{await symlink('objects',join(f.root,'alias'));f.metadata.archivePath='alias/source.txt';await expect(f.reader().read(context,f.metadata.id)).rejects.toThrow('private_artifact_bytes_unavailable');await symlink('source.txt',join(f.root,'objects','symlink.txt'));f.metadata.archivePath='objects/symlink.txt';await expect(f.reader().read(context,f.metadata.id)).rejects.toThrow('private_artifact_bytes_unavailable');f.metadata.archivePath='objects/source.txt';await link(join(f.root,'objects','source.txt'),join(f.root,'objects','hardlink.txt'));await expect(f.reader().read(context,f.metadata.id)).rejects.toThrow('private_artifact_storage_refused');await rm(join(f.root,'objects','hardlink.txt'));await chmod(join(f.root,'objects','source.txt'),0o644);await expect(f.reader().read(context,f.metadata.id)).rejects.toThrow('private_artifact_storage_refused');}finally{await f.cleanup();}
});
test('every read verifies source digest, byte length and MIME without a successful-read cache',async()=>{
 const f=await fixture();try{await f.reader().read(context,f.metadata.id);await writeFile(join(f.root,'objects','source.txt'),Buffer.alloc(body.length,65));await expect(f.reader().read(context,f.metadata.id)).rejects.toThrow('artifact_integrity_conflict');await writeFile(join(f.root,'objects','source.txt'),body);f.metadata.mime='application/pdf';f.metadata.filename='Synthetic source.pdf';await expect(f.reader().read(context,f.metadata.id)).rejects.toThrow('artifact_mime_refused');f.metadata.bytes++;await expect(f.reader().read(context,f.metadata.id)).rejects.toThrow('private_artifact_storage_refused');f.metadata.bytes=Number.MAX_SAFE_INTEGER;await expect(f.reader().read(context,f.metadata.id)).rejects.toThrow('artifact_size_refused');}finally{await f.cleanup();}
});
test('download filenames keep valid UTF8 escaping and cannot advertise an executable extension',async()=>{
 const f=await fixture();try{f.metadata.filename="Synthetic '한글'(copy).txt";const result=await f.reader().read(context,f.metadata.id);expect(result.headers['Content-Disposition']).toContain('%27');expect(result.headers['Content-Disposition']).toContain('%28copy%29');f.metadata.filename='Synthetic source.html';await expect(f.reader().read(context,f.metadata.id)).rejects.toThrow('artifact_filename_mime_conflict');}finally{await f.cleanup();}
});
test('an actual FIFO is rejected before any blocking read',async()=>{
 const f=await fixture();try{
  const fifo=join(f.root,'objects','pipe');expect(Bun.spawnSync(['mkfifo','-m','600','--',fifo]).exitCode).toBe(0);f.metadata.archivePath='objects/pipe';
  const driver=join(f.root,'fifo-probe.ts'),modulePath=new URL('../../src/academy/privateArtifacts.ts',import.meta.url).pathname;
  await writeFile(driver,`import {createPrivateArtifactReader} from ${JSON.stringify(modulePath)};\nconst reader=createPrivateArtifactReader({root:${JSON.stringify(f.root)},uid:${process.getuid!()},ownerId:${JSON.stringify(context.ownerId)},acceptedReceiptSha256:[${JSON.stringify(receipt)}],resolveArtifact:async()=>(${JSON.stringify(f.metadata)}),studentIsOwned:async()=>true});\ntry{await reader.read(${JSON.stringify(context)},${JSON.stringify(f.metadata.id)});process.exitCode=1;}catch(error){if(!(error instanceof Error)||error.message!=='private_artifact_storage_refused')throw error;console.log('fifo_refused');}\n`,{mode:0o600});
  const child=Bun.spawn([process.execPath,'--no-env-file',driver],{stdin:'ignore',stdout:'pipe',stderr:'pipe'});let expired=false;
  const timer=setTimeout(()=>{expired=true;child.kill('SIGKILL');},2000);
  try{const [code,out,error]=await Promise.all([child.exited,new Response(child.stdout).text(),new Response(child.stderr).text()]);expect(expired).toBe(false);expect(code).toBe(0);expect(out).toBe('fifo_refused\n');expect(error).toBe('');}
  finally{clearTimeout(timer);if(child.exitCode===null){child.kill('SIGKILL');await child.exited;}}
 }finally{await f.cleanup();}
},5000);
test('source accessors never execute and scope-provider failures expose a fixed refusal',async()=>{
 const f=await fixture();try{let invoked=0;Object.defineProperty(f.metadata,'filename',{enumerable:true,get(){invoked++;return 'private';}});await expect(f.reader().read(context,f.metadata.id)).rejects.toThrow('accessors');expect(invoked).toBe(0);Object.defineProperty(f.metadata,'filename',{value:'Synthetic source.txt',enumerable:true});const reader=createPrivateArtifactReader({...f.config,studentIsOwned:async()=>{throw Error('SYNTHETIC_PRIVATE_SCOPE_MARKER');}});await expect(reader.read(context,f.metadata.id)).rejects.toThrow('artifact_student_scope_unavailable');}finally{await f.cleanup();}
});

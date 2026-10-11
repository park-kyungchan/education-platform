import {expect,test} from 'bun:test';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
import {scanPublicationText} from '../../harness/tools/prepush_audit';
test('native HTTP public help exposes supported credential owner without secret acquisition',async()=>{
  const child=Bun.spawn([process.execPath,'--no-env-file',resolve(import.meta.dir,'../../harness/academy_http.ts'),'--help'],{stdout:'pipe',stderr:'pipe'});
  const output=await new Response(child.stdout).text();expect(await child.exited).toBe(0);
  const result=JSON.parse(output);expect(result.credentialOwner).toBe('native_profile_skill_secret_input');expect(result.browserFallback).toBe(false);expect(result.sourceEffect).toBe('read_only');
});
test('native HTTP help advertises existing textbook index inspection without paper generation',async()=>{
 const child=Bun.spawn([process.execPath,'--no-env-file',resolve(import.meta.dir,'../../harness/academy_http.ts'),'--help'],{stdout:'pipe',stderr:'pipe'});
 const output=await new Response(child.stdout).text();expect(await child.exited).toBe(0);
 expect(JSON.parse(output).textbookIndexInspection).toBe('read_only_existing_headers_not_generated_paper_membership');
});
test('official journal help is read-first and separates native approval from sending',async()=>{
  const child=Bun.spawn([process.execPath,'--no-env-file',resolve(import.meta.dir,'../../harness/academy_journal_http.ts'),'--help'],{stdout:'pipe',stderr:'pipe'});
  const output=await new Response(child.stdout).text();expect(await child.exited).toBe(0);const result=JSON.parse(output);
  expect(result.default).toBe('qualify_read_only');expect(result.approvalOwner).toBe('actual_native_clarify_result_bound_to_review_digest');expect(result.parentSend).toBe(false);expect(result.automaticRetry).toBe(false);
});
test('HTTP fixtures remain publishable without weakening the session-literal guard',()=>{
 const path='tests/lms/academyHttpClient.test.ts';expect(scanPublicationText(path,readFileSync(resolve(import.meta.dir,'../../',path),'utf8'))).toEqual([]);
});

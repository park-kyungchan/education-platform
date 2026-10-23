import { expect, test } from 'bun:test';
import { loadOwnerReviewProjection } from '../scripts/canonical-projection.ts';
const api=await loadOwnerReviewProjection();
test('Math owner policy is fixed and runtime-frozen',()=>{
 expect(api.policy.repository).toBe('park-kyungchan/math-research-module');
 expect(api.policy.projectId).toBe('math-research-module');expect(api.policy.domainId).toBe('mathematics-education');
 expect(api.policy.semanticOwner).toBe('math-research-module');expect(Object.isFrozen(api.policy)).toBe(true);expect(Object.isFrozen(api.policy.publisher)).toBe(true);
});
test('foreign repository cannot reach reader operations through the canonical owner API',async()=>{
 let calls=0;const forbidden=async()=>{calls++;throw Error('Unexpected source read');};
 await expect(api.validateOwnerScopedReviewWithEvidence(api.policy,{repository:'park-kyungchan/foreign',head:'1'.repeat(40)},{readCommit:forbidden,readStatuses:forbidden,readTree:forbidden,readFile:forbidden})).rejects.toThrow();
 expect(calls).toBe(0);
});
test('real CLI gate fails closed with no read token and cannot synthesize a review PASS',async()=>{
 const child=Bun.spawn([process.execPath,'--no-env-file','ci/native-review.ts'],{cwd:new URL('..',import.meta.url).pathname,
  env:{...process.env,GITHUB_REPOSITORY:'park-kyungchan/math-research-module',REVIEW_HEAD_SHA:'1'.repeat(40),GITHUB_TOKEN:''},stdout:'pipe',stderr:'pipe'});
 const [stdout,stderr,code]=await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited]);
 expect(code).not.toBe(0);expect(stdout).not.toContain('"status":"pass"');expect(stderr.length).toBeGreaterThan(0);
});

test('both generated APIs refuse raw preimport in fresh processes without clearing caches',async()=>{
 for(const [path,loader]of [['./ci/generated/canonical-api.js','loadCanonicalProjection'],['./ci/generated/native-review.js','loadOwnerReviewProjection']]) {
  const source=`await import(${JSON.stringify(path)});const helpers=await import('./scripts/canonical-projection.ts');try{await helpers[${JSON.stringify(loader)}]();process.exit(91);}catch(error){if(!String(error).includes('imported before source verification'))throw error;console.log('PREIMPORT_REFUSED');}`;
  const child=Bun.spawn([process.execPath,'--no-env-file','-e',source],{cwd:new URL('..',import.meta.url).pathname,stdout:'pipe',stderr:'pipe'});
  const [stdout,stderr,code]=await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited]);
  expect(code).toBe(0);expect(stdout).toContain('PREIMPORT_REFUSED');expect(stderr).toBe('');
 }
});

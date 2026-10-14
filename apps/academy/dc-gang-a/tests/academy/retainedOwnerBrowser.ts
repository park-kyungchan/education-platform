import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync,existsSync,unlinkSync} from 'node:fs';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import {SQL} from 'bun';
import {learningFixture,exactAttemptFixture} from './learningWorkFixtures';
import {createAuthSecrets} from '../../src/academy/auth';
import {PostgresAcademyStore} from '../../src/academy/postgresStore';

const output=process.env.DC_ACADEMY_BROWSER_OUTPUT;
if(!output||!process.env.DC_ACADEMY_TEST_SOCKET)throw Error('explicit_test_socket_and_output_required');
mkdirSync(output,{recursive:true,mode:0o700});
const directory=mkdtempSync(resolve(output,'synthetic-owner-'));
const fixture=await learningFixture(),work=await fixture.append('work',fixture.assignment);
await fixture.append('attempt',{...exactAttemptFixture(),assignmentRevisionId:work.revisionId});
const retainedRequestId=crypto.randomUUID();
await fixture.store.admitSourceRequest(fixture.owner,fixture.actor.actorId,fixture.studentId,retainedRequestId);
await fixture.store.finishSourceRequest(fixture.owner,fixture.actor.actorId,retainedRequestId,'blocked','synthetic_prior_source_request');
const password='synthetic-retained-browser-password-2090';
const auth={schemaVersion:1,sessionKey:createAuthSecrets().sessionKey,invitationDigest:null,
  identity:{actorId:fixture.actor.actorId,username:'synthetic-teacher',passwordHash:await Bun.password.hash(password)}};
const authBytes=JSON.stringify(auth)+'\n';
writeFileSync(resolve(directory,'web-auth.json'),authBytes,{mode:0o600});
let config={syntheticOnly:true,ownerId:fixture.owner,socket:process.env.DC_ACADEMY_TEST_SOCKET,port:0};
const cert=Bun.spawnSync(['openssl','req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=localhost',
  '-addext','subjectAltName=IP:127.0.0.1,DNS:localhost','-keyout',resolve(directory,'tls-key.pem'),'-out',resolve(directory,'tls-cert.pem')],{stdout:'ignore',stderr:'pipe'});
assert.equal(cert.exitCode,0,'synthetic TLS fixture creation');
let child:ReturnType<typeof Bun.spawn>|undefined;
const effects:unknown[]=[],errors:string[]=[],cases:string[]=[],screenshots:string[]=[];
const start=async()=>{
  const endpoint=resolve(directory,'endpoint.json');if(existsSync(endpoint))unlinkSync(endpoint);
  writeFileSync(resolve(directory,'owner.json'),JSON.stringify(config)+'\n',{mode:0o600});
  child=Bun.spawn([process.execPath,'tests/academy/retainedOwnerServer.ts','--synthetic-only',directory],{cwd:process.cwd(),stdout:'ignore',stderr:'pipe'});
  for(let n=0;n<250&&!existsSync(endpoint);n++){if(child.exitCode!==null)throw Error('synthetic_server_failed:'+await new Response(child.stderr).text());await Bun.sleep(20);}
  if(!existsSync(endpoint))throw Error('synthetic_server_start_timeout');
  const result=JSON.parse(readFileSync(endpoint,'utf8'));config.port=result.port;return result.origin as string;
};
const stop=async()=>{
  if(!child)return;child.kill('SIGTERM');assert.equal(await child.exited,0,'task-owned server exits cleanly');child=undefined;
  const value=JSON.parse(readFileSync(resolve(directory,'server-effects.json'),'utf8'));assert.equal(value.applicationFetchCalls,0);effects.push(value);
};
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}});
try{
  const origin=await start();
  await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==origin){errors.push('unexpected_browser_origin');return route.abort();}return route.continue();});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/?date=2025-01-02');
  assert.equal((await context.request.get(origin+'/api/cohort')).status(),401);
  await page.locator('#username').fill('synthetic-teacher');await page.locator('#password').fill(password);
  await page.locator('#login-submit').click();await page.locator('#students button').first().waitFor();
  cases.push('real_form_login_issues_browser_session_without_signed_cookie_injection');
  await page.locator('#recover-source-refresh').click();await page.locator('#source-refresh-history').waitFor();
  assert.match(await page.locator('#source-refresh-history').innerText(),new RegExp(retainedRequestId));
  cases.push('existing_actor_scoped_source_request_history_remains_readable_without_acquisition');
  await page.locator('#students button').first().click();
  const item=page.locator('[data-clinic-item="assigned-1"]');await item.waitFor();
  await page.locator('#source-status-summary').click();
  assert.match(await page.locator('#source-connection').innerText(),/보존 자료 전용/);
  assert.equal(await page.locator('#refresh-student').isDisabled(),true);
  assert.match(await item.locator(':scope > summary').innerText(),/미확인/);
  await item.locator(':scope > summary').click();
  await item.locator('[data-role="decision"]').selectOption('completed');
  await item.locator('[data-role="note"]').fill('Invented explicit inspection of this exact retained item.');
  assert.equal(await item.locator('[data-role="save"]').isDisabled(),true);
  await item.locator('[data-role="written"]').check();await item.locator('[data-role="explanation"]').check();await item.locator('[data-role="confirm"]').check();
  let clinicPostCount=0;
  let committed!:(value:{receipt:any;input:any})=>void;
  const committedResponse=new Promise<{receipt:any;input:any}>(resolve=>{committed=resolve;});
  // Lose the browser acknowledgement only after the real protected server has committed.
  await context.route(origin+'/api/teacher-clinic',async route=>{
    clinicPostCount++;const response=await route.fetch({maxRedirects:0});assert.equal(response.status(),200);
    committed({receipt:await response.json(),input:route.request().postDataJSON()});await route.abort('failed');
  });
  await item.locator('[data-role="save"]').click();const {receipt,input}=await committedResponse;
  await item.locator('[data-role="recover"]').waitFor();await item.locator('[data-role="recover"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-clinic-item="assigned-1"] > summary')?.textContent?.includes('교사 완료'));
  assert.equal(clinicPostCount,1);await context.unroute(origin+'/api/teacher-clinic');
  assert.match(await page.locator('[data-clinic-item="assigned-2"] > summary').innerText(),/미확인/);
  cases.push('lost_acknowledgement_recovers_committed_judgment_in_browser_without_second_post_or_other_item_promotion');
  const shot=resolve(output,'retained-teacher-judgment.png');await page.screenshot({path:shot,fullPage:true});screenshots.push(shot);
  const scene=await (await context.request.get(origin+'/api/student?id='+fixture.studentId+'&date=2025-01-02')).json();
  assert.equal(scene.officialSaved,false);assert.equal(scene.parentSent,false);
  const headers={Origin:origin,'X-Teacher-Owner':scene.teacherScope.ownerId,'X-Teacher-Actor':scene.teacherScope.actorId};
  const refresh=await context.request.post(origin+'/api/refresh',{headers,data:{studentId:fixture.studentId,requestId:crypto.randomUUID()}});
  assert.equal(refresh.status(),503);assert.equal((await refresh.json()).cacheRetained,true);
  const foreign=await context.request.post(origin+'/api/teacher-clinic',{headers,data:{...input,studentId:'foreign-student',idempotencyKey:crypto.randomUUID()}});assert.equal(foreign.status(),403);
  cases.push('authenticated_refresh_and_foreign_subject_refused');
  await stop();
  const reopenedOrigin=await start();assert.equal(reopenedOrigin,origin);
  await page.reload();await page.locator('#students button').first().waitFor();await page.locator('#students button').first().click();
  await page.locator('[data-clinic-item="assigned-1"]').waitFor();
  assert.match(await page.locator('[data-clinic-item="assigned-1"] > summary').innerText(),/교사 완료/);
  const lookup=await context.request.get(origin+'/api/teacher-clinic-result?studentId='+fixture.studentId+'&requestId='+input.idempotencyKey);
  assert.equal(lookup.status(),200);assert.equal((await lookup.json()).revisionId,receipt.revisionId);
  const replay=await context.request.post(origin+'/api/teacher-clinic',{headers,data:input});assert.equal(replay.status(),200);assert.equal((await replay.json()).revisionId,receipt.revisionId);
  const db=new SQL({adapter:'postgres',path:config.socket,username:'hermes',database:'dc_academy_test'});
  try{const stored=await new PostgresAcademyStore(db).history(fixture.owner,fixture.studentId,receipt.record.entityId);assert.equal(stored.length,1);assert.equal(stored[0]!.revisionId,receipt.revisionId);}finally{await db.close();}
  assert.equal(readFileSync(resolve(directory,'web-auth.json'),'utf8'),authBytes);
  cases.push('new_process_and_independent_database_readback_preserve_one_committed_judgment_and_existing_auth');
  const restartShot=resolve(output,'retained-after-restart.png');await page.screenshot({path:restartShot,fullPage:true});screenshots.push(restartShot);
  await stop();assert.deepEqual(errors,[]);
  const report={schemaVersion:'academy.retained-owner-browser-verification/1',observedAt:new Date().toISOString(),status:'passed',classification:'ordinary_engineering_not_model_evaluation',
    syntheticOnly:true,realStudentDataUsed:false,browser:await browser.version(),viewport:{width:1440,height:1000},origin,cases,screenshots,effects,
    authentication:'real_form_login_existing_TeacherAuthStore',database:'existing_PostgresAcademyStore_schema_isolated_dc_academy_test',nativeProductionActivation:false,teacherAcceptance:false};
  writeFileSync(resolve(output,'browser-verification.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});console.log(JSON.stringify(report,null,2));
}finally{await stop();await context.close();await browser.close();await fixture.db.close();}

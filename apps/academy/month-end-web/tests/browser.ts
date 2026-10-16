import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {existsSync} from 'node:fs';
import type {Browser,BrowserContext} from '../../dc-gang-a/node_modules/playwright';

const repo=resolve(import.meta.dir,'../../../..');
process.env.PLAYWRIGHT_BROWSERS_PATH=resolve(repo,'.private/browsers');
const {chromium}=await import('../../dc-gang-a/node_modules/playwright');
const output=resolve(repo,'.private/month-end-preview');await mkdir(output,{recursive:true});
const privateLibraries=resolve(repo,'.private/browser-libs/root/usr/lib/x86_64-linux-gnu');
const server=Bun.spawn([process.execPath,'preview.ts'],{cwd:resolve(import.meta.dir,'..'),env:{...process.env,PORT:'4175'},stdout:'pipe',stderr:'pipe'});
let browser:Browser|undefined,context:BrowserContext|undefined;
try{
const reader=server.stdout.getReader();
const ready=await Promise.race([reader.read(),Bun.sleep(5000).then(()=>{throw Error('owned_preview_server_start_timeout');})]);
reader.releaseLock();assert.ok(new TextDecoder().decode(ready.value).includes('127.0.0.1:4175'),'owned preview server failed to bind');
browser=await chromium.launch({headless:true,env:{...process.env,...(existsSync(privateLibraries)?{
  LD_LIBRARY_PATH:[privateLibraries,resolve(repo,'.private/browser-libs/root/lib/x86_64-linux-gnu'),process.env.LD_LIBRARY_PATH].filter(Boolean).join(':'),
  FONTCONFIG_FILE:resolve(repo,'.private/browser-libs/fonts.conf'),
}:{})}});
context=await browser.newContext({viewport:{width:1440,height:1050}});
const page=await context.newPage(),requests:string[]=[],errors:string[]=[];
page.on('request',request=>requests.push(request.url()));page.on('pageerror',error=>errors.push(error.message));
const cases:string[]=[];
  await page.goto('http://127.0.0.1:4175/education-platform/',{waitUntil:'networkidle'});
  await page.getByRole('heading',{name:'익숙한 유형에서, 찾고 싶은 문항까지.'}).waitFor();
  assert.equal(await page.locator('.item-row').count(),8);
  await page.getByRole('searchbox').fill('오류');assert.equal(await page.locator('.item-row').count(),1);
  await page.getByRole('button',{name:'근거 보기 ＋'}).click();await page.getByRole('heading',{name:'문항과 라벨의 근거'}).waitFor();
  await page.getByText('정답 예시 확인',{exact:true}).click();assert.ok((await page.locator('.answer').textContent())!.includes('나머지는'));
  await page.getByRole('searchbox').fill('<img src=x onerror=alert(1)>');assert.equal(await page.locator('.item-row').count(),0);assert.equal(await page.locator('img').count(),0);
  await page.getByRole('button',{name:'검색과 필터 초기화'}).click();cases.push('search_filter_detail_and_untrusted_text');
  await page.getByRole('button',{name:'실제 자료 상태 보기'}).click();await page.getByRole('heading',{name:'아직 원천 라벨을 불러오지 않았습니다.'}).waitFor();
  assert.ok((await page.locator('.result-count').textContent())!.includes('0개라는 뜻이 아닙니다'));await page.getByRole('button',{name:'합성 예시로 화면 보기'}).click();cases.push('actual_inventory_unknown_not_zero');
  await page.locator('[data-view=assessment]').click();await page.locator('[data-role=exam-date]').fill('2026-10-31');
  assert.equal(await page.locator('[data-role=exam-timezone]').inputValue(),'');
  await page.locator('[data-role=exam-timezone]').fill('Etc/UTC');await page.locator('[data-role=exam-date]').fill('');
  assert.equal(await page.locator('[data-role=exam-timezone]').inputValue(),'Etc/UTC');cases.push('date_edit_and_clear_preserve_independent_timezone');
  await page.locator('[data-view=match]').click();await page.getByRole('button',{name:'조회 준비 확인'}).click();assert.ok((await page.locator('.query-status').textContent())!.includes('모두 입력'));
  await page.getByLabel('학습한 세부 유형',{exact:true}).fill('검증용 유형');await page.getByLabel('찾고 싶은 문항의 특징',{exact:true}).fill('나머지의 오류를 설명');
  await page.getByRole('button',{name:'조회 준비 확인'}).click();assert.ok((await page.locator('.query-status').textContent())!.includes('조회는 실행하지 않았습니다'));cases.push('query_intent_does_not_fake_live_search');
  await page.locator('[data-view=pool]').click();await page.screenshot({path:resolve(output,'desktop.png'),fullPage:true});
  for(const width of [1440,1100,768,390,320]){await page.setViewportSize({width,height:1000});
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);assert.equal(overflow,false,`horizontal overflow at ${width}`);}
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:resolve(output,'mobile.png'),fullPage:true});cases.push('desktop_tablet_and_narrow_mobile_layout');
  assert.equal(await page.evaluate(()=>localStorage.length),0);assert.equal(await page.evaluate(()=>sessionStorage.length),0);
  assert.ok(requests.every(url=>url.startsWith('http://127.0.0.1:4175/')));assert.ok(requests.every(url=>!url.includes('/api/')));
  assert.deepEqual(errors,[]);cases.push('no_remote_api_storage_or_page_errors');
  const local=await context.newPage();await local.goto('file://'+resolve(import.meta.dir,'../dist/review.html'));
  await local.getByRole('heading',{name:'익숙한 유형에서, 찾고 싶은 문항까지.'}).waitFor();
  assert.equal(await local.locator('.item-row').count(),8);await local.close();cases.push('single_html_review_opens_without_hosting');
  const receipt={status:'pass',cases,widths:[1440,1100,768,390,320],pageErrors:errors,requests,source:'synthetic_only',
    actualAcademyLabelQuery:'not_verified',selectedQuestions:0,officialWrites:0,published:false};
  await writeFile(resolve(output,'browser-verification.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
}finally{await context?.close();await browser?.close();server.kill();await server.exited;}

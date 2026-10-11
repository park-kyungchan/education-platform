import {expect,test} from 'bun:test';
import {createTeacherServerHandler} from '../../src/academy/server';
import {TeacherApplication} from '../../src/academy/application';
import type {PostgresAcademyStore} from '../../src/academy/postgresStore';
import {createAuthSecrets,signTeacherSession} from '../../src/academy/auth';
import {JSDOM} from 'jsdom';

const origin='https://design.example.invalid',owner='synthetic-design-owner',actor='synthetic-design-teacher';
function fixture(){
  const sessionKey=createAuthSecrets().sessionKey;
  const store=new Proxy({}, {get(){throw Error('design_lab_must_not_access_product_store');}}) as PostgresAcademyStore;
  const handler=createTeacherServerHandler({app:new TeacherApplication(store,owner),origin,sessionKey,identity:{actorId:actor,username:'synthetic-only',passwordHash:'no-live-credential'},invitationDigest:null,saveIdentity:async()=>{throw Error('design_lab_must_not_write');}});
  const request=(path:string,identity?:{owner:string;actor:string})=>handler(new Request(origin+path,{headers:identity?{Cookie:'dc_teacher='+signTeacherSession(sessionKey,identity.owner,identity.actor)}:{}}));
  return {request,allowed:(path='/design-lab')=>request(path,{owner,actor})};
}
test('design lab is teacher-only and serves no product data',async()=>{
  const f=fixture();
  expect((await f.request('/design-lab')).status).toBe(401);
  expect((await f.request('/design-lab',{owner:'different-owner',actor})).status).toBe(401);
  expect((await f.request('/design-lab',{owner,actor:'different-actor'})).status).toBe(401);
  const response=await f.allowed();
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(response.headers.get('Content-Type')).toContain('text/html');
  expect(await response.text()).toContain('디자인 실험실');
});
test('approved reference and retained legacy links use the same synthetic rails without live APIs or writes',async()=>{
  const f=fixture(),facts:string[][]=[];
  for(const theme of ['gang-a','baseline','notion','linear']){
    const response=await f.allowed('/design-lab?theme='+theme);
    expect(response.status).toBe(200);
    const doc=new JSDOM(await response.text()).window.document;
    expect(doc.documentElement.dataset.theme).toBe('gang-a');
    expect(doc.querySelector('[data-synthetic-only]')?.textContent).toContain('합성');
    facts.push([...doc.querySelectorAll('[data-sample]')].map(n=>n.textContent!));
    expect(facts.at(-1)!.length).toBe(4);
    expect(doc.querySelectorAll('.record-summary')).toHaveLength(4);
    expect(doc.body.dataset.design).toBe('gang-a');
    expect(doc.querySelectorAll('script,iframe,form,textarea,input').length).toBe(0);
    expect([...doc.querySelectorAll('a')].every(a=>/^(\/|#)/.test(a.getAttribute('href')??''))).toBe(true);
    expect(doc.querySelector('[data-detail]')?.textContent).toContain('정답과 풀이 상태는 별개');
  }
  expect(facts[0]).toEqual(facts[1]);expect(facts[1]).toEqual(facts[2]);
});
test('gallery navigation is closed, stateful and supports truthful empty states',async()=>{
  const f=fixture();
  for(const query of ['theme=missing','theme=linear&theme=notion','studentId=real','focus=foreign','filter=missing'])expect((await f.allowed('/design-lab?'+query)).status).toBe(400);
  const response=await f.allowed('/design-lab?theme=linear&filter=unknown&focus=c');
  const doc=new JSDOM(await response.text()).window.document;
  expect(doc.querySelectorAll('[data-sample]').length).toBe(2);
  expect(doc.querySelector('[data-detail]')?.getAttribute('data-detail')).toBe('c');
  expect(doc.querySelector('a[data-theme="gang-a"]')?.getAttribute('href')).toContain('filter=unknown&focus=c');
  const emptyResponse=await f.allowed('/design-lab?filter=completed');
  expect(emptyResponse.status).toBe(200);
  const empty=new JSDOM(await emptyResponse.text()).window.document;
  expect(empty.querySelector('[data-empty]')?.textContent).toContain('수업 전체 완료를 뜻하지 않습니다');
});
test('theme token scopes cannot recolor individual variant links',async()=>{
  const doc=new JSDOM(await (await fixture().allowed()).text()).window.document;
  const rules=Array.from(doc.styleSheets[0]!.cssRules).filter((rule):rule is CSSStyleRule=>'style' in rule);
  for(const rule of rules.filter(rule=>rule.style.getPropertyValue('--bg')))expect(rule.selectorText.startsWith(':root')).toBe(true);
});

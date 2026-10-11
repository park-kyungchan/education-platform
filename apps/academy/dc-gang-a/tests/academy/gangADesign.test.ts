import {expect,test} from 'bun:test';
import {JSDOM} from 'jsdom';
import {teacherPage} from '../../src/academy/web/page';
import {createTeacherServerHandler} from '../../src/academy/server';
import {TeacherApplication} from '../../src/academy/application';
import type {TeacherStore} from '../../src/academy/ports/teacherStore';
import {createAuthSecrets} from '../../src/academy/auth';

test('teacher shell uses the approved gang-a paper, ink, accent and typography without legacy dark cards',()=>{
 const doc=new JSDOM(teacherPage).window.document;
 expect(doc.body.dataset.design).toBe('gang-a');
 for(const color of ['#faf8f2','#27322d','#ba4c2c','#376f59'])expect(teacherPage).toContain(color);
 expect(teacherPage).toContain('Noto Serif KR');expect(teacherPage).toContain('Noto Sans KR');
 expect(teacherPage).not.toContain('color-scheme:dark');
 for(const id of ['students','class-list','lesson-date','scene','refresh-all','refresh-student','login-form','password-reset-form'])expect(doc.getElementById(id)).not.toBeNull();
});
test('bundled Korean webfonts are exact public assets, never a database or private path lookup',async()=>{
 const store=new Proxy({},{get(){throw Error('font_route_must_not_read_data');}}) as TeacherStore;
 const origin='https://synthetic.example.invalid';
 const handler=createTeacherServerHandler({app:new TeacherApplication(store,'fixture-font-owner'),origin,sessionKey:createAuthSecrets().sessionKey,identity:null,invitationDigest:null,saveIdentity:async()=>{throw Error('font_route_must_not_write');}});
 for(const path of ['/assets/noto-sans-kr-11e0e8ae.woff2','/assets/noto-serif-kr-dde003b5.woff2']){
  const response=await handler(new Request(origin+path));expect(response.status).toBe(200);
  expect(response.headers.get('Content-Type')).toBe('font/woff2');expect(response.headers.get('Cache-Control')).toContain('immutable');
  const bytes=new Uint8Array(await response.arrayBuffer());expect(new TextDecoder().decode(bytes.slice(0,4))).toBe('wOF2');
 }
 expect((await handler(new Request(origin+'/assets/unlisted.woff2'))).status).not.toBe(200);
});

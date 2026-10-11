import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { createTeacherServerHandler } from '../../src/academy/server';
import { createAuthSecrets } from '../../src/academy/auth';
import type { TeacherApplication } from '../../src/academy/application';
import {teacherPage} from '../../src/academy/web/page';
test('the deployed page provides pinned Korean sans and serif fonts for the accepted visual roles',()=>{
  expect(teacherPage).toContain("font-family:Arial,'Noto Sans KR'");
  expect(teacherPage).toContain("font-family:Georgia,'Noto Serif KR'");
  expect(teacherPage).toContain('/assets/noto-sans-kr-11e0e8ae.woff2');
  expect(teacherPage).toContain('/assets/noto-serif-kr-dde003b5.woff2');
});
test('serves a pinned licensed Korean font without a teacher session or external font request',async()=>{
  const handler=createTeacherServerHandler({app:{ownerId:'fixture-font-owner'} as TeacherApplication,origin:'https://fixture.example.invalid',sessionKey:createAuthSecrets().sessionKey,identity:null,invitationDigest:null,saveIdentity:async()=>{}});
  const response=await handler(new Request('https://fixture.example.invalid/teacher-ko-76f45ef4.ttf'));
  expect(response.status).toBe(200);
  expect(response.headers.get('Content-Type')).toBe('font/ttf');
  const bytes=new Uint8Array(await response.arrayBuffer());
  expect(createHash('sha256').update(bytes).digest('hex')).toBe('76f45ef4a6bcff344c837c95a7dcc26e017e38b5846d5ae0cdcb5b86be2e2d31');
  expect(response.headers.has('Set-Cookie')).toBe(false);
});

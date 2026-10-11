import { describe, expect, test } from 'bun:test';
import { createAuthSecrets, signTeacherSession, verifyTeacherSession } from '../../src/academy/auth';

describe('single-teacher product authentication',()=>{
  test('server-signed scope expires and rejects altered caller roles',()=>{
    const key=createAuthSecrets().sessionKey;
    const token=signTeacherSession(key,'owner-fixture','teacher-fixture',1000,3600);
    expect(verifyTeacherSession(key,token,1100)?.ownerId).toBe('owner-fixture');
    expect(verifyTeacherSession(key,token,5000)).toBeNull();
    expect(verifyTeacherSession(key,token.slice(0,-2)+'xx',1100)).toBeNull();
    expect(verifyTeacherSession(createAuthSecrets().sessionKey,token,1100)).toBeNull();
  });
});

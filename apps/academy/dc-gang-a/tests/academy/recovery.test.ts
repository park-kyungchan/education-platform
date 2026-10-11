import { describe, expect, test } from 'bun:test';
import { decryptRecovery, encryptRecovery } from '../../src/academy/recovery';
describe('authenticated product recovery bundle',()=>{
  test('restores exact JSON and rejects ciphertext changes or another key',()=>{
    const key=crypto.getRandomValues(new Uint8Array(32));
    const original={schemaVersion:1,kind:'invented_recovery_fixture',records:[{id:'fixture',unknown:'preserved'}]};
    const encrypted=encryptRecovery(original,key);
    expect(decryptRecovery(encrypted,key)).toEqual(original);
    const altered=new Uint8Array(encrypted);altered[altered.length-1]^=1;
    expect(()=>decryptRecovery(altered,key)).toThrow();
    expect(()=>decryptRecovery(encrypted,crypto.getRandomValues(new Uint8Array(32)))).toThrow();
  });
});

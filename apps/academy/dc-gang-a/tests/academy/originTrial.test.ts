import { expect, test } from 'bun:test';
import { validateWebMcpTrialToken } from '../../src/academy/originTrial';
const token=(payload:unknown)=>{const bytes=Buffer.from(JSON.stringify(payload)),header=Buffer.alloc(69);header[0]=2;header.writeUInt32BE(bytes.length,65);return Buffer.concat([header,bytes]).toString('base64');};
const origin='https://teacher.example.invalid';
const fixture={origin:origin+':443',feature:'WebMCP',expiry:2000000000,isSubdomain:true};
test('validates public trial metadata while retaining the exact token and single deployment origin',()=>{
  const literal=token(fixture),result=validateWebMcpTrialToken(literal,origin,1900000000);
  expect(result.token).toBe(literal);
  expect(result.deploymentOrigin).toBe(origin);
  expect(result.tokenIncludesSubdomains).toBe(true);
  expect(result.signatureVerified).toBe(false);
});
test('rejects foreign origin, feature, expiry, third-party scope and malformed wire bytes',()=>{
  for(const payload of [{...fixture,origin:'https://foreign.example.invalid:443'},{...fixture,feature:'OtherFeature'},{...fixture,expiry:1800000000},{...fixture,isThirdParty:true}])expect(()=>validateWebMcpTrialToken(token(payload),origin,1900000000)).toThrow();
  expect(()=>validateWebMcpTrialToken(' '+token(fixture),origin,1900000000)).toThrow();
  expect(()=>validateWebMcpTrialToken('invalid',origin,1900000000)).toThrow();
});

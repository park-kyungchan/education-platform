import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { canonicalJson, requireText } from '../learning/model';

export interface TeacherSession { readonly version:1; readonly ownerId:string; readonly actorId:string; readonly role:'teacher'; readonly issuedAt:number; readonly expiresAt:number }
export function createAuthSecrets() { return { sessionKey:randomBytes(32).toString('base64url'), invitation:randomBytes(32).toString('base64url') }; }
export function secretDigest(value:string):string { return createHash('sha256').update(value).digest('hex'); }
export function signTeacherSession(key:string,ownerId:string,actorId:string,now=Math.floor(Date.now()/1000),lifetime=3600):string {
  requireText(key,'server signing key');requireText(ownerId,'owner');requireText(actorId,'actor');
  if(!Number.isSafeInteger(now)||!Number.isSafeInteger(lifetime)||lifetime<1||lifetime>86400)throw Error('invalid_session_lifetime');
  const payload:TeacherSession={version:1,ownerId,actorId,role:'teacher',issuedAt:now,expiresAt:now+lifetime};
  const body=Buffer.from(canonicalJson(payload)).toString('base64url');
  return body+'.'+createHmac('sha256',key).update(body).digest('base64url');
}
export function verifyTeacherSession(key:string,token:string,now=Math.floor(Date.now()/1000)):TeacherSession|null {
  if(typeof token!=='string'||token.length>2048||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))return null;
  const [body,signature]=token.split('.');
  const expected=createHmac('sha256',key).update(body!).digest(),given=Buffer.from(signature!,'base64url');
  if(given.toString('base64url')!==signature||given.length!==expected.length||!timingSafeEqual(given,expected))return null;
  try{
    const decoded=Buffer.from(body!,'base64url');if(decoded.toString('base64url')!==body)return null;
    const value=JSON.parse(decoded.toString('utf8')) as TeacherSession;
    if(canonicalJson(value)!==decoded.toString('utf8')||Object.keys(value).length!==6||value.version!==1||value.role!=='teacher'||typeof value.ownerId!=='string'||!value.ownerId||typeof value.actorId!=='string'||!value.actorId
      ||!Number.isSafeInteger(value.issuedAt)||!Number.isSafeInteger(value.expiresAt)||value.issuedAt>now||value.expiresAt<=now||value.expiresAt-value.issuedAt>86400)return null;
    return value;
  }catch{return null;}
}
export function readCookie(header:string|null,name:string):string|null {
  const values=(header??'').split(';').map(part=>part.trim()).filter(part=>part.startsWith(name+'='));
  return values.length===1?values[0]!.slice(name.length+1):null;
}

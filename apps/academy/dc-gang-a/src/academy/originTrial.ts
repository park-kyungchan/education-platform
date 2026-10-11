export interface ValidatedWebMcpTrial {
  readonly token:string;
  readonly deploymentOrigin:string;
  readonly expiresAt:string;
  readonly tokenIncludesSubdomains:boolean;
  readonly signatureVerified:false;
}
/** Structural metadata check only. Chrome verifies the issuer signature and actual feature availability. */
export function validateWebMcpTrialToken(token:string,origin:string,nowSeconds=Math.floor(Date.now()/1000)):ValidatedWebMcpTrial{
  if(typeof token!=='string'||token.length>12000||!token.length||!Number.isSafeInteger(nowSeconds))throw Error('invalid_origin_trial_token');
  const raw=Buffer.from(token,'base64');
  if(raw.toString('base64')!==token||raw.length<70||raw[0]!==2||raw.readUInt32BE(65)!==raw.length-69)throw Error('invalid_origin_trial_token');
  const payload:unknown=JSON.parse(raw.subarray(69).toString('utf8'));
  if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('invalid_origin_trial_payload');
  const value=payload as Record<string,unknown>;
  if(typeof value.origin!=='string'||value.feature!=='WebMCP'||typeof value.expiry!=='number'||!Number.isSafeInteger(value.expiry)||value.expiry<=nowSeconds||value.isThirdParty===true
    ||(value.isSubdomain!==undefined&&typeof value.isSubdomain!=='boolean'))throw Error('origin_trial_scope_or_expiry_rejected');
  const target=new URL(origin),bound=new URL(value.origin);
  if(target.protocol!=='https:'||target.origin!==origin||bound.protocol!=='https:'||bound.origin!==target.origin||bound.pathname!=='/'||bound.search||bound.hash||bound.username||bound.password)throw Error('origin_trial_origin_conflict');
  return {token,deploymentOrigin:origin,expiresAt:new Date(value.expiry*1000).toISOString(),tokenIncludesSubdomains:value.isSubdomain===true,signatureVerified:false};
}

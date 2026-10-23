import {createHash,timingSafeEqual} from 'node:crypto';
import {readFileSync,lstatSync} from 'node:fs';
import type {IncomingMessage} from 'node:http';
export interface Config {host:'127.0.0.1'|'::1';port:number;authMode:'loopback-preview'|'owner-secret';ownerId:string;dbPath:string;secretFile:string|null;}
export function loadConfig(env:NodeJS.ProcessEnv=process.env):Config {
 const host=env.WORKBENCH_HOST??'127.0.0.1';if(host!=='127.0.0.1'&&host!=='::1')throw Error('external_bind_not_implemented_fail_closed');
 const authMode=env.WORKBENCH_AUTH_MODE??'loopback-preview';if(authMode!=='loopback-preview'&&authMode!=='owner-secret')throw Error('invalid_auth_mode');
 const port=Number(env.WORKBENCH_PORT??8787);if(!Number.isInteger(port)||port<1||port>65535)throw Error('invalid_port');
 if(authMode==='owner-secret'&&!env.WORKBENCH_SECRET_FILE)throw Error('owner_secret_setup_required');
 if(authMode==='owner-secret'&&!env.WORKBENCH_DB_PATH)throw Error('private_database_path_required');
 return {host,port,authMode,ownerId:'local-owner',dbPath:env.WORKBENCH_DB_PATH??'.runtime/synthetic.sqlite',secretFile:env.WORKBENCH_SECRET_FILE??null};
}
// Reads only when the operator explicitly selects owner-secret mode. This build
// does not create, discover, rotate, save, or configure a credential.
export function loadConfiguredSecret(config:Config):Buffer|null {
 if(config.authMode==='loopback-preview')return null;
 if(!config.secretFile)throw Error('owner_secret_setup_required');
 const stat=lstatSync(config.secretFile);if(!stat.isFile()||stat.isSymbolicLink()||(stat.mode&0o077)!==0||stat.size>4096)throw Error('unsafe_owner_secret_file');
 const bytes=readFileSync(config.secretFile);if(bytes.length<32||bytes.length>4096||bytes.includes(10)||bytes.includes(13))throw Error('invalid_owner_secret');return createHash('sha256').update(bytes).digest();
}
const digest=(x:string)=>createHash('sha256').update(x).digest();
export function authenticate(header:string|undefined,config:Config,expectedSecretDigest:Buffer|null):{ownerId:string;assurance:'local_synthetic_preview'|'owner_secret'}|null {
 if(config.authMode==='loopback-preview')return {ownerId:config.ownerId,assurance:'local_synthetic_preview'};
 if(!expectedSecretDigest||!header||header.length>8192)return null;
 let secret:string|undefined;
 if(header.startsWith('Basic ')){try{const credentials=Buffer.from(header.slice(6),'base64').toString('utf8'),colon=credentials.indexOf(':');if(colon===-1||credentials.slice(0,colon)!=='owner')return null;secret=credentials.slice(colon+1);}catch{return null;}}
 else if(header.startsWith('Bearer '))secret=header.slice(7);
 return secret&&timingSafeEqual(digest(secret),expectedSecretDigest)?{ownerId:config.ownerId,assurance:'owner_secret'}:null;
}
export function requestBoundary(req:IncomingMessage,config:Config,boundPort:number):string|null {
 if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress??''))return 'loopback_client_required';
 const host=config.host==='::1'?'[::1]':config.host,authority=host+':'+boundPort;
 if(req.headers.host!==authority)return 'untrusted_host';
 if(req.headers.origin!==undefined&&req.headers.origin!=='http://'+authority)return 'same_origin_required';
 if(req.headers['sec-fetch-site']==='cross-site')return 'same_origin_required';
 if(req.headers['x-forwarded-for']||req.headers['x-forwarded-host']||req.headers.forwarded)return 'proxy_trust_not_configured';
 return null;
}

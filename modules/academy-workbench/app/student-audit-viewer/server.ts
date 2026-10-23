import {createServer} from 'node:http';
import {authenticate,requestBoundary,type Config} from '../standalone/src/server/auth.ts';
import {selectStudent,referenceFor,type Audit,type ReferenceMap} from './model.ts';
import {render} from './view.ts';
import type {PinnedLesson} from './lesson.ts';
export function createViewer(audit:Audit,sha:string,config:Config,secretDigest:Buffer,referenceMap?:ReferenceMap,lesson?:PinnedLesson){
 if(config.authMode!=='owner-secret'||!secretDigest||secretDigest.length!==32)throw Error('owner_auth_required');
 if(config.host!=='127.0.0.1'&&config.host!=='::1')throw Error('external_bind_not_supported');
 const server=createServer((req,res)=>{
  const address=server.address(),port=typeof address==='object'&&address?address.port:config.port;
  res.setHeader('Cache-Control','private, no-store');res.setHeader('Vary','Authorization');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  const send=(status:number,body:string,type='application/json; charset=utf-8')=>{res.writeHead(status,{'Content-Type':type});res.end(body);};
  if(requestBoundary(req,config,port))return send(403,'{"error":"request_boundary_rejected"}');
  if(!authenticate(req.headers.authorization,config,secretDigest)){res.setHeader('WWW-Authenticate','Basic realm="Private academy audit", charset="UTF-8"');return send(401,'{"error":"owner_auth_required"}');}
  if(req.method!=='GET')return send(405,'{"error":"read_only"}');
  let url:URL;try{url=new URL(req.url??'','http://127.0.0.1');}catch{return send(400,'{"error":"invalid_url"}');}
  if(!['/','/api/audit','/source'].includes(url.pathname))return send(404,'{"error":"not_found"}');
  if([...url.searchParams.keys()].some(k=>k!=='studentId')||url.searchParams.getAll('studentId').length>1)return send(400,'{"error":"invalid_query"}');
  const id=url.searchParams.get('studentId')??audit.students[0].studentId;
  let student;try{student=selectStudent(audit,id);}catch{return send(404,'{"error":"student_not_found"}');}
  if(url.pathname==='/source')return send(200,JSON.stringify(referenceFor(audit,id,sha,referenceMap)));
  if(url.pathname==='/api/audit')return send(200,JSON.stringify({schemaVersion:audit.schemaVersion,collectedAt:audit.collectedAt,coverage:audit.coverage,student,sourceMode:'saved_audit',liveSourceQueried:false}));
  return send(200,render(audit,student,sha,lesson),'text/html; charset=utf-8');
 });return server;
}

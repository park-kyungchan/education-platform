import {loadConfiguredSecret,type Config} from '../standalone/src/server/auth.ts';
import {readPinnedAudit} from './model.ts';
import {readPinnedLesson} from './lesson.ts';
import {createViewer} from './server.ts';
// Explicit operator settings only. Never mint/discover/configure credentials.
const env=process.env,path=env.AUDIT_DATA_FILE,sha=env.AUDIT_SHA256,secretFile=env.AUDIT_OWNER_SECRET_FILE;
if(!path||!sha||!secretFile)throw Error('explicit_data_file_hash_and_existing_owner_secret_required');
const host=env.AUDIT_HOST??'127.0.0.1';if(host!=='127.0.0.1'&&host!=='::1')throw Error('external_bind_not_supported');
const port=Number(env.AUDIT_PORT??8790);if(!Number.isInteger(port)||port<1||port>65535)throw Error('invalid_port');
const config:Config={host,port,authMode:'owner-secret',ownerId:'local-owner',dbPath:'unused_read_only_json',secretFile};
const secret=loadConfiguredSecret(config);if(!secret)throw Error('owner_auth_required');
const audit=readPinnedAudit(path,sha);
const lessonPath=env.AUDIT_LESSON_FILE,lessonSha=env.AUDIT_LESSON_SHA256;
if(Boolean(lessonPath)!==Boolean(lessonSha))throw Error('lesson_file_and_hash_required_together');
const lesson=lessonPath&&lessonSha?readPinnedLesson(lessonPath,lessonSha,audit):undefined;
const server=createViewer(audit,sha,config,secret,undefined,lesson);
server.listen(port,host,()=>console.log(JSON.stringify({status:'listening',host,port,mode:'private_saved_audit',liveSourceQueried:false})));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));

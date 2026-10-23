import {startTeacherStdio} from '../src/teacher-server.ts';
import {teacherFixture,sourceRoot} from './teacher-fixture.ts';
const {fetchPage}=await teacherFixture(160);
const scenario=process.argv[2]??'normal';let calls=0;
await startTeacherStdio({sourceRoot,authenticatedFetchPage:async request=>{
  calls++;
  if(scenario==='transport-error')throw Error('DO_NOT_ECHO_PRIVATE_SYNTHETIC_ERROR');
  if(scenario==='refusal')return {schema:'academy.retained-query.v1',status:'refused',code:'owner_scope_conflict',records:[],automaticRetry:false};
  const reply=await fetchPage(request);
  if(scenario==='malformed')return {...reply,extraField:'unexpected'};
  if(reply.status==='page'&&calls===2){
    if(scenario==='snapshot-drift')reply.snapshot='b'.repeat(64);
    if(scenario==='caller-drift')reply.callerBinding='c'.repeat(64);
  }
  return reply;
}});

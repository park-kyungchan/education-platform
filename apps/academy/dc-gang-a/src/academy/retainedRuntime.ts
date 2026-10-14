import {TeacherApplication} from './application';
import type {TeacherStore} from './ports/teacherStore';
import type {SourceRefreshStore} from './ports/sourceRefreshStore';
import type {TrustedTeacherContext} from './contracts/teacherOperations';
import type {AcademySourceConnection} from './nativeConnector';

/** Existing private ledger and teacher commands, with no acquisition or credential consumer. */
export function createRetainedTeacherRuntime(store:TeacherStore&Pick<SourceRefreshStore,'sourceRequestResult'|'pendingSourceRequest'|'sourceRequestHistory'>,ownerId:string){
  if(!ownerId.trim())throw Error('owner_scope_required');
  const connection=():AcademySourceConnection=>({schemaVersion:1,retainedQuery:'available',officialJournalSave:'not_implemented',parentSend:'teacher_owned',
    acquisition:{transport:'direct_http_api',state:'blocked',reason:'retained_only_selected',browserFallback:false}});
  const scope=(actor:TrustedTeacherContext)=>{
    if(actor.ownerId!==ownerId||actor.role!=='teacher')throw Error('owner_scope_conflict');
  };
  return {
    app:new TeacherApplication(store,ownerId,connection),connection,refresh:undefined,
    refreshResult:async(actor:TrustedTeacherContext,id:string)=>{scope(actor);return store.sourceRequestResult(ownerId,actor.actorId,id);},
    refreshPending:async(actor:TrustedTeacherContext)=>{scope(actor);return store.pendingSourceRequest(ownerId,actor.actorId);},
    refreshHistory:async(actor:TrustedTeacherContext,cursor:string|null)=>{scope(actor);return store.sourceRequestHistory(ownerId,actor.actorId,cursor);},
    close:async()=>{},
  };
}

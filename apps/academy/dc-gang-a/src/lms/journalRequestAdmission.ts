import {digest} from '../learning/model';
import {journalHttpActionDigest,type JournalHttpAction,type JournalHttpAdmission} from './lessonJournalHttp';

/** Retrieved by the trusted runtime integration from an actual user event.
 * Never accept this structure, an approval flag or a decision reader in MCP input. */
export interface JournalUserRequestEvidence {
 runtime:string;requestRef:string;requestTextSha256:string;currentUserEventRef:string;
}
export interface JournalRequestOwnerPort {
 /** The integration qualifies current user intent and reads its actual runtime event.
  * It must hold on a changed/cancelled user request, foreign subject or unavailable evidence. */
 readCurrentRequest:()=>Promise<JournalUserRequestEvidence>;
 /** Durable exclusive creation and fsync before dispatch. False means already consumed.
  * This key excludes caller-selected attempt IDs and output directories. */
 consumeOnce:(key:string,record:Readonly<{request:JournalUserRequestEvidence;action:JournalHttpAction;actionDigest:string}>)=>Promise<boolean>;
}
export function createJournalRequestAdmission(input:{request:JournalUserRequestEvidence;actions:readonly JournalHttpAction[];owner:JournalRequestOwnerPort}):JournalHttpAdmission {
 const request=Object.freeze({...input.request});
 if(!request.runtime.trim()||!request.requestRef.trim()||!request.currentUserEventRef.trim()||!/^[a-f0-9]{64}$/.test(request.requestTextSha256))throw Error('journal_actual_user_request_required');
 if(!input.actions.length||input.actions.length>32)throw Error('journal_exact_action_scope_required');
 const admitted=new Set(input.actions.map(journalHttpActionDigest));
 if(admitted.size!==input.actions.length)throw Error('journal_duplicate_action_scope');
 const used=new Set<string>();
 return {consumeApproval:async action=>{
  const actionDigest=journalHttpActionDigest(action);
  if(!admitted.has(actionDigest)||used.has(actionDigest))return {status:'rejected'};
  const actual=await input.owner.readCurrentRequest();
  if(actual.runtime!==request.runtime||actual.requestRef!==request.requestRef||actual.requestTextSha256!==request.requestTextSha256||actual.currentUserEventRef!==request.currentUserEventRef)return {status:'rejected'};
  const identity={requestRef:request.requestRef,runtime:request.runtime,target:action.target,field:action.field,effectRecordKey:action.effectRecordKey,after:action.after};
  const key='journal-request-'+digest(identity);
  const consumed=await input.owner.consumeOnce(key,Object.freeze({request:actual,action:structuredClone(action),actionDigest}));
  used.add(actionDigest);
  return consumed?{status:'verified',actionDigest}:{status:'rejected'};
 }};
}

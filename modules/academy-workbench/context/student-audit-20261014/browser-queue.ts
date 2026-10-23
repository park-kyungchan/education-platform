import {planTabRecovery} from './browser-recovery.ts';
/** Non-authorizing orchestration contract. No browser calls, credentials or runtime locks.
 * The orchestrator must apply this decision BEFORE a tab-recovery or approved retry.
 * A tab is not a separate permission/ownership boundary within one browser connection.
 */
export type BrowserJobId = string;
export interface BrowserQueue {
 connectionId:string;
 activeJob:BrowserJobId|null;
 waitingJobs:BrowserJobId[];
 handoff:{state:'none'}|{state:'pending'|'user_controlling';jobId:BrowserJobId};
 completionBarrier:null|{jobId:BrowserJobId;sourceMessageId:string;release:'explicit_verified_completion_or_user_direction'};
 failedAttempts:number;
 failureReportThreshold:number;
}
export interface BrowserRequest {
 connectionId:string;jobId:BrowserJobId;
 operation:'read'|'navigate'|'recover_tab'|'approved_retry';
 tabId:string|null; // Informational only; changing tabs cannot obtain ownership.
 accessAuthorized:boolean;
}
export type QueueDecision = 'wrong_connection'|'invalid_queue'|'report_blocker_keep_queue'|'wait_for_user_handoff'|'wait_for_explicit_completion'|'wait_for_active_job'|'wait_for_queue_turn'|'verify_action_authority'|'eligible_for_orchestrator_acquire'|'eligible_current_job';
const valid=(q:BrowserQueue)=>Boolean(q.connectionId.trim())&&Number.isInteger(q.failedAttempts)&&q.failedAttempts>=0&&Number.isInteger(q.failureReportThreshold)&&q.failureReportThreshold>0&&new Set(q.waitingJobs).size===q.waitingJobs.length&&!q.waitingJobs.includes(q.activeJob??'')&&(q.handoff.state==='none'||q.handoff.jobId===q.activeJob)&&(!q.completionBarrier||!!q.completionBarrier.jobId&&!!q.completionBarrier.sourceMessageId);
export function assessBrowserQueue(q:BrowserQueue,r:BrowserRequest):{decision:QueueDecision;executionAuthority:'none';browserActionPerformed:false}{
 const result=(decision:QueueDecision)=>({decision,executionAuthority:'none' as const,browserActionPerformed:false as const});
 if(!valid(q)||!r.jobId)return result('invalid_queue');
 if(r.connectionId!==q.connectionId)return result('wrong_connection');
 // Handoff and a user's explicit ordering remain barriers even when retries are authorized.
 if(q.handoff.state!=='none')return result('wait_for_user_handoff');
 if(q.completionBarrier&&q.completionBarrier.jobId!==r.jobId)return result('wait_for_explicit_completion');
 if(q.activeJob!==null&&q.activeJob!==r.jobId)return result('wait_for_active_job');
 if(q.failedAttempts>=q.failureReportThreshold)return result('report_blocker_keep_queue');
 if(q.activeJob===null&&q.waitingJobs.length>0&&q.waitingJobs[0]!==r.jobId)return result('wait_for_queue_turn');
 if(!r.accessAuthorized)return result('verify_action_authority');
 return result(q.activeJob===r.jobId?'eligible_current_job':'eligible_for_orchestrator_acquire');
}
export type QueueTransition =
 | {kind:'job_failed';jobId:string}
 | {kind:'job_completed';jobId:string;outcomeVerified:boolean;evidenceRef:string}
 | {kind:'user_directed_release';jobId:string;sourceMessageId:string}
 | {kind:'handoff_returned';jobId:string;returnVerified:boolean;evidenceRef:string};
export function applyQueueTransition(q:BrowserQueue,t:QueueTransition):BrowserQueue {
 if(!valid(q))throw Error('invalid_queue');
 const next:BrowserQueue={...q,waitingJobs:[...q.waitingJobs],handoff:{...q.handoff},completionBarrier:q.completionBarrier?{...q.completionBarrier}:null};
 if(t.jobId!==q.activeJob)throw Error('not_active_job');
 if(t.kind==='job_failed'){next.failedAttempts++;return next;} // Never silently releases a user barrier.
 if(t.kind==='handoff_returned'){
  if(!t.returnVerified||!t.evidenceRef.trim())throw Error('handoff_return_unverified');
  next.handoff={state:'none'};return next;
 }
 if(q.handoff.state!=='none')throw Error('handoff_still_active');
 if(t.kind==='job_completed'&&(!t.outcomeVerified||!t.evidenceRef.trim()))throw Error('completion_not_verified');
 if(t.kind==='user_directed_release'&&!t.sourceMessageId.trim())throw Error('user_direction_required');
 next.activeJob=null;next.failedAttempts=0;
 if(next.completionBarrier?.jobId===t.jobId)next.completionBarrier=null;
 return next; // Next job is not automatically started or authorized.
}
export const danielBeforeAcademy:BrowserQueue={
 connectionId:'same-approved-cloud-browser',activeJob:'daniel-prayer-readonly',waitingJobs:['academy-readonly'],handoff:{state:'none'},
 completionBarrier:{jobId:'daniel-prayer-readonly',sourceMessageId:'Sentinel_6a8f88775f8c8191acc4697100f11262',release:'explicit_verified_completion_or_user_direction'},
 failedAttempts:0,failureReportThreshold:2,
};

/** Queue first, then the existing permission-aware recovery planner. */
export function planQueuedTabRecovery(q:BrowserQueue,r:BrowserRequest,recovery:Parameters<typeof planTabRecovery>[0]){
 const queue=assessBrowserQueue(q,r);
 if(queue.decision!=='eligible_current_job')return {queue:queue.decision,recovery:null,executionAuthority:'none' as const};
 return {queue:queue.decision,recovery:planTabRecovery(recovery),executionAuthority:'none' as const};
}

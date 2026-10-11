import {z} from 'zod';
import {OperationalId,OperationalRevision,ActionKind} from '../domain/operational-context.ts';
import type {OperatingContext} from '../schema/academy-operating-context.ts';
import {selectOperationalContext} from './select-operational-context.ts';

const Request=z.strictObject({policyId:OperationalId,actionKind:ActionKind,expectedRevision:OperationalRevision,actualAssignmentConfirmed:z.boolean(),triggerEvidenceAvailable:z.boolean()});
/** A preparation result only. No authorization, adapter or execution is supplied here. */
export function planOperationalAction(context:OperatingContext,revision:OperationalRevision,input:unknown){
 const request=Request.parse(input),view=selectOperationalContext(context,revision,{policyIds:[request.policyId],expectedRevision:request.expectedRevision}),policy=context.nodes.find(n=>n.id===request.policyId&&n.kind==='policy');
 if(!policy||policy.kind!=='policy')throw Error('policy_missing');
 const blockers:string[]=[];
 if(policy.lifecycle!=='active')blockers.push('policy_not_active');
 if(policy.applicability.requiresActualAssignment&&!request.actualAssignmentConfirmed)blockers.push('actual_assignment_unconfirmed');
 if(!request.triggerEvidenceAvailable)blockers.push('actual_trigger_unconfirmed');
 if(request.actionKind==='teacher_judgment')blockers.push('authorized_teacher_judgment_required');
 if(!['read_reference','prepare'].includes(request.actionKind))blockers.push('current_task_authorization_and_verified_adapter_required');
 if(request.policyId==='D-A06'&&request.actionKind==='communicate')blockers.push('assistant_may_only_remind_user');
 return {kind:'preparation_only' as const,executionAllowed:false as const,preparationReady:blockers.length===0,blockers,view};
}

import {z} from 'zod';
import {EventId,Instant,Sha256} from '../domain/ids.ts';
import {OperationalId} from '../domain/operational-context.ts';
import {OperatingContext,OperatingManifest} from '../schema/academy-operating-context.ts';
import {validateOperationalContext} from '../application/validate-operational-context.ts';
import {hashCanonical,deepFreeze} from './event-log.ts';

export const OperationalAuditEvent=z.strictObject({eventId:EventId,checkpointId:OperationalId,expectedHead:Sha256,payloadSha256:Sha256,recordedAt:Instant,kind:z.enum(['checkpoint_appended','checkpoint_corrected','checkpoint_retracted']),correctionOfEventId:EventId.nullable(),context:OperatingContext,manifest:OperatingManifest}).superRefine((e,c)=>{
 if(e.checkpointId!==e.context.checkpointId||e.manifest.checkpointId!==e.checkpointId)c.addIssue({code:'custom',message:'operational_audit_scope_mismatch'});
 if((e.kind==='checkpoint_appended')!==(e.correctionOfEventId===null))c.addIssue({code:'custom',message:'operational_correction_target_required'});
});
export type OperationalAuditEvent=z.infer<typeof OperationalAuditEvent>;
export async function appendOperationalAuditEvent(current:Readonly<{checkpointId:OperationalId;head:Sha256;events:readonly OperationalAuditEvent[]}>,input:unknown){
 const event=OperationalAuditEvent.parse(input);validateOperationalContext(event.context,event.manifest);
 if(event.checkpointId!==current.checkpointId)throw Error('operational_audit_scope_mismatch');if(event.expectedHead!==current.head)throw Error('revision_conflict');
 if(current.events.some(e=>e.eventId===event.eventId))throw Error('duplicate_operational_audit_event');
 if(event.correctionOfEventId&&!current.events.some(e=>e.eventId===event.correctionOfEventId))throw Error('operational_correction_target_missing');
 if(await hashCanonical({context:event.context,manifest:event.manifest})!==event.payloadSha256)throw Error('operational_payload_hash_mismatch');
 if(current.events.some(e=>e.payloadSha256===event.payloadSha256)&&event.kind!=='checkpoint_retracted')throw Error('duplicate_operational_revision');
 return deepFreeze({checkpointId:current.checkpointId,head:await hashCanonical(event),events:structuredClone([...current.events,event])});
}

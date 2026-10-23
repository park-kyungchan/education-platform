import {z} from 'zod';
import {validateEvents,MODEL_VERSION,type Event} from '../domain/student-events.ts';
import {canonical,digest,type Append,type AuthorizedScope} from './durable-ledger.ts';
const id=z.string().regex(/^stu_[a-f0-9]{32}$/),hash=z.string().regex(/^[a-f0-9]{64}$/),short=z.string().min(1).max(500),instant=z.iso.datetime({offset:true});
const ref=z.strictObject({kind:z.enum(['activity','paper_artifact','assignment','session','unresolved_scope']),id:short,namespace:z.literal('academy_private'),studentId:id,nativeIdentityVerified:z.literal(false)});
const due=z.strictObject({date:z.iso.date().nullable(),time:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),timezone:z.literal('Asia/Seoul'),resolution:z.enum(['source_explicit','anchored_relative','unresolved']),raw:short.nullable(),anchorDate:z.iso.date().nullable()});
const capturedBundle=z.strictObject({captureKind:z.literal('unresolved_capture_bundle'),orderedItemLabels:z.array(z.string().regex(/^[0-9]{1,16}$/)).min(1).max(200),labelsSource:z.literal('user_report'),clinicKind:z.enum(['similar','error','mixed_or_unspecified']),rawHeader:z.null(),canonicalHeader:z.null(),headerBoundaries:z.null(),paperCount:z.null(),generatedAt:z.null(),printedAt:z.null(),custodyRaw:short.nullable(),assessmentLink:z.null(),representsSinglePrintInstance:z.literal(false),serverMembershipIndependentlyVerified:z.literal(false)});
const claim=z.discriminatedUnion('kind',[
 z.strictObject({kind:z.literal('reference_observation'),referenceKind:z.literal('paper_item_membership'),details:capturedBundle}),
 z.strictObject({kind:z.literal('assignment_assertion'),status:z.enum(['planned','teacher_confirmed','issued_user_report','cancelled']),due,submissionFormatRaw:short.nullable(),basisItemCount:z.number().int().nonnegative().max(10000).nullable(),actualWrongItemLabels:z.array(z.string().regex(/^[0-9]{1,16}$/)).max(200).nullable(),additionalLabels:z.array(z.string().regex(/^[0-9]{1,16}$/)).max(200).nullable()}),
 z.strictObject({kind:z.literal('stage_assertion'),stage:z.enum(['requested','generated','printed','prepared','distributed','solved','grading_local','grading_lms_entry','correction','teacher_review','video_filmed','video_uploaded','dailyrecord_prepared','dailyrecord_recorded','parent_message_sent','handoff_sent','handoff_received','attendance_arrived','attendance_departed']),state:z.enum(['unknown','planned','in_progress','complete','incomplete','not_performed','conditional','cancelled']),ownerRaw:short.nullable(),conditionRaw:short.nullable()}),
 z.strictObject({kind:z.literal('schedule_assertion'),scheduleKind:z.enum(['arrival','absence','departure','makeup']),date:z.iso.date(),startsLocal:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),endsLocal:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),approximate:z.boolean(),status:z.enum(['planned','confirmed_schedule','cancelled'])})
]);
export const inputSchema=z.strictObject({studentId:id,expectedRevision:z.number().int().nonnegative(),expectedHeadHash:hash,requestId:z.string().regex(/^[a-zA-Z0-9:_-]{1,120}$/),evidence:z.strictObject({kind:z.literal('user_report'),sourceMessageId:z.string().regex(/^(?:Sentinel_[a-f0-9]+|[^\s]{1,160}~[^\s]{1,160})$/),quote:z.string().min(1).max(12000),reportedAt:instant.nullable(),collectedAt:instant}),claims:z.array(z.strictObject({target:ref,scopeId:short,scopeDescription:short,claim,occurredAt:instant.nullable(),occurredDate:z.iso.date().nullable(),scheduledFor:instant.nullable(),supersedes:z.array(z.string().regex(/^evt_[a-f0-9]{64}$/)).max(10)})).min(1).max(20)});
export const APPEND_TOOL={name:'academy_append_user_reports',description:'Append bounded user-reported student observations or teacher reports to the private Site ledger. Requires existing owner/managed-student authorization and an original user-message reference plus minimal quote. Saves unverified user-reported evidence; never upgrades it to directly verified server evidence. Does not change the academy server, print, grade, send messages, or infer completion. Corrections preserve originals using same-fact supersedes. This tool changes persistent Site data.',annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false},inputSchema:z.toJSONSchema(inputSchema)};
/** Authorization is supplied by existing platform owner/managed-student gates, never by input flags. */
export interface Dependencies {authorizeWrite:(scope:AuthorizedScope)=>Promise<boolean>;}
const forbidden=/(?:\bBearer\s+[A-Za-z0-9._-]+|\b(?:password|passwd|cookie|authorization|api[_-]?key|access[_-]?token)\s*[:=]|-----BEGIN .*PRIVATE KEY-----|sk-[A-Za-z0-9_-]{15,})/i;
export async function prepareOngoingAppend(raw:unknown,scope:AuthorizedScope,current:readonly Event[],deps:Dependencies):Promise<Append>{
 const input=inputSchema.parse(raw);
 if(!scope.managedStudentGateVerified||scope.studentId!==input.studentId||!await deps.authorizeWrite(scope))throw Error('write_not_authorized');
 if(input.claims.some(c=>c.target.studentId!==input.studentId))throw Error('cross_student_target');
 if(forbidden.test(canonical(input)))throw Error('possible_secret_rejected');
 const evidence=input.evidence;
 // Message reference and quote are preserved assertions, not proof of original-message authenticity.
 // No arbitrary URL retrieval or instructions inside quotes are executed.
 const events:Event[]=[];
 for(const [index,c] of input.claims.entries()){
  if(c.claim.kind==='reference_observation'&&(c.target.kind!=='unresolved_scope'||c.supersedes.length!==0||c.occurredAt!==null||c.scheduledFor!==null))throw Error('unresolved_bundle_must_preserve_original');
  if(c.claim.kind==='assignment_assertion'&&c.target.kind!=='assignment')throw Error('assignment_target_required');
  if(c.claim.kind==='assignment_assertion'&&c.claim.status==='planned'&&c.occurredAt!==null)throw Error('planned_assignment_has_actual_clock');
  if(c.claim.kind==='schedule_assertion'&&c.occurredAt!==null)throw Error('schedule_is_not_actual');
  if(c.claim.kind==='stage_assertion'&&['planned','conditional','not_performed','unknown','cancelled'].includes(c.claim.state)&&c.occurredAt!==null)throw Error('non_actual_stage_has_actual_clock');
  const base={schemaVersion:MODEL_VERSION,studentId:input.studentId,target:c.target,scope:{scopeId:c.scopeId,studentId:input.studentId,bookEdition:null,units:[],items:[],rawDescription:c.scopeDescription,identityState:'user_reported' as const,coverage:'unknown' as const},provenance:{kind:'user_report_relay' as const,originalKind:'user_report' as const,pageId:null,pageSequence:null,blockId:null,blockHash:null,sourceMessageId:evidence.sourceMessageId,sourceReference:evidence.sourceMessageId,rawEvidenceQuote:evidence.quote,originalReceiptVerifiedHere:false},clocks:{occurredAt:c.occurredAt,occurredDate:c.occurredDate,sourceObservedAt:null,sourceReportedAt:evidence.reportedAt,collectedAt:evidence.collectedAt,sourceTimeRaw:null,sourceTimePrecision:c.occurredAt?'instant' as const:c.occurredDate?'date' as const:'unknown' as const,scheduledFor:c.scheduledFor},supersedes:c.supersedes,eligibility:'adopted_preserved_evidence' as const,...c.claim,...(c.claim.kind==='schedule_assertion'?{actualOccurredAt:null}: {})};
  const eventId='evt_'+await digest(canonical({requestId:input.requestId,index,base}));events.push({...base,eventId} as Event);
 }
 validateEvents([...current,...events.filter(e=>!current.some(old=>old.eventId===e.eventId))]);
 return {expectedRevision:input.expectedRevision,expectedHeadHash:input.expectedHeadHash,requestId:input.requestId,events,evidenceSource:'unverified_user_report:'+evidence.sourceMessageId};
}

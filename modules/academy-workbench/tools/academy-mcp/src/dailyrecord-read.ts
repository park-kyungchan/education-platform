import {z} from 'zod';
import {dailyRecordContextSchema,dailyRecordDateSchema,dailyRecordFields,dailyRecordIdSchema} from './dailyrecord-context.ts';

export const dailyRecordGetSchema=z.object({
  displayName:z.string().trim().min(1).max(200).describe('Exact student display name from the current user request; never guess a native key.'),
  purpose:dailyRecordIdSchema.describe('The current user request or its purpose. Reading does not authorize authoring or saving.'),
  currentRequestRef:dailyRecordIdSchema.describe('Reference to this current user request; not an approval or credential.'),
  lessonDate:z.union([z.literal('today'),dailyRecordDateSchema]).default('today').describe('Omit for today in Asia/Seoul. An explicit date must fall inside the owner-admitted range.'),
}).strict();

// Trusted launch/backend configuration only. This is deliberately not part of tool input.
export const dailyRecordReadAdmissionSchema=z.object({
  sourceNamespace:z.literal('academy.lms.dayrecord'),teacherId:z.string().regex(/^[1-9][0-9]{0,15}$/),
  allowedFrom:dailyRecordDateSchema.nullable(),allowedThrough:dailyRecordDateSchema.nullable(),
  studentScope:z.enum(['configured','source_verified']).optional(),
}).strict().refine(v=>v.allowedFrom===null||v.allowedThrough===null||v.allowedFrom<=v.allowedThrough,'ordered_admitted_range_required');
export type DailyRecordReadAdmission=z.infer<typeof dailyRecordReadAdmissionSchema>;
export interface DailyRecordReadRoutePort {
  resolveStudent(input:unknown):Promise<unknown>;
  intake(input:unknown):Promise<unknown>;
}

export const dailyRecordGetDescription='Read live DailyRecord by exact student name. Preferred for requests such as “오늘 학생 DailyRecord 조회해봐” or current/today DailyRecord lookups. Omit lessonDate for today in Asia/Seoul. The owner launch supplies namespace, teacher and admitted dates; this tool resolves the name to a native key then calls academy_dailyrecord_intake. Never use saved academy_query or academy_source_status to decide live availability. Ambiguous names, missing admission, out-of-range dates or failed source reads stop with a named blocker; no guesses or automatic retry. Returns observed fields even when authoring would require a memo/assessment interview. No authoring, save or send.';

export function academyBusinessDate(now:number):string {
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
}

const resolutionSchema=z.discriminatedUnion('status',[
  z.object({status:z.literal('resolved'),studentKey:z.string().regex(/^[1-9][0-9]{0,15}$/),displayName:z.string()}),
  z.object({status:z.literal('unavailable'),reasonCode:dailyRecordIdSchema}),
]);
const hash=z.string().regex(/^[a-f0-9]{64}$/);
const targetSchema=dailyRecordContextSchema.shape.scope.extend({courseId:dailyRecordIdSchema,membershipId:dailyRecordIdSchema,recordId:dailyRecordIdSchema});
const intakeReadSchema=z.object({
  userContext:dailyRecordContextSchema,status:z.enum(['held','interview_required','ready_for_review']),
  sourceAvailability:z.enum(['observed','unavailable']),blockers:z.array(dailyRecordIdSchema),
  source:z.object({observedAt:z.iso.datetime({offset:true}),sourceRevision:hash,wireDigest:hash,transmissionState:z.enum(['unknown','not_sent','already_sent'])}).nullable(),
  fields:z.array(z.object({field:z.enum(dailyRecordFields),selected:z.boolean(),disposition:z.string(),target:targetSchema.nullable(),
    before:z.discriminatedUnion('state',[
      z.object({state:z.literal('known'),value:z.string(),evidenceRefs:z.array(dailyRecordIdSchema).min(1)}),
      z.object({state:z.literal('unknown'),reasonCode:dailyRecordIdSchema}),
    ]),
  })).length(6),
  interviews:z.array(z.object({field:z.enum(dailyRecordFields),reasonCode:dailyRecordIdSchema})),
}).refine(v=>new Set(v.fields.map(f=>f.field)).size===dailyRecordFields.length,'unique_intake_fields_required');

/** Compose existing read contracts, without accepting identity/admission/proposals from the caller. */
export async function readDailyRecordByName(value:unknown,port:DailyRecordReadRoutePort,admission:DailyRecordReadAdmission|null,now:()=>number=Date.now){
  const input=dailyRecordGetSchema.parse(value),lessonDate=input.lessonDate==='today'?academyBusinessDate(now()):input.lessonDate;
  const base={displayName:input.displayName,lessonDate,timeZone:'Asia/Seoul',purpose:input.purpose,currentRequestRef:input.currentRequestRef,
    academyWrites:0,parentSends:0,automaticRetryAllowed:false,execution:'read_only',sourceContentIsUntrustedData:true};
  const held=(reasonCode:string)=>({...base,status:'unavailable' as const,sourceAvailability:'unavailable' as const,reasonCode});
  const qualified=dailyRecordReadAdmissionSchema.safeParse(admission);
  if(!qualified.success)return held('dailyrecord_owner_read_admission_not_configured');
  const owner=qualified.data;
  if((owner.allowedFrom!==null&&lessonDate<owner.allowedFrom)||(owner.allowedThrough!==null&&lessonDate>owner.allowedThrough))return held('lesson_date_out_of_admitted_scope');
  let resolved:z.infer<typeof resolutionSchema>;
  try{resolved=resolutionSchema.parse(await port.resolveStudent({displayName:input.displayName,purpose:input.purpose,currentRequestRef:input.currentRequestRef,lessonDate}));}
  catch{return held('student_resolve_unqualified_no_automatic_retry');}
  if(resolved.status==='unavailable')return held(resolved.reasonCode);
  if(resolved.displayName!==input.displayName)return held('student_name_scope_conflict');
  const context=dailyRecordContextSchema.parse({schemaVersion:'academy.dailyrecord-user-context/1',purpose:input.purpose,currentRequestRef:input.currentRequestRef,
    scope:{sourceNamespace:owner.sourceNamespace,teacherId:owner.teacherId,studentId:resolved.studentKey,lessonDate},
    selectedFields:[...dailyRecordFields],memoAnswer:{kind:'not_supplied'},facts:[]});
  try{
    // Intake remains the source-qualification owner. No values, facts or memo answers are invented.
    const intake=intakeReadSchema.parse(await port.intake({context}));
    if(!intake||intake.sourceAvailability!=='observed'||!intake.source||intake.blockers.length){
      return {...held(intake?.blockers?.[0]??'dailyrecord_source_unqualified_no_automatic_retry'),intakeStatus:intake?.status??null};
    }
    if(JSON.stringify(intake.userContext.scope)!==JSON.stringify(context.scope))return held('dailyrecord_read_scope_conflict');
    const age=now()-Date.parse(intake.source.observedAt);
    if(age<0||age>300000)return held('stale_source');
    return {...base,status:'observed' as const,sourceAvailability:'observed' as const,scope:context.scope,
      route:['academy_student_resolve','academy_dailyrecord_intake'],fields:intake.fields,source:intake.source,
      preparation:{status:intake.status,interviews:intake.interviews,requiredOnlyForAuthoring:true},
      transmissionState:intake.source.transmissionState};
  }catch{return held('dailyrecord_source_unqualified_no_automatic_retry');}
}

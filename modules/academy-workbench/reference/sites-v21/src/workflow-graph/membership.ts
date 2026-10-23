import {z} from 'zod';
import {deepFreeze,sha256} from './primitives.ts';

const Id=z.string().min(1).max(512),Hash=z.string().regex(/^[a-f0-9]{64}$/);
export const AcademyLocalDate=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{const t=Date.parse(value+'T00:00:00Z');return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===value;},'invalid_academy_local_date');
export const IsoWeekday=z.enum(['MO','TU','WE','TH','FR','SA','SU']);
const uniqueIds=z.array(Id).refine(values=>new Set(values).size===values.length,'duplicate_id');
export const EnrollmentWeekdayPattern=z.strictObject({label:Id,isoWeekdays:z.array(IsoWeekday).min(1).refine(values=>new Set(values).size===values.length,'duplicate_weekday')});
const SessionOrdinal=z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const ClassMembership=z.strictObject({studentId:Id,displayName:Id,studentPageId:Id,enrollmentWeekdayPattern:EnrollmentWeekdayPattern,sessionOrdinal:SessionOrdinal,confirmedAsOf:AcademyLocalDate,effectiveFrom:AcademyLocalDate.nullable(),effectiveTo:AcademyLocalDate.nullable(),evidenceKind:z.literal('user_confirmation'),liveVerified:z.literal(false),siteStudentId:z.null()}).superRefine((membership,context)=>{
 if(membership.effectiveFrom&&membership.effectiveTo&&membership.effectiveFrom>membership.effectiveTo)context.addIssue({code:'custom',message:'invalid_membership_effective_period'});
});
export const MembershipCorrection=z.strictObject({
 $schema:Id,schemaVersion:z.literal('1.0.0'),kind:z.literal('class_membership_correction'),
 source:z.strictObject({kind:z.literal('user_confirmation'),messageRef:Id,receivedAt:z.string().datetime({offset:true}),userStatementDate:AcademyLocalDate,quote:Id}),
 scope:z.strictObject({studentIds:uniqueIds,completeAcademyRoster:z.literal(false)}),
 selectionRule:z.strictObject({dateFieldSemantics:z.literal('academy_local_calendar_date'),weekdaySystem:z.literal('ISO_8601'),predicates:z.tuple([z.literal('date_weekday_in_enrollmentWeekdayPattern.isoWeekdays'),z.literal('sessionOrdinal_equals_requested_session')]),cohortKeyFields:z.tuple([z.literal('classDate'),z.literal('sessionOrdinal')]),patternLabelIsCohortKey:z.literal(false),attendanceInferred:z.literal(false),sharedCurriculumInferred:z.literal(false),missingLiveGroupRowNegatesUserConfirmation:z.literal(false)}),
 memberships:z.array(ClassMembership).min(1),
 derivedExample:z.strictObject({classDate:AcademyLocalDate,isoWeekday:IsoWeekday,scope:z.literal('explicitly_confirmed_students_only'),cohorts:z.array(z.strictObject({sessionOrdinal:SessionOrdinal,studentIds:uniqueIds})),basis:z.literal('derived_from_user_confirmation'),attendanceState:z.literal('not_assessed')}),
 implementationStatus:z.literal('specification_only')
});
export type MembershipCorrection=z.infer<typeof MembershipCorrection>;
export type ClassMembership=z.infer<typeof ClassMembership>;
export const MEMBERSHIP_SOURCE_PIN=deepFreeze({sha256:'60ca4af6e8092de654926e971b2ad6b479f8f96c9522cbe19f11561f4a622b06',bytes:4184,sourceMessageId:'export-redacted-message',confirmedAsOf:'2026-10-12'} as const);
export function isoWeekdayForDate(date:string):z.infer<typeof IsoWeekday>{const valid=AcademyLocalDate.parse(date);return (['SU','MO','TU','WE','TH','FR','SA'] as const)[new Date(valid+'T00:00:00Z').getUTCDay()];}
export function validateMembershipCorrection(input:unknown){
 const correction=MembershipCorrection.parse(input),ids=correction.memberships.map(membership=>membership.studentId);
 if(new Set(ids).size!==ids.length||ids.length!==correction.scope.studentIds.length||ids.some(id=>!correction.scope.studentIds.includes(id)))throw Error('membership_student_scope_mismatch');
 if(new Set(correction.memberships.map(membership=>membership.studentPageId)).size!==ids.length)throw Error('duplicate_membership_page_binding');
 if(correction.memberships.some(membership=>membership.confirmedAsOf!==correction.source.userStatementDate))throw Error('membership_confirmation_date_mismatch');
 const example=correction.derivedExample;
 if(example.classDate!==correction.source.userStatementDate)throw Error('membership_example_must_use_confirmation_date');
 if(isoWeekdayForDate(example.classDate)!==example.isoWeekday)throw Error('membership_example_weekday_mismatch');
 const expected=new Map<number,string[]>();
 for(const membership of correction.memberships){
  if(membership.enrollmentWeekdayPattern.isoWeekdays.includes(example.isoWeekday))expected.set(membership.sessionOrdinal,[...(expected.get(membership.sessionOrdinal)??[]),membership.studentId]);
 }
 if(new Set(example.cohorts.map(cohort=>cohort.sessionOrdinal)).size!==example.cohorts.length||example.cohorts.length!==expected.size||example.cohorts.some(cohort=>JSON.stringify([...cohort.studentIds].sort())!==JSON.stringify([...(expected.get(cohort.sessionOrdinal)??[])].sort())))throw Error('membership_example_cohort_mismatch');
 return correction;
}
const Roster=z.array(z.strictObject({id:Id,pageId:Id,displayName:Id,managementState:z.enum(['active','inactive'])})).min(1);
export type MembershipRoster=z.infer<typeof Roster>;
const RosterRevision=z.strictObject({rosterRevision:Id,rosterSourceSha256:Hash});
export type MembershipRosterRevision=z.infer<typeof RosterRevision>;
const bindings=new WeakMap<object,{correction:MembershipCorrection;roster:MembershipRoster;rosterRevision:MembershipRosterRevision}>();
const verifiedMembership:unique symbol=Symbol('verified_membership_source');
export type VerifiedMemberships=Readonly<{readonly [verifiedMembership]:true;sourceSha256:string;confirmedAsOf:string;rosterRevision:string;rosterSourceSha256:string}>;
/** Callers supply only the separately gated roster fields. Names are labels,
 * never identity join keys; source ID and source page must both match exactly. */
export async function loadConfirmedMemberships(sourceBytes:Uint8Array,rosterInput:unknown,rosterRevisionInput:unknown):Promise<VerifiedMemberships>{
 const sourceSnapshot=Uint8Array.from(sourceBytes),roster=Roster.parse(rosterInput),rosterRevision=RosterRevision.parse(rosterRevisionInput);
 if(sourceSnapshot.byteLength!==MEMBERSHIP_SOURCE_PIN.bytes||await sha256(sourceSnapshot)!==MEMBERSHIP_SOURCE_PIN.sha256)throw Error('membership_source_bytes_mismatch');
 const correction=validateMembershipCorrection(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(sourceSnapshot)));
 if(new Set(roster.map(student=>student.id)).size!==roster.length||new Set(roster.map(student=>student.pageId)).size!==roster.length)throw Error('duplicate_membership_roster_binding');
 for(const membership of correction.memberships){
  const student=roster.find(student=>student.id===membership.studentId);
  if(!student||student.pageId!==membership.studentPageId||student.managementState!=='active')throw Error('membership_exact_student_binding_required');
 }
 const result=Object.freeze({[verifiedMembership]:true as const,sourceSha256:MEMBERSHIP_SOURCE_PIN.sha256,confirmedAsOf:correction.source.userStatementDate,...rosterRevision}) as VerifiedMemberships;
 bindings.set(result,{correction,roster,rosterRevision});return result;
}
const CohortRequest=z.strictObject({date:AcademyLocalDate,session:z.union([z.literal('all'),SessionOrdinal]).default('all')});
function dateApplicability(membership:ClassMembership,date:string){
 if(membership.effectiveFrom&&date<membership.effectiveFrom||membership.effectiveTo&&date>membership.effectiveTo)return 'outside_explicit_effective_period' as const;
 if(!membership.effectiveFrom&&date<membership.confirmedAsOf)return 'historical_start_unknown' as const;
 if(date===membership.confirmedAsOf)return 'user_confirmed_as_of_date' as const;
 if(membership.effectiveFrom&&membership.effectiveTo)return 'within_explicit_effective_period' as const;
 return 'projected_pattern_not_date_verified' as const;
}
export function deriveDateCohorts(verified:VerifiedMemberships,input:unknown){
 const context=bindings.get(verified);if(!context)throw Error('verified_membership_source_required');
 const request=CohortRequest.parse(input),weekday=isoWeekdayForDate(request.date),{correction,roster}=context;
 const unverified:Array<{studentId:string;reason:string}>=[];
 const sessions=request.session==='all'?[...new Set(correction.memberships.map(membership=>membership.sessionOrdinal))].sort((a,b)=>a-b):[request.session];
 const cohorts=sessions.map(ordinal=>{
  const members=correction.memberships.filter(membership=>membership.sessionOrdinal===ordinal&&membership.enrollmentWeekdayPattern.isoWeekdays.includes(weekday)).flatMap(membership=>{
   const applicability=dateApplicability(membership,request.date);
   if(applicability==='historical_start_unknown'||applicability==='outside_explicit_effective_period'){unverified.push({studentId:membership.studentId,reason:applicability});return [];}
   const student=roster.find(student=>student.id===membership.studentId)!;
   return [{studentId:student.id,sourceStudentId:membership.studentId,studentPageId:membership.studentPageId,displayName:student.displayName,sourceDisplayName:membership.displayName,enrollmentWeekdayPattern:membership.enrollmentWeekdayPattern,sessionSlot:{ordinal:membership.sessionOrdinal,startTime:null,endTime:null},confirmedAsOf:membership.confirmedAsOf,effectiveFrom:membership.effectiveFrom,effectiveTo:membership.effectiveTo,applicability,identityBindingBasis:'exact_source_student_id_and_page_id' as const,evidenceKind:'user_confirmation' as const,liveVerified:false as const}];
  });
  return {cohortKey:request.date+'/session/'+ordinal,classDate:request.date,sessionSlot:{ordinal,startTime:null,endTime:null},members,attendanceState:'not_assessed' as const,sharedCurriculumState:'not_inferred' as const,taskCount:null,emptyMeansNoClass:false as const};
 });
 const knownIds=new Set(correction.scope.studentIds);
 return deepFreeze({schemaVersion:'academy.date-cohort/1.0.0' as const,classDate:request.date,timezone:'Asia/Seoul' as const,isoWeekday:weekday,basis:'derived_from_user_confirmation' as const,source:{kind:'user_confirmation' as const,messageRef:correction.source.messageRef,receivedAt:correction.source.receivedAt,confirmedAsOf:correction.source.userStatementDate,sha256:verified.sourceSha256},rosterRevision:context.rosterRevision,cohorts,unverified,coverage:{completeAcademyRoster:false as const,confirmedStudentCount:correction.scope.studentIds.length,unconfirmedStudentIds:roster.filter(student=>student.managementState==='active'&&!knownIds.has(student.id)).map(student=>student.id),liveLmsQueryPerformed:false as const,attendanceInferred:false as const,absenceProvesMissingHomework:false as const,dateSpecificChangesVerified:false as const}});
}

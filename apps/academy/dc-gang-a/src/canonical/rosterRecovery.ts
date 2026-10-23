import {assertExactKeys,assertInstant,assertRefs,canonicalJson,stableId} from '../learning/model';
import {readLiteralKey,readLiteralName} from '../lms/academyReadProtocol';
import {readInputRecord} from '../contracts/readInputRecord';
import type {StoredStudent} from '../academy/postgresStore';
import type {CanonicalRosterData} from './canonicalRegistry';
export const recoveredRosterVersion='retained-identities-1';
interface RecoveryOwner {ownerId:string;teacherSourceKey:string;collegeSourceKey:string;teacherLabel:string;expectedStudentNames:readonly string[]}
export interface RecoveredRoster extends CanonicalRosterData {
 reconstruction:{kind:'retained_source_identity_reconstruction';observedAt:string;ownerId:string;collegeKey:string;currentEnrollmentQualified:false;liveAuthenticationQualified:false;groupScheduleQualified:false;source:'protected_product_student_registrations';bindings:StoredStudent[]};
}
/** A user-admitted local reconstruction. Original bindings remain evidence, never fresh enrollment/authentication. */
export function reconstructRoster(config:RecoveryOwner,students:readonly StoredStudent[],observedAt:string):RecoveredRoster{
 canonicalJson({config,students,observedAt});assertInstant(observedAt);readLiteralKey(config.teacherSourceKey);readLiteralKey(config.collegeSourceKey);readLiteralName(config.teacherLabel);
 if(config.ownerId!==stableId('owner','academy_instructor',config.collegeSourceKey,config.teacherSourceKey))throw Error('recovery_owner_conflict');
 if(!Array.isArray(config.expectedStudentNames)||!config.expectedStudentNames.length||config.expectedStudentNames.length>64||new Set(config.expectedStudentNames).size!==config.expectedStudentNames.length||students.length!==config.expectedStudentNames.length)throw Error('recovery_cohort_conflict');
 config.expectedStudentNames.forEach(readLiteralName);const seen=new Set<string>(),names=new Set<string>();
 for(const row of students){
  assertExactKeys(row,['ownerId','id','displayName','sourceKey','proofRefs','registeredAt']);assertExactKeys(row.sourceKey,['namespace','literalKey']);
  readLiteralKey(row.sourceKey.literalKey);readLiteralName(row.displayName);assertRefs(row.proofRefs);assertInstant(row.registeredAt);
  if(!row.proofRefs.length||row.ownerId!==config.ownerId||row.sourceKey.namespace!=='academy_student'||row.id!==stableId('student','academy_student',config.ownerId,row.sourceKey.literalKey)||!config.expectedStudentNames.includes(row.displayName)||seen.has(row.sourceKey.literalKey)||names.has(row.displayName)||Date.parse(row.registeredAt)>Date.parse(observedAt))throw Error('recovery_student_binding_conflict');
  seen.add(row.sourceKey.literalKey);names.add(row.displayName);
 }
 return {version:recoveredRosterVersion,academy:null,branch:null,teacher:{teacherPriNo:config.teacherSourceKey,teacherId:null,name:config.teacherLabel,academy:null,branch:null,sheetTabGid:null},groups:{},
  students:students.map(row=>({studentId:row.sourceKey.literalKey,name:row.displayName,loginId:null,grade:null,schoolGrade:null,group:null,groupId:null,groupName:null,courseSeq:null,cmSeq:null,primaryBook:null,secondaryBook:null,isTest:false})),
  reconstruction:{kind:'retained_source_identity_reconstruction',observedAt,ownerId:config.ownerId,collegeKey:config.collegeSourceKey,currentEnrollmentQualified:false,liveAuthenticationQualified:false,groupScheduleQualified:false,source:'protected_product_student_registrations',bindings:structuredClone([...students])}};
}
/** Boundary-check the entire generated format, including unknown fields and source identity correspondence. */
export function validateRecoveredRoster(input:unknown):RecoveredRoster{
 const value=readInputRecord(input),evidence=readInputRecord(value.reconstruction),teacher=readInputRecord(value.teacher);
 const expected=reconstructRoster({ownerId:evidence.ownerId as string,collegeSourceKey:evidence.collegeKey as string,teacherSourceKey:teacher.teacherPriNo as string,teacherLabel:teacher.name as string,expectedStudentNames:(evidence.bindings as StoredStudent[]).map(row=>row.displayName)},evidence.bindings as StoredStudent[],evidence.observedAt as string);
 if(canonicalJson(expected)!==canonicalJson(value))throw Error('recovered_roster_integrity_conflict');return expected;
}

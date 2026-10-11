import {assertExactKeys,assertInstant,canonicalJson,digest,stableId} from '../src/learning/model';
import {readInputRecord,readLiteralKey,readLiteralName} from '../src/lms/academyReadProtocol';
import {validateRecoveredRoster} from '../src/canonical/rosterRecovery';
/** Fresh source-qualification intake, not expiry override, enrollment proof, deployment or a business-effect grant. */
export function validateDirectQualificationResume(input:unknown,now=new Date().toISOString()){
 const value=readInputRecord(input);canonicalJson(value);assertExactKeys(value,['profile','owner','roster','authentication']);
 if(value.profile!=='dc-gang-a-dev')throw Error('active_profile_required');
 const owner=readInputRecord(value.owner);assertExactKeys(owner,['ownerId','teacherSourceKey','collegeSourceKey','teacherLabel','expectedStudentNames']);
 readLiteralKey(owner.teacherSourceKey);readLiteralKey(owner.collegeSourceKey);readLiteralName(owner.teacherLabel);
 const roster=validateRecoveredRoster(value.roster);
 if(owner.ownerId!==stableId('owner','academy_instructor',owner.collegeSourceKey as string,owner.teacherSourceKey as string)||owner.ownerId!==roster.reconstruction.ownerId||owner.teacherSourceKey!==roster.teacher.teacherPriNo||owner.collegeSourceKey!==roster.reconstruction.collegeKey||owner.teacherLabel!==roster.teacher.name)throw Error('direct_resume_owner_conflict');
 const names=owner.expectedStudentNames;
 if(!Array.isArray(names)||names.length!==roster.students.length||new Set(names).size!==names.length||roster.students.some(row=>!names.includes(row.name)))throw Error('direct_resume_cohort_conflict');
 const receipt=readInputRecord(value.authentication),auth=readInputRecord(receipt.authentication);
 assertExactKeys(receipt,['schemaVersion','observedAt','authentication','source','academyWrites','parentSends']);assertExactKeys(auth,['state','transport','principalKey','collegeKey']);
 if(receipt.schemaVersion!==1||receipt.source!==null||receipt.academyWrites!==0||receipt.parentSends!==0||auth.state!=='authenticated'||auth.transport!=='direct_http_api'||auth.principalKey!==owner.teacherSourceKey||auth.collegeKey!==owner.collegeSourceKey)throw Error('direct_resume_authentication_conflict');
 if(typeof receipt.observedAt!=='string')throw Error('direct_resume_observation_required');assertInstant(receipt.observedAt);assertInstant(now);
 const day=(date:string)=>new Date(date).toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'});
 if(Date.parse(receipt.observedAt)>Date.parse(now)||day(receipt.observedAt)!==day(now)||Date.parse(roster.reconstruction.observedAt)>Date.parse(now))throw Error('direct_resume_stale_evidence');
 return {ok:true as const,mode:'direct_source_qualification' as const,observedAt:receipt.observedAt,studentCount:roster.students.length,identityDigest:digest(roster),authenticationDigest:digest(receipt),legacyPilotResumed:false,currentEnrollmentQualified:false,sourceRecordsQualified:false,authorizesProductionEffects:false,requiresFreshAuthenticationPerAcquisition:true,groupScheduleQualified:false,officialWritesAllowed:false,parentSendAllowed:false};
}

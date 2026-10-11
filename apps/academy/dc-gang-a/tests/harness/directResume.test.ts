import {expect,test} from 'bun:test';
import {reconstructRoster} from '../../src/canonical/rosterRecovery';
import {stableId} from '../../src/learning/model';
const ownerId=stableId('owner','academy_instructor','88001','99001'),now='2025-01-02T04:00:00Z';
const owner={ownerId,teacherSourceKey:'99001',collegeSourceKey:'88001',teacherLabel:'Invented Teacher',expectedStudentNames:['Invented Learner']};
const roster=reconstructRoster(owner,[{ownerId,id:stableId('student','academy_student',ownerId,'91001'),displayName:'Invented Learner',sourceKey:{namespace:'academy_student',literalKey:'91001'},proofRefs:['fixture-original'],registeredAt:'2025-01-01T00:00:00Z'}],now);
const authentication={schemaVersion:1,observedAt:now,authentication:{state:'authenticated',transport:'direct_http_api',principalKey:'99001',collegeKey:'88001'},source:null,academyWrites:0,parentSends:0};
test('native resume exposes a separate direct-qualification mode without retiring the legacy index',()=>{
 const result=Bun.spawnSync([process.execPath,'--no-env-file','harness/resume.ts','--help'],{stdout:'pipe',stderr:'pipe'});
 expect(result.exitCode).toBe(0);expect(result.stdout.toString()).toContain('--direct-qualification');expect(result.stdout.toString()).toContain('handoffs/current-state.json');
});
test('fresh direct qualification uses exact rebuilt identities without changing or resuming an expired legacy pilot',async()=>{
 const {validateDirectQualificationResume}=await import('../../harness/direct_resume');
 const input={profile:'dc-gang-a-dev',owner,roster,authentication};
 expect(validateDirectQualificationResume(input,now)).toMatchObject({ok:true,mode:'direct_source_qualification',studentCount:1,legacyPilotResumed:false,currentEnrollmentQualified:false,sourceRecordsQualified:false,authorizesProductionEffects:false});
 for(const bad of [{...input,profile:'default'},{...input,owner:{...owner,expectedStudentNames:['Foreign Learner']}},{...input,authentication:{...authentication,observedAt:'2025-01-01T00:00:00Z'}},{...input,authentication:{...authentication,authentication:{...authentication.authentication,principalKey:'99002'}}},{...input,authentication:{...authentication,academyWrites:1}},{...input,authentication:{...authentication,source:{unreviewed:true}}}])expect(()=>validateDirectQualificationResume(bad,now)).toThrow();
});

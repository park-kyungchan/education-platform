import {expect,test} from 'bun:test';
import {mkdtempSync,writeFileSync,rmSync,mkdirSync,copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {stableId} from '../../src/learning/model';
import {CanonicalRegistry} from '../../src/canonical/canonicalRegistry';
const ownerId=stableId('owner','academy_instructor','88001','99001');
const students=[{ownerId,id:stableId('student','academy_student',ownerId,'91001'),displayName:'Invented Learner',sourceKey:{namespace:'academy_student',literalKey:'91001'},proofRefs:['synthetic-original-binding'],registeredAt:'2025-01-01T00:00:00Z'}];
const config={ownerId,teacherSourceKey:'99001',collegeSourceKey:'88001',teacherLabel:'Invented Teacher',expectedStudentNames:['Invented Learner']};
test('rebuilds only evidenced literal identities and refuses fabricated aliases or enrollment',async()=>{
 const {reconstructRoster}=await import('../../src/canonical/rosterRecovery');
 const roster=reconstructRoster(config,students,'2025-01-02T00:00:00Z');
 expect(roster.students[0]).toMatchObject({studentId:'91001',name:'Invented Learner',loginId:null,groupId:null,courseSeq:null,cmSeq:null});
 expect(roster.groups).toEqual({});expect(roster.teacher.teacherId).toBeNull();expect(roster.reconstruction.currentEnrollmentQualified).toBe(false);
 for(const invalid of [[{...students[0]!,sourceKey:{namespace:'other',literalKey:'91001'}}],[{...students[0]!,proofRefs:[]}],[{...students[0]!,id:'fabricated'}],[students[0]!,students[0]!]])expect(()=>reconstructRoster(config,invalid,'2025-01-02T00:00:00Z')).toThrow();
 const root=mkdtempSync(join(tmpdir(),'roster-recovery-fixture-')),file=join(root,'roster.json');
 try{
  writeFileSync(file,JSON.stringify(roster),{mode:0o600});const registry=new CanonicalRegistry(file);
  expect(registry.getStudentById('91001').name).toBe('Invented Learner');expect(registry.findStudentByLoginId(null as unknown as string)).toBeNull();expect(registry.findStudentByLoginId('91001')).toBeNull();
  const tampered={...roster,students:[{...roster.students[0]!,studentId:'91002'}]};writeFileSync(file,JSON.stringify(tampered));expect(()=>new CanonicalRegistry(file)).toThrow();
  writeFileSync(file,JSON.stringify({...tampered,version:'legacy'}));expect(()=>new CanonicalRegistry(file)).toThrow();
  mkdirSync(join(root,'workbench_v2'));mkdirSync(join(root,'data/canonical'),{recursive:true});
  writeFileSync(join(root,'workbench_v2/__init__.py'),'');
  copyFileSync('workbench_v2/canonical_entities.py',join(root,'workbench_v2/canonical_entities.py'));
  writeFileSync(join(root,'data/canonical/canonical_roster.json'),JSON.stringify(roster),{mode:0o600});
  const py=Bun.spawnSync(['python3','-B','-c',"import sys;sys.path.insert(0,sys.argv[1]);from workbench_v2.canonical_entities import canonical_registry as r;assert r.get_teacher().teacher_id is None;assert r.get_student_by_id('91001').login_id is None;assert r.find_student_by_login_id('None') is None;assert r.find_student_by_login_id(None) is None",root],{stdout:'pipe',stderr:'pipe'});
  expect(py.stderr.toString()).toBe('');expect(py.exitCode).toBe(0);
 }finally{rmSync(root,{recursive:true});}
});

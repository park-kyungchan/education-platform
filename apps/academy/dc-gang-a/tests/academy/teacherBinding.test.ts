import {expect,test} from 'bun:test';
import {PostgresAcademyStore} from '../../src/academy/postgresStore';
import {TeacherApplication,type TrustedTeacherContext,type NativeCommandIngress} from '../../src/academy/application';
import type {TeacherStore,TeacherPrerequisiteStore} from '../../src/academy/ports/teacherStore';
import {context,known,objectRef} from './nativePrerequisiteContracts.test';
import {FictionalSql,foundation} from './nativePrerequisiteStore.test';

export const actor:TrustedTeacherContext={ownerId:'synthetic-owner',actorId:'synthetic-actor',role:'teacher'};
export const nativeContext=(key:string)=>context(key);
export function ingress(key:string):NativeCommandIngress{const c=context(key);return {idempotencyKey:c.idempotencyKey,occurrenceId:c.occurrenceId,admissionId:c.admissionId,processEpoch:c.processEpoch,sourceObservedAt:c.sourceObservedAt,authenticationRevision:c.verifiedSession.authenticationRevision,namespace:c.namespace,scopeRef:c.scopeRef,nativeOwnerBinding:c.nativeOwnerBinding,nativeInterfaceBinding:c.nativeInterfaceBinding,action:c.action,requestIntentDigest:c.requestIntentDigest};}
export const bindPayload=()=>({kind:'teacher_binding' as const,actorId:actor.actorId,teacherSourceKey:{namespace:'synthetic_teacher',literalKey:'synthetic-teacher-source'},displayName:known('Invented Teacher'),assignmentState:known('ACTIVE' as const),validFrom:'2026-01-01',validTo:null,state:'ACTIVE' as const,synthetic:true});
export function facadeApp(store:TeacherPrerequisiteStore){return new TeacherApplication(store as unknown as TeacherStore,actor.ownerId,undefined,undefined,store);}
export async function emptyFacade(){const sql=new FictionalSql();const store:TeacherPrerequisiteStore=new PostgresAcademyStore(sql.sql);return {sql,store,app:facadeApp(store)};}

test('first self BindTeacher via TeacherApplication allocates the key, returns officialSaved:false and replays the exact command',async()=>{
  const {sql,app}=await emptyFacade();
  const input={command:ingress('facade-bind'),payload:bindPayload()};
  const first=await app.bindTeacher(actor,input);
  expect(first.identity.nativeKey).toMatch(/^teacher:/);
  expect(first.officialSaved).toBe(false);expect(first.parentSent).toBe(false);
  expect(first.status).toBe('saved');
  const replay=await app.bindTeacher(actor,input);
  expect(replay.status).toBe('replay');expect(replay.identity).toEqual(first.identity);expect(replay.receipt).toEqual(first.receipt);
  expect(sql.rows('teacher_versions')).toHaveLength(1);
  const bound=await app.ownTeacherBinding(actor);
  expect(bound?.entityKey).toBe(first.identity.nativeKey);expect(bound?.revisionId).toBe(first.revisionId);
});

test('foreign-teacher bind claim and wrong-owner context refuse before any admission or store mutation',async()=>{
  const {sql,app}=await emptyFacade();
  await expect(app.bindTeacher(actor,{command:ingress('facade-foreign-bind'),payload:{...bindPayload(),actorId:'synthetic-other-actor'}})).rejects.toThrow('teacher_attribution_conflict');
  await expect(app.bindTeacher({ownerId:'synthetic-other-owner',actorId:actor.actorId,role:'teacher'},{command:ingress('facade-wrong-owner'),payload:bindPayload()})).rejects.toThrow('owner_scope_conflict');
  expect(sql.rows('teacher_versions')).toHaveLength(0);expect(sql.rows('effect_fences')).toHaveLength(0);
});

test('ordinary operations before binding refuse teacher_binding_required with no class head; only the bind exemption creates',async()=>{
  const {sql,app}=await emptyFacade();
  const create={command:ingress('facade-early-class'),payload:{kind:'class_group' as const,displayName:known('Invented Class'),businessTimezone:known('Asia/Seoul'),classState:known('ACTIVE' as const),synthetic:true}};
  await expect(app.createClassGroup(actor,create)).rejects.toThrow('teacher_binding_required');
  expect(sql.rows('class_versions')).toHaveLength(0);expect(sql.rows('effect_fences')).toHaveLength(0);
  await app.bindTeacher(actor,{command:ingress('facade-bind-then-class'),payload:bindPayload()});
  const created=await app.createClassGroup(actor,create);
  expect(created.identity.nativeKey).toMatch(/^class:/);
});

test('ordinary prerequisite reads refuse never-bound and retired callers with no payload, while an authorized caller reads collection, single record and history',async()=>{
  const f=await foundation();const app=facadeApp(f.store);
  const unbound={...actor,actorId:'synthetic-never-bound-reader'};
  await expect(app.prerequisiteClassGroups(unbound)).rejects.toThrow('teacher_binding_required');
  await expect(app.prerequisiteClassGroup(unbound,f.group.identity.nativeKey)).rejects.toThrow('teacher_binding_required');
  await expect(app.prerequisiteStudentRevisionHistory(unbound,'student-a')).rejects.toThrow('teacher_binding_required');
  await expect(app.prerequisiteScoreEvidenceForAttempt(unbound,objectRef('DailyTestAttempt','attempt-a'))).rejects.toThrow('teacher_binding_required');
  expect((await app.prerequisiteClassGroups(actor)).length).toBeGreaterThan(0);
  expect((await app.prerequisiteClassGroup(actor,f.group.identity.nativeKey))?.entityKey).toBe(f.group.identity.nativeKey);
  expect((await app.prerequisiteStudentRevisionHistory(actor,'student-a')).length).toBeGreaterThan(0);
  expect((await app.prerequisiteOwnerRevision(actor,'teacher',f.teacher.identity.nativeKey,f.teacher.revisionId))?.revisionId).toBe(f.teacher.revisionId);
  await app.retireTeacher(actor,{command:ingress('facade-retire-before-reads'),teacherKey:f.teacher.identity.nativeKey,expectedRevisionId:f.teacher.revisionId,payload:{...bindPayload(),state:'RETIRED' as const}});
  await expect(app.prerequisiteClassGroups(actor)).rejects.toThrow('teacher_binding_inactive');
  await expect(app.prerequisiteClassGroup(actor,f.group.identity.nativeKey)).rejects.toThrow('teacher_binding_inactive');
  await expect(app.prerequisiteStudentRevisionHistory(actor,'student-a')).rejects.toThrow('teacher_binding_inactive');
  await expect(app.prerequisiteOwnerHistory(actor,'teacher',f.teacher.identity.nativeKey)).rejects.toThrow('teacher_binding_inactive');
  await expect(app.prerequisiteScoreEvidence(actor,'evidence:synthetic')).rejects.toThrow('teacher_binding_inactive');
  expect((await app.ownTeacherBinding(actor))?.payload.state).toBe('RETIRED');
});

test('UpdateTeacher corrects display name by CAS and RetireTeacher tombstones the actor; rebind and later ordinary work refuse inactive',async()=>{
  const f=await foundation();const app=facadeApp(f.store);
  const teacherKey=f.teacher.identity.nativeKey;
  const updated=await app.updateTeacher(actor,{command:ingress('facade-update-teacher'),teacherKey,expectedRevisionId:f.teacher.revisionId,payload:{...bindPayload(),displayName:known('Invented Corrected Teacher')}});
  expect(updated.sequence).toBe(2);
  await expect(app.updateTeacher(actor,{command:ingress('facade-stale-teacher'),teacherKey,expectedRevisionId:f.teacher.revisionId,payload:{...bindPayload(),displayName:known('Invented Stale Teacher')}})).rejects.toThrow('revision_conflict');
  const retired=await app.retireTeacher(actor,{command:ingress('facade-retire-teacher'),teacherKey,expectedRevisionId:updated.revisionId,payload:{...bindPayload(),state:'RETIRED' as const}});
  expect(retired.sequence).toBe(3);
  expect((await app.ownTeacherBinding(actor))?.payload.state).toBe('RETIRED');
  await expect(app.bindTeacher(actor,{command:ingress('facade-rebind'),payload:bindPayload()})).rejects.toThrow('teacher_binding_inactive');
  await expect(app.createClassGroup(actor,{command:ingress('facade-after-retire'),payload:{kind:'class_group' as const,displayName:known('Invented Class'),businessTimezone:known('Asia/Seoul'),classState:known('ACTIVE' as const),synthetic:true}})).rejects.toThrow('teacher_binding_inactive');
  expect(f.sql.rows('class_versions').length).toBe(1);
});

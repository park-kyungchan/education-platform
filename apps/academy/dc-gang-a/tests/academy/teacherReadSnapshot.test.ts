import {describe,expect,test} from 'bun:test';
import {SQL} from 'bun';
import {randomUUID} from 'node:crypto';
import {PostgresAcademyStore} from '../../src/academy/postgresStore';
import {TeacherApplication} from '../../src/academy/application';
import type {TeacherReadStore} from '../../src/academy/ports/teacherStore';
const socket=process.env.DC_ACADEMY_TEST_SOCKET;
describe.skipIf(!socket)('coherent teacher read snapshot',()=>{
 test('keeps one read-only snapshot while a separate writer commits',async()=>{
  const db=new SQL({adapter:'postgres',path:socket!,username:'hermes',database:'dc_academy_test',max:3});
  try{
   const store=new PostgresAcademyStore(db);await store.migrate();
   expect(typeof store.readSnapshot).toBe('function');
   const owner='fixture-snapshot-'+randomUUID();
   const first={ownerId:owner,id:'fixture-a',displayName:'Invented Snapshot A',sourceKey:{namespace:'academy_student',literalKey:'91001'},proofRefs:['fixture']};
   await store.registerStudent(first);
   let mode:unknown;
   const observed=new PostgresAcademyStore(new Proxy(db,{get(target,key){
    if(key==='begin')return (read:(tx:SQL)=>Promise<unknown>)=>target.begin(async tx=>{
     const result=await read(tx as unknown as SQL);
     [mode]=await tx`SELECT current_setting('transaction_read_only') AS read_only,current_setting('transaction_isolation') AS isolation`;return result;
    });return Reflect.get(target,key);
   }}));
   await observed.readSnapshot(async snapshot=>{
    expect((await snapshot.students(owner)).map(s=>s.id)).toEqual(['fixture-a']);
    await store.registerStudent({...first,id:'fixture-b',displayName:'Invented Snapshot B',sourceKey:{namespace:'academy_student',literalKey:'91002'}});
    expect((await snapshot.students(owner)).map(s=>s.id)).toEqual(['fixture-a']);
   });
   expect(mode).toMatchObject({read_only:'on',isolation:'repeatable read'});
   expect((await store.students(owner)).map(s=>s.id).sort()).toEqual(['fixture-a','fixture-b']);
  }finally{await db.close();}
 });
 test('exposes a frozen read facade and expires it at callback completion or exception',async()=>{
  const db=new SQL({adapter:'postgres',path:socket!,username:'hermes',database:'dc_academy_test',max:3});
  try{
   const store=new PostgresAcademyStore(db);await store.migrate();let escaped:TeacherReadStore|undefined;
   await store.readSnapshot(async snapshot=>{
    escaped=snapshot;expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.keys(snapshot).sort()).toEqual(['catalog','clinicRequest','clinicResult','current','history','observationRequest','observationResult','pinnedCatalog','preparationRevisions','students'].sort());
    expect('db' in snapshot||'append' in snapshot||'migrate' in snapshot).toBe(false);
    await snapshot.students('fixture-no-students');
   });
   await expect(escaped!.students('fixture-no-students')).rejects.toThrow('read_snapshot_closed');
   await expect(store.readSnapshot(async snapshot=>{escaped=snapshot;throw Error('fixture_callback_exception');})).rejects.toThrow('fixture_callback_exception');
   await expect(escaped!.students('fixture-no-students')).rejects.toThrow('read_snapshot_closed');
   expect(await store.students('fixture-no-students')).toEqual([]);
  }finally{await db.close();}
 });
 test('PostgreSQL refuses an actual write inside the adapter snapshot transaction',async()=>{
  const db=new SQL({adapter:'postgres',path:socket!,username:'hermes',database:'dc_academy_test',max:3});
  try{
   const store=new PostgresAcademyStore(db);await store.migrate();const owner='fixture-write-probe-'+randomUUID();
   // Test-only driver observation; the callback itself receives no SQL handle.
   const observed=new PostgresAcademyStore(new Proxy(db,{get(target,key){
    if(key==='begin')return (read:(tx:SQL)=>Promise<unknown>)=>target.begin(async tx=>{
     await read(tx as unknown as SQL);await tx`DELETE FROM academy.students WHERE owner_id=${owner}`;
    });return Reflect.get(target,key);
   }}));
   await expect(observed.readSnapshot(snapshot=>snapshot.students(owner))).rejects.toThrow('read-only');
   expect(await store.students(owner)).toEqual([]);
  }finally{await db.close();}
 });
 test('all scene query consumers enter the snapshot after authentication',async()=>{
  const db=new SQL({adapter:'postgres',path:socket!,username:'hermes',database:'dc_academy_test',max:3});
  try{
   const store=new PostgresAcademyStore(db);await store.migrate();
   expect(typeof store.readSnapshot).toBe('function');
   const owner='fixture-query-snapshot-'+randomUUID(),actor={ownerId:owner,actorId:'fixture-teacher',role:'teacher' as const};
   await store.registerStudent({ownerId:owner,id:'fixture-query',displayName:'Invented Query',sourceKey:{namespace:'academy_student',literalKey:'91001'},proofRefs:['fixture']});
   let calls=0;const original=store.readSnapshot.bind(store);store.readSnapshot=read=>{calls++;return original(read);};
   const app=new TeacherApplication(store,owner);
   const scene=await app.student(actor,'fixture-query','2090-01-02');
   expect(scene.workContext.scene.revision).toBe(scene.sceneRevision);
   expect(scene.workContext.data.sectionAssignments.state).toBe('unknown');
   await app.cohort(actor);await app.classPreparation(actor,'2090-01-02');expect(calls).toBe(3);
   await expect(app.student({...actor,ownerId:'foreign'},'fixture-query','2090-01-02')).rejects.toThrow('owner_scope_conflict');expect(calls).toBe(3);
  }finally{await db.close();}
 });
});

import { describe, expect, test } from 'bun:test';
import { SQL } from 'bun';
import { PostgresAcademyStore } from '../../src/academy/postgresStore';
import { unknown } from '../../src/learning/model';
import { randomUUID } from 'node:crypto';

const socket = process.env.DC_ACADEMY_TEST_SOCKET;
describe('read-only runtime storage qualification',()=>{
  test('rejects missing storage without attempting automatic schema migration',async()=>{
    const queries:string[]=[];
    const db=(async(parts:TemplateStringsArray)=>{queries.push(parts.join('?'));return [{tables_ready:false,history_triggers:0}];}) as unknown as SQL;
    await expect(new PostgresAcademyStore(db).assertRuntimeReady()).rejects.toThrow('existing_academy_schema_required');
    expect(queries).toHaveLength(1);
    expect(queries[0]!.trim().startsWith('SELECT')).toBe(true);
    expect(queries[0]).not.toMatch(/\b(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|REVOKE|GRANT)\b/i);
  });
});
describe.skipIf(!socket)('real PostgreSQL student partitions and durable versions', () => {
  test('persists, reopens and isolates a source-bound student without inventing learning facts', async () => {
    const db = new SQL({ adapter: 'postgres', path: socket!, username: 'hermes', database: 'dc_academy_test', max: 3 });
    const store = new PostgresAcademyStore(db);
    await store.migrate();
    await store.assertRuntimeReady();
    const owner = 'fixture-owner-a';
    await store.registerStudent({ ownerId: owner, id: 'fixture-student-a', displayName: 'Invented Learner', sourceKey: { namespace: 'academy_student', literalKey: '91001' }, proofRefs: ['synthetic-independent-course-and-book-binding'] });
    const own = await store.students(owner);
    expect(own.length).toBe(1);
    expect(own[0].id).toBe('fixture-student-a');
    expect(await store.students('fixture-owner-b')).toEqual([]);
    await db.close();
    const reopened = new SQL({ adapter: 'postgres', path: socket!, username: 'hermes', database: 'dc_academy_test', max: 2 });
    expect((await new PostgresAcademyStore(reopened).students(owner))[0].displayName).toBe('Invented Learner');
    await reopened.close();
  });
  test('atomically appends a book-source revision, replays the original request and rejects stale/changed intent', async () => {
    const db = new SQL({ adapter: 'postgres', path: socket!, username: 'hermes', database: 'dc_academy_test', max: 3 });
    const store = new PostgresAcademyStore(db);
    await store.migrate();
    const suffix = randomUUID();
    const bookOwner = 'fixture-book-owner-' + suffix;
    const bookStudent = 'fixture-book-student-' + suffix;
    await store.registerStudent({ ownerId: bookOwner, id: bookStudent, displayName: 'Invented Book Learner', sourceKey: { namespace: 'academy_student', literalKey: '91001' }, proofRefs: ['fixture'] });
    await store.saveCatalog(bookOwner,{id:'fixture-book-catalog',kind:'book_edition',sourceKey:{namespace:'academy_book',literalKey:'61001'},label:'Invented edition',parent:unknown('root_book')});
    const command = { ownerId: bookOwner, studentId: bookStudent, entityId: 'fixture-book-edge', actorId: 'fixture-operator',
      idempotencyKey: 'fixture-source-1', expectedRevisionId: null, sourceObservedAt: '2090-01-01T00:00:00Z',
      payload: { kind: 'source_book_registration' as const, sourceStudent: { namespace: 'academy_student', literalKey: '91001' },
        sourceCourse: { namespace: 'academy_course', literalKey: '71001' }, sourceUserCourse: { namespace: 'academy_user_course', literalKey: '81001' },
        sourceBook: { namespace: 'academy_book', literalKey: '61001' }, catalogNodeId: 'fixture-book-catalog',
        sourceCourseLabel: 'Invented course', sourceBookLabel: 'Invented edition', sourceStatus: 'Invented active label',
        sourceProgressLiteral: '20 %', sourceLearningRangeLiteral: 'Invented range', assignmentValidity: unknown('source_learning_range_not_effective_enrollment'),
        role: unknown('teacher_role_not_declared'), contractRef: 'synthetic-source-contract', evidenceRefs: ['fixture'] } };
    const first = await store.append(command, '2090-01-01T00:00:01Z');
    expect(first.status).toBe('saved');
    await expect(store.append({...command,idempotencyKey:'fixture-foreign-book',entityId:'fixture-other-book',payload:{...command.payload,catalogNodeId:'foreign-missing-book'}},'2090-01-02T00:00:00Z')).rejects.toThrow('catalog_reference_conflict');
    expect(await store.append(command, '2090-01-02T00:00:00Z')).toEqual({ ...first, status: 'replay' });
    await expect(store.append({ ...command, payload: { ...command.payload, sourceProgressLiteral: '30 %' } }, '2090-01-02T00:00:00Z')).rejects.toThrow('idempotency_reuse');
    await expect(store.append({ ...command, idempotencyKey: 'fixture-source-stale' }, '2090-01-02T00:00:00Z')).rejects.toThrow('stale_base');
    expect((await store.history(command.ownerId, command.studentId, command.entityId)).length).toBe(1);
    await expect((async () => { await db`UPDATE academy.record_versions SET payload='{}'::jsonb WHERE owner_id=${command.ownerId}`; })()).rejects.toThrow('append_only_history');
    await db.close();
  });
  test('stores shared catalog versions once and never invents an unknown ancestry', async () => {
    const db = new SQL({ adapter: 'postgres', path: socket!, username: 'hermes', database: 'dc_academy_test' });
    const store = new PostgresAcademyStore(db); await store.migrate();
    const owner='fixture-catalog-'+randomUUID();
    const node={id:'fixture-book',kind:'book_edition' as const,sourceKey:{namespace:'academy_book',literalKey:'61001'},label:'Invented edition',parent:unknown('root_book')};
    const first=await store.saveCatalog(owner,node);
    expect(await store.saveCatalog(owner,node)).toEqual(first);
    expect((await store.catalog(owner)).length).toBe(1);
    await expect(store.saveCatalog(owner,{...node,id:'fixture-minor',kind:'minor_unit',parent:{state:'known',value:node.id,evidenceRefs:['fixture']}})).rejects.toThrow('catalog_parent_level');
    expect(await store.catalog('fixture-foreign-owner')).toEqual([]);
    await db.close();
  });
  test('blocked foreign assessment targets cannot enter an existing student partition',async()=>{
    const db=new SQL({adapter:'postgres',path:socket!,username:'hermes',database:'dc_academy_test'});
    const store=new PostgresAcademyStore(db);await store.migrate();
    const acquisition={schemaVersion:1,family:'daily_zero',status:'blocked',records:[],dayRecords:[],dailyResults:[{studentKey:'91002',studentName:'Invented Foreign Learner',attemptKey:'81002',status:'blocked',reason:'transport_failed'}],observedAt:'2090-01-01T00:00:00Z',coverage:'requested_daily_targets',unknownStates:[],nativePrintInvoked:false,automaticRetryAllowed:false};
    await expect(store.append({ownerId:'fixture-owner-a',studentId:'fixture-student-a',entityId:'fixture-foreign-audit',actorId:'fixture-operator',idempotencyKey:'foreign-audit-'+randomUUID(),expectedRevisionId:null,sourceObservedAt:acquisition.observedAt,payload:{kind:'source_audit',acquisition,contractRef:'fixture'}},'2090-01-01T00:00:01Z')).rejects.toThrow('source_student_binding_conflict');
    await db.close();
  });
});

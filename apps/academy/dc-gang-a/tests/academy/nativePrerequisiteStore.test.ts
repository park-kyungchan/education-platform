import {expect,test} from 'bun:test';
import type {SQL} from 'bun';
import {canonicalJson,digest,known as legacyKnown} from '../../src/learning/model';
import {validateAcademyRecord,type AcademyRecord} from '../../src/academy/records';
import {PostgresAcademyStore} from '../../src/academy/postgresStore';
import {NativePrerequisiteStore,guardReservedAppend,validateReceipt,prerequisiteVersionFrom,computeReadHorizon} from '../../src/academy/nativePrerequisiteStore';
import {scopeActionDefinitions,requestDigest,commandBinding,type CommandContext,type NativeWriteResult,type OwnerVersion,type OwnerPayload,type ObjectRef,type EducationType,type ReadAdmission,type RequestBinding,type OwnerAppendCommand,type TeacherBinding,type ClassGroupRecord,type LessonSessionRecord,type TemporalBinding,type ActivityScopeLink,type NativeStudentPayload} from '../../src/academy/contracts/prerequisiteRecords';
import type {TeacherPrerequisiteStore,TeacherPrerequisiteReadStore,ReadHorizonPlan} from '../../src/academy/ports/teacherStore';
import {context,known,unknown,objectRef,nativeRef,progress,draft,assessment,instant,hash,evidence} from './nativePrerequisiteContracts.test';
import {exactWorkFixture,exactAttemptFixture} from './learningWorkFixtures';
import {nativeProposalTexts} from '../../src/academy/nativeCompleteness';

type Row=Record<string,unknown>;
/** Source-only deterministic driver model. Never opens SQL, sockets, services, auth or files. */
export class FictionalSql {
 readonly queries:{text:string;values:unknown[]}[]=[];
 beforeQuery?: (text:string,values:readonly unknown[])=>void|Promise<void>;
 afterCommit?: ()=>void;
 private tables=new Map<string,Row[]>();
 readonly sql:SQL;
 now='2026-10-24T00:01:00.000Z';
 constructor(){const tag=(strings:TemplateStringsArray,...values:unknown[])=>Object.hasOwn(strings,'raw')?this.query(strings.join('?'),values):{fictionalSqlList:[...strings]};this.sql=Object.assign(tag,{unsafe:(text:string,values:unknown[]=[])=>this.query(text,values),begin:async<T>(fn:(db:SQL)=>Promise<T>):Promise<T>=>{const before=structuredClone(this.tables);let result:T;try{result=await fn(this.sql);}catch(e){this.tables=before;throw e;}this.afterCommit?.();return result;}}) as unknown as SQL;}
 rows(table:string):Row[]{let rows=this.tables.get(table);if(!rows){rows=[];this.tables.set(table,rows);}return rows;}
 seed(table:string,row:Row){this.rows(table).push(structuredClone(row));}
 state(){return canonicalJson([...this.tables.entries()].sort());}
 private async query(raw:string,v:unknown[]):Promise<Row[]>{const text=raw.replace(/\s+/g,' ').trim();this.queries.push({text,values:v});await this.beforeQuery?.(text,v);
 if(text.startsWith('SET TRANSACTION')||text.includes('pg_advisory_xact_lock'))return [];
 if(text.startsWith('SELECT clock_timestamp'))return [{now:this.now}];
 if(text.includes("to_regclass('academy.effect_fences')"))return [{ready:true}];
 if(text.startsWith('INSERT INTO academy.effect_fences')){this.seed('effect_fences',{owner_id:v[0],actor_id:v[1],idempotency_key:v[2],request:JSON.parse(String(v[3])),state:'PRE_TRANSACTION',result:null,proof_digest:null});return [];}
 if(text.startsWith('UPDATE academy.effect_fences')){const index=text.includes("state='COMMITTED'")||text.includes("state='FENCED_NOT_COMMITTED'")?1:0;const row=this.rows('effect_fences').find(x=>x.owner_id===v[index]&&x.actor_id===v[index+1]&&x.idempotency_key===v[index+2]);if(!row)throw Error('fake admission missing');if(text.includes("state='COMMITTED'")){row.state='COMMITTED';row.result=JSON.parse(String(v[0]));}else if(text.includes("state='FENCED_NOT_COMMITTED'")){row.state='FENCED_NOT_COMMITTED';row.proof_digest=v[0];}else row.state='ACTIVE';return [];}
 if(text.startsWith('SELECT')&&text.includes('FROM academy.effect_fences'))return this.rows('effect_fences').filter(x=>x.owner_id===v[0]&&x.actor_id===v[1]&&x.idempotency_key===v[2]);
 if(text.startsWith('SELECT')&&text.includes('FROM academy.command_outcomes'))return this.rows('command_outcomes').filter(x=>x.owner_id===v[0]&&x.actor_id===v[1]&&x.idempotency_key===v[2]);
 if(text.startsWith('INSERT INTO academy.command_outcomes')){const rows=this.rows('command_outcomes');if(rows.some(x=>x.owner_id===v[0]&&x.actor_id===v[1]&&x.idempotency_key===v[2]))throw Error('fake duplicate command');this.seed('command_outcomes',{owner_id:v[0],actor_id:v[1],idempotency_key:v[2],command_digest:v[3],acknowledgement:JSON.parse(String(v[4]))});return [];}
 if(text.startsWith('SELECT')&&text.includes('FROM academy.teacher_actor_index'))return this.rows('teacher_actor_index').filter(x=>x.owner_id===v[0]&&x.actor_id===v[1]);
 if(text.startsWith('INSERT INTO academy.teacher_actor_index')){let row=this.rows('teacher_actor_index').find(x=>x.owner_id===v[0]&&x.actor_id===v[1]);if(!row){row={owner_id:v[0],actor_id:v[1],teacher_key:v[2]};this.rows('teacher_actor_index').push(row);}row.state=v[3];row.retired_revision_id=v[4];return [];}
 const insertVersion=/^INSERT INTO academy\.(\w+)_versions\(owner_id,entity_key/.exec(text);if(insertVersion){const rows=this.rows(insertVersion[1]+'_versions');if(rows.some(x=>x.owner_id===v[0]&&x.revision_id===v[3]))throw Error('fake duplicate revision');this.seed(insertVersion[1]+'_versions',{owner_id:v[0],entity_key:v[1],sequence:v[2],revision_id:v[3],body:JSON.parse(String(v[4]))});return [];}
 const insertHead=/^INSERT INTO academy\.(\w+)_heads\(owner_id,entity_key/.exec(text);if(insertHead){const rows=this.rows(insertHead[1]+'_heads');const row=rows.find(x=>x.owner_id===v[0]&&x.entity_key===v[1]);if(row)row.sequence=v[2];else this.seed(insertHead[1]+'_heads',{owner_id:v[0],entity_key:v[1],sequence:v[2]});return [];}
 const ownerSelect=/^SELECT v.body FROM academy\.(\w+)_heads/.exec(text);if(ownerSelect){const family=ownerSelect[1];const heads=this.rows(family+'_heads').filter(x=>x.owner_id===v[0]&&(v.length===1||x.entity_key===v[1]));return heads.map(h=>this.rows(family+'_versions').find(x=>x.owner_id===h.owner_id&&x.entity_key===h.entity_key&&x.sequence===h.sequence)!);}
 if(text.startsWith('SELECT body FROM academy.')){const table=/FROM academy\.(\w+)/.exec(text)![1]!;return this.rows(table).filter(x=>x.owner_id===v[0]&&x.entity_key===v[1]&&(text.includes('revision_id=')?x.revision_id===v[2]:Number(x.sequence)>Number(v[2]))).slice(0,Number(v[3]??1000));}
 if(text.startsWith('SELECT')&&text.includes('FROM academy.students'))return this.rows('students').filter(x=>x.owner_id===v[0]&&(v.length===1||x.id===v[1]));
 if(text.startsWith('INSERT INTO academy.record_versions')){const keys=['owner_id','student_id','entity_id','sequence','revision_id','previous_revision_id','previous_digest','payload','content_digest','integrity_digest','source_observed_at','recorded_at','actor_id','idempotency_key','command_digest'];this.seed('record_versions',Object.fromEntries(keys.map((k,i)=>[k,k==='payload'?JSON.parse(String(v[i])):v[i]])));return [];}
 if(text.startsWith('INSERT INTO academy.record_heads')){const rows=this.rows('record_heads'),row=rows.find(x=>x.owner_id===v[0]&&x.student_id===v[1]&&x.entity_id===v[2]);const value={owner_id:v[0],student_id:v[1],entity_id:v[2],sequence:v[3],revision_id:v[4],content_digest:v[5],last_verified_at:v[6]};if(row)Object.assign(row,value);else this.seed('record_heads',value);return [];}
 if(text.includes('h.last_verified_at')&&text.includes('FROM academy.record_heads'))return this.rows('record_heads').filter(h=>h.owner_id===v[0]&&h.student_id===v[1]).map(h=>({...this.rows('record_versions').find(x=>x.owner_id===h.owner_id&&x.student_id===h.student_id&&x.entity_id===h.entity_id&&x.sequence===h.sequence)!,last_verified_at:h.last_verified_at}));
 if(text.startsWith('SELECT v.* FROM academy.record_heads')){let rows=this.rows('record_heads').filter(h=>h.owner_id===v[0]);if(text.includes('h.student_id='))rows=rows.filter(h=>h.student_id===v[1]&&(!text.includes('h.entity_id=')||h.entity_id===v[2]));else rows=rows.filter(h=>h.entity_id===v[1]);return rows.map(h=>this.rows('record_versions').find(x=>x.owner_id===h.owner_id&&x.student_id===h.student_id&&x.entity_id===h.entity_id&&x.sequence===h.sequence)!).filter(x=>!text.includes('AND v.revision_id=')||x.revision_id===v[2]);}
 if(text.startsWith('SELECT * FROM academy.record_versions'))return this.rows('record_versions').filter(x=>x.owner_id===v[0]&&x.student_id===v[1]&&x.entity_id===v[2]&&Number(x.sequence)>Number(v[3])).slice(0,Number(v[4]));
 if(text.startsWith('SELECT')&&text.includes('FROM academy.catalog_versions')){if(text.includes('revision_id IN')){const selected=(v[1] as {fictionalSqlList:string[]}).fictionalSqlList;return this.rows('catalog_versions').filter(x=>x.owner_id===v[0]&&selected.includes(String(x.revision_id)));}if(text.includes('DISTINCT ON'))return this.rows('catalog_versions').filter(x=>x.owner_id===v[0]);return this.rows('catalog_versions').filter(x=>x.owner_id===v[0]&&x.node_id===v[1]).slice(-1);}
 if(text.startsWith('SELECT')&&text.includes('FROM academy.draft_scope_index'))return this.rows('draft_scope_index').filter(x=>x.owner_id===v[0]&&x.scope_digest===v[1]);
 if(text.startsWith('INSERT INTO academy.draft_scope_index')){const rows=this.rows('draft_scope_index'),row=rows.find(x=>x.owner_id===v[0]&&x.scope_digest===v[1]);if(row)row.draft_entity_id=v[2];else this.seed('draft_scope_index',{owner_id:v[0],scope_digest:v[1],draft_entity_id:v[2]});return [];}
 if(text.startsWith('SELECT')&&text.includes('FROM academy.read_occurrences'))return this.rows('read_occurrences').filter(x=>x.owner_id===v[0]&&x.actor_id===v[1]&&(text.includes("status='COMPLETED'")?x.status==='COMPLETED'&&x.snapshot_digest===v[2]:x.request_id===v[2]));
 if(text.startsWith('INSERT INTO academy.read_occurrences')){this.seed('read_occurrences',{owner_id:v[0],actor_id:v[1],request_id:v[2],request:JSON.parse(String(v[3])),status:'PENDING',snapshot_digest:null,refusal_code:null});return [];}
 if(text.startsWith('UPDATE academy.read_occurrences')){const row=this.rows('read_occurrences').find(x=>x.owner_id===v[3]&&x.actor_id===v[4]&&x.request_id===v[5]);if(!row)throw Error('fake read missing');row.status=v[0];row.snapshot_digest=v[1];row.refusal_code=v[2];return [];}
 throw Error('unsupported fictional SQL: '+text);
 }
}
export async function admitted<T extends {context:CommandContext}>(store:TeacherPrerequisiteStore,operation:string,c:T,run:()=>Promise<NativeWriteResult>):Promise<NativeWriteResult>{if(operation==='append:scope'){
 const fixture=c as T&{entityKey:string|null;payload:ActivityScopeLink};
 // This source fixture producer supplies the newly required trusted grammar/action before admission.
 fixture.payload={schemaVersion:'2.0.0',state:'ACTIVE',...fixture.payload};
 const action=scopeActionDefinitions[fixture.entityKey===null?'AttachActivityScope':'CorrectActivityScope'];fixture.context={...fixture.context,action:{name:action.name,version:action.version,definitionSha256:digest(action)}};
 }await store.admitCommand({context:c.context,requestDigest:requestDigest(operation,c)});return run();}
export async function foundation(validity:{validFrom:string;validTo:string|null}={validFrom:'2026-01-01',validTo:null},clock?:string){const sql=new FictionalSql();if(clock)sql.now=clock;const concrete=new PostgresAcademyStore(sql.sql);const store:TeacherPrerequisiteStore=concrete;const c=context('bind');const bind:OwnerAppendCommand<TeacherBinding>={context:c,entityKey:null,expectedRevisionId:null,payload:{kind:'teacher_binding',actorId:c.actorId,teacherSourceKey:{namespace:'synthetic_teacher',literalKey:'synthetic-teacher-source'},displayName:known('Invented Teacher'),assignmentState:known('ACTIVE'),validFrom:validity.validFrom,validTo:validity.validTo,state:'ACTIVE',synthetic:true}};const teacher=await admitted(store,'append:teacher',bind,()=>store.appendTeacher(bind));const classCommand:OwnerAppendCommand<ClassGroupRecord>={context:context('class'),entityKey:null,expectedRevisionId:null,payload:{kind:'class_group',displayName:known('Invented Class'),businessTimezone:known('Asia/Seoul'),classState:known('ACTIVE'),synthetic:true}};const group=await admitted(store,'append:class',classCommand,()=>store.appendClassGroup(classCommand));sql.seed('students',{owner_id:c.ownerId,id:'student-a',display_name:'Invented Student',source_namespace:'academy_student',source_key:'synthetic-student-a',proof_refs:['synthetic'],registered_at:instant});const sc={context:context('student-attach'),studentId:'student-a',expectedRevisionId:null,payload:{kind:'student_record' as const,displayName:known('Invented Student'),enrollmentState:known('ACTIVE' as const)}};const student=await admitted(store,'append:student',sc,()=>store.appendStudentRevision(sc));const ref=<T extends EducationType>(type:T,r:NativeWriteResult):ObjectRef<T>=>objectRef(type,r.identity.nativeKey,r.revisionId);
 const lessonCommand:OwnerAppendCommand<LessonSessionRecord>={context:context('lesson'),entityKey:null,expectedRevisionId:null,payload:{kind:'lesson_session',classGroupRef:ref('ClassGroup',group),businessDate:'2026-10-24',occurrenceOrdinal:known(1),startsAt:known('2026-10-24T00:00:00.000Z'),endsAt:known('2026-10-24T01:00:00.000Z'),teacherRefs:known([ref('Teacher',teacher)]),participantRefs:known([ref('Student',student)]),lessonState:known('HELD'),synthetic:true}};const lesson=await admitted(store,'append:lesson',lessonCommand,()=>store.appendLesson(lessonCommand));const recordScope={studentRef:ref('Student',student),classGroupRef:ref('ClassGroup',group),businessDate:'2026-10-24',lessonRef:ref('LessonSession',lesson)};
 for(const [kind,from,to] of [['CLASS_MEMBERSHIP',recordScope.studentRef,recordScope.classGroupRef],['LESSON_PARTICIPATION',recordScope.lessonRef,recordScope.studentRef],['TEACHING_ASSIGNMENT',recordScope.classGroupRef,ref('Teacher',teacher)]] as const){const cmd:OwnerAppendCommand<TemporalBinding>={context:context(kind),entityKey:null,expectedRevisionId:null,payload:{kind:'temporal_binding',bindingKind:kind,subjectRef:from,targetRef:to,validFrom:'2026-01-01',validTo:null,sourceLiteral:'synthetic-dated-decision',synthetic:true}};await admitted(store,'append:binding',cmd,()=>store.appendTemporalBinding(cmd));}
 return {sql,store,concrete,teacher,group,student,lesson,recordScope,ref,bind};}

// Actual stored identity governs every owner-family reference. A caller cannot
// move an existing key/revision into another namespace or occurrence scope.
for(const axis of ['namespace','scope'] as const)for(const type of ['Teacher','ClassGroup','Student','LessonSession'] as const)test('STORED-REF '+axis+' '+type+' uses the resolved native identity',async()=>{
 const f=await foundation(),actor='synthetic-actor-b';
 const ctx=(key:string):CommandContext=>{const c=context('stored-ref-'+axis+'-'+type+'-'+key);return {...c,actorId:actor,verifiedSession:{...c.verifiedSession,actorId:actor},namespace:axis==='namespace'?'synthetic-native-b':c.namespace,scopeRef:axis==='scope'?nativeRef('synthetic-scope-b'):c.scopeRef};};
 const ref=<T extends EducationType>(type:T,r:NativeWriteResult):ObjectRef<T>=>({identity:{...r.identity,objectType:type},revision:r.revisionId});
 const teacherCommand={context:ctx('teacher'),entityKey:null,expectedRevisionId:null,payload:{...f.bind.payload,actorId:actor}};
 const teacher=await admitted(f.store,'append:teacher',teacherCommand,()=>f.store.appendTeacher(teacherCommand));
 const classCommand={context:ctx('class'),entityKey:null,expectedRevisionId:null,payload:{kind:'class_group' as const,displayName:known('Invented B'),businessTimezone:known('Asia/Seoul'),classState:known('ACTIVE' as const),synthetic:true}};
 const group=await admitted(f.store,'append:class',classCommand,()=>f.store.appendClassGroup(classCommand));
 f.sql.seed('students',{owner_id:context().ownerId,id:'student-b',display_name:'Invented B',source_namespace:'academy_student',source_key:'synthetic-student-b',proof_refs:['synthetic'],registered_at:instant});
 const studentCommand={context:ctx('student'),studentId:'student-b',expectedRevisionId:null,payload:{kind:'student_record' as const,displayName:known('Invented B'),enrollmentState:known('ACTIVE' as const)}};
 const student=await admitted(f.store,'append:student',studentCommand,()=>f.store.appendStudentRevision(studentCommand));
 const lessonPayload={kind:'lesson_session' as const,classGroupRef:ref('ClassGroup',group),businessDate:'2026-10-24',occurrenceOrdinal:known(1),startsAt:unknown<string>(),endsAt:unknown<string>(),teacherRefs:known([ref('Teacher',teacher)]),participantRefs:known([ref('Student',student)]),lessonState:known('HELD' as const),synthetic:true};
 const lessonCommand={context:ctx('lesson'),entityKey:null,expectedRevisionId:null,payload:lessonPayload};
 await admitted(f.store,'append:lesson',lessonCommand,()=>f.store.appendLesson(lessonCommand));
 const actual={Teacher:f.teacher,ClassGroup:f.group,Student:f.student,LessonSession:f.lesson}[type];
 const forged={identity:{...actual.identity,namespace:ctx('probe').namespace,scopeRef:ctx('probe').scopeRef,objectType:type},revision:actual.revisionId};
 let operation:string,command:OwnerAppendCommand<LessonSessionRecord>|OwnerAppendCommand<TemporalBinding>,run:()=>Promise<NativeWriteResult>;
 if(type==='ClassGroup'){
  const c={context:ctx('probe'),entityKey:null,expectedRevisionId:null,payload:{...lessonPayload,classGroupRef:forged as ObjectRef<'ClassGroup'>}};
  command=c;operation='append:lesson';run=()=>f.store.appendLesson(c);
 }else{
  const payload:TemporalBinding={kind:'temporal_binding',bindingKind:type==='Teacher'?'TEACHING_ASSIGNMENT':type==='Student'?'CLASS_MEMBERSHIP':'LESSON_PARTICIPATION',subjectRef:type==='Teacher'?ref('ClassGroup',group):forged,targetRef:type==='Teacher'?forged:type==='Student'?ref('ClassGroup',group):ref('Student',student),validFrom:'2026-01-01',validTo:null,sourceLiteral:'synthetic-scope-forgery',synthetic:true};
  const c={context:ctx('probe'),entityKey:null,expectedRevisionId:null,payload};command=c;operation='append:binding';run=()=>f.store.appendTemporalBinding(c);
 }
 await f.store.admitCommand({context:command.context,requestDigest:requestDigest(operation,command)});
 const before=f.sql.state();
 await expect(run()).rejects.toThrow('scope_conflict');
 expect(f.sql.state()).toBe(before);
});

test('real store first binding allocation/replay, closure, immutable history and actor tombstone',async()=>{const f=await foundation();validateReceipt(f.teacher.receipt);expect(f.teacher.identity.nativeKey).toMatch(/^teacher:/);const replay=await f.store.appendTeacher(f.bind);expect(replay.identity).toEqual(f.teacher.identity);expect(replay.receipt).toEqual(f.teacher.receipt);expect(replay.status).toBe('replay');const b=await f.store.teacherBindingByActor(context().ownerId,context().actorId);expect(b?.revisionId).toBe(f.teacher.revisionId);expect(()=>prerequisiteVersionFrom({...b!,contentDigest:'b'.repeat(64)})).toThrow('stored_revision_integrity');const cmd={...f.bind,context:context('retire'),entityKey:f.teacher.identity.nativeKey,expectedRevisionId:f.teacher.revisionId,payload:{...f.bind.payload,state:'RETIRED' as const}};await admitted(f.store,'append:teacher',cmd,()=>f.store.appendTeacher(cmd));await expect(admitted(f.store,'append:teacher',{...f.bind,context:context('rebind')},()=>f.store.appendTeacher({...f.bind,context:context('rebind')}))).rejects.toThrow('teacher_binding_inactive');expect((await f.store.teacherBindingByActor(context().ownerId,context().actorId))?.payload.state).toBe('RETIRED');});
test('all newly frozen read methods reject after close, with no driver/writer or metadata writes',async()=>{const f=await foundation();let captured:TeacherPrerequisiteReadStore|undefined;const before=f.sql.state();await f.store.readSnapshot(async view=>{captured=view;expect(Object.isFrozen(view)).toBe(true);expect('db' in view||'append' in view||'admitReadOccurrence' in view).toBe(false);expect(await view.teachers(context().ownerId)).toHaveLength(1);expect(await view.classGroups(context().ownerId)).toHaveLength(1);expect(await view.lessons(context().ownerId)).toHaveLength(1);});expect(f.sql.state()).toBe(before);for(const method of ['approvalClosurePreview','teachers','teacherCurrent','teacherBindingByActor','classGroups','classCurrent','lessons','lessonCurrent','temporalBindings','activityScopes','studentRevisionCurrent','studentRevisionHistory','approvalCurrent','commandOutcomeLookup','readOccurrenceLookup','currentCatalogPins','ownerRevision','ownerHistory','scoreEvidenceCurrent','scoreEvidenceForAttempt'] as const)await expect(Reflect.apply(captured![method],captured,[context().ownerId,'synthetic-key'])).rejects.toThrow('read_snapshot_closed');expect(f.sql.queries.some(q=>q.text==='SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')).toBe(true);});
test('source command protocol refuses delayed originals after a durable fence and legacy shared append honors reservation',async()=>{const f=await foundation();const cmd={...f.bind,context:context('delayed'),entityKey:null};const request=await f.store.admitCommand({context:cmd.context,requestDigest:requestDigest('append:teacher',cmd)});expect((await f.store.commandOutcomeLookup(request)).status).toBe('PENDING');const before=f.sql.rows('teacher_versions').length;expect((await f.store.fenceCommand({request,fenceOccurrenceId:'synthetic-fence-occurrence',reason:'CANCEL'})).status).toBe('NOT_COMMITTED_FENCED');await expect(f.store.appendTeacher(cmd)).rejects.toThrow('original_occurrence_fenced');expect(f.sql.rows('teacher_versions')).toHaveLength(before);await expect(guardReservedAppend(f.sql.sql,request.ownerId,request.actorId,request.idempotencyKey)).rejects.toThrow('reserved_native_admission');await expect(f.store.append({ownerId:request.ownerId,actorId:request.actorId,idempotencyKey:request.idempotencyKey,studentId:'student-a',entityId:'synthetic-old-note',expectedRevisionId:null,sourceObservedAt:instant,payload:{kind:'teacher_reported_note',text:'Invented note',directiveRef:'synthetic-directive'}})).rejects.toThrow('reserved_native_admission');const state=f.sql.state();expect((await f.store.commandOutcomeLookup({...request,requestDigest:'b'.repeat(64)})).status).toBe('UNKNOWN');expect((await f.store.commandOutcomeLookup({...request,idempotencyKey:'never-admitted'})).status).toBe('UNKNOWN');expect(f.sql.state()).toBe(state);});
test('read metadata survives aborted business snapshot and late completion cannot upgrade UNKNOWN',async()=>{const f=await foundation();const request:ReadAdmission={ownerId:context().ownerId,actorId:context().actorId,requestId:'synthetic-read-1',runId:'synthetic-run',requestDigest:hash,selectorDigest:hash,processEpoch:'synthetic-process-1',registryContractVersion:'1.1.0',consumerProfile:'CURRENT_1_1',consumerProfileDigest:'223dbc1a1517671bcf8b1bdf77072ae6f9fb7d0c1858f7976ab2ebe4166e560e'};expect((await f.store.admitReadOccurrence(request)).status).toBe('PENDING');await expect(f.store.readSnapshot(async()=>{throw Error('synthetic-abort');})).rejects.toThrow('synthetic-abort');expect((await f.store.readOccurrenceLookup(request)).status).toBe('PENDING');const done=await f.store.finalizeReadOccurrence({request,status:'UNKNOWN',snapshotDigest:null,refusalCode:'TIMEOUT'});expect(done.status).toBe('UNKNOWN');expect(done.partialDataDiscarded).toBe(true);await expect(f.store.finalizeReadOccurrence({request,status:'COMPLETED',snapshotDigest:hash,refusalCode:null})).rejects.toThrow('read_already_terminal');await expect(f.store.readOccurrenceLookup({...request,processEpoch:'synthetic-restarted'})).rejects.toThrow('read_request_binding_conflict');});
test('currentCatalogPins returns digest-verified current heads in node order with no partial pins',async()=>{const f=await foundation();const owner=context().ownerId;const a1={id:'a-node',kind:'book_edition'},b1={id:'b-node',kind:'book_edition'},b2={id:'b-node',kind:'book_edition',label:'Invented second'};f.sql.seed('catalog_versions',{owner_id:owner,node_id:'b-node',sequence:1,revision_id:'rev-b1',payload:b1,content_digest:digest(b1)});f.sql.seed('catalog_versions',{owner_id:owner,node_id:'a-node',sequence:1,revision_id:'rev-a1',payload:a1,content_digest:digest(a1)});f.sql.seed('catalog_versions',{owner_id:owner,node_id:'b-node',sequence:2,revision_id:'rev-b2',payload:b2,content_digest:digest(b2)});const pins=await f.store.currentCatalogPins(owner);expect(pins.map(p=>[p.node.id,p.revisionId])).toEqual([['a-node','rev-a1'],['b-node','rev-b2']]);expect(pins[1]!.contentDigest).toBe(digest(b2));await f.store.readSnapshot(async view=>{expect(Object.keys(view)).toHaveLength(31);expect((await view.currentCatalogPins(owner)).map(p=>p.revisionId)).toEqual(['rev-a1','rev-b2']);});f.sql.seed('catalog_versions',{owner_id:owner,node_id:'c-node',sequence:1,revision_id:'rev-c1',payload:{id:'c-node',kind:'book_edition'},content_digest:'b'.repeat(64)});await expect(f.store.currentCatalogPins(owner)).rejects.toThrow('catalog_integrity');});
test('commitReadOutput holds the shared gate before the read key and commits the terminal audit before returning',async()=>{const f=await foundation();const request:ReadAdmission={ownerId:context().ownerId,actorId:context().actorId,requestId:'synthetic-output-1',runId:'synthetic-run',requestDigest:hash,selectorDigest:hash,processEpoch:'synthetic-process-1',registryContractVersion:'1.1.0',consumerProfile:'CURRENT_1_1',consumerProfileDigest:'223dbc1a1517671bcf8b1bdf77072ae6f9fb7d0c1858f7976ab2ebe4166e560e'};await f.store.admitReadOccurrence(request);const horizon=await f.store.readSnapshot(view=>computeReadHorizon(view,request.ownerId,request.actorId,'2026-10-24',[]));const mark=f.sql.queries.length;let escaped:TeacherPrerequisiteReadStore|undefined;const out=await f.store.commitReadOutput(request,async view=>{escaped=view;expect(Object.isFrozen(view)).toBe(true);expect('commitReadOutput' in view||'finalizeReadOccurrence' in view||'db' in view).toBe(false);expect(await view.teachers(request.ownerId)).toHaveLength(1);return {kind:'OUTPUT_READY',value:{items:['synthetic-page']},horizon};});expect(out).toEqual({value:{items:['synthetic-page']},requestId:request.requestId,outputAdmissionId:request.requestId,terminalStatus:'COMPLETED',emissionDisposition:'NOT_ATTEMPTED'});const looked=await f.store.readOccurrenceLookup(request);expect(looked.status).toBe('COMPLETED');expect(looked.snapshotDigest).toBe(digest({outputAdmissionId:request.requestId,value:{items:['synthetic-page']}}));const gateQueries=f.sql.queries.slice(mark);const shared=gateQueries.findIndex(q=>q.text.includes('pg_advisory_xact_lock_shared'));const readKey=gateQueries.findIndex(q=>q.text.includes('pg_advisory_xact_lock(')&&String(q.values[0]).includes('read:'+request.requestId));expect(shared).toBeGreaterThanOrEqual(0);expect(readKey).toBeGreaterThan(shared);await expect(escaped!.teachers(request.ownerId)).rejects.toThrow('read_snapshot_closed');await expect(f.store.commitReadOutput(request,async()=>({kind:'OUTPUT_READY',value:1}))).rejects.toThrow('read_already_terminal_or_unadmitted');expect((await f.store.readOccurrenceLookup(request)).status).toBe('COMPLETED');});
test('commitReadOutput refusal, prepare failure and terminal accounting never replay or upgrade',async()=>{const f=await foundation();const mk=(requestId:string):ReadAdmission=>({ownerId:context().ownerId,actorId:context().actorId,requestId,runId:'synthetic-run',requestDigest:hash,selectorDigest:hash,processEpoch:'synthetic-process-1',registryContractVersion:'1.1.0',consumerProfile:'CURRENT_1_1',consumerProfileDigest:'223dbc1a1517671bcf8b1bdf77072ae6f9fb7d0c1858f7976ab2ebe4166e560e'});const refused=mk('synthetic-output-refused');await f.store.admitReadOccurrence(refused);const refusedOut=await f.store.commitReadOutput(refused,async()=>({kind:'OUTPUT_REFUSED',code:'synthetic_denied'}));expect(refusedOut).toMatchObject({value:null,terminalStatus:'REFUSED',outputAdmissionId:refused.requestId});expect(await f.store.readOccurrenceLookup(refused)).toMatchObject({status:'REFUSED',refusalCode:'synthetic_denied'});const failed=mk('synthetic-output-failed');await f.store.admitReadOccurrence(failed);const failedOut=await f.store.commitReadOutput(failed,async()=>{throw Error('synthetic_prepare_failure');});expect(failedOut).toMatchObject({value:null,terminalStatus:'REFUSED'});expect(await f.store.readOccurrenceLookup(failed)).toMatchObject({status:'REFUSED',refusalCode:'output_prepare_failed'});await expect(f.store.commitReadOutput(mk('synthetic-output-never-admitted'),async()=>({kind:'OUTPUT_READY',value:1}))).rejects.toThrow('read_already_terminal_or_unadmitted');const unknown=mk('synthetic-output-unknown');await f.store.admitReadOccurrence(unknown);await f.store.finalizeReadOccurrence({request:unknown,status:'UNKNOWN',snapshotDigest:null,refusalCode:null});await expect(f.store.commitReadOutput(unknown,async()=>({kind:'OUTPUT_READY',value:1}))).rejects.toThrow('read_already_terminal_or_unadmitted');expect((await f.store.readOccurrenceLookup(unknown)).status).toBe('UNKNOWN');});
test('W12-F2 prepare-failure cleanup returns exact authoritative state when a participating finalizer already made it UNKNOWN',async()=>{const f=await foundation();const mk=(requestId:string):ReadAdmission=>({ownerId:context().ownerId,actorId:context().actorId,requestId,runId:'synthetic-run',requestDigest:hash,selectorDigest:hash,processEpoch:'synthetic-process-1',registryContractVersion:'1.1.0',consumerProfile:'CURRENT_1_1',consumerProfileDigest:'223dbc1a1517671bcf8b1bdf77072ae6f9fb7d0c1858f7976ab2ebe4166e560e'});const raced=mk('synthetic-output-finalizer-race');await f.store.admitReadOccurrence(raced);const driver=f.sql.sql as unknown as {begin:<T>(fn:(db:SQL)=>Promise<T>)=>Promise<T>};const originalBegin=driver.begin;let begins=0;driver.begin=async<T>(fn:(db:SQL)=>Promise<T>):Promise<T>=>{begins+=1;if(begins===2)await new NativePrerequisiteStore(f.sql.sql).finalizeReadOccurrence({request:raced,status:'UNKNOWN',snapshotDigest:null,refusalCode:null});return originalBegin(fn);};const racedOut=await (async()=>{try{return await f.store.commitReadOutput(raced,async()=>{throw Error('synthetic_prepare_failure');});}finally{driver.begin=originalBegin;}})();expect(racedOut).toMatchObject({value:null,terminalStatus:'UNKNOWN',outputAdmissionId:raced.requestId});expect(await f.store.readOccurrenceLookup(raced)).toMatchObject({status:'UNKNOWN',snapshotDigest:null,refusalCode:null});});
/* SC4: store-side complete-horizon recomputation at the final gate. The
 * preparatory horizon is captured in the REPEATABLE READ snapshot; the gate
 * must recompute from current state and refuse any drift class. */
async function sc4Horizon(f:Awaited<ReturnType<typeof foundation>>,businessDate='2026-10-24'){
 return f.store.readSnapshot(view=>computeReadHorizon(view,context().ownerId,context().actorId,businessDate,[]));
}
async function sc4Admit(f:Awaited<ReturnType<typeof foundation>>,requestId:string):Promise<ReadAdmission>{
 const request:ReadAdmission={ownerId:context().ownerId,actorId:context().actorId,requestId,runId:'synthetic-run',requestDigest:hash,selectorDigest:hash,processEpoch:'synthetic-process-1',registryContractVersion:'1.1.0',consumerProfile:'CURRENT_1_1',consumerProfileDigest:'223dbc1a1517671bcf8b1bdf77072ae6f9fb7d0c1858f7976ab2ebe4166e560e'};
 await f.store.admitReadOccurrence(request);return request;
}
test('OR2-01 real store gate ignores nonparticipant student head edits but refuses a new participant',async()=>{
 const f=await foundation(),owner=context().ownerId;
 f.sql.seed('students',{owner_id:owner,id:'student-b',display_name:'Invented peer',source_namespace:'academy_student',source_key:'synthetic-student-b',proof_refs:['synthetic'],registered_at:instant});
 const attach={context:context('or2-peer'),studentId:'student-b',expectedRevisionId:null,payload:{kind:'student_record' as const,displayName:known('Invented peer'),enrollmentState:known('ACTIVE' as const)}};
 const peer=await admitted(f.store,'append:student',attach,()=>f.store.appendStudentRevision(attach));
 const membership:OwnerAppendCommand<TemporalBinding>={context:context('or2-membership'),entityKey:null,expectedRevisionId:null,payload:{kind:'temporal_binding',bindingKind:'CLASS_MEMBERSHIP',subjectRef:f.ref('Student',peer),targetRef:f.recordScope.classGroupRef,validFrom:'2026-01-01',validTo:null,sourceLiteral:'Fictional dated membership',synthetic:true}};
 const member=await admitted(f.store,'append:binding',membership,()=>f.store.appendTemporalBinding(membership));
 const plan:ReadHorizonPlan={classGroupRef:f.recordScope.classGroupRef,studentRef:null,occurrence:{mode:'EXACT',lessonRef:f.recordScope.lessonRef},draftRef:null,expectedRevisions:[]};
 const horizon=await f.store.readSnapshot(view=>computeReadHorizon(view,owner,context().actorId,'2026-10-24',[],plan));
 expect(horizon.students).toEqual(['student-a']);
 expect(horizon.temporalEdges.some(e=>e.entityKey===member.identity.nativeKey)).toBe(true);
 const correction={...attach,context:context('or2-peer-correction'),expectedRevisionId:peer.revisionId,payload:{...attach.payload,displayName:known('Invented peer revised')}};
 const revised=await admitted(f.store,'append:student',correction,()=>f.store.appendStudentRevision(correction));
 const stableRequest=await sc4Admit(f,'or2-nonparticipant-edit');
 expect(await f.store.commitReadOutput(stableRequest,async()=>({kind:'OUTPUT_READY',value:{items:['same-class-page']},horizon}))).toMatchObject({terminalStatus:'COMPLETED',value:{items:['same-class-page']}});
 const lesson=await f.store.lessonCurrent(owner,f.lesson.identity.nativeKey);
 if(!lesson)throw Error('fictional lesson missing');
 const {lessonKey,ownerId,...lessonPayload}=lesson.payload;
 const joined:OwnerAppendCommand<LessonSessionRecord>={context:context('or2-peer-participates'),entityKey:lesson.entityKey,expectedRevisionId:lesson.revisionId,payload:{...lessonPayload,participantRefs:known([f.recordScope.studentRef,f.ref('Student',revised)])}};
 await admitted(f.store,'append:lesson',joined,()=>f.store.appendLesson(joined));
 const driftRequest=await sc4Admit(f,'or2-participant-change');
 expect(await f.store.commitReadOutput(driftRequest,async()=>({kind:'OUTPUT_READY',value:{items:['stale-class-page']},horizon}))).toMatchObject({terminalStatus:'REFUSED',value:null});
 expect(await f.store.readOccurrenceLookup(driftRequest)).toMatchObject({status:'REFUSED',refusalCode:'horizon_drift'});
});
test('SC4 no-drift gate recomputation completes with the preserved witness digest form',async()=>{
 const f=await foundation();const horizon=await sc4Horizon(f);const request=await sc4Admit(f,'sc4-no-drift');
 const out=await f.store.commitReadOutput(request,async()=>({kind:'OUTPUT_READY',value:{items:['sc4-page']},horizon}));
 expect(out).toEqual({value:{items:['sc4-page']},requestId:request.requestId,outputAdmissionId:request.requestId,terminalStatus:'COMPLETED',emissionDisposition:'NOT_ATTEMPTED'});
 expect(await f.store.readOccurrenceLookup(request)).toMatchObject({status:'COMPLETED',snapshotDigest:digest({outputAdmissionId:request.requestId,value:{items:['sc4-page']}})});
});
test('SC4 OUTPUT_READY without required horizon inputs refuses fail-closed with no page',async()=>{
 const f=await foundation();const request=await sc4Admit(f,'sc4-missing-horizon');
 const out=await f.store.commitReadOutput(request,async()=>({kind:'OUTPUT_READY',value:{items:['must-not-egress']}} as never));
 expect(out).toMatchObject({value:null,terminalStatus:'REFUSED',outputAdmissionId:request.requestId});
 expect(await f.store.readOccurrenceLookup(request)).toMatchObject({status:'REFUSED',refusalCode:'horizon_evidence_required',snapshotDigest:null});
});
test('SC4 owner-head revision drift after preparation refuses at the gate',async()=>{
 const f=await foundation();const horizon=await sc4Horizon(f);
 const fix={context:context('sc4-class-fix'),entityKey:f.group.identity.nativeKey,expectedRevisionId:f.group.revisionId,payload:{kind:'class_group' as const,displayName:known('Invented Class Corrected'),businessTimezone:known('Asia/Seoul'),classState:known('ACTIVE' as const),synthetic:true}};
 await admitted(f.store,'append:class',fix,()=>f.store.appendClassGroup(fix));
 const request=await sc4Admit(f,'sc4-revision-drift');
 const out=await f.store.commitReadOutput(request,async()=>({kind:'OUTPUT_READY',value:{items:['stale-page']},horizon}));
 expect(out).toMatchObject({value:null,terminalStatus:'REFUSED'});
 expect(await f.store.readOccurrenceLookup(request)).toMatchObject({status:'REFUSED',refusalCode:'horizon_drift',snapshotDigest:null});
});
test('SC4 whole-plan membership insert and delete both refuse at the gate',async()=>{
 const inserted=await foundation();const insertHorizon=await sc4Horizon(inserted);
 const extra={context:context('sc4-class-insert'),entityKey:null,expectedRevisionId:null,payload:{kind:'class_group' as const,displayName:known('Invented Inserted Class'),businessTimezone:known('Asia/Seoul'),classState:known('ACTIVE' as const),synthetic:true}};
 await admitted(inserted.store,'append:class',extra,()=>inserted.store.appendClassGroup(extra));
 const insertRequest=await sc4Admit(inserted,'sc4-membership-insert');
 expect(await inserted.store.commitReadOutput(insertRequest,async()=>({kind:'OUTPUT_READY',value:1,horizon:insertHorizon}))).toMatchObject({value:null,terminalStatus:'REFUSED'});
 expect(await inserted.store.readOccurrenceLookup(insertRequest)).toMatchObject({status:'REFUSED',refusalCode:'horizon_drift'});
 const deleted=await foundation();const deleteHorizon=await sc4Horizon(deleted);
 deleted.sql.rows('class_heads').splice(0,deleted.sql.rows('class_heads').length);
 const deleteRequest=await sc4Admit(deleted,'sc4-membership-delete');
 expect(await deleted.store.commitReadOutput(deleteRequest,async()=>({kind:'OUTPUT_READY',value:1,horizon:deleteHorizon}))).toMatchObject({value:null,terminalStatus:'REFUSED'});
 expect(await deleted.store.readOccurrenceLookup(deleteRequest)).toMatchObject({status:'REFUSED',refusalCode:'horizon_drift'});
});
test('SC4 catalog ancestor reparenting refuses even when the page rows are unchanged',async()=>{
 const f=await foundation();const owner=context().ownerId;
 const book={id:'sc4-book',kind:'book_edition',sourceKey:{namespace:'synthetic_catalog',literalKey:'sc4-book'},label:'Invented SC4 book',parent:{state:'unknown',reason:'root'}};
 const major={id:'sc4-major',kind:'major_unit',sourceKey:{namespace:'synthetic_catalog',literalKey:'sc4-major'},label:'Invented SC4 major',parent:legacyKnown('sc4-book',['synthetic-parent'])};
 const minor={id:'sc4-minor',kind:'minor_unit',sourceKey:{namespace:'synthetic_catalog',literalKey:'sc4-minor'},label:'Invented SC4 minor',parent:legacyKnown('sc4-major',['synthetic-parent'])};
 for(const node of [book,major,minor])f.sql.seed('catalog_versions',{owner_id:owner,node_id:node.id,sequence:1,revision_id:'sc4-rev-'+node.id,payload:node,content_digest:digest(node)});
 const horizon=await sc4Horizon(f);
 const reparented={...minor,parent:legacyKnown('sc4-book',['synthetic-parent'])};
 f.sql.seed('catalog_versions',{owner_id:owner,node_id:'sc4-minor',sequence:2,revision_id:'sc4-rev-minor-2',payload:reparented,content_digest:digest(reparented)});
 const request=await sc4Admit(f,'sc4-ancestor-drift');
 expect(await f.store.commitReadOutput(request,async()=>({kind:'OUTPUT_READY',value:{items:['same-rows']},horizon}))).toMatchObject({value:null,terminalStatus:'REFUSED'});
 expect(await f.store.readOccurrenceLookup(request)).toMatchObject({status:'REFUSED',refusalCode:'horizon_drift'});
});
test('SC4 temporal edge change and binding retirement refuse at the gate',async()=>{
 const edged=await foundation();const edgeHorizon=await sc4Horizon(edged);
 const binding=(await edged.store.temporalBindings(context().ownerId)).find(x=>x.payload.bindingKind==='CLASS_MEMBERSHIP')!;
 const {bindingKey:_bk,ownerId:_ow,...edgePayload}=binding.payload;
 const edgeFix={context:context('sc4-edge-fix'),entityKey:binding.entityKey,expectedRevisionId:binding.revisionId,payload:{...edgePayload,validTo:'2027-06-30'}};
 await admitted(edged.store,'append:binding',edgeFix,()=>edged.store.appendTemporalBinding(edgeFix));
 const edgeRequest=await sc4Admit(edged,'sc4-temporal-drift');
 expect(await edged.store.commitReadOutput(edgeRequest,async()=>({kind:'OUTPUT_READY',value:1,horizon:edgeHorizon}))).toMatchObject({value:null,terminalStatus:'REFUSED'});
 expect(await edged.store.readOccurrenceLookup(edgeRequest)).toMatchObject({status:'REFUSED',refusalCode:'horizon_drift'});
 const retired=await foundation();const retiredHorizon=await sc4Horizon(retired);
 const {teacherKey:_tk,ownerId:_to,...teacherPayload}=((await retired.store.teacherCurrent(context().ownerId,retired.teacher.identity.nativeKey))!).payload;
 const retire={context:context('sc4-retire'),entityKey:retired.teacher.identity.nativeKey,expectedRevisionId:retired.teacher.revisionId,payload:{...teacherPayload,state:'RETIRED' as const}};
 await admitted(retired.store,'append:teacher',retire,()=>retired.store.appendTeacher(retire));
 const retiredRequest=await sc4Admit(retired,'sc4-rights-drift');
 expect(await retired.store.commitReadOutput(retiredRequest,async()=>({kind:'OUTPUT_READY',value:1,horizon:retiredHorizon}))).toMatchObject({value:null,terminalStatus:'REFUSED'});
 expect((await retired.store.readOccurrenceLookup(retiredRequest)).status).toBe('REFUSED');
});
function seedScoreEvidence(f:Awaited<ReturnType<typeof foundation>>,attemptRef:unknown){
 const payload={kind:'native_score_evidence' as const,attemptRef,assignmentRef:objectRef('HomeworkAssignment','ngfix-homework','ngfix-homework-r1'),recordScope:f.recordScope,scale:{family:'daily_test_attempt' as const,version:'1.0.0' as const,kind:'OWNER_RECORDED_NUMERIC_SCORE' as const},score:{earned:2,maximum:5},recordedBy:f.ref('Teacher',f.teacher),measurementLiteral:'Invented explicit 2/5 score',synthetic:true};
 const body={ownerId:context().ownerId,namespace:'synthetic-native',scopeRef:context().scopeRef,entityKey:'ngfix-score',sequence:1,revisionId:'ngfix-score-r1',previousRevisionId:null,previousDigest:null,payload,contentDigest:digest(payload),sourceObservedAt:instant,recordedAt:instant,actorId:context().actorId,idempotencyKey:'ngfix-score',commandDigest:digest(payload)};
 const v={...body,integrityDigest:digest(body)};prerequisiteVersionFrom(v as never);
 f.sql.seed('native_score_evidence_versions',{owner_id:v.ownerId,entity_key:v.entityKey,sequence:1,revision_id:v.revisionId,body:v});
 f.sql.seed('native_score_evidence_heads',{owner_id:v.ownerId,entity_key:v.entityKey,sequence:1});return v;
}
test('NG-FINAL-E1-SCORE scoped attempt absence witness is in the horizon and score insertion refuses at the gate',async()=>{
 const f=await foundation();const owner=context().ownerId;
 const attempt=retainedBound(f.sql,'ngfix-attempt',{...exactAttemptFixture(),sourceStudent:progress().sourceStudent});
 const attemptRef=objectRef('DailyTestAttempt',attempt.entityId,attempt.revisionId);
 const attach={context:context('ngfix-scope'),entityKey:null,expectedRevisionId:null,payload:{kind:'activity_scope' as const,activityKind:'DAILY_TEST_ATTEMPT' as const,activityRef:attemptRef,recordScope:f.recordScope,sourceLiteral:'synthetic-explicit-scope',synthetic:true}};
 await admitted(f.store,'append:scope',attach as never,()=>f.store.appendActivityScope(attach as never));
 const horizon=await f.store.readSnapshot(view=>computeReadHorizon(view,owner,context().actorId,'2026-10-24',[]));
 expect(horizon.scoreHeads).toEqual([{attemptRef,revisionIds:[]}]);
 seedScoreEvidence(f,attemptRef);
 const request=await sc4Admit(f,'ngfix-score-drift');
 expect(await f.store.commitReadOutput(request,async()=>({kind:'OUTPUT_READY',value:{items:['must-not-egress']},horizon}))).toMatchObject({value:null,terminalStatus:'REFUSED'});
 expect(await f.store.readOccurrenceLookup(request)).toMatchObject({status:'REFUSED',refusalCode:'horizon_drift',snapshotDigest:null});
});
test('NG-FINAL-E1-SCORE observed (unscoped) whole-plan attempt is also a horizon dependency',async()=>{
 const f=await foundation();
 const attempt=retainedBound(f.sql,'ngfix-observed-attempt',{...exactAttemptFixture(),sourceStudent:progress().sourceStudent});
 const attemptRef=objectRef('DailyTestAttempt',attempt.entityId,attempt.revisionId);
 const horizon=await f.store.readSnapshot(view=>computeReadHorizon(view,context().ownerId,context().actorId,'2026-10-24',[]));
 expect(horizon.scoreHeads).toEqual([{attemptRef,revisionIds:[]}]);
});
test('student attachment uses existing identity and exact family revision; absent real history stays unknown',async()=>{const f=await foundation();expect(await f.store.studentRevisionCurrent(context().ownerId,'synthetic-unattached')).toBeNull();expect(f.student.identity.nativeKey).toBe('student-a');const cmd={context:context('student-correction'),studentId:'student-a',expectedRevisionId:f.student.revisionId,payload:{kind:'student_record' as const,displayName:known('Invented Corrected Student'),enrollmentState:known('ACTIVE' as const)}};const second=await admitted(f.store,'append:student',cmd,()=>f.store.appendStudentRevision(cmd));expect(second.sequence).toBe(2);expect(second.revisionId).not.toBe(f.student.revisionId);expect(await f.store.studentRevisionHistory(context().ownerId,'student-a')).toHaveLength(2);});

test('only exact first self binding bypasses ACTIVE; ordinary operations before binding and after retirement refuse',async()=>{
 const fake=new FictionalSql(),store:TeacherPrerequisiteStore=new PostgresAcademyStore(fake.sql);const c={context:context('before-bind-class'),entityKey:null,expectedRevisionId:null,payload:{kind:'class_group' as const,displayName:known('Invented class'),businessTimezone:known('Asia/Seoul'),classState:known('ACTIVE' as const),synthetic:true}};
 await expect(admitted(store,'append:class',c,()=>store.appendClassGroup(c))).rejects.toThrow('teacher_binding_required');expect(fake.rows('class_versions')).toHaveLength(0);
 const foreign={context:context('foreign-bind'),entityKey:null,expectedRevisionId:null,payload:{kind:'teacher_binding' as const,actorId:'synthetic-other-actor',teacherSourceKey:{namespace:'synthetic_teacher',literalKey:'synthetic-other'},displayName:known('Invented other teacher'),assignmentState:known('ACTIVE' as const),validFrom:'2026-01-01',validTo:null,state:'ACTIVE' as const,synthetic:true}};
 await expect(admitted(store,'append:teacher',foreign,()=>store.appendTeacher(foreign))).rejects.toThrow('teacher_attribution_conflict');expect(fake.rows('teacher_versions')).toHaveLength(0);
 const f=await foundation();const retire={...f.bind,context:context('retire-before-ordinary'),entityKey:f.teacher.identity.nativeKey,expectedRevisionId:f.teacher.revisionId,payload:{...f.bind.payload,state:'RETIRED' as const}};await admitted(f.store,'append:teacher',retire,()=>f.store.appendTeacher(retire));const after={...c,context:context('after-retirement-class')};await expect(admitted(f.store,'append:class',after,()=>f.store.appendClassGroup(after))).rejects.toThrow('teacher_binding_inactive');
 let escaped:TeacherPrerequisiteReadStore|undefined;await expect(f.store.readSnapshot(async view=>{escaped=view;throw Error('synthetic-read-abort');})).rejects.toThrow('synthetic-read-abort');await expect(escaped!.approvalClosurePreview(context(),objectRef('DailyRecordDraft'))).rejects.toThrow('read_snapshot_closed');
});
function retainedBound(sql:FictionalSql,entityId:string,payload:AcademyRecord){validateAcademyRecord(payload);const body={ownerId:context().ownerId,studentId:'student-a',entityId,sequence:1,revisionId:'synthetic-retained-'+entityId+'-r1',previousRevisionId:null,previousDigest:null,payload,contentDigest:digest(payload),sourceObservedAt:instant,recordedAt:instant,actorId:context().actorId,idempotencyKey:'synthetic-retained-'+entityId,commandDigest:digest({entityId,payload})};const v={...body,integrityDigest:digest(body)};sql.seed('record_versions',{owner_id:v.ownerId,student_id:v.studentId,entity_id:v.entityId,sequence:v.sequence,revision_id:v.revisionId,previous_revision_id:null,previous_digest:null,payload:v.payload,content_digest:v.contentDigest,integrity_digest:v.integrityDigest,source_observed_at:instant,recorded_at:instant,actor_id:v.actorId,idempotency_key:v.idempotencyKey,command_digest:v.commandDigest});sql.seed('record_heads',{owner_id:v.ownerId,student_id:v.studentId,entity_id:v.entityId,sequence:1,revision_id:v.revisionId,content_digest:v.contentDigest,last_verified_at:instant});return v;}
async function boundScene(witness:'finalizer'|'owner'|'forged'='finalizer'){const f=await foundation(undefined,instant);const store=f.store;const owner=context().ownerId;const work=exactWorkFixture();work.sourceStudent=progress().sourceStudent;work.dueDate=legacyKnown('2026-10-25',['synthetic-native-due']);const ids=['book','major','middle','minor','section','page','problem-1','problem-2'];const nodes=ids.map((id,i)=>({id,kind:({book:'book_edition',major:'major_unit',middle:'middle_unit',minor:'minor_unit',section:'learning_section',page:'printed_page','problem-1':'problem','problem-2':'problem'} as const)[id as typeof ids[number]]!,sourceKey:id==='book'?work.sourceBook:id.startsWith('problem-')?work.items[Number(id.slice(-1))-1]!.itemKey:{namespace:'synthetic_catalog',literalKey:id},label:'Invented '+id,parent:i===0?{state:'unknown' as const,reason:'root'}:legacyKnown(i>=6?'page':ids[i-1]!,['synthetic-parent'])}));for(const node of nodes)f.sql.seed('catalog_versions',{owner_id:owner,node_id:node.id,sequence:1,revision_id:'fixture-catalog-'+node.id,recorded_at:instant,payload:node,content_digest:digest(node)});const priorLesson={context:context('bound-prior-lesson'),entityKey:null,expectedRevisionId:null,payload:{kind:'lesson_session' as const,classGroupRef:f.recordScope.classGroupRef,businessDate:'2026-10-23',occurrenceOrdinal:known(1),startsAt:known('2026-10-23T00:00:00.000Z'),endsAt:known('2026-10-23T01:00:00.000Z'),teacherRefs:known([f.ref('Teacher',f.teacher)]),participantRefs:known([f.recordScope.studentRef]),lessonState:known('HELD' as const),synthetic:true}};const previous=await admitted(store,'append:lesson',priorLesson,()=>store.appendLesson(priorLesson as never));const previousScope={...f.recordScope,businessDate:'2026-10-23',lessonRef:f.ref('LessonSession',previous)};const participation={context:context('bound-prior-participation'),entityKey:null,expectedRevisionId:null,payload:{kind:'temporal_binding' as const,bindingKind:'LESSON_PARTICIPATION' as const,subjectRef:previousScope.lessonRef,targetRef:previousScope.studentRef,validFrom:'2026-01-01',validTo:null,sourceLiteral:'synthetic-native-participation',synthetic:true}};await admitted(store,'append:binding',participation,()=>store.appendTemporalBinding(participation as never));const registration=retainedBound(f.sql,'registration',{kind:'source_book_registration',sourceStudent:work.sourceStudent,sourceCourse:work.sourceCourse,sourceUserCourse:work.sourceUserCourse,sourceBook:work.sourceBook,catalogNodeId:'book',sourceCourseLabel:'Invented course',sourceBookLabel:'Invented book',sourceStatus:'Invented active',sourceProgressLiteral:'Invented progress',sourceLearningRangeLiteral:'Invented range',assignmentValidity:{state:'unknown',reason:'not_qualified'},role:{state:'unknown',reason:'not_qualified'},contractRef:'synthetic',evidenceRefs:['synthetic']});work.registrationRevisionId=registration.revisionId;const original=retainedBound(f.sql,'homework-origin',{...work,effectiveDate:'2026-10-23',dueDate:legacyKnown('2026-10-24',['synthetic-native-due'])});const current=retainedBound(f.sql,'homework-current',{...work,effectiveDate:'2026-10-24',assignmentKey:{namespace:'synthetic_assignment',literalKey:'synthetic-current'}});const attempt=retainedBound(f.sql,'attempt-current',{...exactAttemptFixture(),sourceStudent:work.sourceStudent,assignmentRevisionId:current.revisionId,occurredAt:legacyKnown(instant,['synthetic-native-occurrence'])});const attach=async(kind:string,ref:never,recordScope=f.recordScope)=>{const cmd={context:context('bound-scope-'+(ref as {identity:{nativeKey:string}}).identity.nativeKey),entityKey:null,expectedRevisionId:null,payload:{kind:'activity_scope',activityKind:kind,activityRef:ref,recordScope,sourceLiteral:'synthetic-explicit-scope',synthetic:true}};return admitted(store,'append:scope',cmd as never,()=>store.appendActivityScope(cmd as never));};const originalRef=objectRef('HomeworkAssignment',original.entityId,original.revisionId),homeworkRef=objectRef('HomeworkAssignment',current.entityId,current.revisionId),attemptRef=objectRef('DailyTestAttempt',attempt.entityId,attempt.revisionId);await attach('HOMEWORK_ASSIGNMENT',originalRef as never,previousScope);await attach('HOMEWORK_ASSIGNMENT',homeworkRef as never);await attach('DAILY_TEST_ATTEMPT',attemptRef as never);const p={...progress(),recordScope:f.recordScope,contentScope:{...progress().contentScope,editionRef:objectRef('TextbookEdition','book','fixture-catalog-book'),unitRef:objectRef('Unit','minor','fixture-catalog-minor'),sectionRefs:known([objectRef('Section','section','fixture-catalog-section')])}};const pc={context:context('bound-create-progress'),studentId:'student-a',payload:p};const progressResult=await admitted(store,'createProgress',pc,()=>store.createProgress(pc));const progressRef=f.ref('DailyProgress',progressResult);await attach('DAILY_PROGRESS',progressRef as never);const a={...assessment(),assessmentScope:f.recordScope,homeworkRef:originalRef,evidenceRefs:[originalRef.revision],assessedBy:known(f.ref('Teacher',f.teacher)),assessedAt:known(instant)};const ac={context:context('bound-create-assessment'),studentId:'student-a',payload:a};const assessmentResult=await admitted(store,'createAssessment',ac,()=>store.createAssessment(ac));const assessmentRef=f.ref('PreviousHomeworkAssessment',assessmentResult);await attach('PREVIOUS_HOMEWORK_ASSESSMENT',assessmentRef as never);const scoreCommand={context:context('bound-record-score'),entityKey:null,expectedRevisionId:null,payload:{kind:'native_score_evidence' as const,attemptRef,assignmentRef:homeworkRef,recordScope:f.recordScope,scale:{family:'daily_test_attempt' as const,version:'1.0.0' as const,kind:'OWNER_RECORDED_NUMERIC_SCORE' as const},score:{earned:3,maximum:7},recordedBy:f.ref('Teacher',f.teacher),measurementLiteral:'Invented explicit 3/7 measurement; item grades carry no numeric scale',synthetic:true}};const scoreResult=await admitted(store,'appendScoreEvidence',scoreCommand,()=>store.appendScoreEvidence(scoreCommand));const proposalSources={progress:[{ref:progressRef,payload:p}],homework:[{ref:homeworkRef,payload:current.payload}],attempts:[{ref:attemptRef,payload:{attempt:attempt.payload,scoreEvidence:{revision:scoreResult.revisionId,payload:scoreCommand.payload}}}],previousAssessments:[{ref:assessmentRef,payload:a}]};const texts=nativeProposalTexts(proposalSources),proposalEvidence=(rows:{ref:{identity:{objectType:string;nativeKey:string};revision:string}}[])=>rows.map(({ref})=>({sourceRef:{...context().scopeRef,objectTypeId:ref.identity.objectType,objectTypeVersion:ref.identity.objectType==='Section'?'1.1.0':'1.0.0',objectKey:ref.identity.nativeKey},sourceRevision:ref.revision,locator:'NATIVE_SOURCE_RENDERING_V1',observedAt:instant}));const d={...draft(),recordScope:f.recordScope,progressRefs:known([progressRef]),homeworkRefs:known([homeworkRef]),attemptRefs:known([attemptRef]),previousAssessmentRefs:known([assessmentRef]),responsibleTeacherRef:known(f.ref('Teacher',f.teacher)),progressText:{state:'known' as const,value:texts.progressText,evidence:proposalEvidence(proposalSources.progress)},homeworkText:{state:'known' as const,value:texts.homeworkText,evidence:proposalEvidence([...proposalSources.homework,...proposalSources.previousAssessments])},noteText:{state:'known' as const,value:texts.noteText,evidence:proposalEvidence(proposalSources.attempts)}};const read:ReadAdmission={ownerId:owner,actorId:context().actorId,requestId:'bound-source-read',runId:'synthetic-run',requestDigest:hash,selectorDigest:hash,processEpoch:'synthetic-process-1',registryContractVersion:'1.1.0',consumerProfile:'CURRENT_1_1',consumerProfileDigest:'223dbc1a1517671bcf8b1bdf77072ae6f9fb7d0c1858f7976ab2ebe4166e560e'};await store.admitReadOccurrence(read);let committed:{terminalStatus:string;outputAdmissionId:string}|null=null;if(witness==='owner'){const gateHorizon=await store.readSnapshot(view=>computeReadHorizon(view,owner,context().actorId,f.recordScope.businessDate,[attemptRef]));committed=await store.commitReadOutput(read,async()=>({kind:'OUTPUT_READY' as const,value:{snapshot:d.sourceSnapshot,items:[] as string[]},horizon:gateHorizon}));}else await store.finalizeReadOccurrence({request:read,status:'COMPLETED',snapshotDigest:witness==='forged'?'b'.repeat(64):digest(d.sourceSnapshot),refusalCode:null});const dc={context:context('bound-create-draft'),studentId:'student-a',payload:d};const draftResult=await admitted(store,'createDraft',dc,()=>store.createDraft(dc));const draftRef=f.ref('DailyRecordDraft',draftResult);return {...f,store,dc,progressResult,assessmentResult,draftResult,draftRef,attempt,scoreResult,scoreCommand,proposalSources,draftPayload:d,read,committed};}
test('W12-F3 owner-committed page satisfies approvalClosure; forged witness still refused',async()=>{const ownerScene:any=await boundScene('owner');expect(ownerScene.committed).toMatchObject({terminalStatus:'COMPLETED',outputAdmissionId:ownerScene.read.requestId});expect(await ownerScene.store.readOccurrenceLookup(ownerScene.read)).toMatchObject({status:'COMPLETED',snapshotDigest:digest(ownerScene.draftPayload.sourceSnapshot)});const closure=await ownerScene.store.approvalClosurePreview(context('w12f3-owner-closure'),ownerScene.draftRef);expect(closure.targets[0]?.ref.objectKey).toBe(ownerScene.draftRef.identity.nativeKey);const forgedScene:any=await boundScene('forged');await expect(forgedScene.store.approvalClosurePreview(context('w12f3-forged-closure'),forgedScene.draftRef)).rejects.toThrow('source_snapshot_unverified');});
test('score evidence snapshot bound: at valid, after refuses at issue and consume, fresh snapshot succeeds',async()=>{
 const lateAt='2026-10-24T00:00:30.000Z';
 const freshAt='2026-10-24T00:00:45.000Z';
 const lateScore=async(f:any,tag:string)=>{
  f.sql.now=lateAt;
  const correction={...f.scoreCommand,context:{...context(tag+'-score'),sourceObservedAt:lateAt},entityKey:f.scoreResult.identity.nativeKey,expectedRevisionId:f.scoreResult.revisionId,payload:{...f.scoreCommand.payload,score:{earned:4,maximum:7},measurementLiteral:'Invented late measurement after completed snapshot'}};
  const score=await admitted(f.store,'appendScoreEvidence',correction,()=>f.store.appendScoreEvidence(correction));
  const sources={...f.proposalSources,attempts:[{ref:f.scoreCommand.payload.attemptRef,payload:{attempt:f.attempt.payload,scoreEvidence:{revision:score.revisionId,payload:correction.payload}}}]};
  const draftCommand={context:{...context(tag+'-draft'),sourceObservedAt:lateAt},studentId:'student-a',entityId:f.draftRef.identity.nativeKey,expectedRevisionId:f.draftRef.revision,payload:{...f.dc.payload,noteText:{...f.dc.payload.noteText,value:nativeProposalTexts(sources).noteText}}};
  const draft=await admitted(f.store,'correctPrerequisiteRecord',draftCommand,()=>f.store.correctPrerequisiteRecord(draftCommand));
  return {score,draft,draftRef:f.ref('DailyRecordDraft',draft),draftPayload:draftCommand.payload};
 };
 {const f:any=await boundScene();const target=context('bound-at-consume');const closure=await f.store.readSnapshot((view:any)=>view.approvalClosurePreview(target,f.draftRef));const issue={context:context('bound-at-issue'),draftRef:f.draftRef,closure,validForSeconds:900};await f.store.admitCommand({context:issue.context,requestDigest:requestDigest('issueApproval',issue)});const proof=await f.store.issueApproval(issue);expect(proof.payload.state).toBe('ISSUED');const consume={context:target,draftRef:f.draftRef,approvalProofHandle:proof.proofHandle};await admitted(f.store,'consumeApprovalAndApproveDraft',consume,()=>f.store.consumeApprovalAndApproveDraft(consume));const h=await f.store.history(target.ownerId,'student-a',f.draftRef.identity.nativeKey);const last=h.at(-1)!.payload;expect(last.kind==='daily_record_draft'&&last.draftState.state==='known'&&last.draftState.value).toBe('APPROVED');}
 {const f:any=await boundScene();const beforeClosure=await f.store.readSnapshot((view:any)=>view.approvalClosurePreview(context('bound-late-pre'),f.draftRef));const late=await lateScore(f,'bound-late');const approvalsBefore=f.sql.rows('approval_versions').length;const target=context('bound-late-consume');await expect(f.store.readSnapshot((view:any)=>view.approvalClosurePreview(target,late.draftRef))).rejects.toThrow('source_snapshot_unverified');const issue={context:context('bound-late-issue'),draftRef:late.draftRef,closure:beforeClosure,validForSeconds:900};await f.store.admitCommand({context:issue.context,requestDigest:requestDigest('issueApproval',issue)});await expect(f.store.issueApproval(issue)).rejects.toThrow('source_snapshot_unverified');expect(f.sql.rows('approval_versions')).toHaveLength(approvalsBefore);
  f.sql.now=freshAt;const freshSnapshot={...late.draftPayload.sourceSnapshot,readRevision:'synthetic-snapshot-fresh',asOf:freshAt};const read:ReadAdmission={ownerId:target.ownerId,actorId:target.actorId,requestId:'bound-fresh-read',runId:'synthetic-run',requestDigest:hash,selectorDigest:hash,processEpoch:'synthetic-process-1',registryContractVersion:'1.1.0',consumerProfile:'CURRENT_1_1',consumerProfileDigest:'223dbc1a1517671bcf8b1bdf77072ae6f9fb7d0c1858f7976ab2ebe4166e560e'};await f.store.admitReadOccurrence(read);await f.store.finalizeReadOccurrence({request:read,status:'COMPLETED',snapshotDigest:digest(freshSnapshot),refusalCode:null});const freshCommand={context:{...context('bound-fresh-draft'),sourceObservedAt:freshAt},studentId:'student-a',entityId:late.draft.identity.nativeKey,expectedRevisionId:late.draft.revisionId,payload:{...late.draftPayload,sourceSnapshot:freshSnapshot}};const freshDraft=await admitted(f.store,'correctPrerequisiteRecord',freshCommand,()=>f.store.correctPrerequisiteRecord(freshCommand));const freshRef=f.ref('DailyRecordDraft',freshDraft);const freshTarget=context('bound-fresh-consume');const closure=await f.store.readSnapshot((view:any)=>view.approvalClosurePreview(freshTarget,freshRef));const freshIssue={context:context('bound-fresh-issue'),draftRef:freshRef,closure,validForSeconds:900};await f.store.admitCommand({context:freshIssue.context,requestDigest:requestDigest('issueApproval',freshIssue)});const proof=await f.store.issueApproval(freshIssue);const consume={context:freshTarget,draftRef:freshRef,approvalProofHandle:proof.proofHandle};await admitted(f.store,'consumeApprovalAndApproveDraft',consume,()=>f.store.consumeApprovalAndApproveDraft(consume));const h=await f.store.history(freshTarget.ownerId,'student-a',freshRef.identity.nativeKey);const last=h.at(-1)!.payload;expect(last.kind==='daily_record_draft'&&last.draftState.state==='known'&&last.draftState.value).toBe('APPROVED');}
 {const f:any=await boundScene();const target=context('bound-consume-target');const closure=await f.store.readSnapshot((view:any)=>view.approvalClosurePreview(target,f.draftRef));const issue={context:context('bound-consume-issue'),draftRef:f.draftRef,closure,validForSeconds:900};await f.store.admitCommand({context:issue.context,requestDigest:requestDigest('issueApproval',issue)});const proof=await f.store.issueApproval(issue);const late=await lateScore(f,'bound-consume');const beforeDraft=await f.store.history(target.ownerId,'student-a',late.draftRef.identity.nativeKey);const beforeApproval=await f.store.approvalCurrent(target.ownerId,proof.approvalId);const consume={context:target,draftRef:late.draftRef,approvalProofHandle:proof.proofHandle};await expect(admitted(f.store,'consumeApprovalAndApproveDraft',consume,()=>f.store.consumeApprovalAndApproveDraft(consume))).rejects.toThrow('source_snapshot_unverified');expect(await f.store.history(target.ownerId,'student-a',late.draftRef.identity.nativeKey)).toEqual(beforeDraft);expect(await f.store.approvalCurrent(target.ownerId,proof.approvalId)).toEqual(beforeApproval);}
});

// W17: caller observation time never proves when an owner revision existed.
for(const family of ['teacher','class','lesson','student_record','binding','activity_scope','native_score_evidence','record','catalog'] as const){
 test(`W17-SNAPSHOT dependency ${family} recorded after completed snapshot refuses`,async()=>{
  const f=await boundScene('owner');
  const row=family==='record'?f.sql.rows('record_versions').find(r=>(r.payload as {kind:string}).kind==='daily_progress')!:family==='catalog'?f.sql.rows('catalog_versions')[0]!:f.sql.rows(family+'_versions')[0]!;
  const late='2026-10-24T00:00:30.000Z';
  if(family==='record'){
   row.recorded_at=late;
   // Preserve storage integrity: this is a valid, later owner recording, not corruption.
   const v={ownerId:row.owner_id,studentId:row.student_id,entityId:row.entity_id,sequence:row.sequence,revisionId:row.revision_id,previousRevisionId:row.previous_revision_id,previousDigest:row.previous_digest,payload:row.payload,contentDigest:row.content_digest,sourceObservedAt:row.source_observed_at,recordedAt:late,actorId:row.actor_id,idempotencyKey:row.idempotency_key,commandDigest:row.command_digest};
   row.integrity_digest=digest(v);
  }else if(family==='catalog')row.recorded_at=late;
  else {const body=row.body as OwnerVersion;const {integrityDigest:_old,...v}=body;row.body={...v,recordedAt:late,integrityDigest:digest({...v,recordedAt:late})};}
  f.sql.now='2026-10-24T00:01:00.000Z';
  await expect(f.store.approvalClosurePreview(context('w17-late-'+family),f.draftRef)).rejects.toThrow('source_snapshot_unverified');
 });
}
test('W17-SNAPSHOT backdated genuine score correction refuses preview, issue and consume without effects',async()=>{
 const f=await boundScene('owner'),target=context('w17-target');
 const closure=await f.store.approvalClosurePreview(target,f.draftRef);
 const issue={context:context('w17-issue-before'),draftRef:f.draftRef,closure,validForSeconds:900};
 await f.store.admitCommand({context:issue.context,requestDigest:requestDigest('issueApproval',issue)});
 const proof=await f.store.issueApproval(issue);
 f.sql.now='2026-10-24T00:00:30.000Z';
 const correction={...f.scoreCommand,context:context('w17-late-real-score'),entityKey:f.scoreResult.identity.nativeKey,expectedRevisionId:f.scoreResult.revisionId,payload:{...f.scoreCommand.payload,score:{earned:4,maximum:7}}};
 const score=await admitted(f.store,'appendScoreEvidence',correction,()=>f.store.appendScoreEvidence(correction));
 const sources={...f.proposalSources,attempts:[{ref:f.scoreCommand.payload.attemptRef,payload:{attempt:f.attempt.payload,scoreEvidence:{revision:score.revisionId,payload:correction.payload}}}]};
 const dc={context:context('w17-late-real-draft'),studentId:'student-a',entityId:f.draftRef.identity.nativeKey,expectedRevisionId:f.draftRef.revision,payload:{...f.draftPayload,noteText:{...f.draftPayload.noteText,value:nativeProposalTexts(sources).noteText}}};
 const updated=await admitted(f.store,'correctPrerequisiteRecord',dc,()=>f.store.correctPrerequisiteRecord(dc)),ref=f.ref('DailyRecordDraft',updated);
 expect((await f.store.scoreEvidenceCurrent(target.ownerId,score.identity.nativeKey))!.sourceObservedAt).toBe(instant);
 const before=f.sql.state();
 await expect(f.store.approvalClosurePreview(target,ref)).rejects.toThrow('source_snapshot_unverified');
 const lateIssue={...issue,context:context('w17-issue-after'),draftRef:ref};await f.store.admitCommand({context:lateIssue.context,requestDigest:requestDigest('issueApproval',lateIssue)});
 const afterAdmission=f.sql.state();await expect(f.store.issueApproval(lateIssue)).rejects.toThrow('source_snapshot_unverified');expect(f.sql.state()).toBe(afterAdmission);
 const consume={context:target,draftRef:ref,approvalProofHandle:proof.proofHandle};await f.store.admitCommand({context:target,requestDigest:requestDigest('consumeApprovalAndApproveDraft',consume)});
 const afterConsumeAdmission=f.sql.state();await expect(f.store.consumeApprovalAndApproveDraft(consume)).rejects.toThrow('source_snapshot_unverified');expect(f.sql.state()).toBe(afterConsumeAdmission);expect(before).not.toBe('');
});
for(const [method,family] of [['appendTeacher','teacher'],['appendClassGroup','class'],['appendLesson','lesson'],['appendTemporalBinding','binding'],['appendActivityScope','activity_scope'],['appendStudentRevision','student_record'],['appendScoreEvidence','native_score_evidence']] as const){
 test(`W17-WRITE ${method} snapshots caller aliases before SQL suspension`,async()=>{
  const f=await boundScene('owner');const v=f.sql.rows(family+'_versions').at(-1)!.body as OwnerVersion;
  const command:any={context:context('w17-alias-'+method),entityKey:v.entityKey,expectedRevisionId:v.revisionId,payload:structuredClone(v.payload)};
  for(const allocated of ['teacherKey','classKey','lessonKey','bindingKey','ownerId'])delete command.payload[allocated];
  if(method==='appendStudentRevision'){delete command.entityKey;command.studentId='student-a';}
  if(method==='appendActivityScope'){const action=scopeActionDefinitions.CorrectActivityScope;command.context.action={name:action.name,version:action.version,definitionSha256:digest(action)};}
  const operation=method==='appendScoreEvidence'?method:'append:'+({teacher:'teacher',class:'class',lesson:'lesson',binding:'binding',activity_scope:'scope',student_record:'student'} as Record<string,string>)[family];
  f.sql.now='2026-10-24T00:01:00.000Z';const original=structuredClone(command),expected=requestDigest(operation,original);await f.store.admitCommand({context:command.context,requestDigest:expected});let changed=false;
  f.sql.beforeQuery=text=>{if(!changed&&text.startsWith('SET TRANSACTION')){changed=true;command.context.sourceObservedAt='2026-10-24T00:00:01.000Z';if(command.payload.displayName)command.payload.displayName.value='Invented changed after digest';}};
  const result=await (f.store[method] as (c:any)=>Promise<NativeWriteResult>)(command);f.sql.beforeQuery=undefined;
  expect(changed).toBe(true);expect(result.receipt.requestDigest).toBe(expected);
  const stored=await f.store.ownerRevision(original.context.ownerId,method==='appendScoreEvidence'?'evidence':({teacher:'teacher',class:'class',lesson:'lesson',binding:'binding',activity_scope:'scope',student_record:'student'} as const)[family as 'teacher'],v.entityKey,result.revisionId);
  expect(stored!.payload).toEqual(v.payload);expect(stored!.commandDigest).toBe(expected);expect(stored!.sourceObservedAt).toBe(original.context.sourceObservedAt);
 });
}

test('W17-WRITE every native command ingress snapshots complete objects before any validation or await',async()=>{
 const inspect=async(file:string,names:Record<string,string[]>)=>{
  const js=new Bun.Transpiler({loader:'ts'}).transformSync(await Bun.file(file).text());
  for(const [name,args] of Object.entries(names)){
   const match=new RegExp('^[ \t]*(?:async\\s+)?'+name+'\\([\\s\\S]*?\\)\\s*\\{([^}]{0,240})','m').exec(js);
   expect(match).not.toBeNull();
   const statements=match![1]!.replace(/\s/g,'').split(';');
   args.forEach((arg,i)=>expect(statements[i]).toBe(`${arg}=immutableCopy(${arg})`));
  }
 };
 await inspect('src/academy/nativePrerequisiteStore.ts',Object.fromEntries(['admitCommand','fenceCommand','appendScoreEvidence','ownerWrite','appendStudentRevision','studentWrite','issueApproval','consumeApprovalAndApproveDraft','revokeApproval','finalizeReadOccurrence'].map(n=>[n,['c']]).concat([['admitReadOccurrence',['r']]])));
 await inspect('src/academy/prerequisiteApplication.ts',Object.fromEntries(['bindTeacher','updateTeacher','retireTeacher','createClassGroup','updateClassGroup','createLessonSession','updateLessonSession','upsertTemporalBinding','attachStudentRevision','updateStudentRevision','attachActivityScope','correctActivityScope','createProgress','correctProgress','createAssessment','correctAssessment','createDraft','updateDraft','recordScoreEvidence','previewApprovalClosure','issueApproval','approveDraft','revokeApproval','commandOutcome','fenceCommand','finalizeReadOccurrence'].map(n=>[n,['context','input']]).concat([['admitReadOccurrence',['context','request']]])));
 await inspect('src/academy/postgresStore.ts',{append:['command'],registerStudent:['input'],saveCatalog:['node'],applySourceRefresh:['cohort'],applySourceArea:['outcome'],commitReadOutput:['request']});
});

test('W17-PRIORITY stale implicit catalog pin precedes a simultaneous post-snapshot teacher recording',async()=>{
 const {approvalRefusalPrecedence}=await import('../../src/academy/contracts/prerequisiteRecords');
 const f=await boundScene('owner'),row=f.sql.rows('teacher_versions')[0]!,body=row.body as OwnerVersion,{integrityDigest:_old,...v}=body,late='2026-10-24T00:00:30.000Z';
 row.body={...v,recordedAt:late,integrityDigest:digest({...v,recordedAt:late})};
 f.sql.rows('catalog_versions')[0]!.revision_id='synthetic-current-catalog-after-snapshot';f.sql.now=late;
 await expect(f.store.approvalClosurePreview(context('w17-compound-source'),f.draftRef)).rejects.toThrow(approvalRefusalPrecedence.SOURCE_REVISION.code);
});
test('W17-PRIORITY snapshot validity has one shared refusal row between cited revisions and closure equality',async()=>{
 const {approvalRefusalPrecedence}=await import('../../src/academy/contracts/prerequisiteRecords');
 const row=Reflect.get(approvalRefusalPrecedence,'SOURCE_SNAPSHOT') as {priority:number;code:string;status:number}|undefined;
 expect(row).toBeDefined();expect(row!.code).toBe('source_snapshot_unverified');expect(row!.status).toBe(409);
 expect(approvalRefusalPrecedence.SOURCE_REVISION.priority).toBeLessThan(row!.priority);expect(row!.priority).toBeLessThan(approvalRefusalPrecedence.CLOSURE_EQUALITY.priority);
});

// W18: every ordinary facade query must use the same owner snapshot as its gate.
const facadeSource=await Bun.file(new URL('../../src/academy/prerequisiteApplication.ts',import.meta.url)).text();
const {PrerequisiteApplication:FacadeUnderTest}=await import('../../src/academy/prerequisiteApplication');
const facadePublicSignatures=new Map([...facadeSource.matchAll(/^  async (\w+)\(([^\n]*)/gm)].map(m=>[m[1]!,m[2]!]));
function facadeParameters(signature:string){return signature.split(')')[0]!.split(',').map(p=>{
 const m=/^\s*(\w+)\??(?::([^=]+))?(?:=(.*))?$/.exec(p);if(!m)throw Error('facade_parameter_fixture_required@nativePrerequisiteStore.test.ts:350');
 return {name:m[1]!,type:m[2]?.trim(),initial:m[3]?.trim()};
});}
const facadeReadMethods=Object.getOwnPropertyNames(FacadeUnderTest.prototype).filter(name=>facadePublicSignatures.has(name)&&Reflect.get(FacadeUnderTest.prototype,name).toString().includes('this.gatedRead('));
for(const method of facadeReadMethods){
 test(`W18-READ-ALIAS ${method} retains authorized owner and object inputs across the binding await`,async()=>{
  const f=await foundation(),teacher=await f.store.teacherCurrent(context().ownerId,f.teacher.identity.nativeKey);
  const implementation=Reflect.get(FacadeUnderTest.prototype,method).toString(),query=/view\.(\w+)\(/.exec(implementation)?.[1];expect(query).toBeDefined();
  const command=context('w18-preview'),{ownerId:_owner,actorId:_actor,verifiedSession,...ingress}=command;
  const args=facadeParameters(facadePublicSignatures.get(method)!).slice(1).map(p=>{
   if(p.type==='string')return p.name==='studentId'?'student-a':'synthetic-key';
   if(p.type==='OwnerFamily')return 'class';
   if(p.type==='number'||p.initial&&/^[0-9]+$/.test(p.initial))return p.initial&&/^[0-9]+$/.test(p.initial)?Number(p.initial):p.name==='limit'?200:0;
   if(p.type==='ActivityScopeFilter')return {lessonKey:'synthetic-original-lesson'};
   if(p.type?.startsWith('ObjectRef<'))return objectRef('DailyTestAttempt','synthetic-original-attempt');
   if(p.type==='PreviewApprovalClosureInput')return {command:{...ingress,authenticationRevision:verifiedSession.authenticationRevision},draftRef:objectRef('DailyRecordDraft','synthetic-draft')};
   throw Error('facade_input_fixture_required@nativePrerequisiteStore.test.ts:365');
  });const expected=structuredClone(args);
  let enter:()=>void=()=>{},release:()=>void=()=>{};const entered=new Promise<void>(r=>enter=r),paused=new Promise<void>(r=>release=r);let authorized:unknown[]=[],queried:unknown[]=[];
  const view={teacherBindingByActor:async(...args:unknown[])=>{authorized=structuredClone(args);enter();await paused;return teacher;},[query!]:async(...args:unknown[])=>{queried=structuredClone(args);return [];}};
  const port={...view,readSnapshot:async(read:(v:unknown)=>Promise<unknown>)=>read(Object.freeze(view))};
  const app=new FacadeUnderTest(port as unknown as TeacherPrerequisiteStore,context().ownerId,()=>instant),caller={ownerId:context().ownerId,actorId:context().actorId,role:'teacher' as const};
  const result=Reflect.apply(Reflect.get(app,method),app,[caller,...args]);await entered;caller.ownerId='synthetic-unrelated-owner';
  const mutate=(v:unknown):boolean=>{if(!v||typeof v!=='object')return false;for(const [k,x] of Object.entries(v)){if(typeof x==='string'){Reflect.set(v,k,'synthetic-mutated');return true;}if(mutate(x))return true;}return false;};args.forEach(mutate);
  release();await result;
  expect(authorized).toEqual([context().ownerId,context().actorId]);
  const owner=typeof queried[0]==='string'?queried[0]:queried[0]&&typeof queried[0]==='object'?Reflect.get(queried[0],'ownerId'):null;
  expect(owner).toBe(context().ownerId);
  expect(queried.slice(1)).toEqual(query==='approvalClosurePreview'?[(expected[0] as {draftRef:unknown}).draftRef]:expected);expect(Object.isFrozen(caller)).toBe(false);
 });
}
test('W18-READ-ALIAS every public facade method snapshots its context and every object argument before work',async()=>{
 const {PrerequisiteApplication}=await import('../../src/academy/prerequisiteApplication');
 const source=await Bun.file('src/academy/prerequisiteApplication.ts').text(),js=new Bun.Transpiler({loader:'ts'}).transformSync(source);
 const publicMethods=[...source.matchAll(/^  async (\w+)\(([^\n]*)/gm)].map(m=>({name:m[1]!,signature:m[2]!}));
 const privateMethods=[...source.matchAll(/^  private (?:async )?(\w+)(?:<[^\n]*?>)?\(/gm)].map(m=>m[1]!);
 expect(Object.getOwnPropertyNames(PrerequisiteApplication.prototype).filter(n=>n!=='constructor'&&!privateMethods.includes(n)).sort()).toEqual(publicMethods.map(m=>m.name).sort());
 for(const {name,signature} of publicMethods){
  const args=signature.split(')')[0]!.split(',').map(p=>{
   const parameter=/^\s*(\w+)\??(?::([^=]+))?(?:=(.*))?$/.exec(p);expect(parameter).not.toBeNull();
   const [,name,type,initial]=parameter!,scalar=type?['string','number','boolean','OwnerFamily'].includes(type.trim()):initial!==undefined&&/^(?:[0-9]+|true|false)$/.test(initial.trim());
   return scalar?null:name!;
  }).filter((name):name is string=>name!==null);

  const body=new RegExp('^[ \\t]*(?:async\\s+)?'+name+'\\([\\s\\S]*?\\)\\s*\\{([^}]{0,500})','m').exec(js);expect(body).not.toBeNull();
  const statements=body![1]!.replace(/\s/g,'').split(';');args.forEach((arg,i)=>expect(statements[i]).toBe(`${arg}=immutableCopy(${arg})`));
 }
});

for(const baseline of [{tables_ready:true,history_triggers:2,accept:true},{tables_ready:false,history_triggers:2,accept:false},{tables_ready:true,history_triggers:1,accept:false}]){
 test(`W18-STARTUP legacy readiness tables=${baseline.tables_ready} triggers=${baseline.history_triggers} without native schema`,async()=>{
  const queries:string[]=[];const db=(async(parts:TemplateStringsArray)=>{const sql=parts.join('?');queries.push(sql);return sql.includes('AS tables_ready')?[{tables_ready:baseline.tables_ready,history_triggers:baseline.history_triggers}]:[{ready:false,count:0}];}) as unknown as SQL;
  const store=new PostgresAcademyStore(db);
  if(baseline.accept)await expect(store.assertRuntimeReady()).resolves.toBeUndefined();else await expect(store.assertRuntimeReady()).rejects.toThrow('existing_academy_schema_required');
  expect(queries).toHaveLength(1);expect(queries[0]).not.toMatch(/\b(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|REVOKE|GRANT)\b/i);
 });
}
test('W18-STARTUP native composition independently demands all native readiness after compatible base readiness',async()=>{
 const source=await Bun.file('harness/native_foundations_qualification.ts').text();
 const composition=source.slice(source.indexOf('const store=new PostgresAcademyStore(ownerDb'),source.indexOf('const probed=new Set',source.indexOf('const store=new PostgresAcademyStore(ownerDb')));
 expect(composition).toMatch(/await store\.assertRuntimeReady\(\);\s*await assertNativePrerequisitesReady\(ownerDb\);/);
 const {assertNativePrerequisitesReady}=await import('../../src/academy/nativePrerequisiteStore');
 const missing=(async()=>[{ready:false}]) as unknown as SQL;
 await expect(assertNativePrerequisitesReady(missing)).rejects.toThrow('prerequisite_schema_required');
});

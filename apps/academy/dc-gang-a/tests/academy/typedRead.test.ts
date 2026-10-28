import {describe,expect,test} from 'bun:test';
import {canonicalJson,digest,known as legacyKnown} from '../../src/learning/model';
import {validateNativeGap,toFunctionGap,createNativeTypedRead,functionSelectionDigest,fullFieldMask,linkTypes,linkVersions,namedLinksVersion,previousDay,projectLinkInterval,registryArtifactPath,typeFields,typeVersions,TypedReadRefusal,type QuerySpec,type SnapshotAdmissionGrant,type TypedCompleteFunctionRequest,type TypedFunctionRequest,type TypedReadErrorCode,type TypedReadRequest,type TypedTemporalSelection} from '../../src/academy/nativeTypedRead';
import {validateLearningAssignment,validateLearningAttempt} from '../../src/academy/learningWork';
import {educationTypes,type EducationType,type EvidenceRef,type Knowledge,type NativeObjectRef,type ObjectRef,type OwnerVersion,type ReadAdmission,type ReadFinalization,type ReadSnapshot,type TeacherBinding,type TemporalBinding} from '../../src/academy/contracts/prerequisiteRecords';
import type {TeacherPrerequisiteReadStore,TeacherPrerequisiteStore} from '../../src/academy/ports/teacherStore';
import type {CatalogNode} from '../../src/academy/domain';
import type {CurrentRecord} from '../../src/academy/contracts/storageRecords';
import type {TrustedTeacherContext} from '../../src/academy/contracts/teacherOperations';
import {fixedConsumerProfile,resolveActivityOccurrence,type ConsumerProfileId} from '../../src/academy/contracts/prerequisiteRecords';

test('C1 source gaps have an independent bound of100, closed source carriers and an exact five-field Function adapter',async()=>{
 const build=(count:number)=>{
  const f=fixture();mapFixtureViews(f.store,view=>({...view,current:async(owner,id)=>{
   const sample=(await view.current(owner,id))[0]!;
   return Array.from({length:count},(_,index)=>({...sample,entityId:'carrier-'+index,revisionId:'carrier-revision-'+index,payload:{kind:'teacher_lesson_carryover' as const,sourceStudent:{namespace:'academy_student',literalKey:'synthetic-student-a'},sourceCourse:null,sourceBook:null,sourceMinorUnit:null,activity:'daily_test' as const,status:'reminder' as const,originDate:null,targetDate:DATE,occurrence:{date:DATE,groupId:'1',courseKey:'2',recordKey:'3',membershipKey:'4'},text:'Invented reminder excluded from output',directiveRef:'invented directive',evidenceRefs:['invented evidence']}}));
  }}));return f;
 };
 const f=build(100),page=await f.service.typedRead(ctx,request({pageSize:1,selector:{kind:'EXACT_OBJECT',objectRef:studentRef},linkMask:[]}));
 expect(page.items).toHaveLength(1);expect(page.gaps).toHaveLength(100);expect(page.nextCursor).toBeNull();expect(page.enumeration).toBe('UNKNOWN');
 const gap=page.gaps[0]!,adapted=toFunctionGap(gap);expect(Object.keys(adapted).sort()).toEqual(['evidence','path','reason','requiredEvidence','subject']);expect(adapted.reason).toBe('UNVERIFIED');expect('sourceUnknown' in adapted).toBe(false);
 expect(()=>validateNativeGap(gap)).not.toThrow();
 const extra={...gap.sourceUnknown!,unexpected:true};expect(()=>validateNativeGap({...gap,sourceUnknown:extra})).toThrow();
 const tooLong={...gap.sourceUnknown!,source:{...gap.sourceUnknown!.source,entityId:'가'.repeat(67)}};expect(()=>validateNativeGap({...gap,sourceUnknown:tooLong})).toThrow();
 const wrongUnknown={...gap.sourceUnknown!,recordScope:{...gap.sourceUnknown!.recordScope,evidence:[]}};expect(()=>validateNativeGap({...gap,sourceUnknown:wrongUnknown})).toThrow();
 const over=build(101);await refusal(over.service.typedRead(ctx,request({pageSize:1,selector:{kind:'EXACT_OBJECT',objectRef:studentRef},linkMask:[]})),'CONTRACT_UNVERIFIABLE',409);
 expect(over.store.finalizations.at(-1)).toMatchObject({status:'REFUSED',snapshotDigest:null});expect(over.store.directFinalizeCalls).toBe(0);
});

test('C1 fixed preserved profiles actually project three current Sections versus one old MINOR and two source-correlated remainders',async()=>{
 for(const consumerProfile of ['CURRENT_1_1','OLD_SECTION_1_0'] as const){
  const profile=fixedConsumerProfile(consumerProfile),store=new FakePrerequisiteStore();
  mapFixtureViews(store,view=>({...view,current:async(owner,id)=>{
   const rows=await view.current(owner,id),progress=rows.find(row=>row.payload.kind==='daily_progress')!;
   if(progress.payload.kind!=='daily_progress')throw Error('progress fixture');const payload=progress.payload;
   return ['major','middle','minor'].map(level=>({...progress,entityId:'progress-'+level,revisionId:'rev-progress-'+level,payload:{...payload,contentScope:{...payload.contentScope,unitRef:objectRef('Unit',level),sectionRefs:knownK([objectRef('Section','sec-'+level)])}}}));
  },pinnedCatalog:async(owner,refs)=>{
   const nodes=await view.catalog(owner);return refs.map(ref=>{const node=nodes.find(node=>node.id===ref.nodeId);if(!node||ref.revisionId!=='rev-'+node.id)throw Error('pinned source revision');return {node,revisionId:ref.revisionId};});
  }}));
  const service=createNativeTypedRead(store.asStore(),OWNER,{consumerProfile,processEpoch:'c1-'+consumerProfile,registrySha256:profile.definition.registry.sha256,snapshotGrantSecret:'c1-real-existing-issuer-test-secret',now:()=>Date.parse(ASOF)});
  const temporal=testTemporal(),intent=testFunctionRequest(temporal);
  const acquired=await service.acquireSnapshot(ctx,{schema:'native-read-acquire.v2',consumerProfile,requestId:'c1-profile-acquire',scopeRef:nativeRef(),consistency:'SNAPSHOT',time:{mode:'CURRENT'},functionIntent:intent});
  let projected=0,remainder=0;
  for(const level of ['major','middle','minor']){
   const req=request({consumerProfile,temporalSelection:temporal,snapshot:acquired.snapshot,asOf:acquired.snapshot.asOf,snapshotAdmission:acquired.snapshotAdmission,selector:{kind:'EXACT_OBJECT',objectRef:objectRef('Section','sec-'+level)},fieldMask:fullFieldMask(['Section']),linkMask:['sectionInEdition','sectionInUnit']});
   const page=await service.typedRead(ctx,req),objects=page.items.filter(item=>item.kind==='OBJECT');
   if(consumerProfile==='CURRENT_1_1'||level==='minor'){
    expect(objects).toHaveLength(1);expect(page.items.filter(item=>item.kind==='LINK')).toHaveLength(2);projected++;
    const object=objects[0]!;if(object.kind!=='OBJECT')throw Error('Section');expect(object.record.contractVersion).toBe(profile.definition.registry.version);expect(object.record.typeVersion).toBe(profile.definition.carriage.Section);expect(object.record.unitRef).toEqual(objectRef('Unit',level));
   }else{
    expect(page.items).toEqual([]);expect(page.enumeration).toBe('UNKNOWN');expect(page.gaps).toHaveLength(1);expect(page.gaps[0]).toMatchObject({subject:objectRef('Section','sec-'+level),path:'Section.unitRef',reason:'UNVERIFIED',requiredEvidence:['EDITION_UNIT_SECTION_CHAIN']});remainder++;
   }
  }
  expect([projected,remainder]).toEqual(consumerProfile==='CURRENT_1_1'?[3,0]:[1,2]);
  const stale=request({consumerProfile,temporalSelection:temporal,snapshot:acquired.snapshot,asOf:acquired.snapshot.asOf,snapshotAdmission:acquired.snapshotAdmission,selector:{kind:'EXACT_OBJECT',objectRef:objectRef('Section','sec-major','wrong-actual-revision')},fieldMask:fullFieldMask(['Section']),linkMask:['sectionInEdition','sectionInUnit']});
  await refusal(service.typedRead(ctx,stale),'REVISION_STALE',409);
  await refusal(service.typedRead(ctx,{...stale,consumerProfile:consumerProfile==='CURRENT_1_1'?'OLD_SECTION_1_0':'CURRENT_1_1'}),'OBJECTSET_CURSOR_STALE',409);
 }
});

/* IG-3 Q/source evidence only: in-process fake prerequisite store.
 * No listen, DB, auth effect, file or network access. */
const OWNER='synthetic-owner',ACTOR='synthetic-actor',ASOF='2026-10-24T00:00:00.000Z',DATE='2026-10-24',SHA='a'.repeat(64);
export const ctx:TrustedTeacherContext={ownerId:OWNER,actorId:ACTOR,role:'teacher'};
export function nativeRef(key='synthetic-scope'):NativeObjectRef{return {tag:'object-record',basis:{namespace:'synthetic-native',scope:{ownerNamespace:OWNER,projectKey:'synthetic-project',scopeKey:'synthetic-scope'},contract:{state:'KNOWN',value:{namespace:'synthetic-native',contractId:'synthetic-contract',definitionVersion:'1.1.0',sha256:SHA}},recordRevision:{state:'KNOWN',value:{scheme:'OWNER_REVISION',value:'synthetic-scope-r1'}},source:{ownerNamespace:OWNER,publicLocator:'synthetic-interface',revision:{state:'KNOWN',value:{scheme:'OWNER_REVISION',value:'synthetic-interface-r1'}},evidenceRefs:[]}},objectTypeId:'Scope',objectTypeVersion:'1.0.0',objectKey:key};}
export const evidence=():EvidenceRef=>({sourceRef:nativeRef(),sourceRevision:'synthetic-evidence-r1',locator:'synthetic-scoped-evidence',observedAt:ASOF});
export const knownK=<T>(value:T):Knowledge<T>=>({state:'known',value,evidence:[evidence()]});
export const unknownK=<T>():Knowledge<T>=>({state:'unknown',reason:'UNVERIFIED',evidence:[],requiredEvidence:['SOURCE_FIELD']});
export function objectRef<T extends EducationType>(type:T,key:string,revision='rev-'+key):ObjectRef<T>{return {identity:{scopeRef:nativeRef(),namespace:'synthetic-native',objectType:type,nativeKey:key},revision};}
export function version<P extends import('../../src/academy/contracts/prerequisiteRecords').OwnerPayload>(entityKey:string,revisionId:string,payload:P):OwnerVersion<P>{return {ownerId:OWNER,namespace:'synthetic-native',scopeRef:nativeRef(),entityKey,sequence:1,revisionId,previousRevisionId:null,previousDigest:null,payload,contentDigest:digest(payload),integrityDigest:digest({entityKey,revisionId}),sourceObservedAt:ASOF,recordedAt:ASOF,actorId:ACTOR,idempotencyKey:'key-'+entityKey,commandDigest:digest({entityKey})} as OwnerVersion<P>;}
export const snapshot=(consistency:ReadSnapshot['consistency']='SNAPSHOT'):ReadSnapshot=>({registryVersion:'1.1.0',readRevision:'read-r1',asOf:ASOF,policyRevision:'policy-r1',consistency});
const teacherRef=objectRef('Teacher','teacher-a','rev-teacher'),classRef=objectRef('ClassGroup','class-a','rev-class'),lessonRef=objectRef('LessonSession','lesson-a','rev-lesson'),studentRef=objectRef('Student','student-a','rev-student');
const editionRef=objectRef('TextbookEdition','book','rev-book'),minorRef=objectRef('Unit','minor','rev-minor'),secMinorRef=objectRef('Section','sec-minor','rev-sec-minor');
const progressRef=objectRef('DailyProgress','progress-a','rev-progress'),homeworkRef=objectRef('HomeworkAssignment','homework-a','rev-homework'),attemptRef=objectRef('DailyTestAttempt','attempt-a','rev-attempt'),assessmentRef=objectRef('PreviousHomeworkAssessment','assessment-a','rev-assessment');
const recScope={studentRef,classGroupRef:classRef,businessDate:DATE,lessonRef};
const node=(id:string,kind:CatalogNode['kind'],parent:string|null):CatalogNode=>({id,kind,sourceKey:{namespace:'synthetic_catalog',literalKey:id},label:'Invented '+id,parent:parent?legacyKnown(parent,['synthetic-parent']):{state:'unknown',reason:'root'}} as CatalogNode);
export class FakePrerequisiteStore{
  binding:OwnerVersion<TeacherBinding>|null;
  projectionCalls=0;snapshotCalls=0;
  commitCalls=0;directFinalizeCalls=0;commitTerminal:'COMPLETED'|'UNKNOWN'='COMPLETED';
  occurrenceStatus=new Map<string,string>();
  admissions=new Map<string,ReadAdmission>();finalizations:ReadFinalization[]=[];
  temporals:OwnerVersion<TemporalBinding>[];
  constructor(){
    this.binding=version('teacher-a','rev-teacher',{kind:'teacher_binding',teacherKey:'teacher-a',ownerId:OWNER,actorId:ACTOR,teacherSourceKey:{namespace:'synthetic_teacher',literalKey:'synthetic-teacher'},displayName:knownK('Invented Teacher'),assignmentState:knownK('ACTIVE' as const),validFrom:'2026-01-01',validTo:null,state:'ACTIVE',synthetic:true});
    const binding=(kind:TemporalBinding['bindingKind'],from:ObjectRef,to:ObjectRef,validFrom:string,validTo:string|null,key:string)=>version(key,'rev-'+key,{kind:'temporal_binding' as const,bindingKey:key,ownerId:OWNER,bindingKind:kind,subjectRef:from,targetRef:to,validFrom,validTo,sourceLiteral:'synthetic-dated-decision',synthetic:true});
    this.temporals=[binding('CLASS_MEMBERSHIP',studentRef,classRef,'2026-10-01','2026-10-25','bind-membership'),binding('ENROLLMENT',studentRef,classRef,'2026-10-01','2026-10-25','bind-enrollment'),binding('TEACHING_ASSIGNMENT',classRef,teacherRef,'2026-01-01',null,'bind-teaching'),binding('LESSON_PARTICIPATION',lessonRef,studentRef,'2026-01-01',null,'bind-participation')];
  }
  private view():TeacherPrerequisiteReadStore{
    const self=this;
    const projected=<T>(value:T):T=>{self.projectionCalls++;return value;};
    return {
      teacherBindingByActor:async()=>self.binding,
      teachers:async()=>projected([self.binding!].filter(Boolean)),
      classGroups:async()=>projected([version('class-a','rev-class',{kind:'class_group',classKey:'class-a',ownerId:OWNER,displayName:knownK('Invented Class'),businessTimezone:knownK('Asia/Seoul'),classState:knownK('ACTIVE' as const),synthetic:true})]),
      lessons:async()=>projected([version('lesson-a','rev-lesson',{kind:'lesson_session',lessonKey:'lesson-a',ownerId:OWNER,classGroupRef:classRef,businessDate:DATE,occurrenceOrdinal:knownK(1),startsAt:knownK(ASOF),endsAt:knownK('2026-10-24T01:00:00.000Z'),teacherRefs:knownK([teacherRef]),participantRefs:knownK([studentRef]),lessonState:knownK('HELD' as const),synthetic:true})]),
      students:async()=>projected([{ownerId:OWNER,id:'student-a',displayName:'Invented Student',sourceKey:{namespace:'academy_student',literalKey:'synthetic-student-a'},proofRefs:[],registeredAt:ASOF}]),
      studentRevisionCurrent:async()=>version('student-a','rev-student',{kind:'student_record',displayName:knownK('Invented Student'),enrollmentState:knownK('ACTIVE' as const)}),
      catalog:async()=>projected([node('book','book_edition',null),node('major','major_unit','book'),node('middle','middle_unit','major'),node('minor','minor_unit','middle'),node('sec-major','learning_section','major'),node('sec-middle','learning_section','middle'),node('sec-minor','learning_section','minor')]),
      current:async()=>projected(currents()),
      temporalBindings:async()=>self.temporals,
      activityScopes:async()=>[],
      currentCatalogPins:async()=>projected([node('book','book_edition',null),node('major','major_unit','book'),node('middle','middle_unit','major'),node('minor','minor_unit','middle'),node('sec-major','learning_section','major'),node('sec-middle','learning_section','middle'),node('sec-minor','learning_section','minor')].map(n=>({node:n,revisionId:'rev-'+n.id,contentDigest:digest(n)}))),
      scoreEvidenceForAttempt:async()=>[],
      scoreEvidenceCurrent:async()=>null,
    } as unknown as TeacherPrerequisiteReadStore;
  }
  async readSnapshot<T>(read:(store:TeacherPrerequisiteReadStore)=>Promise<T>):Promise<T>{this.snapshotCalls++;return read(this.view());}
  async admitReadOccurrence(r:ReadAdmission){if(this.admissions.has(r.requestId))throw Error('read_occurrence_already_admitted');this.admissions.set(r.requestId,r);this.occurrenceStatus.set(r.requestId,'PENDING');return {request:r,status:'PENDING' as const,snapshotDigest:null,refusalCode:null,partialDataDiscarded:true as const};}
  async finalizeReadOccurrence(c:ReadFinalization){this.directFinalizeCalls++;this.finalizations.push(c);this.occurrenceStatus.set(c.request.requestId,c.status);return {request:c.request,status:c.status,snapshotDigest:c.snapshotDigest,refusalCode:c.refusalCode,partialDataDiscarded:true as const};}
  /** W1 owner-witness semantics: only this path may record COMPLETED. */
  async commitReadOutput<T>(r:ReadAdmission,prepare:(view:TeacherPrerequisiteReadStore)=>Promise<{kind:'OUTPUT_READY';value:T}|{kind:'OUTPUT_REFUSED';code:string}>){
    this.commitCalls++;
    if(this.occurrenceStatus.get(r.requestId)!=='PENDING')throw Error('read_already_terminal_or_unadmitted');
    const decision=await prepare(this.view());
    if(decision.kind==='OUTPUT_REFUSED'){this.finalizations.push({request:r,status:'REFUSED',snapshotDigest:null,refusalCode:decision.code});this.occurrenceStatus.set(r.requestId,'REFUSED');return {value:null,requestId:r.requestId,outputAdmissionId:r.requestId,terminalStatus:'REFUSED' as const,emissionDisposition:'NOT_ATTEMPTED' as const};}
    if(this.commitTerminal==='UNKNOWN'){this.occurrenceStatus.set(r.requestId,'UNKNOWN');return {value:null,requestId:r.requestId,outputAdmissionId:r.requestId,terminalStatus:'UNKNOWN' as const,emissionDisposition:'NOT_ATTEMPTED' as const};}
    this.finalizations.push({request:r,status:'COMPLETED',snapshotDigest:digest((decision.value as {snapshot:unknown}).snapshot ?? decision.value),refusalCode:null});this.occurrenceStatus.set(r.requestId,'COMPLETED');
    return {value:decision.value,requestId:r.requestId,outputAdmissionId:r.requestId,terminalStatus:'COMPLETED' as const,emissionDisposition:'NOT_ATTEMPTED' as const};
  }
  asStore():TeacherPrerequisiteStore{return this as unknown as TeacherPrerequisiteStore;}
}
function currents():CurrentRecord[]{
  const mk=(entityId:string,revisionId:string,payload:unknown)=>({ownerId:OWNER,studentId:'student-a',entityId,sequence:1,revisionId,previousRevisionId:null,previousDigest:null,payload,contentDigest:'x',integrityDigest:'x',sourceObservedAt:ASOF,recordedAt:ASOF,actorId:ACTOR,idempotencyKey:'cur-'+entityId,commandDigest:'x',lastVerifiedAt:ASOF}) as unknown as CurrentRecord;
  return [
    mk('progress-a','rev-progress',{kind:'daily_progress',sourceStudent:{namespace:'academy_student',literalKey:'synthetic-student-a'},recordScope:recScope,contentScope:{editionRef,unitRef:minorRef,sectionRefs:knownK([secMinorRef]),printedPages:unknownK(),problemLabels:knownK(['1'])},progressState:knownK('IN_PROGRESS'),note:knownK('Synthetic progress')}),
    mk('assessment-a','rev-assessment',{kind:'previous_homework_assessment',sourceStudent:{namespace:'academy_student',literalKey:'synthetic-student-a'},homeworkRef,assessmentScope:recScope,outcome:knownK('COMPLETE'),note:knownK('Synthetic review'),assessedBy:knownK(teacherRef),assessedAt:knownK(ASOF),evidenceRefs:[homeworkRef.revision]}),
    mk('draft-a','rev-draft',{kind:'daily_record_draft',sourceStudent:{namespace:'academy_student',literalKey:'synthetic-student-a'},recordScope:recScope,progressRefs:knownK([progressRef]),homeworkRefs:knownK([homeworkRef]),attemptRefs:knownK([attemptRef]),previousAssessmentRefs:knownK([assessmentRef]),progressText:knownK('Synthetic progress proposal'),homeworkText:knownK('Synthetic homework proposal'),noteText:knownK('Synthetic note'),responsibleTeacherRef:knownK(teacherRef),draftState:knownK('DRAFT'),sourceSnapshot:snapshot('FAIL_ON_CHANGE'),supersedesDraftRef:null}),
  ];
}
export const TEST_REGISTRY_SHA256='914c8d555a27e19e35f7048e125b7f0cfce1fc41a309a8e1d1f71bf7a5988c2a';
/* Pinned defining-object hashes: SHA256(canonicalJson(defining object)) from
 * education-registry.v4 (qualification /activeTypeBindingJoin). */
export const PINNED_TYPE_SHA256:Readonly<Record<string,string>>={
  Student:'a8e23ebf795bdd67bbfd4364824d788f1aceb9956412ed1d9b0c02f990b9014c',
  Teacher:'bea50c793375ff187d893625ac6e0c64df06257f22ffdfed4b68ab4683f6bd26',
  ClassGroup:'828a39b52819384f42d067784fa46326e788ec775fe843c388a35d4e2b453cd4',
  LessonSession:'28fa35fcea286bb0b6d83daaafb95700afdb732bd41b0bee1a4bc4ff27cfb701',
  TextbookEdition:'68d2623a7b24a67ee5af6d4e647af4d55e76608a22f76c7f789983c7b01f6b53',
  Unit:'0cae183c26ad18d150bf1c3255c29c1b50163f7b57e6ce12a28d1050a63deaec',
  Section:'ca8f467bc524ac8646a26ca1ebcf76db169f30ec580502d15d3ed493ee2efb41',
  DailyProgress:'cbfad303e28dcd0c849bf02d5acea85ca49da802da8b94c31014a600b0eefad2',
  HomeworkAssignment:'fbb701224468b298c8b9a86248687327ac8067d1ac76b7083008546a7d6c1b53',
  DailyTestAttempt:'3cb15a75a9f0e357a21402d630d2e4eb92f6262ba4aec5cc04623d837647c18f',
  PreviousHomeworkAssessment:'3b2132a006ab541240ef5b449e591cdd5d25f41cd28f1d2116ca1fb8e280b20f',
  DailyRecordDraft:'9272fae5fa8f797faa46d03e7ea33422ce124091e778fa7d045a843b3c392341',
};
export const PINNED_LINK_SHA256:Readonly<Record<string,string>>={
  studentMemberOfClass:'c5bed5e2b56d84fe19a492e09c74a0d6da1da15aa79eb61d0450512874143b26',
  classTaughtBy:'151d94e60e239ff3eb668734e579b6bf816b028cd900b9f8fb932fb48298333e',
  lessonOfClass:'6aa69dfa4cdcca72f2c7694130077355bfdb81ed153a6058d340d8171abc747b',
  lessonTaughtBy:'09ccfaa6fa8bad6d1c9aa22bf787a625bce70a01dcb1ea2dc4dc830c8763bba0',
  lessonHasStudent:'f6afc9719eb9b2057a4aead37e7905826c95663caa23a28c4629e1787f0bd6b6',
  unitInEdition:'94c97ab4c8c91631599b3573135e2f863672a33e49ef3efa8fbc0c61d1459a91',
  unitParent:'bcd6bd3c53bf5acdffe713f7ec05d1735b4c78aa5c288471072a69b640453e57',
  sectionInEdition:'3d6a62077b0b0457bc77bb325e538be4b8aff626a05208bdad7ee941e951278f',
  sectionInUnit:'fd91406f017e4ee63ad257f8dcde5894ebfa3e270de9418c1024687f080cb369',
  activityForStudent:'d494320a2d931ac6dbfb7edfc016d5cc902d42891f37d96c5c54bcd36cc548e6',
  activityInClass:'3c060a76960769269770edb3eb1e3a9aa2b73f340974cae924fd408f4d9da303',
  activityInLesson:'564a58278557ddf7eccfc253434ca0d917670a2075996baf32a85e0744e1fe96',
  activityUsesEdition:'15287bc04d152db4d338b6548fd39567e86facbc41e5ed5e818cc5cd7fdb87ec',
  activityUsesUnit:'c6a132a77f8e9b4f5b873ba3c96dad518ad02746d756e23c123de4f5aa0b39da',
  activityUsesSection:'bb565f4fd17471cb9cd0dfec0ad47fe9004650d8bde7743b0c9b13ec9cd3523e',
  assessmentOfHomework:'bde9e4aee377a100be26a96f6730e88f203a7d066f5631f4f78b0f45573413c5',
  assessmentByTeacher:'11c77c8f56d04a2f30f6920b1c4d7f8706d10b14d2292b404f998753067afe2d',
  attemptFollows:'0f69fa3cdad41e25e668adce47e3ba24d949f3ff1aa8a5e885f1ca7209c4b945',
  draftProgress:'dd8c8c7c5255e5a6b81ea7b222f265008420434f711514db991c1540b9edcc83',
  draftHomework:'475df4a5ff5018f8317ac235aeb7f604ded0ac7a1a64d35075d3a319d2293b9d',
  draftAttempts:'f8aa0cc58de450123cdce8ce2aeebb5873a0c0b01dd2b1d7b5d2c1dc9b256afd',
  draftPreviousAssessments:'6ba0db87c92db592d5391103219c76fb69e0c267caf09a2610fae11b45f7cf6f',
  draftResponsibleTeacher:'a66985757d573e879768540a247b8111e27edda7152638fa134e1a914152f2d1',
};
export function pinnedHashFor(symbol:string):string{
  const hash=PINNED_TYPE_SHA256[symbol]??(symbol.startsWith('NamedLinks/links/')?PINNED_LINK_SHA256[symbol.slice('NamedLinks/links/'.length)]:undefined);
  if(!hash)throw Error('unpinned test symbol '+symbol);
  return hash;
}
/* function-selection/v2 contract oracle (NG-FINAL-E5): independently build
 * the complete Function 2.0.0 request (intent fields + snapshot + asOf) and
 * digest it excluding only the Function requestId/cursor. Never call the
 * source functionSelectionDigest and never hash the outer native envelope. */
export function expectedSelectionDigest(value:TypedReadRequest):string{
  const fr=JSON.parse(canonicalJson(value.functionRequest)) as Record<string,unknown>;
  delete fr.requestId;delete fr.cursor;
  return digest({domain:'function-selection/v2',...fr});
}
const explicitDigestTemporals=new WeakSet<object>();
export function sealRequest<T extends TypedReadRequest>(value:T):T{
  if(explicitDigestTemporals.has(value.temporalSelection))return value;
  const sealed=expectedSelectionDigest(value);
  value.temporalSelection.functionRequestDigest=sealed;
  if(value.selector.kind==='REGISTERED_QUERY'&&value.selector.query.temporalSelection)value.selector.query.temporalSelection.functionRequestDigest=sealed;
  return value;
}
const draftRef=objectRef('DailyRecordDraft','draft-a','rev-draft');
export function testTemporal(over:Partial<TypedTemporalSelection>={}):TypedTemporalSelection{
  const built={schema:'education-selection.v2',functionName:'GetStudentDailyContext',functionVersion:'2.0.0',functionRequestDigest:'e'.repeat(64),businessDate:DATE,classGroupRef:classRef,studentRef:studentRef,occurrence:{mode:'EXACT',lessonRef},draftRef:null,...over} as TypedTemporalSelection;
  if(Object.hasOwn(over,'functionRequestDigest'))explicitDigestTemporals.add(built);
  return built;
}
export function testQuery(baseType:EducationType,opts:{snapshot?:ReadSnapshot;pageSize?:number;cursor?:string|null;temporal?:TypedTemporalSelection;filter?:QuerySpec['filter'];traverse?:QuerySpec['traverse'];orderBy?:QuerySpec['orderBy']}={}):QuerySpec{
  const snap=opts.snapshot??snapshot(),temporal=opts.temporal??testTemporal();
  return {schema:'query-spec.v2',scope:nativeRef(),registrySha256:TEST_REGISTRY_SHA256,baseType:{artifactPath:registryArtifactPath,symbol:baseType,version:typeVersions[baseType],definitionSha256:pinnedHashFor(baseType)},filter:opts.filter??null,traverse:opts.traverse??null,fieldMask:[...typeFields[baseType]],orderBy:opts.orderBy??[],consistency:snap.consistency,page:{size:opts.pageSize??100,cursor:opts.cursor??null},temporalSelection:temporal};
}
export const testGrant=(over:Partial<SnapshotAdmissionGrant>={}):SnapshotAdmissionGrant=>({grantId:'fictional-grant',proof:'fictional-proof',expiresAt:'2026-10-31T00:00:00.000Z',...over});
export const fictionalGrantVerifier=(grant:SnapshotAdmissionGrant):boolean=>grant.grantId==='fictional-grant'&&grant.proof==='fictional-proof';
export function testFunctionRequest(temporal:TypedTemporalSelection,pageSize=100,expectedRevisions:unknown[]=[]):TypedFunctionRequest{
  const common={contractVersion:'2.0.0' as const,functionVersion:'2.0.0' as const,scopeRef:nativeRef(),classGroupRef:temporal.classGroupRef,businessDate:temporal.businessDate,expectedRevisions:expectedRevisions as TypedFunctionRequest['expectedRevisions']};
  if(temporal.functionName==='ListClassDailyStatus')return {...common,functionName:'ListClassDailyStatus',selector:'CLASS_OCCURRENCE_STATUS_V1',pageSize,occurrence:temporal.occurrence} as TypedFunctionRequest;
  if(temporal.functionName==='CheckDailyRecordCompleteness')return {...common,functionName:'CheckDailyRecordCompleteness',selector:'DRAFT_COMPLETENESS_V1',studentRef:temporal.studentRef!,occurrence:temporal.occurrence,draftRef:temporal.draftRef!,profile:'DAILY_RECORD_OCCURRENCE_V1'} as TypedFunctionRequest;
  return {...common,functionName:'GetStudentDailyContext',selector:'STUDENT_OCCURRENCE_CONTEXT_V1',pageSize,studentRef:temporal.studentRef!,occurrence:temporal.occurrence} as TypedFunctionRequest;
}
export function registeredRequest(baseType:EducationType,over:Partial<TypedReadRequest>={}):TypedReadRequest{
  const snap=over.snapshot??snapshot(),temporal=over.temporalSelection??testTemporal(),pageSize=over.pageSize??100,cursor=over.cursor??null;
  return request({...over,snapshot:snap,temporalSelection:temporal,pageSize,cursor,selector:{kind:'REGISTERED_QUERY',query:testQuery(baseType,{snapshot:snap,temporal,pageSize,cursor})}});
}
let seq=0;
export function request(over:Partial<TypedReadRequest>={}):TypedReadRequest{
  const snap=over.snapshot??snapshot(),temporal=over.temporalSelection??testTemporal(),pageSize=over.pageSize??100,cursor=over.cursor===undefined?null:over.cursor;
  const selector=over.selector??{kind:'REGISTERED_QUERY' as const,query:testQuery('Student',{snapshot:snap,temporal,pageSize,cursor})};
  const intent=testFunctionRequest(temporal,pageSize,over.expectedRevisions??[]);
  const complete:TypedCompleteFunctionRequest={...intent,requestId:'function-'+(seq+1),snapshot:snap,asOf:over.asOf??ASOF,...(intent.functionName==='CheckDailyRecordCompleteness'?{}:{cursor})};
  const built={contractVersion:'3.0.0',consumerProfile:'CURRENT_1_1',requestId:'req-'+(++seq),scopeRef:nativeRef(),...over,selector,snapshot:snap,functionRequest:over.functionRequest??complete,snapshotAdmission:over.snapshotAdmission??testGrant(),asOf:over.asOf??ASOF,expectedRevisions:over.expectedRevisions??[],fieldMask:over.fieldMask??fullFieldMask([...educationTypes]),linkMask:over.linkMask??[...linkTypes],pageSize,cursor,temporalSelection:temporal} as TypedReadRequest;
  return sealRequest(built);
}
export function fixture(){const store=new FakePrerequisiteStore();return {store,service:createNativeTypedRead(store.asStore(),OWNER,{processEpoch:'epoch-1',registrySha256:TEST_REGISTRY_SHA256,snapshotGrantVerifier:fictionalGrantVerifier})};}
/** Apply the same fictional read model in preparation and the output gate. */
export function mapFixtureViews(store:FakePrerequisiteStore,transform:(view:TeacherPrerequisiteReadStore)=>TeacherPrerequisiteReadStore):void{
  const read=store.readSnapshot.bind(store),commit=store.commitReadOutput.bind(store);
  store.readSnapshot=async callback=>read(view=>callback(transform(view)));
  store.commitReadOutput=async(admission,prepare)=>commit(admission,view=>prepare(transform(view)));
}
export function withOutputLabel(store:FakePrerequisiteStore,state:{text:string}):void{
  mapFixtureViews(store,view=>({...view,studentRevisionCurrent:async(owner,id)=>{
    const row=await view.studentRevisionCurrent(owner,id);
    return row?{...row,payload:{...row.payload,displayName:knownK(state.text)}}:null;
  }}));
}
/** Keep functionRequest joins coherent when a test replaces temporalSelection. */
export function withTemporal(base:TypedReadRequest,temporal:TypedTemporalSelection):TypedReadRequest{
  const intent=testFunctionRequest(temporal,base.pageSize,base.expectedRevisions);
  return sealRequest({...base,temporalSelection:temporal,functionRequest:{...intent,requestId:base.functionRequest.requestId,snapshot:base.snapshot,asOf:base.asOf,...(intent.functionName==='CheckDailyRecordCompleteness'?{}:{cursor:base.cursor})}});
}
export function withLegacyWork(store:FakePrerequisiteStore){
  const sk=(namespace:string,literalKey:string)=>({namespace,literalKey});
  const assignment:any={kind:'learning_work_assignment',sourceStudent:sk('academy_student','synthetic-student-a'),sourceCourse:sk('academy_course','fictional-course'),sourceBook:sk('academy_book','fictional-book'),assignmentKey:sk('teacher_assignment','fictional-homework'),sourceUserCourse:sk('academy_user_course','fictional-registration'),registrationRevisionId:'fictional-registration-r1',activity:'daily_test',origin:'teacher_report',effectiveDate:'2026-10-24',dueDate:legacyKnown('2026-10-25',['fictional-evidence']),status:'assigned',catalogRefs:[{nodeId:'sec-minor',revisionId:'rev-sec-minor'}],sectionNodeIds:['sec-minor'],items:[{assignedItemId:'fictional-item',itemKey:sk('teacher_item','fictional-item'),contentNodeId:'sec-minor',sectionNodeId:'sec-minor',labelLiteral:'1'}],paper:{state:'unknown',reason:'unverified'},evidenceRefs:['fictional-evidence']};
  const attempt:any={kind:'learning_work_attempt',sourceStudent:assignment.sourceStudent,attemptKey:sk('teacher_attempt','fictional-attempt'),assignmentRevisionId:'rev-homework',paperIssuanceKey:null,previousAttemptRevisionId:null,occurredAt:legacyKnown('2026-10-24T00:00:00.000Z',['fictional-evidence']),state:'not_started',itemResults:[],evidenceRefs:['fictional-evidence']};
  validateLearningAssignment(assignment);validateLearningAttempt(attempt);
  const wrapView=(view:any)=>({...view,current:async(...args:any[])=>{const rows=await view.current(...args);const base=rows[0];return [...rows,{...base,entityId:'homework-a',revisionId:'rev-homework',payload:assignment},{...base,entityId:'attempt-a',revisionId:'rev-attempt',payload:attempt}];}});
  const original=store.readSnapshot.bind(store);
  store.readSnapshot=(async(read:any)=>original(async(view:any)=>read(wrapView(view)))) as typeof store.readSnapshot;
  const originalCommit=store.commitReadOutput.bind(store);
  store.commitReadOutput=(async(r:any,prepare:any)=>originalCommit(r,async(view:any)=>prepare(wrapView(view)))) as typeof store.commitReadOutput;
}
async function refusal(promise:Promise<unknown>,code:TypedReadErrorCode,status:number){
  try{await promise;}catch(error){expect(error).toBeInstanceOf(TypedReadRefusal);expect((error as TypedReadRefusal).code).toBe(code);expect((error as TypedReadRefusal).httpStatus).toBe(status);return;}
  throw Error('expected refusal '+code);
}

test('registry closes over exactly 12 types and 23 links with Section at 1.1.0',()=>{
  expect([...educationTypes]).toHaveLength(12);
  expect([...linkTypes]).toHaveLength(23);
  expect(linkVersions.sectionInUnit).toBe('1.1.0');
  expect(Object.values(linkVersions).filter(v=>v==='1.1.0')).toHaveLength(1);
});

test('registered Student plan projects only its base plus verified dated membership; catalog stays remainder without invented revisions',async()=>{
  const {service}=fixture(),res=await service.typedRead(ctx,request());
  expect(res.kind).toBe('OK');expect(res.contractVersion).toBe('3.0.0');expect(res.snapshot.readRevision).toBe('read-r1');
  expect(res.nextCursor).toBeNull();
  const records=res.items.flatMap(i=>i.kind==='OBJECT'?[i.record]:[]);
  const links=res.items.flatMap(i=>i.kind==='LINK'?[i.link]:[]);
  expect(records.map(r=>r.identity.objectType)).toEqual(['Student']);
  expect(records[0]?.displayName).toEqual(knownK('Invented Student'));
  expect(links.map(l=>l.linkType)).toEqual(['studentMemberOfClass']);
  expect(links[0]?.linkVersion).toBe(linkVersions.studentMemberOfClass);
  // No fabricated catalog revision anywhere in the wire reply.
  expect(JSON.stringify(res)).not.toContain('catalog-unverified');
  expect(records.some(r=>['TextbookEdition','Unit','Section'].includes(r.identity.objectType))).toBe(false);
  expect(res.gaps.filter(g=>g.path==='TextbookEdition.record')).toHaveLength(1);
  expect(res.gaps.filter(g=>g.path==='Unit.record')).toHaveLength(3);
  expect(res.gaps.filter(g=>g.path==='Section.record')).toHaveLength(1);
  expect(res.gaps.some(g=>g.path==='links.activityUsesEdition')).toBe(true);
  expect(res.enumeration).toBe('UNKNOWN');
  for(const record of records){expect(record.contractVersion).toBe('1.1.0');expect(record.snapshot).toEqual(res.snapshot);expect(record.provenance.length).toBeGreaterThan(0);}
});

test('observed legacy homework and attempt rows stay UNVERIFIED for registered and exact selectors (IG3-REV-01)',async()=>{
  const {store,service}=fixture();withLegacyWork(store);
  const registered=await service.typedRead(ctx,request());
  expect(registered.items.some(i=>i.kind==='OBJECT'&&['HomeworkAssignment','DailyTestAttempt'].includes(i.record.identity.objectType))).toBe(false);
  expect(registered.gaps.some(g=>g.path==='HomeworkAssignment.record'&&g.reason==='UNVERIFIED')).toBe(true);
  expect(registered.gaps.some(g=>g.path==='DailyTestAttempt.record'&&g.reason==='UNVERIFIED')).toBe(true);
  expect(registered.gaps.some(g=>g.path==='DailyTestAttempt.links.attemptFollows')).toBe(true);
  expect(registered.items.some(i=>i.kind==='LINK'&&i.link.linkType==='attemptFollows')).toBe(false);
  const homework=await service.typedRead(ctx,request({selector:{kind:'EXACT_OBJECT',objectRef:homeworkRef},fieldMask:fullFieldMask(['HomeworkAssignment'])}));
  expect(homework.items).toEqual([]);expect(homework.enumeration).toBe('UNKNOWN');
  expect(homework.gaps.some(g=>g.path==='HomeworkAssignment.record')).toBe(true);
  const attempt=await service.typedRead(ctx,request({selector:{kind:'EXACT_OBJECT',objectRef:attemptRef},fieldMask:fullFieldMask(['DailyTestAttempt'])}));
  expect(attempt.items).toEqual([]);
  expect(attempt.gaps.some(g=>g.path==='DailyTestAttempt.record')).toBe(true);
  expect(attempt.gaps.some(g=>g.path==='DailyTestAttempt.links.attemptFollows')).toBe(true);
});

test('catalog exact objects are withheld as remainder at every parent level, never flattened or invented (IG3-REV-02)',async()=>{
  const {service}=fixture();
  for(const [type,key] of [['Section','sec-minor'],['Unit','minor'],['TextbookEdition','book']] as const){
    const res=await service.typedRead(ctx,request({selector:{kind:'EXACT_OBJECT',objectRef:objectRef(type,key,'rev-'+key)},fieldMask:fullFieldMask([type])}));
    expect(res.items).toEqual([]);expect(res.enumeration).toBe('UNKNOWN');
    expect(res.gaps.some(g=>g.path===type+'.record'&&g.reason==='UNVERIFIED')).toBe(true);
    expect(JSON.stringify(res)).not.toContain('catalog-unverified');
  }
  for(const key of ['sec-major','sec-middle'])await refusal(service.typedRead(ctx,request({selector:{kind:'EXACT_OBJECT',objectRef:objectRef('Section',key,'rev-'+key)},fieldMask:fullFieldMask(['Section'])})),'NOT_FOUND',404);
});

test('registered ClassGroup and Draft completeness plans emit only full-identity verified links',async()=>{
  const {service}=fixture();
  const listTemporal=testTemporal({functionName:'ListClassDailyStatus',studentRef:null,occurrence:{mode:'ENUMERATE_SEPARATELY'}});
  const classes=await service.typedRead(ctx,registeredRequest('ClassGroup',{temporalSelection:listTemporal}));
  expect(classes.items.flatMap(i=>i.kind==='OBJECT'?[i.record.identity.objectType]:[])).toEqual(['ClassGroup']);
  expect(classes.items.flatMap(i=>i.kind==='LINK'?[i.link.linkType]:[])).toEqual(['classTaughtBy']);
  const checkTemporal=testTemporal({functionName:'CheckDailyRecordCompleteness',draftRef});
  const drafts=await service.typedRead(ctx,registeredRequest('DailyRecordDraft',{temporalSelection:checkTemporal}));
  const draftLinks=drafts.items.flatMap(i=>i.kind==='LINK'?[i.link.linkType]:[]).sort();
  expect(draftLinks).toEqual((['activityForStudent','activityInClass','activityInLesson','draftPreviousAssessments','draftProgress','draftResponsibleTeacher'] as typeof draftLinks).sort());
  expect(drafts.gaps.some(g=>g.path==='links.draftHomework')).toBe(true);
  expect(drafts.gaps.some(g=>g.path==='links.draftAttempts')).toBe(true);
  expect(drafts.gaps.some(g=>g.path==='links.assessmentOfHomework')).toBe(true);
});

test('pinned wire: old baseType dialect and unsupported plans fail explicitly (IG3-REV-08)',async()=>{
  const {service}=fixture();
  await refusal(service.typedRead(ctx,{...request(),selector:{kind:'REGISTERED_QUERY',query:{baseType:'ALL'}} as never} as TypedReadRequest),'INVALID_REQUEST',400);
  await refusal(service.typedRead(ctx,registeredRequest('Teacher',{temporalSelection:testTemporal({functionName:'ListClassDailyStatus',studentRef:null,occurrence:{mode:'ENUMERATE_SEPARATELY'}})})),'CONTRACT_UNVERIFIABLE',409);
  const filtered=registeredRequest('Student');filtered.selector= {kind:'REGISTERED_QUERY',query:testQuery('Student',{filter:{op:'eq',property:'displayName',value:'x'}})};
  // Outer/inner temporal join must stay identical after replacing selector.
  (filtered.selector as {query:QuerySpec}).query.temporalSelection=filtered.temporalSelection;
  sealRequest(filtered);
  await refusal(service.typedRead(ctx,filtered),'CONTRACT_UNVERIFIABLE',409);
  const mismatched=registeredRequest('Student');(mismatched.selector as {query:QuerySpec}).query.page={size:99,cursor:null};
  await refusal(service.typedRead(ctx,mismatched),'INVALID_REQUEST',400);
});

test('full four-field identity: foreign exact and expected refs are denied, not aliased (IG3-REV-05)',async()=>{
  const {service}=fixture();
  const target=objectRef('Teacher','teacher-a','rev-teacher');target.identity.namespace='fictional-foreign-namespace';
  await refusal(service.typedRead(ctx,request({selector:{kind:'EXACT_OBJECT',objectRef:target},fieldMask:fullFieldMask(['Teacher']),linkMask:[]})),'PERMISSION_DENIED',403);
  const foreignExpected=objectRef('Teacher','teacher-a','rev-teacher');foreignExpected.identity.scopeRef=nativeRef('other-scope');foreignExpected.identity.scopeRef.basis.scope.scopeKey='other-scope';
  // Same owner but a different scopeRef is a different EducationIdentity.
  await refusal(service.typedRead(ctx,request({snapshot:snapshot('FAIL_ON_CHANGE'),expectedRevisions:[foreignExpected]})),'PERMISSION_DENIED',403);
});

describe('temporal projection (REQ-06)',()=>{
  test('previousDay is pure Gregorian arithmetic',()=>{
    expect(previousDay('2026-10-24')).toBe('2026-10-23');expect(previousDay('2026-03-01')).toBe('2026-02-28');
    expect(previousDay('2024-03-01')).toBe('2024-02-29');expect(previousDay('2026-01-01')).toBe('2025-12-31');
    expect(previousDay('2000-03-01')).toBe('2000-02-29');expect(previousDay('1900-03-01')).toBe('1900-02-28');
  });
  test('finite half-open interval projects to inclusive previousDay; closed-before-date bindings are excluded',async()=>{
    const {service}=fixture();
    const inside=await service.typedRead(ctx,request());
    const membership=inside.items.flatMap(i=>i.kind==='LINK'&&i.link.linkType==='studentMemberOfClass'?[i.link]:[]);
    expect(membership).toHaveLength(1);expect(membership[0]!.validFrom).toBe('2026-10-01');
    expect(membership[0]!.validThrough).toEqual({state:'known',value:'2026-10-24',evidence:expect.any(Array)});
    const closed=fixture();
    closed.store.temporals=[...closed.store.temporals.filter(v=>v.payload.bindingKind==='TEACHING_ASSIGNMENT'),version('bind-closed','rev-bind-closed',{kind:'temporal_binding',bindingKey:'bind-closed',ownerId:OWNER,bindingKind:'CLASS_MEMBERSHIP',subjectRef:studentRef,targetRef:classRef,validFrom:'2026-10-01',validTo:'2026-10-24',sourceLiteral:'synthetic-closed',synthetic:true})];
    const out=await closed.service.typedRead(ctx,request());
    expect(out.items.some(i=>i.kind==='LINK'&&i.link.linkType==='studentMemberOfClass')).toBe(false);
  });
  test('open interval projects NOT_APPLICABLE only with evidence; unverified without it',async()=>{
    expect(projectLinkInterval('2026-01-01',null,[evidence()]).validThrough).toMatchObject({state:'unknown',reason:'NOT_APPLICABLE'});
    expect(projectLinkInterval('2026-01-01',null,[]).validThrough).toMatchObject({state:'unknown',reason:'UNVERIFIED'});
    const {service}=fixture();
    const listTemporal=testTemporal({functionName:'ListClassDailyStatus',studentRef:null,occurrence:{mode:'ENUMERATE_SEPARATELY'}});
    const res=await service.typedRead(ctx,registeredRequest('ClassGroup',{temporalSelection:listTemporal}));
    const taught=res.items.flatMap(i=>i.kind==='LINK'&&i.link.linkType==='classTaughtBy'?[i.link]:[]);
    expect(taught).toHaveLength(1);expect(taught[0]!.validThrough).toMatchObject({state:'unknown',reason:'NOT_APPLICABLE'});
  });
  test('empty or reversed intervals refuse as CONTRACT_UNVERIFIABLE (409), never fabricated',async()=>{
    expect(()=>projectLinkInterval('2026-10-10','2026-10-10',[evidence()])).toThrow();
    for(const [from,to] of [['2026-10-10','2026-10-10'],['2026-10-10','2026-10-09']] as const){
      const {store,service}=fixture();
      store.temporals=[...store.temporals.filter(v=>v.payload.bindingKind==='TEACHING_ASSIGNMENT'),version('bind-bad','rev-bind-bad',{kind:'temporal_binding',bindingKey:'bind-bad',ownerId:OWNER,bindingKind:'CLASS_MEMBERSHIP',subjectRef:studentRef,targetRef:classRef,validFrom:from,validTo:to,sourceLiteral:'synthetic-invalid',synthetic:true})];
      await refusal(service.typedRead(ctx,request()),'CONTRACT_UNVERIFIABLE',409);
    }
  });
});

describe('revision fences in every consistency mode (adopted 2.1.0)',()=>{
  test('matching expected revisions pass; stale expected revision refuses 409',async()=>{
    const {service}=fixture();
    const ok=await service.typedRead(ctx,request({snapshot:snapshot('FAIL_ON_CHANGE'),expectedRevisions:[objectRef('Teacher','teacher-a','rev-teacher')]}));
    expect(ok.kind).toBe('OK');
    await refusal(service.typedRead(ctx,request({snapshot:snapshot('FAIL_ON_CHANGE'),expectedRevisions:[objectRef('Teacher','teacher-a','rev-stale')]})),'REVISION_STALE',409);
  });
  test('stale expected and exact revisions refuse under SNAPSHOT too; unknown object is 404',async()=>{
    const {service}=fixture();
    await refusal(service.typedRead(ctx,request({snapshot:snapshot('SNAPSHOT'),expectedRevisions:[objectRef('Teacher','teacher-a','rev-stale')]})),'REVISION_STALE',409);
    const stale=objectRef('Teacher','teacher-a','rev-old');
    await refusal(service.typedRead(ctx,request({selector:{kind:'EXACT_OBJECT',objectRef:stale},snapshot:snapshot('FAIL_ON_CHANGE'),fieldMask:fullFieldMask(['Teacher']),linkMask:[]})),'REVISION_STALE',409);
    await refusal(service.typedRead(ctx,request({selector:{kind:'EXACT_OBJECT',objectRef:stale},fieldMask:fullFieldMask(['Teacher']),linkMask:[]})),'REVISION_STALE',409);
    await refusal(service.typedRead(ctx,request({selector:{kind:'EXACT_OBJECT',objectRef:objectRef('Student','ghost','rev-ghost')},fieldMask:fullFieldMask(['Student']),linkMask:[]})),'NOT_FOUND',404);
  });
});

describe('adopted native-read 2.1.0 envelope (C2/C3)',()=>{
  test('historical 2.0.0 wire and descriptorOnly bootstrap fail closed',async()=>{
    const {service}=fixture();
    await refusal(service.typedRead(ctx,{...request(),contractVersion:'2.0.0'} as unknown as TypedReadRequest),'CONTRACT_UNVERIFIABLE',409);
    await refusal(service.typedRead(ctx,{...request(),descriptorOnly:true} as unknown as TypedReadRequest),'INVALID_REQUEST',400);
  });
  test('snapshot grant requires an owner verifier; bad or expired grants refuse stale',async()=>{
    const {store}=fixture();
    const unverified=createNativeTypedRead(store.asStore(),OWNER,{processEpoch:'epoch-1',registrySha256:TEST_REGISTRY_SHA256});
    await refusal(unverified.typedRead(ctx,request()),'CONTRACT_UNVERIFIABLE',409);
    const {service}=fixture();
    await refusal(service.typedRead(ctx,request({snapshotAdmission:testGrant({proof:'fictional-forged'})})),'OBJECTSET_CURSOR_STALE',409);
    await refusal(service.typedRead(ctx,request({snapshotAdmission:testGrant({expiresAt:'2020-01-01T00:00:00.000Z'})})),'OBJECTSET_CURSOR_STALE',409);
    expect(store.projectionCalls).toBe(0);
  });
  test('functionRequest joins to temporalSelection, scope and paging are enforced',async()=>{
    const {service}=fixture();
    const wrongDate=request();(wrongDate.functionRequest as {businessDate:string}).businessDate='2026-10-25';
    await refusal(service.typedRead(ctx,wrongDate),'INVALID_REQUEST',400);
    const wrongSelector=request();(wrongSelector.functionRequest as {selector:string}).selector='UNREGISTERED_PLAN';
    await refusal(service.typedRead(ctx,wrongSelector),'INVALID_REQUEST',400);
    const extra=request();(extra.functionRequest as unknown as Record<string,unknown>).teacherId='fictional-claim';
    await refusal(service.typedRead(ctx,extra),'INVALID_REQUEST',400);
  });
  test('link TypeBinding uses NamedLinks container 1.1.0; per-row versions stay projected',async()=>{
    expect(namedLinksVersion).toBe('1.1.0');
    const {service}=fixture();
    const mk=(version:string)=>{
      const base=request(),query=testQuery('Student');
      query.traverse={link:{type:{artifactPath:registryArtifactPath,symbol:'NamedLinks/links/studentMemberOfClass',version,definitionSha256:pinnedHashFor('NamedLinks/links/studentMemberOfClass')},direction:'out'},targetType:{artifactPath:registryArtifactPath,symbol:'Student',version:typeVersions.Student,definitionSha256:pinnedHashFor('Student')},targetFilter:null};
      query.temporalSelection=base.temporalSelection;query.page={size:base.pageSize,cursor:null};
      return sealRequest({...base,selector:{kind:'REGISTERED_QUERY' as const,query}});
    };
    await refusal(service.typedRead(ctx,mk('1.0.0')),'INVALID_REQUEST',400);
    // Grammar admitted at 1.1.0; traversal plans remain unsupported downstream.
    await refusal(service.typedRead(ctx,mk('1.1.0')),'CONTRACT_UNVERIFIABLE',409);
  });
});

describe('authorization refuses before projection',()=>{
  const cases:[string,(f:ReturnType<typeof fixture>)=>void][]=[
    ['missing binding',f=>{f.store.binding=null;}],
    ['inactive assignment',f=>{f.store.binding=version('teacher-a','rev-teacher',{...f.store.binding!.payload,assignmentState:knownK('INACTIVE' as const)});}],
    ['retired binding',f=>{f.store.binding=version('teacher-a','rev-teacher',{...f.store.binding!.payload,state:'RETIRED' as const});}],
    ['expired validity (businessDate at validTo)',f=>{f.store.binding=version('teacher-a','rev-teacher',{...f.store.binding!.payload,validTo:DATE});}],
    ['not-yet-valid binding',f=>{f.store.binding=version('teacher-a','rev-teacher',{...f.store.binding!.payload,validFrom:'2026-10-25'});}],
  ];
  for(const [name,mutate] of cases)test(name+' -> 403 with zero projection calls',async()=>{
    const f=fixture();mutate(f);
    await refusal(f.service.typedRead(ctx,request()),'PERMISSION_DENIED',403);
    expect(f.store.projectionCalls).toBe(0);
  });
  test('wrong-owner context and wrong-owner scope refuse before any snapshot',async()=>{
    const f=fixture();
    await refusal(f.service.typedRead({...ctx,ownerId:'synthetic-other-owner'},request()),'PERMISSION_DENIED',403);
    expect(f.store.snapshotCalls).toBe(0);
    const badScope=nativeRef();badScope.basis.scope.ownerNamespace='synthetic-other-owner';
    await refusal(f.service.typedRead(ctx,request({scopeRef:badScope})),'PERMISSION_DENIED',403);
    expect(f.store.snapshotCalls).toBe(0);expect(f.store.projectionCalls).toBe(0);
  });
  test('principal/teacher claims in the closed request are refused, not honored',async()=>{
    const {service}=fixture();
    await refusal(service.typedRead(ctx,{...request(),teacherId:'synthetic-attacker'} as TypedReadRequest),'INVALID_REQUEST',400);
    await refusal(service.typedRead(ctx,request({linkMask:['attemptFollows','bogusLink' as never]})),'INVALID_REQUEST',400);
  });
});

describe('NG-A deterministic bindings (W3-E4/E5)',()=>{
  test('pinned TypeBinding hash succeeds; two wrong hashes refuse CONTRACT_UNVERIFIABLE before admission (W3-E4)',async()=>{
    const ok=await fixture().service.typedRead(ctx,request());
    expect(ok.kind).toBe('OK');
    for(const bad of ['d'.repeat(64),'f'.repeat(64)]){
      const {store,service}=fixture();const req=request();
      if(req.selector.kind!=='REGISTERED_QUERY')throw Error('fixture');
      req.selector.query.baseType.definitionSha256=bad;
      await refusal(service.typedRead(ctx,req),'CONTRACT_UNVERIFIABLE',409);
      expect(store.admissions.size).toBe(0);expect(store.commitCalls).toBe(0);
    }
    const {store,service}=fixture();const linked=request();const query=testQuery('Student');
    query.traverse={link:{type:{artifactPath:registryArtifactPath,symbol:'NamedLinks/links/studentMemberOfClass',version:'1.1.0',definitionSha256:'f'.repeat(64)},direction:'out'},targetType:{artifactPath:registryArtifactPath,symbol:'Student',version:typeVersions.Student,definitionSha256:pinnedHashFor('Student')},targetFilter:null};
    query.temporalSelection=linked.temporalSelection;query.page={size:linked.pageSize,cursor:null};
    await refusal(service.typedRead(ctx,sealRequest({...linked,selector:{kind:'REGISTERED_QUERY',query}})),'CONTRACT_UNVERIFIABLE',409);
    expect(store.admissions.size).toBe(0);
  });
  test('matching caller copies of a wrong function digest still refuse OBJECTSET_CURSOR_STALE (W3-E5)',async()=>{
    for(const bad of ['e'.repeat(64),'f'.repeat(64)]){
      const {store,service}=fixture();const req=request();
      req.temporalSelection.functionRequestDigest=bad;
      if(req.selector.kind==='REGISTERED_QUERY'&&req.selector.query.temporalSelection)req.selector.query.temporalSelection.functionRequestDigest=bad;
      await refusal(service.typedRead(ctx,req),'OBJECTSET_CURSOR_STALE',409);
      expect(store.admissions.size).toBe(0);expect(store.commitCalls).toBe(0);
    }
    const sealed=request();
    expect(sealed.temporalSelection.functionRequestDigest).toBe(expectedSelectionDigest(sealed));
    const ok=await fixture().service.typedRead(ctx,sealed);
    expect(ok.kind).toBe('OK');
  });
});

describe('NG-FINAL-E5 complete Function wire and digest basis',()=>{
  test('OR1-01 acquisition intents and incomplete data requests refuse before admission for each Function',async()=>{
    for(const temporal of [testTemporal(),testTemporal({functionName:'ListClassDailyStatus',studentRef:null}),testTemporal({functionName:'CheckDailyRecordCompleteness',draftRef})]){
      const {store,service}=fixture();
      const req=request({temporalSelection:temporal});
      const intentWire=JSON.parse(canonicalJson(req));
      intentWire.functionRequest=testFunctionRequest(temporal);
      await refusal(service.typedRead(ctx,intentWire),'INVALID_REQUEST',400);
      for(const field of ['requestId','snapshot','asOf',...(temporal.functionName==='CheckDailyRecordCompleteness'?[]:['cursor'])]){
        const incomplete=JSON.parse(canonicalJson(req));delete incomplete.functionRequest[field];
        await refusal(service.typedRead(ctx,incomplete),'INVALID_REQUEST',400);
      }
      expect(store.admissions.size).toBe(0);expect(store.projectionCalls).toBe(0);
    }
  });
  test('source digest equals the independent contract recipe over the complete Function request',()=>{
    const req=request();
    const complete={...(req.functionRequest as unknown as Record<string,unknown>),requestId:'independent-function-id',snapshot:req.snapshot,asOf:req.asOf,cursor:null};
    const {requestId:_r,cursor:_c,...semantic}=complete;
    const independent=digest({domain:'function-selection/v2',...semantic});
    expect(functionSelectionDigest(req)).toBe(independent);
    expect(functionSelectionDigest(req)).toBe(expectedSelectionDigest(req));
  });
  test('complete Function 2.0.0 wire request is accepted and snapshot mismatches refuse',async()=>{
    const {service}=fixture();
    const req=request();
    req.functionRequest={...req.functionRequest,requestId:'independent-function-id',snapshot:req.snapshot,asOf:req.asOf,cursor:null} as TypedCompleteFunctionRequest;
    sealRequest(req);
    const res=await service.typedRead(ctx,req);
    expect(res.kind).toBe('OK');
    const mismatched=request();
    mismatched.functionRequest={...mismatched.functionRequest,requestId:'independent-function-id',snapshot:{...mismatched.snapshot,readRevision:'read-other'},asOf:mismatched.asOf,cursor:null} as TypedCompleteFunctionRequest;
    sealRequest(mismatched);
    await refusal(service.typedRead(ctx,mismatched),'INVALID_REQUEST',400);
  });
});

test('OR1-02 retained catalog payload, parent and revision agree when current catalog has advanced',async()=>{
  const {store,service}=fixture();
  mapFixtureViews(store,view=>({...view,
    current:async(owner,student)=>{
      const rows=await view.current(owner,student),progress=rows.find(r=>r.payload.kind==='daily_progress')!;
      if(progress.payload.kind!=='daily_progress')throw Error('fictional progress required');
      const payload=progress.payload;
      return [...rows,...['major','middle'].map(id=>({...progress,entityId:'progress-'+id,revisionId:'rev-progress-'+id,payload:{...payload,contentScope:{...payload.contentScope,unitRef:objectRef('Unit',id,'rev-'+id)}}}))];
    },
    catalog:async owner=>(await view.catalog(owner)).map(n=>n.id==='minor'?{...n,label:'Current changed unit',parent:legacyKnown('major',['new-parent'])}:n.id==='book'?{...n,label:'Current changed book'}:n).reverse(),
    currentCatalogPins:async owner=>(await view.currentCatalogPins(owner)).map(p=>({...p,revisionId:p.revisionId+'-new'})),
    pinnedCatalog:async(owner,refs)=>{const retained=await view.catalog(owner);return refs.map(r=>{const n=retained.find(n=>n.id===r.nodeId);if(!n)throw Error('missing retained fixture');return {node:n,revisionId:r.revisionId};});},
  }));
  const req=request({selector:{kind:'EXACT_OBJECT',objectRef:minorRef}});
  const result=await service.typedRead(ctx,req);
  const unit=result.items.find(i=>i.kind==='OBJECT');
  expect(unit?.kind).toBe('OBJECT');
  if(unit?.kind!=='OBJECT')throw Error('retained Unit missing');
  expect(unit.record.revision).toBe('rev-minor');
  expect(unit.record.label).toMatchObject({state:'known',value:'Invented minor'});
  expect(unit.record.provenance[0]?.sourceRevision).toBe('rev-minor');
  expect(unit.record.parentUnitRef).toMatchObject({state:'known',value:objectRef('Unit','middle','rev-middle')});
  expect(unit.record.editionRef).toEqual(editionRef);
  const parent=result.items.find(i=>i.kind==='LINK'&&i.link.linkType==='unitParent');
  expect(parent).toMatchObject({kind:'LINK',link:{toRef:objectRef('Unit','middle','rev-middle')}});
  expect(JSON.stringify(result)).not.toContain('Current changed');
});

test('OR1-03 registered Student, Class and Draft rows and outgoing links stay bound to their inputs',async()=>{
  for(const [base,temporal] of [
    ['Student',testTemporal()],
    ['ClassGroup',testTemporal({functionName:'ListClassDailyStatus',studentRef:null})],
    ['DailyRecordDraft',testTemporal({functionName:'CheckDailyRecordCompleteness',draftRef})],
  ] as const){
    const {store,service}=fixture();
    mapFixtureViews(store,view=>({...view,
      students:async owner=>{const rows=await view.students(owner);return [...rows,{...rows[0]!,id:'unrelated-student'}];},
      studentRevisionCurrent:async(owner,id)=>id==='unrelated-student'?version(id,'unrelated-revision',{kind:'student_record',displayName:knownK('Other student'),enrollmentState:knownK('ACTIVE' as const)}):view.studentRevisionCurrent(owner,id),
      classGroups:async owner=>{const rows=await view.classGroups(owner);return [...rows,{...rows[0]!,entityKey:'unrelated-class',revisionId:'unrelated-class-r1'}];},
      current:async(owner,id)=>id==='unrelated-student'?[]:(await view.current(owner,id)).flatMap(r=>r.payload.kind==='daily_record_draft'?[r,{...r,entityId:'other-draft',revisionId:'other-draft-r1'}]:[r]),
    }));
    const result=await service.typedRead(ctx,registeredRequest(base,{temporalSelection:temporal}));
    const expected=base==='Student'?studentRef:base==='ClassGroup'?classRef:draftRef;
    expect(result.items.flatMap(i=>i.kind==='OBJECT'?[i.record.identity]:[])).toEqual([expected.identity]);
    for(const item of result.items)if(item.kind==='LINK')expect(item.link.fromRef.identity).toEqual(expected.identity);
    expect(JSON.stringify(result)).not.toContain('unrelated-');
    // Get/List include the selected occurrence's source closure. Check
    // cites one exact draft, so its sibling's gaps must be excluded.
    if(base==='DailyRecordDraft')expect(result.gaps.every(g=>g.subject?.identity.nativeKey!=='other-draft')).toBe(true);
  }
});

test('OR2-02 Get verifies its own lesson participant without manufacturing a gap for a valid peer',async()=>{
  for(const selectedRevision of ['rev-student','rev-student-advanced']){
    const {store,service}=fixture(),peer=objectRef('Student','student-b','rev-student-b');
    mapFixtureViews(store,view=>({...view,
      lessons:async owner=>(await view.lessons(owner)).map(v=>({...v,payload:{...v.payload,participantRefs:knownK([studentRef,peer])}})),
      students:async owner=>{const rows=await view.students(owner);return [...rows,{...rows[0]!,id:'student-b'}];},
      studentRevisionCurrent:async(owner,id)=>id==='student-b'?version(id,peer.revision,{kind:'student_record',displayName:knownK('Invented peer'),enrollmentState:knownK('ACTIVE' as const)}):{...(await view.studentRevisionCurrent(owner,id))!,revisionId:selectedRevision},
      current:async(owner,id)=>{if(id==='student-b')throw Error('Get must not expand the peer source partition');return view.current(owner,id);},
    }));
    const result=await service.typedRead(ctx,request({selector:{kind:'EXACT_OBJECT',objectRef:lessonRef},expectedRevisions:[],temporalSelection:testTemporal({studentRef:{...studentRef,revision:selectedRevision}})}));
    const participantLinks=result.items.flatMap(i=>i.kind==='LINK'&&i.link.linkType==='lessonHasStudent'?[i.link]:[]);
    const participantGaps=result.gaps.filter(g=>g.path==='links.lessonHasStudent');
    if(selectedRevision==='rev-student'){
      // Payload and dated temporal witnesses retain their distinct intervals.
      expect(participantLinks.map(l=>[l.toRef,l.validFrom])).toEqual([[studentRef,DATE],[studentRef,'2026-01-01']]);
      expect(participantGaps).toEqual([]);
      expect(result.gaps).toContainEqual(expect.objectContaining({path:'links.assessmentOfHomework',reason:'UNVERIFIED'}));
    }else{
      // A real mismatch at the selected endpoint remains explicit.
      expect(participantLinks).toEqual([]);
      expect(participantGaps).toContainEqual(expect.objectContaining({subject:lessonRef,reason:'UNVERIFIED'}));
    }
    expect(JSON.stringify(result.gaps)).not.toContain('student-b');
  }
});

test('OR2-01 List keeps unknown participant mapping explicit instead of reporting an empty complete closure',async()=>{
  const {store,service}=fixture();
  mapFixtureViews(store,view=>({...view,lessons:async owner=>(await view.lessons(owner)).map(v=>({...v,payload:{...v.payload,participantRefs:unknownK<ObjectRef<'Student'>[]>()}}))}));
  const result=await service.typedRead(ctx,registeredRequest('ClassGroup',{temporalSelection:testTemporal({functionName:'ListClassDailyStatus',studentRef:null})}));
  expect(result.enumeration).toBe('UNKNOWN');
  expect(result.gaps).toContainEqual(expect.objectContaining({subject:lessonRef,path:'links.lessonHasStudent',reason:'UNVERIFIED'}));
});


describe('F2 trusted UTF8 output budget',()=>{
  test('a multibyte page at exactly 1048576 wire bytes succeeds; one byte more refuses before COMPLETED',async()=>{
    const build=(text:string)=>{const f=fixture();withOutputLabel(f.store,{text});return {...f,req:registeredRequest('Student',{requestId:'f2-budget-wire',linkMask:[]})};};
    const base=build('x'),page=await base.service.typedRead(ctx,base.req);
    const room=1048576-Buffer.byteLength(JSON.stringify(page),'utf8')+1;
    const label='가'.repeat(Math.floor(room/3))+'x'.repeat(room%3);
    expect(label.length).toBeLessThan(room);
    const exact=build(label),output=await exact.service.typedReadBuffered(ctx,exact.req,()=>true);
    expect(output.status).toBe(200);expect(output.body!.byteLength).toBe(1048576);
    expect(JSON.parse(new TextDecoder().decode(output.body!))).toMatchObject({kind:'OK',requestId:'f2-budget-wire'});
    expect(exact.store.finalizations.map(x=>x.status)).toEqual(['COMPLETED']);
    const over=build(label+'x'),blocked=await over.service.typedReadBuffered(ctx,over.req,()=>true);
    expect(blocked.status).toBe(409);
    const error=JSON.parse(new TextDecoder().decode(blocked.body!));
    expect(error.error.code).toBe('OUTPUT_ADMISSION_BLOCKED');expect(error.items).toBeUndefined();
    expect(over.store.finalizations.map(x=>[x.status,x.refusalCode])).toEqual([['REFUSED','OUTPUT_ADMISSION_BLOCKED']]);
    expect(over.store.commitCalls).toBe(1);expect(over.store.directFinalizeCalls).toBe(0);
  });
  test('the trusted byte policy cannot be overridden through caller JSON',async()=>{
    const f=fixture();
    await refusal(f.service.typedRead(ctx,{...request(),maxOutputBytes:9999999} as TypedReadRequest),'INVALID_REQUEST',400);
    expect(f.store.admissions.size).toBe(0);
  });
});

test('DP-OCC a DailyProgress daily-context query returns only the selected occurrence; cited other-occurrence progress stays a dependency',async()=>{
  const {store,service}=fixture();
  const other={...recScope,businessDate:'2026-10-23',lessonRef:objectRef('LessonSession','prior-lesson','rev-prior-lesson')};
  mapFixtureViews(store,view=>({...view,current:async(owner,student)=>{
    const rows=await view.current(owner,student),progress=rows.find(r=>r.payload.kind==='daily_progress')!;
    return [...rows,{...progress,entityId:'progress-prior',revisionId:'rev-progress-prior',payload:{...progress.payload,recordScope:other} as typeof progress.payload}];
  }}));
  const res=await service.typedRead(ctx,registeredRequest('DailyProgress',{snapshot:snapshot('FAIL_ON_CHANGE'),expectedRevisions:[objectRef('DailyProgress','progress-prior','rev-progress-prior')]}));
  expect(res.items.flatMap(i=>i.kind==='OBJECT'?[i.record.identity.nativeKey]:[])).toEqual(['progress-a']);
});

test('SC-PROG a DailyProgress follows its current activity scope: a detached or re-scoped progress keeps no link to its old lesson',async()=>{
  const scope=(state:'ACTIVE'|'DETACHED',lesson:ObjectRef)=>version('scope-progress','rev-scope-'+state,{schemaVersion:'2.0.0' as const,state,kind:'activity_scope' as const,activityKind:'DAILY_PROGRESS' as const,activityRef:progressRef as ObjectRef<'DailyProgress'>,recordScope:{...recScope,lessonRef:lesson as ObjectRef<'LessonSession'>},sourceLiteral:'synthetic-scope',synthetic:true});
  const lessonLinks=async(scopes:OwnerVersion<any>[]):Promise<string[]>=>{
    const {store,service}=fixture();mapFixtureViews(store,view=>({...view,activityScopes:async()=>scopes}));
    try{const res=await service.typedRead(ctx,request({selector:{kind:'EXACT_OBJECT',objectRef:progressRef},linkMask:['activityInLesson']}));
      return res.items.flatMap(i=>i.kind==='LINK'&&i.link.linkType==='activityInLesson'&&i.link.fromRef.identity.nativeKey==='progress-a'?[i.link.toRef.identity.nativeKey]:[]);}
    catch(error){if(error instanceof TypedReadRefusal)return [];throw error;}
  };
  expect(await lessonLinks([])).toEqual(['lesson-a']);
  expect(await lessonLinks([scope('DETACHED',lessonRef)])).toEqual([]);
  expect(await lessonLinks([scope('ACTIVE',objectRef('LessonSession','lesson-b','rev-lesson-b'))])).not.toContain('lesson-a');
});

test('SC-OCC a student occurrence without dated class membership is never declared COMPLETE on the general path',async()=>{
  const {store,service}=fixture();
  store.temporals=store.temporals.filter(t=>t.payload.bindingKind!=='CLASS_MEMBERSHIP');
  const res=await service.typedRead(ctx,request({selector:{kind:'EXACT_OBJECT',objectRef:studentRef},linkMask:['classTaughtBy']}));
  expect(res.enumeration).not.toBe('COMPLETE');
  expect(res.gaps.map(g=>g.path)).toContain('Student.links.studentMemberOfClass');
});

test('SC-REV a scoped progress whose scope pins another revision is withheld with an explicit unresolved mapping',async()=>{
  const {store,service}=fixture();
  const stale=version('scope-progress','rev-scope-stale',{schemaVersion:'2.0.0' as const,state:'ACTIVE' as const,kind:'activity_scope' as const,activityKind:'DAILY_PROGRESS' as const,activityRef:{...progressRef,revision:'rev-progress-previous'} as ObjectRef<'DailyProgress'>,recordScope:recScope,sourceLiteral:'synthetic-scope',synthetic:true});
  mapFixtureViews(store,view=>({...view,activityScopes:async()=>[stale]}));
  const res=await service.typedRead(ctx,registeredRequest('DailyProgress'));
  expect(res.items.some(i=>i.kind==='OBJECT'&&i.record.identity.nativeKey==='progress-a')).toBe(false);
  expect(res.gaps.map(g=>g.path)).toContain('DailyProgress.recordScope');
  expect(res.enumeration).not.toBe('COMPLETE');
});

test('SC-REV-EXACT an exact read of a progress with an unresolved scope mapping returns that gap, not NOT_FOUND',async()=>{
  const {store,service}=fixture();
  const stale=version('scope-progress','rev-scope-stale',{schemaVersion:'2.0.0' as const,state:'ACTIVE' as const,kind:'activity_scope' as const,activityKind:'DAILY_PROGRESS' as const,activityRef:{...progressRef,revision:'rev-progress-previous'} as ObjectRef<'DailyProgress'>,recordScope:recScope,sourceLiteral:'synthetic-scope',synthetic:true});
  mapFixtureViews(store,view=>({...view,activityScopes:async()=>[stale]}));
  const res=await service.typedRead(ctx,request({selector:{kind:'EXACT_OBJECT',objectRef:progressRef},linkMask:[]}));
  expect(res.items).toEqual([]);
  expect(res.enumeration).toBe('UNKNOWN');
  expect(res.gaps.map(g=>g.path)).toContain('DailyProgress.recordScope');
});

test('SC-LESSON without a dated participation binding the payload participant link stays and no gap contradicts it',async()=>{
  const {store,service}=fixture();
  store.temporals=store.temporals.filter(t=>t.payload.bindingKind!=='LESSON_PARTICIPATION');
  const res=await service.typedRead(ctx,request({selector:{kind:'EXACT_OBJECT',objectRef:lessonRef},linkMask:['lessonHasStudent']}));
  const links=res.items.flatMap(i=>i.kind==='LINK'&&i.link.linkType==='lessonHasStudent'?[i.link]:[]);
  expect(links.map(l=>[l.toRef.identity.nativeKey,l.validFrom])).toEqual([['student-a',DATE]]);
  expect(res.gaps.map(g=>g.path)).not.toContain('LessonSession.links.lessonHasStudent');
});

describe('OCC-RESOLVER one occurrence rule for every reader',()=>{
  const at=(state:'ACTIVE'|'DETACHED',revision:string,lesson='lesson-a',key='scope-p')=>version(key,'rev-'+key+'-'+state+revision,{schemaVersion:'2.0.0' as const,state,kind:'activity_scope' as const,activityKind:'DAILY_PROGRESS' as const,activityRef:{...progressRef,revision} as ObjectRef<'DailyProgress'>,recordScope:{...recScope,lessonRef:objectRef('LessonSession',lesson,'rev-'+lesson) as ObjectRef<'LessonSession'>},sourceLiteral:'synthetic',synthetic:true});
  const activity={objectType:'DailyProgress',nativeKey:'progress-a',revision:'rev-progress'};
  const other=version('scope-h','rev-scope-h',{schemaVersion:'2.0.0' as const,state:'ACTIVE' as const,kind:'activity_scope' as const,activityKind:'HOMEWORK_ASSIGNMENT' as const,activityRef:homeworkRef as ObjectRef<'HomeworkAssignment'>,recordScope:recScope,sourceLiteral:'synthetic',synthetic:true});
  test('no attachment: embedded scope, or unresolved without one',()=>{
    expect(resolveActivityOccurrence(activity,recScope,[other]).state).toBe('EMBEDDED');
    expect(resolveActivityOccurrence(activity,null,[]).state).toBe('UNRESOLVED');
  });
  test('one ACTIVE attachment pinning this revision moves it; a stale pin or two ACTIVE are unresolved; detached wins',()=>{
    const moved=resolveActivityOccurrence(activity,recScope,[at('ACTIVE','rev-progress','lesson-b')]);
    expect(moved.state==='ATTACHED'&&moved.scope.lessonRef.identity.nativeKey).toBe('lesson-b');
    expect(resolveActivityOccurrence(activity,recScope,[at('ACTIVE','rev-progress-previous','lesson-b')]).state).toBe('UNRESOLVED');
    expect(resolveActivityOccurrence(activity,recScope,[at('ACTIVE','rev-progress'),at('ACTIVE','rev-progress','lesson-b','scope-q')]).state).toBe('UNRESOLVED');
    expect(resolveActivityOccurrence(activity,recScope,[at('ACTIVE','rev-progress'),at('DETACHED','rev-progress','lesson-a','scope-q')]).state).toBe('DETACHED');
  });
});

test('SC-REV-STALE a withheld exact object still refuses a revision that is not its current one',async()=>{
  const {store,service}=fixture();
  const stale=version('scope-progress','rev-scope-stale',{schemaVersion:'2.0.0' as const,state:'ACTIVE' as const,kind:'activity_scope' as const,activityKind:'DAILY_PROGRESS' as const,activityRef:{...progressRef,revision:'rev-progress-previous'} as ObjectRef<'DailyProgress'>,recordScope:recScope,sourceLiteral:'synthetic-scope',synthetic:true});
  mapFixtureViews(store,view=>({...view,activityScopes:async()=>[stale]}));
  await refusal(service.typedRead(ctx,request({selector:{kind:'EXACT_OBJECT',objectRef:{...progressRef,revision:'never-existed'}},linkMask:[]})),'REVISION_STALE',409);
});

test('SC-CAT a withheld Unit or TextbookEdition still refuses a revision that is not its current pin',async()=>{
  for(const ref of [objectRef('Unit','minor','never-existed'),objectRef('TextbookEdition','book','never-existed')]){
    const {service}=fixture();
    await refusal(service.typedRead(ctx,request({selector:{kind:'EXACT_OBJECT',objectRef:ref},fieldMask:fullFieldMask([ref.identity.objectType]),linkMask:[]})),'REVISION_STALE',409);
  }
});

test('SC-WITNESS a payload participant link and a dated participation binding with the same start are both kept',async()=>{
  const {store,service}=fixture();
  store.temporals=store.temporals.map(t=>t.payload.bindingKind==='LESSON_PARTICIPATION'?{...t,payload:{...t.payload,validFrom:DATE,validTo:'2026-10-25'}}:t);
  const res=await service.typedRead(ctx,request({selector:{kind:'EXACT_OBJECT',objectRef:lessonRef},linkMask:['lessonHasStudent']}));
  const links=res.items.flatMap(i=>i.kind==='LINK'&&i.link.linkType==='lessonHasStudent'?[i.link]:[]);
  expect(links.map(l=>l.nativeRelationKey.state).sort()).toEqual(['known','unknown']);
  expect(links.find(l=>l.nativeRelationKey.state==='known')!.validThrough).toMatchObject({state:'known',value:DATE});
});


describe('AUTH-T dated teaching is shared by every native read boundary',()=>{
 const changeTeaching=(store:FakePrerequisiteStore,mode:string)=>{
  const rows=store.temporals.filter(v=>v.payload.bindingKind==='TEACHING_ASSIGNMENT');
  if(mode==='missing'){store.temporals=store.temporals.filter(v=>v.payload.bindingKind!=='TEACHING_ASSIGNMENT');return;}
  for(const row of rows){
   if(mode==='closed')row.payload.validTo=DATE;
   if(mode==='future')row.payload.validFrom='2026-10-25';
   if(mode==='other-teacher')row.payload.targetRef=objectRef('Teacher','teacher-other','rev-other');
   if(mode==='stale-teacher')row.payload.targetRef={...row.payload.targetRef,revision:'rev-historical-teacher'};
   if(mode==='stale-class')row.payload.subjectRef={...row.payload.subjectRef,revision:'rev-historical-class'};
  }
 };
 for(const mode of ['missing','closed','future','other-teacher','stale-teacher','stale-class'])test('AUTH-T1 acquire and all projection masks refuse '+mode,async()=>{
  const f=fixture(),issuer=createNativeTypedRead(f.store.asStore(),OWNER,{processEpoch:'auth-t',registrySha256:TEST_REGISTRY_SHA256,snapshotGrantSecret:'invented-auth-t-secret',now:()=>Date.parse(ASOF)});
  const acquire={schema:'native-read-acquire.v2' as const,consumerProfile:'CURRENT_1_1' as const,requestId:'auth-t-acquire',scopeRef:nativeRef(),consistency:'SNAPSHOT' as const,time:{mode:'CURRENT' as const},functionIntent:testFunctionRequest(testTemporal())};
  const grant=await issuer.acquireSnapshot(ctx,acquire);changeTeaching(f.store,mode);
  await refusal(issuer.acquireSnapshot(ctx,{...acquire,requestId:'auth-t-new-acquire'}),'PERMISSION_DENIED',403);
  for(const [type,key,rev] of [['DailyProgress','progress-a','rev-progress'],['PreviousHomeworkAssessment','assessment-a','rev-assessment'],['DailyRecordDraft','draft-a','rev-draft'],['Student','student-a','rev-student']] as const){
   const req=request({requestId:'auth-t-'+type,selector:{kind:'EXACT_OBJECT',objectRef:objectRef(type,key,rev)},fieldMask:fullFieldMask([type,'Teacher']),linkMask:['activityForStudent','activityInClass','activityInLesson']});
   await refusal(f.service.typedRead(ctx,req),'PERMISSION_DENIED',403);
   expect(f.store.finalizations.at(-1)).toMatchObject({status:'REFUSED',refusalCode:'PERMISSION_DENIED'});
  }
  await refusal(issuer.typedRead(ctx,request({requestId:'auth-t-prior-grant',snapshot:grant.snapshot,asOf:grant.snapshot.asOf,snapshotAdmission:grant.snapshotAdmission})),'PERMISSION_DENIED',403);
  await refusal(f.service.verifyContinuation(ctx,request({requestId:'auth-t-continuation'})),'PERMISSION_DENIED',403);
 });
 test('AUTH-T2 the final gate refuses when teaching closes after preparation',async()=>{
  const f=fixture(),commit=f.store.commitReadOutput.bind(f.store);
  f.store.commitReadOutput=async(...args)=>{changeTeaching(f.store,'closed');return commit(...args);};
  const out=await f.service.typedReadBuffered(ctx,request({selector:{kind:'EXACT_OBJECT',objectRef:progressRef}}),()=>true);
  expect(out.status).toBe(403);expect(new TextDecoder().decode(out.body!)).not.toContain('Synthetic progress');
  expect(f.store.finalizations.at(-1)).toMatchObject({status:'REFUSED',refusalCode:'PERMISSION_DENIED'});
 });
 test('AUTH-T3 authorized native records retain known scope with relation evidence gaps',async()=>{
  for(const missing of ['CLASS_MEMBERSHIP','LESSON_PARTICIPATION'] as const){
   const f=fixture();f.store.temporals=f.store.temporals.filter(v=>v.payload.bindingKind!==missing);
   for(const [type,key,rev] of [['DailyProgress','progress-a','rev-progress'],['PreviousHomeworkAssessment','assessment-a','rev-assessment'],['DailyRecordDraft','draft-a','rev-draft']] as const){
    const out=await f.service.typedRead(ctx,request({requestId:'auth-t-compat-'+type,selector:{kind:'EXACT_OBJECT',objectRef:objectRef(type,key,rev)},fieldMask:fullFieldMask([type]),linkMask:['activityForStudent','activityInClass','activityInLesson']}));
    expect(out.items.filter(i=>i.kind==='OBJECT')).toHaveLength(1);expect(out.items.filter(i=>i.kind==='LINK')).toHaveLength(3);
    if(missing==='CLASS_MEMBERSHIP'){expect(out.enumeration).toBe('UNKNOWN');expect(out.gaps.some(g=>g.path==='Student.links.studentMemberOfClass')).toBe(true);}
    else expect(out.gaps.some(g=>g.path==='Student.links.studentParticipatesInLesson')).toBe(false);
   }
  }
 });
});


test('AUTH-T5 current teaching denial precedes invalid acquisition and expired continuation diagnostics',async()=>{
 const f=fixture();f.store.temporals=f.store.temporals.filter(v=>v.payload.bindingKind!=='TEACHING_ASSIGNMENT');
 const expired=request({snapshotAdmission:{...request().snapshotAdmission,expiresAt:'2026-10-23T00:00:00.000Z'}});
 await refusal(f.service.typedRead(ctx,expired),'PERMISSION_DENIED',403);
 await refusal(f.service.verifyContinuation(ctx,expired),'PERMISSION_DENIED',403);
 const issuer=createNativeTypedRead(f.store.asStore(),OWNER,{processEpoch:'auth-invalid',registrySha256:TEST_REGISTRY_SHA256,snapshotGrantSecret:'invented-auth-invalid-secret',now:()=>Date.parse(ASOF)});
 await refusal(issuer.acquireSnapshot(ctx,{schema:'native-read-acquire.v2',consumerProfile:'CURRENT_1_1',requestId:'auth-invalid-acquire',scopeRef:nativeRef(),consistency:'SNAPSHOT',time:{mode:'CURRENT'},functionIntent:{...testFunctionRequest(testTemporal()),pageSize:0}}),'PERMISSION_DENIED',403);
 expect(f.store.projectionCalls).toBe(0);expect(f.store.admissions.size).toBe(0);
});

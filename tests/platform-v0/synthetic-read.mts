// Synthetic owner-port fixture adapted from the existing typed-read source tests.
// No service, authentication, database, files, network or native business writes.
import { canonicalJson, digest, known as legacyKnown } from '../../apps/academy/dc-gang-a/src/learning/model';
import { createNativeTypedRead, fullFieldMask, linkTypes, registryArtifactPath, typeFields, typeVersions, type QuerySpec, type SnapshotAdmissionGrant, type TypedCompleteFunctionRequest, type TypedFunctionRequest, type TypedReadRequest, type TypedTemporalSelection } from '../../apps/academy/dc-gang-a/src/academy/nativeTypedRead';
import { educationTypes, type EducationType, type EvidenceRef, type Knowledge, type NativeObjectRef, type ObjectRef, type OwnerVersion, type ReadAdmission, type ReadFinalization, type ReadSnapshot, type TeacherBinding, type TemporalBinding } from '../../apps/academy/dc-gang-a/src/academy/contracts/prerequisiteRecords';
import type { TeacherPrerequisiteReadStore, TeacherPrerequisiteStore } from '../../apps/academy/dc-gang-a/src/academy/ports/teacherStore';
import type { CatalogNode } from '../../apps/academy/dc-gang-a/src/academy/domain';
import type { CurrentRecord } from '../../apps/academy/dc-gang-a/src/academy/contracts/storageRecords';
import type { TrustedTeacherContext } from '../../apps/academy/dc-gang-a/src/academy/contracts/teacherOperations';
const OWNER='synthetic-owner',ACTOR='synthetic-actor',ASOF='2026-10-24T00:00:00.000Z',DATE='2026-10-24',SHA='a'.repeat(64);
export const ctx:TrustedTeacherContext={ownerId:OWNER,actorId:ACTOR,role:'teacher'};
export function nativeRef(key='synthetic-scope'):NativeObjectRef{return {tag:'object-record',basis:{namespace:'synthetic-native',scope:{ownerNamespace:OWNER,projectKey:'synthetic-project',scopeKey:'synthetic-scope'},contract:{state:'KNOWN',value:{namespace:'synthetic-native',contractId:'synthetic-contract',definitionVersion:'1.1.0',sha256:SHA}},recordRevision:{state:'KNOWN',value:{scheme:'OWNER_REVISION',value:'synthetic-scope-r1'}},source:{ownerNamespace:OWNER,publicLocator:'synthetic-interface',revision:{state:'KNOWN',value:{scheme:'OWNER_REVISION',value:'synthetic-interface-r1'}},evidenceRefs:[]}},objectTypeId:'Scope',objectTypeVersion:'1.0.0',objectKey:key};}
export const evidence=():EvidenceRef=>({sourceRef:nativeRef(),sourceRevision:'synthetic-evidence-r1',locator:'synthetic-scoped-evidence',observedAt:ASOF});
export const knownK=<T,>(value:T):Knowledge<T>=>({state:'known',value,evidence:[evidence()]});
export const unknownK=<T,>():Knowledge<T>=>({state:'unknown',reason:'UNVERIFIED',evidence:[],requiredEvidence:['SOURCE_FIELD']});
export function objectRef<T extends EducationType>(type:T,key:string,revision='rev-'+key):ObjectRef<T>{return {identity:{scopeRef:nativeRef(),namespace:'synthetic-native',objectType:type,nativeKey:key},revision};}
export function version<P extends import('../../apps/academy/dc-gang-a/src/academy/contracts/prerequisiteRecords').OwnerPayload>(entityKey:string,revisionId:string,payload:P):OwnerVersion<P>{return {ownerId:OWNER,namespace:'synthetic-native',scopeRef:nativeRef(),entityKey,sequence:1,revisionId,previousRevisionId:null,previousDigest:null,payload,contentDigest:digest(payload),integrityDigest:digest({entityKey,revisionId}),sourceObservedAt:ASOF,recordedAt:ASOF,actorId:ACTOR,idempotencyKey:'key-'+entityKey,commandDigest:digest({entityKey})} as OwnerVersion<P>;}
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
    const projected=<T,>(value:T):T=>{self.projectionCalls++;return value;};
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
export function fixture(){const store=new FakePrerequisiteStore();return {store,service:createNativeTypedRead(store.asStore(),OWNER,{processEpoch:'epoch-1',registrySha256:TEST_REGISTRY_SHA256,snapshotGrantVerifier:fictionalGrantVerifier,now:()=>Date.parse(ASOF)})};}
/** Apply the same fictional read model in preparation and the output gate. */
export function mapFixtureViews(store:FakePrerequisiteStore,transform:(view:TeacherPrerequisiteReadStore)=>TeacherPrerequisiteReadStore):void{
  const read=store.readSnapshot.bind(store),commit=store.commitReadOutput.bind(store);
  store.readSnapshot=async callback=>read(view=>callback(transform(view)));
  store.commitReadOutput=async(admission,prepare)=>commit(admission,view=>prepare(transform(view)));
}
/** Keep functionRequest joins coherent when a test replaces temporalSelection. */
export function withTemporal(base:TypedReadRequest,temporal:TypedTemporalSelection):TypedReadRequest{
  const intent=testFunctionRequest(temporal,base.pageSize,base.expectedRevisions);
  return sealRequest({...base,temporalSelection:temporal,functionRequest:{...intent,requestId:base.functionRequest.requestId,snapshot:base.snapshot,asOf:base.asOf,...(intent.functionName==='CheckDailyRecordCompleteness'?{}:{cursor:base.cursor})}});
}

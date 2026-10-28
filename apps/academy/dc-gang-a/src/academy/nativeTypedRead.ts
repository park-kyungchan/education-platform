import {createHmac,timingSafeEqual} from 'node:crypto';
import {assertDate,assertExactKeys,assertInstant,canonicalJson,digest,requireText} from '../learning/model';
import {assertTeacherScope} from './usecases/requestRecovery';
import type {TrustedTeacherContext} from './contracts/teacherOperations';
import type {ReadHorizonExpectation,ReadHorizonPlan,ReadOutputRefusalSelector,TeacherPrerequisiteReadStore,TeacherPrerequisiteStore} from './ports/teacherStore';
import {computeReadHorizon,selectReadPlan,readPlanStudentTuples} from './nativePrerequisiteStore';
import {validateKnowledge,validateOwnerPayload,activityScopeState,fixedConsumerProfile,consumerProfilePins,selectedProtocolClosure,type ConsumerProfileId,type RecordScope,educationTypes,projectInterval,validateNativeRef,validateObjectRef,validateSnapshot,type EducationType,type EvidenceRef,type Knowledge,type NativeObjectRef,type ObjectRef,type ReadAdmission,type ReadSnapshot} from './contracts/prerequisiteRecords';
import type {CatalogNode} from './domain';
import {validateAcademyRecord} from './records';
import {validateLearningAssignment,validateLearningAttempt,type LearningWorkAssignment} from './learningWork';
import type {CurrentRecord} from './contracts/storageRecords';
import type {NativeOwnerCursorLease,NativeOwnerCursorBinding} from './teacherAuthStore';

/** IG-3 closed typed-read projectors over the IG-1 prerequisite read port.
 * Authenticated identity always comes from TrustedTeacherContext (existing
 * session-cookie ingress); requests carry no principal/teacher claims.
 * Read-occurrence metadata lives outside the business snapshot. Native
 * actuals that cannot be projected losslessly are reported as authorized
 * remainder gaps, never fabricated. Owner-qualified snapshot, opaque
 * cursor and atomic output capabilities are not exposed by the frozen
 * ports (Root amendment P4S-DEP-READ-FENCE/CURSOR/OUTPUT is requested
 * only): continuation, multi-page enumeration and unsupported registered
 * plans fail closed instead of inventing proofs. Handler/source only. */
export const typedReadContractVersion='3.0.0';
export const acquisitionContractVersion='2.0.0';
export const snapshotAcquireSchema='native-read-acquire.v2';
export const snapshotAcquireResultSchema='native-read-acquire-result.v2';
export const namedLinksVersion='1.1.0';
export const registryContractVersion='1.1.0';
export const cursorDomain='native-read-continuation/v3';
export const registryArtifactPath='reports/p6-execution/native-foundations/reconciliation/education-registry.v4.json';
export type TypedEducationType=EducationType;
export const linkTypes=['studentMemberOfClass','classTaughtBy','lessonOfClass','lessonTaughtBy','lessonHasStudent','unitInEdition','unitParent','sectionInEdition','sectionInUnit','activityForStudent','activityInClass','activityInLesson','activityUsesEdition','activityUsesUnit','activityUsesSection','assessmentOfHomework','assessmentByTeacher','attemptFollows','draftProgress','draftHomework','draftAttempts','draftPreviousAssessments','draftResponsibleTeacher'] as const;
export type TypedLinkType=typeof linkTypes[number];
export const linkVersions:Readonly<Record<TypedLinkType,string>>=Object.freeze(Object.fromEntries(linkTypes.map(link=>[link,link==='sectionInUnit'?'1.1.0':'1.0.0'])) as Record<TypedLinkType,string>);
export const typeVersions:Readonly<Record<EducationType,string>>=Object.freeze(Object.fromEntries(educationTypes.map(type=>[type,type==='Section'?'1.1.0':'1.0.0'])) as Record<EducationType,string>);
const baseFields=['contractVersion','typeVersion','identity','revision','asOf','snapshot','provenance'] as const;
export const typeFields:Readonly<Record<EducationType,readonly string[]>>=Object.freeze({
  Student:[...baseFields,'displayName','enrollmentState'],
  Teacher:[...baseFields,'displayName','assignmentState'],
  ClassGroup:[...baseFields,'displayName','businessTimezone','classState'],
  LessonSession:[...baseFields,'classGroupRef','businessDate','occurrenceOrdinal','startsAt','endsAt','teacherRefs','participantRefs','lessonState'],
  TextbookEdition:[...baseFields,'title','editionLabel','publisher'],
  Unit:[...baseFields,'editionRef','level','parentUnitRef','label','ordinal'],
  Section:[...baseFields,'editionRef','unitRef','label','ordinal'],
  DailyProgress:[...baseFields,'recordScope','contentScope','progressState','note','corrections'],
  HomeworkAssignment:[...baseFields,'recordScope','contentScope','dueDate','taskText','assignmentState','corrections'],
  DailyTestAttempt:[...baseFields,'recordScope','contentScope','assessmentLabel','attemptOrdinal','attemptedAt','score','gradingState','previousAttemptRef','corrections'],
  PreviousHomeworkAssessment:[...baseFields,'recordScope','homeworkRef','outcome','note','assessedBy','assessedAt','corrections'],
  DailyRecordDraft:[...baseFields,'recordScope','progressRefs','homeworkRefs','attemptRefs','previousAssessmentRefs','progressText','homeworkText','noteText','responsibleTeacherRef','draftState','sourceSnapshot','corrections'],
});
export function fullFieldMask(types:readonly EducationType[]):{objectType:EducationType;path:string}[]{
  return types.flatMap(objectType=>typeFields[objectType].map(path=>({objectType,path})));
}
export type TypedReadErrorCode='INVALID_REQUEST'|'PERMISSION_DENIED'|'NOT_FOUND'|'OBJECTSET_CURSOR_STALE'|'REVISION_STALE'|'CONTRACT_UNVERIFIABLE'|'SNAPSHOT_UNAVAILABLE'|'OUTPUT_ADMISSION_BLOCKED'|'READ_UNRESOLVED';
export class TypedReadRefusal extends Error{
  constructor(readonly code:TypedReadErrorCode,readonly httpStatus:number,readonly requiredEvidence:string[]=[]){super(code);
    // Diagnosable refusals: log only the closed code and creation-site frames (no payloads).
    if(code==='CONTRACT_UNVERIFIABLE'||code==='INVALID_REQUEST'){const at=[...(this.stack??'').matchAll(/\/([A-Za-z_]+\.ts):(\d+):\d+/g)].slice(1,5).map(x=>x[1]+':'+x[2]).join('<');console.error(JSON.stringify({status:'TYPED_READ_REFUSAL',code,at}));}}
}
const invalid=(requiredEvidence:string[]=[]):TypedReadRefusal=>new TypedReadRefusal('INVALID_REQUEST',400,requiredEvidence);
const denied=():TypedReadRefusal=>new TypedReadRefusal('PERMISSION_DENIED',403,['AUTHENTICATED_PRINCIPAL_SCOPE']);
const unverifiable=(requiredEvidence:string[]=['OWNER_INTERFACE_RATIFICATION']):TypedReadRefusal=>new TypedReadRefusal('CONTRACT_UNVERIFIABLE',409,requiredEvidence);
const staleRevision=():TypedReadRefusal=>new TypedReadRefusal('REVISION_STALE',409,['NATIVE_REVISION_SNAPSHOT']);
const staleGrant=():TypedReadRefusal=>new TypedReadRefusal('OBJECTSET_CURSOR_STALE',409,['OWNER_INTERFACE_RATIFICATION']);
const sha256Pattern=/^[a-f0-9]{64}$/;
/* Pinned defining objects (education-registry.v4): definitionSha256 must equal
 * SHA256(canonicalJson(defining object)); registry file hash is distinct. */
const pinnedTypeDefinitionSha256:Readonly<Record<string,string>>={
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
const pinnedLinkDefinitionSha256:Readonly<Record<string,string>>={
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
export function pinnedDefinitionSha256(symbol:string):string|undefined{
  return pinnedTypeDefinitionSha256[symbol]??(symbol.startsWith('NamedLinks/links/')?pinnedLinkDefinitionSha256[symbol.slice('NamedLinks/links/'.length)]:undefined);
}

export interface TypeBinding{artifactPath:string;symbol:string;version:string;definitionSha256:string}
export type QueryFilter=Record<string,unknown>;
export interface LinkSelector{type:TypeBinding;direction:'out'|'in'}
export interface QueryTraversal{link:LinkSelector;targetType:TypeBinding;targetFilter:QueryFilter|null}
export interface TypedTemporalSelection{
  schema:'education-selection.v2';
  functionName:'GetStudentDailyContext'|'ListClassDailyStatus'|'CheckDailyRecordCompleteness';
  functionVersion:'2.0.0';functionRequestDigest:string;businessDate:string;
  classGroupRef:ObjectRef<'ClassGroup'>;studentRef:ObjectRef<'Student'>|null;
  occurrence:{mode:'EXACT';lessonRef:ObjectRef<'LessonSession'>}|{mode:'ENUMERATE_SEPARATELY'};
  draftRef:ObjectRef<'DailyRecordDraft'>|null;
}
export interface QuerySpec{
  schema:'query-spec.v2';scope:NativeObjectRef;registrySha256:string;baseType:TypeBinding;
  filter:QueryFilter|null;traverse:QueryTraversal|null;fieldMask:string[];
  orderBy:{property:string;direction:'asc'|'desc'}[];consistency:'SNAPSHOT'|'FAIL_ON_CHANGE';
  page:{size?:number;cursor:string|null};temporalSelection:TypedTemporalSelection|null;
}
export type TypedReadSelector={kind:'EXACT_OBJECT';objectRef:ObjectRef}|{kind:'REGISTERED_QUERY';query:QuerySpec};
/** Owner SnapshotAdmissionGrant from acquisition 1.0.0; proof is opaque. */
export interface SnapshotAdmissionGrant{grantId:string;proof:string;expiresAt:string}
type FunctionOccurrence=TypedTemporalSelection['occurrence'];
interface FunctionRequestCommon{contractVersion:'2.0.0';functionVersion:'2.0.0';scopeRef:NativeObjectRef;classGroupRef:ObjectRef<'ClassGroup'>;businessDate:string;expectedRevisions:ObjectRef[]}
/** Acquisition intent (exactly one variant): the Function fields known at
 * snapshot acquisition, without transport or snapshot binding. */
export type TypedFunctionRequest=
  | (FunctionRequestCommon&{functionName:'GetStudentDailyContext';selector:'STUDENT_OCCURRENCE_CONTEXT_V1';pageSize:number;studentRef:ObjectRef<'Student'>;occurrence:FunctionOccurrence})
  | (FunctionRequestCommon&{functionName:'ListClassDailyStatus';selector:'CLASS_OCCURRENCE_STATUS_V1';pageSize:number;occurrence:FunctionOccurrence})
  | (FunctionRequestCommon&{functionName:'CheckDailyRecordCompleteness';selector:'DRAFT_COMPLETENESS_V1';studentRef:ObjectRef<'Student'>;occurrence:FunctionOccurrence;draftRef:ObjectRef<'DailyRecordDraft'>;profile:'DAILY_RECORD_OCCURRENCE_V1'});
/** Complete data-phase Function 2.0.0 wire request: the intent fields plus
 * RequestBase/PagingRequest fields. Wire bytes/fields are unchanged. */
export type TypedCompleteFunctionRequest=TypedFunctionRequest&{requestId:string;snapshot:ReadSnapshot;asOf:string;cursor?:string|null};
function horizonPlan(intent:TypedFunctionRequest,consumerProfile:ConsumerProfileId='CURRENT_1_1'):ReadHorizonPlan{
  return {consumerProfile,...(consumerProfile==='CURRENT_1_1'&&intent.functionName==='GetStudentDailyContext'?{sourceClosure:true as const}:{}),classGroupRef:intent.classGroupRef,studentRef:'studentRef' in intent?intent.studentRef:null,occurrence:intent.occurrence,draftRef:'draftRef' in intent?intent.draftRef:null,expectedRevisions:intent.expectedRevisions};
}
export interface TypedReadRequest{
  contractVersion:typeof typedReadContractVersion;consumerProfile:ConsumerProfileId;requestId:string;scopeRef:NativeObjectRef;
  selector:TypedReadSelector;snapshot:ReadSnapshot;functionRequest:TypedCompleteFunctionRequest;snapshotAdmission:SnapshotAdmissionGrant;asOf:string;expectedRevisions:ObjectRef[];
  fieldMask:{objectType:EducationType;path:string}[];linkMask:TypedLinkType[];
  pageSize:number;cursor:string|null;temporalSelection:TypedTemporalSelection;
}
export interface TypedRecord{
  contractVersion:'1.1.0'|'1.0.0';typeVersion:string;identity:ObjectRef['identity'];revision:string;asOf:string;snapshot:ReadSnapshot;provenance:EvidenceRef[];
  [field:string]:unknown;
}
export interface TypedLink{
  linkType:TypedLinkType;linkVersion:string;nativeRelationKey:Knowledge<string>;
  fromRef:ObjectRef;toRef:ObjectRef;revision:string;snapshot:ReadSnapshot;
  validFrom:string;validThrough:Knowledge<string>;provenance:EvidenceRef[];
}
export interface SourceRowRef{scopeRef:NativeObjectRef;sourceStudentRef:ObjectRef<'Student'>;entityId:string;revisionId:string;sourceObservedAt:string;recordedAt:string}
export interface SourceScopeUnknown{kind:'FACET_ONLY_CARRYOVER'|'DETACHED_ACTIVITY';source:SourceRowRef;recordScope:Knowledge<RecordScope>&{state:'unknown';reason:'UNVERIFIED'}}
export interface TypedGap{subject:ObjectRef|null;path:string;reason:string;requiredEvidence:string[];evidence:EvidenceRef[];sourceUnknown?:SourceScopeUnknown}
/** Function2/Query2 keep their exact closed five-key Gap contract. */
export function toFunctionGap(gap:TypedGap):Omit<TypedGap,'sourceUnknown'>{const {subject,path,reason,requiredEvidence,evidence}=gap;return {subject,path,reason,requiredEvidence,evidence};}
export function validateNativeGap(gap:TypedGap):void{
 assertExactKeys(gap,['subject','path','reason','requiredEvidence','evidence',...(Object.hasOwn(gap,'sourceUnknown')?['sourceUnknown']:[])]);
 if(gap.subject!==null)validateObjectRef(gap.subject);
 if(!gap.sourceUnknown)return;
 const x=gap.sourceUnknown;assertExactKeys(x,['kind','source','recordScope']);
 if(!['FACET_ONLY_CARRYOVER','DETACHED_ACTIVITY'].includes(x.kind)||gap.reason!=='UNVERIFIED')throw invalid();
 if(x.kind==='FACET_ONLY_CARRYOVER'?(gap.subject!==null||gap.path!=='sourceClosure'):(gap.subject===null||!['HomeworkAssignment.recordScope','DailyTestAttempt.recordScope'].includes(gap.path)))throw invalid();
 const source=x.source;assertExactKeys(source,['scopeRef','sourceStudentRef','entityId','revisionId','sourceObservedAt','recordedAt']);validateNativeRef(source.scopeRef);validateObjectRef(source.sourceStudentRef,['Student']);
 for(const value of [source.entityId,source.revisionId])if(typeof value!=='string'||Buffer.byteLength(value,'utf8')<1||Buffer.byteLength(value,'utf8')>200)throw invalid();
 assertInstant(source.sourceObservedAt);assertInstant(source.recordedAt);if(!source.sourceObservedAt.endsWith('Z')||!source.recordedAt.endsWith('Z')||source.sourceObservedAt>source.recordedAt)throw invalid();
 const k=x.recordScope;assertExactKeys(k,['state','reason','evidence','requiredEvidence']);
 validateKnowledge(k,()=>{throw invalid();});
 if(canonicalJson(source.scopeRef)!==canonicalJson(source.sourceStudentRef.identity.scopeRef)||canonicalJson(gap.evidence[0]?.sourceRef)!==canonicalJson(source.scopeRef))throw invalid();
 if(x.kind==='DETACHED_ACTIVITY'&&(gap.subject!.identity.nativeKey!==source.entityId||gap.subject!.revision!==source.revisionId||canonicalJson(gap.subject!.identity.scopeRef)!==canonicalJson(source.scopeRef)||gap.subject!.identity.namespace!==source.sourceStudentRef.identity.namespace))throw invalid();
 if(k.state!=='unknown'||k.reason!=='UNVERIFIED'||canonicalJson(k.evidence)!==canonicalJson(gap.evidence)||canonicalJson(k.requiredEvidence)!==canonicalJson(gap.requiredEvidence))throw invalid();
 if(!Array.isArray(gap.evidence)||gap.evidence.length!==(x.kind==='FACET_ONLY_CARRYOVER'?1:2)||gap.evidence.length>4||gap.evidence[0]!.sourceRevision!==source.revisionId)throw invalid();
 if(!Array.isArray(gap.requiredEvidence)||gap.requiredEvidence.length<1||gap.requiredEvidence.length>15||new Set(gap.requiredEvidence).size!==gap.requiredEvidence.length||!gap.requiredEvidence.includes('NATIVE_ID_KEY_SCOPE')||!gap.requiredEvidence.includes('NATIVE_RELATION_MAPPING'))throw invalid();
}

export type TypedItem={kind:'OBJECT';record:TypedRecord}|{kind:'LINK';link:TypedLink};
export interface TypedReadOk{kind:'OK';contractVersion:typeof typedReadContractVersion;consumerProfile:ConsumerProfileId;requestId:string;correlationId:string;asOf:string;snapshot:ReadSnapshot;items:TypedItem[];nextCursor:string|null;enumeration:'COMPLETE'|'PARTIAL'|'UNKNOWN';gaps:TypedGap[]}
export interface NativeSnapshotAcquireRequest{schema:typeof snapshotAcquireSchema;consumerProfile:ConsumerProfileId;requestId:string;scopeRef:NativeObjectRef;consistency:'SNAPSHOT'|'FAIL_ON_CHANGE';time:{mode:'CURRENT'}|{mode:'HISTORICAL';asOf:string};functionIntent:TypedFunctionRequest}
export interface NativeSnapshotAcquireResult{schema:typeof snapshotAcquireResultSchema;consumerProfile:ConsumerProfileId;requestId:string;snapshot:ReadSnapshot;snapshotAdmission:SnapshotAdmissionGrant;planBinding:string}
/** Private composition seam. No member is decoded from a request or exposed
 * through the frozen read view. The isolated helper supplies the independently
 * sealed, one-shot implementation; ordinary production composition omits it. */
export interface NativeQualificationHooks {
  afterDependencyWrite?:import('./nativePrerequisiteStore').DependencyWriterHook;
  outputBudgetExceeded?:(requestId:string,actualBytes:number,maxBytes:number)=>void;
  loginLifetime?():15|undefined;
  assertCurrent():void;
  beforeEncode(requestId:string):void;
  prepared<T>(request:ReadAdmission,commit:()=>Promise<T>):Promise<T>;
  pairedRequestId(requestId:string):string|null;
  gate(requestId:string,stage:'SHARED_OWNER'|'READ_KEY'|'PREPARED'|'TERMINAL',backendPid:number):Promise<void>;
  knownCommit(requestId:string,status:string):void;
  suppressAcknowledgement(requestId:string):boolean;
  handoff(requestId:string,status:number,bytes:number,authorized:boolean):'SEND'|'SUPPRESS';
  session(requestId:string,expiresAt:number):void;
}
export interface NativeTypedReadOptions{consumerProfile?:ConsumerProfileId;sourceSetSha256?:string;processEpoch?:string;registrySha256?:string;now?:()=>number;snapshotGrantVerifier?:(grant:SnapshotAdmissionGrant,request:TypedReadRequest,context?:TrustedTeacherContext)=>boolean;snapshotGrantSecret?:string;qualification?:NativeQualificationHooks;
 /** Trusted owner composition only, never decoded from public JSON. */
 cursorOwner?:NativeOwnerCursorLease;cursorInterfaceBinding?:string;cursorExpiryCap?:number;sessionExpiresAt?:number;
 cursorContext?:{readonly runId:string;readonly principalRef:NativeObjectRef;readonly authorityRef:NativeObjectRef;readonly recipientAdmissionRef:NativeObjectRef};
}
// Root-selected isolated qualification policy, not ingress/descriptor policy
// or caller JSON. Change only with an explicit policy/source admission.
export const nativeTypedReadOutputPolicy=Object.freeze({id:'p4-isolated-native-output-budget.v1',maxOutputBytes:1048576});
export interface BufferedTypedReadOutput{readonly body:Uint8Array<ArrayBuffer>|null;readonly status:number}
type PreparedTypedReadResult={value:TypedReadOk;output:BufferedTypedReadOutput}|{error:TypedReadRefusal;output:BufferedTypedReadOutput};
export interface NativeTypedRead{
  /** Short owner-lease preflight only; no admission, projection or egress. */
  verifyContinuation(context:TrustedTeacherContext,request:TypedReadRequest):Promise<void>;
  typedRead(context:TrustedTeacherContext,request:TypedReadRequest):Promise<TypedReadOk>;
  /** Trusted HTTP-owner handoff only; no new public route or wire DTO. */
  typedReadBuffered(context:TrustedTeacherContext,request:TypedReadRequest,currentAuthorization:()=>boolean):Promise<BufferedTypedReadOutput>;
  acquireSnapshot(context:TrustedTeacherContext,request:NativeSnapshotAcquireRequest):Promise<NativeSnapshotAcquireResult>;
}
function prepareTypedReadOutput(value:unknown,status:number,budgetCode:TypedReadErrorCode,onBudget?:(actualBytes:number)=>void):BufferedTypedReadOutput{
  try{
    const json=JSON.stringify(value);
    if(typeof json!=='string')throw Error('output_serialization');
    const actualBytes=Buffer.byteLength(json,'utf8');
    if(actualBytes>nativeTypedReadOutputPolicy.maxOutputBytes){onBudget?.(actualBytes);throw Error('output_budget');}
    const body=new TextEncoder().encode(json);
    if(body.byteLength>nativeTypedReadOutputPolicy.maxOutputBytes)throw Error('output_budget');
    return {body,status};
  }catch{throw new TypedReadRefusal(budgetCode,409,['OWNER_INTERFACE_RATIFICATION']);}
}
function typedReadError(requestId:string,error:TypedReadRefusal,consumerProfile:ConsumerProfileId){
  return {kind:'ERROR',contractVersion:typedReadContractVersion,consumerProfile,requestId,correlationId:requestId,error:{code:error.code,retryable:false,correlationId:requestId,requiredEvidence:error.requiredEvidence,readResolution:error.code==='READ_UNRESOLVED'?'UNRESOLVED_READ':'NOT_APPLICABLE'}};
}
/* function-selection/v2 (NG-FINAL-E5): digest over the complete validated
 * Function 2.0.0 request only, excluding only its requestId/cursor. An
 * outer native envelope is never part of the digest basis. */
export function functionSelectionDigest(request:TypedReadRequest):string{
  const fr=JSON.parse(canonicalJson(request.functionRequest)) as Record<string,unknown>;
  const complete:Record<string,unknown>=fr;
  delete complete.requestId;
  delete complete.cursor;
  return digest({domain:'function-selection/v2',...complete});
}
export function functionIntentDigest(intent:TypedFunctionRequest|TypedCompleteFunctionRequest,consumerProfile:ConsumerProfileId='CURRENT_1_1',sourceSetSha256?:string):string{
  const clone=JSON.parse(canonicalJson(intent)) as Record<string,unknown>;
  delete clone.requestId;delete clone.snapshot;delete clone.asOf;delete clone.cursor;
  return digest({domain:'function-intent/v2',request:clone,...profileBinding(consumerProfile,sourceSetSha256)});
}
export function profileBinding(consumerProfile:ConsumerProfileId,sourceSetSha256?:string){
 const profile=fixedConsumerProfile(consumerProfile);
 return {consumerProfile,consumerProfileDigest:profile.pins.consumerProfileDigest,registrySha256:profile.definition.registry.sha256,functionSha256:profile.definition.function.sha256,querySha256:profile.definition.query.sha256,compilerContractSha256:selectedProtocolClosure.selectedManifest.sha256,sourceSetSha256:sourceSetSha256??null};
}
export function planBindingFor(intent:TypedFunctionRequest|TypedCompleteFunctionRequest,registrySha256?:string,processEpoch?:string,consumerProfile:ConsumerProfileId='CURRENT_1_1',sourceSetSha256?:string):string{
 return digest({domain:'native-read-plan/v2',functionIntentDigest:functionIntentDigest(intent,consumerProfile,sourceSetSha256),registeredPlanId:intent.functionName==='GetStudentDailyContext'?'P4_GET_STUDENT_SECTION_PROFILE_V1':intent.selector,processEpoch:processEpoch??null,...profileBinding(consumerProfile,sourceSetSha256)});
}
export function nativeRequestDigest(request:TypedReadRequest):string{
 const clone=JSON.parse(canonicalJson(request));delete clone.requestId;delete clone.cursor;
 if(clone.selector.kind==='REGISTERED_QUERY')delete clone.selector.query.page.cursor;
 delete clone.functionRequest.requestId;delete clone.functionRequest.cursor;
 return digest({domain:'native-read-request/v4',...clone});
}
interface SnapshotGrantPayload{grantId:string;snapshot:ReadSnapshot;planBinding:string;ownerId:string;actorId:string;scopeRef:NativeObjectRef;registrySha256:string|null;processEpoch:string|null;expiresAt:string;profileBinding:ReturnType<typeof profileBinding>}
function sealSnapshotGrant(secret:string,payload:SnapshotGrantPayload):string{
  const body=Buffer.from(canonicalJson(payload),'utf8').toString('base64url');
  return body+'.'+createHmac('sha256',secret).update(body).digest('base64url');
}
function openSnapshotGrant(secret:string,proof:string):SnapshotGrantPayload|null{
  if(typeof proof!=='string'||proof.length>8192||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(proof))return null;
  const [body,signature]=proof.split('.');
  const expected=createHmac('sha256',secret).update(body!).digest();
  let given:Buffer;
  try{given=Buffer.from(signature!,'base64url');}catch{return null;}
  if(given.toString('base64url')!==signature||given.length!==expected.length||!timingSafeEqual(given,expected))return null;
  try{
    const decoded=Buffer.from(body!,'base64url');
    if(decoded.toString('base64url')!==body)return null;
    const value=JSON.parse(decoded.toString('utf8')) as SnapshotGrantPayload;
    if(canonicalJson(value)!==decoded.toString('utf8'))return null;
    const keys=['grantId','snapshot','planBinding','ownerId','actorId','scopeRef','registrySha256','processEpoch','expiresAt','profileBinding'];
    if(Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))return null;
    return value;
  }catch{return null;}
}
/** Real stateless verifier sealed only with the existing server session key. */
export function createSnapshotGrantVerifier(secret:string,expected:{ownerId:string;processEpoch?:string;registrySha256?:string;consumerProfile?:ConsumerProfileId;sourceSetSha256?:string}):(grant:SnapshotAdmissionGrant,request:TypedReadRequest,context?:TrustedTeacherContext)=>boolean{
  return (grant,request,context)=>{
    if(!secret)return false;
    const payload=openSnapshotGrant(secret,grant.proof);
    if(!payload)return false;
    if(payload.grantId!==grant.grantId||payload.expiresAt!==grant.expiresAt)return false;
    if(payload.ownerId!==expected.ownerId)return false;
    if(canonicalJson(payload.profileBinding)!==canonicalJson(profileBinding(expected.consumerProfile??'CURRENT_1_1',expected.sourceSetSha256))||request.consumerProfile!==(expected.consumerProfile??'CURRENT_1_1'))return false;
    if(payload.registrySha256!==(expected.registrySha256??null)||payload.processEpoch!==(expected.processEpoch??null))return false;
    if(canonicalJson(payload.snapshot)!==canonicalJson(request.snapshot))return false;
    if(canonicalJson(payload.scopeRef)!==canonicalJson(request.scopeRef))return false;
    if(payload.planBinding!==planBindingFor(request.functionRequest,expected.registrySha256,expected.processEpoch,expected.consumerProfile??'CURRENT_1_1',expected.sourceSetSha256))return false;
    if(context&&payload.actorId!==context.actorId)return false;
    return true;
  };
}

/** Half-open native interval [from,to) -> inclusive registry projection. */
export function projectLinkInterval(validFrom:string,validTo:string|null,evidence:EvidenceRef[]):{validFrom:string;validThrough:Knowledge<string>}{
  try{return projectInterval(validFrom,validTo,evidence);}
  catch(error){if(error instanceof Error&&error.message==='invalid_interval')throw unverifiable(['NATIVE_RELATION_MAPPING']);throw error;}
}
function unknownKnowledge<T>(reason:string,requiredEvidence:string[],evidence:EvidenceRef[]=[]):Knowledge<T>{
  return {state:'unknown',reason:reason as Knowledge<T> extends {reason:infer R}?R:never,evidence,requiredEvidence:requiredEvidence as never};
}
function refOf(record:TypedRecord):ObjectRef{return {identity:record.identity,revision:record.revision};}
function compareText(a:string,b:string):number{return a<b?-1:a>b?1:0;}
type Identity=ObjectRef['identity'];
/** EducationIdentity equality requires all four fields, scopeRef included. */
function identityKey(identity:Identity):string{return canonicalJson([identity.scopeRef,identity.namespace,identity.objectType,identity.nativeKey]);}
function identityEqual(a:Identity,b:Identity):boolean{return identityKey(a)===identityKey(b);}
function isRecord(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value);}
const propertyAliases=['$identity','$scope','$student','$class','$lesson','$businessDate'] as const;

export class NativeTypedReadService implements NativeTypedRead{
  private readonly pages=new WeakMap<TypedReadOk,{end:number;total:number}>();
  private readonly cursorOptions:Pick<NativeTypedReadOptions,'cursorOwner'|'cursorInterfaceBinding'|'cursorExpiryCap'|'sessionExpiresAt'|'cursorContext'>;
  private readonly qualification:NativeQualificationHooks|undefined;
  readonly consumerProfile:ConsumerProfileId;private readonly sourceSetSha256:string|undefined;private readonly fixedProfile:ReturnType<typeof fixedConsumerProfile>;
  private readonly processEpoch:string|undefined;private readonly registrySha256:string|undefined;private readonly now:()=>number;private readonly snapshotGrantVerifier:NativeTypedReadOptions['snapshotGrantVerifier'];private readonly snapshotGrantSecret:string|undefined;
  constructor(private readonly store:TeacherPrerequisiteStore,readonly ownerId:string,options:NativeTypedReadOptions={}){
    this.cursorOptions=options;
    this.qualification=options.qualification;
    this.consumerProfile=options.consumerProfile??'CURRENT_1_1';this.fixedProfile=fixedConsumerProfile(this.consumerProfile);this.sourceSetSha256=options.sourceSetSha256;
    this.processEpoch=options.processEpoch;this.registrySha256=options.registrySha256;
    this.now=options.now??(()=>Date.now());
    this.snapshotGrantSecret=options.snapshotGrantSecret;
    this.snapshotGrantVerifier=options.snapshotGrantVerifier??(options.snapshotGrantSecret?createSnapshotGrantVerifier(options.snapshotGrantSecret,{ownerId,processEpoch:options.processEpoch,registrySha256:options.registrySha256,consumerProfile:this.consumerProfile,sourceSetSha256:this.sourceSetSha256}):undefined);
  }
  private prepareOutput(value:unknown,status:number):BufferedTypedReadOutput{
    return prepareTypedReadOutput(value,status,this.cursorOptions.cursorOwner?'CONTRACT_UNVERIFIABLE':'OUTPUT_ADMISSION_BLOCKED',actualBytes=>{
      if(value&&typeof value==='object'&&'requestId' in value&&typeof value.requestId==='string')this.qualification?.outputBudgetExceeded?.(value.requestId,actualBytes,nativeTypedReadOutputPolicy.maxOutputBytes);
    });
  }
  private get bindingsQualified():boolean{return typeof this.processEpoch==='string'&&this.processEpoch.length>0&&typeof this.registrySha256==='string'&&sha256Pattern.test(this.registrySha256)&&this.registrySha256===this.fixedProfile.definition.registry.sha256;}
  private assertProfile(profile:ConsumerProfileId):void{if(profile!=='CURRENT_1_1'&&profile!=='OLD_SECTION_1_0')throw invalid();if(profile!==this.consumerProfile)throw staleGrant();}
  private typeVersion(type:EducationType):string{return this.fixedProfile.pins.objects.find(binding=>binding.symbol===type)!.version;}
  private linkVersion(type:TypedLinkType):string{return type==='sectionInUnit'?this.fixedProfile.definition.carriage.sectionInUnit:linkVersions[type];}
  private requestDigest(request:TypedReadRequest):string{
    return nativeRequestDigest(request);
  }
  private cursorBindings(context:TrustedTeacherContext,request:TypedReadRequest){
    const trusted=this.cursorOptions.cursorContext;if(!trusted)throw unverifiable();
    requireText(trusted.runId,'run');for(const ref of [trusted.principalRef,trusted.authorityRef,trusted.recipientAdmissionRef])validateNativeRef(ref);
    const scopeBinding=digest({domain:'native-read-scope/v1',ownerId:context.ownerId,runId:trusted.runId,scopeRef:request.scopeRef});
    const principalBinding=digest({domain:'native-read-principal/v1',ownerId:context.ownerId,actorId:context.actorId,principalRef:trusted.principalRef,authorityRef:trusted.authorityRef});
    const recipientBinding=digest({domain:'native-read-recipient/v1',recipientAdmissionRef:trusted.recipientAdmissionRef,scopeRef:request.scopeRef});
    return {scopeBinding,principalBinding,recipientBinding};
  }
  private selectorDigest(request:TypedReadRequest):string{
    const selector=structuredClone(request.selector);if(selector.kind==='REGISTERED_QUERY')delete (selector.query.page as {cursor?:string|null}).cursor;
    return digest({selector,linkMask:request.linkMask});
  }
  private cursorCap(request:TypedReadRequest,previous?:NativeOwnerCursorBinding):number{
    const ownerCap=this.cursorOptions.cursorExpiryCap,session=this.cursorOptions.sessionExpiresAt;
    if(!Number.isFinite(ownerCap)||!Number.isFinite(session))throw unverifiable();
    // The authentic original grant's asOf/expiry cannot be extended by a new
    // login or by issuing a successor. Unknown owner deadlines block issue.
    const deadlines=[ownerCap!,session!,Date.parse(request.snapshotAdmission.expiresAt),Date.parse(request.snapshot.asOf)+3600000];
    if(previous)deadlines.push(Date.parse(previous.expiresAt));const cap=Math.min(...deadlines);
    if(!Number.isFinite(cap)||cap<=this.now())throw staleGrant();return cap;
  }
  private async openCursor(view:TeacherPrerequisiteReadStore,context:TrustedTeacherContext,request:TypedReadRequest):Promise<NativeOwnerCursorBinding|undefined>{
    if(request.cursor===null)return undefined;
    await this.assertCurrentBinding(view,context,request.temporalSelection.businessDate);
    const owner=this.cursorOptions.cursorOwner;if(!owner||!this.cursorOptions.cursorInterfaceBinding)throw unverifiable();
    let token:NativeOwnerCursorBinding;try{token=owner.open(request.cursor);}catch{throw staleGrant();}
    const bounds=this.cursorBindings(context,request);
    if(token.principalBinding!==bounds.principalBinding||token.scopeBinding!==bounds.scopeBinding||token.recipientBinding!==bounds.recipientBinding)throw denied();
    if(token.requestDigest!==this.requestDigest(request)||token.registrySha256!==this.registrySha256||token.interfaceBinding!==this.cursorOptions.cursorInterfaceBinding||token.consumerProfile!==this.consumerProfile||token.consumerProfileDigest!==this.fixedProfile.pins.consumerProfileDigest||token.pageSize!==request.pageSize||token.readRevision!==request.snapshot.readRevision||token.policyRevision!==request.snapshot.policyRevision||token.asOf!==request.asOf)throw staleGrant();
    this.cursorCap(request,token);
    const predecessor:ReadAdmission={ownerId:context.ownerId,actorId:context.actorId,requestId:token.readAdmissionId,runId:this.cursorOptions.cursorContext!.runId,requestDigest:this.requestDigest(request),selectorDigest:this.selectorDigest(request),processEpoch:this.processEpoch!,registryContractVersion:this.fixedProfile.definition.registry.version,consumerProfile:this.consumerProfile,consumerProfileDigest:this.fixedProfile.pins.consumerProfileDigest};
    let found;try{found=await view.readOccurrenceLookup(predecessor);}catch{throw staleGrant();}
    if(found.status==='PENDING'||found.status==='UNKNOWN')throw new TypedReadRefusal('READ_UNRESOLVED',503);
    if(found.status!=='COMPLETED'||found.snapshotDigest!==digest(request.snapshot)||canonicalJson(found.request)!==canonicalJson(predecessor))throw staleGrant();
    return token;
  }
  private sealNext(context:TrustedTeacherContext,request:TypedReadRequest,value:TypedReadOk,previous?:NativeOwnerCursorBinding):void{
    const position=this.pages.get(value);if(!position||position.end>=position.total)return;
    const owner=this.cursorOptions.cursorOwner,binding=this.cursorOptions.cursorInterfaceBinding;
    if(!owner||!binding||!sha256Pattern.test(binding)||this.consumerProfile==='OLD_SECTION_1_0')throw unverifiable();
    const token:NativeOwnerCursorBinding={domain:cursorDomain,requestDigest:this.requestDigest(request),...this.cursorBindings(context,request),registrySha256:this.registrySha256!,readRevision:request.snapshot.readRevision,policyRevision:request.snapshot.policyRevision,asOf:request.asOf,interfaceBinding:binding,readAdmissionId:request.requestId,outputAdmissionId:request.requestId,pageSize:request.pageSize,sealedPosition:String(position.end),expiresAt:new Date(this.cursorCap(request,previous)).toISOString(),integrityProofHandle:'academy-native-owner-aes256gcm/v1',consumerProfile:this.consumerProfile,consumerProfileDigest:this.fixedProfile.pins.consumerProfileDigest};
    try{value.nextCursor=owner.seal(token);}catch{throw unverifiable();}
  }
  private mapError(error:unknown):TypedReadRefusal{
    if(error instanceof TypedReadRefusal)return error;
    const code=error instanceof Error?error.message:'';
    if(code==='teacher_binding_required'||code==='teacher_binding_inactive')return denied();
    if(code==='read_occurrence_already_admitted'||code==='read_request_binding_conflict'||code==='read_already_terminal_or_unadmitted')return new TypedReadRefusal('READ_UNRESOLVED',503);
    if(code==='read_snapshot_closed')return new TypedReadRefusal('SNAPSHOT_UNAVAILABLE',409,['NATIVE_REVISION_SNAPSHOT']);
    return unverifiable();
  }
  async typedRead(context:TrustedTeacherContext,request:TypedReadRequest):Promise<TypedReadOk>{
    const prepared=await this.readPrepared(context,request);
    if('error' in prepared)throw prepared.error;
    return prepared.value;
  }
  async verifyContinuation(context:TrustedTeacherContext,request:TypedReadRequest):Promise<void>{
    try{assertTeacherScope(this.ownerId,context);}catch{throw denied();}
    await this.store.readSnapshot(async view=>{
      await this.assertCurrentBinding(view,context,typeof request?.temporalSelection?.businessDate==='string'?request.temporalSelection.businessDate:'');
      const validated=this.validateRequest(request,context);await this.openCursor(view,context,validated);
    });
  }
  async typedReadBuffered(context:TrustedTeacherContext,request:TypedReadRequest,currentAuthorization:()=>boolean):Promise<BufferedTypedReadOutput>{
    return (await this.readPrepared(context,request,currentAuthorization)).output;
  }
  private async readPrepared(context:TrustedTeacherContext,request:TypedReadRequest,currentAuthorization?:()=>boolean):Promise<PreparedTypedReadResult>{
    try{assertTeacherScope(this.ownerId,context);}catch{throw denied();}
    if(request?.scopeRef?.basis?.scope?.ownerNamespace&&request.scopeRef.basis.scope.ownerNamespace!==context.ownerId)throw denied();
    let validated:TypedReadRequest;
    try{validated=this.validateRequest(request,context);}catch(error){
      // Decode failures confer no data access. Current rights still select the emitted refusal.
      await this.store.readSnapshot(view=>this.assertCurrentBinding(view,context,typeof request?.temporalSelection?.businessDate==='string'?request.temporalSelection.businessDate:''));throw error;
    }
    if(!this.bindingsQualified)throw unverifiable(['OWNER_INTERFACE_RATIFICATION']);
    const initialCursor=validated.cursor===null?undefined:await this.store.readSnapshot(view=>this.openCursor(view,context,validated));
    // W12-F1/C4: COMPLETED is an owner-only witness. The service never
    // finalizes COMPLETED (or any terminal state) through the ordinary
    // finalizeReadOccurrence transport; commitReadOutput is the sole
    // terminal writer and no value egresses before its COMMIT resolves.
    if(typeof this.store.commitReadOutput!=='function')throw unverifiable(['OWNER_INTERFACE_RATIFICATION']);
    const admission:ReadAdmission={ownerId:context.ownerId,actorId:context.actorId,requestId:validated.requestId,runId:this.cursorOptions.cursorContext?.runId??validated.requestId,requestDigest:this.requestDigest(validated),selectorDigest:this.selectorDigest(validated),processEpoch:this.processEpoch!,registryContractVersion:this.fixedProfile.definition.registry.version,consumerProfile:this.consumerProfile,consumerProfileDigest:this.fixedProfile.pins.consumerProfileDigest};
    try{await this.store.admitReadOccurrence(admission);}catch(error){throw this.mapError(error);}
    // Preparatory projection in the snapshot view; it authorizes nothing.
    let prepared:{ok:true;value:TypedReadOk;horizon:ReadHorizonExpectation;attemptRefs:ObjectRef[]}|{ok:false;error:TypedReadRefusal};
    try{
      prepared=await this.store.readSnapshot(async view=>{
        const value=await this.projectPage(view,context,validated,initialCursor);
        const attemptRefs=this.attemptRefsForHorizon(validated,value);
        let horizon:ReadHorizonExpectation;
        try{horizon=await computeReadHorizon(view,context.ownerId,context.actorId,validated.temporalSelection.businessDate,attemptRefs,horizonPlan(validated.functionRequest,this.consumerProfile));}
        catch{throw unverifiable(['OWNER_INTERFACE_RATIFICATION']);}
        this.assertAcquiredHorizon(validated,horizon);
        return {ok:true as const,value,horizon,attemptRefs};
      });
    }
    catch(error){prepared={ok:false,error:this.mapError(error)};}
    const prep=prepared;
    let captured:TypedReadRefusal|null=prep.ok?null:prep.error;
    let output:BufferedTypedReadOutput|null=null,refusedOutput:BufferedTypedReadOutput|null=null,expiryOutput:BufferedTypedReadOutput|null=null;
    const refuse=(error:TypedReadRefusal)=>{
      // The auth lease does not stop expiry during awaited final evaluation
      // or encoding. Select current session denial before terminal audit,
      // including when encoding the earlier refusal crossed that boundary.
      let selected=currentAuthorization&&!currentAuthorization()?new TypedReadRefusal('PERMISSION_DENIED',401):error;
      output=null;
      const encode=()=>{
        try{refusedOutput=this.prepareOutput(typedReadError(validated.requestId,selected,this.consumerProfile),selected.httpStatus);}
        catch{refusedOutput=null;} // No unbounded/error reserialization after COMMIT.
      };
      encode();
      if(currentAuthorization&&!currentAuthorization()&&selected.httpStatus!==401){
        selected=new TypedReadRefusal('PERMISSION_DENIED',401);
        encode();
      }
      captured=selected;
      return {kind:'OUTPUT_REFUSED' as const,code:selected.code};
    };
    let committed;
    try{
      const prepare=async(view:TeacherPrerequisiteReadStore)=>{
        try{
          if(currentAuthorization&&!currentAuthorization())return refuse(new TypedReadRefusal('PERMISSION_DENIED',401));
          // Final gate: reauthorize and recompute the complete horizon and
          // page under the gate view; any drift refuses without the old page.
          await this.assertCurrentBinding(view,context,validated.temporalSelection.businessDate);
          const finalCursor=await this.openCursor(view,context,validated);
          const finalValue=await this.projectPage(view,context,validated,finalCursor);
          // A failed preparatory read grants no shortcut around current
          // binding/full-page policy checks. Select the current denial first,
          // then encode any remaining preparatory error before terminal audit.
          if(!prep.ok)return refuse(prep.error);
          if(canonicalJson(finalValue)!==canonicalJson(prep.value)){
            captured=new TypedReadRefusal('OBJECTSET_CURSOR_STALE',409,['OWNER_INTERFACE_RATIFICATION']);
            return refuse(captured);
          }
          let finalHorizon:ReadHorizonExpectation;
          try{finalHorizon=await computeReadHorizon(view,context.ownerId,context.actorId,validated.temporalSelection.businessDate,prep.attemptRefs,horizonPlan(validated.functionRequest,this.consumerProfile));}
          catch{return refuse(unverifiable(['OWNER_INTERFACE_RATIFICATION']));}
          if(canonicalJson(finalHorizon)!==canonicalJson(prep.horizon)){
            captured=new TypedReadRefusal('OBJECTSET_CURSOR_STALE',409,['OWNER_INTERFACE_RATIFICATION']);
            return refuse(captured);
          }
          try{this.assertAcquiredHorizon(validated,finalHorizon);}
          catch(error){return refuse(error as TypedReadRefusal);}
          // Both fences still held: prepare final wire bytes and the generic
          // owner-gate refusal before the store can write a terminal audit.
          refusedOutput=this.prepareOutput(typedReadError(validated.requestId,unverifiable(['OWNER_INTERFACE_RATIFICATION']),this.consumerProfile),409);
          expiryOutput=this.prepareOutput(typedReadError(validated.requestId,staleGrant(),this.consumerProfile),409);
          this.qualification?.beforeEncode(validated.requestId);
          this.sealNext(context,validated,finalValue,finalCursor);
          output=this.prepareOutput(finalValue,200);
          if(currentAuthorization&&!currentAuthorization())return refuse(new TypedReadRefusal('PERMISSION_DENIED',401));
          return {kind:'OUTPUT_READY' as const,value:finalValue,horizon:prep.horizon};
        }catch(error){return refuse(this.mapError(error));}
      };
      const selectRefusal:ReadOutputRefusalSelector=async(view,code)=>{
        // The actual owner can select a new refusal after our successful
        // callback, or after rollback in a fresh ordered cleanup transaction.
        // Reauthorize there; neither the old view nor its prepared fallback
        // is authority for this new terminal decision.
        let selected=captured?.code===code?captured:code==='output_rights_refused'?denied():unverifiable(['OWNER_INTERFACE_RATIFICATION']);
        try{
          if(currentAuthorization&&!currentAuthorization())return refuse(new TypedReadRefusal('PERMISSION_DENIED',401));
          await this.assertCurrentBinding(view,context,validated.temporalSelection.businessDate);
          await this.projectPage(view,context,validated);
          if(prep.ok){
            const current=await computeReadHorizon(view,context.ownerId,context.actorId,validated.temporalSelection.businessDate,prep.attemptRefs,horizonPlan(validated.functionRequest,this.consumerProfile));
            this.assertAcquiredHorizon(validated,current);
            if(canonicalJson(current)!==canonicalJson(prep.horizon))selected=new TypedReadRefusal('OBJECTSET_CURSOR_STALE',409,['OWNER_INTERFACE_RATIFICATION']);
          }
        }catch(error){
          const current=this.mapError(error);
          // Fresh cleanup can discover an explicit object/version mismatch
          // after successful preparation; keep its typed refusal with the
          // current denial and whole-plan mappings, not the generic fallback.
          if(current.httpStatus===401||current.httpStatus===403||current.code==='OBJECTSET_CURSOR_STALE'||current.code==='REVISION_STALE')selected=current;
        }
        return refuse(selected);
      };
      // The captured capability is the actual final projection/authorization
      // callback above, bound to this genuine admission and lease. It is never
      // returned to callers, placed on a read view, or reconstructed from JSON.
      const commit=()=>this.store.commitReadOutput!(admission,prepare,selectRefusal);
      committed=this.qualification?await this.qualification.prepared(admission,commit):await commit();
    }catch{
      // Admission already exists and the owner gate was called: a lost
      // acknowledgement cannot prove refusal or authorize another finalize.
      output=null;refusedOutput=null;
      throw new TypedReadRefusal('READ_UNRESOLVED',503,['OWNER_INTERFACE_RATIFICATION']);
    }
    if(committed.terminalStatus==='COMPLETED'&&committed.value!==null&&committed.value!==undefined&&output!==null){
      // Synchronous known-COMMIT handoff: keep COMPLETED, discard business
      // bytes on expiry; use only the refusal already encoded under fences.
      const caps=[Date.parse(validated.snapshotAdmission.expiresAt)];
      if(this.cursorOptions.cursorExpiryCap!==undefined)caps.push(this.cursorOptions.cursorExpiryCap);
      if(initialCursor)caps.push(Date.parse(initialCursor.expiresAt));
      if(caps.some(cap=>!Number.isFinite(cap)||this.now()>=cap))return {error:staleGrant(),output:expiryOutput??{body:null,status:409}};
      return {value:committed.value,output};
    }
    output=null;
    if(committed.terminalStatus==='REFUSED')return {error:captured??unverifiable(['OWNER_INTERFACE_RATIFICATION']),output:refusedOutput??{body:null,status:503}};
    // Uncertain commit: discard the buffer, preserve the occurrence, no
    // second finalization or replay (adopted READ_UNRESOLVED mapping).
    refusedOutput=null;
    throw new TypedReadRefusal('READ_UNRESOLVED',503,['OWNER_INTERFACE_RATIFICATION']);
  }
  private attemptRefsForHorizon(request:TypedReadRequest,value:TypedReadOk):ObjectRef[]{
    const refs:ObjectRef[]=[];
    const add=(ref:ObjectRef|null|undefined)=>{if(ref&&ref.identity.objectType==='DailyTestAttempt')refs.push(ref);};
    for(const ref of request.expectedRevisions)add(ref);
    if(request.selector.kind==='EXACT_OBJECT')add(request.selector.objectRef);
    for(const item of value.items){
      if(item.kind!=='OBJECT')continue;
      const attempts=item.record.attemptRefs as Knowledge<ObjectRef[]>|undefined;
      if(attempts?.state==='known')for(const ref of attempts.value)add(ref);
    }
    const seen=new Set<string>();
    return refs.filter(ref=>{const key=identityKey(ref.identity);if(seen.has(key))return false;seen.add(key);return true;});
  }
  async acquireSnapshot(context:TrustedTeacherContext,request:NativeSnapshotAcquireRequest):Promise<NativeSnapshotAcquireResult>{
    try{assertTeacherScope(this.ownerId,context);}catch{throw denied();}
    if(request?.scopeRef?.basis?.scope?.ownerNamespace&&request.scopeRef.basis.scope.ownerNamespace!==context.ownerId)throw denied();
    let intent:TypedFunctionRequest;
    try{intent=this.validateAcquireRequest(request,context);}catch(error){await this.store.readSnapshot(view=>this.assertCurrentBinding(view,context,typeof request?.functionIntent?.businessDate==='string'?request.functionIntent.businessDate:''));throw error;}
    if(!this.bindingsQualified)throw unverifiable(['OWNER_INTERFACE_RATIFICATION']);
    if(!this.snapshotGrantSecret)throw unverifiable(['OWNER_INTERFACE_RATIFICATION']);
    try{
      return await this.store.readSnapshot(async view=>{
        await this.assertCurrentBinding(view,context,intent.businessDate);
        if(this.consumerProfile==='OLD_SECTION_1_0'&&(intent.functionName!=='GetStudentDailyContext'||intent.pageSize!==100||intent.occurrence.mode!=='EXACT'))throw unverifiable();
        if(request.time.mode==='HISTORICAL')throw new TypedReadRefusal('SNAPSHOT_UNAVAILABLE',409,['NATIVE_REVISION_SNAPSHOT']);
        const planBinding=planBindingFor(intent,this.registrySha256,this.processEpoch,this.consumerProfile,this.sourceSetSha256);
        const attemptRefs=intent.expectedRevisions.filter(ref=>ref.identity.objectType==='DailyTestAttempt');
        let horizon:ReadHorizonExpectation;
        try{horizon=await computeReadHorizon(view,context.ownerId,context.actorId,intent.businessDate,attemptRefs,horizonPlan(intent,this.consumerProfile));}
        catch{throw unverifiable(['OWNER_INTERFACE_RATIFICATION']);}
        const asOf=new Date(this.now()).toISOString();
        const readRevision='read:'+digest({domain:'native-read-horizon/v3',planBinding,horizon,...profileBinding(this.consumerProfile,this.sourceSetSha256)});
        const policyRevision='policy:'+digest({domain:'native-read-policy/v3',planBinding,processEpoch:this.processEpoch??null,bindingRevision:horizon.bindingRevision,...profileBinding(this.consumerProfile,this.sourceSetSha256)});
        const snapshot:ReadSnapshot={registryVersion:this.fixedProfile.definition.registry.version,readRevision,asOf,policyRevision,consistency:request.consistency};
        const expiry=this.cursorOptions.sessionExpiresAt===undefined?this.now()+900_000:Math.min(this.now()+900_000,this.cursorOptions.sessionExpiresAt);
        const expiresAt=new Date(expiry).toISOString();
        const grantId=crypto.randomUUID();
        const payload:SnapshotGrantPayload={grantId,snapshot,planBinding,ownerId:context.ownerId,actorId:context.actorId,scopeRef:request.scopeRef,registrySha256:this.registrySha256??null,processEpoch:this.processEpoch??null,expiresAt,profileBinding:profileBinding(this.consumerProfile,this.sourceSetSha256)};
        const proof=sealSnapshotGrant(this.snapshotGrantSecret!,payload);
        return {schema:snapshotAcquireResultSchema,consumerProfile:this.consumerProfile,requestId:request.requestId,snapshot,snapshotAdmission:{grantId,proof,expiresAt},planBinding};
      });
    }catch(error){throw this.mapError(error);}
  }
  private validateAcquireRequest(request:NativeSnapshotAcquireRequest,context:TrustedTeacherContext):TypedFunctionRequest{
    try{return this.validateAcquireRequestCore(request,context);}
    catch(error){
      if(error instanceof TypedReadRefusal)throw error;
      if(error instanceof Error&&error.message==='registry_version')throw unverifiable();
      throw invalid();
    }
  }
  private validateAcquireRequestCore(request:NativeSnapshotAcquireRequest,context:TrustedTeacherContext):TypedFunctionRequest{
    if(!request||typeof request!=='object'||Array.isArray(request))throw invalid();
    assertExactKeys(request,['schema','consumerProfile','requestId','scopeRef','consistency','time','functionIntent']);
    if(request.schema!==snapshotAcquireSchema)throw invalid();this.assertProfile(request.consumerProfile);
    requireText(request.requestId,'request');validateNativeRef(request.scopeRef);
    if(request.scopeRef.basis.scope.ownerNamespace!==context.ownerId)throw denied();
    if(request.consistency!=='SNAPSHOT'&&request.consistency!=='FAIL_ON_CHANGE')throw invalid();
    if(!isRecord(request.time))throw invalid();
    if(request.time.mode==='CURRENT')assertExactKeys(request.time,['mode']);
    else if(request.time.mode==='HISTORICAL'){assertExactKeys(request.time,['mode','asOf']);assertInstant(request.time.asOf);}
    else throw invalid();
    const intent=request.functionIntent;
    if(!isRecord(intent))throw invalid();
    if(intent.contractVersion!=='2.0.0'||intent.functionVersion!=='2.0.0')throw invalid();
    const common=['contractVersion','functionVersion','scopeRef','classGroupRef','businessDate','expectedRevisions','functionName','selector'];
    if(intent.functionName==='GetStudentDailyContext')assertExactKeys(intent,[...common,'pageSize','studentRef','occurrence']);
    else if(intent.functionName==='ListClassDailyStatus')assertExactKeys(intent,[...common,'pageSize','occurrence']);
    else if(intent.functionName==='CheckDailyRecordCompleteness')assertExactKeys(intent,[...common,'studentRef','occurrence','draftRef','profile']);
    else throw invalid();
    const expectedSelector=intent.functionName==='GetStudentDailyContext'?'STUDENT_OCCURRENCE_CONTEXT_V1':intent.functionName==='ListClassDailyStatus'?'CLASS_OCCURRENCE_STATUS_V1':'DRAFT_COMPLETENESS_V1';
    if((intent as {selector:string}).selector!==expectedSelector)throw invalid();
    if(canonicalJson(intent.scopeRef)!==canonicalJson(request.scopeRef))throw invalid();
    const scopeRequest={scopeRef:request.scopeRef} as TypedReadRequest;
    validateObjectRef(intent.classGroupRef,['ClassGroup']);this.assertQualifiedScope(intent.classGroupRef,scopeRequest,context);
    assertDate(intent.businessDate);
    if(!Array.isArray(intent.expectedRevisions))throw invalid();
    const seenExpected=new Map<string,string>();
    for(const ref of intent.expectedRevisions){
      validateObjectRef(ref);this.assertQualifiedScope(ref,scopeRequest,context);
      const key=identityKey(ref.identity),prior=seenExpected.get(key);
      if(prior!==undefined&&prior!==ref.revision)throw staleRevision();
      seenExpected.set(key,ref.revision);
    }
    if(intent.functionName!=='CheckDailyRecordCompleteness'){
      const pageSize=(intent as {pageSize:number}).pageSize;
      if(!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>100)throw invalid();
    }else if((intent as {profile:string}).profile!=='DAILY_RECORD_OCCURRENCE_V1')throw invalid();
    if(!isRecord(intent.occurrence))throw invalid();
    if(intent.occurrence.mode==='EXACT'){
      assertExactKeys(intent.occurrence,['mode','lessonRef']);
      validateObjectRef((intent.occurrence as {lessonRef:ObjectRef}).lessonRef,['LessonSession']);
      this.assertQualifiedScope((intent.occurrence as {lessonRef:ObjectRef}).lessonRef,scopeRequest,context);
    }else if(intent.occurrence.mode==='ENUMERATE_SEPARATELY'){
      assertExactKeys(intent.occurrence,['mode']);
      if(intent.functionName!=='ListClassDailyStatus')throw invalid();
    }else throw invalid();
    if(intent.functionName==='GetStudentDailyContext'){
      validateObjectRef((intent as {studentRef:ObjectRef}).studentRef,['Student']);
      this.assertQualifiedScope((intent as {studentRef:ObjectRef}).studentRef,scopeRequest,context);
      if(intent.occurrence.mode!=='EXACT')throw invalid();
    }
    if(intent.functionName==='CheckDailyRecordCompleteness'){
      validateObjectRef((intent as {studentRef:ObjectRef}).studentRef,['Student']);
      this.assertQualifiedScope((intent as {studentRef:ObjectRef}).studentRef,scopeRequest,context);
      validateObjectRef((intent as {draftRef:ObjectRef}).draftRef,['DailyRecordDraft']);
      this.assertQualifiedScope((intent as {draftRef:ObjectRef}).draftRef,scopeRequest,context);
      if(intent.occurrence.mode!=='EXACT')throw invalid();
    }
    return intent as TypedFunctionRequest;
  }
  /* NG-FINAL-E1-ACQUIRED-HORIZON: a sealed acquired snapshot is bound to
   * the horizon actually prepared/finally gated. Only a grant proof that
   * opens under the existing owner secret is an acquired snapshot; any
   * read/policy drift refuses stale with no page/cursor/value egress.
   * SNAPSHOT mode therefore never serves drifted current data under the
   * acquired revision: it delivers only an undrifted pinned horizon or
   * refuses, in both consistency modes. */
  private assertAcquiredHorizon(request:TypedReadRequest,horizon:ReadHorizonExpectation):void{
    if(!this.snapshotGrantSecret)return;
    const payload=openSnapshotGrant(this.snapshotGrantSecret,request.snapshotAdmission.proof);
    if(!payload)return;
    const planBinding=planBindingFor(request.functionRequest,this.registrySha256,this.processEpoch,this.consumerProfile,this.sourceSetSha256);
    if(payload.planBinding!==planBinding)throw staleGrant();
    const readRevision='read:'+digest({domain:'native-read-horizon/v3',planBinding,horizon,...profileBinding(this.consumerProfile,this.sourceSetSha256)});
    const policyRevision='policy:'+digest({domain:'native-read-policy/v3',planBinding,processEpoch:this.processEpoch??null,bindingRevision:horizon.bindingRevision,...profileBinding(this.consumerProfile,this.sourceSetSha256)});
    if(request.snapshot.readRevision!==readRevision||request.snapshot.policyRevision!==policyRevision)throw staleGrant();
  }
  private async assertCurrentBinding(view:TeacherPrerequisiteReadStore,context:TrustedTeacherContext,businessDate:string):Promise<void>{
    const bound=await view.teacherBindingByActor(context.ownerId,context.actorId);
    if(!bound)throw denied();
    if(bound.payload.state!=='ACTIVE'||bound.payload.assignmentState.state!=='known'||bound.payload.assignmentState.value!=='ACTIVE')throw denied();
    if(businessDate<bound.payload.validFrom||bound.payload.validTo!==null&&businessDate>=bound.payload.validTo)throw denied();
  }
  private assertQualifiedScope(ref:ObjectRef,request:TypedReadRequest,context:TrustedTeacherContext):void{
    if(ref.identity.scopeRef.basis.scope.ownerNamespace!==context.ownerId)throw denied();
    if(ref.identity.namespace!==request.scopeRef.basis.namespace)throw denied();
  }
  private validateRequest(request:TypedReadRequest,context:TrustedTeacherContext):TypedReadRequest{
    try{return this.validateRequestCore(request,context);}
    catch(error){
      if(error instanceof TypedReadRefusal)throw error;
      if(error instanceof Error&&error.message==='registry_version')throw unverifiable();
      throw invalid();
    }
  }
  private validateRequestCore(request:TypedReadRequest,context:TrustedTeacherContext):TypedReadRequest{
    if(!request||typeof request!=='object'||Array.isArray(request))throw invalid();
    const keys=Object.keys(request);
    const allowed=['contractVersion','consumerProfile','requestId','scopeRef','selector','snapshot','functionRequest','snapshotAdmission','asOf','expectedRevisions','fieldMask','linkMask','pageSize','cursor','temporalSelection'];
    if(keys.some(key=>!allowed.includes(key))||allowed.some(key=>!keys.includes(key)))throw invalid();
    if(request.contractVersion!==typedReadContractVersion)throw unverifiable();this.assertProfile(request.consumerProfile);
    requireText(request.requestId,'request');validateNativeRef(request.scopeRef);
    if(request.scopeRef.basis.scope.ownerNamespace!==context.ownerId)throw denied();
    validateSnapshot(request.snapshot,this.fixedProfile.definition.registry.version);
    if(request.snapshot.registryVersion!==this.fixedProfile.definition.registry.version)throw unverifiable();
    assertInstant(request.asOf);if(request.asOf!==request.snapshot.asOf)throw invalid();
    if(!Number.isSafeInteger(request.pageSize)||request.pageSize<1||request.pageSize>100)throw invalid();
    if(request.cursor!==null&&typeof request.cursor!=='string')throw invalid();
    if(typeof request.cursor==='string'&&Buffer.byteLength(request.cursor,'utf8')>8192)throw invalid();
    this.validateTemporalSelection(request.temporalSelection,request,context);
    this.validateFunctionRequest(request,context);
    if(!Array.isArray(request.expectedRevisions))throw invalid();
    const expectedByIdentity=new Map<string,string>();
    for(const ref of request.expectedRevisions){
      validateObjectRef(ref);this.assertQualifiedScope(ref,request,context);
      const key=identityKey(ref.identity),prior=expectedByIdentity.get(key);
      if(prior!==undefined&&prior!==ref.revision)throw staleRevision();
      expectedByIdentity.set(key,ref.revision);
    }
    const selector=request.selector;
    if(!selector||typeof selector!=='object')throw invalid();
    let selectedTypes:readonly EducationType[];
    if(selector.kind==='EXACT_OBJECT'){
      assertExactKeys(selector,['kind','objectRef']);validateObjectRef(selector.objectRef);
      this.assertQualifiedScope(selector.objectRef,request,context);
      selectedTypes=[selector.objectRef.identity.objectType];
    }else if(selector.kind==='REGISTERED_QUERY'){
      assertExactKeys(selector,['kind','query']);this.validateQuerySpec(selector.query,request,context);
      selectedTypes=[selector.query.baseType.symbol as EducationType];
    }else throw invalid();
    if(!Array.isArray(request.fieldMask)||!request.fieldMask.length)throw invalid();
    const covered=new Set<string>();
    for(const entry of request.fieldMask){
      assertExactKeys(entry,['objectType','path']);
      if(!educationTypes.includes(entry.objectType)||!typeFields[entry.objectType].includes(entry.path))throw invalid();
      covered.add(entry.objectType+'.'+entry.path);
    }
    for(const type of selectedTypes)for(const path of typeFields[type])if(!covered.has(type+'.'+path))throw invalid();
    if(!Array.isArray(request.linkMask))throw invalid();
    for(const link of request.linkMask)if(!linkTypes.includes(link))throw invalid();
    if(new Set(request.linkMask).size!==request.linkMask.length)throw invalid();
    if(request.temporalSelection.functionRequestDigest!==functionSelectionDigest(request))throw staleGrant();
    this.validateSnapshotAdmission(request,context);
    return request;
  }
  private validateTemporalSelection(selection:TypedTemporalSelection,request:TypedReadRequest,context:TrustedTeacherContext):void{
    if(!isRecord(selection))throw invalid();
    assertExactKeys(selection,['schema','functionName','functionVersion','functionRequestDigest','businessDate','classGroupRef','studentRef','occurrence','draftRef']);
    if(selection.schema!=='education-selection.v2')throw invalid();
    if(selection.functionVersion!=='2.0.0')throw invalid();
    if(!['GetStudentDailyContext','ListClassDailyStatus','CheckDailyRecordCompleteness'].includes(selection.functionName))throw invalid();
    if(typeof selection.functionRequestDigest!=='string'||!sha256Pattern.test(selection.functionRequestDigest))throw invalid();
    assertDate(selection.businessDate);
    validateObjectRef(selection.classGroupRef,['ClassGroup']);this.assertQualifiedScope(selection.classGroupRef,request,context);
    if(selection.studentRef!==null){validateObjectRef(selection.studentRef,['Student']);this.assertQualifiedScope(selection.studentRef,request,context);}
    if(selection.draftRef!==null){validateObjectRef(selection.draftRef,['DailyRecordDraft']);this.assertQualifiedScope(selection.draftRef,request,context);}
    if(!isRecord(selection.occurrence))throw invalid();
    if(selection.occurrence.mode==='EXACT'){
      assertExactKeys(selection.occurrence,['mode','lessonRef']);
      validateObjectRef((selection.occurrence as {lessonRef:ObjectRef}).lessonRef,['LessonSession']);
      this.assertQualifiedScope((selection.occurrence as {lessonRef:ObjectRef}).lessonRef,request,context);
    }else if(selection.occurrence.mode==='ENUMERATE_SEPARATELY'){
      assertExactKeys(selection.occurrence,['mode']);
    }else throw invalid();
    // Registered Function shape invariants (education-functions 2.0.0).
    if(selection.functionName==='GetStudentDailyContext'&&(selection.studentRef===null||selection.occurrence.mode!=='EXACT'||selection.draftRef!==null))throw invalid();
    if(selection.functionName==='CheckDailyRecordCompleteness'&&(selection.studentRef===null||selection.occurrence.mode!=='EXACT'||selection.draftRef===null))throw invalid();
    if(selection.functionName==='ListClassDailyStatus'&&(selection.studentRef!==null||selection.draftRef!==null))throw invalid();
  }
  /** Complete Function 2.0.0 request validation against the unchanged
   * definitions; every join to the outer envelope must hold exactly. */
  private validateFunctionRequest(request:TypedReadRequest,context:TrustedTeacherContext):void{
    const fr=request.functionRequest,temporal=request.temporalSelection;
    if(!isRecord(fr))throw invalid();
    if(fr.contractVersion!=='2.0.0'||fr.functionVersion!=='2.0.0')throw invalid();
    if(fr.functionName!==temporal.functionName)throw invalid();
    const common=['contractVersion','functionVersion','scopeRef','classGroupRef','businessDate','expectedRevisions','functionName','selector'];
    const variantKeys=fr.functionName==='GetStudentDailyContext'?['pageSize','studentRef','occurrence']:fr.functionName==='ListClassDailyStatus'?['pageSize','occurrence']:fr.functionName==='CheckDailyRecordCompleteness'?['studentRef','occurrence','draftRef','profile']:null;
    if(variantKeys===null)throw invalid();
    {
      const keys=[...common,...variantKeys,'requestId','snapshot','asOf',...(fr.functionName==='CheckDailyRecordCompleteness'?[]:['cursor'])];
      assertExactKeys(fr,keys);
      const cfr=fr as unknown as TypedCompleteFunctionRequest;
      requireText(cfr.requestId,'request');validateSnapshot(cfr.snapshot,this.fixedProfile.definition.registry.version);assertInstant(cfr.asOf);
      if(canonicalJson(cfr.snapshot)!==canonicalJson(request.snapshot)||cfr.asOf!==request.asOf)throw invalid();
      if(fr.functionName!=='CheckDailyRecordCompleteness'&&(cfr.cursor!==request.cursor||cfr.cursor!==null&&typeof cfr.cursor!=='string'))throw invalid();
    }
    const expectedSelector=fr.functionName==='GetStudentDailyContext'?'STUDENT_OCCURRENCE_CONTEXT_V1':fr.functionName==='ListClassDailyStatus'?'CLASS_OCCURRENCE_STATUS_V1':'DRAFT_COMPLETENESS_V1';
    if((fr as {selector:string}).selector!==expectedSelector)throw invalid();
    if(canonicalJson(fr.scopeRef)!==canonicalJson(request.scopeRef))throw invalid();
    validateObjectRef(fr.classGroupRef,['ClassGroup']);this.assertQualifiedScope(fr.classGroupRef,request,context);
    if(fr.businessDate!==temporal.businessDate)throw invalid();
    if(canonicalJson(fr.classGroupRef)!==canonicalJson(temporal.classGroupRef))throw invalid();
    if(canonicalJson(fr.occurrence)!==canonicalJson(temporal.occurrence))throw invalid();
    if(canonicalJson(fr.expectedRevisions)!==canonicalJson(request.expectedRevisions))throw invalid();
    if(fr.functionName!=='CheckDailyRecordCompleteness'&&(fr as {pageSize:number}).pageSize!==request.pageSize)throw invalid();
    if(fr.functionName==='CheckDailyRecordCompleteness'&&(fr as {profile:string}).profile!=='DAILY_RECORD_OCCURRENCE_V1')throw invalid();
    if(fr.functionName==='ListClassDailyStatus'){
      if(temporal.studentRef!==null||temporal.draftRef!==null)throw invalid();
    }else{
      const variant=fr as {studentRef:ObjectRef;draftRef?:ObjectRef};
      if(canonicalJson(variant.studentRef)!==canonicalJson(temporal.studentRef))throw invalid();
      if(fr.functionName==='CheckDailyRecordCompleteness'&&canonicalJson(variant.draftRef)!==canonicalJson(temporal.draftRef))throw invalid();
    }
  }
  /** Asserted snapshot grant retained verbatim; no placeholder is
   * reinterpreted. Absent an owner verifier the path fails closed. */
  private validateSnapshotAdmission(request:TypedReadRequest,context:TrustedTeacherContext):void{
    const grant=request.snapshotAdmission;
    if(!isRecord(grant))throw invalid();
    assertExactKeys(grant,['grantId','proof','expiresAt']);
    requireText(grant.grantId,'grant');requireText(grant.proof,'grant');
    assertInstant(grant.expiresAt);
    if(Date.parse(grant.expiresAt)<=this.now())throw staleGrant();
    if(!this.snapshotGrantVerifier)throw unverifiable(['OWNER_INTERFACE_RATIFICATION']);
    let accepted=false;
    try{accepted=this.snapshotGrantVerifier(grant as SnapshotAdmissionGrant,request,context);}catch{throw staleGrant();}
    if(!accepted)throw staleGrant();
  }
  private validateTypeBinding(binding:TypeBinding,allowedSymbols:readonly string[]):EducationType|TypedLinkType{
    if(!isRecord(binding))throw invalid();
    assertExactKeys(binding,['artifactPath','symbol','version','definitionSha256']);
    if(binding.artifactPath!==this.fixedProfile.definition.registry.path)throw invalid();
    if(typeof binding.definitionSha256!=='string'||!sha256Pattern.test(binding.definitionSha256))throw invalid();
    if(!allowedSymbols.includes(binding.symbol))throw invalid();
    // TypeBinding.version is the NamedLinks container 1.1.0 for link
    // selectors; per-row versions apply only to projected links.
    const expected=binding.symbol.startsWith('NamedLinks/links/')
      ? this.fixedProfile.definition.carriage.NamedLinks
      : this.typeVersion(binding.symbol as EducationType);
    if(binding.version!==expected)throw invalid();
    const pinned=[...this.fixedProfile.pins.objects,...this.fixedProfile.pins.links].find(pin=>pin.symbol===binding.symbol)?.definitionSha256;
    if(!pinned||binding.definitionSha256!==pinned)throw unverifiable(['OWNER_INTERFACE_RATIFICATION']);
    return binding.symbol as EducationType;
  }
  private validateProperty(property:unknown,baseType:EducationType,allowAliases:boolean):void{
    if(typeof property!=='string'||!property)throw invalid();
    if(typeFields[baseType].includes(property))return;
    if(allowAliases&&(propertyAliases as readonly string[]).includes(property))return;
    throw invalid();
  }
  private validateScalar(value:unknown):void{
    if(value===null||typeof value==='string'||typeof value==='boolean')return;
    if(typeof value==='number'&&Number.isFinite(value))return;
    throw invalid();
  }
  private validateLinkSelector(selector:LinkSelector,baseType:EducationType):void{
    if(!isRecord(selector))throw invalid();
    assertExactKeys(selector,['type','direction']);
    if(selector.direction!=='out'&&selector.direction!=='in')throw invalid();
    const linkNames=linkTypes.map(link=>'NamedLinks/links/'+link);
    this.validateTypeBinding(selector.type,linkNames);
    void baseType;
  }
  private validateFilter(filter:unknown,baseType:EducationType,depth:number,nodes:{count:number}):void{
    if(!isRecord(filter))throw invalid();
    if(++nodes.count>128||depth>8)throw invalid();
    const op=filter.op;
    if(op==='eq'||op==='neq'){
      assertExactKeys(filter,['op','property','value']);this.validateProperty(filter.property,baseType,true);this.validateScalar(filter.value);
    }else if(op==='in'){
      assertExactKeys(filter,['op','property','values']);this.validateProperty(filter.property,baseType,true);
      if(!Array.isArray(filter.values)||filter.values.length<1||filter.values.length>100)throw invalid();
      filter.values.forEach(value=>this.validateScalar(value));
    }else if(op==='range'){
      assertExactKeys(filter,['op','property','lower','upper']);this.validateProperty(filter.property,baseType,true);
      if(filter.lower===null&&filter.upper===null)throw invalid();
      for(const bound of [filter.lower,filter.upper]){
        if(bound===null)continue;
        if(!isRecord(bound))throw invalid();
        assertExactKeys(bound,['value','inclusive']);this.validateScalar(bound.value);
        if(typeof bound.inclusive!=='boolean')throw invalid();
      }
    }else if(op==='exists'){
      assertExactKeys(filter,['op','subject','value']);
      if(typeof filter.value!=='boolean')throw invalid();
      if(!isRecord(filter.subject))throw invalid();
      if(filter.subject.kind==='property'){assertExactKeys(filter.subject,['kind','property']);this.validateProperty(filter.subject.property,baseType,true);}
      else if(filter.subject.kind==='link'){assertExactKeys(filter.subject,['kind','link']);this.validateLinkSelector(filter.subject.link as LinkSelector,baseType);}
      else throw invalid();
    }else if(op==='unknown'){
      assertExactKeys(filter,['op','property','state']);this.validateProperty(filter.property,baseType,true);
      if(!['unknown','missing','either'].includes(filter.state as string))throw invalid();
    }else if(op==='and'||op==='or'){
      assertExactKeys(filter,['op','args']);
      if(!Array.isArray(filter.args)||filter.args.length<1||filter.args.length>32)throw invalid();
      filter.args.forEach(arg=>this.validateFilter(arg,baseType,depth+1,nodes));
    }else if(op==='not'){
      assertExactKeys(filter,['op','arg']);this.validateFilter(filter.arg,baseType,depth+1,nodes);
    }else throw invalid();
  }
  private validateQuerySpec(query:QuerySpec,request:TypedReadRequest,context:TrustedTeacherContext):void{
    if(!isRecord(query))throw invalid();
    assertExactKeys(query,['schema','scope','registrySha256','baseType','filter','traverse','fieldMask','orderBy','consistency','page','temporalSelection']);
    if(query.schema!=='query-spec.v2')throw invalid();
    validateNativeRef(query.scope);
    if(canonicalJson(query.scope)!==canonicalJson(request.scopeRef)){
      if((query.scope as NativeObjectRef).basis.scope.ownerNamespace!==context.ownerId)throw denied();
      throw invalid();
    }
    if(typeof query.registrySha256!=='string'||!sha256Pattern.test(query.registrySha256))throw invalid();
    if(this.bindingsQualified&&query.registrySha256!==this.registrySha256)throw unverifiable(['OWNER_INTERFACE_RATIFICATION']);
    const baseType=this.validateTypeBinding(query.baseType,[...educationTypes]) as EducationType;
    if(query.filter!==null)this.validateFilter(query.filter,baseType,0,{count:0});
    let maskType=baseType;
    if(query.traverse!==null){
      if(!isRecord(query.traverse))throw invalid();
      assertExactKeys(query.traverse,['link','targetType','targetFilter']);
      this.validateLinkSelector(query.traverse.link,baseType);
      maskType=this.validateTypeBinding(query.traverse.targetType,[...educationTypes]) as EducationType;
      if(query.traverse.targetFilter!==null)this.validateFilter(query.traverse.targetFilter,maskType,0,{count:0});
    }
    if(!Array.isArray(query.fieldMask)||query.fieldMask.length<1||query.fieldMask.length>64)throw invalid();
    if(new Set(query.fieldMask).size!==query.fieldMask.length)throw invalid();
    for(const property of query.fieldMask)this.validateProperty(property,maskType,false);
    // QuerySpec fieldMask joins the outer full mask for the same type.
    const outerPaths=request.fieldMask.filter(entry=>entry.objectType===maskType).map(entry=>entry.path);
    if(canonicalJson([...query.fieldMask].sort())!==canonicalJson([...outerPaths].sort()))throw invalid();
    if(!Array.isArray(query.orderBy)||query.orderBy.length>8)throw invalid();
    const ordered=new Set<string>();
    for(const term of query.orderBy){
      if(!isRecord(term))throw invalid();
      assertExactKeys(term,['property','direction']);this.validateProperty(term.property,baseType,true);
      if(term.direction!=='asc'&&term.direction!=='desc')throw invalid();
      if(ordered.has(term.property as string))throw invalid();
      ordered.add(term.property as string);
    }
    if(query.consistency!==request.snapshot.consistency)throw invalid();
    if(!isRecord(query.page))throw invalid();
    if(Object.keys(query.page).some(key=>!['size','cursor'].includes(key))||!Object.hasOwn(query.page,'cursor'))throw invalid();
    const pageSize=query.page.size===undefined?50:query.page.size;
    if(!Number.isSafeInteger(pageSize)||(pageSize as number)<1||(pageSize as number)>100||pageSize!==request.pageSize)throw invalid();
    if(query.page.cursor!==request.cursor)throw invalid();
    if(query.temporalSelection===null)throw invalid();
    if(canonicalJson(query.temporalSelection)!==canonicalJson(request.temporalSelection))throw invalid();
  }
  /** Only the three pinned RegisteredSelectors plans are supported. Any
   * other well-formed plan (filters, traversal, ordering, unregistered
   * base/function pairing) fails closed; no arbitrary query authority. */
  private assertSupportedPlan(request:TypedReadRequest):void{
    if(this.consumerProfile==='OLD_SECTION_1_0'&&request.cursor!==null)throw unverifiable();
    if(this.consumerProfile==='OLD_SECTION_1_0'&&(request.pageSize!==100||request.fieldMask.some(field=>field.objectType!=='Section')||request.linkMask.length!==2||!request.linkMask.includes('sectionInEdition')||!request.linkMask.includes('sectionInUnit')))throw unverifiable();
    if(this.consumerProfile==='OLD_SECTION_1_0'&&(request.functionRequest.functionName!=='GetStudentDailyContext'||request.selector.kind!=='EXACT_OBJECT'||request.selector.objectRef.identity.objectType!=='Section'||request.linkMask.some(link=>!['sectionInEdition','sectionInUnit'].includes(link))))throw unverifiable();
    if(request.selector.kind==='EXACT_OBJECT')return;
    const query=request.selector.query;
    if(query.filter!==null||query.traverse!==null||query.orderBy.length>0)throw unverifiable(['OWNER_INTERFACE_RATIFICATION']);
    const base=query.baseType.symbol,functionName=request.temporalSelection.functionName;
    const supported=(functionName==='GetStudentDailyContext'&&base==='Student')
      ||(functionName==='GetStudentDailyContext'&&base==='DailyProgress')
      ||(functionName==='ListClassDailyStatus'&&base==='ClassGroup')
      ||(functionName==='CheckDailyRecordCompleteness'&&base==='DailyRecordDraft');
    if(!supported)throw unverifiable(['OWNER_INTERFACE_RATIFICATION']);
  }
  private findExact(records:TypedRecord[],ref:ObjectRef):TypedRecord|null{
    const exact=records.find(record=>identityEqual(record.identity,ref.identity));
    if(exact)return exact;
    if(records.some(record=>record.identity.objectType===ref.identity.objectType&&record.identity.nativeKey===ref.identity.nativeKey))throw denied();
    return null;
  }
  private assertTemporalJoins(request:TypedReadRequest,records:TypedRecord[]):void{
    const selection=request.temporalSelection;
    const check=(ref:ObjectRef|null)=>{
      if(ref===null)return null;
      const record=this.findExact(records,ref);
      if(!record)throw new TypedReadRefusal('NOT_FOUND',404);
      if(record.revision!==ref.revision)throw staleRevision();
      return record;
    };
    check(selection.classGroupRef);check(selection.studentRef);check(selection.draftRef);
    if(selection.occurrence.mode==='EXACT'){
      const lesson=check(selection.occurrence.lessonRef);
      if(lesson){
        const lessonClass=lesson.classGroupRef as ObjectRef;
        if(!identityEqual(lessonClass.identity,selection.classGroupRef.identity))throw denied();
        if(lesson.businessDate!==selection.businessDate)throw invalid();
      }
    }
    if(selection.draftRef!==null){
      const draft=this.findExact(records,selection.draftRef);
      if(draft){
        const scope=draft.recordScope as {studentRef:ObjectRef;classGroupRef:ObjectRef;lessonRef:ObjectRef;businessDate:string};
        if(selection.studentRef===null||!identityEqual(scope.studentRef.identity,selection.studentRef.identity))throw denied();
        if(!identityEqual(scope.classGroupRef.identity,selection.classGroupRef.identity))throw denied();
        if(selection.occurrence.mode==='EXACT'&&!identityEqual(scope.lessonRef.identity,selection.occurrence.lessonRef.identity))throw denied();
        if(scope.businessDate!==selection.businessDate)throw denied();
      }
    }
  }

  /** Root-selected P-SNAPSHOT conformance: exact Student and no links only.
   * Immutable dated endpoints are verified at their ORIGINAL native revisions;
   * they are never rewritten to the current Student head or emitted as links.
   * The caller's unchanged whole-plan horizon is still recomputed by both gates. */
  private async projectStudentOnly(view:TeacherPrerequisiteReadStore,context:TrustedTeacherContext,request:TypedReadRequest):Promise<TypedReadOk>{
    if(request.selector.kind!=='EXACT_OBJECT'||request.selector.objectRef.identity.objectType!=='Student'||request.cursor!==null||request.temporalSelection.occurrence.mode!=='EXACT')throw staleGrant();
    const target=request.selector.objectRef,selection=request.temporalSelection;
    if(selection.occurrence.mode!=='EXACT')throw invalid();
    if(selection.studentRef===null||canonicalJson(target)!==canonicalJson(selection.studentRef))throw denied();
    const student=(await view.students(context.ownerId)).find(s=>s.id===target.identity.nativeKey);
    const version=student?await view.studentRevisionCurrent(context.ownerId,student.id):null;
    if(!student||!version)throw new TypedReadRefusal('NOT_FOUND',404);
    const record=this.baseRecord(request,version,'Student');
    if(!identityEqual(record.identity,target.identity))throw denied();
    if(record.revision!==target.revision)throw staleRevision();
    record.displayName=version.payload.displayName;record.enrollmentState=version.payload.enrollmentState;
    const binding=await view.teacherBindingByActor(context.ownerId,context.actorId);
    if(!binding)throw denied();
    const teacher=this.baseRecord(request,binding,'Teacher'),group=(await view.classGroups(context.ownerId)).find(v=>canonicalJson({identity:{scopeRef:v.scopeRef,namespace:v.namespace,objectType:'ClassGroup',nativeKey:v.entityKey},revision:v.revisionId})===canonicalJson(selection.classGroupRef));
    const lessonRef=selection.occurrence.lessonRef,lesson=(await view.lessons(context.ownerId)).find(v=>canonicalJson({identity:{scopeRef:v.scopeRef,namespace:v.namespace,objectType:'LessonSession',nativeKey:v.entityKey},revision:v.revisionId})===canonicalJson(lessonRef));
    if(!group||!lesson||lesson.payload.businessDate!==selection.businessDate||canonicalJson(lesson.payload.classGroupRef)!==canonicalJson(selection.classGroupRef))throw denied();
    const groupRecord=this.baseRecord(request,group,'ClassGroup'),lessonRecord=this.baseRecord(request,lesson,'LessonSession');
    lessonRecord.classGroupRef=lesson.payload.classGroupRef;lessonRecord.businessDate=lesson.payload.businessDate;
    const originalStudent=async(ref:ObjectRef):Promise<boolean>=>{
      if(!identityEqual(ref.identity,target.identity))return false;
      const original=await view.ownerRevision(context.ownerId,'student',ref.identity.nativeKey,ref.revision);
      return !!original&&original.payload.kind==='student_record'&&original.revisionId===ref.revision&&canonicalJson(original.scopeRef)===canonicalJson(ref.identity.scopeRef)&&original.namespace===ref.identity.namespace&&original.entityKey===ref.identity.nativeKey;
    };
    const edges=(await view.temporalBindings(context.ownerId)).filter(v=>v.payload.validFrom<=selection.businessDate&&(v.payload.validTo===null||selection.businessDate<v.payload.validTo));
    let membership=false,participation=false,teaching=false;
    for(const edge of edges){
      const p=edge.payload;
      if(p.bindingKind==='TEACHING_ASSIGNMENT'&&canonicalJson(p.subjectRef)===canonicalJson(selection.classGroupRef)&&canonicalJson(p.targetRef)===canonicalJson(refOf(teacher)))teaching=true;
      if(p.bindingKind==='CLASS_MEMBERSHIP'&&canonicalJson(p.targetRef)===canonicalJson(selection.classGroupRef)&&await originalStudent(p.subjectRef))membership=true;
      if(p.bindingKind==='LESSON_PARTICIPATION'&&canonicalJson(p.subjectRef)===canonicalJson(lessonRef)&&await originalStudent(p.targetRef))participation=true;
    }
    if(!teaching||!membership||!participation||lesson.payload.participantRefs.state!=='known')throw denied();
    let participant=false;for(const ref of lesson.payload.participantRefs.value)if(await originalStudent(ref))participant=true;
    if(!participant)throw denied();
    for(const scope of await view.activityScopes(context.ownerId,{})){
      const p=scope.payload.recordScope;
      if(identityEqual(p.studentRef.identity,target.identity)&&canonicalJson(p.classGroupRef)===canonicalJson(selection.classGroupRef)&&canonicalJson(p.lessonRef)===canonicalJson(lessonRef)&&p.businessDate===selection.businessDate&&!await originalStudent(p.studentRef))throw denied();
    }
    const records=[record,teacher,groupRecord,lessonRecord];this.assertTemporalJoins(request,records);
    for(const expected of request.expectedRevisions){const found=this.findExact(records,expected);if(!found||found.revision!==expected.revision)throw staleRevision();}
    const value:TypedReadOk={kind:'OK',contractVersion:typedReadContractVersion,consumerProfile:this.consumerProfile,requestId:request.requestId,correlationId:request.requestId,asOf:request.asOf,snapshot:request.snapshot,items:[{kind:'OBJECT',record}],nextCursor:null,enumeration:'COMPLETE',gaps:[]};
    this.pages.set(value,{end:1,total:1});return value;
  }

  private async projectPage(view:TeacherPrerequisiteReadStore,context:TrustedTeacherContext,request:TypedReadRequest,cursor?:NativeOwnerCursorBinding):Promise<TypedReadOk>{
    await this.assertCurrentBinding(view,context,request.temporalSelection.businessDate);
    this.assertSupportedPlan(request);
    view=await selectReadPlan(view,context.ownerId,request.temporalSelection.businessDate,horizonPlan(request.functionRequest,this.consumerProfile));
    if(this.consumerProfile==='CURRENT_1_1'&&this.cursorOptions.cursorOwner&&request.functionRequest.functionName==='GetStudentDailyContext'&&request.selector.kind==='EXACT_OBJECT'&&request.selector.objectRef.identity.objectType==='Student'&&request.linkMask.length===0&&request.fieldMask.every(f=>f.objectType==='Student'))return this.projectStudentOnly(view,context,request);
    const {records,links,gaps,withheldCatalog,observedHomework,observedAttempts}=await this.projectAll(view,context,request);
    this.assertTemporalJoins(request,records);
    // Explicit revision pins are checked in every consistency mode.
    {
      const byIdentity=new Map(records.map(record=>[identityKey(record.identity),record.revision]));
      for(const expected of request.expectedRevisions){
        const key=identityKey(expected.identity);
        if(!byIdentity.has(key)){
          if(records.some(record=>record.identity.objectType===expected.identity.objectType&&record.identity.nativeKey===expected.identity.nativeKey))throw denied();
          throw staleRevision();
        }
        if(byIdentity.get(key)!==expected.revision)throw staleRevision();
      }
    }
    let items:TypedItem[];
    if(request.selector.kind==='EXACT_OBJECT'){
      const target=request.selector.objectRef;
      const record=records.find(candidate=>identityEqual(candidate.identity,target.identity));
      if(!record){
        if(records.some(candidate=>candidate.identity.objectType===target.identity.objectType&&candidate.identity.nativeKey===target.identity.nativeKey))throw denied();
        const withheld=withheldCatalog.has(target.identity.objectType+':'+target.identity.nativeKey)
          ||(target.identity.objectType==='HomeworkAssignment'&&observedHomework.has(target.identity.nativeKey))
          ||(target.identity.objectType==='DailyTestAttempt'&&observedAttempts.has(target.identity.nativeKey));
        if(withheld){
          if(target.identity.objectType==='Section'){const pins=await view.currentCatalogPins(context.ownerId);const pin=pins.find(pin=>pin.node.id===target.identity.nativeKey);if(!pin||pin.revisionId!==target.revision)throw staleRevision();}
          const exactGaps=gaps.filter(gap=>(gap.path===target.identity.objectType+'.record'||gap.path===target.identity.objectType+'.recordScope'||gap.path==='Section.unitRef'||gap.path==='DailyTestAttempt.links.attemptFollows')&&(!gap.subject||identityEqual(gap.subject.identity,target.identity)));
          if(gaps.length>100)throw unverifiable();gaps.forEach(validateNativeGap);
          return {kind:'OK',contractVersion:typedReadContractVersion,consumerProfile:this.consumerProfile,requestId:request.requestId,correlationId:request.requestId,asOf:request.asOf,snapshot:request.snapshot,items:[],nextCursor:null,enumeration:'UNKNOWN',gaps:exactGaps.length?exactGaps:gaps};
        }
        throw new TypedReadRefusal('NOT_FOUND',404);
      }
      if(target.revision!==record.revision)throw staleRevision();
      const outgoing=links.filter(link=>identityEqual(link.fromRef.identity,target.identity)&&request.linkMask.includes(link.linkType));
      items=[{kind:'OBJECT',record},...outgoing.map(link=>({kind:'LINK',link}) as TypedItem)];
    }else{
      const baseType=request.selector.query.baseType.symbol as EducationType;
      const selection=request.temporalSelection;
      const bound=selection.functionName==='GetStudentDailyContext'?selection.studentRef:selection.functionName==='ListClassDailyStatus'?selection.classGroupRef:selection.draftRef;
      // A DailyProgress object set in a student's daily context is that student's progress in the selected
      // occurrence (class, business date and, when exact, lesson); records cited from other occurrences stay
      // dependencies, never results. Every other supported base selects the bound object itself.
      type Scope={studentRef:ObjectRef;classGroupRef:ObjectRef;businessDate:string;lessonRef:ObjectRef};
      const inOccurrence=(scope:Scope|undefined):boolean=>!!scope&&bound!==null&&identityEqual(scope.studentRef.identity,bound.identity)
        &&identityEqual(scope.classGroupRef.identity,selection.classGroupRef.identity)&&scope.businessDate===selection.businessDate
        &&(selection.occurrence.mode!=='EXACT'||identityEqual(scope.lessonRef.identity,selection.occurrence.lessonRef.identity));
      const selected=baseType==='DailyProgress'&&selection.functionName==='GetStudentDailyContext'
        ?records.filter(record=>record.identity.objectType==='DailyProgress'&&inOccurrence(record.recordScope as Scope|undefined))
        :records.filter(record=>record.identity.objectType===baseType&&bound!==null&&identityEqual(record.identity,bound.identity));
      const selectedKeys=new Set(selected.map(record=>identityKey(record.identity)));
      const selectedLinks=links.filter(link=>request.linkMask.includes(link.linkType)&&selectedKeys.has(identityKey(link.fromRef.identity)));
      items=[...selected.map(record=>({kind:'OBJECT',record}) as TypedItem),...selectedLinks.map(link=>({kind:'LINK',link}) as TypedItem)];
    }
    const itemKey=(item:TypedItem)=>item.kind==='OBJECT'?[item.kind,item.record.identity.objectType,item.record.identity.namespace,item.record.identity.nativeKey,item.record.revision,canonicalJson(item.record.identity.scopeRef)]:[item.kind,item.link.linkType,item.link.fromRef.identity.namespace,item.link.nativeRelationKey.state==='known'?item.link.nativeRelationKey.value:canonicalJson([item.link.fromRef.identity,item.link.toRef.identity]),item.link.revision,canonicalJson(item.link.fromRef.identity.scopeRef)];
    const compare=(a:TypedItem,b:TypedItem)=>{const x=itemKey(a),y=itemKey(b);for(let n=0;n<x.length;n++){const c=Buffer.compare(Buffer.from(String(x[n]),'utf8'),Buffer.from(String(y[n]),'utf8'));if(c)return c;}return 0;};
    const unique=new Map<string,TypedItem>();for(const item of items){const key=canonicalJson(itemKey(item));const prior=unique.get(key);if(prior&&canonicalJson(prior)!==canonicalJson(item))throw unverifiable();unique.set(key,item);}items=[...unique.values()].sort(compare);
    const start=cursor?Number(cursor.sealedPosition):0;
    if(!Number.isSafeInteger(start)||start<0||cursor&&start>=items.length)throw staleGrant();
    if(gaps.length>100)throw unverifiable();gaps.forEach(validateNativeGap);
    const page=items.slice(start,start+request.pageSize),end=start+page.length;
    // Gaps describe the selected Function envelope, already narrowed by
    // selectReadPlan, including its unresolved one-hop dependencies.
    const value:TypedReadOk={kind:'OK',contractVersion:typedReadContractVersion,consumerProfile:this.consumerProfile,requestId:request.requestId,correlationId:request.requestId,asOf:request.asOf,snapshot:request.snapshot,items:page,nextCursor:null,enumeration:gaps.length?'UNKNOWN':end<items.length?'PARTIAL':'COMPLETE',gaps};
    this.pages.set(value,{end,total:items.length});return value;
  }
  private provenance(scopeRef:NativeObjectRef,revision:string,locator:string,observedAt:string):EvidenceRef[]{
    return [{sourceRef:scopeRef,sourceRevision:revision,locator,observedAt}];
  }
  private baseRecord(request:TypedReadRequest,version:{scopeRef:NativeObjectRef;namespace:string;entityKey:string;revisionId:string;recordedAt:string},objectType:EducationType):TypedRecord{
    return {contractVersion:this.fixedProfile.definition.registry.version,typeVersion:this.typeVersion(objectType),identity:{scopeRef:version.scopeRef,namespace:version.namespace,objectType,nativeKey:version.entityKey},revision:version.revisionId,asOf:request.asOf,snapshot:request.snapshot,provenance:this.provenance(version.scopeRef,version.revisionId,'nativeTypedRead/'+version.entityKey,version.recordedAt)};
  }
  private async projectAll(view:TeacherPrerequisiteReadStore,context:TrustedTeacherContext,request:TypedReadRequest):Promise<{records:TypedRecord[];links:TypedLink[];gaps:TypedGap[];withheldCatalog:Set<string>;observedHomework:Set<string>;observedAttempts:Set<string>}>{
    const records:TypedRecord[]=[];const gaps:TypedGap[]=[];const links:TypedLink[]=[];
    const observedHomework=new Set<string>(),observedAttempts=new Set<string>();
    for(const version of await view.teachers(context.ownerId)){
      const record=this.baseRecord(request,version,'Teacher');
      record.displayName=version.payload.displayName;record.assignmentState=version.payload.assignmentState;records.push(record);
    }
    for(const version of await view.classGroups(context.ownerId)){
      const record=this.baseRecord(request,version,'ClassGroup');
      record.displayName=version.payload.displayName;record.businessTimezone=version.payload.businessTimezone;record.classState=version.payload.classState;records.push(record);
    }
    const lessonVersions=await view.lessons(context.ownerId),temporalVersions=await view.temporalBindings(context.ownerId);
    const studentTuples=readPlanStudentTuples(horizonPlan(request.functionRequest,this.consumerProfile),lessonVersions,temporalVersions);
    const selectedStudentKeys=new Set([...studentTuples.values()].flatMap(students=>[...students]));
    const studentRelationInPlan=(type:TypedLinkType,from:ObjectRef,to:ObjectRef)=>type==='studentMemberOfClass'?selectedStudentKeys.has(canonicalJson(from.identity)):type==='lessonHasStudent'?studentTuples.get(canonicalJson(from.identity))?.has(canonicalJson(to.identity))===true:true;
    const lessonRecords:TypedRecord[]=[];
    for(const version of lessonVersions){
      const record=this.baseRecord(request,version,'LessonSession');const payload=version.payload;
      record.classGroupRef=payload.classGroupRef;record.businessDate=payload.businessDate;record.occurrenceOrdinal=payload.occurrenceOrdinal;record.startsAt=payload.startsAt;record.endsAt=payload.endsAt;record.teacherRefs=payload.teacherRefs;record.participantRefs=payload.participantRefs;record.lessonState=payload.lessonState;
      records.push(record);lessonRecords.push(record);
    }
    for(const student of await view.students(context.ownerId)){
      const version=await view.studentRevisionCurrent(context.ownerId,student.id);
      if(!version){gaps.push({subject:null,path:'Student.record',reason:'UNVERIFIED',requiredEvidence:['NATIVE_ID_KEY_SCOPE','NATIVE_REVISION_SNAPSHOT'],evidence:[]});continue;}
      const record=this.baseRecord(request,version,'Student');
      record.identity={scopeRef:version.scopeRef,namespace:version.namespace,objectType:'Student',nativeKey:student.id};
      record.displayName=version.payload.displayName;record.enrollmentState=version.payload.enrollmentState;records.push(record);
    }
    const currentBinding=await view.teacherBindingByActor(context.ownerId,context.actorId);
    const scopeVersions=await view.activityScopes(context.ownerId,{});
    const sourceStudents=await view.students(context.ownerId);
    const sourceRows=new Map<string,CurrentRecord[]>();
    for(const student of sourceStudents)sourceRows.set(student.id,await view.current(context.ownerId,student.id));
    // The compiler owns sourceClosure field/row access. It is not a caller capability.
    const sourceClosureAllowed=request.functionRequest.functionName==='GetStudentDailyContext'&&request.temporalSelection.studentRef!==null&&request.temporalSelection.occurrence.mode==='EXACT';
    const assertSourceRights=(student:typeof sourceStudents[number],row:CurrentRecord,activityScope?:RecordScope)=>{
      if(row.ownerId!==context.ownerId||row.studentId!==student.id||!('sourceStudent' in row.payload)||canonicalJson(row.payload.sourceStudent)!==canonicalJson(student.sourceKey))throw denied();
      const studentRecord=records.find(record=>record.identity.objectType==='Student'&&record.identity.nativeKey===student.id);
      const studentRef=request.temporalSelection.studentRef??(studentRecord?refOf(studentRecord):null);
      if(!studentRef||studentRef.identity.nativeKey!==student.id||!selectedStudentKeys.has(canonicalJson(studentRef.identity)))throw denied();
      if(activityScope&&canonicalJson(activityScope.studentRef)!==canonicalJson(studentRef))throw denied();
      const ownTeacher=records.find(r=>r.identity.objectType==='Teacher'&&r.identity.nativeKey===currentBinding?.entityKey);
      if(!ownTeacher)throw denied();
      const date=request.temporalSelection.businessDate,group=request.temporalSelection.classGroupRef;
      const has=(kind:string,from:ObjectRef,to:ObjectRef)=>temporalVersions.some(v=>v.payload.bindingKind===kind&&canonicalJson(v.payload.subjectRef)===canonicalJson(from)&&canonicalJson(v.payload.targetRef)===canonicalJson(to)&&v.payload.validFrom<=date&&(v.payload.validTo===null||date<v.payload.validTo));
      const lessonRef=activityScope?.lessonRef??(request.temporalSelection.occurrence.mode==='EXACT'?request.temporalSelection.occurrence.lessonRef:null);
      if(!lessonRef||studentTuples.get(canonicalJson(lessonRef.identity))?.has(canonicalJson(studentRef.identity))!==true||!has('TEACHING_ASSIGNMENT',group,refOf(ownTeacher))||!has('CLASS_MEMBERSHIP',studentRef,group)||!has('LESSON_PARTICIPATION',lessonRef,studentRef))throw denied();
    };
    const carrier=(kind:SourceScopeUnknown['kind'],student:typeof sourceStudents[number],row:CurrentRecord,terminal?:typeof scopeVersions[number]):TypedGap=>{
      assertSourceRights(student,row);
      if(!sourceClosureAllowed||this.consumerProfile!=='CURRENT_1_1')throw unverifiable();
      if(row.sourceObservedAt>row.recordedAt||row.recordedAt>request.asOf)throw unverifiable();
      const sourceStudentRef=request.temporalSelection.studentRef!;
      const source:SourceRowRef={scopeRef:request.scopeRef,sourceStudentRef,entityId:row.entityId,revisionId:row.revisionId,sourceObservedAt:row.sourceObservedAt,recordedAt:row.recordedAt};
      const evidence=this.provenance(request.scopeRef,row.revisionId,'sourceClosure/'+row.entityId,row.recordedAt);
      if(terminal)evidence.push(...this.provenance(terminal.scopeRef,terminal.revisionId,'activityScope/'+terminal.entityKey,terminal.recordedAt));
      const requiredEvidence=['NATIVE_ID_KEY_SCOPE','NATIVE_RELATION_MAPPING'];
      const objectType=row.payload.kind==='learning_work_assignment'?'HomeworkAssignment':'DailyTestAttempt';
      const gap:TypedGap={subject:kind==='FACET_ONLY_CARRYOVER'?null:{identity:{scopeRef:request.scopeRef,namespace:request.scopeRef.basis.namespace,objectType,nativeKey:row.entityId},revision:row.revisionId},path:kind==='FACET_ONLY_CARRYOVER'?'sourceClosure':objectType+'.recordScope',reason:'UNVERIFIED',requiredEvidence,evidence,sourceUnknown:{kind,source,recordScope:{state:'unknown',reason:'UNVERIFIED',evidence,requiredEvidence:requiredEvidence as never}}};
      validateNativeGap(gap);return gap;
    };
    const contentFor=async(work:LearningWorkAssignment,rows:CurrentRecord[])=>{
      validateLearningAssignment(work);
      const registration=rows.find(row=>row.revisionId===work.registrationRevisionId);
      if(registration?.payload.kind!=='source_book_registration'||canonicalJson([registration.payload.sourceStudent,registration.payload.sourceCourse,registration.payload.sourceUserCourse,registration.payload.sourceBook])!==canonicalJson([work.sourceStudent,work.sourceCourse,work.sourceUserCourse,work.sourceBook]))throw Error('work_crosswalk');
      const pins=await view.pinnedCatalog(context.ownerId,work.catalogRefs);
      if(pins.length!==work.catalogRefs.length)throw Error('work_catalog');
      const byId=new Map(pins.map(pin=>[pin.node.id,pin]));
      const sections=work.sectionNodeIds.map(id=>byId.get(id));
      if(sections.some(pin=>!pin||pin.node.kind!=='learning_section'||pin.node.parent.state!=='known'))throw Error('work_catalog');
      const parents=new Set(sections.map(pin=>pin!.node.parent.state==='known'?pin!.node.parent.value:''));if(parents.size!==1)throw Error('work_catalog');
      const parent=byId.get([...parents][0]!);if(!parent||!['major_unit','middle_unit','minor_unit'].includes(parent.node.kind))throw Error('work_catalog');
      const trace=(id:string)=>{const seen=new Set<string>();let pin=byId.get(id);while(pin){if(seen.has(pin.node.id))throw Error('work_catalog');seen.add(pin.node.id);if(pin.node.kind==='book_edition')return pin;if(pin.node.parent.state!=='known')break;pin=byId.get(pin.node.parent.value);}throw Error('work_catalog');};
      const edition=trace(parent.node.id);if(edition.node.id!==registration.payload.catalogNodeId||canonicalJson(edition.node.sourceKey)!==canonicalJson(work.sourceBook)||sections.some(pin=>trace(pin!.node.id).node.id!==edition.node.id))throw Error('work_catalog');
      for(const item of work.items){const pin=byId.get(item.contentNodeId);if(!pin||pin.node.kind!=='problem'||canonicalJson(pin.node.sourceKey)!==canonicalJson(item.itemKey)||!work.sectionNodeIds.includes(item.sectionNodeId))throw Error('work_catalog');let cursor=pin.node;const seen=new Set<string>();while(cursor.id!==item.sectionNodeId){if(seen.has(cursor.id)||cursor.parent.state!=='known')throw Error('work_catalog');seen.add(cursor.id);const next=byId.get(cursor.parent.value);if(!next)throw Error('work_catalog');cursor=next.node;}}
      if(this.consumerProfile==='OLD_SECTION_1_0'&&parent.node.kind!=='minor_unit')throw Error('work_catalog');
      const ref=(pin:typeof edition,type:EducationType):ObjectRef=>({identity:{scopeRef:request.scopeRef,namespace:request.scopeRef.basis.namespace,objectType:type,nativeKey:pin.node.id},revision:pin.revisionId});
      const evidence=this.provenance(request.scopeRef,registration.revisionId,'sourceRegistration/'+registration.entityId,registration.recordedAt);
      return {editionRef:ref(edition,'TextbookEdition'),unitRef:ref(parent,'Unit'),sectionRefs:{state:'known',value:sections.map(pin=>ref(pin!,'Section')),evidence},printedPages:unknownKnowledge('UNVERIFIED',['SOURCE_FIELD']),problemLabels:{state:'known',value:work.items.map(item=>item.labelLiteral),evidence}};
    };
    // Native student payload types; homework/attempt rows are observed but
    // unprojectable, so every observed row stays in the remainder.
    for(const student of await view.students(context.ownerId)){
      for(const current of await view.current(context.ownerId,student.id)){
        const payload=current.payload;
        if(payload.kind==='teacher_lesson_carryover'){
          if(sourceClosureAllowed&&this.consumerProfile==='CURRENT_1_1'){validateAcademyRecord(payload);gaps.push(carrier('FACET_ONLY_CARRYOVER',student,current));}continue;
        }
        if(payload.kind==='learning_work_assignment'||payload.kind==='learning_work_attempt'){
          const objectType=payload.kind==='learning_work_assignment'?'HomeworkAssignment':'DailyTestAttempt';
          const observed=objectType==='HomeworkAssignment'?observedHomework:observedAttempts;observed.add(current.entityId);
          const scopes=scopeVersions.filter(v=>v.payload.activityRef.identity.nativeKey===current.entityId&&v.payload.activityRef.identity.objectType===objectType&&canonicalJson(v.payload.activityRef.identity.scopeRef)===canonicalJson(request.scopeRef)&&v.payload.activityRef.identity.namespace===request.scopeRef.basis.namespace);
          const terminal=scopes.find(v=>activityScopeState(v.payload)==='DETACHED');
          if(terminal){
            if(terminal.payload.activityRef.revision!==current.revisionId)throw staleRevision();
            if(sourceClosureAllowed&&this.consumerProfile==='CURRENT_1_1'){gaps.push(carrier('DETACHED_ACTIVITY',student,current,terminal));}continue;
          }
          const active=scopes.filter(v=>activityScopeState(v.payload)==='ACTIVE'&&v.payload.activityRef.revision===current.revisionId);
          if(active.length!==1)continue;
          const scope=active[0]!.payload.recordScope;
          assertSourceRights(student,current,scope);
          if(request.temporalSelection.studentRef!==null&&canonicalJson(scope.studentRef)!==canonicalJson(request.temporalSelection.studentRef)||canonicalJson(scope.classGroupRef)!==canonicalJson(request.temporalSelection.classGroupRef)||request.temporalSelection.occurrence.mode==='EXACT'&&canonicalJson(scope.lessonRef)!==canonicalJson(request.temporalSelection.occurrence.lessonRef)||scope.businessDate!==request.temporalSelection.businessDate)throw denied();
          try{
            if(current.sourceObservedAt>current.recordedAt||current.recordedAt>request.asOf)throw Error('source_snapshot');
            const rows=sourceRows.get(student.id)!;
            const work=payload.kind==='learning_work_assignment'?payload:rows.find(row=>row.revisionId===payload.assignmentRevisionId)?.payload;
            if(work?.kind!=='learning_work_assignment')throw Error('work_crosswalk');
            const content=await contentFor(work,rows);
            const record=this.baseRecord(request,{scopeRef:request.scopeRef,namespace:request.scopeRef.basis.namespace,entityKey:current.entityId,revisionId:current.revisionId,recordedAt:current.recordedAt},objectType);
            record.recordScope=scope;record.contentScope=content;record.corrections=[];
            if(payload.kind==='learning_work_assignment'){
              record.assignmentState=payload.status==='assigned'?{state:'known',value:'ASSIGNED',evidence:record.provenance}:unknownKnowledge('UNVERIFIED',['SOURCE_FIELD'],record.provenance);
              record.dueDate=payload.dueDate.state==='known'?{state:'known',value:payload.dueDate.value,evidence:record.provenance}:unknownKnowledge('UNVERIFIED',['SOURCE_FIELD'],record.provenance);
              record.taskText=unknownKnowledge('UNVERIFIED',['SOURCE_FIELD'],record.provenance);
            }else{
              validateLearningAttempt(payload);
              if(canonicalJson(payload.sourceStudent)!==canonicalJson(work.sourceStudent)||payload.itemResults.some(item=>!work.items.some(assigned=>assigned.assignedItemId===item.assignedItemId))||work.paper.state==='known'&&canonicalJson(payload.paperIssuanceKey)!==canonicalJson(work.paper.value.issuanceKey))throw Error('attempt_crosswalk');
              record.assessmentLabel=unknownKnowledge('UNVERIFIED',['SOURCE_FIELD'],record.provenance);record.attemptOrdinal=unknownKnowledge('UNVERIFIED',['ATTEMPT_IDENTITY'],record.provenance);
              record.attemptedAt=payload.occurredAt.state==='known'?{state:'known',value:payload.occurredAt.value,evidence:record.provenance}:unknownKnowledge('UNVERIFIED',['SOURCE_FIELD'],record.provenance);
              const scores=await view.scoreEvidenceForAttempt(context.ownerId,refOf(record) as ObjectRef<'DailyTestAttempt'>);
              const assignment=rows.find(row=>row.revisionId===payload.assignmentRevisionId)!;
              const score=scores.length===1?scores[0]:null;if(score)validateOwnerPayload(score.payload);
              const scoreKnown=score&&score.sourceObservedAt<=request.asOf&&score.recordedAt<=request.asOf&&canonicalJson(score.payload.attemptRef)===canonicalJson(refOf(record))&&canonicalJson(score.payload.recordedBy)===canonicalJson(refOf(records.find(r=>r.identity.objectType==='Teacher'&&r.identity.nativeKey===currentBinding?.entityKey)!))&&score.payload.scale.family==='daily_test_attempt'&&score.payload.scale.version==='1.0.0'&&score.payload.scale.kind==='OWNER_RECORDED_NUMERIC_SCORE'&&canonicalJson(score.payload.recordScope)===canonicalJson(scope)&&score.payload.assignmentRef.identity.nativeKey===assignment.entityId&&score.payload.assignmentRef.revision===assignment.revisionId&&Number.isFinite(score.payload.score.earned)&&Number.isFinite(score.payload.score.maximum)&&score.payload.score.maximum>0&&score.payload.score.earned>=0&&score.payload.score.earned<=score.payload.score.maximum;
              record.score=scoreKnown?{state:'known',value:score!.payload.score,evidence:this.provenance(score!.scopeRef,score!.revisionId,'nativeScore/'+score!.entityKey,score!.recordedAt)}:unknownKnowledge('UNVERIFIED',['SOURCE_FIELD','OWNER_INTERFACE_RATIFICATION'],record.provenance);
              record.gradingState=scoreKnown&&payload.state==='graded'?{state:'known',value:'GRADED',evidence:record.provenance}:unknownKnowledge('UNVERIFIED',['SOURCE_FIELD'],record.provenance);
              record.previousAttemptRef=unknownKnowledge('UNVERIFIED',['ATTEMPT_IDENTITY'],record.provenance);
              if(payload.previousAttemptRevisionId!==null){
                const prior=rows.find(row=>row.revisionId===payload.previousAttemptRevisionId);
                if(prior?.payload.kind==='learning_work_attempt'&&prior.entityId!==current.entityId&&prior.payload.assignmentRevisionId===payload.assignmentRevisionId&&canonicalJson(prior.payload.paperIssuanceKey)===canonicalJson(payload.paperIssuanceKey))record.previousAttemptRef={state:'known',value:{identity:{...record.identity,nativeKey:prior.entityId},revision:prior.revisionId},evidence:record.provenance};
                else gaps.push({subject:refOf(record),path:'DailyTestAttempt.links.attemptFollows',reason:'UNVERIFIED',requiredEvidence:['ATTEMPT_IDENTITY','NATIVE_RELATION_MAPPING'],evidence:record.provenance});
              }
            }
            records.push(record);observed.delete(current.entityId);
          }catch(error){if(error instanceof TypedReadRefusal)throw error;}
          continue;
        }
        if(payload.kind!=='daily_progress'&&payload.kind!=='previous_homework_assessment'&&payload.kind!=='daily_record_draft')continue;
        const objectType:EducationType=payload.kind==='daily_progress'?'DailyProgress':payload.kind==='previous_homework_assessment'?'PreviousHomeworkAssessment':'DailyRecordDraft';
        const payloadScope=payload.kind==='previous_homework_assessment'?payload.assessmentScope:payload.recordScope;
        const versionLike={scopeRef:payloadScope.studentRef.identity.scopeRef,namespace:payloadScope.studentRef.identity.namespace,entityKey:current.entityId,revisionId:current.revisionId,recordedAt:current.recordedAt};
        const record=this.baseRecord(request,versionLike,objectType);
        if(payload.kind==='daily_progress'){record.recordScope=payload.recordScope;record.contentScope=payload.contentScope;record.progressState=payload.progressState;record.note=payload.note;}
        if(payload.kind==='previous_homework_assessment'){record.recordScope=payload.assessmentScope;record.homeworkRef=payload.homeworkRef;record.outcome=payload.outcome;record.note=payload.note;record.assessedBy=payload.assessedBy;record.assessedAt=payload.assessedAt;}
        if(payload.kind==='daily_record_draft'){record.recordScope=payload.recordScope;record.progressRefs=payload.progressRefs;record.homeworkRefs=payload.homeworkRefs;record.attemptRefs=payload.attemptRefs;record.previousAssessmentRefs=payload.previousAssessmentRefs;record.progressText=payload.progressText;record.homeworkText=payload.homeworkText;record.noteText=payload.noteText;record.responsibleTeacherRef=payload.responsibleTeacherRef;record.draftState=payload.draftState;record.sourceSnapshot=payload.sourceSnapshot;}
        record.corrections=[];records.push(record);
      }
    }
    for(const entityId of observedHomework){if(gaps.some(gap=>gap.sourceUnknown?.kind==='DETACHED_ACTIVITY'&&gap.subject?.identity.nativeKey===entityId))continue;gaps.push({subject:null,path:'HomeworkAssignment.record',reason:'UNVERIFIED',requiredEvidence:['NATIVE_ID_KEY_SCOPE','NATIVE_REVISION_SNAPSHOT'],evidence:[]});}
    for(const entityId of observedAttempts){void entityId;gaps.push({subject:null,path:'DailyTestAttempt.record',reason:'UNVERIFIED',requiredEvidence:['NATIVE_ID_KEY_SCOPE','NATIVE_REVISION_SNAPSHOT','ATTEMPT_IDENTITY'],evidence:[]});}
    if(observedAttempts.size&&request.linkMask.includes('attemptFollows')){
      gaps.push({subject:null,path:'DailyTestAttempt.links.attemptFollows',reason:'UNVERIFIED',requiredEvidence:['ATTEMPT_IDENTITY','NATIVE_RELATION_MAPPING'],evidence:[]});
    }
    // Catalog: project only exact pinnedCatalog-verified revisions. The
    // frozen read view exposes no current-pin enumeration (P4S-DEP-CATALOG),
    // so unpinned nodes and their dependent links stay in the remainder.
    const catalog=await view.catalog(context.ownerId);
    const byId=new Map<string,CatalogNode>();
    const candidates=new Map<string,string>();
    const conflicting=new Set<string>();
    const candidate=(ref:ObjectRef)=>{const id=ref.identity.nativeKey,prior=candidates.get(id);if(prior!==undefined&&prior!==ref.revision)conflicting.add(id);candidates.set(id,ref.revision);};
    for(const record of records){
      const content=record.contentScope as {editionRef:ObjectRef;unitRef:ObjectRef;sectionRefs:Knowledge<ObjectRef[]>}|undefined;
      if(!content)continue;
      for(const ref of [content.editionRef,content.unitRef])if(ref)candidate(ref);
      if(content.sectionRefs?.state==='known')for(const ref of content.sectionRefs.value)candidate(ref);
    }
    // Reused work carries an explicit complete immutable catalog crosswalk, including ancestors.
    for(const rows of sourceRows.values())for(const row of rows)if(row.payload.kind==='learning_work_assignment')for(const pin of row.payload.catalogRefs){const prior=candidates.get(pin.nodeId);if(prior!==undefined&&prior!==pin.revisionId)conflicting.add(pin.nodeId);candidates.set(pin.nodeId,pin.revisionId);}
    const verified=new Map<string,string>();
    if(candidates.size&&typeof view.pinnedCatalog==='function'){
      try{
        const pinned=await view.pinnedCatalog(context.ownerId,[...candidates].map(([nodeId,revisionId])=>({nodeId,revisionId})));
        for(const entry of pinned)if(!conflicting.has(entry.node.id)&&candidates.get(entry.node.id)===entry.revisionId){verified.set(entry.node.id,entry.revisionId);byId.set(entry.node.id,entry.node);}
      }catch{/* unpinned catalog stays unverified remainder */}
    }
    const withheldCatalog=new Set<string>();
    const catalogType=(kind:CatalogNode['kind']):EducationType|null=>kind==='book_edition'?'TextbookEdition':kind==='learning_section'?'Section':['major_unit','middle_unit','minor_unit'].includes(kind)?'Unit':null;
    const refForNode=(node:CatalogNode,objectType:EducationType):ObjectRef=>({identity:{scopeRef:request.scopeRef,namespace:request.scopeRef.basis.namespace,objectType,nativeKey:node.id},revision:verified.get(node.id)!});
    const tracedEdition=(node:CatalogNode):CatalogNode|null=>{
      const seen=new Set<string>();let cursor:CatalogNode|undefined=node;
      while(cursor){if(seen.has(cursor.id))return null;seen.add(cursor.id);if(cursor.kind==='book_edition')return cursor;if(cursor.parent.state!=='known')return null;cursor=byId.get(cursor.parent.value);}
      return null;
    };
    const unitLevel=(kind:CatalogNode['kind']):string=>kind==='major_unit'?'MAJOR':kind==='middle_unit'?'MIDDLE':'MINOR';
    const unitRecords=new Map<string,TypedRecord>();
    const withhold=(node:CatalogNode,objectType:EducationType,path:string)=>{
      withheldCatalog.add(objectType+':'+node.id);
      gaps.push({subject:null,path,reason:'UNVERIFIED',requiredEvidence:['NATIVE_REVISION_SNAPSHOT'],evidence:[]});
    };
    // Retained nodes are the only source of verified payload and ancestry.
    // Current catalog order/labels/parents never get stamped with old pins.
    const projectionCatalog=new Map(catalog.map(node=>[node.id,byId.get(node.id)??node]));
    for(const [id,node] of byId)projectionCatalog.set(id,node);
    const ordered=[...projectionCatalog.values()].sort((a,b)=>{
      const depth=(n:CatalogNode)=>{const seen=new Set<string>();let d=0;while(n.parent.state==='known'&&!seen.has(n.id)){seen.add(n.id);const parent=byId.get(n.parent.value);if(!parent)break;n=parent;d++;}return d;};
      return depth(a)-depth(b)||compareText(a.id,b.id);
    });
    for(const node of ordered){
      const objectType=catalogType(node.kind);if(!objectType)continue;
      if(!verified.has(node.id)){withhold(node,objectType,objectType+'.record');continue;}
      const revision=verified.get(node.id)!,evidence=this.provenance(request.scopeRef,revision,'catalog/'+node.id,request.asOf);
      if(node.kind==='book_edition'){
        const record:TypedRecord={contractVersion:this.fixedProfile.definition.registry.version,typeVersion:this.typeVersion('TextbookEdition'),identity:refForNode(node,'TextbookEdition').identity,revision,asOf:request.asOf,snapshot:request.snapshot,provenance:evidence,title:{state:'known',value:node.label,evidence},editionLabel:unknownKnowledge<string>('UNVERIFIED',['SOURCE_FIELD']),publisher:unknownKnowledge<string>('UNVERIFIED',['SOURCE_FIELD'])};
        records.push(record);continue;
      }
      if(['major_unit','middle_unit','minor_unit'].includes(node.kind)){
        const edition=tracedEdition(node);
        if(!edition||!verified.has(edition.id)){withhold(node,'Unit','Unit.record');continue;}
        const parentNode=node.kind==='major_unit'?null:node.parent.state==='known'?byId.get(node.parent.value):undefined;
        const parentRef=node.kind==='major_unit'?unknownKnowledge<ObjectRef>('NOT_APPLICABLE',['NATIVE_RELATION_MAPPING'],evidence):parentNode&&verified.has(parentNode.id)?{state:'known',value:refForNode(parentNode,'Unit'),evidence} as Knowledge<ObjectRef>:unknownKnowledge<ObjectRef>('UNVERIFIED',['NATIVE_RELATION_MAPPING']);
        const record:TypedRecord={contractVersion:this.fixedProfile.definition.registry.version,typeVersion:this.typeVersion('Unit'),identity:refForNode(node,'Unit').identity,revision,asOf:request.asOf,snapshot:request.snapshot,provenance:evidence,editionRef:refForNode(edition,'TextbookEdition'),level:unitLevel(node.kind),parentUnitRef:parentRef,label:{state:'known',value:node.label,evidence},ordinal:unknownKnowledge<number>('UNVERIFIED',['SOURCE_FIELD'])};
        records.push(record);unitRecords.set(node.id,record);continue;
      }
      // learning_section: immediate parent may be MAJOR, MIDDLE or MINOR Unit.
      const edition=tracedEdition(node);
      const parent=node.parent.state==='known'?byId.get(node.parent.value):undefined;
      if(!edition||!verified.has(edition.id)||!parent||!unitRecords.has(parent.id)){withhold(node,'Section','Section.record');continue;}
      if(this.consumerProfile==='OLD_SECTION_1_0'&&parent.kind!=='minor_unit'){withheldCatalog.add('Section:'+node.id);gaps.push({subject:refForNode(node,'Section'),path:'Section.unitRef',reason:'UNVERIFIED',requiredEvidence:['EDITION_UNIT_SECTION_CHAIN'],evidence});continue;}
      const record:TypedRecord={contractVersion:this.fixedProfile.definition.registry.version,typeVersion:this.typeVersion('Section'),identity:refForNode(node,'Section').identity,revision,asOf:request.asOf,snapshot:request.snapshot,provenance:evidence,editionRef:refForNode(edition,'TextbookEdition'),unitRef:refForNode(parent,'Unit'),label:{state:'known',value:node.label,evidence},ordinal:unknownKnowledge<number>('UNVERIFIED',['SOURCE_FIELD'])};
      records.push(record);
    }
    // Named links only when both endpoints resolve by full identity and
    // exact revision to projected records; otherwise explicit remainder.
    const byIdentity=new Map(records.map(record=>[identityKey(record.identity),record]));
    const seenLinks=new Set<string>();
    const emitLink=(linkType:TypedLinkType,from:TypedRecord,toRef:ObjectRef,validFrom:string,provenance:EvidenceRef[],interval?:{validThrough:Knowledge<string>;nativeKey:Knowledge<string>})=>{
      if(!request.linkMask.includes(linkType)||!studentRelationInPlan(linkType,refOf(from),toRef))return;
      const target=byIdentity.get(identityKey(toRef.identity));
      if(!target||target.revision!==toRef.revision){
        gaps.push({subject:refOf(from),path:'links.'+linkType,reason:'UNVERIFIED',requiredEvidence:['NATIVE_RELATION_MAPPING'],evidence:provenance});return;
      }
      const dedup=linkType+':'+identityKey(from.identity)+'->'+identityKey(toRef.identity)+':'+validFrom;
      if(seenLinks.has(dedup))return;seenLinks.add(dedup);
      links.push({linkType,linkVersion:this.linkVersion(linkType),nativeRelationKey:interval?.nativeKey??unknownKnowledge<string>('UNVERIFIED',['NATIVE_RELATION_MAPPING']),fromRef:refOf(from),toRef,revision:from.revision,snapshot:request.snapshot,validFrom,validThrough:interval?.validThrough??unknownKnowledge<string>('UNVERIFIED',['NATIVE_RELATION_MAPPING']),provenance});
    };
    for(const record of lessonRecords){
      const date=String(record.businessDate);
      emitLink('lessonOfClass',record,record.classGroupRef as ObjectRef,date,record.provenance);
      const teacherRefs=record.teacherRefs as Knowledge<ObjectRef[]>;
      if(teacherRefs.state==='known')for(const toRef of teacherRefs.value)emitLink('lessonTaughtBy',record,toRef,date,record.provenance);
      else if(request.linkMask.includes('lessonTaughtBy'))gaps.push({subject:refOf(record),path:'links.lessonTaughtBy',reason:teacherRefs.reason,requiredEvidence:['NATIVE_RELATION_MAPPING'],evidence:[]});
      const participantRefs=record.participantRefs as Knowledge<ObjectRef[]>;
      if(participantRefs.state==='known')for(const toRef of participantRefs.value)emitLink('lessonHasStudent',record,toRef,date,record.provenance);
      else if(request.linkMask.includes('lessonHasStudent'))gaps.push({subject:refOf(record),path:'links.lessonHasStudent',reason:participantRefs.reason,requiredEvidence:['NATIVE_RELATION_MAPPING'],evidence:participantRefs.evidence});
    }
    for(const record of records){
      if(record.identity.objectType==='Unit'){
        emitLink('unitInEdition',record,record.editionRef as ObjectRef,request.temporalSelection.businessDate,record.provenance);
        const parent=record.parentUnitRef as Knowledge<ObjectRef>;
        if(parent.state==='known')emitLink('unitParent',record,parent.value,request.temporalSelection.businessDate,record.provenance);
      }
      if(record.identity.objectType==='Section'){
        emitLink('sectionInEdition',record,record.editionRef as ObjectRef,request.temporalSelection.businessDate,record.provenance);
        emitLink('sectionInUnit',record,record.unitRef as ObjectRef,request.temporalSelection.businessDate,record.provenance);
      }
      const scope=record.recordScope as {studentRef:ObjectRef;classGroupRef:ObjectRef;lessonRef:ObjectRef;businessDate:string}|undefined;
      if(scope&&(record.identity.objectType==='HomeworkAssignment'||record.identity.objectType==='DailyTestAttempt'||record.identity.objectType==='DailyProgress'||record.identity.objectType==='PreviousHomeworkAssessment'||record.identity.objectType==='DailyRecordDraft')){
        emitLink('activityForStudent',record,scope.studentRef,scope.businessDate,record.provenance);
        emitLink('activityInClass',record,scope.classGroupRef,scope.businessDate,record.provenance);
        emitLink('activityInLesson',record,scope.lessonRef,scope.businessDate,record.provenance);
      }
      if(['DailyProgress','HomeworkAssignment','DailyTestAttempt'].includes(record.identity.objectType)){
        const content=record.contentScope as {editionRef:ObjectRef;unitRef:ObjectRef;sectionRefs:Knowledge<ObjectRef[]>};
        emitLink('activityUsesEdition',record,content.editionRef,scope!.businessDate,record.provenance);
        emitLink('activityUsesUnit',record,content.unitRef,scope!.businessDate,record.provenance);
        if(content.sectionRefs.state==='known')for(const toRef of content.sectionRefs.value)emitLink('activityUsesSection',record,toRef,scope!.businessDate,record.provenance);
      }
      if(record.identity.objectType==='DailyTestAttempt'){const previous=record.previousAttemptRef as Knowledge<ObjectRef>;if(previous.state==='known')emitLink('attemptFollows',record,previous.value,scope!.businessDate,record.provenance);}
      if(record.identity.objectType==='PreviousHomeworkAssessment'){
        emitLink('assessmentOfHomework',record,record.homeworkRef as ObjectRef,scope!.businessDate,record.provenance);
        const assessedBy=record.assessedBy as Knowledge<ObjectRef>;
        if(assessedBy.state==='known')emitLink('assessmentByTeacher',record,assessedBy.value,scope!.businessDate,record.provenance);
      }
      if(record.identity.objectType==='DailyRecordDraft'){
        const lists:[TypedLinkType,Knowledge<ObjectRef[]>][]=[['draftProgress',record.progressRefs as Knowledge<ObjectRef[]>],['draftHomework',record.homeworkRefs as Knowledge<ObjectRef[]>],['draftAttempts',record.attemptRefs as Knowledge<ObjectRef[]>],['draftPreviousAssessments',record.previousAssessmentRefs as Knowledge<ObjectRef[]>]];
        for(const [linkType,knownRefs] of lists)if(knownRefs.state==='known')for(const toRef of knownRefs.value)emitLink(linkType,record,toRef,scope!.businessDate,record.provenance);
        const responsible=record.responsibleTeacherRef as Knowledge<ObjectRef>;
        if(responsible.state==='known')emitLink('draftResponsibleTeacher',record,responsible.value,scope!.businessDate,record.provenance);
      }
    }
    const businessDate=request.temporalSelection.businessDate;
    for(const version of temporalVersions){
      const payload=version.payload;
      const linkType:TypedLinkType|null=payload.bindingKind==='CLASS_MEMBERSHIP'||payload.bindingKind==='ENROLLMENT'?'studentMemberOfClass':payload.bindingKind==='TEACHING_ASSIGNMENT'?'classTaughtBy':payload.bindingKind==='LESSON_PARTICIPATION'?'lessonHasStudent':null;
      // Candidate edges still witness the horizon, but only the registered
      // student-occurrence tuples require projected endpoint evidence.
      if(!linkType||!request.linkMask.includes(linkType)||!studentRelationInPlan(linkType,payload.subjectRef,payload.targetRef))continue;
      const provenance=this.provenance(version.scopeRef,version.revisionId,'temporalBinding/'+version.entityKey,version.recordedAt);
      const interval=projectLinkInterval(payload.validFrom,payload.validTo,provenance);
      const through=interval.validThrough;
      const inRange=businessDate>=payload.validFrom&&(through.state==='known'?businessDate<=through.value:through.reason==='NOT_APPLICABLE'?true:false);
      if(through.state==='unknown'&&through.reason==='UNVERIFIED'){
        gaps.push({subject:payload.subjectRef,path:'links.'+linkType,reason:'UNVERIFIED',requiredEvidence:['NATIVE_RELATION_MAPPING'],evidence:[]});
      }
      if(!inRange&&!(through.state==='unknown'&&through.reason==='UNVERIFIED'))continue;
      const fromRecord=byIdentity.get(identityKey(payload.subjectRef.identity));
      const toRecord=byIdentity.get(identityKey(payload.targetRef.identity));
      if(!fromRecord||!toRecord||toRecord.revision!==payload.targetRef.revision||fromRecord.revision!==payload.subjectRef.revision){
        gaps.push({subject:payload.subjectRef,path:'links.'+linkType,reason:'UNVERIFIED',requiredEvidence:['NATIVE_RELATION_MAPPING'],evidence:provenance});continue;
      }
      const dedup=linkType+':'+identityKey(payload.subjectRef.identity)+'->'+identityKey(payload.targetRef.identity)+':'+payload.validFrom;
      if(seenLinks.has(dedup))continue;seenLinks.add(dedup);
      links.push({linkType,linkVersion:this.linkVersion(linkType),nativeRelationKey:{state:'known',value:version.entityKey,evidence:provenance},fromRef:payload.subjectRef,toRef:payload.targetRef,revision:version.revisionId,snapshot:request.snapshot,validFrom:payload.validFrom,validThrough:through,provenance});
    }
    records.sort((a,b)=>compareText(identityKey(a.identity),identityKey(b.identity)));
    links.sort((a,b)=>compareText(a.linkType+':'+identityKey(a.fromRef.identity)+'->'+identityKey(a.toRef.identity),b.linkType+':'+identityKey(b.fromRef.identity)+'->'+identityKey(b.toRef.identity)));
    return {records,links,gaps,withheldCatalog,observedHomework,observedAttempts};
  }
}
export function createNativeTypedRead(store:TeacherPrerequisiteStore,ownerId:string,options:NativeTypedReadOptions={}):NativeTypedRead{
  return new NativeTypedReadService(store,ownerId,options);
}
export {previousDay} from './contracts/prerequisiteRecords';



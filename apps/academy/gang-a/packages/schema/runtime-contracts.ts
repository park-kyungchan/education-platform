import {z} from 'zod';
import {Snapshot,LearningView,RecordView} from './v1/progress-view.ts';
import {EvidenceProjection} from './v1/evidence-projection.ts';
import {TeacherOverlaySchema} from './v1/teacher-overlay.ts';
import {Receipt} from '../security/context/governance-model.ts';
const Id=z.string().min(1),Hash=z.string().regex(/^[a-f0-9]{64}$/),Hashes=z.record(Id,Hash),NullableHashes=z.record(Id,Hash.nullable());
export const Packed=z.strictObject({gzipBase64:z.string().min(1),sha256:Hash});
export const InitRequest=z.strictObject({});
export const SelectRequest=z.strictObject({studentId:Id,expectedRegistrySha256:Hash,expectedRosterRevision:z.union([z.string(),z.number()]),expectedSnapshotSha256:Hash,expectedTeacherOverlaySha256:Hash.nullable(),expectedGradingProjectionSha256:Hash,expectedEvidenceProjectionSha256:Hash,expectedDomainContractSha256:Hash});
const Enrollment=z.strictObject({id:Id,courseTitle:z.string(),validFrom:z.string().nullable(),validTo:z.string().nullable(),status:z.string()});
export const SelectedStudent=z.strictObject({id:Id,pageId:Id,enrollments:z.array(Enrollment)});
const NavigationStudent=z.strictObject({id:Id,displayName:z.string(),managementState:z.enum(['active','unknown','withdrawn'])});
const SnapshotMetadata=z.strictObject({projectionSha256:Hash,sourceHash:Hash,allowedEntityIds:z.array(Id),enrollmentIds:z.array(Id),teacherOverlayProjectionSha256:Hash.nullable(),teacherOverlaySourceSha256:Hash.nullable(),teacherOverlayRevision:Id.nullable(),teacherOverlayEntityIds:z.array(Id),gradingProjectionSha256:Hash,gradingPolicySha256:Hash,evidenceProjectionSha256:Hash,evidenceSourcePlanSha256:Hash.nullable(),namespaceBindingSha256:Hash,evidenceEntityIds:z.array(Id)});
export const RosterIndex=z.strictObject({students:z.array(NavigationStudent),snapshotMeta:z.record(Id,SnapshotMetadata),rosterRevision:z.union([z.number(),z.string()]),rosterSourceSha256:Hash,bundleBuiltAt:z.string()});
const SourceReference=z.strictObject({evidenceLevel:z.string(),fileSha256:Hash,jsonPointer:z.string()});
const Included=z.strictObject({sourceRecordKey:Id,printedSourceLabel:z.string(),bookCode:z.string().optional(),edition:z.union([z.string(),z.number()]).optional(),unitLabel:z.string(),unitTitle:z.string(),tocNodeRef:Id,historicalFrozenRecord:RecordView,sourceSnapshotSha256:Hash,countsAsIndependentProgress:z.literal(false),countsAsIndependentCompletionDenominator:z.literal(false),inclusionState:z.literal('user_reported_final_lesson_subcontent'),inclusionEvidence:z.strictObject({sourceKind:z.literal('user_report'),actor:z.literal('user'),reportedAt:z.string(),observedAt:z.null(),capturedAt:z.null(),verificationStatus:z.literal('unverified'),statementProvenanceConfirmed:z.literal(true)}),sourceMessageId:Id,sourceMessageAt:z.string(),parentSourceRecordId:Id.nullable(),parentNativeEntityId:z.null(),parentCatalogCode:Id.nullable(),parentLessonIndex:z.number().int().positive().nullable(),nativeBindingState:z.enum(['imported_catalog_code_and_user_reported_inclusion','pending_native_last_lesson_binding']),serverIncludedContentObserved:z.literal(false),catalogEvidence:z.strictObject({sourceKind:z.literal('imported_snapshot'),sourceRef:SourceReference,observedAt:z.null(),capturedAt:z.null(),verificationStatus:z.literal('corroborated'),verificationDetail:z.literal('catalog_code_only_in_imported_snapshot_not_server_inclusion')}).nullable()});
export const GradingProjection=z.strictObject({version:z.literal('1.0.0'),policyId:Id,sourceSnapshotSha256:Hash,view:LearningView,includedContents:z.array(Included),excludedStandaloneRecordIds:z.array(Id),completionDenominator:z.null(),studentId:Id});
export const SelectedPayload=z.strictObject({snapshot:Snapshot,selectedStudent:SelectedStudent,teacherOverlay:TeacherOverlaySchema.nullable(),gradingProjection:GradingProjection,evidenceProjection:EvidenceProjection});
export const WorkerConfigSchema=z.strictObject({domainContractText:z.string(),domainContractSha256:Hash,origin:z.string().url(),ownerEmailSha256:Hash,authBoundary:z.strictObject({kind:z.string(),projectId:Id,revision:z.number().int().positive(),soleOwner:z.boolean(),allowedNonOwnerUsers:z.number().int().nonnegative(),allowedGroups:z.number().int().nonnegative(),externalVisitors:z.number().int().nonnegative(),verifiedAt:z.string()}),registryText:z.string(),registrySha256:Hash,contractTexts:z.record(Id,z.string()),contractLocators:z.record(Id,z.strictObject({version:Id,pageId:Id,reference:Id})),defaultStudentId:Id,approvedStudentIds:z.array(Id),rosterRevision:Id,protectedIndex:Packed,snapshots:z.record(Id,Packed),shellHtml:z.string(),capabilityEnabled:z.boolean()});
export const DomainReceipt=z.strictObject({contractVersion:z.literal('academy.evidence/1.1.0'),contractSha256:Hash,fullContractByteHashVerified:z.literal(true),runtimeSchemaValidated:z.literal(true),namespaceBindingValidated:z.literal(true),evidenceProjectionSha256:Hash,namespaceBindingSha256:Hash,studentId:Id,contextScopeFingerprint:Hash,parsedEvidenceCount:z.number().int().nonnegative(),parsedDecisionCount:z.number().int().nonnegative(),externalSourceQueried:z.literal(false)});
export const StudentResponse=z.strictObject({status:z.literal('success'),studentId:Id,...SelectedPayload.shape,domainReceipt:DomainReceipt,receipt:Receipt,navigationReceipt:Receipt,bootstrapReceipt:Receipt,scope:z.strictObject({studentId:Id,sourceRevisions:z.record(Id,z.string()),projectionSha256:Hash,teacherOverlayProjectionSha256:Hash.nullable(),gradingProjectionSha256:Hash,evidenceProjectionSha256:Hash}),meta:z.strictObject({students:z.array(NavigationStudent),rosterRevision:z.union([z.number(),z.string()]),registrySha256:Hash,snapshotProjectionSha256:Hashes,teacherOverlayProjectionSha256:NullableHashes,gradingProjectionSha256:Hashes,evidenceProjectionSha256:Hashes,domainContractSha256:Hash,bundleBuiltAt:z.string(),sourceMode:z.literal('saved_snapshot'),liveRefreshConnected:z.literal(false)}),verification:z.strictObject({contextGatePassed:z.literal(true),navigationGatePassed:z.literal(true),authenticatedOwnerPrivateDispatch:z.literal(true),fullContractByteHashVerified:z.literal(true),contractCount:z.number().int().nonnegative(),platformPromptHook:z.literal(false),externalSourceQueried:z.literal(false)})});
export type WorkerConfig=z.infer<typeof WorkerConfigSchema>;
export type StudentResponse=z.infer<typeof StudentResponse>;
export type GradingProjection=z.infer<typeof GradingProjection>;
export type DomainReceipt=z.infer<typeof DomainReceipt>;

export type Packed=z.infer<typeof Packed>;
/** Stable failure codes retained during v1 migration. No values from the
 * invalid payload are returned to the client or used as authorization. */
export function responseSchemaFailure(issues:readonly {path:readonly PropertyKey[]}[]):string{
 const paths=issues.map(issue=>issue.path.map(String).join('.'));
 if(paths.some(p=>p.startsWith('navigationReceipt')||p.startsWith('verification.navigationGatePassed')))return 'navigation_receipt_required';
 if(paths.some(p=>p.startsWith('meta.teacherOverlayProjectionSha256')||p.startsWith('scope.teacherOverlayProjectionSha256')))return 'teacher_overlay_pin_required';
 if(paths.some(p=>p.startsWith('teacherOverlay')))return 'teacher_overlay_scope_mismatch';
 if(paths.some(p=>p.startsWith('evidenceProjection')||p.startsWith('domainReceipt')))return 'evidence_schema_namespace_receipt_required';
 return 'protected_response_schema_or_receipt_invalid';
}
export function assertRosterIndex(input:unknown):asserts input is z.infer<typeof RosterIndex>{RosterIndex.parse(input);}
export function assertSelectedPayload(input:unknown):asserts input is z.infer<typeof SelectedPayload>{SelectedPayload.parse(input);}

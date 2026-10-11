import {z} from 'zod';
import {Instant, Sha256} from './ids.ts';
import {EvidenceActor, EvidenceSourceRef} from './evidence.ts';

export const OperationalId=z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/).max(160).brand<'OperationalId'>();
export type OperationalId=z.infer<typeof OperationalId>;
export const OperationalRevision=Sha256.brand<'OperationalRevision'>();
export type OperationalRevision=z.infer<typeof OperationalRevision>;
export const OPERATIONAL_SCHEMA_VERSION='academy.operations/1.1.0' as const;
export const DomainKind=z.enum(['administration','middle_school','elementary_school','teaching_coaching']);
export const KnowledgeState=z.enum(['user_confirmed','source_described','observed_structure','recommendation','unknown']);
export const Lifecycle=z.enum(['active','historical','superseded','expired','deferred']);
export const InvestigationStatus=z.enum(['resolved','partially_resolved','open','blocked_on_verified_source','conditional','current_state_check','deferred_admin','awaiting_source','deferred_by_user','human_judgment_only','automation_deferred','resolved_reference']);
export const ActionKind=z.enum(['read_reference','prepare','teacher_judgment','system_entry','communicate','submit','handoff','physical_execution']);
export const CompletionAxis=z.enum(['prepared','executed','transmitted','received','recorded']);
const text=z.string().min(1), ids=z.array(OperationalId);
const common={id:OperationalId,labelRaw:text,sourceAnchorIds:ids};
const condition=z.strictObject({labelRaw:text,state:z.enum(['required','unconfirmed','not_applicable'])});
export const OperationTrigger=z.discriminatedUnion('kind',[
 z.strictObject({kind:z.literal('weekly'),weekday:z.enum(['monday']),time:z.string().regex(/^\d{2}:\d{2}$/).nullable(),timeZone:z.literal('Asia/Seoul')}),
 z.strictObject({kind:z.literal('monthly_window'),fromDay:z.literal(1),throughDay:z.literal(7),forPeriod:z.literal('previous_month'),timeZone:z.literal('Asia/Seoul')}),
 z.strictObject({kind:z.literal('yearly_month'),month:z.literal(9),exactDate:z.null(),timeZone:z.literal('Asia/Seoul')}),
 z.strictObject({kind:z.literal('event'),labelRaw:text}),
 z.strictObject({kind:z.literal('historical'),labelRaw:text}),
 z.strictObject({kind:z.literal('unconfirmed'),labelRaw:text})
]);
export const Policy=z.strictObject({...common,kind:z.literal('policy'),domain:DomainKind,
 knowledge:KnowledgeState,lifecycle:Lifecycle,obligation:z.enum(['source_requirement','user_operating_standard','optional','historical_only','deferred']),
 applicability:z.strictObject({kind:z.enum(['academy','assigned_program','selected_teacher','reference']),status:text,activationRaw:text,requiresActualAssignment:z.boolean()}),
 trigger:OperationTrigger,supplementalTriggers:z.array(OperationTrigger),cadenceRaw:text,deadlineRaw:text,scopeRaw:text,responsibilityRaw:text,ownerRoleIds:ids,
 preconditions:z.array(condition),exceptions:z.array(text),stepIds:ids,investigationIds:ids,
 completionRequirements:z.array(z.strictObject({axis:CompletionAxis,requirementRaw:text})),
 suppliedCompletionClaims:z.array(z.strictObject({labelRaw:text,statementRaw:text,applicability:z.literal('historical_source_only').optional(),independentlyVerifiedHere:z.literal(false)})),
 automation:z.enum(['preparation_only','human_judgment_required','conditional','deferred','historical_only']),
 executionAuthority:z.literal('not_granted_by_context')});
export type Policy=z.infer<typeof Policy>;
export const Step=z.strictObject({...common,kind:z.literal('step'),policyId:OperationalId,order:z.number().int().nonnegative(),actionKind:ActionKind,ownerRoleId:OperationalId,executionAuthority:z.literal('not_granted_by_context')});
export const Role=z.strictObject({...common,kind:z.literal('role')});
export const Artifact=z.strictObject({...common,kind:z.literal('artifact'),axes:z.array(CompletionAxis).min(1),studentRecordsBundled:z.literal(false)});
export const Concept=z.strictObject({...common,kind:z.literal('concept'),meaningRaw:text,existingDomain:z.enum(['assessment','assignment','book','delivery','teacher_outcome','none'])});
export const Reference=z.strictObject({...common,kind:z.literal('reference'),sourceFile:text,adoption:z.enum(['reference_only','user_confirmed_scope','observed_structure']),liveAdapterVerified:z.literal(false)});
export const Domain=z.strictObject({...common,kind:z.literal('domain'),domain:DomainKind});
export const Root=z.strictObject({...common,kind:z.literal('academy_root')});
export const OperationNode=z.discriminatedUnion('kind',[Root,Domain,Policy,Step,Role,Artifact,Concept,Reference]);
export type OperationNode=z.infer<typeof OperationNode>;
const edge={id:OperationalId,from:OperationalId,to:OperationalId,sourceAnchorIds:ids};
export const OperationRelation=z.discriminatedUnion('kind',[
 z.strictObject({...edge,kind:z.literal('contains'),order:z.number().int().nonnegative()}),
 z.strictObject({...edge,kind:z.literal('precedes')}),
 z.strictObject({...edge,kind:z.literal('depends_on')}),
 z.strictObject({...edge,kind:z.literal('performed_by_role')}),
 z.strictObject({...edge,kind:z.literal('produces_artifact')}),
 z.strictObject({...edge,kind:z.literal('reported_to_role')}),
 z.strictObject({...edge,kind:z.literal('uses_reference')}),
 z.strictObject({...edge,kind:z.literal('uses_concept')}),
 z.strictObject({...edge,kind:z.literal('related_policy')})
]);
export type OperationRelation=z.infer<typeof OperationRelation>;
export const SourceAnchor=z.strictObject({id:OperationalId,inputRevisionSha256:Sha256.optional(),statementProvenance:z.enum(['user_verbatim','user_paraphrase','source_description','assistant_inference']).optional(),kind:z.enum(['assistant_inference','line_excerpt','user_statement','verified_transcription','ui_structure','source_metadata']),sourceAlias:text,
 sourceRef:EvidenceSourceRef.extend({sourceMessageId:z.null(),reference:text,sha256:Sha256,jsonPointer:text}),actor:EvidenceActor.extend({id:z.null()}),
 locator:z.discriminatedUnion('kind',[
  z.strictObject({kind:z.literal('lines'),sourceAlias:text,from:z.number().int().positive(),through:z.number().int().positive()}),
  z.strictObject({kind:z.literal('coordinate'),labelRaw:text}),
  z.strictObject({kind:z.literal('pointer'),jsonPointer:text})
 ]),dateRaw:z.string().nullable(),reportedAt:Instant.nullable(),observedAt:Instant.nullable(),capturedAt:Instant.nullable(),
 assertionRaw:text,sourceKindRaw:text,verification:z.literal('supplied_checkpoint_lineage'),supersedesAnchorIds:ids,
 provesLiveStudentRetrieval:z.literal(false),executionAuthority:z.literal('not_granted_by_context')}).superRefine((a,c)=>{
 if(a.locator.kind==='lines'&&(a.locator.from>a.locator.through||a.locator.sourceAlias!==a.sourceAlias))c.addIssue({code:'custom',message:'invalid_source_line_locator'});
 if(a.statementProvenance==='assistant_inference'&&(a.kind!=='assistant_inference'||a.actor.kind!=='assistant'||a.observedAt!==null||a.capturedAt!==null))c.addIssue({code:'custom',message:'inference_not_user_confirmation'});
 if(['user_verbatim','user_paraphrase'].includes(a.statementProvenance??'')&&a.kind!=='user_statement')c.addIssue({code:'custom',message:'user_provenance_requires_user_statement'});
 if(a.kind==='assistant_inference'&&a.statementProvenance!=='assistant_inference')c.addIssue({code:'custom',message:'inference_provenance_required'});
 if(a.kind==='user_statement'&&a.statementProvenance!==undefined&&!['user_verbatim','user_paraphrase'].includes(a.statementProvenance))c.addIssue({code:'custom',message:'user_statement_cannot_be_source_description_or_inference'});
 if(a.kind==='user_statement'&&(a.observedAt!==null||a.capturedAt!==null||a.actor.kind!=='user'))c.addIssue({code:'custom',message:'user_statement_not_tool_observation'});
});
export type SourceAnchor=z.infer<typeof SourceAnchor>;
export const Investigation=z.strictObject({...common,resolution:z.strictObject({confirmedFacts:z.array(text).min(1),remainingUnknowns:z.array(text).min(1),followupMode:z.literal('when_relevant_source_check'),mandatoryInterview:z.literal(false)}).optional(),status:InvestigationStatus,route:z.enum(['user_only','source_document','administrator','tool','optional_design']),priority:z.enum(['high','normal','low','deferred']),policyIds:ids,questionRaw:text,closureConditionRaw:text,knownDoNotReask:z.array(text),neededArtifacts:z.array(text),activationRaw:z.string().nullable(),doNotSendAgain:z.boolean(),executionAuthority:z.literal('not_granted_by_context')}).superRefine((q,c)=>{if(q.status==='partially_resolved'&&(!q.resolution||!q.doNotSendAgain))c.addIssue({code:'custom',message:'partial_resolution_requires_known_unknown_and_no_repeat'});if(q.status!=='partially_resolved'&&q.resolution)c.addIssue({code:'custom',message:'partial_resolution_status_required'});});
export type Investigation=z.infer<typeof Investigation>;
export const LbadReference=z.strictObject({referenceId:OperationalId,criteria:z.array(z.strictObject({column:z.number().int().min(1).max(8),label:text})).length(8),levels:z.array(z.strictObject({row:z.number().int().min(1).max(5),label:text,printedPoints:z.number()})).length(5),cells:z.array(z.strictObject({row:z.number().int().min(1).max(5),column:z.number().int().min(1).max(8),exactText:text,readableText:text})).length(40),footnotes:z.array(z.strictObject({index:z.number().int().min(1).max(3),exactText:text})).length(3),overallLevelRule:z.literal('minimum_of_eight_teacher_selected_levels'),videoStars:z.literal('separate_teacher_judgment_using_whole_lbad'),totalAutomation:z.literal('deferred'),percentageBoundary:z.literal('upper_interval_at_60_70_80'),sourceAnchorIds:ids});
export const StReference=z.strictObject({referenceId:OperationalId,functionalTerm:z.literal('풀이전략'),publisherExpansion:z.literal('StoryTelling'),rules:z.array(z.strictObject({id:OperationalId,knowledge:KnowledgeState,strengthRaw:text,ruleRaw:text,boundaryRaw:text,sourceAnchorIds:ids})).length(9),marks:z.array(z.strictObject({id:OperationalId,shapeRaw:text,meaningRaw:text,localAdoption:z.literal('unconfirmed')})).length(4),exampleForms:z.array(z.array(text)).length(6),awardInvestigationId:OperationalId,unknowns:z.array(z.strictObject({id:OperationalId,topicRaw:text,neededBeforeRaw:text,priorityRaw:text,automaticQuestionAllowed:z.literal(false)})),publisherClaims:z.array(z.strictObject({assertionRaw:text,verification:z.literal('not_verified'),boundaryRaw:text,sourceAnchorIds:ids})),sourceAnchorIds:ids});
export const CismReference=z.strictObject({referenceId:OperationalId,submission:z.strictObject({weekday:z.literal('monday'),time:z.null(),timeZone:z.literal('Asia/Seoul')}),reportingWeek:z.strictObject({from:z.literal('sunday'),through:z.literal('saturday')}),classAtmosphereOptions:z.array(text),studentColumns:z.array(text).length(5),editableMetrics:z.array(z.strictObject({label:text,unit:z.enum(['%','점'])})),narrativeFields:z.array(text).length(8),videoCountsOnlyAfterTeacherRating:z.literal(true),weeklyTest:z.literal('only_when_that_week_has_a_DT_issue'),scoreDefault:z.null(),writeMapping:z.literal('unverified'),reportGeneration:z.literal('unverified'),sourceAnchorIds:ids});
export const MonthlyReference=z.strictObject({referenceId:OperationalId,examMinutes:z.literal(100),correction:z.literal('student_led_havruta_after_exam'),rules:z.array(z.strictObject({textRaw:text,confidenceRaw:text,uncertaintyRaw:z.string().nullable(),authority:z.literal('reference_only'),sourceAnchorIds:ids})),cycle:z.array(z.strictObject({order:z.number().int().positive(),transcription:z.array(text),sourceAnchorIds:ids})).length(4),handwrittenInstitutionWideAuthority:z.literal('unconfirmed'),numericGradingRubric:z.literal('awaiting_source'),sourceAnchorIds:ids});
export const KutReference=z.strictObject({referenceId:OperationalId,teacherScope:z.literal('receive_application_and_handoff_to_vice_director'),anonymousForm:z.strictObject({examDate:text,subjects:z.array(z.strictObject({subject:text,eligibleGradesRaw:text,startTimeRaw:text,durationMinutes:z.number().int().positive()})),printedFeeRaw:text,feeInterpretationRaw:text,venueRaw:text,applicationDeadline:z.null(),resultAnnouncementRaw:text,fieldsPresenceOnly:z.array(text)}),registrationVerified:z.literal(false),originalFormBundled:z.literal(false),sourceAnchorIds:ids});
export const CertificationCatalogReference=z.strictObject({referenceId:OperationalId,sourceAnchorIds:ids,method:z.literal('POST'),endpointName:z.literal('TestPageListGrpServlet'),processes:z.tuple([z.literal('Main'),z.literal('Search')]),commandParameter:z.literal('p_process'),headers:z.array(text).length(6),requestParameterNames:z.array(text).length(11),responseKind:z.literal('test_paper_catalog'),filterEcho:z.literal('ambiguous_explicit_selection'),studentResults:z.literal('not_observed'),exactBookFinalBinding:z.literal('not_observed'),resultMenuEndpointName:z.literal('MarksResultDigestServlet'),resultMenuResponseObserved:z.literal(false),questionCountEstablishesScoreMaximum:z.literal(false),retestLabelEstablishesRetryPolicy:z.literal(false),liveTransport:z.literal('unavailable')});

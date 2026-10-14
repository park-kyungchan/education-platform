/** Separate source semantics, student evidence and exact teacher judgments. */
export const teacherConceptEvidenceContract={
 schema:'academy.teacher-concept-evidence-contract.v1',
 actualUserDecision:{projectId:'academy-workbench',sourcePath:'context/user-context/sources/source-excerpts.json',sourceKey:'Sentinel_2d097f6bc2f881919a3493c6915786e3',meaning:'Map student learning evidence to atomic mathematical concepts and provide a visual knowledge graph.'},
 inspectedResearchSource:{
  projectId:'math-research-module',commit:'4d66eec0cf058a87f788b28d7cda2e845674524c',
  path:'src/components/generated/MathData.ts',sha256:'d04dc6687d5ff9ec001cda9e177263673f368160f1d7d5d00f7d6d5bb1a8fcee',
  classification:'organizational_and_authored_task_proposals_not_verified_atomic_concepts_or_student_diagnosis',
  taskTypes:151,coreTaskTypes:105,connectedTaskTypes:46,capabilityCandidates:28,
  sourceOriginalsRemainWithOwner:true,semanticPromotion:false,
 },
 identities:{atomicConcept:'explicit_academy_atomic_concept_namespace',researchTask:'distinct_research_task_identity',capabilityCandidate:'distinct_capability_identity',studentEvidence:'exact_owner_student_and_source_revision',link:'derived_exact_evidence_revision_and_concept_revision_pair'},
 reviews:{
  definition:'exact_definition_digest_and_curriculum_edition_plus_separate_domain_source_review',
  relationship:'explicit_authenticated_teacher_judgment_for_exact_evidence_and_concept_revision',
  candidate:'retains_unverified_basis_and_unknowns',
  contradiction:'new_attributable_revision_preserves_prior_supported_and_candidate_history',
  noAutomaticTransfer:'new_evidence_or_definition_revision_never_inherits_prior_teacher_judgment',
 },
 knowledge:{scoresDoNotEstablishMastery:true,relationshipDoesNotEstablishCausality:true,taskLabelsDoNotEstablishAtomicity:true,missingMappingIsUnknown:true,unknownCurriculumEditionPreserved:true},
 output:'protected_student_graph_with_original_evidence_drilldown_and_separate_definition_and_relationship_states',
 currentScope:'pure_typed_projection_and_synthetic_validation',
 pending:['authenticated_owner_workspace_persistence_and_transactional_source_scope','private_teacher_graph_UI','real_source_candidate_catalog_and_exact_evidence_adapter','independent_source_review_and_native_browser_verification'],
 effects:{sourceAcademyWrites:false,parentSend:false,teacherJudgmentsAuthoredByAgent:false,domainAcceptanceInferred:false},
} as const;

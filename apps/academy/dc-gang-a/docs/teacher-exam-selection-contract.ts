/** Source-grounded product contract; no personal originals or item payloads are published here. */
export const teacherExamSelectionContract = {
  schema: 'academy.teacher-exam-selection-contract.v1',
  source: {
    projectId: 'academy-workbench',
    path: 'context/user-context/sources/source-excerpts.json',
    sha256: '643a3a4c53e3bcd0fdf19504e0c578f32692d40d9599f3a835e3e2a0df981cc9',
    sourceKeys: ['Sentinel_6c10c77b7ee48191a65771fbde707150', 'Sentinel_2aea7acc8ff8819182a0af4fc465c1fe'],
  },
  acceptedRequirement: {
    questions: 24, responseMode: 'constructed_response', totalPoints: 100,
    pointBands: [{points: 3, questions: 12}, {points: 5, questions: 8}, {points: 6, questions: 4}],
    localStartTime: '15:00', durationMinutes: 80, afterExam: 'grading_then_peer_havruta_until18:00',
    exactDate: 'unknown_in_original', timeZone: 'unknown_in_original',
  },
  rejectedAsUnacceptedProposal: {allocation: [9, 9, 6], role: 'historical_proposal_only'},
  sourceIdentity: 'namespaced_original_item_key_and_exact_candidate_revision',
  sourceContent: 'private_retained_or_independently_qualified_read_only_acquisition',
  inspectableUnknowns: ['edition', 'content', 'answer', 'difficulty', 'response_mode', 'exam_date', 'time_zone'],
  readiness: 'complete_declared_candidate_fields_and_exact_bands_then_ready_for_teacher_review',
  sourceQualification: 'separate_adapter_receipt_required_not_proven_by_known_fields',
  difficulty: 'retain_source_claim_or_teacher_assessment_basis_never_infer_from_points',
  persistenceOwner: 'existing_independent_Academy_PostgreSQL_application',
  currentImplementationScope: 'pure_typed_candidate_and_selection_inspection_with_synthetic_verification',
  pendingIntegration: ['authenticated_owner_workspace_history_and_CAS', 'teacher_selection_UI', 'real_private_item_source_qualification', 'independent_review_and_runtime_verification'],
  effects: {sourceAcademyWrites: false, publication: false, printing: false, teacherAcceptance: false},
} as const;

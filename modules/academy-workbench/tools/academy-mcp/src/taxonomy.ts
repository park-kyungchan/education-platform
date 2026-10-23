/** Business query organization. Source domains remain distinct from workflow meaning. */
export const WORKFLOW_IDS = [
  "people", "teaching", "learning", "assessment", "materials",
  "student_care", "communication", "source_support",
] as const;
export type WorkflowId = (typeof WORKFLOW_IDS)[number];

export const SOURCE_DOMAIN_IDS = [
  "identity", "lesson", "curriculum", "prestudy", "assessment", "clinic",
  "materials", "smartbook", "communication", "counseling", "device",
  "book_order", "navigation",
] as const;
export type SourceDomainId = (typeof SOURCE_DOMAIN_IDS)[number];

const primaryWorkflows = {
  identity: "people",
  lesson: "teaching",
  prestudy: "learning",
  smartbook: "learning",
  assessment: "assessment",
  clinic: "assessment",
  curriculum: "materials",
  materials: "materials",
  book_order: "materials",
  counseling: "student_care",
  communication: "communication",
  navigation: "source_support",
  device: "source_support",
} as const satisfies Record<SourceDomainId, WorkflowId>;

export function isSourceDomain(value: unknown): value is SourceDomainId {
  return typeof value === "string" && SOURCE_DOMAIN_IDS.includes(value as SourceDomainId);
}

export function isWorkflow(value: unknown): value is WorkflowId {
  return typeof value === "string" && WORKFLOW_IDS.includes(value as WorkflowId);
}

export function primaryWorkflow(domain: SourceDomainId): WorkflowId {
  if (!isSourceDomain(domain)) throw new Error("CATALOG_UNKNOWN_DOMAIN");
  return primaryWorkflows[domain];
}

export interface DomainNode {
  readonly kind: "source_domain";
  readonly id: SourceDomainId;
  readonly label: string;
  readonly children: readonly [];
}

export interface WorkflowNode {
  readonly kind: "business_workflow";
  readonly id: WorkflowId;
  readonly label: string;
  readonly meaning: string;
  readonly children: readonly DomainNode[];
}

export interface OperationHierarchy {
  readonly kind: "root";
  readonly id: "academy_operations";
  readonly label: string;
  readonly status: "business_query_design_not_source_completion";
  readonly children: readonly WorkflowNode[];
}

const domainLabels: Record<SourceDomainId, string> = {
  identity: "Students, instructors, staff and source identity",
  lesson: "Schedules, groups, attendance and lesson occurrences",
  curriculum: "Curriculum, book editions and section structure",
  prestudy: "Preparation, video, notes and submissions",
  assessment: "Papers, attempts and item judgments",
  clinic: "Wrong subsets, similar papers and correction follow-up",
  materials: "Existing learning resources and print artifacts",
  smartbook: "Smartbook assignments and results",
  communication: "DailyRecord, reports and delivery observations",
  counseling: "Counseling and student follow-up",
  device: "Application, device and session source support",
  book_order: "Book requests and orders",
  navigation: "Source menus, help and unmapped navigation",
};

const workflowDefinitions: Record<WorkflowId, { label: string; meaning: string }> = {
  people: {
    label: "People and enrollment",
    meaning: "Identify students and responsible actors without treating identity as permission.",
  },
  teaching: {
    label: "Teaching and lesson continuity",
    meaning: "Distinguish planned enrollment, dated lesson occurrences and observed attendance.",
  },
  learning: {
    label: "Assignments and learning evidence",
    meaning: "Keep assignment, submission, grading and teacher review as separate facts.",
  },
  assessment: {
    label: "Assessment and correction evidence",
    meaning: "Keep original papers, attempts, judgments, wrong subsets and generated papers distinct.",
  },
  materials: {
    label: "Books and existing materials",
    meaning: "Preserve edition-local structure, existing print membership and distribution evidence.",
  },
  student_care: {
    label: "Student care and follow-up",
    meaning: "Read counseling and follow-up context without inferring completed intervention.",
  },
  communication: {
    label: "Lesson records and parent communication evidence",
    meaning: "Distinguish draft, review, saved record, current report, sent label and delivery receipt.",
  },
  source_support: {
    label: "Source capability and provenance",
    meaning: "Describe source routes and device context without claiming a callable integration.",
  },
};

export function hierarchy(): OperationHierarchy {
  return {
    kind: "root",
    id: "academy_operations",
    label: "Academy operational queries",
    status: "business_query_design_not_source_completion",
    children: WORKFLOW_IDS.map((workflow) => ({
      kind: "business_workflow",
      id: workflow,
      ...workflowDefinitions[workflow],
      children: SOURCE_DOMAIN_IDS.filter((domain) => primaryWorkflow(domain) === workflow)
        .map((domain) => ({ kind: "source_domain", id: domain, label: domainLabels[domain], children: [] })),
    })),
  };
}

export interface WorkflowRelation {
  readonly from: WorkflowId;
  readonly to: WorkflowId;
  readonly relation: string;
  readonly meaning: string;
  readonly status: "design_relation_requires_source_join_evidence";
}

/** Relations are deliberately separate from the single-parent navigation hierarchy. */
export const WORKFLOW_RELATIONS: readonly WorkflowRelation[] = [
  { from: "people", to: "teaching", relation: "enrollment_context", meaning: "Enrollment can scope a lesson query; it does not establish attendance." },
  { from: "teaching", to: "learning", relation: "dated_assignment_context", meaning: "An assignment needs its dated lesson and student scope." },
  { from: "materials", to: "learning", relation: "edition_local_assignment_scope", meaning: "Learning evidence refers to an exact edition and source section." },
  { from: "learning", to: "assessment", relation: "attempt_and_judgment_context", meaning: "Submission, item judgments and teacher review remain independent." },
  { from: "assessment", to: "materials", relation: "existing_print_identity", meaning: "Current judgments do not reconstruct historical print membership." },
  { from: "assessment", to: "student_care", relation: "follow_up_context", meaning: "Assessment evidence can inform follow-up without proving intervention." },
  { from: "teaching", to: "communication", relation: "parent_relevant_projection", meaning: "Only dated actual progress, next homework and parent-relevant notices belong in a parent projection." },
  { from: "source_support", to: "people", relation: "source_identity_provenance", meaning: "Source identity bindings need their own evidence and freshness." },
].map((relation) => Object.freeze({
  ...relation,
  status: "design_relation_requires_source_join_evidence" as const,
})) as readonly WorkflowRelation[];

/** 기존 schema.ts에 더하는 별도 확장 스키마. 기존 파일을 변경하지 않는다. */
export interface OriginalExample {
  prompt: string;
  answer: string;
  solution: string;
  misconception: string;
  authorship: 'original';
  numericChecks?: (string | { expression: string; expected: string; actual: string; passed: boolean })[];
}
export interface ExpandedProblemType {
  id: string;
  title: string;
  originalTypeIds: string[];
  example: OriginalExample;
  /** Same cognitive type with changed numbers, conditions, or context. */
  variants?: (OriginalExample & { id: string; title: string })[];
  sourceIds: string[];
  evidenceStatus: 'proposed-original';
  alignmentNote?: string;
}
export interface ExpandedDetail {
  id: string;
  parentContentId: string;
  title: string;
  officialGradeBand: '3~4' | '5~6';
  observedPlacement?: string;
  originalContentIds?: string[];
  types: ExpandedProblemType[];
}
export interface ExpansionSource {
  id: string;
  url: string;
  title?: string;
  verifiedAt?: string;
  scope?: string;
  limitations?: string;
  [key: string]: unknown;
}
export interface DetailExpansion {
  version: string;
  details: ExpandedDetail[];
  sources: ExpansionSource[];
  notes: string[];
}

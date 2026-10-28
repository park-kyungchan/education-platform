import type { Catalog } from './types.ts';
import { selectContext } from './select.ts';
import { validateCatalog } from './validate.ts';

/** Required reference checks, not instructions to load every referenced source body. */
const common = ['SRC-INTEGRATION-USER-20261023', 'SRC-CURRENT-SCOPE', 'SRC-CURRENT-USER', 'SRC-DC-CONTRACT', 'SRC-AWB-COVERAGE', 'SRC-AWB-HARNESS'];
const requiredByWorkflow: Record<string, string[]> = {
  'academy.class-preparation': [...common, 'SRC-CURRENT-NAVIGATION', 'SRC-DC-CLASSROOM', 'SRC-AWB-LOGICAL-TYPES', 'SRC-CLASS-TIMETABLE-GUIDE'],
  'academy.lesson-delivery': [...common, 'SRC-DC-CLASSROOM'],
  'academy.progress-audit': [...common, 'SRC-DC-CLASSROOM', 'SRC-AWB-INQUIRY', 'SRC-AWB-LOGICAL-TYPES'],
  'academy.homework-followup': [...common, 'SRC-DC-CLASSROOM', 'SRC-AWB-LOGICAL-TYPES'],
  'academy.assessment-preparation': [...common, 'SRC-ED-MONTHLY', 'SRC-RESEARCH-OWNERS', 'SRC-RESEARCH-CHRONOLOGY', 'SRC-CURRICULUM-GAPS'],
  'academy.wrong-answer-clinic': [...common, 'SRC-DC-CLASSROOM', 'SRC-AWB-INQUIRY', 'SRC-AWB-LOGICAL-TYPES'],
  'academy.attendance-internal-journal': [...common, 'SRC-ED-DAILY-INTERNAL'],
};

export function readingPlan(input: unknown, topicId: string) {
  const catalog: Catalog = validateCatalog(input);
  const required = requiredByWorkflow[topicId];
  if (!required) throw Error('academy-context:reading-plan-requires-internal-workflow');
  const sourceIds = new Set<string>();
  let cursor: string | undefined;
  let catalogHash = '';
  do {
    const page = selectContext(catalog, { topicId, maxBytes: 65536, ...(cursor ? { cursor } : {}) });
    catalogHash = page.catalogSha256;
    for (const item of page.items) if (item.kind === 'source') sourceIds.add(item.value.id);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  for (const id of required) if (!sourceIds.has(id)) throw Error(`academy-context:required-reference-not-selected:${id}`);
  return {
    schemaVersion: 'academy.context-reading-plan/1' as const,
    projectId: catalog.projectId, workId: catalog.workId, topicId, catalogSha256: catalogHash,
    authority: 'none' as const, nativePermissionGranted: false as const,
    defaultNavigation: catalog.defaultNavigation, sourceBodiesLoaded: false as const,
    bodyConsumption: 'Caller selects necessary bounded fragments and qualifies source currentness; this plan executes no read.' as const,
    requiredReferenceIds: [...required],
    discoveryReferenceIds: [...sourceIds].filter(id => !required.includes(id)).sort(),
    coverage: catalog.coverage,
  };
}

import { readFile, lstat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { hierarchy, WORKFLOW_RELATIONS, WORKFLOW_IDS, SOURCE_DOMAIN_IDS } from './taxonomy.ts';
import { loadCatalog, type OperationCatalog } from './catalog.ts';
import { loadSavedContext, type SavedContext } from './saved-context.ts';
import { queryInputSchema, queryResultSchema } from './contracts.ts';
import { digest } from './pagination.ts';

export const capabilitiesInputSchema = z.object({
  view: z.enum(['hierarchy', 'operations', 'source_contract', 'workflow_rules']).default('hierarchy'),
  workflow: z.enum(WORKFLOW_IDS).optional(), domain: z.enum(SOURCE_DOMAIN_IDS).optional(),
  operationId: z.string().min(1).max(256).optional(),
  offset: z.number().int().nonnegative().default(0), limit: z.number().int().min(1).max(50).default(10),
}).strict().superRefine((input, context) => {
  if (input.view === 'source_contract' && (!input.operationId || input.workflow || input.domain)) context.addIssue({ code: 'custom', message: 'source_contract_requires_only_exact_operation_id' });
  if (input.view !== 'source_contract' && input.operationId) context.addIssue({ code: 'custom', message: 'operation_id_requires_source_contract_view' });
  if (input.view === 'hierarchy' && input.domain) context.addIssue({ code: 'custom', message: 'domain_filter_requires_operations_view' });
  if (input.view === 'workflow_rules' && (input.domain || input.workflow)) context.addIssue({ code: 'custom', message: 'workflow_rules_are_preserved_without_invented_domain_assignment' });
});
export const sourceStatusInputSchema = z.object({}).strict();

export class AcademyService {
  constructor(readonly catalog: OperationCatalog, readonly saved: SavedContext, readonly intent: Record<string, unknown>, readonly rules: { source: { path: string; sha256: string }; decisions: unknown[] }) {}
  capabilities(value: unknown) {
    const input = capabilitiesInputSchema.parse(value);
    const inventory = this.catalog.stats();
    let data: unknown;
    if (input.view === 'source_contract') data = this.catalog.get(input.operationId!);
    else if (input.view === 'operations') data = this.catalog.list({ workflow: input.workflow, domain: input.domain, offset: input.offset, limit: input.limit });
    else if (input.view === 'workflow_rules') {
      if (input.offset > this.rules.decisions.length) throw Error('rules_offset_out_of_range');
      const end = Math.min(this.rules.decisions.length, input.offset + input.limit);
      data = { classification: 'generalized_preserved_business_rules_not_execution_authority', source: this.rules.source, items: this.rules.decisions.slice(input.offset, end), total: this.rules.decisions.length, nextOffset: end < this.rules.decisions.length ? end : null };
    }
    else {
      const tree = hierarchy();
      data = { ...tree, children: input.workflow ? tree.children.filter(node => node.id === input.workflow) : tree.children, relatedWorkflows: WORKFLOW_RELATIONS };
    }
    return {
      schemaVersion: 1, sourceMode: 'saved_context', data, inventory,
      source: this.catalog.source,
      implementation: {
        metadata: 'complete_for_pinned_95_operation_inventory',
        savedEvidenceQueries: 'implemented',
        liveAcademyOperations: 'not_implemented_or_exposed',
        sourceReadDeclarationGrantsExecution: false,
        writesPrintGenerationGradingResetSending: 'not_exposed',
      },
    };
  }
  query(value: unknown) { return queryResultSchema.parse(this.saved.query(queryInputSchema.parse(value))); }
  sourceStatus(value: unknown) {
    sourceStatusInputSchema.parse(value);
    return {
      schemaVersion: 1, sourceMode: 'saved_context', teacherScope: this.saved.scope,
      statusScope:'preserved_snapshot_only_not_live_backend_health',
      liveDailyRecord:{preferredTool:'academy_dailyrecord_get',explicitScopeRoute:['academy_student_resolve','academy_dailyrecord_intake'],availability:'not_probed_by_this_tool',historicalAccessReportIsCurrentBlocker:false},
      snapshotHash: this.saved.snapshotHash,
      acquisition: { academyNetworkTransport: 'absent', directServerAccess: 'unavailable_by_user_report', newAcademyReadsPerformed: false, automaticRefresh: false },
      visibilityKnowledge: this.intent.userReportedSourceConstraints,
      interpretation: {
        websiteInvisibilityMeansDeletion: false,
        missingSavedObservationMeansNonperformance: false,
        preservedOlderEvidenceExpiresAfterTwoWeeks: false,
        completeHistoricalCoverage: 'not_established',
        siteWindowIsApiRetentionContract: false,
      },
      scopeDecision: this.intent.userDecisions,
    };
  }
}

export async function loadService(repoRoot: string) {
  const [catalog, saved] = await Promise.all([loadCatalog(repoRoot), loadSavedContext(repoRoot)]);
  const pins = JSON.parse(await readFile(resolve(repoRoot, 'tools/academy-mcp/architecture/source-pins.json'), 'utf8')) as { files: { path: string; sha256: string }[] };
  if (pins.files.find(pin => pin.path === catalog.source.path)?.sha256 !== catalog.source.sha256) throw Error('catalog_source_pin_changed');
  const intentPath = resolve(repoRoot, 'tools/academy-mcp/architecture/intent.json');
  const info = await lstat(intentPath);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 65536) throw Error('intent_file_invalid');
  const intent = JSON.parse(await readFile(intentPath, 'utf8')) as Record<string, unknown>;
  if (intent.schemaVersion !== 'academy.operations-mcp-intent/1') throw Error('intent_schema_invalid');
  const rulePath = 'context/business-decisions.json';
  const ruleInfo = await lstat(resolve(repoRoot, rulePath));
  if (!ruleInfo.isFile() || ruleInfo.isSymbolicLink() || ruleInfo.size > 1024 * 1024) throw Error('business_rules_file_invalid');
  const ruleBytes = await readFile(resolve(repoRoot, rulePath));
  const ruleHash = digest(ruleBytes);
  if (pins.files.find(pin => pin.path === rulePath)?.sha256 !== ruleHash) throw Error('business_rules_source_pin_changed');
  const rules = JSON.parse(ruleBytes.toString('utf8')) as { authorityGranted: unknown; decisions: unknown };
  if (rules.authorityGranted !== false || !Array.isArray(rules.decisions)) throw Error('business_rules_schema_invalid');
  return new AcademyService(catalog, saved, intent, { source: { path: rulePath, sha256: ruleHash }, decisions: rules.decisions });
}

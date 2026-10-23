import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadPlatform, moduleRoot, readJson, sha256 } from '../../scripts/agent-platform.ts';
import { instant } from '../../architecture/logical-model-v2.ts';
import type { InquiryContext } from './context.types.ts';

const root = resolve(moduleRoot, 'context/academy-inquiry');
function fail(message: string): never { throw Error(message); }
function unique(values: string[], name: string) {
  if (new Set(values).size !== values.length) fail(`duplicate-${name}`);
}
export async function createValidator() {
  const api = await loadPlatform();
  const { default: Ajv2020 } = await import(pathToFileURL(Bun.resolveSync('ajv/dist/2020.js', resolve(api.source.root, 'packages/ontology/src'))).href);
  const schema = await readJson(resolve(root, 'context.schema.json'));
  const check = new Ajv2020({ strict: true, allErrors: true, coerceTypes: false }).compile(schema);
  return (value: unknown): InquiryContext => {
    if (!check(value)) fail(`inquiry-schema: ${JSON.stringify(check.errors)}`);
    const context = value as InquiryContext;
    instant(context.preparedAt);
    unique(context.sources.map(x => x.key), 'source');
    unique(context.hierarchy.map(x => x.key), 'node');
    unique(context.records.map(x => x.key), 'record');
    const sources = new Map(context.sources.map(x => [x.key, x]));
    const nodes = new Map(context.hierarchy.map(x => [x.key, x]));
    const records = new Map(context.records.map(x => [x.key, x]));
    for (const source of context.sources) {
      const times = source.times;
      for (const time of [times.sourceTimestamp, times.snapshotCapturedAt, times.userReportTime, times.ingestedAt]) if (time !== null) instant(time);
      if (times.captureWindow) {
        instant(times.captureWindow.from); instant(times.captureWindow.to);
        if (Date.parse(times.captureWindow.from) > Date.parse(times.captureWindow.to)) fail('capture-window-order');
      }
      if (source.kind === 'repository-file' && source.commit !== context.basisCommit) fail('repository-basis-mismatch');
    }
    for (const layer of ['DATA', 'LOGIC', 'ACTION', 'GOVERNANCE']) {
      const node = nodes.get(layer);
      if (!node || node.parent !== null || node.layer !== layer) fail('missing-layer-root');
    }
    for (const node of context.hierarchy) {
      const seen = new Set<string>(); let cursor: typeof node | undefined = node;
      while (cursor) {
        if (seen.has(cursor.key)) fail('hierarchy-cycle');
        seen.add(cursor.key);
        if (cursor.layer !== node.layer) fail('cross-layer-hierarchy');
        if (cursor.parent === null) {
          if (cursor.key !== node.layer) fail('unanchored-hierarchy');
          break;
        }
        cursor = nodes.get(cursor.parent);
        if (!cursor) fail('missing-node-parent');
      }
    }
    for (const record of context.records) {
      if (nodes.get(record.node)?.layer !== record.layer) fail('record-layer-mismatch');
      if (record.sourceKeys.some(key => !sources.has(key))) fail('missing-source-reference');
      for (const link of record.links) {
        const target = records.get(link.target);
        if (!target || target.key === record.key) fail('invalid-record-reference');
        if (['corrects', 'supersedes'].includes(link.relation)) {
          if (record.kind !== 'decision' || target.scope !== record.scope) fail('correction-scope-mismatch');
          if (target.kind === 'observation') fail('immutable-observation-superseded');
        }
      }
      if (record.kind === 'decision') {
        if (!record.sourceKeys.some(key => {
          const source = sources.get(key);
          return source?.kind === 'trusted-user-history' || source?.kind === 'delegated-history-report' && source.originalAuthor === 'user';
        })) fail('decision-needs-user-provenance');
        const decision = record.decision;
        if (decision.facet === 'closure-correction') {
          if (record.scope !== decision.date || !record.links.some(x => x.relation === 'corrects') || !record.links.some(x => x.relation === 'supersedes')) fail('closure-correction-links');
          const observations = record.links.filter(x => x.relation === 'qualifies').map(x => records.get(x.target));
          if (!observations.some(x => x?.kind === 'observation' && x.observation.facet === 'daily-record' && x.observation.date === decision.date && x.observation.rawStatus === 'blank')) fail('closure-original-blank-required');
        }
        if (decision.facet === 'teacher-completion') {
          if (decision.completedOrdinals.some(x => x > decision.auditCohortSize) || decision.judgmentCount !== decision.completedOrdinals.length * decision.paths.length) fail('teacher-judgment-count');
          const delivery = context.records.find(x => x.kind === 'report' && x.report.facet === 'paper-delivery' && x.scope === record.scope);
          if (!delivery || delivery.kind !== 'report' || delivery.report.facet !== 'paper-delivery') fail('remaining-delivery-required');
          if (delivery.report.auditOrdinals.some(x => decision.completedOrdinals.includes(x))) fail('delivery-is-not-completion');
          if (new Set([...decision.completedOrdinals, ...delivery.report.auditOrdinals]).size !== decision.auditCohortSize) fail('audit-cohort-partition');
        }
        if (decision.facet === 'latest-delivery-scope') {
          const old = record.links.filter(x => x.relation === 'supersedes').map(x => records.get(x.target));
          if (!old.some(x => x?.kind === 'report' && x.report.facet === 'prior-scope' && x.report.first === decision.first)) fail('delivery-scope-history-required');
          if (decision.last < decision.first) fail('delivery-range-order');
        }
      }
      if (record.kind === 'observation') {
        const observation = record.observation;
        if (observation.facet === 'app-grading-coverage' && observation.assignedUnits !== observation.scoreVisibleUnits + observation.resultUnconfirmedUnits) fail('grading-unit-count');
        if (observation.facet === 'daily-record' && (observation.rawStatus === 'blank' ? observation.attendanceInterpretation !== 'unresolved' : observation.attendanceInterpretation !== 'absence-record')) fail('blank-is-not-absence');
        if (observation.facet === 'historical-re' && observation.analyzedScreens > observation.menuCount) fail('re-screen-count');
      }
    }
    // Corrections must remain acyclic; learning workflow cycles are a different relation.
    for (const record of context.records) {
      function visit(key: string, ancestors: Set<string>) {
        if (ancestors.has(key)) fail('correction-cycle');
        const next = new Set(ancestors).add(key);
        for (const link of records.get(key)!.links) if (['corrects','supersedes'].includes(link.relation)) visit(link.target, next);
      }
      visit(record.key, new Set());
    }
    const bytes = JSON.stringify(context);
    if (/(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|Bearer\s+[A-Za-z0-9._-]+|-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----|password\s*[=:]\s*[^\s"]+)/i.test(bytes)) fail('private-value-pattern');
    return context;
  };
}

export async function checkInquiry() {
  const validate = await createValidator();
  const context = validate(await readJson(resolve(root, 'context.json')));
  const api = await loadPlatform();
  const identity = await readJson(resolve(root, 'work/identity.json')) as Record<string, unknown>;
  const { default: Ajv2020 } = await import(pathToFileURL(Bun.resolveSync('ajv/dist/2020.js', resolve(api.source.root, 'packages/ontology/src'))).href);
  // Reuse the consumer-local transport contract, retargeting only this Work/Task/Run's exact constants.
  // Canonical Artifact and native Work validators are unchanged and remain externally pinned.
  const identitySchema = await readJson(resolve(moduleRoot, 'harness/work/identity.schema.json')) as { properties: Record<string,{const:unknown}> };
  const expectedWork = 'academy-inquiry-context-20261014';
  identitySchema.properties.workId!.const = expectedWork;
  identitySchema.properties.taskId!.const = `academy-workbench:task:${expectedWork}`;
  identitySchema.properties.runId!.const = `academy-workbench:run:${expectedWork}-01`;
  const validateIdentity = new Ajv2020({strict:true}).compile(identitySchema);
  if (!validateIdentity(identity)) fail('inquiry-work-identity');
  const artifacts = await Promise.all(['project.json', 'context/academy-inquiry/work/task.json', 'context/academy-inquiry/work/run.json'].map(path => readJson(resolve(moduleRoot, path))));
  for (const artifact of artifacts) {
    const result = api.validateArtifact(artifact);
    if (!result.valid) fail(`canonical-artifact: ${JSON.stringify(result.issues)}`);
  }
  const references = api.validateReferences(artifacts);
  if (!references.valid) fail(`canonical-references: ${JSON.stringify(references.issues)}`);
  const [project,task,run] = artifacts as Array<{id:string; projectId:string; domainId:string; payload:any}>;
  if (identity.projectArtifactId !== project!.id || identity.projectId !== project!.projectId || identity.domainId !== project!.domainId || identity.taskId !== task!.id || identity.runId !== run!.id || run!.payload.taskRef !== task!.id || [task,run].some(x => x!.payload.details.workId !== identity.workId)) fail('inquiry-identity-join');
  if (identity.workId === (await readJson(resolve(moduleRoot, 'harness/work/identity.json')) as any).workId) fail('historical-work-id-reused');
  const request = api.validateWorkContextRequest({schema:'codex.work-context.request.v1',projectId:identity.projectId, workId:identity.workId, root:moduleRoot, cwd:moduleRoot, checkpointPath:resolve(moduleRoot,'.harness-runtime/academy-inquiry-checkpoint.json'),maxChars:12000});
  if (!request) fail('canonical-work-request');
  // This interrupted Run's original input is historical, not today's mutable instructions.
  // Preserve its bytes and hashes; the successor cloud Work independently pins current inputs.
  const historical = await readJson(resolve(root, 'work/historical-input-snapshots.json')) as {inputs: Array<{originalPath:string;snapshotPath:string;sha256:string}>};
  for (const entry of historical.inputs) {
    if (!entry.snapshotPath.startsWith('context/academy-inquiry/work/input-snapshots/') || entry.snapshotPath.split('/').includes('..') || entry.snapshotPath.includes('\\') || !run!.payload.inputHashes.some((pin:any)=>pin.path===entry.originalPath && pin.sha256===entry.sha256)) fail('invalid-historical-input-snapshot');
  }
  if (new Set(historical.inputs.map(x=>x.originalPath)).size !== historical.inputs.length) fail('duplicate-historical-input-snapshot');
  for (const pin of run!.payload.inputHashes) {
    const preserved = historical.inputs.find(entry=>entry.originalPath===pin.path);
    if (sha256(await readFile(resolve(moduleRoot,preserved?.snapshotPath ?? pin.path))) !== pin.sha256) fail('inquiry-input-drift');
  }
  return {status:'pass', recordCount:context.records.length, sourceCount:context.sources.length, hierarchy:'pass', correctionReferences:'pass', canonicalArtifacts:'pass', localWorkIdentity:'pass', registration:'local-module-record', sourceTruthIndependentlyVerified:false, actualUserAcceptance:'not-observed', liveReobservation:false, executionAuthority:'none'};
}
if (import.meta.main) console.log(JSON.stringify(await checkInquiry(),null,2));

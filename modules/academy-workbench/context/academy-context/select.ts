import { createHash } from 'node:crypto';
import type { Catalog, ContextRecord, SelectionItem, SelectionPage, SelectionQuery } from './types.ts';
import { validateCatalog } from './validate.ts';

export class ContextSelectionError extends Error {
  constructor(readonly code: string, readonly details: Record<string, string | number> = {}) { super(`academy-context:${code}`); }
}
function fail(code: string, details?: Record<string, string | number>): never { throw new ContextSelectionError(code, details); }
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
}
export function catalogSha256(catalog: Catalog): string { return createHash('sha256').update(canonical(catalog)).digest('hex'); }
const sorted = (values: Iterable<string>): string[] => [...new Set(values)].sort();
const bytes = (value: unknown): number => Buffer.byteLength(JSON.stringify(value), 'utf8');

/** Pure selection: supplied catalog -> bounded metadata page. No source file reads or native effects. */
export function selectContext(input: unknown, request: SelectionQuery): SelectionPage {
  const catalog = validateCatalog(input);
  if (!request || typeof request !== 'object' || Array.isArray(request) || Object.keys(request).some(key => !['topicId','includeHistory','maxBytes','cursor'].includes(key))) fail('invalid-query');
  if (typeof request.topicId !== 'string' || (request.includeHistory !== undefined && typeof request.includeHistory !== 'boolean') || (request.cursor !== undefined && typeof request.cursor !== 'string')) fail('invalid-query');
  const query = { topicId: request.topicId, includeHistory: request.includeHistory ?? false, maxBytes: request.maxBytes ?? 16_384 };
  if (!Number.isSafeInteger(query.maxBytes) || query.maxBytes < 1) fail('invalid-byte-budget');
  const hash = catalogSha256(catalog), queryHash = createHash('sha256').update(canonical(query)).digest('hex');
  const topics = new Map(catalog.topics.map(row => [row.id,row]));
  if (!topics.has(query.topicId)) fail('unknown-topic');
  const parents = new Map<string, Set<string>>(), dependencies = new Map<string, Set<string>>();
  const edge = (map: Map<string,Set<string>>, from: string, to: string): void => { if (!map.has(from)) map.set(from,new Set()); map.get(from)!.add(to); };
  for (const topic of catalog.topics) {
    if (topic.parentId) edge(parents,topic.id,topic.parentId);
    for (const target of topic.dependsOn) edge(dependencies,topic.id,target);
  }
  for (const relation of catalog.relations) {
    if (!topics.has(relation.from) || !topics.has(relation.to)) continue;
    if (relation.topology === 'containment') edge(parents,relation.to,relation.from);
    if (relation.topology === 'dependency') edge(dependencies,relation.from,relation.to);
  }
  const ancestorCache = new Map<string,Set<string>>();
  const ancestors = (id: string): Set<string> => {
    const cached = ancestorCache.get(id); if (cached) return cached;
    const result = new Set([id]); for (const parent of parents.get(id) ?? []) for (const ancestor of ancestors(parent)) result.add(ancestor);
    ancestorCache.set(id,result); return result;
  };
  const allowed = (id: string): boolean => {
    const chain = ancestors(id);
    return catalog.scope.included.some(root => chain.has(root)) && !catalog.scope.excluded.some(root => chain.has(root));
  };
  if (!allowed(query.topicId)) fail('topic-outside-scope');
  const topicClosure = new Set<string>();
  const expand = (id: string): void => {
    if (topicClosure.has(id)) return;
    if (!allowed(id)) fail('dependency-outside-scope', { topicId: id });
    topicClosure.add(id);
    for (const target of sorted([...(parents.get(id) ?? []),...(dependencies.get(id) ?? [])])) expand(target);
  };
  expand(query.topicId);
  const relevant = (topicIds: string[]): boolean => topicIds.some(id => topicClosure.has(id)) && topicIds.every(allowed);
  const records = new Map(catalog.records.map(row => [row.id,row]));
  const byId = (a: {id:string}, b: {id:string}): number => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  const recordPriority = (row: ContextRecord): number => {
    if (row.status === 'current' && row.kind === 'actual-user-decision') return 0;
    if (row.status === 'current' && row.kind === 'source-owner-decision') return 1;
    if (row.status === 'unresolved') return 2;
    if (row.status === 'current') return 3;
    return row.status === 'historical' ? 5 : 4;
  };
  const selectedRecords = catalog.records.filter(row => relevant(row.topicIds) && (query.includeHistory || row.status !== 'historical')).sort((a,b) => recordPriority(a)-recordPriority(b) || byId(a,b));
  const selectedFindings = catalog.findings.filter(row => relevant(row.topicIds)).sort((a,b) => a.priority < b.priority ? -1 : a.priority > b.priority ? 1 : byId(a,b));
  const sourceById = new Map(catalog.sources.map(row => [row.id,row]));
  const sourceIds = new Set<string>();
  const addSource = (sourceId: string): void => {
    const source = sourceById.get(sourceId)!; // validateCatalog proved this reference exists.
    if (!source.topicIds.every(allowed)) fail('referenced-source-outside-scope', {sourceId});
    sourceIds.add(sourceId);
  };
  for (const source of catalog.sources.filter(row => relevant(row.topicIds))) addSource(source.id);
  for (const id of topicClosure) for (const source of topics.get(id)!.sourceIds) addSource(source);
  for (const row of [...selectedRecords,...selectedFindings]) for (const source of row.sourceIds) addSource(source);
  const selectedIds = new Set([...topicClosure,...selectedRecords.map(row => row.id),...selectedFindings.map(row => row.id),...sourceIds]);
  // Follow revision/provenance only as metadata when historical text was not requested.
  const references = new Map<string,ContextRecord>();
  const reference = (id: string): void => {
    if (sourceById.has(id)) { addSource(id); selectedIds.add(id); return; }
    if (selectedIds.has(id) || references.has(id)) return;
    const row = records.get(id); if (!row) return;
    if (!row.topicIds.every(allowed)) fail(row.status === 'historical' ? 'historical-reference-outside-scope' : 'referenced-record-outside-scope', {recordId:id});
    if (row.status !== 'historical') return;
    references.set(id,row);
    for (const source of row.sourceIds) { addSource(source); selectedIds.add(source); }
    for (const target of row.supersedes) reference(target);
    for (const relation of catalog.relations) if (relation.from === id && ['revision','provenance'].includes(relation.topology)) reference(relation.to);
  };
  for (const row of selectedRecords) for (const target of row.supersedes) reference(target);
  // Repeat because provenance can itself refer to another source; never read the referenced bytes.
  let previousSize = -1;
  while (previousSize !== selectedIds.size + references.size) {
    previousSize = selectedIds.size + references.size;
    for (const relation of catalog.relations) if ((selectedIds.has(relation.from) || references.has(relation.from)) && ['revision','provenance'].includes(relation.topology)) reference(relation.to);
  }
  for (const row of references.values()) {
    selectedIds.add(row.id);
  }
  const selectedSources = catalog.sources.filter(row => sourceIds.has(row.id)).sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  for (const row of selectedSources) selectedIds.add(row.id);
  // Repository metadata is not expanded into source content; source repositoryId stays a catalog reference.
  const selectedRelations = catalog.relations.filter(row => selectedIds.has(row.from) && selectedIds.has(row.to)).sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const items: SelectionItem[] = [
    ...sorted(topicClosure).map(id => ({kind:'topic' as const,value:topics.get(id)!})),
    ...selectedRecords.filter(value => recordPriority(value) < 4).map(value => ({kind:'record' as const,value})),
    ...selectedFindings.map(value => ({kind:'finding' as const,value})),
    ...selectedSources.map(value => ({kind:'source' as const,value})),
    ...selectedRecords.filter(value => recordPriority(value) >= 4).map(value => ({kind:'record' as const,value})),
    ...sorted(references.keys()).map(id => {
      const row = references.get(id)!;
      return {kind:'reference' as const,value:{id:row.id,recordKind:row.kind,status:'historical' as const,topicIds:row.topicIds,sourceIds:row.sourceIds,supersedes:row.supersedes,reason:'historical-revision-reference' as const}};
    }),
    ...selectedRelations.map(value => ({kind:'relation' as const,value})),
  ];
  let offset = 0;
  if (request.cursor !== undefined) {
    try {
      if (!/^[A-Za-z0-9_-]+$/.test(request.cursor) || Buffer.from(request.cursor,'base64url').toString('base64url') !== request.cursor) fail('invalid-cursor');
      const cursor = JSON.parse(Buffer.from(request.cursor,'base64url').toString('utf8')) as Record<string,unknown>;
      if (!cursor || Array.isArray(cursor) || typeof cursor !== 'object' || Object.keys(cursor).sort().join(',') !== 'catalogSha256,offset,queryHash,v' || cursor.v !== 1 || !Number.isSafeInteger(cursor.offset) || (cursor.offset as number) < 0) fail('invalid-cursor');
      if (cursor.catalogSha256 !== hash) fail('stale-catalog-cursor');
      if (cursor.queryHash !== queryHash) fail('cursor-query-mismatch');
      if ((cursor.offset as number) >= items.length) fail('invalid-cursor');
      offset = cursor.offset as number;
    } catch (error) { if (error instanceof ContextSelectionError) throw error; fail('invalid-cursor'); }
  }
  const nextCursor = (next: number): string | null => next < items.length ? Buffer.from(JSON.stringify({v:1,catalogSha256:hash,queryHash,offset:next})).toString('base64url') : null;
  const makePage = (end: number): SelectionPage => {
    const page: SelectionPage = {
      schemaVersion:'academy.context-selection/1',catalogSha256:hash,query,
      projectId:catalog.projectId,workId:catalog.workId,authority:'none',nativePermissionGranted:false,
      coverage:catalog.coverage,excludedScope:sorted(catalog.scope.excluded),
      closure:{topicIds:sorted(topicClosure),topicCount:topicClosure.size,sourceCount:selectedSources.length,recordCount:selectedRecords.length,findingCount:selectedFindings.length,relationCount:selectedRelations.length,referenceCount:references.size,itemCount:items.length},
      items:items.slice(offset,end),nextCursor:nextCursor(end),usedBytes:0,
    };
    // usedBytes is part of the serialized response. Recompute until its digit count is stable.
    let size = bytes(page); while (size !== page.usedBytes) { page.usedBytes=size; size=bytes(page); }
    return page;
  };
  if (makePage(offset).usedBytes > query.maxBytes) fail('budget-smaller-than-page-metadata', {maxBytes:query.maxBytes,requiredBytes:makePage(offset).usedBytes});
  let end = offset;
  while (end < items.length) {
    const candidate = makePage(end+1);
    if (candidate.usedBytes > query.maxBytes) {
      if (end === offset) fail('item-exceeds-byte-budget', {itemId:items[end]!.value.id,maxBytes:query.maxBytes,requiredBytes:candidate.usedBytes});
      break;
    }
    end++;
  }
  return makePage(end);
}

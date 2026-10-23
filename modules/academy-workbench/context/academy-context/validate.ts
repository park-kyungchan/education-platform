import type { Catalog } from './types.ts';

function fail(code: string): never { throw new Error(`academy-context:${code}`); }
function object(value: unknown, keys: string[], at: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${at}:object`);
  const actual = Object.keys(value);
  if (actual.length !== keys.length || actual.some(key => !keys.includes(key))) fail(`${at}:fields`);
}
function text(value: unknown, at: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) fail(`${at}:text`);
}
function id(value: unknown, at: string): asserts value is string {
  text(value, at); if (!/^[A-Za-z0-9][A-Za-z0-9_.:/-]*$/.test(value)) fail(`${at}:id`);
}
function list(value: unknown, at: string): asserts value is unknown[] { if (!Array.isArray(value)) fail(`${at}:array`); }
function ids(value: unknown, at: string): asserts value is string[] {
  list(value, at); value.forEach(x => id(x, at)); if (new Set(value).size !== value.length) fail(`${at}:duplicate`);
}
function one(value: unknown, choices: readonly unknown[], at: string): void { if (!choices.includes(value)) fail(`${at}:enum`); }
function path(value: unknown, absolute: boolean): void {
  text(value, 'path');
  if (value.includes('\\') || /[\u0000-\u001f?#%]/.test(value) || value.startsWith('/') !== absolute || value.includes('//') || value.split('/').some(x => x === '..' || x === '.') || (!absolute && /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value))) fail('unsafe-path');
}
function dag(edges: Array<[string, string]>, label: string): void {
  const links = new Map<string, string[]>();
  for (const [from, to] of edges) links.set(from, [...(links.get(from) ?? []), to]);
  const active = new Set<string>(), done = new Set<string>();
  const visit = (node: string): void => {
    if (active.has(node)) fail(`${label}:cycle`); if (done.has(node)) return;
    active.add(node); for (const target of links.get(node) ?? []) visit(target); active.delete(node); done.add(node);
  };
  for (const node of links.keys()) visit(node);
}
/** Checks only the supplied metadata. Does not stat, open, hash or resolve any source path. */
export function validateCatalog(input: unknown, expectedIdentity?: { projectId: string; workId: string }): Catalog {
  object(input, ['schemaVersion','projectId','workId','authority','nativePermissionGranted','defaultNavigation','coverage','scope','repositories','sources','topics','records','relations','findings'], 'catalog');
  one(input.schemaVersion, ['academy.context-catalog/1'], 'schemaVersion');
  id(input.projectId, 'projectId'); id(input.workId, 'workId');
  if (expectedIdentity && (input.projectId !== expectedIdentity.projectId || input.workId !== expectedIdentity.workId)) fail('identity-mismatch');
  if (input.authority !== 'none' || input.nativePermissionGranted !== false) fail('authority');
  if (JSON.stringify(input.defaultNavigation) !== '["date","class","student"]') fail('navigation');
  object(input.coverage, ['status','denominator','complete','note'], 'coverage');
  if (input.coverage.status !== 'partial' || input.coverage.denominator !== null || input.coverage.complete !== false) fail('coverage-overclaim');
  text(input.coverage.note, 'coverage.note');
  object(input.scope, ['included','excluded'], 'scope'); ids(input.scope.included, 'scope.included'); ids(input.scope.excluded, 'scope.excluded');
  const included = input.scope.included as string[], excluded = input.scope.excluded as string[];
  if (!included.length || included.some(x => excluded.includes(x))) fail('scope-overlap');
  for (const key of ['repositories','sources','topics','records','relations','findings']) list(input[key], key);
  const catalog = input as unknown as Catalog;
  const all = new Set<string>();
  for (const [kind, rows] of Object.entries({ repo: catalog.repositories, source: catalog.sources, topic: catalog.topics, record: catalog.records, relation: catalog.relations, finding: catalog.findings })) {
    for (const row of rows) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) fail(`${kind}:object`);
      id(row.id, `${kind}.id`); if (all.has(row.id)) fail(`duplicate-id:${row.id}`); all.add(row.id);
    }
  }
  const repositoryIds = new Set(catalog.repositories.map(x => x.id)), topicIds = new Set(catalog.topics.map(x => x.id)), sourceIds = new Set(catalog.sources.map(x => x.id)), recordIds = new Set(catalog.records.map(x => x.id));
  const refs = (values: unknown, available: Set<string>, label: string): void => { ids(values, label); for (const value of values) if (!available.has(value)) fail(`${label}:dangling:${value}`); };
  refs(catalog.scope.included, topicIds, 'scope.included'); refs(catalog.scope.excluded, topicIds, 'scope.excluded');
  for (const row of catalog.repositories) {
    object(row, ['id','path','commit','role','observation','dirty'], 'repository'); path(row.path, true); text(row.role, 'repository.role');
    if (typeof row.commit !== 'string' || !/^[a-f0-9]{40}$/.test(row.commit) || row.observation !== 'local-checkout' || typeof row.dirty !== 'boolean') fail('repository.identity');
  }
  const privatePath = /(^|\/)(private|private-students|data|config|secrets?|credentials?)(\/|$)|(^|\/)\.env(?:\.|$)|source-excerpts\.json$|\.(?:sqlite|sqlite3|db|zip|tar|gz|7z)$/i;
  for (const row of catalog.sources) {
    object(row, ['id','repositoryId','path','sha256','byteLength','classification','readPolicy','ownerId','topicIds','note'], 'source');
    if (!repositoryIds.has(row.repositoryId)) fail('source.repository:dangling'); path(row.path, false); id(row.ownerId, 'source.ownerId'); text(row.note, 'source.note');
    one(row.classification, ['current-owner','original-reference','historical-summary','derived-view','verification','private-metadata','compatibility'], 'source.classification');
    one(row.readPolicy, ['metadata-only','selected-design','no-content-read'], 'source.readPolicy'); refs(row.topicIds, topicIds, 'source.topicIds');
    if ((row.sha256 === null || row.byteLength === null) && !(row.sha256 === null && row.byteLength === null && row.readPolicy === 'no-content-read')) fail('source.unread-metadata');
    if (row.sha256 === null && !/not[ -](?:read|inspected|opened)|unread|no[ -]content[ -]read|metadata[- ](?:locator|only)/i.test(row.note)) fail('source.unread-note');
    if (row.sha256 !== null && (typeof row.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(row.sha256))) fail('source.hash');
    if (row.byteLength !== null && (!Number.isSafeInteger(row.byteLength) || row.byteLength < 0)) fail('source.byteLength');
    if ((privatePath.test(row.path) || row.classification === 'private-metadata') && row.readPolicy === 'selected-design') fail('private-content-read');
  }
  for (const row of catalog.topics) {
    object(row, ['id','parentId','kind','title','sourceIds','dependsOn'], 'topic'); text(row.title, 'topic.title'); one(row.kind, ['domain','workflow','foundation'], 'topic.kind');
    if (row.parentId !== null && !topicIds.has(row.parentId)) fail('topic.parent:dangling'); refs(row.sourceIds, sourceIds, 'topic.sourceIds'); refs(row.dependsOn, topicIds, 'topic.dependsOn');
  }
  for (const row of catalog.records) {
    object(row, ['id','kind','status','title','text','topicIds','sourceIds','originalIds','supersedes'], 'record');
    one(row.kind, ['actual-user-decision','source-owner-decision','proposal','inference','coverage-gap'], 'record.kind'); one(row.status, ['current','historical','proposed','unresolved'], 'record.status');
    text(row.title, 'record.title'); text(row.text, 'record.text'); refs(row.topicIds, topicIds, 'record.topicIds'); refs(row.sourceIds, sourceIds, 'record.sourceIds'); ids(row.originalIds, 'record.originalIds'); refs(row.supersedes, recordIds, 'record.supersedes');
    if (row.kind === 'actual-user-decision' && (!row.originalIds.length || !row.sourceIds.length)) fail('record.user-provenance');
    if (row.kind === 'proposal' && row.status === 'current') fail('record.proposal-is-not-decision');
  }
  for (const row of catalog.findings) {
    object(row, ['id','category','priority','status','title','detail','topicIds','sourceIds','taskId','nextAction'], 'finding');
    for (const value of [row.category,row.title,row.detail,row.nextAction]) text(value, 'finding.text'); id(row.taskId, 'finding.taskId');
    one(row.priority, ['P1','P2','P3'], 'finding.priority'); one(row.status, ['observed','mitigated-locally','peer-in-progress','deferred-owner','unverified'], 'finding.status');
    refs(row.topicIds, topicIds, 'finding.topicIds'); refs(row.sourceIds, sourceIds, 'finding.sourceIds');
  }
  const endpoints = new Set([...repositoryIds,...topicIds,...sourceIds,...recordIds,...catalog.findings.map(x => x.id)]);
  for (const row of catalog.relations) {
    object(row, ['id','topology','from','to','meaning'], 'relation'); text(row.meaning, 'relation.meaning');
    one(row.topology, ['containment','dependency','provenance','semantic','revision','workflow-cycle'], 'relation.topology');
    if (!endpoints.has(row.from) || !endpoints.has(row.to)) fail('relation.endpoint:dangling');
  }
  for (const topology of ['containment','dependency','revision'] as const) {
    const edges: Array<[string,string]> = catalog.relations.filter(x => x.topology === topology).map(x => [x.from,x.to]);
    if (topology === 'containment') edges.push(...catalog.topics.flatMap(x => x.parentId ? [[x.parentId,x.id] as [string,string]] : []));
    if (topology === 'dependency') edges.push(...catalog.topics.flatMap(x => x.dependsOn.map(target => [x.id,target] as [string,string])));
    if (topology === 'revision') edges.push(...catalog.records.flatMap(x => x.supersedes.map(target => [x.id,target] as [string,string])));
    dag(edges, topology);
  }
  return catalog;
}

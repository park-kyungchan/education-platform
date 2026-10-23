import { describe, expect, test } from 'bun:test';
import type { Catalog, SelectionPage } from './types.ts';
import { validateCatalog } from './validate.ts';
import { catalogSha256, ContextSelectionError, selectContext } from './select.ts';

function fixture(): Catalog {
  return {
    schemaVersion:'academy.context-catalog/1',projectId:'academy-workbench',workId:'synthetic-context-test',authority:'none',nativePermissionGranted:false,defaultNavigation:['date','class','student'],
    coverage:{status:'partial',denominator:null,complete:false,note:'Synthetic metadata only; source population is unknown.'},
    scope:{included:['academy','foundation'],excluded:['academy.counseling','academy.parent-communication']},
    repositories:[{id:'repo',path:'/nonexistent/synthetic-owner',commit:'a'.repeat(40),role:'Synthetic source owner',observation:'local-checkout',dirty:false}],
    sources:[
      {id:'policy',repositoryId:'repo',path:'docs/policy.ts',sha256:'b'.repeat(64),byteLength:123,classification:'current-owner',readPolicy:'selected-design',ownerId:'academy',topicIds:['academy.preparation'],note:'Synthetic policy metadata, never opened.'},
      {id:'identity-source',repositoryId:'repo',path:'docs/identity.ts',sha256:'c'.repeat(64),byteLength:25,classification:'original-reference',readPolicy:'metadata-only',ownerId:'academy',topicIds:['foundation.identity'],note:'Synthetic source identity.'},
      {id:'private-source',repositoryId:'repo',path:'private/not-read.json',sha256:null,byteLength:null,classification:'private-metadata',readPolicy:'no-content-read',ownerId:'academy',topicIds:[],note:'Not read; metadata locator only, no actual private record.'},
    ],
    topics:[
      {id:'academy',parentId:null,kind:'domain',title:'Internal practice',sourceIds:[],dependsOn:[]},
      {id:'academy.preparation',parentId:'academy',kind:'workflow',title:'Date, class, student preparation',sourceIds:['policy'],dependsOn:['foundation.identity']},
      {id:'academy.unrelated',parentId:'academy',kind:'workflow',title:'Unrelated workflow',sourceIds:[],dependsOn:[]},
      {id:'academy.counseling',parentId:'academy',kind:'workflow',title:'Excluded counseling',sourceIds:[],dependsOn:[]},
      {id:'academy.counseling.detail',parentId:'academy.counseling',kind:'workflow',title:'Excluded child',sourceIds:[],dependsOn:[]},
      {id:'academy.parent-communication',parentId:'academy',kind:'workflow',title:'Excluded communication',sourceIds:[],dependsOn:[]},
      {id:'foundation',parentId:null,kind:'domain',title:'Foundations',sourceIds:[],dependsOn:[]},
      {id:'foundation.identity',parentId:'foundation',kind:'foundation',title:'Exact identity',sourceIds:['identity-source'],dependsOn:['foundation.provenance']},
      {id:'foundation.provenance',parentId:'foundation',kind:'foundation',title:'Evidence and unknown clocks',sourceIds:[],dependsOn:[]},
    ],
    records:[
      {id:'current-choice',kind:'source-owner-decision',status:'current',title:'Synthetic teacher choice',text:'Keep teacher completion beside conflicting source observations.',topicIds:['academy.preparation'],sourceIds:['policy'],originalIds:['synthetic-decision'],supersedes:['old-choice']},
      {id:'conflict-a',kind:'inference',status:'unresolved',title:'Source state',text:'Synthetic source reports pending; source clock unknown.',topicIds:['academy.preparation'],sourceIds:['policy'],originalIds:[],supersedes:[]},
      {id:'conflict-b',kind:'coverage-gap',status:'unresolved',title:'Teacher state',text:'Synthetic teacher completed; do not invent a latest timestamp.',topicIds:['academy.preparation'],sourceIds:['policy'],originalIds:[],supersedes:[]},
      {id:'old-choice',kind:'source-owner-decision',status:'historical',title:'Historical choice',text:'HISTORICAL-EXCLUDED-TEXT',topicIds:['academy.preparation'],sourceIds:['policy'],originalIds:['synthetic-old'],supersedes:[]},
      {id:'unrelated-record',kind:'proposal',status:'proposed',title:'Other idea',text:'UNRELATED-TEXT',topicIds:['academy.unrelated'],sourceIds:[],originalIds:[],supersedes:[]},
      {id:'excluded-record',kind:'inference',status:'unresolved',title:'Outside scope',text:'EXCLUDED-COUNSELING-TEXT',topicIds:['academy.counseling.detail'],sourceIds:[],originalIds:[],supersedes:[]},
    ],
    relations:[
      {id:'explicit-parent',topology:'containment',from:'academy',to:'academy.preparation',meaning:'Duplicate declaration of the same containment is harmless.'},
      {id:'explicit-dependency',topology:'dependency',from:'academy.preparation',to:'foundation.identity',meaning:'Exact identity is required.'},
      {id:'revision-link',topology:'revision',from:'current-choice',to:'old-choice',meaning:'Scoped successor, not destructive overwrite.'},
      {id:'private-provenance',topology:'provenance',from:'current-choice',to:'private-source',meaning:'Only an unread metadata locator.'},
      {id:'semantic-a',topology:'semantic',from:'conflict-a',to:'conflict-b',meaning:'Retain conflicting observations.'},
      {id:'semantic-b',topology:'semantic',from:'conflict-b',to:'conflict-a',meaning:'Semantic cycles are valid.'},
      {id:'workflow-cycle',topology:'workflow-cycle',from:'academy.preparation',to:'academy.preparation',meaning:'Another lesson repeats preparation.'},
    ],
    findings:[{id:'finding',category:'currentness',priority:'P1',status:'observed',title:'Synthetic conflict',detail:'Both observations remain visible.',topicIds:['academy.preparation'],sourceIds:['policy'],taskId:'ACX-T02',nextAction:'Reconcile scoped evidence without guessing.'}],
  };
}
const query = {topicId:'academy.preparation'};
function allPages(catalog: Catalog, maxBytes: number, includeHistory = false): SelectionPage[] {
  const pages: SelectionPage[] = []; let cursor: string | undefined;
  do {
    const page = selectContext(catalog,{...query,maxBytes,includeHistory,...(cursor ? {cursor} : {})});
    expect(page.usedBytes).toBe(Buffer.byteLength(JSON.stringify(page),'utf8')); expect(page.usedBytes).toBeLessThanOrEqual(maxBytes);
    pages.push(page); cursor=page.nextCursor ?? undefined;
    if (pages.length > 100) throw Error('Non-terminating pagination');
  } while (cursor);
  return pages;
}

describe('metadata catalog validation and selection', () => {
  test('expands parent and transitive dependencies, retains conflicts and source deduplication', () => {
    const page=selectContext(fixture(),query);
    expect(page.closure.topicIds).toEqual(['academy','academy.preparation','foundation','foundation.identity','foundation.provenance']);
    expect(page.items.filter(x=>x.kind==='source').map(x=>x.value.id)).toEqual(['identity-source','policy','private-source']);
    expect(page.items.filter(x=>x.kind==='record').map(x=>x.value.id)).toEqual(['current-choice','conflict-a','conflict-b']);
    expect(page.items.some(x=>x.kind==='finding')).toBe(true);
    expect(page.items.filter(x=>x.kind==='relation').map(x=>x.value.id)).toContain('semantic-b');
    expect(JSON.stringify(page)).not.toContain('UNRELATED-TEXT'); expect(JSON.stringify(page)).not.toContain('EXCLUDED-COUNSELING-TEXT');
    expect(JSON.stringify(page)).toContain('unknown'); expect(JSON.stringify(page)).not.toContain('"latest"');
  });
  test('historical prose is opt-in while required revision/provenance metadata remains', () => {
    const current=selectContext(fixture(),query), historical=selectContext(fixture(),{...query,includeHistory:true});
    expect(JSON.stringify(current)).not.toContain('HISTORICAL-EXCLUDED-TEXT');
    expect(current.items.find(x=>x.kind==='reference')?.value.id).toBe('old-choice');
    expect(current.items.some(x=>x.kind==='source' && x.value.sha256===null)).toBe(true);
    expect(JSON.stringify(historical)).toContain('HISTORICAL-EXCLUDED-TEXT'); expect(historical.closure.referenceCount).toBe(0);
  });
  test('dependency into excluded scope refuses and excluded descendants cannot be queried', () => {
    expect(()=>selectContext(fixture(),{topicId:'academy.counseling.detail'})).toThrow('topic-outside-scope');
    const catalog=fixture(); catalog.topics.find(x=>x.id===query.topicId)!.dependsOn.push('academy.counseling');
    expect(()=>selectContext(catalog,query)).toThrow('dependency-outside-scope');
  });
  test('mixed-topic excluded records never reenter through the allowed parent', () => {
    const catalog=fixture(); catalog.records.find(x=>x.id==='excluded-record')!.topicIds.push('academy');
    expect(JSON.stringify(selectContext(catalog,query))).not.toContain('EXCLUDED-COUNSELING-TEXT');
  });
  const excludedSource = (catalog: Catalog): void => {
    catalog.sources.push({...catalog.sources[0]!,id:'excluded-source',topicIds:['academy.counseling'],note:'EXCLUDED-ACTION-TEXT'});
  };
  for (const [route, attach] of [
    ['topic.sourceIds',(c:Catalog)=>c.topics.find(x=>x.id===query.topicId)!.sourceIds.push('excluded-source')],
    ['record.sourceIds',(c:Catalog)=>c.records[0]!.sourceIds.push('excluded-source')],
    ['finding.sourceIds',(c:Catalog)=>c.findings[0]!.sourceIds.push('excluded-source')],
    ['provenance relation',(c:Catalog)=>c.relations.push({id:'excluded-provenance',topology:'provenance',from:'current-choice',to:'excluded-source',meaning:'EXCLUDED-RELATION-MEANING'})],
    ['historical record.sourceIds',(c:Catalog)=>c.records.find(x=>x.id==='old-choice')!.sourceIds.push('excluded-source')],
    ['transitive historical source provenance',(c:Catalog)=>{
      c.records.find(x=>x.id==='old-choice')!.sourceIds.push('private-source');
      c.relations.push({id:'excluded-transitive-provenance',topology:'provenance',from:'private-source',to:'excluded-source',meaning:'EXCLUDED-RELATION-MEANING'});
    }],
  ] as const) {
    test(`required excluded source via ${route} refuses without leaking metadata or action text`, () => {
      const catalog=fixture(); excludedSource(catalog); attach(catalog); expect(()=>validateCatalog(catalog)).not.toThrow();
      for (const includeHistory of [false,true]) {
        try { selectContext(catalog,{...query,includeHistory}); throw Error('Expected scoped refusal'); }
        catch (error) {
          expect(error).toBeInstanceOf(ContextSelectionError); expect((error as ContextSelectionError).code).toBe('referenced-source-outside-scope');
          expect((error as ContextSelectionError).details).toEqual({sourceId:'excluded-source'});
          expect(String(error)).not.toContain('EXCLUDED-ACTION-TEXT'); expect(String(error)).not.toContain('EXCLUDED-RELATION-MEANING');
        }
      }
    });
  }
  test('required excluded historical record refuses but unrelated excluded history remains untouched', () => {
    const catalog=fixture();
    catalog.records.push({...catalog.records.find(x=>x.id==='old-choice')!,id:'excluded-history',topicIds:['academy.counseling'],text:'EXCLUDED-HISTORY-TEXT'});
    expect(()=>selectContext(catalog,query)).not.toThrow();
    catalog.records[0]!.supersedes.push('excluded-history'); expect(()=>validateCatalog(catalog)).not.toThrow();
    try { selectContext(catalog,query); throw Error('Expected scoped refusal'); }
    catch (error) { expect(error).toBeInstanceOf(ContextSelectionError); expect((error as ContextSelectionError).code).toBe('historical-reference-outside-scope'); expect((error as ContextSelectionError).details).toEqual({recordId:'excluded-history'}); expect(String(error)).not.toContain('EXCLUDED-HISTORY-TEXT'); }
  });
  test('provenance to an excluded current record cannot bypass scope', () => {
    const catalog=fixture(); catalog.relations.push({id:'excluded-current-ref',topology:'provenance',from:'current-choice',to:'excluded-record',meaning:'EXCLUDED-RELATION-MEANING'});
    expect(()=>validateCatalog(catalog)).not.toThrow(); expect(()=>selectContext(catalog,query)).toThrow('referenced-record-outside-scope');
  });
  test('current decisions, unresolved holds and prioritized findings precede source inventory', () => {
    const catalog=fixture();
    catalog.records.push({...catalog.records[0]!,id:'user-decision',kind:'actual-user-decision',supersedes:[],text:'Synthetic explicit user navigation decision.'});
    catalog.findings.push({...catalog.findings[0]!,id:'finding-p3',priority:'P3'},{...catalog.findings[0]!,id:'finding-p2',priority:'P2'});
    const full=selectContext(catalog,{...query,maxBytes:100_000});
    const kinds=full.items.map(x=>x.kind), ids=full.items.map(x=>x.value.id);
    expect(full.items.find(x=>x.kind!=='topic')?.value.id).toBe('user-decision');
    expect(ids.indexOf('user-decision')).toBeLessThan(ids.indexOf('current-choice'));
    expect(ids.indexOf('conflict-a')).toBeLessThan(kinds.indexOf('source'));
    expect(ids.indexOf('finding')).toBeLessThan(ids.indexOf('finding-p2')); expect(ids.indexOf('finding-p2')).toBeLessThan(ids.indexOf('finding-p3'));
    expect(ids.indexOf('finding-p3')).toBeLessThan(kinds.indexOf('source'));
    const pages=allPages(catalog,2200); expect(pages.flatMap(page=>page.items)).toEqual(full.items);
    expect(pages[0]!.items.some(item=>item.kind==='source')).toBe(false); // Source inventory cannot starve current decisions.
  });
  test('UTF8 page budget yields deterministic complete continuation without duplicates', () => {
    const catalog=fixture(); catalog.records[0]!.text='가나다😀'.repeat(30);
    const full=selectContext(catalog,{...query,maxBytes:100_000}); const pages=allPages(catalog,2200);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.flatMap(x=>x.items)).toEqual(full.items);
    expect(new Set(pages.flatMap(x=>x.items.map(item=>item.value.id))).size).toBe(full.items.length);
    expect(allPages(catalog,2200)).toEqual(pages);
  });
  test('oversize single item is explicitly refused instead of skipped or truncated', () => {
    const catalog=fixture(); catalog.records[0]!.text='가😀'.repeat(2000);
    try { allPages(catalog,2200); throw Error('Expected refusal'); }
    catch (error) { expect(error).toBeInstanceOf(ContextSelectionError); expect((error as ContextSelectionError).code).toBe('item-exceeds-byte-budget'); expect((error as ContextSelectionError).details.itemId).toBe('current-choice'); }
    expect(()=>selectContext(catalog,{...query,maxBytes:10})).toThrow('budget-smaller-than-page-metadata');
  });
  test('cursor is bound to topic, history flag, budget and exact canonical catalog', () => {
    const catalog=fixture(); const cursor=selectContext(catalog,{...query,maxBytes:2200}).nextCursor!;
    expect(cursor).not.toBeNull();
    for (const changed of [{topicId:'foundation.identity',maxBytes:2200},{...query,maxBytes:2200,includeHistory:true},{...query,maxBytes:2300}]) expect(()=>selectContext(catalog,{...changed,cursor})).toThrow('cursor-query-mismatch');
    catalog.records[0]!.text+=' changed'; expect(()=>selectContext(catalog,{...query,maxBytes:2200,cursor})).toThrow('stale-catalog-cursor');
  });
  test('rejects malformed, negative, out-of-range and noncanonical cursors', () => {
    const catalog=fixture(), first=selectContext(catalog,{...query,maxBytes:2200}), decoded=JSON.parse(Buffer.from(first.nextCursor!,'base64url').toString());
    for (const cursor of ['!','e30',Buffer.from(JSON.stringify({...decoded,offset:-1})).toString('base64url'),Buffer.from(JSON.stringify({...decoded,offset:9999})).toString('base64url')]) expect(()=>selectContext(catalog,{...query,maxBytes:2200,cursor})).toThrow('invalid-cursor');
  });
  test('stable object-key ordering does not create spurious catalog drift', () => {
    const catalog=fixture();
    // Reorder root keys only; nested keys and array order retain their meaning.
    const root=Object.fromEntries(Object.entries(catalog).reverse()) as unknown as Catalog;
    expect(catalogSha256(root)).toBe(catalogSha256(catalog));
  });
  test('partial coverage and local identities cannot become authority or completeness', () => {
    const catalog=fixture(); expect(validateCatalog(catalog,{projectId:catalog.projectId,workId:catalog.workId})).toBe(catalog);
    expect(()=>validateCatalog(catalog,{projectId:'foreign',workId:catalog.workId})).toThrow('identity-mismatch');
    for (const mutate of [(c:Catalog)=>{c.authority='granted' as never;},(c:Catalog)=>{c.nativePermissionGranted=true as never;},(c:Catalog)=>{c.coverage.complete=true as never;},(c:Catalog)=>{c.coverage.denominator=100 as never;}]) {const c=fixture(); mutate(c); expect(()=>validateCatalog(c)).toThrow();}
    expect(selectContext(catalog,query).coverage).toEqual(catalog.coverage);
  });
  test('rejects duplicate and dangling identity/reference links', () => {
    for (const mutate of [(c:Catalog)=>{c.sources[0]!.id=c.topics[0]!.id;},(c:Catalog)=>{c.records[0]!.sourceIds=['missing'];},(c:Catalog)=>{c.relations[0]!.to='missing';},(c:Catalog)=>{c.topics[1]!.parentId='missing';},(c:Catalog)=>{c.records[0]!.supersedes=['missing'];}]) {const c=fixture(); mutate(c); expect(()=>validateCatalog(c)).toThrow();}
  });
  test('rejects containment, dependency and revision cycles including mixed declaration forms', () => {
    for (const topology of ['containment','dependency','revision'] as const) {
      const c=fixture(); const [from,to]=topology==='containment'?['academy.preparation','academy']:topology==='dependency'?['foundation.identity','academy.preparation']:['old-choice','current-choice'];
      c.relations.push({id:'bad-cycle',topology,from:from!,to:to!,meaning:'Synthetic forbidden cycle'}); expect(()=>validateCatalog(c)).toThrow(`${topology}:cycle`);
    }
    expect(()=>validateCatalog(fixture())).not.toThrow();
  });
  test('private/unread sources cannot gain design-read policy; sources need not exist', () => {
    expect(()=>selectContext(fixture(),query)).not.toThrow();
    for (const path of ['private/evidence.json','context/private-students/index.json','config/credential.json','.env.local','archives/payload.tar.gz','context/user-context/sources/source-excerpts.json']) {
      const c=fixture(); c.sources[0]!.path=path; expect(()=>validateCatalog(c)).toThrow('private-content-read');
    }
    const c=fixture(); c.sources[2]!.readPolicy='metadata-only'; expect(()=>validateCatalog(c)).toThrow('source.unread-metadata');
  });
  test('rejects traversal, URI-like paths, incomplete pin pairs and fabricated user provenance', () => {
    for (const path of ['../outside.json','docs/../outside.json','docs/./bad.json','docs/%2e%2e/outside.json','/absolute.json','C:/outside.json','docs\\bad.json','https://example.test/file','file:relative.json']) {const c=fixture(); c.sources[0]!.path=path; expect(()=>validateCatalog(c)).toThrow('unsafe-path');}
    const c=fixture(); c.sources[0]!.sha256=null; expect(()=>validateCatalog(c)).toThrow('source.unread-metadata');
    const user=fixture(); user.records[0]!.kind='actual-user-decision'; user.records[0]!.originalIds=[]; expect(()=>validateCatalog(user)).toThrow('record.user-provenance');
    const wrongType=fixture(); wrongType.repositories[0]!.commit=['a'.repeat(40)] as never; expect(()=>validateCatalog(wrongType)).toThrow('repository.identity');
  });
  test('unknown schema fields and invalid query budgets fail closed', () => {
    expect(()=>validateCatalog({...fixture(),nativeRunId:'invented'})).toThrow('catalog:fields');
    for (const maxBytes of [0,-1,Infinity,NaN,1.2]) expect(()=>selectContext(fixture(),{...query,maxBytes})).toThrow('invalid-byte-budget');
    expect(()=>selectContext(fixture(),{topicId:'missing'})).toThrow('unknown-topic');
  });
});

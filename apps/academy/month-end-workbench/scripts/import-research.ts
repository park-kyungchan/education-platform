/** Node/Bun only pinned transport loader. Never executes archived scripts or changes source pins. */
import { readFile, writeFile, realpath, lstat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import lock from '../data/source-lock.json';
import { SOURCE_REVISION, type Projection, type SourceRef, type Json, type ResearchLink } from '../src/contracts.ts';
import { assertProjection } from '../src/validation.ts';
const sha = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const base = 'source/archive/research_review/';
const corpusPath = `${base}original_170_examples_and_hierarchy.json`;
const capabilityPath = 'source/capability-research/초3_105유형_능력후보_근거대응.json';
const identityPath = 'research/identity-pilot/samples/research-bundle.json';
export async function importPinnedResearch(sourceRoot: string): Promise<Projection> {
 const root = await realpath(sourceRoot);
 const git = (args: string[]) => { const r = spawnSync('git', ['-C', root, ...args], {encoding:'utf8'}); if(r.status!==0) throw new Error('Cannot inspect pinned source clone'); return r.stdout.trim(); };
 if(lock.revision!==SOURCE_REVISION || git(['rev-parse','HEAD'])!==SOURCE_REVISION) throw new Error('Source revision drift; explicit review required, never auto-repin');
 const tracked=git(['ls-files','-z']).split('\0').filter(Boolean).sort();
 if(JSON.stringify(tracked)!==JSON.stringify(lock.files.map(f=>f.path))) throw new Error('Source file set drift');
 if(git(['status','--porcelain','--untracked-files=no'])) throw new Error('Pinned source has tracked changes');
 const content = new Map<string,string>();
 for(const f of lock.files){
   if(f.path.startsWith('/')||f.path.split('/').includes('..')) throw new Error('Unsafe source pin');
   const path=join(root,f.path); if(!(await lstat(path)).isFile()) throw new Error('Source symlinks are not admitted');
   const bytes=await readFile(path); if(sha(bytes)!==f.sha256) throw new Error(`Source hash drift: ${f.path}`); content.set(f.path,bytes.toString('utf8'));
 }
 const json=(path:string):any=>JSON.parse(content.get(path)??'null');
 const ref=(path:string,pointer:string):SourceRef=>({owner:'math-research-module',revision:SOURCE_REVISION,path,sha256:lock.files.find(f=>f.path===path)!.sha256,pointer});
 const corpus=json(corpusPath);
 const units:any[]=corpus.nodes.map((n:any,i:number)=>({...n,source:ref(corpusPath,`/nodes/${i}`)}));
 // Upper connections have a different source hierarchy. Preserve its roots/details; do not invent middle levels.
 for(const [i,n] of corpus.upper.entries()) if(!units.some(u=>u.id===n.id)) units.push({id:n.id,title:n.title,parentId:null,level:'연결 내용',evidenceStatus:n.evidenceStatus,source:ref(corpusPath,`/upper/${i}`)});
 for(const [i,d] of corpus.details.entries()) if(!units.some(u=>u.id===d.id)) units.push({id:d.id,title:d.title,parentId:d.parentContentId,level:'연결 세부단원',evidenceStatus:d.evidenceStatus,source:ref(corpusPath,`/details/${i}`)});
 const types:any[]=[];
 for(const [i,d] of corpus.details.entries()) for(const [j,t] of (d.types??[]).entries()){
   const pointer=`/details/${i}/types/${j}`; const examples=[{id:`${t.id}:basic`,typeId:t.id,kind:'basic',prompt:t.example.prompt,answer:t.example.answer,source:ref(corpusPath,`${pointer}/example`)}];
   for(const [k,v] of (t.variants??[]).entries()) examples.push({id:v.id,typeId:t.id,kind:'variant',prompt:v.prompt??v.example?.prompt,answer:v.answer??v.example?.answer,source:ref(corpusPath,`${pointer}/variants/${k}`)});
   types.push({id:t.id,title:t.title,detailId:d.id,scope:t.id.startsWith('H')?'grade3':'upper',original:t,examples,source:ref(corpusPath,pointer)});
 }
 const designs:any[]=[];
 for(const filename of ['multiplication_designs.json','division_designs.json','circle_designs.json','upper_designs.json']){
   const path=base+filename, data=json(path), entries=Array.isArray(data.designs)?data.designs.map((d:any,i:number)=>[String(i),d]):Object.entries(data);
   for(const [key,d] of entries){const typeId=d.subtypeId; const pointer=data.designs?`/designs/${key}`:`/${key}`;
     designs.push({typeId,original:d,source:ref(path,pointer),microsteps:(d.actionDesign?.microActions??[]).map((a:any,i:number)=>({id:a.id,typeId,original:a,source:ref(path,`${pointer}/actionDesign/microActions/${i}`)}))});
   }
 }
 const capabilityResearch=json(capabilityPath);
 const sources=[...corpus.sources,...json(base+'sources.json').sources,...json(base+'psychology_sources.json').sources];
 const sourceMap=new Map<string,any>(); for(const s of sources) if(!sourceMap.has(s.id)) sourceMap.set(s.id,s);
 const contentObjects=[...corpus.core,...corpus.upper];
 const links:ResearchLink[]=[];
 for(const [i,e] of corpus.edges.entries())links.push({relation:e.relation==='essential'?'prerequisite':'content-connection',originalRelation:e.relation,rationale:e.reason,scopeCondition:e.scopeCondition,from:e.source,to:e.target,source:ref(corpusPath,`/edges/${i}`),status:'proposal'});
 for(const u of units) if(u.parentId) links.push({relation:'contains',from:u.parentId,to:u.id,source:u.source,status:'proposal'});
 for(const [i,m] of capabilityResearch.mapping.entries())for(const id of [...m.structuralCandidateIds,...m.explicitProcessProbeIds])links.push({relation:'capability-hypothesis',from:m.typeId,to:id,source:ref(capabilityPath,`/mapping/${i}`),status:'proposal'});
 for(const t of types) links.push({relation:'type-membership',from:t.detailId,to:t.id,source:t.source,status:'original-research'});
 for(const d of designs) for(const sourceId of d.original.sourceIds??[]) links.push({relation:'literature-evidence',from:d.typeId,to:sourceId,source:d.source,status:'proposal'});
 const correctionPath='docs/review/correction-proposals.v1.json',correction=json(correctionPath);
 // Curated synthetic pilot only, with original immutable revision identities/hashes and graph.
 const pilot=json(identityPath);
 const {validateBundle}=await import(pathToFileURL(join(root,'research/identity-pilot/src/validation.ts')).href);
 if(validateBundle(pilot).length) throw new Error('Source-owned research identity validation failed');
 const requirementsPath='context/monthly-assessment-20261016/requirements.json';
 const requirements=json(requirementsPath), sourceCatalog=json('context/monthly-assessment-20261016/sources.json');
 const assessmentResearch={...requirements, sources:sourceCatalog.sources.map((s:any)=>({sourceKey:s.sourceKey,author:s.author,textSha256:s.textSha256,authority:s.authority,nativePermissionGranted:s.nativePermissionGranted})), records:requirements.records.map((r:any,i:number)=>({...r,source:ref(requirementsPath,`/records/${i}`)}))};
 const projection:Projection={schema:'month-end.research-projection.v1',owner:'math-research-module',revision:SOURCE_REVISION,authority:{nativePermissionGranted:false,actualAcceptanceInferred:false,grantsExecution:false},manifest:lock.files,contentObjects,units,types,designs,links,sources:[...sourceMap.values()],capabilityResearch,identityPilot:pilot,assessmentResearch,
 warnings:[{id:correction.proposalId,typeId:correction.typeId,status:correction.status,title:correction.finding.title,conclusion:correction.finding.mathematicalConclusion,source:ref(correctionPath,'/finding')}],
 coverage:{grade3Types:types.filter(t=>t.scope==='grade3').length,upperTypes:types.filter(t=>t.scope==='upper').length,basicExamples:types.length,variantExamples:types.reduce((n,t)=>n+t.examples.length-1,0),designs:designs.length,microsteps:designs.reduce((n,d)=>n+d.microsteps.length,0),archiveBlobs:lock.files.filter(f=>f.path.startsWith('source/archive/')).length}};
 assertProjection(projection); return projection;
}
if(import.meta.main){
 const [mode,root]=process.argv.slice(2); if(!root||!['--write','--verify'].includes(mode??'')) throw new Error('Usage: bun scripts/import-research.ts --verify|--write /pinned/clone');
 const data=JSON.stringify(await importPinnedResearch(root),null,2)+'\n'; const target=resolve(import.meta.dir,'../data/research-projection.json');
 if(mode==='--verify'){if(await readFile(target,'utf8')!==data) throw new Error('Committed projection differs from pinned deterministic projection');console.log('All238 pinned blobs and deterministic curated projection match.');}
 else {await writeFile(target,data);console.log('Reproduced projection from unchanged explicit source pins.');}
}

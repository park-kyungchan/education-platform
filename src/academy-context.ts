import {existsSync,lstatSync,readFileSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {runContextCli} from '../modules/academy-workbench/context/academy-context/cli';
import {validateCatalog} from '../modules/academy-workbench/context/academy-context/validate';

export const academyContextRoot=resolve(import.meta.dir,'..');
type PackageRoute={packageId:string;sourceCommit:string;proposedDestinationRoot:string;fileCount:number;bytes:number;manifestSha256:string};
type Integration={schema:'education.private-context-integration/v1';targetRepository:string;visibilityRequired:string;packages:PackageRoute[];additionalCustody?:{totalFiles:number;groups:{sourceRoot:string;destinationRoot:string;fileCount:number;bytes:number}[]}};

/** Discovery metadata only: no student source body, native store or network is opened. */
export function privatePackageRoutes(manifest:Integration,businessDate?:string){
 if(manifest.schema!=='education.private-context-integration/v1'||manifest.targetRepository!=='park-kyungchan/education-platform'||manifest.visibilityRequired!=='private')throw Error('academy_context_private_owner_required');
 if(businessDate!==undefined&&!/^\d{4}-\d{2}-\d{2}$/.test(businessDate))throw Error('academy_context_invalid_business_date');
 const routes=manifest.packages.filter(p=>businessDate===undefined||p.packageId===businessDate||p.packageId.startsWith(businessDate+'-')).map(p=>{
  if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}(?:-[a-z0-9-]+)?$/.test(p.packageId)||p.proposedDestinationRoot!=='context/private-students/'+p.packageId||!Number.isSafeInteger(p.fileCount)||p.fileCount<1||!Number.isSafeInteger(p.bytes)||p.bytes<1||!/^[a-f0-9]{64}$/.test(p.manifestSha256)||!/^[a-f0-9]{40}$/.test(p.sourceCommit))throw Error('academy_context_invalid_package_route');
  return {packageId:p.packageId,packageDate:p.packageId.slice(0,10),root:p.proposedDestinationRoot,manifest:p.proposedDestinationRoot+'/manifest.json',manifestSha256:p.manifestSha256,originalSourceCommit:p.sourceCommit,fileCount:p.fileCount,bytes:p.bytes,
   readEntry:p.packageId==='2026-10-21'?p.proposedDestinationRoot+'/views/read-entry.json':p.proposedDestinationRoot+'/manifest.json',
   readRule:'Select exact date/class/student/book/occurrence at the existing source entry. Preserve scoped corrections and consume every required page; this route does not open the body.'};
 });
 if(businessDate!==undefined&&routes.length===0)throw Error('academy_context_business_date_not_retained');
 return routes;
}

export async function runIntegratedAcademyContext(args:readonly string[]){
 const [command,...rest]=args;
 if(command==='resolve'){
  if(rest.length!==2||rest[0]!=='--source')throw Error('usage: resolve --source <source-id>');
  const catalog=validateCatalog(JSON.parse(readFileSync(resolve(academyContextRoot,'modules/academy-workbench/context/academy-context/catalog.json'),'utf8')));
  const source=catalog.sources.find(s=>s.id===rest[1]);if(!source)throw Error('academy_context_unknown_source');
  const roots:Record<string,string>={'academy-workbench':'modules/academy-workbench','academy-context-candidate':'modules/academy-workbench','dc-gang-a':'apps/academy/dc-gang-a','education-platform':'','math-research-module':'modules/math-research-module','math-education':'packages/curriculum','gang-a':'apps/academy/gang-a'};
  const result={schema:'education.academy-context-source-route.v1',sourceId:source.id,originalRepository:source.repositoryId,originalPath:source.path,expectedSha256:source.sha256,readPolicy:source.readPolicy,sourceBodiesEmitted:false,nativePermissionGranted:false};
  if(!Object.hasOwn(roots,source.repositoryId))return {...result,status:'external-owner',integratedPath:null,observedSha256:null};
  if(source.readPolicy==='no-content-read'||/^(?:private|archives|\.private|\.local)\//.test(source.path))return {...result,status:'metadata-only-private-custody',integratedPath:null,observedSha256:null};
  if(!source.path||source.path.startsWith('/')||source.path.includes('\\')||source.path.split('/').some(p=>!p||p==='.'||p==='..'))throw Error('academy_context_source_path_invalid');
  const prefix=source.repositoryId==='dc-gang-a'&&source.path.startsWith('context/private-students/')?'':roots[source.repositoryId]!;
  const integratedPath=[prefix,source.path].filter(Boolean).join('/');let target=academyContextRoot;
  for(const part of integratedPath.split('/')){target=resolve(target,part);if(!existsSync(target))return {...result,status:'not-imported',integratedPath,observedSha256:null};if(lstatSync(target).isSymbolicLink())throw Error('academy_context_source_symlink_rejected');}
  if(!target.startsWith(academyContextRoot+sep)||!lstatSync(target).isFile()||lstatSync(target).size>2*1024*1024)throw Error('academy_context_source_outside_bound');
  const observedSha256=createHash('sha256').update(readFileSync(target)).digest('hex');
  return {...result,status:source.sha256===null?'original-pin-unavailable':observedSha256===source.sha256?'original-bytes-retained':'changed-source-requires-scoped-review',integratedPath,observedSha256};
 }
 if(command==='entry'){
  if(rest.length!==0&&(rest.length!==2||rest[0]!=='--date'))throw Error('usage: entry [--date YYYY-MM-DD]');
  const manifest=JSON.parse(readFileSync(resolve(academyContextRoot,'provenance/private-context-integration.json'),'utf8')) as Integration;
  let packages:ReturnType<typeof privatePackageRoutes>;
  try{packages=privatePackageRoutes(manifest,rest[1]);}catch(error){if(rest[1]&&error instanceof Error&&error.message==='academy_context_business_date_not_retained')packages=[];else throw error;}
  return {schema:'education.academy-context-entry.v1',repository:'park-kyungchan/education-platform',sourceBodiesLoaded:false,nativePermissionGranted:false,authority:'none',
   currentWork:'work/education-platform/academy-repository-integration-20261023/work.json',
   currentDirection:'Use the integrated Education source. Historical keep-repositories/no-migration decisions retain their prior scope; current decisions govern this integration only.',
   hierarchy:['work-purpose','business-date','class-or-cohort','student','book-edition','unit','activity','occurrence-or-attempt','stage-and-attributable-observation-or-decision'],
   relationBoundaries:'Containment, prerequisite, provenance, scoped correction and recurring workflow are distinct. Missing evidence is unknown; latest timestamp alone never overwrites a different occurrence.',
   policy:'apps/academy/dc-gang-a/docs/academy-operational-contract.json',
   dailyRecordPolicy:'apps/academy/dc-gang-a/docs/daily-record-authoring-policy.md',
   workflowSelection:'context:academy reading-plan --topic <workflow>; context:academy select --topic <workflow> --max-bytes <budget>',
   resolveSelectedSource:'context:academy resolve --source <source-id>; returns the integrated path and current hash without source text',
   practicalContext:'modules/academy-workbench/context/academy-context/catalog.json',
   researchContext:'modules/math-research-module/context/monthly-assessment-20261016/README.md',
   requestedBusinessDate:rest[1]??null,privatePackages:packages,
   additionalCustody:manifest.additionalCustody?{files:manifest.additionalCustody.totalFiles,groups:manifest.additionalCustody.groups.map(g=>({root:g.destinationRoot,files:g.fileCount,bytes:g.bytes})),readRule:'These are preserved snapshots and opaque archives. A directory date is not every contained event date. Select exact manifest/source fragments; never extract or load all archives by default.'}:null,
   dateCoverage:rest[1]&&packages.length===0?'No exact dated package in this namespace; retained archives may contain relevant history. This is unknown coverage, not absence of student activity.':'Package dates identify source custody; qualify the actual lesson/attempt date inside the selected source.',
   excluded:'Root October23 operational outputs/worktrees, live/native stores, credentials, services and parent sends. No automatic source acquisition, deployment or native activation.',
   coverage:'Exact retained packages and selected source metadata only; all-time academy history and current source health remain unverified.'};
 }
 if(!['inspect','select','reading-plan'].includes(command??''))throw Error('usage: context:academy entry|inspect|select|reading-plan|resolve');
 return runContextCli([...args]);
}

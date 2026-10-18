import {realpathSync} from 'node:fs';
import {dirname,delimiter,resolve,sep} from 'node:path';
import type {AcademyGangSourceMaintenance,EducationModule,ModuleId,SourceMap} from './contracts';
import {assertBunRuntime} from './runtime';
export const projectRoot=resolve(import.meta.dir,'..');
export function validateModuleGraph(modules:readonly EducationModule[]):EducationModule[]{
 const byId=new Map<string,EducationModule>();
 for(const module of modules){if(byId.has(module.id))throw Error('duplicate_module');byId.set(module.id,module);}
 const visited=new Set<string>(),visiting=new Set<string>(),ordered:EducationModule[]=[];
 const visit=(id:string)=>{if(visited.has(id))return;if(visiting.has(id))throw Error('dependency_cycle');const module=byId.get(id);if(!module)throw Error('unknown_dependency');visiting.add(id);for(const child of module.dependsOn)visit(child);visiting.delete(id);visited.add(id);ordered.push(module);};
 for(const id of byId.keys())visit(id);return ordered;
}
export function resolveModuleRoot(module:EducationModule):string{
 if(!module.root||module.root.startsWith('/')||module.root.split('/').some(p=>!p||p==='.'||p==='..')||module.root.includes('\\'))throw Error('invalid_module_root');
 const root=realpathSync(resolve(projectRoot,module.root));if(!root.startsWith(projectRoot+sep))throw Error('module_root_escape');return root;
}
export function validateAcademyGangSourceMaintenance(input:SourceMap):AcademyGangSourceMaintenance{
 const owner=input.academyGangSourceMaintenance;
 if(!owner||!Array.isArray(input.academySources))throw Error('invalid_gang_source_maintenance');
 const imported=input.academySources.filter(source=>source.id===owner.importSourceRef);
 const inspected=input.academySources.filter(source=>source.id===owner.inspectedNativeReferenceRef);
 const academy=input.modules.find(module=>module.id==='academy');
 if(owner.maintainedCodeRoot!=='apps/academy/gang-a'||owner.retainedSourceRepository!=='park-kyungchan/gang-a'||academy?.root!=='apps/academy'||owner.importSourceRef!=='gang-a-upstream'||owner.inspectedNativeReferenceRef!=='gang-a-inspected-reference'||imported.length!==1||inspected.length!==1||imported[0]!.root!==owner.maintainedCodeRoot)throw Error('invalid_gang_owner_relation');
 const baseline=owner.retainedBaseline;
 if(!baseline||baseline.commit!=='7b5cf56dd6f19ffe56d180b61c03d8366f5f98b1'||baseline.commit!==imported[0]!.commit||baseline.tree!=='72736bdc69f26a233736f19cff7bfe948ba2226b'||baseline.trackedPaths!==129||baseline.frozenImplementationAndSourcePaths!==127||!Array.isArray(baseline.allowedGovernanceChanges)||baseline.allowedGovernanceChanges.length!==2||baseline.allowedGovernanceChanges[0]!=='README.md'||baseline.allowedGovernanceChanges[1]!=='.github/workflows/ci.yml')throw Error('invalid_gang_retained_baseline');
 if(inspected[0]!.root!==null||inspected[0]!.commit!=='d60498707b49ae75ef6916fecdbb7458b2ac58ea'||inspected[0]!.writePolicy!=='reference-only'||owner.nativeSourceParity!=='unverified; inspected d604 is historical reference only'||owner.runtimeAuthority!=='none'||owner.nativeOrDataCutoverPerformed!==false||owner.retirementAuthorized!==false)throw Error('gang_native_authority_not_inferred');
 return owner;
}
export async function readSourceMap():Promise<SourceMap>{
 const input=await Bun.file(resolve(projectRoot,'architecture/source-map.json')).json() as SourceMap;
 if(input.schema!=='education.source-map.v1'||input.authority!=='none'||input.ontologyVersion!=='0.2.0')throw Error('invalid_source_map');
 if(input.semanticState.mathematicsHumanDecision!=='PENDING'||input.semanticState.mathematicsCanonicalApplication!=='NOT_PERFORMED')throw Error('semantic_acceptance_not_inferred');
 for(const module of validateModuleGraph(input.modules)){resolveModuleRoot(module);if(module.native.authority!=='none'||!/^\w{40}$/.test(module.commit))throw Error('invalid_source_identity');}
 validateAcademyGangSourceMaintenance(input);
 return input;
}
export function moduleCheckExecution(module:EducationModule,script:string,invoker={executable:process.execPath,version:Bun.version,path:process.env.PATH}){
 if(!module.checks.includes(script))throw Error('unadmitted_script');
 const runtimeRoot=resolve(projectRoot,'.private/runtimes');
 const node=resolve(runtimeRoot,'node-26.7.0/bin/node'),npm=resolve(runtimeRoot,'npm-11.17.0/bin/npm-cli.js');
 if(module.runtime==='bun')assertBunRuntime(invoker.version);
 const command=module.runtime==='node-npm'?[node,npm,'run',script]:[invoker.executable,'run',script];
 const bins=[dirname(invoker.executable),resolve(runtimeRoot,'node-26.7.0/bin')];
 if(module.runtime==='node-npm')bins.reverse();
 const env={...process.env,PATH:[...bins,invoker.path??''].join(delimiter)};
 return {command,env};
}
export async function runModuleCheck(module:EducationModule,script:string):Promise<number>{
 const {command,env}=moduleCheckExecution(module,script);
 const proc=Bun.spawn(command,{cwd:resolveModuleRoot(module),env,stdin:'ignore',stdout:'inherit',stderr:'inherit'});return proc.exited;
}
export async function findModule(id:string):Promise<EducationModule>{const found=(await readSourceMap()).modules.find(m=>m.id===id);if(!found)throw Error('unknown_module');return found;}

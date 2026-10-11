import {realpathSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import type {EducationModule,ModuleId,SourceMap} from './contracts';
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
export async function readSourceMap():Promise<SourceMap>{
 const input=await Bun.file(resolve(projectRoot,'architecture/source-map.json')).json() as SourceMap;
 if(input.schema!=='education.source-map.v1'||input.authority!=='none'||input.ontologyVersion!=='0.2.0')throw Error('invalid_source_map');
 if(input.semanticState.mathematicsHumanDecision!=='PENDING'||input.semanticState.mathematicsCanonicalApplication!=='NOT_PERFORMED')throw Error('semantic_acceptance_not_inferred');
 for(const module of validateModuleGraph(input.modules)){resolveModuleRoot(module);if(module.native.authority!=='none'||!/^\w{40}$/.test(module.commit))throw Error('invalid_source_identity');}
 return input;
}
export async function runModuleCheck(module:EducationModule,script:string):Promise<number>{
 if(!module.checks.includes(script))throw Error('unadmitted_script');
 const runtimeRoot=resolve(projectRoot,'.private/runtimes');
 const bun=resolve(runtimeRoot,module.id==='mathcrew'?'bun-1.4.1/bin/bun':'bun-1.4.2/bin/bun');
 const node=resolve(runtimeRoot,'node-26.7.0/bin/node'),npm=resolve(runtimeRoot,'npm-11.17.0/bin/npm-cli.js');
 const command=module.runtime==='node-npm'?[node,npm,'run',script]:[bun,'run',script];
 const env={...process.env,PATH:resolve(runtimeRoot,'node-26.7.0/bin')+':'+resolve(runtimeRoot,module.id==='mathcrew'?'bun-1.4.1/bin':'bun-1.4.2/bin')+':'+process.env.PATH};
 const proc=Bun.spawn(command,{cwd:resolveModuleRoot(module),env,stdin:'ignore',stdout:'inherit',stderr:'inherit'});return proc.exited;
}
export async function findModule(id:string):Promise<EducationModule>{const found=(await readSourceMap()).modules.find(m=>m.id===id);if(!found)throw Error('unknown_module');return found;}

import {assertArtifact} from '@palantirkc/ontology';
import {resolve} from 'node:path';
import {readSourceMap,validateModuleGraph,runModuleCheck,projectRoot} from '../src/modules';
import {assertBunRuntime} from '../src/runtime';
assertBunRuntime();
for(const path of ['project.json','verification/integration.json','verification/consumer-parity.json','verification/serving-observation.json','verification/check-evidence.json','verification/bun-currentness-20261016.json'])assertArtifact(await Bun.file(resolve(projectRoot,path)).json());
const source=await readSourceMap();
for(const args of [['run','typecheck'],['test','./tests'],['run','verify:imports']]){const p=Bun.spawn([process.execPath,...args],{cwd:projectRoot,stdout:'inherit',stderr:'inherit'});if(await p.exited!==0)process.exit(1);}
for(const module of validateModuleGraph(source.modules))for(const script of module.checks){console.log(JSON.stringify({module:module.id,script,referenceRuntime:module.runtime}));if(await runModuleCheck(module,script)!==0)process.exit(1);}
console.log(JSON.stringify({status:'pass',scope:'local-source-and-synthetic-module-integration',nativeEffects:0,productionVerified:false,humanAcceptance:'pending'}));

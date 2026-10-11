import {readSourceMap,findModule,runModuleCheck,validateModuleGraph} from './modules';
const [command,id,script,...extra]=Bun.argv.slice(2);
if(command==='status'&&!id){const source=await readSourceMap();console.log(JSON.stringify({projectId:source.projectId,authority:source.authority,ontologyVersion:source.ontologyVersion,modules:validateModuleGraph(source.modules).map(m=>({id:m.id,root:m.root,runtime:m.runtime,sourceCommit:m.commit,native:m.native,entrypoints:m.entrypoints})),semanticState:source.semanticState,productionVerified:false},null,2));}
else if(command==='module'&&id&&!extra.length){const module=await findModule(id);if(script)process.exit(await runModuleCheck(module,script));console.log(JSON.stringify(module,null,2));}
else throw Error('usage: status | module <id> [admitted-check-script]');

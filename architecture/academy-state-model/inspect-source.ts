/** Metadata-only source inspection. Uses an external parser, never imports product entrypoints. */
import ts from '/home/palantirkc/projects/agent-platform/node_modules/typescript/lib/typescript.js';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {selection} from './selection';
const base='4bdef2c77cb9a537cecf806ba16054646147dbc5';
const git=(args:string[])=>{const p=Bun.spawnSync(['git',...args]);if(p.exitCode)throw Error(p.stderr.toString());return p.stdout.toString().trim();};
const sha=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex');
const roots=['apps/academy/dc-gang-a/src','apps/academy/gang-a/packages','apps/academy/month-end-workbench/src','apps/academy/month-end-web/src'];
const files=git(['ls-tree','-r','--name-only',base,'--',...roots]).split('\n').filter(p=>/\.tsx?$/.test(p));
const layer=(p:string)=>p.includes('/dc-gang-a/src/academy/')?'dc-application':p.includes('/dc-gang-a/src/lms/')?'dc-lms':p.includes('/gang-a/packages/')?'gang-a':p.includes('/month-end-web/')?'month-end-web':p.includes('/month-end-workbench/')?'month-end-application':'other';
const edges:{from:string;to:string;specifier:string;line:number;symbols:{name:string;typeOnly:boolean}[];typeOnly:boolean}[]=[];
const dynamicDependencies:{from:string;line:number;argumentKind:'literal'|'computed';specifier:string|null;to:string|null;resolution:'source-locator-only-not-executed'|'unknown-runtime-target';expression:string|null}[]=[];
const sources=files.map(path=>{
  const bytes=readFileSync(path);if(sha(bytes)!==sha(Bun.spawnSync(['git','show',base+':'+path]).stdout))throw Error('source_drift:'+path);
  const text=bytes.toString(),ast=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true);
  const visit=(node:ts.Node):void=>{
    if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword){
      const arg=node.arguments[0],literal=arg&&(ts.isStringLiteral(arg)||ts.isNoSubstitutionTemplateLiteral(arg))?arg.text:null;
      const target=literal?.startsWith('.')?resolve(dirname(path),literal):null;
      const found=target?[target,target+'.ts',target+'.tsx',resolve(target,'index.ts')].find(p=>existsSync(p)&&Bun.file(p).size>0):null;
      dynamicDependencies.push({from:path,line:ast.getLineAndCharacterOfPosition(node.getStart()).line+1,argumentKind:literal===null?'computed':'literal',specifier:literal,to:found?relative(process.cwd(),found):null,resolution:found?'source-locator-only-not-executed':'unknown-runtime-target',expression:literal===null?arg?.getText(ast)??null:null});
    }
    ts.forEachChild(node,visit);
  };
  visit(ast);
  for(const node of ast.statements){
    if(!ts.isImportDeclaration(node)&&!ts.isExportDeclaration(node)||!node.moduleSpecifier||!ts.isStringLiteral(node.moduleSpecifier))continue;
    const specifier=node.moduleSpecifier.text;if(!specifier.startsWith('.'))continue;
    const target=resolve(dirname(path),specifier),found=[target,target+'.ts',target+'.tsx',resolve(target,'index.ts')].find(p=>existsSync(p)&&Bun.file(p).size>0);
    const to=found?relative(process.cwd(),found):specifier;
    const clause=ts.isImportDeclaration(node)?node.importClause:undefined;
    const bindings=clause?.namedBindings;
    const symbols=bindings&&ts.isNamedImports(bindings)?bindings.elements.map(el=>({name:(el.propertyName??el.name).text,typeOnly:!!clause?.isTypeOnly||el.isTypeOnly})):clause?.name?[{name:clause.name.text,typeOnly:clause.isTypeOnly}]:[];
    edges.push({from:path,to,specifier,line:ast.getLineAndCharacterOfPosition(node.getStart()).line+1,symbols,typeOnly:(ts.isExportDeclaration(node)&&node.isTypeOnly)||!!clause?.isTypeOnly||symbols.length>0&&symbols.every(s=>s.typeOnly)});
  }
  return {path,sha256:sha(bytes),blobOid:git(['rev-parse',base+':'+path]),bytes:bytes.length};
});
const crossing=edges.filter(e=>layer(e.from)!==layer(e.to));
// Layer coupling is not proof of a file-level cycle; retain exact directional edges.
const layerEdges=[...new Set(crossing.map(e=>layer(e.from)+' -> '+layer(e.to)))].sort();
const evidencePaths=[...new Set(selection.workflows.flatMap(w=>[...w.evidencePaths]))].sort();
const supplemental=evidencePaths.filter(p=>!sources.some(s=>s.path===p)).map(path=>{const bytes=readFileSync(path);return {path,sha256:sha(bytes),blobOid:git(['rev-parse',base+':'+path]),bytes:bytes.length};});
const readInputImports=edges.filter(e=>e.symbols.some(s=>s.name==='readInputRecord'));
const lmsBackImports=edges.filter(e=>layer(e.from)==='dc-lms'&&layer(e.to)==='dc-application');
const dcGangImports=edges.filter(e=>layer(e.from)==='dc-application'&&layer(e.to)==='gang-a');
const result={schema:'academy.dom01-source-evidence.v1',sourceCommit:base,parser:{owner:'external agent-platform analyzer dependency',version:ts.version},scope:roots,inventoryLimits:{staticCountMeaning:'Top-level static import/export declarations only; dynamic imports excluded from this count.',completeRuntimeImportClosure:false,dynamicMeaning:'Literal dependencies are source locators only; computed runtime/data-URL targets remain unresolved. No import or native execution performed.',excluded:'Require calls, generated release contents, evaluated data URLs, runtime-loaded config/assets and transitive external package/runtime resolution are not qualified by this inventory.'},sourceBodiesRetained:false,sources:[...sources,...supplemental],importEdges:edges,dynamicDependencies,crossLayerEdges:crossing,layerEdges,actualApplicationLmsCoupling:'bidirectional; exact module edges retained including type-only edges',readInputImports,lmsBackImports,dcGangImports,selection};
if(process.argv.includes('--write'))await Bun.write('architecture/academy-state-model/source-evidence.json',JSON.stringify(result,null,2)+'\n');
else {
 const saved=await Bun.file('architecture/academy-state-model/source-evidence.json').json();
 if(JSON.stringify(saved)!==JSON.stringify(result))throw Error('source_evidence_drift');
}
console.log(JSON.stringify({sources:result.sources.length,staticDeclarations:edges.length,dynamicDependencies,completeRuntimeImportClosure:false,crossLayerEdges:crossing.length,readInputImports:readInputImports.length,lmsBackImports,dcGangImports,mode:process.argv.includes('--write')?'write':'verify'}));

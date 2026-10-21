/** Refine the qualified frozen graph only at changed files; do not repeat the whole source scan. */
import assert from 'node:assert/strict';
import ts from '/home/palantirkc/projects/agent-platform/node_modules/typescript/lib/typescript.js';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
export const boundaryBase='b9c954cb8f5bf9b0748bb5634b4951c5954e9a6b';
export const boundaryRoot=resolve(import.meta.dir,'../..');
const prefix='apps/academy/dc-gang-a/src/';
const domCommit='f690ba381a61ba5b8b50006802649dccba3cc417';
const sha=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex');
const git=(args:string[])=>{const p=Bun.spawnSync(['git',...args],{cwd:boundaryRoot});assert.equal(p.exitCode,0,'git read failed');return p.stdout.toString().trim();};
const baseText=(path:string)=>git(['show',boundaryBase+':'+path]);
const currentText=(path:string)=>readFileSync(resolve(boundaryRoot,path),'utf8').trimEnd();
const frozenRead=Bun.spawnSync(['git','show',domCommit+':architecture/academy-state-model/source-evidence.json'],{cwd:boundaryRoot});
assert.equal(frozenRead.exitCode,0);
const frozen=JSON.parse(frozenRead.stdout.toString());
export const moved=[
  {from:prefix+'lms/academyReadProtocol.ts',to:prefix+'contracts/readInputRecord.ts',names:['readInputRecord']},
  {from:prefix+'academy/teacherWorkspace.ts',to:prefix+'contracts/parentInternalLanguage.ts',names:['parentInternalLanguage']},
  {from:prefix+'academy/domain.ts',to:prefix+'contracts/catalogLevels.ts',names:['CatalogKind','catalogLevels']},
  {from:prefix+'academy/operationalContract.ts',to:prefix+'contracts/operationalContractShape.ts',names:['OPERATIONAL_CONTRACT_PATH','OPERATIONAL_CONTRACT_REVISION','operationalTopics','OperationalTopic','operationalContractShape']},
  {from:prefix+'academy/nativeBookSource.ts',to:prefix+'contracts/sourceDiscovery.ts',names:['SourceDiscoveryRequest']},
] as const;
export const changedExisting:string[]=[...new Set([...frozen.readInputImports.map((r:{from:string})=>r.from),...moved.map(r=>r.from),...frozen.lmsBackImports.map((r:{from:string})=>r.from)])].sort();
export const newLeaves:string[]=moved.map(r=>r.to);
type SymbolRef={name:string;local:string;typeOnly:boolean};
interface Edge {from:string;to:string;specifier:string;line:number;kind:'import'|'export';symbols:SymbolRef[];typeOnly:boolean}
const parsed=(path:string,text:string)=>ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true);
const named=(node:ts.Statement,file:ts.SourceFile):string[]=>{
  if((ts.isFunctionDeclaration(node)||ts.isTypeAliasDeclaration(node)||ts.isInterfaceDeclaration(node))&&node.name)return [node.name.text];
  return ts.isVariableStatement(node)?node.declarationList.declarations.map(d=>d.name.getText(file)):[];
};
const declaration=(path:string,text:string,name:string)=>{const file=parsed(path,text),node=file.statements.find(n=>named(n,file).includes(name));assert(node,'missing declaration '+path+'#'+name);return node.getText(file);};
function edges(path:string,text:string):Edge[]{
  const file=parsed(path,text),result:Edge[]=[];
  for(const node of file.statements){
    if((!ts.isImportDeclaration(node)&&!ts.isExportDeclaration(node))||!node.moduleSpecifier||!ts.isStringLiteral(node.moduleSpecifier))continue;
    const specifier=node.moduleSpecifier.text;
    const target=specifier.startsWith('.')?resolve(boundaryRoot,dirname(path),specifier):null;
    const found=target?[target,target+'.ts',target+'.tsx',resolve(target,'index.ts')].find(p=>existsSync(p)):null;
    const clause=ts.isImportDeclaration(node)?node.importClause:undefined;
    const bindings=clause?.namedBindings??(ts.isExportDeclaration(node)?node.exportClause:undefined);
    const symbols=bindings&&(ts.isNamedImports(bindings)||ts.isNamedExports(bindings))?bindings.elements.map(el=>({name:(el.propertyName??el.name).text,local:el.name.text,typeOnly:!!clause?.isTypeOnly||ts.isExportDeclaration(node)&&node.isTypeOnly||el.isTypeOnly})):[];
    result.push({from:path,to:found?relative(boundaryRoot,found):specifier,specifier,line:file.getLineAndCharacterOfPosition(node.getStart()).line+1,kind:ts.isImportDeclaration(node)?'import':'export',symbols,typeOnly:!!clause?.isTypeOnly||ts.isExportDeclaration(node)&&node.isTypeOnly||symbols.length>0&&symbols.every(s=>s.typeOnly)});
  }
  return result;
}
export function inspectBoundary(){
  assert.equal(git(['rev-parse','HEAD']),boundaryBase,'require exact admitted base');
  assert.equal(frozen.readInputImports.length,17);assert.equal(frozen.lmsBackImports.length,3);
  // A tree-level path diff reuses the frozen graph without reparsing unchanged sources.
  assert.equal(git(['diff','--name-only',domCommit,boundaryBase,'--',...frozen.scope]),'','production source changed since DOM qualification');
  const changed=git(['diff','--name-only',boundaryBase,'--',...frozen.scope]).split('\n').filter(Boolean);
  assert.deepEqual(changed.sort(),changedExisting);
  const parsedPaths=[...changedExisting,...newLeaves];
  const before=changedExisting.flatMap(path=>edges(path,baseText(path)));
  const after=parsedPaths.flatMap(path=>edges(path,currentText(path)));
  const movedDeclarations=moved.flatMap(move=>move.names.map(name=>{
    const old=declaration(move.from,baseText(move.from),name),next=declaration(move.to,currentText(move.to),name);
    assert.equal(next,old,'moved declaration changed: '+name);
    const compatibility=after.find(e=>e.from===move.from&&e.to===move.to&&e.kind==='export'&&e.symbols.some(s=>s.name===name));
    assert(compatibility,'legacy export missing: '+name);
    return {name,from:move.from,to:move.to,exactDeclarationSha256:sha(old),compatibilityExportTypeOnly:compatibility.symbols.find(s=>s.name===name)!.typeOnly};
  }));
  const unchangedBodies=changedExisting.map(path=>{
    const movedNames:string[]=moved.filter(m=>m.from===path).flatMap(m=>[...m.names]);
    const retained=(text:string)=>{const file=parsed(path,text);return file.statements.filter(n=>!ts.isImportDeclaration(n)&&!ts.isExportDeclaration(n)&&!named(n,file).some(name=>movedNames.includes(name))).map(n=>n.getText(file));};
    assert.deepEqual(retained(currentText(path)),retained(baseText(path)),'non-import/retained body changed: '+path);
    return {path,unchangedNonImportStatements:true};
  });
  const readInputImports=frozen.readInputImports.map((prior:Edge)=>{
    const old=before.find(e=>e.from===prior.from&&e.symbols.some(s=>s.name==='readInputRecord'));
    assert(old);const next=after.find(e=>e.from===prior.from&&e.kind==='import'&&e.symbols.some(s=>s.name==='readInputRecord'));
    assert(next);assert.equal(next.to,prefix+'contracts/readInputRecord.ts');
    const other=old.symbols.filter(s=>s.name!=='readInputRecord');
    if(other.length)assert(after.some(e=>e.from===prior.from&&e.kind==='import'&&e.to===old.to&&JSON.stringify(e.symbols)===JSON.stringify(other)),'mixed import symbols lost: '+prior.from);
    return {from:prior.from,before:old,after:next,otherSymbolsRetained:other};
  });
  const reverseImports=frozen.lmsBackImports.map((prior:Edge)=>{
    const next=after.find(e=>e.from===prior.from&&e.kind==='import'&&e.symbols.some(s=>s.name===prior.symbols[0]!.name));
    assert(next);assert(next.to.startsWith(prefix+'contracts/'));assert.equal(next.typeOnly,prior.typeOnly);
    assert.deepEqual(next.symbols.map(({name,typeOnly})=>({name,typeOnly})),prior.symbols);
    return {before:prior,after:next};
  });
  // Preserve every other static edge/symbol; a removed mixed symbol cannot erase its remaining edge.
  for(const old of before.filter(e=>e.kind==='import')){
    const expectedSymbols=old.symbols.filter(s=>s.name!=='readInputRecord');
    const isReverse=frozen.lmsBackImports.some((e:Edge)=>e.from===old.from&&e.to===old.to);
    const removedCatalogImport=old.from===prefix+'academy/operationalContract.ts'&&old.to===prefix+'academy/domain.ts';
    if(isReverse||removedCatalogImport||!expectedSymbols.length&&old.symbols.length)continue;
    assert(after.some(e=>e.kind==='import'&&e.from===old.from&&e.to===old.to&&JSON.stringify(e.symbols)===JSON.stringify(expectedSymbols)),'real unchanged import lost: '+old.from+' -> '+old.to);
  }
  const leafDependencies=after.filter(e=>newLeaves.includes(e.from));
  assert(leafDependencies.every(e=>newLeaves.includes(e.to)),'neutral leaf imports a driver/application/external module');
  assert.deepEqual(leafDependencies.map(e=>({from:e.from,to:e.to})),[{from:prefix+'contracts/operationalContractShape.ts',to:prefix+'contracts/catalogLevels.ts'}]);
  for(const leaf of newLeaves){
    const file=parsed(leaf,currentText(leaf));
    function noEffect(node:ts.Node){assert(!(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword),'dynamic leaf dependency');assert(!(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&['require','fetch','eval'].includes(node.expression.text)),'effect in leaf');ts.forEachChild(node,noEffect);}
    noEffect(file);
  }
  const preservedCrossOwner=frozen.dcGangImports.map((row:Edge)=>{
    assert.equal(git(['rev-parse',boundaryBase+':'+row.from]),git(['rev-parse',domCommit+':'+row.from]));
    assert.equal(currentText(row.from),baseText(row.from));
    return row;
  });
  const preservedDynamics=frozen.dynamicDependencies.map((row:{from:string})=>{
    assert.equal(git(['rev-parse',boundaryBase+':'+row.from]),git(['rev-parse',domCommit+':'+row.from]));assert.equal(currentText(row.from),baseText(row.from));return row;
  });
  const inheritedEdges=frozen.importEdges.filter((e:Edge)=>!changedExisting.includes(e.from));
  const retainedAppToLms=[...inheritedEdges,...after].filter(e=>e.from.startsWith(prefix+'academy/')&&e.to.startsWith(prefix+'lms/'));
  const remainingLmsToApp=[...inheritedEdges,...after].filter(e=>e.from.startsWith(prefix+'lms/')&&e.to.startsWith(prefix+'academy/'));
  assert.equal(remainingLmsToApp.length,0,'reverse LMS/application coupling remains');
  const receipt={schema:'academy.qry-boundary-source-graph.v1',createdAt:new Date().toISOString(),sourceBase:boundaryBase,
    frozenDom:{commit:domCommit,tree:git(['rev-parse',domCommit+'^{tree}']),inventorySha256:sha(frozenRead.stdout),treeLevelSourceDiffToBase:'empty',wholeGraphReparsed:false},
    parser:{path:'/home/palantirkc/projects/agent-platform/node_modules/typescript/lib/typescript.js',version:ts.version},
    changedExisting,newLeaves,selectedFiles:parsedPaths.map(path=>({path,sha256:sha(readFileSync(resolve(boundaryRoot,path))),bytes:readFileSync(resolve(boundaryRoot,path)).length})),
    movedDeclarations,unchangedBodies,readInputImports,reverseImports,changedFileStaticEdges:after,
    retainedAppToLms,remainingLmsToApp,preservedDcToGangA:preservedCrossOwner,preservedDynamicDependencies:preservedDynamics,neutralLeafDependencies:leafDependencies,
    disposition:{directReverseStaticEdgesRemoved:3,readInputImportsRedirected:17,legacyReexportsRetained:true,applicationToLmsStillPresent:true,dcToGangAUnchanged:true,
      moduleLayerMeaning:'For the inherited frozen source scope, LMS no longer imports application; application still imports LMS and gang-a. Pure leaves import only another pure leaf. This is a scoped static-boundary result, not a whole-system DAG assertion.',
      fileLevelAcyclicity:'not claimed; no SCC recomputation or runtime closure qualification',literalDynamics:'unchanged source locators, not executed',computedDynamics:'unchanged unresolved runtime/data-URL targets, not removed from graph',
      excluded:'Require/generated release/runtime config/assets/external package resolution and actual native runtime behavior are outside inherited inventory qualification.',businessBodiesChanged:false,domainRefinementsImplemented:false,secondReducer:false,nativeActivation:false}};
  return receipt;
}
if(import.meta.main){
  const receipt=inspectBoundary(),out='architecture/academy-query-integration/observations/QRY-BOUNDARY-SOURCE-GRAPH-R1.json';
  if(process.argv.includes('--write')){assert(!existsSync(resolve(boundaryRoot,out)),'immutable graph receipt exists');await Bun.write(resolve(boundaryRoot,out),JSON.stringify(receipt,null,2)+'\n');}
  else{
    const existing=JSON.parse(readFileSync(resolve(boundaryRoot,out),'utf8'));
    assert.deepEqual({...receipt,createdAt:null},{...existing,createdAt:null});
  }
  console.log(JSON.stringify({status:'pass',changedExisting:changedExisting.length,newLeaves:newLeaves.length,movedDeclarations:receipt.movedDeclarations.length,readInputImports:receipt.readInputImports.length,remainingReverse:receipt.remainingLmsToApp.length,retainedApplicationToLms:receipt.retainedAppToLms.length,dcGangEdges:receipt.preservedDcToGangA.length,dynamicDependencies:receipt.preservedDynamicDependencies.length,wholeGraphReparsed:false}));
}

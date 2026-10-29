/** Per-file type escape budgets, measured by the owning TypeScript compiler API. */
import {existsSync,readFileSync} from 'node:fs';
import {dirname,isAbsolute,join,relative,resolve} from 'node:path';
import {API,DiagnosticCategory} from 'typescript/unstable/async';
import * as parser from 'typescript-parser';
import {SyntaxKind,isArrayTypeNode,isParameterDeclaration,isParenthesizedTypeNode,isPropertyDeclaration,isPropertySignatureDeclaration,isTypeReferenceNode,isUnionTypeNode,type Node,type SourceFile,type TypeNode} from 'typescript/unstable/ast';

export interface EscapeCounts {assertions:number;nonNull:number;rawIdentities:number}
export interface EscapeBaseline {schema:'academy-type-escapes.v1';files:Record<string,EscapeCounts>}
const empty=():EscapeCounts=>({assertions:0,nonNull:0,rawIdentities:0});
const metrics=['assertions','nonNull','rawIdentities'] as const;
const identityName=/(?:Ref|Id|Scope|Cursor|Token)s?$|^(?:id|scope|cursor|token)$/;

function rawString(type:TypeNode|undefined):boolean {
 if(!type)return false;
 if(type.kind===SyntaxKind.StringKeyword)return true;
 if(isUnionTypeNode(type))return type.types.some(rawString);
 if(isArrayTypeNode(type))return rawString(type.elementType);
 if(isParenthesizedTypeNode(type))return rawString(type.type);
 if(isTypeReferenceNode(type))return type.typeArguments?.some(rawString)??false;
 return false;
}
export function countEscapes(source:SourceFile):EscapeCounts {
 const counts=empty();
 const visit=(node:Node):void=>{
  if(node.kind===SyntaxKind.AsExpression||node.kind===SyntaxKind.TypeAssertionExpression)counts.assertions++;
  if(node.kind===SyntaxKind.NonNullExpression)counts.nonNull++;
  if((isPropertySignatureDeclaration(node)||isPropertyDeclaration(node)||isParameterDeclaration(node))&&identityName.test(node.name.getText(source).replace(/^['"]|['"]$/g,''))&&rawString(node.type))counts.rawIdentities++;
  node.forEachChild(visit);
 };
 visit(source);return counts;
}
function compiler(app:string,overlay?:string):API {
 const repository=resolve(app,'../../..');
 return new API({cwd:app,...(overlay===undefined?{}:{fs:{readFile:(path:string)=>{
  const rel=relative(repository,resolve(path));
  if(rel.startsWith('..')||isAbsolute(rel))return undefined;
  const selected=join(overlay,rel);return existsSync(selected)?readFileSync(selected,'utf8'):undefined;
 }}})});
}
export async function collectEscapes(app:string,overlay?:string):Promise<EscapeBaseline> {
 const config=join(app,'tsconfig.json'),api=compiler(app,overlay);
 try{
  const snapshot=await api.updateSnapshot({openProjects:[config]});
  try{
   const project=snapshot.getProject(config);if(!project)throw Error(`ratchet_project_missing@${config}:1`);
   if(project.compilerOptions['strict']!==true)throw Error(`ratchet_strict_required@${config}:1`);
   const files:Record<string,EscapeCounts>={};
   for(const file of [...await project.program.getSourceFileNames()].sort()){
    const rel=relative(app,file);
    if(!rel.endsWith('.ts')||!(rel.startsWith('src/academy/')||rel.startsWith('harness/')||rel.startsWith('scripts/')))continue;
    const source=await project.program.getSourceFile(file);if(!source)throw Error(`ratchet_source_missing@${file}:1`);
    files[rel]=countEscapes(source);
   }
   return {schema:'academy-type-escapes.v1',files};
  }finally{await snapshot.dispose();}
 }finally{await api.close();}
}
export async function checkCandidateTypes(app:string,overlay?:string):Promise<number> {
 const config=join(app,'tsconfig.json'),api=compiler(app,overlay);
 try{
  const snapshot=await api.updateSnapshot({openProjects:[config]});
  try{
   const project=snapshot.getProject(config);if(!project)throw Error(`ratchet_project_missing@${config}:1`);
   const errors=(await Promise.all([project.program.getSyntacticDiagnostics(),project.program.getBindDiagnostics(),project.program.getSemanticDiagnostics()])).flat().filter(d=>d.category===DiagnosticCategory.Error);
   for(const error of errors){
    const path=error.fileName;
    const technical=path!==undefined&&['src/','harness/','scripts/'].some(prefix=>relative(app,path).startsWith(prefix));
    const source=technical?await project.program.getSourceFile(path):undefined;
    const line=source?source.getLineAndCharacterOfPosition(error.pos).line+1:1;
    console.error(`type_error@${technical?path:import.meta.path}:${line} code=TS${error.code}`);
   }
   if(!errors.length)console.log('PASS owning_compiler=7 strict=true');
   return errors.length;
  }finally{await snapshot.dispose();}
 }finally{await api.close();}
}
export function parseBaseline(text:string):EscapeBaseline {
 const value:unknown=JSON.parse(text);
 if(!value||typeof value!=='object'||!('schema' in value)||value.schema!=='academy-type-escapes.v1'||!('files' in value)||!value.files||typeof value.files!=='object'||Array.isArray(value.files))throw Error('ratchet_baseline_invalid');
 const files:Record<string,EscapeCounts>={};
 for(const [path,count] of Object.entries(value.files)){
  if(!count||typeof count!=='object'||metrics.some(key=>!Object.hasOwn(count,key)))throw Error('ratchet_baseline_invalid');
  const parsed=empty();for(const key of metrics){const n:unknown=Reflect.get(count,key);if(typeof n!=='number'||!Number.isSafeInteger(n)||n<0)throw Error('ratchet_baseline_invalid');parsed[key]=n;}
  files[path]=parsed;
 }
 return {schema:'academy-type-escapes.v1',files};
}
export function compareEscapes(actual:EscapeBaseline,baseline:EscapeBaseline,code='type_escape_increased'):string[]{
 const errors:string[]=[];
 for(const [path,counts] of Object.entries(actual.files))for(const metric of metrics)if(counts[metric]>(baseline.files[path]?.[metric]??0))errors.push(`${code}@${path}:1 metric=${metric} count=${counts[metric]}`);
 return errors;
}

/** Closed duplicate-case producer contract; no test code is executed here. */
export const EACH_ROW_KINDS=['literal','closed_assignment'] as const;
export const EACH_SYNTAX_KIND=parser.SyntaxKind;
export const FORBIDDEN_EACH_ANCESTORS=[parser.SyntaxKind.IfStatement,parser.SyntaxKind.ForStatement,parser.SyntaxKind.ForInStatement,parser.SyntaxKind.ForOfStatement,parser.SyntaxKind.WhileStatement,parser.SyntaxKind.DoStatement,parser.SyntaxKind.SwitchStatement,parser.SyntaxKind.TryStatement,parser.SyntaxKind.ConditionalExpression,parser.SyntaxKind.ClassDeclaration,parser.SyntaxKind.ModuleDeclaration] as const;
interface EachObservation{readonly rows:number;readonly rowKinds:readonly string[];readonly imports:readonly string[]}
const observations=new Map<string,EachObservation>();
export class EachObserver{
 close(){return Promise.resolve();}
}
export interface EachInput{text:string;name?:string|undefined;tsx?:boolean}
export type EachResult={value:EachObservation;error?:never}|{error:Error;value?:never};
function analyzeEachSource(source:parser.SourceFile,name?:string):EachObservation{
 type Node=parser.Node;
 const {SyntaxKind,isArrayLiteralExpression,isObjectLiteralExpression,isPropertyAssignment,isArrowFunction,isBinaryExpression,isPropertyAccessExpression,isIdentifier,isCallExpression,isExpressionStatement,isStringLiteral,isNumericLiteral,isPrefixUnaryExpression,isImportDeclaration,isExportDeclaration,isNamedImports,isVariableDeclaration,isParameter,isFunctionDeclaration,isFunctionExpression,isNewExpression}=parser;
 const refuse=():never=>{throw Error(`r07_duplicate_producer_invalid@${import.meta.path}:1`);};
   const imports=new Set<string>();
   const modules=(n:Node):void=>{
    if(isImportDeclaration(n)&&!n.importClause?.isTypeOnly){if(!isStringLiteral(n.moduleSpecifier))return refuse();imports.add(n.moduleSpecifier.text);}
    if(isExportDeclaration(n)&&n.moduleSpecifier){if(!isStringLiteral(n.moduleSpecifier))return refuse();imports.add(n.moduleSpecifier.text);}
    if(isCallExpression(n)&&((isIdentifier(n.expression)&&n.expression.text==='require')||n.expression.kind===SyntaxKind.ImportKeyword)){const arg=n.arguments[0];if(n.arguments.length!==1||!arg||!isStringLiteral(arg)||arg.text==='bun:test')return refuse();imports.add(arg.text);}
    if((isCallExpression(n)||isNewExpression(n))&&isIdentifier(n.expression)&&['eval','Function'].includes(n.expression.text))return refuse();
    n.forEachChild(modules);
   };modules(source);
   if(name===undefined)return {rows:0,rowKinds:[],imports:[...imports].sort()};
   const names=new Set<string>();
   for(const statement of source.statements)if(isImportDeclaration(statement)&&isStringLiteral(statement.moduleSpecifier)&&statement.moduleSpecifier.text==='bun:test'){
    const clause=statement.importClause,bindings=clause?.namedBindings;
    if(clause?.isTypeOnly)continue;
    if(!bindings||!isNamedImports(bindings))return refuse();
    for(const s of bindings.elements){const imported=s.propertyName?.text??s.name.text;if(!['test','it','describe','expect','afterEach','beforeEach','afterAll','beforeAll'].includes(imported))return refuse();if(['test','it','describe'].includes(imported)){if(s.isTypeOnly||s.name.text!==imported||names.has(imported))return refuse();names.add(imported);}}
   }
   const literal=(n:Node):boolean=>{
    if(isStringLiteral(n)||isNumericLiteral(n)||[SyntaxKind.TrueKeyword,SyntaxKind.FalseKeyword,SyntaxKind.NullKeyword].includes(n.kind))return true;
    if(isPrefixUnaryExpression(n))return [SyntaxKind.PlusToken,SyntaxKind.MinusToken].includes(n.operator)&&isNumericLiteral(n.operand);
    if(isArrayLiteralExpression(n))return n.elements.every(literal);
    if(isObjectLiteralExpression(n))return n.properties.every(p=>isPropertyAssignment(p)&&(isIdentifier(p.name)||isStringLiteral(p.name)||isNumericLiteral(p.name))&&literal(p.initializer));
    return false;
   };
   const rowKind=(n:Node):string|undefined=>{
    if(literal(n))return EACH_ROW_KINDS[0];
    if(!isArrowFunction(n)||n.modifiers?.length||n.parameters.length!==1)return;
    const p=n.parameters[0];if(!p||!isIdentifier(p.name)||p.dotDotDotToken||p.initializer||p.questionToken||p.modifiers?.length||(p.type&&p.type.kind!==SyntaxKind.AnyKeyword))return;
    const body=n.body;if(!isBinaryExpression(body)||body.operatorToken.kind!==SyntaxKind.EqualsToken||!literal(body.right))return;
    let target:Node=body.left;if(!isPropertyAccessExpression(target))return;
    while(isPropertyAccessExpression(target)){if(target.questionDotToken)return;target=target.expression;}
    return isIdentifier(target)&&target.text===p.name.text?EACH_ROW_KINDS[1]:undefined;
   };
   const directDescribe=(n:Node,fn:Node):boolean=>isCallExpression(n)&&isIdentifier(n.expression)&&n.expression.text==='describe'&&names.has('describe')&&n.arguments.some(argument=>argument===fn);
   const receiver=(n:Node):string|undefined=>isIdentifier(n)&&names.has(n.text)?n.text:isPropertyAccessExpression(n)||isCallExpression(n)?receiver(n.expression):undefined;
   let found:{rows:number;rowKinds:string[];imports:string[]}|undefined;
   const visit=(n:Node,parents:Node[]):void=>{
    if((isVariableDeclaration(n)||isParameter(n)||isFunctionDeclaration(n))&&n.name&&isIdentifier(n.name)&&names.has(n.name.text))return refuse();
    if(isBinaryExpression(n)&&n.operatorToken.kind>=SyntaxKind.FirstAssignment&&n.operatorToken.kind<=SyntaxKind.LastAssignment){let left:Node=n.left;while(isPropertyAccessExpression(left))left=left.expression;if(isIdentifier(left)&&names.has(left.text))return refuse();}
    if(isIdentifier(n)&&names.has(n.text)){
     const parent=parents.at(-1);
     const grandparent=parents.at(-2);
     const allowed=parent&&(parent.kind===SyntaxKind.ImportSpecifier||(isCallExpression(parent)&&parent.expression===n)||(isPropertyAccessExpression(parent)&&(parent.name===n||(parent.expression===n&&grandparent&&isCallExpression(grandparent)&&grandparent.expression===parent))));
     if(!allowed)return refuse();
    }
    if(isCallExpression(n)){
     const inner=n.expression;
     const direct=isIdentifier(inner)&&names.has(inner.text)&&inner.text!=='describe';
     const each=isCallExpression(inner)&&isPropertyAccessExpression(inner.expression)&&inner.expression.name.text==='each'&&isIdentifier(inner.expression.expression)&&names.has(inner.expression.expression.text)&&inner.expression.expression.text!=='describe';
     const parentCall=parents.at(-1),partial=isPropertyAccessExpression(inner)&&inner.name.text==='each'&&parentCall&&isCallExpression(parentCall)&&parentCall.expression===n;
     const provider=receiver(inner);
     if(direct||each||(provider&&provider!=='describe'&&!partial)){
      const label=n.arguments[0];if(!label||!isStringLiteral(label))return refuse();
      if(label.text===name){
       if(found||!each||!isCallExpression(inner)||inner.arguments.length!==1)return refuse();
       const parent=parents.at(-1),array=inner.arguments[0];if(!parent||!isExpressionStatement(parent)||!array||!isArrayLiteralExpression(array)||!array.elements.length)return refuse();
       for(const [i,p]of parents.entries()){
        if(FORBIDDEN_EACH_ANCESTORS.some(kind=>kind===p.kind))return refuse();
        if((isArrowFunction(p)||isFunctionExpression(p)||isFunctionDeclaration(p))&&!directDescribe(parents[i-1]??p,p))return refuse();
       }
       const rowKinds=array.elements.map(rowKind);if(rowKinds.some(k=>k===undefined))return refuse();
       found={rows:array.elements.length,rowKinds:rowKinds.filter((k):k is string=>k!==undefined),imports:[...imports].sort()};
      }
     }
    }
    n.forEachChild(child=>visit(child,[...parents,n]));
   };
   visit(source,[]);return found??refuse();
}
export async function inspectEachBatch(inputs:readonly EachInput[],_shared?:EachObserver):Promise<EachResult[]>{
 const key=(input:EachInput)=>JSON.stringify([input.text,input.name,input.tsx??false]);
 const results:EachResult[]=[],pending:number[]=[];
 for(const [i,input]of inputs.entries()){const cached=observations.get(key(input));if(cached)results[i]={value:cached};else pending.push(i);}
 if(!pending.length)return results;
   for(const i of pending){
    const input=inputs[i];if(!input)throw Error('r07_duplicate_producer_invalid');
    try{
     const source=parser.createSourceFile('source'+i+(input.tsx?'.tsx':'.ts'),input.text,parser.ScriptTarget.Latest,true,input.tsx?parser.ScriptKind.TSX:parser.ScriptKind.TS);
     const diagnostics:unknown=Reflect.get(source,'parseDiagnostics');
     if(!Array.isArray(diagnostics)||diagnostics.length)throw Error(`r07_duplicate_producer_invalid@${import.meta.path}:1`);
     if(source.text!==input.text)throw Error(`r07_ast_source_mismatch@${import.meta.path}:1`);
     const value=analyzeEachSource(source,input.name),frozen=Object.freeze({rows:value.rows,rowKinds:Object.freeze([...value.rowKinds]),imports:Object.freeze([...value.imports])});
     observations.set(key(input),frozen);results[i]={value:frozen};
    }catch(error){results[i]={error:error instanceof Error?error:Error('r07_duplicate_producer_invalid')};}
   }
 return results;
}
export async function inspectEachProducer(text:string,name?:string,shared?:EachObserver):Promise<EachObservation>{
 const result=(await inspectEachBatch([{text,name}],shared))[0];if(!result)throw Error('r07_duplicate_producer_invalid');if(result.error)throw result.error;return result.value;
}

if(import.meta.main){
 try{
  const app=resolve(import.meta.dir,'..'),mode=process.argv[2]??'check',overlay=process.argv[3];
  if(mode==='typecheck'){process.exitCode=await checkCandidateTypes(app,overlay===undefined?undefined:resolve(overlay))?1:0;}
  else {
  const actual=await collectEscapes(app,overlay===undefined?undefined:resolve(overlay));
  if(mode==='inventory')console.log(JSON.stringify(actual,null,2));
  else if(mode==='check'){
   const baselinePath=join(dirname(import.meta.path),'type-escapes.baseline.json');
   const baseline=parseBaseline(readFileSync(baselinePath,'utf8'));
   const errors=compareEscapes(actual,baseline);
   const repository=resolve(app,'../../..');
   const base=Bun.spawnSync(['git','merge-base','HEAD','origin/main'],{cwd:repository});
   if(base.exitCode!==0)throw Error(`ratchet_base_missing@${import.meta.path}:1`);
   const prior=Bun.spawnSync(['git','show',base.stdout.toString().trim()+':apps/academy/dc-gang-a/scripts/type-escapes.baseline.json'],{cwd:repository});
   if(prior.exitCode===0)errors.push(...compareEscapes(baseline,parseBaseline(prior.stdout.toString()),'ratchet_baseline_increased'));
   if(errors.length){for(const error of errors)console.error(error);process.exitCode=1;}
   else console.log(`PASS files=${Object.keys(actual.files).length} assertions=${Object.values(actual.files).reduce((n,c)=>n+c.assertions,0)}`);
  }else throw Error(`ratchet_mode_invalid@${import.meta.path}:1`);
  }
 }catch(error){console.error(error instanceof Error?error.message:`ratchet_failed@${import.meta.path}:1`);process.exitCode=1;}
}

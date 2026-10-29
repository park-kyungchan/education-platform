/** Per-file type escape budgets, measured by the owning TypeScript compiler API. */
import {readFileSync} from 'node:fs';
import {dirname,join,relative,resolve} from 'node:path';
import {API} from 'typescript/unstable/async';
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
export async function collectEscapes(app:string):Promise<EscapeBaseline> {
 const config=join(app,'tsconfig.json'),api=new API({cwd:app});
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


if(import.meta.main){
 try{
  const app=resolve(import.meta.dir,'..'),mode=process.argv[2]??'check';
  const actual=await collectEscapes(app);
  if(mode==='inventory')console.log(JSON.stringify(actual,null,2));
  else if(mode==='check'){
   const baseline=parseBaseline(readFileSync(join(dirname(import.meta.path),'type-escapes.baseline.json'),'utf8'));
   const errors=compareEscapes(actual,baseline);
   // The committed baseline may only shrink against the merge base with main.
   const repository=resolve(app,'../../..');
   const base=Bun.spawnSync(['git','merge-base','HEAD','origin/main'],{cwd:repository});
   if(base.exitCode!==0)throw Error(`ratchet_base_missing@${import.meta.path}:1`);
   const prior=Bun.spawnSync(['git','show',base.stdout.toString().trim()+':apps/academy/dc-gang-a/scripts/type-escapes.baseline.json'],{cwd:repository});
   if(prior.exitCode===0)errors.push(...compareEscapes(baseline,parseBaseline(prior.stdout.toString()),'ratchet_baseline_increased'));
   if(errors.length){for(const error of errors)console.error(error);process.exitCode=1;}
   else console.log(`PASS files=${Object.keys(actual.files).length} assertions=${Object.values(actual.files).reduce((n,c)=>n+c.assertions,0)}`);
  }else throw Error(`ratchet_mode_invalid@${import.meta.path}:1`);
 }catch(error){console.error(error instanceof Error?error.message:`ratchet_failed@${import.meta.path}:1`);process.exitCode=1;}
}

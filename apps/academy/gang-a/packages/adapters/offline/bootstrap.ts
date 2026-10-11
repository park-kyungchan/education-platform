import {parse,type Property} from 'acorn';
import {z} from 'zod';
const number=z.number().finite(),identifier=z.number().int().nonnegative().refine(Number.isSafeInteger),str=z.string();
export const CapturedBootstrapRow=z.strictObject({scoreFlg:number,testingNo:identifier,testNo:identifier,categName:str,applyFlg:number,userName:str,assNo:identifier,pNo:identifier,score:number,courseName:str,similarClinic:str,testTypeName:str,priNo:identifier,studentName:str,developClinic:str,courseKey:identifier,_id:str,applyDate:str.regex(/^\d{2}-\d{2} \d{2}:\d{2}$/),levelOrder:number});
export type BootstrapRow=z.infer<typeof CapturedBootstrapRow>;
/** Static AST decoder only. No response script or handler is executed. */
export function decodeObservedBootstrap(scripts:readonly string[]):BootstrapRow[]{
 const literals:string[]=[];
 for(const script of scripts){if(!script.includes('EXTERN_DIALOG'))continue;const ast=parse(script,{ecmaVersion:2022,sourceType:'script'});
  for(const statement of ast.body){if(statement.type!=='VariableDeclaration')continue;for(const declaration of statement.declarations){if(declaration.id.type!=='Identifier'||declaration.id.name!=='EXTERN_DIALOG')continue;if(declaration.init?.type!=='ObjectExpression')throw Error('bootstrap_not_static_object');
   if(declaration.init.properties.some(property=>property.type!=='Property'||property.computed))throw Error('bootstrap_dynamic_property_or_spread_not_supported');
   const fields=declaration.init.properties.filter((property):property is Property=>property.type==='Property'&&!property.computed&&((property.key.type==='Identifier'&&property.key.name==='testResultList')||(property.key.type==='Literal'&&property.key.value==='testResultList')));
   if(fields.length!==1)throw Error('bootstrap_property_missing_or_duplicate');const field=fields[0],call=field.value;
   if(field.kind!=='init'||field.method||call.type!=='CallExpression'||call.optional||call.callee.type!=='MemberExpression'||call.callee.computed||call.callee.object.type!=='Identifier'||call.callee.object.name!=='JSON'||call.callee.property.type!=='Identifier'||call.callee.property.name!=='parse'||call.arguments.length!==1)throw Error('bootstrap_not_single_quoted_static_json');
   const arg=call.arguments[0];if(arg.type!=='Literal'||typeof arg.value!=='string'||script[arg.start]!=="'")throw Error('bootstrap_not_single_quoted_static_json');literals.push(arg.value);
  }}
 }
 if(literals.length!==1)throw Error('bootstrap_missing_or_ambiguous');const rows=z.array(CapturedBootstrapRow).parse(JSON.parse(literals[0]));if(new Set(rows.map(r=>r.testingNo)).size!==rows.length||new Set(rows.map(r=>r.pNo)).size!==rows.length)throw Error('bootstrap_candidate_ids_not_unique');return rows;
}

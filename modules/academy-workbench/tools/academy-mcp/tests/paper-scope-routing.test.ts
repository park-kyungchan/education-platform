import {expect,test} from 'bun:test';
import {paperScopesSchema,selectPaperRoute} from '../src/paper-scope-routing.ts';

const primary={endpoint:'paper1',upstreamName:'academy_paper_headers',tool:{name:'academy_paper_headers'}};
const secondary={endpoint:'paper2',upstreamName:'academy_paper_headers',tool:{name:'class2_academy_paper_headers'}};
const registry=[primary,secondary];
const scopes=paperScopesSchema.parse([{endpoint:'paper1',studentIds:['1001']},{endpoint:'paper2',studentIds:['1002']}]);

test('selects one verified configured scope without probing or widening upstream authority',()=>{
  expect(selectPaperRoute(scopes,registry,primary,{studentId:'1001'})).toBe(primary);
  expect(selectPaperRoute(scopes,registry,primary,{studentId:'1002'})).toBe(secondary);
  const extraAlias={...secondary,tool:{name:'paper2_headers_alias'}};
  expect(selectPaperRoute(scopes,[primary,secondary,extraAlias],primary,{studentId:'1002'})).toBe(secondary);
  expect(selectPaperRoute(undefined,registry,primary,{studentId:'1002'})).toBe(primary);
  expect(selectPaperRoute(scopes,registry,secondary,{studentId:'1002'})).toBe(secondary);
  expect(()=>selectPaperRoute(scopes,registry,secondary,{studentId:'1001'})).toThrow('paper_scope_unresolved');
  for(const name of ['academy_source_read_contracts','academy_paper_read_contracts']){
    const a={...primary,upstreamName:name},b={...secondary,upstreamName:name};
    expect(selectPaperRoute(scopes,[a,b],a,{studentId:'1002'})).toBe(b);
  }
});
test('missing, ambiguous or unsupported mappings refuse before any endpoint dispatch',()=>{
  expect(()=>selectPaperRoute(scopes,registry,primary,{studentId:'1003'})).toThrow('paper_scope_unresolved');
  const ambiguous=paperScopesSchema.parse([{endpoint:'paper1',studentIds:['1001']},{endpoint:'paper2',studentIds:['1001']}]);
  expect(()=>selectPaperRoute(ambiguous,registry,primary,{studentId:'1001'})).toThrow('paper_scope_unresolved');
  expect(()=>selectPaperRoute(ambiguous,registry,secondary,{studentId:'1001'})).toThrow('paper_scope_unresolved');
  expect(()=>selectPaperRoute(scopes,[primary],primary,{studentId:'1002'})).toThrow('paper_scope_unresolved');
  expect(()=>selectPaperRoute(scopes,registry,primary,{studentId:'01'})).toThrow();
  expect(paperScopesSchema.safeParse([{endpoint:'paper1',studentIds:['1001','1001']}]).success).toBe(false);
  expect(paperScopesSchema.safeParse([{endpoint:'paper3',studentIds:['1001']}]).success).toBe(false);
  expect(paperScopesSchema.safeParse([{endpoint:'paper1',studentIds:['1001']},{endpoint:'paper1',studentIds:['1002']}]).success).toBe(false);
});

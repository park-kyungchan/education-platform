import {expect,test} from 'bun:test';
import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {collectEscapes,compareEscapes,parseBaseline} from './type-escape-ratchet';

function fixture(source:string):string {
 const app=mkdtempSync(join(tmpdir(),'academy-ast-ratchet-'));
 mkdirSync(join(app,'src/academy'),{recursive:true});mkdirSync(join(app,'harness'));
 writeFileSync(join(app,'tsconfig.json'),JSON.stringify({compilerOptions:{strict:true,noEmit:true,types:[],target:'ES2022'},include:['src/**/*.ts','harness/**/*.ts']}));
 writeFileSync(join(app,'src/academy/subject.ts'),source);
 writeFileSync(join(app,'harness/subject.ts'),'export interface Input { occurrenceId: string | null }');
 return app;
}

test('compiler AST counts both assertions, non-null expressions and raw identity fields; ignores comments and strings',async()=>{
 const app=fixture('interface Input { ownerId:string; label:string; token: string | null; cursor?:string }\nconst a=1 as number;const b=<number>1;const c=a!;const text="as Ref !";/* token:string as Ref */');
 const report=await collectEscapes(app);
 expect(report.files['src/academy/subject.ts']).toEqual({assertions:2,nonNull:1,rawIdentities:3});
 expect(report.files['harness/subject.ts']).toEqual({assertions:0,nonNull:0,rawIdentities:1});
 expect(compareEscapes(report,report)).toEqual([]);
});

test('positive control: one added cast falsifies the actual per-file AST budget',async()=>{
 const app=fixture('export const value=1;');
 const baseline=await collectEscapes(app);
 writeFileSync(join(app,'src/academy/subject.ts'),'export const value=1 as number;');
 const actual=await collectEscapes(app);
 expect(compareEscapes(actual,baseline)).toEqual(['type_escape_increased@src/academy/subject.ts:1 metric=assertions count=1']);
 expect(compareEscapes(baseline,actual)).toEqual([]);
});

test('positive control: new files, non-null assertions and raw-string identity fields cannot hide behind missing rows',async()=>{
 const app=fixture('export const value=1;');
 const baseline=await collectEscapes(app);
 writeFileSync(join(app,'src/academy/new-boundary.ts'),'export interface Input { requestId: string }; export const value=1!;');
 const actual=await collectEscapes(app),errors=compareEscapes(actual,baseline);
 expect(errors).toContain('type_escape_increased@src/academy/new-boundary.ts:1 metric=rawIdentities count=1');
 expect(errors).toContain('type_escape_increased@src/academy/new-boundary.ts:1 metric=nonNull count=1');
});

test('a baseline increase refuses for every metric exported in its schema',async()=>{
 const baseline=parseBaseline('{"schema":"academy-type-escapes.v1","files":{"src/academy/subject.ts":{"assertions":1,"nonNull":1,"rawIdentities":1}}}');
 const raised=parseBaseline('{"schema":"academy-type-escapes.v1","files":{"src/academy/subject.ts":{"assertions":2,"nonNull":2,"rawIdentities":2}}}');
 expect(compareEscapes(raised,baseline,'ratchet_baseline_increased')).toHaveLength(Object.keys(baseline.files['src/academy/subject.ts']??{}).length);
 expect(compareEscapes(baseline,raised)).toEqual([]);
 expect(()=>parseBaseline('{"schema":"academy-type-escapes.v1","files":{"x":{"assertions":-1,"nonNull":0,"rawIdentities":0}}}')).toThrow('ratchet_baseline_invalid');
});

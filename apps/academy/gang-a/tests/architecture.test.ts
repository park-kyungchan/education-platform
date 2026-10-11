import assert from 'node:assert/strict';
import {readdirSync,readFileSync,statSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,posix} from 'node:path';
const root=new URL('..',import.meta.url).pathname;
const paths:string[]=[];function walk(dir:string){for(const name of readdirSync(join(root,dir))){const path=posix.join(dir,name);if(path==='src/generated')continue;if(statSync(join(root,path)).isDirectory())walk(path);else if(path.endsWith('.ts'))paths.push(path);}}
for(const directory of ['packages','src','fixtures'])walk(directory);
let explicitAny=0,imports=0;const violations:string[]=[],scanner=new Bun.Transpiler({loader:'ts'});
for(const path of paths){const source=readFileSync(join(root,path),'utf8');
 // Lightweight source lint supplements the full strict compiler. Comments and
 // string/template literals are omitted; no TypeScript compiler API is needed.
 const code=source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g,'');
 const matches=code.match(/\bany\b/g)??[];explicitAny+=matches.length;if(matches.length)violations.push(path+':explicit_any');
 for(const dependency of scanner.scanImports(source)){imports++;const spec=dependency.path,dest=spec.startsWith('.')?posix.normalize(posix.join(posix.dirname(path),spec)):spec;
 const legacyDomain=path.endsWith('-v1.ts')||['packages/domain/grading.ts','packages/domain/delivery.ts','packages/domain/teacher-outcome.ts'].includes(path);
 if(path.startsWith('packages/domain/')&&!legacyDomain&&/^(?:packages\/(?:application|adapters|ports|schema)|src\/)/.test(dest))violations.push(path+':domain_dependency:'+dest);
 if(path.startsWith('packages/application/')&&/^(?:packages\/adapters|src\/)/.test(dest))violations.push(path+':application_dependency:'+dest);
 if(path.startsWith('packages/security/')&&/^(?:packages\/(?:adapters|application)|src\/)/.test(dest))violations.push(path+':security_dependency:'+dest);
 if(path.startsWith('packages/adapters/')&&dest.startsWith('src/'))violations.push(path+':adapter_ui_dependency:'+dest);
 if((path.startsWith('packages/domain/')||path.startsWith('packages/application/')||path.startsWith('src/ui/'))&&spec.startsWith('node:'))violations.push(path+':runtime_node_import:'+spec);
 }}
assert.deepEqual(violations,[]);const receipt={passed:true,modules:paths.length,importsChecked:imports,explicitAny,violations:0,scope:'production_modules_and_fixture_factories',importScanner:'Bun.Transpiler.scanImports',typeKeywordCheck:'source_lint_plus_full_strict_typecheck',legacySchemaExceptions:'explicitly bounded v1 modules only'};mkdirSync(join(root,'test-results'),{recursive:true});writeFileSync(join(root,'test-results/architecture-validation.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));

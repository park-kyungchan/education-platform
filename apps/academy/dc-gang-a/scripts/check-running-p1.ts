/** Compile and exercise the finite observer against fictional ports only. No target execution. */
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {canonicalProjection} from '../src/academy/product-control/running-p1-observer';
const owner=resolve(import.meta.dir,'..'),base=resolve(owner,'runtime/product-control'),graph=JSON.parse(readFileSync(resolve(base,'running-p1/source-graph.json'),'utf8')) as {files:Record<string,string>};
const paths={canonical:resolve(base,'native-product-os.py'),io:resolve(base,'running-p1/readonly_io.py'),root:resolve(base,'running-p1/root_observer.py'),native:resolve(base,'running-p1/native_observer.py'),orchestrator:resolve(owner,'src/academy/product-control/running-p1-observer.ts'),bootstrap:resolve(owner,'src/academy/product-control/running-p1-bootstrap.ts')};
const bodies:Record<string,string>={};for(const [id,path] of Object.entries(paths)){bodies[id]=readFileSync(path,'utf8');if(createHash('sha256').update(bodies[id]!).digest('hex')!==graph.files[id])throw Error('running_p1_source_pin_changed:'+id);}
const projection=canonicalProjection(bodies.canonical!);
for(const role of ['root','native']){
 const program=bodies.io+'\n'+projection+'\n'+bodies[role];
 const child=Bun.spawn(['python3','-I','-S','-B','-c',"import sys; compile(sys.stdin.read(),'<fixed-p1-source-program>','exec')"],{cwd:owner,stdin:Buffer.from(program),stdout:'inherit',stderr:'inherit'});if(await child.exited!==0)throw Error('running_p1_program_syntax_failed');
}
// Reuse original endpoint fixtures unchanged on disk, and add the observation-only capture function.
let fixture=readFileSync(resolve(owner,'tests/academy/product-control/endpoint_fixtures.py'),'utf8');
const original="source=ast.parse((b/'runtime/product-control/native-product-os.py').read_text())";if(!fixture.includes(original))throw Error('endpoint_fixture_projection_changed');
fixture=fixture.replace('import ast,json,stat,io,copy','import ast,json,stat,io,copy,sys').replace("b=Path(__file__).resolve().parents[3]","b=Path.cwd()").replace(original,'source=ast.parse(sys.stdin.read())').replace("['need','observe_original_pg_endpoint']","['need','observe_original_pg_endpoint','capture_original_pg_endpoint']");
fixture+="\nstate.clear();assert ns['capture_original_pg_endpoint'](c,child)==expected;print('{\"observationalEndpointCapture\":\"pass\",\"actualNativeCalls\":0}')\n";
for(const args of [['-c',fixture],['tests/academy/product-control/running_p1_fixtures.py'],['tests/academy/product-control/running_p1_io_fixtures.py']]){
 const child=Bun.spawn(['python3','-I','-S','-B',...args],{cwd:owner,stdin:args[0]==='-c'?Buffer.from(projection):'ignore',stdout:'inherit',stderr:'inherit'});if(await child.exited!==0)throw Error('running_p1_fictional_check_failed');
}
console.log(JSON.stringify({scope:'finite-running-p1-source-and-fictional-port-checks',actualSSH:0,actualNativeEffects:0,actualP1Accepted:false,originalProductSourcesUnmodified:true}));

/** Compile and exercise the finite observer against fictional ports only. No target execution. */
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {canonicalProjection} from '../src/academy/product-control/running-p1-observer';
const owner=resolve(import.meta.dir,'..'),base=resolve(owner,'runtime/product-control'),graph=JSON.parse(readFileSync(resolve(base,'running-p1/source-graph.json'),'utf8')) as {files:Record<string,string>};
const paths={canonical:resolve(base,'native-product-os.py'),io:resolve(base,'running-p1/readonly_io.py'),root:resolve(base,'running-p1/root_observer.py'),native:resolve(base,'running-p1/native_observer.py'),orchestrator:resolve(owner,'src/academy/product-control/running-p1-observer.ts'),bootstrap:resolve(owner,'src/academy/product-control/running-p1-bootstrap.ts'),sshBoundary:resolve(base,'running-p1/local_ssh_boundary.py'),osBoundary:resolve(base,'running-p1/local-ssh-os-boundary.json')};
const bodies:Record<string,string>={};for(const [id,path] of Object.entries(paths)){bodies[id]=readFileSync(path,'utf8');if(createHash('sha256').update(bodies[id]!).digest('hex')!==graph.files[id])throw Error('running_p1_source_pin_changed:'+id);}
const projection=canonicalProjection(bodies.canonical!);
for(const role of ['root','native']){
 const program=bodies.io+'\n'+projection+'\n'+bodies[role];
 const child=Bun.spawn(['python3','-I','-S','-B','-c',"import sys; compile(sys.stdin.read(),'<fixed-p1-source-program>','exec')"],{cwd:owner,stdin:Buffer.from(program),stdout:'inherit',stderr:'inherit'});if(await child.exited!==0)throw Error('running_p1_program_syntax_failed');
}
// Compile the ACTUAL reviewed TS shim-construction expression with harmless fixed fixture data.
const source=bodies.orchestrator!,begin=source.indexOf(' const localBoundaryProgram='),end=source.indexOf(' const recheck=',begin);if(begin<0||end<=begin)throw Error('local_boundary_constructor_changed');
const fixturePrefix="const bodies={sshBoundary:"+JSON.stringify(bodies.sshBoundary)+"},p={sshConfigSha256:'a'.repeat(64)},configBuffer=Buffer.from('FIXTURE'),sshArguments=['/usr/bin/ssh','-F','/proc/self/fd/3','FIXTURE'];const need=(v:unknown,c:string)=>{if(!v)throw Error(c)};\n";
const constructed=new Bun.Transpiler({loader:'ts'}).transformSync(fixturePrefix+source.slice(begin,end)+'\nexport {localBoundaryProgram};'),fixture=await import('data:text/javascript;base64,'+Buffer.from(constructed).toString('base64'));
const syntaxChild=Bun.spawn(['python3','-I','-S','-B','-c',"import sys; compile(sys.stdin.read(),'<fixed-local-ssh-boundary>','exec')"],{stdin:Buffer.from(fixture.localBoundaryProgram),stdout:'inherit',stderr:'inherit'});if(await syntaxChild.exited!==0)throw Error('local_boundary_generated_syntax_failed');
// Reuse original endpoint fixtures unchanged on disk, and add the observation-only capture function.
let endpointFixture=readFileSync(resolve(owner,'tests/academy/product-control/endpoint_fixtures.py'),'utf8');
const original="source=ast.parse((b/'runtime/product-control/native-product-os.py').read_text())";if(!endpointFixture.includes(original))throw Error('endpoint_fixture_projection_changed');
endpointFixture=endpointFixture.replace('import ast,json,stat,io,copy','import ast,json,stat,io,copy,sys').replace("b=Path(__file__).resolve().parents[3]","b=Path.cwd()").replace(original,'source=ast.parse(sys.stdin.read())').replace("['need','observe_original_pg_endpoint']","['need','observe_original_pg_endpoint','capture_original_pg_endpoint']");
endpointFixture+="\nstate.clear();assert ns['capture_original_pg_endpoint'](c,child)==expected;print('{\"observationalEndpointCapture\":\"pass\",\"actualNativeCalls\":0}')\n";
for(const args of [['-c',endpointFixture],['tests/academy/product-control/running_p1_fixtures.py'],['tests/academy/product-control/running_p1_io_fixtures.py'],['tests/academy/product-control/running_p1_transport_fixtures.py']]){
 const child=Bun.spawn(['python3','-I','-S','-B',...args],{cwd:owner,stdin:args[0]==='-c'?Buffer.from(projection):'ignore',stdout:'inherit',stderr:'inherit'});if(await child.exited!==0)throw Error('running_p1_fictional_check_failed');
}
console.log(JSON.stringify({scope:'finite-running-p1-source-and-fictional-port-checks',actualSSH:0,actualNativeEffects:0,actualP1Accepted:false,originalProductSourcesUnmodified:true}));

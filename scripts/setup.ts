import {mkdirSync,readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname,basename} from 'node:path';
import {projectRoot} from '../src/modules';
import {setupRuntime,publishActionsBunPath,bunToolchain} from '../src/runtime';
const bootstrap=setupRuntime();
const runtimeRoot=resolve(projectRoot,'.private/runtimes');mkdirSync(runtimeRoot,{recursive:true});
const receipts:unknown[]=[];
async function get(url:string){const response=await fetch(url);if(!response.ok)throw Error('runtime_download_failed:'+url);return response;}
async function unpack(name:string,url:string,algorithm:'sha256'|'sha512',expected:string,encoding:'hex'|'base64',strip=1){
 const target=resolve(runtimeRoot,name),archive=resolve(runtimeRoot,name+'.tar');mkdirSync(target,{recursive:true});
 const bytes=new Uint8Array(await(await get(url)).arrayBuffer()),actual=createHash(algorithm).update(bytes).digest(encoding);if(actual!==expected)throw Error('runtime_integrity_mismatch:'+name);
 await Bun.write(archive,bytes);const child=Bun.spawn(['tar','-xf',archive,'--strip-components='+strip,'-C',target],{stdout:'inherit',stderr:'inherit'});if(await child.exited!==0)throw Error('runtime_unpack_failed');
 receipts.push({name,url,algorithm,digest:actual,bytes:bytes.length});return target;
}
async function npmTool(name:string,version:string,label:string){const url='https://registry.npmjs.org/'+name+'/'+version;const metadata=await(await get(url)).json() as {version:string;dist:{tarball:string;integrity:string}};if(metadata.version!==version||!metadata.dist.tarball.startsWith('https://registry.npmjs.org/')||!metadata.dist.integrity.startsWith('sha512-'))throw Error('invalid_registry_identity');return unpack(label,metadata.dist.tarball,'sha512',metadata.dist.integrity.slice(7),'base64');}
if(process.platform!=='linux'||process.arch!=='x64')throw Error('this_setup_route_requires_linux_x64; preserve source pins and add a reviewed platform route');
const integration=await npmTool(bunToolchain.packageName,bunToolchain.version,bunToolchain.directory);
const nodeArchive='node-v26.7.0-linux-x64.tar.xz',nodeBase='https://nodejs.org/dist/v26.7.0/';
const sums=await(await get(nodeBase+'SHASUMS256.txt')).text();const expected=sums.split('\n').find(line=>line.endsWith('  '+nodeArchive))?.split(/\s+/)[0];if(!expected||!/^[a-f0-9]{64}$/.test(expected))throw Error('missing_node_checksum');
const node=await unpack('node-26.7.0',nodeBase+nodeArchive,'sha256',expected,'hex');
const npm=await npmTool('npm','11.17.0','npm-11.17.0');
const bun=resolve(integration,'bin/bun'),env={...process.env,PATH:resolve(integration,'bin')+':'+resolve(node,'bin')+':'+process.env.PATH};
for(const relative of ['.','packages/curriculum','apps/academy/gang-a','apps/academy/dc-gang-a','examples/clinic-workbench','modules/academy-workbench','modules/academy-workbench/tools/academy-mcp','modules/math-research-module']){const p=Bun.spawn([bun,'install','--frozen-lockfile','--ignore-scripts'],{cwd:resolve(projectRoot,relative),env,stdout:'inherit',stderr:'inherit'});if(await p.exited!==0)throw Error('module_dependency_install_failed:'+relative);}
const teacherFixture=Bun.spawn([bun,'--no-env-file','scripts/setup-academy-teacher-fixture.ts'],{cwd:projectRoot,env,stdout:'inherit',stderr:'inherit'});
if(await teacherFixture.exited!==0)throw Error('academy_teacher_fixture_preparation_failed');
const commonSnapshot=Bun.spawn([bun,'--no-env-file','run','setup:ci'],{cwd:resolve(projectRoot,'modules/academy-workbench'),env,stdout:'inherit',stderr:'inherit'});
if(await commonSnapshot.exited!==0)throw Error('academy_common_snapshot_preparation_failed');
const math=Bun.spawn([resolve(node,'bin/node'),resolve(npm,'bin/npm-cli.js'),'ci','--ignore-scripts','--no-audit','--no-fund'],{cwd:resolve(projectRoot,'packages/mathematics-core'),env,stdout:'inherit',stderr:'inherit'});if(await math.exited!==0)throw Error('math_reference_dependency_install_failed');
await Bun.write(resolve(runtimeRoot,'receipt.json'),JSON.stringify({schema:'education.local-toolchain-receipt.v1',receipts,nativeEffects:0,globalRuntimeChanged:false},null,2)+'\n');
publishActionsBunPath(resolve(integration,'bin'),bootstrap.actionsPath);
console.log(JSON.stringify({status:'ready',check:'.private/runtimes/'+bunToolchain.directory+'/bin/bun run check',runtimeScope:'project-private',referenceMath:'Node26.7.0/npm11.17.0',bunModules:'Bun'+bunToolchain.version,bootstrapVersion:bootstrap.bootstrapVersion,actionsPathPublished:!!bootstrap.actionsPath}));

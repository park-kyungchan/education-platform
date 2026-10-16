import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const provider=JSON.parse(await readFile(root+'architecture/common-ci-provider.json','utf8'));
const fullSha=(value:unknown)=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
const digest=(value:unknown)=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
if(provider.schema!=='education.common-ci-projection.v2'||provider.codeOwner!=='agent-platform'||provider.nativePermissionGranted!==false||provider.runtimeAuthority!==false||provider.generatedOnly!==true)throw Error('Invalid common CI source owner');
if(!fullSha(provider.source.commit)||!fullSha(provider.source.tree)||provider.source.repository!=='https://github.com/park-kyungchan/agent-platform.git'||provider.source.path!=='ci/source-check.ts')throw Error('Invalid immutable common CI source identity');
if(provider.compiler.name!=='Bun'||provider.compiler.version!=='1.4.3'||!fullSha(provider.compiler.revision)||!digest(provider.compiler.sha256)||!Number.isSafeInteger(provider.compiler.bytes)||provider.compiler.bytes<=0)throw Error('Invalid projection compiler pin');
const canonical=['ci/source-check.ts','ci/quality/receipt-validation-gate.ts','ci/quality/receipt-validator.ts'];
const local=['ci/native-review.entry.ts','ci/generate-projection.ts'];
if(!Array.isArray(provider.source.inputs)||provider.source.inputs.map((row:any)=>row.path).sort().join('|')!==canonical.sort().join('|')||provider.source.inputs.some((row:any)=>!digest(row.sha256))||provider.source.sha256!==provider.source.inputs.find((row:any)=>row.path===provider.source.path)?.sha256)throw Error('Incomplete common CI source closure');
if(!Array.isArray(provider.generationInputs)||provider.generationInputs.map((row:any)=>row.path).sort().join('|')!==local.sort().join('|')||provider.generationEntry!=='ci/native-review.entry.ts'||provider.generator!=='ci/generate-projection.ts')throw Error('Incomplete projection generation inputs');
if(!Array.isArray(provider.generated)||provider.generated.length!==1||provider.generated[0].path!=='ci/native-review-gate.js')throw Error('Unexpected generated CI output');
for(const row of [...provider.generated,...provider.generationInputs]){
 if(!digest(row.sha256)||createHash('sha256').update(await readFile(root+row.path)).digest('hex')!==row.sha256)throw Error('Generated common CI projection drift');
}
const expected=new Map([...provider.source.inputs.map((row:any)=>['agent-platform:'+row.path,row.sha256]),['education-entry:ci/native-review.entry.ts',provider.generationInputs.find((row:any)=>row.path==='ci/native-review.entry.ts').sha256]]);
if(!Array.isArray(provider.compiledInputs)||provider.compiledInputs.length!==4||new Set(provider.compiledInputs.map((row:any)=>row.path)).size!==4)throw Error('Incomplete compiled CI graph');
for(const row of provider.compiledInputs){
 if(expected.get(row.path)!==row.sha256||!Number.isSafeInteger(row.bytes)||row.bytes<=0||!Array.isArray(row.imports))throw Error('Compiled CI source proof mismatch');
 for(const edge of row.imports)if(edge.external?!['crypto','fs/promises','os','path'].includes(edge.path):!expected.has(edge.path))throw Error('Unpinned compiled CI dependency');
}
if(provider.build.target!=='bun'||provider.build.format!=='esm'||provider.build.minify!==false||provider.build.splitting!==false||provider.build.tsconfigSha256!==createHash('sha256').update('{"compilerOptions":{}}\n').digest('hex'))throw Error('Projection build configuration drift');
console.log(JSON.stringify({status:'passed',class:'pinned-generated-common-ci-projection',commonCommit:provider.source.commit,commonTree:provider.source.tree,compiledInputs:provider.compiledInputs.length,nativePermissionGranted:false}));

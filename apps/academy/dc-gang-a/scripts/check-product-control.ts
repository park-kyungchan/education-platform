/** Source-only owner checks: no controller/native entrypoint execution or real contracts. */
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const owner=resolve(import.meta.dir,'..'),project=resolve(owner,'../../..');
const adoption=JSON.parse(readFileSync(resolve(owner,'runtime/product-control/source-adoption.json'),'utf8')) as {schema:string;files:{path:string;sha256:string}[];runtimeBoundary:{sourceAdoptionOnly:boolean;runtimeOrNativeAdmission:boolean;runningP1Route:string}};
if(adoption.schema!=='academy.product-control-canonical-source-adoption.v1'||!adoption.runtimeBoundary.sourceAdoptionOnly||adoption.runtimeBoundary.runtimeOrNativeAdmission||adoption.runtimeBoundary.runningP1Route!=='UNIDENTIFIED_UNAVAILABLE_HOLD')throw Error('source_adoption_boundary_required');
for(const file of adoption.files)if(createHash('sha256').update(readFileSync(resolve(project,file.path))).digest('hex')!==file.sha256)throw Error('reviewed_adoption_source_changed:'+file.path);
const compiled=await Bun.build({entrypoints:[resolve(owner,'src/academy/product-control/product-domain-controller.ts')],target:'bun'});
if(!compiled.success)throw Error('product_control_import_closure_failed');
const syntax="from pathlib import Path\nimport ast\nroot=Path.cwd()\nfor path in (root/'runtime/product-control').glob('*.py'): compile(path.read_text(),str(path),'exec')\nfor path in (root/'tests/academy/product-control').glob('*.py'): compile(path.read_text(),str(path),'exec')\ntree=ast.parse((root/'runtime/product-control/native-product-os.py').read_text())\nassert any(isinstance(n,ast.Import) and any(v.name=='re' for v in n.names) for n in tree.body)\n";
for(const args of [['-c',syntax],['tests/academy/product-control/native_boundary_fixtures.py'],['tests/academy/product-control/endpoint_fixtures.py']]){
 const child=Bun.spawn(['python3','-I','-S','-B',...args],{cwd:owner,stdin:'ignore',stdout:'inherit',stderr:'inherit'});
 if(await child.exited!==0)throw Error('product_control_source_fixture_failed');
}
console.log(JSON.stringify({scope:'product-control-reviewed-source-adoption-and-fictional-guards',sourceFiles:adoption.files.length,importClosureExecuted:false,nativeModuleImported:false,realContractAuthorityOrProfileOpened:false,actualRuntimeQualification:false,nativeEffects:0}));

import {readFileSync,writeFileSync,readdirSync,mkdirSync,lstatSync,existsSync} from 'node:fs';
import {resolve,join,relative,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mapOffline,sha,type InputFile} from './adapter.ts';
const [inputArg,outputArg]=process.argv.slice(2);
if(!inputArg||!outputArg||process.argv.length!==4)throw Error('Usage: node src/cli.ts INPUT_DIRECTORY NEW_PRIVATE_OUTPUT_DIRECTORY');
const input=resolve(inputArg),output=resolve(outputArg),adapterRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
if(existsSync(output)||output===input||output.startsWith(input+'/')||input.startsWith(output+'/'))throw Error('new_separate_output_directory_required');
if(output===adapterRoot||output.startsWith(adapterRoot+'/')||output.split('/').some(p=>['public','fixtures','.runtime'].includes(p)))throw Error('private_output_must_be_outside_app_and_public_roots');
for(let parent=dirname(output);;parent=dirname(parent)){
 if(existsSync(parent)){
  if(lstatSync(parent).isSymbolicLink())throw Error('output_ancestor_symlink_rejected');
  if(existsSync(join(parent,'package.json'))&&JSON.parse(readFileSync(join(parent,'package.json'),'utf8')).name==='academy-workbench')throw Error('frozen_runtime_output_rejected');
 }
 if(parent===dirname(parent))break;
}
const files:InputFile[]=[];let sourceBytes=0;
function walk(dir:string){for(const e of readdirSync(dir,{withFileTypes:true})){
 const path=join(dir,e.name);if(lstatSync(path).isSymbolicLink())throw Error('source_symlink_rejected');
 if(e.isDirectory())walk(path);else if(e.isFile()){
  sourceBytes+=lstatSync(path).size;if(sourceBytes>100*1024*1024)throw Error('source_byte_limit');files.push({path:relative(input,path),bytes:readFileSync(path)});
 }else throw Error('non_regular_source_file');
}}
if(lstatSync(input).isSymbolicLink())throw Error('source_symlink_rejected');walk(input);
const{dataset,report}=mapOffline(files),bytes=JSON.stringify(dataset,null,2)+'\n';
if(Buffer.byteLength(bytes)>100*1024*1024)throw Error('envelope_byte_limit');
mkdirSync(output,{mode:0o700});mkdirSync(join(output,'sources'),{mode:0o700});
for(const file of files){const dest=join(output,'sources',file.path);mkdirSync(dirname(dest),{recursive:true,mode:0o700});writeFileSync(dest,file.bytes,{flag:'wx',mode:0o600});if(sha(readFileSync(dest))!==sha(file.bytes))throw Error('source_copy_hash_mismatch');}
writeFileSync(join(output,'private-dataset.json'),bytes,{flag:'wx',mode:0o600});
writeFileSync(join(output,'mapping-report.json'),JSON.stringify({...report,sourceFilesBytePreserved:true,envelopeBytes:Buffer.byteLength(bytes),envelopeSha256:sha(bytes),databaseWritten:false,httpServerStarted:false},null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify({mode:'private',students:dataset.students.length,records:dataset.records.length,artifacts:dataset.artifacts.length,projections:0,databaseWritten:false,httpServerStarted:false,reportPath:join(output,'mapping-report.json')}));

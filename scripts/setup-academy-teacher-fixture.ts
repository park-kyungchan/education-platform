import {existsSync,lstatSync,realpathSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';

// This immutable ancestor is already in the delivered Education Git history.
// Keep the native reader's exact commit/tree/hash guard unchanged.
const root=realpathSync(resolve(import.meta.dir,'..'));
const commit='8f8c9bd61bd5e55445780b5569ecc40effcecef6';
const tree='ccb0fc6302f664abe069086881961cec99cf2d85';
const target=resolve(root,'.private/academy-teacher-fixture');
const manifest=JSON.parse(readFileSync(resolve(root,'architecture/academy-teacher-test-fixture.json'),'utf8')) as {schema:string;commit:string;tree:string;files:{path:string;mode:string;type:string;sha256:string;bytes:number}[]};
if(manifest.schema!=='education.academy-teacher-test-fixture.v1'||manifest.commit!==commit||manifest.tree!==tree||manifest.files.length!==74)throw Error('teacher_fixture_manifest_conflict');
const paths=manifest.files.map(file=>file.path);
if(new Set(paths).size!==paths.length||paths.some(path=>path.split('/').some(p=>!p||p==='.'||p==='..')||path.includes('\\')||!(path==='.gitignore'||/^apps\/academy\/dc-gang-a\/(?:src|harness|docs)\/.+\.ts$/.test(path)||/^apps\/academy\/dc-gang-a\/tests\/academy\/(?:retainedQueryFixtures|learningWorkFixtures)\.ts$/.test(path)||/^apps\/academy\/gang-a\/(?:packages\/.+\.ts|package\.json|bun\.lock)$/.test(path))))throw Error('teacher_fixture_source_scope_conflict');
const patterns=paths.map(path=>'/'+path);
const git=(cwd:string,...args:string[])=>execFileSync('git',['--no-optional-locks','-C',cwd,...args],{encoding:'utf8',env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_OPTIONAL_LOCKS:'0'},maxBuffer:1024*1024}).trim();
if(existsSync(resolve(root,'.private'))&&(lstatSync(resolve(root,'.private')).isSymbolicLink()||realpathSync(resolve(root,'.private'))!==resolve(root,'.private')))throw Error('teacher_fixture_private_root_unqualified');
if(git(root,'rev-parse','--show-toplevel')!==root||git(root,'rev-parse',commit+'^{tree}')!==tree)throw Error('teacher_fixture_full_history_required');
git(root,'merge-base','--is-ancestor',commit,'HEAD');
if(!existsSync(target)){
 git(root,'worktree','add','--detach','--no-checkout',target,commit);
 git(target,'sparse-checkout','set','--no-cone',...patterns);
 git(target,'read-tree','-mu','HEAD');
}
// Existing, incomplete or changed fixtures are never reset or silently repaired.
if(lstatSync(target).isSymbolicLink()||realpathSync(target)!==target||git(target,'rev-parse','--show-toplevel')!==target||git(target,'rev-parse','HEAD')!==commit||git(target,'rev-parse','HEAD^{tree}')!==tree)throw Error('teacher_fixture_revision_conflict');
if(git(target,'rev-parse','--path-format=absolute','--git-common-dir')!==git(root,'rev-parse','--path-format=absolute','--git-common-dir'))throw Error('teacher_fixture_owner_conflict');
if(git(target,'sparse-checkout','list')!==patterns.join('\n')||git(target,'status','--porcelain=v1','--untracked-files=all')!=='')throw Error('teacher_fixture_source_conflict');
for(const file of manifest.files){
 const path=resolve(target,file.path),stat=lstatSync(path);
 if(file.mode!=='100644'||file.type!=='blob'||!stat.isFile()||stat.isSymbolicLink()||realpathSync(path)!==path||stat.size!==file.bytes||createHash('sha256').update(readFileSync(path)).digest('hex')!==file.sha256)throw Error('teacher_fixture_bytes_conflict');
}
const {loadTeacherSource}=await import('../modules/academy-workbench/tools/academy-mcp/src/teacher-source-binding.ts');
await loadTeacherSource(target);
// The canonical application imports Gang-a's source-owned operating-context adapter.
const install=Bun.spawn([process.execPath,'install','--frozen-lockfile','--ignore-scripts'],{cwd:resolve(target,'apps/academy/gang-a'),stdin:'ignore',stdout:'inherit',stderr:'inherit'});
if(await install.exited!==0)throw Error('teacher_fixture_dependency_install_failed');
console.log(JSON.stringify({status:'ready',scope:'historical-canonical-source-and-fictional-fixtures',relativeRoot:'.private/academy-teacher-fixture',commit,tree,sourceFiles:paths.length,manifest:'architecture/academy-teacher-test-fixture.json',gitNetwork:false,dependencyNetwork:'frozen-lockfile-registry-install',privateStudentDataIncluded:false,nativeActivation:false}));

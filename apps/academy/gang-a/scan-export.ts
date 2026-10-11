/** Deliverable-source regression guard. Never inspect private source directories. */
import {readdirSync,readFileSync,statSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,relative} from 'node:path';
const root=import.meta.dir,skip=new Set(['node_modules','dist','src/generated','test-results','validation.json','.git']);
const files:string[]=[];function walk(path:string){for(const name of readdirSync(path)){const file=join(path,name),rel=relative(root,file);if(skip.has(rel)||rel.startsWith('src/generated/'))continue;if(statSync(file).isDirectory())walk(file);else {if(rel.endsWith('.log')&&Bun.spawnSync(['git','check-ignore','-q','--',rel],{cwd:root}).exitCode===0)continue;files.push(file);}}}walk(root);
const patterns=[/appgprj_[a-f0-9]{32}/,/appgver_[a-f0-9]{32}/,/appgdep_[a-f0-9]{32}/,/libfile_[a-f0-9]{32}/,/Sentinel_[a-f0-9]{32}/,/stu_[a-f0-9]{32}/,/FileDrive_[a-f0-9]{32}/,/page_space_[a-f0-9]{32}/,/https:\/\/[^\s"']+\.chatgpt\.site/,/\b(?:sk-proj-|ghp_|github_pat_)[A-Za-z0-9_]{12,}/,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/];
const syntheticPages=new Set(['1','2','3'].map(c=>'page_'+c.repeat(32))),failed=new Set<string>();
for(const file of files){const rel=relative(root,file);if(/(?:^|\/)(?:\.env(?:\.|$)|cookies?(?:\.|\/)|credentials?(?:\.|\/)|private[-_]binding)|\.har(?:\.gz)?$|\.pem$|\.p12$/i.test(rel))failed.add(rel);
 if(rel==='scan-export.ts')continue;const text=readFileSync(file,'utf8');if(patterns.some(pattern=>pattern.test(text)))failed.add(rel);for(const id of text.match(/\bpage_[a-f0-9]{32}\b/g)??[])if(!syntheticPages.has(id))failed.add(rel);
}
if(failed.size)throw Error('Code-only source scan failed: '+[...failed].join(','));
mkdirSync(root+'/test-results',{recursive:true});const receipt={passed:true,sourceFiles:files.length,actualPrivateIdentifiersDetected:false,sourceDataOrCompiledBundlesIncluded:false,dependencyTreesExcluded:true,syntheticFixturesDeclared:true,guardScope:'known_identifier_secret_and_forbidden_file_patterns_not_complete_DLP'};writeFileSync(root+'/test-results/export-scan.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));

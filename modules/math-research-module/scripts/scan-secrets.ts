import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const moduleRoot = fileURLToPath(new URL('../', import.meta.url));
const excluded = new Set(['node_modules','.git','dist','.test-build','.harness-deps','.local']);
const rules = [/\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{35,})\b/, /\bsk-(?:proj-)?[A-Za-z0-9_-]{30,}\b/, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /\bAKIA[A-Z0-9]{16}\b/, /[?&](?:X-Amz-Signature|X-Goog-Signature|sig)=[A-Za-z0-9%+/]{20,}/i];
export async function scanSources(root = moduleRoot) {
const failures:string[]=[]; let count=0;
const tracked = existsSync(join(root,'.git')) ? execFileSync('git',['-C',root,'ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean) : [];
for(const path of tracked.filter(path=>path==='.private'||path.startsWith('.private/')))
  failures.push(`Tracked operational output is not admitted: ${path}`);
async function scan(dir:string) { for (const e of await readdir(dir,{withFileTypes:true})) {
  if(excluded.has(e.name)) continue; const path=join(dir,e.name); const rel=relative(root,path);
  if(rel==='.private') continue;
  if(e.isDirectory()) { await scan(path); continue; }
  if(!e.isFile()) { failures.push(`Unsupported source file type: ${rel}`); continue; }
  if(/\.pdf$/i.test(e.name)) failures.push(`Publisher/PDF inclusion needs review: ${rel}`);
  if(/\.(?:woff2?|ttf|png|jpg|zip)$/.test(e.name)) continue;
  const text=await readFile(path,'utf8'); count++;
  if(rules.some(rule=>rule.test(text))) failures.push(`Credential-like content: ${rel}`);
  if(!rel.startsWith('source/') && /\.(tsx?|cjs)$/.test(e.name) && /(?:\/tmp\/math-research|\/workspace\/scratch\/[^'"\s]+)/.test(text)) failures.push(`Nonportable active code: ${rel}`);
} }
await scan(root);
return {failures,count};
}
if(import.meta.main) {
const {failures,count}=await scanSources();
if(failures.length) throw new Error(failures.join('\n'));
console.log(`PASS scoped secret/nonportable-code scan: ${count} text files. Heuristic scan, not a security certification.`);
}

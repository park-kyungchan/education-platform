import {readFile, lstat, realpath} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

export type TeacherSelector = {kind:'cohort'} | {kind:'student';studentId:string;date:string} | {kind:'class_preparation';date:string;groupId?:string};
/** An authenticated, read-only callback selected by the source owner at composition time. */
export type AuthenticatedFetchPage = (request: unknown) => Promise<unknown>;
const commit = '8f8c9bd61bd5e55445780b5569ecc40effcecef6';
const tree = 'ccb0fc6302f664abe069086881961cec99cf2d85';
const prefix = 'apps/academy/dc-gang-a/src/academy/';
const pins = [
  ['contracts/retainedQuery.ts','390d83478a73afdcc0863b75c5b013ca9e065deb25c763cf2f19622caf9a9965'],
  ['retainedQueryClient.ts','c458e74bce4ef63530c5480e2148646cacd81f5ceeb56ed1ec6570823b26288d'],
  ['retainedQueryValidation.ts','b5c1c09cd288a6d380776dbd67acb0b78b49cc125c020f7517f771d27b81ad9d'],
] as const;
export interface TeacherSourceBinding {
  readonly source: {readonly commit:string;readonly tree:string};
  assertCurrent(): Promise<void>;
  validateReply(value:unknown): Record<string,unknown>;
  readDocument(selector:TeacherSelector, fetchPage:AuthenticatedFetchPage): Promise<unknown>;
}
const exec = promisify(execFile);
/** Local composition only: paths are never accepted from MCP requests; no auth discovery or installation. */
export async function loadTeacherSource(sourceRoot:string):Promise<TeacherSourceBinding> {
  if(typeof sourceRoot!=='string'||!sourceRoot||sourceRoot.length>4096)throw Error('teacher_source_root_required');
  const root = resolve(sourceRoot);
  if(await realpath(root)!==root || !(await lstat(root)).isDirectory())throw Error('teacher_source_root_unqualified');
  const git = async (...args:string[]) => {
    const result = await exec('git',['--no-optional-locks','-C',root,...args],{encoding:'utf8',maxBuffer:8192,env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_OPTIONAL_LOCKS:'0'}});
    return result.stdout.trim();
  };
  const assertCurrent = async () => {
    if(await git('rev-parse','--show-toplevel')!==root || await git('rev-parse','HEAD')!==commit || await git('rev-parse','HEAD^{tree}')!==tree)throw Error('teacher_source_revision_conflict');
    for(const [path,sha256] of pins){
      const file=resolve(root,prefix,path),stat=await lstat(file);
      if(!stat.isFile()||stat.isSymbolicLink()||stat.size>65536||await realpath(file)!==file)throw Error('teacher_source_file_unqualified');
      if(createHash('sha256').update(await readFile(file)).digest('hex')!==sha256)throw Error('teacher_source_bytes_conflict');
    }
  };
  await assertCurrent();
  // The exact three-module browser-safe closure remains canonical-owner implementation.
  const client = await import(pathToFileURL(resolve(root,prefix,'retainedQueryClient.ts')).href);
  const validation = await import(pathToFileURL(resolve(root,prefix,'retainedQueryValidation.ts')).href);
  if(typeof client.readRetainedDocument!=='function'||typeof validation.validateRetainedQueryReply!=='function')throw Error('teacher_source_exports_unqualified');
  await assertCurrent();
  return Object.freeze({source:Object.freeze({commit,tree}),assertCurrent,
    validateReply:(value:unknown)=>validation.validateRetainedQueryReply(value) as Record<string,unknown>,
    readDocument:(selector:TeacherSelector,fetchPage:AuthenticatedFetchPage)=>client.readRetainedDocument(selector,fetchPage) as Promise<unknown>,
  });
}

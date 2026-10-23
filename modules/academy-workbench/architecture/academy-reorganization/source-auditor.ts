/** Qualified external audit dependency only; does not upgrade Academy consumer pins or native code. */
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const pinnedRoot=resolve(import.meta.dir,'../../.local/auditors/agent-platform-712f90de');
export const sourceAuditorSelection=Object.freeze({
  repositoryId:'park-kyungchan/agent-platform',
  commit:'712f90deac0676e662dc5d75d88d89f7b6773bfe',
  tree:'9ffdf1773188fb9bb75ed5111b21d21f32b07a24',
  root:pinnedRoot,
  meaning:'Owner-local detached sparse checkout for the previously admitted source auditor; current common main and native activation remain independent.',
});
export type {GitWorkReader,GitWorkSelection,LogicalIdentity,SourceReference,TaskRecord} from '../../.local/auditors/agent-platform-712f90de/packages/work-continuity/src/git-work/types.ts';
type SourceAuditModule=typeof import('../../.local/auditors/agent-platform-712f90de/packages/work-continuity/src/git-work/index.ts');
/** Check source before importing code. A caller may supply an equivalent exact checkout, never another revision. */
export async function loadSourceAuditor(root=pinnedRoot):Promise<SourceAuditModule>{
  const git=(...args:string[])=>{
    const result=Bun.spawnSync(['git','-C',root,...args],{stdout:'pipe',stderr:'pipe'});
    if(result.exitCode!==0)throw Error('source_auditor_unavailable');
    return result.stdout.toString().trim();
  };
  const qualify=()=>{
    if(git('rev-parse','HEAD')!==sourceAuditorSelection.commit||git('rev-parse','HEAD^{tree}')!==sourceAuditorSelection.tree||git('diff','HEAD','--name-only')!=='')throw Error('source_auditor_revision_or_bytes_changed');
  };
  qualify();
  const module=await import(pathToFileURL(resolve(root,'packages/work-continuity/src/git-work/index.ts')).href) as SourceAuditModule;
  qualify();
  return module;
}

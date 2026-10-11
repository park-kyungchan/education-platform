/** Domain-owned repository source bindings; not a checkout manager or execution grant. */
export interface RepositoryBinding {
  repositoryId:string;sourceKind:'git_worktree'|'inspected_archive';root:string;commit:string;
  contentState:'mixed_working_tree'|'inspected_reference_snapshot';writePolicy:'current_work_owned_changes_only'|'reference_only';
  revisionMeaning:'observed_HEAD_not_worktree_content'|'inspected_archive_not_current_upstream';
  observedAtUtc:string;evidenceRef:string;evidenceSha256:string;
}
export interface RepositoryBindings {
  schemaVersion:1;kind:'domain_repository_bindings';ownerProfile:'dc-gang-a-dev';primaryRepository:string;
  authority:'none';bindings:RepositoryBinding[];
}
const text=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=800&&!/[\u0000-\u001f]/.test(v);
function exact(v:unknown,fields:string[]):Record<string,unknown>{
  if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==fields.length||fields.some(k=>!Object.hasOwn(v,k)))throw Error('invalid_repository_bindings');
  if(Object.values(Object.getOwnPropertyDescriptors(v)).some(d=>!Object.hasOwn(d,'value')))throw Error('invalid_repository_bindings');
  return v as Record<string,unknown>;
}
export function validateRepositoryBindings(input:unknown):RepositoryBindings {
  const v=exact(input,['schemaVersion','kind','ownerProfile','primaryRepository','authority','bindings']);
  if(v.schemaVersion!==1||v.kind!=='domain_repository_bindings'||v.ownerProfile!=='dc-gang-a-dev'||v.authority!=='none'||!Array.isArray(v.bindings)||v.bindings.length<1||v.bindings.length>8)throw Error('invalid_repository_bindings');
  const ids=new Set(),roots=new Set();
  for(const raw of v.bindings){
    const b=exact(raw,['repositoryId','sourceKind','root','commit','contentState','writePolicy','revisionMeaning','observedAtUtc','evidenceRef','evidenceSha256']);
    if(Object.values(b).some(x=>!text(x))||typeof b.repositoryId!=='string'||!/^[-\w.]+\/[-\w.]+$/.test(b.repositoryId)||ids.has(b.repositoryId)||roots.has(b.root))throw Error('invalid_repository_bindings');
    if(typeof b.root!=='string'||!b.root.startsWith('/')||b.root.split('/').slice(1).some(x=>!x||x==='.'||x==='..')||b.root.includes('\\')||!(/^[a-f0-9]{40}$/).test(String(b.commit))||!(/^[a-f0-9]{64}$/).test(String(b.evidenceSha256))||!Number.isFinite(Date.parse(String(b.observedAtUtc))))throw Error('invalid_repository_identity');
    const actual=b.sourceKind==='git_worktree'&&b.contentState==='mixed_working_tree'&&b.writePolicy==='current_work_owned_changes_only'&&b.revisionMeaning==='observed_HEAD_not_worktree_content';
    const archive=b.sourceKind==='inspected_archive'&&b.contentState==='inspected_reference_snapshot'&&b.writePolicy==='reference_only'&&b.revisionMeaning==='inspected_archive_not_current_upstream';
    if(!actual&&!archive)throw Error('repository_source_class_conflict');
    ids.add(b.repositoryId);roots.add(b.root);
  }
  if(!ids.has(v.primaryRepository)||!v.bindings.some((b:any)=>b.repositoryId===v.primaryRepository&&b.sourceKind==='git_worktree'))throw Error('primary_repository_not_worktree');
  return structuredClone(v) as unknown as RepositoryBindings;
}

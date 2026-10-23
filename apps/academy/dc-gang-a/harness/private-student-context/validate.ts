import {readFileSync, lstatSync, readdirSync} from 'node:fs';
import {resolve, relative, sep} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import type {PrivateStudentManifest} from './types.ts';

const kinds = new Set(['user_report','space_snapshot','historical_artifact','derived_view','schema']);
const coverage = new Set(['complete_for_declared_scope','partial','unknown']);
function assert(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
function object(value: unknown): value is Record<string, unknown> {return !!value && typeof value === 'object' && !Array.isArray(value);}
function keys(value: Record<string,unknown>, expected: string[], where: string) {
  assert(Object.keys(value).every(k=>expected.includes(k)), `${where}:unexpected_field`);
  assert(expected.every(k=>Object.hasOwn(value,k)),`${where}:missing_field`);
}
function scan(value: unknown): void {
  if(Array.isArray(value)){for(const item of value)scan(item);return;}
  if(object(value))for(const [key,item] of Object.entries(value)){
    if(key.toLowerCase()==='authorization'){
      const policyText=item==='runtime managed student read scope'||item==='explicit teacher judgment and authorized app write';
      const policyObject=object(item)&&Object.keys(item).length===4&&Object.keys(item).every(k=>['evaluatedAtRuntime','allowedScopeRequired','explicitAuthorityForEffects','documentGrantsPermission'].includes(k))&&Object.values(item).every(v=>typeof v==='boolean');
      const schemaString=object(item)&&Object.keys(item).length===1&&item.type==='string';
      const schemaObject=object(item)&&item.type==='object'&&item.additionalProperties===false&&Object.keys(item).every(k=>['type','additionalProperties','properties','required'].includes(k))&&object(item.properties)&&Object.keys(item.properties).length===4&&Object.keys(item.properties).every(k=>['evaluatedAtRuntime','allowedScopeRequired','explicitAuthorityForEffects','documentGrantsPermission'].includes(k))&&Object.values(item.properties).every(v=>object(v)&&Object.keys(v).length===1&&v.type==='boolean');
      assert(policyText||policyObject||schemaString||schemaObject,'credential_authorization_field_rejected');
    }
    assert(!/^(password|passwd|access_token|refresh_token|session_token|client_secret|cookie|set-cookie|private_key)$/i.test(key),'credential_field_rejected');
    scan(item);
  }
  if(typeof value==='string')assert(!/(-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|Bearer\s+[A-Za-z0-9._~-]{16,}|JSESSIONID=\S+)/.test(value),'credential_pattern_rejected');
}
function files(root:string, dir=root): string[] {
  return readdirSync(dir).flatMap(name=>{
    const path=resolve(dir,name),stat=lstatSync(path);
    assert(!stat.isSymbolicLink(),'symlink_rejected');
    return stat.isDirectory()?files(root,path):[relative(root,path).split(sep).join('/')];
  });
}
export function validatePrivateStudentPackage(directory:string) {
  const root=resolve(directory);
  assert(!lstatSync(root).isSymbolicLink(),'root_symlink_rejected');
  assert(!lstatSync(resolve(root,'manifest.json')).isSymbolicLink(),'manifest_symlink_rejected');
  const m:unknown=JSON.parse(readFileSync(resolve(root,'manifest.json'),'utf8'));
  assert(object(m),'manifest_object_required');
  keys(m,['schemaVersion','dataClass','asOf','timezone','publication','artifacts','limitations'],'manifest');
  assert(m.schemaVersion==='academy.private-student-context/1.0'&&m.dataClass==='real_student_evidence','real_namespace_required');
  assert(m.timezone==='Asia/Seoul'&&typeof m.asOf==='string'&&/(Z|[+-]\d{2}:\d{2})$/.test(m.asOf)&&Number.isFinite(Date.parse(m.asOf)),'timestamp_required');
  assert(object(m.publication),'publication_required');
  keys(m.publication,['repository','visibility','mergeAllowed','productionMutation','syntheticReplacement','authorizationMessageIds'],'publication');
  assert(m.publication.repository==='park-kyungchan/dc-gang-a'&&m.publication.visibility==='private','private_target_required');
  assert(m.publication.mergeAllowed===false&&m.publication.productionMutation===false&&m.publication.syntheticReplacement===false,'effects_forbidden');
  // Source-message locators are provenance, not authentication or an effect grant.
  // Preserve historical Sentinel locators and actual native Codex message UUIDs.
  const messageRef=(x:unknown)=>typeof x==='string'&&(x.startsWith('Sentinel_')||/^msg_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(x));
  assert(Array.isArray(m.publication.authorizationMessageIds)&&m.publication.authorizationMessageIds.length>0&&m.publication.authorizationMessageIds.every(messageRef),'authorization_sources_required');
  assert(Array.isArray(m.limitations)&&m.limitations.every(x=>typeof x==='string'&&x.length>0),'limitations_required');
  assert(Array.isArray(m.artifacts)&&m.artifacts.length>0,'artifacts_required');
  const seen=new Set<string>();let totalBytes=0;
  // Inspect containment/symlinks before opening an artifact through a parent directory.
  const actual=files(root);
  for(const a of m.artifacts){
    assert(object(a),'artifact_object_required');
    keys(a,['path','sha256','bytes','provenanceKind','sourceReferences','coverage'],'artifact');
    assert(typeof a.path==='string'&&/^(today|space|history|views|schemas)\//.test(a.path)&&!a.path.includes('\\')&&!a.path.split('/').some(p=>p==='..'||p==='.'||p===''),'artifact_path_rejected');
    assert(!seen.has(a.path),'duplicate_path');seen.add(a.path);
    assert(typeof a.sha256==='string'&&/^[0-9a-f]{64}$/.test(a.sha256),'sha256_required');
    assert(Number.isSafeInteger(a.bytes)&&Number(a.bytes)>0,'bytes_required');
    assert(typeof a.provenanceKind==='string'&&kinds.has(a.provenanceKind)&&typeof a.coverage==='string'&&coverage.has(a.coverage),'artifact_type_required');
    assert(Array.isArray(a.sourceReferences)&&a.sourceReferences.length>0&&a.sourceReferences.every(x=>typeof x==='string'&&x.length>0),'source_references_required');
    const path=resolve(root,a.path);assert(path.startsWith(root+sep),'outside_package');
    const bytes=readFileSync(path);assert(bytes.byteLength===a.bytes,'byte_count_mismatch');
    assert(createHash('sha256').update(bytes).digest('hex')===a.sha256,'hash_mismatch');
    const text=bytes.toString('utf8');
    try{
      scan(text);
      if(a.path.toLowerCase().endsWith('.json'))scan(JSON.parse(text));
      else if(a.path.toLowerCase().endsWith('.jsonl')){
        for(const [index,line] of text.split(/\r?\n/).entries()){
          if(!line.trim())continue;
          let record:unknown;
          try{record=JSON.parse(line);}catch{throw new Error(`jsonl_record_invalid:${index+1}`);}
          scan(record);
        }
      }
    }
    catch(error){throw new Error(`${a.path}:${error instanceof Error?error.message:'invalid_artifact'}`);}
    totalBytes+=bytes.byteLength;
  }
  assert(actual.every(p=>p==='manifest.json'||seen.has(p)),'unmanifested_file');
  scan(m);
  return {status:'passed',schemaVersion:(m as unknown as PrivateStudentManifest).schemaVersion,artifactCount:seen.size,totalBytes,scope:'manifest_integrity_and_boundary_checks_not_semantic_acceptance'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const target=process.argv[2]??'context/private-students/2026-10-16';
  try{console.log(JSON.stringify(validatePrivateStudentPackage(target)));}catch(error){console.error(error instanceof Error?error.message:'validation_failed');process.exitCode=1;}
}

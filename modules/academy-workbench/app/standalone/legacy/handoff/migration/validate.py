"""Validate documentation, never call an academy route or change application state.
Requires an already available Python jsonschema package. Type checking is optional
unless --tsc points to an already installed TypeScript compiler. Installs nothing.
"""
from pathlib import Path
import argparse, collections, datetime, hashlib, json, re, subprocess, sys
from jsonschema import Draft202012Validator, FormatChecker
P=Path(__file__).resolve().parent
parser=argparse.ArgumentParser()
parser.add_argument('--source-root',type=Path,help='Optional original evidence workspace; source contents are never copied.')
parser.add_argument('--tsc',type=Path,help='Existing TypeScript bin/tsc path, executed using node.')
parser.add_argument('--output',default='validation-result.json')
args=parser.parse_args()
checks=[]
def check(name,condition,detail=''):
 if not condition: raise AssertionError(name+(': '+detail if detail else ''))
 checks.append({'name':name,'passed':True})
def read(n):return json.loads((P/n).read_text())
registry=read('hardlimits.json');example=read('hardlimits.example.json');manifest=read('evidence-manifest.json');schema=read('hardlimits.schema.json')
Draft202012Validator.check_schema(schema);check('json_schema_meta_validation',True)
v=Draft202012Validator(schema,format_checker=FormatChecker())
for name,data in [('current_registry',registry),('synthetic_example',example)]:
 errors=list(v.iter_errors(data));check(name+'_schema',not errors,str(errors[0])[:500] if errors else '')
source_by_id={s['id']:s for s in manifest['sources']}
check('evidence_source_ids_unique',len(source_by_id)==len(manifest['sources']))
check('all_five_status_alternatives_demonstrated',{x['status'] for x in example['limits']}=={'failed','blocked','unverified','approval_pending','resolved'})
for docname,doc in [('registry',registry),('example',example)]:
 ids={x['id'] for x in doc['limits']};goals={x['id'] for x in doc['goals']};domains={x['id']:set(x['children']) for x in doc['domainHierarchy']}
 check(docname+'_unique_limit_ids',len(ids)==len(doc['limits']))
 checks_ids=[c['id'] for x in doc['limits'] for c in x['acceptanceChecks']]
 check(docname+'_unique_acceptance_ids',len(set(checks_ids))==len(checks_ids))
 check(docname+'_domain_paths',all(x['domainPath'][0] in domains and x['domainPath'][1] in domains[x['domainPath'][0]] for x in doc['limits']))
 check(docname+'_goal_references',all(set(x['impactedGoals'])<=goals for x in doc['limits']))
 check(docname+'_dependency_references',all(set(x['dependencies'])<=ids and x['id'] not in x['dependencies'] for x in doc['limits']))
 expected={(x['id'],d) for x in doc['limits'] for d in x['dependencies']};actual={(e['from'],e['to']) for e in doc['dependencyGraph']['edges']}
 check(docname+'_dependency_graph_matches_limits',expected==actual and len(actual)==len(doc['dependencyGraph']['edges']))
 by_id={x['id']:x for x in doc['limits']};visiting=set();visited=set()
 def visit(i):
  if i in visiting:raise AssertionError('Prerequisite dependency cycle: '+i)
  if i in visited:return
  visiting.add(i)
  for d in by_id[i]['dependencies']:visit(d)
  visiting.remove(i);visited.add(i)
 for i in ids:visit(i)
 check(docname+'_prerequisite_graph_is_dag',len(visited)==len(ids))
 check(docname+'_evidence_references',all(e['sourceId'] in source_by_id for x in doc['limits'] for e in x['evidence']))
 check(docname+'_attempt_evidence_references',all(set(a['evidenceSourceIds'])<=set(source_by_id) for x in doc['limits'] for a in x['attemptedMethods']))
 check(docname+'_workflow_cycles_separate',all(w['id'] not in ids and not w['executionEnabled'] and all(t['from'] in w['stages'] and t['to'] in w['stages'] for t in w['transitions']) for w in doc['workflowCycles']))
 check(docname+'_authority_is_false',all(value is False for value in doc['authority'].values()))
 check(docname+'_actual_device_not_new_gate',doc['currentState']['qa']['actualDeviceIsAdditionalMandatoryGate'] is False)
check('recorded_v21_commit',registry['currentState']['sites']['storedCandidateCommit']=='54967bfc64278fb594d64887106b85c71facd80c')
check('production_19_candidate_21_undeployed',registry['currentState']['sites']['productionVersion']==19 and registry['currentState']['sites']['storedCandidateVersion']==21 and registry['currentState']['sites']['candidateDeployed'] is False)
check('separate_ui_and_api_coverage',registry['currentState']['coverageAxes']['officialUiReadSupportedCatalogEntries']==7 and registry['currentState']['coverageAxes']['historicalCatalogEntries']==95 and registry['currentState']['coverageAxes']['independentlyActivatedProductionSourceApiAdapters']==0)
check('owner_only_private_scope',registry['currentState']['pilotAudience']=='owner_only' and registry['repositoryVisibilityRequired']=='private')
# Reject status-field misuse: each variant must carry its own detail and no other status detail.
for status,key in [('failed','failure'),('blocked','blocker'),('unverified','verification'),('approval_pending','approval'),('resolved','resolution')]:
 item=next(x for x in example['limits'] if x['status']==status)
 bad=json.loads(json.dumps(example));bad['limits']=[{k:v for k,v in item.items() if k!=key}]
 check('reject_missing_'+key,not v.is_valid(bad))
 bad=json.loads(json.dumps(example));bad['limits']=[dict(item,unexpectedField='not allowed')]
 check('reject_extra_field_'+status,not v.is_valid(bad))
original_hashes_checked=0;pointers_checked=0;private_needle_checks=0
if args.source_root:
 root=args.source_root.resolve()
 for source in manifest['sources']:
  if source['kind']!='file_hash_reference':continue
  path=(root/source['relativePath']).resolve()
  check('source_path_within_root_'+source['id'],path.is_relative_to(root))
  check('source_digest_'+source['id'],path.is_file() and hashlib.sha256(path.read_bytes()).hexdigest()==source['sha256'])
  original_hashes_checked+=1
 for item in registry['limits']:
  for evidence in item['evidence']:
   source=source_by_id[evidence['sourceId']]
   if 'jsonPointer' not in evidence or source['kind']!='file_hash_reference':continue
   data=json.loads((root/source['relativePath']).read_text())
   for token in evidence['jsonPointer'].split('/')[1:]:
    token=token.replace('~1','/').replace('~0','~');data=data[int(token)] if isinstance(data,list) else data[token]
   pointers_checked+=1
 check('all_cited_json_pointers_exist',True)
 # Compare known sensitive values in the private replay only in memory; never log them.
 private_path=root/'clinic-context-integration-20261013/live-coverage-results.json'
 if private_path.is_file():
  private=json.loads(private_path.read_text());needles=set()
  for candidate in private.get('ambiguousHeader',{}).get('candidates',[]):
   title=candidate.get('fullTestingName','')
   if ' - ' in title:needles.add(title.rsplit(' - ',1)[1])
   needles.update(str(value) for value in candidate.get('observedIds',{}).values() if len(str(value))>=6)
  for path in P.iterdir():
   if path.is_file() and path.suffix in {'.json','.ts','.md','.py'} and path.name!=args.output:
    text=path.read_text()
    for needle in needles:
     check('private_value_excluded_'+str(private_needle_checks),not re.search(r'(?<![A-Za-z0-9])'+re.escape(needle)+r'(?![A-Za-z0-9])',text))
     private_needle_checks+=1
sensitive_patterns={
 'email_value':r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}',
 'private_key_material':r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
 'github_token':r'gh[pousr]_[A-Za-z0-9]{30,}',
 'openai_key':r'sk-[A-Za-z0-9_-]{30,}',
 'session_cookie_value':r'(?i)JSESSIONID\s*[:=]\s*[A-Za-z0-9._-]{12,}',
 'bearer_value':r'(?i)Bearer\s+[A-Za-z0-9._-]{20,}',
}
export_names={'README.md','hardlimits.types.ts','hardlimits.schema.json','hardlimits.json','hardlimits.example.json','evidence-manifest.json','validate.py'}
scan_files=[p for p in P.iterdir() if p.is_file() and p.name in export_names]
for name,pattern in sensitive_patterns.items():
 check('no_'+name,all(not re.search(pattern,p.read_text()) for p in scan_files))
typecheck='not_run_no_compiler_supplied'
if args.tsc:
 generated=P/'_typecheck.generated.ts'
 try:
  generated.write_text('import type { HardLimitRegistry, EvidenceManifest } from "./hardlimits.types";\n'+
   'export const current = '+json.dumps(registry,ensure_ascii=False)+' as const satisfies HardLimitRegistry;\n'+
   'export const example = '+json.dumps(example,ensure_ascii=False)+' as const satisfies HardLimitRegistry;\n'+
   'export const evidence = '+json.dumps(manifest,ensure_ascii=False)+' as const satisfies EvidenceManifest;\n')
  proc=subprocess.run(['node',str(args.tsc.resolve()),'--noEmit','--strict','--target','ES2022','--module','ESNext','--moduleResolution','Bundler','--skipLibCheck',str(generated)],capture_output=True,text=True)
  check('strict_typescript_literal_assignability',proc.returncode==0,(proc.stdout+proc.stderr)[:4000]);typecheck='passed'
 finally:generated.unlink(missing_ok=True)
receipt={'schemaVersion':'1.0.0','checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'passed','checksPassed':len(checks),'limits':len(registry['limits']),'statusCounts':dict(collections.Counter(x['status'] for x in registry['limits'])),'evidenceSources':len(manifest['sources']),'originalSourceHashesChecked':original_hashes_checked,'sourceHashCheckMode':'verified_against_original_workspace' if args.source_root else 'not_run_original_sources_not_supplied','jsonPointersChecked':pointers_checked,'knownPrivateValueChecks':private_needle_checks,'staticPrivacyPatternChecks':len(sensitive_patterns),'strictTypeScript':typecheck,'noToolsInstalled':True,'liveSourceRequests':0,'applicationTestsRun':0,'deploymentChanges':0,'checks':checks,'documentDigests':[{'file':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(scan_files)]}
(P/args.output).write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:receipt[k] for k in ['status','checksPassed','limits','statusCounts','originalSourceHashesChecked','jsonPointersChecked','knownPrivateValueChecks','strictTypeScript']},ensure_ascii=False))

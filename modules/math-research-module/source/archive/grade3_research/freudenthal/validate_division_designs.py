import json, pathlib,re,ast
P=pathlib.Path('grade3_research/freudenthal')
x=json.loads((P/'division_designs.json').read_text()); src=json.load(open('grade3_research/expanded/core_detail_expansion.json'))
expected={t['id'] for d in src['details'] if d['id'].startswith('HD') for t in d['types']}
actual={r['subtypeId'] for r in x['designs']};assert actual==expected
required='subtypeId status attribution sourceIds originalExample revisedExample targetStructure generalizationDomain phenomenonToOrganize designRationale expectedStrategies anticipatedErrors invariant transfer boundaryCase adjacentTypeContrast guidanceSequence scope prerequisites observationPlan learningEffectClaim actionDesign'.split()
reqaction='id phase cue observableStudentAction expectedUnderstanding mathematicalPurpose designIntent teacherCheck likelyError scaffold fading separationReason evidence childFacingSegment'.split()
ids=[];counts={};original_checks=[]
for r in x['designs']:
 assert all(k in r for k in required),(r['subtypeId'],'missing record field')
 assert r['status']=='paradigmatic_design_intent_unvalidated'
 assert r['attribution']=='project_authored_interpretation_not_freudenthal_endorsement'
 assert r['learningEffectClaim']=='hypothesis_not_observed'
 assert set(r['sourceIds'])<={'F78','F83','F91','MP84'}
 a=r['actionDesign']; assert a['subtypeId']==r['subtypeId']
 assert a['status']=='research_design_unvalidated'
 for step in a['microActions']:
  assert all(k in step and step[k] for k in reqaction),(r['subtypeId'],step['id'])
  assert set(step['teacherCheck'])=={'evidence','nonEvidence','nextDecision'}
  assert set(step['fading'])=={'remove','readinessEvidence','restoreIf'}
  assert all(e['relation']=='project_application_inference' for e in step['evidence'])
  ids.append(step['id'])
 flattened=[i for c in a['segmentation']['chunks'] for i in c['actionIds']]
 assert flattened==[m['id'] for m in a['microActions']]
 counts[r['subtypeId']]=len(a['microActions'])
assert len(ids)==len(set(ids))
for d in src['details']:
 if d['id'].startswith('HD'):
  for t in d['types']:
   for expr in t['example'].get('numericChecks',[]):
    left,right=expr.split('='); assert eval(left,{'__builtins__':{}})==eval(right,{'__builtins__':{}}),expr
    original_checks.append(expr)
# Explicit audits of every distinct central division and added numeric examples.
cases=[(84,2,42,0),(66,3,22,0),(84,3,28,0),(90,3,30,0),(80,4,20,0),(90,4,22,2),(72,3,24,0),(86,4,21,2),(86,3,28,2),(60,4,15,0),(80,5,16,0),(60,6,10,0),(96,3,32,0),(84,4,21,0),(18,3,6,0),(32,4,8,0),(45,6,7,3),(40,4,10,0),(29,4,7,1),(35,6,5,5),(28,4,7,0),(38,5,7,3),(43,6,7,1),(38,6,6,2),(846,2,423,0),(963,3,321,0),(852,2,426,0),(156,3,52,0),(248,4,62,0),(306,3,102,0),(528,4,132,0),(642,4,160,2),(428,4,107,0),(735,5,147,0),(658,3,219,1),(725,4,181,1),(638,5,127,3),(617,3,205,2),(818,4,204,2),(853,7,121,6),(964,8,120,4),(824,4,206,0),(365,5,73,0),(635,5,127,0),(399,4,99,3),(400,4,100,0),(372,6,62,0),(468,6,78,0),(600,6,100,0),(618,3,206,0),(816,4,204,0),(903,3,301,0),(840,4,210,0),(960,4,240,0),(850,5,170,0),(860,5,172,0),(841,4,210,1),(963,4,240,3),(844,4,211,0),(96,4,24,0),(144,6,24,0),(97,4,24,1),(324,3,108,0),(408,4,102,0),(95,6,15,5),(209,6,34,5),(200,7,28,4),(210,6,35,0),(24,6,4,0),(35,5,7,0),(53,8,6,5),(62,9,6,8),(56,8,7,0),(59,7,8,3),(68,9,7,5),(49,8,6,1),(48,8,6,0),(63,9,7,0),(57,8,7,1),(238,4,59,2),(317,4,79,1),(72,6,12,0),(60,5,12,0)]
for n,d,q,r in cases:
 assert d>0 and 0<=r<d and n==d*q+r and divmod(n,d)==(q,r),(n,d,q,r)
# Candidate-error examples deliberately conserve total but violate the remainder bound.
for n,d,q,r in [(38,6,5,8),(38,5,6,8),(853,7,120,13),(853,7,119,20),(964,8,119,12),(725,4,180,5),(86,4,20,6),(210,6,34,6),(238,4,58,6)]:
 assert n==d*q+r and r>=d
assert 8%3==2 and (8%3)*10+6==26
assert (38+34)//6==12 and (29+31)//5==12
assert (53+8-1)//8==7 and (49+8-1)//8==7 and (56+8-1)//8==7
report=dict(status='passed',coveredTypes=len(actual),missingTypes=[],duplicateTypeIds=len(x['designs'])-len(actual),microActions=len(ids),microActionCountRange=[min(counts.values()),max(counts.values())],originalArithmeticChecks=len(original_checks),additionalDivisionCases=len(cases),errorCandidateBoundaryChecks=9,zeroDivisorPolicy='excluded from generalized domain; explicitly invalid in boundary case',roundingPolicy='capacity/complete-bundle choices derived from conditions, not nearest-integer rounding',schemaChecks='all required design and microaction fields present; IDs unique; chunks cover all actions in order',originalCorpus='read-only; source file not modified',countByType=counts,limitations=['This verifies schema and stated numerical relationships, not pedagogical effectiveness.','Contextual wording and grade-level scope were reviewed by author; no student study was run.'])
(P/'division_validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='countByType'},ensure_ascii=False,indent=2))

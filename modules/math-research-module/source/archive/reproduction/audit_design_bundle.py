import json,glob,collections,hashlib
base={}
for f in ['grade3_research/expanded/core_detail_expansion.json','grade3_research/expanded/upper_detail_expansion.json']:
 for s in json.load(open(f))['details']:
  for t in s['types']:base[t['id']]=t['example']
req='subtypeId status attribution sourceIds originalExample revisedExample targetStructure generalizationDomain phenomenonToOrganize designRationale expectedStrategies anticipatedErrors invariant transfer boundaryCase adjacentTypeContrast guidanceSequence scope prerequisites observationPlan learningEffectClaim actionDesign'.split()
areq='subtypeId status example prerequisites segmentation microActions independentTransfer boundaryProbe interpretationLimits'.split()
mreq='id phase cue observableStudentAction expectedUnderstanding mathematicalPurpose designIntent teacherCheck likelyError scaffold fading separationReason evidence childFacingSegment'.split()
phases={'prerequisite','orient','represent','execute','connect','explain','check','transfer'}
psy={'IES21','IES07','RJ06','SC85','RAMS02'}
issues=[];ids=[];actions=[];counts={}
def check(o,keys,p):
 for k in keys:
  if k not in o or o[k] in ('',None,[],{}):issues.append((p,'missing/empty',k))
for f in sorted(glob.glob('grade3_research/freudenthal/*designs.json')):
 data=open(f,'rb').read();d=json.loads(data);ds=d.get('designs',list(d.values()));n=0
 for x in ds:
  id=x.get('subtypeId','?');ids.append(id);check(x,req,id)
  if id not in base:issues.append((id,'unknownID'))
  else:
   for k in ['prompt','answer']:
    if x['originalExample'][k]!=base[id][k]:issues.append((id,'originalChanged',k))
  for k,want in [('status','paradigmatic_design_intent_unvalidated'),('attribution','project_authored_interpretation_not_freudenthal_endorsement'),('learningEffectClaim','hypothesis_not_observed')]:
   if x.get(k)!=want:issues.append((id,k,x.get(k)))
  check(x['designRationale'],'context numbers conditions representation contrastWithAlternative'.split(),id+'.rationale')
  check(x['revisedExample'],'prompt answer solution'.split(),id+'.revised')
  check(x['transfer'],'prompt answer preservedStructure'.split(),id+'.transfer')
  check(x['boundaryCase'],'prompt answer changedCondition'.split(),id+'.boundary')
  if set(x['sourceIds'])-{'F78','F83','F91','MP84'}:issues.append((id,'unknown theory source'))
  a=x['actionDesign'];check(a,areq,id+'.actionDesign')
  if a['subtypeId']!=id:issues.append((id,'action ID mismatch'))
  ms=a['microActions'];mids=[m['id'] for m in ms];n+=len(ms);actions.extend(mids)
  for m in ms:
   p=m['id'];check(m,mreq,p);check(m['teacherCheck'],'evidence nonEvidence nextDecision'.split(),p+'.teacherCheck');check(m['fading'],'remove readinessEvidence restoreIf'.split(),p+'.fading')
   if m['phase'] not in phases:issues.append((p,'badphase',m['phase']))
   for e in m['evidence']:
    check(e,'sourceId relation applicationInference'.split(),p+'.evidence')
    if e['sourceId'] not in psy:issues.append((p,'unknown psy source'))
  cids=[i for c in a['segmentation']['chunks'] for i in c['actionIds']]
  if collections.Counter(cids)!=collections.Counter(mids):issues.append((id,'chunk coverage mismatch'))
  if a['example']['prompt']!=x['revisedExample']['prompt'] or a['example']['answer']!=x['revisedExample']['answer']:issues.append((id,'action example mismatch'))
  for k,xk in [('independentTransfer','transfer'),('boundaryProbe','boundaryCase')]:
   for field in ['prompt','answer']:
    if a[k][field]!=x[xk][field]:issues.append((id,k,field,'mismatch'))
 counts[f]={'designs':len(ds),'actions':n,'sha256':hashlib.sha256(data).hexdigest()}
for name,ls in [('design',ids),('action',actions)]:
 if len(ls)!=len(set(ls)):issues.append((name,'duplicate IDs'))
print(json.dumps({'counts':counts,'missingIDs':sorted(set(base)-set(ids)),'issues':issues,'totals':[len(ids),len(actions)]},ensure_ascii=False,indent=2))

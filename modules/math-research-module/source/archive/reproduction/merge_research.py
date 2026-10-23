import json, pathlib, hashlib
root=pathlib.Path(__file__).resolve().parent
research=root.parent/'grade3_research/freudenthal'
out=root/'src/components/generated'
designs=[]
for name in ['multiplication_designs.json','division_designs.json','circle_designs.json','upper_designs.json']:
 p=research/name
 if not p.exists(): raise SystemExit('Not ready: '+str(p))
 obj=json.loads(p.read_text())
 if isinstance(obj,list): rows=obj
 else:
  rows=next((obj[k] for k in ['designs','records','items'] if isinstance(obj.get(k),list)),None)
  if rows is None and all(isinstance(v,dict) and v.get('subtypeId')==k for k,v in obj.items()): rows=list(obj.values())
  if rows is None: raise SystemExit('Unknown record wrapper: '+name+' keys='+str(obj.keys()))
 designs+=rows
data=json.loads((out/'MathData.ts').read_text().split('=',1)[1].strip().removesuffix(';'))
ids={t['id'] for d in data['details'] for t in d['types']}
mapped={d['subtypeId']:d for d in designs}
assert len(mapped)==len(designs)==len(ids)==151,(len(mapped),len(designs),len(ids))
assert set(mapped)==ids,{'missing':list(ids-set(mapped)),'extra':list(set(mapped)-ids)}
for d in designs:
 assert d['status']=='paradigmatic_design_intent_unvalidated',d['subtypeId']
 for k in ['attribution','sourceIds','originalExample','revisedExample','targetStructure','generalizationDomain','phenomenonToOrganize','designRationale','expectedStrategies','anticipatedErrors','invariant','transfer','boundaryCase','adjacentTypeContrast','guidanceSequence','scope','prerequisites','observationPlan','learningEffectClaim']:
  assert d.get(k),'Missing '+k+' '+d['subtypeId']
 assert d['scope'] in ['grade3_core','grade3_deepening','grade4_6_connection'],d['subtypeId']
 assert d['learningEffectClaim']=='hypothesis_not_observed',d['subtypeId']
 assert set(d['sourceIds'])<=set(['F78','F83','F91','MP84']),d['subtypeId']
 for k in ['expectedStrategies','anticipatedErrors','guidanceSequence','prerequisites','observationPlan']:
  assert isinstance(d[k],list),'Not list '+k+' '+d['subtypeId']
 assert isinstance(d['revisedExample']['solution'],list),'Solution not list '+d['subtypeId']
 for k in ['context','numbers','conditions','representation','contrastWithAlternative']:
  assert d['designRationale'].get(k),'Missing rationale '+k+' '+d['subtypeId']
 for k in ['prompt','answer','preservedStructure']:
  assert d['transfer'].get(k),'Missing transfer '+k+' '+d['subtypeId']
 for k in ['prompt','answer','changedCondition']:
  assert d['boundaryCase'].get(k),'Missing boundary '+k+' '+d['subtypeId']
 a=d.get('actionDesign')
 assert a and len(a['microActions'])>0,'No action design: '+d['subtypeId']
 assert a['subtypeId']==d['subtypeId']
 assert a['example']['prompt']==d['revisedExample']['prompt'],'Action prompt mismatch '+d['subtypeId']
 assert a['example']['answer']==d['revisedExample']['answer'],'Action answer mismatch '+d['subtypeId']
 action_ids=[x['id'] for x in a['microActions']]
 assert len(set(action_ids))==len(action_ids),'Action duplicate '+d['subtypeId']
 for c in a['segmentation']['chunks']:
  assert set(c['actionIds'])<=set(action_ids),'Invalid chunk refs '+d['subtypeId']
 for step in a['microActions']:
  for field in ['id','phase','cue','observableStudentAction','expectedUnderstanding','mathematicalPurpose','designIntent','teacherCheck','likelyError','scaffold','fading','separationReason','evidence','childFacingSegment']:
   assert step.get(field),'Missing '+field+' '+d['subtypeId']
  assert all(e['sourceId'] in ['IES21','IES07','RJ06','SC85','RAMS02'] for e in step['evidence'])
sources=json.loads((research/'sources.json').read_text())['sources']
psych=json.loads((research/'psychology_sources.json').read_text())['sources']
ko=json.loads((root/'psychology_ko.json').read_text())
psych=[{**s,**ko.get(s['id'],{})} for s in psych]

for old in out.glob('ResearchDataPart*.ts'): old.unlink()
parts=[];batch={};size=0
for key,record in mapped.items():
 record_size=len(json.dumps(record,ensure_ascii=False,separators=(',',':')).encode())
 if batch and size+record_size>800000:
  parts.append(batch);batch={};size=0
 batch[key]=record;size+=record_size+len(key)+4
if batch:parts.append(batch)
imports=[]
for i,part in enumerate(parts):
 name='ResearchDataPart'+str(i+1).zfill(2)
 (out/(name+'.ts')).write_text('export const DATA_PART: Record<string, any> = '+json.dumps(part,ensure_ascii=False,separators=(',',':'))+';\n')
 imports.append("import { DATA_PART as p"+str(i)+" } from './"+name+"';")
index='\n'.join(imports)+'\nexport const RESEARCH_DESIGNS: Record<string, any> = Object.assign({},'+','.join('p'+str(i) for i in range(len(parts)))+');\n'
index+='export const RESEARCH_SOURCES: any[] = '+json.dumps(sources,ensure_ascii=False,separators=(',',':'))+';\nexport const PSYCHOLOGY_SOURCES: any[] = '+json.dumps(psych,ensure_ascii=False,separators=(',',':'))+';\n'
(out/'ResearchData.ts').write_text(index)
(root/'merged_designs.json').write_text(json.dumps(mapped,ensure_ascii=False,separators=(',',':')))
assert all(p.stat().st_size<1048576 for p in out.glob('*') if p.is_file())
print(json.dumps({'designs':len(designs),'actions':sum(len(d['actionDesign']['microActions']) for d in designs),'dataParts':len(parts),'dataBytes':sum(p.stat().st_size for p in out.glob('ResearchData*.ts')),'baselineMathDataSha256':hashlib.sha256((out/'MathData.ts').read_bytes()).hexdigest()},indent=2))

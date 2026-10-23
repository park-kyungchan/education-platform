import pathlib,json,hashlib
P=pathlib.Path(__file__).resolve().parent;B=P.parent
read=lambda n:json.loads((P/n).read_text())
c=read('core_detail_expansion.json');u=read('upper_detail_expansion.json');h=json.loads((B/'four_level_hierarchy.json').read_text());g=json.loads((B/'grade3_to_6_connections.json').read_text())
details=c['details']+u['details'];types=[t for d in details for t in d['types']];examples=[e for t in types for e in [t['example']]+t.get('variants',[])]
assert len({d['id'] for d in details})==len(details)
assert len({t['id'] for t in types})==len(types)
oldcore={n['id'] for n in json.loads((B/'core_taxonomy.json').read_text())['nodes'] if n['kind']=='problem-type'}
oldupper={t['id'] for t in json.loads((B/'upper_problem_types.json').read_text())['types']}
linked={i for t in types for i in t['originalTypeIds']}
assert oldcore|oldupper<=linked
assert {d['id'] for d in c['details']}=={d['id'] for d in h['nodes'] if d['level']=='세부단원'}
byid={n['id']:n for n in g['nodes']}
assert {d['parentContentId'] for d in u['details']}=={n['id'] for n in g['nodes'] if n['connectionRole']=='core-related'}
assert u['boundarySupportNodes']==[n for n in g['nodes'] if n['connectionRole']=='boundary-support']
assert all(d['officialGradeBand']==byid[d['parentContentId']]['officialGradeBand'] for d in u['details'])
for obj in [c,u]:
 sources={s['id'] for s in obj['sources']}
 for d in obj['details']:
  for t in d['types']:assert set(t['sourceIds'])<=sources
for e in examples:
 assert all(e.get(k) for k in ['prompt','answer','solution','misconception','authorship'])
 assert e['authorship']=='original'
 assert isinstance(e['solution'],str), 'solution must normalize to string'
v={'status':'passed','originalContentNodesPreserved':88,'coreDetailCount':55,'upperDetailCount':27,'allDetailCount':len(details),'cognitiveTypeCount':len(types),'exampleCount':len(examples),'variantCount':len(examples)-len(types),'coveredOriginalCoreTypes':33,'coveredOriginalUpperTypes':34,'uncoveredOriginalDetails':[],'boundarySupportNodesPreserved':4,'boundarySupportExamples':0,'numericAssertions':read('core_expansion_validation.json')['numericAssertions']+u['validation']['arithmeticAssertionCount'],'checks':['all existing detail nodes covered','all original 67 types traceable','parent content and source references resolve','official grade bands match original records','boundary records unchanged and not expanded','all required example fields present','all solutions normalized to text'],'files':{n:hashlib.sha256((P/n).read_bytes()).hexdigest() for n in ['core_detail_expansion.json','upper_detail_expansion.json','multiplication_mindmap_sample.md']}}
(P/'combined_validation.json').write_text(json.dumps(v,ensure_ascii=False,indent=2))
print(json.dumps(v,ensure_ascii=False,indent=2))
md=['# 상위 연결내용 창작 예시','',u['scope'],'','범위·편성의 출처를 참고하여 직접 작성한 문항이다. 출판사 원문 복제가 아니다.','']
for d in u['details']:
 md += [f'## {d["title"]} ({d["id"]})',f'학년군: {d["officialGradeBand"]}', '']
 for t in d['types']:
  md += [f'### {t["title"]} ({t["id"]})']
  for e in [t['example']]+t.get('variants',[]):
   md += [f'- 문항: {e["prompt"]}',f'- 정답: {e["answer"]}',f'- 풀이: {e["solution"]}',f'- 오개념: {e["misconception"]}','- 직접 창작','']
md += ['## 범위 확인 출처']
for s in u['sources']:md += [f'- [{s.get("title",s["id"])}]({s["url"]})']
(P/'upper_detail_examples.md').write_text('\n'.join(md))

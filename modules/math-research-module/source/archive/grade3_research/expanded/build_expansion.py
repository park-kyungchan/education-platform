import json, pathlib, re, ast, operator
from collections import defaultdict,Counter
P=pathlib.Path(__file__).resolve().parent; BASE=P.parent
h=json.load(open(BASE/'four_level_hierarchy.json')); core=json.load(open(BASE/'core_taxonomy.json'))
links=defaultdict(list)
for x in h['typeLinks']:
 for d in x['detailContentIds']:links[d].append(x['typeId'])
rows=defaultdict(list); checks=[]
ops={ast.Add:operator.add,ast.Sub:operator.sub,ast.Mult:operator.mul,ast.Div:operator.truediv}
def calc(s):
 def go(n):
  if isinstance(n,ast.Constant) and isinstance(n.value,(int,float)):return n.value
  if isinstance(n,ast.BinOp) and type(n.op) in ops:return ops[type(n.op)](go(n.left),go(n.right))
  raise ValueError(s)
 return go(ast.parse(s,mode='eval').body)
for line in (P/'core_rows.txt').read_text().splitlines():
 a=line.split('|'); assert len(a)==7,a
 d,title,prompt,answer,solution,misconception,equations=a
 for eq in equations.split(';'):
  if eq:
   l,r=eq.split('='); assert calc(l)==calc(r),(d,eq);checks.append({'detailId':d,'equation':eq,'passed':True})
 rows[d].append({'title':title,'example':{'prompt':prompt,'answer':answer,'solution':solution,'misconception':misconception,'authorship':'original','numericChecks':equations.split(';') if equations else []}})
# Different surface settings or magnitudes alone do not become separate cognitive types.
merge={'HM11-d2':'자리별 실제 값에 곱하기','HM12-d3':'연속 올림 처리','HD32-d2':'나눗셈의 나머지를 최종 답으로 선택','HD32-d3':'완성된 묶음만 세기','HC22-d1':'반지름·지름을 같은 기준으로 바꾸어 비교'}
details=[]
for node in h['nodes']:
 if node['level']!='세부단원':continue
 d=node['id']; rr=rows[d];assert rr,d
 types=[]
 for i,r in enumerate(rr):
  if d in merge and i:
   types[0].setdefault('variants',[]).append({'id':f'{d}-T01-V{i:02}','title':r['title'],**r['example']}); continue
  types.append({'id':f'{d}-T{i+1:02}','title':merge.get(d,r['title']),'originalTypeIds':links[d], 'example':r['example'],'sourceIds':['PUB3-2022-TOC'],'evidenceStatus':'proposed-original','alignmentNote':'공개 차시 목차로 내용 범위를 확인했다. 세분유형·문항·해설은 직접 설계했으며 출판사 문항 분류나 문항 인용이 아니다.'})
 details.append({'id':d,'parentContentId':node['parentId'],'title':node['title'],'officialGradeBand':'3~4','observedPlacement':'3-2','placementStatus':'publisher-observed-not-national-mandate','originalContentIds':node['originalContentIds'],'types':types})
sources=[{'id':'PUB3-2022-TOC','url':'https://www.didimdolclass.co.kr/curriculum/curriculum','title':'디딤돌교실 2022개정 수학 3-2 공개 차시 목차','verifiedAt':'2026-10-13','verificationMethod':'공개 웹페이지 본문 확인','scope':'세 자리×한 자리, ×10·몇십, 한 자리×두 자리, 두 자리×두 자리, 원의 요소·성질·컴퍼스, 두/세 자리÷한 자리, 나머지 및 검산의 내용 범위','limitations':'페이지가 기본 선택 교과서를 바꿀 수 있음. 로그인 자료·문항 원문은 열람하지 않음. 개별 세분유형의 출판사 채택을 주장하지 않음.'}]
obj={'version':'1.0-expanded-original-examples','preserves':['four_level_hierarchy.json','core_taxonomy.json','upper_problem_types.json','grade3_to_6_connections.json'],'sources':sources,'details':details,'notes':['기존 88개 내용 노드는 수정하지 않았다. 모든 기존 세부단원 55개에 직접 연결한 창작 문항을 추가한다.','공식 성취기준의 학년군과 출판사 학기 배치를 구별한다. 3-2는 확인한 교과서 편성이다.','내용 포함 관계와 선수 관계는 별개이다. 문항은 학생의 숙달을 입증하는 자료가 아니다.','수치나 맥락만 바뀐 5쌍은 새로운 인지 유형으로 세지 않고 동일 유형의 variants에 넣었다.','기존 직접 연결 누락 HC21-d2에 새 유형을 부착하였다. 기존 C-T03(반지름 성질)을 지름 유형이라고 바꾸지 않았다.']}
(P/'core_detail_expansion.json').write_text(json.dumps(obj,ensure_ascii=False,indent=2))
count=sum(len(x['types']) for x in details);total=sum(len(r) for r in rows.values())
audit={'status':'passed','originalContentNodeCount':len(h['nodes']),'detailCount':len(details),'coveredDetailCount':len(rows),'missingDetails':[],'originalUnlinkedDetails':[x['id'] for x in details if not links[x['id']]],'newCognitiveTypeCount':count,'exampleCount':total,'variantCount':total-count,'numericAssertions':len(checks),'numericAssertionResults':checks,'scope':'초3 본체 확장. 기존 파일 검산은 이전 validation.json을 보존하며 여기서는 새 예시 계산식을 검사. 개념·서술 검토는 작성자 검토이고 독립 실증 검증은 아님.'}
all_types=[t for d in details for t in d['types']]
all_ids=[t['id'] for t in all_types]
assert len(all_ids)==len(set(all_ids))
original_types={n['id'] for n in core['nodes'] if n['kind']=='problem-type'}
covered_types={i for t in all_types for i in t['originalTypeIds']}
assert original_types<=covered_types
for t in all_types:
 for e in [t['example']]+t.get('variants',[]):
  assert all(e.get(k) for k in ['prompt','answer','solution','misconception','authorship'])
audit.update({'allNewTypeIdsUnique':True,'requiredExampleFieldsPresent':True,'originalCoreTypeCount':len(original_types),'coveredOriginalCoreTypeCount':len(original_types&covered_types),'missingOriginalCoreTypes':sorted(original_types-covered_types),'reviewCorrections':['HC33-d2-T02에 두 원의 외접 조건을 명시하여 답의 유일성을 확보','HM22-d2-T02의 오개념을 실제 계산과 일치하는 부분곱 누락·정렬 오류로 수정']})
(P/'core_expansion_validation.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2))
md=['# 초3-2 세부단원별 창작 예시 확장','',f'55개 세부단원 / {count}개 세분유형 / {total}개 창작 예시. 수치·맥락 변형 {total-count}개는 같은 유형 안에 표시한다.','', '출처: [디딤돌교실 공개 차시 목차](https://www.didimdolclass.co.kr/curriculum/curriculum). 목차로 범위를 확인하고 유형·문항은 직접 창작했다. 출판사 문항을 인용한 자료가 아니다.','']
for d in details:
 md += [f'## {d["title"]} ({d["id"]})','']
 for t in d['types']:
  md += [f'### {t["title"]} ({t["id"]})']
  for e in [t['example']]+t.get('variants',[]):
   md += [f'- 문항: {e["prompt"]}',f'- 정답: {e["answer"]}',f'- 풀이: {e["solution"]}',f'- 오개념: {e["misconception"]}','- 창작 구분: 직접 창작','']
(P/'core_detail_examples.md').write_text('\n'.join(md))
print({k:v for k,v in audit.items() if k!='numericAssertionResults'})

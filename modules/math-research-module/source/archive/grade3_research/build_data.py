import json,re,pathlib
p=pathlib.Path(__file__).parent
s=(p/'problem_types.md').read_text()
rows=[]
for line in s.splitlines():
 if re.match(r'\| [MDC]-T\d\d ',line):
  a=[x.strip() for x in line.split('|')[1:-1]]
  rows.append(dict(id=a[0],contentIds=a[1].split('/'),title=a[2],exampleAndAnswer=a[3],diagnosticNotes=a[4],evidenceStatus='proposed-original'))
merges={'M-T06':'M-T02','D-T01':'D-T02','D-T11':'D-T10','C-T02':'C-T01','C-T06':'C-T03','C-T08':'C-T07','C-T12':'C-T05'}
lookup={r['id']:r for r in rows}
for child,parent in merges.items():
 lookup[parent].setdefault('variants',[]).append(lookup[child])
 lookup[parent]['contentIds']=list(dict.fromkeys(lookup[parent]['contentIds']+lookup[child]['contentIds']))
types=[r for r in rows if r['id'] not in merges]
assert len(types)==33
nodes=[('G3S2','초3 2학기',None,'root'),('U-M','2-1 곱셈','G3S2','unit'),('U-D','2-2 나눗셈','G3S2','unit'),('U-C','2-3 원','G3S2','unit')]
for u,ls in [('M',['선수: 자릿값·곱셈구구·두 자리×한 자리','세 자리×한 자리','×10·몇십 곱하기','한 자리×두 자리','두 자리×두 자리','곱셈 종합 활용']),('D',['선수: 나눗셈 의미·역관계·자릿값','몇십÷한 자리','두 자리÷한 자리','나머지 있는 나눗셈','나눗셈 검산','세 자리÷한 자리','생활 상황 해석']),('C',['선수: 원 모양·선분·길이·두 배','중심·반지름·지름','원의 성질','컴퍼스 작도','조건에 맞는 원·무늬'])]:
 for i,t in enumerate(ls): nodes.append((f'{u}{i}',t,'U-'+u,'prerequisite-summary' if i==0 else 'content'))
outnodes=[dict(id=i,title=t,parentId=pa,kind=k,evidenceStatus='publisher-aligned' if k=='content' else 'organizational-proposal') for i,t,pa,k in nodes]
for t in types:
 t['parentId']=t['contentIds'][0]
 t['kind']='problem-type'
 outnodes.append(t)
edges=[]
def add(a,b,rel='essential',note=''):
 edges.append(dict(id=f'{a}__{b}__{rel}',source=a,target=b,relation=rel,evidenceStatus='pedagogical-inference',reason=note))
for a,b,r in [('M0','M1','essential'),('M1','M2','helpful'),('M2','M3','essential'),('M2','M4','essential'),('M3','M4','recommended-order'),('D0','D1','essential'),('D1','D2','essential'),('D2','D3','recommended-order'),('D3','D4','essential'),('D2','D5','essential'),('D3','D5','essential'),('D4','D5','recommended-order'),('M1','D4','helpful'),('D3','D6','essential'),('C0','C1','essential'),('C1','C2','essential'),('C1','C3','essential'),('C2','C4','essential'),('C3','C4','essential')]:add(a,b,r)
data=dict(version='0.2-research',verifiedAt='2026-10-13',scope='3학년2학기 핵심, 3~6학년 연결 별도 보완',sources=[dict(id='S1',url='https://www.didimdolclass.co.kr/curriculum/curriculum',role='2022개정 디딤돌3-2 차시배치'),dict(id='S2',url='https://www.pen.go.kr/upload/main/na/bbs_2330/ntt_1118209/doc_eaadv4ca2%3D8avba%3D4dv76%3Db4v0c%3D291bvb350v0784_v620.pdf',role='2022개정 학년군 성취기준')],counts=dict(coreProblemTypes=len(types),illustrativeVariants=len(merges)),nodes=outnodes,prerequisiteEdges=edges,notes=['parentId는 계층 전용이며 선수 관계가 아니다.','contentIds는 교차 연결이다. 같은 유형을 여러 개념 아래 복제하지 않는다.','essential/helpful/recommended-order는 공식 지정이 아니라 수업 설계 제안이다.','실제 교과 차시는 검산 후 세 자리 나눗셈.','계산 조건·표현·인지 행동·맥락 태그의 곱집합을 새 유형으로 만들지 않는다.','studentMastery는 근거가 없으므로 필드 자체를 생성하지 않았다.','M0,D0,C0는 선수 요약이며 초1~2 전체 계층으로 확장하지 않는다.'])
(p/'core_taxonomy.json').write_text(json.dumps(data,ensure_ascii=False,indent=2))
print(len(outnodes),'nodes',len(edges),'edges',len(types),'core types')
# Refine merged labels and evidence metadata without changing stable IDs.
titles={'M-T02':'자릿값·부분곱·모형으로 곱셈 원리 설명','M-T08':'빈칸·가려진 수 추론','D-T02':'두 자리 수·몇십을 한 자리 수로 나누기','D-T06':'곱셈과 덧셈으로 나눗셈 결과 검산','D-T10':'등분·포함 상황을 식으로 모델링','D-T12':'남는 수를 답으로 해석','C-T01':'원의 요소 식별·예와 비예 분류','C-T03':'한 원의 반지름 성질 적용·설명','C-T05':'반지름·지름·위치 조건으로 원의 크기 비교','C-T07':'반지름·지름 조건에 맞는 원 작도'}
for n in data['nodes']:
 if n['id'] in titles:n['title']=titles[n['id']]
 if n['id'].startswith('M'): n['standardIds']=['4수01-04']
 if n['id'].startswith('D'): n['standardIds']=['4수01-05','4수01-06']
 if n['id'].startswith('C'): n['standardIds']=['4수03-06'] if n['id'] not in ['C3','C4','C-T07','C-T09','C-T10','C-T11'] else ['4수03-06','4수03-07']
 if n['id'] in ['M-T09','D-T15']:n['standardIds'].append('4수01-08')
 if n['kind']=='content': n['sourceIds']=['S1','S2']
 if n['kind']=='problem-type': n['sourceIds']=['S1','S2'];n['alignmentNote']='성취기준·차시 범위에 맞춘 제안 유형이며 출처에 이 유형 목록이 직접 실려 있지는 않음'
data['tagDimensions']={'calculationCondition':['피승수/승수 자리수','받아올림 위치/횟수','0 포함 위치','자리 바꾸어 나눔','나머지 유무','몫 자리수','몫 중간/끝0'],'representation':['가로식','세로식','수모형','배열','문장','원 도식','실기'],'cognitiveAction':['계산','설명','추론','비교','검증','모델링','작도'],'context':['없음','같은 묶음','배 비교','등분','포함','남는 양','완성 묶음','모두 수용','무늬'],'level':['기초','연결','선택 확장']}
(p/'core_taxonomy.json').write_text(json.dumps(data,ensure_ascii=False,indent=2))
edge_details={
('M0','M1'):('자리별 곱과 받아올림을 이해한다.','자릿값·곱셈구구·두 자리 곱셈 중 해당 하위 기술'),
('M1','M2'):('자릿값에 따른 곱을 십 단위 곱으로 연결한다.','권장 교수 경로이며 역순 학습도 가능'),
('M2','M3'):('십의 자리와 일의 자리 부분곱을 합한다.','표준 부분곱 설명 경로'),
('M2','M4'):('십의 자리 부분곱의 크기와 정렬을 이해한다.','표준 부분곱·세로셈 설명 경로'),
('M3','M4'):('쉬운 수에서 두 자리 승수의 구조를 먼저 경험한다.','권장 교수 순서'),
('D0','D1'):('같게 나누는 뜻과 곱셈구구로 몫을 찾는다.','선수 요약 중 나눗셈 의미·곱셈구구'),
('D1','D2'):('십을 일로 바꾸어 나누는 절차를 확장한다.','자리 바꾸기가 있는 세로셈'),
('D2','D3'):('나눗셈 절차에 남는 양 해석을 더한다.','권장 교수 순서, 구체적 나머지 경험은 더 일찍 가능'),
('D3','D4'):('나머지를 더하는 검산식과 나머지 조건을 확인한다.','나머지가 있는 검산에 한정'),
('D2','D5'):('자리별 몫 산출을 세 자리로 확장한다.','세로셈 경로'),
('D3','D5'):('남는 양을 세 자리 나눗셈에서도 해석한다.','세 자리 나눗셈 중 나머지가 있는 경우에 한정'),
('D4','D5'):('검산을 먼저 익힌 뒤 더 큰 수에서 활용한다.','S1에 확인된 차시 순서, 일반적 필수 순서는 아님'),
('M1','D4'):('곱셈 계산으로 역산 결과를 확인한다.','검산의 곱이 세 자리×한 자리인 경우'),
('D3','D6'):('문맥에 따라 몫과 나머지를 선택한다.','나머지가 있는 활용에 한정, 정확한 등분·포함은 제외'),
('C0','C1'):('원의 요소를 점과 선분으로 구분한다.','선수 요약 중 원 모양·점·선분만 해당, 두 배와 측정은 제외'),
('C1','C2'):('반지름과 지름을 구분하여 성질을 설명한다.','요소 기반 성질 탐구'),
('C1','C3'):('바늘 위치는 중심, 벌림은 반지름으로 대응한다.','중심·반지름 조건 작도'),
('C2','C4'):('크기 조건을 같은 기준으로 변환한다.','지름/반지름 변환이나 크기 관계가 있는 과제'),
('C3','C4'):('중심과 벌림을 바꾸어 원을 구성한다.','컴퍼스를 사용하는 구성 과제')}
for e in data['prerequisiteEdges']:
 e['reason'],e['scopeCondition']=edge_details[(e['source'],e['target'])]
for n in data['nodes']:
 if n['id']=='C-T11':n['standardIds']=['4수03-06']
 if n['id'] in ['M5','D6']:n['evidenceStatus']='organizational-proposal'
data['notes']+=['선수 간선은 학습 잠금·해제 규칙이 아니다. essential도 scopeCondition에 적힌 방법·과제 조건에 한정된다.','상위 단원 완료를 하위 과제의 선수 숙달로 간주하지 않는다.']
(p/'core_taxonomy.json').write_text(json.dumps(data,ensure_ascii=False,indent=2))

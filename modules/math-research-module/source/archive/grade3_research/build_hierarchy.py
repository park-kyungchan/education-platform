import pathlib,json
p=pathlib.Path(__file__).parent
core=json.loads((p/'core_taxonomy.json').read_text());nodes=[];details_by_content={}
def N(id,title,parent,level,refs=[]):
 nodes.append(dict(id=id,title=title,parentId=parent,level=level,originalContentIds=refs,evidenceStatus='organizational-proposal',note='사용자 기존 4단계 구조에 맞춘 탐색용 내용 계층'))
for id,title in [('U-M','2-1 곱셈'),('U-D','2-2 나눗셈'),('U-C','2-3 원')]:N(id,title,None,'대단원',[id])
# Preserve the user's previous middle/small units; atomic details are explicit revisions.
groups=[
('HM1','세 자리 수와 한 자리 수의 곱셈','U-M',[
('HM11','올림이 없는 곱셈',['M1'],['자릿값에 따라 수 분해하기','각 자리의 수를 곱하기','자리별 곱을 합치기']),
('HM12','올림이 있는 곱셈',['M1'],['올림이 필요한 이유 설명하기','한 번 올림 처리하기','여러 번 올림 처리하기','0이 포함된 수의 자릿값 유지하기'])]),
('HM2','두 자리 수를 곱하는 곱셈','U-M',[
('HM21','10과 몇십 곱하기',['M2'],['10배의 자릿값 변화 설명하기','몇십을 곱하는 크기 해석하기']),
('HM22','한 자리 수와 두 자리 수의 곱셈',['M3'],['십과 일로 나누어 부분곱 구하기','부분곱을 합쳐 곱 구하기']),
('HM23','두 자리 수와 두 자리 수의 곱셈',['M4'],['일의 자리 부분곱 구하기','십의 자리 부분곱 구하기','부분곱의 자리를 맞추어 합산하기','곱셈의 올림과 합산의 올림 구별하기'])]),
('HM3','곱셈 결과 판단과 활용','U-M',[
('HM31','어림과 오류 점검',['M5'],['어림으로 결과의 크기 판단하기','자릿값과 올림 오류 설명하기']),
('HM32','곱셈 문제 해결',['M5'],['묶음과 배 관계를 식으로 나타내기','곱의 관계와 미지수 추론하기','단계별 식으로 상황 해결하기'])]),
('HD1','두 자리 수÷한 자리 수','U-D',[
('HD11','나누어떨어지는 나눗셈',['D1','D2'],['높은 자리부터 나누기','남은 십을 일로 바꾸기','몫의 위치 정하기']),
('HD12','나머지가 있는 나눗셈',['D3'],['몫과 나머지의 의미 설명하기','나머지의 범위 확인하기'])]),
('HD2','세 자리 수÷한 자리 수','U-D',[
('HD21','나누어떨어지는 나눗셈',['D5'],['높은 자리부터 몫 정하기','남은 양의 단위를 바꾸기']),
('HD22','나머지가 있는 나눗셈',['D5'],['세 자리 계산의 몫과 나머지 구하기','최종 나머지 범위 확인하기']),
('HD23','몫의 자리와 0 처리',['D5'],['몫의 자릿수와 위치 판단하기','몫의 중간 0 처리하기','몫의 끝 0 처리하기'])]),
('HD3','계산 확인과 상황 해석','U-D',[
('HD31','나눗셈 검산',['D4'],['나누어떨어지는 계산 검산하기','나머지가 있는 계산 검산하기']),
('HD32','나눗셈 상황 해석',['D6'],['등분과 포함의 뜻 구분하기','남는 양을 답으로 해석하기','완성 묶음 수를 답으로 해석하기','모두 수용할 묶음 수 구하기','어림과 단계별 식으로 상황 해결하기'])]),
('HC1','원의 구성 요소','U-C',[
('HC11','중심과 반지름',['C1'],['중심 정의와 위치 식별하기','반지름 정의와 예·비예 구분하기']),
('HC12','지름',['C1'],['중심 통과와 양 끝점 조건 식별하기','지름의 예·비예 구분하기'])]),
('HC2','원의 성질과 크기','U-C',[
('HC21','길이 관계',['C2'],['한 원의 반지름 길이가 같음을 적용하기','한 원의 지름 길이가 같음을 적용하기','지름과 반지름의 두 배 관계 적용하기']),
('HC22','크기 비교',['C2'],['반지름 또는 지름을 같은 기준으로 비교하기','원의 위치와 크기 구별하기'])]),
('HC3','원 그리기와 활용','U-C',[
('HC31','컴퍼스 사용',['C3'],['중심을 고정하기','벌린 거리가 반지름임을 설명하기','같은 벌림을 유지하며 돌리기']),
('HC32','조건에 맞게 그리기',['C3','C4'],['주어진 반지름으로 원 그리기','주어진 지름을 반지름으로 바꾸어 그리기']),
('HC33','원 무늬와 활용',['C4'],['중심과 반지름을 바꾸어 무늬 만들기','명시된 원 배치에서 길이 추론하기'])])]
for mid,title,unit,subs in groups:
 N(mid,title,unit,'중단원')
 for sid,st,refs,ds in subs:
  N(sid,st,mid,'소단원',refs)
  for i,dt in enumerate(ds,1):
   did=sid+'-d'+str(i);N(did,dt,sid,'세부단원',refs)
   for c in refs:details_by_content.setdefault(c,[]).append(did)
# Broad semantic coverage defaults; precise mappings override where useful.
links=[]
overrides={
'M-T09':['HM31-d1'],'M-T10':['HM32-d1'],'M-T11':['HM32-d2'],'M-T12':['HM32-d3'],'M-T08':['HM32-d2'],'M-T07':['HM31-d2'],
'D-T03':['HD11-d2'],'D-T04':['HD12-d1'],'D-T05':['HD12-d2'],'D-T08':['HD23-d1','HD23-d2','HD23-d3'],'D-T09':['HD31-d2'],'D-T10':['HD32-d1'],'D-T12':['HD32-d2'],'D-T13':['HD32-d3'],'D-T14':['HD32-d4'],'D-T15':['HD32-d5'],'D-T16':['HD32-d5'],
'C-T03':['HC21-d1'],'C-T04':['HC21-d3'],'C-T05':['HC22-d1','HC22-d2'],'C-T07':['HC32-d1','HC32-d2'],'C-T09':['HC31-d1','HC31-d2','HC31-d3'],'C-T10':['HC33-d1'],'C-T11':['HC33-d2']}
for t in core['nodes']:
 if t['kind']!='problem-type':continue
 ds=overrides.get(t['id']) or list(dict.fromkeys(d for c in t['contentIds'] for d in details_by_content.get(c,[])))
 links.append(dict(typeId=t['id'],detailContentIds=ds,relation='task-applies-to-content'))
d=dict(version='0.2-user-structure-aligned',status='original-middle-small-titles-preserved-with-explicit-detail-refinement',levels=['대단원','중단원','소단원','세부단원'],nodes=nodes,typeLinks=links,proposedRevisions=['기존 원 구조의 원자 기능을 관찰 가능한 동사형 세부단원으로 명시했다.','기존 곱셈의 올림 조건 안에 0의 자릿값 기능을 보완했다.','기존 원 무늬 아래 배치 길이 추론을 선택 확장 기능으로 추가했다.','내용 배치와 교수 순서는 구분한다. 나눗셈 검산은 세 자리 계산보다 먼저 지도할 수 있다.'],notes=['학년·학기는 별도 범위 정보이며 4내용계층에 세지 않는다.','문제 유형은 별도 카탈로그로 두고 세부단원에 연결한다.','originalContentIds는 기존 개념·선수 그래프와의 대응이며 선수 관계가 아니다.','공식 교육과정이 이 4단계 분류를 지정했다는 뜻이 아니다.','문제 유형은 여러 세부단원에 연결될 수 있으며 중복하여 세지 않는다.'])
(p/'four_level_hierarchy.json').write_text(json.dumps(d,ensure_ascii=False,indent=2));print(len(nodes),'four-level content nodes',len(links),'type links')
d['contentCrossLinks']=[dict(source='HM12-d4',target='HM11',relation='also-applies-to',note='0의 자릿값 처리는 올림 없는201×3=603 같은 계산에도 적용된다. 기존 소단원 제목을 유지하기 위한 교차 연결이다.')]
(p/'four_level_hierarchy.json').write_text(json.dumps(d,ensure_ascii=False,indent=2))

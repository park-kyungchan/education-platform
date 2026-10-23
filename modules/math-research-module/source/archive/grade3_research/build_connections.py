import json,pathlib
p=pathlib.Path(__file__).parent
S3='https://www.goe.go.kr/resource/goe/na/bbs_2675/2026/02/116dc7a4-254a-44fe-9e77-3e908ecc5ff3.pdf'
S4='https://s3.ap-northeast-2.amazonaws.com/tsol.jihak.co.kr/tsol/archive/page/m2024/pbl/ele.html'
rows=[
('G4-M','자연수 곱셈 범위 확대','4-1',['4수01-04'],'core-related'),
('G4-D','두 자리 수로 나누기','4-1',['4수01-07'],'core-related'),
('G5-FM','약수와 배수','5-1',['6수01-04','6수01-05'],'core-related'),
('G5-RED','약분·통분','5-1',['6수01-06'],'boundary-support'),
('G5-FMULT','분수의 곱셈','5-2',['6수01-09'],'core-related'),
('G5-DMULT','소수의 곱셈','5-2',['6수01-13'],'core-related'),
('G6-FDIVN','분수를 자연수로 나누기·자연수 나눗셈의 분수 몫','6-1',['6수01-10','6수01-11'],'core-related'),
('G6-DDIVN','소수를 자연수로 나누기·자연수 나눗셈의 소수 몫','6-1',['6수01-14','6수01-15'],'core-related'),
('G6-FDIVF','분수로 나누기','6-2',['6수01-11'],'core-related'),
('G6-DDIVD','소수로 나누기','6-2',['6수01-15'],'core-related'),
('G6-PI','원주율과 원주','6-2',['6수03-15','6수03-16'],'core-related'),
('G6-AREA','원의 넓이','6-2',['6수03-16'],'core-related'),
('G5-AREABASE','둘레·넓이 의미, 넓이 단위, 직사각형 넓이','5-1',['6수03-11','6수03-12','6수03-13'],'boundary-support'),
('G34-FRAC','분수의 의미','3~4학년군',['4수01-09','4수01-10'],'boundary-support'),
('G34-DEC','소수의 의미·자릿값','3~4학년군',['4수01-12','4수01-13'],'boundary-support')]
nodes=[]
for id,title,place,codes,role in rows:
 source='S4' if place=='4-1' else 'S2' if place=='3~4학년군' else 'S3'
 nodes.append(dict(id=id,title=title,parentId=None,kind='connected-content',connectionRole=role,standardIds=codes,officialGradeBand='3~4' if id.startswith(('G4-','G34-')) else '5~6',observedPlacement=place,placementStatus='grade-band-only' if place=='3~4학년군' else 'verified-official-example-not-national-mandate',sourceIds=[source],evidenceStatus='curriculum-aligned',scopeNote='해당 연결에 필요한 부분만 표시하며 이 단원 전체를 펼치지 않음'))
edges=[]
def E(a,b,r,why,scope):edges.append(dict(id=a+'__'+b,source=a,target=b,relation=r,evidenceStatus='pedagogical-inference',reason=why,scopeCondition=scope))
E('M4','G4-M','helpful','자릿값과 부분곱 계산을 더 큰 수로 확장','표준 부분곱 계산 경로')
E('D5','G4-D','helpful','몫 산출·빼기·나머지 확인 절차를 두 자리 제수로 확장','표준 세로셈 경로')
E('M1','G5-FM','application','곱으로 수를 만드는 관계를 배수·약수로 해석','곱셈 관계를 활용한 탐구')
E('D3','G5-FM','application','나누어떨어지는지 확인하여 약수를 찾음','나머지0 조건으로 약수 판별')
E('G5-FM','G5-RED','essential','공약수·공배수를 활용해 분수 표현을 바꿈','공약수로 약분·공배수로 통분하는 경로')
E('M1','G5-FMULT','helpful','자연수 곱셈 계산을 분자·분모 계산에 활용','계산 기반, 이것만으로 분수곱셈 의미가 준비되지는 않음')
E('G34-FRAC','G5-FMULT','essential','분수로 나타낸 양의 곱을 해석','분수곱셈의 의미 이해')
E('G5-RED','G5-FMULT','helpful','계산 전후 약분으로 더 간단히 표현','약분 전 값을 구하는 데 반드시 필요하지 않음')
E('M4','G5-DMULT','helpful','자연수처럼 곱한 뒤 단위·자릿값을 해석','소수 세로셈 경로')
E('G34-DEC','G5-DMULT','essential','소수 자릿값과 단위 크기로 곱 해석','소수곱셈의 의미·자릿수 설명')
E('D2','G6-FDIVN','helpful','등분·포함과 몫의 의미를 분수 범위로 확장','나눗셈 의미 연결')
E('G34-FRAC','G6-FDIVN','essential','몫과 피제수를 분수로 해석','분수 나눗셈 의미')
E('D5','G6-DDIVN','helpful','자릿값을 더 작게 바꾸며 나누기를 이어감','소수 세로셈 설명 경로')
E('G34-DEC','G6-DDIVN','essential','소수 단위로 나누고 몫의 자릿값을 해석','소수 나눗셈 의미')
E('G6-FDIVN','G6-FDIVF','recommended-order','자연수 제수에서 분수 제수로 범위를 넓힘','확인한 학기배치와 쉬운 사례 우선 순서')
E('G5-FMULT','G6-FDIVF','essential','나눗셈을 곱셈으로 바꾸어 계산','역수 곱셈 방식에 한정, 모든 도식 해법의 필수는 아님')
E('G6-DDIVN','G6-DDIVD','helpful','자연수 제수로 바꾸어 계산할 기반','제수·피제수에 같은10의 거듭제곱을 곱하는 방법')
E('G5-DMULT','G6-DDIVD','helpful','동일 배율 변화와 곱셈 검산으로 확인','소수곱셈을 활용한 변환·검산')
E('C2','G6-PI','essential','지름과 반지름을 구분해 원주와 비교','원의 요소 해석')
E('C2','G6-AREA','essential','반지름을 길이로 해석해 원 넓이 계산','반지름 기반 원 넓이 식')
E('C3','G6-PI','helpful','서로 다른 원을 그려 측정·비교','원주율 탐구 활동에 한정')
E('G5-DMULT','G6-PI','application','원주율 근삿값과 지름의 곱을 계산','소수 근삿값을 사용한 수치 계산')
E('G6-DDIVN','G6-PI','application','원주를 지름으로 나눠 비슷한 값을 찾음','자연수 지름인 측정값의 나눗셈')
E('G5-AREABASE','G6-AREA','essential','길이와 넓이를 구별하고 넓이 단위 및 재구성을 사용','직사각형 유사 모양으로 재구성하는 설명 경로')
E('G5-DMULT','G6-AREA','application','반지름과 원주율 근삿값의 곱을 계산','소수 원주율을 사용하는 수치 계산')
E('G6-PI','G6-AREA','helpful','원주·원주율을 재구성한 도형의 가로 길이에 연결','원 조각을 재배열하는 넓이 설명 경로')
d=dict(version='0.1-reviewed-scope',verifiedAt='2026-10-13',scope='3-2 세 단원에 직접 관련된3~6학년만, 핵심 유형 그래프에 부착',externalNodeIds=['M1','M4','D2','D3','D5','C2','C3'],sources=[dict(id='S3',url=S3,role='2026 5~6학년2022개정 성취기준 및 학기배치 공식 예시',pages='15~17,37~38,65~66,93~95,121~124'),dict(id='S4',url=S4,role='지학사2022개정3~4학년 공식 차시자료'),dict(id='S2',url='https://www.pen.go.kr/upload/main/na/bbs_2330/ntt_1118209/doc_eaadv4ca2%3D8avba%3D4dv76%3Db4v0c%3D291bvb350v0784_v620.pdf',role='2022개정 학년군 표 PDF61·63쪽')],nodes=nodes,edges=edges,notes=['국가 성취기준은 학년군 범위, 학기배치는 확인한 공식 예시 편성이다.','간선은 모두 연구자의 교수학습 해석이며 공식 필수 선수 지정이 아니다.','약수배수는 곱셈나눗셈 활용의 별도 가지이며 모든 분수소수 계산의 필수 관문이 아니다.','원의 직접 확장은6-2이며4·5학년의 모든 도형으로 연결하지 않는다.','boundary-support는 연결 이해에 필요한 바깥 선수 일부만 표시하며 새 전체단원을 조사하는 확장이 아니다.','분수·소수의 덧셈뺄셈 전체, 비례식, 도형 전체, 통계는 포함하지 않는다.','3~6학년 연결 노드의 세부 문제유형 전수 분류는 아직 하지 않았다. 이 파일은 검증된 연결 뼈대다.'])
(p/'grade3_to_6_connections.json').write_text(json.dumps(d,ensure_ascii=False,indent=2))
print(len(nodes),'connected nodes',len(edges),'scoped edges')

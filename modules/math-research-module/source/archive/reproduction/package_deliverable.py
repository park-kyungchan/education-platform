import json,pathlib,shutil,zipfile,hashlib
root=pathlib.Path(__file__).resolve().parent
research=root.parent/'grade3_research/freudenthal'
stage=root/'deliverable'
stage.mkdir(exist_ok=True)
readme="""# 수학 연구 설계 자료집

이 자료는 초3 곱셈·나눗셈·원 및 직접 연결되는 초4–6 내용을 위한 연구자 검토용 창작 설계안입니다.

## 읽는 순서
1. research_memo.md: Freudenthal 원문 확인 범위, 전형성 작업 정의, 설계 루브릭
2. research_memo_psychology.md: 학습심리학 근거와 행동 단위 분석의 한계
3. 151_designs_review.md: 각 세부유형 문항·설계 이유·전이·경계·행동 분석
4. 영역별 *_designs.json: 모든 항목을 보존한 구조화 원고
5. validation_receipt.json: 전체 유형 및 화면 검증 결과
6. design_schema.ts, action_microsteps_schema.ts: 데이터의 의미와 구분
7. original_170_examples_and_hierarchy.json: 보존한 기존 기본·변형 문항과 탐색 구조

## 연구 해석의 경계
- 원저의 사실, 이 지도의 설계 해석, 실제 관찰 결과는 구분해야 합니다.
- 모든 문항과 행동 분석은 창작 시안입니다. 실제 학생 자료·점수·학습효과는 없습니다.
- 기대 이해·오류·효과는 가설입니다. 정답이나 교사의 설명 반복만으로 이해를 확정하지 않습니다.
- 상위 학년 연결 문항을 초3 학생에게 곧바로 요구하지 않습니다.
- 복잡한 연구자 설명 전체를 학생에게 한꺼번에 제시하지 않습니다. 행동 단위의 짧은 구간과 선수 지식 확인을 사용합니다.
- 이전 기본문항 151개와 변형 19개는 그대로 보존되어 있습니다.

폰트는 Noto Sans KR의 부분 집합을 MathExplorerKR로 이름을 바꾼 것이며, OFL 라이선스를 함께 제공합니다.
"""
(stage/'README.md').write_text(readme)
files=['research_memo.md','research_memo_psychology.md','three_design_studies.md','design_schema.ts','action_microsteps_schema.ts','sources.json','psychology_sources.json','action_microsteps_sample_division.json','multiplication_designs.json','division_designs.json','circle_designs.json','upper_designs.json','multiplication_validation.json','division_validation.json','circle_validation.json','upper_validation.json','independent_audit.json']
for name in files:
 p=research/name
 if p.exists(): shutil.copy2(p,stage/name)
shutil.copy2('/tmp/NotoSansKR-OFL.txt',stage/'FONT-LICENSE-OFL.txt')
shutil.copy2(root/'psychology_ko.json',stage/'psychology_source_summaries_ko.json')
receipt=root/'validation_receipt.json'
assert receipt.exists(),'Final validation receipt is required'
shutil.copy2(receipt,stage/receipt.name)
labels={'subtypeId':'유형 ID','status':'상태','attribution':'작성 구분','sourceIds':'출처 ID','originalExample':'기존 기본문항','revisedExample':'연구 설계 문항','prompt':'문제','answer':'정답','solution':'풀이','targetStructure':'목표 구조','generalizationDomain':'일반화 범위','phenomenonToOrganize':'조직할 현상','designRationale':'설계 이유','context':'상황','numbers':'수치','conditions':'조건','representation':'표현','contrastWithAlternative':'다른 예와 비교','expectedStrategies':'예상 전략','anticipatedErrors':'예상 오류','invariant':'불변 구조','transfer':'전이','preservedStructure':'보존 구조','boundaryCase':'경계 사례','changedCondition':'바뀐 조건','adjacentTypeContrast':'인접 유형과의 차이','guidanceSequence':'안내 질문 순서','scope':'학년 범위','prerequisites':'선수 지식','grade4_6Connection':'초4–6 연결','observationPlan':'관찰 계획','learningEffectClaim':'학습효과 구분','actionDesign':'행동 단위 분석','example':'대상 문항','skill':'선수 기능','quickCheck':'짧은 확인','ifNotReady':'준비되지 않았다면','segmentation':'구간 나누기','chunks':'행동 묶음','label':'이름','actionIds':'행동 ID','exitEvidence':'완료 판단 근거','presentationRule':'제시 원칙','microActions':'각 행동','id':'행동 ID','phase':'국면','cue':'짧은 질문·지시','observableStudentAction':'관찰할 학생 행동','expectedUnderstanding':'기대 이해(가설)','mathematicalPurpose':'수학적 목적','designIntent':'설계 의도','teacherCheck':'교사 확인','evidence':'근거','nonEvidence':'이것만으로는 부족한 근거','nextDecision':'다음 결정','likelyError':'예상 오류','scaffold':'도움','fading':'도움 줄이기','remove':'제거할 도움','readinessEvidence':'준비도 근거','restoreIf':'도움 복원 조건','separationReason':'별도 행동으로 나눈 이유','sourceId':'출처','relation':'근거 관계','applicationInference':'적용 추론','childFacingSegment':'학생 제시 구간','independentTransfer':'독립 전이','evidenceToCollect':'수집할 근거','changedFeature':'변경 특징','boundaryProbe':'경계 확인','distinguishes':'구별할 내용','interpretationLimits':'해석 한계'}
def render(value,depth=0):
 if isinstance(value,dict):
  out=[]
  for k,v in value.items():
   title=labels.get(k,k)
   if isinstance(v,(dict,list)):
    out.append('  '*depth+'- **'+title+'**\n'+render(v,depth+1))
   else: out.append('  '*depth+'- **'+title+'**: '+str(v).replace('\n','\n'+'  '*(depth+1)))
  return '\n'.join(out)
 if isinstance(value,list):
  return '\n'.join(('  '*depth+'- '+str(v)) if not isinstance(v,(dict,list)) else ('  '*depth+'- 항목 '+str(i+1)+'\n'+render(v,depth+1)) for i,v in enumerate(value))
 return str(value)
data=json.loads((root/'merged_designs.json').read_text())
doc=['# 151개 세부유형 연구 설계와 행동 분석','\n연구자 창작 시안 · 학습효과 미검증 · 학생 기록 사용 없음\n']
schema_keys=['subtypeId','status','attribution','sourceIds','originalExample','revisedExample','targetStructure','generalizationDomain','phenomenonToOrganize','designRationale','expectedStrategies','anticipatedErrors','invariant','transfer','boundaryCase','adjacentTypeContrast','guidanceSequence','scope','prerequisites','grade4_6Connection','observationPlan','learningEffectClaim','actionDesign']
for id,d in data.items():
 doc.append('\n## '+id+'\n')
 doc.append(render({k:d[k] for k in schema_keys if k in d}))
(stage/'151_designs_review.md').write_text('\n'.join(doc))
baseline=json.loads((root/'src/components/generated/MathData.ts').read_text().split('=',1)[1].strip().removesuffix(';'))
(stage/'original_170_examples_and_hierarchy.json').write_text(json.dumps(baseline,ensure_ascii=False,indent=2))
manifest={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in stage.iterdir() if p.is_file() and p.name!='file_checksums.json'}
(stage/'file_checksums.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
dest=root/'수학_151유형_연구설계_행동분석_20261013.zip'
with zipfile.ZipFile(dest,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for p in sorted(stage.iterdir()):
  if p.is_file():z.write(p,p.name)
print(dest, dest.stat().st_size)

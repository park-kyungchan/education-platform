#!/usr/bin/env python3
"""Read-only archive audit. Writes reports only under docs/review; never edits source."""
import ast, collections, hashlib, json, re
from decimal import Decimal
from fractions import Fraction
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
ARCHIVE = ROOT / 'source/archive'
OUT = ROOT / 'docs/review'
def read(path): return json.loads(path.read_text())
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def walk(obj, pointer=''):
    if isinstance(obj, dict):
        for k, v in obj.items(): yield from walk(v, pointer+'/'+str(k).replace('~','~0').replace('/','~1'))
    elif isinstance(obj, list):
        for i, v in enumerate(obj): yield from walk(v, pointer+'/'+str(i))
    else: yield pointer, obj
def objects(obj, pointer=''):
    if isinstance(obj, dict):
        yield pointer, obj
        for k,v in obj.items(): yield from objects(v,pointer+'/'+str(k))
    elif isinstance(obj,list):
        for i,v in enumerate(obj): yield from objects(v,pointer+'/'+str(i))
def duplicates(ids): return [x for x,n in collections.Counter(ids).items() if n>1]
def graph_cycles(edges):
    graph=collections.defaultdict(list)
    for source,target in edges: graph[source].append(target)
    done=set();active=[];cycles=[]
    def visit(node):
        if node in active:
            cycles.append(active[active.index(node):]+[node]); return
        if node in done:return
        active.append(node)
        for child in graph.get(node,[]):visit(child)
        active.pop();done.add(node)
    for node in list(graph):visit(node)
    return cycles
# Explicit allowlist; expressions cannot access files, import modules, or attributes.
def arithmetic(expression):
    tree=ast.parse(expression,mode='eval')
    allowed=(ast.Expression,ast.Constant,ast.BinOp,ast.UnaryOp,ast.BoolOp,ast.Compare,
             ast.List,ast.Tuple,ast.ListComp,ast.GeneratorExp,ast.comprehension,
             ast.Name,ast.Load,ast.Store,ast.Call,ast.Add,ast.Sub,ast.Mult,ast.Div,
             ast.FloorDiv,ast.Mod,ast.Pow,ast.UAdd,ast.USub,ast.Eq,ast.NotEq,
             ast.Lt,ast.LtE,ast.Gt,ast.GtE,ast.And,ast.Or)
    names={'F':Fraction,'D':Decimal,'range':range,'min':min,'max':max}
    for node in ast.walk(tree):
        if not isinstance(node,allowed): raise ValueError(type(node).__name__)
        if isinstance(node,ast.Name) and node.id not in names and node.id!='n': raise ValueError(node.id)
        if isinstance(node,ast.Call) and (not isinstance(node.func,ast.Name) or node.func.id not in names): raise ValueError('call')
        if isinstance(node,ast.Constant) and isinstance(node.value,(int,float)) and abs(node.value)>10**8: raise ValueError('magnitude')
    return eval(compile(tree,'<audited arithmetic>','eval'),{'__builtins__':{},**names},{})
def comparable(v):
    if isinstance(v,str):
        try:return Fraction(v)
        except (ValueError,ZeroDivisionError):
            try:return ast.literal_eval(v)
            except (ValueError,SyntaxError):return v
    if isinstance(v,(Decimal,float)):return Fraction(str(v))
    return v

manifest=read(ARCHIVE/'FILES.sha256.json')
actual_files={str(p.relative_to(ARCHIVE)) for p in ARCHIVE.rglob('*') if p.is_file()}
manifest_failures=[{'path':p,'expected':h,'actual':sha(ARCHIVE/p) if (ARCHIVE/p).is_file() else None} for p,h in manifest.items() if not (ARCHIVE/p).is_file() or sha(ARCHIVE/p)!=h]
base_path=ARCHIVE/'research_review/original_170_examples_and_hierarchy.json'
base=read(base_path)
details=base['details']
types=[t for d in details for t in d['types']]
variants=[v for t in types for v in t.get('variants',[])]
type_by_id={t['id']:t for t in types}
type_parent={t['id']:d['id'] for d in details for t in d['types']}
core_details=[d for d in details if d['id'].startswith(('HM','HD','HC'))]
upper_details=[d for d in details if d not in core_details]
core_ids={t['id'] for d in core_details for t in d['types']}
node_ids={n['id'] for k in ['nodes','core','upper'] for n in base[k]}
core_nodes={n['id'] for n in base['core']}
original_type_ids=core_nodes | {t['id'] for t in read(ARCHIVE/'grade3_research/upper_problem_types.json')['types']}
# Source registries: content + design principles + psychology, distinct roles.
source_ids={s['id'] for s in base['sources']}
for fname in ['grade3_research/expanded/core_detail_expansion.json','grade3_research/expanded/upper_detail_expansion.json','research_review/sources.json','research_review/psychology_sources.json']:
    source_ids.update(s['id'] for s in read(ARCHIVE/fname)['sources'])
reference_issues=[]
for k in ['nodes','core','upper']:
    local={n['id'] for n in base[k]}
    for n in base[k]:
        if n.get('parentId') and n['parentId'] not in local: reference_issues.append([k,n['id'],'parentId',n['parentId']])
for e in base['edges']:
    for field in ['source','target']:
        if e[field] not in node_ids: reference_issues.append(['edge',e['id'],field,e[field]])
for d in details:
    if d['parentContentId'] not in node_ids: reference_issues.append(['detail',d['id'],'parentContentId',d['parentContentId']])
    for t in d['types']:
        if t.get('parentId') and t['parentId']!=d['id']: reference_issues.append(['type',t['id'],'parentId',t['parentId']])
        for v in t.get('variants',[]):
            if v.get('parentId') and v['parentId']!=t['id']: reference_issues.append(['variant',v['id'],'parentId',v['parentId']])
        for rid in t.get('reusedCoreTypeIds',[]):
            if rid not in core_nodes: reference_issues.append(['type',t['id'],'reusedCoreTypeIds',rid])
for ptr,obj in objects(base):
    for ref in obj.get('originalTypeIds',[]):
        if ref not in original_type_ids: reference_issues.append(['base',ptr,'originalTypeIds',ref])
    for ref in obj.get('sourceIds',[]):
        if ref not in source_ids: reference_issues.append(['base',ptr,'sourceIds',ref])

required='subtypeId status attribution sourceIds originalExample revisedExample targetStructure generalizationDomain phenomenonToOrganize designRationale expectedStrategies anticipatedErrors invariant transfer boundaryCase adjacentTypeContrast guidanceSequence scope prerequisites observationPlan learningEffectClaim actionDesign'.split()
action_required='id phase cue observableStudentAction expectedUnderstanding mathematicalPurpose designIntent teacherCheck likelyError scaffold fading separationReason evidence childFacingSegment'.split()
designs={}; records=[]; all_actions=[]; design_issues=[]; source_snapshots=[]; groups={}
for domain in ['multiplication','division','circle','upper']:
    file=ARCHIVE/f'research_review/{domain}_designs.json'; raw=read(file)
    entries=raw.get('designs',list(raw.values()))
    groups[domain]={'types':len(entries),'microActions':sum(len(x['actionDesign']['microActions']) for x in entries)}
    original=ARCHIVE/f'grade3_research/freudenthal/{domain}_designs.json'
    source_snapshots.append({'domain':domain,'byteIdentical':file.read_bytes()==original.read_bytes(),'sha256':sha(file)})
    for i,x in enumerate(entries):
        tid=x['subtypeId']; design_pointer=f'/designs/{i}' if 'designs' in raw else '/'+tid
        records.append((str(file.relative_to(ROOT)),design_pointer,x));
        if tid in designs:design_issues.append([tid,'duplicate design ID'])
        designs[tid]=x
        for key in required:
            if key not in x or x[key] in ('',None,[],{}):design_issues.append([tid,'missing/empty',key])
        if tid not in type_by_id:design_issues.append([tid,'unknown type'])
        else:
            for key in ['prompt','answer']:
                if x['originalExample'][key]!=type_by_id[tid]['example'][key]:design_issues.append([tid,'original mismatch',key])
        if x.get('detailId') and x['detailId']!=type_parent[tid]:design_issues.append([tid,'detailId mismatch'])
        if x.get('typeId') and x['typeId']!=tid:design_issues.append([tid,'typeId mismatch'])
        if x['actionDesign']['subtypeId']!=tid:design_issues.append([tid,'action subtype mismatch'])
        for key,value in [('status','paradigmatic_design_intent_unvalidated'),('attribution','project_authored_interpretation_not_freudenthal_endorsement'),('learningEffectClaim','hypothesis_not_observed')]:
            if x[key]!=value:design_issues.append([tid,'claim mismatch',key])
        action=x['actionDesign']; mids=[m['id'] for m in action['microActions']];all_actions+=mids
        chunks=[aid for c in action['segmentation']['chunks'] for aid in c['actionIds']]
        if collections.Counter(mids)!=collections.Counter(chunks):design_issues.append([tid,'chunk coverage mismatch'])
        for child,parent in [('example','revisedExample'),('independentTransfer','transfer'),('boundaryProbe','boundaryCase')]:
            for key in ['prompt','answer']:
                if action[child][key]!=x[parent][key]:design_issues.append([tid,'task duplicate mismatch',child,key])
        for m in action['microActions']:
            if not m['id'].startswith(tid+'-A'):design_issues.append([tid,'action ID namespace',m['id']])
            for key in action_required:
                if key not in m or m[key] in ('',None,[],{}):design_issues.append([tid,m['id'],'missing/empty',key])
        for ptr,obj in objects(x):
            for ref in obj.get('sourceIds',[]):
                if ref not in source_ids:reference_issues.append([tid,ptr,'sourceIds',ref])
            if 'sourceId' in obj and obj['sourceId'] not in source_ids:reference_issues.append([tid,ptr,'sourceId',obj['sourceId']])

cap_path=ROOT/'source/capability-research/초3_105유형_능력후보_근거대응.json';cap=read(cap_path)
cap_issues=[];ability_ids={a['id'] for a in cap['abilities']};cap_type_ids=[m['typeId'] for m in cap['mapping']]
lit_ids={s['id'] for s in cap['literatureReview']['sources']}
for m in cap['mapping']:
    tid=m['typeId']
    if tid not in core_ids:cap_issues.append([tid,'not core type'])
    for field in ['structuralCandidateIds','explicitProcessProbeIds']:
        for rid in m[field]:
            if rid not in ability_ids:cap_issues.append([tid,'unknown ability',rid])
    for field,source_field in [('originalPrompt','prompt'),('originalAnswer','answer')]:
        if m[field]!=type_by_id[tid]['example'][source_field]:cap_issues.append([tid,'original mismatch',field])
    for field,actual_value in [('designTarget',designs[tid]['targetStructure']),('designPrompt',designs[tid]['revisedExample']['prompt'])]:
        if m[field]!=actual_value:cap_issues.append([tid,'design mismatch',field])
for a in cap['abilities']:
    actual_mapped={m['typeId'] for m in cap['mapping'] if a['id'] in m['structuralCandidateIds']+m['explicitProcessProbeIds']}
    if set(a['allMappedTypeIds'])!=actual_mapped or a['mappedCount']!=len(actual_mapped):cap_issues.append([a['id'],'reverse mapping mismatch'])
    for rid in a['representativeTypeIds']:
        if rid not in core_ids:cap_issues.append([a['id'],'unknown representative type',rid])
    for rid in a.get('literatureCrosswalk',{}).get('sources',[]):
        if rid not in lit_ids:cap_issues.append([a['id'],'unknown literature source',rid])

# Independently recompute persisted check expressions; do not trust saved `passed` fields.
numeric_results=[]
for file,root_pointer,obj in [(str(base_path.relative_to(ROOT)),'',base)]+records:
    for ptr,item in objects(obj,root_pointer):
        for field in ['numericChecks','arithmeticChecks']:
            for i,check in enumerate(item.get(field,[])):
                result={'file':file,'pointer':ptr+'/'+field+'/'+str(i),'check':check}
                try:
                    if isinstance(check,str):
                        parts=check.split('=');values=[arithmetic(part) for part in parts]
                        passed=all(comparable(v)==comparable(values[0]) for v in values[1:])
                        result.update(actual=[str(v) for v in values],passed=passed)
                    else:
                        actual=arithmetic(check['expression']);passed=comparable(actual)==comparable(check['expected'])
                        result.update(actual=str(actual),passed=passed)
                except Exception as e:result.update(passed=None,skipReason=str(e))
                numeric_results.append(result)

# Exact JSON equality for archived app data; never execute the TS source.
app_data_dir=ARCHIVE/'app_snapshot/src/components/generated'
def ts_json(path):
    text=path.read_text();start=text.index('=')+1
    return json.JSONDecoder().raw_decode(text[start:].lstrip())[0]
app_math_equal=ts_json(app_data_dir/'MathData.ts')==base
app_designs={};app_duplicates=[]
for file in sorted(app_data_dir.glob('ResearchDataPart*.ts')):
    part=ts_json(file)
    app_duplicates+=list(set(app_designs)&set(part));app_designs.update(part)
app_differences=[tid for tid,x in designs.items() if app_designs.get(tid)!=x]
report={
 'schemaVersion':'1.0.0','auditVersion':'2026-10-13.v1','status':'structural_audit_and_targeted_math_review_complete_not_full_math_or_pedagogy_audit',
 'method':'Independent read-only local checks; source files and archived validators were not executed or modified. Only allowlisted arithmetic expressions were recomputed.',
 'sourceIntegrity':{'actualFileCount':len(actual_files),'manifestEntryCount':len(manifest),'manifestSha256':sha(ARCHIVE/'FILES.sha256.json'),'failures':manifest_failures,'unlistedFiles':sorted(actual_files-set(manifest)),'note':'FILES.sha256.json intentionally does not hash itself.'},
 'counts':{'details':len(details),'coreDetails':len(core_details),'upperDetails':len(upper_details),'researchTypes':len(types),'coreTypes':len(core_ids),'upperTypes':len(types)-len(core_ids),'primaryOriginalExamples':len(types),'originalVariants':len(variants),'originalExamplesIncludingVariants':len(types)+len(variants),'microActions':len(all_actions),'domains':groups,'capabilityMappings':len(cap['mapping']),'capabilityCandidates':len(cap['abilities'])},
 'identityChecks':{'duplicateTypes':duplicates([x['id'] for x in types]),'duplicateVariants':duplicates([x['id'] for x in variants]),'typeVariantIdCollisions':sorted(set(type_by_id)&{v['id'] for v in variants}),'duplicateMicroActions':duplicates(all_actions),'duplicateDetails':duplicates([d['id'] for d in details]),'duplicateNodesWithinNamespaces':{k:duplicates([n['id'] for n in base[k]]) for k in ['nodes','core','upper','edges']},'missingDesignTypes':sorted(set(type_by_id)-set(designs)),'unexpectedDesignTypes':sorted(set(designs)-set(type_by_id)),'duplicateCapabilityIds':duplicates([a['id'] for a in cap['abilities']]),'duplicateCapabilityMappings':duplicates(cap_type_ids),'missingCapabilityMappings':sorted(core_ids-set(cap_type_ids))},
 'cycleChecks':{'hierarchies':{k:graph_cycles([(n['parentId'],n['id']) for n in base[k] if n.get('parentId')]) for k in ['nodes','core','upper']},'prerequisiteAndConnectionEdges':graph_cycles([(e['source'],e['target']) for e in base['edges']])},
 'referenceIssues':reference_issues,'designConsistencyIssues':design_issues,'capabilityConsistencyIssues':cap_issues,
 'replicaChecks':{'designFiles':source_snapshots,'appMathDataEqualsOriginalBundle':app_math_equal,'appDesignCount':len(app_designs),'duplicateAppDesignIds':app_duplicates,'appDesignDifferences':app_differences},
 'numericCheckReplay':{'occurrences':len(numeric_results),'passed':sum(r['passed'] is True for r in numeric_results),'failed':sum(r['passed'] is False for r in numeric_results),'skipped':sum(r['passed'] is None for r in numeric_results),'uniqueCheckDefinitions':len({json.dumps(r['check'],sort_keys=True,ensure_ascii=False) for r in numeric_results}),'failuresOrSkips':[r for r in numeric_results if r['passed'] is not True],'coverageWarning':'Persisted arithmetic checks do not validate every problem statement, diagram, answer, solution, proof, or pedagogical interpretation.'},
 'confirmedTargetedFindings':['MATH-HC11-D1-T02-001'],
 'interpretationLimits':['No student observations or personal learner data were supplied.','Learning effects, latent ability constructs, mastery inference, and causal explanations are not validated.','No claim of a full mathematical or pedagogical audit of all 151 types or 170 examples.','External literature claims, curriculum placement, diagram realization, classroom wording, and complete free-text arithmetic have not been independently validated in this local audit.','Checksums demonstrate preservation against the supplied manifest, not the truth or external authenticity of the content.'],
 'sourceHashes':{str(p.relative_to(ROOT)):sha(p) for p in [base_path,cap_path]+[ARCHIVE/f'research_review/{n}_designs.json' for n in ['multiplication','division','circle','upper']]}
}
(OUT/'source-integrity-audit.v1.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
(OUT/'numeric-check-replay.v1.json').write_text(json.dumps(numeric_results,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:report[k] for k in ['counts','identityChecks','referenceIssues','designConsistencyIssues','capabilityConsistencyIssues','replicaChecks','numericCheckReplay']},ensure_ascii=False,indent=2))

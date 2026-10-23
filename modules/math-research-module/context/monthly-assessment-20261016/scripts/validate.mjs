/** Local dataset validation, NOT a replacement for canonical harness validators. */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
export async function load() {
 const json=async n=>JSON.parse(await readFile(new URL('../'+n,import.meta.url),'utf8'));
 return {dossier:await json('dossier.json'), sources:await json('sources.json'), coverage:await json('coverage.json'), requirements:await json('requirements.json'), history:await json('history.json'), chronology:await json('chronology.json')};
}
export function validate(d) {
 const errors=[];const check=(x,m)=>{if(!x)errors.push(m)};
 const ids=new Set(d.dossier.claims.map(x=>x.key));const src=new Map(d.sources.sources.map(x=>[x.sourceKey,x]));
 check(ids.size===d.dossier.claims.length,'duplicate claim key');check(src.size===d.sources.sources.length,'duplicate source key');
 check(d.dossier.authority==='none'&&d.dossier.nativePermissionGranted===false,'authority escalation');
 check(d.coverage.completenessClaimed===false&&d.coverage.denominator===null,'unsupported completeness');
 for(const s of src.values()) {check(['user','assistant','unknown','page_summary'].includes(s.author),'invalid source author '+s.sourceKey);check(createHash('sha256').update(s.originalText).digest('hex')===s.textSha256,'source hash mismatch '+s.sourceKey);check(!/ghp_[A-Za-z0-9]{20}|-----BEGIN.*PRIVATE KEY-----/.test(s.originalText),'excluded data '+s.sourceKey);}
 const statuses=new Set(['current','superseded','proposal','historical_report','unknown','accepted_scoped']);
 for(const r of d.dossier.claims) {check(statuses.has(r.status),'invalid status '+r.key);check(r.sourceKeys.length>0,'missing citation '+r.key);for(const k of r.sourceKeys)check(src.has(k),'unresolved source '+k);if(r.basis==='user_hypothesis'||r.basis==='assistant_proposal')check(r.status==='proposal'||r.status==='superseded','proposal promoted '+r.key);}
 const ext=new Set(d.dossier.externalRecordReferences.map(x=>x.key));
 for(const r of d.dossier.relations){check(ids.has(r.from),'unresolved relation from');check(ids.has(r.to)||ext.has(r.to),'unresolved relation to');for(const s of r.sourceKeys)check(src.has(s),'uncited relation');}
 for(const g of d.dossier.hierarchy)for(const k of g.recordKeys)check(ids.has(k),'unresolved hierarchy '+k);
 for(const r of d.requirements.records)for(const s of r.sourceKeys)check(src.has(s),'requirements source');
 for(const r of d.history.claims)for(const s of r.sourceKeys)check(src.has(s),'history source');
 check(d.coverage.sourceCount===src.size,'source count mismatch');check(d.coverage.normalizedClaimCount===ids.size,'claim count mismatch');
 check(d.chronology.entries.length===src.size,'chronology count');
 const by=new Map(d.dossier.claims.map(r=>[r.key,r]));
 check(by.get('math-exam-distribution')?.status==='proposal','allocation adopted without evidence');
 check(by.get('history:ux.ancestor_only')?.status==='superseded','navigation correction lost');
 check(by.get('history:ux.siblings')?.status==='current','sibling context lost');
 check(by.get('math-palantir-user-analogy')?.status==='proposal','research hypothesis promotion');
 check(by.has('math-ontology-worked-example-24-times-3'),'worked example missing');
 for(const k of ['DATA','LOGIC','ACTION','GOVERNANCE'])check(d.dossier.ontologyArchitecture[k]!=null,'ontology layer missing '+k);
 const facts=d.requirements.records.find(r=>r.key==='math-exam-context')?.assessmentFacts;
 check(facts?.questionCount===24&&facts?.totalPoints===100&&facts?.scoreBands?.reduce((n,b)=>n+b.count,0)===facts?.questionCount&&facts?.scoreBands?.reduce((n,b)=>n+b.count*b.points,0)===facts?.totalPoints,'score arithmetic');
 const timing=d.requirements.records.find(r=>r.key==='math-exam-timing')?.timingFacts;
 check(timing?.startLocal==='15:00'&&timing?.durationMinutes===80&&timing?.sessionEndLocal==='18:00','exam timing drift');
 return errors;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const d=await load();const errors=validate(d);if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log(`PASS local dossier: ${d.dossier.claims.length} claims, ${d.sources.sources.length} sources; no mathematical/empirical acceptance inferred.`);}

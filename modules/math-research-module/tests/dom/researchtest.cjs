const {JSDOM}=require('jsdom'),fs=require('fs');
const dom=new JSDOM('<div id="root"></div>',{runScripts:'dangerously',url:'http://localhost/'}),w=dom.window;
w.eval(fs.readFileSync(require('path').join(__dirname,'../../.test-build/research-entry.js'),'utf8'));
const assert=(x,m)=>{if(!x)throw Error(m)};
const q=s=>w.document.querySelector(s);
const ids=Object.keys(w.designs);assert(ids.length===151,'151 designs');
let actions=0;
for(const id of ids){
 const d=w.designs[id];w.renderResearch(id);
 assert(q('[data-research-type]').dataset.researchType===id,'type '+id);
 assert(q('.problem-text').textContent===d.revisedExample.prompt,'prompt '+id);
 assert(w.document.querySelectorAll('.research-panel').length===5,'five panels '+id);
 assert(w.document.querySelectorAll('.research-panel[open]').length===0,'collapsed initially '+id);
 assert(q('.research-status').textContent.includes('학습효과 미검증'),'claim '+id);
 w.flush(()=>q('.me-primary').click());
 assert(q('.answer-value').textContent===d.revisedExample.answer,'answer '+id);
 assert(q('.research-problem').textContent.includes(d.designRationale.numbers),'rationale '+id);
 const bs=()=>[...w.document.querySelectorAll('.action-steps button')];
 assert(bs().length===d.actionDesign.microActions.length,'action count '+id);
 for(let i=0;i<bs().length;i++){
  w.flush(()=>bs()[i].click());const a=d.actionDesign.microActions[i];actions++;
  assert(q('.action-cue p').textContent===a.cue,'cue '+id+' '+i);
  assert(q('.action-detail').textContent.includes(a.mathematicalPurpose),'purpose '+id+' '+i);
  assert(q('.action-detail').textContent.includes(a.teacherCheck.nonEvidence),'nonEvidence '+id+' '+i);
  assert(q('.action-detail').textContent.includes(a.fading.restoreIf),'fading '+id+' '+i);
  assert(bs().filter(e=>e.getAttribute('aria-pressed')==='true').length===1,'one selected '+id+' '+i);
  assert(!q('.action-detail').textContent.includes('근거 서지 연결을 확인해야'),'source '+id+' '+i);
 }
 if(d.scope==='grade4_6_connection')assert(q('.action-explorer').textContent.includes('초3 학생에게 상위 공식이나 절차를 직접 요구하지 않습니다'),'scope '+id);
}
console.log('PASS 151 research records and '+actions+' action steps rendered with exact prompts/answers, source links, disclosure defaults, persistent step selection, and upper-grade warning.');
dom.window.close();

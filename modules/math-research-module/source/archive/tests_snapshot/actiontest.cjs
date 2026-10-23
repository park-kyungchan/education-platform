const {JSDOM}=require('jsdom'),fs=require('fs');
const dom=new JSDOM('<div id="root"></div>',{runScripts:'dangerously',url:'http://localhost/'}),w=dom.window;
w.eval(fs.readFileSync('/tmp/math-research-test/build/action-entry.js','utf8'));
const assert=(x,m)=>{if(!x)throw Error(m)};
const q=s=>w.document.querySelector(s);
const buttons=()=>[...w.document.querySelectorAll('.action-steps button')];
assert(buttons().length===w.sample.microActions.length,'all step choices remain');
for(let i=0;i<w.sample.microActions.length;i++){
 w.flush(()=>buttons()[i].click());
 const a=w.sample.microActions[i];
 assert(q('.action-cue p').textContent===a.cue,'cue '+i);
 assert(q('.action-detail').textContent.includes(a.observableStudentAction),'observable '+i);
 assert(q('.action-detail').textContent.includes(a.teacherCheck.nonEvidence),'nonEvidence '+i);
 assert(q('.action-detail').textContent.includes(a.fading.restoreIf),'restoreIf '+i);
 assert(buttons().filter(e=>e.getAttribute('aria-pressed')==='true').length===1,'single selection '+i);
 assert(buttons().length===w.sample.microActions.length,'persistent '+i);
 assert(q('.action-detail').querySelectorAll('details[open]').length===0,'details reset '+i);
 const anchors=[...q('.action-detail').querySelectorAll('a')];
 assert(anchors.length>0&&anchors.every(e=>e.href.startsWith('https://')),'verified source links '+i);
}
assert(q('.action-controls button:last-child').disabled,'final next disabled');
w.flush(()=>buttons()[0].click());
assert(q('.action-controls button:first-child').disabled,'first previous disabled');
console.log('PASS action UI: '+w.sample.microActions.length+' persistent selectable steps, all detailed fields, source links, disclosure reset and end controls.');
dom.window.close();

import {expect,test} from 'bun:test';
import {journalWireDigest,assertJournalWireQualified} from '../../src/lms/lessonJournalHttp';

const suffix='var g_param = "";\nvar g_count = 0;\n$("#daily_test_confirm").click(function(){send("/fixed",g_param+"&daily_test_no="+selected);});';
const base={functions:{onFoPrg:'function onFoPrg(){request("GET","/fixed?reqCmd=udtPrg&prg_txt="+value);}'},popupEvents:['var ciValue = "";\n'+suffix],assessmentOptions:[{field:'daily_test_radio',value:'0',label:'Not administered'}]};
test('a bfcache listener in unrelated preceding context does not change the exact save-contract fingerprint',()=>{
 const current={...base,popupEvents:['}\nwindow.addEventListener("pageshow",function(e){if(e.persisted)g_submitting=false;});\n'+suffix]};
 expect(journalWireDigest(current)).toBe(journalWireDigest(base));
});
test('handler endpoint, payload key, method, popup request and assessment changes remain distinguishable',()=>{
 const changes=[
  {...base,functions:{onFoPrg:base.functions.onFoPrg.replace('udtPrg','otherEffect')}},
  {...base,functions:{onFoPrg:base.functions.onFoPrg.replace('prg_txt','other_field')}},
  {...base,functions:{onFoPrg:base.functions.onFoPrg.replace('GET','POST')}},
  {...base,popupEvents:[base.popupEvents[0]!.replace('daily_test_no','other_assessment')]},
  {...base,assessmentOptions:[{...base.assessmentOptions[0]!,value:'1'}]},
 ];
 for(const changed of changes){expect(journalWireDigest(changed)).not.toBe(journalWireDigest(base));expect(()=>assertJournalWireQualified(journalWireDigest(changed))).toThrow('journal_mutation_wire_not_qualified');}
});
test('missing or duplicated parameter declarations and extra source scripts fail closed',()=>{
 for(const popupEvents of [[],['unbound callback'],[suffix,suffix],[suffix+'\n'+suffix]])
  expect(()=>journalWireDigest({...base,popupEvents})).toThrow('journal_popup_source_ambiguous');
});

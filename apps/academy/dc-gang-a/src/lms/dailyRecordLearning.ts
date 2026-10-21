/** Academy-owned, runtime-neutral mapping rules. Catalog presence never means assigned or incomplete. */
export interface LearningSection {sectionRef:string;label:string;basis:'source_catalog'|'printed_toc'|'teacher_report';evidenceRefs:string[]}
export interface LearningUnit {unitRef:string;code:string;title:string;kind:'minor'|'chapter_assessment'|'unknown';sections:LearningSection[];evidenceRefs:string[]}
export interface LearningBook {studentRef:string;bookRef:string;label:string;brand:string;schoolLevel:'elementary'|'middle'|null;grade:number|null;term:number|null;series:number|null;seriesKind:'numbered'|'not_applicable'|'unknown';edition:string|null;bindingState:'confirmed'|'unresolved';units:LearningUnit[];evidenceRefs:string[]}
export interface LearningCatalog {schemaVersion:'academy.learning-catalog/1';coverage:'observed_only';books:LearningBook[]}
export interface LearningEntry {bookRef:string;unitRef:string;scope:'unit'|'sections';sectionRefs:string[];activity:string;deadline:string|null}
const text=(v:unknown):v is string=>typeof v==='string'&&v.trim().length>0&&!/[\r\n\u0000-\u001f]/.test(v);
function exact(v:unknown,keys:string[]):asserts v is Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join()!==keys.sort().join())throw Error('learning_contract_invalid');}
function refs(v:unknown):asserts v is string[]{if(!Array.isArray(v)||!v.length||v.some(x=>!text(x))||new Set(v).size!==v.length)throw Error('learning_evidence_required');}
const unique=(v:string[])=>new Set(v).size===v.length;
const validDate=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
export function qualifyLearningCatalog(input:unknown):LearningCatalog{
  exact(input,['schemaVersion','coverage','books']);
  if(input.schemaVersion!=='academy.learning-catalog/1'||input.coverage!=='observed_only'||!Array.isArray(input.books))throw Error('learning_catalog_invalid');
  const books=input.books as LearningBook[];
  for(const b of books){
    exact(b,['studentRef','bookRef','label','brand','schoolLevel','grade','term','series','seriesKind','edition','bindingState','units','evidenceRefs']);
    if(![b.studentRef,b.bookRef,b.label,b.brand].every(text)||![null,'elementary','middle'].includes(b.schoolLevel)||![null,1,2,3,4,5,6].includes(b.grade)||![null,1,2].includes(b.term)||!['confirmed','unresolved'].includes(b.bindingState)||!Array.isArray(b.units))throw Error('learning_book_invalid');
    if(!['numbered','not_applicable','unknown'].includes(b.seriesKind)||(b.seriesKind==='numbered'?(!Number.isSafeInteger(b.series)||b.series!<1):b.series!==null)||(b.edition!==null&&!text(b.edition)))throw Error('learning_edition_invalid');
    if(b.schoolLevel==='middle'&&b.grade!==null&&b.grade>3)throw Error('learning_grade_invalid');
    if(b.schoolLevel==='middle'&&b.brand==='다빈치'&&(b.series!==null||b.seriesKind!=='not_applicable'))throw Error('middle_davinci_has_no_series');
    refs(b.evidenceRefs);
    for(const u of b.units){
      exact(u,['unitRef','code','title','kind','sections','evidenceRefs']);
      if(![u.unitRef,u.code,u.title].every(text)||!['minor','chapter_assessment','unknown'].includes(u.kind)||!Array.isArray(u.sections))throw Error('learning_unit_invalid');
      if(u.kind==='minor'&&!/^[1-9]\d*-[1-9]\d*$/.test(u.code))throw Error('literal_minor_code_required');
      if(u.kind==='chapter_assessment'&&!/^[1-9]\d*$/.test(u.code))throw Error('assessment_major_only');
      refs(u.evidenceRefs);
      for(const s of u.sections){exact(s,['sectionRef','label','basis','evidenceRefs']);if(!text(s.sectionRef)||!text(s.label)||!['source_catalog','printed_toc','teacher_report'].includes(s.basis))throw Error('learning_section_invalid');refs(s.evidenceRefs);}
      if(!unique(u.sections.map(s=>s.sectionRef)))throw Error('duplicate_learning_section');
    }
    if(!unique(b.units.map(u=>u.unitRef)))throw Error('duplicate_learning_unit');
  }
  if(!unique(books.map(b=>b.bookRef)))throw Error('duplicate_learning_book');
  // Detach caller objects; later mutation cannot broaden a qualified owner's catalog.
  return structuredClone(input) as unknown as LearningCatalog;
}

/** Three numbers identify a book; four identify curriculum coordinates, NEVER a series + major. */
export function resolveLearningNotation(catalog:LearningCatalog,studentRef:string,notation:string,schoolLevel?:'elementary'|'middle'){
  const m=/^(가우스 플러스|가우스|다빈치)\s+(\d+)-(\d+)-(\d+)(?:-(\d+))?$/.exec(notation.trim());
  const interview=(reasonCode:string)=>({status:'interview_required' as const,reasonCode,candidates:[] as {bookRef:string;unitRef:string|null}[]});
  if(!m)return interview('unknown_notation_ask_teacher');
  const [,brand,g,t,third,fourth]=m;
  const books=catalog.books.filter(b=>b.studentRef===studentRef&&b.bindingState==='confirmed'&&b.brand===brand&&b.grade===Number(g)&&b.term===Number(t)&&(!schoolLevel||b.schoolLevel===schoolLevel));
  const candidates=fourth===undefined?books.filter(b=>b.seriesKind==='numbered'&&b.series===Number(third)).map(b=>({bookRef:b.bookRef,unitRef:null})):
    books.flatMap(b=>b.units.filter(u=>u.kind==='minor'&&u.code===`${Number(third)}-${Number(fourth)}`).map(u=>({bookRef:b.bookRef,unitRef:u.unitRef})));
  return candidates.length===1?{status:'resolved' as const,kind:fourth===undefined?'book':'minor_unit',...candidates[0]}:
    {status:'interview_required' as const,reasonCode:candidates.length?'ambiguous_book_edition_ask_teacher':'unverified_mapping_ask_teacher',candidates};
}

export function createDailyRecordLearningReviewer(input:unknown){
  const catalog=qualifyLearningCatalog(input);
  function render(studentRef:string,inputEntries:unknown){
    if(!text(studentRef)||!Array.isArray(inputEntries)||!inputEntries.length||inputEntries.length>64)throw Error('learning_entries_required');
    const groups=new Map<string,{book:LearningBook;unit:LearningUnit;entry:LearningEntry;sections:LearningSection[]}>();
    for(const raw of inputEntries){
      exact(raw,['bookRef','unitRef','scope','sectionRefs','activity','deadline']);const e=raw as unknown as LearningEntry;
      if(!text(e.bookRef)||!text(e.unitRef)||!text(e.activity)||!['unit','sections'].includes(e.scope)||!Array.isArray(e.sectionRefs)||!unique(e.sectionRefs)||e.sectionRefs.some(s=>!text(s))||(e.scope==='sections')!==!!e.sectionRefs.length||(e.deadline!==null&&(!text(e.deadline)||!validDate(e.deadline))))throw Error('learning_entry_invalid');
      const b=catalog.books.find(b=>b.bookRef===e.bookRef&&b.studentRef===studentRef);
      if(!b||b.bindingState!=='confirmed')throw Error('student_book_binding_unverified_ask_teacher');
      const u=b.units.find(u=>u.unitRef===e.unitRef);if(!u||u.kind==='unknown')throw Error('book_unit_unverified_ask_teacher');
      const sections=e.sectionRefs.map(ref=>{const s=u.sections.find(s=>s.sectionRef===ref);if(!s)throw Error('edition_unit_section_unverified_ask_teacher');return s;});
      // Same edition + exact unit + activity + deadline only. Other tuples always start a new line.
      const key=JSON.stringify([b.bookRef,u.unitRef,e.activity,e.deadline,e.scope]);const g=groups.get(key);
      if(g){for(const s of sections)if(!g.sections.some(x=>x.sectionRef===s.sectionRef))g.sections.push(s);}
      else groups.set(key,{book:b,unit:u,entry:e,sections});
    }
    return [...groups.values()].map(({book,unit,entry,sections})=>'- '+[entry.deadline?`${entry.deadline}까지`:null,book.label,unit.kind==='chapter_assessment'?`${unit.code}단원`:unit.code,unit.title,sections.map(s=>s.label).join('·'),entry.activity].filter(Boolean).join(' ')).join('\n');
  }
  return {schemaVersion:'academy.dailyrecord-learning-review/1' as const,render,
    review(studentRef:string,value:string,entries:unknown){try{const expected=render(studentRef,entries);return {blockers:expected===value?[]:['learning_render_mismatch'],expected,coverage:'observed_only' as const};}catch(error){return {blockers:[error instanceof Error?error.message:'learning_mapping_unqualified'],expected:null,coverage:'observed_only' as const};}}
  };
}

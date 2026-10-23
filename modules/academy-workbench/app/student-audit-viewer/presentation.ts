import type {Row, Student} from './model.ts';
export type SeriesDimension = {state:'not_applicable';value:null}|{state:'known';value:string}|{state:'unknown';value:null};
export function bookIdentity(raw:string):{display:string;series:SeriesDimension;raw:string} {
 const m=/^(다빈치)\s+(\d+)-(\d+)(?:-(?:\d+|\?))?$/.exec(raw);
 if(m)return {display:`${m[1]} ${m[2]}-${m[3]}`,series:{state:'not_applicable',value:null},raw};
 const g=/^가우스\s+\d+-\d+-(\d+)$/.exec(raw);
 return {display:raw,series:g?{state:'known',value:g[1]}:{state:'unknown',value:null},raw};
}
// Numeric syllabus labels, never lexical 1-10 before 1-2. Unknown labels remain
// last in original stable order. This is display order, not prerequisite logic.
export function compareUnit(a:unknown,b:unknown):number {
 const parse=(x:unknown)=>/^\d+(?:-\d+)*$/.test(String(x))?String(x).split('-').map(Number):null;
 const x=parse(a),y=parse(b);if(!x||!y)return x?-1:y?1:0;
 for(let i=0;i<Math.min(x.length,y.length);i++)if(x[i]!==y[i])return x[i]-y[i];
 return x.length-y.length;
}
const sectionOrder=['개념백지테스트','개념 백지 테스트','개념예제','개념 예제','개념 쏙 생각 쑥','기본문제','기본 문제','필수예제','필수 예제','유형다지기','유형 다지기','실력다지기','실력쌓기','실력올리기','Daily Restudy','대단원 총괄평가'];
export function orderedSections(input:Row[]):Row[]{return input.map((row,i)=>({row,i})).sort((a,b)=>{
 const unit=compareUnit(a.row.unitLabel,b.row.unitLabel);if(unit)return unit;
 const ai=sectionOrder.indexOf(String(a.row.sectionSourceLabel)),bi=sectionOrder.indexOf(String(b.row.sectionSourceLabel));
 return (ai<0?999:ai)-(bi<0?999:bi)||Number(a.row.lessonIndex??999)-Number(b.row.lessonIndex??999)||a.i-b.i;
 }).map(x=>x.row);}
export function unitsFor(student:Student,edition:unknown):{label:string;title:string;sections:Row[]}[]{
 const groups=new Map<string,{label:string;title:string;sections:Row[]}>();
 for(const row of orderedSections(student.sections.filter(r=>r.bookEditionId===edition))){
  const key=String(row.unitLabel??'대응 미확인');let group=groups.get(key);
  if(!group){group={label:key,title:String(row.unitTitle??''),sections:[]};groups.set(key,group);}group.sections.push(row);
 }return [...groups.values()];
}

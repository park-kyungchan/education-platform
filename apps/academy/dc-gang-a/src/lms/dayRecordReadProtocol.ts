import type {AcademyReadEnvironment,DayRecordReadRequest} from './academyReadProtocol';
import {createAcademyReadPlan} from './academyReadProtocol';
import {bindDayRecordDomRow,type DayRecordColumnGroup,type DayRecordHandler,type DayRecordEventAttribute,type DayRecordSourceSignature} from './dayRecordDomBinding';
import { verifyDayRecordHeaderRows, type DayRecordHeaderCell } from './dayRecordColumnContract';
/** Trusted collector input, not a caller flag or proof created by this reader.
 * Exact reviewed header rows and column handlers are required. Unreviewed spans fail closed.
 */
export interface DayRecordColumnContract {
  contractRef:string;
  headerCells:readonly string[];
  headerRows?:readonly (readonly DayRecordHeaderCell[])[];
  dataRowsMayRemainInThead?:true;
  columnGroups:readonly DayRecordColumnGroup[];
  handlersByColumn:readonly (readonly DayRecordHandler[])[];
}
export interface DayRecordSourceRow {studentName:string;date:string;groupId:string;teacherKey:string;studentKey:string;courseKey:string;recordKey:string;membershipKey:string;fields:Record<string,string>}
export async function readDayRecordSource(request:DayRecordReadRequest,environment:AcademyReadEnvironment):Promise<DayRecordSourceRow[]> {
  if(environment.origin!=='https://dc.gang-a.kr'||environment.authenticatedTeacherVisible!==true)throw new Error('authentication_required');
  const plan=createAcademyReadPlan(request);if(plan.family!=='day_record')throw new Error('invalid_day_record_scope');request=plan.request;
  if(typeof environment.principalKey!=='string'||!/^[1-9][0-9]{0,15}$/.test(environment.principalKey)
    ||BigInt(environment.principalKey)>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('principal_binding_required');
  const parser=environment.domParser??(typeof DOMParser==='undefined'?undefined:new DOMParser());
  if(!parser)throw new Error('native_browser_dom_required');
  const columns=environment.dayRecordColumnContract;
  if(!columns)throw new Error('day_record_column_contract_required');
  if(typeof columns.contractRef!=='string'||!columns.contractRef.trim()||!Array.isArray(columns.headerCells)
    ||columns.headerCells.length<1||columns.headerCells.length>64||columns.headerCells.some(x=>typeof x!=='string'||!x.trim())
    ||!Array.isArray(columns.columnGroups)||columns.columnGroups.length!==columns.headerCells.length
    ||columns.columnGroups.some(x=>!['identity','current_progress','previous_progress','unknown'].includes(x))
    ||!Array.isArray(columns.handlersByColumn)||columns.handlersByColumn.length!==columns.headerCells.length
    ||columns.handlersByColumn.some(x=>!Array.isArray(x)||x.some(h=>typeof h!=='string')))throw new Error('day_record_column_contract_rejected');
  const output:DayRecordSourceRow[]=[];
  const seen=new Set<string>();
  const responseText=async(response:Response)=>{
    const text=await response.text();
    if(text.length>2000000||/webUserPass|세션이 만료|<input\b[^>]*\btype\s*=\s*["']password["']/i.test(text))throw new Error('day_record_authentication_or_size_rejected');
    return text;
  };
  for(const group of request.groupIds) {
    const response=await environment.fetcher('/servlet/controller.cct.tutor.DayRecordServlet',{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',
      headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'},body:new URLSearchParams({p_process:'Main',std_ymd:request.date.replaceAll('-',''),grp_seq:group}).toString(),signal:AbortSignal.timeout(20000)});
    if(!response.ok||response.redirected)throw new Error('day_record_transport_failed');
    const html=await responseText(response);
    const doc=parser.parseFromString(html,'text/html');
    if(doc.querySelector<HTMLInputElement>('[name=std_date]')?.value!==request.date
      ||doc.querySelector<HTMLSelectElement>('[name=grp_seq]')?.value!==group
      ||doc.querySelector<HTMLInputElement>('[name=teacher_pri_no]')?.value!==environment.principalKey)throw new Error('day_record_scope_conflict');
    const signatures:DayRecordSourceSignature[]=[];
    for(const script of doc.querySelectorAll('script'))for(const m of (script.textContent??'').matchAll(/function\s+(onAttn|onFoPrg|onFoHw|onFoMm|onFoStuMemo|onOpenDaysMain|onDailyReport|setDailyTest|openHomeWorkRate)\s*\(([^)]*)\)/g))
      signatures.push({handler:m[1] as DayRecordSourceSignature['handler'],parameterNames:m[2]!.split(',').map(x=>x.trim())});
    const links=[...doc.querySelectorAll('[onclick]')].filter(e=>(e.getAttribute('onclick')??'').includes('onOpenDaysMain'));
    for(const name of request.studentNames)for(const link of links.filter(e=>e.textContent?.trim()===name)) {
      let row=link.closest('tr');
      while(row){const controls=[...row.querySelectorAll('[onchange],[onfocusout],[onclick]')];
        if(['onAttn','onFoPrg','onFoHw','onFoMm'].every(h=>controls.filter(e=>['onchange','onfocusout','onclick'].some(k=>(e.getAttribute(k)??'').includes(h+'('))).length===1))break;
        row=row.parentElement?.closest('tr')??null;}
      if(!row)throw new Error('requested_row_structure_unresolved');
      const table=row.closest('table'),headers=table?.tHead?.rows;
      const headerCount=columns.headerRows?.length??1;
      const headerList=headers?[...headers]:[];
      if(columns.dataRowsMayRemainInThead&&headerList.slice(headerCount).some(extra=>extra.cells.length!==columns.headerCells.length
        ||[...extra.cells].some(cell=>cell.tagName!=='TD'||cell.colSpan!==1||cell.rowSpan!==1)))throw new Error('day_record_column_contract_rejected');
      const selectedHeaders=columns.dataRowsMayRemainInThead?headerList.slice(0,headerCount):headerList;
      const observedHeaders=selectedHeaders.map(header=>[...header.cells].map(cell=>({text:cell.textContent?.trim()??'',colSpan:cell.colSpan,rowSpan:cell.rowSpan})));
      if(!verifyDayRecordHeaderRows(observedHeaders,columns)||row.cells.length!==columns.headerCells.length
        ||[...row.cells].some(cell=>cell.colSpan!==1||cell.rowSpan!==1))throw new Error('day_record_column_contract_rejected');
      const attributes:DayRecordEventAttribute[]=[];const fields:Record<string,string>={};
      for(const element of row.querySelectorAll<HTMLElement>('[onchange],[onfocusout],[onclick]'))for(const event of ['onchange','onfocusout','onclick'] as const){
        const source=element.getAttribute(event);if(!source)continue;
        const match=/(onAttn|onFoPrg|onFoHw|onFoMm|onFoStuMemo|onOpenDaysMain|onDailyReport|setDailyTest|openHomeWorkRate)\s*\(/.exec(source);if(!match)continue;
        const handler=match[1] as DayRecordHandler;
        // The deployed view nests report/homework-rate controls in inner tables.
        // Bind to the qualified outer student-row cell, never the nearest inner td.
        const index=[...row.cells].findIndex(candidate=>candidate.contains(element));
        if(index<0||!columns.handlersByColumn[index]!.includes(handler))throw new Error('requested_row_binding_unresolved');
        const columnGroup=columns.columnGroups[index]!;
        attributes.push({event,source,columnGroup});
        const field={onFoPrg:'progress',onFoHw:'homework',onFoMm:'lessonMemo',onFoStuMemo:'persistentMemo',onAttn:'attendance'}[handler as 'onFoPrg'];
        if(field){
          if(!['INPUT','SELECT','TEXTAREA'].includes(element.tagName)||typeof (element as HTMLInputElement).value!=='string')throw new Error('day_record_field_contract_rejected');
          fields[field]=(element as HTMLInputElement).value;
        }
      }
      const binding=bindDayRecordDomRow({attributes,sourceSignatures:signatures});
      if(binding.status!=='resolved')throw new Error('requested_row_binding_unresolved');
      const target=binding.identity;
      const query=new URLSearchParams({reqCmd:'SelSglRecord',course_seq:target.course_seq,stu_pri_no:target.stu_pri_no,record_seq:target.record_seq,
        sel_grp_seq:group,tut_pri_no:environment.principalKey,cm_seq:target.cm_seq});
      const selected=await environment.fetcher('/servlet/controller.cct.tutor.CourseScheduleServlet?'+query,{method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
      if(!selected.ok||selected.redirected)throw new Error('independent_occurrence_transport_failed');
      const xml=parser.parseFromString(await responseText(selected),'text/xml');
      const records=xml.querySelectorAll('record');
      if(xml.querySelector('parsererror')||records.length!==1)throw new Error('independent_occurrence_contract_rejected');
      const values=records[0]?.textContent?.split('!');
      if(!values||values[1]!==request.date||values[2]!==target.course_seq||values[4]!==name||values[9]!==group
        ||values[10]!==target.record_seq||values[11]!==target.stu_pri_no||values[12]!==target.cm_seq)throw new Error('independent_occurrence_conflict');
      const identity=JSON.stringify([request.date,target.stu_pri_no,target.record_seq,target.cm_seq]);
      if(seen.has(identity)||output.some(x=>x.studentName===name))throw new Error('ambiguous_day_record_identity');seen.add(identity);
      output.push({studentName:name,date:request.date,groupId:group,teacherKey:environment.principalKey,studentKey:target.stu_pri_no,
        courseKey:target.course_seq,recordKey:target.record_seq,membershipKey:target.cm_seq,fields});
    }
  }
  return output.sort((a,b)=>a.studentName<b.studentName?-1:a.studentName>b.studentName?1:0);
}

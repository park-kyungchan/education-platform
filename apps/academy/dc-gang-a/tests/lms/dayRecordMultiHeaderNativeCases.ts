import { readDayRecordSource } from '../../src/lms/dayRecordReadProtocol';
import { currentDayRecordColumns } from '../../src/lms/dayRecordColumnContract';
import { DAY_RECORD_HANDLER_SIGNATURES } from '../../src/lms/dayRecordDomBinding';
/** Invented values with the qualified source header shape; no academy requests. */
export async function runDayRecordMultiHeaderNativeCase(sourceUnclosedThead=false,sourceNestedCells=false){
  const headers=currentDayRecordColumns.headerRows!.map(row=>'<tr>'+row.map(cell=>`<th colspan="${cell.colSpan}" rowspan="${cell.rowSpan}">${cell.text}</th>`).join('')+'</tr>').join('');
  const core=(name:string)=>`${name}(0,71001,91001,41001,81001)`;
  const cells=['<a onclick="onOpenDaysMain(91001)">Invented Learner</a>','Invented course','<textarea onfocusout="onFoStuMemo(0,91001,71001)">Invented persistent note</textarea>','2090-01-01','Invented previous progress','<a onclick="openHomeWorkRate(41000,81000,2)">80</a>','Invented previous memo','<a onclick="onDailyReport(51001,91001,41001,81001)">Report</a>',`<select onchange="${core('onAttn')}"><option selected>Y</option></select>`,'<a onclick="setDailyTest(41001,81001,3)">80</a>',`<input value="Invented current progress" onfocusout="${core('onFoPrg')}">`,`<input value="Invented homework" onfocusout="${core('onFoHw')}">`,`<textarea onfocusout="${core('onFoMm')}">Invented lesson memo</textarea>`];
  const signatures=Object.entries(DAY_RECORD_HANDLER_SIGNATURES).map(([name,args])=>`function ${name}(${args.join(',')}) {}`).join('\n');
  const dataRow='<tr>'+cells.map((cell,index)=>'<td>'+(sourceNestedCells&&[5,7].includes(index)?'<table><tr><td>'+cell+'</td></tr></table>':cell)+'</td>').join('')+'</tr>';
  const table=sourceUnclosedThead?`<table><thead>${headers}${dataRow}</table>`:`<table><thead>${headers}</thead><tbody>${dataRow}</tbody></table>`;
  const html=`<input name="std_date" value="2090-01-02"><input name="teacher_pri_no" value="11001"><select name="grp_seq"><option value="21001" selected>Invented group</option></select><script>${signatures}</script>${table}`;
  let requests=0;
  const rows=await readDayRecordSource({family:'day_record',teacherLabel:'Invented Teacher',date:'2090-01-02',groupIds:['21001'],studentNames:['Invented Learner']},{origin:'https://dc.gang-a.kr',authenticatedTeacherVisible:true,principalKey:'11001',dayRecordColumnContract:currentDayRecordColumns,fetcher:async(_url,init)=>{requests++;return new Response(init.method==='POST'?html:'<root><record>0!2090-01-02!71001!0!Invented Learner!0!0!0!0!21001!41001!91001!81001</record></root>');}});
  if(rows.length!==1||rows[0]!.fields.progress!=='Invented current progress'||rows[0]!.fields.homework!=='Invented homework'||requests!==2)throw Error('multi_header_native_case_failed');
  return {pass:true,synthetic:true,requests,academyRequests:0};
}

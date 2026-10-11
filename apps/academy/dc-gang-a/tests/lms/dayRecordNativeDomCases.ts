import {createAcademyReadPlan,executeAcademyRead,type AcademyReadResult} from '../../src/lms/academyReadProtocol';
import {DAY_RECORD_HANDLER_SIGNATURES} from '../../src/lms/dayRecordDomBinding';

/** Synthetic source responses in a REAL native browser DOM; no live academy request. */
export async function runNativeDayRecordRegression() {
  const request={family:'day_record',teacherLabel:'Invented Teacher',date:'2099-01-01',groupIds:['3'],studentNames:['Invented Student']};
  const signatures=Object.entries(DAY_RECORD_HANDLER_SIGNATURES).map(([name,args])=>`function ${name}(${args.join(',')}) {}`).join('\n');
  const tuple="'0','6101','9101','7101','5101'";
  const headerCells=['Synthetic student','Synthetic current attendance','Synthetic current progress','Synthetic current homework','Synthetic current memo','Synthetic student memo'];
  const columnContract={contractRef:'synthetic:dayrecord:headers:v1',headerCells,
    columnGroups:['identity','current_progress','current_progress','current_progress','current_progress','identity'] as const,
    handlersByColumn:[['onOpenDaysMain'],['onAttn'],['onFoPrg'],['onFoHw'],['onFoMm'],['onFoStuMemo']] as const};
  const html=(principal:string,invalidValue=false,headerDrift=false,swappedColumn=false)=>`<input name="std_date" value="2099-01-01"><select name="grp_seq"><option selected value="3">Synthetic group</option></select><input name="teacher_pri_no" value="${principal}"><script>${signatures}</script><table><thead><tr>${headerCells.map((name,i)=>`<th>${headerDrift&&i===2?'Unreviewed previous progress':name}</th>`).join('')}</tr></thead><tbody><tr><td><a onclick="onOpenDaysMain('9101')">Invented Student</a>${swappedColumn?`<input onfocusout="onFoPrg(${tuple})" value="Wrong column">`:''}</td><td><select onchange="onAttn(${tuple})"><option selected value="Y">Synthetic attendance</option></select></td><td>${invalidValue?`<span onfocusout="onFoPrg(${tuple})">No value</span>`:swappedColumn?'':`<input onfocusout="onFoPrg(${tuple})" value="Synthetic progress">`}</td><td><input onfocusout="onFoHw(${tuple})" value="Synthetic homework"></td><td><input onfocusout="onFoMm(${tuple})" value="Synthetic memo"></td><td><input onfocusout="onFoStuMemo('0','9101','6101')" value=""></td></tr></tbody></table>`;
  const values=Array<string>(13).fill('');
  values[1]='2099-01-01';values[2]='6101';values[4]='Invented Student';values[9]='3';values[10]='7101';values[11]='9101';values[12]='5101';
  const record=(v=values)=>`<record>${v.join('!')}</record>`;
  const cases:[string,{principal?:string,invalidValue?:boolean,xml?:string,missingContract?:boolean,headerDrift?:boolean,swappedColumn?:boolean},string|null][]=[
    ['one_matching_record',{principal:'1101',xml:`<root>${record()}</root>`},null],
    ['canonical_single_digit_principal',{principal:'1',xml:`<root>${record()}</root>`},null],
    ['unsafe_principal_before_transport',{principal:'9007199254740992'},'principal_binding_required'],
    ['non_value_control',{principal:'1101',invalidValue:true},'day_record_field_contract_rejected'],
    ['two_selected_records',{xml:`<root>${record()}${record()}</root>`},'independent_occurrence_contract_rejected'],
    ['malformed_selected_xml',{xml:'<root><record>'},'independent_occurrence_contract_rejected'],
    ['oversized_selected_xml',{xml:`<root>${' '.repeat(2000001)}${record()}</root>`},'day_record_authentication_or_size_rejected'],
    ['authentication_marker',{xml:`<root>세션이 만료${record()}</root>`},'day_record_authentication_or_size_rejected'],
    ['date_conflict',{xml:`<root>${record(values.map((v,i)=>i===1?'2099-01-02':v))}</root>`},'independent_occurrence_conflict'],
    ['missing_column_contract',{missingContract:true},'day_record_column_contract_required'],
    ['header_drift',{headerDrift:true},'day_record_column_contract_rejected'],
    ['handler_in_wrong_column',{swappedColumn:true},'requested_row_binding_unresolved'],
  ];
  const results=[];
  for(const [id,options,expectedError] of cases) {
    const principal=options.principal??'1101';let calls=0;let observedError:string|null=null;let result:AcademyReadResult|null=null;
    try {
      result=await executeAcademyRead(createAcademyReadPlan(request),{origin:'https://dc.gang-a.kr',authenticatedTeacherVisible:true,principalKey:principal,
        ...(!options.missingContract?{dayRecordColumnContract:columnContract}:{}),
        fetcher:async(url,init)=>{calls++;if(calls===1){if(url!=='/servlet/controller.cct.tutor.DayRecordServlet'||init.method!=='POST')throw Error('synthetic_transport_contract');return new Response(html(principal,options.invalidValue,options.headerDrift,options.swappedColumn));}
          if(calls===2){if(!url.startsWith('/servlet/controller.cct.tutor.CourseScheduleServlet?')||init.method!=='GET')throw Error('synthetic_transport_contract');return new Response(options.xml??`<root>${record()}</root>`);}throw Error('unexpected_synthetic_request');}});
    }catch(e){observedError=e instanceof Error?e.message:'untyped_error';}
    const positive=expectedError===null&&result?.status==='observed'&&result.dayRecords.length===1&&result.dayRecords[0]!.fields.progress==='Synthetic progress'&&calls===2;
    const negative=expectedError!==null&&observedError===expectedError&&(!['unsafe_principal_before_transport','missing_column_contract'].includes(id)||calls===0)&&(!['non_value_control','header_drift','handler_in_wrong_column'].includes(id)||calls===1);
    results.push({id,pass:positive||negative,expectedError,observedError,transportCalls:calls,status:result?.status??null});
  }
  return {schemaVersion:1,kind:'synthetic_native_dom_regression',nativeDomPresent:typeof DOMParser!=='undefined',actualAcademyNetworkRequests:0,sourceHeaderLayoutEstablished:false,results};
}

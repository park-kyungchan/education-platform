import type { DayRecordColumnContract } from './dayRecordReadProtocol';
export interface DayRecordHeaderCell { readonly text:string; readonly colSpan:number; readonly rowSpan:number }
const normalize=(value:string)=>value.replace(/\s+/g,' ').trim();
/** Qualified from two real date/group views; not an academy write contract. */
export const currentDayRecordColumns:DayRecordColumnContract={
  contractRef:'docs/academy-dayrecord-column-qualification-2026-10-04.json',
  dataRowsMayRemainInThead:true,
  headerCells:['이름','과정','지속사항','지난수업일','진도','숙제','메모','일괄 발송 금일진도','금일출석','일일테스트','진도','숙제','메모'],
  headerRows:[
    [{text:'이름',colSpan:1,rowSpan:2},{text:'과정',colSpan:1,rowSpan:2},{text:'지속사항',colSpan:1,rowSpan:2},{text:'지난진도',colSpan:4,rowSpan:1},{text:'일괄 발송 금일진도',colSpan:6,rowSpan:1}],
    [{text:'지난수업일',colSpan:1,rowSpan:1},{text:'진도',colSpan:1,rowSpan:1},{text:'숙제',colSpan:1,rowSpan:1},{text:'메모',colSpan:1,rowSpan:1},{text:'',colSpan:1,rowSpan:1},{text:'금일출석',colSpan:1,rowSpan:1},{text:'일일테스트',colSpan:1,rowSpan:1},{text:'진도',colSpan:1,rowSpan:1},{text:'숙제',colSpan:1,rowSpan:1},{text:'메모',colSpan:1,rowSpan:1}],
  ],
  columnGroups:['identity','identity','identity','previous_progress','previous_progress','previous_progress','previous_progress','current_progress','current_progress','current_progress','current_progress','current_progress','current_progress'],
  handlersByColumn:[['onOpenDaysMain'],[],['onFoStuMemo'],[],[],['openHomeWorkRate'],[],['onDailyReport'],['onAttn'],['setDailyTest'],['onFoPrg'],['onFoHw'],['onFoMm']],
};
export function verifyDayRecordHeaderRows(observed:readonly (readonly DayRecordHeaderCell[])[],contract:DayRecordColumnContract):boolean {
  const expected=contract.headerRows??[contract.headerCells.map(text=>({text,colSpan:1,rowSpan:1}))];
  if(observed.length!==expected.length)return false;
  return observed.every((row,r)=>row.length===expected[r]!.length&&row.every((cell,c)=>{
    const target=expected[r]![c]!;
    return cell.colSpan===target.colSpan&&cell.rowSpan===target.rowSpan&&normalize(cell.text)===normalize(target.text);
  }));
}

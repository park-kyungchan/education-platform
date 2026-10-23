import {createHash} from 'node:crypto';
import {assertDate} from '../learning/model';

type ParseDocument=(raw:string,mime:DOMParserSupportedType)=>Document;
const normalize=(value:string)=>value.replace(/\s+/g,' ').trim();
const groupKey=(value:string)=>value===''||/^(?:0|[1-9][0-9]{0,19})$/.test(value);

/** Exact DayRecord selector metadata only; no student rows, handlers or principal values. */
export function inspectDayRecordGroupMetadata(raw:string,parseDocument:ParseDocument,expectedDate:string){
  assertDate(expectedDate);
  if(typeof raw!=='string'||Buffer.byteLength(raw)>2_000_000)throw Error('day_record_group_source_size_rejected');
  const doc=parseDocument(raw,'text/html');
  if(doc.querySelector('input[type=password],form[name=loginForm]')||/webUserPass|세션이 만료/.test(raw))throw Error('day_record_group_authentication_required');
  const controls=[...doc.querySelectorAll<HTMLInputElement>('input[name=std_ymd]')];
  let returnedDate:string|null=null;
  if(controls.length===1){
    const value=controls[0]!.value;
    const candidate=/^\d{8}$/.test(value)?`${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}`:value;
    try{assertDate(candidate);returnedDate=candidate;}catch{/* An unqualified source date remains unknown. */}
  }
  const nodes=[...doc.querySelectorAll<HTMLSelectElement>('select[name=grp_seq]')];
  if(nodes.length>4)throw Error('day_record_group_selector_limit');
  const selectors=nodes.map(node=>{
    const optionNodes=[...node.querySelectorAll<HTMLOptionElement>('option')];
    if(optionNodes.length>100)throw Error('day_record_group_option_limit');
    const options=optionNodes.map(option=>{
      const value=option.value,label=normalize(option.textContent??'');
      if(!groupKey(value)||label.length>100||/[\x00-\x1f]/.test(label))throw Error('day_record_group_option_rejected');
      return {value,label};
    });
    if(new Set(options.map(option=>option.value)).size!==options.length)throw Error('day_record_group_duplicate_option');
    return {name:'grp_seq' as const,options};
  });
  return {sourceSha256:createHash('sha256').update(raw,'utf8').digest('hex'),returnedDate,
    dateMatches:returnedDate===expectedDate,selectors,
    groupSelectorQualified:selectors.length===1&&selectors[0]!.options.some(option=>/^[1-9]/.test(option.value))};
}

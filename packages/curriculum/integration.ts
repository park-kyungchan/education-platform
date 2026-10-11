/** Source-aware integration facade. UI exports never substitute for missing canonical workpacks. */
export interface RequiredCurriculumSource {name:string;workpackId?:string;workpackRevision?:number;workpackSha256?:string;expectedHash?:string}
export interface CurriculumSourceStatus {status:'not_available_in_this_ui_export';required:RequiredCurriculumSource[];canonicalReady:false;authority:'none'}
export async function inspectCurriculumSources():Promise<CurriculumSourceStatus>{
 const input=await Bun.file(new URL('./canonical/required-sources.json',import.meta.url)).json() as {status:string;files:RequiredCurriculumSource[]};
 if(input.status!=='not_available_in_this_ui_export'||!Array.isArray(input.files))throw Error('unexpected_curriculum_source_status');
 for(const row of input.files)if(row.workpackId&&(!/^[a-f0-9]{64}$/.test(row.workpackSha256??'')||!Number.isInteger(row.workpackRevision)))throw Error('invalid_curriculum_source');
 return {status:input.status,required:input.files.map(row=>({...row})),canonicalReady:false,authority:'none'};
}

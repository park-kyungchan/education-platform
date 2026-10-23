import {createHash} from 'node:crypto';
import {z} from 'zod';

export const poolQuestionContentInputSchema=z.object({
  hierarchyId:z.string().min(1).max(1024),labelId:z.string().min(1).max(1024),
  lectureKey:z.string().regex(/^[1-9][0-9]{0,8}$/),variant:z.enum(['obj','sbj','des']),
  purpose:z.literal('teacher_requested_review'),
}).strict();
export type PoolImageTransport=(url:string,init:RequestInit)=>Promise<Response>;
export const maximumPoolImageBytes=8*1024*1024;

function pngCrc32(bytes:Uint8Array){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
/** Container validation is distinct from a renderer or analyst inspecting the actual mathematical image. */
function inspectPngContainer(image:Buffer){
  if(image.length<57||!image.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('pool_content_png_signature_invalid');
  let offset=8,width=0,height=0,seenHeader=false,seenData=false,endedData=false,seenEnd=false,dataBytes=0;
  while(offset<image.length){
    if(image.length-offset<12)throw Error('pool_content_png_container_invalid');
    const length=image.readUInt32BE(offset),type=image.toString('ascii',offset+4,offset+8);
    if(!/^[A-Za-z]{4}$/.test(type)||length>image.length-offset-12)throw Error('pool_content_png_container_invalid');
    const end=offset+12+length;
    if(pngCrc32(image.subarray(offset+4,end-4))!==image.readUInt32BE(end-4))throw Error('pool_content_png_crc_invalid');
    if(!seenHeader&&type!=='IHDR')throw Error('pool_content_png_container_invalid');
    if(type==='IHDR'){
      if(seenHeader||length!==13)throw Error('pool_content_png_container_invalid');
      seenHeader=true;width=image.readUInt32BE(offset+8);height=image.readUInt32BE(offset+12);
      const depth=image[offset+16]!,color=image[offset+17]!,depths:Record<number,number[]>={0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]};
      if(!depths[color]?.includes(depth)||image[offset+18]!==0||image[offset+19]!==0||image[offset+20]!>1)throw Error('pool_content_png_container_invalid');
      if(!width||!height||width>10000||height>10000||width*height>32000000)throw Error('pool_content_dimensions_limit');
    }else if(type==='IDAT'){
      if(endedData)throw Error('pool_content_png_container_invalid');seenData=true;dataBytes+=length;
    }else if(type==='IEND'){
      if(length!==0||!seenData||!dataBytes||end!==image.length)throw Error('pool_content_png_container_invalid');seenEnd=true;
    }else{
      if(seenData)endedData=true;
      if(type==='PLTE'){if(seenData||!length||length%3||length>768)throw Error('pool_content_png_container_invalid');}
      else if(type[0]===type[0]!.toUpperCase())throw Error('pool_content_png_unsupported_critical_chunk');
    }
    offset=end;
  }
  if(!seenHeader||!seenData||!seenEnd)throw Error('pool_content_png_container_invalid');
  return {width,height};
}

/** Fetch only a previously exposed, source-qualified image. Variant names do not establish content roles. */
export async function readPoolQuestionImage(reference:{url:string;type:'obj'|'sbj'|'des'},lectureKey:string,transport:PoolImageTransport=fetch){
  if(!/^[1-9][0-9]{0,8}$/.test(lectureKey))throw Error('pool_content_question_identity_invalid');
  const key=Number(lectureKey),d6=String(Math.floor(key/1000000)).padStart(3,'0'),d4=String(Math.floor(key%1000000/10000)).padStart(2,'0'),d2=String(Math.floor(key%10000/100)).padStart(2,'0');
  const expected=`https://storage.studyq.net/data/contents/exam/d6-${d6}/d4-${d4}/d2-${d2}/ek-${lectureKey}/${lectureKey}-examcard-${reference.type}.png`;
  if(reference.url!==expected)throw Error('pool_content_exact_source_reference_required');
  const response=await transport(reference.url,{method:'GET',redirect:'error',credentials:'omit',headers:{Accept:'image/png'},signal:AbortSignal.timeout(20000)});
  if(!response.ok||response.redirected)throw Error('pool_content_source_unavailable');
  if(response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()!=='image/png')throw Error('pool_content_png_required');
  const length=response.headers.get('content-length');
  if(length!==null&&(!/^\d+$/.test(length)||Number(length)>maximumPoolImageBytes))throw Error('pool_content_size_limit');
  if(!response.body)throw Error('pool_content_body_missing');
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];let bytes=0;
  try{while(true){const next=await reader.read();if(next.done)break;bytes+=next.value.byteLength;if(bytes>maximumPoolImageBytes){await reader.cancel();throw Error('pool_content_size_limit');}chunks.push(next.value);}}finally{reader.releaseLock();}
  const image=Buffer.concat(chunks);
  const {width,height}=inspectPngContainer(image);
  return {metadata:{status:'available',lectureKey,variant:reference.type,url:reference.url,mimeType:'image/png',bytes:image.length,width,height,
    sha256:createHash('sha256').update(image).digest('hex'),observedAt:new Date().toISOString(),contentRole:'source_variant_role_not_inferred',
    pngValidation:'signature_chunk_integrity_dimensions_not_pixel_or_mathematical_review',sourceContentInspectedByAnalyst:false,officialSolutionAvailability:'not_established_by_variant_name',credentialsForwarded:false,academyWrites:0,finalItemMembershipCreated:false},
    image:{type:'image' as const,data:image.toString('base64'),mimeType:'image/png'}};
}

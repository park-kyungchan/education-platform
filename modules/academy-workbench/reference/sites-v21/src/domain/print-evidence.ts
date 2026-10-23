/** Browser-local marks, physical print, handover and server history are independent observations. */
export interface PrintEvidence {
 studentId:string;printInstanceId:string;
 cachedPrintMark:{state:'marked'|'unmarked'|'unknown';observedAt:string|null;source:'browser_local_indexeddb';evidenceIds:readonly string[]};
 actualPrinted:{state:'confirmed'|'not_printed'|'unknown';evidenceIds:readonly string[]};
 physicalDistribution:{state:'confirmed'|'not_distributed'|'unknown';evidenceIds:readonly string[]};
 serverPrintHistory:{state:'verified'|'unverified';evidenceIds:readonly string[]};
}
export function projectPrintEvidence(e:PrintEvidence){
 if(!e||typeof e.studentId!=='string'||!e.studentId.trim()||typeof e.printInstanceId!=='string'||!e.printInstanceId.trim())throw Error('missing_print_instance');
 if(!e.cachedPrintMark||!e.actualPrinted||!e.physicalDistribution||!e.serverPrintHistory||!['marked','unmarked','unknown'].includes(e.cachedPrintMark.state)||e.cachedPrintMark.source!=='browser_local_indexeddb'||!['confirmed','not_printed','unknown'].includes(e.actualPrinted.state)||!['confirmed','not_distributed','unknown'].includes(e.physicalDistribution.state)||!['verified','unverified'].includes(e.serverPrintHistory.state)||[e.cachedPrintMark,e.actualPrinted,e.physicalDistribution,e.serverPrintHistory].some(x=>!Array.isArray(x.evidenceIds)||x.evidenceIds.some(id=>typeof id!=='string'||!id.trim())))throw Error('invalid_print_observation');
 if(e.cachedPrintMark.state!=='unknown'&&!e.cachedPrintMark.evidenceIds.length||e.actualPrinted.state!=='unknown'&&!e.actualPrinted.evidenceIds.length||e.physicalDistribution.state!=='unknown'&&!e.physicalDistribution.evidenceIds.length||e.serverPrintHistory.state==='verified'&&!e.serverPrintHistory.evidenceIds.length)throw Error('unsupported_print_observation');
 return {...structuredClone(e),printedChecked:e.actualPrinted.state==='confirmed',distributedChecked:e.physicalDistribution.state==='confirmed',serverRetentionDays:null,localMarkIsPhysicalPrintProof:false as const};
}

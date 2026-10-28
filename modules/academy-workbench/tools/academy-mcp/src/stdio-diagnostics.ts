import {Transform} from 'node:stream';
import {StdioServerTransport} from '@modelcontextprotocol/server/stdio';
/** Diagnostics never include a frame, exception, ID or body; capped per process. */
function diagnosticEmitter(emit:(text:string)=>unknown){
  let count=0;
  return ()=>{if(count++<16)emit(JSON.stringify({code:'mcp_stdio_input_or_transport_invalid',category:'protocol',
    evidenceLocator:'src/stdio-diagnostics.ts:createAcademyStdioTransport',automaticRetryAllowed:false})+'\n');};
}
export function installStdioDiagnostics(server:{onerror?:(error:Error)=>void},emit:(text:string)=>unknown=text=>process.stderr.write(text)){
  server.onerror=diagnosticEmitter(emit);
}
/** SDK 2.3.1 ReadBuffer silently discards SyntaxError lines. This module-local
 * bounded framing adapter reports them before forwarding valid JSON unchanged
 * to the SDK's JSON-RPC schema/dispatch. It does not change the shared SDK. */
export function createAcademyStdioTransport(){
  const report=diagnosticEmitter(text=>process.stderr.write(text)),limit=1024*1024;
  let pending=Buffer.alloc(0);
  const input=new Transform({transform(chunk:Buffer,_encoding,callback){
    pending=Buffer.concat([pending,chunk]);
    let newline:number;
    while((newline=pending.indexOf(10))>=0){
      const line=pending.subarray(0,newline+1);pending=pending.subarray(newline+1);
      if(line.length>limit){report();callback(Error('mcp_stdio_frame_too_large'));return;}
      try{JSON.parse(line.toString('utf8'));}catch{report();continue;}
      this.push(line);
    }
    if(pending.length>limit){pending=Buffer.alloc(0);report();callback(Error('mcp_stdio_frame_too_large'));return;}
    callback();
  },flush(callback){if(pending.length){report();pending=Buffer.alloc(0);}callback();}});
  process.stdin.pipe(input);
  return new StdioServerTransport(input,process.stdout,{maxBufferSize:limit});
}

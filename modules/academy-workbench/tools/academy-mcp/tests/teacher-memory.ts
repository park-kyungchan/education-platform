import {Client} from '@modelcontextprotocol/client';
import {InMemoryTransport,serializeMessage,deserializeMessage} from '@modelcontextprotocol/server';
import {createTeacherServer,type TeacherServerConfiguration} from '../src/teacher-server.ts';

/** Actual SDK transports, instrumented through public send methods and the installed wire codec. */
export async function teacherMemory(configuration:TeacherServerConfiguration){
  const server=await createTeacherServer(configuration);
  const client=new Client({name:'invented-response-contract-check',version:'1.0.0'});
  const [clientTransport,serverTransport]=InMemoryTransport.createLinkedPair();
  const results:{resultBytes:number;frameBytes:number}[]=[];
  for(const [transport,direction] of [[clientTransport,'request'],[serverTransport,'response']] as const){
    const send=transport.send.bind(transport);
    transport.send=async(message,options)=>{
      const frame=serializeMessage(message),decoded=deserializeMessage(frame);
      if(direction==='response'&&'result' in decoded&&decoded.result&&'content' in decoded.result){
        results.push({resultBytes:Buffer.byteLength(JSON.stringify(decoded.result)),frameBytes:Buffer.byteLength(frame)});
      }
      await send(decoded,options);
    };
  }
  try{await server.connect(serverTransport);await client.connect(clientTransport);}
  catch(error){await client.close();await server.close();throw error;}
  return {client,results,close:async()=>{await client.close();await server.close();}};
}

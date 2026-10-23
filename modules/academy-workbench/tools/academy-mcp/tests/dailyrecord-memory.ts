import {Client} from '@modelcontextprotocol/client';
import {McpServer,InMemoryTransport,serializeMessage,deserializeMessage} from '@modelcontextprotocol/server';
import {DailyRecordService,type DailyRecordReadBackend} from '../src/dailyrecord.ts';
import {registerDailyRecordTools} from '../src/dailyrecord-tools.ts';

/** Same service/registration composition as dailyrecord-server.ts, on the actual SDK/wire.
 * Owner configuration and all source I/O are supplied by fictional test ports only. */
export async function dailyRecordMemory(backend:DailyRecordReadBackend){
  const server=new McpServer({name:'invented-dailyrecord-caller',version:'1.0.0'});
  const service=new DailyRecordService(backend);
  registerDailyRecordTools(server,service);
  const client=new Client({name:'invented-metadata-verifier',version:'1.0.0'});
  const [clientTransport,serverTransport]=InMemoryTransport.createLinkedPair();
  for(const transport of [clientTransport,serverTransport]){
    const send=transport.send.bind(transport);
    transport.send=(message,options)=>send(deserializeMessage(serializeMessage(message)),options);
  }
  try{await server.connect(serverTransport);await client.connect(clientTransport);}
  catch(error){await client.close();await server.close();throw error;}
  return {client,service,close:async()=>{await client.close();await server.close();}};
}

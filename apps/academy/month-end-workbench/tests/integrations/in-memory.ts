import {Client} from '@modelcontextprotocol/client';
import type {McpServer} from '@modelcontextprotocol/server';

type Transport=Parameters<Client['connect']>[0];
type Message=Parameters<Transport['send']>[0];
/** Test-only paired SDK transport: messages never leave this process. */
function pair():[Transport,Transport]{
  const queues:Message[][]=[[],[]],started=[false,false],closed=[false,false];
  const ends=[0,1].map(index=>({
    async start(){if(closed[index])throw Error('synthetic_transport_closed');started[index]=true;for(const message of queues[index]!.splice(0))queueMicrotask(()=>ends[index]!.onmessage?.(message));},
    async send(message:Message){const peer=1-index;if(closed[index]||closed[peer])throw Error('synthetic_transport_closed');const value=structuredClone(message);if(started[peer])queueMicrotask(()=>ends[peer]!.onmessage?.(value));else queues[peer]!.push(value);},
    async close(){if(closed[index])return;closed[index]=true;queues[index]!.length=0;ends[index]!.onclose?.();const peer=1-index;if(!closed[peer]){closed[peer]=true;queues[peer]!.length=0;ends[peer]!.onclose?.();}},
    onmessage:undefined as Transport['onmessage'],onclose:undefined as Transport['onclose'],onerror:undefined as Transport['onerror'],
  }));
  return [ends[0]!,ends[1]!];
}
export async function connectSyntheticServer(server:McpServer){
  const [clientTransport,serverTransport]=pair();
  const client=new Client({name:'in-process-source-qa',version:'1'});
  await server.connect(serverTransport);await client.connect(clientTransport);
  return {client,async close(){await client.close();await server.close();}};
}

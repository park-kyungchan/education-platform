import './network-deny.ts';
import {McpServer} from '@modelcontextprotocol/server';
import {StdioServerTransport} from '@modelcontextprotocol/server/stdio';
import {registerItemLabelTools} from '../src/item-label-tools.ts';
import {registerDailyRecordTools} from '../src/dailyrecord-tools.ts';
const server=new McpServer({name:'fictional-saved-endpoint',version:'1.0.0'});
registerItemLabelTools(server,null);
registerDailyRecordTools(server);
await server.connect(new StdioServerTransport());

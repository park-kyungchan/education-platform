import {McpServer} from '@modelcontextprotocol/server';
import {StdioServerTransport} from '@modelcontextprotocol/server/stdio';
import {loadItemLabelIndex} from './item-label-store.ts';
import {loadNativePoolBackend} from './native-pool-backend.ts';
import {registerItemLabelTools} from './item-label-tools.ts';
import {registerPoolEvidenceTools} from './pool-tools.ts';
import {loadOperatorPoolBackend} from './native-pool-socket.ts';

// A dedicated question-pool entry point. It never initializes student, DailyRecord or CISM services.
const args=process.argv.slice(2);
const backend=args[0]==='--operator-socket'?await loadOperatorPoolBackend(args):args[0]==='--native-bridge'?await loadNativePoolBackend(args):await loadItemLabelIndex(args);
const server=new McpServer({name:'academy-question-pool',version:'0.2.0'});
registerItemLabelTools(server,backend);
registerPoolEvidenceTools(server,backend);
await server.connect(new StdioServerTransport());

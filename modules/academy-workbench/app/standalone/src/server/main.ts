import {loadConfig,loadConfiguredSecret} from './auth.ts';
import {Store} from './storage.ts';
import {createApplication} from './http.ts';
import {makeSyntheticDataset} from '../../fixtures/dataset.ts';
const config=loadConfig();
// Secret configuration is never discovered automatically or created here.
const secret=loadConfiguredSecret(config),store=new Store(config.dbPath);
if(config.authMode==='loopback-preview')store.importDataset(makeSyntheticDataset(),{ownerId:config.ownerId,allowPrivate:false});
const server=createApplication(config,store,secret);
server.listen(config.port,config.host,()=>console.log(JSON.stringify({status:'listening',url:`http://${config.host==='::1'?'[::1]':config.host}:${config.port}`,mode:config.authMode,sourceConnected:false})));
function close(){server.close(()=>{store.close();process.exit(0);});}
process.on('SIGINT',close);process.on('SIGTERM',close);

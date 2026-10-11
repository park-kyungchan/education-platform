import config from './generated/worker-config.ts';
import {createWorker} from './worker-handler.ts';
export default createWorker(config);

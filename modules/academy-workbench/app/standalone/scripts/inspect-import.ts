import {readFileSync,statSync} from 'node:fs';
import {validateDataset} from '../src/server/contracts.ts';
const file=process.argv[2];if(!file)throw Error('Usage: npm run inspect:import -- /path/to/dataset.json');
if(statSync(file).size>100*1024*1024)throw Error('dataset_byte_limit');
const value:unknown=JSON.parse(readFileSync(file,'utf8'));validateDataset(value);
console.log(JSON.stringify({valid:true,mode:value.mode,students:value.students.length,records:value.records.length,artifacts:value.artifacts.length,projections:value.projections.length,databaseWritten:false,sourceIdentityIndependentlyVerified:false,sourceToProjectionReconciled:false}));

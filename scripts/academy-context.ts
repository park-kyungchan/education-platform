import {runIntegratedAcademyContext} from '../src/academy-context';
try{console.log(JSON.stringify(await runIntegratedAcademyContext(Bun.argv.slice(2)),null,2));}
catch(error){console.error(error instanceof Error?error.message:'academy_context_failed');process.exitCode=1;}

import {runIntegratedAcademyContext} from '../src/academy-context';
try{
 const args=Bun.argv.slice(2),value=await runIntegratedAcademyContext(args);
 // The selector accounts for compact UTF8 JSON, including its continuation cursor.
 // Do not add indentation or a newline outside that measured representation.
 if(args[0]==='select')await Bun.write(Bun.stdout,JSON.stringify(value));
 else console.log(JSON.stringify(value,null,2));
}
catch(error){console.error(error instanceof Error?error.message:'academy_context_failed');process.exitCode=1;}

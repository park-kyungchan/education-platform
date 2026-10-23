import {build} from 'esbuild';
import {writeFileSync} from 'node:fs';
const result=await build({entryPoints:['src/client/app.ts'],bundle:true,format:'iife',platform:'browser',target:'es2022',outfile:'public/app.js',minify:false,legalComments:'eof',metafile:true});writeFileSync('validation/browser-build-inputs.json',JSON.stringify(result.metafile,null,2)+'\n');console.log('Built independent local assets with no embedded source data.');

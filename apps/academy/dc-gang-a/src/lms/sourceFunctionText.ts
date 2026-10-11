/** Small fail-closed source-text selector, not JavaScript execution or a general JS parser. */
export function selectSourceFunction(source:string,name:string):string|null{
 if(typeof source!=='string'||source.length>1000000||! /^[A-Za-z_$][A-Za-z0-9_$]{0,64}$/.test(name))throw Error('source_function_scope_rejected');
 const matches=[...source.matchAll(new RegExp('function\\s+'+name+'\\s*\\([A-Za-z0-9_$,\\s]*\\)\\s*\\{','g'))];
 if(!matches.length)return null;if(matches.length!==1)throw Error('source_function_ambiguous');
 const start=matches[0]!.index!,brace=start+matches[0]![0].length-1;let depth=0,quote='',escaped=false,lineComment=false,blockComment=false;
 for(let i=brace;i<source.length;i++){
  const c=source[i]!,next=source[i+1];
  if(i-start>20000)throw Error('source_function_too_large');
  if(lineComment){if(c==='\n')lineComment=false;continue;}
  if(blockComment){if(c==='*'&&next==='/'){blockComment=false;i++;}continue;}
  if(quote){if(escaped){escaped=false;continue;}if(c==='\\'){escaped=true;continue;}if(c===quote)quote='';continue;}
  if(c==='/'&&next==='/'){lineComment=true;i++;continue;}if(c==='/'&&next==='*'){blockComment=true;i++;continue;}
  if(c==="'"||c==='"'||c==='`'){quote=c;continue;}
  // Regexp/division parsing is outside this deliberately narrow source selector.
  if(c==='/')throw Error('source_function_unqualified_slash_syntax');
  if(c==='{')depth++;else if(c==='}'&&--depth===0)return source.slice(start,i+1);
 }
 throw Error('source_function_unterminated');
}

const entities:Readonly<Record<string,string>>={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
export function escapeHtml(value:unknown):string{return String(value??'미제공').replace(/[&<>"']/g,c=>entities[c]);}

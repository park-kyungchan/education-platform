/** Calendar date and timezone are independent teacher knowledge. No default timezone is inferred. */
export function validDate(value:string):boolean{return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}
export function validTimeZone(value:string):boolean{try{new Intl.DateTimeFormat('ko',{timeZone:value});return value.length>0;}catch{return false;}}

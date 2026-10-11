import {z} from 'zod';

/** These functions interpret explicit reference selections, never evaluate qualitative behavior. */
export function selectPrintedLbadOverallLevel(input:unknown):number{
 const selected=z.array(z.number().int().min(1).max(5)).length(8).parse(input);
 return Math.min(...selected);
}
export function classifyLbadAccuracyBoundary(input:unknown):'below_printed_numeric_range'|'강아 레벨1'|'강아 레벨2'|'강아 레벨3'|'pride-s 레벨'{
 const percent=z.number().min(0).max(100).parse(input);
 // pre-Step is qualitative: a percentage below 50 cannot select it automatically.
 return percent<50?'below_printed_numeric_range':percent<60?'강아 레벨1':percent<70?'강아 레벨2':percent<80?'강아 레벨3':'pride-s 레벨';
}

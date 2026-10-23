import {assertDate,assertExactKeys} from '../learning/model';

export interface StudentPaperSearchPeriod {from:string;through:string}

/** Explicit read scope only; a source form's default period is not complete history. */
export function qualifyStudentPaperSearchPeriod(value:unknown):StudentPaperSearchPeriod {
  assertExactKeys(value as object,['from','through']);
  const period=value as StudentPaperSearchPeriod;
  assertDate(period.from);assertDate(period.through);
  if(period.from>period.through)throw Error('student_paper_period_reversed');
  return {from:period.from,through:period.through};
}

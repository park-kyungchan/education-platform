import {z} from 'zod';
import {StudentId,EntityId} from '../domain/ids.ts';
import {Evidence} from '../domain/evidence.ts';
import {LocalDate} from '../domain/operational-makeup.ts';

const Claim=z.discriminatedUnion('field',[
 z.strictObject({field:z.literal('per_book_actual_start'),value:LocalDate.nullable()}),
 z.strictObject({field:z.literal('per_book_expected_end'),value:LocalDate.nullable()}),
 z.strictObject({field:z.literal('book_score'),value:z.number().nullable()})
]);
/** Exact scoped statements only. First class, book delivery and inference never supply defaults. */
export function prepareBookProgressFacts(scopeInput:unknown,evidenceInputs:readonly unknown[]){
 const scope=z.strictObject({studentId:StudentId,bookEditionId:EntityId}).parse(scopeInput),evidence=evidenceInputs.map(value=>Evidence.parse(value));
 if(new Set(evidence.map(e=>e.evidenceId)).size!==evidence.length)throw Error('duplicate_book_progress_evidence');
 const values=new Map<z.infer<typeof Claim>['field'],z.infer<typeof Claim>['value']>();
 const lineage:{field:z.infer<typeof Claim>['field'];evidenceId:string;provenance:'teacher_report'}[]=[];
 for(const e of evidence){
  if(e.scope.studentId!==scope.studentId||!e.scope.entityIds.includes(scope.bookEditionId))throw Error('book_progress_evidence_scope_mismatch');
  if(e.claim.type!=='book_progress_explicit_statement')continue;
  if(e.source.kind!=='user_report'||e.source.actor.role!=='teacher'||!e.source.statementProvenanceConfirmed||e.verificationStatus==='contradicted')continue;
  const claim=Claim.parse(e.claim.value);
  if(values.has(claim.field)&&values.get(claim.field)!==claim.value)throw Error('book_progress_conflicting_statements_require_review');
  values.set(claim.field,claim.value);lineage.push({field:claim.field,evidenceId:e.evidenceId,provenance:'teacher_report'});
 }
 const actualStartOn=LocalDate.nullable().parse(values.get('per_book_actual_start')??null),expectedEndOn=LocalDate.nullable().parse(values.get('per_book_expected_end')??null),score=z.number().nullable().parse(values.get('book_score')??null);
 return {scope,actualStartOn,expectedEndOn,score,lineage,liveSourceVerified:false as const,sheetWritten:false as const};
}

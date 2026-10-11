import type {Assignment} from '../../../packages/domain/assignment.ts';
import type {Evidence} from '../../../packages/domain/evidence.ts';
import type {Decision} from '../../../packages/domain/decision.ts';
import type {StudentId,EntityId} from '../../../packages/domain/ids.ts';
/** Source availability, teacher authority and completion remain independent. */
export function selectEntityEvidence(studentId:StudentId,entityId:EntityId,evidence:readonly Evidence[],decisions:readonly Decision[]){return {evidence:evidence.filter(e=>e.scope.studentId===studentId&&e.scope.entityIds.includes(entityId)),decisions:decisions.filter(d=>d.studentId===studentId&&d.targetEntityIds.includes(entityId))};}
export function selectAssignmentDenominator(assignment:Assignment){return {gradingUnits:assignment.scope.length,embeddedIndependentUnits:0 as const,completionRate:null};}

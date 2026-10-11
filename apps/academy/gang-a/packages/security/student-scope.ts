import {StudentId,EntityId} from '../domain/ids.ts';
import type {Evidence} from '../domain/evidence.ts';
import type {Decision} from '../domain/decision.ts';
export function assertSelectedStudent(studentInput:unknown,allowedInputs:readonly unknown[]):StudentId{const studentId=StudentId.parse(studentInput),allowed=allowedInputs.map(value=>StudentId.parse(value));if(!allowed.includes(studentId))throw Error('student_outside_managed_scope');return studentId;}
export function assertEvidenceNamespace(studentId:StudentId,allowed:readonly EntityId[],evidence:readonly Evidence[],decisions:readonly Decision[]){for(const e of evidence)if(e.scope.studentId!==studentId||!e.scope.entityIds.every(id=>allowed.includes(id)))throw Error('evidence_student_namespace_mismatch');for(const d of decisions)if(d.studentId!==studentId||!d.targetEntityIds.every(id=>allowed.includes(id)))throw Error('decision_student_namespace_mismatch');}

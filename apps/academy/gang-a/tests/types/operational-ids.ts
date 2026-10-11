import {StudentId,EntityId} from '../../packages/domain/ids.ts';
import {OperationalId,OperationalRevision} from '../../packages/domain/operational-context.ts';
const operation=OperationalId.parse('D-A02'),student=StudentId.parse('synthetic-student');
// @ts-expect-error An academy-wide policy cannot impersonate a student identity.
const fakeStudent:StudentId=operation;
// @ts-expect-error Student IDs cannot become operating policy keys.
const fakeOperation:OperationalId=student;
// @ts-expect-error A student entity and an operating policy occupy different namespaces.
const fakeEntity:EntityId=operation;
// @ts-expect-error Revisions are not operational entity identifiers.
const fakeRevision:OperationalRevision=operation;
void [fakeStudent,fakeOperation,fakeEntity,fakeRevision];

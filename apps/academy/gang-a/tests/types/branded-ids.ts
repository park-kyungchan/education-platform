import {StudentId,NativeStudentId,EntityId,NativeEntityId} from '../../packages/domain/ids.ts';
const localStudent=StudentId.parse('synthetic-local'),nativeStudent=NativeStudentId.parse('synthetic-native');
const localEntity=EntityId.parse('synthetic-entity'),nativeEntity=NativeEntityId.parse('synthetic-native-entity');
const student:StudentId=localStudent;
// @ts-expect-error Native source identity cannot silently become a local student key.
const wrongStudent:StudentId=nativeStudent;
// @ts-expect-error Local keys cannot be sent as verified native identity.
const wrongNative:NativeStudentId=localStudent;
// @ts-expect-error Native entity identifiers have their own namespace.
const wrongEntity:EntityId=nativeEntity;
void [student,wrongStudent,wrongNative,wrongEntity,localEntity];

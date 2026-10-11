import type {ReadOnlyStudentTransport} from '../ports/transport.ts';
import {SourceId} from '../domain/ids.ts';
/** Deliberately makes no network request. No live connector is implemented. */
export const unavailableStudentTransport:ReadOnlyStudentTransport={capability:'unavailable',async retrieve(input){return {kind:'unavailable',studentId:input.studentId,sourceId:SourceId.parse('academy'),reason:'CONNECTOR_UNAVAILABLE',networkInvoked:false};}};

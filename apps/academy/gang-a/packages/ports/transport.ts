import type {StudentId,NativeStudentId} from '../domain/ids.ts';
import type {RefreshResult} from '../application/refresh-student.ts';
export interface ReadOnlyStudentTransport {readonly capability:'unavailable'|'verified_read_only';retrieve(input:{studentId:StudentId;nativeStudentId:NativeStudentId;signal:AbortSignal}):Promise<RefreshResult>;}
/** Route syntax is not permission. A transport requires independently verified
 * source identity, read-only effect, credential grant and protected-query health. */
export interface SourceAuthorization {readonly routeVerified:boolean;readonly readEffectVerified:boolean;readonly nativeIdentityVerified:boolean;readonly protectedQueryHealthy:boolean;readonly humanSessionActive:boolean;}

import type {RefreshResult} from '../application/refresh-student.ts';
/** Supply only from trusted server-side adapter state. Never implement from
 * source documents, caller booleans, displayed names or schema syntax alone. */
export interface TrustedObservationVerifier {verify(result:Extract<RefreshResult,{kind:'direct_observation'}>):Promise<boolean>;}

import type {StudentId,Sha256} from '../domain/ids.ts';
export interface OwnerPrincipal {readonly kind:'managed_sites_owner';readonly identitySha256:Sha256;}
export interface OwnerAuthorizationPort {authenticate(request:Request):Promise<OwnerPrincipal>;authorizeStudent(principal:OwnerPrincipal,studentId:StudentId):Promise<boolean>;}

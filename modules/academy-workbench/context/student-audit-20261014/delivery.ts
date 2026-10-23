export type RequestedOutput='final_app_frontend'|'standalone_html'|'zip_bundle'|'report_file';
export function deliveryDecision(output:RequestedOutput,readiness:{final:boolean;accessibleToOwner:boolean;authorizationVerified:boolean}){
 if(output!=='final_app_frontend')return {state:'blocked_by_user_output_scope',deliver:false,fallbackToAttachment:false};
 if(!readiness.final||!readiness.accessibleToOwner||!readiness.authorizationVerified)return {state:'frontend_not_ready',deliver:false,fallbackToAttachment:false};
 return {state:'deliver_verified_frontend',deliver:true,fallbackToAttachment:false};
}

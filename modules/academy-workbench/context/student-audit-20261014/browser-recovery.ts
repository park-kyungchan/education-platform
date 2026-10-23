/** Recovery planning only. Never establishes access or overrides tool denials. */
export function planTabRecovery(x:{sameApprovedBrowser:boolean;scopeUnchanged:boolean;tabMissing:boolean;unresolvedDenial:boolean}){
 if(x.unresolvedDenial)return 'stop_and_resolve_denial' as const;
 if(!x.sameApprovedBrowser||!x.scopeUnchanged)return 'verify_new_connection_or_scope_permission' as const;
 return x.tabMissing?'create_fresh_tab_in_same_approved_browser' as const:'reuse_existing_tab' as const;
}

/** Supplemental regression guard for the common operating catalog, not DLP. */
export function assertCommonOperationsPrivacy(input:unknown):void {
 const text=JSON.stringify(input);
 const patterns=[/(?:libfile_|Sentinel_|stu_|page_space_|FileDrive_)[a-f0-9]{32}/,/\b(?:sk-proj-|ghp_|github_pat_)[A-Za-z0-9_]{12,}/,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/tutor_pri_no\s*=/,/https?:\/\//,/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/];
 if(patterns.some(p=>p.test(text)))throw Error('common_operations_private_metadata_forbidden');
}

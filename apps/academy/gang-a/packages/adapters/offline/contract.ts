import {z} from 'zod';
export const CAPTURE_CONTRACT_SHA256='48eb8091244f3e3962fc4d6f85d7cba9743b9db88f31fed75c3f791c7759904a';
export const CAPTURE_AT='2026-10-07T08:05:31.277Z';
export const SEARCH_URL='https://dc.gang-a.kr/servlet/controller.tutor.base.TestPageListServlet?p_process=StudentNameSearch';
export const PARAM_NAMES=['clg_no','book_code','stu_name','check_all_stu','sort_date','chioce_course'] as const;
export const HEADERS=['학생이름','학습과정-단원분류','응시일','시험지','점수','클리닉','','채 오 클 분','일괄 재응시'] as const;
/** One user-supplied capture. Neither read effects nor authentication were
 * proved; this module carries no network implementation or credentials. */
export const CAPTURE_FACTS=Object.freeze({method:'POST',operation:'StudentNameSearch',contentType:'application/x-www-form-urlencoded',responseCharset:'utf-8',dateFilterValue:'3',dateFilterLabelRaw:'최근3주',capturedDataRowCount:27,columns:9,sourceKind:'imported_capture',captureAt:CAPTURE_AT,serverReadEffectsVerified:false,authenticationRequirementsVerified:false,completeHistoricalCoverageVerified:false});
export const FILTER_CONDITIONS=Object.freeze({academyBinding:'explicit_private_capture_scope_only',checkboxLabelRaw:'비 담당학생 포함',capturedCheckboxState:'checked_only_unchecked_not_observed',onSearchBookReset:'0',noCourseSelectionSentinel:'-1',clientAssignmentsAreNotBackendSemantics:true,capturedValuesAreGlobalDefaults:false});
export const Scope=z.strictObject({studentId:z.string().min(1),exactExpectedName:z.string().min(1).max(100),dateFilterValue:z.literal('3')});
export type StudentScope=z.infer<typeof Scope>;
export const FixedFields=z.strictObject({clg_no:z.string().regex(/^\d+$/),book_code:z.string().regex(/^\d+$/),check_all_stu:z.string().regex(/^\d+$/),chioce_course:z.string().regex(/^(?:-1|\d+)$/)});
export type FixedFormFields=z.infer<typeof FixedFields>;
export type FixedFieldPolicy={source:'unverified'|'synthetic_fixture'|'verified_nonsecret_capture_values';fixedValues:FixedFormFields|null};
export const UNVERIFIED_FORM_POLICY:FixedFieldPolicy=Object.freeze({source:'unverified',fixedValues:null});
export interface OfflineRequestTemplate{kind:'offline_request_template';url:typeof SEARCH_URL;method:'POST';contentType:'application/x-www-form-urlencoded';bodyUtf8:string;scope:StudentScope;requestParameterNames:readonly typeof PARAM_NAMES[number][];valueProvenance:Exclude<FixedFieldPolicy['source'],'unverified'>;networkExecutionAllowed:false;readEffectsVerified:false;credentialsIncluded:false;contractCaptureAt:typeof CAPTURE_AT;}
export type BuildResult={status:'prepared';template:OfflineRequestTemplate}|{status:'blocked';code:'NONSTUDENT_FORM_VALUES_UNVERIFIED'|'INVALID_SCOPE_OR_FORM';networkExecutionAllowed:false};
export function buildCapturedStudentNameSearch(input:unknown,policy:FixedFieldPolicy=UNVERIFIED_FORM_POLICY):BuildResult{
 const parsed=Scope.safeParse(input);if(!parsed.success)return {status:'blocked',code:'INVALID_SCOPE_OR_FORM',networkExecutionAllowed:false};const scope=parsed.data;
 if(scope.exactExpectedName!==scope.exactExpectedName.trim()||/[\u0000-\u001f\u007f]/.test(scope.exactExpectedName))return {status:'blocked',code:'INVALID_SCOPE_OR_FORM',networkExecutionAllowed:false};
 if(policy.source==='unverified'||policy.fixedValues===null)return {status:'blocked',code:'NONSTUDENT_FORM_VALUES_UNVERIFIED',networkExecutionAllowed:false};
 const values=FixedFields.safeParse(policy.fixedValues);if(!values.success)return {status:'blocked',code:'INVALID_SCOPE_OR_FORM',networkExecutionAllowed:false};
 // No policy values are shipped for the real capture. The fixed policy must
 // come from a separately verified, nonsecret source; caller input cannot add
 // another route, operation, broad search option, output action or credential.
 const pairs:Record<typeof PARAM_NAMES[number],string>={clg_no:values.data.clg_no,book_code:values.data.book_code,stu_name:scope.exactExpectedName,check_all_stu:values.data.check_all_stu,sort_date:'3',chioce_course:values.data.chioce_course};const body=new URLSearchParams();for(const name of PARAM_NAMES)body.append(name,pairs[name]);
 return {status:'prepared',template:{kind:'offline_request_template',url:SEARCH_URL,method:'POST',contentType:'application/x-www-form-urlencoded',bodyUtf8:body.toString(),scope,requestParameterNames:PARAM_NAMES,valueProvenance:policy.source,networkExecutionAllowed:false,readEffectsVerified:false,credentialsIncluded:false,contractCaptureAt:CAPTURE_AT}};
}
/** Intentionally not a transport implementation. Even a prepared template
 * cannot issue a request. Do not replace this with fetch without new approval. */
export interface TransportBoundary{kind:'no_network_implementation';operation:'StudentNameSearch';networkExecutionAllowed:false;credentialsAccepted:false;}
export const TRANSPORT_BOUNDARY:TransportBoundary=Object.freeze({kind:'no_network_implementation',operation:'StudentNameSearch',networkExecutionAllowed:false,credentialsAccepted:false});
export function requireExecutableTransport():never{throw Error('NETWORK_EXECUTION_NOT_IMPLEMENTED_OR_APPROVED');}

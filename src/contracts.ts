export const moduleIds = ['mathematics-core','curriculum','academy','clinic-workbench','mathcrew','academy-workbench','math-research'] as const;
export type ModuleId = typeof moduleIds[number];
export interface NativeBinding {ownerProfile:string|null;projectId:string|null;projectRoot:string|null;workIssueIds:string[];pendingWork?:string;ontologyRootKind?:string;workIssueMeaning?:string;bindingMeaning?:string;authority:'none'}
export interface EducationModule {id:ModuleId;root:string;projectId:string;sourceKind:string;commit:string;runtime:'bun'|'node-npm';runtimePin?:string;dependsOn:ModuleId[];checks:string[];entrypoints:string[];native:NativeBinding}
export interface AcademySource {id:string;root:string|null;commit:string;revisionMeaning:string;writePolicy?:'reference-only'}
export interface AcademyGangSourceMaintenance {
 maintainedCodeRoot:'apps/academy/gang-a';
 retainedSourceRepository:'park-kyungchan/gang-a';
 retainedBaseline:{commit:string;tree:string;trackedPaths:129;frozenImplementationAndSourcePaths:127;allowedGovernanceChanges:['README.md','.github/workflows/ci.yml']};
 importSourceRef:'gang-a-upstream';
 inspectedNativeReferenceRef:'gang-a-inspected-reference';
 ownershipBoundary:string;
 retainedValidation:string;
 nativeSourceParity:'unverified; inspected d604 is historical reference only';
 runtimeAuthority:'none';
 nativeOrDataCutoverPerformed:false;
 retirementAuthorized:false;
}
export interface SourceMap {schema:'education.source-map.v1';projectId:'education-platform';ontologyVersion:'0.2.0';authority:'none';modules:EducationModule[];academySources:AcademySource[];academyGangSourceMaintenance:AcademyGangSourceMaintenance;semanticState:{mathematicsHumanDecision:'PENDING';mathematicsCanonicalApplication:'NOT_PERFORMED';r4Review:'PENDING_NEW_EXACT_REVIEW_AUTHORITY';bunParity:'DEFERRED';curriculumCanonicalInputs:'not_available_in_this_ui_export'}}

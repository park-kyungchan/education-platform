/** W4 isolated composition. Importing this module performs no filesystem,
 * authentication, database, listener, provider, or process operation.
 * HELD candidates are deliberately not executable admissions. */
import {createHash, randomUUID} from 'node:crypto';
import {chmodSync,closeSync, constants, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readlinkSync,readSync,rmdirSync,unlinkSync, writeFileSync, writeSync} from 'node:fs';
import {dirname, isAbsolute, join, resolve} from 'node:path';
import {fixedConsumerProfile,selectedProtocolClosure,validateNativeRef,type NativeObjectRef,type ConsumerProfileId,type ReadAdmission} from '../src/academy/contracts/prerequisiteRecords';
import {assertInstant,canonicalJson,digest} from '../src/learning/model';
import type {SQL} from 'bun';
import type {NativeQualificationHooks} from '../src/academy/nativeTypedRead';
import {nativeTypedReadOutputPolicy} from '../src/academy/nativeTypedRead';
import type {NativeCursorRuntime} from '../src/academy/server';
import type {TeacherPrerequisiteStore} from '../src/academy/ports/teacherStore';
import type {TeacherAuthStore, ProductAuthState} from '../src/academy/teacherAuthStore';

export const isolatedTarget = Object.freeze({
  runId:'e2e-p4-native-20261027-52', directory:'/var/tmp/e2e-p4-native-20261024-01/runs/e11-sealed-frame-52',
  worktree:'/var/tmp/e2e-p4-native-20261024-01/runs/e11-sealed-frame-52/source/education-native-foundations',
  evidenceRoot:'/home/palantirkc/operations/platform-redesign-20261023T1807Z',
  hostname:'127.0.0.1', port:38743, runtime:'/usr/local/bin/bun', runtimeVersion:'1.4.3',
  runtimeSha256:'7ce7d6b654eddeec20afddf2396317fba6dc19ab52788a27e894e1806bf8f24b',
  image:'docker.io/library/postgres@sha256:ec4dfc6571f04fe0731ce948c1500d676af49a7224392dcc6995cc1ee33a94bb',
  providerSocket:'/var/tmp/e2e-p4-native-20261024-01/socket',
  database:'e2e_p4_e11_frame52', username:'e2e_qualification',
  registry:'reports/p6-execution/native-foundations/reconciliation/education-registry.v4.json',
  registrySha256:'914c8d555a27e19e35f7048e125b7f0cfce1fc41a309a8e1d1f71bf7a5988c2a',
  environment:'reports/p4-p5-execution/claude-takeover-20261027/gen84/environment-direction.v1.json',
});
export function isDirectPhaseMetadataDirectory(value:unknown):value is string {
  return typeof value==='string'&&dirname(value)===isolatedTarget.directory+'/phases'&&resolve(value)===value;
}
const academy='apps/academy/dc-gang-a/';
export const selectedCapabilityPins:readonly FilePin[]=Object.freeze([
 {path:'reports/p4-p5-execution/resumption-20261025/cursor-capability-adoption.v2.json',sha256:'81d8bc27833b4da1e9408d58783a4e57052e6109af201acd78a5248ff7ad70ec',bytes:11892},
 {path:'reports/p4-p5-execution/resumption-20261025/cursor-capability-contract-r1/candidate.v1.json',sha256:'47e0e4eb704815729bf5fec7229a6301ad8b980d65789ed2e90811b99565a4e7',bytes:28447},
 {path:'reports/p4-p5-execution/resumption-20261025/cursor-capability-contract-r1/joins-and-implementation.v1.json',sha256:'636ad52affae106ace68926adde69b9bf42009c5b318b37f3a5d158d8fa50c2a',bytes:32791},
 {path:'reports/p4-p5-execution/resumption-20261025/root-fault-expiry-source-selection.v1.json',sha256:'f33c1a435df9c675de03e86117d14e9c8dfd3704b812fced07f4dc23c925265e',bytes:9690},
 {path:'packets/p4-p5-execution/lead-workflow-improvement-20261025/e9-writer-source-selection.v1.json',sha256:'4523946b7f281a2c94443b201c232d68daea596d8c4aecc99fca5774d8a0a0d3',bytes:9480},
 {path:'packets/p4-p5-execution/lead-workflow-improvement-20261025/e10-c2-teacher-writer-join.v1.json',sha256:'3f04155f774cc4f52b0cbf4011d065403eeeedda97401cb4797c601c1eda00b0',bytes:6033},
 {path:'packets/p4-p5-execution/lead-workflow-improvement-20261025/e10-c2-f1-preconditions-join.v1.json',sha256:'748671bc770dd7278a324333d490b90fd70e9a22a7a66f1523986668323c08b0',bytes:9361},
]);
export const fixedRunnerPaths=Object.freeze({MIGRATE:academy+'harness/native_foundations_migrate.ts',CONTROLLER:academy+'harness/native_qualification_controller.py',FIXTURE:academy+'harness/native_foundations_fixture.ts',MEASURE:academy+'harness/native_foundations_measurement.ts'});
export const dependencyTargets=Object.freeze([
  {link:isolatedTarget.worktree+'/'+academy+'node_modules',target:'/home/palantirkc/projects/education-platform/apps/academy/dc-gang-a/node_modules',device:2049,inode:110933},
  {link:isolatedTarget.worktree+'/apps/academy/gang-a/node_modules',target:'/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules',device:2049,inode:1680008},
]);
export const requiredSourcePaths:readonly string[]=Object.freeze(["apps/academy/dc-gang-a/docs/teacher-exam-selection-contract.ts","apps/academy/dc-gang-a/harness/native_foundations_fixture.ts","apps/academy/dc-gang-a/harness/native_foundations_measurement.ts","apps/academy/dc-gang-a/harness/native_foundations_migrate.ts","apps/academy/dc-gang-a/harness/native_foundations_qualification.ts","apps/academy/dc-gang-a/harness/native_qualification_controller.py","apps/academy/dc-gang-a/src/academy/academyConnectionStatus.ts","apps/academy/dc-gang-a/src/academy/application.ts","apps/academy/dc-gang-a/src/academy/auth.ts","apps/academy/dc-gang-a/src/academy/bookCertificationEvidence.ts","apps/academy/dc-gang-a/src/academy/bookPreparation.ts","apps/academy/dc-gang-a/src/academy/classroomCyclePolicy.ts","apps/academy/dc-gang-a/src/academy/conceptEvidenceAdapter.ts","apps/academy/dc-gang-a/src/academy/conceptEvidenceGraph.ts","apps/academy/dc-gang-a/src/academy/conceptWorkspace.ts","apps/academy/dc-gang-a/src/academy/conceptWorkspaceStore.ts","apps/academy/dc-gang-a/src/academy/contracts/prerequisiteRecords.ts","apps/academy/dc-gang-a/src/academy/contracts/retainedQuery.ts","apps/academy/dc-gang-a/src/academy/contracts/storageRecords.ts","apps/academy/dc-gang-a/src/academy/contracts/teacherOperations.ts","apps/academy/dc-gang-a/src/academy/curatedConceptCandidates.ts","apps/academy/dc-gang-a/src/academy/domain.ts","apps/academy/dc-gang-a/src/academy/examSelection.ts","apps/academy/dc-gang-a/src/academy/learningWork.ts","apps/academy/dc-gang-a/src/academy/learningWorkBindings.ts","apps/academy/dc-gang-a/src/academy/learningWorkProjection.ts","apps/academy/dc-gang-a/src/academy/main.ts","apps/academy/dc-gang-a/src/academy/nativeCompleteness.ts","apps/academy/dc-gang-a/src/academy/nativeConnector.ts","apps/academy/dc-gang-a/src/academy/nativePrerequisiteStore.ts","apps/academy/dc-gang-a/src/academy/nativeReadDescriptor.ts","apps/academy/dc-gang-a/src/academy/nativeTypedRead.ts","apps/academy/dc-gang-a/src/academy/operatingWorkspace.ts","apps/academy/dc-gang-a/src/academy/operationalContract.ts","apps/academy/dc-gang-a/src/academy/originTrial.ts","apps/academy/dc-gang-a/src/academy/ownerWorkspaceStore.ts","apps/academy/dc-gang-a/src/academy/ports/teacherStore.ts","apps/academy/dc-gang-a/src/academy/postgresStore.ts","apps/academy/dc-gang-a/src/academy/preparationHistory.ts","apps/academy/dc-gang-a/src/academy/prerequisiteApplication.ts","apps/academy/dc-gang-a/src/academy/preservedHistory.ts","apps/academy/dc-gang-a/src/academy/records.ts","apps/academy/dc-gang-a/src/academy/retainedQuery.ts","apps/academy/dc-gang-a/src/academy/retainedQueryValidation.ts","apps/academy/dc-gang-a/src/academy/server.ts","apps/academy/dc-gang-a/src/academy/sourceEvidence.ts","apps/academy/dc-gang-a/src/academy/sourceSynchronization.ts","apps/academy/dc-gang-a/src/academy/teacherActionScope.ts","apps/academy/dc-gang-a/src/academy/teacherAuthStore.ts","apps/academy/dc-gang-a/src/academy/teacherExamWorkspace.ts","apps/academy/dc-gang-a/src/academy/teacherWorkContext.ts","apps/academy/dc-gang-a/src/academy/teacherWorkspace.ts","apps/academy/dc-gang-a/src/academy/usecases/conceptWorkspace.ts","apps/academy/dc-gang-a/src/academy/usecases/requestRecovery.ts","apps/academy/dc-gang-a/src/academy/usecases/studentScene.ts","apps/academy/dc-gang-a/src/academy/usecases/teacherClinic.ts","apps/academy/dc-gang-a/src/academy/usecases/teacherObservation.ts","apps/academy/dc-gang-a/src/academy/usecases/teacherWorkspace.ts","apps/academy/dc-gang-a/src/academy/web/designLab.ts","apps/academy/dc-gang-a/src/academy/web/designLabCatalog.ts","apps/academy/dc-gang-a/src/academy/web/designTokens.ts","apps/academy/dc-gang-a/src/academy/web/fontAssets.ts","apps/academy/dc-gang-a/src/academy/web/teacherRails.ts","apps/academy/dc-gang-a/src/academy/web/teacherStyles.ts","apps/academy/dc-gang-a/src/contracts/catalogLevels.ts","apps/academy/dc-gang-a/src/contracts/operationalContractShape.ts","apps/academy/dc-gang-a/src/contracts/parentInternalLanguage.ts","apps/academy/dc-gang-a/src/contracts/readInputRecord.ts","apps/academy/dc-gang-a/src/learning/model.ts","apps/academy/dc-gang-a/src/lms/academyReadProtocol.ts","apps/academy/dc-gang-a/src/lms/academySourceAudit.ts","apps/academy/dc-gang-a/src/lms/assessmentReadProtocol.ts","apps/academy/dc-gang-a/src/lms/dayRecordColumnContract.ts","apps/academy/dc-gang-a/src/lms/dayRecordDomBinding.ts","apps/academy/dc-gang-a/src/lms/dayRecordReadProtocol.ts","apps/academy/dc-gang-a/src/lms/itemAnswerAudit.ts","apps/academy/dc-gang-a/src/lms/itemAnswerBatch.ts","apps/academy/dc-gang-a/src/lms/itemAnswerRead.ts","apps/academy/dc-gang-a/src/lms/itemMetadataRead.ts","apps/academy/dc-gang-a/src/lms/printedPaperCode.ts","apps/academy/dc-gang-a/src/lms/studentCourseRead.ts","apps/academy/dc-gang-a/tests/academy/fourGapSourceGrammar.test.ts","apps/academy/dc-gang-a/tests/academy/isolatedNativeServer.test.ts","apps/academy/dc-gang-a/tests/academy/nativeCompleteness.test.ts","apps/academy/dc-gang-a/tests/academy/nativePrerequisitePort.test.ts","apps/academy/dc-gang-a/tests/academy/nativePrerequisiteStore.test.ts","apps/academy/dc-gang-a/tests/academy/nativeReadDescriptor.test.ts","apps/academy/dc-gang-a/tests/academy/outcomeLookup.test.ts","apps/academy/dc-gang-a/tests/academy/teacherAuthStore.test.ts","apps/academy/dc-gang-a/tests/academy/teacherBinding.test.ts","apps/academy/dc-gang-a/tests/academy/teacherReadSnapshot.test.ts","apps/academy/dc-gang-a/tests/academy/typedRead.test.ts","apps/academy/dc-gang-a/tests/academy/typedReadIngress.test.ts","apps/academy/dc-gang-a/tests/academy/typedReadSnapshot.test.ts","apps/academy/gang-a/packages/adapters/repository-operating-context.ts","apps/academy/gang-a/packages/application/project-book-certification.ts","apps/academy/gang-a/packages/application/select-operational-context.ts","apps/academy/gang-a/packages/application/validate-operational-context.ts","apps/academy/gang-a/packages/audit/event-log.ts","apps/academy/gang-a/packages/domain/book-certification.ts","apps/academy/gang-a/packages/domain/evidence.ts","apps/academy/gang-a/packages/domain/ids.ts","apps/academy/gang-a/packages/domain/operational-context.ts","apps/academy/gang-a/packages/domain/operational-followup.ts","apps/academy/gang-a/packages/domain/scope.ts","apps/academy/gang-a/packages/schema/academy-operating-context.ts","apps/academy/gang-a/packages/security/operational-context.ts"]);
export const requiredZodPins:readonly FilePin[]=Object.freeze([{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/index.js","sha256":"32e7efd49a94a765f6d10a1a0a3c02c50c246def17c80c6f0225f85525d98505","bytes":422},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/package.json","sha256":"a046ed85fa09571dba539fee9ef236152d12dabd1f229b014ec3bd2ebaad9000","bytes":4142},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/classic/checks.js","sha256":"7543391a9ad5e7df287bbfecaa79844d46af44c75c1de0d43a411d65795d9dd1","bytes":690},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/classic/coerce.js","sha256":"fb2efe3b6eacc475c77cbb571b5fb8650d92a10f316dc869e49b722973d83c3c","bytes":550},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/classic/compat.js","sha256":"0e948b101771cc0e7b753e54b3f5b486929d3db9bd4c09d98fe4ce86271bcf7b","bytes":1090},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/classic/deep-partial.js","sha256":"0abffcc9838e04dc6f091229c1d522fbfd43aab9563316b52d3eb8ff2bacf26d","bytes":543},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/classic/errors.js","sha256":"d32f7c1ef8e2c70072f6f0ec8ba7081bbc331353cc3a7cb4429e5ece91409543","bytes":2532},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/classic/external.js","sha256":"c6b584ae70ba4e7132b2cd78c23ea4ecedc9828abf999edee312372e1fb453d6","bytes":1101},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/classic/from-json-schema.js","sha256":"31dc999a26cb6928f5e99ea564d648567e85cf9aa47565198fb6186dbd6c070e","bytes":38171},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/classic/in-out.js","sha256":"34370913842ff02d14a9796b11c5ec2af160bdb35a7148edc286e9a9c6fb5c17","bytes":2190},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/classic/iso.js","sha256":"deaa026b7c5302e59719f401248e7866691d8d8a892884dd2b6868b1cb7252d8","bytes":556},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/classic/parse.js","sha256":"11941573401bbef138842c7a523dff554873343fccbf0e8b0a144259d2d703f1","bytes":1057},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/classic/schemas.js","sha256":"2bf4a631a18f734a9a7ab7fc11bcf919214774d2235a312dcec0dd53d0324c32","bytes":53354},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/core/api.js","sha256":"03ae6016abc9585e3f3481d6b8d775a95ae4ee65badbde73ca1ed953ff14c0e7","bytes":28953},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/core/checks.js","sha256":"bc42543274218aa7ef72192b3218d2a4a399e53df8de240a04d9ff275096f563","bytes":19491},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/core/compile.js","sha256":"df28853593428e5a2a8729b09f43baf0998eaae7f1e37797993035187833b054","bytes":91611},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/core/core.js","sha256":"c7ce485c97263e42568d16b11bb4a90133221c7e807498a9273d70f41ba16ef6","bytes":6642},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/core/doc.js","sha256":"be4c1b1a1ad247cc70f360a572060edd7e0cea24252c3a319f33d247899c5643","bytes":1290},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/core/errors.js","sha256":"a0c95ef2f7085b5bc2931f7b566f524b26a0360c8df741e3f87f923745cf9792","bytes":10871},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/core/index.js","sha256":"2a0e452323aa5b75b7d7de4879289e2579b9dd2d6af291c0416ba6806ca2199d","bytes":690},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/core/json-schema-generator.js","sha256":"beaeab6faa654e99e443b8a9f5d8a4adc08cd8226f92a0cd32477a58ecfa1807","bytes":3857},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/core/json-schema-processors.js","sha256":"b6d2aee72212c076b9cde38da6333591c76a24eb049a4ee4e7bd2b7825d8b817","bytes":34985},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/core/json-schema.js","sha256":"8e609bb71c20b858c77f0e9f90bb1319db8477b13f9f965f1a1e18524bf50881","bytes":11},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/core/memoizer.js","sha256":"18a3188c51229d9189a5408b0b7fbc3e121b55c2b4c3c406d79cb9b77e7ad964","bytes":12517},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/core/parse.js","sha256":"fb05b91ec260f3f484f7c00a177b6126ceb8fd1b09dc90b1200afdffd4d98efd","bytes":8267},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/core/regexes.js","sha256":"24fc98f6fc9175e50ff29d28b040e3b4ac5650de19914d45ee27b853d367ecc6","bytes":11818},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/core/registries.js","sha256":"f04d4b2c0bc5b4ac2d6610ea34edf2e5260eade18f20976b79916dcdbeb9fa4d","bytes":1540},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/core/schemas.js","sha256":"e632b655441418f0593153abc6809fd81cf3e0782d810622d0a4fa50ef6e182e","bytes":105968},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/core/to-json-schema.js","sha256":"85b883eb8f05e9f060c71a39fce7df9345b566af29d5bc9c8fa477fe616a051d","bytes":29029},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/core/util.js","sha256":"728f52b496620336775eafcdb91c0a574380086e53f215b55c58eedc1422c49c","bytes":34363},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/core/versions.js","sha256":"63b38035ff5e2a5a5cfe5665e271af72b0cf9791e770dccf5e99d977064fb96c","bytes":70},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/core/visit.js","sha256":"a804062900869e09ea0b975cfa569fd3c70dc33bad7fc30b63872d451cae29f7","bytes":6643},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/ar.js","sha256":"eec4016c2b3063ae929617d90ec609e4c425e60c97a954d3a24de0f457b6ec97","bytes":5404},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/az.js","sha256":"5bd03646b9d18b73e71356cd28937e4e6413b806bb23e14689cc88f6f65ff3a6","bytes":4703},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/be.js","sha256":"f969afea5d9800a71958a621658943b85a2576a2bfefdd5dea70afc4924d4af4","bytes":6998},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/bg.js","sha256":"96741333a790320e05aef7286b5b709a4a7c48cfffc50fc5e6acff5b505275e9","bytes":6029},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/bn.js","sha256":"6d8227b52a6864465b7c52a9ef7e09d261d904ec8a619932e15dd9f9f826e8dd","bytes":5757},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/ca.js","sha256":"67f6f38b59a6e3ee81cc5155480465331dd9a142b2471a495503a81dafba0684","bytes":4908},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/ckb.js","sha256":"bdb9ef0cfda4009f8892585a1780fff863cd409931d6f89394c271042c131137","bytes":5948},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/cs.js","sha256":"4ffa0e484ad1842a2c0e5c7f2dfe9160155ff5be4b95ab6e524d3a30a2210488","bytes":4953},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/da.js","sha256":"29addcd60e88422bed9ed78c6c864220a15c06b31fdb4ab7ad4f87be4098e6ae","bytes":4987},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/de.js","sha256":"f344eb96ba18d9db907f3f9c95897ce2590ab0cde1553c023daffbb1cb5ef6f4","bytes":4774},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/el.js","sha256":"fdea833aa0a8c381d26216db1521dd7fbc4dccb6d3aa50f9a585ffb975df91eb","bytes":5701},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/en.js","sha256":"d5930e10d137b048b37823e168e4177947e1f696ada8419c71bb0d32da4333c0","bytes":5302},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/eo.js","sha256":"97797bd22319ecc3f2044da6c305f1114b851803697029ffce2b66644757da3a","bytes":4784},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/es.js","sha256":"12e762b921b1e3fdb8e265d2b554de81ce9706ceb23a81527f48ae2dddf355db","bytes":5591},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/fa.js","sha256":"60e7eeff4c000c85f8420168374344305d3c2110a5f91a2fb672b2a2381eeddf","bytes":5343},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/fi.js","sha256":"1e72af4193e564cd37dce4a850dc18bc1bcd6ca280f29e9f5f8c6bbab6a2cad9","bytes":5007},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/fr-CA.js","sha256":"a2ca0451ff943766bb6a88b392b25447462a1d3ed75c1adda5ddb0bc474bcd42","bytes":4749},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/fr.js","sha256":"477345d6401d0e4f07794b1a2cff8b78953723f1fc8cfaeb6b660c19be47125a","bytes":5414},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/gu.js","sha256":"b1921ac6b4158e6360a8da6099df8bbf2d7bce7c1cf381d5a5e47aa0c74874d2","bytes":5930},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/he.js","sha256":"1cfff31fac19616d900d1f3febd9690ea87711e13b5be299326ebfd3f33aad4d","bytes":12411},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/hi.js","sha256":"c31e466c2a31dc10ba6a288e1aebf429a6e9566a26918d0240aae058693f6329","bytes":5940},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/hr.js","sha256":"ff2bebef0761f2d6095103d58484e3b95551bc51d56770db8f161b8e0e0ec941","bytes":5184},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/hu.js","sha256":"9816c21ee0b3be9d973f9e033e9587a608f2d35dd1b984d415b88e03242b0189","bytes":4871},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/hy.js","sha256":"daf6d0c590d9b061759598ba9f7f97041e2874c7a58da2c64b86f152840d68fa","bytes":6720},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/id.js","sha256":"e5c23bb0b6f696fa936bafd7969e64738504cf7a5be3ec04b24ae899d4912b58","bytes":4759},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/index.js","sha256":"7ea85250d1e7bd9459cda61f38c78757a410d561a5421bb3f08019bba79c9849","bytes":2607},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/is.js","sha256":"1cce1285bbf55c8a76303fea0be0fb6d39fbd0ece833137ea23a22f406ac1ae1","bytes":4822},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/it.js","sha256":"096b497df6c5fe7de4422482b7733e764e4b344e8d7f768a7289556687acdb82","bytes":4775},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/ja.js","sha256":"2a6bbbd6dbd573687b22f35873a13cdf730c07423b4ab114e5a8b12d8777146d","bytes":5054},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/ka.js","sha256":"baf3204123cf4246df654fd1948b6c8da6917e7a06e470aeeaf7c1eaa7003628","bytes":6527},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/kh.js","sha256":"78c3d1991041bb8c8fc0f7c5d745aae422d4c2e4e8f30bae44f3fef4765900a8","bytes":111},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/km.js","sha256":"e61079f14070dfa9c7b2047eb79f5bea6d4e845f192756d103c121bbd63ee18a","bytes":6509},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/kn.js","sha256":"884b1b68a1ca02fe9a774b8de9cbfa3486892eea36192699120f57b31f0a1f42","bytes":6512},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/ko.js","sha256":"11fcef61a2f23e010bf0f569d71be0d49524afc97f3072cc03fdc6fe3ea2f14d","bytes":5109},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/lt.js","sha256":"d2e67a35a3c6e7241a9eb9c5851e4b5b651ac8b23278854862e6055829946c48","bytes":8223},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/mk.js","sha256":"64ddd914c432ba5690d0686bff6603651ce886a891f84823d7dc766c9c980cd1","bytes":5399},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/ms.js","sha256":"94faf0d306ffa2a4f95e57f3e53060d27220a639b9cb529f00d1d01b6270f045","bytes":4674},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/ne.js","sha256":"6da69989b702ae15baa27b799b6b2b32fd011ba3980a190dd0eccfc9233083d6","bytes":5819},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/nl.js","sha256":"296ced8be508c5f9e82b562049d2974882029bcd5b2ab4ade14401b33ec99909","bytes":4939},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/nn.js","sha256":"bae9756817629db30841eb54a27ed9b3c71c2a4208314d8d070be624bd2e9359","bytes":4678},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/no.js","sha256":"f358e5586940350ee25a05db184565d23eb1c66903e182ebec812172f31cb55a","bytes":4693},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/ota.js","sha256":"66ed8c3ce00b2e9971ed5a17f002937405d8cdfeb399ebe012db9d2317f42146","bytes":4723},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/pl.js","sha256":"b7f82cf9f747785beeec05cd31d3d7493c52bd3647598924141568f148c07222","bytes":5150},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/ps.js","sha256":"1c15b81fcce0cdc59dbcca18df5c4ecf4e176fc3fb7668207b9ba54df43cce46","bytes":5123},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/pt-BR.js","sha256":"abc52db767b9dd938954776728ea7480cdcab569a5a17664f60e5a2c1d63e60b","bytes":7024},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/pt.js","sha256":"93a820f60d571607bf34b69198f5b24617475584c0b22c0f8d160fcdef096a46","bytes":7024},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/ro.js","sha256":"54751d2866171c9c7ce1a72868dec09efa54d1b2b67401767594c5b360aca38a","bytes":4883},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/ru.js","sha256":"40a019b53bd1684fd4b750db87021520dd5d710f714010c0a594e5bcf5787478","bytes":7095},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/sk.js","sha256":"ae7c49242e70149434c9051dd00209afbd517d98ba54c13692371a5340b616da","bytes":4949},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/sl.js","sha256":"490ca48f8aae3aed660758b32856d49a9fc5c7e255dad220e75abaef8c35140b","bytes":4756},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/sv.js","sha256":"448f36996bb0d159489b34ad7d86df03e520a13e43b1c98ea2fb18d7ed4a3c95","bytes":4841},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/ta.js","sha256":"8b6e1bc033fdaefb1acfc7edf88c9f53c3a50cc892066effdab306103e994d42","bytes":6688},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/tg.js","sha256":"9a5c9a3b18b8ccded28d66033575b22d823df17a7afa8bb9a733f31fe071462f","bytes":5647},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/th.js","sha256":"913cc4962ddf5cb54ed694d04b7008493ef401d3333b26426b32f4890712574e","bytes":6563},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/tk.js","sha256":"445abfed18c5a9d79143b02c9cf9c171b41fb5dff8ffc2cb59b7aef7203e5a7f","bytes":4458},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/tr.js","sha256":"bca07607a27f518f19877dd9c2235fada9c73eb56896f0f6e274781fab71d64e","bytes":4642},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/ua.js","sha256":"9391169ffbc72f777a83230b6ffcc3f4cf46ab5945ec540de9ef4609dca1f4cc","bytes":111},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/uk.js","sha256":"1e59ba41296aeb5b6142a6e5ed84712931e33e54ab0b9ae5d83faf436fc3d968","bytes":5665},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/ur.js","sha256":"d37ed2c93408e0a6b6e1cd290117a6f0e9d7b2c83509cd34b502e1dd94899c87","bytes":5491},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/uz.js","sha256":"2cbe07635b03064ffad0bfcc98d2d570f3264b9cd3e22bbd5c160cd0343f7872","bytes":4844},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/vi.js","sha256":"15939adaf263e0869c602d4b34c206178a235b8bec11c8207ccd3fa50de3a141","bytes":4967},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/yo.js","sha256":"88b33f6527c1a2faaf159568330cf727c448dc468eac72142a6fb24f8714ac1e","bytes":4847},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/zh-CN.js","sha256":"8fc02f2bd4d92f46b24b8d82da0ee95c962fc80c14dd7dd469500e14de08d320","bytes":4622},{"path":"/home/palantirkc/projects/education-platform/apps/academy/gang-a/node_modules/zod/v4/locales/zh-TW.js","sha256":"01d9b119e318d8b9f1a8fa720d06424457429425a61d0730984b750e6a5edf7d","bytes":4672}]);
export type Phase='A0'|'B0'|'A1'|'P-RESTART'|'OLD-SECTION'|'CURRENT-RESTORED';
export type Operation='AUTH_INIT'|'START';
export interface FilePin {readonly path:string; readonly sha256:string; readonly bytes:number}
interface ProcessBinding {readonly pid:number; readonly startTicks:number}
const cursorDeadlineDimensions=['acquisition','session','grant','snapshot','source','read','output','admission','retention'] as const;
interface CursorOwnerDeadline {readonly dimension:typeof cursorDeadlineDimensions[number];readonly disposition:'APPLICABLE'|'NOT_APPLICABLE';readonly expiresAt:string|null;readonly provenance:NativeObjectRef}
export interface CursorOwnerBinding {
 readonly schema:'root-cursor-owner-binding.v1';readonly interfaceId:string;readonly ownerId:string;readonly runId:string;
 readonly principalRef:NativeObjectRef;readonly authorityRef:NativeObjectRef;readonly recipientAdmissionRef:NativeObjectRef;
 readonly deadlines:readonly CursorOwnerDeadline[];readonly pipe:RunnerPipe;
 readonly sourceReviewSha256:string;readonly environmentSha256:string;readonly occurrenceId:string;
}
const rootCursorBindings=new WeakSet<object>();
export interface QualificationConfiguration {
  readonly cursorOwnerBinding?:CursorOwnerBinding;
  readonly schema:'isolated-native-qualification.v2'; readonly status:'SEALED';
  readonly consumerProfile:ConsumerProfileId;readonly consumerProfileDigest:string;
  readonly effectiveContracts:{readonly manifest:FilePin;readonly artifacts:readonly FilePin[]};
  readonly operation:Operation; readonly phase:Phase; readonly runId:string;
  readonly occurrenceId:string; readonly ownerId:string; readonly serviceInstanceRef:string;
  readonly hostname:'127.0.0.1'; readonly port:38743; readonly worktree:string; readonly taskDirectory:string;
  readonly metadataDirectory:string; readonly authFile:string; readonly authSha256:string|null;
  readonly sourceSet:{readonly sha256:string; readonly files:readonly FilePin[]};
  readonly dependencySet:{readonly sha256:string;readonly files:readonly FilePin[]};
  readonly registry:FilePin; readonly environment:FilePin; readonly runtime:FilePin&{readonly version:string};
  readonly provider:{readonly image:string; readonly socket:string; readonly database:string; readonly username:string};
  readonly executor:ProcessBinding&{readonly uid:0}; readonly controller:ProcessBinding;
  readonly environmentSha256:string;
  readonly invitationPipe:{readonly writeFd:number; readonly readFd:number; readonly device:number; readonly inode:number}|null;
  readonly predecessor:{readonly phase:Phase; readonly process:ProcessBinding; readonly stopReceipt:FilePin}|null;
  readonly qualification?:QualificationPlan;
  readonly dependencyWriterSchedule?:DependencyWriterSchedule;
}
function failure(code='isolated_config_required'):never {throw Error(code);}
function deepFreeze<T>(value:T):T {
  if(value&&typeof value==='object'){for(const child of Object.values(value))deepFreeze(child);Object.freeze(value);}
  return value;
}
const object=(v:unknown):Record<string,unknown>=>{
  if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v)))return failure();
  return v as Record<string,unknown>;
};
function keys(v:Record<string,unknown>, expected:readonly string[]):void {
  if(Object.keys(v).length!==expected.length||expected.some(k=>!Object.hasOwn(v,k)))failure();
}
function text(v:unknown, pattern=/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/):asserts v is string {
  if(typeof v!=='string'||!pattern.test(v))failure();
}
function positive(v:unknown):asserts v is number {if(!Number.isSafeInteger(v)||typeof v!=='number'||v<1)failure();}
function hash(v:unknown):asserts v is string {text(v,/^[a-f0-9]{64}$/);}
function canonicalPath(v:unknown):asserts v is string {
  if(typeof v!=='string'||!isAbsolute(v)||resolve(v)!==v||v.includes('\0'))failure();
}
function pin(v:unknown):FilePin {
  const x=object(v);keys(x,['path','sha256','bytes']);text(x.path,/^[A-Za-z0-9_./-]+$/);hash(x.sha256);
  if(typeof x.bytes!=='number'||!Number.isSafeInteger(x.bytes)||x.bytes<1)failure();
  return {path:x.path,sha256:x.sha256,bytes:x.bytes};
}
function processBinding(v:unknown):ProcessBinding {
  const x=object(v);keys(x,['pid','startTicks']);positive(x.pid);positive(x.startTicks);return {pid:x.pid,startTicks:x.startTicks};
}
export function sourceSetDigest(files:readonly FilePin[]):string {
  const sorted=files.map(p=>({path:p.path,sha256:p.sha256,bytes:p.bytes})).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
}
export function authPhasePolicy(phase:Phase,operation:Operation):{authDirectory:'auth-a'|'auth-b';expected:'ABSENT'|'BOOTSTRAP'|'REGISTERED'} {
  if(operation==='AUTH_INIT'&&phase!=='A0'&&phase!=='B0')failure('auth_reinitialization_prohibited');
  return {authDirectory:phase==='B0'?'auth-b':'auth-a',expected:operation==='AUTH_INIT'?'ABSENT':phase==='A0'||phase==='B0'?'BOOTSTRAP':'REGISTERED'};
}
/** Pure, closed validation precedes every runtime read or effect. */
export function validateConfiguration(value:unknown,mode:'HELPER'|'MIGRATE'='HELPER'):QualificationConfiguration {
  const x=object(value);
  keys(x,['schema','status','consumerProfile','consumerProfileDigest','effectiveContracts','operation','phase','runId','occurrenceId','ownerId','serviceInstanceRef','hostname','port','worktree','taskDirectory','metadataDirectory','authFile','authSha256','sourceSet','dependencySet','registry','environment','runtime','provider','executor','controller','environmentSha256','invitationPipe','predecessor',...(Object.hasOwn(x,'dependencyWriterSchedule')?['dependencyWriterSchedule']:[]),...(Object.hasOwn(x,'qualification')?['qualification']:[]),...(Object.hasOwn(x,'cursorOwnerBinding')?['cursorOwnerBinding']:[])]);
  if(x.schema!=='isolated-native-qualification.v2'||x.status!=='SEALED'||!['AUTH_INIT','START'].includes(String(x.operation))||!['A0','B0','A1','P-RESTART','OLD-SECTION','CURRENT-RESTORED'].includes(String(x.phase)))failure();
  const operation:Operation=x.operation==='AUTH_INIT'?'AUTH_INIT':'START';
  const phase=x.phase as Phase;
  if(x.consumerProfile!=='CURRENT_1_1'&&x.consumerProfile!=='OLD_SECTION_1_0')failure();
  const consumerProfile=x.consumerProfile,profile=fixedConsumerProfile(consumerProfile);
  if(x.consumerProfileDigest!==profile.pins.consumerProfileDigest||(phase==='OLD-SECTION')!==(consumerProfile==='OLD_SECTION_1_0')||consumerProfile==='OLD_SECTION_1_0'&&operation!=='START')failure();
  const closure=object(x.effectiveContracts);keys(closure,['manifest','artifacts']);const manifest=pin(closure.manifest);
  if(JSON.stringify(manifest)!==JSON.stringify(selectedProtocolClosure.selectedManifest)||!Array.isArray(closure.artifacts))failure();
  const artifacts=closure.artifacts.map(pin);if(artifacts.length!==9||artifacts.some((artifact,index)=>JSON.stringify(artifact)!==JSON.stringify(selectedProtocolClosure.artifacts[index])))failure();
  if(x.runId!==isolatedTarget.runId||x.taskDirectory!==isolatedTarget.directory||x.worktree!==isolatedTarget.worktree||x.hostname!==isolatedTarget.hostname||x.port!==isolatedTarget.port)failure();
  text(x.occurrenceId);text(x.ownerId,/^synthetic-[A-Za-z0-9_-]{1,100}$/);text(x.serviceInstanceRef);
  canonicalPath(x.metadataDirectory);
  if(!isDirectPhaseMetadataDirectory(x.metadataDirectory))failure();
  const policy=authPhasePolicy(phase,operation);
  if(x.authFile!==join(isolatedTarget.directory,policy.authDirectory,'web-auth.json'))failure();
  if(operation==='AUTH_INIT'||mode==='MIGRATE'){if(x.authSha256!==null||mode==='MIGRATE'&&(operation!=='START'||phase!=='A0'))failure();}else hash(x.authSha256);
  const ss=object(x.sourceSet);keys(ss,['sha256','files']);hash(ss.sha256);
  if(!Array.isArray(ss.files)||ss.files.length<requiredSourcePaths.length||ss.files.length>1000)failure();
  const files=ss.files.map(pin), paths=new Set(files.map(p=>p.path));
  if(paths.size!==files.length||files.length!==requiredSourcePaths.length||requiredSourcePaths.some(p=>!paths.has(p))||files.some(p=>isAbsolute(p.path)||p.path.split('/').some(c=>!c||c==='.'||c==='..')||(!p.path.endsWith('.ts')&&p.path!==fixedRunnerPaths.CONTROLLER)||(!requiredSourcePaths.includes(p.path)&&!p.path.startsWith(academy+'src/')&&!p.path.startsWith('apps/academy/gang-a/packages/')&&![academy+'harness/academy_private_io.ts',academy+'docs/teacher-exam-selection-contract.ts'].includes(p.path)))||sourceSetDigest(files)!==ss.sha256)failure();
  const ds=object(x.dependencySet);keys(ds,['sha256','files']);hash(ds.sha256);
  if(!Array.isArray(ds.files)||ds.files.length!==requiredZodPins.length)failure();
  const dependencyFiles=ds.files.map(pin);if(dependencyFiles.some(p=>!requiredZodPins.some(x=>x.path===p.path&&x.sha256===p.sha256&&x.bytes===p.bytes)))failure('exact_complete_zod_pins_required');
  if(new Set(dependencyFiles.map(p=>p.path)).size!==dependencyFiles.length||dependencyFiles.some(p=>!dependencyTargets.some(t=>p.path.startsWith(t.target+'/'))||resolve(p.path)!==p.path||!/\.(?:js|mjs|json)$/.test(p.path))||!dependencyFiles.some(p=>p.path===dependencyTargets[1]!.target+'/zod/package.json')||sourceSetDigest(dependencyFiles)!==ds.sha256)failure();
  const registry=pin(x.registry),environment=pin(x.environment),rt=object(x.runtime);keys(rt,['path','sha256','bytes','version']);
  const runtime=pin({path:rt.path,sha256:rt.sha256,bytes:rt.bytes});
  if(registry.path!==profile.definition.registry.path||registry.sha256!==profile.definition.registry.sha256||registry.bytes!==profile.definition.registry.bytes||environment.path!==isolatedTarget.environment||runtime.path!==isolatedTarget.runtime||runtime.sha256!==isolatedTarget.runtimeSha256||rt.version!==isolatedTarget.runtimeVersion)failure();
  const provider=object(x.provider);keys(provider,['image','socket','database','username']);
  if(provider.image!==isolatedTarget.image||provider.socket!==isolatedTarget.providerSocket||provider.database!==isolatedTarget.database||provider.username!==isolatedTarget.username)failure();
  const ex=object(x.executor);keys(ex,['pid','startTicks','uid']);const executor=processBinding({pid:ex.pid,startTicks:ex.startTicks});if(ex.uid!==0)failure();
  const controller=processBinding(x.controller);if(executor.pid===controller.pid)failure();hash(x.environmentSha256);
  let invitationPipe:QualificationConfiguration['invitationPipe']=null;
  if(operation==='AUTH_INIT'){
    const p=object(x.invitationPipe);keys(p,['writeFd','readFd','device','inode']);
    positive(p.writeFd);positive(p.readFd);positive(p.device);positive(p.inode);if(p.writeFd<=2||p.readFd<=2)failure();
    invitationPipe={writeFd:p.writeFd,readFd:p.readFd,device:p.device,inode:p.inode};
  }else if(x.invitationPipe!==null)failure();
  let predecessor:QualificationConfiguration['predecessor']=null;
  const priorPhase=phase==='B0'?'A0':phase==='A1'?'B0':phase==='P-RESTART'?'CURRENT-RESTORED':phase==='OLD-SECTION'?'A1':phase==='CURRENT-RESTORED'?'OLD-SECTION':null;
  if(priorPhase){
    const prev=object(x.predecessor);keys(prev,['phase','process','stopReceipt']);if(prev.phase!==priorPhase)failure();
    const receipt=pin(prev.stopReceipt);canonicalPath(receipt.path);
    if(!receipt.path.startsWith(isolatedTarget.directory+'/phases/')||!receipt.path.endsWith('/stopped.json'))failure();
    predecessor={phase:priorPhase,process:processBinding(prev.process),stopReceipt:receipt};
  }else if(x.predecessor!==null)failure();
  const qualification=x.qualification===undefined?undefined:validateQualificationPlan(x.qualification);
  const dependencyWriterSchedule=x.dependencyWriterSchedule===undefined?undefined:validateDependencyWriterSchedule(x.dependencyWriterSchedule);
  if(dependencyWriterSchedule&&(!qualification||operation!=='START'||phase!=='A1'))failure('writer_schedule_current_a1_only');
  const cursorOwnerBinding=x.cursorOwnerBinding===undefined?undefined:validateCursorOwnerBinding(x.cursorOwnerBinding);
  if(cursorOwnerBinding&&(operation!=='START'||phase==='A0'||phase==='B0'||cursorOwnerBinding.ownerId!==x.ownerId||cursorOwnerBinding.runId!==x.runId||cursorOwnerBinding.occurrenceId!==x.occurrenceId||cursorOwnerBinding.environmentSha256!==x.environmentSha256))failure('exact_cursor_owner_binding_required');
  if(qualification&&(operation!=='START'||phase!=='A1'))failure('qualification_current_a1_only');
  return deepFreeze<QualificationConfiguration>({...(dependencyWriterSchedule?{dependencyWriterSchedule}:{}),...(cursorOwnerBinding?{cursorOwnerBinding}:{}),...(qualification?{qualification}:{}),schema:'isolated-native-qualification.v2',status:'SEALED',consumerProfile,consumerProfileDigest:profile.pins.consumerProfileDigest,effectiveContracts:{manifest,artifacts},operation,phase,runId:isolatedTarget.runId,occurrenceId:x.occurrenceId,ownerId:x.ownerId,serviceInstanceRef:x.serviceInstanceRef,hostname:'127.0.0.1',port:38743,worktree:isolatedTarget.worktree,taskDirectory:isolatedTarget.directory,metadataDirectory:x.metadataDirectory,authFile:x.authFile,authSha256:x.authSha256===null?null:String(x.authSha256),sourceSet:{sha256:ss.sha256,files},dependencySet:{sha256:ds.sha256,files:dependencyFiles},registry,environment,runtime:{...runtime,version:isolatedTarget.runtimeVersion},provider:{image:isolatedTarget.image,socket:isolatedTarget.providerSocket,database:isolatedTarget.database,username:isolatedTarget.username},executor:{...executor,uid:0},controller,environmentSha256:x.environmentSha256,invitationPipe,predecessor});
}

/** Pure typed validation is not owner qualification or a permission. */
export function validateCursorOwnerBinding(value:unknown):CursorOwnerBinding {
 const x=object(value);keys(x,['schema','interfaceId','ownerId','runId','principalRef','authorityRef','recipientAdmissionRef','deadlines','pipe','sourceReviewSha256','environmentSha256','occurrenceId']);
 if(x.schema!=='root-cursor-owner-binding.v1')failure('cursor_owner_binding_required');
 for(const key of ['interfaceId','ownerId','runId','occurrenceId'])text(x[key]);
 for(const key of ['sourceReviewSha256','environmentSha256'])hash(x[key]);
 for(const ref of [x.principalRef,x.authorityRef,x.recipientAdmissionRef])validateNativeRef(ref as NativeObjectRef);
 const pipe=object(x.pipe);keys(pipe,['readFd','writeFd','device','inode']);for(const v of Object.values(pipe))positive(v);if(Number(pipe.readFd)<=2||Number(pipe.writeFd)<=2)failure('cursor_owner_pipe_required');
 if(!Array.isArray(x.deadlines)||x.deadlines.length!==cursorDeadlineDimensions.length)failure('all_cursor_deadline_dimensions_required');
 const seen=new Set<string>();
 for(const raw of x.deadlines){const d=object(raw);keys(d,['dimension','disposition','expiresAt','provenance']);
  if(!cursorDeadlineDimensions.includes(d.dimension as never)||seen.has(String(d.dimension)))failure('all_cursor_deadline_dimensions_required');seen.add(String(d.dimension));validateNativeRef(d.provenance as NativeObjectRef);
  if(d.disposition==='APPLICABLE'){if(typeof d.expiresAt!=='string')failure('qualified_cursor_deadline_required');assertInstant(d.expiresAt);}else if(d.disposition!=='NOT_APPLICABLE'||d.expiresAt!==null)failure('qualified_cursor_deadline_required');
 }
 return deepFreeze(x as unknown as CursorOwnerBinding);
}
function assertCursorOwnerRootSeal(i:VerifiedInvocation):CursorOwnerBinding {
 assertVerified(i);const c=i.config,b=c.cursorOwnerBinding;if(!b)failure('cursor_owner_binding_required');
 const path=join(c.metadataDirectory,'admission.json');privateFile(path);const a=JSON.parse(readPinnedFile('/',{path,sha256:i.admissionSha256,bytes:lstatSync(path).size}).toString('utf8'));validateAdmission(c,a,i.manifestSha256);
 if(a.reviewSha256!==b.sourceReviewSha256||process.pid!==c.executor.pid||startTicks(process.pid)!==c.executor.startTicks||startTicks(c.controller.pid)!==c.controller.startTicks)failure('exact_cursor_owner_seal_required');
 const p=b.pipe,s=fstatSync(p.readFd),own=readlinkSync('/proc/self/fd/'+p.readFd),peer=readlinkSync('/proc/'+c.controller.pid+'/fd/'+p.writeFd);
 const access=(path:string)=>Number.parseInt(readFileSync(path,'utf8').match(/^flags:\s+(\d+)$/m)?.[1]??'',8)&3;
 if(!s.isFIFO()||s.dev!==p.device||s.ino!==p.inode||!/^pipe:\[\d+\]$/.test(own)||own!==peer||access('/proc/self/fdinfo/'+p.readFd)!==0||access('/proc/'+c.controller.pid+'/fdinfo/'+p.writeFd)!==1)failure('exact_cursor_owner_pipe_required');
 if(b.deadlines.some(d=>d.disposition==='APPLICABLE'&&Date.parse(d.expiresAt!)<=Date.now()))failure('cursor_owner_deadline_expired');
 return b;
}

function noSymlinkComponents(path:string):void {
  canonicalPath(path);let current='/';
  for(const part of path.split('/').filter(Boolean)){current=join(current,part);if(lstatSync(current).isSymbolicLink())failure('isolated_path_required');}
}
/** Pinned code may have package-manager hardlinks. Private auth/config/receipt
 * callers must separately pass privateFile; their single-link rule is unchanged. */
export function readPinnedFile(root:string,p:FilePin):Buffer {
  const path=isAbsolute(p.path)?p.path:resolve(root,p.path);noSymlinkComponents(path);
  const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);
  try{const st=fstatSync(fd);if(!st.isFile()||st.size!==p.bytes)failure('source_pin_mismatch');const b=readFileSync(fd);if(createHash('sha256').update(b).digest('hex')!==p.sha256)failure('source_pin_mismatch');return b;}finally{closeSync(fd);}
}
function privateDirectory(path:string):void {
  noSymlinkComponents(path);const s=lstatSync(path);
  if(!s.isDirectory()||s.uid!==process.getuid!()||(s.mode&0o777)!==0o700)failure('private_directory_required');
}
function privateFile(path:string):void {
  privateDirectory(dirname(path));const s=lstatSync(path);
  if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1||s.uid!==process.getuid!()||(s.mode&0o777)!==0o600||s.size>262144)failure('private_file_required');
}
function syncDirectory(path:string):void {const fd=openSync(path,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);try{fsyncSync(fd);}finally{closeSync(fd);}}
/** Used for exact one-shot metadata/auth files. Failure never removes or retries a possibly written file. */
export function writeExclusivePrivateJson(path:string,value:unknown):void {
  privateDirectory(dirname(path));const fd=openSync(path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
  try{const s=fstatSync(fd);if(!s.isFile()||s.nlink!==1||s.uid!==process.getuid!()||(s.mode&0o777)!==0o600)failure('private_file_required');writeFileSync(fd,JSON.stringify(value)+'\n');fsyncSync(fd);}finally{closeSync(fd);}
  syncDirectory(dirname(path));
}
export const fixedStageOrder=Object.freeze(['MIGRATE','A0','B0','A1-SETUP','A1-BASE','A1-DETACH','A1-AFTER','CLOSE-CURRENT','A-OLD-SECTION','CLOSE-OLD','A2-CURRENT','P-SNAPSHOT','P-ACTOR','RESTORE-A','P-RESTART','P-RETIRE-A','SEAL-CUSTODY-CLEANUP'] as const);
export type FixedStage=typeof fixedStageOrder[number];
export type FixedRunner='MIGRATE'|'FIXTURE'|'MEASURE';
export interface RunnerPipe {readonly readFd:number;readonly writeFd:number;readonly device:number;readonly inode:number}
export interface FixedRunnerConfiguration {
 readonly schema:'fixed-native-runner.v2';readonly status:'SEALED';readonly kind:FixedRunner;readonly stage:FixedStage;
 readonly base:QualificationConfiguration;readonly input:RunnerPipe;readonly output:RunnerPipe;
 readonly inputSha256:string;readonly inputByteLength:number;
 readonly resourceSelection:FilePin;readonly bootstrapSelection:FilePin;
 readonly liveHelper:ProcessBinding|null;readonly helperStartReceipt:FilePin|null;
 readonly previousStageReceipt:FilePin|null;readonly windowState:'CLOSED';
}
export interface FixedRunnerInvocation {readonly config:FixedRunnerConfiguration;readonly manifestSha256:string;readonly admissionSha256:string;readonly assertCurrent:()=>void;readonly readMemory:()=>Promise<Record<string,unknown>>;readonly claim:()=>void}
const runnerWitnesses=new WeakSet<object>();
export function assertFixedRunner(i:FixedRunnerInvocation,kind:FixedRunner):void {if(!runnerWitnesses.has(i)||i.config.kind!==kind)failure('verified_fixed_runner_required');i.assertCurrent();}
/** Pure closed two-profile sealed-environment validation. One immutable
 * environment binds both fixed profile registries for an entire run; the
 * selected profile registry pin must still match exactly. Legacy singular
 * registrySha256 evidence is never accepted. No effect is admitted. */
export function validateSealedEnvironment(value:unknown,selected:{consumerProfile:ConsumerProfileId;registrySha256:string;sourceSetSha256:string;runId:string;ownerId:string}):void {
  const env=object(value);
  if(env.status!=='SEALED_FOR_EXACT_NATIVE_OCCURRENCES'||env.runId!==selected.runId||env.ownerId!==selected.ownerId||env.sourceSetSha256!==selected.sourceSetSha256||Object.hasOwn(env,'registrySha256'))failure('exact_environment_successor_required');
  const rawMap=env.registrySha256ByProfile;
  if(!rawMap||typeof rawMap!=='object'||Array.isArray(rawMap))failure('exact_environment_successor_required');
  const byProfile=rawMap as Record<string,unknown>;
  if(Object.keys(byProfile).length!==2||!Object.hasOwn(byProfile,'CURRENT_1_1')||!Object.hasOwn(byProfile,'OLD_SECTION_1_0'))failure('exact_environment_successor_required');
  for(const id of ['CURRENT_1_1','OLD_SECTION_1_0'] as const){const v=byProfile[id];if(typeof v!=='string'||!/^[a-f0-9]{64}$/.test(v)||v!==fixedConsumerProfile(id).definition.registry.sha256)failure('exact_environment_successor_required');}
  if(typeof selected.registrySha256!=='string'||!/^[a-f0-9]{64}$/.test(selected.registrySha256)||byProfile[selected.consumerProfile]!==selected.registrySha256)failure('exact_environment_successor_required');
}
/** Closed pure parsing is available for inert source tests. It does not admit an effect. */
export function validateFixedRunner(value:unknown):FixedRunnerConfiguration {
 const x=object(value);keys(x,['schema','status','kind','stage','base','input','output','inputSha256','inputByteLength','resourceSelection','bootstrapSelection','liveHelper','helperStartReceipt','previousStageReceipt','windowState']);hash(x.inputSha256);
 if(!Number.isSafeInteger(x.inputByteLength)||Number(x.inputByteLength)<1||Number(x.inputByteLength)>16777216)failure('sealed_input_length_required');
 if(x.schema!=='fixed-native-runner.v2'||x.status!=='SEALED'||!['MIGRATE','FIXTURE','MEASURE'].includes(String(x.kind))||!fixedStageOrder.includes(x.stage as FixedStage)||x.windowState!=='CLOSED')failure('fixed_runner_config_required');
 const kind=x.kind as FixedRunner,stage=x.stage as FixedStage,base=validateConfiguration(x.base,kind==='MIGRATE'?'MIGRATE':'HELPER');
 if(base.operation!=='START'||base.ownerId!=='synthetic-p4-e2e-p4-native-20261027-52'||(kind==='MIGRATE')!==(stage==='MIGRATE')||kind==='FIXTURE'&&!['A0','B0','A1-SETUP','A1-DETACH','P-SNAPSHOT','P-ACTOR','RESTORE-A','P-RETIRE-A'].includes(stage)||kind==='MEASURE'&&!['A1-BASE','A1-AFTER','A-OLD-SECTION','A2-CURRENT','P-SNAPSHOT','P-ACTOR','RESTORE-A','P-RESTART'].includes(stage))failure('fixed_runner_config_required');
 if((stage==='A-OLD-SECTION')!==(base.consumerProfile==='OLD_SECTION_1_0')||stage==='A-OLD-SECTION'&&base.phase!=='OLD-SECTION'||stage==='A2-CURRENT'&&base.phase!=='CURRENT-RESTORED'||stage==='P-RESTART'&&base.phase!=='P-RESTART')failure('fixed_runner_profile_stage_required');
 const rp=(v:unknown):RunnerPipe=>{const p=object(v);keys(p,['readFd','writeFd','device','inode']);for(const z of Object.values(p))positive(z);if(Number(p.readFd)<=2||Number(p.writeFd)<=2)failure();return p as unknown as RunnerPipe;};
 const resourceSelection=pin(x.resourceSelection),bootstrapSelection=pin(x.bootstrapSelection);
 if(resourceSelection.path!=='reports/p4-p5-execution/claude-takeover-20261027/gen84/candidate/bindings/resource-names.v1.json'||resourceSelection.sha256!=='43e2f06ae901e86ca1e503a74a62776857438ca296a8a830d676d6c2918d4bc7'||resourceSelection.bytes!==6820||bootstrapSelection.path!=='reports/p4-p5-execution/claude-takeover-20261027/gen84/candidate/bindings/bootstrap-selection.v1.json'||bootstrapSelection.sha256!=='e7d1b9394b08d5439f612e9bbe21b06b40b2516248c0fff470a1a0b2ed147d2b'||bootstrapSelection.bytes!==3983)failure('exact_resource_selection_required');
 const liveHelper=x.liveHelper===null?null:processBinding(x.liveHelper),helperStartReceipt=x.helperStartReceipt===null?null:pin(x.helperStartReceipt),previousStageReceipt=x.previousStageReceipt===null?null:pin(x.previousStageReceipt);
 if(kind==='MIGRATE'&&(liveHelper!==null||helperStartReceipt!==null)||kind!=='MIGRATE'&&(!liveHelper||!helperStartReceipt)||stage!=='MIGRATE'&&!previousStageReceipt)failure('fixed_runner_config_required');
 return deepFreeze({schema:'fixed-native-runner.v2',status:'SEALED',kind,stage,base,input:rp(x.input),output:rp(x.output),inputSha256:x.inputSha256,inputByteLength:Number(x.inputByteLength),resourceSelection,bootstrapSelection,liveHelper,helperStartReceipt,previousStageReceipt,windowState:'CLOSED'});
}

type NativeMemory=Record<string,unknown>;
function scopeAnchor(memory:NativeMemory):Record<string,unknown>|null {
 const anchor=memory['root.scopeRef'];
 if(anchor===undefined)return null;
 if(!anchor||typeof anchor!=='object'||Array.isArray(anchor)||Object.hasOwn(anchor,'$scopeRef'))throw Error('private_scope_anchor_required');
 return anchor as Record<string,unknown>;
}
function checkScopeMarker(value:Record<string,unknown>):boolean {
 if(!Object.hasOwn(value,'$scopeRef'))return false;
 if(Object.keys(value).length!==1||value.$scopeRef!=='root.scopeRef')throw Error('private_scope_marker_required');
 return true;
}
function rehydratePrivateMemoryScopes(memory:NativeMemory):NativeMemory {
 const anchor=scopeAnchor(memory);
 const restore=(value:unknown):unknown=>{
  if(Array.isArray(value))return value.map(restore);
  if(value&&typeof value==='object'){
   const record=value as Record<string,unknown>;
   if(checkScopeMarker(record)){if(!anchor)throw Error('private_scope_anchor_required');return structuredClone(anchor);}
   return Object.fromEntries(Object.entries(record).map(([k,v])=>[k,restore(v)]));
  }return value;
 };
 return Object.fromEntries(Object.entries(memory).map(([k,v])=>[k,k==='root.scopeRef'?v:restore(v)])) as NativeMemory;
}
/** Private reader: only its loader closure can release claim capability. */
async function readSealedNativeMemory(c:FixedRunnerConfiguration,assertCurrent:()=>void):Promise<NativeMemory> {
 const n=c.inputByteLength;
 if(!Number.isSafeInteger(n)||n<1||n>16777216||!/^[a-f0-9]{64}$/.test(c.inputSha256))failure('sealed_input_length_or_hash_required');
 assertCurrent();const raw=Buffer.alloc(n),fd=c.input.readFd;let offset=0;
 const deadline=Date.now()+1500000;
 while(offset<n){
  assertCurrent();if(Date.now()>=deadline)failure('sealed_input_deadline_reconcile_no_retry');
  let count:number;
  try{count=readSync(fd,raw,offset,n-offset,null);}catch(error){
   if(['EAGAIN','EWOULDBLOCK'].includes(String((error as NodeJS.ErrnoException).code))){await Bun.sleep(5);continue;}throw error;
  }
  if(count===0)failure('sealed_input_early_eof');offset+=count;
 }
 const extra=Buffer.alloc(1);
 try{if(readSync(fd,extra,0,1,null)>0)failure('sealed_input_surplus');}
 catch(error){if(!['EAGAIN','EWOULDBLOCK'].includes(String((error as NodeJS.ErrnoException).code)))throw error;}
 if(createHash('sha256').update(raw).digest('hex')!==c.inputSha256)failure('private_pipe_bound_or_pin');
 const value:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));
 if(!value||typeof value!=='object'||Array.isArray(value))failure('private_memory_required');
 const memory=rehydratePrivateMemoryScopes(value as NativeMemory);assertCurrent();return memory;
}

function checkRunnerPipes(c:FixedRunnerConfiguration):void {
 for(const [p,direction] of [[c.input,'read'],[c.output,'write']] as const){
  const own=direction==='read'?p.readFd:p.writeFd,other=direction==='read'?p.writeFd:p.readFd;
  const s=fstatSync(own),link=readlinkSync('/proc/self/fd/'+own),peer=readlinkSync('/proc/'+c.base.controller.pid+'/fd/'+other);
  const ownFlags=Number.parseInt(readFileSync('/proc/self/fdinfo/'+own,'utf8').match(/^flags:\s+(\d+)$/m)?.[1]??'',8)&3;
  const peerFlags=Number.parseInt(readFileSync('/proc/'+c.base.controller.pid+'/fdinfo/'+other,'utf8').match(/^flags:\s+(\d+)$/m)?.[1]??'',8)&3;
  if(!s.isFIFO()||s.dev!==p.device||s.ino!==p.inode||!/^pipe:\[\d+\]$/.test(link)||peer!==link||ownFlags!==(direction==='read'?0:1)||peerFlags!==(direction==='read'?1:0))failure('exact_runner_pipe_required');
 }
}
/** Root seals the actual blocked child's PID/start before the fixed Python
 * launcher execs it. All original outcomes/claims stay durable on failure. */
export function loadFixedRunnerInvocation(args:readonly string[],kind:FixedRunner):FixedRunnerInvocation {
 if(args.length!==6||args[0]!=='--manifest'||args[2]!=='--manifest-sha256'||args[4]!=='--admission-sha256')failure('fixed_runner_argv_required');
 const path=args[1]!,manifestSha256=args[3]!,admissionSha256=args[5]!;hash(manifestSha256);hash(admissionSha256);canonicalPath(path);privateFile(path);
 const raw=readPinnedFile('/',{path,sha256:manifestSha256,bytes:lstatSync(path).size});
 const config=validateFixedRunner(JSON.parse(raw.toString('utf8'))),b=config.base;
 if(config.kind!==kind||path!==join(b.metadataDirectory,'config.json'))failure('fixed_runner_config_required');
 const admissionPath=join(b.metadataDirectory,'admission.json');privateFile(admissionPath);
 const assertCurrent=()=>{
  readPinnedFile('/',{path,sha256:manifestSha256,bytes:raw.length});
  const admission=object(JSON.parse(readPinnedFile('/',{path:admissionPath,sha256:admissionSha256,bytes:lstatSync(admissionPath).size}).toString('utf8')));
  keys(admission,['schema','decision','authorityEpoch','kind','stage','manifestSha256','sourceSetSha256','dependencySetSha256','reviewSha256','environmentSha256','runId','ownerId','occurrenceId','executor','controller','issuedAt','expiresAt']);
  if(admission.schema!=='root-fixed-runner-admission.v1'||admission.decision!=='GO_EXACT_OCCURRENCE'||admission.authorityEpoch!==11||admission.kind!==kind||admission.stage!==config.stage||admission.manifestSha256!==manifestSha256||admission.sourceSetSha256!==b.sourceSet.sha256||admission.dependencySetSha256!==b.dependencySet.sha256||admission.environmentSha256!==b.environment.sha256||admission.runId!==b.runId||admission.ownerId!==b.ownerId||admission.occurrenceId!==b.occurrenceId)failure('exact_root_runner_admission_required');
  hash(admission.reviewSha256);
  if(JSON.stringify(processBinding(admission.executor))!==JSON.stringify({pid:b.executor.pid,startTicks:b.executor.startTicks})||JSON.stringify(processBinding(admission.controller))!==JSON.stringify(b.controller)||Date.parse(String(admission.issuedAt))>Date.now()||!Number.isFinite(Date.parse(String(admission.issuedAt)))||Date.parse(String(admission.expiresAt))<=Date.now()||!Number.isFinite(Date.parse(String(admission.expiresAt))))failure('exact_root_runner_admission_required');
  if(process.pid!==b.executor.pid||startTicks(process.pid)!==b.executor.startTicks||process.ppid!==b.controller.pid||startTicks(b.controller.pid)!==b.controller.startTicks||process.getuid!()!==0||Bun.version!==b.runtime.version||process.execPath!==b.runtime.path||environmentDigest()!==b.environmentSha256)failure('isolated_executor_required');
  checkRunnerPipes(config);
 };
 assertCurrent();privateDirectory(b.taskDirectory);privateDirectory(b.metadataDirectory);
 for(const p of b.sourceSet.files)readPinnedFile(b.worktree,p);
 for(const p of b.dependencySet.files)readPinnedFile('/',p);
 const zod=JSON.parse(readPinnedFile(isolatedTarget.evidenceRoot,{path:'reports/p4-p5-execution/resumption-20261025/runtime/zod-runtime-literal-closure.v1.json',sha256:'c41b474a9bbe8c3aae883a5b9b2fdf6dd87a281479d584e6291375a2682971d9',bytes:106265}).toString('utf8')) as {files:FilePin[]};
 if(zod.files.length!==96||sourceSetDigest(zod.files)!==sourceSetDigest(b.dependencySet.files))failure('complete_unbundled_zod_required');
 for(const p of [b.runtime,b.registry,b.environment,config.resourceSelection,config.bootstrapSelection,b.effectiveContracts.manifest,...b.effectiveContracts.artifacts,...selectedProtocolClosure.baseArtifacts,...selectedCapabilityPins])readPinnedFile(isolatedTarget.evidenceRoot,p);
 const env=object(JSON.parse(readPinnedFile(isolatedTarget.evidenceRoot,b.environment).toString('utf8')));
 validateSealedEnvironment(env,{consumerProfile:b.consumerProfile,registrySha256:b.registry.sha256,sourceSetSha256:b.sourceSet.sha256,runId:b.runId,ownerId:b.ownerId});
 if(config.liveHelper){const h=config.liveHelper;if(startTicks(h.pid)!==h.startTicks)failure('exact_live_helper_required');const receipt=object(JSON.parse(readPinnedFile('/',config.helperStartReceipt!).toString('utf8')));if(receipt.pid!==h.pid||receipt.startTicks!==h.startTicks||receipt.sourceSetSha256!==b.sourceSet.sha256||receipt.ownerId!==b.ownerId||receipt.authFile!==b.authFile||receipt.serviceInstanceRef!==b.serviceInstanceRef||receipt.consumerProfile!==b.consumerProfile)failure('exact_live_helper_required');}
 if(config.previousStageReceipt)readPinnedFile('/',config.previousStageReceipt);
 let claimed=false,inputRead=false,inputVerified=false;
 const readMemory=async()=>{if(inputRead)failure('sealed_input_single_read_required');inputRead=true;const memory=await readSealedNativeMemory(config,assertCurrent);assertCurrent();inputVerified=true;return memory;};
 if(kind==='MIGRATE')assertAbsent(b.authFile);
 const claimRunner=()=>{if(claimed)failure('runner_already_claimed');if(!inputVerified)failure('verified_input_before_claim_required');assertCurrent();writeExclusivePrivateJson(join(b.metadataDirectory,'runner-claim.json'),{schema:'fixed-runner-claim.v1',kind,stage:config.stage,occurrenceId:b.occurrenceId,manifestSha256,pid:process.pid,startTicks:b.executor.startTicks,automaticRetry:false});claimed=true;};
 const i=Object.freeze({config,manifestSha256,admissionSha256,assertCurrent,readMemory,claim:claimRunner});runnerWitnesses.add(i);return i;
}
function startTicks(pid:number):number|null {
  try{const s=readFileSync('/proc/'+pid+'/stat','utf8');return Number(s.slice(s.lastIndexOf(')')+2).split(' ')[19]);}
  catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error;}
}
export function validateAdmission(config:QualificationConfiguration,value:unknown,manifestSha256:string,now=Date.now()):void {
  const a=object(value);keys(a,['schema','decision','consumerProfile','consumerProfileDigest','selectedManifestSha256','authorityEpoch','manifestSha256','sourceSetSha256','dependencySetSha256','registrySha256','runtimeSha256','environmentSha256','helperSha256','reviewSha256','runId','ownerId','occurrenceId','phase','operation','serviceInstanceRef','executor','controller','issuedAt','expiresAt']);
  const helper=config.sourceSet.files.find(p=>p.path===academy+'harness/native_foundations_qualification.ts');
  if(a.schema!=='root-isolated-occurrence-admission.v1'||a.decision!=='GO_EXACT_OCCURRENCE'||a.authorityEpoch!==11||a.manifestSha256!==manifestSha256||a.sourceSetSha256!==config.sourceSet.sha256||a.dependencySetSha256!==config.dependencySet.sha256||a.registrySha256!==config.registry.sha256||a.consumerProfile!==config.consumerProfile||a.consumerProfileDigest!==config.consumerProfileDigest||a.selectedManifestSha256!==config.effectiveContracts.manifest.sha256||a.runtimeSha256!==config.runtime.sha256||a.environmentSha256!==config.environment.sha256||a.helperSha256!==helper?.sha256)failure('exact_root_admission_required');
  hash(a.reviewSha256);
  for(const k of ['runId','ownerId','occurrenceId','phase','operation','serviceInstanceRef'] as const)if(a[k]!==config[k])failure('exact_root_admission_required');
  const ex=processBinding(a.executor),controller=processBinding(a.controller);
  if(ex.pid!==config.executor.pid||ex.startTicks!==config.executor.startTicks||controller.pid!==config.controller.pid||controller.startTicks!==config.controller.startTicks)failure('exact_root_admission_required');
  if(typeof a.issuedAt!=='string'||typeof a.expiresAt!=='string'||!Number.isFinite(Date.parse(a.issuedAt))||!Number.isFinite(Date.parse(a.expiresAt))||Date.parse(a.issuedAt)>now||Date.parse(a.expiresAt)<=now)failure('exact_root_admission_required');
}
const verifiedInvocations=new WeakSet<object>();
const claimedInvocations=new WeakSet<object>();
interface VerifiedInvocation {readonly config:QualificationConfiguration;readonly manifestSha256:string;readonly admissionSha256:string}
function assertVerified(i:VerifiedInvocation):void {if(!verifiedInvocations.has(i))failure('verified_invocation_required');}
function assertAbsent(path:string):void {try{lstatSync(path);}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return;throw e;}failure('expected_absent_required');}
function environmentDigest():string {
  const allowed=['PATH','LANG','LC_ALL','TZ','TMPDIR'];
  if(Object.keys(process.env).some(k=>!allowed.includes(k)))failure('isolated_environment_required');
  return createHash('sha256').update(JSON.stringify(allowed.filter(k=>process.env[k]!==undefined).sort().map(k=>[k,process.env[k]]))).digest('hex');
}
function checkPredecessor(c:QualificationConfiguration):void {
  if(!c.predecessor)return;
  const prev=c.predecessor;privateFile(prev.stopReceipt.path);const r=object(JSON.parse(readPinnedFile('/',prev.stopReceipt).toString('utf8')));
  if(r.schema!=='isolated-helper-stop.v1'||r.stopped!==true||r.inFlight!==0||r.runId!==c.runId||r.ownerId!==c.ownerId||r.phase!==prev.phase||r.pid!==prev.process.pid||r.startTicks!==prev.process.startTicks||r.sourceSetSha256!==c.sourceSet.sha256||r.consumerProfile!==(prev.phase==='OLD-SECTION'?'OLD_SECTION_1_0':'CURRENT_1_1')||r.registrySha256!==fixedConsumerProfile(prev.phase==='OLD-SECTION'?'OLD_SECTION_1_0':'CURRENT_1_1').definition.registry.sha256||r.consumerProfileDigest!==fixedConsumerProfile(prev.phase==='OLD-SECTION'?'OLD_SECTION_1_0':'CURRENT_1_1').pins.consumerProfileDigest||startTicks(prev.process.pid)===prev.process.startTicks)failure('previous_process_not_settled');
  if(c.phase==='P-RESTART'&&(r.authFile!==c.authFile||r.authSha256!==c.authSha256||r.serviceInstanceRef!==c.serviceInstanceRef))failure('restart_parity_required');
}
function assertPortAbsent():void {
  for(const path of ['/proc/net/tcp','/proc/net/tcp6']){
    const rows=readFileSync(path,'utf8').trim().split('\n').slice(1);
    if(rows.some(row=>{const cols=row.trim().split(/\s+/);return cols[3]==='0A'&&parseInt(cols[1]!.split(':')[1]!,16)===isolatedTarget.port;}))failure('isolated_port_busy');
  }
}
/** Root supplies exact private manifest/admission hashes via non-secret argv.
 * No config/profile/env fallback, implicit initialization, or provider bootstrap. */
export function loadVerifiedInvocation(manifestPath:string,manifestSha256:string,admissionSha256:string):VerifiedInvocation {
  canonicalPath(manifestPath);hash(manifestSha256);hash(admissionSha256);
  if(!manifestPath.startsWith(isolatedTarget.directory+'/phases/')||!manifestPath.endsWith('/config.json'))failure();
  privateFile(manifestPath);const bytes=readFileSync(manifestPath);if(createHash('sha256').update(bytes).digest('hex')!==manifestSha256)failure();
  const config=validateConfiguration(JSON.parse(bytes.toString('utf8')));
  if(manifestPath!==join(config.metadataDirectory,'config.json'))failure();
  const admissionPath=join(config.metadataDirectory,'admission.json');privateFile(admissionPath);const admission=readFileSync(admissionPath);if(createHash('sha256').update(admission).digest('hex')!==admissionSha256)failure('exact_root_admission_required');
  validateAdmission(config,JSON.parse(admission.toString('utf8')),manifestSha256);
  if(process.getuid!()!==config.executor.uid||process.pid!==config.executor.pid||startTicks(process.pid)!==config.executor.startTicks||startTicks(config.controller.pid)!==config.controller.startTicks||Bun.version!==config.runtime.version||process.execPath!==config.runtime.path||environmentDigest()!==config.environmentSha256)failure('isolated_executor_required');
  privateDirectory(config.taskDirectory);privateDirectory(config.metadataDirectory);
  for(const p of config.sourceSet.files)readPinnedFile(config.worktree,p);
  for(const t of dependencyTargets){
    const link=lstatSync(t.link),target=lstatSync(t.target);
    if(!link.isSymbolicLink()||readlinkSync(t.link)!==t.target||!target.isDirectory()||target.isSymbolicLink()||target.dev!==t.device||target.ino!==t.inode)failure('exact_dependency_target_required');
  }
  for(const p of config.dependencySet.files)readPinnedFile('/',p);
  readPinnedFile('/',config.runtime);readPinnedFile(isolatedTarget.evidenceRoot,config.registry);
  for(const artifact of [config.effectiveContracts.manifest,...config.effectiveContracts.artifacts,...selectedProtocolClosure.baseArtifacts,...selectedCapabilityPins,fixedConsumerProfile(config.consumerProfile).definition.function,fixedConsumerProfile(config.consumerProfile).definition.query])readPinnedFile(isolatedTarget.evidenceRoot,artifact);
  const environment=object(JSON.parse(readPinnedFile(isolatedTarget.evidenceRoot,config.environment).toString('utf8')));
  validateSealedEnvironment(environment,{consumerProfile:config.consumerProfile,registrySha256:config.registry.sha256,sourceSetSha256:config.sourceSet.sha256,runId:config.runId,ownerId:config.ownerId});
  checkPredecessor(config);assertAbsent(join(config.metadataDirectory,'claim.json'));
  assertAbsent(join(config.metadataDirectory,config.operation==='START'?'started.json':'auth-initialized.json'));
  assertAbsent(join(config.metadataDirectory,'stopped.json'));
  const policy=authPhasePolicy(config.phase,config.operation);
  if(policy.expected==='ABSENT'){
    assertAbsent(config.authFile);assertAbsent(config.authFile+'.lock');
    try{privateDirectory(dirname(config.authFile));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
    assertInvitationPipe(config);
  }else{
    privateFile(config.authFile);if(createHash('sha256').update(readFileSync(config.authFile)).digest('hex')!==config.authSha256)failure('auth_pin_mismatch');assertAbsent(config.authFile+'.lock');
  }
  assertPortAbsent();
  const invocation=Object.freeze({config,manifestSha256,admissionSha256});verifiedInvocations.add(invocation);return invocation;
}
function assertInvitationPipe(c:QualificationConfiguration):void {
  const p=c.invitationPipe;if(!p)failure('private_operator_pipe_required');
  const s=fstatSync(p.writeFd),link=readlinkSync('/proc/self/fd/'+p.writeFd),reader=readlinkSync('/proc/'+c.controller.pid+'/fd/'+p.readFd);
  const flags=(pid:string,fd:number)=>Number.parseInt(readFileSync('/proc/'+pid+'/fdinfo/'+fd,'utf8').match(/^flags:\s+(\d+)$/m)?.[1]??'',8)&3;
  if(!s.isFIFO()||s.dev!==p.device||s.ino!==p.inode||!/^pipe:\[\d+\]$/.test(link)||reader!==link||flags('self',p.writeFd)!==constants.O_WRONLY||flags(String(c.controller.pid),p.readFd)!==constants.O_RDONLY)failure('private_operator_pipe_required');
}
function claim(i:VerifiedInvocation):void {
  assertVerified(i);
  if(claimedInvocations.has(i))failure('helper_already_claimed');
  // Recheck exact bytes, expiry and live process bindings after awaited imports.
  const fresh=loadVerifiedInvocation(join(i.config.metadataDirectory,'config.json'),i.manifestSha256,i.admissionSha256);
  verifiedInvocations.delete(fresh);claimedInvocations.add(i);
  writeExclusivePrivateJson(join(i.config.metadataDirectory,'claim.json'),{schema:'isolated-helper-claim.v1',runId:i.config.runId,phase:i.config.phase,occurrenceId:i.config.occurrenceId,operation:i.config.operation,manifestSha256:i.manifestSha256,pid:process.pid,startTicks:startTicks(process.pid),automaticRetry:false});
}
/** Separately invoked AUTH_INIT only. Native setup-user owns principal allocation. */
export async function initializeSyntheticAuthentication(i:VerifiedInvocation):Promise<void> {
  assertVerified(i);const c=i.config;if(c.operation!=='AUTH_INIT')failure();authPhasePolicy(c.phase,c.operation);assertInvitationPipe(c);claim(i);
  const parent=dirname(c.authFile);
  try{mkdirSync(parent,{mode:0o700});syncDirectory(dirname(parent));}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}
  privateDirectory(parent);assertAbsent(c.authFile);assertAbsent(c.authFile+'.lock');
  const {createAuthSecrets,secretDigest}=await import('../src/academy/auth');
  const secrets=createAuthSecrets();
  const state:ProductAuthState={schemaVersion:1,sessionKey:secrets.sessionKey,invitationDigest:secretDigest(secrets.invitation),identity:null,passwordRecovery:null};
  writeExclusivePrivateJson(c.authFile,state);
  const payload=Buffer.from(secrets.invitation+'\n','utf8');
  // One sub-PIPE_BUF write; a partial/error outcome is UNKNOWN, never replayed.
  if(writeSync(c.invitationPipe!.writeFd,payload)!==payload.length)failure('auth_initialization_outcome_unknown');
  closeSync(c.invitationPipe!.writeFd);
  writeExclusivePrivateJson(join(c.metadataDirectory,'auth-initialized.json'),{schema:'isolated-auth-initialized.v1',runId:c.runId,occurrenceId:c.occurrenceId,phase:c.phase,authFile:c.authFile,authSha256:createHash('sha256').update(readFileSync(c.authFile)).digest('hex'),identity:null,mode:'0600',uid:process.getuid!(),sourceSetSha256:c.sourceSet.sha256,manifestSha256:i.manifestSha256,invitationHandoff:'PRIVATE_OPERATOR_PIPE_NO_LOG',automaticRetry:false});
}

export interface CompositionOptions {
  readonly authLeaseProbe?:(operation:'consumeInvitation'|'registerIdentity',contender:()=>void)=>Promise<void>;
  readonly cursorOwnerBinding?:CursorOwnerBinding;readonly cursorRuntime?:NativeCursorRuntime;
  readonly qualification?:NativeQualificationHooks;readonly consumerProfile?:ConsumerProfileId;readonly ownerId:string;readonly store:TeacherPrerequisiteStore;readonly authStore:TeacherAuthStore;
  readonly registrySha256:string;readonly processNonce:string;readonly sourceSetSha256:string;readonly serviceInstanceRef:string;
}
function cursorRuntimeFor(i:VerifiedInvocation,processNonce:string,actorId:string|undefined):NativeCursorRuntime|undefined {
 const c=i.config,b=c.cursorOwnerBinding;if(!b)return undefined;
 assertCursorOwnerRootSeal(i);if(!actorId)failure('actual_cursor_actor_required');rootCursorBindings.add(b);
 const profile=fixedConsumerProfile(c.consumerProfile),compiler=c.sourceSet.files.find(p=>p.path===academy+'src/academy/nativeTypedRead.ts');
 if(!compiler)failure('actual_compiler_source_pin_required');
 const interfaceBinding=digest({domain:'native-read-interface/v1',interfaceId:b.interfaceId,ownerId:c.ownerId,runId:c.runId,processNonce,consumerProfile:c.consumerProfile,consumerProfileDigest:c.consumerProfileDigest,registrySha256:c.registry.sha256,functionSha256:profile.definition.function.sha256,querySha256:profile.definition.query.sha256,compilerSourceSha256:compiler.sha256,sourceSetSha256:c.sourceSet.sha256,contractSupplementSha256:selectedCapabilityPins[0]!.sha256,codecVersion:'academy-native-owner-aes256gcm/v1',integrityProofHandle:'academy-native-owner-aes256gcm/v1',outputPolicyId:nativeTypedReadOutputPolicy.id,maxOutputBytes:nativeTypedReadOutputPolicy.maxOutputBytes});
 const admission=JSON.parse(readFileSync(join(c.metadataDirectory,'admission.json'),'utf8'));
 const deadlines=[Date.parse(admission.expiresAt),...b.deadlines.filter(d=>d.disposition==='APPLICABLE').map(d=>Date.parse(d.expiresAt!))];
 if(deadlines.some(v=>!Number.isFinite(v)))failure('qualified_cursor_deadline_required');
 return Object.freeze({actorId,interfaceBinding,expiryCap:Math.min(...deadlines),context:{runId:c.runId,principalRef:b.principalRef,authorityRef:b.authorityRef,recipientAdmissionRef:b.recipientAdmissionRef},assertCurrent:()=>{if(!rootCursorBindings.has(b))failure('actual_cursor_owner_required');assertCursorOwnerRootSeal(i);}});
}
export type QualificationMode='DUPLICATE'|'DISTINCT'|'BARRIER'|'ENCODING_FAILURE'|'ACK_SUPPRESSION'|'DRIVER_ACK_LOSS'|'EXPIRY'|'TRANSPORT_SUPPRESSION';
export interface QualificationCase {
 readonly id:string;readonly requestId:string;readonly mode:QualificationMode;
 readonly peerRequestId:string|null;readonly barrier:'SHARED_OWNER'|'READ_KEY'|'PREPARED'|'TERMINAL'|null;
}
export interface QualificationPlan {readonly schema:'root-finite-qualification.v1';readonly pipe:RunnerPipe;readonly cases:readonly QualificationCase[]}
export const dependencyWriterOperations=Object.freeze({
 F1:['appendTeacher','appendClassGroup','appendLesson','appendTemporalBinding','appendActivityScope','appendStudentRevision','createProgress','correctProgress','createAssessment','correctAssessment','createDraft','correctDraft','appendScoreEvidence','issueApproval','consumeApproval','revokeApproval'],
 F2:['registerStudent'],F3:['append'],F4:['saveCatalog'],F6:['ADMIT','FINALIZE','GENERIC-CLEANUP'],
} as const);
export interface DependencyWriterCase {
 readonly id:string;readonly family:'F1'|'F2'|'F3'|'F4'|'F6';readonly operation:string;
 readonly disposition:'COMMIT'|'ROLLBACK';readonly ingress:'STORE_API';readonly targetFixtureKey:string;
 readonly expectedBefore:'ABSENT'|'CURRENT_RECEIPT';readonly expectedAfter:'NEW_RECEIPT'|'UNCHANGED';
 readonly readerRequestId:string;readonly barrier:'SHARED_OWNER';
}
export interface DependencyWriterSchedule {
 readonly schema:'root-dependency-writer-schedule.v1';readonly sqlCases:readonly DependencyWriterCase[];
 readonly authLeaseCases:readonly ['consumeInvitation','registerIdentity'];
 readonly exclusions:readonly ['F5:EXCLUDED_EXISTING','F7_RECOVERY4:EXCLUDED_EXISTING','F8:LATE_ROOT_OWNED'];
}
export function dependencyWriterCaseId(family:string,operation:string,disposition:'COMMIT'|'ROLLBACK'):string {
 return family==='F2'?'W-F2-'+(disposition==='COMMIT'?'C':'R'):'W-'+family+'-'+operation+'-'+(disposition==='COMMIT'?'C':'R');
}
export function dependencyStoreOperation(c:DependencyWriterCase):string{
 const names:Record<string,string>={appendTeacher:'append:teacher',appendClassGroup:'append:class',appendLesson:'append:lesson',appendTemporalBinding:'append:binding',appendActivityScope:'append:scope',appendStudentRevision:'append:student',correctProgress:'correctPrerequisiteRecord',correctAssessment:'correctPrerequisiteRecord',correctDraft:'correctPrerequisiteRecord',consumeApproval:'consumeApprovalAndApproveDraft',ADMIT:'admitReadOccurrence',FINALIZE:'finalizeReadOccurrence','GENERIC-CLEANUP':'finalizeReadOccurrence'};
 return names[c.operation]??c.operation;
}
/** The complete fixed matrix is mandatory. No executable body, SQL, callback,
 * provider, principal, clock or path can enter through this sealed data. */
export function validateDependencyWriterSchedule(value:unknown):DependencyWriterSchedule {
 const x=object(value);keys(x,['schema','sqlCases','authLeaseCases','exclusions']);
 if(x.schema!=='root-dependency-writer-schedule.v1'||!Array.isArray(x.sqlCases)||x.sqlCases.length!==44)failure('exact44_writer_cases_required');
 const expected=new Map<string,{family:string;operation:string;disposition:string}>();
 for(const [family,operations] of Object.entries(dependencyWriterOperations))for(const operation of operations)for(const disposition of ['COMMIT','ROLLBACK'] as const)expected.set(dependencyWriterCaseId(family,operation,disposition),{family,operation,disposition});
 const readers=new Set<string>();
 const sqlCases=x.sqlCases.map(value=>{
  const c=object(value);keys(c,['id','family','operation','disposition','ingress','targetFixtureKey','expectedBefore','expectedAfter','readerRequestId','barrier']);
  const e=expected.get(String(c.id));if(!e||c.family!==e.family||c.operation!==e.operation||c.disposition!==e.disposition)failure('fixed_writer_case_required');expected.delete(String(c.id));
  if(c.ingress!=='STORE_API'||c.targetFixtureKey!==c.id||c.readerRequestId!=='W-R-'+c.id||readers.has(String(c.readerRequestId))||c.barrier!=='SHARED_OWNER'||!['ABSENT','CURRENT_RECEIPT'].includes(String(c.expectedBefore))||c.expectedAfter!==(c.disposition==='COMMIT'?'NEW_RECEIPT':'UNCHANGED'))failure('closed_writer_binding_required');
  readers.add(String(c.readerRequestId));return c as unknown as DependencyWriterCase;
 });
 if(expected.size||JSON.stringify(x.authLeaseCases)!==JSON.stringify(['consumeInvitation','registerIdentity'])||JSON.stringify(x.exclusions)!==JSON.stringify(['F5:EXCLUDED_EXISTING','F7_RECOVERY4:EXCLUDED_EXISTING','F8:LATE_ROOT_OWNED']))failure('writer_exclusions_unchanged_required');
 return deepFreeze<DependencyWriterSchedule>({schema:'root-dependency-writer-schedule.v1',sqlCases,authLeaseCases:['consumeInvitation','registerIdentity'],exclusions:['F5:EXCLUDED_EXISTING','F7_RECOVERY4:EXCLUDED_EXISTING','F8:LATE_ROOT_OWNED']});
}
/** Pure closed parser. Neither a parsed plan nor a hash is an admission. */
export function validateQualificationPlan(value:unknown):QualificationPlan {
 const x=object(value);keys(x,['schema','pipe','cases']);
 if(x.schema!=='root-finite-qualification.v1'||!Array.isArray(x.cases)||x.cases.length<1||x.cases.length>32)failure('finite_qualification_plan_required');
 const p=object(x.pipe);keys(p,['readFd','writeFd','device','inode']);for(const v of Object.values(p))positive(v);
 if(Number(p.readFd)<=2||Number(p.writeFd)<=2)failure('finite_qualification_pipe_required');
 const ids=new Set<string>(),requests=new Set<string>();
 const cases=x.cases.map(value=>{
  const c=object(value);keys(c,['id','requestId','mode','peerRequestId','barrier']);text(c.id);text(c.requestId);
  if(ids.has(c.id)||requests.has(c.requestId)||!['DUPLICATE','DISTINCT','BARRIER','ENCODING_FAILURE','ACK_SUPPRESSION','DRIVER_ACK_LOSS','EXPIRY','TRANSPORT_SUPPRESSION'].includes(String(c.mode)))failure('finite_qualification_case_required');
  ids.add(c.id);requests.add(c.requestId);
  if(c.mode==='DISTINCT'){text(c.peerRequestId);if(requests.has(c.peerRequestId))failure();requests.add(c.peerRequestId);}else if(c.peerRequestId!==null)failure();
  if(c.barrier!==null&&!['SHARED_OWNER','READ_KEY','PREPARED','TERMINAL'].includes(String(c.barrier)))failure();
  return c as unknown as QualificationCase;
 });
 return deepFreeze({schema:'root-finite-qualification.v1',pipe:p as unknown as RunnerPipe,cases});
}
/** Only a verified START can install these finite effects. No command name,
 * callback, principal, clock, signer, source row or SQL arrives over HTTP. */
export class PG17BackendFrames {
 private pending:Buffer=Buffer.alloc(0);
 readonly maxBytes=8388608;
 push(bytes:Uint8Array,consume:(frame:Buffer)=>void):void {
  if(this.pending.length+bytes.byteLength>this.maxBytes)failure('relay_buffer_bound');
  this.pending=Buffer.concat([this.pending,bytes]);
  while(this.pending.length>=5){
   const length=this.pending.readUInt32BE(1);
   if(length<4||length+1>this.maxBytes)failure('relay_protocol_frame_refused');
   if(this.pending.length<length+1)return;
   const frame=Buffer.from(this.pending.subarray(0,length+1));
   this.pending=Buffer.from(this.pending.subarray(length+1));consume(frame);
  }
 }
 close():void {this.pending.fill(0);this.pending=Buffer.alloc(0);}
}
interface RelaySink {write(bytes:Uint8Array):number}
/** Source-testable partial-write accounting; no socket or effect on construction. */
export class BoundedRelayQueue {
 private queued:Buffer=Buffer.alloc(0);private sink:RelaySink|undefined;
 constructor(private readonly pause:()=>void,private readonly resume:()=>void,readonly maxBytes=8388608){}
 attach(sink:RelaySink):void {if(this.sink)failure('relay_sink_already_attached');this.sink=sink;this.drain();}
 push(bytes:Uint8Array):void {if(this.queued.length+bytes.byteLength>this.maxBytes)failure('relay_buffer_bound');this.queued=Buffer.concat([this.queued,bytes]);this.drain();}
 drain():void {
  if(this.sink&&this.queued.length){const wrote=this.sink.write(this.queued);if(!Number.isSafeInteger(wrote)||wrote<0||wrote>this.queued.length)failure('relay_write_outcome_unknown');this.queued=Buffer.from(this.queued.subarray(wrote));}
  if(this.queued.length)this.pause();else this.resume();
 }
 get pendingBytes():number{return this.queued.length;}
 close():void {this.queued.fill(0);this.queued=Buffer.alloc(0);this.sink=undefined;}
}
export interface CommitAckArm {readonly requestId:string;readonly backendPid:number;readonly connectionId:number}
/** Pure backend state machine. It never parses SQL or retains cancel secrets. */
export class PG17CommitAckFilter {
 private readonly frames=new PG17BackendFrames();private armed:CommitAckArm|undefined;
 backendPid:number|null=null;private suppressed=false;
 constructor(readonly connectionId:number){}
 arm(requestId:string,backendPid:number):void {
  if(this.armed||this.suppressed||this.backendPid!==backendPid||!requestId||!Number.isSafeInteger(backendPid)||backendPid<1)failure('exact_relay_arm_required');
  this.armed={requestId,backendPid,connectionId:this.connectionId};
 }
 push(bytes:Uint8Array,forward:(frame:Buffer)=>void,lost:(arm:CommitAckArm)=>void):void {
  if(this.suppressed)return;
  this.frames.push(bytes,frame=>{
   if(this.suppressed){frame.fill(0);return;}
   if(frame[0]===75){if(frame.length!==13||this.backendPid!==null)failure('relay_backend_key_refused');this.backendPid=frame.readUInt32BE(5);}
   // CommandComplete is type + Int32 + a NUL-terminated tag. Withhold the
   // COMPLETE frame itself (and any coalesced ReadyForQuery) from the driver.
   if(this.armed&&frame[0]===67&&frame.subarray(5).equals(Buffer.from('COMMIT\0'))){this.suppressed=true;frame.fill(0);lost(this.armed);return;}
   forward(frame);
  });
 }
 close():void {this.frames.close();}
}
interface CommitAckRelay {readonly socket:string;arm(requestId:string,backendPid:number,witness:(metadata:Record<string,unknown>)=>void):void;stop():Promise<void>}
interface RelayConnection {id:number;client:Bun.Socket<RelayConnection>;backend?:Bun.Socket<RelayConnection>;filter:PG17CommitAckFilter;toBackend:BoundedRelayQueue;toClient:BoundedRelayQueue;closed:boolean;witness?:((metadata:Record<string,unknown>)=>void)}
/** This is a future native effect path, entered only after verified START,
 * Root claim, selected finite case, exclusive fixed paths and genuine FD seal.
 * It is never invoked by source checks or module import. */
async function createCommitAckRelay(i:VerifiedInvocation):Promise<CommitAckRelay>{
 assertVerified(i);const c=i.config;
 if(c.operation!=='START'||!c.qualification?.cases.some(q=>q.mode==='DRIVER_ACK_LOSS'))failure('selected_driver_ack_occurrence_required');
 const directory=join(c.taskDirectory,'commit-ack-relay'),socket=join(directory,'.s.PGSQL.5432'),backendSocket=join(c.provider.socket,'.s.PGSQL.5432');
 if(directory!==isolatedTarget.directory+'/commit-ack-relay'||backendSocket!==isolatedTarget.providerSocket+'/.s.PGSQL.5432')failure('fixed_relay_target_required');
 privateDirectory(c.taskDirectory);noSymlinkComponents(c.provider.socket);const providerDirectory=lstatSync(c.provider.socket);
 if(!providerDirectory.isDirectory()||providerDirectory.uid!==999||(providerDirectory.mode&0o777)!==0o700)failure('selected_provider_socket_directory_required');assertAbsent(directory);
 mkdirSync(directory,{mode:0o700});privateDirectory(directory);const ownedDirectory=lstatSync(directory);
 const backendIdentity=lstatSync(backendSocket);if(!backendIdentity.isSocket()||backendIdentity.isSymbolicLink())failure('actual_backend_socket_required');
 const connections=new Map<number,RelayConnection>();let sequence=0,closed=false;
 const close=(s:RelayConnection)=>{if(s.closed)return;s.closed=true;s.filter.close();s.toBackend.close();s.toClient.close();s.client.close();s.backend?.close();connections.delete(s.id);};
 const server=Bun.listen<RelayConnection>({unix:socket,socket:{
  open(client){
   if(closed||connections.size>=5){client.close();return;}
   let state!:RelayConnection;
   state={id:++sequence,client,filter:new PG17CommitAckFilter(sequence),closed:false,toBackend:new BoundedRelayQueue(()=>client.pause(),()=>client.resume()),toClient:new BoundedRelayQueue(()=>state.backend?.pause(),()=>state.backend?.resume())};client.data=state;connections.set(state.id,state);state.toClient.attach(client);
   void Bun.connect<RelayConnection>({unix:backendSocket,data:state,socket:{
    open(upstream){state.backend=upstream;state.toBackend.attach(upstream);},
    data(upstream,data){try{state.filter.push(data,frame=>state.toClient.push(frame),arm=>{state.witness?.({backendPid:arm.backendPid,connectionId:arm.connectionId,requestId:arm.requestId,backendCommand:'COMMIT',driverAckForwarded:false,driverCommitKnown:false,strongerKernelAtomicity:'UNQUALIFIED'});close(state);});}catch{close(state);}},
    drain(){try{state.toBackend.drain();}catch{close(state);}},close(){close(state);},error(){close(state);},connectError(){close(state);}
   }}).catch(()=>close(state));
  },
  data(client,data){const state=client.data;if(!state)return;try{state.toBackend.push(data);}catch{close(state);}},
  drain(client){if(client.data)try{client.data.toClient.drain();}catch{close(client.data);}},
  close(client){if(client.data)close(client.data);},error(client){if(client.data)close(client.data);}
 }});
 const ownedSocket=lstatSync(socket);if(!ownedSocket.isSocket()||ownedSocket.uid!==process.getuid!())failure('owned_relay_socket_required');chmodSync(socket,0o600);
 return {socket:directory,
  arm(requestId,backendPid,witness){
   const selected=c.qualification!.cases.filter(q=>q.mode==='DRIVER_ACK_LOSS'&&q.requestId===requestId);if(selected.length!==1)failure('exact_relay_arm_required');
   const matching=[...connections.values()].filter(s=>!s.closed&&s.filter.backendPid===backendPid);if(matching.length!==1)failure('actual_relay_backend_connection_required');
   const s=matching[0]!;s.filter.arm(requestId,backendPid);s.witness=witness;
  },
  async stop(){if(closed)failure('relay_stop_already_claimed');closed=true;
   // Pool close() returns before the relay observes its sockets closing; drain briefly before judging.
   for(let n=0;n<100&&connections.size!==0;n++)await Bun.sleep(100);
   if(connections.size!==0)failure('relay_connections_pending_reconcile');
   const current=lstatSync(socket),dir=lstatSync(directory);if(current.dev!==ownedSocket.dev||current.ino!==ownedSocket.ino||!current.isSocket()||dir.dev!==ownedDirectory.dev||dir.ino!==ownedDirectory.ino||!dir.isDirectory())failure('owned_relay_cleanup_required');
   server.stop(false);
   let remaining;try{remaining=lstatSync(socket);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
   if(remaining){if(remaining.dev!==ownedSocket.dev||remaining.ino!==ownedSocket.ino||!remaining.isSocket())failure('owned_relay_cleanup_required');unlinkSync(socket);}rmdirSync(directory);
  }
 };
}
function createQualificationHooks(i:VerifiedInvocation,db:SQL,relay?:CommitAckRelay):NativeQualificationHooks {
 assertVerified(i);const c=i.config,plan=c.qualification!;
 const claimed=new Set<string>(),encoded=new Set<string>(),deadlines=new Map<string,number>(),eventCounts=new Map<string,number>(),writerClaims=new Set<string>();let expiryIssued=false;
 const writerCases=c.dependencyWriterSchedule?.sqlCases??[];
 const shared=new Map<string,{backends:Set<number>;release:()=>void;ready:Promise<void>}>();
 const selected=(id:string)=>plan.cases.find(v=>v.requestId===id||v.peerRequestId===id);
 const assertCurrent=()=>{
  const path=join(c.metadataDirectory,'admission.json');privateFile(path);
  validateAdmission(c,JSON.parse(readPinnedFile('/',{path,sha256:i.admissionSha256,bytes:lstatSync(path).size}).toString('utf8')),i.manifestSha256);
  if(process.pid!==c.executor.pid||startTicks(process.pid)!==c.executor.startTicks||startTicks(c.controller.pid)!==c.controller.startTicks)failure('exact_qualification_identity_required');
  const p=plan.pipe,s=fstatSync(p.readFd),own=readlinkSync('/proc/self/fd/'+p.readFd),peer=readlinkSync('/proc/'+c.controller.pid+'/fd/'+p.writeFd);
  const flags=(path:string)=>Number.parseInt(readFileSync(path,'utf8').match(/^flags:\s+(\d+)$/m)?.[1]??'',8)&3;
  if(!s.isFIFO()||s.dev!==p.device||s.ino!==p.inode||!/^pipe:\[\d+\]$/.test(own)||own!==peer||flags('/proc/self/fdinfo/'+p.readFd)!==0||flags('/proc/'+c.controller.pid+'/fdinfo/'+p.writeFd)!==1)failure('exact_qualification_pipe_required');
 };
 const event=(requestId:string,stage:string,metadata:Record<string,unknown>)=>{
  const q=selected(requestId);if(!q)return;
  const eventKey=requestId+':'+stage,count=(eventCounts.get(eventKey)??0)+1;eventCounts.set(eventKey,count);
  // Payload-free, exclusive receipts retain the original one-shot occurrence.
  writeExclusivePrivateJson(join(c.metadataDirectory,'q-'+q.id+'-'+(q.requestId===requestId?'a':'b')+'-'+stage+'-'+count+'.json'),{schema:'finite-native-qualification-witness.v1',caseId:q.id,mode:q.mode,stage,requestId,runId:c.runId,ownerId:c.ownerId,occurrenceId:c.occurrenceId,pid:process.pid,startTicks:c.executor.startTicks,sourceSetSha256:c.sourceSet.sha256,manifestSha256:i.manifestSha256,...metadata,automaticRetry:false});
 };
 return {
  assertCurrent,
  async afterDependencyWrite(operation,ownerId,key,tx){
   const entry=writerCases.find(e=>e.id===key&&dependencyStoreOperation(e)===operation);if(!entry)return;
   assertCurrent();if(ownerId!==c.ownerId||writerClaims.has(entry.id))failure('writer_occurrence_reconcile_no_replay');writerClaims.add(entry.id);
   const backendPid=Number((await tx`SELECT pg_backend_pid() AS pid`)[0]!.pid);
   writeExclusivePrivateJson(join(c.metadataDirectory,'writer-'+entry.id+'.json'),{schema:'actual-dependency-writer-held.v1',id:entry.id,operation,backendPid,runId:c.runId,ownerId,sourceSetSha256:c.sourceSet.sha256,pid:process.pid,startTicks:c.executor.startTicks,exclusiveOwnerHeld:true,actualWorkFinished:true,disposition:entry.disposition});
   // Wait on a separately held fixed schedule key while the actual writer's
   // exclusive owner and narrower locks remain in its genuine transaction.
   await tx`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['p4-writer-release',c.ownerId,entry.id])},0))`;
   assertCurrent();if(entry.disposition==='ROLLBACK')throw Error('QUALIFICATION_WRITER_ROLLBACK');
  },
  outputBudgetExceeded(requestId,actualBytes,maxBytes){
   assertCurrent();text(requestId);if(!Number.isSafeInteger(actualBytes)||actualBytes<=maxBytes||maxBytes!==1048576)failure('actual_output_budget_required');
   writeExclusivePrivateJson(join(c.metadataDirectory,'output-budget-'+requestId+'.json'),{schema:'actual-output-budget.v1',requestId,actualBytes,maxBytes,runId:c.runId,ownerId:c.ownerId,sourceSetSha256:c.sourceSet.sha256,pid:process.pid,startTicks:c.executor.startTicks,clipped:false});
  },
   loginLifetime(){
    const cases=plan.cases.filter(q=>q.mode==='EXPIRY');if(!cases.length||expiryIssued)return undefined;if(cases.length!==1)failure('one_exact_expiry_occurrence_required');assertCurrent();
    const raw=Buffer.alloc(4096);let n:number;
    try{n=readSync(plan.pipe.readFd,raw,0,raw.length,null);}catch(error){if(['EAGAIN','EWOULDBLOCK'].includes((error as NodeJS.ErrnoException).code??''))return undefined;throw error;}
    if(n===0)return undefined;
    try{
     const text=new TextDecoder('utf-8',{fatal:true}).decode(raw.subarray(0,n));if(!text.endsWith('\n')||text.slice(0,-1).includes('\n'))failure('expiry_arm_outcome_unknown');
     const arm=object(JSON.parse(text));keys(arm,['schema','caseId','requestId','ownerId','runId','occurrenceId','sourceSetSha256','pid','startTicks']);
     const q=cases[0]!;if(arm.schema!=='root-fixed-expiry-arm.v1'||arm.caseId!==q.id||arm.requestId!==q.requestId||arm.ownerId!==c.ownerId||arm.runId!==c.runId||arm.occurrenceId!==c.occurrenceId||arm.sourceSetSha256!==c.sourceSet.sha256||arm.pid!==process.pid||arm.startTicks!==c.executor.startTicks)failure('exact_expiry_arm_required');
     assertCurrent();expiryIssued=true;event(q.requestId,'genuine-login-short-lifetime',{lifetimeSeconds:15,clock:'ACTUAL_NATIVE_DEFAULT',oneShot:true});return 15;
    }finally{raw.fill(0);}
   },
  session(id,expiresAt){if(selected(id)){assertCurrent();if(!Number.isSafeInteger(expiresAt))failure();deadlines.set(id,expiresAt*1000);}},
  pairedRequestId(id){const q=selected(id);return q?.mode==='DISTINCT'&&q.requestId===id?q.peerRequestId:null;},
  beforeEncode(id){const q=selected(id);if(!q)return;assertCurrent();if(q.mode==='ENCODING_FAILURE'&&!encoded.has(id)){encoded.add(id);event(id,'encoding-failure',{businessBytesProduced:0});throw Error('qualification_pre_serialization_failure');}},
  async prepared<T>(request:ReadAdmission,commit:()=>Promise<T>):Promise<T>{
   const writer=writerCases.find(e=>e.readerRequestId===request.requestId);
   if(writer){assertCurrent();if(claimed.has(request.requestId))failure('writer_reader_occurrence_consumed');claimed.add(request.requestId);
    // This is the real prepared service closure before commitReadOutput takes
    // its SHARED owner lock. Admission is already durable; no duplicate admit.
    await db.begin(async tx=>{await tx`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['p4-writer-reader-ready',c.ownerId,writer.id])},0))`;});assertCurrent();return commit();}
   const q=selected(request.requestId);if(!q)return commit();assertCurrent();
   if(claimed.has(request.requestId))failure('qualification_case_already_claimed');claimed.add(request.requestId);
   if(q.mode!=='DUPLICATE')return commit();
   const results=await Promise.allSettled([commit(),commit()]);
   const completed=results.filter(v=>v.status==='fulfilled');
   const losers=results.filter(v=>v.status==='rejected'&&v.reason instanceof Error&&v.reason.message==='read_already_terminal_or_unadmitted');
   if(completed.length!==1||losers.length!==1)failure('duplicate_terminal_reconcile_no_replay');
   event(request.requestId,'duplicate',{terminals:1,lookupOnlyLosers:1,preparedCapability:'ACTUAL_SERVICE_CLOSURE',transportCandidates:1});return completed[0]!.value;
  },
  async gate(id,stage,backendPid){
   const writer=writerCases.find(e=>e.readerRequestId===id);
   if(writer){assertCurrent();writeExclusivePrivateJson(join(c.metadataDirectory,'writer-reader-'+writer.id+'-'+stage+'.json'),{schema:'actual-writer-reader-stage.v1',caseId:writer.id,requestId:id,stage,backendPid,runId:c.runId,ownerId:c.ownerId,sourceSetSha256:c.sourceSet.sha256,pid:process.pid,startTicks:c.executor.startTicks});return;}
   const q=selected(id);if(!q)return;assertCurrent();event(id,stage.toLowerCase(),{backendPid});
    if(q.mode==='DRIVER_ACK_LOSS'&&stage==='TERMINAL'){
     if(!relay)failure('exact_commit_ack_relay_required');
     relay.arm(id,backendPid,metadata=>event(id,'driver-ack-loss',metadata));
    }
   if(q.mode==='DISTINCT'&&stage==='SHARED_OWNER'){
    let group=shared.get(q.id);if(!group){let release!:()=>void;const ready=new Promise<void>(r=>{release=r;});group={backends:new Set(),ready,release};shared.set(q.id,group);}
    group.backends.add(backendPid);if(group.backends.size===2)group.release();
    await Promise.race([group.ready,new Promise<never>((_,reject)=>{const timer=setTimeout(()=>reject(Error('distinct_shared_gate_timeout_reconcile')),300000);group!.ready.finally(()=>clearTimeout(timer));})]);
    event(id,'shared-compatible',{backendPids:[...group.backends],authLeaseCount:1,independentReadKeys:true});
   }
   if(q.barrier===stage){
    // The runner holds this separately sealed schedule key. This transaction
    // waits while the real output transaction retains its actual owner/key
    // locks; pg_locks/pg_blocking_pids provide the scheduling witness.
    await db.begin(async tx=>{await tx`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['p4-qualification-barrier',c.ownerId,q.id])},0))`;});
    assertCurrent();event(id,'barrier-released',{backendPid,stage});
   }
  },
  knownCommit(id,status){const q=selected(id);if(!q)return;event(id,'known-commit',{terminalStatus:status,driverCommitKnown:true});assertCurrent();
   if(q.mode==='EXPIRY'){
    const deadline=deadlines.get(id);if(!deadline||deadline<Date.now()-30000||deadline-Date.now()>30000)failure('actual_near_expiry_session_required');
    // Deliberately synchronous actual-time boundary: no await, forged clock,
    // extended session/admission, or business serialization after COMMIT.
    while(Date.now()<=deadline)Bun.sleepSync(Math.min(10,Math.max(1,deadline-Date.now()+1)));
   }
  },
  suppressAcknowledgement(id){const q=selected(id);if(q?.mode!=='ACK_SUPPRESSION')return false;event(id,'ack-suppressed',{driverCommitKnown:true,scope:'OWNER_FACING_ACK_SUPPRESSION_ONLY',strongerDriverCommitUncertainty:'UNQUALIFIED',bufferDisposition:'DISCARDED',replay:false});return true;},
  handoff(id,status,bytes,authorized){const q=selected(id);if(!q)return 'SEND';const suppress=q.mode==='TRANSPORT_SUPPRESSION';event(id,'handoff',{status,preparedBytes:bytes,authorized,emissionDisposition:suppress||!authorized?'NOT_ATTEMPTED':'ATTEMPTED',networkDelivery:'UNKNOWN'});return suppress?'SUPPRESS':'SEND';},
 };
}
/** Pure composition apart from reading the supplied auth file. Source unit tests
 * may supply a fictional read store and private toy auth file, never a verifier,
 * issuer, output-lease substitute, SQL connection, cookie or native principal. */
export async function composeIsolatedHandler(c:CompositionOptions) {
  if((c.cursorOwnerBinding||c.cursorRuntime)&&(!c.cursorOwnerBinding||!c.cursorRuntime||!rootCursorBindings.has(c.cursorOwnerBinding)))failure('actual_cursor_owner_required');
  const [{TeacherApplication},{createTeacherServerHandler,nativePrereqRouteAliases}]=await Promise.all([import('../src/academy/application'),import('../src/academy/server')]);
  const auth=c.authStore.read();
  const app=new TeacherApplication(c.store,c.ownerId,undefined,undefined,c.store);
  const handler=createTeacherServerHandler({app,origin:'http://127.0.0.1:38743',sessionKey:auth.sessionKey,identity:auth.identity,invitationDigest:auth.invitationDigest,
    currentAuthentication:()=>c.authStore.read(),
    consumeInvitation:async()=>{if(!auth.invitationDigest)failure('setup_not_admitted');await c.authLeaseProbe?.('consumeInvitation',()=>c.authStore.consumeInvitation(auth.invitationDigest!));c.authStore.consumeInvitation(auth.invitationDigest);},
    saveIdentity:async identity=>{await c.authLeaseProbe?.('registerIdentity',()=>c.authStore.registerIdentity(identity));c.authStore.registerIdentity(identity);},
    passwordRecovery:{claim:async token=>c.authStore.claimRecovery(token),status:async id=>c.authStore.recoveryStatus(id),complete:async(id,hash)=>c.authStore.completeRecovery(id,hash)},
    buildDescriptor:{sourceSetSha256:c.sourceSetSha256,serviceInstanceRef:c.serviceInstanceRef},
    typedRead:{cursorRuntime:c.cursorRuntime,qualification:c.qualification,consumerProfile:c.consumerProfile??'CURRENT_1_1',sourceSetSha256:c.sourceSetSha256,store:c.store,registrySha256:c.registrySha256,processEpoch:c.processNonce,outputLease:use=>c.authStore.withOutputLease(use)},
  });
  const paths=new Set(['/health','/api/setup-session','/api/setup-user','/api/login','/api/native-read-descriptor','/api/native-read-snapshot','/api/typed-read','/api/native-prerequisite','/api/native-prereq/teachers/update',...Object.keys(nativePrereqRouteAliases)]);
  return {app,fetch:(request:Request):Promise<Response>=>(c.consumerProfile==='OLD_SECTION_1_0'||paths.has(new URL(request.url).pathname))?handler(request):Promise.resolve(new Response('Isolated route unavailable',{status:404}))};
}
/** Native START only; no migrations, fixture allocation, auth initialization,
 * profile loading, source refresh, provider creation, or outbound probes. */
export async function startIsolatedHelper(i:VerifiedInvocation) {
  assertVerified(i);const c=i.config;if(c.operation!=='START')failure();
  const [{TeacherAuthStore},{SQL},{PostgresAcademyStore}]=await Promise.all([import('../src/academy/teacherAuthStore'),import('bun'),import('../src/academy/postgresStore')]);
  const authStore=new TeacherAuthStore(c.authFile),auth=authStore.read(),policy=authPhasePolicy(c.phase,c.operation);
  if((policy.expected==='BOOTSTRAP'&&(auth.identity!==null||!auth.invitationDigest))||(policy.expected==='REGISTERED'&&(!auth.identity||auth.invitationDigest!==null)))failure('auth_phase_mismatch');
  claim(i);
  const processNonce=randomUUID();
  const db=new SQL({adapter:'postgres',path:c.provider.socket,username:c.provider.username,database:c.provider.database,max:5});
  let relay:CommitAckRelay|undefined,ownerDb:SQL=db;
  let closeListener:(()=>Promise<void>)|null=null;
  try{
  const cursorRuntime=cursorRuntimeFor(i,processNonce,auth.identity?.actorId);
  if(c.qualification?.cases.some(q=>q.mode==='DRIVER_ACK_LOSS')){assertCursorOwnerRootSeal(i);relay=await createCommitAckRelay(i);ownerDb=new SQL({adapter:'postgres',path:relay.socket,username:c.provider.username,database:c.provider.database,max:5,tls:false});}
  const qualification=c.qualification?createQualificationHooks(i,db,relay):undefined;
  const store=new PostgresAcademyStore(ownerDb,undefined,qualification);await store.assertRuntimeReady();
  const probed=new Set<string>();
  const authLeaseProbe=c.phase==='A0'?async(operation:'consumeInvitation'|'registerIdentity',contender:()=>void)=>{
    assertVerified(i);if(probed.has(operation))failure('auth_probe_occurrence_consumed');probed.add(operation);
    const before=createHash('sha256').update(readFileSync(c.authFile)).digest('hex');
    await authStore.withOutputLease(async()=>{
      let refused=false;try{contender();}catch(error){refused=error instanceof Error&&error.message==='private_auth_lock_required';if(!refused)throw error;}
      if(!refused||createHash('sha256').update(readFileSync(c.authFile)).digest('hex')!==before)failure('auth_lease_probe_outcome_unknown');
    });
    if(createHash('sha256').update(readFileSync(c.authFile)).digest('hex')!==before)failure('auth_probe_changed_bytes');
    writeExclusivePrivateJson(join(c.metadataDirectory,'auth-lease-'+operation+'.json'),{schema:'auth-lease-no-write-probe.v1',operation,runId:c.runId,occurrenceId:c.occurrenceId,pid:process.pid,startTicks:c.executor.startTicks,sourceSetSha256:c.sourceSet.sha256,beforeSha256:before,afterSha256:before,refusal:'private_auth_lock_required',businessWrites:0,databaseOwnerHeld:false,followingSetup:'DISTINCT_GENUINE_ONCE_NO_REPLAY'});
  }:undefined;
  const composition=await composeIsolatedHandler({authLeaseProbe,cursorOwnerBinding:c.cursorOwnerBinding,cursorRuntime,qualification,consumerProfile:c.consumerProfile,ownerId:c.ownerId,store,authStore,registrySha256:c.registry.sha256,processNonce,sourceSetSha256:c.sourceSet.sha256,serviceInstanceRef:c.serviceInstanceRef});
  let stopping=false,inFlight=0,ready=false;
  const server=Bun.serve({hostname:c.hostname,port:c.port,idleTimeout:255,fetch:async request=>{
    if(stopping||!ready)return new Response('Unavailable',{status:503});inFlight++;
    try{return await composition.fetch(request);}finally{inFlight--;}
  },error:()=>new Response('Isolated operation unavailable',{status:503})});
  closeListener=async()=>{await server.stop(false);};
  const metadata=()=>({consumerProfile:c.consumerProfile,consumerProfileDigest:c.consumerProfileDigest,selectedManifestSha256:c.effectiveContracts.manifest.sha256,runId:c.runId,ownerId:c.ownerId,phase:c.phase,occurrenceId:c.occurrenceId,pid:process.pid,startTicks:startTicks(process.pid),processNonce,serviceInstanceRef:c.serviceInstanceRef,sourceSetSha256:c.sourceSet.sha256,registrySha256:c.registry.sha256,manifestSha256:i.manifestSha256,authFile:c.authFile,authSha256:createHash('sha256').update(readFileSync(c.authFile)).digest('hex'),hostname:c.hostname,port:server.port,automaticRetry:false});
  if(server.port!==c.port||server.hostname!==c.hostname)failure('isolated_listener_mismatch');
  writeExclusivePrivateJson(join(c.metadataDirectory,'started.json'),{schema:'isolated-helper-start.v1',...metadata(),loadedFiles:c.sourceSet.files,dependencySetSha256:c.dependencySet.sha256,runtimeSha256:c.runtime.sha256,environmentSha256:c.environment.sha256});
  ready=true;
  return {async stop(){if(stopping)failure('stop_already_started');stopping=true;const slow=setTimeout(()=>console.error(JSON.stringify({status:'HELPER_STOP_WAITING',inFlight,automaticRetry:false})),20_000);slow.unref?.();await server.stop(false);clearTimeout(slow);if(inFlight!==0)failure('stop_outcome_unknown');if(ownerDb!==db)await ownerDb.close();if(relay)await relay.stop();await db.close();if(c.cursorOwnerBinding)rootCursorBindings.delete(c.cursorOwnerBinding);writeExclusivePrivateJson(join(c.metadataDirectory,'stopped.json'),{schema:'isolated-helper-stop.v1',...metadata(),stopped:true,inFlight:0,relayConnections:0,externalPortAbsence:'REQUIRES_ROOT_OBSERVATION'});}};
  }catch(error){
    // No request dispatch before the durable start receipt. Close only this
    // occurrence's known resources; retain its claim/files for reconciliation.
    if(closeListener)await closeListener();if(ownerDb!==db)await ownerDb.close();if(relay)await relay.stop();await db.close();throw error;
  }
}

if(import.meta.main){
  const run=async()=>{
    const args=process.argv.slice(2);
    if(args.length!==6||args[0]!=='--manifest'||args[2]!=='--manifest-sha256'||args[4]!=='--admission-sha256')failure();
    const invocation=loadVerifiedInvocation(args[1]!,args[3]!,args[5]!);
    if(invocation.config.operation==='AUTH_INIT'){await initializeSyntheticAuthentication(invocation);return;}
    const helper=await startIsolatedHelper(invocation);
    for(const signal of ['SIGTERM','SIGINT'] as const)process.once(signal,()=>{void helper.stop().catch((error)=>{const m=error instanceof Error?error.message:'';const at=error instanceof Error?[...(error.stack??'').matchAll(/\/([A-Za-z_]+\.ts):(\d+):\d+/g)].slice(0,3).map(x=>x[1]+':'+x[2]).join('<'):'';console.error(JSON.stringify({status:'HELPER_STOP_FAILED',code:(/^[A-Za-z0-9_]{1,100}$/.test(m)?m:(error instanceof Error?error.constructor.name:'UNKNOWN'))+(at?'@'+at:''),automaticRetry:false}));process.exitCode=1;});});
  };
  void run().catch((error)=>{console.error(JSON.stringify({status:'HELD_OR_RECONCILE',code:((e:unknown)=>{const m=e instanceof Error?e.message:'';const k=/^[A-Za-z0-9_]{1,100}$/.test(m)?m:(e instanceof Error?e.constructor.name:'UNKNOWN')+(typeof (e as {code?:unknown})?.code==='string'?':'+String((e as {code:string}).code).slice(0,40):'');const at=e instanceof Error?[...(e.stack??'').matchAll(/\/([A-Za-z_]+\.ts):(\d+):\d+/g)].slice(0,3).map(x=>x[1]+':'+x[2]).join('<'):'';return at?k+'@'+at:k;})(error),automaticRetry:false}));process.exitCode=1;});
}

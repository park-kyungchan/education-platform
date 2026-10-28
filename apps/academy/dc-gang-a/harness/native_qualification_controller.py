"""Fixed P4 qualification controller. Import is inert; no shell, scheduler,
agent loop, provider operation, arbitrary program or automatic replay exists.
Run only under separately qualified Python -I -S and exact Root admission.
Private A bytes, invitations, passwords, cookies and grants stay in RAM/pipes.
"""
import os
import sys
import json
import re
import hashlib
import stat
import signal
import select
import time

WORKTREE = '/var/tmp/e2e-p4-native-20261024-01/runs/e11-sealed-frame-45/source/education-native-foundations'
TASK = '/var/tmp/e2e-p4-native-20261024-01/runs/e11-sealed-frame-45'
BUN = '/usr/local/bin/bun'
ACADEMY = WORKTREE + '/apps/academy/dc-gang-a/harness/'
SCRIPTS = {'HELPER': ACADEMY + 'native_foundations_qualification.ts',
           'MIGRATE': ACADEMY + 'native_foundations_migrate.ts',
           'FIXTURE': ACADEMY + 'native_foundations_fixture.ts',
           'MEASURE': ACADEMY + 'native_foundations_measurement.ts'}
ENVIRONMENT = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'LANG': 'C.UTF-8', 'TZ': 'UTC'}
SOURCE_PATHS = ('apps/academy/dc-gang-a/docs/teacher-exam-selection-contract.ts', 'apps/academy/dc-gang-a/harness/native_foundations_fixture.ts', 'apps/academy/dc-gang-a/harness/native_foundations_measurement.ts', 'apps/academy/dc-gang-a/harness/native_foundations_migrate.ts', 'apps/academy/dc-gang-a/harness/native_foundations_qualification.ts', 'apps/academy/dc-gang-a/harness/native_qualification_controller.py', 'apps/academy/dc-gang-a/src/academy/academyConnectionStatus.ts', 'apps/academy/dc-gang-a/src/academy/application.ts', 'apps/academy/dc-gang-a/src/academy/auth.ts', 'apps/academy/dc-gang-a/src/academy/bookCertificationEvidence.ts', 'apps/academy/dc-gang-a/src/academy/bookPreparation.ts', 'apps/academy/dc-gang-a/src/academy/classroomCyclePolicy.ts', 'apps/academy/dc-gang-a/src/academy/conceptEvidenceAdapter.ts', 'apps/academy/dc-gang-a/src/academy/conceptEvidenceGraph.ts', 'apps/academy/dc-gang-a/src/academy/conceptWorkspace.ts', 'apps/academy/dc-gang-a/src/academy/conceptWorkspaceStore.ts', 'apps/academy/dc-gang-a/src/academy/contracts/prerequisiteRecords.ts', 'apps/academy/dc-gang-a/src/academy/contracts/retainedQuery.ts', 'apps/academy/dc-gang-a/src/academy/contracts/storageRecords.ts', 'apps/academy/dc-gang-a/src/academy/contracts/teacherOperations.ts', 'apps/academy/dc-gang-a/src/academy/curatedConceptCandidates.ts', 'apps/academy/dc-gang-a/src/academy/domain.ts', 'apps/academy/dc-gang-a/src/academy/examSelection.ts', 'apps/academy/dc-gang-a/src/academy/learningWork.ts', 'apps/academy/dc-gang-a/src/academy/learningWorkBindings.ts', 'apps/academy/dc-gang-a/src/academy/learningWorkProjection.ts', 'apps/academy/dc-gang-a/src/academy/main.ts', 'apps/academy/dc-gang-a/src/academy/nativeCompleteness.ts', 'apps/academy/dc-gang-a/src/academy/nativeConnector.ts', 'apps/academy/dc-gang-a/src/academy/nativePrerequisiteStore.ts', 'apps/academy/dc-gang-a/src/academy/nativeReadDescriptor.ts', 'apps/academy/dc-gang-a/src/academy/nativeTypedRead.ts', 'apps/academy/dc-gang-a/src/academy/operatingWorkspace.ts', 'apps/academy/dc-gang-a/src/academy/operationalContract.ts', 'apps/academy/dc-gang-a/src/academy/originTrial.ts', 'apps/academy/dc-gang-a/src/academy/ownerWorkspaceStore.ts', 'apps/academy/dc-gang-a/src/academy/ports/teacherStore.ts', 'apps/academy/dc-gang-a/src/academy/postgresStore.ts', 'apps/academy/dc-gang-a/src/academy/preparationHistory.ts', 'apps/academy/dc-gang-a/src/academy/prerequisiteApplication.ts', 'apps/academy/dc-gang-a/src/academy/preservedHistory.ts', 'apps/academy/dc-gang-a/src/academy/records.ts', 'apps/academy/dc-gang-a/src/academy/retainedQuery.ts', 'apps/academy/dc-gang-a/src/academy/retainedQueryValidation.ts', 'apps/academy/dc-gang-a/src/academy/server.ts', 'apps/academy/dc-gang-a/src/academy/sourceEvidence.ts', 'apps/academy/dc-gang-a/src/academy/sourceSynchronization.ts', 'apps/academy/dc-gang-a/src/academy/teacherActionScope.ts', 'apps/academy/dc-gang-a/src/academy/teacherAuthStore.ts', 'apps/academy/dc-gang-a/src/academy/teacherExamWorkspace.ts', 'apps/academy/dc-gang-a/src/academy/teacherWorkContext.ts', 'apps/academy/dc-gang-a/src/academy/teacherWorkspace.ts', 'apps/academy/dc-gang-a/src/academy/usecases/conceptWorkspace.ts', 'apps/academy/dc-gang-a/src/academy/usecases/requestRecovery.ts', 'apps/academy/dc-gang-a/src/academy/usecases/studentScene.ts', 'apps/academy/dc-gang-a/src/academy/usecases/teacherClinic.ts', 'apps/academy/dc-gang-a/src/academy/usecases/teacherObservation.ts', 'apps/academy/dc-gang-a/src/academy/usecases/teacherWorkspace.ts', 'apps/academy/dc-gang-a/src/academy/web/designLab.ts', 'apps/academy/dc-gang-a/src/academy/web/designLabCatalog.ts', 'apps/academy/dc-gang-a/src/academy/web/designTokens.ts', 'apps/academy/dc-gang-a/src/academy/web/fontAssets.ts', 'apps/academy/dc-gang-a/src/academy/web/teacherRails.ts', 'apps/academy/dc-gang-a/src/academy/web/teacherStyles.ts', 'apps/academy/dc-gang-a/src/contracts/catalogLevels.ts', 'apps/academy/dc-gang-a/src/contracts/operationalContractShape.ts', 'apps/academy/dc-gang-a/src/contracts/parentInternalLanguage.ts', 'apps/academy/dc-gang-a/src/contracts/readInputRecord.ts', 'apps/academy/dc-gang-a/src/learning/model.ts', 'apps/academy/dc-gang-a/src/lms/academyReadProtocol.ts', 'apps/academy/dc-gang-a/src/lms/academySourceAudit.ts', 'apps/academy/dc-gang-a/src/lms/assessmentReadProtocol.ts', 'apps/academy/dc-gang-a/src/lms/dayRecordColumnContract.ts', 'apps/academy/dc-gang-a/src/lms/dayRecordDomBinding.ts', 'apps/academy/dc-gang-a/src/lms/dayRecordReadProtocol.ts', 'apps/academy/dc-gang-a/src/lms/itemAnswerAudit.ts', 'apps/academy/dc-gang-a/src/lms/itemAnswerBatch.ts', 'apps/academy/dc-gang-a/src/lms/itemAnswerRead.ts', 'apps/academy/dc-gang-a/src/lms/itemMetadataRead.ts', 'apps/academy/dc-gang-a/src/lms/printedPaperCode.ts', 'apps/academy/dc-gang-a/src/lms/studentCourseRead.ts', 'apps/academy/dc-gang-a/tests/academy/fourGapSourceGrammar.test.ts', 'apps/academy/dc-gang-a/tests/academy/isolatedNativeServer.test.ts', 'apps/academy/dc-gang-a/tests/academy/nativeCompleteness.test.ts', 'apps/academy/dc-gang-a/tests/academy/nativePrerequisitePort.test.ts', 'apps/academy/dc-gang-a/tests/academy/nativePrerequisiteStore.test.ts', 'apps/academy/dc-gang-a/tests/academy/nativeReadDescriptor.test.ts', 'apps/academy/dc-gang-a/tests/academy/outcomeLookup.test.ts', 'apps/academy/dc-gang-a/tests/academy/teacherAuthStore.test.ts', 'apps/academy/dc-gang-a/tests/academy/teacherBinding.test.ts', 'apps/academy/dc-gang-a/tests/academy/teacherReadSnapshot.test.ts', 'apps/academy/dc-gang-a/tests/academy/typedRead.test.ts', 'apps/academy/dc-gang-a/tests/academy/typedReadIngress.test.ts', 'apps/academy/dc-gang-a/tests/academy/typedReadSnapshot.test.ts', 'apps/academy/gang-a/packages/adapters/repository-operating-context.ts', 'apps/academy/gang-a/packages/application/project-book-certification.ts', 'apps/academy/gang-a/packages/application/select-operational-context.ts', 'apps/academy/gang-a/packages/application/validate-operational-context.ts', 'apps/academy/gang-a/packages/audit/event-log.ts', 'apps/academy/gang-a/packages/domain/book-certification.ts', 'apps/academy/gang-a/packages/domain/evidence.ts', 'apps/academy/gang-a/packages/domain/ids.ts', 'apps/academy/gang-a/packages/domain/operational-context.ts', 'apps/academy/gang-a/packages/domain/operational-followup.ts', 'apps/academy/gang-a/packages/domain/scope.ts', 'apps/academy/gang-a/packages/schema/academy-operating-context.ts', 'apps/academy/gang-a/packages/security/operational-context.ts')
# This is a single fixed native procedure, not a caller-supplied workflow.
STEPS = (('MIGRATE', 'MIGRATE'),
         ('AUTH_INIT', 'A0'), ('START', 'A0'), ('FIXTURE', 'A0'), ('STOP', 'A0'),
         ('AUTH_INIT', 'B0'), ('START', 'B0'), ('FIXTURE', 'B0'), ('STOP', 'B0'),
         ('START', 'A1'), ('FIXTURE', 'A1-SETUP'), ('MEASURE', 'A1-BASE'),
         ('FIXTURE', 'A1-DETACH'), ('MEASURE', 'A1-AFTER'), ('STOP', 'CLOSE-CURRENT'),
         ('START', 'OLD-SECTION'), ('MEASURE', 'A-OLD-SECTION'), ('STOP', 'CLOSE-OLD'),
         ('START', 'CURRENT-RESTORED'), ('MEASURE', 'A2-CURRENT'),
         ('FIXTURE', 'P-SNAPSHOT'), ('MEASURE', 'P-SNAPSHOT'),
         ('FIXTURE', 'P-ACTOR'), ('MEASURE', 'P-ACTOR'),
         ('FIXTURE', 'RESTORE-A'), ('MEASURE', 'RESTORE-A'),
         ('STOP', 'BEFORE-RESTART'), ('START', 'P-RESTART'), ('MEASURE', 'P-RESTART'),
         ('FIXTURE', 'P-RETIRE-A'), ('STOP', 'FINAL'), ('SEAL', 'SEAL-CUSTODY-CLEANUP'))


def require(condition, code):
    if not condition:
        raise RuntimeError(code)


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def verify_python_material(admission):
    """Verify only Root-selected public v2 bytes. This does not qualify future
    dynamic imports/providers/config/locale/kernel or atomic executed bytes."""
    evidence = '/home/palantirkc/operations/platform-redesign-20261023T1807Z/reports/p4-p5-execution/resumption-20261025/'
    selected = (
        ('python-runtime-r1/public-runtime-pins.v2.json', 'cbb94c0b8295c9be648c9e2058db3f2064c890e2c4e373b30482ef2d081ac705'),
        ('python-runtime-r1/native-loader-metadata.v1.json', '071e3831b7e1f16f19eda4ac64c30d82df004130c0ccd119bf1e253d0899b71b'),
        ('python-runtime-r1/launch-recommendations-and-holds.v1.json', '4f15ad7ed36ebbcf2b33991c6963ecc27d5ca893aeffdb57026624c40d3aee92'))
    values = []
    for suffix, expected in selected:
        fd = os.open(evidence + suffix, os.O_RDONLY | os.O_NOFOLLOW)
        try:
            info = os.fstat(fd)
            require(stat.S_ISREG(info.st_mode) and info.st_size <= 150000, 'public_metadata_bound')
            raw = b''
            while len(raw) < info.st_size:
                piece = os.read(fd, min(65536, info.st_size - len(raw)))
                require(piece, 'public_metadata_eof')
                raw += piece
            require(digest(raw) == expected, 'selected_python_v2_required')
            values.append(json.loads(raw))
        finally:
            os.close(fd)
    pins, loader, recommendations = values
    require(admission['pythonPinsSha256'] == selected[0][1]
            and admission['pythonCoverageHolds'] == recommendations['unknowns']
            and len(recommendations['unknowns']) == 9
            and pins['explicitImports'] == ['os', 'sys', 'json', 'hashlib', 'stat', 'signal', 'select', 'time'],
            'all_python_v2_holds_required')
    present, absent = 0, 0
    for pin in pins['pins']:
        path = pin['path']
        if pin['status'] == 'absent':
            require(not os.path.lexists(path), 'python_absence_changed')
            absent += 1
            continue
        before = os.stat(path)
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
        try:
            hasher = hashlib.sha256()
            while True:
                chunk = os.read(fd, 65536)
                if not chunk:
                    break
                hasher.update(chunk)
        finally:
            os.close(fd)
        after = os.stat(path)
        observed = {'bytes': after.st_size, 'ctimeNs': str(after.st_ctime_ns),
                    'device': after.st_dev, 'gid': after.st_gid, 'inode': after.st_ino,
                    'mode': oct(stat.S_IMODE(after.st_mode)), 'mtimeNs': str(after.st_mtime_ns), 'uid': after.st_uid}
        require(before == after and observed == pin['after'] and hasher.hexdigest() == pin['sha256']
                and os.path.realpath(path) == pin['realPath'], 'python_present_changed')
        present += 1
    require((present, absent, len(loader['aliases'])) == (74, 97, 13), 'exact_python_v2_counts_required')
    for alias in loader['aliases']:
        require(os.path.realpath(alias['path']) == alias['realPath'], 'python_alias_changed')
        with open(alias['path'], 'rb') as source:
            require(digest(source.read()) == alias['sha256'], 'python_alias_bytes_changed')


def verify_controller_source(admission):
    require(admission['runId'] == 'e2e-p4-native-20261027-45'
            and admission['ownerId'] == 'synthetic-p4-e2e-p4-native-20261027-45'
            and admission['sourceReadyReview'] == 'ROOT_ACCEPTED_EXACT_WHOLE_ENVELOPE_U_V2',
            'final_root_source_review_required')
    for key in ['reviewSha256', 'environmentSha256', 'dependencySetSha256']:
        require(isinstance(admission[key], str) and len(admission[key]) == 64
                and all(c in '0123456789abcdef' for c in admission[key]), 'exact_root_binding_required')
    require(admission['environmentSha256'] == digest(json.dumps(sorted(os.environ.items()), separators=(',', ':')).encode('utf-8')),
            'exact_controller_environment_required')
    pins = admission['sourceSet']['files']
    require(len(pins) == 107 and len({p['path'] for p in pins}) == 107
            and {p['path'] for p in pins} == set(SOURCE_PATHS), 'exact_controller_source_closure_required')
    normalized = sorted([{'path': p['path'], 'sha256': p['sha256'], 'bytes': p['bytes']} for p in pins], key=lambda p: p['path'])
    require(digest(json.dumps(normalized, separators=(',', ':')).encode('utf-8')) == admission['sourceSet']['sha256'],
            'exact_controller_source_set_required')
    for pin in pins:
        path = WORKTREE + '/' + pin['path']
        require(os.path.normpath(path) == path, 'fixed_source_path_required')
        before = os.stat(path)
        with open(path, 'rb') as source:
            raw = source.read()
        require(os.stat(path) == before and len(raw) == pin['bytes'] and digest(raw) == pin['sha256'],
                'controller_source_changed')
    own = next(p for p in pins if p['path'] == 'apps/academy/dc-gang-a/harness/native_qualification_controller.py')
    require(os.path.realpath(__file__) == WORKTREE + '/' + own['path']
            and own['sha256'] == admission['controllerSourceSha256'], 'exact_controller_script_required')
    with open(BUN, 'rb') as executable:
        require(digest(executable.read()) == '7ce7d6b654eddeec20afddf2396317fba6dc19ab52788a27e894e1806bf8f24b', 'fixed_bun_bytes_required')


def start_ticks(pid):
    fd = os.open('/proc/%d/stat' % pid, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        raw = os.read(fd, 4096).decode('ascii')
    finally:
        os.close(fd)
    return int(raw[raw.rfind(')') + 2:].split()[19])


def private_pin(pin):
    path = pin['path']
    require(path.startswith(TASK + '/phases/') and os.path.normpath(path) == path,
            'fixed_private_occurrence_path_required')
    current = '/'
    for part in path.split('/')[1:]:
        current = os.path.join(current, part)
        require(not stat.S_ISLNK(os.lstat(current).st_mode), 'nofollow_required')
    parent = os.stat(os.path.dirname(path), follow_symlinks=False)
    require(stat.S_ISDIR(parent.st_mode) and parent.st_uid == os.getuid()
            and stat.S_IMODE(parent.st_mode) == 0o700, 'private_directory_required')
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        info = os.fstat(fd)
        require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1
                and info.st_uid == os.getuid() and stat.S_IMODE(info.st_mode) == 0o600
                and info.st_size <= 262144, 'private_file_required')
        chunks, size = [], 0
        while True:
            piece = os.read(fd, 65536)
            if not piece:
                break
            size += len(piece)
            require(size <= 262144, 'private_file_bound')
            chunks.append(piece)
        raw = b''.join(chunks)
        require(len(raw) == pin['bytes'] and digest(raw) == pin['sha256'], 'exact_pin_required')
        return raw
    finally:
        os.close(fd)


def pipe_identity(fd, access):
    info = os.fstat(fd)
    require(fd > 2 and stat.S_ISFIFO(info.st_mode), 'anonymous_pipe_required')
    link = os.readlink('/proc/self/fd/%d' % fd)
    require(link.startswith('pipe:['), 'anonymous_pipe_required')
    fdinfo = open('/proc/self/fdinfo/%d' % fd, encoding='ascii').read()
    flags = int(next(x.split()[1] for x in fdinfo.splitlines() if x.startswith('flags:')), 8)
    require(flags & 3 == access, 'pipe_direction_required')
    return {'device': info.st_dev, 'inode': info.st_ino}


def send(fd, value):
    raw = json.dumps(value, separators=(',', ':')).encode('utf-8') + b'\n'
    require(len(raw) <= 16777216, 'pipe_bound')  # private memory pipe; 16 MiB (was 1 MiB, a harness cap)
    offset = 0
    while offset < len(raw):
        written = os.write(fd, raw[offset:])
        require(written > 0, 'pipe_outcome_unknown')
        offset += written


def receive_line(fd, limit=262144, timeout=300):
    raw = bytearray()
    deadline = time.monotonic() + timeout
    while True:
        remaining = deadline - time.monotonic()
        require(remaining > 0, 'control_timeout_reconcile_no_retry')
        require(select.select([fd], [], [], min(remaining, 30))[0] or time.monotonic() < deadline,
                'control_timeout_reconcile_no_retry')
        if not select.select([fd], [], [], 0)[0]:
            continue
        piece = os.read(fd, 1)
        require(piece, 'control_eof_reconcile_no_retry')
        if piece == b'\n':
            return json.loads(raw)
        raw.extend(piece)
        require(len(raw) <= limit, 'control_bound')


def fixed_argv(kind, config, manifest_hash, admission_hash, loader):
    require(kind in SCRIPTS and config == os.path.dirname(config) + '/config.json', 'fixed_program_required')
    require(loader['path'] == os.path.dirname(config) + '/tsconfig.json', 'fixed_loader_required')
    options = json.loads(private_pin(loader))
    require(set(options) == {'compilerOptions'} and set(options['compilerOptions']) <=
            {'target', 'module', 'moduleResolution', 'strict', 'types', 'skipLibCheck'},
            'no_extended_loader_required')
    return [BUN, '--config=/dev/null', '--no-env-file', '--no-install', '--no-macros',
            '--tsconfig-override', loader['path'], SCRIPTS[kind], '--manifest', config,
            '--manifest-sha256', manifest_hash, '--admission-sha256', admission_hash]



class SealedInputWriter:
    def __init__(self, raw, length, expected_hash):
        require(type(length) is int and 1 <= length <= 16777216, 'sealed_input_length_required')
        require(type(raw) is bytes and len(raw) == length and digest(raw) == expected_hash, 'sealed_input_pin_required')
        self.raw, self.offset = raw, 0

    def write_ready(self, fd):
        require(self.offset < len(self.raw), 'sealed_input_no_second_frame')
        n = os.write(fd, self.raw[self.offset:self.offset + 65536])
        require(n > 0, 'sealed_input_write_failed')
        self.offset += n
        return n

    def append(self, raw):
        raise RuntimeError('sealed_input_no_append')


def pump_fixed_runner(child, raw, input_w, output_r, frame, assert_current, handoff, timeout=1500):
    writer = SealedInputWriter(raw, frame['inputByteLength'], frame['inputSha256'])
    os.set_blocking(input_w, False)
    os.set_blocking(output_r, False)
    received, output_eof, terminal, original_error = bytearray(), False, None, None
    deadline = time.monotonic() + timeout
    try:
        while terminal is None or not output_eof:
            if terminal is None:
                assert_current()
            require(time.monotonic() < deadline, 'child_timeout_reconcile_no_retry')
            pid, status = os.waitpid(child, os.WNOHANG) if terminal is None else (0, 0)
            if pid:
                terminal = {'pid': pid, 'exitCode': os.waitstatus_to_exitcode(status)}
            readable, writable, _ = select.select([] if output_eof else [output_r], [input_w] if writer.offset < len(raw) and terminal is None else [], [], 0.01)
            if writable:
                writer.write_ready(input_w)
            if readable:
                piece = os.read(output_r, 65536)
                if not piece:
                    output_eof = True  # retain the reader FD even at EOF
                else:
                    received.extend(piece)
                    require(len(received) <= 16777216, 'private_memory_bound')
            if terminal is not None:
                require(terminal['exitCode'] == 0, 'child_failed_reconcile_no_retry')
                require(writer.offset == len(raw), 'sealed_input_incomplete_terminal')
    except BaseException as error:
        original_error = error
        if terminal is None:
            # Explicit custody transfer to the SAME existing controller owner.
            # No more writes/effects, timeout extension, signal, daemon or retry.
            handoff({'pid': child, 'inputWriteFd': input_w, 'outputReadFd': output_r,
                     'reason': str(error), 'ownerPid': os.getpid()})
            while terminal is None:
                pid, status = os.waitpid(child, os.WNOHANG)
                if pid:
                    terminal = {'pid': pid, 'exitCode': os.waitstatus_to_exitcode(status)}
                    break
                if not output_eof and select.select([output_r], [], [], 0.01)[0]:
                    if not os.read(output_r, 65536):
                        output_eof = True
                else:
                    time.sleep(0.01)
    # This helper alone owns these FDs after entry; failures are retained, never success.
    require(terminal is not None, 'exact_terminal_before_peer_close')
    os.close(input_w)
    os.close(output_r)
    if original_error is not None:
        raise original_error
    return bytes(received), terminal


class Controller:
    def __init__(self, control_read, control_write, admission_pin):
        require(sys.flags.isolated and sys.flags.no_site and sys.flags.ignore_environment
                and sys.dont_write_bytecode and sys.version_info[:3] == (3, 12, 3)
                and os.getuid() == 0, 'qualified_isolated_python_required')
        require(dict(os.environ) == ENVIRONMENT, 'isolated_environment_required')
        pipe_identity(control_read, 0)
        pipe_identity(control_write, 1)
        admission = json.loads(private_pin(admission_pin))
        require(admission['schema'] == 'root-fixed-controller-admission.v1'
                and admission['decision'] == 'GO_EXACT_CONTROLLER' and admission['authorityEpoch'] == 11
                and admission['pid'] == os.getpid() and admission['startTicks'] == start_ticks(os.getpid())
                and admission['parentPid'] == os.getppid()
                and admission['parentStartTicks'] == start_ticks(os.getppid())
                and admission['issuedAtEpoch'] <= time.time() < admission['expiresAtEpoch'],
                'exact_controller_admission_required')
        for fd, field in [(control_read, 'controlRead'), (control_write, 'controlWrite')]:
            require(pipe_identity(fd, 0 if field == 'controlRead' else 1) == admission[field],
                    'exact_root_control_pipe_required')
        require(admission['python']['path'] == os.path.realpath(sys.executable)
                and digest(open(sys.executable, 'rb').read()) == admission['python']['sha256']
                and admission['runtimeQualification'] == 'ROOT_ADMITTED_BOUNDED_PYTHON_V2_WITH_9_HOLDS',
                'qualified_python_loader_required')
        verify_python_material(admission)
        verify_controller_source(admission)
        claim_path = os.path.dirname(admission_pin['path']) + '/controller-claim.json'
        claim = json.dumps({'schema': 'fixed-controller-claim.v1', 'pid': os.getpid(),
                'startTicks': start_ticks(os.getpid()), 'runId': admission['runId'],
                'ownerId': admission['ownerId'], 'sourceSetSha256': admission['sourceSet']['sha256'],
                'admissionSha256': admission_pin['sha256'], 'automaticRetry': False}, separators=(',', ':')).encode('ascii')
        claim_fd = os.open(claim_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        try:
            require(os.write(claim_fd, claim) == len(claim), 'controller_claim_outcome_unknown')
            os.fsync(claim_fd)
        finally:
            os.close(claim_fd)
        directory_fd = os.open(os.path.dirname(claim_path), os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        try:
            os.fsync(directory_fd)
        finally:
            os.close(directory_fd)
        self.admission = admission
        self.control_read, self.control_write = control_read, control_write
        self.memory = {'root.ownerId': 'synthetic-p4-e2e-p4-native-20261027-45',
                       'root.namespace': 'p4-qualification-e2e-p4-native-20261027-45',
                       'memory.generatedPassword.A': os.urandom(32).hex(),
                       'memory.generatedPassword.B': os.urandom(32).hex()}
        self.helper = None
        self.claims = set()
        self.step = 0

    def verify_release(self, release, operation, stage, child):
        require(set(release) == {'schema', 'operation', 'stage', 'manifest', 'admission', 'loader'},
                'closed_release_required')
        require(release['schema'] == 'root-fixed-controller-release.v1'
                and (release['operation'], release['stage']) == (operation, stage), 'fixed_step_required')
        config = json.loads(private_pin(release['manifest']))
        base = config.get('base', config)
        admission = json.loads(private_pin(release['admission']))
        require(base['executor']['pid'] == child and base['executor']['startTicks'] == start_ticks(child)
                and base['controller'] == {'pid': os.getpid(), 'startTicks': start_ticks(os.getpid())}
                and base['ownerId'] == 'synthetic-p4-e2e-p4-native-20261027-45'
                and base['runId'] == 'e2e-p4-native-20261027-45'
                and base['sourceSet']['sha256'] == self.admission['sourceSet']['sha256']
                and base['dependencySet']['sha256'] == self.admission['dependencySetSha256']
                and base['environmentSha256'] == self.admission['environmentSha256'], 'actual_child_binding_required')
        require(admission['decision'] == 'GO_EXACT_OCCURRENCE' and admission['authorityEpoch'] == 11
                and admission['manifestSha256'] == release['manifest']['sha256']
                and admission['reviewSha256'] == self.admission['reviewSha256'], 'exact_root_admission_required')
        if operation in ('MIGRATE', 'FIXTURE', 'MEASURE'):
            require(set(config) == {'schema','status','kind','stage','base','input','output','inputSha256','inputByteLength','resourceSelection','bootstrapSelection','liveHelper','helperStartReceipt','previousStageReceipt','windowState'}, 'closed_fixed_runner_v2_required')
            require(config['schema'] == 'fixed-native-runner.v2' and config['status'] == 'SEALED'
                    and config['kind'] == operation and config['stage'] == stage and config['windowState'] == 'CLOSED', 'fixed_runner_v2_required')
            frame = self.pending_fixed_frame
            require(type(config['inputByteLength']) is int and 1 <= config['inputByteLength'] <= 16777216
                    and config['inputByteLength'] == len(frame['raw']) and config['inputSha256'] == digest(frame['raw'])
                    and config['input'] == frame['input'] and config['output'] == frame['output'], 'sealed_frame_release_required')
        require(base['occurrenceId'] not in self.claims, 'no_replay')
        self.claims.add(base['occurrenceId'])
        return base

    def launch(self, operation, stage):
        require(self.admission['issuedAtEpoch'] <= time.time() < self.admission['expiresAtEpoch'],
                'controller_admission_expired_no_extension')
        require(not (operation == 'START' and self.helper), 'one_live_helper_required')
        prepared = receive_line(self.control_read)
        require(set(prepared) == {'schema', 'operation', 'stage', 'bindings'}
                and prepared['schema'] == 'root-fixed-step-input.v1'
                and (prepared['operation'], prepared['stage']) == (operation, stage), 'fixed_input_required')
        for key, value in prepared['bindings'].items():
            require(key in ('root.scopeRef', 'root.externalScopedRef', 'evidence.fixture', 'clock.observedSourceAt')
                    or key.startswith('ingress.') or key.startswith('root.storeKeys.'), 'no_native_fact_injection')
            self.memory[key] = value
        gate_r, gate_w = os.pipe()
        input_r, input_w = os.pipe()
        output_r, output_w = os.pipe()
        invitation_r, invitation_w = os.pipe()
        child = os.fork()
        if child == 0:
            try:
                for fd in [gate_w, input_w, output_r, invitation_r, self.control_read, self.control_write]:
                    os.close(fd)
                release = receive_line(gate_r)
                os.close(gate_r)
                selected = 'HELPER' if operation in ('AUTH_INIT', 'START') else operation
                # Parent already checked exact Root release; the TS entrypoint
                # independently verifies pins, expiry, live PID/FD bindings.
                argv = fixed_argv(selected, release['manifest']['path'], release['manifest']['sha256'],
                                  release['admission']['sha256'], release['loader'])
                helper_config = json.loads(private_pin(release['manifest'])) if selected == 'HELPER' else {}
                inherited = [invitation_w] if operation == 'AUTH_INIT' else [input_r, output_w] if selected != 'HELPER' or helper_config.get('qualification') is not None or helper_config.get('cursorOwnerBinding') is not None else []
                if input_r in inherited:
                    os.set_blocking(input_r, False)
                # Do not let background children retain the controller pipes.
                devnull_r = os.open('/dev/null', os.O_RDONLY)
                os.dup2(devnull_r, 0)
                if devnull_r != 0: os.close(devnull_r)
                devnull_w = os.open('/dev/null', os.O_WRONLY)
                os.dup2(devnull_w, 1)
                if devnull_w != 1: os.close(devnull_w)
                for name in os.listdir('/proc/self/fd'):
                    fd = int(name)
                    if fd > 2 and fd not in inherited:
                        try:
                            os.close(fd)
                        except OSError:
                            pass
                for fd in inherited:
                    os.set_inheritable(fd, True)
                os.execve(BUN, argv, ENVIRONMENT)
            except BaseException:
                os._exit(121)
        for fd in [gate_r, input_r, output_w, invitation_w]:
            os.close(fd)
        try:
            raw = json.dumps(self.memory, separators=(',', ':')).encode('utf-8')
            fixed_runner = operation in ('MIGRATE', 'FIXTURE', 'MEASURE')
            child_start = start_ticks(child)
            self.pending_fixed_frame = {'raw': raw, 'input': {'readFd': input_r, 'writeFd': input_w, **pipe_identity(input_w, 1)}, 'output': {'readFd': output_r, 'writeFd': output_w, **pipe_identity(output_r, 0)}}
            send(self.control_write, {'schema': 'fixed-child-before-seal.v2' if fixed_runner else 'fixed-child-before-seal.v1', 'step': self.step,
                 'operation': operation, 'stage': stage, 'executor': {'pid': child, 'startTicks': start_ticks(child)},
                 'controller': {'pid': os.getpid(), 'startTicks': start_ticks(os.getpid())},
                 'input': {'readFd': input_r, 'writeFd': input_w, **pipe_identity(input_w, 1)},
                 'output': {'readFd': output_r, 'writeFd': output_w, **pipe_identity(output_r, 0)},
                 'invitation': {'readFd': invitation_r, 'writeFd': invitation_w, **pipe_identity(invitation_r, 0)},
                 'inputSha256': digest(raw), **({'inputByteLength': len(raw)} if fixed_runner else {})})
            release = receive_line(self.control_read)
            base = self.verify_release(release, operation, stage, child)
            send(gate_w, release)
            os.close(gate_w)
            gate_w = -1
            if operation == 'START':
                self.helper = {'pid': child, 'startTicks': start_ticks(child), 'base': base}
                self.memory['native.helperMetadataDirectory'] = base['metadataDirectory']
                self.memory['native.qualificationCases'] = base.get('qualification', {}).get('cases', [])
                if base.get('qualification') is not None or base.get('cursorOwnerBinding') is not None:
                    self.helper['controlPipeWrite'] = input_w
                    input_w = -1
                # Root must independently observe started receipt/socket owner
                # and send the exact completion ACK before the next step.
            elif operation == 'AUTH_INIT':
                invitation = self.read_invitation(invitation_r)
                self.memory['memory.invitation.' + stage[0]] = invitation
                self.wait_child(child)
            else:
                def current():
                    require(self.admission['issuedAtEpoch'] <= time.time() < self.admission['expiresAtEpoch'], 'controller_admission_expired_no_extension')
                    private_pin(release['manifest'])
                    private_pin(release['admission'])
                    require(start_ticks(child) == child_start, 'exact_child_current_required')
                def handoff(custody):
                    send(self.control_write, {'schema': 'fixed-peer-custody-handoff.v1', 'executor': {'pid': child, 'startTicks': child_start}, 'custody': custody, 'automaticRetry': False})
                owned_input, owned_output = input_w, output_r
                input_w = output_r = -1  # transfer to pump; never blind finally-close
                received, terminal = pump_fixed_runner(child, raw, owned_input, owned_output,
                    {'inputByteLength': len(raw), 'inputSha256': digest(raw)}, current, handoff)
                if received:
                    self.memory = json.loads(received)
                send(self.control_write, {'schema': 'fixed-child-terminal.v1', 'step': self.step,
                    'operation': operation, 'stage': stage, 'executor': {'pid': child, 'startTicks': child_start}, 'exitCode': terminal['exitCode']})
            self.require_ack(operation, stage, child)
        finally:
            for fd in [gate_w, input_w, output_r, invitation_r]:
                if fd >= 0:
                    os.close(fd)

    def read_invitation(self, fd):
        require(select.select([fd], [], [], 300)[0], 'invitation_timeout_unknown')
        raw = os.read(fd, 256)
        require(raw.endswith(b'\n') and len(raw) < 256 and b'\n' not in raw[:-1], 'invitation_outcome_unknown')
        return raw[:-1].decode('ascii')

    def wait_child(self, child):
        deadline = time.monotonic() + 1500
        while time.monotonic() < deadline:
            pid, status = os.waitpid(child, os.WNOHANG)
            if pid:
                require(os.waitstatus_to_exitcode(status) == 0, 'child_failed_reconcile_no_retry')
                return
            time.sleep(0.05)
        raise RuntimeError('child_timeout_reconcile_no_retry')

    def require_ack(self, operation, stage, child):
        ack = receive_line(self.control_read)
        require(set(ack) == {'schema', 'operation', 'stage', 'pid', 'receipt'}, 'closed_ack_required')
        require(ack['schema'] == 'root-fixed-step-observed.v1' and (ack['operation'], ack['stage'], ack['pid'])
                == (operation, stage, child), 'actual_root_observation_required')
        private_pin(ack['receipt'])
        return ack

    def stop(self, stage):
        require(self.helper is not None, 'owned_helper_required')
        binding = self.helper
        request = receive_line(self.control_read)
        admission = json.loads(private_pin(request['admission']))
        require(admission['decision'] == 'GO_EXACT_STOP' and admission['authorityEpoch'] == 11
                and admission['stage'] == stage and admission['pid'] == binding['pid']
                and admission['startTicks'] == binding['startTicks'] and admission['windowsClosed'] is True
                and admission['inFlight'] == 0 and admission['controllerPid'] == os.getpid()
                and admission['controllerStartTicks'] == start_ticks(os.getpid())
                and admission['issuedAtEpoch'] <= time.time() < admission['expiresAtEpoch']
                and admission['sourceSetSha256'] == binding['base']['sourceSet']['sha256']
                and admission['ownerId'] == binding['base']['ownerId']
                and admission['runId'] == binding['base']['runId'], 'exact_stop_admission_required')
        require(start_ticks(binding['pid']) == binding['startTicks'], 'actual_owned_helper_required')
        os.kill(binding['pid'], signal.SIGTERM)  # Exactly once; never restart on timeout.
        self.wait_child(binding['pid'])
        ack = self.require_ack('STOP', stage, binding['pid'])
        receipt = json.loads(private_pin(ack['receipt']))
        require(receipt['schema'] == 'isolated-helper-stop.v1' and receipt['stopped'] is True
                and receipt['inFlight'] == 0 and receipt['pid'] == binding['pid']
                and receipt['startTicks'] == binding['startTicks']
                and receipt['sourceSetSha256'] == binding['base']['sourceSet']['sha256'],
                'exact_stop_receipt_required')
        for path in ['/proc/net/tcp', '/proc/net/tcp6']:
            for row in open(path, encoding='ascii').read().strip().splitlines()[1:]:
                fields = row.split()
                require(not (fields[3] == '0A' and int(fields[1].split(':')[1], 16) == 38743),
                        'port_not_released')
        if 'controlPipeWrite' in binding:
            os.close(binding['controlPipeWrite'])
        self.helper = None

    def run(self):
        for self.step, (operation, stage) in enumerate(STEPS):
            if (operation, stage) == ('MEASURE', 'A1-BASE'):
                require(self.helper is not None, 'actual_expiry_helper_required')
                cases = [q for q in self.helper['base'].get('qualification', {}).get('cases', []) if q['mode'] == 'EXPIRY']
                require(len(cases) == 1 and not self.helper.get('expiryArmed'), 'one_exact_expiry_case_required')
                q, base = cases[0], self.helper['base']
                require(start_ticks(self.helper['pid']) == self.helper['startTicks'], 'actual_expiry_helper_required')
                send(self.helper['controlPipeWrite'], {'schema': 'root-fixed-expiry-arm.v1',
                     'caseId': q['id'], 'requestId': q['requestId'], 'ownerId': base['ownerId'],
                     'runId': base['runId'], 'occurrenceId': base['occurrenceId'],
                     'sourceSetSha256': base['sourceSet']['sha256'],
                     'pid': self.helper['pid'], 'startTicks': self.helper['startTicks']})
                self.helper['expiryArmed'] = True
            if operation == 'STOP':
                self.stop(stage)
            elif operation == 'SEAL':
                require(self.helper is None and 'private.originalA' not in self.memory, 'settlement_required')
                # No provider/container/file cleanup is performed by this runner.
                # Root owns retention/custody and separate exact cleanup admission.
                send(self.control_write, {'schema': 'fixed-controller-settled.v1', 'step': self.step,
                     'pid': os.getpid(), 'startTicks': start_ticks(os.getpid()), 'helpers': 0,
                     'nativeCleanup': False, 'automaticRetry': False})
                self.memory.clear()
            else:
                self.launch(operation, stage)


def main():
    require(len(sys.argv) == 9 and sys.argv[1] == '--control-read-fd'
            and sys.argv[3] == '--control-write-fd' and sys.argv[5] == '--admission'
            and sys.argv[7] == '--admission-sha256', 'fixed_controller_argv_required')
    pin = {'path': sys.argv[6], 'sha256': sys.argv[8], 'bytes': os.lstat(sys.argv[6]).st_size}
    Controller(int(sys.argv[2]), int(sys.argv[4]), pin).run()


if __name__ == '__main__':
    try:
        main()
    except BaseException as error:
        # No traceback/private pipe contents or credentials are logged; only a
        # closed snake_case require() code or the exception class (gen39).
        # Existing children are deliberately retained for exact reconciliation.
        text = str(error) if isinstance(error, Exception) else ''
        code = text if re.fullmatch(r'[a-z0-9_]{1,100}', text) else type(error).__name__
        frame, lines = error.__traceback__, []
        while frame is not None:
            lines.append(frame.tb_lineno); frame = frame.tb_next
        if lines:
            code += '@controller.py:' + str(lines[-1])
        os.write(2, json.dumps({'status': 'RECONCILE', 'code': code, 'automaticRetry': False}).encode() + b'\n')
        sys.exit(1)

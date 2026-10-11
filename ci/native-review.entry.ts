// Generation-only entrypoint. Canonical review implementation remains agent-platform.
import {reviewGate} from '../../agent-platform/ci/source-check';
await reviewGate();

// Generation-only transport; all review predicates remain in the immutable common owner.
// @ts-expect-error Virtual import resolved only by the pinned generator.
import { ownerScopedReviewGate, validateOwnerScopedReviewWithEvidence } from 'canonical:owner-review';
// @ts-expect-error Immutable canonical manifest API.
import {deriveReviewedSourceManifest} from 'canonical:review-manifest';
// @ts-expect-error Immutable Ontology0.2.0 API.
import {validateArtifact, validateReferences} from 'canonical:ontology';
export const policy=Object.freeze({"repository":"park-kyungchan/education-platform","projectId":"education-platform","domainId":"education","semanticOwner":"education-platform","scope":"month-end-source-redesign","statusContext":"native-independent-review","publisher":Object.freeze({"id":"241037670","login":"park-kyungchan","type":"User"})});
export {validateOwnerScopedReviewWithEvidence, deriveReviewedSourceManifest, validateArtifact, validateReferences};
export async function runReviewGate(){await ownerScopedReviewGate(policy);}
if(import.meta.main)await runReviewGate();

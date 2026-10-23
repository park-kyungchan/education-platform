import { verifyCanonicalProjection, verifyOwnerReviewProjection } from '../scripts/canonical-projection.ts';
const proof=await verifyCanonicalProjection();
const review=await verifyOwnerReviewProjection();
console.log(JSON.stringify({status:'pass',source:proof.source,canonicalInputs:proof.fixture.inputs.length,compiledInputs:proof.manifest.compiledInputs.length,externalPackages:proof.externalRoots.size,reviewProvider:review.provider.source.commit,nativePermissionGranted:false}));

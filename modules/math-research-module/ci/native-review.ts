import { loadOwnerReviewProjection, verifyOwnerReviewProjection } from '../scripts/canonical-projection.ts';
const api=await loadOwnerReviewProjection();
await api.runReviewGate();
await verifyOwnerReviewProjection();

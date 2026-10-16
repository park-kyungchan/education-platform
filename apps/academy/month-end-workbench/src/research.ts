/** Safe committed research originals and curated requirement records. No credentials, private transcript originals or learner records. */
import data from '../data/research-projection.json';
import type { Projection } from './contracts.ts';
import { assertProjection } from './validation.ts';
assertProjection(data);
export const researchProjection: Projection = data as unknown as Projection;

import {z} from 'zod';
export const Id=z.string().min(1).max(256),Hash=z.string().regex(/^[a-f0-9]{64}$/),Instant=z.string().regex(/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/).refine(x=>Number.isFinite(Date.parse(x)));

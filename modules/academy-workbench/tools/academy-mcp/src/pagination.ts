import { createHash } from 'node:crypto';
import { z } from 'zod';
import { MAX_QUERY_LIMIT, QueryRefusal } from './contracts.ts';

const cursorSchema = z.object({
  version: z.literal(1), snapshot: z.string().regex(/^[a-f0-9]{64}$/),
  selection: z.string().regex(/^[a-f0-9]{64}$/), offset: z.number().int().nonnegative(),
}).strict();
export const digest = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');

/** A cursor selects a page, not authority. Bind it to immutable bytes and the exact parsed query. */
export function paginate<T>(rows: readonly T[], query: unknown, snapshot: string, limit: number, cursor?: string, byteBudget = Infinity, byteCost: (row:T)=>number = row=>Buffer.byteLength(JSON.stringify(row)), separatorBytes = 1) {
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_QUERY_LIMIT) throw new QueryRefusal('invalid_page_limit');
  if (byteBudget !== Infinity && (!Number.isSafeInteger(byteBudget) || byteBudget < 1)) throw new QueryRefusal('invalid_byte_budget');
  const selection = digest(JSON.stringify(query));
  let offset = 0;
  if (cursor !== undefined) {
    try {
      if (cursor.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(cursor)) throw Error();
      const parsed = cursorSchema.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')));
      if (parsed.snapshot !== snapshot || parsed.selection !== selection || parsed.offset > rows.length) throw Error();
      offset = parsed.offset;
    } catch { throw new QueryRefusal('cursor_scope_or_snapshot_conflict'); }
  }
  const items: T[] = [];
  let bytes = 2, byteLimited = false;
  for (let index = offset; index < Math.min(rows.length, offset + limit); index++) {
    const row = rows[index]!;
    const encodedBytes = byteCost(row) + (items.length ? separatorBytes : 0);
    if (bytes + encodedBytes > byteBudget) {
      if (!items.length) throw new QueryRefusal('single_record_exceeds_response_budget');
      byteLimited = true; break;
    }
    bytes += encodedBytes; items.push(row);
  }
  const next = offset + items.length;
  return {
    items,
    page: {
      totalInSavedSelection: rows.length, returned: items.length, exhausted: next >= rows.length,
      nextCursor: next < rows.length ? Buffer.from(JSON.stringify({ version: 1, snapshot, selection, offset: next })).toString('base64url') : null,
      ...(byteLimited ? { byteLimited: true } : {}),
    },
  };
}

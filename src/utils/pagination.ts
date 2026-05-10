import { z } from "zod";

export const paginationSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Math.min(Math.max(parseInt(v, 10), 1), 100) : 25)),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    next_cursor: string | null;
    has_more: boolean;
  };
}

export function buildCursorQuery(cursor: string | undefined): Record<string, unknown> {
  if (!cursor) return {};
  return { cursor: { id: cursor }, skip: 1 };
}

export function paginatedResponse<T extends { id: string }>(
  items: T[],
  limit: number
): PaginatedResult<T> {
  const has_more = items.length > limit;
  const data = has_more ? items.slice(0, limit) : items;
  return {
    data,
    pagination: {
      next_cursor: has_more ? data[data.length - 1].id : null,
      has_more,
    },
  };
}

import { schema, type Infer } from "@zudojs/schema";

import type { Page, PageRequest } from "../types/pagination.type.js";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const PageQuerySchema = schema.object({
  limit: schema.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  cursor: schema.string().uuid().optional(),
});

export type PageQuery = Infer<typeof PageQuerySchema>;

export function buildPageRequest(query: PageQuery): PageRequest {
  return {
    limit: query.limit ?? DEFAULT_PAGE_SIZE,
    ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
  };
}

export function paginateSortedItems<T extends { readonly id: string }>(sorted: readonly T[], page: PageRequest): Page<T> {
  let start = 0;
  if (page.cursor !== undefined) {
    const at = sorted.findIndex((item) => item.id === page.cursor);
    if (at === -1) return { items: [], nextCursor: null };
    start = at + 1;
  }
  const items = sorted.slice(start, start + page.limit);
  const last = items.at(-1);
  return { items, nextCursor: last !== undefined && start + page.limit < sorted.length ? last.id : null };
}

export function buildPrismaPageArguments(page: PageRequest) {
  return {
    take: page.limit + 1,
    ...(page.cursor === undefined ? {} : { cursor: { id: page.cursor }, skip: 1 }),
  };
}

export function buildPageFromFetchedRows<T extends { readonly id: string }>(rows: readonly T[], page: PageRequest): Page<T> {
  const items = rows.slice(0, page.limit);
  const last = items.at(-1);
  return { items, nextCursor: rows.length > page.limit && last !== undefined ? last.id : null };
}

export function mapPageItems<T, U>(page: Page<T>, map: (item: T) => U): Page<U> {
  return { items: page.items.map(map), nextCursor: page.nextCursor };
}

export function compareByNewestFirst<T extends { readonly id: string; readonly createdAt: string | Date }>(left: T, right: T): number {
  const delta = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  return delta !== 0 ? delta : right.id.localeCompare(left.id);
}

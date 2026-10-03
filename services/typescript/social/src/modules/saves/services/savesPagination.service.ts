import { savesPageSize } from "../../../constants/social.constant.js";
import type { SavedItemType } from "../../../generated/prisma/client.js";
import { buildPageFromOverfetchedRows } from "../../../utils/cursor.util.js";
import type { Page } from "../../../types/pagination.type.js";
import type { SavedItemFilter } from "../models/saved.model.js";

export function resolveSavedTypeFilter(filter: SavedItemFilter | undefined): readonly SavedItemType[] | undefined {
  return filter === undefined || filter === "all" ? undefined : [filter];
}

export function paginateSavedRows<T extends { readonly id: string }>(overfetchedRows: readonly T[], requestedLimit?: number): Page<T> {
  return buildPageFromOverfetchedRows(overfetchedRows, requestedLimit ?? savesPageSize);
}

export function resolveSavesLimit(requested: number | undefined): number {
  if (requested === undefined) return savesPageSize;
  return Math.min(Math.max(Math.trunc(requested), 1), savesPageSize);
}

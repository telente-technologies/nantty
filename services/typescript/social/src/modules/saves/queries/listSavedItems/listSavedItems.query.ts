import type { SavedItemFilter } from "../../models/saved.model.js";

export interface ListSavedItemsQuery {
  readonly userId: string;
  readonly type: SavedItemFilter | undefined;
  readonly collectionId: string | undefined;
  readonly cursor: string | undefined;
}

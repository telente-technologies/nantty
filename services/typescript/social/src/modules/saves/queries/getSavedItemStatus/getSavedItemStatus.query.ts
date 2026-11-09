import type { SavedItemTypeName } from "../../models/saved.model.js";

export interface GetSavedItemStatusQuery {
  readonly userId: string;
  readonly type: SavedItemTypeName;
  readonly targetId: string;
}

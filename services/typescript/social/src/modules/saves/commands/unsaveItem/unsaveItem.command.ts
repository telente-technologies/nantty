import type { SavedItemTypeName } from "../../models/saved.model.js";

export interface UnsaveItemCommand {
  readonly userId: string;
  readonly type: SavedItemTypeName | undefined;
  readonly targetId: string;
}

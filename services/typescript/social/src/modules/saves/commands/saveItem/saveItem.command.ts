import type { SavedItemTypeName } from "../../models/saved.model.js";

export interface SaveItemCommand {
  readonly userId: string;
  readonly type: SavedItemTypeName;
  readonly targetId: string;
  readonly collectionId: string | undefined;
}

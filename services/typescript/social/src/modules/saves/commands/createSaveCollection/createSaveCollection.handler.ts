import { conflict } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { isUniqueConstraintViolationError } from "../../../../utils/prismaError.util.js";
import type { SaveCollectionView } from "../../models/saved.model.js";
import { saveCollectionRepository } from "../../repositories/saveCollection.repository.js";
import type { CreateSaveCollectionCommand } from "./createSaveCollection.command.js";

export function createCreateSaveCollectionHandler(context: HandlerContext): Handler<CreateSaveCollectionCommand, SaveCollectionView> {
  return async ({ userId, name }) => {
    try {
      const created = await saveCollectionRepository.create(context.database.client, userId, name.trim());
      return { id: created.id, name: created.name, itemCount: 0, coverUrl: null };
    } catch (error) {
      if (isUniqueConstraintViolationError(error)) throw conflict("COLLECTION_NAME_TAKEN", "You already have a collection with that name.");
      throw error;
    }
  };
}

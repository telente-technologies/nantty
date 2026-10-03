import type { Handler } from "../../../types/handlerContext.type.js";
import type { Page } from "../../../types/pagination.type.js";
import type { RouteFactory } from "../../../utils/route.util.js";
import type { CreateSaveCollectionCommand } from "../commands/createSaveCollection/createSaveCollection.command.js";
import type { MoveSavedItemCommand } from "../commands/moveSavedItem/moveSavedItem.command.js";
import type { SaveItemCommand } from "../commands/saveItem/saveItem.command.js";
import type { UnsaveItemCommand } from "../commands/unsaveItem/unsaveItem.command.js";
import type { SaveCollectionView, SavedItemView } from "../models/saved.model.js";
import type { ListSaveCollectionsQuery } from "../queries/listSaveCollections/listSaveCollections.query.js";
import type { ListSavedItemsQuery } from "../queries/listSavedItems/listSavedItems.query.js";
import { collectionBodySchema, listSavesQuerySchema, moveSaveBodySchema, saveBodySchema, saveIdParamsSchema, unsaveQuerySchema } from "../validators/saves.validator.js";

export interface SavesHandlers {
  readonly saveItem: Handler<SaveItemCommand, void>;
  readonly unsaveItem: Handler<UnsaveItemCommand, void>;
  readonly createSaveCollection: Handler<CreateSaveCollectionCommand, SaveCollectionView>;
  readonly moveSavedItem: Handler<MoveSavedItemCommand, SavedItemView>;
  readonly listSavedItems: Handler<ListSavedItemsQuery, Page<SavedItemView>>;
  readonly listSaveCollections: Handler<ListSaveCollectionsQuery, SaveCollectionView[]>;
}

export function createSavesController(route: RouteFactory, handlers: SavesHandlers) {
  return {
    saveItem: route({ authentication: "required", body: saveBodySchema, successStatus: 204 }, ({ principal, body }) => handlers.saveItem({ userId: principal.accountId, type: body.type, targetId: body.targetId, collectionId: body.collectionId })),
    unsaveItem: route({ authentication: "required", query: unsaveQuerySchema }, ({ principal, query }) => handlers.unsaveItem({ userId: principal.accountId, type: query.type, targetId: query.targetId })),
    listSavedItems: route({ authentication: "required", query: listSavesQuerySchema }, ({ principal, query }) => handlers.listSavedItems({ userId: principal.accountId, type: query.type, collectionId: query.collectionId, cursor: query.cursor })),
    listSaveCollections: route({ authentication: "required" }, ({ principal }) => handlers.listSaveCollections({ userId: principal.accountId })),
    createSaveCollection: route({ authentication: "required", body: collectionBodySchema, successStatus: 201 }, ({ principal, body }) => handlers.createSaveCollection({ userId: principal.accountId, name: body.name })),
    moveSavedItem: route({ authentication: "required", params: saveIdParamsSchema, body: moveSaveBodySchema }, ({ principal, params, body }) => handlers.moveSavedItem({ userId: principal.accountId, saveId: params.saveId, collectionId: body.collectionId })),
  };
}

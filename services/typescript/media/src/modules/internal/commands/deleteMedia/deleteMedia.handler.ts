import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { deleteMediaAssets } from "../../../assets/services/mediaDeletion.service.js";

export function createDeleteMediaHandler(context: HandlerContext): Handler<{ readonly mediaIds: readonly string[]; readonly reason: string }, { readonly deleted: number }> {
  return async (command) => ({ deleted: await deleteMediaAssets(context, command.mediaIds, command.reason) });
}

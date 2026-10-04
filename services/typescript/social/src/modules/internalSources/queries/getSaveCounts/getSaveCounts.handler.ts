import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { saveCountsFor } from "../../../saves/services/saveCounter.service.js";
import type { CursorPage } from "../../models/internalSources.model.js";
import type { GetSaveCountsQuery } from "./getSaveCounts.query.js";

export function createGetSaveCountsHandler(context: HandlerContext): Handler<GetSaveCountsQuery, CursorPage<{ readonly targetId: string; readonly saveCount: number }>> {
  return async ({ type, targetIds }) => {
    const counts = await saveCountsFor(context.database.client, type, targetIds);
    return { data: targetIds.map((targetId) => ({ targetId, saveCount: counts.get(targetId) ?? 0 })), nextCursor: null };
  };
}

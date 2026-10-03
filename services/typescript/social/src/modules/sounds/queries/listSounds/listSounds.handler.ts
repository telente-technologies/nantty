import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { Page } from "../../../../types/pagination.type.js";
import { buildPageFromOverfetchedRows } from "../../../../utils/cursor.util.js";
import type { SoundView } from "../../models/sound.model.js";
import { soundRepository } from "../../repositories/sound.repository.js";
import { buildSoundViews } from "../../services/soundView.service.js";
import type { ListSoundsQuery } from "./listSounds.query.js";

export function createListSoundsHandler(context: HandlerContext): Handler<ListSoundsQuery, Page<SoundView>> {
  return async ({ viewerId, scope, term, cursor, limit }) => {
    const db = context.database.client;
    if (scope === "trending") return { data: await buildSoundViews(context, viewerId, await soundRepository.trending(db, limit)), nextCursor: null };
    const rows = scope === "saved" && viewerId !== undefined ? await soundRepository.pageSaved(db, viewerId, limit, cursor) : scope === "saved" ? [] : await soundRepository.pageSearch(db, term.trim(), limit, cursor);
    const page = buildPageFromOverfetchedRows(rows, limit);
    return { data: await buildSoundViews(context, viewerId, page.data), nextCursor: page.nextCursor };
  };
}

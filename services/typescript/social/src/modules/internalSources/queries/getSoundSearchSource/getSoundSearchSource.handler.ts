import { notFound } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { SoundSearchSource } from "../../models/internalSources.model.js";
import type { GetSoundSearchSourceQuery } from "./getSoundSearchSource.query.js";

export function createGetSoundSearchSourceHandler(context: HandlerContext): Handler<GetSoundSearchSourceQuery, SoundSearchSource> {
  return async ({ soundId }) => {
    const row = await context.database.client.sound.findUnique({ where: { id: soundId } });
    if (row === null) throw notFound("SOUND_NOT_FOUND", "Sound not found.");
    const owner = (await context.directory.findUserSummaries([row.ownerId])).get(row.ownerId);
    return {
      soundId: row.id,
      title: row.title,
      artist: owner === undefined || owner.name === "" ? (owner?.username ?? null) : owner.name,
      coverUrl: row.coverUrl,
      useCount: row.usageCount,
      active: row.status === "available",
      createdAt: row.createdAt.toISOString(),
    };
  };
}

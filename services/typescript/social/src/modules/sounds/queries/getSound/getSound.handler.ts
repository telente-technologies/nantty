import { notFound } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { SoundView } from "../../models/sound.model.js";
import { soundRepository } from "../../repositories/sound.repository.js";
import { buildSoundViews } from "../../services/soundView.service.js";
import type { GetSoundQuery } from "./getSound.query.js";

export function createGetSoundHandler(context: HandlerContext): Handler<GetSoundQuery, SoundView> {
  return async ({ viewerId, soundId }) => {
    const sound = await soundRepository.findById(context.database.client, soundId);
    if (sound === null || sound.status === "removed") throw notFound("SOUND_NOT_FOUND", "Sound not found.");
    return (await buildSoundViews(context, viewerId, [sound]))[0] as SoundView;
  };
}

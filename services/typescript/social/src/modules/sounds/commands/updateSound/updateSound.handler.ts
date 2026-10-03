import { forbidden, notFound } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { SoundView } from "../../models/sound.model.js";
import { soundRepository } from "../../repositories/sound.repository.js";
import { buildSoundViews } from "../../services/soundView.service.js";
import type { UpdateSoundCommand } from "./updateSound.command.js";

export function createUpdateSoundHandler(context: HandlerContext): Handler<UpdateSoundCommand, SoundView> {
  return async ({ viewerId, soundId, title, allowReuse }) => {
    const db = context.database.client;
    const sound = await soundRepository.findById(db, soundId);
    if (sound === null) throw notFound("SOUND_NOT_FOUND", "Sound not found.");
    if (sound.ownerId !== viewerId) throw forbidden("NOT_SOUND_OWNER", "Only the owner can change this sound.");
    const updated = await soundRepository.update(db, soundId, { ...(title === undefined ? {} : { title: title.trim() }), ...(allowReuse === undefined ? {} : { allowReuse }) });
    return (await buildSoundViews(context, viewerId, [updated]))[0] as SoundView;
  };
}

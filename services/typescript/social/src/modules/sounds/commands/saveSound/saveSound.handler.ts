import { notFound } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { soundRepository } from "../../repositories/sound.repository.js";
import type { SaveSoundCommand } from "./saveSound.command.js";

export function createSaveSoundHandler(context: HandlerContext): Handler<SaveSoundCommand, void> {
  return async ({ userId, soundId }) => {
    const db = context.database.client;
    if ((await soundRepository.findById(db, soundId)) === null) throw notFound("SOUND_NOT_FOUND", "Sound not found.");
    await soundRepository.addSave(db, soundId, userId);
  };
}

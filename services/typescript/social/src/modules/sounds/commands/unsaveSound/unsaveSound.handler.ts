import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { soundRepository } from "../../repositories/sound.repository.js";
import type { UnsaveSoundCommand } from "./unsaveSound.command.js";

export function createUnsaveSoundHandler(context: HandlerContext): Handler<UnsaveSoundCommand, void> {
  return async ({ userId, soundId }) => {
    await soundRepository.removeSave(context.database.client, soundId, userId);
  };
}

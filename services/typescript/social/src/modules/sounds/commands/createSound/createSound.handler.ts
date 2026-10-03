import { forbidden } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { postRepository } from "../../../posts/repositories/post.repository.js";
import type { SoundView } from "../../models/sound.model.js";
import { soundRepository } from "../../repositories/sound.repository.js";
import { buildSoundViews } from "../../services/soundView.service.js";
import type { CreateSoundCommand } from "./createSound.command.js";

export function createCreateSoundHandler(context: HandlerContext): Handler<CreateSoundCommand, SoundView> {
  return async (command) => {
    const db = context.database.client;
    if (command.sourceClipId !== undefined) {
      const clip = await postRepository.findById(db, command.sourceClipId);
      if (clip === null || clip.authorId !== command.ownerId) throw forbidden("NOT_CLIP_AUTHOR", "You can only extract audio from your own clip.");
    }
    const sound = await soundRepository.create(db, {
      ownerId: command.ownerId, title: command.title.trim(), isOriginal: true, allowReuse: command.allowReuse,
      ...(command.audioUrl === undefined ? {} : { audioUrl: command.audioUrl }), ...(command.coverUrl === undefined ? {} : { coverUrl: command.coverUrl }),
      ...(command.sourceClipId === undefined ? {} : { sourceClipId: command.sourceClipId }),
    });
    return (await buildSoundViews(context, command.ownerId, [sound]))[0] as SoundView;
  };
}

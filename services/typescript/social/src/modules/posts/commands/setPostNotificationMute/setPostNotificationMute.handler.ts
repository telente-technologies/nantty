import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { postNotificationMuteRepository } from "../../repositories/postNotificationMute.repository.js";
import { loadPostVisibleToViewer } from "../../services/postAccess.service.js";
import type { PostNotificationMuteView, SetPostNotificationMuteCommand } from "./setPostNotificationMute.command.js";

export function createSetPostNotificationMuteHandler(context: HandlerContext): Handler<SetPostNotificationMuteCommand, PostNotificationMuteView> {
  return async ({ actorId, postId, muted }) => {
    const db = context.database.client;
    if (!muted) {
      await postNotificationMuteRepository.unmute(db, actorId, postId);
      return { postId, muted: false };
    }
    const post = await loadPostVisibleToViewer(context, actorId, postId);
    await postNotificationMuteRepository.mute(db, actorId, post.id);
    return { postId: post.id, muted: true };
  };
}

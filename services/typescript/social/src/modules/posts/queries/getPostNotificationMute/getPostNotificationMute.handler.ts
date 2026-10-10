import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { PostNotificationMuteView } from "../../commands/setPostNotificationMute/setPostNotificationMute.command.js";
import { postNotificationMuteRepository } from "../../repositories/postNotificationMute.repository.js";
import type { GetPostNotificationMuteQuery } from "./getPostNotificationMute.query.js";

export function createGetPostNotificationMuteHandler(context: HandlerContext): Handler<GetPostNotificationMuteQuery, PostNotificationMuteView> {
  return async ({ viewerId, postId }) => ({ postId, muted: await postNotificationMuteRepository.isMuted(context.database.client, viewerId, postId) });
}

import type { Handler } from "../../../types/handlerContext.type.js";
import type { RouteFactory } from "../../../utils/route.util.js";
import type { PostNotificationMuteView, SetPostNotificationMuteCommand } from "../commands/setPostNotificationMute/setPostNotificationMute.command.js";
import type { GetPostNotificationMuteQuery } from "../queries/getPostNotificationMute/getPostNotificationMute.query.js";
import { postIdParamsSchema } from "../validators/posts.validator.js";

export interface PostNotificationMuteHandlers {
  readonly setPostNotificationMute: Handler<SetPostNotificationMuteCommand, PostNotificationMuteView>;
  readonly getPostNotificationMute: Handler<GetPostNotificationMuteQuery, PostNotificationMuteView>;
}

export function createPostNotificationMuteController(route: RouteFactory, handlers: PostNotificationMuteHandlers) {
  return {
    getMute: route({ authentication: "required", params: postIdParamsSchema }, ({ principal, params }) => handlers.getPostNotificationMute({ viewerId: principal.accountId, postId: params.postId })),
    mute: route({ authentication: "required", params: postIdParamsSchema }, ({ principal, params }) => handlers.setPostNotificationMute({ actorId: principal.accountId, postId: params.postId, muted: true })),
    unmute: route({ authentication: "required", params: postIdParamsSchema }, ({ principal, params }) => handlers.setPostNotificationMute({ actorId: principal.accountId, postId: params.postId, muted: false })),
  };
}

import type { Handler } from "../../../types/handlerContext.type.js";
import type { Page } from "../../../types/pagination.type.js";
import { clampPageSize } from "../../../utils/cursor.util.js";
import type { RouteFactory } from "../../../utils/route.util.js";
import type { SetPostProductsCommand } from "../commands/setPostProducts/setPostProducts.command.js";
import type { UpdatePostSensitivityCommand } from "../commands/updatePostSensitivity/updatePostSensitivity.command.js";
import type { UpdateReplySettingsCommand } from "../commands/updateReplySettings/updateReplySettings.command.js";
import type { PostView } from "../models/post.model.js";
import type { ListPostQuotesQuery } from "../queries/listPostQuotes/listPostQuotes.query.js";
import { postIdParamsSchema, quotesQuerySchema, replySettingsBodySchema, sensitiveLabelsBodySchema, tagProductsBodySchema } from "../validators/posts.validator.js";

export interface PostAudienceHandlers {
  readonly updateReplySettings: Handler<UpdateReplySettingsCommand, PostView>;
  readonly updatePostSensitivity: Handler<UpdatePostSensitivityCommand, PostView>;
  readonly listPostQuotes: Handler<ListPostQuotesQuery, Page<PostView>>;
  readonly setPostProducts: Handler<SetPostProductsCommand, PostView>;
}

export function createPostAudienceController(route: RouteFactory, handlers: PostAudienceHandlers) {
  return {
    updateReplySettings: route({ authentication: "required", params: postIdParamsSchema, body: replySettingsBodySchema }, ({ principal, params, body }) =>
      handlers.updateReplySettings({ actorId: principal.accountId, postId: params.postId, replyPolicy: body.replyPolicy })),
    updatePostSensitivity: route({ authentication: "required", params: postIdParamsSchema, body: sensitiveLabelsBodySchema }, ({ principal, params, body }) =>
      handlers.updatePostSensitivity({ actorId: principal.accountId, postId: params.postId, sensitiveLabels: body.sensitiveLabels })),
    listPostQuotes: route({ authentication: "optional", params: postIdParamsSchema, query: quotesQuerySchema }, ({ principal, params, query }) =>
      handlers.listPostQuotes({ viewerId: principal?.accountId, postId: params.postId, cursor: query.cursor, limit: clampPageSize(query.limit, 20) })),
    setPostProducts: route({ authentication: "required", params: postIdParamsSchema, body: tagProductsBodySchema }, ({ principal, params, body }) =>
      handlers.setPostProducts({ actorId: principal.accountId, postId: params.postId, productIds: body.productIds })),
  };
}

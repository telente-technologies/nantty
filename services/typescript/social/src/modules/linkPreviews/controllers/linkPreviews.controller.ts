import type { Handler } from "../../../types/handlerContext.type.js";
import type { RouteFactory } from "../../../utils/route.util.js";
import type { RefreshPostLinkPreviewCommand } from "../commands/refreshPostLinkPreview/refreshPostLinkPreview.command.js";
import type { LinkPreviewView } from "../models/linkPreview.model.js";
import type { ResolveLinkPreviewQuery } from "../queries/resolveLinkPreview/resolveLinkPreview.query.js";
import { postLinkPreviewParamsSchema, resolveLinkPreviewQuerySchema } from "../validators/linkPreviews.validator.js";

export interface LinkPreviewsHandlers {
  readonly resolveLinkPreview: Handler<ResolveLinkPreviewQuery, LinkPreviewView | null>;
  readonly refreshPostLinkPreview: Handler<RefreshPostLinkPreviewCommand, LinkPreviewView | null>;
}

export function createLinkPreviewsController(route: RouteFactory, handlers: LinkPreviewsHandlers) {
  return {
    resolve: route({ authentication: "required", query: resolveLinkPreviewQuerySchema }, ({ query }) => handlers.resolveLinkPreview({ url: query.url })),
    refreshForPost: route({ authentication: "required", params: postLinkPreviewParamsSchema }, ({ principal, params }) => handlers.refreshPostLinkPreview({ actorId: principal.accountId, postId: params.postId })),
  };
}

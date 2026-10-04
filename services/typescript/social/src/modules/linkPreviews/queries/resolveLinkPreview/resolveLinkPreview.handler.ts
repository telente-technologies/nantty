import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { LinkPreviewView } from "../../models/linkPreview.model.js";
import type { ResolveLinkPreviewQuery } from "./resolveLinkPreview.query.js";

export function createResolveLinkPreviewHandler(context: HandlerContext): Handler<ResolveLinkPreviewQuery, LinkPreviewView | null> {
  return async (query) => (context.linkPreviews === undefined ? null : context.linkPreviews.resolveLinkPreview(query.url));
}

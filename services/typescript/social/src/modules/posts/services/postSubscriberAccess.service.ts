import { forbidden } from "../../../errors/social.error.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";

export async function assertViewerMayReadConversation(context: HandlerContext, viewerId: string | undefined, post: { readonly authorId: string; readonly visibility: "public" | "subscribers" }): Promise<void> {
  if (post.visibility !== "subscribers" || viewerId === post.authorId) return;
  if (viewerId === undefined || !(await context.premium.hasSubscribedToCreator(viewerId, post.authorId))) {
    throw forbidden("SUBSCRIBERS_ONLY", "Subscribe to this creator to see the conversation.");
  }
}

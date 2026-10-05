import type { HandlerContext } from "../../../types/handlerContext.type.js";
import type { Page } from "../../../types/pagination.type.js";
import { decodeOffsetCursor } from "../../../utils/cursor.util.js";
import { resolveViewerCountry } from "../../explore/services/exploreScope.service.js";
import type { PostView } from "../../posts/models/post.model.js";
import { attachFriendsLiked } from "./socialProof.service.js";
import { insertSponsoredPost } from "./sponsoredInsertion.service.js";

export interface FeedDecorationRequest {
  readonly viewerId: string | undefined;
  readonly surface: "feed" | "clips";
  readonly cursor: string | undefined;
  readonly limit: number;
  readonly topics?: readonly string[];
}

function pageIndexFor(cursor: string | undefined, limit: number): number {
  if (cursor === undefined) return 0;
  const offset = decodeOffsetCursor(cursor);
  return offset > 0 ? Math.floor(offset / Math.max(1, limit)) : 1;
}

export async function decorateFeedPage(context: HandlerContext, page: Page<PostView>, request: FeedDecorationRequest): Promise<Page<PostView>> {
  const withProof = await attachFriendsLiked(context, request.viewerId, page.data).catch(() => [...page.data]);
  const country = await resolveViewerCountry(context, request.viewerId, undefined).catch(() => null);
  const data = await insertSponsoredPost(context, { viewerId: request.viewerId, views: withProof, surface: request.surface, pageIndex: pageIndexFor(request.cursor, request.limit), country, topics: request.topics ?? [] }).catch(() => withProof);
  return { data, nextCursor: page.nextCursor };
}

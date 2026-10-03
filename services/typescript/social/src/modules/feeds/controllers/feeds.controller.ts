import type { Handler } from "../../../types/handlerContext.type.js";
import type { Page } from "../../../types/pagination.type.js";
import { clampPageSize } from "../../../utils/cursor.util.js";
import type { RouteFactory } from "../../../utils/route.util.js";
import type { PostView } from "../../posts/models/post.model.js";
import type { RecordFeedFeedbackCommand } from "../commands/recordFeedFeedback/recordFeedFeedback.command.js";
import type { GetForYouFeedQuery } from "../queries/getForYouFeed/getForYouFeed.query.js";
import type { GetFollowingFeedQuery } from "../queries/getFollowingFeed/getFollowingFeed.query.js";
import type { GetPopularFeedQuery } from "../queries/getPopularFeed/getPopularFeed.query.js";
import type { ListClipsQuery } from "../queries/listClips/listClips.query.js";
import { clipsQuerySchema, feedbackBodySchema, feedQuerySchema, followingFeedQuerySchema } from "../validators/feeds.validator.js";

export interface FeedsHandlers {
  readonly getForYouFeed: Handler<GetForYouFeedQuery, Page<PostView>>;
  readonly getFollowingFeed: Handler<GetFollowingFeedQuery, Page<PostView>>;
  readonly getPopularFeed: Handler<GetPopularFeedQuery, Page<PostView>>;
  readonly listClips: Handler<ListClipsQuery, Page<PostView>>;
  readonly recordFeedFeedback: Handler<RecordFeedFeedbackCommand, void>;
}

export function createFeedsController(route: RouteFactory, handlers: FeedsHandlers) {
  return {
    forYou: route({ authentication: "optional", query: feedQuerySchema }, ({ principal, query }) => handlers.getForYouFeed({ viewerId: principal?.accountId, cursor: query.cursor, limit: clampPageSize(query.limit, 10) })),
    popular: route({ authentication: "optional", query: feedQuerySchema }, ({ principal, query }) => handlers.getPopularFeed({ viewerId: principal?.accountId, cursor: query.cursor, limit: clampPageSize(query.limit, 10) })),
    following: route({ authentication: "required", query: followingFeedQuerySchema }, ({ principal, query }) => handlers.getFollowingFeed({ viewerId: principal.accountId, kinds: ["post", "clip"], cursor: query.cursor, limit: clampPageSize(query.limit, 10) })),
    clips: route({ authentication: "optional", query: clipsQuerySchema }, ({ principal, query }) => handlers.listClips({ viewerId: principal?.accountId, tab: query.tab ?? "forYou", cursor: query.cursor, limit: clampPageSize(query.limit, 10) })),
    suggestedClips: route({ authentication: "optional" }, async ({ principal }) => {
      const page = await handlers.listClips({ viewerId: principal?.accountId, tab: "forYou", cursor: undefined, limit: 12 });
      return page.data.map((clip) => ({ id: clip.id, thumbnailUrl: clip.media[0]?.posterUrl ?? clip.media[0]?.url ?? null }));
    }),
    feedback: route({ authentication: "required", body: feedbackBodySchema }, ({ principal, body }) => handlers.recordFeedFeedback({ userId: principal.accountId, postId: body.postId, kind: body.kind })),
  };
}

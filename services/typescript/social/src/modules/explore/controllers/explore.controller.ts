import { trendCategories } from "../../../constants/ranking.constant.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import { clampPageSize } from "../../../utils/cursor.util.js";
import type { RouteFactory } from "../../../utils/route.util.js";
import { trendCategoryLabels } from "../../../utils/trendCategory.util.js";
import { buildRankedFeedPage } from "../../feeds/services/rankedFeed.service.js";
import { resolveViewerCountry } from "../services/exploreScope.service.js";
import { computeHeadlines } from "../services/headlines.service.js";
import { computeTrends } from "../services/trends.service.js";
import { suggestAccountsToFollow } from "../services/whoToFollow.service.js";
import { headlinesQuerySchema, postsForYouQuerySchema, trendsQuerySchema, whoToFollowQuerySchema } from "../validators/explore.validator.js";

export function createExploreController(route: RouteFactory, context: HandlerContext) {
  return {
    categories: route({ authentication: "optional" }, async () => ({ data: trendCategories.map((id) => ({ id, label: trendCategoryLabels[id] ?? id })), nextCursor: null })),
    trends: route({ authentication: "optional", query: trendsQuerySchema }, async ({ principal, query }) =>
      computeTrends(context, { country: await resolveViewerCountry(context, principal?.accountId, query.country), category: query.category ?? null, limit: query.limit ?? 10 })),
    headlines: route({ authentication: "optional", query: headlinesQuerySchema }, async ({ principal, query }) =>
      computeHeadlines(context, { country: await resolveViewerCountry(context, principal?.accountId, query.country), category: query.category ?? null, limit: query.limit ?? 6 })),
    whoToFollow: route({ authentication: "optional", query: whoToFollowQuerySchema }, async ({ principal, query }) => ({
      data: await suggestAccountsToFollow(context, { viewerId: principal?.accountId, country: await resolveViewerCountry(context, principal?.accountId, query.country), limit: query.limit ?? 5 }),
      nextCursor: null,
    })),
    postsForYou: route({ authentication: "optional", query: postsForYouQuerySchema }, async ({ principal, query }) => {
      const personalized = principal !== undefined && (await context.directory.hasPersonalizationConsent(principal.accountId));
      return buildRankedFeedPage(context, { viewerId: principal?.accountId, personalized, kinds: ["post", "clip"], cursor: query.cursor, limit: clampPageSize(query.limit, 10), category: query.category ?? "for_you", ...(query.country === undefined ? {} : { country: query.country }) });
    }),
  };
}

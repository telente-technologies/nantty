import { schema } from "@zudojs/schema";

import { notFound } from "../../../errors/social.error.js";
import { requireInternalToken } from "../../../middlewares/internalToken.middleware.js";
import { postRepository } from "../../posts/repositories/post.repository.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import type { RouteFactory } from "../../../utils/route.util.js";
import { createGetChatReportabilityHandler } from "../queries/getChatReportability/getChatReportability.handler.js";
import { createGetModerationTargetPreviewHandler } from "../queries/getModerationTargetPreview/getModerationTargetPreview.handler.js";
import { createGetPostSearchSourceHandler } from "../queries/getPostSearchSource/getPostSearchSource.handler.js";
import { createGetSaveCountsHandler } from "../queries/getSaveCounts/getSaveCounts.handler.js";
import { createGetAccountActivityCountsHandler } from "../queries/getAccountActivityCounts/getAccountActivityCounts.handler.js";
import { createGetSoundSearchSourceHandler } from "../queries/getSoundSearchSource/getSoundSearchSource.handler.js";
import { createListAdContentSourcesHandler } from "../queries/listAdContentSources/listAdContentSources.handler.js";
import { createListAudienceEngagersHandler } from "../queries/listAudienceEngagers/listAudienceEngagers.handler.js";
import { createListAudienceFollowersHandler } from "../queries/listAudienceFollowers/listAudienceFollowers.handler.js";

const identifier = schema.string().uuid();
const searchSourceParams = schema.object({ collection: schema.enum(["posts", "sounds"]), id: identifier });
const moderationParams = schema.object({ type: schema.enum(["post", "clip", "comment", "sound", "message"]), id: identifier });
const accountParams = schema.object({ accountId: identifier });
const conversationParams = schema.object({ conversationId: identifier });
const reportabilityQuery = schema.object({ reporterId: identifier, reportedUserId: identifier.optional(), messageId: identifier.optional() });
const ownershipParams = schema.object({ kind: schema.enum(["post", "clip"]), id: identifier });
const ownershipQuery = schema.object({ ownerUserId: identifier, storeId: schema.string().max(64).optional() });
const pageQuery = { cursor: schema.string().max(100).optional(), limit: schema.coerce.number().int().min(1).max(1000).optional() };
const contentQuery = schema.object({ ownerUserId: identifier, storeId: schema.string().max(64).optional(), type: schema.enum(["post", "clip", "product", "live", "store"]).optional(), search: schema.string().max(100).optional(), ...pageQuery });
const engagerQuery = schema.object({ source: schema.enum(["any_post", "clips_watched", "messaged"]), retentionDays: schema.coerce.number().int().min(1).max(365), ...pageQuery });
const activityCountQuery = schema.object({ sinceDays: schema.coerce.number().int().min(1).max(3660).optional() });
const saveCountQuery = schema.object({ type: schema.enum(["post", "video", "clip", "product"]), ids: schema.string().min(1).max(4000) });

export function createInternalSourcesController(route: RouteFactory, internalToken: string, context: HandlerContext) {
  const getPost = createGetPostSearchSourceHandler(context);
  const getSound = createGetSoundSearchSourceHandler(context);
  const getPreview = createGetModerationTargetPreviewHandler(context);
  const listContent = createListAdContentSourcesHandler(context);
  const listFollowers = createListAudienceFollowersHandler(context);
  const listEngagers = createListAudienceEngagersHandler(context);
  const getSaveCounts = createGetSaveCountsHandler(context);
  const getActivityCounts = createGetAccountActivityCountsHandler(context);
  const getChatReportability = createGetChatReportabilityHandler(context);
  return {
    chatReportability: requireInternalToken(internalToken, route({ authentication: "optional", params: conversationParams, query: reportabilityQuery }, ({ params, query }) =>
      getChatReportability({ conversationId: params.conversationId, reporterId: query.reporterId, reportedUserId: query.reportedUserId, messageId: query.messageId }))),
    ownership: requireInternalToken(internalToken, route({ authentication: "optional", params: ownershipParams, query: ownershipQuery }, async ({ params, query }) => {
      const post = await postRepository.findById(context.database.client, params.id);
      if (post === null || (params.kind === "clip" ? post.kind !== "clip" : post.kind !== "post" && post.kind !== "clip")) throw notFound("DESTINATION_NOT_FOUND", "That post is not available.");
      return { owned: post.authorId === query.ownerUserId };
    })),
    searchSource: requireInternalToken(internalToken, route({ authentication: "optional", params: searchSourceParams }, ({ params }) =>
      params.collection === "posts" ? getPost({ postId: params.id }) : getSound({ soundId: params.id }))),
    moderationTarget: requireInternalToken(internalToken, route({ authentication: "optional", params: moderationParams }, ({ params }) => getPreview({ targetType: params.type, targetId: params.id }))),
    adContentSources: requireInternalToken(internalToken, route({ authentication: "optional", query: contentQuery }, ({ query }) =>
      listContent({ ownerUserId: query.ownerUserId, type: query.type, search: query.search, cursor: query.cursor, limit: Math.min(query.limit ?? 20, 100) }))),
    followers: requireInternalToken(internalToken, route({ authentication: "optional", params: accountParams, query: schema.object(pageQuery) }, ({ params, query }) =>
      listFollowers({ accountId: params.accountId, cursor: query.cursor, limit: query.limit ?? 500 }))),
    engagers: requireInternalToken(internalToken, route({ authentication: "optional", params: accountParams, query: engagerQuery }, ({ params, query }) =>
      listEngagers({ accountId: params.accountId, source: query.source, since: new Date(context.clock.now().getTime() - query.retentionDays * 86_400_000), cursor: query.cursor, limit: query.limit ?? 500 }))),
    activityCounts: requireInternalToken(internalToken, route({ authentication: "optional", params: accountParams, query: activityCountQuery }, ({ params, query }) =>
      getActivityCounts({ accountId: params.accountId, sinceDays: query.sinceDays ?? 365 }))),
    saveCounts: requireInternalToken(internalToken, route({ authentication: "optional", query: saveCountQuery }, ({ query }) =>
      getSaveCounts({ type: query.type, targetIds: [...new Set(query.ids.split(",").map((id) => id.trim()).filter((id) => id !== ""))].slice(0, 200) }))),
  };
}

import { schema } from "@zudojs/schema";

import { requireInternalToken } from "../../../middlewares/internalToken.middleware.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import type { RouteFactory } from "../../../utils/route.util.js";
import { createGetModerationTargetPreviewHandler } from "../queries/getModerationTargetPreview/getModerationTargetPreview.handler.js";
import { createGetPostSearchSourceHandler } from "../queries/getPostSearchSource/getPostSearchSource.handler.js";
import { createGetSaveCountsHandler } from "../queries/getSaveCounts/getSaveCounts.handler.js";
import { createGetSoundSearchSourceHandler } from "../queries/getSoundSearchSource/getSoundSearchSource.handler.js";
import { createListAdContentSourcesHandler } from "../queries/listAdContentSources/listAdContentSources.handler.js";
import { createListAudienceEngagersHandler } from "../queries/listAudienceEngagers/listAudienceEngagers.handler.js";
import { createListAudienceFollowersHandler } from "../queries/listAudienceFollowers/listAudienceFollowers.handler.js";

const identifier = schema.string().uuid();
const searchSourceParams = schema.object({ collection: schema.enum(["posts", "sounds"]), id: identifier });
const moderationParams = schema.object({ type: schema.enum(["post", "clip", "comment", "sound"]), id: identifier });
const accountParams = schema.object({ accountId: identifier });
const pageQuery = { cursor: schema.string().max(100).optional(), limit: schema.coerce.number().int().min(1).max(1000).optional() };
const contentQuery = schema.object({ ownerUserId: identifier, storeId: schema.string().max(64).optional(), type: schema.enum(["post", "clip", "product", "live", "store"]).optional(), search: schema.string().max(100).optional(), ...pageQuery });
const engagerQuery = schema.object({ source: schema.enum(["any_post", "clips_watched", "messaged"]), retentionDays: schema.coerce.number().int().min(1).max(365), ...pageQuery });
const saveCountQuery = schema.object({ type: schema.enum(["post", "video", "clip", "product"]), ids: schema.string().min(1).max(4000) });

export function createInternalSourcesController(route: RouteFactory, internalToken: string, context: HandlerContext) {
  const getPost = createGetPostSearchSourceHandler(context);
  const getSound = createGetSoundSearchSourceHandler(context);
  const getPreview = createGetModerationTargetPreviewHandler(context);
  const listContent = createListAdContentSourcesHandler(context);
  const listFollowers = createListAudienceFollowersHandler(context);
  const listEngagers = createListAudienceEngagersHandler(context);
  const getSaveCounts = createGetSaveCountsHandler(context);
  return {
    searchSource: requireInternalToken(internalToken, route({ authentication: "optional", params: searchSourceParams }, ({ params }) =>
      params.collection === "posts" ? getPost({ postId: params.id }) : getSound({ soundId: params.id }))),
    moderationTarget: requireInternalToken(internalToken, route({ authentication: "optional", params: moderationParams }, ({ params }) => getPreview({ targetType: params.type, targetId: params.id }))),
    adContentSources: requireInternalToken(internalToken, route({ authentication: "optional", query: contentQuery }, ({ query }) =>
      listContent({ ownerUserId: query.ownerUserId, type: query.type, search: query.search, cursor: query.cursor, limit: Math.min(query.limit ?? 20, 100) }))),
    followers: requireInternalToken(internalToken, route({ authentication: "optional", params: accountParams, query: schema.object(pageQuery) }, ({ params, query }) =>
      listFollowers({ accountId: params.accountId, cursor: query.cursor, limit: query.limit ?? 500 }))),
    engagers: requireInternalToken(internalToken, route({ authentication: "optional", params: accountParams, query: engagerQuery }, ({ params, query }) =>
      listEngagers({ accountId: params.accountId, source: query.source, since: new Date(context.clock.now().getTime() - query.retentionDays * 86_400_000), cursor: query.cursor, limit: query.limit ?? 500 }))),
    saveCounts: requireInternalToken(internalToken, route({ authentication: "optional", query: saveCountQuery }, ({ query }) =>
      getSaveCounts({ type: query.type, targetIds: [...new Set(query.ids.split(",").map((id) => id.trim()).filter((id) => id !== ""))].slice(0, 200) }))),
  };
}

import { notFound } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { blockRepository } from "../../../blocks/repositories/block.repository.js";
import { followRepository } from "../../../follows/repositories/follow.repository.js";
import type { PostNotificationsView } from "../../models/postNotifications.model.js";
import { viewerLevelOf } from "../../services/postNotificationRules.service.js";
import type { GetPostNotificationsQuery } from "./getPostNotifications.query.js";

export function createGetPostNotificationsHandler(context: HandlerContext): Handler<GetPostNotificationsQuery, PostNotificationsView> {
  return async ({ viewerId, targetId }) => {
    const db = context.database.client;
    if (viewerId === targetId) return { level: "off", following: false };
    if (!(await context.directory.findUserSummaries([targetId])).has(targetId)) throw notFound("USER_NOT_FOUND", "User not found.");
    const [follow, blockedEitherWay] = await Promise.all([followRepository.find(db, viewerId, targetId), blockRepository.eitherDirection(db, viewerId, targetId)]);
    const followState = blockedEitherWay ? undefined : follow?.state;
    return { level: viewerLevelOf(followState, follow?.postNotifications), following: followState === "accepted" };
  };
}

import { notFound } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { blockRepository } from "../../../blocks/repositories/block.repository.js";
import type { FollowStatusView } from "../../models/follow.model.js";
import { followRepository } from "../../repositories/follow.repository.js";
import { deriveViewerFollowState } from "../../services/followRules.service.js";
import { viewerLevelOf } from "../../../postNotifications/services/postNotificationRules.service.js";
import type { GetFollowStatusQuery } from "./getFollowStatus.query.js";

export function createGetFollowStatusHandler(context: HandlerContext): Handler<GetFollowStatusQuery, FollowStatusView> {
  return async ({ viewerId, targetId }) => {
    const db = context.database.client;
    if (!(await context.directory.findUserSummaries([targetId])).has(targetId)) throw notFound("USER_NOT_FOUND", "User not found.");
    const [forward, backward, viewerHasBlocked, followersCount, followingCount] = await Promise.all([
      viewerId === undefined ? null : followRepository.find(db, viewerId, targetId),
      viewerId === undefined ? null : followRepository.find(db, targetId, viewerId),
      viewerId === undefined ? false : blockRepository.exists(db, viewerId, targetId),
      followRepository.countFollowers(db, targetId),
      followRepository.countFollowing(db, targetId),
    ]);
    const state = deriveViewerFollowState(viewerHasBlocked, forward?.state);
    return { state, followedBy: backward?.state === "accepted", followersCount, followingCount, viewerPostNotifications: viewerLevelOf(state, forward?.postNotifications) };
  };
}

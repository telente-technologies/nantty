import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { blockRepository } from "../../../blocks/repositories/block.repository.js";
import { followRepository } from "../../../follows/repositories/follow.repository.js";
import { decideProfileVisibility } from "../../../follows/services/followRules.service.js";
import { postRepository } from "../../repositories/post.repository.js";
import { storyRingHiddenFromViewer, summariseStoryRingForViewer, type StoryRingStatus } from "../../services/storyRingStatus.service.js";
import type { GetStoryRingStatusQuery } from "./getStoryRingStatus.query.js";

export function createGetStoryRingStatusHandler(context: HandlerContext): Handler<GetStoryRingStatusQuery, StoryRingStatus> {
  return async ({ viewerId, ownerId }) => {
    const db = context.database.client;
    const viewerIsOwner = viewerId === ownerId;
    const owner = (await context.directory.findUserSummaries([ownerId])).get(ownerId);
    if (owner === undefined) return storyRingHiddenFromViewer;
    const [privateOwners, viewerFollow, ownerHasBlockedViewer, viewerHasBlockedOwner] = await Promise.all([
      context.directory.findPrivateAccountIds([ownerId]),
      viewerId === undefined || viewerIsOwner ? null : followRepository.find(db, viewerId, ownerId),
      viewerId === undefined || viewerIsOwner ? false : blockRepository.exists(db, ownerId, viewerId),
      viewerId === undefined || viewerIsOwner ? false : blockRepository.exists(db, viewerId, ownerId),
    ]);
    const viewerIsAcceptedFollower = viewerFollow?.state === "accepted";
    const visibility = decideProfileVisibility({ viewerId, ownerId, ownerIsPrivate: privateOwners.has(ownerId), viewerIsAcceptedFollower, ownerHasBlockedViewer });
    if (visibility !== "visible" || viewerHasBlockedOwner) return storyRingHiddenFromViewer;
    const audiences = viewerIsOwner || viewerIsAcceptedFollower ? (["everyone", "followers"] as const) : (["everyone"] as const);
    const activeStoryIds = await postRepository.activeStoryIdsByAuthor(db, ownerId, audiences, context.clock.now());
    const seenStoryIds = viewerId === undefined || viewerIsOwner || activeStoryIds.length === 0 ? new Set<string>() : await postRepository.viewedStoryIds(db, viewerId, activeStoryIds);
    return summariseStoryRingForViewer(activeStoryIds, seenStoryIds, viewerIsOwner);
  };
}

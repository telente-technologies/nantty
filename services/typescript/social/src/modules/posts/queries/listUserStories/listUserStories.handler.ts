import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { followRepository } from "../../../follows/repositories/follow.repository.js";
import { assertViewerMaySeeConnections } from "../../../follows/services/profileAccess.service.js";
import type { StoryView } from "../../models/post.model.js";
import { postRepository } from "../../repositories/post.repository.js";
import { buildStoryViews } from "../../services/storyView.service.js";
import type { ListUserStoriesQuery } from "./listUserStories.query.js";

export function createListUserStoriesHandler(context: HandlerContext): Handler<ListUserStoriesQuery, StoryView[]> {
  return async ({ viewerId, ownerId }) => {
    await assertViewerMaySeeConnections(context, viewerId, ownerId);
    const db = context.database.client;
    const isFollower = viewerId !== undefined && (viewerId === ownerId || (await followRepository.find(db, viewerId, ownerId))?.state === "accepted");
    const rows = await postRepository.pageByAuthor(db, ownerId, ["story"], 50, undefined, isFollower ? ["everyone", "followers"] : ["everyone"], context.clock.now());
    return buildStoryViews(context, viewerId, rows.reverse());
  };
}

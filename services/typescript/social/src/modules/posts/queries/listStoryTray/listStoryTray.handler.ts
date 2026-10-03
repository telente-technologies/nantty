import type { UserSummary } from "../../../../interfaces/identityDirectory.interface.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { followRepository } from "../../../follows/repositories/follow.repository.js";
import { filterAuthorsVisibleToViewer } from "../../../follows/services/profileAccess.service.js";
import { postRepository } from "../../repositories/post.repository.js";
import type { ListStoryTrayQuery } from "./listStoryTray.query.js";

export interface StoryTrayItem {
  readonly user: UserSummary;
  readonly hasUnseen: boolean;
}

export function createListStoryTrayHandler(context: HandlerContext): Handler<ListStoryTrayQuery, StoryTrayItem[]> {
  return async ({ viewerId }) => {
    const db = context.database.client;
    const followed = await followRepository.allFollowedAccountIds(db, viewerId, 500);
    const candidateIds = [viewerId, ...followed];
    const stories = await postRepository.storyAuthorsWithActiveStories(db, candidateIds, context.clock.now());
    if (stories.length === 0) return [];
    const [visible, seen] = await Promise.all([
      filterAuthorsVisibleToViewer(context, viewerId, stories.map((story) => story.authorId)),
      postRepository.viewedStoryIds(db, viewerId, stories.map((story) => story.id)),
    ]);
    const unseenByAuthor = new Map<string, boolean>();
    for (const story of stories) {
      if (!visible.has(story.authorId)) continue;
      unseenByAuthor.set(story.authorId, (unseenByAuthor.get(story.authorId) ?? false) || (!seen.has(story.id) && story.authorId !== viewerId));
    }
    const summaries = await context.directory.findUserSummaries([...unseenByAuthor.keys()]);
    const items = [...unseenByAuthor].flatMap(([authorId, hasUnseen]) => {
      const user = summaries.get(authorId);
      return user === undefined ? [] : [{ user, hasUnseen }];
    });
    return items.sort((left, right) => Number(right.hasUnseen) - Number(left.hasUnseen) || Number(right.user.id === viewerId) - Number(left.user.id === viewerId));
  };
}

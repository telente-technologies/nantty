import { QueryHandler } from "@zudojs/cqrs";

import type { StoryTrayEntryDto } from "../../dtos/posts.dto.js";
import type { PostsService } from "../../services/posts.service.js";
import type { ListActiveStoriesQuery } from "./listActiveStories.query.js";

const MAXIMUM_STORIES = 300;

export class ListActiveStoriesHandler extends QueryHandler<ListActiveStoriesQuery, readonly StoryTrayEntryDto[]> {
  public readonly queryType = "posts.listActiveStories" as const;

  public constructor(private readonly postsService: PostsService) {
    super();
  }

  public async execute(query: ListActiveStoriesQuery): Promise<readonly StoryTrayEntryDto[]> {
    const { posts, clock, socialGraph } = this.postsService.dependencies;
    const authorIds = query.authorId === undefined ? [query.viewerId, ...(await socialGraph.listFollowedUserIds(query.viewerId))] : [query.authorId];
    if (query.authorId !== undefined && query.authorId !== query.viewerId && (await socialGraph.isBlockedEitherWay(query.viewerId, query.authorId))) return [];
    const stories = await posts.listRecentCandidates({ authorIds, kinds: ["story"] }, clock.now(), MAXIMUM_STORIES);
    return this.postsService.presenter.presentStoryTray(stories, query.viewerId);
  }
}

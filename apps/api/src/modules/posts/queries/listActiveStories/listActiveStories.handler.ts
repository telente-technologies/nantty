import { QueryHandler } from "@zudojs/cqrs";

import type { StoryGroupDto } from "../../dtos/posts.dto.js";
import type { PostsService } from "../../services/posts.service.js";
import type { ListActiveStoriesQuery } from "./listActiveStories.query.js";

const MAXIMUM_STORIES = 300;

export class ListActiveStoriesHandler extends QueryHandler<ListActiveStoriesQuery, readonly StoryGroupDto[]> {
  public readonly queryType = "posts.listActiveStories" as const;

  public constructor(private readonly postsService: PostsService) {
    super();
  }

  public async execute(query: ListActiveStoriesQuery): Promise<readonly StoryGroupDto[]> {
    const { posts, clock, socialGraph } = this.postsService.dependencies;
    const viewerId = query.principal.userId;
    const authorIds = [viewerId, ...(await socialGraph.listFollowedUserIds(viewerId))];
    const stories = await posts.listRecentCandidates({ authorIds, kinds: ["story"] }, clock.now(), MAXIMUM_STORIES);
    const presented = await this.postsService.presenter.presentPosts([...stories].reverse(), viewerId, query.displayCurrency);
    const groups = new Map<string, StoryGroupDto>();
    for (const story of presented) {
      const authorId = story.author?.id ?? "unknown";
      const group = groups.get(authorId) ?? { author: story.author, stories: [] };
      groups.set(authorId, { author: group.author, stories: [...group.stories, story] });
    }
    const ownGroup = groups.get(viewerId);
    groups.delete(viewerId);
    return [...(ownGroup === undefined ? [] : [ownGroup]), ...groups.values()];
  }
}

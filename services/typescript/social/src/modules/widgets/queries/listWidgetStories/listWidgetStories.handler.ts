import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { followRepository } from "../../../follows/repositories/follow.repository.js";
import { filterAuthorsVisibleToViewer } from "../../../follows/services/profileAccess.service.js";
import { postRepository } from "../../../posts/repositories/post.repository.js";
import { widgetStoryRepository } from "../../repositories/widgetStory.repository.js";
import { orderWidgetStoryPeople, storyDeepLink, type WidgetStoriesPayload, type WidgetStoryPerson } from "../../services/widgetStoryOrdering.service.js";
import type { ListWidgetStoriesQuery } from "./listWidgetStories.query.js";

interface AuthorStories {
  storyIds: string[];
  latest: Date;
  thumbnailUrl: string | null;
}

type StoryRow = Awaited<ReturnType<typeof widgetStoryRepository.activeStoriesByAuthors>>[number];

function thumbnailOf(row: StoryRow): string | null {
  const media = row.media[0];
  if (media === undefined || row.sensitiveLabels.length > 0) return null;
  return media.type === "video" ? media.posterUrl : media.url ?? media.posterUrl;
}

export function createListWidgetStoriesHandler(context: HandlerContext): Handler<ListWidgetStoriesQuery, WidgetStoriesPayload> {
  return async ({ viewerId, limit }) => {
    const db = context.database.client;
    const now = context.clock.now();
    const empty: WidgetStoriesPayload = { people: [], generatedAt: now.toISOString() };
    const followed = (await followRepository.allFollowedAccountIds(db, viewerId, 500)).filter((id) => id !== viewerId);
    if (followed.length === 0) return empty;
    const rows = await widgetStoryRepository.activeStoriesByAuthors(db, followed, now);
    if (rows.length === 0) return empty;
    const visible = await filterAuthorsVisibleToViewer(context, viewerId, [...new Set(rows.map((row) => row.authorId))]);
    const byAuthor = new Map<string, AuthorStories>();
    for (const row of rows) {
      if (!visible.has(row.authorId)) continue;
      const entry = byAuthor.get(row.authorId);
      if (entry === undefined) byAuthor.set(row.authorId, { storyIds: [row.id], latest: row.createdAt, thumbnailUrl: thumbnailOf(row) });
      else entry.storyIds.push(row.id);
    }
    if (byAuthor.size === 0) return empty;
    const [seen, summaries] = await Promise.all([
      postRepository.viewedStoryIds(db, viewerId, [...byAuthor.values()].flatMap((entry) => entry.storyIds)),
      context.directory.findUserSummaries([...byAuthor.keys()]),
    ]);
    const people: WidgetStoryPerson[] = [...byAuthor].flatMap(([authorId, entry]) => {
      const user = summaries.get(authorId);
      if (user === undefined) return [];
      return [{
        userId: authorId, name: user.name, username: user.username, avatarUrl: user.avatarUrl, hasUnseen: entry.storyIds.some((id) => !seen.has(id)),
        storyCount: entry.storyIds.length, latestStoryAt: entry.latest.toISOString(), thumbnailUrl: entry.thumbnailUrl, deepLink: storyDeepLink(authorId),
      }];
    });
    return { people: orderWidgetStoryPeople(people, limit), generatedAt: now.toISOString() };
  };
}

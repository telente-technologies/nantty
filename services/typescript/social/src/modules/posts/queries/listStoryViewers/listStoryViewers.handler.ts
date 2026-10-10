import { forbidden, notFound } from "../../../../errors/social.error.js";
import type { UserSummary } from "../../../../interfaces/identityDirectory.interface.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { buildPageFromOverfetchedRows, decodeOffsetCursor, encodeOffsetCursor } from "../../../../utils/cursor.util.js";
import { postRepository } from "../../repositories/post.repository.js";
import type { ListStoryViewersQuery } from "./listStoryViewers.query.js";

export interface StoryViewersPage {
  readonly viewers: readonly UserSummary[];
  readonly total: number;
  readonly nextCursor: string | null;
}

async function isOwnStory(context: HandlerContext, viewerId: string, authorId: string, authorProfileId: string | null): Promise<boolean> {
  if (authorId === viewerId) return true;
  if (authorProfileId === null) return false;
  return (await context.directory.findOwnedPostableProfile(viewerId, authorProfileId)) !== null;
}

export function createListStoryViewersHandler(context: HandlerContext): Handler<ListStoryViewersQuery, StoryViewersPage> {
  return async ({ viewerId, storyId, cursor, limit }) => {
    const db = context.database.client;
    const story = await postRepository.findById(db, storyId);
    if (story === null || story.kind !== "story") throw notFound("STORY_NOT_FOUND", "Story not found.");
    if (!(await isOwnStory(context, viewerId, story.authorId, story.authorProfileId))) {
      throw forbidden("NOT_STORY_OWNER", "Only the author can see story viewers.");
    }
    const offset = decodeOffsetCursor(cursor);
    const [total, rows] = await Promise.all([
      db.storyView.count({ where: { storyId } }),
      db.storyView.findMany({ where: { storyId }, orderBy: { createdAt: "desc" }, skip: offset, take: limit + 1 }),
    ]);
    const page = buildPageFromOverfetchedRows(
      rows.map((row) => ({ id: row.viewerId, viewerId: row.viewerId })),
      limit,
    );
    const summaries = await context.directory.findUserSummaries(page.data.map((row) => row.viewerId));
    return {
      viewers: page.data.flatMap((row) => summaries.get(row.viewerId) ?? []),
      total,
      nextCursor: page.nextCursor === null ? null : encodeOffsetCursor(offset + limit),
    };
  };
}

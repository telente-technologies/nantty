import { badRequest, forbidden, notFound } from "../../../../errors/social.error.js";
import type { UserSummary } from "../../../../interfaces/identityDirectory.interface.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { postRepository } from "../../repositories/post.repository.js";
import type { ListStoryViewersQuery } from "./listStoryViewers.query.js";

export interface StoryViewersPage {
  readonly viewers: readonly UserSummary[];
  readonly total: number;
  readonly nextCursor: string | null;
}

interface StoryViewerCursor {
  readonly createdAt: string;
  readonly viewerId: string;
}

type StoryViewerPageCursor =
  | { readonly kind: "keyset"; readonly boundary: StoryViewerCursor }
  | { readonly kind: "legacy-offset"; readonly offset: number }
  | null;

function decodeStoryViewerCursor(cursor: string | undefined): StoryViewerPageCursor {
  if (cursor === undefined) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as unknown;
    // Accept cursors issued by older app/server versions during a rolling deploy.
    if (typeof parsed === "object" && parsed !== null && "o" in parsed) {
      const offset = parsed.o;
      if (typeof offset === "number" && Number.isSafeInteger(offset) && offset >= 0) return { kind: "legacy-offset", offset };
      throw new Error("invalid cursor");
    }
    if (Array.isArray(parsed) && parsed.length === 2) {
      const [timestamp, viewerId] = parsed as [unknown, unknown];
      if (typeof timestamp !== "number" || !Number.isSafeInteger(timestamp) || typeof viewerId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(viewerId)) throw new Error("invalid cursor");
      return { kind: "keyset", boundary: { createdAt: new Date(timestamp).toISOString(), viewerId } };
    }
    const legacy = parsed as Partial<StoryViewerCursor>;
    if (
      typeof legacy.createdAt !== "string" ||
      !Number.isFinite(Date.parse(legacy.createdAt)) ||
      typeof legacy.viewerId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(legacy.viewerId)
    ) throw new Error("invalid cursor");
    return { kind: "keyset", boundary: { createdAt: new Date(legacy.createdAt).toISOString(), viewerId: legacy.viewerId } };
  } catch {
    throw badRequest("INVALID_STORY_VIEWER_CURSOR", "This story viewer page link is invalid. Refresh the viewer list and try again.");
  }
}

function encodeStoryViewerCursor(row: { readonly createdAt: Date; readonly viewerId: string }): string {
  // The tuple keeps the cursor under the route's 100-character query limit.
  return Buffer.from(JSON.stringify([row.createdAt.getTime(), row.viewerId])).toString("base64url");
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
    const pageCursor = decodeStoryViewerCursor(cursor);
    const boundary = pageCursor?.kind === "keyset" ? pageCursor.boundary : null;
    const continuation = boundary === null ? {} : {
      OR: [
        { createdAt: { lt: new Date(boundary.createdAt) } },
        { createdAt: new Date(boundary.createdAt), viewerId: { gt: boundary.viewerId } },
      ],
    };
    const [total, rows] = await Promise.all([
      db.storyView.count({ where: { storyId } }),
      db.storyView.findMany({
        where: { storyId, ...continuation },
        orderBy: [{ createdAt: "desc" }, { viewerId: "asc" }],
        ...(pageCursor?.kind === "legacy-offset" ? { skip: pageCursor.offset } : {}),
        take: limit + 1,
      }),
    ]);
    const pageRows = rows.slice(0, limit);
    const summaries = await context.directory.findUserSummaries(pageRows.map((row) => row.viewerId));
    return {
      viewers: pageRows.flatMap((row) => summaries.get(row.viewerId) ?? []),
      total,
      nextCursor: rows.length > limit && pageRows.length > 0 ? encodeStoryViewerCursor(pageRows[pageRows.length - 1]!) : null,
    };
  };
}

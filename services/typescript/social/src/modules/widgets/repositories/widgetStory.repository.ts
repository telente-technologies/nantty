import type { Db } from "../../../types/database.type.js";
import { shownToViewers } from "../../../constants/moderation.constant.js";

export const widgetStoryRepository = {
  activeStoriesByAuthors: (db: Db, authorIds: readonly string[], now: Date) =>
    db.post.findMany({
      where: { authorId: { in: [...authorIds] }, kind: "story", ...shownToViewers, visibility: "public", audience: { in: ["everyone", "followers"] }, expiresAt: { gt: now } },
      select: { id: true, authorId: true, createdAt: true, sensitiveLabels: true, media: { orderBy: { position: "asc" }, take: 1, select: { type: true, url: true, posterUrl: true } } },
      orderBy: { id: "desc" },
      take: 500,
    }),
};

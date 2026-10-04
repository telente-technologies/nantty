import type { SensitiveLabel } from "../../../generated/prisma/client.js";
import { canViewerSeePostByAudience } from "./postRules.service.js";
import { isPostWithheldFromViewer } from "./sensitiveContent.service.js";

export interface QuoteCandidate {
  readonly id: string;
  readonly authorId: string;
  readonly audience: "everyone" | "followers";
  readonly sensitiveLabels: readonly SensitiveLabel[];
}

export interface QuoteViewerContext {
  readonly viewerId: string | undefined;
  readonly visibleAuthors: ReadonlySet<string>;
  readonly followedAuthors: ReadonlySet<string>;
  readonly withheldLabels: readonly SensitiveLabel[];
}

export function selectQuotesVisibleToViewer<T extends QuoteCandidate>(rows: readonly T[], viewer: QuoteViewerContext): T[] {
  return rows.filter((row) =>
    viewer.visibleAuthors.has(row.authorId)
    && canViewerSeePostByAudience({ audience: row.audience, viewerId: viewer.viewerId, authorId: row.authorId, viewerFollowsAuthor: viewer.followedAuthors.has(row.authorId) })
    && !isPostWithheldFromViewer(row, viewer));
}

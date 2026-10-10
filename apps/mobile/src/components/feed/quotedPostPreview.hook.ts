import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { ApiError } from "@/errors/api.error";
import { postsService } from "@/services/content/posts.service";
import type { ID, QuotedPostSummary } from "@/types";
import { findFirstPostLinkInText, quotedSummaryFromPost } from "@/utils/postLinks.util";

export type QuotedPostPreviewState =
  | { readonly status: "loading"; readonly quoted: null }
  | { readonly status: "ready"; readonly quoted: QuotedPostSummary }
  | { readonly status: "unavailable"; readonly quoted: null };

export interface QuotedPostPreview {
  readonly preview: QuotedPostPreviewState | null;
  readonly quotedPostId: ID | null | undefined;
  readonly remove: () => void;
  readonly reset: () => void;
}

const isMissingPostError = (error: unknown) => error instanceof ApiError && (error.status === 403 || error.status === 404 || error.status === 410);

export function useQuotedPostPreview(text: string): QuotedPostPreview {
  const linkedPostId = useMemo(() => findFirstPostLinkInText(text)?.postId ?? null, [text]);
  const [removedPostId, setRemovedPostId] = useState<ID | null>(null);
  useEffect(() => {
    if (removedPostId && linkedPostId !== removedPostId) setRemovedPostId(null);
  }, [linkedPostId, removedPostId]);
  const activePostId = linkedPostId && linkedPostId !== removedPostId ? linkedPostId : null;
  const query = useQuery({
    queryKey: ["post", activePostId],
    queryFn: () => postsService.fetchPostById(activePostId as ID),
    enabled: !!activePostId,
    retry: false,
    staleTime: 60_000,
  });
  const preview: QuotedPostPreviewState | null = !activePostId
    ? null
    : query.data
      ? { status: "ready", quoted: quotedSummaryFromPost(query.data) }
      : query.isError
        ? isMissingPostError(query.error) ? { status: "unavailable", quoted: null } : null
        : { status: "loading", quoted: null };
  const quotedPostId = removedPostId !== null && linkedPostId === removedPostId ? null : preview?.status === "ready" ? preview.quoted.id : undefined;
  return {
    preview,
    quotedPostId,
    remove: () => {
      if (linkedPostId) setRemovedPostId(linkedPostId);
    },
    reset: () => setRemovedPostId(null),
  };
}

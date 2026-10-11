"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { WebappRequestError } from "@/services/clientApi.service";
import { postsService } from "@/services/posts.service";
import type { ID, QuotedPostSummary } from "@/types";
import { findFirstPostLinkInText, quotedSummaryFromPost } from "@/utils/quotedPostLinks.util";

export type QuotedPostPreviewState =
  | { readonly status: "loading"; readonly quoted: null }
  | { readonly status: "ready"; readonly quoted: QuotedPostSummary }
  | { readonly status: "unavailable"; readonly quoted: null };

const isMissingPostError = (error: unknown) => error instanceof WebappRequestError && (error.status === 403 || error.status === 404 || error.status === 410);

export const QUOTE_UNAVAILABLE_MESSAGE = "The post you’re quoting isn’t available anymore. Remove it to post.";

export function useQuotedPostPreview(text: string, initialQuotedPostId?: ID | null) {
  const linkedPostId = useMemo(() => findFirstPostLinkInText(text)?.postId ?? null, [text]);
  const [attachedPostId, setAttachedPostId] = useState<ID | null>(initialQuotedPostId ?? null);
  const [removedPostId, setRemovedPostId] = useState<ID | null>(null);
  useEffect(() => {
    if (removedPostId && linkedPostId !== removedPostId) setRemovedPostId(null);
  }, [linkedPostId, removedPostId]);
  const activePostId = attachedPostId ?? (linkedPostId && linkedPostId !== removedPostId ? linkedPostId : null);
  const query = useQuery({
    queryKey: ["post", activePostId],
    queryFn: () => postsService.fetchPostById(activePostId as ID),
    enabled: activePostId !== null,
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
  const quotedPostId: ID | null | undefined = attachedPostId
    ?? (removedPostId !== null && linkedPostId === removedPostId ? null : preview?.status === "ready" ? preview.quoted.id : undefined);
  return {
    preview,
    quotedPostId,
    attachedPostId,
    isUnavailable: preview?.status === "unavailable",
    remove: () => {
      if (attachedPostId) {
        setAttachedPostId(null);
        if (linkedPostId === attachedPostId) setRemovedPostId(linkedPostId);
        return;
      }
      if (linkedPostId) setRemovedPostId(linkedPostId);
    },
    reset: () => {
      setRemovedPostId(null);
      setAttachedPostId(null);
    },
    attach: (postId: ID | null) => {
      setAttachedPostId(postId);
      setRemovedPostId(null);
    },
    refresh: () => {
      if (activePostId) void query.refetch();
    },
  };
}

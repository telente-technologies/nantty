import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";

import { storiesService } from "@/services/clips/stories.service";
import { generateIdempotencyKey } from "@/services/core/apiClient.service";
import type { ID, NewPostInput, Post } from "@/types";

import { fillProcessingPostMediaWithLocalPreviews, type PostDraftMediaItem } from "./postDraftUploads.hook";

export interface PublishPostOptions {
  readonly draftMediaItems: readonly PostDraftMediaItem[];
  readonly combinedUploadedFraction: number;
  readonly waitForAllDraftMediaIds: () => Promise<readonly ID[]>;
  readonly buildInput: (mediaIds: readonly ID[], scheduledAt?: string) => NewPostInput;
  readonly onPublished: (post: Post) => void;
  readonly onError?: (error: Error) => void;
  readonly fillLocalPreviews?: boolean;
}

export function usePublishPost({ draftMediaItems, combinedUploadedFraction, waitForAllDraftMediaIds, buildInput, onPublished, onError, fillLocalPreviews = true }: PublishPostOptions) {
  const queryClient = useQueryClient();
  const isPublishing = useRef(false);
  const requestIdentity = useRef<{ readonly fingerprint: string; readonly key: string } | null>(null);
  const mutation = useMutation({
    mutationFn: async (scheduledAt?: string) => {
      const input = buildInput(await waitForAllDraftMediaIds(), scheduledAt);
      const fingerprint = JSON.stringify(input);
      if (requestIdentity.current?.fingerprint !== fingerprint) requestIdentity.current = { fingerprint, key: generateIdempotencyKey() };
      return storiesService.publishPost(input, requestIdentity.current.key);
    },
    onSuccess: (post) => {
      requestIdentity.current = null;
      queryClient.setQueryData(["post", post.id], fillLocalPreviews ? fillProcessingPostMediaWithLocalPreviews(post, draftMediaItems) : post);
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-posts"] });
      if (post.kind === "clip") queryClient.invalidateQueries({ queryKey: ["clips"] });
      onPublished(post);
    },
    onError,
    onSettled: () => {
      isPublishing.current = false;
    },
  });
  const publish = (scheduledAt?: string) => {
    if (isPublishing.current) return;
    isPublishing.current = true;
    mutation.mutate(scheduledAt);
  };
  const isWaitingForUploads = mutation.isPending && combinedUploadedFraction < 1;
  const buttonTitle = isWaitingForUploads ? `Uploading ${Math.round(combinedUploadedFraction * 100)}%…` : mutation.isPending ? (mutation.variables ? "Scheduling…" : "Posting…") : "Post";
  return { mutation, publish, buttonTitle, errorMessage: mutation.error ? mutation.error.message : null };
}

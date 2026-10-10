import { useMutation, useQueryClient } from "@tanstack/react-query";

import { storiesService } from "@/services/clips/stories.service";
import type { ID, NewPostInput, Post } from "@/types";

import { fillProcessingPostMediaWithLocalPreviews, type PostDraftMediaItem } from "./postDraftUploads.hook";

export interface PublishPostOptions {
  readonly draftMediaItems: readonly PostDraftMediaItem[];
  readonly combinedUploadedFraction: number;
  readonly waitForAllDraftMediaIds: () => Promise<readonly ID[]>;
  readonly buildInput: (mediaIds: readonly ID[]) => NewPostInput;
  readonly onPublished: (post: Post) => void;
  readonly fillLocalPreviews?: boolean;
}

export function usePublishPost({ draftMediaItems, combinedUploadedFraction, waitForAllDraftMediaIds, buildInput, onPublished, fillLocalPreviews = true }: PublishPostOptions) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => storiesService.publishPost(buildInput(await waitForAllDraftMediaIds())),
    onSuccess: (post) => {
      queryClient.setQueryData(["post", post.id], fillLocalPreviews ? fillProcessingPostMediaWithLocalPreviews(post, draftMediaItems) : post);
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      if (post.kind === "clip") queryClient.invalidateQueries({ queryKey: ["clips"] });
      onPublished(post);
    },
  });
  const isWaitingForUploads = mutation.isPending && combinedUploadedFraction < 1;
  const buttonTitle = isWaitingForUploads ? `Uploading ${Math.round(combinedUploadedFraction * 100)}%…` : mutation.isPending ? "Posting…" : "Post";
  return { mutation, buttonTitle, errorMessage: mutation.error ? mutation.error.message : null };
}

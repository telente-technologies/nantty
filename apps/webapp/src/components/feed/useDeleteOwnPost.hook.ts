"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { requestConfirmation } from "@/components/ui/confirmDialog";
import { showToast } from "@/components/ui/toast";
import { WebappRequestError } from "@/services/clientApi.service";
import { postsService } from "@/services/posts.service";
import { removePostEverywhere, restoreCacheSnapshot, type CacheSnapshot } from "@/utils/postEngagementCache.util";
import { deleteConfirmationCopy, isAlreadyDeleted, type DeletablePost } from "@/utils/postDeletion.util";

export function useDeleteOwnPost(options: { readonly onDeleted?: (post: DeletablePost) => void } = {}) {
  const queryClient = useQueryClient();
  const mutation = useMutation<void, unknown, DeletablePost, { readonly snapshot: CacheSnapshot }>({
    mutationFn: async (post) => {
      try {
        await postsService.deletePost(post.id);
      } catch (error) {
        if (!isAlreadyDeleted(error)) throw error;
      }
    },
    onMutate: (post) => ({ snapshot: removePostEverywhere(queryClient, post.id) }),
    onSuccess: (_result, post) => {
      showToast({ text: deleteConfirmationCopy(post.kind).deletedToast });
      if (post.kind === "story") void queryClient.invalidateQueries({ queryKey: ["story-tray"] });
      options.onDeleted?.(post);
    },
    onError: (error, post, context) => {
      if (context) restoreCacheSnapshot(queryClient, context.snapshot);
      const copy = deleteConfirmationCopy(post.kind);
      const forbidden = error instanceof WebappRequestError && error.status === 403;
      showToast({ text: forbidden ? copy.forbidden : copy.failed, tone: "error" });
    },
  });
  const confirmAndDelete = async (post: DeletablePost) => {
    const copy = deleteConfirmationCopy(post.kind);
    const confirmed = await requestConfirmation({ title: copy.title, description: copy.message, confirmLabel: "Delete", intent: "delete" });
    if (confirmed) mutation.mutate(post);
  };
  return { confirmAndDelete, isDeleting: mutation.isPending };
}

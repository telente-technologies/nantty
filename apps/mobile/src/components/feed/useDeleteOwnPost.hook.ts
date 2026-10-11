import { useMutation, useQueryClient } from "@tanstack/react-query";

import { removePostEverywhere, restoreCacheSnapshot, type CacheSnapshot } from "@/cache/postEngagementCache.util";
import { ApiError } from "@/errors/api.error";
import { postsService } from "@/services/content/posts.service";
import { showToast } from "@/store/toast.store";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";

export type DeletableKind = "post" | "clip" | "story";

export interface DeletablePost {
  readonly id: string;
  readonly kind?: DeletableKind | string;
}

const nounFor = (kind: DeletablePost["kind"]) => (kind === "clip" ? "clip" : kind === "story" ? "story" : "post");

export const deleteConfirmationCopy = (kind: DeletablePost["kind"]) => {
  const noun = nounFor(kind);
  return { title: `Delete ${noun}?`, message: "This can't be undone.", confirmLabel: "Delete", deletedToast: `${noun[0]?.toUpperCase()}${noun.slice(1)} deleted` };
};

export const isAlreadyGone = (error: unknown) => error instanceof ApiError && (error.status === 404 || error.status === 410);

export function useDeleteOwnPost(options: { readonly onDeleted?: (post: DeletablePost) => void } = {}) {
  const queryClient = useQueryClient();
  const mutation = useMutation<void, unknown, DeletablePost, { readonly snapshot: CacheSnapshot }>({
    mutationFn: async (post) => {
      try {
        await postsService.deletePost(post.id);
      } catch (error) {
        if (!isAlreadyGone(error)) throw error;
      }
    },
    onMutate: (post) => ({ snapshot: removePostEverywhere(queryClient, post.id) }),
    onSuccess: (_result, post) => {
      showToast(deleteConfirmationCopy(post.kind).deletedToast);
      if (post.kind === "story") void queryClient.invalidateQueries({ queryKey: ["story-tray"] });
      options.onDeleted?.(post);
    },
    onError: (error, post, context) => {
      if (context) restoreCacheSnapshot(queryClient, context.snapshot);
      const noun = nounFor(post.kind);
      const message = error instanceof ApiError && error.status === 403 ? `You can only delete your own ${noun}s.` : "Please check your connection and try again.";
      showAlertWithButtons(`Couldn't delete ${noun}`, message);
    },
  });
  const confirmAndDelete = (post: DeletablePost) => {
    const copy = deleteConfirmationCopy(post.kind);
    showAlertWithButtons(copy.title, copy.message, [
      { text: "Cancel", style: "cancel" },
      { text: copy.confirmLabel, style: "destructive", onPress: () => mutation.mutate(post) },
    ], { intent: "delete" });
  };
  return { confirmAndDelete, isDeleting: mutation.isPending };
}

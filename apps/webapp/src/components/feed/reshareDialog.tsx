"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { requireAuthThen } from "@/components/auth/authPrompt.store";
import { Dialog } from "@/components/ui/dialog";
import { QuoteActionIcon, RepostActionIcon } from "@/components/ui/icons";
import { showToast } from "@/components/ui/toast";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { postsService } from "@/services/posts.service";
import type { Post } from "@/types";
import { addRepostEverywhere, removeRepostEverywhere } from "@/utils/postEngagementCache.util";

import styles from "./reshareDialog.module.css";

export const quoteComposerHref = (postId: string) => `/post/new?quote=${encodeURIComponent(postId)}`;

export function ReshareDialog({ post, onClose }: { readonly post: Pick<Post, "id" | "reposted"> | null; readonly onClose: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const reposted = post?.reposted === true;

  const repostMutation = useMutation({
    mutationFn: ({ postId, undo }: { readonly postId: string; readonly undo: boolean }) => (undo ? postsService.undoRepost(postId) : postsService.repostPost(postId).then(() => undefined)),
    onSuccess: (_result, { postId, undo }) => {
      if (undo) removeRepostEverywhere(queryClient, postId);
      else addRepostEverywhere(queryClient, postId);
      showToast({ text: undo ? "Repost removed" : "Reposted" });
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
      onClose();
    },
    onError: (error) => showToast({ text: readErrorMessageForDisplay(error), tone: "error" }),
  });

  const toggleRepost = () => {
    if (!post || repostMutation.isPending) return;
    const postId = post.id;
    requireAuthThen(() => repostMutation.mutate({ postId, undo: reposted }), "Sign in to repost.");
  };

  const openQuoteComposer = () => {
    if (!post) return;
    const href = quoteComposerHref(post.id);
    onClose();
    requireAuthThen(() => router.push(href), "Sign in to quote.");
  };

  return (
    <Dialog isOpen={post !== null} onClose={onClose} title="Repost" layout="sheet" size="small" icon={<RepostActionIcon size={22} />}>
      <div className={styles.options}>
        <button type="button" className={styles.option} disabled={repostMutation.isPending} onClick={toggleRepost}>
          <RepostActionIcon size={20} />
          <span className={styles.optionText}>
            <strong>{reposted ? "Undo repost" : "Repost"}</strong>
            <span>{reposted ? "Remove this from your profile and followers’ feeds." : "Share this with your followers as-is."}</span>
          </span>
        </button>
        <button type="button" className={styles.option} disabled={repostMutation.isPending} onClick={openQuoteComposer}>
          <QuoteActionIcon size={20} />
          <span className={styles.optionText}>
            <strong>Quote</strong>
            <span>Write a post with this attached.</span>
          </span>
        </button>
        {repostMutation.isPending ? <p className={styles.busy} aria-live="polite">{reposted ? "Removing…" : "Reposting…"}</p> : null}
      </div>
    </Dialog>
  );
}

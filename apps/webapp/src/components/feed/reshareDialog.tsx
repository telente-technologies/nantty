"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { requireAuthThen } from "@/components/auth/authPrompt.store";
import { Dialog } from "@/components/ui/dialog";
import { ReplyActionIcon, RepostActionIcon } from "@/components/ui/icons";
import { showToast } from "@/components/ui/toast";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { postsService } from "@/services/posts.service";
import type { Post } from "@/types";
import { hasSendableContent } from "@/utils/sendableContent.util";

import styles from "./reshareDialog.module.css";

export function ReshareDialog({ post, onClose }: { readonly post: Post | null; readonly onClose: () => void }) {
  const queryClient = useQueryClient();
  const [isComposingQuote, setIsComposingQuote] = useState(false);
  const [quote, setQuote] = useState("");

  useEffect(() => {
    if (post) {
      setIsComposingQuote(false);
      setQuote("");
    }
  }, [post]);

  const reshareMutation = useMutation({
    mutationFn: (text?: string) => postsService.repostPost(post?.id ?? "", text),
    onSuccess: (_created, text) => {
      showToast({ text: text ? "Posted your quote" : "Reposted" });
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
      if (post) void queryClient.invalidateQueries({ queryKey: ["post", post.id] });
      onClose();
    },
    onError: (error) => showToast({ text: readErrorMessageForDisplay(error), tone: "error" }),
  });

  function submitQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = quote.trim();
    if (!hasSendableContent(text) || reshareMutation.isPending) return;
    requireAuthThen(() => reshareMutation.mutate(text), "Sign in to repost.");
  }

  const canQuote = hasSendableContent(quote);

  return (
    <Dialog
      isOpen={post !== null}
      onClose={onClose}
      title={isComposingQuote ? "Quote" : "Repost"}
      description={isComposingQuote ? undefined : `Repost this by ${post?.author.name ?? "this author"} to your followers?`}
      layout="sheet"
      size="small"
      icon={<RepostActionIcon size={22} />}
    >
      {isComposingQuote ? (
        <form className={styles.composer} onSubmit={submitQuote}>
          <label htmlFor="reshare-quote-input" className="visuallyHidden">
            Add a comment to your quote
          </label>
          <textarea
            id="reshare-quote-input"
            className={styles.composerInput}
            value={quote}
            maxLength={2200}
            rows={4}
            autoFocus
            placeholder="Add a comment"
            onChange={(event) => setQuote(event.target.value)}
          />
          <div className={styles.composerActions}>
            <button type="button" className={styles.secondary} onClick={() => setIsComposingQuote(false)} disabled={reshareMutation.isPending}>
              Back
            </button>
            <button type="submit" className={styles.primary} disabled={!canQuote || reshareMutation.isPending}>
              {reshareMutation.isPending ? "Posting…" : "Post quote"}
            </button>
          </div>
        </form>
      ) : (
        <div className={styles.options}>
          <button
            type="button"
            className={styles.option}
            disabled={reshareMutation.isPending}
            onClick={() => requireAuthThen(() => reshareMutation.mutate(undefined), "Sign in to repost.")}
          >
            <RepostActionIcon size={20} />
            <span className={styles.optionText}>
              <strong>Repost</strong>
              <span>Share this with your followers as-is.</span>
            </span>
          </button>
          <button type="button" className={styles.option} onClick={() => setIsComposingQuote(true)}>
            <ReplyActionIcon size={20} />
            <span className={styles.optionText}>
              <strong>Quote</strong>
              <span>Add your own comment above the post.</span>
            </span>
          </button>
          {reshareMutation.isPending ? <p className={styles.busy} aria-live="polite">Reposting…</p> : null}
        </div>
      )}
    </Dialog>
  );
}

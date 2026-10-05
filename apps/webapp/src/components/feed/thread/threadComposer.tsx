"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { requireAuthThen } from "@/components/auth/authPrompt.store";
import { MentionAutocompleteInput } from "@/components/mentions/mentionAutocompleteInput";
import mentionStyles from "@/components/mentions/mentions.module.css";
import { useSession } from "@/components/providers/sessionProvider";
import { Avatar } from "@/components/ui/media";
import { showToast } from "@/components/ui/toast";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { commentsService } from "@/services/webActions.service";
import type { ThreadReply } from "@/types/postThread.type";
import type { ReplyRestriction } from "@/types/postAudience.type";
import { LockIcon } from "@/components/ui/icons";
import { maximumMentionsPerText } from "@/types/mentions.type";
import { buildMentionEntitiesFromText, countMentionsInText, type MentionDraft } from "@/utils/mentions.util";

import styles from "./thread.module.css";
import composerStyles from "./threadComposer.module.css";

interface ThreadComposerProps {
  readonly postId: string;
  readonly postAuthorUsername: string;
  readonly replyTarget: ThreadReply | null;
  readonly onCancelReply: () => void;
  readonly replyRestriction?: ReplyRestriction | null;
}

export function ThreadComposer({ postId, postAuthorUsername, replyTarget, onCancelReply, replyRestriction }: ThreadComposerProps) {
  const { viewer } = useSession();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [chosenMentions, setChosenMentions] = useState<readonly MentionDraft[]>([]);
  const mentionCount = countMentionsInText(text, chosenMentions);
  const replyingToUsername = replyTarget?.author.username ?? postAuthorUsername;
  const postMutation = useMutation({
    mutationFn: (replyText: string) => commentsService.addComment(postId, replyText, replyTarget?.id, buildMentionEntitiesFromText(replyText, chosenMentions)),
    onSuccess: () => {
      setText("");
      setChosenMentions([]);
      void queryClient.invalidateQueries({ queryKey: ["post-thread", postId] });
      if (replyTarget) void queryClient.invalidateQueries({ queryKey: ["post-thread-replies", replyTarget.id] });
      showToast({ text: "Reply posted" });
      onCancelReply();
    },
    onError: (error) => showToast({ text: readErrorMessageForDisplay(error), tone: "error" }),
  });

  function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const replyText = text.trim();
    if (!replyText) return;
    requireAuthThen(() => postMutation.mutate(replyText), "Sign in to join the conversation.");
  }

  if (!viewer) {
    return (
      <div className={composerStyles.composer}>
        <button type="button" className={composerStyles.guestPrompt} onClick={() => requireAuthThen(() => undefined, "Sign in to join the conversation.")}>
          <span>Post your reply</span>
          <span className={composerStyles.guestPromptAction}>Sign in to reply</span>
        </button>
      </div>
    );
  }

  if (replyRestriction) {
    return (
      <div className={[composerStyles.composer, composerStyles.restricted].join(" ")} role="note" aria-label="Who can reply?">
        <LockIcon size={18} />
        <p className={composerStyles.restrictedText}>
          <strong>Who can reply?</strong>
          <span>{replyRestriction.message}</span>
        </p>
      </div>
    );
  }

  const inputId = `thread-reply-${postId}`;
  return (
    <form className={composerStyles.composer} onSubmit={submitReply}>
      <p className={composerStyles.composerReplyingTo}>
        Replying to <strong>@{replyingToUsername}</strong>
        {replyTarget ? (
          <button type="button" className={styles.textAction} onClick={onCancelReply}>
            Reply to post instead
          </button>
        ) : null}
      </p>
      <div className={composerStyles.composerRow}>
        <Avatar name={viewer.name} src={viewer.avatarUrl} size="sm" />
        <label htmlFor={inputId} className="visuallyHidden">
          Post your reply to @{replyingToUsername}
        </label>
        <MentionAutocompleteInput
          key={replyTarget?.id ?? "post"}
          id={inputId}
          className={composerStyles.composerInput}
          value={text}
          maxLength={1000}
          autoFocus={replyTarget !== null}
          enabled
          surface="comment"
          placeholder="Post your reply"
          chosenMentions={chosenMentions}
          onChooseMention={(mention) => setChosenMentions((current) => (current.some((entry) => entry.userId === mention.userId) ? current : [...current, mention]))}
          onChange={setText}
        />
        <button type="submit" className={composerStyles.composerSend} disabled={!text.trim() || postMutation.isPending}>
          Reply
        </button>
      </div>
      {mentionCount > 0 ? (
        <span className={mentionStyles.mentionCounter} aria-live="polite">
          {mentionCount}/{maximumMentionsPerText} mentions
        </span>
      ) : null}
    </form>
  );
}

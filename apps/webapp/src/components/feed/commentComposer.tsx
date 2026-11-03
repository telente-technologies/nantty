"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { requireAuthThen } from "@/components/auth/authPrompt.store";
import { useSession } from "@/components/providers/sessionProvider";
import { Avatar } from "@/components/ui/media";
import { showToast } from "@/components/ui/toast";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { MentionAutocompleteInput } from "@/components/mentions/mentionAutocompleteInput";
import { commentsService } from "@/services/webActions.service";
import { actingProfileService } from "@/services/actingProfile.service";
import { commentableActingProfiles } from "@/utils/commentableActingProfiles.util";
import type { Comment } from "@/types";
import { maximumMentionsPerText } from "@/types/mentions.type";
import { buildMentionEntitiesFromText, countMentionsInText, type MentionDraft } from "@/utils/mentions.util";
import mentionStyles from "@/components/mentions/mentions.module.css";

import styles from "./commentsPanel.module.css";
import { QuotedPostCard } from "./quotedPostCard";
import { useQuotedPostPreview } from "./quotedPostPreview.hook";

interface CommentComposerProps {
  readonly postId: string;
  readonly parentCommentId?: string;
  readonly replyingTo?: MentionDraft;
  readonly onPosted?: (created: Comment) => void;
  readonly autoFocus?: boolean;
}

export function CommentComposer({ postId, parentCommentId, replyingTo, onPosted, autoFocus = false }: CommentComposerProps) {
  const { viewer } = useSession();
  const queryClient = useQueryClient();
  const [selectedProfileId, setSelectedProfileId] = useState<string | undefined>();
  const profilesQuery = useQuery({ queryKey: ["users", "me", "profiles"], queryFn: actingProfileService.fetchMine, enabled: viewer !== null, retry: false, staleTime: 60_000 });
  const commentProfiles = commentableActingProfiles(profilesQuery.data ?? []);
  const selectedProfile = commentProfiles.find((profile) => profile.id === selectedProfileId);
  const [text, setText] = useState(replyingTo ? `@${replyingTo.username} ` : "");
  const [chosenMentions, setChosenMentions] = useState<readonly MentionDraft[]>(replyingTo ? [replyingTo] : []);
  const mentionCount = countMentionsInText(text, chosenMentions);
  const quote = useQuotedPostPreview(text);
  const postMutation = useMutation({
    mutationFn: (commentText: string) => commentsService.addComment(postId, commentText, parentCommentId, buildMentionEntitiesFromText(commentText, chosenMentions), quote.quotedPostId, selectedProfile?.id),
    onSuccess: (created) => {
      setText("");
      setChosenMentions([]);
      quote.reset();
      void queryClient.invalidateQueries({ queryKey: ["comments", postId] });
      if (parentCommentId) void queryClient.invalidateQueries({ queryKey: ["commentReplies", parentCommentId] });
      onPosted?.(created);
    },
    onError: (error) => showToast({ text: readErrorMessageForDisplay(error), tone: "error" }),
  });

  function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const commentText = text.trim();
    if (!commentText || postMutation.isPending) return;
    requireAuthThen(() => postMutation.mutate(commentText), "Sign in to join the conversation.");
  }

  const inputId = `comment-input-${parentCommentId ?? postId}`;
  return (
    <form className={[styles.composer, parentCommentId ? styles.composerReply : ""].join(" ")} onSubmit={submitComment}>
      <Avatar name={selectedProfile?.name ?? viewer?.name ?? "You"} src={selectedProfile?.avatarUrl ?? viewer?.avatarUrl ?? null} size={parentCommentId ? "xs" : "sm"} />
      {viewer && commentProfiles.length > 0 ? (
        <label className={styles.commentIdentity}>
          <span className="visuallyHidden">Commenting as</span>
          <select aria-label="Comment as" value={selectedProfile?.id ?? ""} onChange={(event) => setSelectedProfileId(event.target.value || undefined)}>
            <option value="">Comment as {viewer.username ? `@${viewer.username}` : viewer.name}</option>
            {commentProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name} · @{profile.handle}</option>)}
          </select>
        </label>
      ) : null}
      <label htmlFor={inputId} className="visuallyHidden">
        {parentCommentId ? "Write a reply" : "Add a comment"}
      </label>
      <MentionAutocompleteInput
        id={inputId}
        className={styles.composerInput}
        value={text}
        maxLength={1000}
        autoFocus={autoFocus}
        enabled={viewer !== null}
        surface="comment"
        onFocus={() => {
          if (!viewer) requireAuthThen(() => undefined, "Sign in to join the conversation.");
        }}
        placeholder={parentCommentId ? "Write a reply…" : "Add a comment… Use @ to mention someone"}
        chosenMentions={chosenMentions}
        onChooseMention={(mention) => setChosenMentions((current) => (current.some((entry) => entry.userId === mention.userId) ? current : [...current, mention]))}
        onChange={setText}
      />
      {mentionCount > 0 ? (
        <span className={mentionStyles.mentionCounter} aria-live="polite">
          {mentionCount}/{maximumMentionsPerText} mentions
        </span>
      ) : null}
      {quote.preview ? (
        <div className={styles.composerQuote}>
          <QuotedPostCard quoted={quote.preview.quoted} loading={quote.preview.status === "loading"} unavailable={quote.preview.status === "unavailable"} onRemove={quote.remove} />
        </div>
      ) : null}
      <button type="submit" className={styles.composerSend} disabled={!text.trim() || postMutation.isPending}>
        {parentCommentId ? "Reply" : "Post"}
      </button>
    </form>
  );
}

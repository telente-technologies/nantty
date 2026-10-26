"use client";

import { useMutation } from "@tanstack/react-query";
import { useRef, useState, type FormEvent } from "react";

import { requestConfirmation } from "@nantty/web-kit";

import { Button } from "@/components/ui/button";
import { TextAreaField } from "@/components/ui/field";
import { Badge } from "@/components/ui/feedback";
import { EyeIcon, HideIcon, PinIcon, ReplyIcon, TrashIcon } from "@/components/ui/icons";
import { Avatar } from "@/components/ui/media";
import { webappLinks } from "@/config/webappLinks.config";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { commentsService } from "@/services/comments.service";
import type { MyPostComment } from "@/types/studioSocial.type";
import { formatTimeSincePosted } from "@/utils/formatDate.util";

import styles from "./comments.module.css";

const MAX_REPLY_LENGTH = 1500;

interface CommentItemProps {
  readonly comment: MyPostComment;
  readonly onChanged: () => void;
}

export function CommentItem({ comment, onChanged }: CommentItemProps) {
  const post = comment.post;
  const [replying, setReplying] = useState(false);
  const [draft, setDraft] = useState("");
  const inFlight = useRef(false);
  const authorName = comment.author.name || comment.author.username;
  const reply = useMutation({
    mutationFn: (text: string) => commentsService.reply(post.id, comment.id, text),
    onSuccess: () => {
      setDraft("");
      setReplying(false);
      onChanged();
    },
  });
  const pin = useMutation({
    mutationFn: async () => {
      if (comment.isPinned) await commentsService.unpinComment(post.id, comment.id);
      else await commentsService.pinComment(post.id, comment.id);
    },
    onSuccess: onChanged,
  });
  const remove = useMutation({ mutationFn: () => commentsService.deleteComment(comment.id), onSuccess: onChanged });
  const visibility = useMutation({
    mutationFn: () => (comment.hidden ? commentsService.unhideComment(post.id, comment.id) : commentsService.hideComment(post.id, comment.id)),
    onSuccess: onChanged,
  });
  const failure = reply.error ?? pin.error ?? remove.error ?? visibility.error;
  const trimmed = draft.trim();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trimmed || trimmed.length > MAX_REPLY_LENGTH || inFlight.current) return;
    inFlight.current = true;
    reply.mutate(trimmed, { onSettled: () => { inFlight.current = false; } });
  }

  async function confirmDelete() {
    const confirmed = await requestConfirmation({ title: "Delete this comment?", description: `${authorName}'s comment and its replies are removed for everyone. This can't be undone.`, confirmLabel: "Delete comment", cancelLabel: "Keep it", tone: "danger" });
    if (confirmed && !remove.isPending) remove.mutate();
  }

  return (
    <li className={styles.item}>
      <div className={styles.head}>
        <Avatar name={authorName} src={comment.author.avatarUrl} size="sm" />
        <div className={styles.headText}>
          <span className={styles.author}>
            <span className={styles.authorName}>{authorName}</span>
            <span className={styles.meta}>{`@${comment.author.username} · ${formatTimeSincePosted(comment.createdAt)}`}</span>
            {comment.isPinned ? <Badge tone="brand">Pinned</Badge> : null}
            {comment.hidden ? <Badge tone="warning">Hidden</Badge> : null}
            {comment.parentCommentId ? <Badge>Reply</Badge> : null}
            {comment.isPostAuthor ? <Badge>You</Badge> : null}
          </span>
          <a className={styles.postLink} href={webappLinks.post(post.id)} target="_blank" rel="noopener noreferrer">
            {`On: ${post.text || (post.kind === "clip" ? "Untitled clip" : "Untitled post")}`}
            <span className="visuallyHidden"> (opens in a new tab)</span>
          </a>
        </div>
      </div>
      <p className={styles.text}>{comment.text}</p>
      {comment.previewReplies.length > 0 ? (
        <ul className={styles.replies} aria-label={`Replies to ${authorName}`}>
          {comment.previewReplies.map((entry) => (
            <li key={entry.id} className={styles.reply}>
              <strong>{entry.isPostAuthor ? "You" : entry.author.name || entry.author.username}</strong>{` ${entry.text}`}
            </li>
          ))}
          {comment.replyCount > comment.previewReplies.length ? <li className={styles.meta}>{`${comment.replyCount - comment.previewReplies.length} more on the post`}</li> : null}
        </ul>
      ) : null}
      {comment.hidden ? <p className={styles.meta}>Hidden from everyone except you and {authorName}. Replies under it are hidden too.</p> : null}
      <div className={styles.actions}>
        {comment.hidden ? null : (
          <Button variant="secondary" size="sm" leadingIcon={<ReplyIcon size={16} />} aria-expanded={replying} onClick={() => setReplying((value) => !value)}>
            {replying ? "Close" : "Reply"}
          </Button>
        )}
        {comment.hidden || comment.parentCommentId ? null : (
          <Button variant="ghost" size="sm" leadingIcon={<PinIcon size={16} />} busy={pin.isPending} onClick={() => pin.mutate()}>
            {comment.isPinned ? "Unpin" : "Pin"}
          </Button>
        )}
        {comment.isPostAuthor ? null : (
          <Button variant="ghost" size="sm" leadingIcon={comment.hidden ? <EyeIcon size={16} /> : <HideIcon size={16} />} busy={visibility.isPending} onClick={() => !visibility.isPending && visibility.mutate()}>
            {comment.hidden ? "Unhide" : "Hide"}
          </Button>
        )}
        <Button variant="ghost" size="sm" leadingIcon={<TrashIcon size={16} />} busy={remove.isPending} onClick={() => void confirmDelete()}>
          Delete
        </Button>
      </div>
      {replying && !comment.hidden ? (
        <form className={styles.replyForm} onSubmit={submit} aria-label={`Reply to ${authorName}`}>
          <TextAreaField
            label="Your reply"
            rows={3}
            value={draft}
            maxLength={MAX_REPLY_LENGTH}
            placeholder={`Reply to @${comment.author.username}`}
            hint={`${trimmed.length}/${MAX_REPLY_LENGTH}`}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className={styles.replyFoot}>
            <Button type="submit" size="sm" busy={reply.isPending} disabled={!trimmed}>Post reply</Button>
          </div>
        </form>
      ) : null}
      {failure ? <p className={styles.error} role="alert">{readErrorMessageForDisplay(failure)}</p> : null}
    </li>
  );
}

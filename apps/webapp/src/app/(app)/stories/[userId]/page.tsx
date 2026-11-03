"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { requireAuthThen } from "@/components/auth/authPrompt.store";
import { useDeleteOwnPost } from "@/components/feed/useDeleteOwnPost.hook";
import { useSession } from "@/components/providers/sessionProvider";
import { readChatCryptoErrorMessage } from "@/services/chatCrypto/chatCrypto.service";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { storiesService } from "@/services/stories.service";
import { useAuthStore } from "@/store/auth.store";
import { getStoryTrayNeighbors } from "@/utils/storyTrayNavigation.util";

import { ErrorState } from "@/components/ui/feedback";
import { Avatar } from "@/components/ui/media";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";

import styles from "./page.module.css";

export default function StoryViewerPage() {
  const params = useParams<{ userId: string }>();
  const userId = params.userId;
  const stories = useQuery({ queryKey: ["stories", userId], queryFn: () => storiesService.fetchStoriesForUser(userId) });
  const storyTray = useQuery({ queryKey: ["story-tray"], queryFn: storiesService.fetchStoryTray });
  const [storyPosition, setStoryPosition] = useState({ userId, index: 0 });
  const [startAtLastUserId, setStartAtLastUserId] = useState<string | null>(null);
  const list = stories.data ?? [];
  const index = storyPosition.userId === userId
    ? storyPosition.index
    : startAtLastUserId === userId ? Math.max(list.length - 1, 0) : 0;
  const [replyState, setReplyState] = useState({ userId, draft: "", notice: "" });
  const [isReplyFocused, setIsReplyFocused] = useState(false);
  const replyDraft = replyState.userId === userId ? replyState.draft : "";
  const replyNotice = replyState.userId === userId ? replyState.notice : "";
  const router = useRouter();
  const { viewer } = useSession();
  const { confirmAndDelete, isDeleting } = useDeleteOwnPost({ onDeleted: () => {
    if ((stories.data ?? []).length === 0) router.replace("/stories");
  } });
  const current = list[Math.min(index, Math.max(list.length - 1, 0))];
  const tray = storyTray.data ?? [];
  const { previous: previousStoryUser, next: nextStoryUser } = getStoryTrayNeighbors(tray, userId);
  const goToNextStory = useCallback(() => {
    if (index < list.length - 1) {
      setStoryPosition({ userId, index: index + 1 });
      return;
    }
    if (storyTray.isLoading) return;
    if (nextStoryUser) {
      setStartAtLastUserId(null);
      router.replace(`/stories/${encodeURIComponent(nextStoryUser.user.id)}`);
      return;
    }
    router.replace("/stories");
  }, [index, list.length, nextStoryUser, router, storyTray.isLoading, userId]);
  const goToPreviousStory = useCallback(() => {
    if (index > 0) {
      setStoryPosition({ userId, index: index - 1 });
      return;
    }
    if (previousStoryUser) {
      setStartAtLastUserId(previousStoryUser.user.id);
      router.replace(`/stories/${encodeURIComponent(previousStoryUser.user.id)}`);
    }
  }, [index, previousStoryUser, router, userId]);
  const reply = useMutation({
    mutationFn: (variables: { readonly storyId: string; readonly authorId: string; readonly viewerId: string; readonly text: string }) =>
      storiesService.replyToStory(variables.storyId, variables.authorId, variables.viewerId, variables.text),
    onSuccess: (_, variables) => {
      setReplyState((currentState) => currentState.userId === userId
        ? { ...currentState, draft: currentState.draft === variables.text ? "" : currentState.draft, notice: "Reply sent in a private chat." }
        : currentState);
    },
  });
  useEffect(() => {
    if (current && !current.seen && viewer) {
      void storiesService.markStoryAsSeen(current.id).catch(() => undefined);
    }
  }, [current, viewer]);
  useEffect(() => {
    if (!current || current.media.type === "video" || isReplyFocused || reply.isPending) return;
    const timer = window.setTimeout(goToNextStory, 8000);
    return () => window.clearTimeout(timer);
  }, [current, goToNextStory, isReplyFocused, reply.isPending]);
  const viewers = useQuery({
    queryKey: ["stories", current?.id, "viewers"],
    queryFn: () => storiesService.fetchStoryViewers(current!.id),
    enabled: !!current && viewer?.id === current.author.id,
    retry: false,
  });
  function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = replyDraft.trim();
    if (!text || !current || reply.isPending) return;
    setReplyState((currentState) => ({ ...currentState, userId, notice: "" }));
    const send = (viewerId: string | null) => {
      if (!viewerId) return;
      reply.mutate({ storyId: current.id, authorId: current.author.id, viewerId, text });
    };
    if (viewer?.id) send(viewer.id);
    else requireAuthThen(() => send(useAuthStore.getState().user?.id ?? null), "Sign in to reply to stories.");
  }
  function submitOnEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }
  if (stories.isLoading) return <ListRowsSkeleton label="Loading story" rows={3} />;
  if (stories.isError || !current) return <ErrorState description="This story isn't available." error={stories.error} onRetry={() => void stories.refetch()} />;
  const media = current.media;
  const isVideo = media.type === "video";
  return (
    <div className={styles.page}>
      <div className={styles.progress} aria-hidden="true">
        {list.map((story, position) => (
          <span key={story.id} className={[styles.progressSegment, position <= index ? styles.progressDone : ""].filter(Boolean).join(" ")} />
        ))}
      </div>
      <div className={styles.viewer}>
        <span className={styles.rowMain}>
          <Avatar name={current.author.name} src={current.author.avatarUrl} size="md" />
          <span className={styles.rowTitle}>@{current.author.username}</span>
          <span className={styles.rowMeta}>{new Date(current.createdAt).toLocaleString()}</span>
        </span>
        {isVideo && media.url ? (
          <video className={styles.media} src={media.url} poster={media.posterUrl ?? undefined} controls autoPlay muted playsInline onEnded={goToNextStory} />
        ) : media.url ? (
          <img className={styles.media} src={media.url} alt={`Story by ${current.author.username}`} />
        ) : null}
        <div className={styles.controls}>
          <button type="button" className={styles.linkButton} disabled={index === 0 && !previousStoryUser} onClick={goToPreviousStory}>Previous</button>
          <button type="button" className={styles.linkButton} disabled={index >= list.length - 1 && storyTray.isLoading} onClick={goToNextStory}>{index >= list.length - 1 ? nextStoryUser ? "Next person" : "Close stories" : "Next"}</button>
          <Link className={styles.linkButton} href="/stories">All stories</Link>
          {viewer?.id === current.author.id ? (
            <button type="button" className={styles.linkButton} disabled={isDeleting} onClick={() => void confirmAndDelete({ id: current.id, kind: "story" })}>Delete story</button>
          ) : null}
        </div>
        {viewer?.id === current.author.id ? null : (
          <>
            <form className={styles.replyForm} aria-label="Reply to story" onSubmit={submitReply}>
              <label className="visuallyHidden" htmlFor="story-reply">Reply to @{current.author.username}</label>
              <textarea
                id="story-reply"
                className={styles.replyInput}
                rows={1}
                maxLength={1000}
                placeholder={`Reply to @${current.author.username}…`}
                value={replyDraft}
                onFocus={() => setIsReplyFocused(true)}
                onBlur={() => setIsReplyFocused(false)}
                onChange={(event) => setReplyState({ userId, draft: event.target.value, notice: "" })}
                onKeyDown={submitOnEnter}
              />
              <button className={styles.replyButton} type="submit" disabled={!replyDraft.trim() || reply.isPending}>
                {reply.isPending ? "Sending…" : "Send"}
              </button>
            </form>
            {replyNotice ? <p className={styles.replyNotice} role="status">{replyNotice}</p> : null}
            {reply.isError ? <p className={styles.replyError} role="alert">{readChatCryptoErrorMessage(reply.error) ?? readErrorMessageForDisplay(reply.error)}</p> : null}
          </>
        )}
        {viewers.data ? (
          <p className={styles.note}>{viewers.data.total.toLocaleString()} views{viewers.data.viewers.length > 0 ? ` · latest by @${viewers.data.viewers[0]?.username}` : ""}</p>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/feedback";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { scheduledPostsService, type ScheduledPostSummary } from "@/services/scheduledPosts.service";
import { validateScheduleDate } from "@/utils/scheduledPosts.util";

import styles from "./page.module.css";

function scheduledTime(value: string | null): string {
  if (value === null || !Number.isFinite(new Date(value).getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function localDateTimeValue(value: string | null): string {
  if (value === null) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function scheduleFailure(reason: ScheduledPostSummary["failureReason"]): string {
  if (reason === "media_failed") return "Media processing failed. Cancel this schedule and create a new post with working media.";
  if (reason === "media_processing_timeout") return "Media is still processing. Reschedule after it is ready.";
  if (reason === "author_unavailable") return "This account cannot publish right now. Resolve account access before rescheduling.";
  if (reason === "profile_unavailable") return "The selected posting profile is unavailable. Create a new post using an active profile.";
  return "This post could not be published. Cancel it and create a new post.";
}

export default function ScheduledPostsPage() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [textValue, setTextValue] = useState("");
  const [textError, setTextError] = useState<string | null>(null);
  const [scheduleValue, setScheduleValue] = useState("");
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const query = useInfiniteQuery({
    queryKey: ["scheduled-posts"],
    queryFn: ({ pageParam }) => scheduledPostsService.list(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const posts = query.data?.pages.flatMap((page) => page.data) ?? [];
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["scheduled-posts"] });
  const publish = useMutation({ mutationFn: scheduledPostsService.publishNow, onSuccess: refresh });
  const cancel = useMutation({ mutationFn: scheduledPostsService.cancel, onSuccess: refresh });
  const reschedule = useMutation({
    mutationFn: ({ id, scheduledAt }: { readonly id: string; readonly scheduledAt: string }) => scheduledPostsService.reschedule(id, scheduledAt),
    onSuccess: () => { setEditingId(null); setScheduleError(null); void refresh(); },
  });
  const editContent = useMutation({
    mutationFn: ({ id, text }: { readonly id: string; readonly text: string }) => scheduledPostsService.editContent(id, { text }),
    onSuccess: () => { setEditingTextId(null); setTextError(null); void refresh(); },
  });

  const saveSchedule = (postId: string) => {
    const validation = validateScheduleDate(scheduleValue);
    if (!validation.scheduledAt) { setScheduleError(validation.message); return; }
    setScheduleError(null);
    reschedule.mutate({ id: postId, scheduledAt: validation.scheduledAt });
  };

  const saveContent = (post: ScheduledPostSummary) => {
    const trimmed = textValue.trim();
    if (!trimmed && post.media.length === 0) {
      setTextError("Write something before saving, or keep at least one attachment.");
      return;
    }
    if (textValue.length > 2200) {
      setTextError("Text can be up to 2,200 characters.");
      return;
    }
    setTextError(null);
    editContent.mutate({ id: post.id, text: textValue });
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Your posts</p>
          <h1 className={styles.title}>Scheduled</h1>
          <p className={styles.subtitle}>Only you can see these posts until they publish. Times are shown in your local timezone.</p>
        </div>
      </header>

      {query.isLoading ? <Spinner label="Loading scheduled posts" /> : null}
      {query.isError ? <ErrorState description="We couldn't load your scheduled posts." error={query.error} onRetry={() => void query.refetch()} /> : null}
      {query.isSuccess && posts.length === 0 ? <EmptyState title="Nothing scheduled yet" description="Posts you schedule will appear here. You can change the time, publish now or cancel a schedule." /> : null}

      <ul className={styles.list} aria-label="Scheduled posts">
        {posts.map((post) => {
          const isBusy = publish.isPending || cancel.isPending || reschedule.isPending || editContent.isPending;
          const canRescheduleFailure = post.status !== "failed" || post.failureReason === "media_processing_timeout" || post.failureReason === "author_unavailable";
          return (
            <li key={post.id} className={styles.card}>
              <div className={styles.postBody}>
                <p className={post.status === "failed" ? styles.failedStatus : styles.status}>
                  {post.status === "failed" ? "Needs attention" : scheduledTime(post.scheduledAt)}
                </p>
                {post.status === "failed" ? <p className={styles.failure}>{scheduleFailure(post.failureReason)}</p> : null}
                <p className={styles.postText}>{post.text || `${post.media.length} attachment${post.media.length === 1 ? "" : "s"}`}</p>
                <p className={styles.mediaCount}>{post.media.length} media item{post.media.length === 1 ? "" : "s"}</p>
              </div>
              {editingId === post.id ? (
                <div className={styles.rescheduleForm}>
                  <label className={styles.dateLabel} htmlFor={`schedule-${post.id}`}>New publish time</label>
                  <input id={`schedule-${post.id}`} className={styles.dateInput} type="datetime-local" value={scheduleValue} onChange={(event) => setScheduleValue(event.currentTarget.value)} />
                  {scheduleError || reschedule.isError ? <p className={styles.error} role="alert">{scheduleError ?? readErrorMessageForDisplay(reschedule.error)}</p> : null}
                  <div className={styles.actions}>
                    <Button size="sm" busy={reschedule.isPending} onClick={() => saveSchedule(post.id)}>Save time</Button>
                    <Button size="sm" variant="secondary" disabled={reschedule.isPending} onClick={() => { setEditingId(null); setScheduleError(null); }}>Keep current time</Button>
                  </div>
                </div>
              ) : editingTextId === post.id ? (
                <div className={styles.rescheduleForm}>
                  <label className={styles.dateLabel} htmlFor={`text-${post.id}`}>Edit post text</label>
                  <textarea id={`text-${post.id}`} className={styles.textAreaInput} maxLength={2200} value={textValue} onChange={(event) => setTextValue(event.currentTarget.value)} />
                  {textError || editContent.isError ? <p className={styles.error} role="alert">{textError ?? readErrorMessageForDisplay(editContent.error)}</p> : null}
                  <div className={styles.actions}>
                    <Button size="sm" busy={editContent.isPending} onClick={() => saveContent(post)}>Save changes</Button>
                    <Button size="sm" variant="secondary" disabled={editContent.isPending} onClick={() => { setEditingTextId(null); setTextError(null); }}>Discard</Button>
                  </div>
                </div>
              ) : (
                <div className={styles.actions}>
                  <Button size="sm" variant="secondary" disabled={post.status === "failed" || isBusy} onClick={() => publish.mutate(post.id)}>Publish now</Button>
                  <Button size="sm" variant="ghost" disabled={isBusy} onClick={() => { setEditingTextId(post.id); setEditingId(null); setTextValue(post.text); setTextError(null); }}>Edit text</Button>
                  <Button size="sm" variant="ghost" disabled={!canRescheduleFailure || isBusy} onClick={() => { setEditingId(post.id); setEditingTextId(null); setScheduleValue(localDateTimeValue(post.scheduledAt)); }}>Reschedule</Button>
                  <Button size="sm" variant="danger" disabled={isBusy} onClick={() => { if (window.confirm("Cancel this scheduled post? It will remain unpublished and be removed from this list.")) cancel.mutate(post.id); }}>Cancel</Button>
                </div>
              )}
              {publish.isError ? <p className={styles.error} role="alert">{readErrorMessageForDisplay(publish.error)}</p> : null}
              {cancel.isError ? <p className={styles.error} role="alert">{readErrorMessageForDisplay(cancel.error)}</p> : null}
            </li>
          );
        })}
      </ul>

      {query.hasNextPage ? <div className={styles.loadMore}><Button variant="secondary" busy={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>Load more</Button></div> : null}
      {query.isFetchingNextPage ? <Spinner label="Loading more scheduled posts" /> : null}
    </main>
  );
}

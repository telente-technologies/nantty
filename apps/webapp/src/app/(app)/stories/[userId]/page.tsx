"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { useDeleteOwnPost } from "@/components/feed/useDeleteOwnPost.hook";
import { useSession } from "@/components/providers/sessionProvider";

import { ErrorState } from "@/components/ui/feedback";
import { Avatar } from "@/components/ui/media";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";
import { storiesService } from "@/services/stories.service";

import styles from "../../sounds/page.module.css";

export default function StoryViewerPage() {
  const params = useParams<{ userId: string }>();
  const userId = params.userId;
  const stories = useQuery({ queryKey: ["stories", userId], queryFn: () => storiesService.fetchStoriesForUser(userId) });
  const [index, setIndex] = useState(0);
  const router = useRouter();
  const { viewer } = useSession();
  const { confirmAndDelete, isDeleting } = useDeleteOwnPost({ onDeleted: () => {
    if ((stories.data ?? []).length === 0) router.replace("/stories");
  } });
  const list = stories.data ?? [];
  const current = list[Math.min(index, Math.max(list.length - 1, 0))];
  useEffect(() => {
    setIndex(0);
  }, [userId]);
  useEffect(() => {
    if (current && !current.seen && viewer) {
      void storiesService.markStoryAsSeen(current.id).catch(() => undefined);
    }
  }, [current, viewer]);
  useEffect(() => {
    if (list.length <= 1) return;
    const timer = window.setTimeout(() => setIndex((value) => Math.min(value + 1, list.length - 1)), 8000);
    return () => window.clearTimeout(timer);
  }, [index, list.length]);
  const viewers = useQuery({
    queryKey: ["stories", current?.id, "viewers"],
    queryFn: () => storiesService.fetchStoryViewers(current!.id),
    enabled: !!current && viewer?.id === current.author.id,
    retry: false,
  });
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
          <video className={styles.media} src={media.url} poster={media.posterUrl ?? undefined} controls autoPlay muted playsInline />
        ) : media.url ? (
          <img className={styles.media} src={media.url} alt={`Story by ${current.author.username}`} />
        ) : null}
        <div className={styles.controls}>
          <button type="button" className={styles.linkButton} disabled={index === 0} onClick={() => setIndex((value) => Math.max(value - 1, 0))}>Previous</button>
          <button type="button" className={styles.linkButton} disabled={index >= list.length - 1} onClick={() => setIndex((value) => Math.min(value + 1, list.length - 1))}>Next</button>
          <Link className={styles.linkButton} href="/stories">All stories</Link>
          {viewer?.id === current.author.id ? (
            <button type="button" className={styles.linkButton} disabled={isDeleting} onClick={() => void confirmAndDelete({ id: current.id, kind: "story" })}>Delete story</button>
          ) : null}
        </div>
        {viewers.data ? (
          <p className={styles.note}>{viewers.data.total.toLocaleString()} views{viewers.data.viewers.length > 0 ? ` · latest by @${viewers.data.viewers[0]?.username}` : ""}</p>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";

import { RetryButton } from "@/components/ui/controls";
import { EmptyState, ErrorState, Skeleton, Spinner } from "@/components/ui/feedback";
import { SegmentedControl } from "@/components/ui/controls";
import { useInfiniteScrollSentinel } from "@/components/ui/useInfiniteScrollSentinel.hook";
import { discoveryService } from "@/services/discovery.service";
import { requireAuthThen } from "@/components/auth/authPrompt.store";
import { SpeakerHighIcon, SpeakerMutedIcon } from "@/components/ui/icons";
import type { Clip } from "@/types";

import { ClipPlayerCard } from "./clipPlayerCard";
import { useClipInteractions } from "./clipInteractions.hook";
import { FollowingClipsEmptyState } from "./followingClipsEmptyState";
import { ClipCommentsSheet } from "./clipCommentsSheet";
import styles from "./page.module.css";
import { AppIcon } from "@/components/ui/appIcon";

type ClipsTab = "forYou" | "following";

export default function ClipsPage() {
  const searchParams = useSearchParams();
  const startClipId = searchParams.get("start");
  const [tab, setTab] = useState<ClipsTab>("forYou");
  const [activeClipId, setActiveClipId] = useState<string | null>(startClipId);
  const [isMuted, setIsMuted] = useState(true);
  const queryClient = useQueryClient();
  const { engagementFor, toggleLikeOnClip, likeClipWithDoubleTap, toggleFollowOnClipAuthor, shareClipLink, shareCountFor } = useClipInteractions();
  const [commentsForClip, setCommentsForClip] = useState<Clip | null>(null);
  const feedRef = useRef<HTMLDivElement | null>(null);
  const clipsQuery = useInfiniteQuery({
    queryKey: ["clips", tab],
    queryFn: ({ pageParam }) => discoveryService.fetchClipsPage(tab, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
  const sentinelRef = useInfiniteScrollSentinel({ hasNextPage: clipsQuery.hasNextPage, isFetchingNextPage: clipsQuery.isFetchingNextPage, fetchNextPage: clipsQuery.fetchNextPage, rootMargin: "1200px" });
  const clips = (clipsQuery.data?.pages ?? []).flatMap((page) => page.data);

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const mostVisible = entries.filter((entry) => entry.isIntersecting && entry.intersectionRatio > 0.6)[0];
        const clipId = mostVisible?.target.getAttribute("data-clip-id");
        if (clipId) setActiveClipId(clipId);
      },
      { root: feed, threshold: [0.6] },
    );
    feed.querySelectorAll("[data-clip-id]").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [clips.length]);

  useEffect(() => {
    if (!startClipId || clips.length === 0) return;
    feedRef.current?.querySelector(`[data-clip-id="${CSS.escape(startClipId)}"]`)?.scrollIntoView({ block: "start" });
  }, [startClipId, clips.length > 0]);

  const scrollByOneClip = useCallback((direction: 1 | -1) => {
    const feed = feedRef.current;
    if (feed) feed.scrollBy({ top: direction * feed.clientHeight, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, []);

  function handleFeedKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowDown" || event.key === "PageDown") {
      event.preventDefault();
      scrollByOneClip(1);
    }
    if (event.key === "ArrowUp" || event.key === "PageUp") {
      event.preventDefault();
      scrollByOneClip(-1);
    }
    if (event.key === "m") setIsMuted((muted) => !muted);
  }

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <h1 className={styles.title}>Clips</h1>
        <SegmentedControl
          label="Clips feed"
          value={tab}
          onChange={(next: ClipsTab) => (next === "following" ? requireAuthThen(() => setTab("following"), "Sign in to see clips from people you follow.") : setTab(next))}
          options={[
            { value: "forYou", label: "For you" },
            { value: "following", label: "Following" },
          ]}
        />
        <button
          type="button"
          className={[styles.stepButton, styles.muteToggle].join(" ")}
          aria-pressed={isMuted}
          aria-label={isMuted ? "Unmute clips" : "Mute clips"}
          title={isMuted ? "Unmute (M)" : "Mute (M)"}
          onClick={() => setIsMuted((muted) => !muted)}
        >
          {isMuted ? <SpeakerMutedIcon size={20} /> : <SpeakerHighIcon size={20} />}
        </button>
        <div className={styles.stepButtons}>
          <button type="button" className={styles.stepButton} onClick={() => scrollByOneClip(-1)} aria-label="Previous clip">
            <AppIcon name="arrowUp24" size={20} />
          </button>
          <button type="button" className={styles.stepButton} onClick={() => scrollByOneClip(1)} aria-label="Next clip">
            <AppIcon name="arrowDown24" size={20} />
          </button>
        </div>
      </div>

      {clipsQuery.isLoading ? (
        <div className={styles.feed}>
          <Skeleton height="auto" className={styles.stageSkeleton} />
        </div>
      ) : clipsQuery.isError ? (
        <ErrorState description="We couldn't load clips." error={clipsQuery.error} onRetry={() => void clipsQuery.refetch()} />
      ) : clips.length === 0 ? (
        tab === "following" ? (
          <FollowingClipsEmptyState onFollowedCreator={() => void queryClient.invalidateQueries({ queryKey: ["clips", "following"] })} onWatchForYou={() => setTab("forYou")} />
        ) : (
          <EmptyState kind="clips" description="Check back soon for fresh clips." action={<RetryButton onRetry={() => void clipsQuery.refetch()} />} />
        )
      ) : (
        <div ref={feedRef} className={styles.feed} tabIndex={0} onKeyDown={handleFeedKeys} aria-label="Clips. Use the arrow keys to move between clips.">
          {clips.map((clip, index) => (
            <ClipPlayerCard
              key={clip.id}
              clip={clip}
              isActive={activeClipId ? activeClipId === clip.id : index === 0}
              isMuted={isMuted}
              engagement={engagementFor(clip)}
              shareCount={shareCountFor(clip)}
              onToggleMute={() => setIsMuted((muted) => !muted)}
              onToggleLike={() => toggleLikeOnClip(clip)}
              onLikeByDoubleTap={() => likeClipWithDoubleTap(clip)}
              onToggleFollow={() => toggleFollowOnClipAuthor(clip)}
              onOpenComments={() => setCommentsForClip(clip)}
              onShareLink={() => shareClipLink(clip)}
            />
          ))}
          <div ref={sentinelRef} className={styles.sentinel}>
            {clipsQuery.isFetchingNextPage ? <Spinner label="Loading more clips" /> : null}
          </div>
        </div>
      )}
      <ClipCommentsSheet
        postId={commentsForClip?.id ?? null}
        postAuthorId={commentsForClip?.author.id}
        totalComments={commentsForClip?.comments ?? 0}
        quoteCount={commentsForClip?.quotes}
        onClose={() => setCommentsForClip(null)}
      />
    </div>
  );
}

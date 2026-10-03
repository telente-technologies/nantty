"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";

import { RetryButton } from "@/components/ui/controls";
import { EmptyState, ErrorState, Skeleton, Spinner } from "@/components/ui/feedback";
import { SegmentedControl } from "@/components/ui/controls";
import { useInfiniteScrollSentinel } from "@/components/ui/useInfiniteScrollSentinel.hook";
import { discoveryService } from "@/services/discovery.service";

import { ClipPlayerCard } from "./clipPlayerCard";
import styles from "./page.module.css";
import { AppIcon } from "@/components/ui/appIcon";

type ClipsTab = "forYou" | "following";

export default function ClipsPage() {
  const searchParams = useSearchParams();
  const startClipId = searchParams.get("start");
  const [tab, setTab] = useState<ClipsTab>("forYou");
  const [activeClipId, setActiveClipId] = useState<string | null>(startClipId);
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
    if (feed) feed.scrollBy({ top: direction * feed.clientHeight, behavior: "smooth" });
  }, []);

  function handleFeedKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowDown" || event.key === "j" || event.key === "PageDown") {
      event.preventDefault();
      scrollByOneClip(1);
    }
    if (event.key === "ArrowUp" || event.key === "k" || event.key === "PageUp") {
      event.preventDefault();
      scrollByOneClip(-1);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <h1 className={styles.title}>Clips</h1>
        <SegmentedControl
          label="Clips feed"
          value={tab}
          onChange={setTab}
          options={[
            { value: "forYou", label: "For you" },
            { value: "following", label: "Following" },
          ]}
        />
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
        <ErrorState description="We couldn't load clips." action={<RetryButton onRetry={() => clipsQuery.refetch()} />} />
      ) : clips.length === 0 ? (
        <EmptyState title="No clips yet" description="Follow creators to see their clips here." />
      ) : (
        <div ref={feedRef} className={styles.feed} tabIndex={0} onKeyDown={handleFeedKeys} aria-label="Clips. Use the arrow keys to move between clips.">
          {clips.map((clip, index) => (
            <ClipPlayerCard key={clip.id} clip={clip} isActive={activeClipId ? activeClipId === clip.id : index === 0} />
          ))}
          <div ref={sentinelRef} className={styles.sentinel}>
            {clipsQuery.isFetchingNextPage ? <Spinner label="Loading more clips" /> : null}
          </div>
        </div>
      )}
    </div>
  );
}

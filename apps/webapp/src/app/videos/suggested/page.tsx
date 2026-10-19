"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { ClipCommentsSheet } from "@/app/(app)/clips/clipCommentsSheet";
import { useClipInteractions } from "@/app/(app)/clips/clipInteractions.hook";
import { ClipPlayerCard } from "@/app/(app)/clips/clipPlayerCard";
import { suggestedVideoStartQueryKey } from "@/components/feedModules/suggestedClipsStream.hook";
import { AppIcon } from "@/components/ui/appIcon";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/feedback";
import { SpeakerHighIcon, SpeakerMutedIcon } from "@/components/ui/icons";
import { useInfiniteScrollSentinel } from "@/components/ui/useInfiniteScrollSentinel.hook";
import { feedsService } from "@/services/feeds.service";
import { postsService } from "@/services/posts.service";
import type { Clip, Post } from "@/types";
import { buildSuggestedVideoSequence } from "@/utils/suggestedVideoSequence.util";

import styles from "./page.module.css";

const wellFormedClipIdPattern = /^[A-Za-z0-9_-]{1,64}$/;
const isPlayableClip = (post: Post): post is Clip => post.kind === "clip" || post.media.some((media) => media.type === "video");
const isTypingTarget = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function SuggestedVideosMessage({ title, body, children }: { readonly title: string; readonly body: string; readonly children?: ReactNode }) {
  return (
    <div className={styles.message} role="status">
      <h2 className={styles.messageTitle}>{title}</h2>
      <p className={styles.messageBody}>{body}</p>
      {children ? <div className={styles.messageActions}>{children}</div> : null}
    </div>
  );
}

function SuggestedVideosViewer() {
  const router = useRouter();
  const requestedStartId = useSearchParams().get("start");
  const startIdIsWellFormed = requestedStartId !== null && wellFormedClipIdPattern.test(requestedStartId);
  const [continueWithoutStartClip, setContinueWithoutStartClip] = useState(false);
  const [activeClipId, setActiveClipId] = useState<string | null>(requestedStartId);
  const [isMuted, setIsMuted] = useState(true);
  const [commentsForClip, setCommentsForClip] = useState<Clip | null>(null);
  const feedRef = useRef<HTMLDivElement | null>(null);
  const interactions = useClipInteractions();

  const startClipQuery = useQuery({
    queryKey: suggestedVideoStartQueryKey(requestedStartId ?? ""),
    queryFn: () => postsService.fetchPostById(requestedStartId!),
    enabled: startIdIsWellFormed,
    retry: 1,
    staleTime: 60_000,
  });
  const startClip = startClipQuery.data && isPlayableClip(startClipQuery.data) ? startClipQuery.data : null;
  const startClipUnavailable = !startIdIsWellFormed || startClipQuery.isError || (startClipQuery.isSuccess && startClip === null);
  const stream = useInfiniteQuery({
    queryKey: ["suggestedVideos", "stream", requestedStartId],
    queryFn: ({ pageParam }) => feedsService.fetchSuggestedClipsPage(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: startClip !== null || continueWithoutStartClip,
  });
  const clips = useMemo(() => buildSuggestedVideoSequence(startClip, (stream.data?.pages ?? []).map((page) => page.data)), [startClip, stream.data]);
  const sentinelRef = useInfiniteScrollSentinel({ hasNextPage: stream.hasNextPage, isFetchingNextPage: stream.isFetchingNextPage, fetchNextPage: stream.fetchNextPage, rootMargin: "1200px" });

  const goBack = useCallback(() => {
    if (window.history.length > 1) router.back();
    else router.push("/");
  }, [router]);

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const mostVisible = entries.find((entry) => entry.isIntersecting && entry.intersectionRatio > 0.6);
        const clipId = mostVisible?.target.getAttribute("data-clip-id");
        if (clipId) setActiveClipId(clipId);
      },
      { root: feed, threshold: [0.6] },
    );
    feed.querySelectorAll("[data-clip-id]").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [clips.length]);

  const scrollByOneClip = useCallback((direction: 1 | -1) => {
    const feed = feedRef.current;
    if (feed) feed.scrollBy({ top: direction * feed.clientHeight, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, []);

  useEffect(() => {
    const handleKeys = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target) || commentsForClip) return;
      const key = event.key.toLowerCase();
      if (key === "escape") return goBack();
      if (key === "arrowdown" || key === "j" || key === "pagedown") {
        event.preventDefault();
        scrollByOneClip(1);
      } else if (key === "arrowup" || key === "k" || key === "pageup") {
        event.preventDefault();
        scrollByOneClip(-1);
      } else if (key === "m") {
        setIsMuted((muted) => !muted);
      }
    };
    document.addEventListener("keydown", handleKeys);
    return () => document.removeEventListener("keydown", handleKeys);
  }, [goBack, scrollByOneClip, commentsForClip]);

  const renderBody = () => {
    if (startClipUnavailable && !continueWithoutStartClip) {
      return (
        <SuggestedVideosMessage title="This video isn't available" body="It may have been removed or the link is wrong.">
          <Button onClick={() => setContinueWithoutStartClip(true)}>Watch suggested videos</Button>
          <Button variant="secondary" onClick={goBack}>Go back</Button>
        </SuggestedVideosMessage>
      );
    }
    if (clips.length === 0) {
      if (startClipQuery.isLoading || stream.isPending) return <div className={styles.message}><Spinner label="Loading suggested videos" /></div>;
      if (stream.isError) return <SuggestedVideosMessage title="Couldn't load suggested videos" body="Check your connection and try again."><Button onClick={() => void stream.refetch()}>Try again</Button></SuggestedVideosMessage>;
      return <SuggestedVideosMessage title="No suggested videos right now" body="Check back soon for fresh clips."><Button onClick={goBack}>Back to feed</Button></SuggestedVideosMessage>;
    }
    return (
      <div ref={feedRef} className={styles.feed} tabIndex={0} aria-label="Suggested videos. Use the arrow keys or J and K to move between videos, Escape to go back.">
        {clips.map((clip, index) => (
          <ClipPlayerCard
            key={clip.id}
            clip={clip}
            isActive={activeClipId ? activeClipId === clip.id : index === 0}
            isMuted={isMuted}
            engagement={interactions.engagementFor(clip)}
            shareCount={interactions.shareCountFor(clip)}
            onToggleMute={() => setIsMuted((muted) => !muted)}
            onToggleLike={() => interactions.toggleLikeOnClip(clip)}
            onLikeByDoubleTap={() => interactions.likeClipWithDoubleTap(clip)}
            onToggleFollow={() => interactions.toggleFollowOnClipAuthor(clip)}
            onOpenComments={() => setCommentsForClip(clip)}
            onShareLink={() => interactions.shareClipLink(clip)}
          />
        ))}
        <div ref={sentinelRef} className={styles.sentinel}>{stream.isFetchingNextPage ? <Spinner label="Loading more videos" /> : null}</div>
      </div>
    );
  };

  return (
    <main id="main-content" className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.headerButton} onClick={goBack} aria-label="Back">
          <AppIcon name="arrowLeft24" size={22} />
        </button>
        <h1 className={styles.title}>Suggested videos</h1>
        <span className={styles.spacer} />
        <button type="button" className={styles.headerButton} aria-pressed={isMuted} aria-label={isMuted ? "Unmute videos" : "Mute videos"} title={isMuted ? "Unmute (M)" : "Mute (M)"} onClick={() => setIsMuted((muted) => !muted)}>
          {isMuted ? <SpeakerMutedIcon size={20} /> : <SpeakerHighIcon size={20} />}
        </button>
      </header>
      {renderBody()}
      <ClipCommentsSheet postId={commentsForClip?.id ?? null} postAuthorId={commentsForClip?.author.id} totalComments={commentsForClip?.comments ?? 0} quoteCount={commentsForClip?.quotes} onClose={() => setCommentsForClip(null)} />
    </main>
  );
}

export default function SuggestedVideosPage() {
  return (
    <Suspense fallback={null}>
      <SuggestedVideosViewer />
    </Suspense>
  );
}

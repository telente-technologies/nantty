"use client";

import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";

import { RetryButton } from "@/components/ui/controls";
import { EmptyState, ErrorState, Skeleton, Spinner } from "@/components/ui/feedback";
import { SegmentedControl } from "@/components/ui/controls";
import { useInfiniteScrollSentinel } from "@/components/ui/useInfiniteScrollSentinel.hook";
import { discoveryService } from "@/services/discovery.service";
import { productsService } from "@/services/products.service";
import { useProductInteraction } from "@/components/commerce/useProductInteraction.hook";
import { ProductCard } from "@/components/commerce/productCard";
import { useSession } from "@/components/providers/sessionProvider";
import { feedModuleCadence } from "@/config/feedModules.config";
import { clipProductRecommendationIndexes, clipProductRecommendations } from "@/utils/clipProductRecommendations.util";
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
  const [isRecommendationPageActive, setIsRecommendationPageActive] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const queryClient = useQueryClient();
  const viewerId = useSession().viewer?.id ?? null;
  const { track: trackProductInteraction } = useProductInteraction();
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
  const organicClipCount = clips.reduce((count, clip) => count + (clip.sponsored ? 0 : 1), 0);
  const productRecommendations = useQuery({
    queryKey: ["mart", "recommendations", "clips", viewerId ?? "guest"],
    queryFn: () => productsService.fetchProductsYouMightLike("clips"),
    enabled: tab === "forYou" && organicClipCount >= feedModuleCadence.productsYouMightLike.firstAfterPosts,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const recommendationProducts = productRecommendations.data?.products ?? [];
  const recommendationCadence = feedModuleCadence.productsYouMightLike;
  const recommendationIndexes = clipProductRecommendationIndexes(clips, recommendationCadence, tab === "forYou", recommendationProducts.length > 0);
  const feedItems = clips.flatMap((clip, index) => {
    const item = [{ kind: "clip" as const, key: `clip:${clip.id}`, clip }];
    const products = recommendationIndexes.has(index) ? clipProductRecommendations(recommendationProducts, clip.products.map((product) => product.id)) : [];
    if (products.length === 0) return item;
    return [...item, { kind: "productRecommendations" as const, key: `product-recommendations:${clip.id}`, products }];
  });

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const mostVisible = entries.filter((entry) => entry.isIntersecting && entry.intersectionRatio > 0.6).sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
        if (!mostVisible) return;
        if (mostVisible.target.hasAttribute("data-product-recommendations")) {
          setIsRecommendationPageActive(true);
          return;
        }
        const clipId = mostVisible.target.getAttribute("data-clip-id");
        if (clipId) {
          setIsRecommendationPageActive(false);
          setActiveClipId(clipId);
        }
      },
      { root: feed, threshold: [0.6] },
    );
    feed.querySelectorAll("[data-clip-id], [data-product-recommendations]").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [feedItems.length]);

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
          {feedItems.map((item, index) => item.kind === "productRecommendations" ? (
            <section key={item.key} className={styles.recommendationPage} data-product-recommendations aria-label="Products you might like">
              <h2 className={styles.recommendationPageTitle}>Products you might like</h2>
              <p className={styles.recommendationPageDescription}>Picked for you from Nantty stores.</p>
              <div className={styles.recommendationPageSlider}>
                {item.products.map((product, position) => (
                  <div className={styles.recommendationPageCard} key={product.id}>
                    <ProductCard product={product} showStoreDetails onClick={() => trackProductInteraction("product.clicked", { productId: product.id, surface: "clips_recommendations", position })} />
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <ClipPlayerCard
              key={item.key}
              clip={item.clip}
              isActive={!isRecommendationPageActive && (activeClipId ? activeClipId === item.clip.id : index === 0)}
              isMuted={isMuted}
              engagement={engagementFor(item.clip)}
              shareCount={shareCountFor(item.clip)}
              onToggleMute={() => setIsMuted((muted) => !muted)}
              onToggleLike={() => toggleLikeOnClip(item.clip)}
              onLikeByDoubleTap={() => likeClipWithDoubleTap(item.clip)}
              onToggleFollow={() => toggleFollowOnClipAuthor(item.clip)}
              onOpenComments={() => setCommentsForClip(item.clip)}
              onShareLink={() => shareClipLink(item.clip)}
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

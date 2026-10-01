"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { PostCard } from "@/components/feed/postCard";
import { ProductCard } from "@/components/commerce/productCard";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/feedback";
import { RetryButton, SegmentedControl } from "@/components/ui/controls";
import { feedsService } from "@/services/feeds.service";
import { productsService } from "@/services/products.service";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import styles from "./home.module.css";

type HomeSection = "feed" | "mart";

function TopicFilterRow() {
  const followedQuery = useQuery({ queryKey: ["feed", "topics"], queryFn: feedsService.fetchMyFollowedTopics, retry: false });
  const [activeTopic, setActiveTopic] = useState<string | null>(null);

  if (followedQuery.isLoading) return <div className={styles.topicRowLoading} />;
  const topics = followedQuery.data ?? [];
  if (topics.length === 0) return null;

  return (
    <div className={styles.topicRow} role="group" aria-label="Filter your feed by topic">
      <button type="button" className={[styles.topicChip, activeTopic === null ? styles.topicChipActive : ""].filter(Boolean).join(" ")} onClick={() => setActiveTopic(null)}>
        For you
      </button>
      {topics.map((topic) => (
        <button
          key={topic.id}
          type="button"
          className={[styles.topicChip, activeTopic === topic.id ? styles.topicChipActive : ""].filter(Boolean).join(" ")}
          aria-pressed={activeTopic === topic.id}
          onClick={() => setActiveTopic((previous) => (previous === topic.id ? null : topic.id))}
        >
          {topic.name}
        </button>
      ))}
    </div>
  );
}

function FeedSection() {
  const feedQuery = useInfiniteQuery({
    queryKey: ["feed", "for-you"],
    queryFn: ({ pageParam }) => feedsService.fetchForYouFeedPage(null, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const posts = (feedQuery.data?.pages ?? []).flatMap((page) => page.data);

  if (feedQuery.isLoading) return <Spinner label="Loading your feed" />;
  if (feedQuery.isError) return <ErrorState description="We couldn't load your feed." action={<RetryButton onRetry={() => feedQuery.refetch()} />} />;
  if (posts.length === 0) {
    return <EmptyState icon="✦" title="Your feed is warming up" description="Follow a few people or topics and their posts will show up here." />;
  }

  return (
    <div className={styles.feedList}>
      {posts.map((post, index) => (
        <PostCard key={post.id} post={post} priority={index < 2} />
      ))}
      {feedQuery.hasNextPage ? (
        <button type="button" className={styles.loadMore} onClick={() => feedQuery.fetchNextPage()} disabled={feedQuery.isFetchingNextPage}>
          {feedQuery.isFetchingNextPage ? "Loading…" : "Load more posts"}
        </button>
      ) : null}
    </div>
  );
}

function MartSection() {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const martHome = useQuery({ queryKey: ["mart", "home"], queryFn: productsService.fetchMartHome, retry: false });

  const productsQuery = useInfiniteQuery({
    queryKey: ["products", "page", selectedCategoryId],
    queryFn: ({ pageParam }) => productsService.fetchProductsPage(selectedCategoryId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const products = (productsQuery.data?.pages ?? []).flatMap((page) => page.data);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !productsQuery.hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !productsQuery.isFetchingNextPage) productsQuery.fetchNextPage();
      },
      { rootMargin: "600px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [productsQuery.hasNextPage, productsQuery.isFetchingNextPage, productsQuery]);

  return (
    <div className={styles.mart}>
      {martHome.data?.banners.length ? (
        <div className={styles.banners}>
          {martHome.data.banners.map((banner) => (
            <Link key={banner.id} href="/explore" className={styles.banner}>
              <img src={banner.imageUrl ?? undefined} alt="" className={styles.bannerImage} loading="lazy" />
            </Link>
          ))}
        </div>
      ) : null}

      <div className={styles.collectionRow}>
        <Link href="/collections/sales_of_the_day" className={styles.collectionTile}>
          Sales of the Day
        </Link>
        <Link href="/collections/featured_brands" className={styles.collectionTile}>
          Featured Brands
        </Link>
        <Link href="/collections/new_arrivals" className={styles.collectionTile}>
          New Arrivals
        </Link>
      </div>

      <div className={styles.topicRow} role="group" aria-label="Filter products by category">
        <button
          type="button"
          className={[styles.topicChip, selectedCategoryId === null ? styles.topicChipActive : ""].filter(Boolean).join(" ")}
          onClick={() => setSelectedCategoryId(null)}
        >
          All
        </button>
        {(martHome.data?.categories ?? []).map((category) => (
          <button
            key={category.id}
            type="button"
            className={[styles.topicChip, selectedCategoryId === category.id ? styles.topicChipActive : ""].filter(Boolean).join(" ")}
            aria-pressed={selectedCategoryId === category.id}
            onClick={() => setSelectedCategoryId((previous) => (previous === category.id ? null : category.id))}
          >
            {category.name}
          </button>
        ))}
      </div>

      {productsQuery.isLoading ? (
        <Spinner label="Loading products" />
      ) : productsQuery.isError ? (
        <ErrorState description="We couldn't load products." action={<RetryButton onRetry={() => productsQuery.refetch()} />} />
      ) : products.length === 0 ? (
        <EmptyState icon="🛍" title="Nothing here yet" description="No products in this category right now." />
      ) : (
        <div className={styles.productGrid}>
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      <div ref={sentinelRef} />
      {productsQuery.hasNextPage ? <div className={styles.loadMoreRow}>{productsQuery.isFetchingNextPage ? <Spinner label="Loading more products" /> : null}</div> : null}
    </div>
  );
}

export default function HomePage() {
  const [section, setSection] = useState<HomeSection>("feed");

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <SegmentedControl
          label="Home sections"
          value={section}
          onChange={setSection}
          options={[
            { value: "feed", label: "Feed" },
            { value: "mart", label: "Mart" },
          ]}
        />
      </div>
      {section === "feed" ? (
        <>
          <TopicFilterRow />
          <FeedSection />
        </>
      ) : (
        <MartSection />
      )}
    </div>
  );
}

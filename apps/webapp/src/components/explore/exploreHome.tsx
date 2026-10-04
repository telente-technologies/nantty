"use client";

import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { requireAuthThen } from "@/components/auth/authPrompt.store";
import { PostCard } from "@/components/feed/postCard";
import { Skeleton } from "@/components/ui/feedback";
import { Avatar, SafeImage } from "@/components/ui/media";
import { exploreService } from "@/services/explore.service";
import { followsService } from "@/services/posts.service";
import type { ExploreCategory, ExploreCategoryId, FollowSuggestion, RankingExplanation } from "@/types/explore.type";

import styles from "./exploreHome.module.css";

const defaultCategories: readonly ExploreCategory[] = [
  { id: "for_you", label: "For you" }, { id: "trending", label: "Trending" }, { id: "news", label: "News" }, { id: "sports", label: "Sports" },
  { id: "entertainment", label: "Entertainment" }, { id: "music", label: "Music" }, { id: "tech", label: "Tech" }, { id: "business", label: "Business" },
  { id: "fashion", label: "Fashion" }, { id: "gaming", label: "Gaming" }, { id: "comedy", label: "Comedy" }, { id: "religion", label: "Religion" },
  { id: "food", label: "Food" }, { id: "politics", label: "Politics" }, { id: "lifestyle", label: "Lifestyle" },
];
const collapsedTrendCount = 5;
const compactNumber = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

function SectionState({ loading, error, empty, emptyMessage, onRetry, rows = 3, children }: { readonly loading: boolean; readonly error: boolean; readonly empty: boolean; readonly emptyMessage: string; readonly onRetry: () => void; readonly rows?: number; readonly children: ReactNode }) {
  if (loading) {
    return (
      <div aria-busy="true" aria-label="Loading">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className={styles.skeletonRow}>
            <Skeleton width="40%" height={10} />
            <Skeleton width="80%" height={14} />
          </div>
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <div className={styles.state} role="alert">
        <span>This didn&apos;t load.</span>
        <button type="button" className={styles.linkButton} onClick={onRetry}>Try again</button>
      </div>
    );
  }
  if (empty) return <p className={styles.state}>{emptyMessage}</p>;
  return <>{children}</>;
}

function WhyShown({ explanations }: { readonly explanations: readonly RankingExplanation[] }) {
  if (explanations.length === 0) return null;
  return (
    <details className={styles.why}>
      <summary>Why am I seeing this?</summary>
      <ul className={styles.whyList}>
        {explanations.map((explanation) => (
          <li key={`${explanation.code}-${explanation.label}`}>{explanation.label}{explanation.detail && explanation.code.endsWith("boost") ? `. ${explanation.detail}.` : ""}</li>
        ))}
      </ul>
    </details>
  );
}

function SuggestionRow({ suggestion }: { readonly suggestion: FollowSuggestion }) {
  const [following, setFollowing] = useState(false);
  const follow = useMutation({
    mutationFn: (next: boolean) => (next ? followsService.followUser(suggestion.user.id) : followsService.unfollowUser(suggestion.user.id)),
    onMutate: (next) => setFollowing(next),
    onError: (_error, next) => setFollowing(!next),
  });
  return (
    <div className={styles.person}>
      <Link href={`/${suggestion.user.username}`} className={styles.personLink}>
        <Avatar name={suggestion.user.name} src={suggestion.user.avatarUrl} size="md" />
        <span className={styles.personText}>
          <span className={styles.personName}>
            {suggestion.user.name}
            {suggestion.isOfficial ? <span className={styles.officialBadge}>Official</span> : null}
          </span>
          <span className={styles.meta}>@{suggestion.user.username}</span>
          <span className={styles.meta}>{suggestion.reason.label}</span>
        </span>
      </Link>
      <button type="button" className={[styles.followButton, following ? styles.followButtonActive : ""].join(" ")} aria-pressed={following} onClick={() => requireAuthThen(() => follow.mutate(!following), `Sign in to follow ${suggestion.user.name}.`)}>
        {following ? "Following" : "Follow"}
      </button>
    </div>
  );
}

export function ExploreHome() {
  const [category, setCategory] = useState<ExploreCategoryId>("for_you");
  const [showAllTrends, setShowAllTrends] = useState(false);
  const categories = useQuery({ queryKey: ["explore", "categories"], queryFn: exploreService.listExploreCategories, staleTime: 3_600_000, retry: false });
  const headlines = useQuery({ queryKey: ["explore", "headlines", category], queryFn: () => exploreService.fetchHeadlines(category), staleTime: 120_000, retry: false });
  const trends = useQuery({ queryKey: ["explore", "trends", category], queryFn: () => exploreService.fetchTrends(category), staleTime: 60_000, retry: false });
  const suggestions = useQuery({ queryKey: ["explore", "whoToFollow"], queryFn: exploreService.fetchWhoToFollow, staleTime: 300_000, retry: false });
  const posts = useInfiniteQuery({
    queryKey: ["explore", "postsForYou", category],
    queryFn: ({ pageParam }) => exploreService.fetchPostsForYou(category, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
    retry: false,
  });
  const trendItems = trends.data?.items ?? [];
  const postItems = posts.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <div className={styles.home}>
      <div className={styles.tabs} role="tablist" aria-label="Explore categories">
        {(categories.data?.data ?? defaultCategories).map((option) => (
          <button key={option.id} type="button" role="tab" aria-selected={category === option.id} className={[styles.tab, category === option.id ? styles.tabActive : ""].join(" ")} onClick={() => setCategory(option.id)}>
            {option.label}
          </button>
        ))}
      </div>

      <section className={styles.section} aria-labelledby="explore-happening">
        <h2 id="explore-happening" className={styles.sectionTitle}>What&apos;s happening</h2>
        <SectionState loading={headlines.isLoading} error={headlines.isError} empty={(headlines.data?.items.length ?? 0) === 0} emptyMessage="Nothing big is happening here right now." onRetry={() => void headlines.refetch()}>
          <div className={styles.headlines}>
            {headlines.data?.items.map((headline) => (
              <Link key={headline.id} href={headline.postIds[0] ? `/post/${headline.postIds[0]}` : `/explore?q=${encodeURIComponent(`#${headline.hashtags[0] ?? headline.id}`)}`} className={styles.headline}>
                <span className={styles.headlineText}>
                  <span className={styles.meta}>{headline.categoryLabel} · {compactNumber.format(headline.postCount)} posts</span>
                  <span className={styles.headlineTitle}>{headline.title}</span>
                  <span className={styles.summary}>{headline.summary}</span>
                  <span className={styles.sourceLabel}>{headline.sourceLabel}</span>
                </span>
                {headline.coverImageUrl ? <span className={styles.coverFrame}><SafeImage src={headline.coverImageUrl} alt="" sizes="76px" className={styles.cover} /></span> : null}
              </Link>
            ))}
          </div>
        </SectionState>
      </section>

      <section className={styles.section} aria-labelledby="explore-trends">
        <div className={styles.sectionHeader}>
          <h2 id="explore-trends" className={styles.sectionTitle}>{category === "for_you" ? "Trends for you" : "Trending"}</h2>
          {trendItems.length > collapsedTrendCount ? <button type="button" className={styles.linkButton} onClick={() => setShowAllTrends((value) => !value)}>{showAllTrends ? "Show less" : "Show more"}</button> : null}
        </div>
        <SectionState loading={trends.isLoading} error={trends.isError} empty={trendItems.length === 0} emptyMessage="No trends in this category yet." onRetry={() => void trends.refetch()} rows={4}>
          <div className={styles.list}>
            {(showAllTrends ? trendItems : trendItems.slice(0, collapsedTrendCount)).map((trend) => (
              <Link key={trend.hashtag} href={`/explore?q=${encodeURIComponent(trend.label)}`} className={styles.rowButton}>
                <span className={styles.meta}>{trend.rank} · {trend.context}</span>
                <span className={styles.trendLabel}>{trend.label}</span>
                <span className={styles.meta}>{compactNumber.format(trend.postCount)} posts</span>
              </Link>
            ))}
          </div>
        </SectionState>
      </section>

      <section className={styles.section} aria-labelledby="explore-follow">
        <h2 id="explore-follow" className={styles.sectionTitle}>Who to follow</h2>
        <SectionState loading={suggestions.isLoading} error={suggestions.isError} empty={(suggestions.data?.data.length ?? 0) === 0} emptyMessage="No suggestions right now." onRetry={() => void suggestions.refetch()} rows={2}>
          <div className={styles.list}>
            {suggestions.data?.data.map((suggestion) => <SuggestionRow key={suggestion.user.id} suggestion={suggestion} />)}
          </div>
        </SectionState>
      </section>

      <section className={styles.section} aria-labelledby="explore-posts">
        <h2 id="explore-posts" className={styles.sectionTitle}>Posts for you</h2>
        <SectionState loading={posts.isLoading} error={posts.isError} empty={postItems.length === 0} emptyMessage="No posts here yet. Try another category." onRetry={() => void posts.refetch()} rows={2}>
          <div className={styles.posts}>
            {postItems.map((post) => (
              <div key={post.id}>
                <WhyShown explanations={post.ranking?.explanations ?? []} />
                <PostCard post={post} />
              </div>
            ))}
            {posts.hasNextPage ? <button type="button" className={styles.linkButton} disabled={posts.isFetchingNextPage} onClick={() => void posts.fetchNextPage()}>{posts.isFetchingNextPage ? "Loading…" : "Show more posts"}</button> : null}
          </div>
        </SectionState>
      </section>
    </div>
  );
}

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { PostCard } from "@/components/feed/postCard";
import { isActiveFollowState, useFollowUserToggle } from "@/components/profile/confirmedFollowToggle.hook";
import { Button } from "@/components/ui/button";
import { useRequireAuth } from "@/hooks/useRequireAuth.hook";
import { exploreService } from "@/services/feed/explore.service";
import type { UserSummary } from "@/types";
import type { ExploreCategoryId } from "@/types/explore.type";
import type { FollowState } from "@/types/socialGraph.type";

import { DEFAULT_EXPLORE_CATEGORIES, ExploreCategoryTabs } from "./exploreCategoryTabs";
import { ExploreSectionHeader, ExploreSectionState } from "./exploreSections";
import { FollowSuggestionRow } from "./followSuggestionRow";
import { HeadlineCard } from "./headlineCard";
import { TrendRow } from "./trendRow";
import { WhyShownNotice } from "./whyShownNotice";

export interface ExploreHomeProps {
  readonly onSearchHashtag: (hashtag: string) => void;
  readonly onOpenPost: (postId: string) => void;
  readonly onOpenProfile: (userId: string) => void;
}

const COLLAPSED_TREND_COUNT = 5;

export function ExploreHome({ onSearchHashtag, onOpenPost, onOpenProfile }: ExploreHomeProps) {
  const { requireAuthThen } = useRequireAuth();
  const [category, setCategory] = useState<ExploreCategoryId>("for_you");
  const [showAllTrends, setShowAllTrends] = useState(false);
  const [followStates, setFollowStates] = useState<ReadonlyMap<string, FollowState>>(new Map());
  const { toggleUser } = useFollowUserToggle();
  const categories = useQuery({ queryKey: ["explore", "categories"], queryFn: exploreService.listExploreCategories, staleTime: 3_600_000 });
  const headlines = useQuery({ queryKey: ["explore", "headlines", category], queryFn: () => exploreService.fetchHeadlines(category), staleTime: 120_000 });
  const trends = useQuery({ queryKey: ["explore", "trends", category], queryFn: () => exploreService.fetchTrends(category, 10), staleTime: 60_000 });
  const suggestions = useQuery({ queryKey: ["explore", "whoToFollow"], queryFn: () => exploreService.fetchWhoToFollow(3), staleTime: 300_000 });
  const posts = useInfiniteQuery({
    queryKey: ["explore", "postsForYou", category],
    queryFn: ({ pageParam }) => exploreService.fetchPostsForYou(category, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
  const trendItems = trends.data?.items ?? [];
  const visibleTrends = showAllTrends ? trendItems : trendItems.slice(0, COLLAPSED_TREND_COUNT);
  const postItems = posts.data?.pages.flatMap((page) => page.data) ?? [];
  const toggleFollow = (user: UserSummary) =>
    requireAuthThen(() => toggleUser({ id: user.id, username: user.username, followState: followStates.get(user.id) ?? "none" }, (state) =>
      setFollowStates((current) => new Map(current).set(user.id, state)),
    ), "follow accounts");

  return (
    <View style={styles.root}>
      <ExploreCategoryTabs categories={categories.data?.data ?? DEFAULT_EXPLORE_CATEGORIES} selected={category} onSelect={setCategory} />

      <ExploreSectionHeader title="What's happening" />
      <ExploreSectionState loading={headlines.isLoading} error={headlines.isError} empty={(headlines.data?.items.length ?? 0) === 0} emptyMessage="Nothing big is happening here right now." onRetry={() => void headlines.refetch()}>
        <View style={styles.cards}>
          {headlines.data?.items.map((headline) => (
            <HeadlineCard key={headline.id} headline={headline} onPress={() => (headline.postIds[0] ? onOpenPost(headline.postIds[0]) : onSearchHashtag(headline.hashtags[0] ?? headline.id))} />
          ))}
        </View>
      </ExploreSectionState>

      <ExploreSectionHeader title={category === "for_you" ? "Trends for you" : "Trending"} actionLabel={trendItems.length > COLLAPSED_TREND_COUNT ? (showAllTrends ? "Show less" : "Show more") : undefined} onPressAction={() => setShowAllTrends((value) => !value)} />
      <ExploreSectionState loading={trends.isLoading} error={trends.isError} empty={trendItems.length === 0} emptyMessage="No trends in this category yet." onRetry={() => void trends.refetch()} skeletonRows={4}>
        {visibleTrends.map((trend) => <TrendRow key={trend.hashtag} trend={trend} onPress={() => onSearchHashtag(trend.hashtag)} />)}
      </ExploreSectionState>

      <ExploreSectionHeader title="Who to follow" />
      <ExploreSectionState loading={suggestions.isLoading} error={suggestions.isError} empty={(suggestions.data?.data.length ?? 0) === 0} emptyMessage="No suggestions right now." onRetry={() => void suggestions.refetch()} skeletonRows={2}>
        {suggestions.data?.data.map((suggestion) => (
          <FollowSuggestionRow key={suggestion.user.id} suggestion={suggestion} following={isActiveFollowState(followStates.get(suggestion.user.id))} onPressProfile={() => onOpenProfile(suggestion.user.id)} onToggleFollow={() => toggleFollow(suggestion.user)} />
        ))}
      </ExploreSectionState>

      <ExploreSectionHeader title="Posts for you" />
      <ExploreSectionState loading={posts.isLoading} error={posts.isError} empty={postItems.length === 0} emptyMessage="No posts here yet. Try another category." onRetry={() => void posts.refetch()} skeletonRows={2}>
        {postItems.map((post) => (
          <View key={post.id}>
            <WhyShownNotice explanations={post.ranking?.explanations ?? []} />
            <PostCard post={post} surface="explore" onPress={() => onOpenPost(post.id)} onPressComments={() => onOpenPost(post.id)} onPressAuthor={() => onOpenProfile(post.author.id)} />
          </View>
        ))}
        {posts.hasNextPage ? (
          <View style={styles.more}>
            <Button title="Show more posts" variant="outline" loading={posts.isFetchingNextPage} onPress={() => void posts.fetchNextPage()} />
          </View>
        ) : null}
      </ExploreSectionState>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingBottom: 24 },
  cards: { gap: 10 },
  more: { paddingHorizontal: 16, paddingTop: 12 },
});

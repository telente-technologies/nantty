"use client";

import Link from "next/link";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/controls";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Card, DataRows, Muted, pageStyles } from "@/components/ui/studioPage";
import { contentService } from "@/services/content.service";
import type { RankingBoard, RankingPeriod } from "@/types/audience.type";
import { formatCountWithThousandsSuffix } from "@/utils/formatDate.util";

const boardOptions = [
  { value: "streamer", label: "Streamers" },
  { value: "creator", label: "Creators" },
] as const;

const periodOptions = [
  { value: "day", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
] as const;

function RankingCard({ viewerId }: { readonly viewerId: string | undefined }) {
  const [board, setBoard] = useState<RankingBoard>("streamer");
  const [period, setPeriod] = useState<RankingPeriod>("week");
  const rankings = useQuery({ queryKey: ["rankings", board, period], queryFn: () => contentService.fetchRankings(board, period) });
  const mine = rankings.data?.data.find((entry) => entry.user.id === viewerId);
  return (
    <Card title="Leaderboard">
      <div className={pageStyles.inlineActions}>
        <SegmentedControl label="Board" options={boardOptions} value={board as "streamer" | "creator"} onChange={setBoard} />
        <SegmentedControl label="Period" options={periodOptions} value={period as "day" | "week" | "month"} onChange={setPeriod} />
      </div>
      {rankings.isError ? <ErrorState title="Leaderboard didn't load" error={rankings.error} onRetry={() => void rankings.refetch()} /> : null}
      {rankings.isLoading ? <Skeleton height={80} /> : null}
      {rankings.data ? (
        mine ? <Muted>{`You're #${mine.rank} with ${formatCountWithThousandsSuffix(mine.points)} points.`}</Muted> : <Muted>You're not in the top {rankings.data.data.length || 20} yet. Points come from gifts and engagement in your lives; <Link href="/lives">schedule a live</Link> to climb.</Muted>
      ) : null}
      <DataRows rows={(rankings.data?.data ?? []).slice(0, 10).map((entry) => ({ key: entry.user.id, label: `#${entry.rank} ${entry.user.name || entry.user.username}${entry.user.id === viewerId ? " (you)" : ""}`, value: `${formatCountWithThousandsSuffix(entry.points)} pts` }))} />
    </Card>
  );
}

export function AudiencePanels({ viewerId }: { readonly viewerId: string | undefined }) {
  const followers = useInfiniteQuery({
    queryKey: ["followers", "me"],
    queryFn: ({ pageParam }) => contentService.listFollowers(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const people = followers.data?.pages.flatMap((page) => page.data) ?? [];
  const notFollowedBack = people.filter((person) => !person.isFollowing).length;

  return (
    <div className={pageStyles.columns}>
      <Card title="Recent followers">
        {followers.isError ? <ErrorState title="Followers didn't load" error={followers.error} onRetry={() => void followers.refetch()} /> : null}
        {followers.isLoading ? <Skeleton height={120} /> : null}
        {followers.isSuccess && people.length === 0 ? <EmptyState title="No followers yet" description="Share your profile link in your bio on other apps and post a clip; most first followers come from clips." /> : null}
        {notFollowedBack > 0 ? <Muted>{`${notFollowedBack} of these you don't follow back.`}</Muted> : null}
        <DataRows rows={people.map((person) => ({ key: person.id, label: person.name || person.username, detail: `@${person.username}`, value: person.isFollowing ? "Following" : "" }))} />
        {followers.hasNextPage ? <Button variant="secondary" busy={followers.isFetchingNextPage} onClick={() => void followers.fetchNextPage()}>Load more</Button> : null}
      </Card>
      <RankingCard viewerId={viewerId} />
    </div>
  );
}

"use client";

import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useSession } from "@/components/providers/sessionProvider";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/controls";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Card, DataRows, PageHeader, StatGrid, pageStyles } from "@/components/ui/studioPage";
import { webappLinks } from "@/config/webappLinks.config";
import { contentService } from "@/services/content.service";
import type { MyPost } from "@/types/audience.type";
import { formatCountWithThousandsSuffix, formatTimeSincePosted } from "@/utils/formatDate.util";

type KindFilter = "all" | "post" | "clip";

const kindOptions = [
  { value: "all", label: "All" },
  { value: "clip", label: "Clips" },
  { value: "post", label: "Posts" },
] as const;

const describePost = (post: MyPost) => (post.text.trim() ? post.text.trim().slice(0, 90) : post.kind === "clip" ? "Untitled clip" : "Untitled post");

export default function ContentPage() {
  const { viewer } = useSession();
  const [kind, setKind] = useState<KindFilter>("all");
  const posts = useInfiniteQuery({
    queryKey: ["my-posts", viewer?.id, kind],
    queryFn: ({ pageParam }) => contentService.listMyPosts(viewer!.id, kind === "all" ? null : kind, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: Boolean(viewer?.id),
  });
  const items = posts.data?.pages.flatMap((page) => page.data) ?? [];
  const sum = (pick: (post: MyPost) => number) => formatCountWithThousandsSuffix(items.reduce((total, post) => total + pick(post), 0));

  return (
    <div className={pageStyles.page}>
      <PageHeader
        title="Content"
        subtitle="Views and engagement for every post and clip. Open one to see watch time, completion and who it reached."
        action={<a className={pageStyles.textLink} href={webappLinks.newClip} target="_blank" rel="noopener noreferrer">Post a clip</a>}
      />
      <SegmentedControl label="Content type" options={kindOptions} value={kind} onChange={setKind} />
      {posts.isError ? <ErrorState title="Your content didn't load" error={posts.error} onRetry={() => void posts.refetch()} /> : null}
      {posts.isLoading ? <Skeleton height={160} /> : null}
      {posts.isSuccess && items.length === 0 ? (
        <EmptyState title={kind === "post" ? "No posts yet" : kind === "clip" ? "No clips yet" : "Nothing posted yet"} description="Clips get the most reach. Post one, then come back here for its watch time and completion rate." action={<a className={pageStyles.textLink} href={webappLinks.newClip} target="_blank" rel="noopener noreferrer">Post a clip</a>} />
      ) : null}
      {items.length > 0 ? (
        <>
          <StatGrid
            label={`Totals for the ${items.length} items below`}
            stats={[
              { label: "Views", value: sum((post) => post.views), hint: `Across ${items.length} items shown` },
              { label: "Likes", value: sum((post) => post.likes) },
              { label: "Comments", value: sum((post) => post.comments) },
              { label: "Shares", value: sum((post) => post.shares) },
              { label: "Saves", value: sum((post) => post.saveCount) },
            ]}
          />
          <Card>
            <DataRows
              rows={items.map((post) => ({
                key: post.id,
                label: <Link href={`/content/${post.id}`}>{describePost(post)}</Link>,
                detail: `${post.kind === "clip" ? "Clip" : "Post"} · ${formatTimeSincePosted(post.createdAt)} ago${post.subscriberOnly ? " · Subscribers only" : ""} · ${formatCountWithThousandsSuffix(post.likes)} likes · ${formatCountWithThousandsSuffix(post.comments)} comments`,
                value: `${formatCountWithThousandsSuffix(post.views)} views`,
              }))}
            />
            {posts.hasNextPage ? <Button variant="secondary" busy={posts.isFetchingNextPage} onClick={() => void posts.fetchNextPage()}>Load older content</Button> : null}
          </Card>
        </>
      ) : null}
    </div>
  );
}

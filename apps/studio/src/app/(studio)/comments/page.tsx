"use client";

import { keepPreviousData, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useRealtimeStatus } from "@zudomart/web-kit/src/realtime/realtimeHooks";
import { useDeferredValue, useMemo, useState } from "react";

import { CommentItem } from "@/components/comments/commentItem";
import styles from "@/components/comments/comments.module.css";
import { useSession } from "@/components/providers/sessionProvider";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/controls";
import { SelectField, TextField } from "@/components/ui/field";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { ListPageSkeleton } from "@/components/ui/pageSkeletons";
import { PageHeader, pageStyles } from "@/components/ui/studioPage";
import { webappLinks } from "@/config/webappLinks.config";
import { commentsService } from "@/services/comments.service";
import { contentService } from "@/services/content.service";
import { studioRealtime } from "@/services/realtime/studioRealtime.service";
import type { MyPost } from "@/types/audience.type";
import type { MyPostCommentsFilter } from "@/types/studioSocial.type";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "needs_reply", label: "Needs reply" },
  { value: "pinned", label: "Pinned" },
  { value: "hidden", label: "Hidden" },
] as const;

const ALL_POSTS = "";

const EMPTY_COPY: Record<MyPostCommentsFilter, string> = {
  all: "When people comment on your posts and clips, you can reply to them here.",
  needs_reply: "You've replied to every comment.",
  pinned: "Pin a comment to keep it at the top of a post.",
  hidden: "Comments you hide show up here. Only you and the person who wrote them can see them.",
};

const describePost = (post: MyPost) => {
  const text = post.text.trim() || (post.kind === "clip" ? "Untitled clip" : "Untitled post");
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
};

export default function CommentsPage() {
  const { viewer } = useSession();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<MyPostCommentsFilter>("all");
  const [postId, setPostId] = useState(ALL_POSTS);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const isRealtime = useRealtimeStatus(studioRealtime) === "live";

  const posts = useInfiniteQuery({
    queryKey: ["my-posts", viewer?.id, "all"],
    queryFn: ({ pageParam }) => contentService.listMyPosts(viewer!.id, null, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: Boolean(viewer?.id),
  });
  const postsWithComments = useMemo(() => (posts.data?.pages.flatMap((page) => page.data) ?? []).filter((post) => post.comments > 0), [posts.data]);

  const comments = useInfiniteQuery({
    queryKey: ["my-post-comments", viewer?.id, filter, postId, deferredSearch],
    queryFn: ({ pageParam }) => commentsService.listMyPostComments({ filter, postId, search: deferredSearch, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
    enabled: Boolean(viewer?.id),
    refetchInterval: isRealtime ? false : 60_000,
  });
  const visible = comments.data?.pages.flatMap((page) => page.data) ?? [];

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["my-post-comments"] });
    void queryClient.invalidateQueries({ queryKey: ["my-posts"] });
  };

  const header = <PageHeader title="Comments" subtitle="Reply to, pin, hide and remove comments on your posts and clips. Live chat is moderated from each live's control room." />;
  if (!viewer || comments.isLoading) return <div className={pageStyles.page}>{header}<ListPageSkeleton label="Loading comments" /></div>;
  if (comments.isError) return <div className={pageStyles.page}>{header}<ErrorState title="We couldn't load your comments" error={comments.error} onRetry={() => void comments.refetch()} /></div>;

  const filtered = filter !== "all" || postId !== ALL_POSTS || deferredSearch !== "";

  return (
    <div className={pageStyles.page}>
      {header}
      <div className={styles.toolbar}>
        <SegmentedControl label="Show" options={FILTERS} value={filter} onChange={setFilter} />
        <SelectField className={styles.toolbarField} label="Post" value={postId} onChange={(event) => setPostId(event.target.value)}>
          <option value={ALL_POSTS}>All posts and clips</option>
          {postsWithComments.map((post) => <option key={post.id} value={post.id}>{`${describePost(post)} (${post.comments})`}</option>)}
        </SelectField>
        <TextField className={styles.toolbarField} label="Search comments" type="search" value={search} placeholder="Words in the comment" onChange={(event) => setSearch(event.target.value)} />
      </div>
      <p className={styles.summary} role="status">
        {comments.isFetching && !comments.isFetchingNextPage ? "Updating…" : `${visible.length}${comments.hasNextPage ? "+" : ""} shown`}
      </p>
      {visible.length === 0 ? (
        <EmptyState
          title={filter === "hidden" ? "No hidden comments" : filtered ? "Nothing matches" : "No comments yet"}
          description={filter === "all" && filtered ? "Try another post or search." : EMPTY_COPY[filter]}
          action={filtered ? undefined : <a href={webappLinks.newClip} target="_blank" rel="noopener noreferrer" className={pageStyles.textLink}>Post a clip</a>}
          variant="compact"
        />
      ) : (
        <ul className={styles.list}>
          {visible.map((comment) => <CommentItem key={comment.id} comment={comment} onChanged={refresh} />)}
        </ul>
      )}
      {comments.hasNextPage ? (
        <div>
          <Button variant="secondary" busy={comments.isFetchingNextPage} onClick={() => void comments.fetchNextPage()}>Load more comments</Button>
        </div>
      ) : null}
      {posts.hasNextPage ? (
        <div>
          <Button variant="quiet" size="sm" busy={posts.isFetchingNextPage} onClick={() => void posts.fetchNextPage()}>Show older posts in the post picker</Button>
        </div>
      ) : null}
    </div>
  );
}

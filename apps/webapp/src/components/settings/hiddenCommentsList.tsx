"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

import { AppIcon } from "@/components/ui/appIcon";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { ListRowsSkeleton } from "@/components/ui/pageSkeletons";
import { showToast } from "@/components/ui/toast";
import { commentsService } from "@/services/webActions.service";
import type { MyPostComment } from "@/types";
import { formatTimeSincePosted } from "@/utils/formatDate.util";

import styles from "./myReportsList.module.css";

function HiddenCommentRow({ comment }: { readonly comment: MyPostComment }) {
  const queryClient = useQueryClient();
  const unhide = useMutation({
    mutationFn: () => commentsService.unhideComment(comment.post.id, comment.id),
    onSuccess: () => {
      showToast({ text: "Comment is visible again" });
      void queryClient.invalidateQueries({ queryKey: ["hidden-comments"] });
      void queryClient.invalidateQueries({ queryKey: ["comments", comment.post.id] });
      void queryClient.invalidateQueries({ queryKey: ["post-thread", comment.post.id] });
    },
    onError: () => showToast({ text: "Couldn't unhide the comment. Try again.", tone: "error" }),
  });
  const postLabel = comment.post.text.trim() || (comment.post.kind === "clip" ? "your clip" : "your post");
  return (
    <li className={styles.row}>
      <div className={styles.top}>
        <strong>{comment.author.name || `@${comment.author.username}`}</strong>
        <Button variant="secondary" size="sm" busy={unhide.isPending} onClick={() => !unhide.isPending && unhide.mutate()}>Unhide</Button>
      </div>
      <span>{comment.text}</span>
      <span className={styles.meta}>
        {comment.parentCommentId ? "Reply on " : "On "}
        <Link href={`/post/${comment.post.id}`}>{postLabel.length > 60 ? `${postLabel.slice(0, 57)}…` : postLabel}</Link>
        {comment.hiddenAt ? ` · hidden ${formatTimeSincePosted(comment.hiddenAt)}` : null}
      </span>
    </li>
  );
}

export function HiddenCommentsList() {
  const hidden = useInfiniteQuery({
    queryKey: ["hidden-comments"],
    queryFn: ({ pageParam }) => commentsService.listHiddenComments(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  if (hidden.isLoading) return <ListRowsSkeleton label="Loading hidden comments" rows={4} withAvatar={false} />;
  if (hidden.isError) return <ErrorState description="We couldn't load your hidden comments." error={hidden.error} onRetry={() => void hidden.refetch()} />;
  const comments = hidden.data?.pages.flatMap((page) => page.data) ?? [];
  if (comments.length === 0) {
    return <EmptyState icon={<AppIcon name="eyeSlash24" size={28} />} title="No hidden comments" description="When you hide a comment on your post, only you and the person who wrote it can see it. Hidden comments show up here." />;
  }
  return (
    <>
      <p className={styles.meta}>Only you and each commenter can see these. Replies under a hidden comment are hidden too.</p>
      <ul className={styles.list}>
        {comments.map((comment) => <HiddenCommentRow key={comment.id} comment={comment} />)}
      </ul>
      {hidden.hasNextPage ? <Button variant="secondary" busy={hidden.isFetchingNextPage} onClick={() => void hidden.fetchNextPage()}>Load more</Button> : null}
    </>
  );
}

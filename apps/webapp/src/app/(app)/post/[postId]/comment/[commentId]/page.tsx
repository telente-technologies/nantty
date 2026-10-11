"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";

import { PostCard } from "@/components/feed/postCard";
import { PostCardSkeleton } from "@/components/feed/postCardSkeleton";
import { ThreadComposer } from "@/components/feed/thread/threadComposer";
import { ThreadReplyBranch } from "@/components/feed/thread/threadReply";
import { RetryButton } from "@/components/ui/controls";
import { ErrorState } from "@/components/ui/feedback";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { useInfiniteScrollSentinel } from "@/components/ui/useInfiniteScrollSentinel.hook";
import { postsService } from "@/services/posts.service";
import { postThreadService } from "@/services/postThread.service";
import type { Comment } from "@/types";
import type { ThreadReply } from "@/types/postThread.type";
import { classifyContentLoadFailure, contentLoadFailureCopy } from "@/utils/contentAvailability.util";

import styles from "../../page.module.css";

const asThreadReply = (comment: Comment, postAuthorId: string | undefined, hasParentAbove: boolean): ThreadReply => ({
  ...comment,
  isPostAuthor: comment.author.id === postAuthorId,
  connector: { depth: 0, hasParentAbove, hasChildBelow: false, isLastInChain: true },
  inlineReplies: [],
});

export default function CommentThreadPage({ params }: { readonly params: Promise<{ readonly postId: string; readonly commentId: string }> }) {
  const { postId, commentId } = use(params);
  const router = useRouter();
  const [replyTarget, setReplyTarget] = useState<ThreadReply | null>(null);
  const [postedReplies, setPostedReplies] = useState<readonly ThreadReply[]>([]);
  const post = useQuery({ queryKey: ["post", postId], queryFn: () => postsService.fetchPostById(postId), retry: false });
  const thread = useInfiniteQuery({
    queryKey: ["comment-thread", commentId],
    queryFn: ({ pageParam }) => postThreadService.fetchCommentThread(commentId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    retry: false,
  });
  const sentinelRef = useInfiniteScrollSentinel({ hasNextPage: thread.hasNextPage && !thread.isError, isFetchingNextPage: thread.isFetchingNextPage, fetchNextPage: thread.fetchNextPage });
  const firstPage = thread.data?.pages[0];
  const postAuthorId = post.data?.author.id;
  const focus = firstPage ? asThreadReply(firstPage.focus, postAuthorId, firstPage.ancestors.length > 0) : null;
  const threadFailure = thread.isError && !firstPage ? classifyContentLoadFailure(thread.error) : null;
  const postFailure = post.isError ? classifyContentLoadFailure(post.error) : null;

  return (
    <div className={styles.page}>
      <button type="button" className={styles.back} onClick={() => (window.history.length > 1 ? router.back() : router.push(`/post/${encodeURIComponent(postId)}`))}>
        <ArrowLeftIcon size={18} /> Back
      </button>
      <h1 className="visuallyHidden">Thread</h1>
      {post.isLoading ? <PostCardSkeleton /> : post.data ? <PostCard post={post.data} surface="post_detail" /> : null}
      {postFailure && !threadFailure ? (
        <ErrorState title={contentLoadFailureCopy.post[postFailure].title} description={contentLoadFailureCopy.post[postFailure].description} action={postFailure === "failed" ? <RetryButton onRetry={() => post.refetch()} /> : undefined} />
      ) : null}
      {thread.isLoading ? (
        <PostCardSkeleton />
      ) : threadFailure ? (
        <ErrorState
          title={contentLoadFailureCopy.reply[threadFailure].title}
          description={contentLoadFailureCopy.reply[threadFailure].description}
          action={threadFailure === "failed" ? <RetryButton onRetry={() => thread.refetch()} /> : <Link href="/">Go to your feed</Link>}
        />
      ) : focus && firstPage ? (
        <section aria-label="Replies in this thread">
          {firstPage.ancestors.map((ancestor, index) => (
            <ThreadReplyBranch key={ancestor.id} reply={asThreadReply(ancestor, postAuthorId, index > 0)} postId={postId} postAuthorId={postAuthorId} hasParentAbove={index > 0} showReplyingTo onReply={setReplyTarget} onOpenThread={(reply) => router.push(`/post/${encodeURIComponent(postId)}/comment/${encodeURIComponent(reply.id)}`)} />
          ))}
          <ThreadReplyBranch
            key={focus.id}
            reply={{ ...focus, inlineReplies: [...(thread.data?.pages.flatMap((page) => page.data) ?? []), ...postedReplies] }}
            postId={postId}
            postAuthorId={postAuthorId}
            hasParentAbove={firstPage.ancestors.length > 0}
            showReplyingTo
            onReply={setReplyTarget}
            onOpenThread={(reply) => router.push(`/post/${encodeURIComponent(postId)}/comment/${encodeURIComponent(reply.id)}`)}
          />
          <div ref={sentinelRef} />
          {post.data && post.data.viewerCanReply !== false ? (
            <ThreadComposer
              postId={postId}
              postAuthorUsername={post.data.author.username}
              replyTarget={replyTarget ?? focus}
              onCancelReply={() => setReplyTarget(null)}
              replyRestriction={null}
              onPosted={(created) => {
                if (created.parentCommentId === focus.id) setPostedReplies((current) => [...current, asThreadReply(created, postAuthorId, true)]);
                setReplyTarget(null);
              }}
            />
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

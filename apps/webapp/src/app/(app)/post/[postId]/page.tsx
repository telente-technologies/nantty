"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { use } from "react";

import { ConversationPanel } from "@/components/feed/thread/conversationPanel";
import { PostCard } from "@/components/feed/postCard";
import { PostCardSkeleton } from "@/components/feed/postCardSkeleton";
import { RetryButton } from "@/components/ui/controls";
import { ErrorState } from "@/components/ui/feedback";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { postsService } from "@/services/posts.service";

import styles from "./page.module.css";

export default function PostDetailPage({ params }: { readonly params: Promise<{ readonly postId: string }> }) {
  const { postId } = use(params);
  const router = useRouter();
  const postQuery = useQuery({ queryKey: ["post", postId], queryFn: () => postsService.fetchPostById(postId), retry: false });

  return (
    <div className={styles.page}>
      <button type="button" className={styles.back} onClick={() => router.back()}>
        <ArrowLeftIcon size={18} /> Back
      </button>
      {postQuery.isLoading ? (
        <PostCardSkeleton />
      ) : postQuery.isError || !postQuery.data ? (
        <ErrorState description="This post isn't available." action={<RetryButton onRetry={() => postQuery.refetch()} />} />
      ) : (
        <>
          <h1 className="visuallyHidden">Post by {postQuery.data.author.name}</h1>
          <PostCard post={postQuery.data} priority />
          <ConversationPanel post={postQuery.data} />
        </>
      )}
    </div>
  );
}

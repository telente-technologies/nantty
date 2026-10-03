"use client";

import Link from "next/link";
import { useState } from "react";

import { AnalyticsIcon, ChatIcon, HeartIcon, ShareIcon, TagIcon } from "@/components/ui/icons";
import { requireAuthThen } from "@/components/auth/authPrompt.store";
import { MentionText } from "@/components/mentions/mentionText";
import { ContentActionsMenu } from "@/components/actions/contentActionsMenu";
import { SaveToggleButton } from "@/components/saves/saveToggleButton";
import { useSession } from "@/components/providers/sessionProvider";
import { Avatar, MediaImage } from "@/components/ui/media";
import { formatCountWithThousandsSuffix, formatTimeSincePosted } from "@/utils/formatDate.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postsService } from "@/services/posts.service";
import type { Post } from "@/types";

import styles from "./postCard.module.css";
import { hasVideoMedia, isLandscapeVideoPost, PostMedia } from "./postCardMedia";
import { AppIcon } from "@/components/ui/appIcon";

export function PostCard({ post, priority = false }: { readonly post: Post; readonly priority?: boolean }) {
  const queryClient = useQueryClient();
  const { viewer } = useSession();
  const [optimisticLikes, setOptimisticLikes] = useState(post.likes);
  const [optimisticLiked, setOptimisticLiked] = useState(post.liked);

  const likeMutation = useMutation({
    mutationFn: (liked: boolean) => (liked ? postsService.unlikePost(post.id) : postsService.likePost(post.id)),
    onMutate: async (liked) => {
      setOptimisticLiked(!liked);
      setOptimisticLikes((count) => Math.max(0, count + (liked ? -1 : 1)));
      await queryClient.cancelQueries({ queryKey: ["feed"] });
    },
    onError: (_error, liked) => {
      setOptimisticLiked(liked);
      setOptimisticLikes((count) => Math.max(0, count + (liked ? 1 : -1)));
    },
  });

  return (
    <article className={styles.card}>
      <header className={styles.header}>
        <Link href={`/user/${post.author.id}`} className={styles.author}>
          <Avatar name={post.author.name} src={post.author.avatarUrl} size="md" />
          <span className={styles.authorText}>
            <span className={styles.authorName}>
              {post.author.name}
              {post.author.verified ? <span className={styles.verified} aria-label="Verified account"><AppIcon name="check16" size={10} /></span> : null}
            </span>
            <span className={styles.authorMeta}>@{post.author.username}</span>
          </span>
        </Link>
        <Link href={`/post/${post.id}`} className={styles.timestamp}>
          <time dateTime={post.createdAt}>{formatTimeSincePosted(post.createdAt)}</time>
        </Link>
        <ContentActionsMenu
          shareKind={hasVideoMedia(post) ? "video" : "post"}
          reportTargetType="post"
          targetId={post.id}
          canonicalPath={`/post/${post.id}`}
          isOwnContent={viewer?.id === post.author.id}
        />
      </header>

      {post.text ? (
        <p className={styles.text}>
          <MentionText text={post.text} mentions={post.mentions} />
        </p>
      ) : null}
      <PostMedia media={post.media} priority={priority} watchHref={isLandscapeVideoPost(post) ? `/watch/${post.id}` : null} />

      {post.products.length > 0 ? (
        <div className={styles.productStrip}>
          <span className={styles.productStripLabel}>
            <TagIcon size={14} /> Tagged
          </span>
          {post.products.slice(0, 4).map((product) => (
            <Link key={product.id} href={`/product/${product.id}`} className={styles.productChip}>
              <span className={styles.productChipThumb}>
                <MediaImage src={product.imageUrl} alt="" sizes="48px" />
              </span>
              <span className={styles.productChipName}>{product.name}</span>
              <span className={styles.productChipPrice}>{formatMoneyForDisplay(product.price)}</span>
            </Link>
          ))}
        </div>
      ) : null}

      <footer className={styles.footer}>
        <button
          type="button"
          className={[styles.action, optimisticLiked ? styles.actionActive : ""].filter(Boolean).join(" ")}
          aria-pressed={optimisticLiked}
          onClick={() => requireAuthThen(() => likeMutation.mutate(optimisticLiked), "Sign in to like posts.")}
        >
          <HeartIcon size={19} />
          {formatCountWithThousandsSuffix(optimisticLikes)}
        </button>
        <Link href={`/post/${post.id}#comments`} className={styles.action} aria-label={`${post.comments} comments`}>
          <ChatIcon size={18} />
          {formatCountWithThousandsSuffix(post.comments)}
        </Link>
        <span className={styles.action}>
          <ShareIcon size={18} />
          {formatCountWithThousandsSuffix(post.reposts)}
        </span>
        <SaveToggleButton targetType={hasVideoMedia(post) ? "video" : "post"} targetId={post.id} initiallySaved={post.bookmarked} iconSize={18} />
        {post.sponsored ? <span className={styles.sponsored}>{post.sponsored.label}</span> : null}
        {viewer?.id === post.author.id ? (
          <Link className={styles.actionViews} href={`/analytics/post/${post.id}`} aria-label="Open post analytics">
            <AnalyticsIcon size={16} />
            {formatCountWithThousandsSuffix(post.views)}
            <span className={styles.viewsWord}> impressions</span>
          </Link>
        ) : (
          <span className={styles.actionViews}>
            <AnalyticsIcon size={16} />
            {formatCountWithThousandsSuffix(post.views)}
            <span className={styles.viewsWord}> impressions</span>
          </span>
        )}
      </footer>
    </article>
  );
}

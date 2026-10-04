"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { LikeFilledActionIcon, ReplyActionIcon, TagIcon } from "@/components/ui/icons";
import { requireAuthThen } from "@/components/auth/authPrompt.store";
import { MentionText } from "@/components/mentions/mentionText";
import { ContentActionsMenu } from "@/components/actions/contentActionsMenu";
import { useSession } from "@/components/providers/sessionProvider";
import { CopyrightCountdownBanner } from "@/components/copyright/copyrightCountdownBanner";
import { Avatar, MediaImage } from "@/components/ui/media";
import { formatTimeSincePosted } from "@/utils/formatDate.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postsService } from "@/services/posts.service";
import type { Post } from "@/types";

import styles from "./postCard.module.css";
import swipeStyles from "./postSwipe.module.css";
import { usePostSwipe } from "./postSwipe.hook";
import { PostActions } from "./postActions";
import { SponsoredAdBody, SponsoredMediaLink } from "./sponsoredAd";
import { hasVideoMedia, isLandscapeVideoPost, PostMedia } from "./postCardMedia";
import { AppIcon } from "@/components/ui/appIcon";
import { buildProductPath, buildProfilePath } from "@/utils/seoPaths.util";
import { PostLinkCard } from "./postLinkCard";
import { SensitiveContentGate } from "./sensitiveContentGate";
import { ViewQuotesLink } from "./viewQuotesLink";
import { TaggedPeopleLine } from "@/components/taggedPeople/taggedPeopleLine";

export function PostCard({ post, priority = false, swipeable = false }: { readonly post: Post; readonly priority?: boolean; readonly swipeable?: boolean }) {
  const router = useRouter();
  const [likePopSignal, setLikePopSignal] = useState(0);
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

  const toggleLike = () => requireAuthThen(() => likeMutation.mutate(optimisticLiked), "Sign in to like posts.");
  const swipe = usePostSwipe({
    enabled: swipeable && !post.sponsored,
    isLiked: optimisticLiked,
    onLike: () =>
      requireAuthThen(() => {
        setLikePopSignal((signal) => signal + 1);
        likeMutation.mutate(false);
      }, "Sign in to like posts."),
    onOpenComments: () => router.push(`/post/${post.id}#comments`),
  });

  const card = (
    <article className={[styles.card, swipe.isActive ? swipeStyles.card : ""].filter(Boolean).join(" ")}>
      <header className={styles.header}>
        <Link href={buildProfilePath(post.author.username)} className={styles.author}>
          <Avatar name={post.author.name} src={post.author.avatarUrl} size="md" />
          <span className={styles.authorText}>
            <span className={styles.authorName}>
              {post.author.name}
              {post.author.verified ? <span className={styles.verified} aria-label="Verified account"><AppIcon name="check16" size={10} /></span> : null}
            </span>
            <span className={styles.authorMeta}>@{post.author.username}</span>
          </span>
        </Link>
        {post.sponsored ? <span className={styles.sponsored}>{post.sponsored.label}</span> : null}
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

      {viewer?.id === post.author.id ? <CopyrightCountdownBanner contentId={post.id} /> : null}
      <SensitiveContentGate postId={post.id} sensitive={post.sensitive} previewUrl={post.media[0]?.posterUrl ?? post.media[0]?.url ?? null}>
      {post.text ? (
        <p className={styles.text}>
          <MentionText text={post.text} mentions={post.mentions} />
        </p>
      ) : null}
      <PostLinkCard post={post} />
      {post.sponsored?.adType === "carousel" ? null : (
        <SponsoredMediaLink post={post}>
          <PostMedia media={post.media} priority={priority} watchHref={isLandscapeVideoPost(post) && !post.sponsored ? `/watch/${post.id}` : null} />
        </SponsoredMediaLink>
      )}
      <SponsoredAdBody post={post} />
      </SensitiveContentGate>
      <TaggedPeopleLine post={post} />

      {post.products.length > 0 ? (
        <div className={styles.productStrip}>
          <span className={styles.productStripLabel}>
            <TagIcon size={14} /> Tagged
          </span>
          {post.products.slice(0, 4).map((product) => (
            <Link key={product.id} href={buildProductPath(product)} className={styles.productChip}>
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
        <PostActions
          post={post}
          saveTargetType={hasVideoMedia(post) ? "video" : "post"}
          isOwnPost={viewer?.id === post.author.id}
          isLiked={optimisticLiked}
          likeCount={optimisticLikes}
          onToggleLike={toggleLike}
          likePopSignal={likePopSignal}
        />
        <ViewQuotesLink post={post} />
      </footer>
    </article>
  );

  if (!swipe.isActive) return card;
  return (
    <div ref={swipe.frameRef} className={swipeStyles.frame} {...swipe.frameHandlers}>
      <div className={swipeStyles.hints} aria-hidden="true">
        <span className={[swipeStyles.hint, swipeStyles.likeHint].join(" ")}>
          <LikeFilledActionIcon size={26} />
          {optimisticLiked ? "Liked" : "Like"}
        </span>
        <span className={[swipeStyles.hint, swipeStyles.replyHint].join(" ")}>
          <ReplyActionIcon size={26} />
          Reply
        </span>
      </div>
      {card}
    </div>
  );
}

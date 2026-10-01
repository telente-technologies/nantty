"use client";

import Link from "next/link";
import { useState } from "react";

import { HeartIcon, MoreIcon, ShareIcon, TagIcon } from "@/components/ui/icons";
import { Avatar, MediaImage } from "@/components/ui/media";
import { formatCountWithThousandsSuffix, formatTimeSincePosted } from "@/utils/formatDate.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postsService } from "@/services/posts.service";
import type { Media, Post } from "@/types";

import styles from "./postCard.module.css";

function PostMedia({ media, priority }: { readonly media: readonly Media[]; readonly priority: boolean }) {
  const [imageIndex, setImageIndex] = useState(0);
  const visible = media.filter((entry) => entry.type === "image" || entry.posterUrl || entry.url);
  if (visible.length === 0) return null;
  const active = visible[Math.min(imageIndex, visible.length - 1)];

  if (visible.length > 1) {
    return (
      <div className={styles.mediaFrame}>
        <div className={styles.mediaScroller} onScroll={(event) => setImageIndex(Math.round(event.currentTarget.scrollLeft / event.currentTarget.clientWidth))}>
          {visible.map((entry, index) => (
            <div className={styles.mediaSlide} key={`${entry.id ?? index}`}>
              <MediaImage src={entry.type === "image" ? entry.url : (entry.posterUrl ?? entry.url)} alt="" sizes="(max-width: 768px) 100vw, 640px" priority={priority && index === 0} />
            </div>
          ))}
        </div>
        <div className={styles.mediaDots} aria-hidden="true">
          {visible.map((entry, index) => (
            <span key={entry.id ?? index} className={index === Math.min(imageIndex, visible.length - 1) ? styles.mediaDotActive : styles.mediaDot} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.mediaFrame}>
      {active?.type === "video" && active.url && !active.url.endsWith(".m3u8") ? (
        <video className={styles.video} src={active.url} poster={active.posterUrl ?? undefined} controls preload="metadata" playsInline />
      ) : (
        <MediaImage src={active?.type === "image" ? active.url : (active?.posterUrl ?? active?.url)} alt="" sizes="(max-width: 768px) 100vw, 640px" priority={priority} />
      )}
    </div>
  );
}

export function PostCard({ post, priority = false }: { readonly post: Post; readonly priority?: boolean }) {
  const queryClient = useQueryClient();
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
              {post.author.verified ? <span className={styles.verified} aria-label="Verified account">✓</span> : null}
            </span>
            <span className={styles.authorMeta}>
              @{post.author.username} · {formatTimeSincePosted(post.createdAt)}
            </span>
          </span>
        </Link>
        <button type="button" className={styles.moreButton} aria-label="More options">
          <MoreIcon size={20} />
        </button>
      </header>

      {post.text ? <p className={styles.text}>{post.text}</p> : null}
      <PostMedia media={post.media} priority={priority} />

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
          onClick={() => likeMutation.mutate(optimisticLiked)}
        >
          <HeartIcon size={19} />
          {formatCountWithThousandsSuffix(optimisticLikes)}
        </button>
        <span className={styles.action}>
          <span className={styles.actionBubble} aria-hidden="true" />
          {formatCountWithThousandsSuffix(post.comments)}
        </span>
        <span className={styles.action}>
          <ShareIcon size={18} />
          {formatCountWithThousandsSuffix(post.reposts)}
        </span>
        <span className={styles.actionViews}>
          {formatCountWithThousandsSuffix(post.views)} views
        </span>
        {post.sponsored ? <span className={styles.sponsored}>{post.sponsored.label}</span> : null}
      </footer>
    </article>
  );
}

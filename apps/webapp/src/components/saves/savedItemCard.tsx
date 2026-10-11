"use client";

import Link from "next/link";

import { formatVideoDuration } from "@/components/feed/postCardMedia";
import { ChatIcon, ClipsIcon, ImageIcon, PlayIcon, StoreIcon } from "@/components/ui/icons";
import { MediaImage } from "@/components/ui/media";
import { formatTimeSincePosted } from "@/utils/formatDate.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import type { SaveCollection, SavedItem, SaveTargetType } from "@/types";

import { SaveToggleButton } from "./saveToggleButton";
import styles from "./savedItemCard.module.css";

const targetTypeLabels: Record<SaveTargetType, string> = { post: "Post", video: "Video", clip: "Clip", product: "Product", comment: "Reply" };

export function resolveSavedItemHref(item: SavedItem): string {
  const targetId = encodeURIComponent(item.targetId);
  if (item.type === "product") return item.preview.href.startsWith("/p/") ? item.preview.href : `/product/${targetId}`;
  if (item.type === "clip") return `/clips?start=${targetId}`;
  if (item.type === "video") return `/watch/${targetId}`;
  if (item.type === "comment") {
    const postId = item.postId ?? item.comment?.postId ?? item.preview.href.match(/^\/post\/([^/#?]+)/)?.[1];
    return postId ? `/post/${encodeURIComponent(postId)}/comment/${targetId}` : "/saved";
  }
  return `/post/${targetId}`;
}

function TargetTypeIcon({ targetType }: { readonly targetType: SaveTargetType }) {
  if (targetType === "video") return <PlayIcon size={14} />;
  if (targetType === "clip") return <ClipsIcon size={14} />;
  if (targetType === "product") return <StoreIcon size={14} />;
  if (targetType === "comment") return <ChatIcon size={14} />;
  return <ImageIcon size={14} />;
}

interface SavedItemCardProps {
  readonly item: SavedItem;
  readonly collections: readonly SaveCollection[];
  readonly onMoveToCollection: (collectionId: string | null) => void;
}

export function SavedItemCard({ item, collections, onMoveToCollection }: SavedItemCardProps) {
  return (
    <article className={styles.card}>
      <Link href={resolveSavedItemHref(item)} className={styles.thumbnail}>
        {item.preview.thumbnailUrl ? (
          <MediaImage src={item.preview.thumbnailUrl} alt="" sizes="(max-width: 768px) 50vw, 260px" />
        ) : (
          <span className={styles.textOnlyPreview}>{item.preview.title}</span>
        )}
        <span className={styles.typeBadge}>
          <TargetTypeIcon targetType={item.type} />
          {targetTypeLabels[item.type]}
        </span>
        {item.preview.durationSeconds ? <span className={styles.duration}>{formatVideoDuration(item.preview.durationSeconds)}</span> : null}
        <span className="visuallyHidden">Open {targetTypeLabels[item.type].toLowerCase()}</span>
      </Link>
      <div className={styles.body}>
        <p className={styles.title}>{item.preview.title}</p>
        <p className={styles.meta}>
          {item.preview.price ? <strong className={styles.price}>{formatMoneyForDisplay(item.preview.price)}</strong> : item.preview.author ? `@${item.preview.author}` : null}
          <span aria-hidden="true"> · </span>
          <span>Saved {formatTimeSincePosted(item.savedAt)}</span>
        </p>
        <div className={styles.actions}>
          {collections.length > 0 ? (
            <label className={styles.collectionPicker}>
              <span className="visuallyHidden">Collection</span>
              <select value={item.collectionId ?? ""} onChange={(event) => onMoveToCollection(event.target.value || null)}>
                <option value="">No collection</option>
                {collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <SaveToggleButton targetType={item.type} targetId={item.targetId} initiallySaved iconSize={18} />
        </div>
      </div>
    </article>
  );
}

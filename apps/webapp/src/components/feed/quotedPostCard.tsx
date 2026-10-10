"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { AppIcon } from "@/components/ui/appIcon";
import { Avatar, MediaImage } from "@/components/ui/media";
import type { QuotedPostSummary } from "@/types";
import { formatTimeSincePosted } from "@/utils/formatDate.util";

import styles from "./quotedPostCard.module.css";

export const QUOTED_POST_UNAVAILABLE_TEXT = "This post is unavailable.";

interface QuotedPostCardProps {
  readonly quoted: QuotedPostSummary | null;
  readonly unavailable?: boolean;
  readonly loading?: boolean;
  readonly onRemove?: () => void;
}

function RemoveButton({ onRemove }: { readonly onRemove: () => void }) {
  return (
    <button type="button" className={styles.remove} aria-label="Remove quoted post" onClick={onRemove}>
      <AppIcon name="cancel20" size={16} />
    </button>
  );
}

export function QuotedPostCard({ quoted, unavailable, loading, onRemove }: QuotedPostCardProps) {
  if (loading || unavailable || !quoted) {
    return (
      <div className={[styles.card, styles.placeholder].join(" ")} role="note" aria-busy={loading ? "true" : undefined}>
        <span>{loading ? "Loading post…" : QUOTED_POST_UNAVAILABLE_TEXT}</span>
        {onRemove ? <RemoveButton onRemove={onRemove} /> : null}
      </div>
    );
  }
  const thumbnail = quoted.thumbnail;
  const body: ReactNode = (
    <>
      <span className={styles.header}>
        <Avatar name={quoted.author.name} src={quoted.author.avatarUrl} size="xs" />
        <strong className={styles.name}>{quoted.author.name}</strong>
        {quoted.author.verified ? (
          <span className={styles.verified} aria-label="Verified account">
            <AppIcon name="check16" size={9} />
          </span>
        ) : null}
        <span className={styles.handle}>
          @{quoted.author.username} · <time dateTime={quoted.createdAt}>{formatTimeSincePosted(quoted.createdAt)}</time>
        </span>
      </span>
      <span className={quoted.text ? styles.bodyRow : styles.mediaOnly}>
        {quoted.text ? <span className={styles.text}>{quoted.text}</span> : null}
        {thumbnail ? (
          <span className={quoted.text ? styles.thumb : styles.wideThumb}>
            <MediaImage src={thumbnail.url} alt="" sizes={quoted.text ? "80px" : "(max-width: 768px) 90vw, 520px"} />
            {thumbnail.type === "video" ? (
              <span className={styles.play} aria-hidden="true">
                <AppIcon name="play24" size={14} />
              </span>
            ) : null}
          </span>
        ) : null}
      </span>
    </>
  );
  if (onRemove) {
    return (
      <div className={styles.card} aria-label={`Quoting a post by ${quoted.author.name}`}>
        <RemoveButton onRemove={onRemove} />
        {body}
      </div>
    );
  }
  return (
    <Link href={`/post/${quoted.id}`} className={[styles.card, styles.link].join(" ")} aria-label={`Quoted post by ${quoted.author.name}: ${quoted.text}`}>
      {body}
    </Link>
  );
}

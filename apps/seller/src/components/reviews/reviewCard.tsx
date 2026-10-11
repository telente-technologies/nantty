"use client";

import Link from "next/link";
import { useState } from "react";

import { requestConfirmation } from "@zudomart/web-kit";

import { ReviewReportDialog } from "@/components/reviews/reviewReportDialog";
import { Button } from "@/components/ui/button";
import { TextAreaField } from "@/components/ui/formFields";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useToast } from "@/components/ui/toastProvider";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { Review } from "@/types/review.type";
import { formatDateForDisplay, formatRelativeTimeFromNow } from "@/utils/dateFormatting.util";

import styles from "./reviews.module.css";
import { ZudoIcon } from "@/components/ui/zudoIcon";

export function StarRating({ rating }: { readonly rating: number }) {
  const rounded = Math.round(rating);
  return (
    <span style={{ display: "inline-flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((position) => (
        <span key={position} style={{ opacity: position <= rounded ? 1 : 0.25 }}>
          <ZudoIcon name="star16" size={14} />
        </span>
      ))}
    </span>
  );
}

export function ReviewCard({ review, onReviewChanged }: { readonly review: Review; readonly onReviewChanged: (review: Review) => void }) {
  const { showToast } = useToast();
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState(review.reply?.body ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [isReporting, setIsReporting] = useState(false);

  async function saveReply() {
    if (replyText.trim().length < 2) return showToast("Write a reply first.", "error");
    setIsSaving(true);
    try {
      const updated = await sendSellerApiRequest<Review>(`/seller/reviews/${encodeURIComponent(review.id)}/reply`, { method: "PUT", body: { body: replyText.trim() } });
      onReviewChanged(updated);
      setIsReplying(false);
      showToast("Reply posted. The buyer gets a notification in the app.");
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteReply() {
    if (!(await requestConfirmation({ title: "Remove your public reply?", description: "Buyers will no longer see it.", confirmLabel: "Remove reply", tone: "danger", intent: "delete" }))) return;
    try {
      const updated = await sendSellerApiRequest<Review>(`/seller/reviews/${encodeURIComponent(review.id)}/reply`, { method: "DELETE" });
      onReviewChanged(updated);
      setReplyText("");
      showToast("Reply removed.");
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    }
  }

  return (
    <article className={styles.card}>
      <header className={styles.cardHeader}>
        <span className={styles.author}>
          <strong>{review.author.name}</strong>
          <span className={styles.muted}>@{review.author.username} · {formatRelativeTimeFromNow(review.createdAt)}{review.orderNumber ? ` · ${review.orderNumber}` : ""}</span>
        </span>
        <span className={styles.badges}>
          <span className={styles.stars} aria-label={`${review.rating} out of 5 stars`}><StarRating rating={review.rating} /></span>
          <StatusBadge tone={review.kind === "store" ? "highlight" : "neutral"}>{review.kind === "store" ? "Store review" : "Product review"}</StatusBadge>
          {review.isVerifiedPurchase ? <StatusBadge tone="success">Verified purchase</StatusBadge> : null}
          {review.status === "reported" ? <StatusBadge tone="caution">Reported</StatusBadge> : null}
        </span>
      </header>
      {review.product ? (
        <Link href={`/products/${review.product.id}`} className={styles.productLine}>
          {review.product.imageUrl ? <img src={review.product.imageUrl} alt="" width={28} height={28} className={styles.thumbnail} /> : null}
          {review.product.name}
        </Link>
      ) : null}
      {review.title ? <p className={styles.title}>{review.title}</p> : null}
      <p>{review.body}</p>
      {review.photoCount > 0 || review.helpfulCount > 0 ? <p className={styles.muted}>{review.photoCount > 0 ? `${review.photoCount} photo${review.photoCount === 1 ? "" : "s"} · ` : ""}{review.helpfulCount} found this helpful</p> : null}
      {review.reply && !isReplying ? (
        <div className={styles.reply}>
          <p className={styles.replyMeta}>Your reply · {formatDateForDisplay(review.reply.updatedAt ?? review.reply.createdAt)}{review.reply.updatedAt ? " (edited)" : ""}</p>
          <p>{review.reply.body}</p>
        </div>
      ) : null}
      {isReplying ? (
        <div className={styles.stack}>
          <TextAreaField label="Public reply" hint="Everyone who sees the review sees your reply. Be kind and specific." rows={3} maxLength={1000} value={replyText} onChange={(event) => setReplyText(event.target.value)} />
          <div className={styles.actions}>
            <Button size="small" variant="primary" isBusy={isSaving} onClick={() => void saveReply()}>Post reply</Button>
            <Button size="small" variant="ghost" onClick={() => setIsReplying(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className={styles.actions}>
          <Button size="small" iconName="chatCircle24" onClick={() => setIsReplying(true)}>{review.reply ? "Edit reply" : "Reply"}</Button>
          {review.reply ? <Button size="small" variant="ghost" onClick={() => void deleteReply()}>Remove reply</Button> : null}
          {review.status !== "reported" ? <Button size="small" variant="ghost" iconName="warning20" onClick={() => setIsReporting(true)}>Report</Button> : null}
        </div>
      )}
      {isReporting ? (
        <ReviewReportDialog
          review={review}
          onClose={() => setIsReporting(false)}
          onReported={(updated) => {
            setIsReporting(false);
            onReviewChanged(updated);
          }}
        />
      ) : null}
    </article>
  );
}

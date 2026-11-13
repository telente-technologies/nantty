import { Avatar } from "@/components/ui/media";
import type { ProductReview } from "@/types/commerce.type";
import { formatTimeSincePosted } from "@/utils/formatDate.util";

import { StarRatingDisplay } from "./starRating";
import styles from "./reviews.module.css";

export function ReviewCard({
  review,
  isOwn = false,
  isDeleting = false,
  onDelete,
}: {
  readonly review: ProductReview;
  readonly isOwn?: boolean;
  readonly isDeleting?: boolean;
  readonly onDelete?: () => void;
}) {
  return (
    <article className={styles.review}>
      <header className={styles.reviewHeader}>
        <Avatar name={review.author.name} src={review.author.avatarUrl} size="sm" />
        <span className={styles.reviewAuthor}>
          <strong>{review.author.name}</strong>
          <span>{formatTimeSincePosted(review.createdAt)}{review.isVerifiedPurchase ? " · Verified purchase" : ""}</span>
        </span>
      </header>
      <StarRatingDisplay rating={review.rating} />
      {review.title ? <h3 className={styles.reviewTitle}>{review.title}</h3> : null}
      <p className={styles.reviewText}>{review.text}</p>
      {review.reply ? (
        <div className={styles.reply}>
          <strong>Reply from {review.reply.authorName}</strong>
          <p>{review.reply.body}</p>
        </div>
      ) : null}
      {isOwn && onDelete ? (
        <button type="button" className={styles.deleteReview} disabled={isDeleting} onClick={onDelete}>
          {isDeleting ? "Deleting review…" : "Delete my review"}
        </button>
      ) : null}
    </article>
  );
}

import { Avatar } from "@/components/ui/media";
import type { ProductReview } from "@/types/commerce.type";
import { formatTimeSincePosted } from "@/utils/formatDate.util";

import { StarRatingDisplay } from "./starRating";
import styles from "./reviews.module.css";

export function ReviewCard({ review }: { readonly review: ProductReview }) {
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
    </article>
  );
}

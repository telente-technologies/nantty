"use client";

import { AppIcon } from "@/components/ui/appIcon";
import { StarIcon } from "@/components/ui/icons";
import { filledStarCount, starsLabel } from "@/utils/productReviews.util";

import styles from "./reviews.module.css";

export function StarRatingDisplay({ rating, size = 14 }: { readonly rating: number; readonly size?: number }) {
  const filled = filledStarCount(rating);
  return (
    <span className={styles.stars} role="img" aria-label={starsLabel(rating)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={star <= filled ? styles.starFilled : styles.starEmpty}>
          {star <= filled ? <AppIcon name="star16" size={size} /> : <StarIcon size={size} />}
        </span>
      ))}
    </span>
  );
}

export function StarRatingInput({ value, onChange, disabled }: { readonly value: number; readonly onChange: (rating: number) => void; readonly disabled?: boolean }) {
  return (
    <div className={styles.starInput} role="radiogroup" aria-label="How would you rate it?">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} ${star === 1 ? "star" : "stars"}`}
          className={star <= value ? styles.starFilled : styles.starEmpty}
          disabled={disabled}
          onClick={() => onChange(star)}
        >
          {star <= value ? <AppIcon name="star16" size={32} /> : <StarIcon size={32} />}
        </button>
      ))}
    </div>
  );
}

"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useRef, useState, type FormEvent } from "react";

import { StarRatingInput } from "@/components/reviews/starRating";
import styles from "@/components/reviews/reviews.module.css";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";
import { TextAreaField, TextField } from "@/components/ui/field";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { MediaImage } from "@/components/ui/media";
import { showToast } from "@/components/ui/toast";
import { createIdempotencyKey } from "@/services/clientApi.service";
import { productsService } from "@/services/products.service";
import { reviewsService } from "@/services/reviews.service";
import {
  classifyReviewSubmitError, hasDraftErrors, REVIEW_TEXT_MAX_BYTES, REVIEW_TITLE_MAX_BYTES, toSubmitReviewInput, utf8ByteLength, validateReviewDraft, type ReviewDraftErrors, type ReviewSubmitOutcome,
} from "@/utils/productReviews.util";

export default function WriteReviewPage({ params }: { readonly params: Promise<{ readonly productId: string }> }) {
  const { productId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const product = useQuery({ queryKey: ["product", productId], queryFn: () => productsService.fetchProductDetailById(productId), retry: false });
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<ReviewDraftErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [failure, setFailure] = useState<{ readonly outcome: ReviewSubmitOutcome; readonly message: string } | null>(null);
  const inFlight = useRef(false);
  const idempotencyKey = useRef(createIdempotencyKey("review"));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (inFlight.current) return;
    const draft = { rating, text, title };
    const found = validateReviewDraft(draft);
    setErrors(found);
    if (hasDraftErrors(found)) return;
    inFlight.current = true;
    setIsSubmitting(true);
    setFailure(null);
    try {
      await reviewsService.submitProductReview(productId, toSubmitReviewInput(draft), idempotencyKey.current);
      void queryClient.invalidateQueries({ queryKey: ["product", productId] });
      showToast({ text: "Thanks for your review" });
      router.replace(`/product/${encodeURIComponent(productId)}/reviews`);
    } catch (error) {
      const classified = classifyReviewSubmitError(error);
      if (classified.outcome !== "failed") idempotencyKey.current = createIdempotencyKey("review");
      setFailure(classified);
    } finally {
      inFlight.current = false;
      setIsSubmitting(false);
    }
  };

  if (failure && (failure.outcome === "already_reviewed" || failure.outcome === "not_eligible")) {
    return (
      <div className={styles.page}>
        <ErrorState
          title={failure.outcome === "already_reviewed" ? "You've already reviewed this" : "Not ready for a review yet"}
          description={failure.message}
          action={<Link href={`/product/${encodeURIComponent(productId)}/reviews`}>See reviews</Link>}
        />
      </div>
    );
  }

  return (
    <form className={styles.page} onSubmit={(event) => void submit(event)} noValidate>
      <header className={styles.header}>
        <button type="button" className={styles.back} aria-label="Back" onClick={() => router.back()}><ArrowLeftIcon size={18} /></button>
        <h1 className={styles.title}>Rate your purchase</h1>
      </header>
      {product.data ? (
        <div className={styles.product}>
          <span className={styles.productThumb}>{product.data.imageUrl ? <MediaImage src={product.data.imageUrl} alt="" sizes="48px" /> : null}</span>
          <strong>{product.data.name}</strong>
        </div>
      ) : null}
      <div className={styles.field}>
        <span className={styles.fieldLabel}>How would you rate it?</span>
        <StarRatingInput value={rating} onChange={setRating} disabled={isSubmitting} />
        {errors.rating ? <p className={styles.error} role="alert">{errors.rating}</p> : null}
      </div>
      <TextField label="Title (optional)" placeholder="Sum it up in a few words" value={title} onChange={(event) => setTitle(event.target.value)} error={errors.title} hint={`${utf8ByteLength(title.trim())}/${REVIEW_TITLE_MAX_BYTES}`} />
      <TextAreaField label="Your review" placeholder="What did you like or dislike? How was the quality and fit?" rows={6} value={text} onChange={(event) => setText(event.target.value)} error={errors.text} hint={`${utf8ByteLength(text.trim())}/${REVIEW_TEXT_MAX_BYTES}`} />
      {failure ? <p className={styles.error} role="alert">{failure.message}</p> : null}
      <Button type="submit" busy={isSubmitting}>Post review</Button>
    </form>
  );
}

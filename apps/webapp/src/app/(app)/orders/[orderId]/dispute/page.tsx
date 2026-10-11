"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import styles from "@/components/escrow/escrow.module.css";
import { EvidencePhotoPicker } from "@/components/escrow/evidencePhotoPicker";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";
import { TextAreaField } from "@/components/ui/field";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { DetailSkeleton } from "@/components/ui/pageSkeletons";
import { useIsOnline } from "@/components/ui/onlineStatus.hook";
import { createIdempotencyKey, readErrorMessageForDisplay, WebappRequestError } from "@/services/clientApi.service";
import { disputesService, escrowQueryKeys, escrowsService } from "@/services/disputes.service";
import type { DisputeReason } from "@/types/commerce.type";
import {
  DISPUTE_REASON_OPTIONS, disputeReasonNeedsPhotos, escrowActionsForViewer, isDisputeDraftReady, MAXIMUM_DISPUTE_DESCRIPTION_LENGTH, MINIMUM_DISPUTE_DESCRIPTION_LENGTH,
} from "@/utils/escrowStage.util";

export default function OpenDisputePage({ params }: { readonly params: Promise<{ readonly orderId: string }> }) {
  const { orderId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const isOnline = useIsOnline();
  const escrowQuery = useQuery({ queryKey: escrowQueryKeys.forOrder(orderId), queryFn: () => escrowsService.fetchEscrowForOrder(orderId), retry: false });
  const [reason, setReason] = useState<DisputeReason | null>(null);
  const [description, setDescription] = useState("");
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const idempotencyKey = useRef(createIdempotencyKey("dispute"));
  const hasDraft = reason !== null || description.trim() !== "" || evidenceUrls.length > 0;

  useEffect(() => {
    if (!hasDraft) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [hasDraft]);

  const onChangePhotoUrls = useCallback((urls: string[]) => setEvidenceUrls(urls), []);
  const onUploadingChange = useCallback((uploading: boolean) => setUploadingEvidence(uploading), []);

  const photosRequired = disputeReasonNeedsPhotos(reason);
  const trimmedLength = description.trim().length;
  const descriptionLongEnough = trimmedLength >= MINIMUM_DISPUTE_DESCRIPTION_LENGTH;
  const readyToSubmit = isDisputeDraftReady({ reason, description, evidenceCount: evidenceUrls.length, uploading: uploadingEvidence }) && isOnline;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (inFlight.current || !readyToSubmit || reason === null) return;
    inFlight.current = true;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const dispute = await disputesService.openDisputeForOrder(orderId, { reason, description: description.trim(), evidenceUrls }, idempotencyKey.current);
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({ queryKey: escrowQueryKeys.forOrder(orderId) });
      queryClient.setQueryData(escrowQueryKeys.dispute(dispute.id), dispute);
      router.replace(`/disputes/${encodeURIComponent(dispute.id)}`);
    } catch (error) {
      if (error instanceof WebappRequestError && error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429) idempotencyKey.current = createIdempotencyKey("dispute");
      setSubmitError(error instanceof WebappRequestError ? readErrorMessageForDisplay(error) : "Couldn't open the dispute. Try again.");
      inFlight.current = false;
      setIsSubmitting(false);
    }
  };

  const header = (
    <header className={styles.header}>
      <button type="button" className={styles.back} aria-label="Back" onClick={() => (window.history.length > 1 ? router.back() : router.push(`/orders/${encodeURIComponent(orderId)}`))}><ArrowLeftIcon size={18} /></button>
      <h1 className={styles.title}>Open a dispute</h1>
    </header>
  );

  if (escrowQuery.isLoading) return <div className={styles.page}>{header}<DetailSkeleton label="Loading order" blocks={2} /></div>;
  if (escrowQuery.data?.disputeId) {
    return (
      <div className={styles.page}>
        {header}
        <ErrorState kind="alreadyDone" title="A dispute is already open for this order" description="You can follow it and message support from the dispute page." action={<Link href={`/disputes/${encodeURIComponent(escrowQuery.data.disputeId)}`}>View dispute</Link>} />
      </div>
    );
  }
  if (!escrowQuery.data || !escrowActionsForViewer(escrowQuery.data, "buyer").canOpenDispute) {
    return (
      <div className={styles.page}>
        {header}
        <ErrorState
          title="You can't open a dispute for this order"
          description="Disputes are for escrow orders in Nigeria, before the payment is released. For direct payments, contact the seller or support."
          action={<Link href={`/help/tickets/new?category=order&linkKind=order&linkId=${encodeURIComponent(orderId)}`}>Contact support</Link>}
        />
      </div>
    );
  }

  return (
    <form className={styles.page} onSubmit={(event) => void submit(event)} noValidate>
      {header}
      <div className={styles.notice}>
        <p className={styles.noticeTitle}>Your payment is paused while we look into this</p>
        <p className={styles.muted}>The seller can&apos;t receive the money until the dispute is resolved. They have 48 hours to respond, then Zudomart support steps in.</p>
      </div>
      <fieldset className={styles.reasons}>
        <legend className={styles.cardTitle}>What went wrong?</legend>
        {DISPUTE_REASON_OPTIONS.map((option) => (
          <label key={option.id} className={styles.reason}>
            <input type="radio" name="reason" value={option.id} checked={reason === option.id} onChange={() => setReason(option.id)} disabled={isSubmitting} />
            <span className={styles.reasonText}>
              {option.label}
              <span className={styles.faint}>{option.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <TextAreaField
        label="Describe the problem"
        rows={5}
        maxLength={MAXIMUM_DISPUTE_DESCRIPTION_LENGTH}
        placeholder="E.g. The heel of the left shoe is peeling and there's a glue stain on the toe."
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        disabled={isSubmitting}
        hint={descriptionLongEnough ? `${trimmedLength}/${MAXIMUM_DISPUTE_DESCRIPTION_LENGTH}` : `At least ${MINIMUM_DISPUTE_DESCRIPTION_LENGTH} characters`}
      />
      <section className={styles.actions} aria-labelledby="evidence-title">
        <h2 id="evidence-title" className={styles.cardTitle}>Photo evidence{photosRequired ? "" : " (optional)"}</h2>
        <p className={styles.muted}>Clear photos of the item, packaging and label help us resolve this faster. Only you, the seller and Zudomart support can see them.</p>
        <EvidencePhotoPicker onChangePhotoUrls={onChangePhotoUrls} onUploadingChange={onUploadingChange} disabled={isSubmitting} />
      </section>
      {!isOnline ? <p className={styles.error} role="status">You&apos;re offline. Reconnect to submit your dispute.</p> : null}
      {submitError ? <p className={styles.error} role="alert">{submitError}</p> : null}
      <Button type="submit" size="lg" disabled={!readyToSubmit} busy={isSubmitting}>Submit dispute</Button>
    </form>
  );
}

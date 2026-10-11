"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useRef, useState, type FormEvent } from "react";

import { DisputeStatusHistory } from "@/components/escrow/escrowCards";
import styles from "@/components/escrow/escrow.module.css";
import { Button } from "@/components/ui/button";
import { Badge, ErrorState } from "@/components/ui/feedback";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { DetailSkeleton } from "@/components/ui/pageSkeletons";
import { useIsOnline } from "@/components/ui/onlineStatus.hook";
import { createIdempotencyKey, readErrorMessageForDisplay, WebappRequestError } from "@/services/clientApi.service";
import { disputesService, escrowQueryKeys } from "@/services/disputes.service";
import { DISPUTE_STATUS_APPEARANCE, disputeReasonLabel, formatFriendlyDateTime, isDisputeFinished } from "@/utils/escrowStage.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

const MAXIMUM_MESSAGE_LENGTH = 1000;

export default function DisputeDetailPage({ params }: { readonly params: Promise<{ readonly disputeId: string }> }) {
  const { disputeId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const isOnline = useIsOnline();
  const disputeQuery = useQuery({ queryKey: escrowQueryKeys.dispute(disputeId), queryFn: () => disputesService.fetchDisputeById(disputeId), retry: false });
  const [draft, setDraft] = useState("");
  const messageKey = useRef(createIdempotencyKey("dispute-message"));
  const listEndRef = useRef<HTMLDivElement>(null);
  const messageCount = disputeQuery.data?.messages.length ?? 0;

  useEffect(() => {
    if (messageCount > 0) listEndRef.current?.scrollIntoView({ block: "end" });
  }, [messageCount]);

  const sendMessage = useMutation({
    mutationFn: (text: string) => disputesService.sendDisputeMessage(disputeId, text, [], messageKey.current),
    onSuccess: () => {
      setDraft("");
      messageKey.current = createIdempotencyKey("dispute-message");
      void queryClient.invalidateQueries({ queryKey: escrowQueryKeys.dispute(disputeId) });
    },
  });

  const header = (title: string) => (
    <header className={styles.header}>
      <button type="button" className={styles.back} aria-label="Back" onClick={() => (window.history.length > 1 ? router.back() : router.push("/orders"))}><ArrowLeftIcon size={18} /></button>
      <h1 className={styles.title}>{title}</h1>
    </header>
  );

  if (disputeQuery.isLoading) return <div className={styles.page}>{header("Dispute")}<DetailSkeleton label="Loading dispute" blocks={3} /></div>;
  if (!disputeQuery.data) {
    const gone = disputeQuery.error instanceof WebappRequestError && (disputeQuery.error.status === 404 || disputeQuery.error.status === 403);
    return (
      <div className={styles.page}>
        {header("Dispute")}
        {gone ? (
          <ErrorState kind="orderNotFound" title="This dispute isn't available" description="It may belong to another account, or the link is wrong." action={<Link href="/orders">Your orders</Link>} />
        ) : (
          <ErrorState title="Couldn't load this dispute." error={disputeQuery.error} onRetry={() => void disputeQuery.refetch()} />
        )}
      </div>
    );
  }

  const dispute = disputeQuery.data;
  const appearance = DISPUTE_STATUS_APPEARANCE[dispute.status];
  const finished = isDisputeFinished(dispute.status);
  const sellerMustRespond = dispute.viewerRole === "seller" && dispute.status === "awaiting_seller";
  const trimmedDraft = draft.trim();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (sendMessage.isPending || trimmedDraft === "" || !isOnline) return;
    sendMessage.mutate(trimmedDraft);
  };

  return (
    <div className={styles.page}>
      {header(`Dispute · ${dispute.orderReference}`)}
      <section className={styles.card}>
        <div className={styles.row}>
          <strong className={styles.cardTitle}>{dispute.productName}</strong>
          <Badge tone={appearance.tone}>{appearance.label}</Badge>
        </div>
        <span className={styles.muted}>{disputeReasonLabel(dispute.reason)} · {formatMoneyForDisplay(dispute.amount)} held in escrow</span>
        <span className={styles.muted}>{dispute.viewerRole === "buyer" ? "Seller" : "Buyer"}: {dispute.counterpartyName} · Opened {formatFriendlyDateTime(dispute.openedAt)}</span>
        {sellerMustRespond && dispute.respondByAt ? (
          <span className={styles.urgent}>Respond by {formatFriendlyDateTime(dispute.respondByAt)} or support will decide without your input.</span>
        ) : null}
        <p className={styles.bubbleText}>{dispute.description}</p>
        {dispute.evidenceUrls.length > 0 ? (
          <ul className={styles.thumbs} aria-label="Evidence">
            {dispute.evidenceUrls.map((url, index) => (
              <li key={url} className={styles.thumb}>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Evidence ${index + 1}`} />
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        <Link className={styles.link} href={`/orders/${encodeURIComponent(dispute.orderId)}/escrow`}>View payment status</Link>
      </section>
      <section className={styles.card} aria-labelledby="dispute-status">
        <h2 id="dispute-status" className={styles.cardTitle}>Status</h2>
        <DisputeStatusHistory events={dispute.statusHistory} />
        {dispute.resolutionNote ? <p className={styles.muted}>{dispute.resolutionNote}</p> : null}
      </section>
      <section className={styles.actions} aria-labelledby="dispute-messages">
        <h2 id="dispute-messages" className={styles.cardTitle}>Messages with support</h2>
        <ol className={styles.messages}>
          {dispute.messages.map((message) => (
            <li key={message.id} className={styles.bubble} data-mine={message.authorRole === dispute.viewerRole} data-role={message.authorRole}>
              <span className={styles.bubbleAuthor}>{message.authorRole === "support" ? "Zudomart support" : message.authorName}</span>
              <span className={styles.bubbleText}>{message.text}</span>
              <span className={styles.faint}>{formatFriendlyDateTime(message.createdAt)}</span>
            </li>
          ))}
        </ol>
        <div ref={listEndRef} />
      </section>
      {finished ? null : (
        <form className={styles.composer} onSubmit={submit}>
          <textarea
            aria-label="Message"
            value={draft}
            maxLength={MAXIMUM_MESSAGE_LENGTH}
            placeholder={sellerMustRespond ? "Reply to the buyer and support…" : "Write a message…"}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <Button type="submit" busy={sendMessage.isPending} disabled={trimmedDraft === "" || !isOnline}>Send message</Button>
        </form>
      )}
      {sendMessage.isError ? <p className={styles.error} role="alert">{readErrorMessageForDisplay(sendMessage.error)}</p> : null}
      {!isOnline && !finished ? <p className={styles.error} role="status">You&apos;re offline. Reconnect to send your message.</p> : null}
    </div>
  );
}

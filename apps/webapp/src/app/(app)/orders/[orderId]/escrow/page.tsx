"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useRef, useState } from "react";

import { ContactCounterpartyButton } from "@/components/escrow/contactCounterpartyButton";
import { MessageStoreButton } from "@/components/messages/messageStoreButton";
import { EscrowExplainerCard, EscrowSummaryCard, EscrowTimeline } from "@/components/escrow/escrowCards";
import styles from "@/components/escrow/escrow.module.css";
import { useSession } from "@/components/providers/sessionProvider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/feedback";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { DetailSkeleton } from "@/components/ui/pageSkeletons";
import { createIdempotencyKey, readErrorMessageForDisplay, WebappRequestError } from "@/services/clientApi.service";
import { escrowQueryKeys, escrowsService } from "@/services/disputes.service";
import { escrowActionsForViewer } from "@/utils/escrowStage.util";

export default function EscrowStatusPage({ params }: { readonly params: Promise<{ readonly orderId: string }> }) {
  const { orderId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const viewerId = useSession().viewer?.id ?? null;
  const escrowQuery = useQuery({ queryKey: escrowQueryKeys.forOrder(orderId), queryFn: () => escrowsService.fetchEscrowForOrder(orderId), retry: false });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const confirmationKey = useRef(createIdempotencyKey("confirm-receipt"));
  const confirmReceipt = useMutation({
    mutationFn: () => escrowsService.confirmOrderReceiptAndReleaseEscrow(orderId, confirmationKey.current),
    onSuccess: () => {
      setConfirmOpen(false);
      void queryClient.invalidateQueries({ queryKey: escrowQueryKeys.forOrder(orderId) });
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const header = (
    <header className={styles.header}>
      <button type="button" className={styles.back} aria-label="Back" onClick={() => (window.history.length > 1 ? router.back() : router.push(`/orders/${encodeURIComponent(orderId)}`))}><ArrowLeftIcon size={18} /></button>
      <h1 className={styles.title}>Payment protection</h1>
    </header>
  );

  if (escrowQuery.isLoading) return <div className={styles.page}>{header}<DetailSkeleton label="Loading payment protection" blocks={3} /></div>;
  if (!escrowQuery.data) {
    const gone = escrowQuery.error instanceof WebappRequestError && (escrowQuery.error.status === 404 || escrowQuery.error.status === 403);
    return (
      <div className={styles.page}>
        {header}
        {gone ? (
          <ErrorState kind="orderNotFound" title="No payment protection for this order" description="This order was paid directly, or it belongs to another account." action={<Link href="/orders">Your orders</Link>} />
        ) : (
          <ErrorState title="Couldn't load the escrow status." error={escrowQuery.error} onRetry={() => void escrowQuery.refetch()} />
        )}
      </div>
    );
  }

  const escrow = escrowQuery.data;
  const viewerRole = escrow.sellerUserId === viewerId ? "seller" : "buyer";
  const actions = escrowActionsForViewer(escrow, viewerRole);

  return (
    <div className={styles.page}>
      {header}
      <EscrowSummaryCard escrow={escrow} viewerRole={viewerRole} />
      <section className={styles.card} aria-labelledby="escrow-progress">
        <h2 id="escrow-progress" className={styles.cardTitle}>Progress</h2>
        <EscrowTimeline escrow={escrow} viewerRole={viewerRole} />
      </section>
      <EscrowExplainerCard viewerRole={viewerRole} />
      <div className={styles.actions}>
        {actions.canConfirmReceipt ? <Button onClick={() => setConfirmOpen(true)}>Confirm receipt</Button> : null}
        {actions.canMarkShipped ? <Button onClick={() => router.push(`/seller/orders/${encodeURIComponent(orderId)}`)}>Mark as shipped</Button> : null}
        {escrow.disputeId ? <Button variant="secondary" onClick={() => router.push(`/disputes/${encodeURIComponent(escrow.disputeId!)}`)}>View dispute</Button> : null}
        {actions.canOpenDispute ? <Button variant="secondary" onClick={() => router.push(`/orders/${encodeURIComponent(orderId)}/dispute`)}>Open a dispute</Button> : null}
        {viewerRole === "buyer" ? <MessageStoreButton storeId={escrow.store.id} storeName={escrow.store.name} label="Contact seller" /> : <ContactCounterpartyButton userId={escrow.buyer.id} label="Contact buyer" />}
      </div>
      <Dialog
        isOpen={confirmOpen}
        onClose={() => { if (!confirmReceipt.isPending) setConfirmOpen(false); }}
        title="Confirm you received it?"
        intent="money"
        description={`Only confirm if everything arrived as described. ${escrow.store.name} will be paid right away and this can't be undone.`}
        actions={[
          { label: "Not yet", variant: "secondary", onClick: () => setConfirmOpen(false), disabled: confirmReceipt.isPending },
          { label: "Yes, release payment", variant: "primary", busy: confirmReceipt.isPending, onClick: () => { if (!confirmReceipt.isPending) confirmReceipt.mutate(); } },
        ]}
      >
        {confirmReceipt.isError ? <p className={styles.error} role="alert">{readErrorMessageForDisplay(confirmReceipt.error)}</p> : null}
      </Dialog>
    </div>
  );
}

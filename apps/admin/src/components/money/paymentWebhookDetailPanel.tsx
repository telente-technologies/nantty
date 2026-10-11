"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { ErrorBlock, LoadingBlock, NoticeBanner } from "@/components/ui/feedback";
import { SidePanel } from "@/components/ui/sidePanel";
import { KeyValueList, SectionHeading } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchDeadLetteredWebhook, replayDeadLetteredWebhook } from "@/services/paymentWebhooksApi.service";
import { formatDateTime } from "@/utils/formatting.util";

import styles from "./money.module.css";

export function PaymentWebhookDetailPanel({ webhookId, onClose, onReplayed }: { readonly webhookId: string; readonly onClose: () => void; readonly onReplayed: () => void }) {
  const { showToast } = useToast();
  const { data: webhook, errorMessage, isLoading, reload, replaceData } = useAdminQuery((signal) => fetchDeadLetteredWebhook(webhookId, signal), webhookId);
  const [isConfirming, setIsConfirming] = useState(false);
  const replay = useAdminMutation((reason: string) => replayDeadLetteredWebhook(webhookId, reason));
  const isProcessed = webhook?.processedAt !== null && webhook?.processedAt !== undefined;

  async function confirmReplay(reason: string) {
    const replayed = await replay.run(reason);
    if (!replayed) return;
    replaceData((current) => (current ? { ...current, ...replayed, payload: current.payload } : current));
    showToast(replayed.processedAt ? "Webhook replayed and processed" : "Webhook queued again; it will keep retrying");
    setIsConfirming(false);
    onReplayed();
  }

  return (
    <SidePanel
      isOpen
      title={webhook ? webhook.eventType : "Webhook"}
      subtitle={webhook ? webhook.provider : null}
      onClose={onClose}
      width="wide"
      footer={webhook && !isProcessed ? <Button variant="primary" iconName="shield24" onClick={() => setIsConfirming(true)}>Replay</Button> : null}
    >
      {errorMessage ? <ErrorBlock message={errorMessage} onRetry={reload} /> : null}
      {isLoading && !webhook ? <LoadingBlock /> : null}
      {webhook ? (
        <>
          {isProcessed ? <NoticeBanner tone="success" title="Processed">This event has been processed. Nothing more to do.</NoticeBanner> : null}
          <KeyValueList
            columns={2}
            items={[
              { label: "Reference", value: webhook.reference || "—", isMono: true },
              { label: "Event key", value: webhook.eventKey, isMono: true },
              { label: "Attempts", value: String(webhook.attempts) },
              { label: "Received", value: formatDateTime(webhook.createdAt) },
              { label: "Gave up", value: formatDateTime(webhook.deadLetteredAt) },
              { label: "Processed", value: formatDateTime(webhook.processedAt) },
            ]}
          />
          <SectionHeading>Last error</SectionHeading>
          <p className={styles.muted}>{webhook.lastError || "—"}</p>
          <SectionHeading>Payload (personal and card data removed)</SectionHeading>
          <pre className={styles.payload}>{JSON.stringify(webhook.payload ?? null, null, 2)}</pre>
        </>
      ) : null}
      {webhook && isConfirming ? (
        <ConfirmActionDialog
          isOpen
          title="Replay webhook"
          description={`${webhook.eventType} for ${webhook.reference || "an unknown reference"}.`}
          consequences={["The payment, deposit or transfer is checked again with the provider before anything is credited.", "If it fails again it goes back to retrying with backoff."]}
          confirmLabel="Replay"
          requiresReason
          reasonMaximumLength={500}
          reasonHint="Say what was fixed. This is kept in the audit log."
          requiresStepUp
          isBusy={replay.isRunning}
          errorMessage={replay.errorMessage}
          onConfirm={confirmReplay}
          onClose={() => setIsConfirming(false)}
        />
      ) : null}
    </SidePanel>
  );
}

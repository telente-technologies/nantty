"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { disputeStatusPresentation } from "@/components/orders/orderPresentation.constant";
import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { Button, ButtonLink } from "@/components/ui/button";
import { Callout, ErrorCallout, LoadingBlock } from "@/components/ui/feedback";
import { TextAreaField } from "@/components/ui/formFields";
import { KeyValueList, PageHeader, PageStack, Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useToast } from "@/components/ui/toastProvider";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { OrderDispute } from "@/types/order.type";
import { formatDateTimeForDisplay, formatRelativeTimeFromNow } from "@/utils/dateFormatting.util";

import styles from "./orders.module.css";
import { IconLabel } from "@/components/ui/zudoIcon";

const senderLabels = { buyer: "Buyer", seller: "You", zudomart: "Zudomart" } as const;

export function DisputeDetailView({ disputeId }: { readonly disputeId: string }) {
  const { can } = useSellerSession();
  const { showToast } = useToast();
  const { formatMoney } = useMoneyFormatter();
  const disputeQuery = useSellerQuery<OrderDispute>(`/seller/disputes/${encodeURIComponent(disputeId)}`);
  const [responseText, setResponseText] = useState("");
  const [responseError, setResponseError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const dispute = disputeQuery.data;

  if (disputeQuery.isLoading && !dispute) return <LoadingBlock label="Loading dispute" />;
  if (!dispute) return <ErrorCallout message={disputeQuery.errorMessage ?? "This dispute could not be loaded."} onRetry={disputeQuery.reload} />;
  const isResolved = dispute.status === "resolved_for_buyer" || dispute.status === "resolved_for_seller";

  async function sendDisputeResponse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedResponse = responseText.trim();
    if (trimmedResponse.length < 10 || trimmedResponse.length > 2000) {
      setResponseError("Write your response (10–2,000 characters).");
      return;
    }
    setIsSending(true);
    setResponseError(null);
    try {
      const updated = await sendSellerApiRequest<OrderDispute>(`/seller/disputes/${dispute?.id}/responses`, { method: "POST", body: { body: trimmedResponse } });
      disputeQuery.replaceData(() => updated);
      setResponseText("");
      showToast("Response sent. Zudomart will review it.");
    } catch (error) {
      setResponseError(readErrorMessageForDisplay(error));
    } finally {
      setIsSending(false);
    }
  }

  return (
    <PageStack>
      <PageHeader
        eyebrow={<Link href="/orders/disputes"><IconLabel name="arrowLeft24" size={16}>Disputes</IconLabel></Link>}
        title={`Dispute on ${dispute.orderNumber}`}
        description={`${dispute.buyerName} · ${dispute.reason}`}
        actions={
          <>
            <StatusBadge tone={disputeStatusPresentation[dispute.status].tone}>{disputeStatusPresentation[dispute.status].label}</StatusBadge>
            <ButtonLink href={`/orders/${dispute.orderId}`} size="small">View order</ButtonLink>
          </>
        }
      />
      {dispute.status === "awaiting_seller" && dispute.respondBy ? (
        <Callout tone="caution" title={`Reply ${formatRelativeTimeFromNow(dispute.respondBy)}`}>
          If you do not reply by {formatDateTimeForDisplay(dispute.respondBy)}, Zudomart may refund the buyer.
        </Callout>
      ) : null}
      <div className={styles.detailGrid}>
        <Panel title="Conversation">
          <div className={styles.thread}>
            {dispute.messages.map((message) => (
              <div key={message.id} className={`${styles.message} ${message.from === "seller" ? styles.message_seller : message.from === "zudomart" ? styles.message_zudomart : ""}`}>
                <p className={styles.messageMeta}>{senderLabels[message.from]} · {formatDateTimeForDisplay(message.createdAt)}</p>
                <p>{message.body}</p>
              </div>
            ))}
          </div>
          {!isResolved && can("orders:manage") ? (
            <form onSubmit={sendDisputeResponse} className={styles.formStack} style={{ marginTop: 16 }} noValidate>
              <TextAreaField
                label="Your response"
                hint="Describe what was sent, how it was packed and any evidence (photos, courier receipt numbers). Be factual."
                value={responseText}
                onChange={(event) => setResponseText(event.target.value)}
                maxLength={2000}
                errorMessage={responseError}
              />
              <div className={styles.actionRow}>
                <Button type="submit" variant="primary" iconName="paperPlaneTilt24" isBusy={isSending}>Send response</Button>
              </div>
            </form>
          ) : null}
        </Panel>
        <Panel title="Details">
          <KeyValueList
            items={[
              { label: "Amount on hold", value: formatMoney(dispute.amount) },
              { label: "Opened", value: formatDateTimeForDisplay(dispute.openedAt) },
              { label: "Reply by", value: formatDateTimeForDisplay(dispute.respondBy) },
            ]}
          />
        </Panel>
      </div>
    </PageStack>
  );
}

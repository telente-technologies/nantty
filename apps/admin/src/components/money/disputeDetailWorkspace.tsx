"use client";

import Link from "next/link";
import { useState } from "react";

import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { Button, ButtonLink } from "@/components/ui/button";
import { ErrorBlock, LoadingBlock, NoticeBanner } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/pageHeader";
import { StatusBadge } from "@/components/ui/statusBadge";
import { Card, KeyValueList, TwoColumnLayout } from "@/components/ui/surfaces";
import { UserIdentity } from "@/components/ui/userIdentity";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchDisputeDetail } from "@/services/moneyApi.service";
import { formatDateTime, formatMoneyForDisplay, formatRelativeTimeFromNow, humanizeConstantName } from "@/utils/formatting.util";
import { toIdentityUser } from "@/utils/partySummary.util";

import { DisputeCaseFile } from "./disputeCaseFile";
import { isDisputeOpen } from "./disputesWorkspace";
import { ResolveDisputeDialog } from "./resolveDisputeDialog";

export function DisputeDetailWorkspace({ disputeId }: { readonly disputeId: string }) {
  const { can } = useAdminPermissions();
  const { data: dispute, errorMessage, isLoading, reload, replaceData } = useAdminQuery((signal) => fetchDisputeDetail(disputeId, signal), disputeId);
  const [isResolveDialogOpen, setIsResolveDialogOpen] = useState(false);

  if (errorMessage) return <ErrorBlock variant="section" message={errorMessage} onRetry={reload} />;
  if (isLoading || !dispute) return <LoadingBlock lines={8} />;
  const isOpen = isDisputeOpen(dispute);
  const resolution = dispute.resolution;
  const escrow = dispute.escrow;

  return (
    <>
      <PageHeader
        area="Money · Disputes"
        title={`${humanizeConstantName(dispute.reason)} · ${dispute.orderNumber}`}
        description={`${dispute.productName}. Opened ${formatDateTime(dispute.openedAt)}. ${isOpen ? (dispute.slaDueAt ? `Decision due ${formatRelativeTimeFromNow(dispute.slaDueAt)}.` : "") : "Closed."}`}
        meta={
          <>
            <StatusBadge status={dispute.status} />
            <StatusBadge status={dispute.priority} hasDot={false} />
            {isOpen && dispute.isSlaBreached ? <StatusBadge label="Past SLA" tone="danger" /> : null}
          </>
        }
        actions={
          <>
            <ButtonLink href="/commerce/disputes" variant="ghost" iconName="arrowLeft24">All disputes</ButtonLink>
            <ButtonLink href={`/commerce/orders/${dispute.orderId}`} iconName="shoppingCart24">View order</ButtonLink>
            {isOpen && can("disputes:resolve") ? <Button variant="primary" iconName="shield24" onClick={() => setIsResolveDialogOpen(true)}>Resolve</Button> : null}
          </>
        }
      />
      <TwoColumnLayout
        main={
          <>
            {resolution ? (
              <NoticeBanner tone="success" title={`Resolved: ${humanizeConstantName(resolution.outcome)}`}>
                Buyer refunded {formatMoneyForDisplay(resolution.buyerRefund)}, seller received {formatMoneyForDisplay(resolution.sellerPayout)}, escrow fee {formatMoneyForDisplay(resolution.commission)}.{resolution.resolvedAt ? ` ${resolution.resolvedByStaffId ? `Staff ${resolution.resolvedByStaffId}` : "Closed"} on ${formatDateTime(resolution.resolvedAt)}` : ""}{resolution.note ? `: “${resolution.note}”` : ""}
              </NoticeBanner>
            ) : null}
            <DisputeCaseFile dispute={dispute} />
          </>
        }
        aside={
          <>
            <Card title="Escrow">
              <KeyValueList
                items={[
                  { label: "Status", value: <StatusBadge status={escrow.status} hasDot={false} /> },
                  { label: "Order amount", value: formatMoneyForDisplay(escrow.amount) },
                  { label: "Held now", value: formatMoneyForDisplay(escrow.heldAmount) },
                  { label: "Refunded", value: formatMoneyForDisplay(escrow.refundedAmount) },
                  { label: "Released", value: formatMoneyForDisplay(escrow.releasedAmount) },
                  { label: "Escrow fee", value: formatMoneyForDisplay(escrow.commission) },
                  { label: "Processing fee", value: formatMoneyForDisplay(escrow.processingFee) },
                  { label: "Payment reference", value: escrow.paymentReference || "—", isMono: true },
                  { label: "Delivered", value: formatDateTime(escrow.deliveredAt) },
                ]}
              />
            </Card>
            <Card title="People">
              <KeyValueList
                items={[
                  { label: "Buyer", value: <Link href={`/users/${dispute.buyer.id}`}><UserIdentity user={toIdentityUser(dispute.buyer)} size={24} /></Link> },
                  { label: "Seller", value: <Link href={`/users/${dispute.seller.id}`}><UserIdentity user={toIdentityUser(dispute.seller)} size={24} /></Link> },
                ]}
              />
            </Card>
          </>
        }
      />
      {isResolveDialogOpen ? <ResolveDisputeDialog dispute={dispute} onClose={() => setIsResolveDialogOpen(false)} onResolved={(updated) => replaceData(() => updated)} /> : null}
    </>
  );
}

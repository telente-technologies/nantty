"use client";

import Link from "next/link";
import { useState } from "react";

import { AuditHistoryList } from "@/components/audit/auditHistoryList";
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

import { DisputeCaseFile } from "./disputeCaseFile";
import { EscrowTimeline } from "./escrowTimeline";
import { ResolveDisputeDialog } from "./resolveDisputeDialog";

export function DisputeDetailWorkspace({ disputeId }: { readonly disputeId: string }) {
  const { can } = useAdminPermissions();
  const { data: dispute, errorMessage, isLoading, reload, replaceData } = useAdminQuery((signal) => fetchDisputeDetail(disputeId, signal), disputeId);
  const [isResolveDialogOpen, setIsResolveDialogOpen] = useState(false);

  if (errorMessage) return <ErrorBlock message={errorMessage} onRetry={reload} />;
  if (isLoading || !dispute) return <LoadingBlock lines={8} />;
  const isOverdue = dispute.status !== "RESOLVED" && new Date(dispute.slaDueAt).getTime() < Date.now();
  const resolution = dispute.resolution;

  return (
    <>
      <PageHeader
        area="Money · Disputes"
        title={`${humanizeConstantName(dispute.reasonCategory)} · ${dispute.orderNumber}`}
        description={`Opened ${formatDateTime(dispute.openedAt)}. ${dispute.status === "RESOLVED" ? "Resolved." : `Decision due ${formatRelativeTimeFromNow(dispute.slaDueAt)}.`}`}
        meta={
          <>
            <StatusBadge status={dispute.status} />
            <StatusBadge status={dispute.priority} hasDot={false} />
            {isOverdue ? <StatusBadge label="Past SLA" tone="danger" /> : null}
          </>
        }
        actions={
          <>
            <ButtonLink href="/commerce/disputes" variant="ghost" iconName="arrowLeft24">All disputes</ButtonLink>
            <ButtonLink href={`/commerce/orders/${dispute.orderId}`} iconName="shoppingCart24">View order</ButtonLink>
            {dispute.status !== "RESOLVED" && can("disputes:resolve") ? <Button variant="primary" iconName="shield24" onClick={() => setIsResolveDialogOpen(true)}>Resolve</Button> : null}
          </>
        }
      />
      <TwoColumnLayout
        main={
          <>
            {resolution ? (
              <NoticeBanner tone="success" title={`Resolved: ${humanizeConstantName(resolution.outcome)}`}>
                Buyer refunded {formatMoneyForDisplay(resolution.buyerRefund)}, seller received {formatMoneyForDisplay(resolution.sellerPayout)}, escrow fee {formatMoneyForDisplay(resolution.commission)}. By {resolution.resolvedByName} on {formatDateTime(resolution.resolvedAt)}: “{resolution.reason}”
              </NoticeBanner>
            ) : null}
            <DisputeCaseFile dispute={dispute} />
            <Card title="Escrow timeline">
              <EscrowTimeline escrow={dispute.escrow} />
            </Card>
          </>
        }
        aside={
          <>
            <Card title="Money">
              <KeyValueList
                items={[
                  { label: "In escrow", value: formatMoneyForDisplay(dispute.escrow.heldAmount) },
                  { label: "Order total", value: formatMoneyForDisplay(dispute.escrowAmount) },
                  { label: "Escrow status", value: <StatusBadge status={dispute.escrow.status} hasDot={false} /> },
                ]}
              />
            </Card>
            <Card title="People">
              <KeyValueList
                items={[
                  { label: "Buyer", value: <Link href={`/users/${dispute.buyer.id}`}><UserIdentity user={dispute.buyer} size={24} /></Link> },
                  { label: "Seller", value: <Link href={`/users/${dispute.seller.id}`}><UserIdentity user={dispute.seller} size={24} /></Link> },
                ]}
              />
            </Card>
            <Card title="Admin history">
              <AuditHistoryList entries={dispute.history} />
            </Card>
          </>
        }
      />
      {isResolveDialogOpen ? <ResolveDisputeDialog dispute={dispute} onClose={() => setIsResolveDialogOpen(false)} onResolved={(updated) => replaceData(() => updated)} /> : null}
    </>
  );
}

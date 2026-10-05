"use client";

import { useState } from "react";

import { AffiliateCreatorIdentity } from "@/components/affiliates/affiliateCreatorIdentity";
import { AffiliateLiveInvitationDialog } from "@/components/affiliates/affiliateLiveInvitationDialog";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/dataTable";
import { EmptyState, ErrorCallout } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/panel";
import { StatusBadge, type StatusTone } from "@/components/ui/statusBadge";
import { useToast } from "@/components/ui/toastProvider";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { LiveInvitation, LiveInvitationStatus } from "@/types/affiliate.type";
import type { CursorPage } from "@/types/pagination.type";
import { formatDateTimeForDisplay } from "@/utils/dateFormatting.util";
import { formatBasisPointsAsPercent } from "@/utils/money.util";

const invitationStatusTone: Record<LiveInvitationStatus, StatusTone> = { pending: "info", accepted: "success", declined: "neutral", live: "highlight", ended: "neutral", cancelled: "neutral" };
const invitationStatusLabel: Record<LiveInvitationStatus, string> = { pending: "Waiting for reply", accepted: "Accepted", declined: "Declined", live: "Live now", ended: "Ended", cancelled: "Cancelled" };

export function AffiliateLiveInvitationsView() {
  const invitationsQuery = useSellerQuery<CursorPage<LiveInvitation>>("/seller/affiliates/live-invitations", { limit: 100 });
  const { showToast } = useToast();
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [cancellingInvitationId, setCancellingInvitationId] = useState<string | null>(null);

  async function cancelLiveInvitation(invitation: LiveInvitation) {
    setCancellingInvitationId(invitation.id);
    try {
      await sendSellerApiRequest(`/seller/affiliates/live-invitations/${encodeURIComponent(invitation.id)}/cancel`, { method: "POST" });
      showToast(`Cancelled the live with @${invitation.creator.username}.`);
      invitationsQuery.reload();
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setCancellingInvitationId(null);
    }
  }

  return (
    <>
      <Panel
        title="Live selling invitations"
        description="Invite a creator to feature your products in a Zudomart live. Sales from the live earn them commission like any other affiliate sale."
        actions={<Button variant="primary" iconName="videoCamera24" onClick={() => setIsInviteDialogOpen(true)}>Invite a creator</Button>}
        padded={false}
      >
        {invitationsQuery.errorMessage ? <ErrorCallout message={invitationsQuery.errorMessage} onRetry={invitationsQuery.reload} /> : null}
        <DataTable
          caption="Live selling invitations"
          rows={invitationsQuery.data?.data ?? null}
          isLoading={invitationsQuery.isLoading}
          readRowKey={(invitation) => invitation.id}
          emptyState={<EmptyState iconName="videoCamera24" title="No lives planned" description="Invite a creator to host a live with your products." />}
          columns={[
            { key: "creator", header: "Creator", render: (invitation) => <AffiliateCreatorIdentity creator={invitation.creator} showNiche={false} /> },
            { key: "products", header: "Products", render: (invitation) => invitation.products.map((product) => product.name).join(", ") },
            { key: "start", header: "Starts", render: (invitation) => formatDateTimeForDisplay(invitation.proposedStartAt) },
            { key: "commission", header: "Commission", hideBelowTablet: true, render: (invitation) => (invitation.commissionBasisPoints === null ? "Product rates" : formatBasisPointsAsPercent(invitation.commissionBasisPoints)) },
            { key: "status", header: "Status", render: (invitation) => <StatusBadge tone={invitationStatusTone[invitation.status]}>{invitationStatusLabel[invitation.status]}</StatusBadge> },
            {
              key: "actions",
              header: <span className="visuallyHidden">Actions</span>,
              align: "end",
              render: (invitation) =>
                invitation.status === "pending" || invitation.status === "accepted" ? (
                  <Button size="small" variant="ghost" isBusy={cancellingInvitationId === invitation.id} onClick={() => void cancelLiveInvitation(invitation)}>
                    Cancel
                  </Button>
                ) : null,
            },
          ]}
        />
      </Panel>
      <AffiliateLiveInvitationDialog
        isOpen={isInviteDialogOpen}
        onClose={() => setIsInviteDialogOpen(false)}
        onInvited={() => {
          setIsInviteDialogOpen(false);
          invitationsQuery.reload();
        }}
      />
    </>
  );
}

"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { DataTable } from "@/components/ui/dataTable";
import { ModalDialog } from "@/components/ui/modalDialog";
import { StatusBadge } from "@/components/ui/statusBadge";
import { KeyValueList } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { revokeOfferLink } from "@/services/subscriptionOffersApi.service";
import type { OfferLink } from "@/types/subscriptionOffers.type";
import { formatDateTime } from "@/utils/formatting.util";
import { describeOfferDiscount, describeOfferDuration, describeOfferHeadline, describeOfferUses, offerStatusLabels, readOfferPlanLabel } from "@/utils/offerLinkFormat.util";

import { SendOfferLinkDialog } from "./sendOfferLinkDialog";
import styles from "./subscriptionOffers.module.css";

const claimStatusLabels = { reserved: "Reserved", redeemed: "Paid", released: "Released" } as const;

export function OfferLinkDetailsDialog({ link, canWrite, onClose, onChanged }: { readonly link: OfferLink; readonly canWrite: boolean; readonly onClose: () => void; readonly onChanged: (link: OfferLink) => void }) {
  const [isSending, setIsSending] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const { showToast } = useToast();
  const revoke = useAdminMutation((reason: string) => revokeOfferLink(link.id, reason));
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link.url);
      showToast("Link copied.");
    } catch {
      showToast("Couldn't copy the link. Select it and copy it by hand.", "error");
    }
  };
  const confirmRevoke = async (reason: string) => {
    const revoked = await revoke.run(reason);
    if (!revoked) return;
    showToast("Offer link revoked.");
    setIsRevoking(false);
    onChanged(revoked);
  };
  const isActive = link.status === "active";
  return (
    <>
      <ModalDialog
        isOpen={!isSending && !isRevoking}
        width="wide"
        title={describeOfferHeadline(link)}
        description={link.label || undefined}
        onClose={onClose}
        footer={
          <>
            {canWrite && link.status !== "revoked" ? <Button variant="quietDanger" onClick={() => setIsRevoking(true)}>Revoke link</Button> : null}
            {canWrite && isActive ? <Button variant="primary" iconName="arrowUpRight24" onClick={() => setIsSending(true)}>Email this offer</Button> : null}
          </>
        }
      >
        <div className={styles.form}>
          <div className={styles.linkRow}>
            <code className={styles.linkText}>{link.url}</code>
            <Button size="small" iconName="copy16" onClick={() => void copyLink()}>Copy link</Button>
          </div>
          <KeyValueList
            columns={2}
            items={[
              { label: "Status", value: <StatusBadge status={link.status.toUpperCase()} label={offerStatusLabels[link.status]} /> },
              { label: "Plans", value: link.plans.map((plan) => readOfferPlanLabel(plan.planCode)).join(", ") },
              { label: "Discount", value: describeOfferDiscount(link.discount) },
              { label: "Lasts for", value: describeOfferDuration(link.durationCycles) },
              { label: "Claims", value: describeOfferUses(link) },
              { label: "Expires", value: link.expiresAt ? formatDateTime(link.expiresAt) : "Never" },
              { label: "Created", value: `${formatDateTime(link.createdAt)} by ${link.createdByStaffId}`, isMono: false },
              ...(link.revokedAt ? [{ label: "Revoked", value: formatDateTime(link.revokedAt) }] : []),
            ]}
          />
          <DataTable
            caption="Claims"
            rows={link.claims}
            readRowKey={(claim) => claim.id}
            columns={[
              { key: "account", header: "Account", render: (claim) => claim.accountId, isMono: true },
              { key: "status", header: "Status", render: (claim) => claimStatusLabels[claim.status] },
              { key: "claimed", header: "Claimed", render: (claim) => formatDateTime(claim.claimedAt) },
              { key: "paid", header: "Paid", render: (claim) => (claim.redeemedAt ? formatDateTime(claim.redeemedAt) : "—") },
            ]}
          />
          <DataTable
            caption="Emails sent"
            rows={link.sends}
            readRowKey={(send) => send.id}
            columns={[
              { key: "to", header: "To", render: (send) => send.recipientEmail },
              { key: "by", header: "Sent by", render: (send) => send.sentByStaffId, isMono: true },
              { key: "when", header: "When", render: (send) => formatDateTime(send.sentAt) },
              { key: "note", header: "Note", render: (send) => send.note || "—" },
            ]}
          />
        </div>
      </ModalDialog>
      {isSending ? (
        <SendOfferLinkDialog
          link={link}
          onClose={() => setIsSending(false)}
          onSent={(sends) => {
            setIsSending(false);
            onChanged({ ...link, sends: [...sends, ...link.sends] });
          }}
        />
      ) : null}
      <ConfirmActionDialog
        isOpen={isRevoking}
        title="Revoke this offer link?"
        description="Nobody can claim it after this. Buyers who already paid keep their discount for the cycles they were promised."
        confirmLabel="Revoke link"
        tone="danger"
        reasonMaximumLength={300}
        isBusy={revoke.isRunning}
        errorMessage={revoke.errorMessage}
        onConfirm={(reason) => void confirmRevoke(reason)}
        onClose={() => setIsRevoking(false)}
      />
    </>
  );
}

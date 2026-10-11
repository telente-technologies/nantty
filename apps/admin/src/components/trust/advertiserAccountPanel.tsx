"use client";

import Link from "next/link";
import { useState } from "react";

import { AuditHistoryList } from "@/components/audit/auditHistoryList";
import { useAdminPermissions } from "@/components/session/adminSessionProvider";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirmActionDialog";
import { ErrorBlock, LoadingBlock } from "@/components/ui/feedback";
import { MoneyByCurrencyList } from "@/components/ui/moneyByCurrencyList";
import { SidePanel } from "@/components/ui/sidePanel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { KeyValueList, SectionHeading } from "@/components/ui/surfaces";
import { useToast } from "@/components/ui/toastProvider";
import { UserIdentity } from "@/components/ui/userIdentity";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { changeAdvertiserAccountStatus, fetchAdvertiserAccountDetail } from "@/services/adsReviewApi.service";
import { formatDateOnly, formatRelativeTimeFromNow } from "@/utils/formatting.util";

import styles from "./adsReview.module.css";

export function AdvertiserAccountPanel({ advertiserId, onClose, onAdvertiserChanged }: { readonly advertiserId: string; readonly onClose: () => void; readonly onAdvertiserChanged: () => void }) {
  const { data: advertiser, errorMessage, error: queryError, isLoading, reload, replaceData } = useAdminQuery((signal) => fetchAdvertiserAccountDetail(advertiserId, signal), advertiserId);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const { can } = useAdminPermissions();
  const { showToast } = useToast();
  const nextAction = advertiser?.status === "SUSPENDED" ? "reinstate" : "suspend";
  const mutation = useAdminMutation((reason: string) => changeAdvertiserAccountStatus(advertiserId, nextAction, reason));

  async function confirmStatusChange(reason: string) {
    const updated = await mutation.run(reason);
    if (!updated) return;
    replaceData((current) => (current ? { ...current, status: updated.status } : current));
    showToast(nextAction === "suspend" ? "Advertiser suspended. All their ads stopped delivering." : "Advertiser reinstated.");
    setIsConfirmOpen(false);
    onAdvertiserChanged();
  }

  return (
    <SidePanel
      isOpen
      onClose={onClose}
      title={advertiser?.name ?? "Advertiser"}
      subtitle={advertiser ? `${advertiser.id} · since ${formatDateOnly(advertiser.createdAt)}` : null}
      footer={advertiser && can("advertisers:manage") ? <Button variant={nextAction === "suspend" ? "quietDanger" : "primary"} onClick={() => setIsConfirmOpen(true)}>{nextAction === "suspend" ? "Suspend advertiser" : "Reinstate advertiser"}</Button> : null}
    >
      {errorMessage ? <ErrorBlock error={queryError} message={errorMessage} onRetry={reload} /> : null}
      {isLoading && !advertiser ? <LoadingBlock /> : null}
      {advertiser ? (
        <>
          <div className={styles.section}>
            <SectionHeading actions={<Link href={`/users/${advertiser.owner.id}`}>Open profile</Link>}>Owner</SectionHeading>
            <UserIdentity user={advertiser.owner} size={36} />
          </div>
          <KeyValueList columns={2} items={[
            { label: "Status", value: <StatusBadge status={advertiser.status} /> },
            { label: "Billing currency", value: advertiser.currency, isMono: true },
            { label: "Lifetime spend", value: <MoneyByCurrencyList amounts={advertiser.spendByCurrency} isCompact={false} /> },
            { label: "Active campaigns", value: advertiser.activeCampaigns },
            { label: "Policy violations", value: advertiser.violationCount },
            { label: "Last violation", value: advertiser.lastViolationAt ? formatRelativeTimeFromNow(advertiser.lastViolationAt) : "Never" },
          ]} />
          <div className={styles.section}>
            <SectionHeading>History</SectionHeading>
            <AuditHistoryList entries={advertiser.history} />
          </div>
          <ConfirmActionDialog intent="suspend"
            isOpen={isConfirmOpen}
            title={nextAction === "suspend" ? `Suspend ${advertiser.name}` : `Reinstate ${advertiser.name}`}
            consequences={nextAction === "suspend" ? ["Every campaign stops delivering immediately.", "Unspent prepaid balance stays on the account.", "The owner can't create new ads until reinstated."] : ["The account can create ads again. Paused campaigns stay paused until the owner resumes them."]}
            confirmLabel={nextAction === "suspend" ? "Suspend advertiser" : "Reinstate advertiser"}
            tone={nextAction === "suspend" ? "danger" : "default"}
            isBusy={mutation.isRunning}
            errorMessage={mutation.errorMessage}
            onConfirm={confirmStatusChange}
            onClose={() => { mutation.clearError(); setIsConfirmOpen(false); }}
          />
        </>
      ) : null}
    </SidePanel>
  );
}

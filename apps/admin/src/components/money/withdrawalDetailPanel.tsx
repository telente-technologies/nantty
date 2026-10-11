"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorBlock, LoadingBlock, NoticeBanner } from "@/components/ui/feedback";
import { SidePanel } from "@/components/ui/sidePanel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { KeyValueList, SectionHeading } from "@/components/ui/surfaces";
import { UserIdentity } from "@/components/ui/userIdentity";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchWithdrawalDetail } from "@/services/moneyApi.service";
import type { StaffWithdrawalDetail, WithdrawalDecision } from "@/types/withdrawals.type";
import { formatDateTime, formatMoneyForDisplay, formatRelativeTimeFromNow, humanizeConstantName } from "@/utils/formatting.util";
import { toIdentityUser } from "@/utils/partySummary.util";

import styles from "./money.module.css";
import { WithdrawalDecisionDialog } from "./withdrawalDecisionDialog";

const decisionsByStatus: Readonly<Partial<Record<StaffWithdrawalDetail["withdrawalStatus"], readonly WithdrawalDecision[]>>> = {
  pending_review: ["approve", "hold", "reject"],
  on_hold: ["approve", "reject"],
  queued: ["hold"],
};

function WithdrawalDetailBody({ withdrawal }: { readonly withdrawal: StaffWithdrawalDetail }) {
  const destination = withdrawal.destination;
  return (
    <>
      <Link href={`/users/${withdrawal.userId}`}>
        <UserIdentity user={toIdentityUser(withdrawal.user)} size={36} />
      </Link>
      {destination?.removed ? <NoticeBanner tone="caution" title="Destination removed">The user removed this bank account after asking for the withdrawal.</NoticeBanner> : null}
      {withdrawal.failureReason ? <NoticeBanner tone="danger" title="Not paid">{withdrawal.failureReason}</NoticeBanner> : null}
      <KeyValueList
        columns={2}
        items={[
          { label: "Amount", value: <span className={styles.amount}>{formatMoneyForDisplay(withdrawal.amount)}</span> },
          { label: "User receives", value: formatMoneyForDisplay(withdrawal.netAmount) },
          { label: "Fee", value: `${formatMoneyForDisplay(withdrawal.fee)} · ${withdrawal.provider}` },
          { label: "Available balance now", value: formatMoneyForDisplay(withdrawal.availableBalance) },
          { label: "Reference", value: withdrawal.reference, isMono: true },
          { label: "Requested", value: formatDateTime(withdrawal.createdAt) },
          { label: "Processed", value: formatDateTime(withdrawal.processedAt) },
        ]}
      />
      <SectionHeading>Destination</SectionHeading>
      {destination ? (
        <KeyValueList
          columns={2}
          items={[
            { label: "Bank", value: `${destination.bankName} ••••${destination.accountLast4}` },
            { label: "Account name", value: destination.accountName },
            { label: "Country", value: destination.countryCode },
            { label: "Added", value: formatRelativeTimeFromNow(destination.addedAt) },
          ]}
        />
      ) : <p className={styles.muted}>The payout account could not be found.</p>}
      <SectionHeading>Last decision</SectionHeading>
      {withdrawal.reviewedAt ? (
        <p className={styles.muted}>Staff {withdrawal.reviewedByStaffId ?? "unknown"} · {formatDateTime(withdrawal.reviewedAt)}{withdrawal.reviewNote ? ` · “${withdrawal.reviewNote}”` : ""}</p>
      ) : <p className={styles.muted}>Nobody has reviewed this withdrawal yet.</p>}
      <SectionHeading>Other withdrawals by this user</SectionHeading>
      {withdrawal.recentWithdrawals.length === 0 ? (
        <p className={styles.muted}>First withdrawal.</p>
      ) : (
        <ul className={styles.reasons}>
          {withdrawal.recentWithdrawals.map((recent) => (
            <li key={recent.id}>
              {formatMoneyForDisplay(recent.amount)} · {humanizeConstantName(recent.withdrawalStatus)} · {formatDateTime(recent.createdAt)}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function WithdrawalDetailPanel({ withdrawalId, onClose, onChanged }: { readonly withdrawalId: string; readonly onClose: () => void; readonly onChanged: () => void }) {
  const { data: withdrawal, errorMessage, error: queryError, isLoading, reload, replaceData } = useAdminQuery((signal) => fetchWithdrawalDetail(withdrawalId, signal), withdrawalId);
  const [decision, setDecision] = useState<WithdrawalDecision | null>(null);
  const decisions = withdrawal ? (decisionsByStatus[withdrawal.withdrawalStatus] ?? []) : [];

  return (
    <SidePanel
      isOpen
      title={withdrawal ? `Withdrawal ${withdrawal.reference}` : "Withdrawal"}
      subtitle={withdrawal ? <StatusBadge status={withdrawal.withdrawalStatus} /> : null}
      onClose={onClose}
      footer={
        decisions.length > 0 ? (
          <>
            {decisions.includes("approve") ? <Button variant="primary" iconName="shield24" onClick={() => setDecision("approve")}>Approve</Button> : null}
            {decisions.includes("hold") ? <Button iconName="shield24" onClick={() => setDecision("hold")}>Hold</Button> : null}
            {decisions.includes("reject") ? <Button variant="quietDanger" iconName="shield24" onClick={() => setDecision("reject")}>Reject</Button> : null}
          </>
        ) : null
      }
    >
      {errorMessage ? <ErrorBlock error={queryError} message={errorMessage} onRetry={reload} /> : null}
      {isLoading && !withdrawal ? <LoadingBlock /> : null}
      {withdrawal ? <WithdrawalDetailBody withdrawal={withdrawal} /> : null}
      {withdrawal && decision ? (
        <WithdrawalDecisionDialog
          withdrawal={withdrawal}
          decision={decision}
          onClose={() => setDecision(null)}
          onDecided={(updated) => {
            replaceData(() => updated);
            onChanged();
          }}
        />
      ) : null}
    </SidePanel>
  );
}

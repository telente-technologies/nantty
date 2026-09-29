"use client";

import Link from "next/link";
import { useState } from "react";

import { AuditHistoryList } from "@/components/audit/auditHistoryList";
import { Button } from "@/components/ui/button";
import { ErrorBlock, LoadingBlock } from "@/components/ui/feedback";
import { SidePanel } from "@/components/ui/sidePanel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { KeyValueList, SectionHeading } from "@/components/ui/surfaces";
import { UserIdentity } from "@/components/ui/userIdentity";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchPayoutDetail } from "@/services/moneyApi.service";
import type { PayoutDetail } from "@/types/payouts.type";
import { formatDateTime, formatMoneyForDisplay, formatRelativeTimeFromNow, humanizeConstantName } from "@/utils/formatting.util";

import { FraudScoreMeter } from "./fraudScoreMeter";
import styles from "./money.module.css";
import { PayoutDecisionDialog, type PayoutDecision } from "./payoutDecisionDialog";

function PayoutDetailBody({ payout }: { readonly payout: PayoutDetail }) {
  return (
    <>
      <Link href={`/users/${payout.user.id}`}>
        <UserIdentity user={payout.user} size={36} />
      </Link>
      <KeyValueList
        columns={2}
        items={[
          { label: "Amount", value: <span className={styles.amount}>{formatMoneyForDisplay(payout.amount)}</span> },
          { label: "User receives", value: formatMoneyForDisplay(payout.netAmount) },
          { label: "Provider fee", value: `${formatMoneyForDisplay(payout.providerFee)} · ${payout.provider}` },
          { label: "Wallet after", value: formatMoneyForDisplay(payout.walletBalanceAfter) },
          { label: "Source", value: humanizeConstantName(payout.source) },
          { label: "Requested", value: formatDateTime(payout.requestedAt) },
        ]}
      />
      <SectionHeading>Destination</SectionHeading>
      <KeyValueList
        columns={2}
        items={[
          { label: humanizeConstantName(payout.destination.kind), value: `${payout.destination.institutionName} ${payout.destination.accountMasked}` },
          { label: "Account name", value: payout.destination.accountName },
          { label: "Added", value: formatRelativeTimeFromNow(payout.destination.addedAt) },
        ]}
      />
      <SectionHeading actions={<StatusBadge status={payout.fraud.riskLevel} />}>Fraud check · intelligence service</SectionHeading>
      <FraudScoreMeter fraud={payout.fraud} />
      <ul className={styles.reasons}>
        {payout.fraud.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
      <p className={styles.muted}>
        Model {payout.fraud.modelVersion} · scored {formatRelativeTimeFromNow(payout.fraud.evaluatedAt)}
      </p>
      <SectionHeading>Other withdrawals by this user</SectionHeading>
      {payout.recentPayouts.length === 0 ? (
        <p className={styles.muted}>First withdrawal.</p>
      ) : (
        <ul className={styles.reasons}>
          {payout.recentPayouts.map((recent) => (
            <li key={recent.id}>
              {formatMoneyForDisplay(recent.amount)} · {humanizeConstantName(recent.status)} · {formatDateTime(recent.requestedAt)}
            </li>
          ))}
        </ul>
      )}
      <SectionHeading>Admin history</SectionHeading>
      <AuditHistoryList entries={payout.history} />
    </>
  );
}

export function PayoutDetailPanel({ payoutId, onClose, onChanged }: { readonly payoutId: string; readonly onClose: () => void; readonly onChanged: () => void }) {
  const { data: payout, errorMessage, isLoading, reload, replaceData } = useAdminQuery((signal) => fetchPayoutDetail(payoutId, signal), payoutId);
  const [decision, setDecision] = useState<PayoutDecision | null>(null);
  const isActionable = payout?.status === "PENDING" || payout?.status === "ON_HOLD";

  return (
    <SidePanel
      isOpen
      title={payout ? `Withdrawal ${payout.id}` : "Withdrawal"}
      subtitle={payout ? <StatusBadge status={payout.status} /> : null}
      onClose={onClose}
      footer={
        payout && isActionable ? (
          <>
            <Button variant="primary" iconName="shield24" onClick={() => setDecision("approve")}>Approve</Button>
            {payout.status === "PENDING" ? <Button onClick={() => setDecision("hold")}>Hold</Button> : null}
            <Button variant="quietDanger" onClick={() => setDecision("reject")}>Reject</Button>
          </>
        ) : null
      }
    >
      {errorMessage ? <ErrorBlock message={errorMessage} onRetry={reload} /> : null}
      {isLoading && !payout ? <LoadingBlock /> : null}
      {payout ? <PayoutDetailBody payout={payout} /> : null}
      {payout && decision ? (
        <PayoutDecisionDialog
          payout={payout}
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

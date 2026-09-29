"use client";

import { useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/ui/dataTable";
import { ErrorBlock } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/pageHeader";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/statusBadge";
import { SegmentedTabs } from "@/components/ui/tabs";
import { UserIdentity } from "@/components/ui/userIdentity";
import { useAdminQuery } from "@/hooks/useAdminQuery.hook";
import { fetchPayouts } from "@/services/moneyApi.service";
import type { PayoutRequest, PayoutStatus } from "@/types/payouts.type";
import { formatMoneyForDisplay, formatRelativeTimeFromNow } from "@/utils/formatting.util";

import { FraudScoreMeter } from "./fraudScoreMeter";
import styles from "./money.module.css";
import { PayoutDetailPanel } from "./payoutDetailPanel";

type PayoutTabKey = PayoutStatus | "ALL";

const payoutColumns: readonly DataTableColumn<PayoutRequest>[] = [
  { key: "user", header: "User", render: (payout) => <UserIdentity user={payout.user} size={24} /> },
  { key: "amount", header: "Amount", render: (payout) => <span className={styles.stack}><span className={styles.amount}>{formatMoneyForDisplay(payout.amount)}</span><span className={styles.muted}>fee {formatMoneyForDisplay(payout.providerFee)}</span></span>, align: "end" },
  { key: "destination", header: "Destination", render: (payout) => <span className={styles.stack}><span>{payout.destination.institutionName} <span className="mono">{payout.destination.accountMasked}</span></span><span className={styles.muted}>added {formatRelativeTimeFromNow(payout.destination.addedAt)}</span></span> },
  { key: "fraud", header: "Fraud score", render: (payout) => <span className={styles.stack}><FraudScoreMeter fraud={payout.fraud} /><span className={styles.muted}>{payout.fraud.reasons[0] ?? ""}</span></span>, width: "26%" },
  { key: "status", header: "Status", render: (payout) => <StatusBadge status={payout.status} /> },
  { key: "requested", header: "Requested", render: (payout) => <span className={styles.muted}>{formatRelativeTimeFromNow(payout.requestedAt)}</span> },
];

export function PayoutsWorkspace() {
  const [status, setStatus] = useState<PayoutTabKey>("PENDING");
  const [page, setPage] = useState(1);
  const [openPayoutId, setOpenPayoutId] = useState<string | null>(null);
  const filters = { status, page };
  const { data, errorMessage, isLoading, reload } = useAdminQuery((signal) => fetchPayouts(filters, signal), JSON.stringify(filters));
  const counts = data?.counts;
  const tabs = (["PENDING", "ON_HOLD", "APPROVED", "PAID", "REJECTED"] as const).map((key) => ({ key: key as PayoutTabKey, label: key === "ON_HOLD" ? "On hold" : key.charAt(0) + key.slice(1).toLowerCase(), count: counts?.[key] ?? null }));

  return (
    <>
      <PageHeader area="Money" title="Payouts" description="Withdrawals waiting for a person. Riskiest first, scored by the intelligence service. Approving sends real money." />
      <SegmentedTabs label="Payout status" items={[...tabs, { key: "ALL", label: "All" }]} activeKey={status} onChange={(key) => { setStatus(key); setPage(1); }} />
      {errorMessage ? <ErrorBlock message={errorMessage} onRetry={reload} /> : null}
      <DataTable
        caption="Withdrawal requests"
        columns={payoutColumns}
        rows={data?.items ?? []}
        readRowKey={(payout) => payout.id}
        isLoading={isLoading}
        selectedRowKey={openPayoutId}
        onRowOpen={(payout) => setOpenPayoutId(payout.id)}
        readRowTone={(payout) => (payout.fraud.riskLevel === "HIGH" ? "danger" : payout.fraud.riskLevel === "MEDIUM" ? "caution" : null)}
        emptyMessage="No withdrawals in this state."
      />
      {data ? <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} /> : null}
      {openPayoutId ? <PayoutDetailPanel key={openPayoutId} payoutId={openPayoutId} onClose={() => setOpenPayoutId(null)} onChanged={reload} /> : null}
    </>
  );
}
